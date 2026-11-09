// Сбор базы знаний: агент читает переписки сотрудников, шаблоны и вопросы клиентов
// и собирает профиль бизнеса — тон, приветствие, формат номеров, шаблоны, частые вопросы, контакты.
// Работает без внешних сервисов, по правилам. На claude.ai результат можно уточнить с помощью Claude.
(function (root, factory) {
  const profile = typeof require === "function" ? require("./profile.js") : root.Flora.profile;
  const mod = factory(profile);
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).kb = mod;
})(typeof self !== "undefined" ? self : this, function (profile) {
  const low = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");
  const EMOJI = /\p{Extended_Pictographic}/gu;
  const countBy = (arr) => arr.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  const top = (arr, n = 1) => [...countBy(arr).entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  const STAFF_DEFAULT = ["менеджер", "флорист", "продавец", "администратор", "оператор", "магазин", "поддержка"];

  // ---------- переписки ----------
  // Строки вида «Имя: текст», «[12:03] Имя: текст». Пустая строка или «---» — новый разговор.
  function parseChats(text, staffNames = STAFF_DEFAULT) {
    const staff = staffNames.map(low).filter(Boolean);
    const out = [];
    let conv = 0;
    let last = null;
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || /^-{3,}$/.test(line)) { conv += 1; last = null; continue; }
      const m = line.match(/^(?:\[[^\]]*\]\s*)?(?:\d{1,2}[.:]\d{2}\s*[-—]?\s*)?([^:]{1,40}):\s*(.+)$/);
      if (m) {
        const who = staff.some((s) => low(m[1]).includes(s)) ? "staff" : "client";
        last = { conv, who, name: m[1].trim(), text: m[2].trim() };
        out.push(last);
      } else if (last) last.text += "\n" + line;
    }
    return out;
  }

  const VY = /(^|[^а-яё])(вы|вас|вам|вами|ваш|ваша|ваше|ваши|вашего|вашу|вашим)(?=[^а-яё]|$)/gi;
  const TY = /(^|[^а-яё])(ты|тебя|тебе|тобой|твой|твоя|твое|твоё|твои|твоего)(?=[^а-яё]|$)/gi;
  const GREET = /^(добрый день|добрый вечер|доброе утро|здравствуйте|привет|приветствуем вас|приветствую)[!,.]?/i;
  const SIGNOFF = /(хорошего дня|хорошего вечера|всего доброго|спасибо за заказ|ждём вас снова|ждем вас снова|до встречи|обращайтесь)[!.]?\s*(\p{Extended_Pictographic})?\s*$/iu;
  const FILLERS = ["ну", "короче", "как бы", "типа того", "вообще-то", "щас", "блин", "в общем", "это самое", "так сказать"];

  function analyzeTone(staffMsgs) {
    const all = staffMsgs.map((m) => m.text).join("\n");
    const vy = (all.match(VY) || []).length;
    const ty = (all.match(TY) || []).length;
    const withEmoji = staffMsgs.filter((m) => (m.text.match(EMOJI) || []).length).length;
    const emojis = staffMsgs.flatMap((m) => m.text.match(EMOJI) || []);
    const greet = staffMsgs.map((m) => (m.text.match(GREET) || [])[1]).filter(Boolean).map((g) => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase());
    const sign = staffMsgs.map((m) => (m.text.match(SIGNOFF) || [])[1]).filter(Boolean).map((g) => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase());
    const rate = staffMsgs.length ? withEmoji / staffMsgs.length : 0;
    return {
      address: ty > vy ? "ты" : "вы", vy, ty,
      emojiRate: rate, emoji: rate >= 0.15 && emojis.length ? top(emojis)[0][0] : "",
      greeting: greet.length ? top(greet)[0][0] + "!" : "", greetingCount: greet.length,
      signoff: sign.length >= 2 ? top(sign)[0][0] + "!" : "", signoffCount: sign.length,
      avgLength: staffMsgs.length ? Math.round(staffMsgs.reduce((s, m) => s + m.text.length, 0) / staffMsgs.length) : 0,
      phrases: phrases(staffMsgs),
    };
  }

  const SKIP = new Set(["и", "в", "на", "с", "по", "к", "а", "но", "что", "это", "мы", "вы", "вам", "вас", "ваш", "у", "за", "до", "от", "для", "из", "не", "же", "ли", "бы", "о", "об", "ну", "как", "так", "то", "да", "нет", "я", "он", "она", "они", "все", "всё", "уже", "еще", "ещё", "если", "или"]);
  function phrases(staffMsgs) {
    const grams = [];
    for (const m of staffMsgs) {
      const w = low(m.text).replace(EMOJI, " ").split(/[^а-яa-z0-9-]+/).filter(Boolean);
      for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= w.length; i++) {
        const g = w.slice(i, i + n);
        if (g.filter((x) => !SKIP.has(x)).length >= 2) grams.push(g.join(" "));
      }
    }
    return top(grams, 12).filter(([, c]) => c >= 2).map(([g]) => g).slice(0, 6);
  }

  // ---------- номера заказов ----------
  function analyzeIds(text) {
    const ids = [...String(text || "").matchAll(/(^|[^А-ЯЁA-Zа-яё])([А-ЯЁA-Z]{1,4})-(?:(20\d{2})-)?(\d{2,6})(?![\d])/g)].map((m) => ({ prefix: m[2], year: m[3], n: m[4], raw: `${m[2]}-${m[3] ? m[3] + "-" : ""}${m[4]}` }));
    if (!ids.length) return null;
    const [prefix] = top(ids.map((x) => x.prefix))[0];
    const own = ids.filter((x) => x.prefix === prefix);
    return { order: prefix, withYear: own.filter((x) => x.year).length > own.length / 2, examples: [...new Set(own.map((x) => x.raw))].slice(0, 4) };
  }

  // ---------- шаблоны ----------
  const TEMPLATE_KEYS = [
    ["pay_reminder", /напомина\S*.*оплат|оплат\S*.*напомина|ещё не оплачен|еще не оплачен/],
    ["paid", /оплат\S* (получен|прошла)|получили оплату/],
    ["payment_failed", /оплат\S* не прошла|не удалось оплатить/],
    ["confirmed", /подтвержд|к оплате|ссылк\S* на оплату/],
    ["night", /откроемся|утром (позвоним|свяжемся|перезвоним)|ночью/],
    ["delivering", /курьер|в пути|выехал/],
    ["ready", /готов\S*.*(забрать|выдач)|можно забирать/],
    ["cancelled", /отмен/],
    ["review", /оцени|отзыв|от 1 до 5/],
    ["done", /выполнен|доставлен|вручили|рады видеть|спасибо за заказ/],
    ["created", /принят|получили (ваш )?заказ|оформлен/],
  ];
  const NAMED = { "заказ принят": "created", "принят": "created", "подтверждение": "confirmed", "подтверждён": "confirmed", "напоминание об оплате": "pay_reminder", "оплата получена": "paid", "оплата не прошла": "payment_failed", "курьер": "delivering", "в пути": "delivering", "готов к выдаче": "ready", "выполнен": "done", "отмена": "cancelled", "отзыв": "review", "ночью": "night", "ночное": "night" };

  function generalize(text, ctx) {
    let t = String(text).trim();
    t = t.replace(/https?:\/\/\S+?(?=[.,;:!?)]?(?:\s|$))/g, "{link}");
    t = t.replace(/(^|[^А-ЯЁA-Zа-яё])[А-ЯЁA-Z]{1,4}-(?:20\d{2}-)?\d{2,6}(?!\d)/g, "$1{id}");
    t = t.replace(/\d{1,2}[:.]\d{2}\s*[–—-]\s*\d{1,2}[:.]\d{2}/g, "{slot}");
    t = t.replace(/\d[\d\s ]*\s?(₽|руб\.?|р\.)/g, "{sum}");
    t = t.replace(/\+7[\d\s()-]{10,}\d/g, "{phone}");
    if (ctx.name) t = t.split(ctx.name).join("{shop}");
    if (ctx.address) t = t.split(ctx.address).join("{address}");
    return t;
  }

  function parseTemplates(text, ctx) {
    const found = {};
    for (const block of String(text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)) {
      let key = null;
      let body = block;
      const m = block.match(/^([^:\n]{2,40}):\s*([\s\S]+)$/);
      if (m && NAMED[low(m[1]).trim()]) { key = NAMED[low(m[1]).trim()]; body = m[2]; }
      if (!key) { const hit = TEMPLATE_KEYS.find(([, re]) => re.test(low(body))); key = hit ? hit[0] : null; }
      if (key && !found[key]) found[key] = generalize(body, ctx);
    }
    return found;
  }

  // ---------- вопросы и ответы ----------
  const COMMON = ["приве", "здрав", "добро", "букет", "цвето", "заказ", "можно", "скажи", "подска", "здравс", "пожалу", "спасиб", "добры", "хочу", "нужно", "сколь", "будет", "есть", "какой", "какие", "когда", "сегод", "завтр"];
  function keywords(q) {
    const words = low(q).split(/[^а-я0-9]+/).filter((w) => w.length >= 4);
    const stems = words.map((w) => w.slice(0, Math.min(6, Math.max(4, w.length - 2))));
    return [...new Set(stems)].filter((s) => !COMMON.some((c) => s.startsWith(c) || c.startsWith(s))).slice(0, 4);
  }
  // Ответ без слов-паразитов: агент повторяет смысл, а не манеру.
  function clean(text) {
    let t = String(text);
    for (const w of [...FILLERS, ...profile.DEFAULT.stopWords]) {
      const re = new RegExp(`(^|[\\s,.!?])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s,.!?]|$),?`, "gi");
      t = t.replace(re, "$1");
    }
    return t.replace(/\s+([,.!?])/g, "$1").replace(/,\s*,/g, ",").replace(/^[,\s]+/, "").replace(/\s{2,}/g, " ").replace(/^./, (c) => c.toUpperCase()).trim();
  }
  function faqFromChats(msgs) {
    const out = [];
    for (let i = 0; i < msgs.length - 1; i++) {
      const q = msgs[i];
      const a = msgs[i + 1];
      if (q.who !== "client" || a.who !== "staff" || q.conv !== a.conv || !q.text.includes("?")) continue;
      if (/[А-ЯЁA-Z]{1,4}-\d{2,}|\+7\d|\d{3}-\d{2}-\d{2}/.test(a.text)) continue; // ответ про конкретный заказ
      if (/\?\s*(\p{Extended_Pictographic}\s*)*$/u.test(a.text)) continue; // встречный вопрос — это ход разговора, а не ответ
      const kw = keywords(q.text);
      if (!kw.length || a.text.length < 15) continue;
      out.push({ q: q.text.split("\n")[0], a: clean(a.text), keywords: kw, from: "переписки" });
    }
    return out;
  }
  function parseFaq(text) {
    const out = [];
    for (const block of String(text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)) {
      const m = block.match(/^(?:в(?:опрос)?[:.]\s*)?([^\n]+\?)\s*\n(?:о(?:твет)?[:.]\s*)?([\s\S]+)$/i);
      if (m) { const kw = keywords(m[1]); if (kw.length) out.push({ q: m[1].trim(), a: clean(m[2].trim()), keywords: kw, from: "список вопросов" }); }
    }
    return out;
  }
  function dedupe(list) {
    const out = [];
    for (const f of list) {
      const dup = out.find((g) => f.keywords.filter((k) => g.keywords.includes(k)).length >= Math.ceil(Math.min(f.keywords.length, g.keywords.length) / 2));
      if (!dup) out.push(f);
    }
    return out;
  }

  // ---------- контакты ----------
  function analyzeContacts(text) {
    const t = String(text || "");
    const c = {};
    const phone = t.match(/\+7[\d\s()-]{10,}\d/);
    if (phone) c.phone = phone[0].replace(/\s+/g, " ").trim();
    const hours = t.match(/(?:^|[^а-я])с\s*(\d{1,2})(?::00)?\s*(?:до|–|—|-)\s*(\d{1,2})(?::00)?/i);
    if (hours && +hours[1] < +hours[2] && +hours[2] <= 24) c.hours = { from: +hours[1], to: +hours[2] };
    const addrLine = t.match(/адрес[:\s—-]+([^\n]+)/i);
    const addr = addrLine ? addrLine[1].split(/[.;]\s+(?=[А-ЯЁA-Z])/)[0] : (t.match(/((?:ул\.|улица|проспект|пр-т|переулок|пер\.|наб\.|набережная|шоссе|бульвар)\s*[^,\n]*,\s*\d+[а-я]?|[А-ЯЁ][а-яё]+(?:\s[А-ЯЁа-яё]+)?,\s*\d+[а-я]?)/) || [])[1];
    if (addr) c.address = addr.trim().replace(/[.;]$/, "");
    const name = t.match(/«([^»]{2,30})»/);
    if (name) c.name = name[1];
    return c;
  }

  // ---------- слова-паразиты ----------
  function analyzeFillers(staffMsgs, p) {
    const words = [...new Set([...FILLERS, ...(p.stopWords || [])])];
    const res = [];
    for (const w of words) {
      const re = new RegExp(`(^|[^а-яё])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^а-яё]|$)`, "i");
      const hits = staffMsgs.filter((m) => re.test(low(m.text)));
      if (hits.length) res.push({ word: w, count: hits.length, example: hits[0].text.slice(0, 120) });
    }
    return res.sort((a, b) => b.count - a.count);
  }

  // Главная функция: всё вместе. Возвращает профиль и отчёт «что понял и почему».
  function analyze({ chats = "", templates = "", faq = "", contacts = "", staff = STAFF_DEFAULT } = {}, base = profile.DEFAULT) {
    const msgs = parseChats(chats, staff);
    const staffMsgs = msgs.filter((m) => m.who === "staff");
    const tone = analyzeTone(staffMsgs);
    const contactInfo = analyzeContacts([contacts, staffMsgs.map((m) => m.text).join("\n")].join("\n"));
    const ids = analyzeIds([chats, templates].join("\n"));
    const ctx = { name: contactInfo.name || base.business.name, address: contactInfo.address };
    const tpl = parseTemplates(templates, ctx);
    const fq = dedupe([...parseFaq(faq), ...faqFromChats(msgs)]);
    const fillers = analyzeFillers(staffMsgs, base);

    const patch = { business: {}, tone: {}, templates: tpl };
    if (contactInfo.name) patch.business.name = contactInfo.name;
    if (contactInfo.address) patch.business.address = contactInfo.address;
    if (contactInfo.phone) patch.business.phone = contactInfo.phone;
    if (contactInfo.hours) patch.business.hours = contactInfo.hours;
    if (staffMsgs.length) {
      patch.tone.address = tone.address;
      patch.tone.emoji = tone.emoji;
      if (tone.greeting) patch.tone.greeting = tone.greeting;
      patch.tone.signoff = tone.signoff;
      patch.tone.phrases = tone.phrases;
    }
    if (ids) patch.orderId = { order: ids.order, callback: base.orderId.callback, withYear: ids.withYear };
    const merged = profile.merge(base, patch);
    // свои вопросы — первыми, стандартные остаются, если не пересекаются
    merged.faq = dedupe([...fq.map(({ q, a, keywords: k }) => ({ q, a, keywords: k })), ...base.faq]);

    return {
      profile: merged,
      report: {
        messages: msgs.length, staffMessages: staffMsgs.length, clientMessages: msgs.length - staffMsgs.length,
        conversations: new Set(msgs.map((m) => m.conv)).size,
        tone, ids, contacts: contactInfo, templates: Object.keys(tpl), faq: fq, fillers,
      },
    };
  }

  // Проверка качества всего, что агент будет писать: шаблоны и ответы базы знаний.
  function quality(p) {
    const issues = [];
    for (const [k, t] of Object.entries(p.templates || {})) for (const w of profile.lint(t, p)) issues.push({ where: `шаблон «${k}»`, word: w });
    for (const f of p.faq || []) for (const w of profile.lint(f.a, p)) issues.push({ where: `ответ на «${f.q}»`, word: w });
    return issues;
  }

  return { parseChats, analyze, quality, clean, keywords, generalize, STAFF_DEFAULT };
});
