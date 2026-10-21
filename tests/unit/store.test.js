const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../js/store.js");

const order = {
  kind: "order", source: "site", name: "Мария", phone: "+79161234567", fulfillment: "delivery",
  address: "Остоженка, 7", date: "2026-10-22", slot: "12-15", note: "",
  items: [{ id: "dacha", name: "Утро на даче", price: 3900, qty: 1 }],
};

function fresh(extra = {}) {
  let t = Date.parse("2026-10-21T07:30:00Z");
  return S.createStore({ storage: S.memoryStorage(), now: () => new Date((t += 1000)), ...extra });
}

test("create присваивает номера по порядку и считает сумму с доставкой", () => {
  const s = fresh();
  const a = s.create(order);
  const b = s.create({ kind: "callback", source: "chat", name: "Анна", phone: "+79261112233", topic: "Свадьба" });
  assert.equal(a.id, "СТ-1001");
  assert.equal(b.id, "ЗВ-1002");
  assert.equal(a.status, "new");
  assert.equal(a.totals.total, 4390);
  assert.equal(b.items, undefined);
});

test("get находит заявку по номеру в любом написании", () => {
  const s = fresh();
  s.create(order);
  assert.equal(s.get("СТ-1001").id, "СТ-1001");
  assert.equal(s.get("ст1001").id, "СТ-1001");
  assert.equal(s.get("1001").id, "СТ-1001");
  assert.equal(s.get("1002"), null);
  assert.equal(s.get(""), null);
});

test("полный путь заказа с доставкой", () => {
  const s = fresh();
  const { id } = s.create(order);
  for (const st of ["confirmed", "assembling", "delivering", "done"]) s.setStatus(id, st);
  const r = s.get(id);
  assert.equal(r.status, "done");
  assert.deepEqual(r.history.filter((h) => h.type === "status").map((h) => h.status), ["new", "confirmed", "assembling", "delivering", "done"]);
  assert.deepEqual(S.nextStatuses(r), []);
});

test("самовывоз идёт через «Готов к выдаче», а не «В доставке»", () => {
  const s = fresh();
  const { id } = s.create({ ...order, fulfillment: "pickup" });
  s.setStatus(id, "confirmed");
  s.setStatus(id, "assembling");
  assert.deepEqual(S.nextStatuses(s.get(id)), ["ready", "cancelled"]);
  assert.throws(() => s.setStatus(id, "delivering"), /Нельзя перевести/);
});

test("нельзя перепрыгнуть статус или изменить закрытую заявку", () => {
  const s = fresh();
  const { id } = s.create(order);
  assert.throws(() => s.setStatus(id, "done"), /из статуса «Новый» в «Выполнен»/);
  s.setStatus(id, "cancelled");
  assert.throws(() => s.setStatus(id, "confirmed"));
});

test("звонок: новый → перезвонили", () => {
  const s = fresh();
  const { id } = s.create({ kind: "callback", source: "chat", name: "Анна", phone: "+79261112233" });
  assert.deepEqual(S.nextStatuses(s.get(id)), ["called", "cancelled"]);
  s.setStatus(id, "called");
  assert.equal(s.get(id).status, "called");
});

test("комментарии пишутся в историю, пустой отклоняется", () => {
  const s = fresh();
  const { id } = s.create(order);
  s.addComment(id, "  Позвонить за час  ", "Ольга");
  const last = s.get(id).history.at(-1);
  assert.deepEqual([last.type, last.text, last.by], ["comment", "Позвонить за час", "Ольга"]);
  assert.throws(() => s.addComment(id, "   "), /текст комментария/);
  assert.throws(() => s.addComment("СТ-9999", "x"), /не найдена/);
});

test("list: фильтры, поиск по имени, номеру и телефону, новые сверху", () => {
  const s = fresh();
  s.create(order);
  s.create({ ...order, source: "chat", name: "Игорь", phone: "+79037654321" });
  s.create({ kind: "callback", source: "chat", name: "Анна", phone: "+79261112233" });
  assert.deepEqual(s.list().map((r) => r.id), ["ЗВ-1003", "СТ-1002", "СТ-1001"]);
  assert.equal(s.list({ source: "chat" }).length, 2);
  assert.equal(s.list({ kind: "callback" }).length, 1);
  assert.equal(s.list({ q: "игорь" })[0].id, "СТ-1002");
  assert.equal(s.list({ q: "765" })[0].id, "СТ-1002");
  assert.equal(s.list({ q: "1001" })[0].id, "СТ-1001");
  assert.equal(s.list({ status: "done" }).length, 0);
});

test("данные переживают пересоздание хранилища (как перезагрузку страницы)", () => {
  const storage = S.memoryStorage();
  S.createStore({ storage }).create(order);
  assert.equal(S.createStore({ storage }).list().length, 1);
});

test("повреждённые данные не ломают CRM", () => {
  const storage = S.memoryStorage();
  storage.setItem(S.STORAGE_KEY, "{не json");
  const s = S.createStore({ storage });
  assert.deepEqual(s.list(), []);
  assert.equal(s.create(order).id, "СТ-1001");
});

test("seedDemo создаёт заявки в разных статусах", () => {
  const s = fresh();
  s.seedDemo("2026-10-22");
  const st = s.list().map((r) => r.status).sort();
  assert.deepEqual(st, ["assembling", "confirmed", "new", "new"]);
});
