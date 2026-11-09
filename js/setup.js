(function () {
  const { kb, profile: PR, bot, store: S, kbSamples } = Flora;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TEMPLATES = [
    ["created", "Заказ принят"], ["night", "Заказ принят ночью"], ["confirmed", "Подтверждение и ссылка на оплату"],
    ["pay_reminder", "Напоминание об оплате"], ["paid", "Оплата получена"], ["payment_failed", "Оплата не прошла"],
    ["delivering", "Курьер в пути"], ["ready", "Готов к выдаче"], ["done", "Заказ выполнен"], ["review", "Просьба оценить"], ["cancelled", "Отмена"],
  ];

  let candidate = PR.get();
  let report = null;

  // ---------- источники ----------
  const SRC = ["chats", "staff", "contacts", "templates", "faq"];
  document.querySelectorAll("[data-sample]").forEach((b) => b.addEventListener("click", () => {
    const s = kbSamples[b.dataset.sample];
    $("src-chats").value = s.chats;
    $("src-staff").value = s.staff;
    $("src-contacts").value = s.contacts;
    $("src-templates").value = s.templates;
    $("src-faq").value = s.faq;
  }));
  $("clear-src").addEventListener("click", () => SRC.forEach((k) => ($("src-" + k).value = "")));

  $("analyze").addEventListener("click", () => {
    const staff = $("src-staff").value.split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);
    const res = kb.analyze({
      chats: $("src-chats").value, templates: $("src-templates").value, faq: $("src-faq").value,
      contacts: $("src-contacts").value, staff: staff.length ? staff : kb.STAFF_DEFAULT,
    });
    candidate = res.profile;
    report = res.report;
    show();
    $("result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  // ---------- результат ----------
  function show() {
    $("result").hidden = false;
    const p = candidate;
    const r = report;
    $("r-summary").textContent = r
      ? `Прочитано ${r.messages} сообщений в ${r.conversations} разговорах: ${r.staffMessages} от сотрудников, ${r.clientMessages} от клиентов. Найдено шаблонов: ${r.templates.length}, вопросов с ответами: ${r.faq.length}.`
      : `Сейчас на стенде действует профиль «${p.business.name}». Соберите новый из переписок или поправьте поля.`;

    $("f-address").value = p.tone.address;
    $("f-emoji").value = p.tone.emoji || "";
    $("f-greeting").value = p.tone.greeting;
    $("f-signoff").value = p.tone.signoff || "";
    $("why-tone").textContent = r && r.staffMessages
      ? `Обращения на «вы»: ${r.tone.vy}, на «ты»: ${r.tone.ty}. Эмодзи в ${Math.round(r.tone.emojiRate * 100)}% сообщений. Приветствие встречается ${r.tone.greetingCount} раз, прощание — ${r.tone.signoffCount}. Средняя длина ответа — ${r.tone.avgLength} знаков.`
      : "";
    $("phrases").innerHTML = (p.tone.phrases || []).length ? "Фирменные обороты: " + p.tone.phrases.map((x) => `<span>${esc(x)}</span>`).join("") : "";

    $("f-name").value = p.business.name;
    $("f-addr").value = p.business.address;
    $("f-phone").value = p.business.phone;
    $("f-from").value = p.business.hours.from;
    $("f-to").value = p.business.hours.to;

    $("f-prefix").value = p.orderId.order;
    $("f-year").checked = !!p.orderId.withYear;

    $("fillers").innerHTML = r && r.fillers.length
      ? r.fillers.map((f) => `<li><b>«${esc(f.word)}»</b> — ${f.count} ${f.count === 1 ? "раз" : "раза"}<q>${esc(f.example)}</q></li>`).join("")
      : `<li>${r ? "В ответах сотрудников паразитов не нашлось." : "Появится после разбора переписок."}</li>`;

    $("templates").innerHTML = TEMPLATES.map(([k, label]) => `
      <div class="tpl"><div><b>${label}</b><small>${r && r.templates.includes(k) ? "из ваших шаблонов" : "стандартный"}</small></div>
      <div><textarea rows="2" data-tpl="${k}">${esc(p.templates[k] || "")}</textarea><p class="warn" data-warn="${k}"></p></div></div>`).join("");

    renderFaq();
    renderIds();
    renderQuality();
    resetTry();
  }

  function renderIds() {
    const p = readForm();
    const ex = PR.formatId("order", 1001, "2026", p);
    $("why-ids").textContent = (report && report.ids ? `В переписках нашлись номера ${report.ids.examples.join(", ")}. ` : "") + `Новые заказы будут выглядеть так: ${ex}.`;
  }

  function renderFaq() {
    const ours = new Set((report ? report.faq : []).map((f) => f.q));
    $("faq").innerHTML = candidate.faq.map((f, i) => `
      <div class="qa" data-i="${i}"><div><b>${esc(f.q)}</b><small>${ours.has(f.q) ? "из ваших данных" : "стандартный"} · ключевые слова: ${esc((f.keywords || []).join(", "))}</small>
        <button class="remove" type="button" data-remove="${i}">Убрать вопрос</button></div>
      <div><textarea rows="2" data-faq="${i}">${esc(f.a)}</textarea></div></div>`).join("");
  }

  // Поля формы → профиль-кандидат.
  function readForm() {
    const p = JSON.parse(JSON.stringify(candidate));
    p.tone.address = $("f-address").value;
    p.tone.emoji = $("f-emoji").value.trim();
    p.tone.greeting = $("f-greeting").value.trim() || "Здравствуйте!";
    p.tone.signoff = $("f-signoff").value.trim();
    p.business.name = $("f-name").value.trim() || p.business.name;
    p.business.address = $("f-addr").value.trim() || p.business.address;
    p.business.phone = $("f-phone").value.trim() || p.business.phone;
    const from = Number($("f-from").value);
    const to = Number($("f-to").value);
    if (from >= 0 && to > from && to <= 24) p.business.hours = { from, to };
    p.orderId.order = ($("f-prefix").value.trim() || p.orderId.order).toUpperCase();
    p.orderId.withYear = $("f-year").checked;
    document.querySelectorAll("[data-tpl]").forEach((t) => (p.templates[t.dataset.tpl] = t.value.trim()));
    document.querySelectorAll("[data-faq]").forEach((t) => { const f = p.faq[Number(t.dataset.faq)]; if (f) f.a = t.value.trim(); });
    return p;
  }

  $("result").addEventListener("input", () => {
    candidate = readForm();
    renderIds();
    renderQuality();
  });
  $("result").addEventListener("change", () => resetTry());
  $("faq").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    candidate = readForm();
    candidate.faq.splice(Number(b.dataset.remove), 1);
    renderFaq();
    renderQuality();
    resetTry();
  });

  function renderQuality() {
    const issues = kb.quality(candidate);
    TEMPLATES.forEach(([k]) => {
      const w = PR.lint(candidate.templates[k] || "", candidate);
      const el = document.querySelector(`[data-warn="${k}"]`);
      if (el) el.textContent = w.length ? `Лучше без: ${w.join(", ")}` : "";
    });
    const missing = TEMPLATES.filter(([k]) => !(candidate.templates[k] || "").trim()).map(([, l]) => l);
    $("quality").innerHTML = [
      issues.length ? issues.map((i) => `<li class="bad">В ${esc(i.where)} — «${esc(i.word)}»</li>`).join("") : `<li class="ok">Ни одного слова-паразита в шаблонах и ответах</li>`,
      missing.length ? `<li class="bad">Пустые шаблоны: ${esc(missing.join(", "))}</li>` : `<li class="ok">Все ${TEMPLATES.length} шаблонов заполнены</li>`,
      `<li class="ok">Вопросов в базе знаний: ${candidate.faq.length}</li>`,
      `<li>Обращение: на «${esc(candidate.tone.address)}», приветствие «${esc(candidate.tone.greeting)}»${candidate.tone.emoji ? `, эмодзи ${esc(candidate.tone.emoji)}` : ""}</li>`,
    ].join("");
  }

  // ---------- проба ----------
  let tryState = null;
  const tryStore = S.createStore({ storage: S.memoryStorage() });
  const tryCtx = () => ({ now: () => new Date(), create: (i) => tryStore.create(i), lookup: (id) => tryStore.get(id), profile: candidate, source: "chat" });
  function tryShow(r) {
    tryState = r.state;
    for (const m of r.messages) {
      const li = document.createElement("li");
      li.textContent = m.text;
      $("try-log").appendChild(li);
    }
    const opts = (r.messages.filter((m) => m.options).pop() || {}).options || [];
    $("try-chips").innerHTML = opts.map((o) => `<button type="button" data-v="${esc(o.value)}">${esc(o.label)}</button>`).join("") +
      ["ещё актуально?", "можно картой?", "розы на завтра вечером"].map((t) => `<button type="button" data-t="${esc(t)}">${esc(t)}</button>`).join("");
    $("try-log").scrollTop = $("try-log").scrollHeight;
  }
  function trySay(text, value) {
    const li = document.createElement("li");
    li.className = "me";
    li.textContent = text;
    $("try-log").appendChild(li);
    PR.use(candidate);
    try { tryShow(bot.reply(tryState, { text, value }, tryCtx())); } finally { PR.use(null); }
  }
  function resetTry() {
    $("try-log").innerHTML = "";
    PR.use(candidate);
    try { tryShow(bot.start({ profile: candidate })); } finally { PR.use(null); }
  }
  $("try-chips").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.v) trySay(b.textContent, b.dataset.v);
    else trySay(b.dataset.t);
  });
  $("try-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = $("try-text").value.trim();
    if (!t) return;
    $("try-text").value = "";
    trySay(t);
  });

  // ---------- применить ----------
  $("apply").addEventListener("click", () => {
    candidate = readForm();
    PR.save(candidate);
    $("apply-status").textContent = `Готово: бот во всех каналах, SMS и номера заказов теперь работают как у «${candidate.business.name}».`;
  });
  $("restore").addEventListener("click", () => {
    PR.reset();
    candidate = PR.get();
    report = null;
    show();
    $("apply-status").textContent = "Вернули настройки «Стебля».";
  });
  $("download").addEventListener("click", () => {
    candidate = readForm();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(candidate, null, 2)], { type: "application/json" }));
    a.download = `profile-${candidate.business.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ---------- Claude (только на claude.ai, через оболочку стенда) ----------
  let ai = null;
  try { ai = window.parent !== window && window.parent.STEBEL_AI; } catch (e) { ai = null; }
  if (ai) $("ai").hidden = false;
  $("ai").addEventListener("click", async () => {
    const src = ["chats", "templates", "faq", "contacts"].map((k) => `### ${k}\n${$("src-" + k).value}`).join("\n\n").slice(0, 15000);
    if (!src.replace(/###.*\n/g, "").trim()) { $("ai-status").textContent = "Сначала вставьте переписки или подставьте пример."; return; }
    $("ai").disabled = true;
    $("ai-status").textContent = "Claude читает переписки…";
    const prompt = `Ты настраиваешь чат-бота магазина по перепискам его сотрудников с клиентами. Ответь только JSON вида
{"tone":{"address":"вы"|"ты","greeting":"…","signoff":"…","emoji":"…"},"faq":[{"q":"вопрос клиента","a":"ответ магазина","keywords":["основы слов 4-6 букв"]}],"notes":["что важно учесть, до 5 пунктов"]}.
Правила: пиши по-русски, дружелюбно и коротко, без слов-паразитов и канцелярита; ответы в faq — общие, без номеров конкретных заказов и личных данных; keywords — начала слов в нижнем регистре, по которым узнать вопрос.
Данные магазина:\n${src}`;
    try {
      const out = await ai(prompt);
      candidate = readForm();
      const t = out && out.tone ? out.tone : {};
      if (t.address === "вы" || t.address === "ты") candidate.tone.address = t.address;
      if (t.greeting) candidate.tone.greeting = t.greeting;
      if (typeof t.signoff === "string") candidate.tone.signoff = t.signoff;
      if (typeof t.emoji === "string" && t.emoji.length <= 4) candidate.tone.emoji = t.emoji;
      const known = new Set(candidate.faq.map((f) => f.q.toLowerCase()));
      const added = (out && Array.isArray(out.faq) ? out.faq : []).filter((f) => f && f.q && f.a && Array.isArray(f.keywords) && f.keywords.length && !known.has(String(f.q).toLowerCase()))
        .map((f) => ({ q: String(f.q), a: kb.clean(String(f.a)), keywords: f.keywords.map((k) => String(k).toLowerCase()).slice(0, 4) }));
      candidate.faq = [...added, ...candidate.faq];
      show();
      $("ai-status").textContent = `Claude добавил вопросов: ${added.length}.` + (out && out.notes && out.notes.length ? " Заметки: " + out.notes.slice(0, 5).join(" ") : "");
    } catch (e) {
      $("ai-status").textContent = e && e.code === "not_granted" ? "Доступ к Claude не разрешён для этой страницы." : e && e.code === "rate_limited" ? "Слишком много запросов, попробуйте позже." : "Claude сейчас недоступен — база знаний собрана без него.";
    } finally {
      $("ai").disabled = false;
    }
  });

  show();
})();
