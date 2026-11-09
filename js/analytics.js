// Аналитика агента: заявки, заказы, выручка, каналы, ночь, допродажи, работа агента.
// Источник — записи CRM (normalize) или демо-история за два года с сезонностью (demoHistory).
// Всё считается здесь, страница analytics.html только рисует.
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).analytics = mod;
})(typeof self !== "undefined" ? self : this, function () {
  const CHANNELS = { avito: "Авито", telegram: "Telegram", chat: "Чат на сайте", site: "Сайт", vk: "ВКонтакте", max: "MAX", alice: "Алиса", crm: "CRM" };
  const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const DAY = 86400000;
  const isNight = (h) => h < 9 || h >= 21;

  // ---------- записи CRM → строки аналитики ----------
  // row: { t, ch, kind: order|callback|dialog, sum, cancelled, done, paid, auto, night, rescued, review, offers, accepted, upsell }
  function normalize(rec, addonPrices = {}) {
    const t = Date.parse(rec.createdAt);
    const hist = rec.history || [];
    const statusBy = hist.filter((h) => h.type === "status" && h.status !== "new");
    const agent = hist.filter((h) => h.type === "agent");
    const offers = rec.offers || [];
    const accepted = offers.filter((o) => o.accepted);
    const upsell = accepted.reduce((s, o) => s + ((rec.items || []).find((i) => i.id === o.id) || { price: addonPrices[o.id] || 0 }).price, 0);
    return {
      t,
      ch: rec.source || "site",
      kind: rec.kind === "callback" ? "callback" : "order",
      sum: rec.kind === "order" && rec.totals ? rec.totals.total : 0,
      cancelled: rec.status === "cancelled",
      done: rec.status === "done" || rec.status === "called",
      paid: rec.payment === "paid",
      // заказ дошёл до конца без единого действия менеджера
      auto: rec.kind === "order" && rec.source !== "crm" && statusBy.length > 0 && statusBy.every((h) => h.by !== "Менеджер"),
      night: isNight(new Date(t).getHours()),
      rescued: agent.some((a) => a.code === "sla_ping" || a.code === "pay_reminder") && rec.status !== "cancelled",
      review: agent.some((a) => a.code === "review"),
      offers: offers.length,
      accepted: accepted.length,
      upsell,
    };
  }

  // ---------- демо-история ----------
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  // Праздники цветочного магазина: [месяц, день, сила, дней разгона]
  const PEAKS = [[2, 14, 3.2, 3], [3, 8, 5.5, 4], [9, 1, 2.2, 2], [12, 31, 1.5, 4], [5, 9, 1.4, 1], [6, 1, 1.3, 1]];
  const HOLIDAYS = [{ m: 2, d: 14, name: "14 февраля" }, { m: 3, d: 8, name: "8 марта" }, { m: 9, d: 1, name: "1 сентября" }, { m: 11, d: 30, name: "День матери" }, { m: 12, d: 31, name: "Новый год" }];
  function seasonal(date) {
    const m = date.getMonth() + 1, d = date.getDate();
    let k = [0.85, 1.05, 1.2, 1.0, 1.05, 0.95, 0.8, 0.85, 1.1, 1.0, 1.0, 1.15][m - 1];
    for (const [pm, pd, power, ramp] of PEAKS) {
      const peak = new Date(date.getFullYear(), pm - 1, pd);
      const diff = Math.round((peak - new Date(date.getFullYear(), m - 1, d)) / DAY);
      if (diff >= 0 && diff <= ramp) k *= 1 + (power - 1) * (1 - diff / (ramp + 1));
    }
    // День матери — последнее воскресенье ноября
    if (m === 11 && d >= 24 && date.getDay() === 0) k *= 1.8;
    const wd = date.getDay();
    return k * [0.9, 0.95, 0.95, 1.0, 1.15, 1.2, 1.05][wd];
  }
  const HOURS = [0.4, 0.2, 0.1, 0.1, 0.1, 0.2, 0.5, 1.2, 2.5, 4, 5, 5.5, 5.2, 4.6, 4.4, 4.6, 5.2, 6, 6.4, 5.8, 4.6, 3.2, 2, 1];
  const CH_SHARE = [["avito", 0.3], ["telegram", 0.2], ["chat", 0.15], ["site", 0.13], ["vk", 0.1], ["max", 0.07], ["alice", 0.05]];
  const CH_CONV = { avito: 0.82, telegram: 1.1, chat: 1.0, site: 1.15, vk: 0.9, max: 1.0, alice: 0.7 };
  const pickW = (r, list) => { let x = r() * list.reduce((s, [, w]) => s + w, 0); for (const [v, w] of list) if ((x -= w) <= 0) return v; return list[0][0]; };

  // now — конец истории, agentFrom — дата запуска агента (до неё ночью заявки терялись, допродаж не было).
  function demoHistory({ now = new Date(), days = 730, seed = 7, agentFrom } = {}) {
    const r = rng(seed);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const launch = agentFrom ? new Date(agentFrom) : new Date(end.getTime() - 270 * DAY);
    const rows = [];
    for (let i = days; i >= 0; i--) {
      const day = new Date(end.getTime() - i * DAY);
      const growth = 1 + 0.25 * (1 - i / 365);
      const withAgent = day >= launch;
      const n = Math.max(0, Math.round(20 * seasonal(day) * growth * (0.8 + 0.4 * r())));
      for (let j = 0; j < n; j++) {
        const hour = Number(pickW(r, HOURS.map((w, h) => [h, w])));
        const t = day.getTime() + hour * 3600000 + Math.floor(r() * 3600000);
        if (i === 0 && t > now.getTime()) continue;
        const ch = pickW(r, CH_SHARE);
        const night = isNight(hour);
        let conv = (withAgent ? 0.56 : 0.41) * CH_CONV[ch];
        if (night && !withAgent) conv *= 0.25; // ночью без агента почти никто не отвечал
        const kindRoll = r();
        const kind = kindRoll < conv ? "order" : kindRoll < conv + 0.07 ? "callback" : "dialog";
        const row = { t, ch, kind, sum: 0, cancelled: false, done: false, paid: false, auto: false, night, rescued: false, review: false, offers: 0, accepted: 0, upsell: 0 };
        if (kind === "order") {
          const base = [3900, 4600, 5200, 5800, 6800, 8900][Math.floor(r() * 6)];
          row.sum = base + (r() < 0.55 ? 490 : 0);
          row.cancelled = r() < (withAgent ? 0.045 : 0.07);
          row.paid = !row.cancelled && r() < 0.93;
          row.done = row.paid && t < now.getTime() - DAY;
          if (withAgent) {
            row.auto = r() < 0.64;
            row.rescued = r() < 0.09;
            row.review = row.done && r() < 0.35;
            if (r() < 0.62) {
              row.offers = 1;
              if (r() < 0.23) { row.accepted = 1; row.upsell = r() < 0.5 ? 450 : 700; row.sum += row.upsell; }
            }
          }
        }
        if (kind === "callback") row.done = r() < 0.9;
        rows.push(row);
      }
    }
    return rows;
  }

  // ---------- периоды ----------
  function startOf(view, d) {
    if (view === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (view === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
    return new Date(d.getFullYear(), 0, 1);
  }
  function shift(view, d, n) {
    if (view === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    if (view === "month") return new Date(d.getFullYear(), d.getMonth() + n, 1);
    return new Date(d.getFullYear() + n, 0, 1);
  }
  function period(view, anchor) {
    const from = startOf(view, anchor);
    return { from, to: shift(view, from, 1) };
  }
  // compare: "prev" — предыдущий день/месяц/год; "year" — тот же период год назад
  function comparePeriod(view, anchor, compare) {
    const { from } = period(view, anchor);
    if (compare === "year" && view !== "year") {
      const f = new Date(from.getFullYear() - 1, from.getMonth(), from.getDate());
      return { from: f, to: shift(view, f, 1) };
    }
    const f = shift(view, from, -1);
    return { from: f, to: from };
  }
  function bucketsOf(view, from) {
    if (view === "day") return Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, "0"), title: `${h}:00–${h + 1}:00` }));
    if (view === "month") {
      const n = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
      return Array.from({ length: n }, (_, i) => ({ label: String(i + 1), title: `${i + 1} ${MONTHS_GEN[from.getMonth()]}` }));
    }
    return MONTHS_SHORT.map((m, i) => ({ label: m, title: MONTHS[i] }));
  }
  function bucketIndex(view, t) {
    const d = new Date(t);
    return view === "day" ? d.getHours() : view === "month" ? d.getDate() - 1 : d.getMonth();
  }
  function periodTitle(view, from) {
    if (view === "day") return `${from.getDate()} ${MONTHS_GEN[from.getMonth()]} ${from.getFullYear()}`;
    if (view === "month") return `${MONTHS[from.getMonth()]} ${from.getFullYear()}`;
    return String(from.getFullYear());
  }

  // ---------- метрики ----------
  function totals(rows) {
    const orders = rows.filter((r) => r.kind === "order" && !r.cancelled);
    const all = rows.filter((r) => r.kind === "order");
    const revenue = orders.reduce((s, r) => s + r.sum, 0);
    const offered = all.reduce((s, r) => s + r.offers, 0);
    const accepted = all.reduce((s, r) => s + r.accepted, 0);
    return {
      leads: rows.length,
      orders: orders.length,
      callbacks: rows.filter((r) => r.kind === "callback").length,
      conversion: rows.length ? orders.length / rows.length : 0,
      revenue,
      avgCheck: orders.length ? revenue / orders.length : 0,
      autoShare: orders.length ? orders.filter((r) => r.auto).length / orders.length : 0,
      nightLeads: rows.filter((r) => r.night).length,
      nightOrders: orders.filter((r) => r.night).length,
      nightRevenue: orders.filter((r) => r.night).reduce((s, r) => s + r.sum, 0),
      rescued: orders.filter((r) => r.rescued).length,
      rescuedRevenue: orders.filter((r) => r.rescued).reduce((s, r) => s + r.sum, 0),
      offered, accepted,
      offerRate: offered ? accepted / offered : 0,
      upsell: orders.reduce((s, r) => s + r.upsell, 0),
      cancelled: all.filter((r) => r.cancelled).length,
      cancelRate: all.length ? all.filter((r) => r.cancelled).length / all.length : 0,
      reviews: rows.filter((r) => r.review).length,
      lost: rows.filter((r) => r.kind === "dialog").length,
    };
  }
  const delta = (a, b) => (b ? (a - b) / b : a ? null : 0);

  function byChannel(rows) {
    const map = {};
    for (const r of rows) (map[r.ch] = map[r.ch] || []).push(r);
    return Object.entries(map).map(([ch, list]) => ({ ch, name: CHANNELS[ch] || ch, ...totals(list) })).sort((a, b) => b.revenue - a.revenue);
  }

  function report(allRows, { view = "month", anchor = new Date(), compare = "prev", now = new Date() } = {}) {
    const cur = period(view, anchor);
    const prev = comparePeriod(view, anchor, compare);
    const inP = (p) => allRows.filter((r) => r.t >= p.from.getTime() && r.t < p.to.getTime());
    const curRows = inP(cur), prevRows = inP(prev);
    // Период ещё идёт — итоги сравниваем с тем же отрезком прошлого (9 дней с 9 днями), а не с целым месяцем.
    const partial = cur.to > now && cur.from <= now;
    const elapsed = partial ? now.getTime() - cur.from.getTime() : Infinity;
    const prevCut = partial ? prevRows.filter((r) => r.t - prev.from.getTime() < elapsed) : prevRows;
    const buckets = bucketsOf(view, cur.from).map((b) => ({ ...b, cur: [], prev: [] }));
    for (const r of curRows) buckets[bucketIndex(view, r.t)].cur.push(r);
    for (const r of prevRows) { const i = bucketIndex(view, r.t); if (buckets[i]) buckets[i].prev.push(r); }
    const series = buckets.map((b) => ({ label: b.label, title: b.title, cur: totals(b.cur), prev: totals(b.prev) }));
    const T = totals(curRows), P = totals(prevCut);
    const deltas = {};
    for (const k of Object.keys(T)) deltas[k] = delta(T[k], P[k]);
    const hours = Array.from({ length: 24 }, (_, h) => curRows.filter((r) => new Date(r.t).getHours() === h).length);
    return {
      view, compare,
      period: { ...cur, title: periodTitle(view, cur.from) },
      prevPeriod: { ...prev, title: periodTitle(view, prev.from) },
      totals: T, prev: P, deltas, series,
      channels: byChannel(curRows), prevChannels: byChannel(prevCut), partial,
      hours,
    };
  }

  // ---------- куда идти дальше ----------
  const rub = (n) => Math.round(n).toLocaleString("ru-RU").replace(/,/g, " ") + " ₽";
  const pct = (x) => Math.round(x * 100) + "%";
  function insights(rep, allRows, { now = new Date() } = {}) {
    const out = [];
    const T = rep.totals, D = rep.deltas;
    if (!T.leads) return [{ kind: "info", title: "За этот период данных нет", text: "Выберите другой период или включите демо-историю." }];

    // выручка: рост или падение и за счёт чего
    if (D.revenue != null && Math.abs(D.revenue) >= 0.05) {
      const ch = rep.channels.map((c) => ({ ...c, before: (rep.prevChannels.find((p) => p.ch === c.ch) || { revenue: 0 }).revenue }))
        .sort((a, b) => Math.abs(b.revenue - b.before) - Math.abs(a.revenue - a.before))[0];
      const up = D.revenue > 0;
      out.push({ kind: up ? "good" : "warn", title: `Выручка ${up ? "выросла" : "упала"} на ${pct(Math.abs(D.revenue))}`,
        text: `${up ? "Больше всего добавил" : "Больше всего просел"} канал «${ch.name}»: ${rub(ch.before)} → ${rub(ch.revenue)}. ${up ? "Закрепите: в этом канале агент отвечает быстрее всего — добавьте туда объявления или пост с подборкой." : "Откройте «Разбор диалогов» по этому каналу: где клиенты перестают отвечать."}` });
    }
    // самый слабый канал по конверсии
    const big = rep.channels.filter((c) => c.leads >= Math.max(5, T.leads * 0.08));
    if (big.length > 1) {
      const worst = big.slice().sort((a, b) => a.conversion - b.conversion)[0];
      if (worst.conversion < T.conversion * 0.85) {
        const gain = (T.conversion - worst.conversion) * worst.leads * T.avgCheck;
        out.push({ kind: "warn", title: `«${worst.name}»: в заказ превращается ${pct(worst.conversion)} обращений`, text: `В среднем по каналам ${pct(T.conversion)}. Если подтянуть до среднего, это ещё около ${rub(gain)} за период. Обычно помогает: цена и наличие в первом ответе, фото букета, кнопка «оформить» сразу.` });
      }
    }
    // ночь
    if (T.nightLeads >= 3) {
      out.push({ kind: "good", title: `Ночью написали ${T.nightLeads} раз — ${T.nightOrders} заказов на ${rub(T.nightRevenue)}`, text: "Это заявки с 21:00 до 9:00, когда магазин закрыт. Агент принял их сам; утром флорист видит готовые заказы в CRM." });
    }
    // допродажи
    if (T.offered >= 10) {
      if (T.offerRate < 0.15) out.push({ kind: "warn", title: `Допродажу берут редко: ${pct(T.offerRate)}`, text: "Попробуйте другое дополнение (открытка вместо вазы) или предлагайте его только когда оно добирает до бесплатной доставки." });
      else out.push({ kind: "good", title: `Допродажи принесли ${rub(T.upsell)}`, text: `Берут ${pct(T.offerRate)} предложений. Можно добавить второе дополнение для заказов от 6 000 ₽ — без давления, одной фразой.` });
    }
    if (T.rescued) out.push({ kind: "good", title: `Агент спас ${T.rescued} заказов на ${rub(T.rescuedRevenue)}`, text: "Это заказы, где менеджер не ответил вовремя или клиент забыл оплатить: агент напомнил, и заказ состоялся." });
    if (T.cancelRate > 0.07) out.push({ kind: "warn", title: `Отмен много: ${pct(T.cancelRate)}`, text: "Проверьте причины в карточках CRM. Частая причина — нет подтверждения звонком: включите автоподтверждение агентом через 30 минут." });

    // пиковые часы
    const peak = rep.hours.map((n, h) => [h, n]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h).sort((a, b) => a - b);
    if (rep.view !== "day" && T.leads >= 30) out.push({ kind: "info", title: `Пик обращений: ${peak.map((h) => h + ":00").join(", ")}`, text: "В эти часы держите на смене флориста, чтобы заказы из чатов собирались без очереди." });

    // ближайший праздник и прошлогодний спрос
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next = HOLIDAYS.map((h) => {
      let d = new Date(today.getFullYear(), h.m - 1, h.d);
      if (d < today) d = new Date(today.getFullYear() + 1, h.m - 1, h.d);
      return { ...h, date: d, days: Math.round((d - today) / DAY) };
    }).sort((a, b) => a.days - b.days)[0];
    if (next && next.days <= 60) {
      const ly = new Date(next.date.getFullYear() - 1, next.date.getMonth(), next.date.getDate());
      const week = allRows.filter((r) => r.kind === "order" && !r.cancelled && r.t >= ly.getTime() - 6 * DAY && r.t < ly.getTime() + DAY);
      const usual = allRows.filter((r) => r.kind === "order" && !r.cancelled && r.t >= ly.getTime() - 37 * DAY && r.t < ly.getTime() - 30 * DAY).length;
      if (week.length) out.push({ kind: "plan", title: `До праздника «${next.name}» ${next.days} дн.`, text: `Год назад за неделю до него было ${week.length} заказов (обычная неделя — ${usual}), выручка ${rub(week.reduce((s, r) => s + r.sum, 0))}. Откройте предзаказ заранее, закупите цветы под спрос и включите агенту подсказку о сроках доставки.` });
    }
    return out;
  }

  return { CHANNELS, HOLIDAYS, normalize, demoHistory, seasonal, period, comparePeriod, totals, byChannel, report, insights, rub, pct };
});
