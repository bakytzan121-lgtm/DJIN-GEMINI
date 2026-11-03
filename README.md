# DJIN

Независимый веб-ассистент DJIN.

## Запуск локально

Требуется Node.js 20 или новее.

```bash
npm start
```

Откройте `http://localhost:3000`.

## Развёртывание на Render

Создайте Web Service из этого GitHub-репозитория:

- Runtime: Node
- Build Command: оставить пустым
- Start Command: `npm start`
- Environment: `OPENAI_API_KEY` — секретный API-ключ OpenAI
- Не добавляйте ключ в GitHub и не записывайте его в исходный код.

Дополнительно можно задать `OPENAI_MODEL`; по умолчанию используется `gpt-4o-mini`.

Проверка состояния: `/health`.
Интерфейс чата: корневая страница `/`.
API чата: `POST /api/chat`.
