// Корзина: чистые функции, состояние хранит вызывающий код.
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).cart = mod;
})(typeof self !== "undefined" ? self : this, function () {
  const DELIVERY_FEE = 490;
  const FREE_DELIVERY_FROM = 5000;
  const MAX_QTY = 20;

  function add(items, product, qty = 1) {
    const found = items.find((i) => i.id === product.id);
    if (found) return setQty(items, product.id, found.qty + qty);
    return items.concat({ id: product.id, name: product.name, price: product.price, qty: Math.min(qty, MAX_QTY) });
  }

  function setQty(items, id, qty) {
    const q = Math.min(Math.max(0, Math.floor(qty)), MAX_QTY);
    if (q === 0) return items.filter((i) => i.id !== id);
    return items.map((i) => (i.id === id ? { ...i, qty: q } : i));
  }

  function totals(items, fulfillment = "delivery") {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const count = items.reduce((s, i) => s + i.qty, 0);
    const delivery = fulfillment === "pickup" || subtotal === 0 || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
    return { subtotal, delivery, total: subtotal + delivery, count, toFree: Math.max(0, FREE_DELIVERY_FROM - subtotal) };
  }

  const rub = new Intl.NumberFormat("ru-RU");
  function formatRub(n) {
    return rub.format(n) + " ₽";
  }

  return { DELIVERY_FEE, FREE_DELIVERY_FROM, MAX_QTY, add, setQty, totals, formatRub };
});
