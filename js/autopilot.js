// Автопилот: магазин работает сам. Виртуальные клиенты пишут во все каналы, бот отвечает,
// виртуальные менеджеры и курьеры ведут заказы, ИИ-агент подхватывает то, что люди упустили.
// Время виртуальное: сутки можно прогнать за минуту. Один и тот же seed даёт один и тот же день.
(function (root, factory) {
  const dep = (name, file) => (typeof require === "function" ? require(file) : root.Flora[name]);
  const mod = factory(dep("store", "./store.js"), dep("channels", "./channels.js"), dep("agent", "./agent.js"), dep("validate", "./validate.js"),
    dep("catalog", "./catalog.js"), dep("cart", "./cart.js"), dep("messages", "./messages.js"), dep("profile", "./profile.js"));
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).autopilot = mod;
})(typeof self !== "undefined" ? self : this, function (S, CH, agent, validate, catalog, cart, messages, profileLib) {
  const MIN = 60000;
  const STOPPED = { product: "не выбрав букет", date: "не выбрав день", slot: "не выбрав время", fulfillment: "не выбрав доставку или самовывоз", address: "не написав адрес", name: "не назвав имя", phone: "не оставив телефон", confirm: "не подтвердив заказ" };
  const TAG = "autopilot";

  // ---------- режимы ----------
  // rate(h) — сколько новых клиентов в час (по Москве); manager — через сколько минут менеджер берёт заявку.
  const MODES = {
    normal: {
      title: "Обычный день", about: "Ровный поток заявок, менеджеры на месте с 9 до 21.", startHour: 8,
      rate: (h) => (h >= 9 && h < 21 ? 5 : h >= 7 && h < 23 ? 1.5 : 0.4), manager: [3, 12],
    },
    rush: {
      title: "Перед праздником", about: "Наплыв как перед 8 Марта: заявок втрое больше, менеджеры не успевают.", startHour: 8,
      rate: (h) => (h >= 8 && h < 22 ? 14 : 3), manager: [10, 45],
    },
    night: {
      title: "Ночная смена", about: "Магазин закрывается в 21:00, а заявки идут. Ночью работают только бот и агент.", startHour: 20,
      rate: (h) => (h >= 20 && h < 24 ? 4 : h < 2 ? 2 : h < 9 ? 0.6 : 5), manager: [3, 12],
    },
    busy: {
      title: "Менеджеры заняты", about: "Заявки обычные, но менеджеры отвечают через полчаса-час. Видно, как агент не даёт заказам остыть.", startHour: 10,
      rate: (h) => (h >= 9 && h < 21 ? 5 : 1), manager: [25, 90],
    },
    outage: {
      title: "Сбой Telegram", about: "Уведомления менеджеру не доходят. Заявки всё равно сохраняются в CRM, агент следит за сроками.", startHour: 11,
      rate: (h) => (h >= 9 && h < 21 ? 5 : 1), manager: [5, 20], tgDown: true,
    },
  };

  // Откуда приходят клиенты: Авито — главный канал.
  const MIX = [["avito", 0.38], ["telegram", 0.16], ["site", 0.14], ["chat", 0.1], ["vk", 0.08], ["max", 0.08], ["alice", 0.06]];

  const NAMES = ["Анна", "Мария", "Ольга", "Дмитрий", "Сергей", "Екатерина", "Алексей", "Наталья", "Иван", "Юлия", "Андрей", "Татьяна", "Максим", "Елена", "Павел", "Ксения", "Артём", "Виктория", "Роман", "Ирина", "Никита", "Полина", "Глеб", "Дарья"];
  const STREETS = ["Ленинский проспект", "Тверская", "Профсоюзная", "Мичуринский проспект", "Бауманская", "Кутузовский проспект", "Нахимовский проспект", "Большая Никитская", "Пятницкая", "ул. Вавилова", "Мосфильмовская", "Остоженка"];

  // Как ведут себя клиенты. first — с чего начинают; leave — на каком шаге бросят разговор; back — вернутся ли после напоминания агента.
  const PERSONAS = [
    { first: "пионы маме на завтра вечером до 5000", f: "delivery" },
    { first: "розы к 18, заберу сам", f: "pickup" },
    { first: "что-нибудь недорогое подруге на др", f: "pickup", pay: "forget" },
    { first: "Здравствуйте, ещё актуально?", f: "delivery", avitoOnly: true },
    { first: "Добрый день! Можно доставку на завтра?", f: "delivery", avitoOnly: true },
    { first: "можно оплатить картой?", then: "хочу тюльпаны на завтра", f: "delivery" },
    { first: "доставляете за МКАД?", then: "тогда бордо на завтра утром", f: "delivery" },
    { first: "шикарный букет на юбилей жене", f: "delivery", pay: "decline" },
    { first: "тюльпаны на завтра", f: "delivery", leave: "phone", back: true },
    { first: "хочу букет", f: "pickup", leave: "slot", back: false },
    { first: "ранункулюсы в субботу утром", f: "pickup", leave: "name", back: true },
    { first: "сирень на завтра днём, доставка", f: "delivery", pay: "forget" },
    { first: "позовите флориста", callback: true },
    { first: "нужно 30 букетов на корпоратив", callback: true },
    { first: "полевой букет завтра утром, заберу сам", f: "pickup" },
    { first: "привет", then: "хочу розы до 4000", f: "delivery", leave: "address", back: true },
    { first: "Здравствуйте, а за МКАД доставляете?", f: "delivery", avitoOnly: true, pay: "forget" },
    { first: "букет извиниться перед девушкой, сегодня вечером", f: "delivery" },
  ];

  // ---------- случайности с seed ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts = {}) {
    const mode = MODES[opts.mode] ? opts.mode : "normal";
    const M = MODES[mode];
    const P = opts.profile || profileLib.get();
    const rand = rng(opts.seed || 2026);
    const between = (a, b) => a + rand() * (b - a);
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const sim = opts.sim;
    const startDay = validate.moscowNow(opts.start ? new Date(opts.start) : new Date()).date;
    let t = opts.start ? new Date(opts.start).getTime() : new Date(`${startDay}T${String(M.startHour).padStart(2, "0")}:00:00+03:00`).getTime();
    const t0 = t;
    const now = () => new Date(t);
    const hourMsk = () => validate.moscowNow(now()).hour;
    const isOpen = () => agent.isOpen(now(), P);

    const events = [];
    const log = (type, text, extra = {}) => {
      const e = { at: now().toISOString(), type, text, ...extra };
      events.push(e);
      if (opts.onEvent) opts.onEvent(e);
      return e;
    };
    const stats = { clients: 0, conversations: 0, orders: 0, callbacks: 0, siteOrders: 0, botReplies: 0, abandoned: 0, followUps: 0, returned: 0, rescuedDialogs: 0,
      byManager: 0, autoConfirmed: 0, paid: 0, paidAfterReminder: 0, revenue: 0, night: 0, tgFailed: 0, byChannel: {} };

    // ---------- CRM и уведомления ----------
    const records = new Map(); // id → { conv, persona }
    const store = S.createStore({
      storage: opts.storage, now,
      onEvent: (e, rec) => {
        if (sim) sim.notify(e, rec);
        if (e.type === "created") onCreated(rec);
        if (e.type === "status" && e.status === "confirmed") onConfirmed(rec);
        if (e.type === "paid") { stats.paid += 1; stats.revenue += rec.totals.total; log("paid", `${rec.id}: клиент оплатил ${cart.formatRub(rec.totals.total)}`, { ref: rec.id }); }
        if (e.type === "payment_failed") log("payment", `${rec.id}: банк отклонил оплату, клиенту ушла ссылка ещё раз`, { ref: rec.id });
      },
    });

    function managerMessage(rec) {
      if (M.tgDown) {
        stats.tgFailed += 1;
        log("fail", `Telegram недоступен: уведомление о ${rec.id} не ушло. Заявка сохранена в CRM, агент следит за сроком.`, { ref: rec.id });
        return;
      }
      if (sim) sim.outbox.push({ channel: "telegram", ref: rec.id, text: messages.formatTelegram(rec) });
    }

    // ---------- очередь событий ----------
    const queue = [];
    const at = (when, fn) => { queue.push({ when, fn }); queue.sort((a, b) => a.when - b.when); };
    const afterMin = (m, fn) => at(t + m * MIN, fn);
    const nextOpening = () => agent.nextOpening(now(), P).getTime();

    // ---------- менеджеры и курьеры ----------
    function managerDelay() {
      const d = between(M.manager[0], M.manager[1]) * MIN;
      return isOpen() ? t + d : nextOpening() + d;
    }
    function onCreated(rec) {
      const ctx = records.get(rec.id) || {};
      records.set(rec.id, ctx);
      const ch = rec.source;
      stats.byChannel[ch] = (stats.byChannel[ch] || 0) + 1;
      if (!isOpen()) stats.night += 1;
      managerMessage(rec);
      if (rec.kind === "order") {
        stats.orders += 1;
        log("order", `${rec.id}: новый заказ (${CH.NAMES[ch === "chat" ? "site" : ch] || "сайт"}) — ${rec.items.map((i) => i.name).join(", ")}, ${cart.formatRub(rec.totals.total)}`, { ref: rec.id, channel: ch });
        at(managerDelay(), () => {
          const r = store.get(rec.id);
          if (r && r.status === "new") {
            store.setStatus(rec.id, "confirmed", "Менеджер");
            stats.byManager += 1;
            log("manager", `${rec.id}: менеджер позвонил и подтвердил заказ`, { ref: rec.id });
          }
        });
      } else {
        stats.callbacks += 1;
        log("order", `${rec.id}: просьба перезвонить (${CH.NAMES[ch === "chat" ? "site" : ch] || ch})`, { ref: rec.id, channel: ch });
        at(managerDelay(), () => {
          const r = store.get(rec.id);
          if (r && r.status === "new") { store.setStatus(rec.id, "called", "Менеджер"); log("manager", `${rec.id}: менеджер перезвонил клиенту`, { ref: rec.id }); }
        });
      }
    }
    function onConfirmed(rec) {
      const ctx = records.get(rec.id) || {};
      const pay = (ctx.persona && ctx.persona.pay) || (rand() < 0.15 ? "forget" : "fast");
      if (pay === "fast") afterMin(between(2, 15), () => safePay(rec.id, "success"));
      if (pay === "decline") {
        afterMin(between(3, 8), () => safePay(rec.id, "declined"));
        afterMin(between(12, 25), () => safePay(rec.id, "success"));
      }
      if (pay === "forget") ctx.waitsReminder = true;
      records.set(rec.id, ctx);
      // флорист и курьер
      afterMin(between(30, 120), () => advance(rec.id, "assembling", "Флорист", "флорист начал собирать букет"));
      afterMin(between(150, 260), () => {
        const r = store.get(rec.id);
        if (!r) return;
        if (r.fulfillment === "pickup") advance(rec.id, "ready", "Флорист", "букет готов к выдаче");
        else advance(rec.id, "delivering", "Курьер", "курьер забрал букет");
      });
      afterMin(between(300, 420), () => advance(rec.id, "done", "Курьер", "заказ вручён"));
    }
    function advance(id, status, by, text) {
      const r = store.get(id);
      if (!r || !S.nextStatuses(r).includes(status)) return;
      if (!isOpen()) return at(nextOpening() + between(10, 60) * MIN, () => advance(id, status, by, text));
      store.setStatus(id, status, by);
      log("progress", `${id}: ${text}`, { ref: id });
    }
    function safePay(id, outcome) {
      const r = store.get(id);
      if (!r || r.payment === "paid" || !S.PAYABLE.includes(r.status)) return;
      store.pay(id, outcome);
    }

    // ---------- ИИ-агент ----------
    function agentTick() {
      const acts = agent.tick({
        store, now: now(), profile: P, filter: (r) => r.tag === TAG,
        notify: {
          manager: (text, r) => (M.tgDown ? log("fail", `Telegram недоступен: напоминание менеджеру о ${r.id} не ушло`, { ref: r.id }) : sim && sim.outbox.push({ channel: "telegram", ref: r.id, text })),
          client: (text, r) => sim && sim.outbox.push({ channel: "sms", ref: r.id, to: r.customer.phone, text }),
        },
      });
      for (const a of acts) {
        log("agent", `ИИ-агент, ${a.id}: ${a.text}`, { ref: a.id });
        if (a.code === "auto_confirm") stats.autoConfirmed += 1;
        const ctx = records.get(a.id);
        if (a.code === "pay_reminder" && ctx && ctx.waitsReminder) {
          ctx.waitsReminder = false;
          afterMin(between(5, 30), () => {
            const r = store.get(a.id);
            safePay(a.id, "success");
            if (r && store.get(a.id).payment === "paid") stats.paidAfterReminder += 1;
          });
        }
      }
      // брошенные разговоры
      for (const c of convs) {
        if (c.status === "waiting" && t - c.lastAt >= P.agent.followUpMin * MIN && !c.followed && isOpenForFollowUp()) {
          c.followed = true;
          stats.followUps += 1;
          const text = agent.followUpText(c.step, P);
          c.log.push({ from: "agent", text, at: now().toISOString() });
          log("agent", `ИИ-агент напомнил клиенту (${CH.NAMES[c.channel]}), который не закончил заказ`, { conv: c.id, channel: c.channel });
          if (c.persona.back) afterMin(between(5, 40), () => { c.status = "active"; c.returned = true; stats.returned += 1; log("dialog", `Клиент вернулся в разговор (${CH.NAMES[c.channel]}) после напоминания агента`, { conv: c.id }); clientTurn(c); });
          else c.status = "lost";
        }
      }
    }
    // Не будим людей напоминаниями среди ночи.
    const isOpenForFollowUp = () => { const h = hourMsk(); return h >= 9 && h < 22; };

    // ---------- разговоры ----------
    const convs = [];
    const sessions = new Map();
    const sess = { get: async (k) => sessions.get(k), set: async (k, v) => { sessions.set(k, v); } };
    let convSeq = 0;
    const ADS = Object.keys((P.avito && P.avito.items) || {});

    function chooseChannel() {
      let x = rand();
      for (const [ch, w] of MIX) { if ((x -= w) < 0) return ch; }
      return "telegram";
    }

    function newClient() {
      stats.clients += 1;
      const channel = chooseChannel();
      const name = pick(NAMES);
      const phone = "+79" + String(Math.floor(between(100000000, 999999999)));
      if (channel === "site") return siteOrder(name, phone);
      const pool = PERSONAS.filter((p) => channel === "avito" || !p.avitoOnly);
      const persona = pick(pool);
      const c = { id: ++convSeq, channel, persona, name, phone, log: [], status: "active", step: "menu", lastAt: t, turns: 0, chatId: `${channel}-${convSeq}`, item: channel === "avito" ? pick(ADS) : null };
      convs.push(c);
      stats.conversations += 1;
      if (convs.length > 300) convs.splice(0, convs.length - 300);
      log("dialog", `Новый клиент пишет в ${CH.NAMES[channel === "chat" ? "site" : channel]}: «${persona.first}»`, { conv: c.id, channel });
      say(c, persona.first);
    }

    function siteOrder(name, phone) {
      const p = pick(catalog.products);
      const tomorrow = validate.addDays(validate.moscowNow(now()).date, 1);
      const pickup = rand() < 0.35;
      const rec = store.create({ kind: "order", source: "site", tag: TAG, name, phone, fulfillment: pickup ? "pickup" : "delivery", address: pickup ? "" : `${pick(STREETS)}, ${Math.ceil(between(1, 120))}, кв. ${Math.ceil(between(1, 200))}`, date: tomorrow, slot: pick(validate.SLOTS).id, note: "", items: [{ id: p.id, name: p.name, price: p.price, qty: rand() < 0.15 ? 2 : 1 }] });
      stats.siteOrders += 1;
      const ctx = records.get(rec.id) || {};
      ctx.persona = { pay: rand() < 0.2 ? "forget" : "fast" };
      records.set(rec.id, ctx);
    }

    // Событие в формате платформы — через тот же адаптер, что и настоящий канал.
    function update(c, text, opt) {
      const ch = c.channel;
      if (ch === "avito") return { payload: { type: "message", value: { chat_id: c.chatId, user_id: 777, author_id: 555, type: "text", content: { text }, item_id: Number(c.item) } } };
      if (ch === "telegram") return opt ? { callback_query: { id: "cq", data: opt.value, message: { chat: { id: c.chatId }, reply_markup: { inline_keyboard: [[{ text: opt.label, callback_data: opt.value }]] } } } } : { message: { chat: { id: c.chatId }, text } };
      if (ch === "vk") return { type: "message_new", object: { message: { peer_id: c.id, text: opt ? opt.label : text, payload: opt ? JSON.stringify({ v: opt.value }) : undefined } } };
      if (ch === "max") return opt ? { update_type: "message_callback", callback: { callback_id: "cb", payload: opt.value }, message: { recipient: { chat_id: c.chatId } } } : { update_type: "message_created", message: { recipient: { chat_id: c.chatId }, body: { text } } };
      if (ch === "alice") return { session: { session_id: c.chatId, new: false }, request: { command: text.toLowerCase(), original_utterance: opt ? opt.label : text, payload: opt ? { v: opt.value } : undefined }, state: { session: c.alice } };
      return { chatId: c.chatId, text: opt ? opt.label : text, value: opt ? opt.value : undefined };
    }

    async function say(c, text, opt) {
      c.log.push({ from: "client", text: opt ? opt.label : text, at: now().toISOString() });
      c.turns += 1;
      const ctx = {
        now, profile: P, lookup: (id) => store.get(id),
        create: (i) => {
          const rec = store.create({ ...i, tag: TAG, dialog: c.log.slice(-10).map((x) => ({ from: x.from === "client" ? "client" : "bot", text: x.text })) });
          const r = records.get(rec.id) || {};
          r.conv = c.id;
          r.persona = c.persona;
          records.set(rec.id, r);
          c.recordId = rec.id;
          return rec;
        },
      };
      const sendText = c.channel === "avito" && opt ? String(c.opts.findIndex((o) => o.value === opt.value) + 1) : text;
      const res = await CH.handle(c.channel === "chat" ? "site" : c.channel, update(c, sendText, c.channel === "avito" ? null : opt), { sessions: sess, ctx });
      if (res.kind !== "message") return;
      stats.botReplies += 1;
      if (c.channel === "alice") c.alice = res.calls[0].body.session_state;
      const botText = res.messages.map((m) => m.text).filter(Boolean).join("\n");
      c.opts = (res.messages.filter((m) => m.options).pop() || {}).options || [];
      c.log.push({ from: "bot", text: c.channel === "avito" ? res.calls[0].body.message.text : botText, options: c.opts.map((o) => o.label), at: now().toISOString() });
      c.step = res.state.step;
      c.lastAt = t;
      if (c.recordId && res.state.step === "menu") {
        c.status = "done";
        if (c.returned) stats.rescuedDialogs += 1;
        if (c.returned) log("rescued", `${c.recordId}: заказ спасён — клиент вернулся после напоминания агента и оформил`, { ref: c.recordId, conv: c.id });
        return;
      }
      if (c.persona.leave && c.step === c.persona.leave && !c.returned) {
        c.status = "waiting";
        stats.abandoned += 1;
        log("dialog", `Клиент (${CH.NAMES[c.channel === "chat" ? "site" : c.channel]}) перестал отвечать, ${STOPPED[c.step] || "не закончив заказ"}`, { conv: c.id });
        return;
      }
      if (c.turns > 25) { c.status = "lost"; return; }
      afterMin(between(0.4, 2.5), () => clientTurn(c));
    }

    // Что клиент ответит на текущий вопрос бота.
    function clientTurn(c) {
      if (c.status !== "active") return;
      const p = c.persona;
      const opt = (fn) => c.opts.find(fn);
      const step = c.step;
      if (p.then && !c.thenSaid) { c.thenSaid = true; return say(c, p.then); }
      if (p.callback) {
        if (step === "cb_name") return say(c, c.name);
        if (step === "cb_phone") return say(c, validate.formatPhone(c.phone));
        const b = opt((o) => o.value === "callback");
        return b ? say(c, b.label, b) : say(c, "позовите флориста");
      }
      // Нажать вариант, а если кнопок нет — ответить словами, как живой человек.
      const choose = (b, words) => (b ? say(c, b.label, b) : say(c, words));
      switch (step) {
        case "menu": return choose(opt((o) => o.value === "order"), "хочу букет");
        case "product": return choose(opt((o) => /^p:/.test(o.value)) || opt((o) => /^b:/.test(o.value)) || opt((o) => o.value === "all"), "покажите все");
        case "date": return choose(opt((o) => o.label === "Завтра") || opt((o) => /^d:\d/.test(o.value)), "завтра");
        case "date_custom": return say(c, "завтра");
        case "slot": { const choices = c.opts.filter((o) => /^s:/.test(o.value)); return choose(choices[Math.floor(rand() * choices.length)], "вечером"); }
        case "fulfillment": return choose(opt((o) => o.value === "f:" + (p.f || "delivery")), p.f === "pickup" ? "заберу сам" : "доставка");
        case "address": return say(c, `${pick(STREETS)}, ${Math.ceil(between(1, 120))}, кв. ${Math.ceil(between(1, 200))}`);
        case "name": return say(c, c.name);
        case "phone": return say(c, validate.formatPhone(c.phone));
        case "confirm": return choose(opt((o) => o.value === "confirm"), "да");
        default: c.status = "lost";
      }
    }

    // ---------- поток клиентов ----------
    function scheduleArrival() {
      const rate = Math.max(0.05, M.rate(hourMsk()));
      const gap = (-Math.log(1 - rand()) / rate) * 60; // минуты до следующего клиента
      afterMin(gap, () => { newClient(); scheduleArrival(); });
    }

    let started = false;
    function start() {
      if (started) return;
      started = true;
      if (sim) sim.setSettings({ tgDown: !!M.tgDown });
      log("system", `Симуляция «${M.title}» началась`);
      scheduleArrival();
    }

    // Продвинуть виртуальное время на minutes, выполняя всё, что за это время случилось.
    let nextAgent = t;
    async function run(minutes) {
      start();
      const until = t + minutes * MIN;
      while (true) {
        const nextEvent = queue.length ? queue[0].when : Infinity;
        const next = Math.min(nextEvent, nextAgent, until);
        if (next > until) break;
        t = Math.max(t, next);
        if (t >= nextAgent) { agentTick(); nextAgent = t + MIN; }
        while (queue.length && queue[0].when <= t) {
          const ev = queue.shift();
          await ev.fn();
        }
        if (t >= until) break;
      }
      t = until;
    }

    function snapshot() {
      const recs = store.list().filter((r) => r.tag === TAG);
      const count = (st) => recs.filter((r) => st.includes(r.status)).length;
      return {
        now: now(), elapsedMin: (t - t0) / MIN, stats: { ...stats, byChannel: { ...stats.byChannel } },
        funnel: { new: count(["new"]), confirmed: count(["confirmed"]), assembling: count(["assembling"]), out: count(["delivering", "ready"]), done: count(["done", "called"]), cancelled: count(["cancelled"]) },
        agent: agent.summary(recs),
      };
    }

    return { mode, MODE: M, run, snapshot, events, convs, store, now, TAG };
  }

  return { MODES, MIX, PERSONAS, create, TAG };
});
