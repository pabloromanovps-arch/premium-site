// Симуляция внешнего мира: время, Telegram, внешняя CRM, SMS клиенту.
// Настройки и журнал отправок хранятся в localStorage, поэтому общие для всех вкладок.
(function (root, factory) {
  const messages = typeof require === "function" ? require("./messages.js") : root.Flora.messages;
  const mod = factory(root, messages);
  if (typeof module === "object" && module.exports) module.exports = mod;
  else {
    const F = (root.Flora = root.Flora || {});
    F.sim = mod;
    F.simInstance = mod.createSim({ storage: mod.browserStorage() });
    F.clock = () => F.simInstance.now();
  }
})(typeof self !== "undefined" ? self : this, function (root, messages) {
  const SETTINGS_KEY = "stebel.sim.v1";
  const OUTBOX_KEY = "stebel.outbox.v1";
  const OUTBOX_LIMIT = 300;
  const DEFAULTS = { offsetMs: 0, tgDown: false, crmDown: false, latencyMs: 300 };
  const CHANNELS = { telegram: "Telegram менеджеру", crm: "Внешняя CRM", sms: "SMS клиенту", metrika: "Яндекс.Метрика" };

  function memoryStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
  function browserStorage() {
    try {
      root.localStorage.setItem("__stebel_test", "1");
      root.localStorage.removeItem("__stebel_test");
      return root.localStorage;
    } catch (e) {
      return memoryStorage();
    }
  }

  function createSim(opts = {}) {
    const storage = opts.storage || memoryStorage();
    const realNow = opts.realNow || (() => Date.now());
    const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    let seq = 0;

    const read = (k, d) => { try { return JSON.parse(storage.getItem(k)) || d; } catch (e) { return d; } };
    const settings = () => ({ ...DEFAULTS, ...read(SETTINGS_KEY, {}) });
    const setSettings = (patch) => { const s = { ...settings(), ...patch }; storage.setItem(SETTINGS_KEY, JSON.stringify(s)); return s; };

    const now = () => new Date(realNow() + settings().offsetMs);
    // Время идёт дальше от заданной точки, как настоящее.
    const setTime = (date) => setSettings({ offsetMs: new Date(date).getTime() - realNow() });
    const resetTime = () => setSettings({ offsetMs: 0 });

    const outbox = {
      list: (channel) => read(OUTBOX_KEY, []).filter((e) => !channel || e.channel === channel),
      push(entry) {
        const all = read(OUTBOX_KEY, []);
        const e = { n: Date.now() + "-" + ++seq, at: now().toISOString(), ...entry };
        all.unshift(e);
        storage.setItem(OUTBOX_KEY, JSON.stringify(all.slice(0, OUTBOX_LIMIT)));
        return e;
      },
      clear: () => storage.removeItem(OUTBOX_KEY),
    };

    // Ведёт себя как store.createWebhook, но вместо сети пишет в журнал и умеет «падать».
    const webhook = {
      async send(rec) {
        const s = settings();
        if (s.latencyMs) await sleep(s.latencyMs);
        const failed = [];
        if (s.tgDown) failed.push("Telegram недоступен");
        else outbox.push({ channel: "telegram", ref: rec.id, text: messages.formatTelegram(rec) });
        if (s.crmDown) failed.push("внешняя CRM недоступна");
        else outbox.push({ channel: "crm", ref: rec.id, text: JSON.stringify({ id: rec.id, kind: rec.kind, status: rec.status, name: rec.customer.name, phone: rec.customer.phone, total: rec.totals ? rec.totals.total : null }) });
        if (failed.length) throw new Error(failed.join(", ") + " (симуляция)");
        return true;
      },
    };

    function notify(event, rec) {
      const text = messages.customerSms(rec, event);
      if (text) outbox.push({ channel: "sms", ref: rec.id, to: rec.customer.phone, text });
    }

    function resetAll() {
      storage.removeItem(SETTINGS_KEY);
      outbox.clear();
    }

    return { now, settings, setSettings, setTime, resetTime, outbox, webhook, notify, resetAll };
  }

  return { CHANNELS, DEFAULTS, SETTINGS_KEY, OUTBOX_KEY, createSim, memoryStorage, browserStorage };
});
