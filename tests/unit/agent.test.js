// ИИ-агент: не даёт заявкам потеряться, действует один раз и только в рабочее время.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../js/store.js");
const agent = require("../../js/agent.js");
const profile = require("../../js/profile.js");

const at = (msk) => new Date(`2026-10-21T${msk}:00+03:00`);
function setup(createdMsk, extra = {}) {
  let t = at(createdMsk);
  const store = S.createStore({ storage: S.memoryStorage(), now: () => t });
  const sent = { manager: [], client: [] };
  const notify = { manager: (text, r) => sent.manager.push([r.id, text]), client: (text, r) => sent.client.push([r.id, text]) };
  const rec = store.create({ kind: "order", source: "avito", name: "Алина", phone: "+79161212121", fulfillment: "pickup", date: "2026-10-22", slot: "12-15", items: [{ id: "bordo", name: "Бордо", price: 6800, qty: 1 }], ...extra });
  const run = (msk) => { t = at(msk); return agent.tick({ store, now: t, profile: profile.DEFAULT, notify }); };
  return { store, rec, sent, run, setT: (msk) => (t = at(msk)) };
}
const codes = (acts) => acts.map((a) => a.code);

test("днём: напомнить менеджеру через 15 минут, подтвердить самому через 30", () => {
  const s = setup("14:00");
  assert.deepEqual(codes(s.run("14:10")), []);
  assert.deepEqual(codes(s.run("14:16")), ["sla_ping"]);
  assert.match(s.sent.manager[0][1], /СТ-1001 ждёт подтверждения уже 16 мин/);
  assert.deepEqual(codes(s.run("14:20")), [], "второй раз не напоминает");
  assert.deepEqual(codes(s.run("14:31")), ["auto_confirm"]);
  const r = s.store.get(s.rec.id);
  assert.equal(r.status, "confirmed");
  assert.equal(r.history.find((h) => h.status === "confirmed").by, "ИИ-агент");
});

test("если менеджер успел, агент не вмешивается", () => {
  const s = setup("14:00");
  s.setT("14:05");
  s.store.setStatus(s.rec.id, "confirmed");
  assert.deepEqual(codes(s.run("14:40")), []);
});

test("ночью: сразу сообщение клиенту, а отсчёт для менеджера — с открытия", () => {
  const s = setup("23:30");
  assert.deepEqual(codes(s.run("23:31")), ["night_notice"]);
  assert.match(s.sent.client[0][1], /Мы откроемся в 9:00/);
  assert.deepEqual(codes(s.run("23:59")), [], "ночью менеджера не дёргает");
  // утро следующего дня
  const store = s.store;
  const next = new Date("2026-10-22T09:16:00+03:00");
  const acts = agent.tick({ store, now: next, profile: profile.DEFAULT, notify: { manager: () => {}, client: () => {} } });
  assert.deepEqual(codes(acts), ["sla_ping"], "в 9:16 — 16 минут рабочего времени");
});

test("напоминание об оплате через час после подтверждения — и только днём", () => {
  const s = setup("15:00");
  s.setT("15:05");
  s.store.setStatus(s.rec.id, "confirmed");
  assert.deepEqual(codes(s.run("15:50")), []);
  assert.deepEqual(codes(s.run("16:06")), ["pay_reminder"]);
  assert.match(s.sent.client[0][1], /напоминаем про оплату заказа СТ-1001 — 6\s800\s₽/);
  s.setT("16:20");
  s.store.pay(s.rec.id, "success");
  assert.equal(agent.summary(s.store.list()).paidAfterReminder, 1);
});

test("после выполнения агент просит оценку", () => {
  const s = setup("10:00");
  s.setT("10:05");
  for (const st of ["confirmed", "assembling", "ready", "done"]) s.store.setStatus(s.rec.id, st);
  assert.deepEqual(codes(s.run("12:10")), ["review"]);
  assert.match(s.sent.client[0][1], /как вам букет/i);
});

test("агент выключен в профиле — ничего не делает", () => {
  const s = setup("14:00");
  const off = profile.merge(profile.DEFAULT, { agent: { enabled: false } });
  assert.deepEqual(agent.tick({ store: s.store, now: at("15:00"), profile: off, notify: { manager() {}, client() {} } }), []);
});

test("звонок: напоминание менеджеру есть, автоподтверждения нет", () => {
  let t = at("11:00");
  const store = S.createStore({ storage: S.memoryStorage(), now: () => t });
  store.create({ kind: "callback", source: "avito", name: "Ирина", phone: "+79168181818", topic: "Свадьба" });
  t = at("11:40");
  const acts = agent.tick({ store, now: t, profile: profile.DEFAULT, notify: { manager() {}, client() {} } });
  assert.deepEqual(codes(acts), ["sla_ping"]);
  assert.equal(store.list()[0].status, "new");
});

test("напоминание брошенному диалогу называет, что осталось", () => {
  assert.match(agent.followUpText("phone"), /осталось только оставить телефон/);
  const ty = profile.merge(profile.DEFAULT, { tone: { address: "ты", greeting: "Привет!" } });
  assert.match(agent.followUpText("name", ty), /^Привет!.*как тебя зовут|^Привет!.*обращаться/);
});
