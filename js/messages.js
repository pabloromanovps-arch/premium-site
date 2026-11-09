// Тексты уведомлений: менеджеру в Telegram и клиенту по SMS. Общие для симуляции и настоящего сервера.
(function (root, factory) {
  const profile = typeof require === "function" ? require("./profile.js") : root.Flora.profile;
  const mod = factory(profile);
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).messages = mod;
})(typeof self !== "undefined" ? self : this, function (profile) {
  const rub = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
  const STATUS = { new: "Новый", confirmed: "Подтверждён", assembling: "Собирается", delivering: "В доставке", ready: "Готов к выдаче", done: "Выполнен", called: "Перезвонили", cancelled: "Отменён" };

  const SOURCE = { site: "сайт", chat: "чат на сайте", avito: "Авито", telegram: "Telegram", vk: "ВКонтакте", max: "MAX", alice: "Алиса" };
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const day = (iso) => { const [, mo, d] = String(iso).split("-").map(Number); return mo ? `${d} ${MONTHS[mo - 1]}` : String(iso); };
  const slot = (id) => String(id).replace(/^(\d+)-(\d+)$/, "$1:00–$2:00");

  function formatTelegram(o) {
    const src = SOURCE[o.source] || o.source;
    if (o.kind === "callback") {
      return `Заявка на звонок ${o.id} (${src})\n${o.customer.name}, ${o.customer.phone}\nТема: ${o.topic || "—"}`;
    }
    const items = o.items.map((i) => `• ${i.name} ×${i.qty} — ${rub(i.price * i.qty)}`).join("\n");
    const where = o.fulfillment === "pickup" ? "Самовывоз" : `Доставка: ${o.address}`;
    return [
      `Новый заказ ${o.id} (${src}), статус: ${STATUS[o.status] || o.status}`,
      items,
      `${day(o.date)}, ${slot(o.slot)}`,
      where,
      `${o.customer.name}, ${o.customer.phone}`,
      o.note ? `Открытка: ${o.note}` : "",
      `Итого: ${rub(o.totals.total)}`,
    ].filter(Boolean).join("\n");
  }

  function paymentLink(id) {
    return "pay.html#" + encodeURIComponent(id);
  }

  // Текст сообщения клиенту по шаблону из профиля бизнеса. key — название шаблона.
  function render(key, o, p) {
    p = p || (profile ? profile.get() : null);
    if (!p || !p.templates[key]) return null;
    const text = profile.fill(p.templates[key], profile.vars(p, {
      id: o.id, sum: o.totals ? rub(o.totals.total) : "", slot: o.slot ? slot(o.slot) : "",
      link: paymentLink(o.id), name: o.customer ? o.customer.name : "",
    }));
    return profile.voice(text, p.tone.address);
  }

  // SMS клиенту при событии с заказом; null — сообщение не нужно.
  function customerSms(o, event) {
    if (o.kind !== "order") return null;
    if (event.type === "created") return render("created", o);
    if (event.type === "paid") return render("paid", o);
    if (event.type === "payment_failed") return render("payment_failed", o);
    if (event.type !== "status") return null;
    return ["confirmed", "delivering", "ready", "done", "cancelled"].includes(event.status) ? render(event.status, o) : null;
  }

  return { formatTelegram, customerSms, paymentLink, render };
});
