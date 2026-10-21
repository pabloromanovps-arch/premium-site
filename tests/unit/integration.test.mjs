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
    calls.push({ url, body: JSON.parse(init.body) });
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
  assert.equal(formatTelegram(cb), "Заявка на звонок ЗВ-1001 (чат-бот)\nАнна, +79261112233\nТема: Свадьба");
});
