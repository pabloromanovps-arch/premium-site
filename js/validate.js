// Проверка данных заказа, телефоны, даты и интервалы доставки по московскому времени.
(function (root, factory) {
  const mod = factory(root);
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).validate = mod;
})(typeof self !== "undefined" ? self : this, function (root) {
  // В браузере время может быть сдвинуто пультом тестирования (js/sim.js).
  const clock = () => (root && root.Flora && root.Flora.clock ? root.Flora.clock() : new Date());

  const SLOTS = [
    { id: "9-12", label: "9:00–12:00", start: 9 },
    { id: "12-15", label: "12:00–15:00", start: 12 },
    { id: "15-18", label: "15:00–18:00", start: 15 },
    { id: "18-21", label: "18:00–21:00", start: 18 },
  ];
  const LEAD_HOURS = 2;
  const MAX_DAYS_AHEAD = 30;

  const mskFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });

  function moscowNow(now = clock()) {
    const p = Object.fromEntries(mskFormat.formatToParts(now).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
  }

  function isIsoDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
    const d = new Date(s + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function addDays(iso, n) {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function dateRange(now = clock()) {
    const today = moscowNow(now).date;
    return { min: today, max: addDays(today, MAX_DAYS_AHEAD) };
  }

  function availableSlots(date, now = clock()) {
    if (!isIsoDate(date)) return [];
    const t = moscowNow(now);
    const { min, max } = dateRange(now);
    if (date < min || date > max) return [];
    if (date === t.date) {
      const h = t.hour + t.minute / 60;
      return SLOTS.filter((s) => s.start >= h + LEAD_HOURS);
    }
    return SLOTS.slice();
  }

  function slotLabel(id) {
    const s = SLOTS.find((x) => x.id === id);
    return s ? s.label : "";
  }

  // Возвращает +7XXXXXXXXXX или null.
  function normalizePhone(value) {
    let d = String(value || "").replace(/\D/g, "");
    if (d.length === 11 && (d[0] === "7" || d[0] === "8")) d = d.slice(1);
    return d.length === 10 ? "+7" + d : null;
  }

  function formatPhone(p) {
    const d = String(p || "").replace(/\D/g, "").slice(-10);
    if (d.length !== 10) return String(p || "");
    return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
  }

  const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  function formatDate(iso) {
    return isIsoDate(iso) ? dayFormat.format(new Date(iso + "T00:00:00Z")) : "";
  }

  // Принимает «25.12» или «25.12.2026», возвращает ISO-дату или null.
  function parseRuDate(text, now = clock()) {
    const m = String(text || "").trim().match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
    if (!m) return null;
    const today = moscowNow(now).date;
    let year = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : Number(today.slice(0, 4));
    const pad = (n) => String(n).padStart(2, "0");
    let iso = `${year}-${pad(m[2])}-${pad(m[1])}`;
    if (!isIsoDate(iso)) return null;
    if (!m[3] && iso < today) iso = `${year + 1}-${pad(m[2])}-${pad(m[1])}`;
    return isIsoDate(iso) ? iso : null;
  }

  function validateOrder(input, now = clock()) {
    const errors = {};
    const name = String(input.name || "").trim();
    const phone = normalizePhone(input.phone);
    const fulfillment = input.fulfillment;
    const address = String(input.address || "").trim();
    const date = input.date;
    const slot = input.slot;
    const items = Array.isArray(input.items) ? input.items.filter((i) => i.qty > 0) : [];

    if (!name) errors.name = "Укажите имя.";
    if (!phone) errors.phone = "Введите номер телефона: 10 цифр после +7.";
    if (fulfillment !== "delivery" && fulfillment !== "pickup") errors.fulfillment = "Выберите доставку или самовывоз.";
    if (fulfillment === "delivery" && address.length < 5) errors.address = "Укажите адрес доставки: улица, дом, квартира.";

    const { min, max } = dateRange(now);
    if (!isIsoDate(date) || date < min || date > max) {
      errors.date = "Выберите дату с сегодняшнего дня и не позже чем через 30 дней.";
    } else if (!SLOTS.some((s) => s.id === slot)) {
      errors.slot = "Выберите интервал.";
    } else if (!availableSlots(date, now).some((s) => s.id === slot)) {
      errors.slot = "Этот интервал уже недоступен: на сегодня принимаем заказы минимум за 2 часа. Выберите более поздний.";
    }
    if (!items.length) errors.items = "Добавьте в корзину хотя бы один букет.";

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      value: {
        name, phone, fulfillment,
        address: fulfillment === "delivery" ? address : "",
        date, slot,
        note: String(input.note || "").trim().slice(0, 300),
        items,
      },
    };
  }

  return {
    SLOTS, LEAD_HOURS, MAX_DAYS_AHEAD,
    moscowNow, isIsoDate, addDays, dateRange, availableSlots, slotLabel,
    normalizePhone, formatPhone, formatDate, parseRuDate, validateOrder,
  };
});
