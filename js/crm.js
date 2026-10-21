(function () {
  const { store: S, cart, validate } = Flora;
  const store = S.appStore();
  const $ = (id) => document.getElementById(id);
  const filters = $("filters");
  let selected = decodeURIComponent(location.hash.slice(1)) || null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const timeFmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  const when = (iso) => timeFmt.format(new Date(iso));
  const chip = (s) => `<span class="chip" data-s="${s}">${S.STATUS[s]}</span>`;

  function fillSelect(name, map) {
    filters.elements[name].insertAdjacentHTML("beforeend", Object.entries(map).map(([v, l]) => `<option value="${v}">${l}</option>`).join(""));
  }
  fillSelect("status", S.STATUS);
  fillSelect("source", S.SOURCE);
  fillSelect("kind", { order: "Только заказы", callback: "Только звонки" });

  function what(r) {
    if (r.kind === "callback") return `Звонок<span class="sub">${esc(r.topic)}</span>`;
    return esc(r.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(", ")) +
      `<span class="sub">${r.fulfillment === "pickup" ? "Самовывоз" : "Доставка"}</span>`;
  }

  function render() {
    const f = Object.fromEntries(new FormData(filters));
    const all = store.list();
    const rows = store.list(f);

    const active = all.filter((r) => !["done", "called", "cancelled", "new"].includes(r.status));
    $("stat-new").textContent = all.filter((r) => r.status === "new").length;
    $("stat-work").textContent = active.length;
    $("stat-done").textContent = all.filter((r) => r.status === "done" || r.status === "called").length;
    $("stat-sum").textContent = cart.formatRub(all.filter((r) => r.kind === "order" && !["done", "cancelled"].includes(r.status)).reduce((s, r) => s + r.totals.total, 0));

    $("rows").innerHTML = rows.map((r) => `
      <tr data-id="${esc(r.id)}" aria-selected="${r.id === selected}">
        <td class="id"><button type="button">${esc(r.id)}</button><span class="sub">${when(r.createdAt)}</span></td>
        <td>${esc(r.customer.name)}<span class="sub">${esc(validate.formatPhone(r.customer.phone))}</span></td>
        <td>${what(r)}</td>
        <td>${r.kind === "order" ? `${validate.formatDate(r.date)}<span class="sub">${validate.slotLabel(r.slot)}</span>` : "Как можно скорее"}</td>
        <td class="money">${r.kind === "order" ? cart.formatRub(r.totals.total) : ""}</td>
        <td>${chip(r.status)}</td>
        <td>${S.SOURCE[r.source]}</td>
      </tr>`).join("");

    $("records").hidden = rows.length === 0;
    $("empty").hidden = rows.length > 0;
    $("empty-text").textContent = all.length
      ? "По этим фильтрам заявок нет. Измените поиск или фильтры."
      : "Заявок пока нет. Оформите заказ на сайте или в чате — он появится здесь. Или добавьте демо-данные.";

    renderDetail();
  }

  function renderDetail() {
    const r = selected ? store.get(selected) : null;
    $("detail").hidden = !r;
    document.querySelector(".layout").classList.toggle("has-detail", !!r);
    if (!r) return;

    $("d-title").textContent = `${S.KIND[r.kind]} ${r.id}`;
    $("d-status").outerHTML = `<span class="chip" id="d-status" data-s="${r.status}">${S.STATUS[r.status]}</span>`;
    $("d-meta").textContent = `${S.SOURCE[r.source]}, ${when(r.createdAt)}`;

    const facts = [
      ["Клиент", esc(r.customer.name)],
      ["Телефон", `<a href="tel:${esc(r.customer.phone)}">${esc(validate.formatPhone(r.customer.phone))}</a>`],
    ];
    if (r.kind === "order") {
      facts.push(
        ["Состав", esc(r.items.map((i) => `${i.name} ×${i.qty}`).join(", "))],
        ["Получение", r.fulfillment === "pickup" ? "Самовывоз, Покровка, 12" : esc(r.address)],
        ["Когда", `${validate.formatDate(r.date)}, ${validate.slotLabel(r.slot)}`],
        ["Сумма", `${cart.formatRub(r.totals.total)}${r.totals.delivery ? ` (доставка ${cart.formatRub(r.totals.delivery)})` : ""}`]
      );
      if (r.note) facts.push(["Открытка", esc(r.note)]);
    } else {
      facts.push(["Тема", esc(r.topic)]);
    }
    $("d-facts").innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");

    const next = S.nextStatuses(r);
    $("d-moves").innerHTML = next.length
      ? next.map((s) => `<button type="button" class="btn btn-small${s === "cancelled" ? " cancel" : ""}" data-move="${s}">${s === "cancelled" ? "Отменить" : S.STATUS[s]}</button>`).join("")
      : "<p>Заявка закрыта, статус больше не меняется.</p>";

    $("d-history").innerHTML = r.history.slice().reverse().map((h) => {
      const body = h.type === "status" ? `Статус: ${S.STATUS[h.status]}` : h.type === "sync" ? `<span class="${h.ok ? "" : "bad"}">${esc(h.text)}</span>` : esc(h.text);
      return `<li>${body}<br><time>${when(h.at)}</time> <span class="by">${esc(h.by)}</span></li>`;
    }).join("");
  }

  function select(id) {
    selected = id;
    history.replaceState(null, "", id ? "#" + encodeURIComponent(id) : location.pathname);
    $("d-error").hidden = true;
    render();
  }

  $("rows").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) select(tr.dataset.id);
  });
  $("d-close").addEventListener("click", () => select(null));
  $("d-moves").addEventListener("click", (e) => {
    const b = e.target.closest("[data-move]");
    if (!b) return;
    try {
      store.setStatus(selected, b.dataset.move);
      $("d-error").hidden = true;
    } catch (err) {
      $("d-error").textContent = err.message;
      $("d-error").hidden = false;
    }
    render();
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

  filters.addEventListener("input", render);
  filters.addEventListener("submit", (e) => e.preventDefault());
  $("seed").addEventListener("click", () => { store.seedDemo(); render(); });
  $("clear").addEventListener("click", () => {
    if (!confirm("Удалить все заявки из демо-CRM? Это нельзя отменить.")) return;
    store.reset();
    select(null);
  });
  $("export").addEventListener("click", () => {
    const head = ["Номер", "Тип", "Статус", "Источник", "Создан", "Клиент", "Телефон", "Состав или тема", "Дата", "Интервал", "Адрес", "Сумма"];
    const lines = store.list().map((r) => [
      r.id, S.KIND[r.kind], S.STATUS[r.status], S.SOURCE[r.source], r.createdAt, r.customer.name, r.customer.phone,
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

  // заказы из магазина в другой вкладке появляются сразу
  addEventListener("storage", (e) => { if (e.key === store.storageKey || e.key === null) render(); });

  render();
})();
