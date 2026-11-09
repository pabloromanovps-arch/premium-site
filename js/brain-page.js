// Страница «Нейросеть»: выбор модели, проверка на разговоре, сравнение с ответами по правилам.
(function () {
  const { bot, llm, store: S } = Flora;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const HELP = {
    none: "Без нейросети агент отвечает по правилам и шаблонам из настройки. Это работает всегда и ничего не стоит.",
    ollama: "Установите Ollama, скачайте модель (например, «ollama pull qwen2.5:7b») и запустите с разрешением для сайта: OLLAMA_ORIGINS=* ollama serve. Переписка не покидает компьютер.",
    openai: "LM Studio: вкладка Developer → Start Server, включите CORS. Подойдут и vLLM, и OpenAI. Ключ в браузере — только для проверки на своём компьютере: для работы с клиентами подключайте модель через свой сервер.",
    server: "Адрес вашего сервера (server/worker.mjs). Модель «claude» — Claude, «openai» — OpenAI или совместимая. Ключи задаются на сервере: wrangler secret put ANTHROPIC_API_KEY.",
    claudeai: "Работает, когда стенд открыт по ссылке на claude.ai: ответы пишет Claude от имени зрителя, ключ не нужен.",
  };
  let cfg = llm.settings();

  function renderProviders() {
    $("providers").innerHTML = Object.entries(llm.PROVIDERS).map(([id, p]) =>
      `<label><b><input type="radio" name="prov" value="${id}"${cfg.provider === id ? " checked" : ""}> ${esc(p.title)}</b><span>${esc(p.about)}</span></label>`).join("");
  }
  function renderFields() {
    const p = llm.PROVIDERS[cfg.provider] || {};
    document.querySelectorAll("#prov-fields [data-for]").forEach((l) => { l.hidden = !l.dataset.for.split(" ").includes(cfg.provider); });
    $("prov-fields").hidden = cfg.provider === "none";
    $("f-url").value = cfg.url || "";
    $("f-url").placeholder = p.url || "https://bot.example.workers.dev";
    $("f-model").value = cfg.model || "";
    $("f-model").placeholder = p.model || "";
    $("f-key").value = cfg.key || "";
    $("f-timeout").value = Math.round((cfg.timeoutMs || 12000) / 1000);
    $("prov-help").textContent = HELP[cfg.provider] || "";
  }
  function readFields() {
    cfg = { ...cfg, url: $("f-url").value.trim(), model: $("f-model").value.trim(), key: cfg.provider === "openai" ? $("f-key").value.trim() : "", timeoutMs: Math.max(2, Math.min(60, Number($("f-timeout").value) || 12)) * 1000 };
  }

  $("providers").addEventListener("change", (e) => {
    if (e.target.name !== "prov") return;
    readFields();
    cfg = { ...cfg, provider: e.target.value, url: "", model: "", key: "" };
    renderFields();
  });
  $("save").addEventListener("click", () => {
    readFields();
    llm.saveSettings(cfg);
    $("save-status").textContent = cfg.provider === "none" ? "Готово: агент отвечает по правилам." : `Готово: в чате на сайте и в мессенджерах отвечает «${llm.PROVIDERS[cfg.provider].title}».`;
  });

  // Разговор для проверки: закончившийся товар, уточнения, оформление.
  const SCRIPT = ["Здравствуйте! Есть ранункулюсы? Хочу подарить сестре на день рождения", "давайте первый, на завтра днём, доставка", "Москва, ул. Лесная, 5, кв 12", "Анна", "+7 916 555-12-34", "да, всё верно"];

  async function run() {
    readFields();
    const box = $("compare");
    box.innerHTML = "";
    $("run").disabled = true;
    const tryStore = S.createStore({ storage: S.memoryStorage() });
    const ctx = { now: () => new Date(), create: (i) => tryStore.create(i), lookup: (id) => tryStore.get(id), source: "chat" };
    let state = bot.start().state;
    const history = [];
    let used = 0, fell = 0;
    try {
      for (const [i, text] of SCRIPT.entries()) {
        $("run-status").textContent = `Реплика ${i + 1} из ${SCRIPT.length}…`;
        history.push({ from: "client", text });
        const turn = document.createElement("div");
        turn.className = "turn";
        turn.innerHTML = `<p class="client">${esc(text)}</p><div class="ans"><small>Бот по правилам</small>…</div><div class="ans llm"><small>Нейросеть</small>думает…</div>`;
        box.appendChild(turn);
        const before = state;
        const rules = bot.reply(before, { text }, { ...ctx, create: (x) => ({ ...x, id: "СТ-…" }) });
        turn.children[1].innerHTML = `<small>Бот по правилам</small>${esc(rules.messages.map((m) => m.text).join("\n\n"))}`;
        const out = await llm.reply(before, { text }, ctx, { cfg, history });
        state = out.state;
        const said = out.messages.map((m) => m.text).filter(Boolean).join("\n\n");
        history.push({ from: "bot", text: said });
        const right = turn.children[2];
        if (out.meta.by === "llm") { used++; right.innerHTML = `<small>Нейросеть · ${(out.meta.ms / 1000).toFixed(1)} с</small>${esc(said)}`; }
        else {
          fell++;
          right.classList.add("fallback");
          right.innerHTML = `<small>${cfg.provider === "none" ? "Нейросеть выключена — ответ бота" : "Ответ бота: " + esc((out.meta.fallback || []).join("; "))}</small>${esc(said)}`;
        }
      }
      $("run-status").textContent = cfg.provider === "none" ? "Выберите модель выше, чтобы сравнить." : `Готово: нейросеть ответила ${used} раз, проверка вернула ответ бота ${fell} раз.`;
    } catch (e) {
      $("run-status").textContent = "Ошибка: " + e.message;
    } finally {
      $("run").disabled = false;
    }
  }
  $("run").addEventListener("click", run);

  renderProviders();
  renderFields();
})();
