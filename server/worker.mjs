// Сервер для настоящих интеграций (Cloudflare Workers).
// Принимает заявку с сайта и пересылает её в Telegram и/или во внешнюю CRM.
//
// Переменные окружения (секреты задаются в панели Cloudflare или через `wrangler secret put`):
//   TG_BOT_TOKEN   — токен бота от @BotFather
//   TG_CHAT_ID     — id чата, куда слать заявки
//   CRM_WEBHOOK_URL — входящий вебхук CRM (amoCRM, Bitrix24 и т. п.), необязательно
//   ALLOWED_ORIGIN — адрес сайта, например https://user.github.io; по умолчанию разрешены все

const STATUS = { new: "Новый" };
const rub = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

export function checkPayload(o) {
  if (!o || typeof o !== "object") return "Пустое тело запроса";
  if (typeof o.id !== "string" || !/^(СТ|ЗВ)-\d+$/.test(o.id)) return "Некорректный номер заявки";
  if (!o.customer || typeof o.customer.name !== "string" || !/^\+7\d{10}$/.test(o.customer.phone || "")) return "Нет имени или телефона клиента";
  if (o.kind === "order" && (!Array.isArray(o.items) || !o.items.length)) return "В заказе нет букетов";
  return null;
}

export function formatTelegram(o) {
  const src = o.source === "chat" ? "чат-бот" : "сайт";
  if (o.kind === "callback") {
    return `Заявка на звонок ${o.id} (${src})\n${o.customer.name}, ${o.customer.phone}\nТема: ${o.topic || "—"}`;
  }
  const items = o.items.map((i) => `• ${i.name} ×${i.qty} — ${rub(i.price * i.qty)}`).join("\n");
  const where = o.fulfillment === "pickup" ? "Самовывоз" : `Доставка: ${o.address}`;
  return [
    `Новый заказ ${o.id} (${src}), статус: ${STATUS[o.status] || o.status}`,
    items,
    `${o.date}, интервал ${o.slot}`,
    where,
    `${o.customer.name}, ${o.customer.phone}`,
    o.note ? `Открытка: ${o.note}` : "",
    `Итого: ${rub(o.totals.total)}`,
  ].filter(Boolean).join("\n");
}

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function handle(request, env, fetchImpl = fetch) {
  const headers = { ...cors(env), "Content-Type": "application/json; charset=utf-8" };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
  if (request.method !== "POST") return reply(405, { ok: false, error: "Используйте POST" });

  let order;
  try {
    order = await request.json();
  } catch (e) {
    return reply(400, { ok: false, error: "Тело запроса не JSON" });
  }
  const problem = checkPayload(order);
  if (problem) return reply(400, { ok: false, error: problem });

  const results = {};
  if (env.TG_BOT_TOKEN && env.TG_CHAT_ID) {
    const res = await fetchImpl(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: formatTelegram(order) }),
    });
    results.telegram = res.ok;
  }
  if (env.CRM_WEBHOOK_URL) {
    const res = await fetchImpl(env.CRM_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    results.crm = res.ok;
  }

  const failed = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) return reply(502, { ok: false, error: "Не доставлено: " + failed.join(", "), results });
  return reply(200, { ok: true, results });
}

export default { fetch: (request, env) => handle(request, env) };
