// Разбор диалогов: где агент не понял клиента, где клиент ушёл, чему агент ещё не научился.
// Исправление ответа превращается в частый вопрос в профиле бизнеса — агент сразу начинает так отвечать.
// Это ежемесячная работа по сопровождению: разобрать диалоги, дописать базу знаний, проверить.
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).review = mod;
})(typeof self !== "undefined" ? self : this, function () {
  const MISS = /не совсем понял|не понял|не нашёл такого|не нашел такого|не разобрал/i;
  const ANGRY = /не то|не понимаете|не понимаешь|бот\b|робот|позовите|живого|человек|оператор|ерунд|бесит|\?!|!!/i;
  const STOP = new Set("можно есть ваши ваша ваше вашу если когда какой какая какие какую сколько стоит будет будут буду нужно надо здравствуйте добрый день вечер утро пожалуйста спасибо хочу хотел хотела подскажите скажите а ли или для это этот эта эти того тоже также ещё еще уже очень просто".split(" "));

  // Опорные слова вопроса для поиска: «Работаете 31 декабря?» → ["работ", "декабр"]
  function keywordsOf(question) {
    const words = String(question || "").toLowerCase().replace(/ё/g, "е").match(/[а-я]{4,}/g) || [];
    const out = [];
    for (const w of words) {
      if (STOP.has(w)) continue;
      const stem = w.length > 6 ? w.slice(0, 6) : w.length > 4 ? w.slice(0, w.length - 1) : w;
      if (!out.includes(stem)) out.push(stem);
    }
    return out.slice(0, 5);
  }

  // Реплики-реакции («ясно», «позовите человека») — не вопрос, которому надо учить агента.
  const REACT = /^(ясно|понятно|спасибо|ок|окей|хорошо|ладно|ну ладно|жаль)[\s,.!]*/i;
  const isReaction = (text) => REACT.test(text) || ANGRY.test(text);
  function questionBefore(turns, i) {
    const prev = turns.slice(0, i).reverse().filter((x) => x.from === "client");
    return (prev.find((x) => !isReaction(x.text)) || prev[0] || {}).text;
  }

  // Проблемы в разговоре. turns: [{from: "client"|"bot", text}], outcome: order|callback|lost
  function issues(turns, outcome) {
    const out = [];
    turns.forEach((t, i) => {
      if (t.from !== "bot") return;
      const q = questionBefore(turns, i);
      if (!q) return;
      if (MISS.test(t.text)) out.push({ at: i, type: "miss", title: "Агент не понял", question: q });
      const next = turns[i + 1];
      if (next && next.from === "client" && ANGRY.test(next.text)) out.push({ at: i, type: "angry", title: "Клиент недоволен ответом", question: q });
    });
    const last = turns[turns.length - 1];
    if (outcome === "lost" && last && last.from === "bot" && !out.some((x) => x.at === turns.length - 1)) {
      const q = questionBefore(turns, turns.length);
      if (q) out.push({ at: turns.length - 1, type: "left", title: "Клиент ушёл после ответа", question: q });
    }
    return out;
  }

  // Записи CRM с перепиской → разговоры для разбора.
  function fromRecords(records) {
    return records.filter((r) => Array.isArray(r.dialog) && r.dialog.length).map((r) => ({
      id: r.id, source: r.source, at: r.createdAt, name: (r.customer && r.customer.name) || "",
      outcome: r.status === "cancelled" ? "lost" : r.kind,
      turns: r.dialog,
    }));
  }

  function analyze(dialogs) {
    const list = dialogs.map((d) => ({ ...d, issues: issues(d.turns, d.outcome) }));
    const problems = list.filter((d) => d.issues.length);
    // одинаковые пробелы в знаниях — вместе: «чему агент ещё не научился»
    const gaps = {};
    for (const d of problems) for (const i of d.issues) {
      const key = keywordsOf(i.question).slice(0, 2).join(" ") || i.question.toLowerCase();
      (gaps[key] = gaps[key] || { question: i.question, count: 0, types: new Set(), dialogs: [] }).count++;
      gaps[key].types.add(i.type);
      gaps[key].dialogs.push(d.id);
    }
    return {
      dialogs: list,
      total: list.length,
      clean: list.length - problems.length,
      quality: list.length ? (list.length - problems.length) / list.length : 1,
      gaps: Object.values(gaps).map((g) => ({ ...g, types: [...g.types] })).sort((a, b) => b.count - a.count),
    };
  }

  // Исправленный ответ → частый вопрос в профиле. Тот же вопрос заменяется, а не дублируется.
  function addFaq(profile, { q, a, keywords }) {
    const kw = (keywords && keywords.length ? keywords : keywordsOf(q)).map((k) => String(k).toLowerCase().trim()).filter(Boolean);
    if (!String(a || "").trim() || !kw.length) throw new Error("Нужны ответ и хотя бы одно опорное слово.");
    const faq = (profile.faq || []).filter((f) => f.q !== q);
    faq.push({ q: String(q).trim(), keywords: kw, a: String(a).trim(), learned: true });
    return { ...profile, faq };
  }

  // Демо-разговоры для разбора: живые вопросы, на которые у «Стебля» пока нет ответа.
  const DEMO = [
    { id: "Д-1", source: "avito", name: "Ксения", outcome: "lost", script: ["Здравствуйте! Есть скидка постоянным клиентам?", "ясно, спасибо"] },
    { id: "Д-2", source: "telegram", name: "Олег", outcome: "lost", script: ["Можно оплатить по счёту для юрлица?", "мне нужен счёт на организацию, а не карта"] },
    { id: "Д-3", source: "vk", name: "Марина", outcome: "lost", script: ["Работаете 31 декабря?"] },
    { id: "Д-4", source: "chat", name: "Павел", outcome: "lost", script: ["Доставите в Зеленоград?", "это не ответ на мой вопрос!!"] },
    { id: "Д-5", source: "avito", name: "Алина", outcome: "lost", script: ["А корзину с фруктами можно?"] },
    { id: "Д-6", source: "max", name: "Света", outcome: "lost", script: ["Скидка есть, если беру часто?"] },
    { id: "Д-7", source: "telegram", name: "Руслан", outcome: "lost", script: ["Можно с игрушкой?", "позовите человека"] },
    { id: "Д-8", source: "chat", name: "Ирина", outcome: "order", script: ["хочу пионы маме на завтра", "Утро на даче", "Заберу сам"] },
    { id: "Д-9", source: "avito", name: "Денис", outcome: "lost", script: ["В новогоднюю ночь 31 декабря доставляете?"] },
  ];
  // Прогоняет демо-разговоры через настоящего бота, чтобы в разборе были его реальные ответы.
  function demoDialogs(bot, ctx) {
    return DEMO.map((d) => {
      let r = bot.start();
      const turns = [];
      for (const text of d.script) {
        turns.push({ from: "client", text });
        r = bot.reply(r.state, { text }, ctx);
        turns.push({ from: "bot", text: r.messages.map((m) => m.text).filter(Boolean).join("\n") });
      }
      return { id: d.id, source: d.source, name: d.name, outcome: d.outcome, turns, demo: true };
    });
  }

  return { keywordsOf, issues, fromRecords, analyze, addFaq, demoDialogs, DEMO };
});
