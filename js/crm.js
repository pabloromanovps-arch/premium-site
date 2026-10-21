(function () {
  const { store: S, cart, validate, messages } = Flora;
  const store = S.appStore();
  const now = () => (Flora.clock ? Flora.clock() : new Date());
  const $ = (id) => document.getElementById(id);
  const filters = $("filters");
  let selected = decodeURIComponent(location.hash.slice(1)) || null;
  let view = "board";
  try { view = localStorage.getItem("stebel.crm.view") || "board"; } catch (e) { /* по умолчанию воронка */ }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const timeFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  const when = (iso) => timeFmt.format(new Date(iso));
  const chip = (s) => `<span class="chip" data-s="${s}">${S.STATUS[s]}</span>`;
  const src = (r) => `<span class="src" data-src="${r.source}">${S.SOURCE[r.source] || r.source}</span>`;
  const payBadge = (r) => (r.kind !== "order" || r.status === "cancelled" ? "" : r.payment === "paid" ? `<span class="pay ok">Оплачен</span>` : S.PAYABLE.includes(r.status) || r.status === "done" ? `<span class="pay no">Не оплачен</span>` : "");

  // Колонки воронки: этапы заказа слева направо.
  const COLUMNS = [
    { id: "new", title: "Новые", hint: "Позвоните клиенту и подтвердите заказ", statuses: ["new"], color: "#c92a62" },
    { id: "confirmed", title: "Подтверждены", hint: "Клиенту ушла ссылка на оплату — можно собирать", statuses: ["confirmed"], color: "#1f4f9b" },
    { id: "assembling", title: "Собираются", hint: "Флорист собирает букет", statuses: ["assembling"], color: "#b07a00" },
    { id: "out", title: "В доставке и к выдаче", hint: "Курьер в пути или букет ждёт на Покровке", statuses: ["delivering", "ready"], color: "#11626a" },
    { id: "done", title: "Выполнены", hint: "Закрытые заказы и звонки", statuses: ["done", "called"], color: "#2f5d3a" },
    { id: "cancelled", title: "Отменены", hint: "", statuses: ["cancelled"], color: "#777" },
  ];

  // Главное действие для каждого этапа — глаголом, как в жизни.
  function primaryAction(r) {
    if (r.kind === "callback") return r.status === "new" ? { to: "called", label: "Перезвонили клиенту" } : null;
    return {
      new: { to: "confirmed", label: "Подтвердить заказ" },
      confirmed: { to: "assembling", label: "Начать сборку" },
      assembling: r.fulfillment === "pickup" ? { to: "ready", label: "Букет готов к выдаче" } : { to: "delivering", label: "Передать курьеру" },
      delivering: { to: "done", label: "Отметить доставленным" },
      ready: { to: "done", label: "Отметить выданным" },
    }[r.status] || null;
  }

  function explain(r) {
    if (r.kind === "callback") {
      return r.status === "new" ? "Клиент просит перезвонить. Позвоните и нажмите «Перезвонили клиенту»." : "Звонок состоялся, заявка закрыта.";
    }
    const pay = r.payment === "paid" ? "Оплата получена." : "Оплата ещё не поступила.";
    return {
      new: "Клиент ждёт звонка. Позвоните, уточните букет, время и адрес, затем подтвердите — клиенту уйдёт SMS со ссылкой на оплату.",
      confirmed: `Заказ подтверждён. ${pay} Когда флорист возьмётся за букет, нажмите «Начать сборку».`,
      assembling: `Букет собирают. ${pay} ${r.fulfillment === "pickup" ? "Когда будет готов — клиент получит SMS, что можно забирать." : "Когда букет готов, передайте его курьеру."}`,
      delivering: `Курьер везёт заказ. ${pay} После вручения отметьте доставку.`,
      ready: `Букет ждёт клиента на Покровке. ${pay}`,
      done: "Заказ выполнен и закрыт.",
      cancelled: "Заказ отменён и закрыт.",
    }[r.status];
  }

  function waitBadge(r) {
    if (r.status !== "new") return "";
    const min = Math.max(0, Math.round((now() - new Date(r.createdAt)) / 60000));
    const text = min < 1 ? "только что" : min < 60 ? `ждёт ${min} мин` : `ждёт ${Math.floor(min / 60)} ч ${min % 60} мин`;
    return `<span class="wait${min >= 15 ? " late" : ""}">${text}</span>`;
  }

  function what(r) {
    if (r.kind === "callback") return `Звонок: ${esc(r.topic || "консультация")}`;
    return esc(r.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(", ")) + (r.fulfillment === "pickup" ? ", самовывоз" : ", доставка");
  }
  const whenText = (r) => (r.kind === "order" ? `${validate.formatDate(r.date)}, ${validate.slotLabel(r.slot)}` : "перезвонить как можно скорее");

  function fillSelect(name, map) {
    filters.elements[name].insertAdjacentHTML("beforeend", Object.entries(map).map(([v, l]) => `<option value="${v}">${l}</option>`).join(""));
  }
  fillSelect("status", S.STATUS);
  fillSelect("source", Object.fromEntries(Object.entries(S.SOURCE).filter(([k]) => k !== "crm")));
  fillSelect("kind", { order: "Только заказы", callback: "Только звонки" });

  function deal(r) {
    const act = primaryAction(r);
    return `
      <article class="deal" data-id="${esc(r.id)}" aria-current="${r.id === selected}">
        <div class="deal-top"><button class="deal-id" type="button">${esc(r.id)}</button>${src(r)}</div>
        <p class="name">${esc(r.customer.name)}</p>
        <p class="what">${what(r)}</p>
        <p class="when">${whenText(r)}</p>
        <div class="deal-bottom"><span class="sum">${r.kind === "order" ? cart.formatRub(r.totals.total) : ""}</span>${payBadge(r)}${waitBadge(r)}</div>
        ${act ? `<button class="btn btn-small quick" type="button" data-move="${act.to}" data-for="${esc(r.id)}">${act.label}</button>` : ""}
      </article>`;
  }

  function render() {
    const f = Object.fromEntries(new FormData(filters));
    if (view === "board") delete f.status;
    const all = store.list();
    const rows = store.list(f);

    $("stat-new").textContent = all.filter((r) => r.status === "new").length;
    $("stat-work").textContent = all.filter((r) => ["confirmed", "assembling", "delivering", "ready"].includes(r.status)).length;
    $("stat-unpaid").textContent = all.filter((r) => r.kind === "order" && S.PAYABLE.includes(r.status) && r.payment !== "paid").length;
    $("stat-sum").textContent = cart.formatRub(all.filter((r) => r.kind === "order" && !["done", "cancelled"].includes(r.status)).reduce((s, r) => s + r.totals.total, 0));

    document.body.classList.toggle("list-view", view === "list");
    filters.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    $("board").hidden = view !== "board" || rows.length === 0;
    $("list").hidden = view !== "list" || rows.length === 0;
    $("empty").hidden = rows.length > 0;
    $("empty-text").textContent = all.length
      ? "По этим фильтрам заявок нет. Измените поиск или фильтры."
      : "Заявок пока нет. Оформите заказ на сайте или напишите боту в любом мессенджере — заявка появится здесь. Или добавьте демо-данные.";

    if (view === "board") {
      $("board").innerHTML = COLUMNS.filter((c) => c.id !== "cancelled" || rows.some((r) => r.status === "cancelled")).map((c) => {
        const items = rows.filter((r) => c.statuses.includes(r.status));
        const sum = items.filter((r) => r.kind === "order").reduce((s, r) => s + r.totals.total, 0);
        return `
          <section class="column" data-column="${c.id}" style="--c:${c.color}" aria-label="${c.title}">
            <div class="column-head">
              <h2>${c.title} <span class="count">${items.length}</span></h2>
              ${c.hint ? `<p>${c.hint}</p>` : ""}
              ${sum ? `<p class="col-sum">На сумму ${cart.formatRub(sum)}</p>` : ""}
            </div>
            ${items.map(deal).join("") || `<p class="column-empty">Пусто</p>`}
          </section>`;
      }).join("");
    } else {
      $("rows").innerHTML = rows.map((r) => `
        <tr data-id="${esc(r.id)}" aria-selected="${r.id === selected}">
          <td class="id"><button type="button">${esc(r.id)}</button><span class="sub">${when(r.createdAt)}</span></td>
          <td>${esc(r.customer.name)}<span class="sub">${esc(validate.formatPhone(r.customer.phone))}</span></td>
          <td>${what(r)}</td>
          <td>${whenText(r)}</td>
          <td class="money">${r.kind === "order" ? cart.formatRub(r.totals.total) : ""}<span class="sub">${payBadge(r)}</span></td>
          <td>${chip(r.status)}</td>
          <td>${src(r)}</td>
        </tr>`).join("");
    }
    renderDetail();
  }

  function renderDetail() {
    const r = selected ? store.get(selected) : null;
    $("detail").hidden = !r;
    document.querySelector(".layout").classList.toggle("has-detail", !!r);
    if (!r) return;

    $("d-title").textContent = `${S.KIND[r.kind]} ${r.id}`;
    $("d-status").outerHTML = `<span class="chip" id="d-status" data-s="${r.status}">${S.STATUS[r.status]}</span>`;
    $("d-meta").innerHTML = `${src(r)} ${payBadge(r)} <span>создан ${when(r.createdAt)}</span>`;
    $("d-explain").textContent = explain(r);

    const act = primaryAction(r);
    const canCancel = S.nextStatuses(r).includes("cancelled");
    $("d-moves").innerHTML =
      (act ? `<button type="button" class="btn primary" data-move="${act.to}">${act.label}</button>` : "") +
      (canCancel ? `<button type="button" class="btn btn-small cancel" data-move="cancelled">Отменить ${r.kind === "order" ? "заказ" : "заявку"}</button>` : "");

    const facts = [
      ["Клиент", esc(r.customer.name)],
      ["Телефон", `<a href="tel:${esc(r.customer.phone)}">${esc(validate.formatPhone(r.customer.phone))}</a>`],
    ];
    if (r.kind === "order") {
      facts.push(
        ["Букеты", esc(r.items.map((i) => `${i.name} ×${i.qty}`).join(", "))],
        ["Получение", r.fulfillment === "pickup" ? "Самовывоз, Покровка, 12" : esc(r.address)],
        ["Когда", whenText(r)],
        ["Сумма", `${cart.formatRub(r.totals.total)}${r.totals.delivery ? ` (доставка ${cart.formatRub(r.totals.delivery)})` : ""}`],
        ["Оплата", r.payment === "paid" ? "Получена" : S.PAYABLE.includes(r.status) ? `Ждём. <a href="${messages.paymentLink(r.id)}" target="_blank" rel="noopener">Страница оплаты клиента</a>` : r.status === "new" ? "Ссылка уйдёт после подтверждения" : "—"]
      );
      if (r.note) facts.push(["Открытка", esc(r.note)]);
    } else {
      facts.push(["Тема", esc(r.topic)]);
    }
    $("d-facts").innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");

    $("d-history").innerHTML = r.history.slice().reverse().map((h) => {
      const body = h.type === "status" ? `Этап: ${S.STATUS[h.status]}`
        : h.type === "sync" || h.type === "payment" ? `<span class="${h.ok ? "" : "bad"}">${esc(h.text)}</span>` : esc(h.text);
      return `<li>${body}<br><time>${when(h.at)}</time> <span class="by">${esc(h.by)}</span></li>`;
    }).join("");
  }

  function select(id) {
    selected = id;
    history.replaceState(null, "", id ? "#" + encodeURIComponent(id) : location.pathname);
    $("d-error").hidden = true;
    render();
  }

  function move(id, to) {
    try {
      store.setStatus(id, to);
      $("d-error").hidden = true;
    } catch (err) {
      $("d-error").textContent = err.message;
      $("d-error").hidden = false;
    }
    render();
  }

  $("board").addEventListener("click", (e) => {
    const quick = e.target.closest("[data-move]");
    if (quick) {
      selected = quick.dataset.for;
      move(quick.dataset.for, quick.dataset.move);
      return;
    }
    const card = e.target.closest(".deal");
    if (card) select(card.dataset.id);
  });
  $("rows").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) select(tr.dataset.id);
  });
  $("d-close").addEventListener("click", () => select(null));
  $("d-moves").addEventListener("click", (e) => {
    const b = e.target.closest("[data-move]");
    if (!b) return;
    if (b.dataset.move === "cancelled" && !confirm("Отменить заявку? Клиент получит SMS об отмене.")) return;
    move(selected, b.dataset.move);
  });
  $("d-comment").addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      store.addComment(selected, $("d-text").value);
      $("d-text").value = "";
      $("d-error").hidden = true;
    } catch (err) {
      $("d-error").textContent = err.message;
      $("d-error").hidden = false;
    }
    render();
  });

  filters.addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    view = b.dataset.view;
    try { localStorage.setItem("stebel.crm.view", view); } catch (err) { /* вид не запомнится */ }
    render();
  });
  filters.addEventListener("input", render);
  filters.addEventListener("submit", (e) => e.preventDefault());

  try { if (localStorage.getItem("stebel.crm.howto") === "hidden") $("howto").hidden = true; } catch (e) { /* подсказка видна */ }
  $("howto-close").addEventListener("click", () => {
    $("howto").hidden = true;
    try { localStorage.setItem("stebel.crm.howto", "hidden"); } catch (e) { /* не запомнится */ }
  });

  $("seed").addEventListener("click", () => { store.seedDemo(); render(); });
  $("clear").addEventListener("click", () => {
    if (!confirm("Удалить все заявки из демо-CRM? Это нельзя отменить.")) return;
    store.reset();
    select(null);
  });
  $("export").addEventListener("click", () => {
    const head = ["Номер", "Тип", "Этап", "Оплата", "Канал", "Создан", "Клиент", "Телефон", "Состав или тема", "Дата", "Интервал", "Адрес", "Сумма"];
    const lines = store.list().map((r) => [
      r.id, S.KIND[r.kind], S.STATUS[r.status], r.kind === "order" ? S.PAYMENT[r.payment] : "", S.SOURCE[r.source], r.createdAt, r.customer.name, r.customer.phone,
      r.kind === "order" ? r.items.map((i) => `${i.name} x${i.qty}`).join("; ") : r.topic,
      r.date || "", validate.slotLabel(r.slot), r.address || "", r.totals ? r.totals.total : "",
    ]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "stebel-crm.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // заказы из магазина и мессенджеров в соседних вкладках появляются сразу
  addEventListener("storage", (e) => { if (e.key === store.storageKey || e.key === null) render(); });
  setInterval(render, 60000);

  render();
})();
