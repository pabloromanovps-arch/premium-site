// Интеграционный уровень: сайт → вебхук → сервер → Telegram/CRM. Сеть подменяется, реальные запросы не уходят.
import test from "node:test";
import assert from "node:assert/strict";
import S from "../../js/store.js";
import { handle, formatTelegram, checkPayload } from "../../server/worker.mjs";

const input = {
  kind: "order", source: "site", name: "Мария", phone: "+79161234567", fulfillment: "delivery",
  address: "Остоженка, 7", date: "2026-10-22", slot: "12-15", note: "С днём рождения",
  items: [{ id: "dacha", name: "Утро на даче", price: 3900, qty: 1 }],
};

function fakeNet(status = 200) {
  const calls = [];
  const fetch = async (url, init) => {
    let body;
    try { body = JSON.parse(init.body); } catch { body = Object.fromEntries(new URLSearchParams(init.body)); }
    calls.push({ url, body });
    return new Response("{}", { status });
  };
  return { calls, fetch };
}

const env = { TG_BOT_TOKEN: "test-token", TG_CHAT_ID: "42", CRM_WEBHOOK_URL: "https://crm.example/hook" };
const post = (body) => new Request("https://worker.example/", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

test("сайт отправляет заказ на вебхук и отмечает успех в истории", async () => {
  const net = fakeNet(200);
  const s = S.createStore({ storage: S.memoryStorage(), webhook: S.createWebhook("https://worker.example/", net.fetch) });
  const rec = s.create(input);
  await s.flush();
  assert.equal(net.calls.length, 1);
  assert.equal(net.calls[0].body.id, rec.id);
  const sync = s.get(rec.id).history.at(-1);
  assert.deepEqual([sync.type, sync.ok], ["sync", true]);
});

test("ошибка вебхука не теряет заказ, а пишется в историю", async () => {
  const net = fakeNet(500);
  const s = S.createStore({ storage: S.memoryStorage(), webhook: S.createWebhook("https://worker.example/", net.fetch) });
  const rec = s.create(input);
  await s.flush();
  const sync = s.get(rec.id).history.at(-1);
  assert.equal(sync.ok, false);
  assert.match(sync.text, /500/);
  assert.equal(s.list().length, 1);
});

test("сервер пересылает заказ в Telegram и CRM", async () => {
  const rec = S.createStore({ storage: S.memoryStorage() }).create(input);
  const net = fakeNet(200);
  const res = await handle(post(rec), env, net.fetch);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, results: { telegram: true, crm: true } });
  assert.equal(net.calls[0].url, "https://api.telegram.org/bottest-token/sendMessage");
  assert.equal(net.calls[0].body.chat_id, "42");
  assert.match(net.calls[0].body.text, /Новый заказ СТ-1001 \(сайт\)/);
  assert.equal(net.calls[1].url, env.CRM_WEBHOOK_URL);
  assert.equal(net.calls[1].body.id, "СТ-1001");
});

test("сервер возвращает 502, если Telegram недоступен", async () => {
  const rec = S.createStore({ storage: S.memoryStorage() }).create(input);
  const res = await handle(post(rec), { TG_BOT_TOKEN: "t", TG_CHAT_ID: "1" }, fakeNet(503).fetch);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /telegram/);
});

test("сервер отклоняет мусор и не ходит в сеть", async () => {
  const net = fakeNet();
  assert.equal((await handle(post("не json"), env, net.fetch)).status, 400);
  assert.equal((await handle(post({ id: "СТ-1", customer: { name: "x", phone: "123" } }), env, net.fetch)).status, 400);
  assert.equal((await handle(new Request("https://w/", { method: "GET" }), env, net.fetch)).status, 405);
  assert.equal((await handle(new Request("https://w/", { method: "OPTIONS" }), env, net.fetch)).status, 204);
  assert.equal(net.calls.length, 0);
});

test("checkPayload и текст для Telegram по звонку", () => {
  const cb = S.createStore({ storage: S.memoryStorage() }).create({ kind: "callback", source: "chat", name: "Анна", phone: "+79261112233", topic: "Свадьба" });
  assert.equal(checkPayload(cb), null);
  assert.equal(formatTelegram(cb), "Заявка на звонок ЗВ-1001 (чат на сайте)\nАнна, +79261112233\nТема: Свадьба");
});

// ---------- вебхуки мессенджеров на сервере ----------
const chatEnv = { TG_BOT_TOKEN: "tg", TG_MANAGER_CHAT_ID: "100", VK_TOKEN: "vk", VK_CONFIRMATION: "abc123", VK_SECRET: "sec", MAX_TOKEN: "mx" };
const at = (path, body, headers = {}) => new Request("https://worker.example" + path, { method: "POST", headers, body: JSON.stringify(body) });

test("сервер: Telegram-бот отвечает через sendMessage с кнопками", async () => {
  const net = fakeNet();
  const res = await handle(at("/telegram", { update_id: 1, message: { chat: { id: 42 }, text: "/start" } }), chatEnv, net.fetch);
  assert.equal(res.status, 200);
  assert.equal(net.calls[0].url, "https://api.telegram.org/bottg/sendMessage");
  assert.equal(net.calls[0].body.chat_id, "42");
  assert.ok(net.calls[0].body.reply_markup.inline_keyboard.length >= 4);
});

test("сервер: секрет Telegram проверяется", async () => {
  const res = await handle(at("/telegram", { message: { chat: { id: 1 }, text: "hi" } }, { "X-Telegram-Bot-Api-Secret-Token": "wrong" }), { ...chatEnv, TG_SECRET: "right" }, fakeNet().fetch);
  assert.equal(res.status, 403);
});

test("сервер: ВКонтакте — строка подтверждения, секрет и ответ «ok»", async () => {
  const net = fakeNet();
  const conf = await handle(at("/vk", { type: "confirmation", group_id: 1, secret: "sec" }), chatEnv, net.fetch);
  assert.equal(await conf.text(), "abc123");
  assert.equal((await handle(at("/vk", { type: "message_new", secret: "bad", object: { message: { peer_id: 1, text: "x" } } }), chatEnv, net.fetch)).status, 403);
  const res = await handle(at("/vk", { type: "message_new", secret: "sec", object: { message: { peer_id: 7, text: "Начать" } } }), chatEnv, net.fetch);
  assert.equal(await res.text(), "ok");
  assert.equal(net.calls[0].url, "https://api.vk.com/method/messages.send");
  assert.equal(net.calls[0].body.peer_id, "7");
  assert.equal(net.calls[0].body.access_token, "vk");
  assert.equal(JSON.parse(net.calls[0].body.keyboard).inline, true);
});

test("сервер: MAX — POST /messages с токеном в заголовке", async () => {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init }); return new Response("{}"); };
  await handle(at("/max", { update_type: "bot_started", chat_id: 9001 }), chatEnv, f);
  assert.equal(calls[0].url, "https://platform-api.max.ru/messages?chat_id=9001");
  assert.equal(calls[0].init.headers.Authorization, "mx");
});

test("сервер: Алиса — ответ JSON в формате Яндекс Диалогов", async () => {
  const res = await handle(at("/alice", { version: "1.0", session: { session_id: "s", new: true }, request: { command: "", original_utterance: "" } }), chatEnv, fakeNet().fetch);
  const body = await res.json();
  assert.equal(body.version, "1.0");
  assert.ok(body.response.text.length > 0 && body.response.text.length <= 1024);
  assert.ok(body.session_state.bot);
});

test("сервер: заказ в Telegram-боте уходит менеджеру и в CRM, номер растёт", async () => {
  const net = fakeNet();
  const env = { ...chatEnv, CRM_WEBHOOK_URL: "https://crm.example/hook" };
  const say = (text) => handle(at("/telegram", { message: { chat: { id: 77 }, text } }), env, net.fetch);
  for (const t of ["бордо на завтра утром, заберу сам", "Игорь", "9037654321", "да"]) await say(t);
  const toManager = net.calls.filter((c) => c.body.chat_id === "100");
  assert.equal(toManager.length, 1);
  assert.match(toManager[0].body.text, /Новый заказ СТ-\d+ \(Telegram\)/);
  assert.ok(net.calls.some((c) => c.url === "https://crm.example/hook" && c.body.source === "telegram"));
});

test("сервер: Авито — берёт токен по ключам приложения и отвечает в чат объявления", async () => {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    if (url === "https://api.avito.ru/token") return new Response(JSON.stringify({ access_token: "tok-1", expires_in: 86400 }));
    return new Response("{}");
  };
  const env = { AVITO_CLIENT_ID: "id", AVITO_CLIENT_SECRET: "sec" };
  const body = { payload: { type: "message", value: { chat_id: "u2i-9", user_id: 42, author_id: 7, type: "text", content: { text: "Здравствуйте, ещё актуально?" }, item_id: 4012345602 } } };
  const res = await handle(at("/avito", body), env, f);
  assert.equal(res.status, 200);
  assert.equal(calls[0].url, "https://api.avito.ru/token");
  assert.match(calls[0].init.body, /grant_type=client_credentials/);
  const send = calls.find((c) => c.url.includes("/messenger/"));
  assert.equal(send.url, "https://api.avito.ru/messenger/v1/accounts/42/chats/u2i-9/messages");
  assert.equal(send.init.headers.Authorization, "Bearer tok-1");
  assert.match(JSON.parse(send.init.body).message.text, /25 тюльпанов/);
  // второе сообщение — токен из кэша, без нового запроса
  await handle(at("/avito", { payload: { ...body.payload, value: { ...body.payload.value, content: { text: "1" } } } }), env, f);
  assert.equal(calls.filter((c) => c.url === "https://api.avito.ru/token").length, 1);
});

// ---------- нейросеть на сервере ----------
const llmBody = { provider: "claude", system: "Ты продавец.", messages: [{ role: "user", content: "ЧЕРНОВИК: Здравствуйте!" }] };
const hdr = (h, k) => (h && typeof h.get === "function" ? h.get(k) : h && (h[k] || h[k.toLowerCase()]));

test("сервер /llm: Claude через официальный SDK — модель, низкое усилие, резервная модель при отказе", async () => {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: "{\"reply\":\"Добрый день!\"}" }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } }), { headers: { "Content-Type": "application/json" } });
  };
  const res = await handle(at("/llm", llmBody), { ANTHROPIC_API_KEY: "sk-ant-test" }, f);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: "{\"reply\":\"Добрый день!\"}", model: "claude-opus-5-5" });
  assert.match(calls[0].url, /^https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.equal(calls[0].body.model, "claude-opus-5-5");
  assert.equal(calls[0].body.fallbacks, "default");
  assert.deepEqual(calls[0].body.output_config, { effort: "low" });
  assert.match(hdr(calls[0].init.headers, "anthropic-beta"), /server-side-fallback-2026-07-01/);
  assert.match(hdr(calls[0].init.headers, "authorization") || hdr(calls[0].init.headers, "x-api-key"), /sk-ant-test/);
});

test("сервер /llm: отказ модели — пустой текст, стенд ответит правилами", async () => {
  const f = async () => new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: "refusal", stop_sequence: null, stop_details: { type: "refusal", category: null, explanation: "" }, usage: { input_tokens: 1, output_tokens: 0 } }), { headers: { "Content-Type": "application/json" } });
  const res = await handle(at("/llm", llmBody), { ANTHROPIC_API_KEY: "k" }, f);
  assert.deepEqual(await res.json(), { text: null, refusal: true });
});

test("сервер /llm: без ключа, с мусором и с чужого сайта — отказ без обращения к модели", async () => {
  const net = fakeNet();
  assert.equal((await handle(at("/llm", llmBody), {}, net.fetch)).status, 501);
  assert.equal((await handle(at("/llm", { ...llmBody, messages: [{ role: "assistant", content: "x" }] }), { ANTHROPIC_API_KEY: "k" }, net.fetch)).status, 400);
  assert.equal((await handle(at("/llm", llmBody, { Origin: "https://evil.example" }), { ANTHROPIC_API_KEY: "k", ALLOWED_ORIGIN: "https://ok.example" }, net.fetch)).status, 403);
  assert.equal(net.calls.length, 0);
});

test("сервер /llm: OpenAI-совместимая модель с ключом сервера", async () => {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ choices: [{ message: { content: "{\"reply\":\"ok\"}" } }] })); };
  const res = await handle(at("/llm", { ...llmBody, provider: "openai" }), { OPENAI_API_KEY: "sk-o", OPENAI_BASE_URL: "http://gpu.local:8000/v1", OPENAI_MODEL: "qwen" }, f);
  assert.deepEqual(await res.json(), { text: "{\"reply\":\"ok\"}" });
  assert.equal(calls[0].url, "http://gpu.local:8000/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer sk-o");
});
