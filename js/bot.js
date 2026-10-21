// Чат-бот по сценариям. reply() не трогает DOM и хранилище напрямую: всё внешнее приходит через ctx.
// ctx: { now(): Date, create(input): record, lookup(id): record|null }
(function (root, factory) {
  const dep = (name, file) => (typeof require === "function" ? require(file) : root.Flora[name]);
  const mod = factory(dep("catalog", "./catalog.js"), dep("validate", "./validate.js"), dep("cart", "./cart.js"), dep("store", "./store.js"));
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).bot = mod;
})(typeof self !== "undefined" ? self : this, function (catalog, validate, cart, store) {
  const MENU = [
    { label: "Заказать букет", value: "order" },
    { label: "Доставка и оплата", value: "delivery" },
    { label: "Где мой заказ", value: "status" },
    { label: "Позвонить мне", value: "callback" },
  ];
  const TO_MENU = { label: "В меню", value: "menu" };
  const PICKUP_ADDRESS = "Покровка, 12, ежедневно 9:00–21:00";

  const DELIVERY_TEXT =
    "Доставляем по Москве в пределах МКАД в интервалы 9–12, 12–15, 15–18 и 18–21. " +
    "Заказ на сегодня принимаем минимум за 2 часа до начала интервала. " +
    `Доставка ${cart.formatRub(cart.DELIVERY_FEE)}, от ${cart.formatRub(cart.FREE_DELIVERY_FROM)} — бесплатно. ` +
    `Самовывоз: ${PICKUP_ADDRESS}. Оплата картой или по ссылке после подтверждения заказа флористом.`;

  const m = (text, options) => (options ? { text, options } : { text });
  const go = (step, draft, messages) => ({ state: { step, draft }, messages });

  function start() {
    return go("menu", {}, [m("Здравствуйте! Я бот магазина «Стебель». Помогу выбрать букет, расскажу о доставке или найду ваш заказ.", MENU)]);
  }

  function detectIntent(text) {
    const t = text.toLowerCase();
    if (/статус|где\s+(мой\s+)?заказ|отслед/.test(t)) return "status";
    if (/доставк|оплат|самовывоз|интервал/.test(t)) return "delivery";
    if (/позвон|перезвон|флорист|оператор|человек|менеджер/.test(t)) return "callback";
    if (/букет|заказ|купить|роз|тюльпан|пион|цвет/.test(t)) return "order";
    return null;
  }

  function enterIntent(intent, draft) {
    switch (intent) {
      case "order":
        return go("budget", {}, [m("На какой бюджет подбираем букет?", Object.entries(catalog.BUDGETS).map(([value, b]) => ({ label: b.label, value })))]);
      case "delivery":
        return go("menu", draft, [m(DELIVERY_TEXT, MENU)]);
      case "status":
        return go("status", {}, [m("Напишите номер заказа — он есть в SMS и выглядит как СТ-1001.", [TO_MENU])]);
      case "callback":
        return go("cb_name", {}, [m("Флорист перезвонит и поможет с выбором. Как к вам обращаться?", [TO_MENU])]);
      default:
        return go("menu", draft, [m("Я пока понимаю только простые запросы. Выберите, что нужно:", MENU)]);
    }
  }

  function dateOptions(now) {
    const today = validate.moscowNow(now).date;
    const opts = [];
    if (validate.availableSlots(today, now).length) opts.push({ label: "Сегодня", value: today });
    const tomorrow = validate.addDays(today, 1);
    opts.push({ label: "Завтра", value: tomorrow });
    opts.push({ label: "Другая дата", value: "custom" });
    return opts;
  }

  function askDate(draft, now, prefix) {
    return go("date", draft, [m((prefix ? prefix + " " : "") + "На какой день нужна доставка или самовывоз?", dateOptions(now))]);
  }

  function askSlot(draft, now) {
    const slots = validate.availableSlots(draft.date, now);
    if (!slots.length) return askDate({ ...draft, date: undefined }, now, "На эту дату свободных интервалов нет.");
    return go("slot", draft, [m(`${validate.formatDate(draft.date)}. Выберите интервал:`, slots.map((s) => ({ label: s.label, value: s.id })))]);
  }

  function summary(d) {
    const p = catalog.byId(d.product);
    const t = cart.totals([{ ...p, qty: 1 }], d.fulfillment);
    const where = d.fulfillment === "pickup" ? `самовывоз, ${PICKUP_ADDRESS}` : `доставка: ${d.address}`;
    return (
      `Проверьте заказ:\n${p.name} — ${cart.formatRub(p.price)}\n` +
      `${validate.formatDate(d.date)}, ${validate.slotLabel(d.slot)}, ${where}\n` +
      `${d.name}, ${validate.formatPhone(d.phone)}\n` +
      `Итого: ${cart.formatRub(t.total)}${t.delivery ? ` (с доставкой ${cart.formatRub(t.delivery)})` : ""}`
    );
  }

  function reply(state, input, ctx) {
    const text = String((input && input.text) || "").trim();
    const value = input && input.value;
    const draft = { ...(state && state.draft) };
    const now = ctx.now ? ctx.now() : new Date();
    const step = (state && state.step) || "menu";

    if (value === "menu" || /^(меню|начать заново|старт|\/start)$/i.test(text)) {
      return go("menu", {}, [m("Чем помочь?", MENU)]);
    }

    switch (step) {
      case "menu": {
        const intent = MENU.some((o) => o.value === value) ? value : detectIntent(text);
        return enterIntent(intent, draft);
      }

      case "budget": {
        const band = catalog.BUDGETS[value] ? value : null;
        if (!band) return go("budget", draft, [m("Выберите один из вариантов бюджета.", Object.entries(catalog.BUDGETS).map(([v, b]) => ({ label: b.label, value: v })))]);
        const items = catalog.byBudget(band);
        return go("pick", { ...draft, band }, [
          m("Вот что есть в этом бюджете. Какой букет нравится?", items.map((p) => ({ label: `${p.name}, ${cart.formatRub(p.price)}`, value: p.id })).concat({ label: "Другой бюджет", value: "order" })),
        ]);
      }

      case "pick": {
        if (value === "order") return enterIntent("order", {});
        const p = catalog.byId(value) || catalog.products.find((x) => text && x.name.toLowerCase().includes(text.toLowerCase()));
        if (!p) return go("pick", draft, [m("Не нашёл такой букет. Выберите из списка выше или нажмите «Другой бюджет».", [{ label: "Другой бюджет", value: "order" }])]);
        return askDate({ ...draft, product: p.id }, now, `${p.name}: ${p.composition.toLowerCase()}. Отличный выбор.`);
      }

      case "date": {
        if (value === "custom") return go("date_custom", draft, [m("Напишите дату в формате ДД.ММ, например 14.02.")]);
        if (validate.isIsoDate(value)) return askSlot({ ...draft, date: value }, now);
        const parsed = validate.parseRuDate(text, now);
        if (parsed) return askSlot({ ...draft, date: parsed }, now);
        return go("date", draft, [m("Выберите день кнопкой или напишите дату в формате ДД.ММ.", dateOptions(now))]);
      }

      case "date_custom": {
        const parsed = validate.parseRuDate(text, now);
        const range = validate.dateRange(now);
        if (!parsed) return go("date_custom", draft, [m("Не понял дату. Напишите в формате ДД.ММ, например 14.02.")]);
        if (parsed < range.min || parsed > range.max) return go("date_custom", draft, [m(`Принимаем заказы на ближайшие 30 дней — до ${validate.formatDate(range.max)}. Напишите другую дату.`)]);
        return askSlot({ ...draft, date: parsed }, now);
      }

      case "slot": {
        const ok = validate.availableSlots(draft.date, now).some((s) => s.id === value);
        if (!ok) return askSlot(draft, now);
        return go("fulfillment", { ...draft, slot: value }, [
          m("Доставить или заберёте сами?", [
            { label: `Доставка, ${cart.formatRub(cart.DELIVERY_FEE)}`, value: "delivery" },
            { label: "Самовывоз, бесплатно", value: "pickup" },
          ]),
        ]);
      }

      case "fulfillment": {
        if (value === "pickup") return go("name", { ...draft, fulfillment: "pickup", address: "" }, [m(`Забрать можно здесь: ${PICKUP_ADDRESS}. Как вас зовут?`)]);
        if (value === "delivery") return go("address", { ...draft, fulfillment: "delivery" }, [m("Напишите адрес: улица, дом, квартира.")]);
        return go("fulfillment", draft, [m("Выберите доставку или самовывоз.", [{ label: "Доставка", value: "delivery" }, { label: "Самовывоз", value: "pickup" }])]);
      }

      case "address":
        if (text.length < 5) return go("address", draft, [m("Адрес слишком короткий. Напишите улицу, дом и квартиру.")]);
        return go("name", { ...draft, address: text }, [m("Как вас зовут?")]);

      case "name":
        if (!text) return go("name", draft, [m("Напишите, как к вам обращаться.")]);
        return go("phone", { ...draft, name: text.slice(0, 60) }, [m("Номер телефона для подтверждения заказа?")]);

      case "phone": {
        const phone = validate.normalizePhone(text);
        if (!phone) return go("phone", draft, [m("Нужен номер из 10 цифр после +7, например +7 916 123-45-67.")]);
        const d = { ...draft, phone };
        return go("confirm", d, [m(summary(d), [{ label: "Оформить заказ", value: "confirm" }, { label: "Начать заново", value: "order" }])]);
      }

      case "confirm": {
        if (value === "order") return enterIntent("order", {});
        if (value !== "confirm" && !/^(да|оформ)/i.test(text)) {
          return go("confirm", draft, [m("Оформляем?", [{ label: "Оформить заказ", value: "confirm" }, { label: "Начать заново", value: "order" }])]);
        }
        const p = catalog.byId(draft.product);
        const check = validate.validateOrder({ ...draft, items: [{ id: p.id, name: p.name, price: p.price, qty: 1 }] }, now);
        if (!check.ok) {
          if (check.errors.slot || check.errors.date) return askDate({ ...draft, date: undefined, slot: undefined }, now, Object.values(check.errors)[0]);
          return go("menu", {}, [m(Object.values(check.errors)[0] + " Давайте начнём заново.", MENU)]);
        }
        const rec = ctx.create({ ...check.value, kind: "order", source: "chat" });
        return go("menu", {}, [m(`Заказ ${rec.id} оформлен. Флорист позвонит в течение 15 минут, чтобы подтвердить его и прислать ссылку на оплату.`, MENU)]);
      }

      case "status": {
        const rec = text ? ctx.lookup(text) : null;
        if (!rec || rec.kind !== "order") {
          return go("status", draft, [m(`Заказ «${text || "—"}» не найден. Проверьте номер в SMS: он выглядит как СТ-1001.`, [TO_MENU])]);
        }
        const extra = {
          new: "Флорист скоро позвонит для подтверждения.",
          confirmed: "Скоро начнём собирать букет.",
          assembling: "Флорист собирает букет.",
          delivering: "Курьер уже в пути.",
          ready: `Можно забирать: ${PICKUP_ADDRESS}.`,
          done: "Спасибо, что выбрали нас!",
          cancelled: "Если это ошибка, нажмите «Позвонить мне».",
        }[rec.status] || "";
        return go("menu", {}, [m(`Заказ ${rec.id}: ${store.STATUS[rec.status].toLowerCase()}. ${extra}`, MENU)]);
      }

      case "cb_name":
        if (!text) return go("cb_name", draft, [m("Напишите, как к вам обращаться.")]);
        return go("cb_phone", { name: text.slice(0, 60) }, [m("Ваш номер телефона?")]);

      case "cb_phone": {
        const phone = validate.normalizePhone(text);
        if (!phone) return go("cb_phone", draft, [m("Нужен номер из 10 цифр после +7, например +7 916 123-45-67.")]);
        const rec = ctx.create({ kind: "callback", source: "chat", name: draft.name, phone, topic: "Консультация флориста" });
        return go("menu", {}, [m(`Готово, заявка ${rec.id}. Флорист перезвонит в течение 15 минут с 9:00 до 21:00.`, MENU)]);
      }

      default:
        return start();
    }
  }

  return { MENU, DELIVERY_TEXT, PICKUP_ADDRESS, start, reply, detectIntent };
});
