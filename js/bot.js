// Чат-бот «Стебля». Один и тот же для сайта, Telegram, ВКонтакте, MAX и Алисы.
// reply() не трогает DOM, сеть и хранилище: всё внешнее приходит через ctx.
// ctx: { now(): Date, create(input): record, lookup(id): record|null }
//
// Бот понимает свободный текст («пионы маме на завтра вечером до 5000»), запоминает всё, что уже сказано,
// и спрашивает только то, чего не хватает для заказа.
(function (root, factory) {
  const dep = (name, file) => (typeof require === "function" ? require(file) : root.Flora[name]);
  const mod = factory(dep("catalog", "./catalog.js"), dep("validate", "./validate.js"), dep("cart", "./cart.js"), dep("store", "./store.js"));
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).bot = mod;
})(typeof self !== "undefined" ? self : this, function (catalog, validate, cart, store) {
  const PICKUP_ADDRESS = "Покровка, 12";
  const PICKUP_HOURS = "ежедневно с 9:00 до 21:00";
  const rub = cart.formatRub;

  const MENU = [
    { label: "Подобрать букет", value: "order" },
    { label: "Доставка и оплата", value: "delivery" },
    { label: "Где мой заказ", value: "status" },
    { label: "Позвать флориста", value: "callback" },
  ];
  const TO_MENU = { label: "В начало", value: "menu" };

  const DELIVERY_TEXT =
    `Возим по Москве в пределах МКАД, в двухчасовые интервалы с 9 до 21. Доставка ${rub(cart.DELIVERY_FEE)}, ` +
    `а для заказов от ${rub(cart.FREE_DELIVERY_FROM)} — бесплатно. На сегодня успеваем, если до начала интервала больше 2 часов.\n` +
    `Забрать самому можно на ${PICKUP_ADDRESS}, ${PICKUP_HOURS}.\n` +
    "Оплата картой по ссылке: флорист пришлёт её после того, как подтвердит заказ.";

  const FLOWERS = ["роз", "тюльпан", "пион", "ромаш", "сирен", "гортенз", "ранункул", "калл", "гвоздик", "василь", "эвкалипт", "дельфиниум"];
  const OCCASIONS = [
    { id: "bulk", re: /корпоратив|оптом|(?:^|[^\d])(?:[2-9]\d|\d{3,})\s*букет/, line: "Большой заказ флорист посчитает индивидуально — цену, сроки и доставку. Нажмите «Позвать флориста», он перезвонит. А пока вот готовые варианты." },
    { id: "wedding", re: /свадьб|невест/, line: "Свадебный букет флорист соберёт индивидуально — могу попросить его позвонить. А пока вот готовые варианты." },
    { id: "birthday", re: /день\s*рожд|днюх|(?:^|[^а-я])др(?![а-я])|юбиле/, line: "На день рождения хорошо смотрятся яркие пышные букеты." },
    { id: "mom", re: /мам|бабушк|8\s*марта/, line: "Для мамы — нежные и тёплые варианты." },
    { id: "love", re: /любим|девушк|жен[еау](?![а-я])|свидан|романт/, line: "Для романтичного повода сейчас особенно хороши эти." },
    { id: "sorry", re: /извин|прощени|помирит/, line: "Цветы тут правда помогают. Вот что подойдёт." },
    { id: "work", re: /коллег|офис|начальни|руководител/, line: "Для коллег — сдержанные, но заметные букеты." },
  ];
  // Как клиенты называют готовые букеты в переписке.
  const PRODUCT_WORDS = { dacha: /утро на даче|на даче/, siren: /сирень и мят/, pole: /полев/, bordo: /бордо/, prazdnik: /большой праздник/, kompliment: /комплимент/ };
  const WEEKDAYS = [/воскресень/, /понедельник/, /вторник/, /сред[уа]/, /четверг/, /пятниц/, /суббот/];

  const m = (text, options, extra) => Object.assign({ text }, options ? { options } : null, extra);
  // Варианты фраз по очереди, чтобы бот не повторялся слово в слово.
  const pick = (state, key, variants) => {
    const seen = state.seen || (state.seen = {});
    const n = seen[key] || 0;
    seen[key] = n + 1;
    return variants[n % variants.length];
  };

  // ---------- понимание текста ----------

  function slotFromHour(h, mode) {
    if (mode === "by") {
      const fit = validate.SLOTS.filter((s) => s.start + 3 <= h);
      return fit.length ? fit[fit.length - 1].id : null;
    }
    const s = validate.SLOTS.find((x) => h >= x.start && h < x.start + 3);
    return s ? s.id : null;
  }

  function understand(text, now) {
    const t = String(text || "").toLowerCase().replace(/ё/g, "е");
    const u = {};
    if (!t.trim()) return u;

    const id = t.match(/(?:ст|зв)\s*-?\s*(\d{4,})/);
    if (id) u.orderId = id[1];

    const ph = String(text).match(/(?:\+?[78][\s\-()]*)?(?:\d[\s\-()]*){9}\d/);
    if (ph) {
      const n = validate.normalizePhone(ph[0]);
      if (n) u.phone = n;
    }

    let money = t.match(/(?:до|не дороже|не больше|в пределах|около|примерно|за)\s*(\d[\d\s]*\d|\d)\s*(к(?![а-я])|тыс\S*|т(?![а-я]))?/) ||
      t.match(/(\d[\d\s]*\d|\d)\s*(к(?![а-я])|тыс\S*|₽|р(?![а-я])|руб\S*)/);
    if (money) {
      let n = parseInt(money[1].replace(/\s/g, ""), 10);
      if (money[2] && /^(к|т)/.test(money[2])) n *= 1000;
      if (n >= 500 && n <= 200000) u.maxPrice = n;
    }
    if (/подешевле|недорог|бюджетн|скромн/.test(t)) u.maxPrice = u.maxPrice || 3000;
    if (/подороже|роскош|шикарн|побольше|большой букет|огромн/.test(t)) u.minPrice = 6000;

    const product = Object.keys(PRODUCT_WORDS).find((id) => PRODUCT_WORDS[id].test(t));
    if (product) u.product = product;
    const flowers = FLOWERS.filter((stem) => t.includes(stem));
    if (flowers.length) u.flowers = flowers;
    const occ = OCCASIONS.find((o) => o.re.test(t));
    if (occ) u.occasion = occ.id;

    const today = validate.moscowNow(now).date;
    if (/послезавтра/.test(t)) u.date = validate.addDays(today, 2);
    else if (/завтра/.test(t)) u.date = validate.addDays(today, 1);
    else if (/сегодня|прямо сейчас|срочно/.test(t)) u.date = today;
    else {
      const d = t.match(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/);
      const iso = d && validate.parseRuDate(d[0], now);
      if (iso) u.date = iso;
      else {
        const wd = WEEKDAYS.findIndex((re) => re.test(t));
        if (wd >= 0) {
          const cur = new Date(today + "T00:00:00Z").getUTCDay();
          u.date = validate.addDays(today, (wd - cur + 7) % 7);
        }
      }
    }

    if (/после обеда/.test(t)) u.slot = "15-18";
    else if (/утр/.test(t)) u.slot = "9-12";
    else if (/обед|днем(?![а-я])/.test(t)) u.slot = "12-15";
    else if (/вечер/.test(t)) u.slot = "18-21";
    const by = t.match(/(?:^|[^а-я])(?:к|до)\s*(\d{1,2})(?:[:.]00)?(?![\d\s]*\d)(?!\s*(?:к(?![а-я])|тыс|т(?![а-я])|₽|р(?![а-я])|руб))/);
    const at = t.match(/(?:^|[^а-я])в\s*(\d{1,2})(?:[:.]\d{2})?\s*(час\S*|ч(?![а-я])|утра|вечера|дня)?(?![\d\s]*\d)/);
    if (by && +by[1] <= 21) u.slot = slotFromHour(+by[1], "by") || u.slot;
    else if (at && (at[2] || /[:.]/.test(at[0]))) {
      let h = +at[1];
      if ((at[2] === "вечера" || at[2] === "дня") && h < 12) h += 12;
      u.slot = slotFromHour(h, "in") || u.slot;
    }
    if (!u.slot) delete u.slot;

    if (/самовывоз|заберу|сам\S* забер|забрать сам/.test(t)) u.fulfillment = "pickup";
    else if (/доставк|привез|курьер|доставьте/.test(t)) u.fulfillment = "delivery";

    if (/статус|где\s+(мой\s+)?заказ|отслед|когда привез/.test(t) || u.orderId) u.intent = "status";
    else if (/перезвон|позвон|флорист|оператор|человек|менеджер|живой/.test(t)) u.intent = "callback";
    else if (/(сколько|стоимост|цена).{0,20}доставк|условия|как\s+(оплат|доставля)|оплат|где вы|адрес магазин|режим работ|до скольки/.test(t)) u.intent = "delivery";
    else if (/^(привет|здравств|добр\S* (день|утро|вечер)|хай|доброго)/.test(t)) u.intent = "greet";
    else if (/спасиб|благодар/.test(t)) u.intent = "thanks";
    if (!u.intent && (/букет|цвет|заказ|купить|хочу|подбер|подар/.test(t) || u.product || u.flowers || u.maxPrice || u.minPrice || u.occasion)) u.intent = "order";
    return u;
  }

  // ---------- подбор ----------

  function candidates(d) {
    const fits = (p) => (!d.maxPrice || p.price <= d.maxPrice) && (!d.minPrice || p.price >= d.minPrice) && (!d.band || catalog.BUDGETS[d.band].test(p));
    const has = (p) => !d.flowers || d.flowers.some((f) => (p.name + " " + p.composition).toLowerCase().includes(f));
    const byPrice = catalog.products.filter(fits).sort((a, b) => a.price - b.price);
    const exact = byPrice.filter(has);
    if (d.flowers && !exact.length) {
      const pricier = catalog.products.filter(has).sort((a, b) => a.price - b.price);
      if (pricier.length) return { list: pricier.slice(0, 4), overBudget: true };
    }
    return { list: (exact.length ? exact : byPrice).slice(0, 4), flowerMiss: !!d.flowers && !exact.length };
  }
  const hasCriteria = (d) => !!(d.maxPrice || d.minPrice || d.band || d.flowers || d.occasion || d.all);
  const card = (p) => ({ id: p.id, name: p.name, price: p.price, composition: p.composition });

  // ---------- вопросы ----------

  function nextField(d) {
    if (!d.product) return "product";
    if (!d.date) return "date";
    if (!d.slot) return "slot";
    if (!d.fulfillment) return "fulfillment";
    if (d.fulfillment === "delivery" && !d.address) return "address";
    if (!d.name) return "name";
    if (!d.phone) return "phone";
    return "confirm";
  }

  function dateOptions(now) {
    const today = validate.moscowNow(now).date;
    const opts = [];
    if (validate.availableSlots(today, now).length) opts.push({ label: "Сегодня", value: "d:" + today });
    opts.push({ label: "Завтра", value: "d:" + validate.addDays(today, 1) });
    opts.push({ label: "Послезавтра", value: "d:" + validate.addDays(today, 2) });
    opts.push({ label: "Другой день", value: "d:custom" });
    return opts;
  }

  function summary(d) {
    const p = catalog.byId(d.product);
    const t = cart.totals([{ ...p, qty: 1 }], d.fulfillment);
    const where = d.fulfillment === "pickup" ? `Самовывоз: ${PICKUP_ADDRESS}` : `Доставка: ${d.address}`;
    return [
      "Проверьте, всё ли верно:",
      `${p.name} — ${rub(p.price)}`,
      `${validate.formatDate(d.date)}, ${validate.slotLabel(d.slot)}`,
      where,
      `${d.name}, ${validate.formatPhone(d.phone)}`,
      `Итого: ${rub(t.total)}${t.delivery ? ` (доставка ${rub(t.delivery)})` : d.fulfillment === "delivery" ? " (доставка бесплатно)" : ""}`,
    ].join("\n");
  }

  // Формирует вопрос про первое незаполненное поле. pre — реплики перед вопросом.
  function ask(state, d, now, pre = []) {
    const field = d.dateCustom && !d.date ? "date_custom" : nextField(d);
    const out = pre.map((t) => m(t));
    const st = { ...state, step: field, draft: d };
    const push = (msg) => out.push(msg);

    switch (field) {
      case "product": {
        if (!hasCriteria(d)) {
          push(m(pick(state, "v1", [
            "С удовольствием подберу. На какую сумму ориентируемся? Можно нажать кнопку или написать своими словами — например, «тюльпаны до 4000» или «маме на день рождения».",
            "Давайте подберём. Подскажите бюджет — или просто опишите, кому и по какому поводу букет.",
          ]), Object.entries(catalog.BUDGETS).map(([v, b]) => ({ label: b.label, value: "b:" + v })).concat({ label: "Показать все", value: "all" })));
          break;
        }
        const { list, flowerMiss, overBudget } = candidates(d);
        const occ = OCCASIONS.find((o) => o.id === d.occasion);
        const lines = [];
        if (overBudget) lines.push("С этими цветами есть только букеты дороже названного бюджета:");
        else if (flowerMiss) lines.push("Таких цветов в готовых букетах сегодня нет — флорист может собрать на заказ. Из готовых могу предложить:");
        else if (occ) lines.push(occ.line);
        if (!list.length) {
          push(m(`${lines.join(" ")} В этот бюджет готовых букетов нет: самый доступный стоит ${rub(Math.min(...catalog.products.map((p) => p.price)))}. Посмотрим другие?`.trim(),
            [{ label: "Показать все", value: "all" }, { label: "Позвать флориста", value: "callback" }]));
          break;
        }
        lines.push(lines.length ? "" : pick(state, "v2", ["Вот что могу предложить:", "Посмотрите эти:", "Есть такие варианты:"]));
        const extra = [{ label: "Другие варианты", value: "all" }];
        if (occ && (occ.id === "bulk" || occ.id === "wedding")) extra.push({ label: "Позвать флориста", value: "callback" });
        push(m(lines.filter(Boolean).join(" "), list.map((p) => ({ label: `${p.name}, ${rub(p.price)}`, value: "p:" + p.id })).concat(extra), { cards: list.map(card) }));
        break;
      }
      case "date":
        push(m(pick(state, "v3", ["На какой день нужен букет?", "Когда доставить или к какому дню приготовить?"]), dateOptions(now)));
        break;
      case "date_custom":
        push(m("Напишите дату, например «14.02» или «в субботу»."));
        break;
      case "slot": {
        const slots = validate.availableSlots(d.date, now);
        push(m(`${validate.formatDate(d.date)}. В какое время удобно?`, slots.map((s) => ({ label: s.label, value: "s:" + s.id }))));
        break;
      }
      case "fulfillment": {
        const p = catalog.byId(d.product);
        const free = p.price >= cart.FREE_DELIVERY_FROM;
        push(m("Привезти курьером или заберёте сами?", [
          { label: free ? "Доставка — бесплатно" : `Доставка — ${rub(cart.DELIVERY_FEE)}`, value: "f:delivery" },
          { label: "Заберу сам — бесплатно", value: "f:pickup" },
        ]));
        break;
      }
      case "address":
        push(m(pick(state, "v4", [
          "Куда везём? Улица, дом и квартира. Курьер позвонит получателю перед приездом.",
          "Напишите адрес доставки: улица, дом, квартира или офис.",
        ])));
        break;
      case "name":
        push(m(pick(state, "v5", ["Как к вам обращаться?", "Как вас зовут?"])));
        break;
      case "phone":
        push(m(`${d.name}, оставьте номер телефона — флорист позвонит подтвердить заказ.`));
        break;
      case "confirm":
        push(m(summary(d), [{ label: "Всё верно, оформить", value: "confirm" }, { label: "Изменить", value: "edit" }]));
        break;
    }
    return { state: st, messages: out };
  }

  // Переносит понятое из текста в черновик заказа. Возвращает реплики, если что-то не подошло.
  function absorb(d, u, now) {
    const notes = [];
    const n = { ...d };
    if (u.maxPrice) { n.maxPrice = u.maxPrice; delete n.band; }
    if (u.minPrice) { n.minPrice = u.minPrice; delete n.band; }
    if (u.flowers) n.flowers = u.flowers;
    if (u.occasion) n.occasion = u.occasion;
    if (u.product) n.product = u.product;
    if (u.date) {
      const range = validate.dateRange(now);
      if (u.date < range.min || u.date > range.max) notes.push(`Принимаем заказы на ближайшие 30 дней, до ${validate.formatDate(range.max)}.`);
      else if (!validate.availableSlots(u.date, now).length) notes.push(`На ${u.date === range.min ? "сегодня" : validate.formatDate(u.date)} уже не успеем — до последнего интервала меньше 2 часов. Можно на завтра.`);
      else { n.date = u.date; delete n.dateCustom; }
    }
    const wantSlot = u.slot || n.wantSlot;
    if (wantSlot) {
      if (n.date && validate.availableSlots(n.date, now).some((s) => s.id === wantSlot)) { n.slot = wantSlot; delete n.wantSlot; }
      else if (n.date) { if (u.slot) notes.push(`${validate.slotLabel(wantSlot)} на ${validate.formatDate(n.date)} уже недоступно.`); delete n.slot; delete n.wantSlot; }
      else n.wantSlot = wantSlot;
    }
    if (n.slot && n.date && !validate.availableSlots(n.date, now).some((s) => s.id === n.slot)) delete n.slot;
    if (u.fulfillment) n.fulfillment = u.fulfillment;
    if (u.phone) n.phone = u.phone;
    return { d: n, notes };
  }

  function menu(state, text) {
    return { state: { ...state, step: "menu", draft: {} }, messages: [m(text, MENU)] };
  }

  function start() {
    return {
      state: { step: "menu", draft: {}, turn: 0, seen: {} },
      messages: [m("Здравствуйте! Это «Стебель», цветочная мастерская на Покровке. Помогу выбрать букет, оформить доставку или узнать, где ваш заказ.\nМожно просто написать, что нужно — например: «пионы маме на завтра до 5000».", MENU)],
    };
  }

  function statusReply(state, rec) {
    const extra = {
      new: "Флорист скоро позвонит, чтобы подтвердить детали.",
      confirmed: "Скоро начнём собирать.",
      assembling: "Флорист как раз собирает букет.",
      delivering: "Курьер уже в пути.",
      ready: `Можно забирать: ${PICKUP_ADDRESS}, ${PICKUP_HOURS}.`,
      done: "Спасибо, что выбрали нас!",
      cancelled: "Если это ошибка — нажмите «Позвать флориста», разберёмся.",
    }[rec.status] || "";
    const pay = rec.payment === "paid" ? " Оплата получена." : store.PAYABLE.includes(rec.status) ? " Ждём оплату по ссылке из SMS." : "";
    return menu(state, `Заказ ${rec.id}: ${store.STATUS[rec.status].toLowerCase()}. ${extra}${pay}`);
  }

  function enter(intent, state, now, u = {}) {
    switch (intent) {
      case "order": {
        const { d, notes } = absorb({}, u, now);
        return ask(state, d, now, notes);
      }
      case "delivery":
        return menu(state, DELIVERY_TEXT);
      case "status":
        if (u.orderId) {
          const rec = state.ctx.lookup(u.orderId);
          if (rec && rec.kind === "order") return statusReply(state, rec);
        }
        return { state: { ...state, step: "status", draft: {} }, messages: [m("Напишите номер заказа — он в SMS и выглядит как СТ-1001.", [TO_MENU])] };
      case "callback":
        return { state: { ...state, step: "cb_name", draft: {} }, messages: [m("Флорист перезвонит и всё подскажет. Как к вам обращаться?", [TO_MENU])] };
      case "greet":
        return menu(state, "Здравствуйте! Чем помочь? Можно выбрать кнопкой или написать своими словами.");
      case "thanks":
        return menu(state, "Пожалуйста! Если что-то ещё понадобится — пишите.");
      default:
        return menu(state, pick(state, "v6", [
          "Не совсем понял. Я умею подбирать букеты, рассказывать о доставке и искать заказы. Что из этого нужно?",
          "Кажется, я не понял. Попробуйте написать иначе — например, «розы на завтра» — или выберите кнопку.",
        ]));
    }
  }

  function handleOrderStep(state, step, text, value, now) {
    let d = { ...state.draft };
    const u = step === "address" || step === "name" ? {} : understand(text, now);
    const pre = [];

    // кнопки
    if (value) {
      const [k, v] = value.includes(":") ? value.split(/:(.*)/s) : [value, ""];
      if (k === "b") { d = { ...d, band: v }; delete d.maxPrice; delete d.minPrice; delete d.all; }
      else if (k === "all") { d = { ...d, all: true }; delete d.band; delete d.maxPrice; delete d.minPrice; delete d.flowers; }
      else if (k === "p" && catalog.byId(v)) {
        d.product = v;
        const p = catalog.byId(v);
        pre.push(`«${p.name}»: ${p.composition.toLowerCase()}. ${pick(state, "v7", ["Хороший выбор.", "Отличный вариант.", "Его часто берут."])}`);
      } else if (k === "d" && v === "custom") { d.dateCustom = true; delete d.date; }
      else if (k === "d") { const r = absorb(d, { date: v }, now); d = r.d; pre.push(...r.notes); }
      else if (k === "s") { const r = absorb(d, { slot: v }, now); d = r.d; pre.push(...r.notes); }
      else if (k === "f") d.fulfillment = v;
      else if (k === "e") {
        const drop = { product: ["product"], date: ["date", "slot"], address: ["fulfillment", "address"], phone: ["name", "phone"] }[v] || [];
        drop.forEach((f) => delete d[f]);
      }
      else if (value === "edit") {
        return { state: { ...state, step: "confirm", draft: d }, messages: [m("Что поменяем?", [
          { label: "Букет", value: "e:product" }, { label: "Дату и время", value: "e:date" },
          { label: "Адрес или самовывоз", value: "e:address" }, { label: "Имя и телефон", value: "e:phone" },
        ])] };
      }
      else if (value === "confirm") return confirm(state, d, now);
      return ask(state, d, now, pre);
    }

    // свободный текст: сначала общее понимание, потом поле, о котором спрашивали
    if (u.intent === "delivery" && step !== "address") {
      const r = ask(state, d, now);
      return { state: r.state, messages: [m(DELIVERY_TEXT)].concat(r.messages) };
    }
    const r = absorb(d, u, now);
    d = r.d;
    pre.push(...r.notes);

    switch (step) {
      case "product": {
        const byName = catalog.products.find((p) => text.toLowerCase().includes(p.name.toLowerCase()));
        if (byName) d.product = byName.id;
        else if (!u.flowers && !u.maxPrice && !u.minPrice && !u.occasion && !u.date && !u.slot && !u.fulfillment) {
          pre.push("Не нашёл такого букета. Выберите из списка или опишите, что хочется — цветы, повод или бюджет.");
        }
        break;
      }
      case "date":
      case "date_custom":
        if (!u.date && !d.date && !pre.length) pre.push("Не понял дату. Напишите, например, «завтра», «14.02» или «в субботу».");
        break;
      case "slot":
        if (!d.slot && !u.slot && !pre.length) {
          const mm = text.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})|с\s*(\d{1,2})/);
          const h = mm ? +(mm[1] || mm[3]) : NaN;
          const sid = Number.isNaN(h) ? null : slotFromHour(h, "in");
          const ok = sid && validate.availableSlots(d.date, now).some((s) => s.id === sid);
          if (ok) d.slot = sid;
          else pre.push("Выберите интервал кнопкой — или напишите, например, «вечером» или «к 15».");
        }
        break;
      case "fulfillment":
        if (!d.fulfillment) pre.push("Напишите «доставка» или «заберу сам».");
        break;
      case "address":
        if (text.length < 5) pre.push("Адрес слишком короткий. Нужны улица, дом и квартира.");
        else d.address = text.slice(0, 200);
        break;
      case "name": {
        const name = text.replace(/^(меня зовут|я|это)\s+/i, "").replace(/!+$/, "").trim();
        if (!name || /\d{3,}/.test(name) || /^(да|нет|ок|ага|угу|хорошо)$/i.test(name)) pre.push("Напишите, пожалуйста, как к вам обращаться.");
        else d.name = name.slice(0, 60);
        break;
      }
      case "phone":
        if (!d.phone) pre.push("Нужен номер из 10 цифр после +7 — например, +7 916 123-45-67.");
        break;
      case "confirm":
        if (/^(да|верно|все верно|оформ|ок|подтвержд|давай)/i.test(text)) return confirm(state, d, now);
        if (/^(нет|измен|поменя)/i.test(text)) return handleOrderStep(state, step, "", "edit", now);
        break;
    }
    return ask(state, d, now, pre);
  }

  function confirm(state, d, now) {
    const p = catalog.byId(d.product);
    const check = validate.validateOrder({ ...d, items: [{ id: p.id, name: p.name, price: p.price, qty: 1 }] }, now);
    if (!check.ok) {
      const nd = { ...d };
      if (check.errors.slot || check.errors.date) { delete nd.slot; delete nd.date; }
      return ask(state, nd, now, [Object.values(check.errors)[0]]);
    }
    const rec = state.ctx.create({ ...check.value, kind: "order", source: state.ctx.source || "chat" });
    return menu(state, `Готово! Заказ ${rec.id} принят. Флорист позвонит в течение 15 минут, подтвердит детали и пришлёт ссылку на оплату.\nЧтобы узнать статус, напишите здесь номер заказа.`);
  }

  function reply(state, input, ctx) {
    const text = String((input && input.text) || "").trim();
    const value = input && input.value;
    const now = ctx.now ? ctx.now() : new Date();
    const prev = state || start().state;
    const base = { step: prev.step || "menu", draft: { ...(prev.draft || {}) }, turn: (prev.turn || 0) + 1, seen: { ...(prev.seen || {}) } };
    const withCtx = { ...base, ctx };
    const strip = (r) => { const s = { ...r.state }; delete s.ctx; return { state: s, messages: r.messages }; };

    if (value === "menu" || /^(меню|в начало|начать заново|старт|\/start|отмена)$/i.test(text)) {
      return strip(menu(withCtx, "Хорошо, начнём сначала. Чем помочь?"));
    }
    if (["order", "delivery", "status", "callback"].includes(value)) return strip(enter(value, withCtx, now));

    const step = base.step;
    if (step === "menu") {
      const u = understand(text, now);
      return strip(enter(u.intent, withCtx, now, u));
    }

    if (step === "status") {
      const u = understand(text, now);
      const id = u.orderId || (text.match(/\d{4,}/) || [])[0];
      const rec = id ? ctx.lookup(id) : null;
      if (!rec || rec.kind !== "order") {
        return strip({ state: withCtx, messages: [m(`Заказ «${text || "—"}» не нашёлся. Проверьте номер в SMS: он выглядит как СТ-1001.`, [TO_MENU, { label: "Позвать флориста", value: "callback" }])] });
      }
      return strip(statusReply(withCtx, rec));
    }

    if (step === "cb_name") {
      const u = understand(text, now);
      const name = text.replace(/^(меня зовут|я|это)\s+/i, "").replace(/\+?\d[\d\s\-()]{8,}/, "").trim();
      if (!name) return strip({ state: withCtx, messages: [m("Напишите, пожалуйста, как к вам обращаться.")] });
      const d = { name: name.slice(0, 60), phone: u.phone };
      if (d.phone) return strip(callbackDone(withCtx, d));
      return strip({ state: { ...withCtx, step: "cb_phone", draft: d }, messages: [m(`${d.name}, на какой номер позвонить?`)] });
    }
    if (step === "cb_phone") {
      const phone = validate.normalizePhone(text);
      if (!phone) return strip({ state: withCtx, messages: [m("Нужен номер из 10 цифр после +7 — например, +7 916 123-45-67.")] });
      return strip(callbackDone(withCtx, { ...base.draft, phone }));
    }

    // шаги заказа: смена темы по ходу разговора
    if (!value && step !== "address" && step !== "name") {
      const u = understand(text, now);
      if (u.intent === "status" && u.orderId) {
        const rec = ctx.lookup(u.orderId);
        return strip(rec && rec.kind === "order" ? statusReply(withCtx, rec) : { state: withCtx, messages: [m(`Заказ «${text}» не нашёлся. Продолжим оформление?`)] });
      }
      if (u.intent === "callback") return strip(enter("callback", withCtx, now));
    }
    return strip(handleOrderStep(withCtx, step, text, value, now));
  }

  function callbackDone(state, d) {
    const rec = state.ctx.create({ kind: "callback", source: state.ctx.source || "chat", name: d.name, phone: d.phone, topic: "Консультация флориста" });
    return menu(state, `Спасибо, ${d.name}! Заявка ${rec.id} у флориста — он перезвонит на ${validate.formatPhone(d.phone)} в течение 15 минут (мы работаем с 9 до 21).`);
  }

  return { MENU, DELIVERY_TEXT, PICKUP_ADDRESS, start, reply, understand, candidates };
});
