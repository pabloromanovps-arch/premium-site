(function () {
  const { bot, store: storeMod, flowers, catalog, cart } = Flora;
  const store = storeMod.appStore();
  const goal = (g, params) => Flora.metrika && Flora.metrika.reachGoal(g, params);
  const $ = (id) => document.getElementById(id);
  const ctx = {
    now: () => (Flora.clock ? Flora.clock() : new Date()),
    create(input) {
      const rec = store.create({ ...input, dialog: transcript.slice(-20) });
      goal(rec.kind === "order" ? "chat_order" : "callback_request", { order_id: rec.id });
      return rec;
    },
    lookup: (id) => store.get(id),
  };
  const transcript = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const panel = $("chat-panel");
  const launch = $("chat-open");
  const log = $("chat-log");
  const options = $("chat-options");
  const input = $("chat-text");
  let state = null;
  let started = false;
  // Ответы показываются строго по очереди, даже если клиент пишет, пока бот «печатает».
  let queue = Promise.resolve();
  const enqueue = (fn) => (queue = queue.then(fn, fn));

  function add(el) {
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }
  function say(who, text) {
    transcript.push({ from: who === "me" ? "client" : "bot", text });
    const li = document.createElement("li");
    li.className = who;
    li.textContent = text;
    add(li);
  }
  // Букеты в чате на сайте — карточками с картинкой.
  function cards(list) {
    const li = document.createElement("li");
    li.className = "chat-cards-wrap";
    li.innerHTML = `<ul class="chat-cards">${list.map((c) => `<li>${flowers.bouquetSVG(catalog.byId(c.id))}<div><b>${c.name}, ${cart.formatRub(c.price)}</b><span>${c.composition}</span></div></li>`).join("")}</ul>`;
    add(li);
  }

  function showOptions(opts) {
    options.innerHTML = "";
    for (const o of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = o.label;
      b.dataset.value = o.value;
      options.appendChild(b);
    }
  }

  // Короткая пауза «печатает…», чтобы ответ не появлялся мгновенно, как у робота.
  async function apply(result) {
    state = result.state;
    let opts = [];
    options.innerHTML = "";
    for (const msg of result.messages) {
      if (!reduced) {
        const t = document.createElement("li");
        t.className = "bot typing";
        t.textContent = "печатает…";
        add(t);
        await new Promise((r) => setTimeout(r, Math.min(900, 250 + msg.text.length * 6)));
        t.remove();
      }
      if (msg.text) say("bot", msg.text);
      if (msg.cards) cards(msg.cards);
      if (msg.options) opts = msg.options;
    }
    showOptions(opts);
  }

  function send(text, value) {
    say("me", text);
    options.innerHTML = "";
    enqueue(() => apply(bot.reply(state, { text, value }, ctx)));
  }

  function open() {
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    if (!started) {
      started = true;
      goal("chat_open");
      enqueue(() => apply(bot.start()));
    }
    input.focus();
  }
  function close() {
    panel.hidden = true;
    launch.setAttribute("aria-expanded", "false");
    launch.focus();
  }

  launch.addEventListener("click", open);
  $("chat-close").addEventListener("click", close);
  document.querySelectorAll("[data-open-chat]").forEach((b) => b.addEventListener("click", open));
  options.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) send(b.textContent, b.dataset.value);
  });
  $("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    send(text);
  });
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();
