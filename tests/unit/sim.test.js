const test = require("node:test");
const assert = require("node:assert/strict");
const sim = require("../../js/sim.js");
const S = require("../../js/store.js");
const messages = require("../../js/messages.js");

const REAL = Date.parse("2026-10-21T07:30:00Z");
const mk = () => sim.createSim({ realNow: () => REAL, sleep: () => Promise.resolve() });

test("машина времени: setTime и resetTime", () => {
  const s = mk();
  assert.equal(s.now().getTime(), REAL);
  s.setTime("2026-10-21T20:30:00+03:00");
  assert.equal(s.now().toISOString(), "2026-10-21T17:30:00.000Z");
  s.resetTime();
  assert.equal(s.now().getTime(), REAL);
});

test("настройки по умолчанию и частичное обновление", () => {
  const s = mk();
  assert.deepEqual(s.settings(), sim.DEFAULTS);
  s.setSettings({ crmDown: true });
  assert.equal(s.settings().crmDown, true);
  assert.equal(s.settings().latencyMs, sim.DEFAULTS.latencyMs);
});

test("вебхук пишет в журнал Telegram и CRM", async () => {
  const s = mk();
  const store = S.createStore({ webhook: s.webhook, now: s.now });
  const rec = store.create({ kind: "callback", source: "chat", name: "Анна", phone: "+79261112233", topic: "Свадьба" });
  await store.flush();
  assert.equal(s.outbox.list("telegram")[0].text, messages.formatTelegram(rec));
  assert.equal(JSON.parse(s.outbox.list("crm")[0].text).id, rec.id);
});

test("сбой CRM: ошибка с понятным текстом, Telegram при этом отправлен", async () => {
  const s = mk();
  s.setSettings({ crmDown: true });
  await assert.rejects(s.webhook.send({ id: "ЗВ-1", kind: "callback", customer: { name: "a", phone: "+79990000000" } }), /внешняя CRM недоступна \(симуляция\)/);
  assert.equal(s.outbox.list("telegram").length, 1);
  assert.equal(s.outbox.list("crm").length, 0);
});

test("журнал: новые сверху, не больше лимита, очистка", () => {
  const s = mk();
  for (let i = 0; i < 310; i++) s.outbox.push({ channel: "sms", text: String(i) });
  const all = s.outbox.list();
  assert.equal(all.length, 300);
  assert.equal(all[0].text, "309");
  s.outbox.clear();
  assert.equal(s.outbox.list().length, 0);
});

test("SMS клиенту по событиям заказа", () => {
  const o = { id: "СТ-1001", kind: "order", slot: "12-15", totals: { total: 4390 } };
  assert.match(messages.customerSms(o, { type: "status", status: "confirmed" }), /4\s390 ₽\. Оплатить: pay\.html#%D0%A1%D0%A2-1001/);
  assert.match(messages.customerSms(o, { type: "status", status: "delivering" }), /12:00–15:00/);
  assert.equal(messages.customerSms(o, { type: "status", status: "assembling" }), null);
  assert.equal(messages.customerSms({ ...o, kind: "callback" }, { type: "created" }), null);
});

test("уведомление менеджеру: канал по-русски, дата и интервал по-человечески", () => {
  const o = { id: "СТ-1001", kind: "order", source: "vk", status: "new", date: "2026-10-23", slot: "9-12", fulfillment: "pickup",
    customer: { name: "Игорь", phone: "+79037654321" }, items: [{ name: "Бордо", price: 6800, qty: 1 }], totals: { total: 6800 } };
  const text = messages.formatTelegram(o);
  assert.match(text, /^Новый заказ СТ-1001 \(ВКонтакте\)/);
  assert.match(text, /23 октября, 9:00–12:00/);
});
