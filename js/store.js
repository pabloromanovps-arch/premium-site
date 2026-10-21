// Мини-CRM: хранилище заявок, статусы и синхронизация с внешним сервисом.
(function (root, factory) {
  const cart = typeof require === "function" ? require("./cart.js") : root.Flora.cart;
  const mod = factory(root, cart);
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).store = mod;
})(typeof self !== "undefined" ? self : this, function (root, cart) {
  const STATUS = {
    new: "Новый",
    confirmed: "Подтверждён",
    assembling: "Собирается",
    delivering: "В доставке",
    ready: "Готов к выдаче",
    done: "Выполнен",
    called: "Перезвонили",
    cancelled: "Отменён",
  };
  const KIND = { order: "Заказ", callback: "Звонок" };
  const PAYMENT = { unpaid: "Не оплачен", paid: "Оплачен" };
  const PAYABLE = ["confirmed", "assembling", "delivering", "ready"];
  const SOURCE = { site: "Сайт", chat: "Чат на сайте", telegram: "Telegram", vk: "ВКонтакте", max: "MAX", alice: "Алиса", crm: "CRM" };
  const STORAGE_KEY = "stebel.crm.v1";

  function nextStatuses(rec) {
    if (rec.kind === "callback") return { new: ["called", "cancelled"] }[rec.status] || [];
    const map = {
      new: ["confirmed", "cancelled"],
      confirmed: ["assembling", "cancelled"],
      assembling: [rec.fulfillment === "pickup" ? "ready" : "delivering", "cancelled"],
      delivering: ["done"],
      ready: ["done"],
    };
    return map[rec.status] || [];
  }

  function memoryStorage() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }

  // localStorage бывает недоступен (приватный режим, запрет cookies) — тогда храним в памяти.
  function safeStorage() {
    try {
      const s = root.localStorage;
      s.setItem("__stebel_test", "1");
      s.removeItem("__stebel_test");
      return s;
    } catch (e) {
      return memoryStorage();
    }
  }

  function createWebhook(url, fetchImpl) {
    const f = fetchImpl || ((...a) => root.fetch(...a));
    return {
      async send(rec) {
        const res = await f(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) });
        if (!res.ok) throw new Error("сервер ответил " + res.status);
        return true;
      },
    };
  }

  const digits = (s) => String(s || "").replace(/\D/g, "");
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function createStore(opts = {}) {
    const storage = opts.storage || memoryStorage();
    const now = opts.now || (() => new Date());
    const key = opts.key || STORAGE_KEY;
    const webhook = opts.webhook || null;
    const onEvent = opts.onEvent || (() => {});
    const pending = [];
    const emit = (event, rec) => { try { onEvent(event, rec); } catch (e) { /* уведомления не должны ломать CRM */ } };

    function load() {
      try {
        const db = JSON.parse(storage.getItem(key));
        if (db && Array.isArray(db.items)) return db;
      } catch (e) { /* повреждённые данные — начинаем заново */ }
      return { seq: 1000, items: [] };
    }
    const save = (db) => storage.setItem(key, JSON.stringify(db));

    function mutate(id, fn) {
      const db = load();
      const rec = db.items.find((r) => digits(r.id) === digits(id));
      if (!rec) throw new Error(`Заявка ${id} не найдена.`);
      fn(rec);
      save(db);
      return clone(rec);
    }

    function create(input) {
      const db = load();
      db.seq += 1;
      const kind = input.kind === "callback" ? "callback" : "order";
      const source = SOURCE[input.source] ? input.source : "site";
      const at = now().toISOString();
      const rec = {
        id: (kind === "order" ? "СТ-" : "ЗВ-") + db.seq,
        kind, source, status: "new", createdAt: at,
        customer: { name: String(input.name || "").trim(), phone: input.phone },
        history: [{ at, type: "status", status: "new", by: SOURCE[source] }],
      };
      if (kind === "order") {
        Object.assign(rec, {
          fulfillment: input.fulfillment, address: input.address || "",
          date: input.date, slot: input.slot, note: input.note || "",
          items: input.items.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
          totals: cart.totals(input.items, input.fulfillment),
          payment: "unpaid",
        });
      } else {
        rec.topic = input.topic || "";
      }
      db.items.push(rec);
      save(db);
      if (webhook) pending.push(sync(rec.id));
      emit({ type: "created" }, clone(rec));
      return clone(rec);
    }

    function log(id, entry) {
      return mutate(id, (r) => r.history.push({ at: now().toISOString(), by: "Система", ...entry }));
    }

    function sync(id) {
      return Promise.resolve()
        .then(() => webhook.send(get(id)))
        .then(
          () => log(id, { type: "sync", ok: true, text: "Отправлено во внешнюю CRM" }),
          (err) => log(id, { type: "sync", ok: false, text: "Не отправлено во внешнюю CRM: " + err.message })
        );
    }

    function get(id) {
      const d = digits(id);
      if (!d) return null;
      const rec = load().items.find((r) => digits(r.id) === d);
      return rec ? clone(rec) : null;
    }

    function list(filter = {}) {
      const q = String(filter.q || "").trim().toLowerCase();
      const qd = digits(q);
      return load().items
        .filter((r) => !filter.status || r.status === filter.status)
        .filter((r) => !filter.source || r.source === filter.source)
        .filter((r) => !filter.kind || r.kind === filter.kind)
        .filter((r) => !q || r.customer.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) ||
          (qd.length >= 3 && (digits(r.id).includes(qd) || digits(r.customer.phone).includes(qd))))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : digits(b.id) - digits(a.id)))
        .map(clone);
    }

    function setStatus(id, status, by = "Менеджер") {
      const rec = mutate(id, (r) => {
        if (!nextStatuses(r).includes(status)) {
          throw new Error(`Нельзя перевести ${r.id} из статуса «${STATUS[r.status]}» в «${STATUS[status] || status}».`);
        }
        r.status = status;
        r.history.push({ at: now().toISOString(), type: "status", status, by });
      });
      emit({ type: "status", status }, rec);
      return rec;
    }

    // outcome: "success" или "declined" (отказ банка). Платёж принимается только после подтверждения заказа.
    function pay(id, outcome = "success") {
      const rec = mutate(id, (r) => {
        if (r.kind !== "order") throw new Error("Звонок нельзя оплатить.");
        if (r.payment === "paid") throw new Error(`Заказ ${r.id} уже оплачен.`);
        if (!PAYABLE.includes(r.status)) {
          throw new Error(r.status === "new"
            ? `Заказ ${r.id} ещё не подтверждён флористом. Оплата станет доступна после подтверждения.`
            : `Заказ ${r.id} в статусе «${STATUS[r.status]}», оплатить его нельзя.`);
        }
        const ok = outcome === "success";
        if (ok) r.payment = "paid";
        r.history.push({ at: now().toISOString(), type: "payment", ok, text: ok ? `Оплачено ${cart.formatRub(r.totals.total)}` : "Банк отклонил оплату", by: "Платёжная страница" });
      });
      emit({ type: rec.payment === "paid" ? "paid" : "payment_failed" }, rec);
      return rec;
    }

    function addComment(id, text, by = "Менеджер") {
      const t = String(text || "").trim();
      if (!t) throw new Error("Напишите текст комментария.");
      return mutate(id, (r) => r.history.push({ at: now().toISOString(), type: "comment", text: t, by }));
    }

    function reset() {
      storage.removeItem(key);
    }

    // Удаляет заявки по условию (например, тестовые). Возвращает число удалённых.
    function purge(pred) {
      const db = load();
      const before = db.items.length;
      db.items = db.items.filter((r) => !pred(clone(r)));
      save(db);
      return before - db.items.length;
    }

    function seedDemo(today) {
      const day = today || new Date(now().getTime() + 864e5).toISOString().slice(0, 10);
      const mk = (o) => create(o);
      const a = mk({ source: "site", name: "Мария Соколова", phone: "+79161234567", fulfillment: "delivery", address: "ул. Остоженка, 7, кв. 12", date: day, slot: "12-15", note: "С днём рождения, мама!", items: [{ id: "dacha", name: "Утро на даче", price: 3900, qty: 1 }] });
      const b = mk({ source: "chat", name: "Игорь", phone: "+79037654321", fulfillment: "pickup", date: day, slot: "18-21", items: [{ id: "bordo", name: "Бордо", price: 6800, qty: 1 }] });
      mk({ source: "chat", kind: "callback", name: "Анна", phone: "+79261112233", topic: "Свадебный букет" });
      const d = mk({ source: "site", name: "ООО «Север»", phone: "+74951234567", fulfillment: "delivery", address: "Пресненская наб., 12, офис 40", date: day, slot: "9-12", items: [{ id: "tulip", name: "25 тюльпанов", price: 3200, qty: 3 }] });
      setStatus(a.id, "confirmed");
      setStatus(b.id, "confirmed");
      setStatus(b.id, "assembling", "Флорист");
      addComment(d.id, "Нужен закрывающий документ на юрлицо.");
    }

    return { create, get, list, setStatus, pay, addComment, reset, purge, seedDemo, flush: () => Promise.all(pending), storageKey: key };
  }

  // Хранилище для страниц сайта. Если в js/config.js задан webhookUrl — заявки уходят на настоящий сервер,
  // иначе в симуляцию (js/sim.js): журнал Telegram, внешней CRM и SMS на пульте тестирования.
  function appStore() {
    const F = root.Flora || {};
    const url = F.config && F.config.webhookUrl;
    const sim = F.simInstance;
    return createStore({
      storage: safeStorage(),
      now: sim ? sim.now : undefined,
      webhook: url ? createWebhook(url) : sim ? sim.webhook : null,
      onEvent: sim ? sim.notify : undefined,
    });
  }

  return { STATUS, KIND, PAYMENT, PAYABLE, SOURCE, STORAGE_KEY, nextStatuses, memoryStorage, safeStorage, createWebhook, createStore, appStore };
});
