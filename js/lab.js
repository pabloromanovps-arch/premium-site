(function () {
  const { sim: SimLib, simInstance: sim, store: S, scenarios, validate } = Flora;
  const store = S.appStore();
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clockFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Moscow" });
  const logFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Moscow" });

  // ---------- время ----------
  function renderClock() {
    const shifted = sim.settings().offsetMs !== 0;
    $("now").innerHTML = `${esc(clockFmt.format(sim.now()))} <small>по Москве${shifted ? ", часы переведены" : ", реальное время"}</small>`;
  }
  function setMsk(date, time) {
    sim.setTime(`${date}T${time}:00+03:00`);
    renderAll();
  }
  $("t-date").value = validate.moscowNow(sim.now()).date;
  $("t-clock").value = "20:30";
  $("t-set").addEventListener("click", () => {
    if (!$("t-date").value || !$("t-clock").value) return;
    setMsk($("t-date").value, $("t-clock").value);
  });
  document.querySelectorAll("[data-time]").forEach((b) => b.addEventListener("click", () => setMsk(validate.moscowNow(sim.now()).date, b.dataset.time)));
  $("t-reset").addEventListener("click", () => { sim.resetTime(); renderAll(); });

  // ---------- сбои ----------
  function renderFailures() {
    const s = sim.settings();
    $("f-tg").checked = s.tgDown;
    $("f-crm").checked = s.crmDown;
    $("f-latency").value = String(s.latencyMs);
  }
  $("f-tg").addEventListener("change", (e) => sim.setSettings({ tgDown: e.target.checked }));
  $("f-crm").addEventListener("change", (e) => sim.setSettings({ crmDown: e.target.checked }));
  $("f-latency").addEventListener("change", (e) => sim.setSettings({ latencyMs: Number(e.target.value) }));

  // ---------- автопрогон ----------
  const results = {};
  function renderRuns() {
    $("runs").innerHTML = scenarios.SCENARIOS.map((sc) => {
      const r = results[sc.id];
      const verdict = !r ? `<span class="verdict" aria-label="не запускался">—</span>` : r === "running" ? `<span class="verdict" aria-label="идёт">…</span>`
        : `<span class="verdict ${r.ok ? "ok" : "bad"}" aria-label="${r.ok ? "пройден" : "провален"}">${r.ok ? "✓" : "✕"}</span>`;
      const checks = r && r !== "running"
        ? `<ul class="checks">${r.checks.map((c) => `<li class="${c.ok ? "" : "bad"}">${c.ok ? "✓" : "✕"} ${esc(c.name)}${c.detail ? `<span class="detail">${esc(c.detail)}</span>` : ""}</li>`).join("")}</ul>`
        : "";
      return `<li class="run" data-scenario="${sc.id}">
        <div class="run-head">${verdict}<div><h3>${esc(sc.title)}</h3><p>${esc(sc.about)}</p></div>
        <button class="btn btn-quiet btn-small" type="button" data-run="${sc.id}">Запустить</button></div>${checks}</li>`;
    }).join("");
  }
  async function runOne(id) {
    const sc = scenarios.SCENARIOS.find((s) => s.id === id);
    results[id] = "running";
    renderRuns();
    results[id] = await scenarios.run(sc, { store, sim });
    renderRuns();
    renderLog();
    return results[id];
  }
  $("runs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-run]");
    if (b) runOne(b.dataset.run);
  });
  $("run-all").addEventListener("click", async () => {
    $("run-all").disabled = true;
    $("run-status").textContent = "Идёт прогон…";
    let ok = 0;
    for (const sc of scenarios.SCENARIOS) if ((await runOne(sc.id)).ok) ok++;
    const total = scenarios.SCENARIOS.length;
    $("run-status").innerHTML = `<span class="summary">${ok === total ? `Все ${total} сценариев пройдены` : `Пройдено ${ok} из ${total}`}</span>`;
    $("run-all").disabled = false;
  });

  $("purge").addEventListener("click", () => {
    const n = store.purge((r) => r.customer.name.startsWith(scenarios.PREFIX));
    $("run-status").textContent = n ? `Удалено тестовых заявок: ${n}` : "Тестовых заявок нет";
  });

  // ---------- журнал ----------
  let tab = "";
  $("tabs").innerHTML = [["", "Всё"], ...Object.entries(SimLib.CHANNELS)].map(([v, l]) => `<button type="button" data-tab="${v}" aria-pressed="${v === tab}">${l}</button>`).join("");
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    tab = b.dataset.tab;
    $("tabs").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tab === tab)));
    renderLog();
  });
  function linkify(text) {
    return esc(text).replace(/pay\.html#[^\s]+/g, (m) => `<a href="${m}" target="_blank" rel="noopener">${decodeURIComponent(m)}</a>`);
  }
  function renderLog() {
    const items = sim.outbox.list(tab).slice(0, 150);
    $("log").innerHTML = items.length
      ? items.map((e) => `<li data-ch="${e.channel}"><span class="meta">${esc(SimLib.CHANNELS[e.channel] || e.channel)}, ${logFmt.format(new Date(e.at))}${e.ref ? `, ${esc(e.ref)}` : ""}${e.to ? `, на ${esc(validate.formatPhone(e.to))}` : ""}</span><pre>${linkify(e.text)}</pre></li>`).join("")
      : `<li class="empty-log">Пока ничего. Оформите заказ в магазине или в мессенджере — сообщения появятся здесь.</li>`;
  }
  $("log-clear").addEventListener("click", () => { sim.outbox.clear(); renderLog(); });
  $("reset-all").addEventListener("click", () => {
    if (!confirm("Сбросить стенд: удалить заявки, журнал, корзину, диалоги в мессенджерах и настройки?")) return;
    store.reset();
    sim.resetAll();
    try {
      ["stebel.cart.v1", "stebel.chsess.v1"].forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* хранилище недоступно */ }
    Object.keys(results).forEach((k) => delete results[k]);
    renderAll();
  });

  function renderAll() {
    renderClock();
    renderFailures();
    renderRuns();
    renderLog();
  }
  addEventListener("storage", (e) => {
    if (e.key === SimLib.OUTBOX_KEY || e.key === null) renderLog();
    if (e.key === SimLib.SETTINGS_KEY) { renderFailures(); renderClock(); }
  });
  setInterval(renderClock, 1000);
  renderAll();
})();
