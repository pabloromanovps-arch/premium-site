// ИИ-агент поверх CRM: следит, чтобы ни одна заявка не потерялась.
// Каждое действие записывается в историю заявки с пометкой «ИИ-агент» и выполняется один раз.
//
// Правила (сроки берутся из профиля бизнеса, раздел agent):
//   night_notice — заявка пришла, когда магазин закрыт: клиент сразу узнаёт, когда с ним свяжутся;
//   sla_ping     — менеджер не ответил N минут рабочего времени: агент напоминает ему в Telegram;
//   auto_confirm — менеджер так и не ответил: агент сам подтверждает заказ и отправляет ссылку на оплату;
//   pay_reminder — заказ подтверждён, но не оплачен: агент вежливо напоминает клиенту;
//   review       — заказ выполнен: агент просит оценку.
(function (root, factory) {
  const dep = (name, file) => (typeof require === "function" ? require(file) : root.Flora[name]);
  const mod = factory(dep("store", "./store.js"), dep("validate", "./validate.js"), dep("messages", "./messages.js"), dep("profile", "./profile.js"));
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).agent = mod;
})(typeof self !== "undefined" ? self : this, function (S, validate, messages, profileLib) {
  const BY = "ИИ-агент";
  const pad = (n) => String(n).padStart(2, "0");

  function isOpen(date, p) {
    const h = validate.moscowNow(date).hour;
    return h >= p.business.hours.from && h < p.business.hours.to;
  }
  // Когда магазин откроется после этого момента (по Москве).
  function nextOpening(date, p) {
    const t = validate.moscowNow(date);
    const day = t.hour < p.business.hours.from ? t.date : validate.addDays(t.date, 1);
    return new Date(`${day}T${pad(p.business.hours.from)}:00:00+03:00`);
  }
  // Сколько рабочих минут прошло с момента (заявка ночью начинает «тикать» с открытия).
  function workMinutes(fromIso, now, p) {
    if (!isOpen(now, p)) return -1;
    let start = new Date(fromIso);
    if (!isOpen(start, p)) start = nextOpening(start, p);
    return (now - start) / 60000;
  }
  const done = (r, code) => (r.history || []).some((h) => h.type === "agent" && h.code === code);
  const statusAt = (r, status) => { const h = (r.history || []).find((x) => x.type === "status" && x.status === status); return h ? h.at : null; };

  // Один проход агента. notify: { manager(text, rec), client(text, rec) }. Возвращает выполненные действия.
  // filter(rec) — какие заявки вести (у симуляции свой агент со своими часами).
  function tick({ store, now = new Date(), profile, notify, filter = (r) => !r.tag }) {
    const p = profile || profileLib.get();
    const a = p.agent;
    if (!a || !a.enabled) return [];
    const actions = [];
    const act = (r, code, text, effect) => {
      if (done(r, code)) return;
      if (effect) effect();
      store.agentNote(r.id, code, text);
      actions.push({ code, id: r.id, text });
    };

    for (const r of store.list().filter(filter)) {
      if (r.status === "new") {
        if (r.kind === "order" && !isOpen(new Date(r.createdAt), p)) {
          const sms = messages.render("night", r, p);
          act(r, "night_notice", `Заявка пришла, когда магазин был закрыт. Клиенту ушло сообщение, что в ${p.business.hours.from}:00 с ним свяжутся.`, () => notify.client(sms, r));
        }
        const waited = workMinutes(r.createdAt, now, p);
        if (waited >= a.slaRemindMin) {
          const what = r.kind === "order" ? "ждёт подтверждения" : "просит перезвонить";
          act(r, "sla_ping", `Менеджер не ответил ${Math.round(waited)} мин — агент напомнил ему в Telegram.`,
            () => notify.manager(`⏰ ${r.id} ${what} уже ${Math.round(waited)} мин.\n${r.customer.name}, ${validate.formatPhone(r.customer.phone)}`, r));
        }
        if (r.kind === "order" && a.autoConfirm && waited >= a.autoConfirmMin) {
          act(r, "auto_confirm", `Менеджер не ответил ${Math.round(waited)} мин. Агент сам подтвердил заказ: данные полные, интервал доступен. Клиенту ушла ссылка на оплату.`,
            () => store.setStatus(r.id, "confirmed", BY));
        }
        continue;
      }
      if (r.kind !== "order" || !isOpen(now, p)) continue;
      if (S.PAYABLE.includes(r.status) && r.payment !== "paid") {
        const since = statusAt(r, "confirmed");
        if (since && (now - new Date(since)) / 60000 >= a.payReminderMin) {
          const sms = messages.render("pay_reminder", r, p);
          act(r, "pay_reminder", "Оплата не пришла — агент вежливо напомнил клиенту и приложил ссылку.", () => notify.client(sms, r));
        }
      }
      if (r.status === "done") {
        const since = statusAt(r, "done");
        if (since && (now - new Date(since)) / 60000 >= a.reviewAfterMin) {
          const sms = messages.render("review", r, p);
          act(r, "review", "Агент попросил клиента оценить заказ.", () => notify.client(sms, r));
        }
      }
    }
    return actions;
  }

  // Напоминание клиенту, который не закончил разговор с ботом: что осталось сделать.
  const LEFT = { product: "выбрать букет", date: "выбрать день", date_custom: "выбрать день", slot: "выбрать время", fulfillment: "решить, доставка или самовывоз", address: "написать адрес", name: "сказать, как к вам обращаться", phone: "оставить телефон", confirm: "подтвердить заказ" };
  function followUpText(step, p = profileLib.get()) {
    const left = LEFT[step];
    const text = left
      ? `Здравствуйте! Вижу, мы не закончили — до заказа осталось только ${left}. Если ещё актуально, напишите, и продолжим с того же места.`
      : "Здравствуйте! Если ещё нужна помощь с букетом, просто напишите — продолжим с того же места.";
    return profileLib.voice(text.replace(/^Здравствуйте!/, p.tone.greeting), p.tone.address);
  }

  // Сводка: что агент сделал по заявкам.
  function summary(records) {
    const by = (code) => records.filter((r) => done(r, code)).length;
    const paidAfterReminder = records.filter((r) => done(r, "pay_reminder") && r.payment === "paid").length;
    return {
      touched: records.filter((r) => (r.history || []).some((h) => h.type === "agent")).length,
      night: by("night_notice"), pinged: by("sla_ping"), autoConfirmed: by("auto_confirm"),
      payReminders: by("pay_reminder"), paidAfterReminder, reviews: by("review"),
    };
  }

  return { BY, tick, isOpen, nextOpening, workMinutes, followUpText, summary };
});
