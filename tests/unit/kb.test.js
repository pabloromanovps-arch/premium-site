// База знаний: агент учится у переписок сотрудников и настраивает бота под бизнес.
const test = require("node:test");
const assert = require("node:assert/strict");
const kb = require("../../js/kb.js");
const samples = require("../../js/kb-samples.js");
const profile = require("../../js/profile.js");
const bot = require("../../js/bot.js");
const S = require("../../js/store.js");

const run = (name) => {
  const s = samples[name];
  return kb.analyze({ chats: s.chats, templates: s.templates, faq: s.faq, contacts: s.contacts, staff: s.staff.split(/,\s*/) });
};

test("переписки разбираются по ролям и разговорам", () => {
  const msgs = kb.parseChats("Клиент: Привет?\nФлорист: Добрый день!\nпродолжение\n---\nКлиент: ещё", ["флорист"]);
  assert.deepEqual(msgs.map((m) => [m.conv, m.who]), [[0, "client"], [0, "staff"], [1, "client"]]);
  assert.equal(msgs[1].text, "Добрый день!\nпродолжение");
});

test("«Стебель»: тон на «вы», фирменный эмодзи, приветствие и прощание", () => {
  const { report, profile: p } = run("stebel");
  assert.equal(report.tone.address, "вы");
  assert.equal(report.tone.emoji, "🌷");
  assert.equal(report.tone.greeting, "Добрый день!");
  assert.equal(report.tone.signoff, "Хорошего дня!");
  assert.equal(p.tone.greeting, "Добрый день!");
});

test("«Стебель»: номера заказов, контакты и шаблоны с переменными", () => {
  const { report, profile: p } = run("stebel");
  assert.deepEqual(report.ids, { order: "СТ", withYear: false, examples: ["СТ-1042", "СТ-1043", "СТ-1040"] });
  assert.equal(p.business.name, "Стебель");
  assert.equal(p.business.address, "Покровка, 12");
  assert.deepEqual(p.business.hours, { from: 9, to: 21 });
  assert.equal(p.templates.confirmed, "«{shop}»: заказ {id} подтверждён, к оплате {sum}. Оплатить: {link}");
  assert.equal(p.templates.delivering, "«{shop}»: курьер везёт заказ {id}, интервал {slot}.");
  assert.ok(report.templates.includes("pay_reminder") && report.templates.includes("done"));
});

test("«Стебель»: частые вопросы из переписок — без слов-паразитов сотрудников", () => {
  const { report, profile: p } = run("stebel");
  const qs = report.faq.map((f) => f.q);
  assert.ok(qs.some((q) => /вернуть букет/.test(q)), "из списка вопросов");
  assert.ok(qs.some((q) => /Химки/.test(q)), "из переписок");
  assert.ok(report.fillers.some((f) => f.word === "как бы") && report.fillers.some((f) => f.word === "короче"), "нашёл паразитов у сотрудника");
  for (const f of p.faq) assert.deepEqual(profile.lint(f.a), [], f.a);
  assert.deepEqual(kb.quality(p), []);
});

test("«Флора»: на «ты», 🌸, формат ЦВ-2026-0153, часы 10–20", () => {
  const { report, profile: p } = run("flora");
  assert.equal(p.tone.address, "ты");
  assert.equal(p.tone.emoji, "🌸");
  assert.equal(p.tone.greeting, "Привет!");
  assert.deepEqual(p.orderId, { order: "ЦВ", callback: "ЗВ", withYear: true });
  assert.equal(p.business.name, "Флора");
  assert.deepEqual(p.business.hours, { from: 10, to: 20 });
  assert.ok(report.faq.some((f) => /открытку/.test(f.q)));
  assert.ok(!report.faq.some((f) => /есть пионы/.test(f.q)), "встречный вопрос сотрудника — ход продажи, а не ответ для базы знаний");
});

test("бот с профилем «Флоры» говорит её голосом и выдаёт её номера", () => {
  const { profile: p } = run("flora");
  const now = new Date("2026-10-21T08:30:00Z"); // 11:30 МСК
  const store = S.createStore({ storage: S.memoryStorage(), now: () => now });
  profile.use(p);
  try {
    const ctx = { now: () => now, create: (i) => store.create(i), lookup: (id) => store.get(id), profile: p };
    let r = bot.start({ profile: p });
    assert.match(r.messages[0].text, /^Привет! Это «Флора»/);
    assert.match(r.messages[0].text, /🌸$/);
    for (const t of ["бордо на завтра утром, заберу сам", "Игорь", "9037654321", "да"]) r = bot.reply(r.state, { text: t }, ctx);
    assert.match(r.messages[0].text, /Заказ ЦВ-2026-1001 принят/);
    assert.match(r.messages[0].text, /Хорошего дня!/);
    r = bot.reply(r.state, { text: "а можно открытку?" }, ctx);
    assert.match(r.messages[0].text, /Открытка бесплатно/);
  } finally {
    profile.use(null);
  }
});

test("шаблоны обобщаются: номер, сумма, время, ссылка, телефон", () => {
  assert.equal(kb.generalize("Заказ ЦВ-2026-0153 на 4 200 ₽, с 12:00–15:00, https://x.ru/1, тел +7 495 111-22-33", {}), "Заказ {id} на {sum}, с {slot}, {link}, тел {phone}");
});

test("очистка ответа убирает паразитов и не ломает текст", () => {
  assert.equal(kb.clean("Ну как бы получится 900 ₽ доставка, короче, можем завтра"), "Получится 900 ₽ доставка, можем завтра");
});

test("пустые данные — профиль по умолчанию без ошибок", () => {
  const { profile: p, report } = kb.analyze({});
  assert.equal(report.messages, 0);
  assert.equal(p.business.name, "Стебель");
  assert.ok(p.faq.length >= profile.DEFAULT.faq.length);
});
