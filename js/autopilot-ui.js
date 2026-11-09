(function () {
  const { autopilot: AP, store: S, cart, channels: CH } = Flora;
  const sim = Flora.simInstance;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clockFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  const DAY_MIN = 24 * 60;

  let mode = "normal";
  let speed = 600; // виртуальных секунд в реальную
  let ap = null;
  let timer = null;
  let busy = false;

  // ---------- выбор ситуации и скорости ----------
  $("modes").innerHTML = Object.entries(AP.MODES).map(([k, m]) => `<button type="button" role="radio" data-mode="${k}" aria-checked="${k === mode}"><b>${m.title}</b><span>${m.about}</span></button>`).join("");
  $("modes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b || ap) return;
    mode = b.dataset.mode;
    $("modes").querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x.dataset.mode === mode)));
  });
  document.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));

  // ---------- запуск ----------
  function start() {
    if (!ap) {
      const storage = S.safeStorage();
      if ($("fresh").checked) {
        S.createStore({ storage }).reset();
        if (sim) sim.outbox.clear();
      }
      ap = AP.create({ mode, seed: Math.floor(Math.random() * 1e9), storage, sim });
      $("modes").querySelectorAll("button").forEach((x) => (x.disabled = x.dataset.mode !== mode));
      $("summary").hidden = true;
    }
    $("start").disabled = true;
    $("pause").disabled = false;
    timer = setInterval(tick, 250);
  }
  function pause() {
    clearInterval(timer);
    timer = null;
    $("start").disabled = false;
    $("start").textContent = "Продолжить";
    $("pause").disabled = true;
  }
  function reset() {
    pause();
    ap = null;
    if (sim) sim.setSettings({ tgDown: false });
    $("start").textContent = "Запустить";
    $("modes").querySelectorAll("button").forEach((x) => (x.disabled = false));
    $("clock").textContent = "Симуляция не запущена";
    $("summary").hidden = true;
    render();
  }
  async function tick() {
    if (busy || !ap) return;
    busy = true;
    try {
      const left = DAY_MIN - ap.snapshot().elapsedMin;
      await ap.run(Math.min(left, (speed * 0.25) / 60));
      render();
      if (ap.snapshot().elapsedMin >= DAY_MIN) finish();
    } finally {
      busy = false;
    }
  }
  function finish() {
    pause();
    $("start").disabled = true;
    if (sim) sim.setSettings({ tgDown: false });
    const s = ap.snapshot();
    const saved = s.stats.autoConfirmed + s.stats.paidAfterReminder + s.stats.rescuedDialogs;
    $("summary").hidden = false;
    $("summary").textContent = `Сутки прошли. Написали ${s.stats.clients} покупателей, оформлено ${s.stats.orders} заказов на ${cart.formatRub(s.stats.revenue)} оплаченных. ИИ-агент спас ${saved} ${plural(saved, "заказ", "заказа", "заказов")}, которые без него могли остыть. Нажмите «Сбросить», чтобы попробовать другую ситуацию.`;
  }
  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

  $("start").addEventListener("click", start);
  $("pause").addEventListener("click", pause);
  $("reset").addEventListener("click", reset);

  // ---------- отрисовка ----------
  const CH_NAME = (ch) => (ch === "chat" ? "Чат на сайте" : CH.NAMES[ch] || ch);
  const COLS = [["new", "Новые", "#c92a62"], ["confirmed", "Подтверждены", "#1f4f9b"], ["assembling", "Собираются", "#b07a00"], ["out", "В доставке и к выдаче", "#11626a"], ["done", "Выполнены", "#2f5d3a"]];

  function render() {
    if (!ap) {
      ["k-clients", "k-orders", "k-saved", "k-night"].forEach((id) => ($(id).textContent = "0"));
      $("k-revenue").textContent = "0 ₽";
      $("chats").innerHTML = `<p class="empty-log">Здесь появятся переписки покупателей с ботом.</p>`;
      $("funnel").innerHTML = COLS.map(([, t, c]) => `<li style="--c:${c}">${t} <b>0</b></li>`).join("");
      $("agent-sum").innerHTML = "";
      $("feed").innerHTML = "";
      return;
    }
    const s = ap.snapshot();
    const st = s.stats;
    const elapsed = Math.min(DAY_MIN, s.elapsedMin);
    $("clock").innerHTML = `${esc(clockFmt.format(s.now))} <small>по Москве, ${ap.MODE.title.toLowerCase()}, прошло ${Math.floor(elapsed / 60)} ч ${Math.round(elapsed % 60)} мин из суток</small>`;
    $("k-clients").textContent = st.clients;
    $("k-orders").textContent = st.orders;
    $("k-orders-l").textContent = `заказов оформлено, из них ${st.orders - st.siteOrders} — в чатах с ботом, без менеджера`;
    $("k-revenue").textContent = cart.formatRub(st.revenue);
    $("k-saved").textContent = st.autoConfirmed + st.paidAfterReminder + st.rescuedDialogs;
    $("k-night").textContent = st.night;

    $("funnel").innerHTML = COLS.map(([k, t, c]) => `<li style="--c:${c}">${t} <b>${s.funnel[k]}</b></li>`).join("");
    const a = s.agent;
    $("agent-sum").innerHTML = [
      [a.night, "ночным заявкам сообщил, когда перезвонят"],
      [a.pinged, "раз напомнил менеджеру о заявке без ответа"],
      [a.autoConfirmed, "заказов подтвердил сам, когда менеджер не успел"],
      [a.payReminders, `напоминаний об оплате, после них оплатили ${a.paidAfterReminder}`],
      [st.followUps, `напоминаний бросившим разговор, вернулись ${st.returned}, оформили ${st.rescuedDialogs}`],
      [a.reviews, "раз попросил оценку после доставки"],
    ].map(([n, t]) => `<li><b>${n}</b> ${t}</li>`).join("");

    const live = ap.convs.filter((c) => c.log.length).slice().sort((x, y) => y.lastAt - x.lastAt).slice(0, 4);
    $("chats").innerHTML = live.map((c) => `
      <article class="mini" data-ch="${c.channel}" aria-label="Разговор в ${esc(CH_NAME(c.channel))}">
        <div class="mini-head">${esc(CH_NAME(c.channel))}<span>${esc(c.name)}${c.status === "waiting" ? " — не отвечает" : c.status === "lost" ? " — ушёл" : c.status === "done" ? " — заказ оформлен" : ""}</span></div>
        <ol>${c.log.slice(-8).map((m) => `<li class="${m.from}">${m.from === "agent" ? "ИИ-агент: " : ""}${esc(m.text.length > 280 ? m.text.slice(0, 280) + "…" : m.text)}${m.options && m.options.length && c.channel !== "avito" ? `<span class="opts">[${esc(m.options.slice(0, 4).join("] ["))}]</span>` : ""}</li>`).join("")}</ol>
      </article>`).join("") || `<p class="empty-log">Ждём первого покупателя…</p>`;
    document.querySelectorAll(".mini ol").forEach((ol) => (ol.scrollTop = ol.scrollHeight));

    $("feed").innerHTML = ap.events.slice(-40).reverse().map((e) => `<li data-type="${e.type}"><time>${timeFmt.format(new Date(e.at))}</time>${esc(e.text)}</li>`).join("");
  }

  render();
})();
