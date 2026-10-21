// Каталог букетов. Цвета используются для иллюстраций.
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).catalog = mod;
})(typeof self !== "undefined" ? self : this, function () {
  const products = [
    { id: "dacha", name: "Утро на даче", price: 3900, composition: "Пионовидные розы, ромашка, эвкалипт", colors: ["#f2b8c6", "#fbe9ee", "#ffffff"], center: "#e8b64c" },
    { id: "siren", name: "Сирень и мята", price: 4600, composition: "Сирень, гвоздика, мята", colors: ["#b79bd6", "#d8c6ec", "#9a7cc2"], center: "#f3e6a8" },
    { id: "pole", name: "Полевой", price: 2400, composition: "Ромашка, васильки, злаки", colors: ["#ffffff", "#5b7fd4", "#f5f1e1"], center: "#e8b64c" },
    { id: "bordo", name: "Бордо", price: 6800, composition: "Розы, калла, амарант", colors: ["#8e1f3f", "#b8325a", "#5e1430"], center: "#3a0b1c" },
    { id: "ranunkulus", name: "Ранункулюсы", price: 5200, composition: "15 ранункулюсов в крафте", colors: ["#f59a6b", "#f7c08f", "#ef7a55"], center: "#7b9a3c" },
    { id: "tulip", name: "25 тюльпанов", price: 3200, composition: "Тюльпаны одного сорта на выбор", colors: ["#e6456f", "#f17a98", "#d22f5c"], center: "#3d2a14" },
    { id: "prazdnik", name: "Большой праздник", price: 9500, composition: "Гортензия, розы, дельфиниум", colors: ["#9cc0ea", "#f2b8c6", "#ffffff", "#6f93d6"], center: "#e8b64c" },
    { id: "kompliment", name: "Маленький комплимент", price: 1600, composition: "3 розы и эвкалипт", colors: ["#f4c9a8", "#f8dcc4"], center: "#c99a5b" },
  ];

  const BUDGETS = {
    low: { label: "До 3 000 ₽", test: (p) => p.price < 3000 },
    mid: { label: "3 000–6 000 ₽", test: (p) => p.price >= 3000 && p.price <= 6000 },
    high: { label: "От 6 000 ₽", test: (p) => p.price > 6000 },
  };

  function byId(id) {
    return products.find((p) => p.id === id) || null;
  }

  function byBudget(band) {
    const b = BUDGETS[band];
    return b ? products.filter(b.test) : [];
  }

  return { products, BUDGETS, byId, byBudget };
});
