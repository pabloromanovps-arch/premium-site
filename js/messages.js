// Тексты уведомлений: менеджеру в Telegram и клиенту по SMS. Общие для симуляции и настоящего сервера.
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).messages = mod;
})(typeof self !== "undefined" ? self : this, function () {
  const rub = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
  const STATUS = { new: "Новый", confirmed: "Подтверждён", assembling: "Собирается", delivering: "В доставке", ready: "Готов к выдаче", done: "Выполнен", called: "Перезвонили", cancelled: "Отменён" };

  function formatTelegram(o) {
    const src = o.source === "chat" ? "чат-бот" : "сайт";
    if (o.kind === "callback") {
      return `Заявка на звонок ${o.id} (${src})\n${o.customer.name}, ${o.customer.phone}\nТема: ${o.topic || "—"}`;
    }
    const items = o.items.map((i) => `• ${i.name} ×${i.qty} — ${rub(i.price * i.qty)}`).join("\n");
    const where = o.fulfillment === "pickup" ? "Самовывоз" : `Доставка: ${o.address}`;
    return [
      `Новый заказ ${o.id} (${src}), статус: ${STATUS[o.status] || o.status}`,
      items,
      `${o.date}, интервал ${o.slot}`,
      where,
      `${o.customer.name}, ${o.customer.phone}`,
      o.note ? `Открытка: ${o.note}` : "",
      `Итого: ${rub(o.totals.total)}`,
    ].filter(Boolean).join("\n");
  }

  function paymentLink(id) {
    return "pay.html#" + encodeURIComponent(id);
  }

  // SMS клиенту при событии с заказом; null — сообщение не нужно.
  function customerSms(o, event) {
    if (o.kind !== "order") return null;
    const total = rub(o.totals.total);
    if (event.type === "created") return `«Стебель»: заказ ${o.id} принят. Флорист позвонит в течение 15 минут.`;
    if (event.type === "paid") return `«Стебель»: оплата ${total} по заказу ${o.id} получена. Спасибо!`;
    if (event.type === "payment_failed") return `«Стебель»: оплата по заказу ${o.id} не прошла. Попробуйте ещё раз: ${paymentLink(o.id)}`;
    if (event.type !== "status") return null;
    switch (event.status) {
      case "confirmed": return `«Стебель»: заказ ${o.id} подтверждён, к оплате ${total}. Оплатить: ${paymentLink(o.id)}`;
      case "delivering": return `«Стебель»: курьер везёт заказ ${o.id}, интервал ${o.slot.replace("-", ":00–")}:00.`;
      case "ready": return `«Стебель»: заказ ${o.id} готов, забрать можно на Покровке, 12 до 21:00.`;
      case "done": return `«Стебель»: заказ ${o.id} выполнен. Будем рады видеть вас снова!`;
      case "cancelled": return `«Стебель»: заказ ${o.id} отменён. Если это ошибка, позвоните +7 495 000-00-00.`;
      default: return null;
    }
  }

  return { formatTelegram, customerSms, paymentLink };
});
