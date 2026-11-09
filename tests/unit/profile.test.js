// Профиль бизнеса: тон, база знаний, номера заказов, шаблоны — бот подстраивается под любую компанию.
const test = require("node:test");
const assert = require("node:assert/strict");
const profile = require("../../js/profile.js");
const bot = require("../../js/bot.js");
const S = require("../../js/store.js");
const messages = require("../../js/messages.js");

const NOW = new Date("2026-10-21T07:30:00Z"); // 10:30 МСК
const NIGHT = new Date("2026-10-21T20:30:00Z"); // 23:30 МСК

const FLORA = {
  business: { name: "Флора", kind: "цветочный салон", address: "Тверская, 8", phone: "+7 495 111-22-33", staff: "менеджер", staffGen: "менеджера", hours: { from: 10, to: 20 } },
  tone: { address: "ты", emoji: "🌸", greeting: "Привет!", signoff: "Хорошего дня!" },
  orderId: { order: "ЦВ", callback: "КЛ", withYear: true },
};

function session(p, now = NOW) {
  const store = S.createStore({ storage: S.memoryStorage(), now: () => now });
  const ctx = { now: () => now, create: (i) => store.create(i), lookup: (id) => store.get(id), profile: p };
  let r = bot.start({ profile: p });
  const say = (text, value) => (r = bot.reply(r.state, { text, value }, ctx));
  return { store, say, get r() { return r; }, all: () => r.messages.map((m) => m.text).join("\n") };
}

// Все ответы бота, до которых можно дойти кнопками и типичными фразами.
function crawl(p) {
  const store = S.createStore({ storage: S.memoryStorage(), now: () => NOW });
  store.create({ kind: "order", source: "site", name: "М", phone: "+79161234567", fulfillment: "delivery", address: "Остоженка 7", date: "2026-10-22", slot: "9-12", items: [{ id: "pole", name: "Полевой", price: 2400, qty: 1 }] });
  const ctx = { now: () => NOW, create: (i) => store.create(i), lookup: (id) => store.get(id), profile: p };
  const TEXTS = {
    menu: ["привет", "спасибо", "хочу розы до 4000 на завтра вечером", "сколько стоит доставка", "абракадабра", "можно картой?", "ещё актуально?"],
    product: ["тюльпаны", "лилии", "доставляете за мкад?"], date: ["в субботу", "когда-нибудь"], slot: ["в 3 ночи"],
    fulfillment: ["что?"], address: ["Тверская 7, кв 1"], name: ["ок", "Мария"], phone: ["123", "+7 916 123-45-67"],
    confirm: ["нет", "да"], status: ["1001", "999999"], cb_name: ["Анна"], cb_phone: ["9261112233"],
  };
  const seen = new Set();
  const out = new Set();
  const queue = [bot.start({ profile: p })];
  while (queue.length && seen.size < 1500) {
    const res = queue.shift();
    const key = JSON.stringify([res.state.step, res.state.draft]);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const m of res.messages) {
      out.add(m.text);
      for (const o of m.options || []) out.add(o.label);
    }
    if (Object.keys(res.state.draft || {}).length > 9) continue;
    for (const o of res.messages.flatMap((m) => m.options || [])) queue.push(bot.reply(res.state, { text: o.label, value: o.value }, ctx));
    for (const t of TEXTS[res.state.step] || []) queue.push(bot.reply(res.state, { text: t }, ctx));
  }
  return [...out];
}

test("в режиме «на ты» бот нигде не говорит «вы»", () => {
  const p = profile.merge(profile.DEFAULT, FLORA);
  const bad = crawl(p).filter((t) => /(^|[^А-Яа-яЁё])(вы|Вы|вас|Вас|вам|Вам|вами|ваш\S*|Ваш\S*)(?=[^А-Яа-яЁё]|$)/.test(t) || /[а-яё]{3,}(ите|йте)(?![а-яё])/i.test(t.replace(/сайте|Сайте/g, "")));
  assert.deepEqual(bad, []);
});

test("бот не использует слова-паразиты и канцелярит ни в одном ответе", () => {
  for (const p of [profile.DEFAULT, profile.merge(profile.DEFAULT, FLORA)]) {
    const bad = crawl(p).map((t) => [t, profile.lint(t, p)]).filter(([, w]) => w.length);
    assert.deepEqual(bad, []);
  }
  for (const [k, t] of Object.entries(profile.DEFAULT.templates)) assert.deepEqual(profile.lint(t), [], k);
  for (const f of profile.DEFAULT.faq) assert.deepEqual(profile.lint(f.a), [], f.q);
});

test("lint находит слова-паразиты и канцелярит", () => {
  assert.deepEqual(profile.lint("Ну как бы букет данного типа в настоящее время недоступен").sort(), ["в настоящее время", "данного", "как бы"]);
  assert.deepEqual(profile.lint("Хороший букет, привезём завтра"), []);
});

test("свой бизнес: название, приветствие, эмодзи и прощание", () => {
  const p = profile.merge(profile.DEFAULT, FLORA);
  const c = session(p);
  assert.match(c.all(), /^Привет! Это «Флора», цветочный салон\./);
  assert.match(c.all(), /🌸$/);
  assert.ok(c.r.messages[0].options.some((o) => o.label === "Позвать менеджера"));
});

test("свой формат номеров: ЦВ-2026-1001, поиск по полному номеру и по цифрам", () => {
  const p = profile.merge(profile.DEFAULT, FLORA);
  profile.use(p);
  try {
    const c = session(p);
    c.say("бордо на завтра утром, заберу сам");
    c.say("Игорь");
    c.say("9037654321");
    c.say("да");
    assert.match(c.all(), /Заказ ЦВ-2026-1001 принят/);
    assert.match(c.all(), /Хорошего дня!/);
    assert.equal(c.store.get("ЦВ-2026-1001").customer.name, "Игорь");
    assert.equal(c.store.get("1001").id, "ЦВ-2026-1001");
    c.say("где заказ цв-2026-1001?");
    assert.match(c.all(), /ЦВ-2026-1001: новый/);
    assert.match(messages.render("created", c.store.get("1001")), /^«Флора»: заказ ЦВ-2026-1001 принят\. Менеджер позвонит/);
  } finally {
    profile.use(null);
  }
});

test("база знаний: частые вопросы с Авито и из чатов", () => {
  const c = session(profile.DEFAULT);
  c.say("Здравствуйте, ещё актуально?");
  assert.match(c.all(), /Да, в наличии/);
  c.say("а можно оплатить наличными?");
  assert.match(c.all(), /Оплатить можно картой или через СБП/);
  c.say("доставляете в Химки?");
  assert.match(c.all(), /Подмосковье/);
  // посреди заказа: ответ и возврат к вопросу
  c.say("тюльпаны на завтра");
  c.say("", "p:tulip");
  const step = c.r.state.step;
  c.say("а фото пришлёте перед доставкой?");
  assert.match(c.all(), /пришлём фото готового букета/);
  assert.equal(c.r.state.step, step);
});

test("ночью бот честно говорит, когда перезвонят", () => {
  const c = session(profile.DEFAULT, NIGHT);
  c.say("бордо на завтра утром, заберу сам");
  c.say("Игорь");
  c.say("9037654321");
  c.say("да");
  assert.match(c.all(), /Сейчас мы закрыты, но заказ уже у нас\. В 9:00 флорист первым делом позвонит/);
  const cb = session(profile.DEFAULT, NIGHT);
  cb.say("позовите флориста");
  cb.say("Анна 89261112233");
  assert.match(cb.all(), /утром, как только откроемся в 9:00/);
});

test("разговор по объявлению: товар уже известен, бот сразу спрашивает дату", () => {
  const store = S.createStore({ storage: S.memoryStorage(), now: () => NOW });
  const ctx = { now: () => NOW, create: (i) => store.create(i), lookup: (id) => store.get(id) };
  const r = bot.startWithProduct("bordo", ctx);
  assert.match(r.messages[0].text, /по объявлению «Бордо» — 6 800 ₽/);
  assert.equal(r.state.step, "date");
  assert.equal(r.state.draft.product, "bordo");
});

test("шаблоны SMS заполняются переменными, неизвестные остаются как есть", () => {
  assert.equal(profile.fill("Заказ {id} на {sum}, {unknown}", { id: "СТ-1", sum: "100 ₽" }), "Заказ СТ-1 на 100 ₽, {unknown}");
});
