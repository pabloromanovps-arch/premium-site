// Страница аналитики: фильтры, показатели, графики, рекомендации.
(function () {
  const A = Flora.analytics;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const NOW = new Date();
  const rub = A.rub, pct = A.pct;
  const num = (n) => Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ");
  const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", ",") + " млн" : n >= 1e4 ? Math.round(n / 1e3) + " тыс" : num(n));

  const METRICS = {
    revenue: { name: "Выручка", fmt: rub, axis: (v) => short(v) + " ₽" },
    orders: { name: "Заказы", fmt: num, axis: short },
    leads: { name: "Обращения", fmt: num, axis: short },
    conversion: { name: "Конверсия", fmt: pct, axis: pct },
  };
  const ui = { view: "month", metric: "revenue", compare: "prev", source: "demo", anchor: new Date(NOW) };
  try { Object.assign(ui, JSON.parse(localStorage.getItem("stebel.analytics.ui") || "{}"), { anchor: new Date(NOW) }); } catch (e) { /* без сохранения */ }
  const remember = () => { try { localStorage.setItem("stebel.analytics.ui", JSON.stringify({ view: ui.view, metric: ui.metric, compare: ui.compare, source: ui.source })); } catch (e) { /* ничего */ } };

  let demo = null;
  function rows() {
    if (ui.source === "demo") return demo || (demo = A.demoHistory({ now: NOW, seed: 7 }));
    const prof = Flora.profile ? Flora.profile.get() : {};
    const prices = Object.fromEntries((prof.addons || []).map((a) => [a.id, a.price]));
    return Flora.store.appStore().list().map((r) => A.normalize(r, prices));
  }

  // ---------- подсказка ----------
  const tip = $("tip");
  function showTip(e, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }
  const hideTip = () => { tip.hidden = true; };

  // ---------- столбики: текущий период и пунктир прошлого ----------
  // Верх шкалы — четыре «круглых» деления: 0, 5, 10, 15, 20 или 0, 25 тыс, 50 тыс…
  function niceMax(v, integer) {
    if (v <= 0) return 4;
    const raw = v / 4;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    let step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((k) => k * p).find((x) => x >= raw);
    if (integer) step = Math.max(1, Math.ceil(step));
    return step * 4;
  }
  function bars(el, data, { axis, tipRows, night = false, height = 240, onlyCur = false, integer = false }) {
    const W = Math.max(280, el.clientWidth || 600), H = height, L = 52, R = 6, T = 8, B = 22;
    const top = Math.max(0, ...data.map((d) => Math.max(d.value, onlyCur ? 0 : d.prev || 0)));
    const max = niceMax(top * 1.02, integer);
    const step = (W - L - R) / data.length;
    const bw = Math.max(2, Math.min(36, step * 0.64));
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const every = Math.ceil(data.length / Math.floor((W - L) / 34));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(el.getAttribute("aria-label") || "")}">`;
    if (night) data.forEach((d, i) => { if (i < 9 || i >= 21) s += `<rect class="night" x="${L + i * step}" y="${T}" width="${step}" height="${H - T - B}"/>`; });
    s += `<g class="grid">`;
    for (let k = 0; k <= 4; k++) { const v = (max * k) / 4, yy = y(v); s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${esc(axis(v))}</text>`; }
    s += `</g>`;
    data.forEach((d, i) => {
      const x = L + i * step + (step - bw) / 2, top = y(d.value), h = H - B - top;
      if (d.value > 0) {
        const r = Math.min(4, bw / 2, h);
        s += `<path class="bar" data-i="${i}" d="M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - B} Z"/>`;
      }
      if (i % every === 0) s += `<text x="${L + i * step + step / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
    });
    if (!onlyCur) {
      const pts = data.map((d, i) => `${L + i * step + step / 2},${y(d.prev || 0)}`).join(" ");
      s += `<polyline class="prev" points="${pts}"/>`;
    }
    data.forEach((d, i) => { s += `<rect class="hit" data-i="${i}" x="${L + i * step}" y="${T}" width="${step}" height="${H - T - B}"/>`; });
    el.innerHTML = s + "</svg>";
    const svg = el.querySelector("svg");
    svg.addEventListener("mousemove", (e) => {
      const hit = e.target.closest(".hit");
      svg.querySelectorAll(".bar.on").forEach((b) => b.classList.remove("on"));
      if (!hit) return hideTip();
      const i = +hit.dataset.i;
      const b = svg.querySelector(`.bar[data-i="${i}"]`);
      if (b) b.classList.add("on");
      showTip(e, tipRows(data[i]));
    });
    svg.addEventListener("mouseleave", () => { hideTip(); svg.querySelectorAll(".bar.on").forEach((b) => b.classList.remove("on")); });
  }

  // ---------- отрисовка ----------
  const deltaHtml = (d, inverse = false) => {
    if (d == null) return `<span>нового нет в прошлом периоде</span>`;
    if (Math.abs(d) < 0.005) return "без изменений";
    const good = inverse ? d < 0 : d > 0;
    return `<span class="${good ? "up" : "down"}">${d > 0 ? "▲" : "▼"} ${Math.round(Math.abs(d) * 100)}%</span>`;
  };

  function render() {
    remember();
    const all = rows();
    const rep = A.report(all, { view: ui.view, anchor: ui.anchor, compare: ui.compare, now: NOW });
    const T = rep.totals, P = rep.prev, D = rep.deltas;
    document.querySelectorAll("#view button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.view === ui.view)));
    document.querySelectorAll("#metric button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.metric === ui.metric)));
    $("compare").value = ui.compare;
    $("source").value = ui.source;
    $("compare").options[1].disabled = ui.view === "year";
    $("period-title").textContent = rep.period.title;
    $("next").disabled = rep.period.to > NOW;
    $("source-note").textContent = ui.source === "demo"
      ? "Демо: два года работы цветочного магазина с сезонностью (14 февраля, 8 марта, 1 сентября, День матери, Новый год). Агент запущен 9 месяцев назад — видно, как менялись конверсия, ночные заказы и допродажи."
      : `Заявки стенда: ${all.length} записей из CRM — из чата, мессенджеров, автопилота и пульта.`;

    const vs = (rep.partial ? "за то же время, " : "") + `к ${ui.compare === "year" && ui.view !== "year" ? "прошлому году" : { day: "предыдущему дню", month: "прошлому месяцу", year: "прошлому году" }[ui.view]}`;
    const tiles = [
      ["Выручка", rub(T.revenue), D.revenue],
      ["Заказы", num(T.orders), D.orders],
      ["Обращения", num(T.leads), D.leads],
      ["Конверсия в заказ", pct(T.conversion), D.conversion],
      ["Средний чек", rub(T.avgCheck), D.avgCheck],
      ["Заказы без менеджера", pct(T.autoShare), D.autoShare],
      ["Заказы ночью", num(T.nightOrders), D.nightOrders],
      ["Допродажи", rub(T.upsell), D.upsell],
    ];
    $("kpis").innerHTML = tiles.map(([n, v, d]) => `<div class="kpi"><span>${n}</span><b>${v}</b><small>${deltaHtml(d)} ${vs}</small></div>`).join("");

    const M = METRICS[ui.metric];
    $("legend").innerHTML = `<span><i></i>${esc(rep.period.title)}</span><span><i class="line"></i>${esc(rep.prevPeriod.title)}</span>`;
    const data = rep.series.map((b) => ({ label: b.label, title: b.title, value: b.cur[ui.metric], prev: b.prev[ui.metric], cur: b.cur }));
    const chart = $("chart");
    chart.setAttribute("aria-label", `${M.name}: ${rep.period.title} и ${rep.prevPeriod.title}`);
    bars(chart, data, {
      axis: M.axis, integer: ui.metric === "orders" || ui.metric === "leads", night: ui.view === "day",
      tipRows: (d) => `<b>${esc(d.title)}</b><div><span>${M.name}</span>${M.fmt(d.value)}</div><div><span>${esc(rep.prevPeriod.title)}</span>${M.fmt(d.prev || 0)}</div><div><span>Заказы / обращения</span>${num(d.cur.orders)} / ${num(d.cur.leads)}</div>`,
    });
    $("main-table").innerHTML = `<table><thead><tr><th>${ui.view === "day" ? "Час" : ui.view === "month" ? "День" : "Месяц"}</th><th>Обращения</th><th>Заказы</th><th>Конверсия</th><th>Выручка</th><th>${esc(rep.prevPeriod.title)}: выручка</th></tr></thead><tbody>${rep.series.map((b) => `<tr><td>${esc(b.title)}</td><td>${num(b.cur.leads)}</td><td>${num(b.cur.orders)}</td><td>${pct(b.cur.conversion)}</td><td>${rub(b.cur.revenue)}</td><td>${rub(b.prev.revenue)}</td></tr>`).join("")}</tbody></table>`;

    $("insights").innerHTML = A.insights(rep, all, { now: NOW }).map((i) => `<li class="${i.kind}"><b>${esc(i.title)}</b>${esc(i.text)}</li>`).join("");

    const maxCh = Math.max(1, ...rep.channels.map((c) => c.revenue));
    $("channels").innerHTML = rep.channels.length ? `<table class="ch-table"><thead><tr><th>Канал</th><th>Обращения</th><th>Заказы</th><th>Конверсия</th><th>Выручка</th></tr></thead><tbody>${rep.channels.map((c) => {
      const before = rep.prevChannels.find((p) => p.ch === c.ch);
      return `<tr><td>${esc(c.name)}<span class="ch-bar" style="width:${Math.max(2, (c.revenue / maxCh) * 100)}%"></span></td><td>${num(c.leads)}</td><td>${num(c.orders)}</td><td>${pct(c.conversion)}</td><td>${rub(c.revenue)}<br><small>${before && before.revenue ? deltaHtml((c.revenue - before.revenue) / before.revenue) : ""}</small></td></tr>`;
    }).join("")}</tbody></table>` : `<p class="sub">Нет обращений за период.</p>`;

    const hours = $("hours");
    hours.setAttribute("aria-label", "Обращения по часам");
    bars(hours, rep.hours.map((n, h) => ({ label: String(h), title: `${h}:00–${h + 1}:00`, value: n })), {
      axis: short, integer: true, night: true, height: 180, onlyCur: true,
      tipRows: (d) => `<b>${esc(d.title)}</b><div><span>Обращения</span>${num(d.value)}</div>`,
    });

    const agent = [
      [num(T.nightLeads), "обращений ночью, когда магазин закрыт"],
      [rub(T.nightRevenue), "выручка с ночных заказов"],
      [num(T.rescued), `заказов спас агент (${rub(T.rescuedRevenue)})`],
      [pct(T.offerRate), `допродаж принято (${num(T.accepted)} из ${num(T.offered)})`],
      [num(T.reviews), "просьб об отзыве после доставки"],
      [pct(T.cancelRate), "отмен заказов"],
      [num(T.callbacks), "просьб перезвонить"],
      [num(T.lost), "разговоров без заказа — материал для разбора"],
    ];
    $("agent").innerHTML = agent.map(([v, t]) => `<div><b>${v}</b><span>${t}</span></div>`).join("");
    void P;
  }

  $("view").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; ui.view = b.dataset.view; if (ui.view === "year") ui.compare = "prev"; ui.anchor = new Date(NOW); render(); });
  $("metric").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; ui.metric = b.dataset.metric; render(); });
  $("compare").addEventListener("change", (e) => { ui.compare = e.target.value; render(); });
  $("source").addEventListener("change", (e) => { ui.source = e.target.value; ui.anchor = new Date(NOW); render(); });
  const move = (n) => {
    const a = ui.anchor;
    ui.anchor = ui.view === "day" ? new Date(a.getFullYear(), a.getMonth(), a.getDate() + n) : ui.view === "month" ? new Date(a.getFullYear(), a.getMonth() + n, 1) : new Date(a.getFullYear() + n, 0, 1);
    render();
  };
  $("prev").addEventListener("click", () => move(-1));
  $("next").addEventListener("click", () => move(1));
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });
  // Заявки стенда меняются в других вкладках — пересчитываем.
  addEventListener("storage", (e) => { if (ui.source === "crm" && e.key && e.key.startsWith("stebel.crm")) render(); });
  render();
})();
