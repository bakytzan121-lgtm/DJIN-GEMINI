const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const PAGE = fs.readFileSync(path.join(__dirname, "public", "index.html"));
let aiClient;

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

async function getAI() {
  if (!GEMINI_API_KEY) throw new Error("На сервере не задан GEMINI_API_KEY. Добавьте ключ Google AI Studio в Render → Environment.");
  if (!aiClient) {
    const { GoogleGenAI } = await import("@google/genai");
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return aiClient;
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
      provider: "GEMINI",
      geminiConfigured: Boolean(GEMINI_API_KEY),
      model: GEMINI_MODEL
    });
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    let body;
    try { body = await readBody(req); }
    catch (error) { return send(res, 400, { ok: false, error: error.message }); }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const safeMessages = messages
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-20)
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content.slice(0, 12000) }]
      }));

    if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== "user") {
      return send(res, 400, { ok: false, error: "Напишите сообщение для DJIN." });
    }

    try {
      const ai = await getAI();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: safeMessages,
        config: {
          systemInstruction: "Ты DJIN — самостоятельный, внимательный AI-ассистент. Отвечай на русском языке, если пользователь пишет по-русски. Давай точные пошаговые инструкции. Не утверждай, что выполнил действия во внешних сервисах, если это не подтверждено."
        }
      });

      const answer = response.text;
      if (!answer) return send(res, 502, { ok: false, error: "AI не вернул текст ответа." });
      return send(res, 200, { ok: true, assistant: "DJIN", reply: answer });
    } catch (error) {
      console.error("Gemini request failed:", error.message);
      const message = error.message || "Не удалось связаться с Gemini.";
      const status = Number(error.status || error.code);
      return send(res, status === 429 ? 429 : 502, {
        ok: false,
        error: message.includes("GEMINI_API_KEY")
          ? message
          : status === 429
            ? "Превышен лимит запросов Gemini. Попробуйте немного позже."
            : "Не удалось получить ответ от AI-сервиса. Проверьте ключ Gemini и настройки Render."
      });
    }
  }

  return send(res, 404, { ok: false, error: "Страница не найдена." });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DJIN запущен на порту ${PORT}`);
});
