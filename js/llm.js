// Нейросеть для живого диалога. Работает в паре с ботом:
//   бот (js/bot.js) отвечает за факты — цены, наличие, даты, номера заказов, ссылки, CRM;
//   нейросеть переписывает его ответ по-человечески, учитывая весь разговор и тон магазина.
// Каждый ответ модели проверяется. Если она выдумала цену, потеряла номер заказа, написала
// слово-паразит или «вы» вместо «ты», клиент получает проверенный ответ бота без нейросети.
//
// Провайдеры:
//   none     — без нейросети, только правила;
//   ollama   — локальная модель через Ollama (http://localhost:11434);
//   openai   — любой OpenAI-совместимый адрес: LM Studio, vLLM, OpenAI (Codex и другие модели);
//   server   — наш сервер (server/worker.mjs, маршрут /llm): Claude или OpenAI с ключами на сервере;
//   claudeai — Claude прямо на claude.ai, когда стенд открыт там.
(function (root, factory) {
  const dep = (name, file) => (typeof require === "function" ? require(file) : root.Flora[name]);
  const mod = factory(root, dep("bot", "./bot.js"), dep("profile", "./profile.js"), dep("catalog", "./catalog.js"));
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).llm = mod;
})(typeof self !== "undefined" ? self : this, function (root, bot, profileLib, catalog) {
  const KEY = "stebel.llm.v1";
  const PROVIDERS = {
    none: { title: "Без нейросети", about: "Бот отвечает по правилам. Быстро, бесплатно, предсказуемо." },
    ollama: { title: "Локальная: Ollama", about: "Модель на вашем компьютере или сервере. Данные никуда не уходят.", url: "http://localhost:11434", model: "qwen2.5:7b" },
    openai: { title: "OpenAI-совместимая", about: "LM Studio, vLLM, OpenAI и другие с OpenAI API.", url: "http://localhost:1234/v1", model: "local-model" },
    server: { title: "Свой сервер: Claude или OpenAI", about: "Ключи хранятся на сервере, браузер их не видит. Для работы с клиентами — только так.", url: "", model: "claude" },
    claudeai: { title: "Claude на claude.ai", about: "Работает, когда стенд открыт по ссылке claude.ai." },
  };

  // ---------- настройки ----------
  const store = () => { try { return root.localStorage || null; } catch (e) { return null; } };
  function settings() {
    let s = null;
    try { s = JSON.parse(store() && store().getItem(KEY)); } catch (e) { s = null; }
    return { provider: "none", url: "", model: "", key: "", timeoutMs: 12000, ...(s || {}) };
  }
  function saveSettings(s) { const st = store(); if (st) st.setItem(KEY, JSON.stringify(s)); }

  // ---------- вызов модели ----------
  // Возвращает текст ответа модели. fetchImpl — для тестов.
  async function complete(cfg, { system, messages }, fetchImpl) {
    const f = fetchImpl || ((...a) => root.fetch(...a));
    let timer = null;
    const timeout = (ms) => new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`нет ответа за ${Math.round(ms / 1000)} с`)), ms); });
    const call = (async () => {
      if (cfg.provider === "ollama") {
        const res = await f(`${trim(cfg.url || PROVIDERS.ollama.url)}/api/chat`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: cfg.model || PROVIDERS.ollama.model, stream: false, format: "json", messages: [{ role: "system", content: system }, ...messages] }),
        });
        if (!res.ok) throw new Error(`Ollama ответила ${res.status}`);
        return (await res.json()).message.content;
      }
      if (cfg.provider === "openai") {
        const headers = { "Content-Type": "application/json" };
        if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
        const res = await f(`${trim(cfg.url || PROVIDERS.openai.url)}/chat/completions`, {
          method: "POST", headers,
          body: JSON.stringify({ model: cfg.model || PROVIDERS.openai.model, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, ...messages] }),
        });
        if (!res.ok) throw new Error(`сервер модели ответил ${res.status}`);
        return (await res.json()).choices[0].message.content;
      }
      if (cfg.provider === "server") {
        if (!cfg.url) throw new Error("не указан адрес сервера");
        const res = await f(`${trim(cfg.url)}/llm`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: cfg.model === "openai" ? "openai" : "claude", system, messages }),
        });
        if (!res.ok) throw new Error(`сервер ответил ${res.status}`);
        return (await res.json()).text;
      }
      if (cfg.provider === "claudeai") {
        let ai = null;
        try { ai = root.parent && root.parent !== root && root.parent.STEBEL_AI; } catch (e) { ai = null; }
        if (!ai) throw new Error("стенд открыт не на claude.ai");
        const out = await ai(`${system}\n\nРазговор:\n${messages.map((m) => `${m.role === "user" ? "Клиент" : "Магазин"}: ${m.content}`).join("\n")}`);
        return typeof out === "string" ? out : JSON.stringify(out);
      }
      throw new Error("нейросеть не выбрана");
    })();
    try {
      return await Promise.race([call, timeout(cfg.timeoutMs || 12000)]);
    } finally {
      clearTimeout(timer);
    }
  }
  const trim = (u) => String(u).replace(/\/+$/, "");

  // Ответ модели: JSON {"reply": "..."}, иногда в ``` или с текстом вокруг.
  function parseReply(raw) {
    if (raw && typeof raw === "object") return raw.reply ? String(raw.reply) : null;
    const t = String(raw || "");
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start < 0 || end < start) return null;
    try { const o = JSON.parse(t.slice(start, end + 1)); return o && typeof o.reply === "string" ? o.reply : null; } catch (e) { return null; }
  }

  // ---------- что нельзя потерять и нельзя выдумать ----------
  const MONEY = /\d[\d\s ]*\s?₽/g;
  const norm = (s) => s.replace(/[\s ]/g, "");
  function facts(text, p) {
    const prefixes = [p.orderId.order, p.orderId.callback].join("|");
    const ids = text.match(new RegExp(`(?:${prefixes})-(?:\\d{4}-)?\\d+`, "g")) || [];
    const links = text.match(/pay\.html#\S+/g) || [];
    const money = (text.match(MONEY) || []).map(norm);
    const slots = text.match(/\d{1,2}:\d{2}–\d{1,2}:\d{2}/g) || [];
    const dates = text.match(/\d{1,2} (?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/g) || [];
    const phones = text.match(/\+7 \d{3} \d{3}-\d{2}-\d{2}/g) || [];
    return { ids, links, money, slots, dates, phones };
  }

  // Проверка ответа модели. Возвращает список проблем; пустой — ответ можно отправлять.
  function check(reply, draft, p) {
    const problems = [];
    if (!reply || !reply.trim()) return ["пустой ответ"];
    if (reply.length > Math.max(600, draft.length * 1.8 + 200)) problems.push("слишком длинно");
    const need = facts(draft, p);
    const keep = (list, what) => { for (const x of list) if (!(what === "money" ? norm(reply).includes(x) : reply.includes(x))) problems.push(`потерян факт: ${x}`); };
    keep(need.ids); keep(need.links); keep(need.money, "money"); keep(need.slots); keep(need.dates); keep(need.phones);
    // суммы в ответе — только те, что есть у бота, в каталоге или в допродажах
    const allowed = new Set([...need.money, ...catalog.products.map((x) => norm(x.price.toLocaleString("ru-RU") + "₽")), ...(p.addons || []).map((a) => norm(a.price.toLocaleString("ru-RU") + "₽"))].map((x) => x.replace(/\D/g, "")));
    for (const m of reply.match(MONEY) || []) if (!allowed.has(m.replace(/\D/g, ""))) problems.push(`выдуманная сумма: ${m.trim()}`);
    const otherIds = (reply.match(new RegExp(`(?:${p.orderId.order}|${p.orderId.callback})-(?:\\d{4}-)?\\d+`, "g")) || []).filter((x) => !need.ids.includes(x));
    if (otherIds.length) problems.push(`выдуманный номер: ${otherIds[0]}`);
    if (/https?:\/\//.test(reply) && !/https?:\/\//.test(draft)) problems.push("ссылка, которой нет у бота");
    for (const w of profileLib.lint(reply, p)) problems.push(`слово-паразит: ${w}`);
    if (p.tone.address === "ты" && /(^|[^А-Яа-яЁё])(вы|Вы|вас|Вас|вам|Вам|ваш\S*|Ваш\S*)(?=[^А-Яа-яЁё]|$)/.test(reply)) problems.push("обращение на «вы» вместо «ты»");
    return problems;
  }

  // ---------- подсказка для модели ----------
  function systemPrompt(p) {
    const b = p.business;
    return [
      `Ты — продавец-консультант «${b.name}» (${b.kind}, ${b.city}). Пишешь клиенту в чате.`,
      `Обращайся на «${p.tone.address}». Приветствие магазина: «${p.tone.greeting}».${p.tone.emoji ? ` Фирменный эмодзи ${p.tone.emoji} — не чаще одного раза за сообщение.` : " Без эмодзи."}`,
      "Тебе дают разговор и ЧЕРНОВИК ответа от системы магазина. Перепиши черновик так, как ответил бы внимательный живой продавец: тепло, коротко, по делу, учитывая, что клиент сказал раньше.",
      "Правила:",
      "— Все факты из черновика сохрани дословно: суммы, даты, время, номера заказов, телефоны, ссылки, названия букетов. Не добавляй новых цен, скидок, сроков и обещаний.",
      "— Если в черновике есть вопрос клиенту — задай его. Если есть варианты на выбор — упомяни их естественно, кнопки клиент увидит сам.",
      "— Если в черновике есть предложение («Кстати…») — оставь его одним мягким предложением, без нажима. Если клиент уже отказался — не возвращайся к нему.",
      "— Если товара нет — честно скажи и предложи то, что предложила система.",
      "— Без канцелярита и слов-паразитов, без «ваш запрос очень важен». Не притворяйся человеком, если спросят прямо.",
      "Ответь только JSON: {\"reply\": \"текст ответа\"}.",
    ].join("\n");
  }

  // Разговор для модели: последние реплики, затем черновик системы.
  function buildMessages(history, draftText) {
    const tail = (history || []).slice(-8).map((h) => ({ role: h.from === "client" ? "user" : "assistant", content: h.text }));
    const last = tail.length && tail[tail.length - 1].role === "user" ? tail.pop().content : "";
    const out = tail.slice(-7);
    while (out.length && out[0].role !== "user") out.shift(); // разговор для модели начинается с клиента
    return out.concat({ role: "user", content: `${last ? `Клиент: ${last}\n\n` : ""}ЧЕРНОВИК СИСТЕМЫ (факты не менять):\n${draftText}` });
  }

  // ---------- главный ход ----------
  // Как bot.reply, но текст ответа пишет нейросеть (если она выбрана и ответ прошёл проверку).
  // history — переписка [{from: "client"|"bot", text}] включая последнюю реплику клиента.
  async function reply(state, input, ctx, { cfg = settings(), history = [], fetchImpl } = {}) {
    const r = bot.reply(state, input, ctx);
    if (!cfg || cfg.provider === "none") return { ...r, meta: { by: "rules" } };
    return rewrite(r, ctx, { cfg, history, fetchImpl });
  }
  async function rewrite(r, ctx, { cfg, history = [], fetchImpl }) {
    const p = (ctx && ctx.profile) || profileLib.get();
    const draftText = r.messages.map((m) => m.text).filter(Boolean).join("\n\n");
    if (!draftText.trim()) return { ...r, meta: { by: "rules" } };
    const started = Date.now();
    try {
      const raw = await complete(cfg, { system: systemPrompt(p), messages: buildMessages(history, draftText) }, fetchImpl);
      const text = parseReply(raw);
      const problems = check(text, draftText, p);
      if (problems.length) return { ...r, meta: { by: "rules", fallback: problems, ms: Date.now() - started } };
      // один живой ответ вместо нескольких сообщений бота; кнопки и карточки — как у бота
      const options = (r.messages.filter((m) => m.options).pop() || {}).options;
      const cards = (r.messages.filter((m) => m.cards).pop() || {}).cards;
      const msg = { text: text.trim() };
      if (options) msg.options = options;
      if (cards) msg.cards = cards;
      return { state: r.state, messages: [msg], meta: { by: "llm", provider: cfg.provider, ms: Date.now() - started, draft: draftText } };
    } catch (e) {
      return { ...r, meta: { by: "rules", fallback: [e.message || "ошибка нейросети"], ms: Date.now() - started } };
    }
  }

  return { KEY, PROVIDERS, settings, saveSettings, complete, parseReply, check, facts, systemPrompt, buildMessages, reply, rewrite };
});
