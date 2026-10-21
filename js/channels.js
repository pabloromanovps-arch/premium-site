// Адаптеры мессенджеров: разбирают входящее событие платформы и превращают ответ бота в вызовы её API.
// Один бот (js/bot.js) — пять каналов: чат на сайте, Telegram, ВКонтакте, MAX и навык Алисы.
//
// Ограничения платформ взяты из их документации для разработчиков (Telegram Bot API, VK API,
// MAX Bot API, Яндекс Диалоги). Перед запуском в бой сверяйте с актуальной документацией.
(function (root, factory) {
  const dep = (name, file) => (typeof require === "function" ? require(file) : root.Flora[name]);
  const mod = factory(dep("bot", "./bot.js"), dep("cart", "./cart.js"));
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).channels = mod;
})(typeof self !== "undefined" ? self : this, function (bot, cart) {
  const LIMITS = {
    telegram: { text: 4096, callbackBytes: 64, buttonText: 64, rows: 100 },
    vk: { text: 4096, buttonText: 40, payloadChars: 255, rows: 6, buttons: 10 },
    max: { text: 4000, buttonText: 64, payloadBytes: 1024, rows: 30, buttons: 210 },
    alice: { text: 1024, tts: 1024, buttonText: 64, buttons: 8 },
  };
  const NAMES = { site: "Чат на сайте", telegram: "Telegram", vk: "ВКонтакте", max: "MAX", alice: "Алиса" };

  const bytes = (s) => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s).length : Buffer.byteLength(s));
  const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const rub = (n) => cart.formatRub(n);

  // Карточки букетов в мессенджерах — списком в тексте.
  function withCards(msg) {
    if (!msg.cards || !msg.cards.length) return msg.text;
    const list = msg.cards.map((c) => `• ${c.name} — ${rub(c.price)}\n   ${c.composition}`).join("\n");
    return (msg.text ? msg.text + "\n\n" : "") + list;
  }
  const lastOptions = (messages) => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].options) return { index: i, options: messages[i].options };
    return { index: -1, options: [] };
  };

  // ---------- Telegram ----------
  const telegram = {
    parse(u) {
      if (u.callback_query) {
        const cq = u.callback_query;
        const kb = (cq.message && cq.message.reply_markup && cq.message.reply_markup.inline_keyboard) || [];
        const btn = kb.flat().find((b) => b.callback_data === cq.data);
        return { kind: "message", chatId: String(cq.message.chat.id), value: cq.data, text: btn ? btn.text : "", callbackId: cq.id };
      }
      if (u.message && typeof u.message.text === "string") {
        const text = u.message.text.trim();
        return { kind: "message", chatId: String(u.message.chat.id), text, start: text === "/start" };
      }
      return { kind: "ignore" };
    },
    render(chatId, messages, inb) {
      const { index, options } = lastOptions(messages);
      const calls = messages.map((msg, i) => {
        const body = { chat_id: chatId, text: clip(withCards(msg), LIMITS.telegram.text) };
        if (i === index) body.reply_markup = { inline_keyboard: options.map((o) => [{ text: clip(o.label, LIMITS.telegram.buttonText), callback_data: o.value }]) };
        return { method: "sendMessage", body };
      });
      if (inb && inb.callbackId) calls.unshift({ method: "answerCallbackQuery", body: { callback_query_id: inb.callbackId } });
      return calls;
    },
  };

  // ---------- ВКонтакте (Callback API + messages.send) ----------
  let vkRandom = 0;
  const vk = {
    parse(u) {
      if (u.type === "confirmation") return { kind: "confirmation" };
      if (u.type !== "message_new") return { kind: "ignore" };
      const msg = (u.object && (u.object.message || u.object)) || {};
      let value;
      let start = false;
      if (msg.payload) {
        try {
          const p = JSON.parse(msg.payload);
          value = p.v;
          start = p.command === "start";
        } catch (e) { /* чужой payload — считаем обычным текстом */ }
      }
      return { kind: "message", chatId: String(msg.peer_id), text: String(msg.text || "").trim(), value, start };
    },
    render(chatId, messages) {
      const { index, options } = lastOptions(messages);
      return messages.map((msg, i) => {
        const body = { peer_id: Number(chatId), random_id: Date.now() * 1000 + (++vkRandom % 1000), message: clip(withCards(msg), LIMITS.vk.text) };
        if (i === index) {
          body.keyboard = JSON.stringify({
            inline: true,
            buttons: options.slice(0, LIMITS.vk.rows).map((o) => [{ action: { type: "text", label: clip(o.label, LIMITS.vk.buttonText), payload: JSON.stringify({ v: o.value }) }, color: "secondary" }]),
          });
        }
        return { method: "messages.send", body };
      });
    },
  };

  // ---------- MAX (Bot API) ----------
  const max = {
    parse(u) {
      if (u.update_type === "bot_started") return { kind: "message", chatId: String(u.chat_id), text: "", start: true };
      if (u.update_type === "message_callback") {
        return { kind: "message", chatId: String(u.message.recipient.chat_id), value: u.callback.payload, text: "", callbackId: u.callback.callback_id };
      }
      if (u.update_type === "message_created") {
        const text = String((u.message.body && u.message.body.text) || "").trim();
        return { kind: "message", chatId: String(u.message.recipient.chat_id), text, start: text === "/start" };
      }
      return { kind: "ignore" };
    },
    render(chatId, messages, inb) {
      const { index, options } = lastOptions(messages);
      const calls = messages.map((msg, i) => {
        const body = { text: clip(withCards(msg), LIMITS.max.text) };
        if (i === index) {
          body.attachments = [{ type: "inline_keyboard", payload: { buttons: options.map((o) => [{ type: "callback", text: clip(o.label, LIMITS.max.buttonText), payload: o.value }]) } }];
        }
        return { method: "POST /messages", query: { chat_id: chatId }, body };
      });
      if (inb && inb.callbackId) calls.unshift({ method: "POST /answers", query: { callback_id: inb.callbackId }, body: { notification: "" } });
      return calls;
    },
  };

  // ---------- Алиса (Яндекс Диалоги) ----------
  // Состояние разговора Алиса хранит сама: мы возвращаем его в session_state, она присылает его в state.session.
  function speak(text) {
    return text
      .replace(/(\d) (\d)/g, "$1$2")
      .replace(/\u00a0/g, " ")
      .replace(/₽/g, "рублей")
      .replace(/СТ-(\d+)/g, "эс тэ $1")
      .replace(/ЗВ-(\d+)/g, "зэ вэ $1")
      .replace(/[«»•]/g, "")
      .replace(/\s*\n+\s*/g, ". ")
      .replace(/\.\s*\./g, ".");
  }
  const alice = {
    parse(u) {
      const req = u.request || {};
      const value = req.payload && req.payload.v;
      const text = String(req.original_utterance || req.command || "").trim();
      const isNew = !!(u.session && u.session.new);
      return {
        kind: "message", chatId: String(u.session && u.session.session_id), text, value,
        start: isNew && !text && !value,
        state: u.state && u.state.session && u.state.session.bot,
      };
    },
    render(chatId, messages) {
      const { options } = lastOptions(messages);
      // У Алисы один ответ на реплику: склеиваем сообщения, карточки — коротко, чтобы влезть в 1024 символа.
      const parts = messages.map((msg) => {
        if (!msg.cards || !msg.cards.length) return msg.text;
        const list = msg.cards.map((c) => `${c.name} — ${rub(c.price)}`).join("; ");
        return (msg.text ? msg.text + " " : "") + list + ".";
      });
      let text = parts.join("\n").replace(/\n+/g, "\n");
      text = clip(text, LIMITS.alice.text);
      return [{
        method: "response",
        body: {
          version: "1.0",
          response: {
            text,
            tts: clip(speak(text), LIMITS.alice.tts),
            buttons: options.slice(0, LIMITS.alice.buttons).map((o) => ({ title: clip(o.label, LIMITS.alice.buttonText), payload: { v: o.value }, hide: true })),
            end_session: false,
          },
        },
      }];
    },
  };

  // ---------- чат на сайте: формат «как есть» ----------
  const site = {
    parse: (u) => ({ kind: "message", chatId: String(u.chatId || "site"), text: String(u.text || "").trim(), value: u.value, start: !!u.start }),
    render: (chatId, messages) => [{ method: "show", body: { messages } }],
  };

  const ADAPTERS = { site, telegram, vk, max, alice };

  // Полный цикл: событие платформы → бот → вызовы API.
  // deps: { sessions: { get(key), set(key, state) } (могут быть async), ctx: { now, create, lookup } }
  async function handle(channel, update, deps) {
    const a = ADAPTERS[channel];
    if (!a) throw new Error("Неизвестный канал: " + channel);
    const inb = a.parse(update);
    if (inb.kind !== "message") return { kind: inb.kind, calls: [] };

    const key = channel + ":" + inb.chatId;
    const saved = channel === "alice" ? inb.state : await deps.sessions.get(key);
    const ctx = { ...deps.ctx, source: channel === "site" ? "chat" : channel };
    let result;
    if (inb.start || (!saved && !inb.text && !inb.value)) result = bot.start();
    else result = bot.reply(saved || bot.start().state, { text: inb.text, value: inb.value }, ctx);

    const calls = a.render(inb.chatId, result.messages, inb);
    if (channel === "alice") calls[0].body.session_state = { bot: result.state };
    else await deps.sessions.set(key, result.state);
    return { kind: "message", chatId: inb.chatId, input: inb, state: result.state, messages: result.messages, calls };
  }

  // Проверка вызовов API на ограничения платформы. Возвращает список нарушений.
  function checkLimits(channel, calls) {
    const L = LIMITS[channel];
    const errs = [];
    if (!L) return errs;
    for (const c of calls) {
      const b = c.body;
      if (channel === "telegram" && c.method === "sendMessage") {
        if (!b.text || b.text.length > L.text) errs.push(`Telegram: длина текста ${b.text ? b.text.length : 0}`);
        for (const btn of ((b.reply_markup && b.reply_markup.inline_keyboard) || []).flat()) {
          if (bytes(btn.callback_data) > L.callbackBytes) errs.push(`Telegram: callback_data «${btn.callback_data}» длиннее ${L.callbackBytes} байт`);
          if (!btn.text) errs.push("Telegram: пустая кнопка");
        }
      }
      if (channel === "vk" && c.method === "messages.send") {
        if (!b.message || b.message.length > L.text) errs.push(`VK: длина текста ${b.message ? b.message.length : 0}`);
        if (b.keyboard) {
          const kb = JSON.parse(b.keyboard);
          const flat = kb.buttons.flat();
          if (kb.buttons.length > L.rows) errs.push(`VK: рядов ${kb.buttons.length} > ${L.rows}`);
          if (flat.length > L.buttons) errs.push(`VK: кнопок ${flat.length} > ${L.buttons}`);
          for (const btn of flat) {
            if (btn.action.label.length > L.buttonText) errs.push(`VK: подпись «${btn.action.label}» длиннее ${L.buttonText}`);
            if (btn.action.payload.length > L.payloadChars) errs.push("VK: payload длиннее 255 символов");
          }
        }
        if (!Number.isInteger(b.random_id)) errs.push("VK: нет random_id");
      }
      if (channel === "max" && c.method === "POST /messages") {
        if (!b.text || b.text.length > L.text) errs.push(`MAX: длина текста ${b.text ? b.text.length : 0}`);
        for (const att of b.attachments || []) {
          const btns = att.payload.buttons;
          if (btns.length > L.rows) errs.push(`MAX: рядов ${btns.length}`);
          for (const btn of btns.flat()) {
            if (btn.text.length > L.buttonText) errs.push(`MAX: подпись «${btn.text}» длинная`);
            if (bytes(btn.payload) > L.payloadBytes) errs.push("MAX: payload слишком длинный");
          }
        }
      }
      if (channel === "alice") {
        const r = b.response;
        if (!r.text || r.text.length > L.text) errs.push(`Алиса: длина текста ${r.text ? r.text.length : 0}`);
        if (r.tts.length > L.tts) errs.push(`Алиса: длина tts ${r.tts.length}`);
        if (/https?:|pay\.html/.test(r.tts)) errs.push("Алиса: в голосовом ответе ссылка");
        for (const btn of r.buttons) if (btn.title.length > L.buttonText) errs.push(`Алиса: кнопка «${btn.title}» длинная`);
        if (b.session_state && bytes(JSON.stringify(b.session_state)) > 1024 * 4) errs.push("Алиса: session_state слишком большой");
      }
    }
    return errs;
  }

  return { NAMES, LIMITS, ADAPTERS, handle, checkLimits, speak };
});
