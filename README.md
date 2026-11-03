# DJIN

Независимый AI-ассистент DJIN на базе Google Gemini.

## Локальный запуск

Требуется Node.js 22 или новее.

1. Установите зависимости: `npm install`
2. Задайте переменную окружения `GEMINI_API_KEY` (ключ Google AI Studio).
3. Запустите: `npm start`
4. Откройте `http://localhost:3000`.

## Развёртывание на Render

Создайте Web Service из этого GitHub-репозитория:

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Node version: 22 или новее
- Environment Variable: `GEMINI_API_KEY` — секретный ключ Google AI Studio.
- Дополнительно: `GEMINI_MODEL` — модель Gemini; по умолчанию `gemini-flash-latest`.

Не добавляйте API-ключ в GitHub и не записывайте его в исходный код. Для этого проекта не нужен ключ OpenAI.

Проверка состояния: `/health`.
Интерфейс чата: корневая страница `/`.
API чата: `POST /api/chat`.
