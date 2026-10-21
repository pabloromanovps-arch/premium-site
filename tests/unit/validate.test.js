const test = require("node:test");
const assert = require("node:assert/strict");
const v = require("../../js/validate.js");

// 10:30 по Москве, 21 октября 2026
const NOW = new Date("2026-10-21T07:30:00Z");
const base = {
  name: "Мария", phone: "8 (916) 123-45-67", fulfillment: "delivery", address: "Остоженка, 7, кв. 12",
  date: "2026-10-22", slot: "12-15", items: [{ id: "dacha", name: "Утро на даче", price: 3900, qty: 1 }],
};

test("moscowNow переводит время в Москву, в том числе через полночь", () => {
  assert.deepEqual(v.moscowNow(NOW), { date: "2026-10-21", hour: 10, minute: 30 });
  assert.equal(v.moscowNow(new Date("2026-10-21T22:30:00Z")).date, "2026-10-22");
});

test("normalizePhone принимает 8, +7 и 10 цифр, отклоняет мусор", () => {
  assert.equal(v.normalizePhone("8 (916) 123-45-67"), "+79161234567");
  assert.equal(v.normalizePhone("+7 916 123 45 67"), "+79161234567");
  assert.equal(v.normalizePhone("9161234567"), "+79161234567");
  assert.equal(v.normalizePhone("12345"), null);
  assert.equal(v.normalizePhone("+1 916 123 45 67 8"), null);
  assert.equal(v.normalizePhone(""), null);
});

test("formatPhone", () => {
  assert.equal(v.formatPhone("+79161234567"), "+7 916 123-45-67");
});

test("на сегодня доступны только интервалы, до начала которых минимум 2 часа", () => {
  assert.deepEqual(v.availableSlots("2026-10-21", NOW).map((s) => s.id), ["15-18", "18-21"]);
  assert.deepEqual(v.availableSlots("2026-10-21", new Date("2026-10-21T10:00:00Z")).map((s) => s.id), ["15-18", "18-21"]);
  assert.deepEqual(v.availableSlots("2026-10-21", new Date("2026-10-21T10:01:00Z")).map((s) => s.id), ["18-21"]);
  assert.deepEqual(v.availableSlots("2026-10-21", new Date("2026-10-21T16:00:00Z")), []);
});

test("прошлые даты и даты дальше 30 дней недоступны", () => {
  assert.equal(v.availableSlots("2026-10-20", NOW).length, 0);
  assert.equal(v.availableSlots("2026-11-20", NOW).length, 4);
  assert.equal(v.availableSlots("2026-11-21", NOW).length, 0);
  assert.equal(v.availableSlots("2026-02-30", NOW).length, 0);
  assert.equal(v.availableSlots("завтра", NOW).length, 0);
});

test("parseRuDate понимает ДД.ММ и переносит прошедшую дату на следующий год", () => {
  assert.equal(v.parseRuDate("25.10", NOW), "2026-10-25");
  assert.equal(v.parseRuDate("14.02", NOW), "2027-02-14");
  assert.equal(v.parseRuDate("1/11/2026", NOW), "2026-11-01");
  assert.equal(v.parseRuDate("31.02", NOW), null);
  assert.equal(v.parseRuDate("завтра", NOW), null);
});

test("formatDate", () => {
  assert.equal(v.formatDate("2026-10-22"), "22 октября");
});

test("validateOrder: корректный заказ проходит и нормализуется", () => {
  const r = v.validateOrder({ ...base, note: "  С днём рождения  " }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.value.phone, "+79161234567");
  assert.equal(r.value.note, "С днём рождения");
});

test("validateOrder: пустая форма даёт ошибку по каждому полю", () => {
  const r = v.validateOrder({ items: [] }, NOW);
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ["date", "fulfillment", "items", "name", "phone"]);
});

test("validateOrder: при самовывозе адрес не нужен и не сохраняется", () => {
  const r = v.validateOrder({ ...base, fulfillment: "pickup", address: "" }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.value.address, "");
});

test("validateOrder: короткий адрес при доставке", () => {
  assert.ok(v.validateOrder({ ...base, address: "Тв" }, NOW).errors.address);
});

test("validateOrder: интервал, который уже недоступен сегодня", () => {
  const r = v.validateOrder({ ...base, date: "2026-10-21", slot: "9-12" }, NOW);
  assert.match(r.errors.slot, /недоступен/);
});

test("validateOrder: неизвестный интервал", () => {
  assert.equal(v.validateOrder({ ...base, slot: "21-24" }, NOW).errors.slot, "Выберите интервал.");
});
