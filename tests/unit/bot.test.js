const test = require("node:test");
const assert = require("node:assert/strict");
const bot = require("../../js/bot.js");
const S = require("../../js/store.js");

// 10:30 по Москве: сегодня ещё доступны интервалы 15–18 и 18–21
const NOW = new Date("2026-10-21T07:30:00Z");

function session(now = NOW) {
  const store = S.createStore({ storage: S.memoryStorage(), now: () => now });
  const ctx = { now: () => now, create: (i) => store.create(i), lookup: (id) => store.get(id) };
  let r = bot.start();
  const say = (text, value) => (r = bot.reply(r.state, { text, value }, ctx));
  const last = () => r.messages.at(-1);
  const options = () => (last().options || []).map((o) => o.value);
  return { store, say, last, options, get state() { return r.state; } };
}

test("приветствие предлагает меню", () => {
  const r = bot.start();
  assert.deepEqual(r.messages[0].options.map((o) => o.value), ["order", "delivery", "status", "callback"]);
});

test("полный заказ через кнопки: доставка на завтра", () => {
  const c = session();
  c.say("Заказать букет", "order");
  assert.deepEqual(c.options(), ["low", "mid", "high"]);
  c.say("3 000–6 000 ₽", "mid");
  assert.ok(c.options().includes("dacha"));
  c.say("Утро на даче", "dacha");
  assert.deepEqual(c.options(), ["2026-10-21", "2026-10-22", "custom"]);
  c.say("Завтра", "2026-10-22");
  assert.deepEqual(c.options(), ["9-12", "12-15", "15-18", "18-21"]);
  c.say("12:00–15:00", "12-15");
  c.say("Доставка", "delivery");
  c.say("Остоженка, 7, кв. 12");
  c.say("Мария");
  c.say("8 916 123 45 67");
  assert.equal(c.state.step, "confirm");
  assert.match(c.last().text, /Утро на даче[\s\S]*22 октября, 12:00–15:00[\s\S]*Итого: 4 390 ₽/);
  c.say("Оформить заказ", "confirm");
  assert.match(c.last().text, /Заказ СТ-1001 оформлен/);

  const rec = c.store.get("СТ-1001");
  assert.equal(rec.source, "chat");
  assert.equal(rec.customer.phone, "+79161234567");
  assert.equal(rec.address, "Остоженка, 7, кв. 12");
  assert.equal(rec.totals.total, 4390);
});

test("самовывоз не спрашивает адрес", () => {
  const c = session();
  c.say("", "order"); c.say("", "high"); c.say("", "bordo"); c.say("", "2026-10-22"); c.say("", "18-21");
  c.say("", "pickup");
  assert.equal(c.state.step, "name");
  c.say("Игорь"); c.say("9037654321"); c.say("да");
  assert.equal(c.store.get("1001").fulfillment, "pickup");
  assert.equal(c.store.get("1001").totals.delivery, 0);
});

test("вечером «Сегодня» не предлагается", () => {
  const c = session(new Date("2026-10-21T16:30:00Z")); // 19:30 МСК
  c.say("", "order"); c.say("", "low"); c.say("", "pole");
  assert.deepEqual(c.options(), ["2026-10-22", "custom"]);
});

test("своя дата: ошибки формата и диапазона, потом успех", () => {
  const c = session();
  c.say("", "order"); c.say("", "low"); c.say("", "pole");
  c.say("Другая дата", "custom");
  c.say("в пятницу");
  assert.match(c.last().text, /Не понял дату/);
  c.say("25.12");
  assert.match(c.last().text, /30 дней/);
  c.say("25.10");
  assert.equal(c.state.step, "slot");
  assert.equal(c.state.draft.date, "2026-10-25");
});

test("неверный телефон — бот переспрашивает и не создаёт заказ", () => {
  const c = session();
  c.say("", "order"); c.say("", "low"); c.say("", "pole"); c.say("", "2026-10-22"); c.say("", "9-12"); c.say("", "pickup"); c.say("Оля");
  c.say("123");
  assert.equal(c.state.step, "phone");
  assert.match(c.last().text, /10 цифр/);
  assert.equal(c.store.list().length, 0);
});

test("если интервал истёк, пока клиент думал, бот просит выбрать дату заново", () => {
  let now = new Date("2026-10-21T07:30:00Z");
  const store = S.createStore({ storage: S.memoryStorage() });
  const ctx = { now: () => now, create: (i) => store.create(i), lookup: (id) => store.get(id) };
  let r = bot.start();
  const say = (text, value) => (r = bot.reply(r.state, { text, value }, ctx));
  say("", "order"); say("", "low"); say("", "pole"); say("", "2026-10-21"); say("", "15-18"); say("", "pickup"); say("Оля"); say("9161234567");
  now = new Date("2026-10-21T11:00:00Z"); // 14:00 МСК, до 15:00 меньше 2 часов
  say("", "confirm");
  assert.equal(r.state.step, "date");
  assert.match(r.messages[0].text, /недоступен/);
  assert.equal(store.list().length, 0);
});

test("статус заказа: найден и не найден", () => {
  const c = session();
  const rec = c.store.create({ kind: "order", source: "site", name: "М", phone: "+79161234567", fulfillment: "delivery", address: "Остоженка 7", date: "2026-10-22", slot: "9-12", items: [{ id: "pole", name: "Полевой", price: 2400, qty: 1 }] });
  c.store.setStatus(rec.id, "confirmed");
  c.say("где мой заказ?");
  assert.equal(c.state.step, "status");
  c.say("СТ-9999");
  assert.match(c.last().text, /не найден/);
  c.say("ст 1001");
  assert.match(c.last().text, /СТ-1001: подтверждён/);
  assert.equal(c.state.step, "menu");
});

test("обратный звонок попадает в CRM как звонок", () => {
  const c = session();
  c.say("позовите флориста");
  c.say("Анна");
  c.say("+7 926 111-22-33");
  assert.match(c.last().text, /ЗВ-1001/);
  assert.equal(c.store.get("1001").kind, "callback");
});

test("свободный текст: доставка и непонятный запрос", () => {
  const c = session();
  c.say("сколько стоит доставка?");
  assert.match(c.last().text, /490/);
  c.say("абракадабра");
  assert.match(c.last().text, /понимаю только простые запросы/);
});

test("«меню» сбрасывает сценарий с любого шага", () => {
  const c = session();
  c.say("", "order"); c.say("", "low");
  c.say("меню");
  assert.equal(c.state.step, "menu");
  assert.deepEqual(c.state.draft, {});
});

test("detectIntent", () => {
  assert.equal(bot.detectIntent("Хочу розы"), "order");
  assert.equal(bot.detectIntent("Какой статус?"), "status");
  assert.equal(bot.detectIntent("Перезвоните мне"), "callback");
  assert.equal(bot.detectIntent("привет"), null);
});
