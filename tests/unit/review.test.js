// Разбор диалогов: находим провалы, исправление становится знанием агента.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../js/review.js");
const bot = require("../../js/bot.js");
const profile = require("../../js/profile.js");
const S = require("../../js/store.js");

const ctx = () => { const st = S.createStore({ storage: S.memoryStorage() }); return { now: () => new Date("2026-11-09T09:00:00Z"), create: (i) => st.create(i), lookup: (id) => st.get(id) }; };

test("опорные слова вопроса", () => {
  assert.deepEqual(R.keywordsOf("Работаете 31 декабря?"), ["работа", "декабр"]);
  assert.deepEqual(R.keywordsOf("Можно оплатить по счёту для юрлица?"), ["оплати", "счет", "юрлиц"]);
});

test("разбор демо-разговоров: непонятые вопросы, недовольство, уход; удачный заказ без замечаний", () => {
  const rep = R.analyze(R.demoDialogs(bot, ctx()));
  const byId = Object.fromEntries(rep.dialogs.map((d) => [d.id, d]));
  assert.ok(byId["Д-3"].issues.some((i) => i.type === "miss"));
  assert.ok(byId["Д-4"].issues.some((i) => i.type === "angry"));
  assert.ok(byId["Д-2"].issues.some((i) => i.type === "angry" || i.type === "left"), "ответ про карту не подошёл юрлицу");
  assert.equal(byId["Д-8"].issues.length, 0);
  assert.ok(rep.quality < 0.5);
  const gap = rep.gaps.find((g) => /31 декабря/.test(g.question));
  assert.ok(gap && gap.count >= 1);
});

test("исправленный ответ попадает в базу знаний — агент отвечает правильно, остальное не ломается", () => {
  const c = ctx();
  let p = profile.merge(profile.DEFAULT, {});
  p = R.addFaq(p, { q: "Работаете 31 декабря?", a: "31 декабря работаем до 18:00, 1 января — выходной." });
  p = R.addFaq(p, { q: "Можно оплатить по счёту для юрлица?", a: "Да, выставим счёт на организацию — пришлите реквизиты, закрывающие документы отдадим с букетом." });
  profile.use(p);
  try {
    const a = bot.reply(bot.start().state, { text: "Вы работаете 31 декабря?" }, c);
    assert.match(a.messages[0].text, /до 18:00/);
    const b = bot.reply(bot.start().state, { text: "Можно оплатить по счёту для юрлица?" }, c);
    assert.match(b.messages[0].text, /счёт на организацию/);
    const card = bot.reply(bot.start().state, { text: "Можно оплатить картой?" }, c);
    assert.match(card.messages[0].text, /картой или через СБП/, "старый ответ про карту остался");
  } finally { profile.use(null); }
  assert.equal(R.addFaq(p, { q: "Работаете 31 декабря?", a: "до 17" }).faq.filter((f) => /31 декабря/.test(f.q)).length, 1);
  assert.throws(() => R.addFaq(p, { q: "x", a: "" }));
});

test("переписка из CRM идёт в разбор", () => {
  const recs = [{ id: "СТ-1", source: "chat", createdAt: "2026-11-09T09:00:00Z", kind: "order", status: "new", customer: { name: "А" }, dialog: [{ from: "client", text: "хочу пионы" }, { from: "bot", text: "Подобрал" }] }];
  const d = R.fromRecords(recs);
  assert.equal(d[0].outcome, "order");
  assert.equal(R.analyze(d).quality, 1);
});

test("учим отвечать на вопрос, а не на «ясно, спасибо» или «позовите человека»", () => {
  const rep = R.analyze(R.demoDialogs(bot, ctx()));
  const qs = rep.gaps.map((g) => g.question);
  assert.ok(!qs.some((q) => /^ясно|позовите|не ответ/i.test(q)), qs.join(" | "));
  assert.ok(qs.some((q) => /скидка постоянным/.test(q)));
});
