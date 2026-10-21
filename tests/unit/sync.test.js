// Синхронизация стенда между участниками: никакие заявки не теряются.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../js/store.js");
const { mergeCrm, mergeOutbox, canonCrm } = require("../../js/sync.js");

const input = (name, phone = "+79161234567") => ({
  kind: "order", source: "site", name, phone, fulfillment: "pickup", date: "2026-10-22", slot: "9-12",
  items: [{ id: "pole", name: "Полевой", price: 2400, qty: 1 }],
});

// Два участника: у каждого своя копия, начинают с общей.
function twoPeople(start) {
  const a = S.memoryStorage();
  const b = S.memoryStorage();
  if (start) { a.setItem(S.STORAGE_KEY, start); b.setItem(S.STORAGE_KEY, start); }
  let t = Date.parse("2026-10-21T07:30:00Z");
  const now = () => new Date((t += 1000));
  return { a, b, A: S.createStore({ storage: a, now }), B: S.createStore({ storage: b, now }) };
}
const raw = (st) => st.getItem(S.STORAGE_KEY);

test("заказы, созданные одновременно разными людьми, оба сохраняются под разными номерами", () => {
  const { a, b, A, B } = twoPeople();
  A.create(input("Анна", "+79160000001"));
  B.create(input("Борис", "+79160000002"));
  assert.equal(A.list()[0].id, "СТ-1001");
  assert.equal(B.list()[0].id, "СТ-1001", "оба получили одинаковый номер — так бывает при одновременной работе");
  const { db, renumbered } = mergeCrm(raw(b), raw(a));
  assert.equal(db.items.length, 2);
  assert.deepEqual(db.items.map((r) => r.id).sort(), ["СТ-1001", "СТ-1002"]);
  assert.deepEqual(renumbered, [{ from: "СТ-1001", to: "СТ-1002" }]);
  const moved = db.items.find((r) => r.id === "СТ-1002");
  assert.equal(moved.customer.name, "Борис");
  assert.match(moved.history.at(-1).text, /Номер изменён с СТ-1001/);
  assert.equal(db.seq, 1002, "следующий заказ получит 1003");
});

test("смена статуса у одного и комментарий у другого — сохраняются оба", () => {
  const { a, A } = twoPeople();
  const rec = A.create(input("Анна"));
  const shared = raw(a);
  const p = twoPeople(shared);
  p.A.setStatus(rec.id, "confirmed");
  p.B.addComment(rec.id, "Позвонить за час");
  const { db } = mergeCrm(raw(p.b), raw(p.a));
  const r = db.items[0];
  assert.equal(r.status, "confirmed");
  assert.ok(r.history.some((h) => h.type === "comment" && h.text === "Позвонить за час"));
  assert.ok(r.history.some((h) => h.type === "status" && h.status === "confirmed"));
});

test("слияние идемпотентно и не зависит от порядка", () => {
  const { a, b, A, B } = twoPeople();
  A.create(input("Анна", "+79160000001"));
  B.create({ ...input("Вера", "+79160000003"), kind: "callback" });
  const ab = mergeCrm(raw(a), raw(b)).db;
  const again = mergeCrm(JSON.stringify(ab), JSON.stringify(ab)).db;
  assert.equal(canonCrm(again), canonCrm(ab));
  assert.equal(mergeCrm(JSON.stringify(ab), raw(b)).db.items.length, 2);
});

test("удаление тестовых заявок и полная очистка не «воскрешаются» чужой копией", () => {
  const { a, A } = twoPeople();
  A.create(input("Тест: X"));
  A.create(input("Мария", "+79160000009"));
  const shared = raw(a);
  const p = twoPeople(shared);
  p.A.purge((r) => r.customer.name.startsWith("Тест:"));
  let { db } = mergeCrm(raw(p.b), raw(p.a));
  assert.deepEqual(db.items.map((r) => r.customer.name), ["Мария"]);
  p.A.reset();
  db = mergeCrm(raw(p.b), raw(p.a)).db;
  assert.equal(db.items.length, 0);
});

test("пустые и повреждённые копии не ломают слияние", () => {
  assert.deepEqual(mergeCrm(null, null).db, { seq: 1000, items: [], deleted: [] });
  assert.equal(mergeCrm("{битый", null).db.items.length, 0);
});

test("журнал: объединение без дублей, новые сверху, очистка по времени", () => {
  const e = (t, n, at) => ({ n: `${t}-${n}`, at, channel: "sms", text: String(n) });
  const local = [e(3000, 2, "2026-10-21T08:00:03Z"), e(1000, 1, "2026-10-21T08:00:01Z")];
  const remote = [e(2000, 9, "2026-10-21T08:00:02Z"), e(1000, 1, "2026-10-21T08:00:01Z")];
  assert.deepEqual(mergeOutbox(local, remote).map((x) => x.text), ["2", "9", "1"]);
  assert.deepEqual(mergeOutbox(local, remote, 2500).map((x) => x.text), ["2"]);
});
