// Аналитика: периоды, сравнение, метрики и рекомендации.
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../../js/analytics.js");
const S = require("../../js/store.js");

const NOW = new Date(2026, 10, 9, 15, 0);
const rows = A.demoHistory({ now: NOW, seed: 3 });

test("демо-история: два года, сезонность — 8 марта и 14 февраля выше обычного дня", () => {
  assert.ok(rows.length > 10000);
  const dayCount = (y, m, d) => rows.filter((r) => { const x = new Date(r.t); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d; }).length;
  assert.ok(dayCount(2026, 3, 7) > 2.5 * dayCount(2026, 3, 18), "перед 8 марта");
  assert.ok(dayCount(2026, 2, 14) > 1.8 * dayCount(2026, 2, 24), "14 февраля");
  assert.ok(rows.every((r) => r.t <= NOW.getTime()), "будущего нет");
});

test("отчёт за месяц: дни месяца, итоги равны сумме по дням, сравнение с прошлым месяцем", () => {
  const rep = A.report(rows, { view: "month", anchor: new Date(2026, 2, 15) });
  assert.equal(rep.series.length, 31);
  assert.equal(rep.period.title, "март 2026");
  assert.equal(rep.prevPeriod.title, "февраль 2026");
  assert.equal(rep.series.reduce((s, b) => s + b.cur.orders, 0), rep.totals.orders);
  assert.equal(rep.series.reduce((s, b) => s + b.cur.revenue, 0), rep.totals.revenue);
  assert.ok(Math.abs(rep.deltas.revenue - (rep.totals.revenue - rep.prev.revenue) / rep.prev.revenue) < 1e-9);
  assert.ok(rep.totals.conversion > 0 && rep.totals.conversion < 1);
  assert.equal(rep.channels.reduce((s, c) => s + c.leads, 0), rep.totals.leads);
});

test("день — по часам, год — по месяцам; сравнение с тем же периодом год назад", () => {
  const d = A.report(rows, { view: "day", anchor: new Date(2026, 10, 3), compare: "year" });
  assert.equal(d.series.length, 24);
  assert.equal(d.prevPeriod.title, "3 ноября 2025");
  const y = A.report(rows, { view: "year", anchor: new Date(2026, 5, 1) });
  assert.equal(y.series.length, 12);
  assert.equal(y.prevPeriod.title, "2025");
});

test("эффект агента виден: после запуска выше конверсия, есть ночные заказы и допродажи", () => {
  const before = A.report(rows, { view: "month", anchor: new Date(2025, 9, 1) }).totals;
  const after = A.report(rows, { view: "month", anchor: new Date(2026, 9, 1) }).totals;
  assert.ok(after.conversion > before.conversion + 0.08);
  assert.ok(after.upsell > 0 && before.upsell === 0);
  assert.ok(after.nightOrders > before.nightOrders * 2);
  assert.ok(after.autoShare > 0.5);
});

test("рекомендации: праздник впереди, ночь, допродажи; без данных — подсказка", () => {
  const rep = A.report(rows, { view: "month", anchor: new Date(2026, 10, 1) });
  const ins = A.insights(rep, rows, { now: NOW });
  const titles = ins.map((i) => i.title).join(" | ");
  assert.match(titles, /День матери/);
  assert.match(titles, /Ночью написали/);
  assert.match(titles, /Допродаж/);
  const empty = A.insights(A.report([], { view: "day", anchor: NOW }), [], { now: NOW });
  assert.match(empty[0].title, /нет/);
});

test("записи CRM: заказ из чата, принятая допродажа, отмена и работа агента считаются", () => {
  const st = S.createStore({ storage: S.memoryStorage(), now: () => NOW });
  const a = st.create({ source: "telegram", name: "Анна", phone: "+79165551234", fulfillment: "pickup", date: "2026-11-10", slot: "12-15", items: [{ id: "lilac", name: "Сирень и мята", price: 4600, qty: 1 }, { id: "choco", name: "Шоколад", price: 450, qty: 1 }], offers: [{ id: "choco", accepted: true }] });
  st.setStatus(a.id, "confirmed", "ИИ-агент");
  st.agentNote(a.id, "pay_reminder", "Напомнили об оплате");
  const b = st.create({ source: "avito", name: "Игорь", phone: "+79037654321", fulfillment: "pickup", date: "2026-11-10", slot: "12-15", items: [{ id: "bordo", name: "Бордо", price: 6800, qty: 1 }] });
  st.setStatus(b.id, "cancelled");
  const r = st.list().map((x) => A.normalize(x));
  const t = A.totals(r);
  assert.equal(t.orders, 1);
  assert.equal(t.cancelled, 1);
  assert.equal(t.upsell, 450);
  assert.equal(t.rescued, 1);
  assert.equal(t.autoShare, 1);
  assert.equal(t.revenue, 5050);
});

test("незаконченный месяц сравнивается с тем же числом дней прошлого месяца", () => {
  const rep = A.report(rows, { view: "month", anchor: NOW, now: NOW });
  assert.equal(rep.partial, true);
  const prevFull = A.report(rows, { view: "month", anchor: new Date(2026, 9, 1), now: NOW }).totals.orders;
  assert.ok(rep.prev.orders < prevFull * 0.45, "в сравнении только первые 9 дней октября");
  assert.ok(Math.abs(rep.deltas.orders) < 0.4, "нет ложного «упало на 70%»");
});
