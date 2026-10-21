// Цели Яндекс.Метрики. Если в js/config.js указан metrikaId — цели уходят в настоящий счётчик,
// а на стенде они всегда видны в журнале пульта тестирования.
(function (root) {
  const F = (root.Flora = root.Flora || {});
  const GOALS = {
    cart_add: "Добавил букет в корзину",
    cart_open: "Открыл корзину",
    checkout_error: "Ошибка в форме заказа",
    order_sent: "Оформил заказ на сайте",
    chat_open: "Открыл чат",
    chat_order: "Оформил заказ в чате",
    callback_request: "Попросил перезвонить",
    payment_success: "Оплатил заказ",
  };
  const id = F.config && F.config.metrikaId;

  if (id && root.document) {
    // Стандартный код счётчика Метрики.
    root.ym = root.ym || function () { (root.ym.a = root.ym.a || []).push(arguments); };
    root.ym.l = Date.now();
    const s = root.document.createElement("script");
    s.async = true;
    s.src = "https://mc.yandex.ru/metrika/tag.js";
    root.document.head.appendChild(s);
    root.ym(id, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  }

  F.metrika = {
    GOALS,
    reachGoal(goal, params) {
      if (id && root.ym) root.ym(id, "reachGoal", goal, params);
      if (F.simInstance) {
        F.simInstance.outbox.push({
          channel: "metrika",
          ref: params && params.order_id,
          text: `${goal} — ${GOALS[goal] || "цель"}${params ? " " + JSON.stringify(params) : ""}`,
        });
      }
    },
  };
})(typeof self !== "undefined" ? self : this);
