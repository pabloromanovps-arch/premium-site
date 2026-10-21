// Симулятор мессенджеров: каждое окно шлёт событие в формате платформы через js/channels.js
// и рисует ответ так, как его покажет платформа.
(function () {
  const { channels: CH, store: S } = Flora;
  const store = S.appStore();
  const now = () => (Flora.clock ? Flora.clock() : new Date());
  const SESS_KEY = "stebel.chsess.v1";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const readSess = () => { try { return JSON.parse(localStorage.getItem(SESS_KEY)) || {}; } catch (e) { return {}; } };
  const writeSess = (all) => { try { localStorage.setItem(SESS_KEY, JSON.stringify(all)); } catch (e) { /* без сохранения */ } };
  const sessions = { get: (k) => readSess()[k], set: (k, v) => { const all = readSess(); all[k] = v; writeSess(all); } };
  const ctx = { now, create: (i) => store.create(i), lookup: (id) => store.get(id) };

  const PHONES = [
    { ch: "telegram", title: "Стебель — цветы", sub: "бот в Telegram", ava: "С", chatId: 555001 },
    { ch: "vk", title: "Стебель | Цветы Москва", sub: "сообщество ВКонтакте", ava: "С", chatId: 2000000001 },
    { ch: "max", title: "Стебель", sub: "бот в MAX", ava: "С", chatId: 9001 },
    { ch: "alice", title: "Навык «Стебель»", sub: "Алиса, Яндекс", ava: "А", chatId: "alice-session-1" },
  ];

  $("phones").innerHTML = PHONES.map((p) => `
    <section class="phone" data-ch="${p.ch}" aria-label="${CH.NAMES[p.ch]}">
      <div class="phone-head"><span class="ava" aria-hidden="true">${p.ava}</span><div><h2>${p.title}</h2><p>${p.sub}</p></div>
        <button class="reset" type="button" data-reset>Начать заново</button></div>
      <div class="feed" aria-live="polite"></div>
      <div class="suggest" hidden></div>
      <form class="composer"><label class="sr-only" for="in-${p.ch}">Сообщение в ${CH.NAMES[p.ch]}</label>
        <input id="in-${p.ch}" autocomplete="off" placeholder="${p.ch === "alice" ? "Скажите или напишите Алисе" : "Сообщение"}">
        <button type="submit">Отправить</button></form>
      <details class="raw"><summary>Что ушло в API платформы</summary><p class="limits"></p><pre></pre></details>
    </section>`).join("");

  // Сборка входящих событий в формате каждой платформы
  const updates = {
    telegram: {
      start: (p) => ({ update_id: Date.now(), message: { message_id: 1, chat: { id: p.chatId, type: "private" }, text: "/start" } }),
      text: (p, text) => ({ update_id: Date.now(), message: { message_id: 1, chat: { id: p.chatId, type: "private" }, text } }),
      press: (p, btn, call) => ({ update_id: Date.now(), callback_query: { id: "cq" + Date.now(), data: btn.value, message: { chat: { id: p.chatId }, reply_markup: call.body.reply_markup } } }),
    },
    vk: {
      start: (p) => ({ type: "message_new", object: { message: { peer_id: p.chatId, text: "Начать", payload: JSON.stringify({ command: "start" }) } } }),
      text: (p, text) => ({ type: "message_new", object: { message: { peer_id: p.chatId, text } } }),
      press: (p, btn) => ({ type: "message_new", object: { message: { peer_id: p.chatId, text: btn.label, payload: btn.payload } } }),
    },
    max: {
      start: (p) => ({ update_type: "bot_started", chat_id: p.chatId }),
      text: (p, text) => ({ update_type: "message_created", message: { recipient: { chat_id: p.chatId }, body: { text } } }),
      press: (p, btn) => ({ update_type: "message_callback", callback: { callback_id: "cb" + Date.now(), payload: btn.value }, message: { recipient: { chat_id: p.chatId } } }),
    },
    alice: {
      start: (p) => ({ version: "1.0", session: { session_id: p.chatId, new: true }, request: { command: "", original_utterance: "", type: "SimpleUtterance" }, state: {} }),
      text: (p, text, st) => ({ version: "1.0", session: { session_id: p.chatId, new: false }, request: { command: text.toLowerCase(), original_utterance: text, type: "SimpleUtterance" }, state: { session: st } }),
      press: (p, btn, _c, st) => ({ version: "1.0", session: { session_id: p.chatId, new: false }, request: { command: btn.label.toLowerCase(), original_utterance: btn.label, type: "ButtonPressed", payload: btn.payloadObj }, state: { session: st } }),
    },
  };

  // Кнопки из вызова API, в едином виде для отрисовки
  function buttonsOf(ch, call) {
    const b = call.body;
    if (ch === "telegram" && b.reply_markup) return b.reply_markup.inline_keyboard.flat().map((x) => ({ label: x.text, value: x.callback_data }));
    if (ch === "vk" && b.keyboard) return JSON.parse(b.keyboard).buttons.flat().map((x) => ({ label: x.action.label, payload: x.action.payload }));
    if (ch === "max" && b.attachments) return b.attachments[0].payload.buttons.flat().map((x) => ({ label: x.text, value: x.payload }));
    return [];
  }
  const textOf = (ch, call) => (ch === "vk" ? call.body.message : call.body.text);

  PHONES.forEach((p) => {
    const el = document.querySelector(`.phone[data-ch="${p.ch}"]`);
    const feed = el.querySelector(".feed");
    const suggest = el.querySelector(".suggest");
    const histKey = "hist:" + p.ch;
    let alice = sessions.get("alice-state:" + p.chatId);
    // Сообщения уходят строго по очереди: следующее событие собирается, когда пришёл ответ на предыдущее.
    let queue = Promise.resolve();

    function bubble(html, me) {
      const d = document.createElement("div");
      d.className = "bubble" + (me ? " me" : "");
      d.innerHTML = html;
      feed.appendChild(d);
      feed.scrollTop = feed.scrollHeight;
      return d;
    }
    function remember(entry) {
      const h = sessions.get(histKey) || [];
      h.push(entry);
      sessions.set(histKey, h.slice(-80));
    }

    function draw(calls) {
      suggest.hidden = true;
      suggest.innerHTML = "";
      feed.querySelectorAll(".kb button").forEach((b) => (b.disabled = true));
      if (p.ch === "alice") {
        const r = calls[0].body.response;
        const d = bubble(esc(r.text));
        d.insertAdjacentHTML("beforeend", `<p class="tts">Алиса произнесёт: ${esc(r.tts)}</p>`);
        r.buttons.forEach((btn) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = btn.title;
          b.addEventListener("click", () => send(() => updates.alice.press(p, { label: btn.title, payloadObj: btn.payload }, null, alice), btn.title));
          suggest.appendChild(b);
        });
        suggest.hidden = r.buttons.length === 0;
        return;
      }
      for (const call of calls) {
        if (/answer/i.test(call.method)) continue;
        const d = bubble(esc(textOf(p.ch, call)));
        const btns = buttonsOf(p.ch, call);
        if (btns.length) {
          const kb = document.createElement("div");
          kb.className = "kb";
          btns.forEach((btn) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = btn.label;
            b.addEventListener("click", () => send(() => updates[p.ch].press(p, btn, call, alice), btn.label));
            kb.appendChild(b);
          });
          d.appendChild(kb);
        }
      }
    }

    function showRaw(update, calls) {
      const errs = CH.checkLimits(p.ch, calls);
      el.querySelector(".limits").innerHTML = errs.length
        ? `<span class="bad">Нарушены ограничения платформы: ${esc(errs.join("; "))}</span>`
        : "Ограничения платформы соблюдены.";
      el.querySelector(".raw pre").textContent = "Входящее событие:\n" + JSON.stringify(update, null, 2) + "\n\nВызовы API:\n" + JSON.stringify(calls, null, 2);
    }

    function send(build, shownText) {
      if (shownText) { bubble(esc(shownText), true); remember({ me: shownText }); }
      queue = queue.then(() => deliver(build())).catch((e) => bubble("Ошибка стенда: " + esc(e.message)));
      return queue;
    }
    async function deliver(update) {
      const res = await CH.handle(p.ch, update, { sessions, ctx });
      if (res.kind !== "message") return;
      // Яндекс возвращает в state.session ровно то, что навык отдал в session_state.
      if (p.ch === "alice") { alice = res.calls[0].body.session_state; sessions.set("alice-state:" + p.chatId, alice); }
      remember({ calls: res.calls });
      draw(res.calls);
      showRaw(update, res.calls);
    }

    function restore() {
      feed.innerHTML = "";
      const h = sessions.get(histKey) || [];
      if (!h.length) return send(() => updates[p.ch].start(p));
      for (const e of h) e.me ? bubble(esc(e.me), true) : draw(e.calls);
    }

    el.querySelector(".composer").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = el.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      send(() => updates[p.ch].text(p, text, alice), text);
    });
    el.querySelector("[data-reset]").addEventListener("click", () => {
      const all = readSess();
      Object.keys(all).filter((k) => k.endsWith(":" + p.chatId) || k === histKey).forEach((k) => delete all[k]);
      writeSess(all);
      alice = undefined;
      restore();
    });

    restore();
  });
})();
