// Страница «Разбор диалогов».
(function () {
  const { bot, review: R, profile: PR, store: S } = Flora;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const CH = { avito: "Авито", telegram: "Telegram", chat: "Чат на сайте", site: "Сайт", vk: "ВКонтакте", max: "MAX", alice: "Алиса", crm: "CRM" };
  const OUT = { order: ["заказ", "order"], callback: ["перезвонить", ""], lost: ["ушёл без заказа", "lost"] };
  const scratch = () => { const st = S.createStore({ storage: S.memoryStorage() }); return { now: () => new Date(), create: (i) => st.create(i), lookup: (id) => st.get(id) }; };

  function dialogs() {
    const src = $("source").value;
    const out = [];
    if (src !== "crm") out.push(...R.demoDialogs(bot, scratch()));
    if (src !== "demo") out.push(...R.fromRecords(S.appStore().list()));
    return out;
  }

  // Что агент ответит сейчас — с учётом выученного.
  function answerNow(question) {
    const r = bot.reply(bot.start().state, { text: question }, scratch());
    return r.messages.map((m) => m.text).filter(Boolean).join("\n");
  }

  function render() {
    const rep = R.analyze(dialogs());
    const issuesN = rep.dialogs.reduce((s, d) => s + d.issues.length, 0);
    const left = rep.dialogs.filter((d) => d.outcome === "lost" && d.issues.length).length;
    $("tiles").innerHTML = [
      [rep.total, "разговоров разобрано"],
      [Math.round(rep.quality * 100) + "%", "прошли без замечаний"],
      [issuesN, "мест, где агент ошибся"],
      [left, "клиентов ушли после ошибки"],
    ].map(([v, t]) => `<div><b>${v}</b><span>${t}</span></div>`).join("");

    $("gaps").innerHTML = rep.gaps.length
      ? rep.gaps.slice(0, 8).map((g) => `<li>«${esc(g.question)}» <small>— ${g.count} ${g.count === 1 ? "раз" : "раза"}</small><button type="button" data-goto="${esc(g.dialogs[0])}">Научить</button></li>`).join("")
      : `<li>Пробелов не найдено — агент справился со всеми разговорами.</li>`;

    const list = $("only-bad").checked ? rep.dialogs.filter((d) => d.issues.length) : rep.dialogs;
    $("dialogs").innerHTML = list.map((d) => {
      const [outText, outCls] = OUT[d.outcome] || OUT.lost;
      const flagged = Object.fromEntries(d.issues.map((i) => [i.at, i]));
      const turns = d.turns.map((t, i) => {
        const f = flagged[i];
        return `<li class="${t.from === "client" ? "client" : "bot"}${f ? " flag" : ""}">${f ? `<span class="why">${esc(f.title)}</span>` : ""}${esc(t.text)}</li>`;
      }).join("");
      const fixes = d.issues.filter((i, k, a) => a.findIndex((x) => x.question === i.question) === k).map((i) => `
        <form class="fix" data-q="${esc(i.question)}">
          <label>Как ответить на «${esc(i.question)}»
            <textarea name="a" required placeholder="Напишите ответ так, как ответил бы ваш лучший сотрудник"></textarea></label>
          <label>Опорные слова (через запятую) — по ним агент узнаёт вопрос
            <input name="k" value="${esc(R.keywordsOf(i.question).join(", "))}"></label>
          <div class="row"><button class="btn btn-small" type="submit">Сохранить в базу знаний</button><span class="result" role="status"></span></div>
        </form>`).join("");
      return `<article class="dlg" id="dlg-${esc(d.id)}"><header><span><b>${esc(d.name || "Клиент")}</b> · ${esc(CH[d.source] || d.source)} · ${esc(d.id)}${d.demo ? " · демо" : ""}</span><span class="tag ${outCls}">${outText}</span></header><ol class="turns">${turns}</ol>${fixes}</article>`;
    }).join("") || `<p class="sub">Разговоров нет. Поговорите с ботом в чате на сайте или в мессенджерах — переписка придёт в CRM и сюда.</p>`;

    const learned = (PR.get().faq || []).filter((f) => f.learned);
    $("learned").innerHTML = learned.length
      ? learned.map((f) => `<li><b>${esc(f.q)}</b><br>${esc(f.a)}<small>опорные слова: ${esc(f.keywords.join(", "))}</small><button type="button" data-forget="${esc(f.q)}">Убрать</button></li>`).join("")
      : `<li class="sub">Пока ничего. Исправьте ответ в разговоре выше.</li>`;
  }

  $("dialogs").addEventListener("submit", (e) => {
    const form = e.target.closest("form.fix");
    if (!form) return;
    e.preventDefault();
    const q = form.dataset.q;
    const a = form.elements.a.value.trim();
    const keywords = form.elements.k.value.split(",").map((x) => x.trim()).filter(Boolean);
    const out = form.querySelector(".result");
    try {
      PR.save(R.addFaq(PR.get(), { q, a, keywords }));
      const now = answerNow(q);
      const ok = now.includes(a.slice(0, 40));
      out.className = "result " + (ok ? "ok" : "bad");
      out.textContent = ok ? `Готово. Теперь агент отвечает: «${now}»` : `Сохранено, но агент пока отвечает иначе: «${now}». Добавьте опорные слова из вопроса.`;
      setTimeout(render, ok ? 2500 : 6000);
    } catch (err) {
      out.className = "result bad";
      out.textContent = err.message;
    }
  });
  $("gaps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto]");
    if (!b) return;
    const el = document.getElementById("dlg-" + b.dataset.goto);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); const t = el.querySelector("textarea"); if (t) t.focus({ preventScroll: true }); }
  });
  $("learned").addEventListener("click", (e) => {
    const b = e.target.closest("[data-forget]");
    if (!b) return;
    const p = PR.get();
    PR.save({ ...p, faq: (p.faq || []).filter((f) => !(f.learned && f.q === b.dataset.forget)) });
    render();
  });
  $("source").addEventListener("change", render);
  $("only-bad").addEventListener("change", render);
  addEventListener("storage", (e) => { if (e.key && (e.key.startsWith("stebel.crm") || e.key === PR.KEY)) render(); });
  render();
})();
