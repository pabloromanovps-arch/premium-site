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
  const sim = Flora.simInstance;

  const PHONES = [
    { ch: "telegram", title: "Стебель — цветы", sub: "бот в Telegram", ava: "С", chatId: 555001 },
    { ch: "vk", title: "Стебель | Цветы Москва", sub: "сообщество ВКонтакте", ava: "С", chatId: 2000000001 },
    { ch: "max", title: "Стебель", sub: "бот в MAX", ava: "С", chatId: 9001 },
    { ch: "alice", title: "Навык «Стебель»", sub: "Алиса, Яндекс", ava: "А", chatId: "alice-session-1" },
  ];

  // Вторая сторона переписки: что получают менеджер и клиент.
  const SIDES = [
    { ch: "manager", title: "Стебель: заявки", sub: "Telegram менеджера", ava: "М", note: "Сюда приходит каждая новая заявка с сайта и из мессенджеров." },
    { ch: "sms", title: "Сообщения", sub: "телефон клиента", ava: "✉", note: "SMS, которые получает клиент: заказ принят, ссылка на оплату, курьер в пути." },
  ];
  const ALL = [...PHONES.map((p) => ({ ch: p.ch, label: CH.NAMES[p.ch] })), { ch: "manager", label: "Менеджер" }, { ch: "sms", label: "Клиент: SMS" }];
  $("phone-tabs").innerHTML = ALL.map((x) => `<button type="button" data-show="${x.ch}">${x.label}</button>`).join("");

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
    </section>`).join("") + SIDES.map((p) => `
    <section class="phone side" data-ch="${p.ch}" aria-label="${p.sub}">
      <div class="phone-head"><span class="ava" aria-hidden="true">${p.ava}</span><div><h2>${p.title}</h2><p>${p.sub}</p></div></div>
      <div class="feed" aria-live="polite"></div>
      <p class="side-note">${p.note}</p>
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
    // Заявка из чата уносит с собой переписку — менеджер увидит её в CRM.
    const paneCtx = {
      now,
      lookup: (id) => store.get(id),
      create: (i) => store.create({ ...i, dialog: transcript() }),
    };
    function transcript() {
      const out = [];
      for (const e of sessions.get(histKey) || []) {
        if (e.me) out.push({ from: "client", text: e.me });
        else for (const c of e.calls || []) {
          if (/answer/i.test(c.method)) continue;
          out.push({ from: "bot", text: p.ch === "alice" ? c.body.response.text : textOf(p.ch, c) });
        }
      }
      return out.slice(-20);
    }
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
      const res = await CH.handle(p.ch, update, { sessions, ctx: paneCtx });
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

  // ---------- менеджер и клиент ----------
  const fmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  let lastSides = "";
  function renderSides() {
    if (!sim) return;
    const tg = sim.outbox.list("telegram").slice(0, 60).reverse();
    const sms = sim.outbox.list("sms").slice(0, 60).reverse();
    const sig = tg.map((e) => e.n).join() + "|" + sms.map((e) => e.n).join();
    if (sig === lastSides) return;
    lastSides = sig;
    const mgr = document.querySelector('.phone[data-ch="manager"] .feed');
    mgr.innerHTML = tg.length
      ? tg.map((e) => `<div class="bubble">${esc(e.text)}<span class="time">${fmt.format(new Date(e.at))}</span>${e.ref ? `<a class="open-crm" href="crm.html#${encodeURIComponent(e.ref)}">Открыть ${esc(e.ref)} в CRM</a>` : ""}</div>`).join("")
      : `<p class="side-empty">Заявок пока нет. Оформите заказ в любом окне слева или на сайте.</p>`;
    mgr.scrollTop = mgr.scrollHeight;
    const box = document.querySelector('.phone[data-ch="sms"] .feed');
    box.innerHTML = sms.length
      ? sms.map((e) => `<div class="bubble"><span class="to">на ${esc(Flora.validate.formatPhone(e.to))}</span>${esc(e.text).replace(/pay\.html#[^\s]+/g, (m) => `<a href="${m}">${decodeURIComponent(m)}</a>`)}<span class="time">${fmt.format(new Date(e.at))}</span></div>`).join("")
      : `<p class="side-empty">SMS появятся, когда клиент оформит заказ, а менеджер подтвердит его в CRM.</p>`;
    box.scrollTop = box.scrollHeight;
  }
  renderSides();
  setInterval(renderSides, 1000);

  // ---------- на телефоне: одно окно на весь экран ----------
  function show(ch) {
    if (!ALL.some((x) => x.ch === ch)) ch = "telegram";
    document.querySelectorAll(".phone").forEach((el) => el.classList.toggle("active", el.dataset.ch === ch));
    document.querySelectorAll("#phone-tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.show === ch)));
  }
  $("phone-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-show]");
    if (!b) return;
    show(b.dataset.show);
    history.replaceState(null, "", "#" + b.dataset.show);
  });
  show(decodeURIComponent(location.hash.slice(1)));
})();
