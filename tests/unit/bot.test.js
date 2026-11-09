const test = require("node:test");
const assert = require("node:assert/strict");
const bot = require("../../js/bot.js");
const S = require("../../js/store.js");
const profile = require("../../js/profile.js");

// 10:30 по Москве, среда 21 октября 2026: сегодня ещё доступны 15–18 и 18–21
const NOW = new Date("2026-10-21T07:30:00Z");

function session(now = NOW, source) {
  const store = S.createStore({ storage: S.memoryStorage(), now: () => now });
  const ctx = { now: () => now, create: (i) => store.create(i), lookup: (id) => store.get(id), source };
  let r = bot.start();
  const say = (text, value) => (r = bot.reply(r.state, { text, value }, ctx));
  const press = (label) => {
    const o = r.messages.flatMap((x) => x.options || []).find((x) => (label instanceof RegExp ? label.test(x.label) : x.label === label));
    assert.ok(o, `нет кнопки «${label}», есть: ${r.messages.flatMap((x) => x.options || []).map((x) => x.label).join(", ")}`);
    return say(o.label, o.value);
  };
  const last = () => r.messages.at(-1);
  const all = () => r.messages.map((x) => x.text).join("\n");
  const labels = () => r.messages.flatMap((x) => x.options || []).map((o) => o.label);
  return { store, say, press, last, all, labels, get state() { return r.state; } };
}

test("приветствие с подсказкой, что можно писать своими словами", () => {
  const r = bot.start();
  assert.deepEqual(r.messages[0].options.map((o) => o.value), ["order", "delivery", "status", "callback"]);
  assert.match(r.messages[0].text, /просто написать/);
});

test("заказ кнопками: бюджет → букет → дата → время → доставка", () => {
  const c = session();
  c.press("Подобрать букет");
  assert.deepEqual(c.labels(), ["До 3 000 ₽", "3 000–6 000 ₽", "От 6 000 ₽", "Показать все"]);
  c.press("3 000–6 000 ₽");
  assert.ok(c.last().cards.length > 0, "букеты показаны карточками");
  c.press(/^Утро на даче/);
  c.press("Завтра");
  c.press("12:00–15:00");
  c.press(/^Доставка/);
  c.say("Остоженка, 7, кв. 12");
  c.say("Мария");
  c.say("8 916 123 45 67");
  assert.equal(c.state.step, "confirm");
  assert.match(c.last().text, /Утро на даче[\s\S]*22 октября, 12:00–15:00[\s\S]*Итого: 4 390 ₽/);
  c.press("Всё верно, оформить");
  assert.match(c.all(), /Заказ СТ-1001 принят/);
  const rec = c.store.get("СТ-1001");
  assert.deepEqual([rec.source, rec.customer.phone, rec.address, rec.totals.total], ["chat", "+79161234567", "Остоженка, 7, кв. 12", 4390]);
});

test("одна фраза заполняет сразу цветы, повод, дату, время и бюджет", () => {
  const c = session();
  c.say("хочу пионы маме на завтра вечером до 5000");
  assert.match(c.all(), /Для мамы/);
  assert.deepEqual(c.state.draft.flowers, ["пион"]);
  assert.equal(c.state.draft.maxPrice, 5000);
  assert.equal(c.state.draft.date, "2026-10-22");
  assert.equal(c.state.draft.slot, "18-21");
  assert.ok(c.last().cards.every((p) => p.price <= 5000));
  c.press(/^Утро на даче/);
  assert.equal(c.state.step, "fulfillment", "дату и время второй раз не спрашивает");
});

test("«к 18» — интервал, который заканчивается к 18:00; «заберу сам» — самовывоз", () => {
  const c = session();
  c.say("розы на сегодня к 18, заберу сам");
  assert.equal(c.state.draft.slot, "15-18");
  assert.equal(c.state.draft.fulfillment, "pickup");
  c.press(/^Маленький комплимент/);
  assert.equal(c.state.step, "name");
  c.say("Игорь"); c.say("+7 903 765 43 21"); c.say("да");
  const rec = c.store.get("1001");
  assert.deepEqual([rec.fulfillment, rec.slot, rec.totals.delivery], ["pickup", "15-18", 0]);
});

test("понимание текста", () => {
  const u = (t) => bot.understand(t, NOW);
  assert.equal(u("до 4 тыс").maxPrice, 4000);
  assert.equal(u("бюджет 3000 р").maxPrice, 3000);
  assert.equal(u("что-нибудь недорогое").maxPrice, 3000);
  assert.equal(u("шикарный букет").minPrice, 6000);
  assert.equal(u("в субботу").date, "2026-10-24");
  assert.equal(u("в среду").date, "2026-10-21");
  assert.equal(u("послезавтра").date, "2026-10-23");
  assert.equal(u("14.02").date, "2027-02-14");
  assert.equal(u("с утра").slot, "9-12");
  assert.equal(u("после обеда").slot, "15-18");
  assert.equal(u("в 7 вечера").slot, "18-21");
  assert.equal(u("в 13:30").slot, "12-15");
  assert.equal(u("к 12").slot, "9-12");
  assert.equal(u("на др подруге").occasion, "birthday");
  assert.equal(u("мой номер 8 916 123-45-67").phone, "+79161234567");
  assert.equal(u("где мой заказ").intent, "status");
  assert.equal(u("ст-1001").orderId, "1001");
  assert.equal(u("позовите человека").intent, "callback");
  assert.equal(u("сколько стоит доставка").intent, "delivery");
  assert.equal(u("хочу тюльпаны").intent, "order");
  assert.equal(u("абракадабра").intent, undefined);
  assert.equal(u("до 18").maxPrice, undefined, "«до 18» — время, а не бюджет");
});

test("цветов нет в готовых букетах — бот честно говорит и предлагает похожие", () => {
  const c = session();
  c.say("хочу орхидеи до 3000");
  assert.equal(c.state.step, "product");
  c.say("лилии");
  assert.match(c.all(), /Не нашёл такого букета/);
  c.say("гортензии");
  assert.match(c.last().text, /дороже названного бюджета/);
  assert.deepEqual(c.last().cards.map((x) => x.id), ["prazdnik"]);
});

test("бюджет, в который ничего не влезает", () => {
  const c = session();
  c.say("букет до 1000");
  assert.match(c.all(), /готовых букетов нет: самый доступный стоит 1 600 ₽/);
});

test("вечером «Сегодня» не предлагается, а «сегодня» в тексте объясняется", () => {
  const c = session(new Date("2026-10-21T16:30:00Z")); // 19:30 МСК
  c.press("Подобрать букет"); c.press("Показать все"); c.press(/^Полевой/);
  assert.ok(!c.labels().includes("Сегодня"));
  c.say("сегодня");
  assert.match(c.all(), /уже не успеем/);
});

test("своя дата: ошибка формата, слишком далеко, потом успех", () => {
  const c = session();
  c.press("Подобрать букет"); c.press("Показать все"); c.press(/^Полевой/);
  c.press("Другой день");
  c.say("когда-нибудь");
  assert.match(c.all(), /Не понял дату/);
  c.say("25.12");
  assert.match(c.all(), /30 дней/);
  c.say("25.10");
  assert.equal(c.state.step, "slot");
});

test("изменение перед оформлением: дата меняется, остальное сохраняется", () => {
  const c = session();
  c.say("бордо на завтра утром, заберу сам");
  assert.equal(c.state.step, "name", "букет, дату, время и самовывоз бот понял из одной фразы");
  c.say("Игорь"); c.say("9037654321");
  c.say("нет");
  c.press("Дату и время");
  c.say("в субботу вечером");
  assert.equal(c.state.step, "confirm");
  assert.match(c.last().text, /24 октября, 18:00–21:00[\s\S]*Игорь/);
});

test("неверный телефон и «ок» вместо имени — бот переспрашивает", () => {
  const c = session();
  c.say("полевой букет завтра утром, заберу сам");
  c.say("ок");
  assert.equal(c.state.step, "name");
  c.say("Оля");
  c.say("123");
  assert.equal(c.state.step, "phone");
  assert.match(c.all(), /10 цифр/);
  assert.equal(c.store.list().length, 0);
});

test("если интервал истёк, пока клиент думал, бот просит выбрать время заново", () => {
  let now = NOW;
  const store = S.createStore({ storage: S.memoryStorage() });
  const ctx = { now: () => now, create: (i) => store.create(i), lookup: (id) => store.get(id) };
  let r = bot.start();
  const say = (text, value) => (r = bot.reply(r.state, { text, value }, ctx));
  say("полевой сегодня после обеда, заберу сам"); say("Оля"); say("9161234567");
  assert.equal(r.state.step, "confirm");
  now = new Date("2026-10-21T11:00:00Z"); // 14:00 МСК
  say("", "confirm");
  assert.notEqual(r.state.step, "confirm");
  assert.match(r.messages[0].text, /недоступен/);
  assert.equal(store.list().length, 0);
});

test("статус: из меню, с номером в тексте и посреди оформления", () => {
  const c = session();
  const rec = c.store.create({ kind: "order", source: "site", name: "М", phone: "+79161234567", fulfillment: "delivery", address: "Остоженка 7", date: "2026-10-22", slot: "9-12", items: [{ id: "pole", name: "Полевой", price: 2400, qty: 1 }] });
  c.store.setStatus(rec.id, "confirmed");
  c.say("где мой заказ ст-1001");
  assert.match(c.last().text, /СТ-1001: подтверждён[\s\S]*Ждём оплату/);
  c.press("Где мой заказ");
  c.say("СТ-9999");
  assert.match(c.last().text, /не нашёлся/);
  c.say("хочу тюльпаны");
  c.say("кстати, что с заказом ст 1001?");
  assert.match(c.last().text, /СТ-1001: подтверждён/);
});

test("обратный звонок: имя и телефон одной фразой", () => {
  const c = session(NOW, "telegram");
  c.say("позовите флориста");
  c.say("Анна 8 926 111-22-33");
  assert.match(c.last().text, /ЗВ-1001[\s\S]*\+7 926 111-22-33/);
  const rec = c.store.get("1001");
  assert.deepEqual([rec.kind, rec.source], ["callback", "telegram"]);
});

test("вопрос о доставке посреди заказа не сбрасывает оформление", () => {
  const c = session();
  c.say("тюльпаны на завтра");
  c.press(/^25 тюльпанов/);
  const step = c.state.step;
  c.say("а сколько стоит доставка?");
  assert.match(c.all(), /490/);
  assert.equal(c.state.step, step);
  assert.equal(c.state.draft.product, "tulip");
});

test("непонятный текст, приветствие, спасибо, «меню»", () => {
  const c = session();
  c.say("абракадабра");
  assert.match(c.last().text, /понял/);
  c.say("привет");
  assert.match(c.last().text, /Чем помочь/);
  c.say("спасибо");
  assert.match(c.last().text, /Пожалуйста/);
  c.say("тюльпаны");
  c.say("меню");
  assert.equal(c.state.step, "menu");
  assert.deepEqual(c.state.draft, {});
});

test("ответы не повторяются слово в слово", () => {
  const c = session();
  c.press("Подобрать букет");
  const first = c.last().text;
  c.say("меню");
  c.press("Подобрать букет");
  assert.notEqual(c.last().text, first);
});

test("большой заказ: бот предлагает позвать флориста, а не только готовые букеты", () => {
  const c = session();
  c.say("нужно 30 букетов для сотрудниц на корпоратив");
  assert.match(c.all(), /Большой заказ флорист посчитает индивидуально/);
  c.press("Позвать флориста");
  assert.equal(c.state.step, "cb_name");
  assert.equal(bot.understand("3 букета", NOW).occasion, undefined, "три букета — не опт");
});

test("имя с инициалом сохраняется как написано", () => {
  const c = session();
  c.say("полевой завтра утром, заберу сам");
  c.say("Ольга Н.");
  assert.equal(c.state.draft.name, "Ольга Н.");
});

// ---------- мягкие продажи ----------
test("нет в наличии: честно говорит и предлагает похожие по цене и цветам", () => {
  const c = session();
  c.say("хочу ранункулюсы на завтра");
  assert.match(c.all(), /«Ранункулюсы» сегодня закончились — привезём с утренней поставкой/);
  assert.ok(c.last().cards.length > 0);
  assert.ok(!c.last().cards.some((p) => p.id === "ranunkulus"), "закончившийся букет не предлагаем");
  c.say("", "p:" + c.last().cards[0].id);
  assert.equal(c.state.step, "slot", "дальше — как обычно, дата уже понята");
});

test("закончившийся букет не попадает в подборки", () => {
  const c = session();
  c.press("Подобрать букет");
  c.press("Показать все");
  assert.ok(!c.labels().some((l) => /Ранункулюсы/.test(l)));
});

test("допродажа: одно предложение при проверке заказа, с честной выгодой по доставке", () => {
  const c = session();
  c.say("сирень на завтра днём, доставка"); // 4 600 ₽: до бесплатной доставки 400 ₽, доставка 490 ₽
  c.press(/^Сирень и мята/);
  c.say("Профсоюзная 104, кв 220");
  c.say("Ольга");
  c.say("9161234567");
  assert.match(c.last().text, /до бесплатной доставки не хватает 400\u00a0₽: если добавить шоколад ручной работы за 450\u00a0₽, доставка станет бесплатной — и это даже дешевле, чем платить за доставку\./);
  c.press("Добавить шоколад (+450\u00a0₽)");
  assert.match(c.all(), /Добавили шоколад к заказу/);
  assert.match(c.last().text, /Шоколад ручной работы — 450\u00a0₽[\s\S]*Итого: 5\u00a0050\u00a0₽ \(доставка бесплатно\)/);
  assert.doesNotMatch(c.last().text, /Кстати/, "второй раз не предлагает");
  c.press("Всё верно, оформить");
  const rec = c.store.get("1001");
  assert.deepEqual(rec.items.map((i) => i.id), ["siren", "choco"]);
  assert.equal(rec.totals.total, 5050);
  assert.deepEqual(rec.offers, [{ id: "choco", accepted: true }]);
});

test("допродажа дороже доставки: агент считает, во сколько она обойдётся на самом деле", () => {
  const p = profile.merge(profile.DEFAULT, { addons: [{ id: "vase", name: "Ваза", acc: "вазу", short: "вазу", nom: "ваза", price: 600, pitch: "." }] });
  const store = S.createStore({ storage: S.memoryStorage(), now: () => NOW });
  const ctx = { now: () => NOW, create: (i) => store.create(i), lookup: (id) => store.get(id), profile: p };
  let r = bot.start({ profile: p });
  for (const [t, v] of [["сирень на завтра днём, доставка"], ["", "p:siren"], ["Профсоюзная 104, кв 220"], ["Ольга"], ["9161234567"]]) r = bot.reply(r.state, { text: t, value: v }, ctx);
  assert.match(r.messages.at(-1).text, /по сути ваза обойдётся в 110\u00a0₽/);
});

test("допродажа: отказ — просто оформляем, предложение не повторяется", () => {
  const c = session();
  c.say("пионы маме на завтра вечером, заберу сам");
  c.press(/^Утро на даче/);
  c.say("Мария");
  c.say("9161234567");
  assert.match(c.last().text, /шоколад ручной работы за 450 ₽/, "для мамы — шоколад, а не ваза");
  c.say("нет");
  c.press("Дату и время");
  c.say("в субботу утром");
  assert.doesNotMatch(c.last().text, /Кстати/);
  c.press("Всё верно, оформить");
  assert.deepEqual(c.store.get("1001").offers, [{ id: "choco", accepted: false }]);
});

test("допродажу можно принять словами", () => {
  const c = session();
  c.say("бордо на завтра утром, заберу сам");
  c.say("Игорь");
  c.say("9037654321");
  c.say("да, добавьте вазу");
  assert.match(c.last().text, /Стеклянная ваза — 700/);
});

test("мягкие продажи выключаются в профиле", () => {
  const off = profile.merge(profile.DEFAULT, { sales: { softOffers: false } });
  const store = S.createStore({ storage: S.memoryStorage(), now: () => NOW });
  const ctx = { now: () => NOW, create: (i) => store.create(i), lookup: (id) => store.get(id), profile: off };
  let r = bot.start({ profile: off });
  for (const t of ["бордо на завтра утром, заберу сам", "Игорь", "9037654321"]) r = bot.reply(r.state, { text: t }, ctx);
  assert.doesNotMatch(r.messages.at(-1).text, /Кстати/);
});

test("приветствие с просьбой в одном сообщении — бот отвечает на просьбу, а не только здоровается", () => {
  const S2 = require("../../js/store.js");
  const st = S2.createStore({ storage: S2.memoryStorage() });
  const c = { now: () => new Date("2026-11-09T09:00:00Z"), create: (i) => st.create(i), lookup: (id) => st.get(id) };
  const r = bot.reply(bot.start().state, { text: "Здравствуйте! Есть ранункулюсы? Хочу подарить сестре" }, c);
  assert.match(r.messages[0].text, /закончились/);
  const g = bot.reply(bot.start().state, { text: "Добрый день!" }, c);
  assert.match(g.messages[0].text, /Чем помочь/);
});

test("выбор из списка по порядку: «давайте первый» — первый показанный букет", () => {
  const S2 = require("../../js/store.js");
  const st = S2.createStore({ storage: S2.memoryStorage() });
  const c = { now: () => new Date("2026-11-09T09:00:00Z"), create: (i) => st.create(i), lookup: (id) => st.get(id) };
  const a = bot.reply(bot.start().state, { text: "есть ранункулюсы?" }, c);
  const first = a.messages.at(-1).options[0].label.split(",")[0];
  const b = bot.reply(a.state, { text: "давайте первый, на завтра днём, доставка" }, c);
  assert.match(b.messages[0].text, new RegExp(first));
  assert.equal(b.state.draft.slot, "12-15");
  const c2 = bot.reply(a.state, { text: "2" }, c);
  assert.ok(c2.state.draft.product && !c2.state.draft.similarTo);
});
