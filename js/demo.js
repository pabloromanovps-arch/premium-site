// Живые примеры для стенда: разные клиенты, каналы, букеты, просьбы и этапы.
// Заказы из мессенджеров создаются настоящими разговорами с ботом, поэтому в карточках — правдоподобные переписки.
(function (root, factory) {
  const dep = (name, file) => (typeof require === "function" ? require(file) : root.Flora[name]);
  const mod = factory(dep("bot", "./bot.js"), dep("store", "./store.js"), dep("catalog", "./catalog.js"), dep("validate", "./validate.js"));
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).demo = mod;
})(typeof self !== "undefined" ? self : this, function (bot, S, catalog, validate) {
  const DEMO_MARK = "демо";

  // h — сколько часов назад клиент написал; steps — что делал менеджер потом (минуты после заявки).
  const CUSTOMERS = [
    { ch: "telegram", name: "Ксения Орлова", phone: "+79161110101", h: 26, say: "пионы маме на завтра вечером до 5000", answers: { fulfillment: "delivery", address: "Ленинский проспект, 32, кв. 81" },
      client: "Мама не знает про сюрприз — позвоните получателю за час, но не говорите, от кого.", steps: [["confirmed", 6], ["pay", 14], ["assembling", 600], ["delivering", 1020], ["done", 1130]], mgr: "Вручили лично, мама очень рада." },
    { ch: "vk", name: "Дмитрий", phone: "+79265550202", h: 9.5, say: "розы к 18, заберу сам", answers: { product: "kompliment" },
      steps: [["confirmed", 4], ["pay", 9], ["assembling", 300]] },
    { ch: "alice", name: "Анна Сергеевна", phone: "+79037770303", h: 7, say: "тюльпаны на завтра утром", answers: { fulfillment: "delivery", address: "Кутузовский проспект, 24, офис 512" },
      client: "Это в офис, на ресепшене скажите «для бухгалтерии».", steps: [["confirmed", 12]] },
    { ch: "max", name: "Игорь Ветров", phone: "+79998880404", h: 3, say: "шикарный букет на юбилей жене на завтра днём", answers: { product: "prazdnik", fulfillment: "delivery", address: "Мосфильмовская, 70, кв. 9" },
      client: "Можно добавить открытку «С юбилеем, любимая! 25 лет вместе»?", steps: [["confirmed", 3], ["pay", 5]] },
    { ch: "chat", name: "Лена", phone: "+79161230505", h: 0.6, say: "что-нибудь недорогое подруге на др в субботу", answers: { product: "pole", fulfillment: "pickup" }, steps: [] },
    { ch: "telegram", name: "Михаил", phone: "+79057770606", h: 1.2, say: "бордо на сегодня вечером", answers: { fulfillment: "delivery", address: "Большая Никитская, 15, кв. 3" },
      client: "Получатель будет дома после 19:00.", steps: [["confirmed", 7]] },
    { ch: "vk", name: "Ольга Н.", phone: "+79267770707", h: 30, say: "сирень на завтра после обеда, доставка", answers: { product: "siren", address: "Профсоюзная, 104, кв. 220" },
      steps: [["cancelled", 20]], mgr: "Клиент передумал: решил дарить в другой день. Предложили отложенный заказ." },
    { ch: "alice", name: "Сергей", phone: "+79858880808", h: 4.5, say: "ранункулюсы в субботу утром, заберу сам", answers: { product: "ranunkulus" }, steps: [["confirmed", 15], ["pay", 40]] },
    { ch: "max", name: "Вера Павловна", phone: "+79161119090", h: 22, say: "полевой букет завтра в 10, заберу сам", answers: {},
      steps: [["confirmed", 10], ["assembling", 540], ["ready", 600], ["pay", 650], ["done", 660]], mgr: "Оплатила картой при получении." },
    { ch: "telegram", name: "Артём", phone: "+79031231010", h: 11.5, callback: "свадебный букет, хочу обсудить с флористом", steps: [["called", 25]], mgr: "Свадьба 14 ноября. Отправили 3 варианта в Telegram, ждём выбор." },
    { ch: "chat", name: "Наталья", phone: "+79167771111", h: 0.3, callback: "нужно 30 букетов для сотрудниц на корпоратив", steps: [] },
  ];

  // Заказы с сайта: корзина и форма, без бота.
  const SITE = [
    { name: "ООО «Север»", phone: "+74951234567", h: 20, items: [["tulip", 4]], fulfillment: "delivery", address: "Пресненская наб., 12, башня «Федерация», 40 этаж",
      note: "С 8 Марта, дорогие коллеги!", client: "Нужны закрывающие документы на юрлицо, ИНН пришлём на почту.", steps: [["confirmed", 30], ["pay", 180], ["assembling", 400]] },
    { name: "Павел Громов", phone: "+79264441313", h: 14, items: [["dacha", 1], ["kompliment", 1]], fulfillment: "delivery", address: "Ломоносовский проспект, 7, кв. 45",
      note: "Прости меня. Ты лучшая.", steps: [["confirmed", 9], ["pay", 15], ["assembling", 200], ["delivering", 260]] },
    { name: "Татьяна", phone: "+79098881414", h: 2, items: [["siren", 1]], fulfillment: "pickup", steps: [] },
    { name: "Роман Ким", phone: "+79161515151", h: 28, items: [["bordo", 2]], fulfillment: "delivery", address: "ул. Арбат, 10, кв. 6",
      note: "Для двух самых важных женщин в моей жизни", steps: [["confirmed", 5], ["pay", 8], ["assembling", 500], ["delivering", 600], ["done", 680]] },
    { name: "Екатерина Л.", phone: "+79031616161", h: 5.5, items: [["ranunkulus", 1], ["pole", 1]], fulfillment: "delivery", address: "Бауманская, 33, кв. 70",
      client: "Пожалуйста, без лилий — у получателя аллергия.", steps: [["confirmed", 18]] },
    { name: "Антон", phone: "+79251717171", h: 0.1, items: [["prazdnik", 1]], fulfillment: "delivery", address: "Ходынский бульвар, 4, кв. 128", note: "С днём рождения, сестрёнка!", steps: [] },
  ];

  // Проводит разговор с ботом: начинает фразой клиента, дальше отвечает на то, что бот спрашивает.
  function talk(c, ctx, dialog) {
    const button = (r, pred) => r.messages.flatMap((m) => m.options || []).find(pred);
    const sayBot = (r) => r.messages.forEach((m) => {
      const text = m.text + (m.cards ? "\n" + m.cards.map((x) => `${x.name} — ${x.price} ₽`).join("\n") : "");
      if (text.trim()) dialog.push({ from: "bot", text });
    });
    let r = bot.start();
    sayBot(r);
    const send = (text, value) => {
      dialog.push({ from: "client", text });
      r = bot.reply(r.state, { text, value }, ctx);
      sayBot(r);
    };
    if (c.callback) {
      send(c.callback);
      if (r.state.step !== "cb_name") {
        const b = button(r, (o) => o.value === "callback");
        if (b) send(b.label, b.value);
        else send("позовите флориста");
      }
      send(c.name);
      send(validate.formatPhone(c.phone));
      return;
    }
    send(c.say);
    for (let i = 0; i < 12 && r.state.step !== "menu"; i++) {
      const step = r.state.step;
      const a = c.answers;
      if (step === "product") {
        const id = a.product || (r.messages.flatMap((m) => m.cards || [])[0] || {}).id || "pole";
        const b = button(r, (o) => o.value === "p:" + id) || { label: catalog.byId(id).name, value: "p:" + id };
        send(b.label, b.value);
      } else if (step === "date") {
        const b = button(r, (o) => o.label === "Завтра");
        send(b.label, b.value);
      } else if (step === "slot") {
        const b = button(r, () => true);
        send(b.label, b.value);
      } else if (step === "fulfillment") {
        const b = button(r, (o) => o.value === "f:" + (a.fulfillment || "delivery"));
        send(b.label, b.value);
      } else if (step === "address") send(a.address || "Тверская, 1, кв. 1");
      else if (step === "name") send(c.name);
      else if (step === "phone") send(validate.formatPhone(c.phone));
      else if (step === "confirm") send("Всё верно, оформить", "confirm");
      else break;
    }
  }

  // Заполняет CRM примерами. storage — то же хранилище, что у страниц; sim — симуляция (SMS и журнал), можно null.
  function fill({ storage, sim, realNow = () => Date.now() } = {}) {
    let t = realNow();
    const now = () => new Date(t);
    const store = S.createStore({ storage, now, onEvent: sim ? sim.notify : undefined });
    const ids = [];

    const advance = (rec, startMs, steps, mgr, client) => {
      if (client) { t = startMs + 60000; store.addComment(rec.id, client, "Клиент"); }
      for (const [what, min] of steps) {
        t = startMs + min * 60000;
        if (t > realNow()) break;
        if (what === "pay") store.pay(rec.id, "success");
        else store.setStatus(rec.id, what, what === "assembling" || what === "ready" ? "Флорист" : what === "delivering" || what === "done" ? "Курьер" : "Менеджер");
      }
      if (mgr) { t = Math.min(realNow(), t + 120000); store.addComment(rec.id, mgr, "Менеджер"); }
    };

    const all = [
      ...CUSTOMERS.map((c) => ({ ...c, kind: "bot" })),
      ...SITE.map((c) => ({ ...c, kind: "site" })),
    ].sort((a, b) => b.h - a.h);

    for (const c of all) {
      const startMs = realNow() - c.h * 3600000;
      t = startMs;
      let rec = null;
      if (c.kind === "site") {
        const items = c.items.map(([id, qty]) => { const p = catalog.byId(id); return { id, name: p.name, price: p.price, qty }; });
        const today = validate.moscowNow(now()).date;
        const date = c.h > 12 ? today : validate.addDays(today, 1);
        rec = store.create({ kind: "order", source: "site", name: c.name, phone: c.phone, fulfillment: c.fulfillment, address: c.address || "", date, slot: c.fulfillment === "pickup" ? "18-21" : "12-15", note: c.note || "", items });
      } else {
        const dialog = [];
        const ctx = { now, source: c.ch, lookup: (id) => store.get(id), create: (i) => (rec = store.create({ ...i, dialog: dialog.slice(-20) })) };
        talk(c, ctx, dialog);
      }
      if (!rec) continue;
      ids.push(rec.id);
      advance(rec, startMs, c.steps || [], c.mgr, c.client);
    }
    return ids;
  }

  return { CUSTOMERS, SITE, fill, DEMO_MARK };
});
