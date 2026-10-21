// Сценарии автопрогона. Работают и на пульте тестирования (lab.html), и в node-тестах.
// env: { store, sim } — хранилище CRM и симуляция внешнего мира.
(function (root, factory) {
  const dep = (name, file) => (typeof require === "function" ? require(file) : root.Flora[name]);
  const mod = factory(dep("bot", "./bot.js"), dep("validate", "./validate.js"), dep("store", "./store.js"), dep("catalog", "./catalog.js"));
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).scenarios = mod;
})(typeof self !== "undefined" ? self : this, function (bot, validate, S, catalog) {
  const PREFIX = "Тест: ";

  function tomorrow(env) {
    return validate.addDays(validate.moscowNow(env.sim.now()).date, 1);
  }

  function orderInput(env, extra) {
    const p = catalog.byId("dacha");
    return {
      kind: "order", source: "site", name: PREFIX + "Покупатель", phone: "+79160000001",
      fulfillment: "delivery", address: "Тестовая ул., 1, кв. 1", date: tomorrow(env), slot: "12-15",
      items: [{ id: p.id, name: p.name, price: p.price, qty: 1 }], ...extra,
    };
  }

  // Разговор с ботом. Шаг — текст или { label } для нажатия кнопки по её надписи.
  function chat(env, steps) {
    const ctx = { now: env.sim.now, create: (i) => env.store.create(i), lookup: (id) => env.store.get(id) };
    let r = bot.start();
    for (const step of steps) {
      if (typeof step === "string") {
        r = bot.reply(r.state, { text: step }, ctx);
        continue;
      }
      const opts = r.messages.flatMap((m) => m.options || []);
      const opt = opts.find((o) => (step.label instanceof RegExp ? step.label.test(o.label) : o.label === step.label));
      if (!opt) throw new Error(`Бот не предложил кнопку «${step.label}». Были: ${opts.map((o) => o.label).join(", ") || "нет кнопок"}`);
      r = bot.reply(r.state, { text: opt.label, value: opt.value }, ctx);
    }
    return r;
  }
  const lastText = (r) => r.messages[r.messages.length - 1].text;
  const optionLabels = (r) => r.messages.flatMap((m) => m.options || []).map((o) => o.label);
  const throwsMsg = (fn) => { try { fn(); return ""; } catch (e) { return e.message; } };
  const sms = (env, id) => env.sim.outbox.list("sms").filter((e) => e.ref === id).reverse();

  const SCENARIOS = [
    {
      id: "bot-delivery",
      title: "Заказ через чат-бота с доставкой",
      about: "Клиент проходит весь диалог кнопками. Заказ попадает в CRM, Telegram менеджеру, внешнюю CRM и SMS клиенту.",
      async run(env, t) {
        const r = chat(env, [
          { label: "Подобрать букет" }, { label: "3 000–6 000 ₽" }, { label: /^Утро на даче/ }, { label: "Завтра" },
          { label: "12:00–15:00" }, { label: /^Доставка/ }, "Тестовая ул., 1, кв. 1", PREFIX + "Чат", "8 916 000 00 02", { label: "Всё верно, оформить" },
        ]);
        const id = (lastText(r).match(/СТ-\d+/) || [])[0];
        t.ok("Бот выдал номер заказа", id, lastText(r));
        const rec = id && env.store.get(id);
        t.ok("Заказ есть в CRM", rec);
        if (!rec) return;
        t.ok("Источник — чат-бот", rec.source === "chat", rec.source);
        t.ok("Сумма с доставкой 4 390 ₽", rec.totals.total === 4390, rec.totals.total);
        t.ok("Телефон приведён к +7…", rec.customer.phone === "+79160000002", rec.customer.phone);
        await env.store.flush();
        t.ok("Ушло в Telegram менеджеру", env.sim.outbox.list("telegram").some((e) => e.ref === id));
        t.ok("Ушло во внешнюю CRM", env.sim.outbox.list("crm").some((e) => e.ref === id));
        t.ok("Клиенту ушло SMS «заказ принят»", sms(env, id).some((e) => /принят/.test(e.text)));
        t.ok("В истории отметка об отправке", env.store.get(id).history.some((h) => h.type === "sync" && h.ok));
      },
    },
    {
      id: "pickup-lifecycle",
      title: "Самовывоз: от «Новый» до «Выполнен»",
      about: "Менеджер ведёт заказ по статусам. Для самовывоза вместо «В доставке» — «Готов к выдаче». На каждый шаг клиенту приходит SMS.",
      async run(env, t) {
        const rec = env.store.create(orderInput(env, { fulfillment: "pickup", address: "" }));
        t.ok("Самовывоз без платы за доставку", rec.totals.delivery === 0, rec.totals.delivery);
        env.store.setStatus(rec.id, "confirmed");
        env.store.setStatus(rec.id, "assembling");
        const next = S.nextStatuses(env.store.get(rec.id));
        t.ok("Дальше «Готов к выдаче», а не «В доставке»", next.includes("ready") && !next.includes("delivering"), next.join(", "));
        env.store.setStatus(rec.id, "ready");
        env.store.setStatus(rec.id, "done");
        const fin = env.store.get(rec.id);
        t.ok("Статус «Выполнен»", fin.status === "done", fin.status);
        t.ok("Заказ закрыт, переходов больше нет", S.nextStatuses(fin).length === 0);
        const texts = sms(env, rec.id).map((e) => e.text);
        t.ok("4 SMS: принят, подтверждён, готов, выполнен", texts.length === 4, texts.join(" | "));
        t.ok("В SMS о подтверждении есть ссылка на оплату", texts.some((x) => x.includes("pay.html#")));
      },
    },
    {
      id: "payment",
      title: "Оплата: отказ банка, затем успех",
      about: "Оплата недоступна до подтверждения. Отказ банка не ломает заказ, повторная оплата проходит, двойная оплата запрещена.",
      async run(env, t) {
        const rec = env.store.create(orderInput(env));
        t.ok("До подтверждения оплатить нельзя", /не подтверждён/.test(throwsMsg(() => env.store.pay(rec.id))));
        env.store.setStatus(rec.id, "confirmed");
        const declined = env.store.pay(rec.id, "declined");
        t.ok("После отказа заказ не оплачен", declined.payment === "unpaid", declined.payment);
        t.ok("Клиенту ушло SMS о неудачной оплате", sms(env, rec.id).some((e) => /не прошла/.test(e.text)));
        const paid = env.store.pay(rec.id, "success");
        t.ok("После повторной попытки заказ оплачен", paid.payment === "paid", paid.payment);
        t.ok("Клиенту ушло SMS об оплате", sms(env, rec.id).some((e) => /получена/.test(e.text)));
        t.ok("Второй раз оплатить нельзя", /уже оплачен/.test(throwsMsg(() => env.store.pay(rec.id))));
        const r = chat(env, [{ label: "Где мой заказ" }, rec.id]);
        t.ok("Бот сообщает, что оплата получена", /Оплата получена/.test(lastText(r)), lastText(r));
      },
    },
    {
      id: "telegram-down",
      title: "Telegram недоступен",
      about: "Сбой внешнего сервиса не должен терять заказ: он сохраняется в CRM, а в истории видна ошибка отправки.",
      async run(env, t) {
        const before = env.sim.settings().tgDown;
        env.sim.setSettings({ tgDown: true });
        try {
          const rec = env.store.create(orderInput(env));
          await env.store.flush();
          const h = env.store.get(rec.id).history.filter((x) => x.type === "sync").pop();
          t.ok("Заказ сохранён в CRM", env.store.get(rec.id));
          t.ok("В истории ошибка отправки в Telegram", h && !h.ok && /Telegram/.test(h.text), h && h.text);
          t.ok("В Telegram ничего не ушло", !env.sim.outbox.list("telegram").some((e) => e.ref === rec.id));
          t.ok("Во внешнюю CRM заказ всё равно ушёл", env.sim.outbox.list("crm").some((e) => e.ref === rec.id));
        } finally {
          env.sim.setSettings({ tgDown: before });
        }
      },
    },
    {
      id: "evening",
      title: "Вечер: интервалы на сегодня закрыты",
      about: "Время переводится на 20:30 по Москве. Сегодня заказать нельзя ни на сайте, ни в боте. Утром интервалы снова открыты.",
      async run(env, t) {
        const offset = env.sim.settings().offsetMs;
        try {
          const today = validate.moscowNow(env.sim.now()).date;
          env.sim.setTime(`${today}T20:30:00+03:00`);
          t.ok("Часы показывают 20:30 по Москве", validate.moscowNow(env.sim.now()).hour === 20);
          t.ok("На сегодня нет интервалов", validate.availableSlots(today, env.sim.now()).length === 0);
          const r = chat(env, [{ label: "Подобрать букет" }, { label: "До 3 000 ₽" }, { label: /^Полевой/ }]);
          t.ok("Бот не предлагает «Сегодня»", !optionLabels(r).includes("Сегодня"), optionLabels(r).join(", "));
          const check = validate.validateOrder(orderInput(env, { date: today, slot: "18-21" }), env.sim.now());
          t.ok("Форма отклоняет заказ на сегодня", check.errors.slot && /недоступен/.test(check.errors.slot), JSON.stringify(check.errors));
          env.sim.setTime(`${today}T10:30:00+03:00`);
          const ids = validate.availableSlots(today, env.sim.now()).map((s) => s.id);
          t.ok("В 10:30 доступны 15–18 и 18–21", ids.join() === "15-18,18-21", ids.join());
        } finally {
          env.sim.setSettings({ offsetMs: offset });
        }
      },
    },
    {
      id: "guards",
      title: "Защита от ошибок",
      about: "Запрещённые действия отклоняются с понятным текстом: перескок статуса, оплата отменённого, пустые поля, неверный телефон.",
      async run(env, t) {
        const rec = env.store.create(orderInput(env));
        t.ok("Нельзя сразу перевести в «Выполнен»", /Нельзя перевести/.test(throwsMsg(() => env.store.setStatus(rec.id, "done"))));
        env.store.setStatus(rec.id, "cancelled");
        t.ok("Отменённый нельзя вернуть", /Нельзя перевести/.test(throwsMsg(() => env.store.setStatus(rec.id, "confirmed"))));
        t.ok("Отменённый нельзя оплатить", /оплатить его нельзя/.test(throwsMsg(() => env.store.pay(rec.id))));
        t.ok("Пустой комментарий отклонён", /текст комментария/.test(throwsMsg(() => env.store.addComment(rec.id, "  "))));
        const empty = validate.validateOrder({ items: [] }, env.sim.now());
        t.ok("Пустая форма: 5 ошибок", Object.keys(empty.errors).length === 5, Object.keys(empty.errors).join(", "));
        const r = chat(env, [{ label: "Позвать флориста" }, PREFIX + "Звонок", "12345"]);
        t.ok("Бот переспрашивает неверный телефон", /10 цифр/.test(lastText(r)), lastText(r));
        const r2 = chat(env, [{ label: "Где мой заказ" }, "СТ-999999"]);
        t.ok("Бот сообщает, что заказ не найден", /не нашёлся/.test(lastText(r2)), lastText(r2));
      },
    },
    {
      id: "load",
      title: "Нагрузка: 50 заявок подряд",
      about: "Создаёт 50 заказов и звонков, проверяет нумерацию, поиск и скорость CRM, затем удаляет их. Можно запускать сколько угодно раз и вдвоём.",
      async run(env, t) {
        // У каждого прогона своя метка: повторные запуски и запуски других участников не мешают друг другу.
        const tag = Math.random().toString(36).slice(2, 7).toUpperCase();
        const name = (i) => `${PREFIX}Нагрузка ${tag}-${i}`;
        const started = Date.now();
        const ids = [];
        for (let i = 0; i < 50; i++) {
          const phone = "+7916" + String(1000000 + i).slice(-7);
          const rec = i % 5 === 4
            ? env.store.create({ kind: "callback", source: "chat", name: name(i), phone, topic: "Нагрузка" })
            : env.store.create(orderInput(env, { name: name(i), phone, source: i % 2 ? "chat" : "site" }));
          ids.push(rec.id);
        }
        const ms = Date.now() - started;
        t.ok("Все 50 номеров уникальны", new Set(ids).size === 50, `уникальных: ${new Set(ids).size}`);
        const found = env.store.list({ q: name(17) });
        t.ok("Поиск по имени находит ровно одну заявку", found.length === 1 && found[0].id === ids[17], `найдено: ${found.map((r) => r.id).join(", ") || "ничего"}`);
        const calls = env.store.list({ kind: "callback", q: `${PREFIX}Нагрузка ${tag}-` }).length;
        t.ok("Фильтр «звонки» видит ровно 10 звонков этого прогона", calls === 10, `найдено: ${calls}`);
        t.ok("Создание заняло меньше 3 секунд", ms < 3000, ms + " мс");
        await env.store.flush();
        const removed = env.store.purge((r) => r.customer.name.startsWith(`${PREFIX}Нагрузка ${tag}-`));
        t.ok("После проверки тестовые заявки удалены", removed === 50 && env.store.list({ q: `Нагрузка ${tag}-` }).length === 0, `удалено: ${removed}`);
      },
    },
  ];

  async function run(scenario, env) {
    const checks = [];
    const t = { ok: (name, cond, detail) => checks.push({ name, ok: !!cond, detail: cond ? "" : String(detail ?? "") }) };
    const started = Date.now();
    try {
      await scenario.run(env, t);
    } catch (e) {
      checks.push({ name: "Сценарий дошёл до конца", ok: false, detail: e.message });
    }
    return { id: scenario.id, title: scenario.title, ok: checks.length > 0 && checks.every((c) => c.ok), checks, ms: Date.now() - started };
  }

  return { SCENARIOS, PREFIX, run };
});
