// Сервер для настоящих интеграций (Cloudflare Workers).
//
// Маршруты:
//   POST /order     — заявка с сайта → Telegram менеджеру и внешняя CRM
//   POST /telegram  — вебхук Telegram-бота
//   POST /vk        — Callback API сообщества ВКонтакте
//   POST /max       — вебхук бота MAX
//   POST /alice     — навык Алисы (Яндекс Диалоги)
//   POST /avito     — вебхук Авито Мессенджера (v3)
//   POST /llm       — нейросеть для живого диалога (Claude или OpenAI-совместимая модель); ключи — только здесь
//
// Переменные окружения (секреты — через `wrangler secret put` или панель Cloudflare):
//   TG_BOT_TOKEN, TG_SECRET           — токен клиентского бота и секрет вебхука (необязательно)
//   TG_MANAGER_CHAT_ID                — куда слать заявки менеджеру (можно тем же ботом)
//   VK_TOKEN, VK_CONFIRMATION, VK_SECRET — ключ сообщества, строка подтверждения и секрет Callback API
//   MAX_TOKEN                         — токен бота MAX
//   AVITO_CLIENT_ID, AVITO_CLIENT_SECRET — ключи приложения Авито (личный кабинет → API);
//                                       токен доступа сервер получает и обновляет сам
//   ANTHROPIC_API_KEY, CLAUDE_MODEL   — ключ Claude API и модель (по умолчанию claude-opus-5-5)
//   OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL — для OpenAI или любой совместимой модели
//   CRM_WEBHOOK_URL                   — входящий вебхук вашей CRM (amoCRM, Bitrix24 и т. п.)
//   ALLOWED_ORIGIN                    — адрес сайта для CORS
// Хранилище: KV-пространство SESSIONS (состояние диалогов и заявки из мессенджеров).
// Без него сервер работает, но после перезапуска забывает, на каком шаге был клиент.

import Anthropic from "@anthropic-ai/sdk";
import messages from "../js/messages.js";
import channels from "../js/channels.js";
import storeLib from "../js/store.js";

export const formatTelegram = messages.formatTelegram;

export function checkPayload(o) {
  if (!o || typeof o !== "object") return "Пустое тело запроса";
  if (typeof o.id !== "string" || !/^[A-Za-zА-ЯЁа-яё]{1,6}-(\d{4}-)?\d+$/.test(o.id)) return "Некорректный номер заявки";
  if (!o.customer || typeof o.customer.name !== "string" || !/^\+7\d{10}$/.test(o.customer.phone || "")) return "Нет имени или телефона клиента";
  if (o.kind === "order" && (!Array.isArray(o.items) || !o.items.length)) return "В заказе нет букетов";
  return null;
}

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const memoryKV = new Map();
function kv(env) {
  if (env.SESSIONS) return { get: (k) => env.SESSIONS.get(k, "json"), put: (k, v) => env.SESSIONS.put(k, JSON.stringify(v)) };
  return { get: async (k) => memoryKV.get(k) ?? null, put: async (k, v) => void memoryKV.set(k, v) };
}

// Отправка заявки менеджеру и во внешнюю CRM. Возвращает { telegram?: bool, crm?: bool }.
async function forward(order, env, fetchImpl) {
  const results = {};
  const managerChat = env.TG_MANAGER_CHAT_ID || env.TG_CHAT_ID;
  if (env.TG_BOT_TOKEN && managerChat) {
    const res = await fetchImpl(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: managerChat, text: formatTelegram(order) }),
    });
    results.telegram = res.ok;
  }
  if (env.CRM_WEBHOOK_URL) {
    const res = await fetchImpl(env.CRM_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) });
    results.crm = res.ok;
  }
  return results;
}

// Вызов API платформы по описанию из channels.render().
// Токен Авито живёт сутки: берём новый по client_credentials и держим в KV, пока не истечёт.
async function avitoToken(env, fetchImpl) {
  const db = kv(env);
  const cached = await db.get("avito:token");
  if (cached && cached.until > Date.now() + 60000) return cached.token;
  const res = await fetchImpl("https://api.avito.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.AVITO_CLIENT_ID || "", client_secret: env.AVITO_CLIENT_SECRET || "" }).toString(),
  });
  if (!res.ok) throw new Error("Авито не выдал токен: " + res.status);
  const data = await res.json();
  await db.put("avito:token", { token: data.access_token, until: Date.now() + (Number(data.expires_in) || 86400) * 1000 });
  return data.access_token;
}

function apiRequest(channel, call, env, token) {
  if (channel === "avito") {
    return [`https://api.avito.ru${call.path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(call.body) }];
  }
  if (channel === "telegram") {
    return [`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${call.method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(call.body) }];
  }
  if (channel === "vk") {
    const form = new URLSearchParams({ ...Object.fromEntries(Object.entries(call.body).map(([k, v]) => [k, String(v)])), access_token: env.VK_TOKEN, v: "5.199" });
    return [`https://api.vk.com/method/${call.method}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() }];
  }
  if (channel === "max") {
    const [verb, path] = call.method.split(" ");
    const q = new URLSearchParams(call.query || {});
    return [`https://platform-api.max.ru${path}?${q}`, { method: verb, headers: { "Content-Type": "application/json", Authorization: env.MAX_TOKEN }, body: JSON.stringify(call.body) }];
  }
  throw new Error("Нет API для канала " + channel);
}

async function handleChannel(channel, request, env, fetchImpl) {
  if (channel === "telegram" && env.TG_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TG_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  let update;
  try {
    update = await request.json();
  } catch (e) {
    return new Response("bad json", { status: 400 });
  }
  if (channel === "vk" && env.VK_SECRET && update.secret !== env.VK_SECRET) return new Response("forbidden", { status: 403 });

  const db = kv(env);
  const storage = storeLib.memoryStorage();
  const saved = await db.get("crm");
  if (saved) storage.setItem(storeLib.STORAGE_KEY, JSON.stringify(saved));
  const store = storeLib.createStore({ storage });
  const created = [];
  const ctx = { now: () => new Date(), create: (i) => { const r = store.create(i); created.push(r); return r; }, lookup: (id) => store.get(id) };

  const result = await channels.handle(channel, update, { ctx, sessions: { get: (k) => db.get("s:" + k), set: (k, v) => db.put("s:" + k, v) } });

  if (result.kind === "confirmation") return new Response(env.VK_CONFIRMATION || "", { status: 200 });
  if (created.length) {
    await db.put("crm", JSON.parse(storage.getItem(storeLib.STORAGE_KEY)));
    for (const rec of created) await forward(rec, env, fetchImpl);
  }
  if (channel === "alice") return Response.json(result.calls[0].body);
  const token = channel === "avito" && result.calls.length ? await avitoToken(env, fetchImpl) : null;
  for (const call of result.calls) await fetchImpl(...apiRequest(channel, call, env, token));
  return new Response(channel === "vk" ? "ok" : "", { status: 200 });
}

// Нейросеть для живого диалога. Браузер присылает разговор и черновик ответа бота, получает текст.
// Проверку фактов делает js/llm.js на стороне стенда; здесь — только вызов модели с ключом сервера.
async function handleLlm(request, env, fetchImpl) {
  const headers = { ...cors(env), "Content-Type": "application/json; charset=utf-8" };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (env.ALLOWED_ORIGIN && request.headers.get("Origin") !== env.ALLOWED_ORIGIN) return reply(403, { error: "Чужой сайт" });
  let body;
  try { body = await request.json(); } catch (e) { return reply(400, { error: "Тело запроса не JSON" }); }
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  const valid = msgs.length > 0 && msgs.length <= 20 && msgs.every((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length <= 4000) && msgs[0].role === "user";
  if (!valid || typeof body.system !== "string" || body.system.length > 6000) return reply(400, { error: "Неверный разговор" });

  if (body.provider === "openai") {
    if (!env.OPENAI_API_KEY) return reply(501, { error: "OpenAI не настроен на сервере" });
    const res = await fetchImpl(`${(env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.OPENAI_MODEL, response_format: { type: "json_object" }, messages: [{ role: "system", content: body.system }, ...msgs] }),
    });
    if (!res.ok) return reply(502, { error: `Модель ответила ${res.status}` });
    return reply(200, { text: (await res.json()).choices[0].message.content });
  }

  if (!env.ANTHROPIC_API_KEY) return reply(501, { error: "Claude не настроен на сервере" });
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, fetch: fetchImpl, maxRetries: 1 });
  try {
    // Короткая реплика в чате — низкое усилие; при отказе основной модели запрос подхватит резервная.
    const response = await client.beta.messages.create({
      model: env.CLAUDE_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: body.system,
      messages: msgs,
    });
    if (response.stop_reason === "refusal") return reply(200, { text: null, refusal: true });
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return reply(200, { text, model: response.model });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return reply(429, { error: "Слишком много запросов к Claude" });
    if (e instanceof Anthropic.AuthenticationError) return reply(502, { error: "Неверный ключ Claude на сервере" });
    if (e instanceof Anthropic.APIError) return reply(502, { error: `Claude ответил ${e.status}` });
    return reply(502, { error: "Claude недоступен" });
  }
}

export async function handle(request, env, fetchImpl = fetch) {
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  const headers = { ...cors(env), "Content-Type": "application/json; charset=utf-8" };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
  if (request.method !== "POST") return reply(405, { ok: false, error: "Используйте POST" });

  if (path === "/llm") return handleLlm(request, env, fetchImpl);
  const channel = { "/telegram": "telegram", "/vk": "vk", "/max": "max", "/alice": "alice", "/avito": "avito" }[path];
  if (channel) return handleChannel(channel, request, env, fetchImpl);

  let order;
  try {
    order = await request.json();
  } catch (e) {
    return reply(400, { ok: false, error: "Тело запроса не JSON" });
  }
  const problem = checkPayload(order);
  if (problem) return reply(400, { ok: false, error: problem });

  const results = await forward(order, env, fetchImpl);
  const failed = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
  if (failed.length) return reply(502, { ok: false, error: "Не доставлено: " + failed.join(", "), results });
  return reply(200, { ok: true, results });
}

export default { fetch: (request, env) => handle(request, env) };
