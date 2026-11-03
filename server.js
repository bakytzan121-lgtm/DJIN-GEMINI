const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const PAGE = fs.readFileSync(path.join(__dirname, "public", "index.html"));

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Слишком большой запрос"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch { reject(new Error("Некорректный JSON")); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return send(res, 200, PAGE, "text/html; charset=utf-8");
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, {
      ok: true,
      assistant: "DJIN",
      provider: "OPENAI",
      openaiConfigured: Boolean(OPENAI_API_KEY),
      model: OPENAI_MODEL
    });
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    if (!OPENAI_API_KEY) {
      return send(res, 503, {
        ok: false,
        error: "На сервере не задан OPENAI_API_KEY. Добавьте ключ в Render → Environment."
      });
    }

    let body;
    try { body = await readBody(req); }
    catch (error) { return send(res, 400, { ok: false, error: error.message }); }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const safeMessages = messages
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content.slice(0, 12000) }));

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return send(res, 400, { ok: false, error: "Напишите сообщение для DJIN." });
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content: "Ты DJIN — самостоятельный, внимательный AI-ассистент. Отвечай на русском языке, если пользователь пишет по-русски. Давай точные пошаговые инструкции. Не утверждай, что выполнил действия во внешних сервисах, если это не подтверждено."
            },
            ...safeMessages
          ],
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(60000)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = result.error?.message || `OpenAI API вернул ошибку ${response.status}`;
        return send(res, response.status === 429 ? 429 : 502, { ok: false, error: message });
      }

      const answer = result.choices?.[0]?.message?.content;
      if (!answer) return send(res, 502, { ok: false, error: "AI не вернул текст ответа." });
      return send(res, 200, { ok: true, assistant: "DJIN", reply: answer });
    } catch (error) {
      const timeout = error.name === "TimeoutError" || error.name === "AbortError";
      return send(res, 502, {
        ok: false,
        error: timeout ? "Превышено время ожидания ответа. Попробуйте ещё раз." : "Не удалось связаться с AI-сервисом."
      });
    }
  }

  return send(res, 404, { ok: false, error: "Страница не найдена." });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DJIN запущен на порту ${PORT}`);
});
