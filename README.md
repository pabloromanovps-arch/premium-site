# Стебель — цветочный магазин с чат-ботом и CRM

Учебный стенд для обкатки всей цепочки продаж: сайт → чат-бот → CRM → Telegram или внешняя CRM.
Чистый HTML/CSS/JS, сборка не нужна.

| Что | Где |
| --- | --- |
| Магазин: каталог, корзина, оформление заказа | `index.html`, `js/shop.js` |
| Чат-бот по сценариям | `js/bot.js` (логика), `js/chat.js` (окно чата) |
| Демо-CRM для менеджеров | `crm.html`, `js/crm.js`, `js/store.js` |
| Правила: телефоны, даты, интервалы, доставка | `js/validate.js`, `js/cart.js` |
| Сервер для Telegram и внешней CRM | `server/worker.mjs` |
| Тесты | `tests/` — подробно в [TESTING.md](TESTING.md) |

## Как запустить

**Без установки.** Скачайте репозиторий (Code → Download ZIP), распакуйте и откройте `index.html` двойным кликом.
CRM — файл `crm.html` рядом.

**Через локальный сервер** (нужен Node.js 18+):

```bash
npm start            # сайт: http://localhost:4173, CRM: http://localhost:4173/crm.html
```

**В интернете.** GitHub → Settings → Pages → Branch: эта ветка, папка `/ (root)` → Save.

## Режимы работы

- **Демо (по умолчанию).** Заказы и заявки хранятся в браузере (localStorage) и сразу видны в CRM на этом же устройстве.
- **Настоящие интеграции.** Разверните `server/worker.mjs` на Cloudflare Workers (`npx wrangler deploy`), задайте секреты
  `TG_BOT_TOKEN`, `TG_CHAT_ID` и при необходимости `CRM_WEBHOOK_URL`, затем впишите адрес воркера в `js/config.js`
  (`webhookUrl`). Заказы продолжат сохраняться в демо-CRM, а копия уйдёт в Telegram и вашу CRM.
  Результат отправки виден в истории заявки.
