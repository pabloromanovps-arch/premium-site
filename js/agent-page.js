(function () {
  const { bot, store: S, cart } = Flora;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- живые примеры: разговоры с настоящим ботом стенда ----------
  // Время — 14:00 завтрашнего дня по Москве, чтобы примеры не зависели от того, когда открыли страницу.
  const day = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const now = () => new Date(`${day}T14:00:00+03:00`);
  const store = S.createStore({ storage: S.memoryStorage(), now });
  const ctx = (source) => ({ now, source, create: (i) => store.create(i), lookup: (id) => store.get(id) });
  const firstLines = (text, n = 4) => text.split("\n").slice(0, n).join("\n");
  const said = (r) => r.messages.map((m) => m.text + (m.cards ? "\n" + m.cards.map((c) => `• ${c.name} — ${cart.formatRub(c.price)}`).join("\n") : "")).join("\n");

  function conversation(title, source, steps, start) {
    const c = ctx(source);
    let r = start ? start(c) : bot.start();
    const out = [];
    if (start) out.push(["b", firstLines(said(r))]);
    for (const s of steps) {
      r = bot.reply(r.state, typeof s === "string" ? { text: s } : s, c);
      out.push(["c", typeof s === "string" ? s : s.text]);
      out.push(["b", firstLines(said(r))]);
    }
    return `<article class="talk"><span class="ch">${esc(title)}</span>${out.map(([w, t]) => `<p class="${w}">${esc(t)}</p>`).join("")}</article>`;
  }

  $("talks").innerHTML = [
    conversation("Авито, по объявлению «Бордо»", "avito", ["Здравствуйте, ещё актуально?"], (c) => bot.startWithProduct("bordo", c)),
    conversation("Telegram", "telegram", ["пионы маме на завтра вечером до 5000", "а фото пришлёте перед доставкой?"]),
    conversation("Сайт", "chat", ["нужно 30 букетов на корпоратив"]),
  ].join("");

  // ---------- калькулятор ----------
  const form = $("calc");
  const n = (name) => Math.max(0, Number(form.elements[name].value) || 0);
  const pct = (name) => Math.min(100, n(name)) / 100;
  function calc() {
    const leads = n("leads");
    const check = n("check");
    const lostNow = leads * pct("late") * pct("lost");
    const saved = lostNow * pct("save");
    const unpaidBack = leads * (1 - pct("late") * pct("lost")) * pct("unpaid") * pct("back");
    const orders = saved + unpaidBack;
    const hours = (leads * n("minutes") * pct("auto")) / 60;
    $("c-orders").textContent = Math.round(orders);
    $("c-money").textContent = cart.formatRub(Math.round((orders * check) / 100) * 100);
    $("c-hours").textContent = `${Math.round(hours)} ч`;
    $("c-formula").textContent =
      `Как считаем: сейчас теряется ${Math.round(lostNow)} заявок в месяц (${leads} × ${n("late")}% × ${n("lost")}%), агент сохраняет ${n("save")}% из них — ${Math.round(saved)} заказов. ` +
      `Ещё ${Math.round(unpaidBack)} заказов возвращаются после напоминаний об оплате. Время: ${leads} заявок × ${n("minutes")} мин × ${n("auto")}% рутины.`;
  }
  form.addEventListener("input", calc);
  calc();
})();
