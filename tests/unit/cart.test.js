const test = require("node:test");
const assert = require("node:assert/strict");
const cart = require("../../js/cart.js");
const catalog = require("../../js/catalog.js");

const rose = catalog.byId("kompliment"); // 1 600
const big = catalog.byId("prazdnik"); // 9 500

test("add добавляет новую позицию и увеличивает количество существующей", () => {
  let items = cart.add([], rose);
  items = cart.add(items, rose, 2);
  assert.equal(items.length, 1);
  assert.equal(items[0].qty, 3);
});

test("add не меняет исходный массив", () => {
  const before = [];
  cart.add(before, rose);
  assert.equal(before.length, 0);
});

test("setQty: ноль удаляет, верхний предел 20", () => {
  const items = cart.add([], rose);
  assert.equal(cart.setQty(items, rose.id, 0).length, 0);
  assert.equal(cart.setQty(items, rose.id, 99)[0].qty, cart.MAX_QTY);
  assert.equal(cart.setQty(items, rose.id, -3).length, 0);
});

test("доставка платная до 5 000 ₽ и бесплатная от 5 000 ₽", () => {
  const small = cart.add([], rose, 3); // 4 800
  assert.deepEqual(cart.totals(small, "delivery"), { subtotal: 4800, delivery: 490, total: 5290, count: 3, toFree: 200 });
  const enough = cart.setQty(small, rose.id, 4); // 6 400
  assert.equal(cart.totals(enough, "delivery").delivery, 0);
});

test("ровно 5 000 ₽ — доставка бесплатная", () => {
  const items = [{ id: "x", name: "x", price: 5000, qty: 1 }];
  assert.equal(cart.totals(items, "delivery").delivery, 0);
});

test("самовывоз всегда бесплатный, пустая корзина — без доставки", () => {
  assert.equal(cart.totals(cart.add([], rose), "pickup").delivery, 0);
  assert.equal(cart.totals([], "delivery").total, 0);
});

test("formatRub", () => {
  assert.equal(cart.formatRub(9500), "9 500 ₽");
});

test("каталог: бюджеты не пересекаются и покрывают все букеты", () => {
  const all = ["low", "mid", "high"].flatMap((b) => catalog.byBudget(b).map((p) => p.id));
  assert.equal(new Set(all).size, catalog.products.length);
  assert.ok(catalog.byBudget("high").includes(big));
  assert.deepEqual(catalog.byBudget("unknown"), []);
});
