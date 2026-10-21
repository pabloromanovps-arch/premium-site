(function () {
  const { catalog, cart, validate, store: storeMod, flowers } = Flora;
  const store = storeMod.appStore();
  const CART_KEY = "stebel.cart.v1";
  const $ = (id) => document.getElementById(id);

  let items = loadCart();

  function loadCart() {
    try {
      const v = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(v) ? v.filter((i) => catalog.byId(i.id)) : [];
    } catch (e) {
      return [];
    }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* без сохранения корзины */ }
  }

  // каталог
  $("hero-art").innerHTML = flowers.bouquetSVG(catalog.byId("prazdnik"));
  $("catalog-grid").innerHTML = catalog.products.map((p) => `
    <article class="product" data-product="${p.id}">
      <figure>${flowers.bouquetSVG(p, "Букет «" + p.name + "»")}</figure>
      <h3>${p.name}</h3>
      <p class="comp">${p.composition}</p>
      <div class="buy">
        <span class="price">${cart.formatRub(p.price)}</span>
        <button class="btn btn-small" type="button" data-add="${p.id}">В корзину</button>
      </div>
    </article>`).join("");

  $("catalog-grid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]");
    if (!btn) return;
    items = cart.add(items, catalog.byId(btn.dataset.add));
    saveCart();
    renderCart();
    btn.textContent = "Добавлено";
    setTimeout(() => (btn.textContent = "В корзину"), 1200);
  });

  // корзина
  const dialog = $("cart");
  const form = $("checkout");
  const fulfillment = () => form.elements.fulfillment.value;

  function renderCart() {
    const t = cart.totals(items, fulfillment());
    $("cart-count").textContent = t.count;
    $("cart-empty").hidden = items.length > 0;
    $("cart-full").hidden = items.length === 0;

    $("cart-lines").innerHTML = items.map((i) => `
      <li data-line="${i.id}">
        <span class="name">${i.name}</span>
        <span class="line-price">${cart.formatRub(i.price * i.qty)}</span>
        <span class="qty">
          <button type="button" data-dec="${i.id}" aria-label="Уменьшить количество «${i.name}»">−</button>
          <output aria-label="Количество">${i.qty}</output>
          <button type="button" data-inc="${i.id}" aria-label="Увеличить количество «${i.name}»">+</button>
        </span>
        <button class="remove" type="button" data-remove="${i.id}">Удалить</button>
      </li>`).join("");

    $("free-hint").textContent = fulfillment() === "delivery" && t.toFree > 0
      ? `Добавьте букетов ещё на ${cart.formatRub(t.toFree)}, и доставка будет бесплатной.`
      : fulfillment() === "delivery" ? "Доставка бесплатная." : "";

    $("cart-sum").innerHTML = `
      <dt>Букеты</dt><dd>${cart.formatRub(t.subtotal)}</dd>
      <dt>${fulfillment() === "pickup" ? "Самовывоз" : "Доставка"}</dt><dd>${t.delivery ? cart.formatRub(t.delivery) : "бесплатно"}</dd>
      <dt class="total">Итого</dt><dd class="total" id="cart-total">${cart.formatRub(t.total)}</dd>`;
    $("checkout-submit").textContent = `Оформить заказ на ${cart.formatRub(t.total)}`;
    $("address-field").hidden = fulfillment() === "pickup";
  }

  $("cart-lines").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const id = b.dataset.inc || b.dataset.dec || b.dataset.remove;
    const line = items.find((i) => i.id === id);
    if (!line) return;
    const qty = b.dataset.inc ? line.qty + 1 : b.dataset.dec ? line.qty - 1 : 0;
    items = cart.setQty(items, id, qty);
    saveCart();
    renderCart();
  });

  function renderSlots() {
    const sel = form.elements.slot;
    const prev = sel.value;
    const slots = validate.availableSlots(form.elements.date.value);
    sel.innerHTML = slots.length
      ? slots.map((s) => `<option value="${s.id}">${s.label}</option>`).join("")
      : `<option value="">Нет свободных интервалов</option>`;
    if (slots.some((s) => s.id === prev)) sel.value = prev;
  }

  function initDates() {
    const { min, max } = validate.dateRange();
    const d = form.elements.date;
    d.min = min;
    d.max = max;
    if (!d.value || d.value < min) d.value = validate.availableSlots(min).length ? min : validate.addDays(min, 1);
    renderSlots();
  }

  function openCart() {
    $("cart-done").hidden = true;
    initDates();
    renderCart();
    dialog.showModal();
  }

  $("cart-open").addEventListener("click", openCart);
  $("cart-close").addEventListener("click", () => dialog.close());
  $("done-close").addEventListener("click", () => dialog.close());
  $("cart-to-catalog").addEventListener("click", () => {
    dialog.close();
    location.hash = "catalog";
  });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  form.addEventListener("change", (e) => {
    if (e.target.name === "fulfillment") renderCart();
    if (e.target.name === "date") renderSlots();
  });

  const FIELDS = ["fulfillment", "name", "phone", "address", "date", "slot", "items"];
  function showErrors(errors) {
    for (const f of FIELDS) {
      const el = $("err-" + f);
      el.hidden = !errors[f];
      el.textContent = errors[f] || "";
      const input = form.elements[f];
      if (input && input.setAttribute) input.setAttribute("aria-invalid", String(!!errors[f]));
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const check = validate.validateOrder({ ...data, items });
    showErrors(check.errors);
    if (!check.ok) {
      const first = FIELDS.find((f) => check.errors[f]);
      const input = form.elements[first];
      if (input && input.focus) input.focus();
      return;
    }
    const rec = store.create({ ...check.value, kind: "order", source: "site" });
    items = [];
    saveCart();
    form.reset();
    renderCart();
    $("cart-full").hidden = true;
    $("cart-empty").hidden = true;
    $("done-id").textContent = rec.id;
    $("done-crm").href = "crm.html#" + encodeURIComponent(rec.id);
    $("cart-done").hidden = false;
    $("cart-done").focus();
  });

  // другие вкладки могли изменить корзину
  addEventListener("storage", (e) => {
    if (e.key === CART_KEY) {
      items = loadCart();
      renderCart();
    }
  });

  renderCart();
})();
