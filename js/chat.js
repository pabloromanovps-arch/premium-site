(function () {
  const { bot, store: storeMod } = Flora;
  const store = storeMod.appStore();
  const $ = (id) => document.getElementById(id);
  const ctx = { now: () => new Date(), create: (input) => store.create(input), lookup: (id) => store.get(id) };

  const panel = $("chat-panel");
  const launch = $("chat-open");
  const log = $("chat-log");
  const options = $("chat-options");
  const input = $("chat-text");
  let state = null;

  function say(who, text) {
    const li = document.createElement("li");
    li.className = who;
    li.textContent = text;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
  }

  function apply(result) {
    state = result.state;
    let opts = [];
    for (const msg of result.messages) {
      say("bot", msg.text);
      if (msg.options) opts = msg.options;
    }
    options.innerHTML = "";
    for (const o of opts) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = o.label;
      b.dataset.value = o.value;
      options.appendChild(b);
    }
  }

  function send(text, value) {
    say("me", text);
    apply(bot.reply(state, { text, value }, ctx));
  }

  function open() {
    panel.hidden = false;
    launch.setAttribute("aria-expanded", "true");
    if (!state) apply(bot.start());
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
