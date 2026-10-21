// Оболочка стенда: вкладки разделов и общий режим.
// Разделы открываются во фрейме и хранят данные в localStorage (он общий с оболочкой).
// Оболочка сливает CRM и журнал отправок с общей базой опубликованной страницы,
// поэтому все участники видят одни и те же заявки. Вне claude.ai стенд работает локально.
(function () {
  const { sync } = Flora;
  const KEYS = { crm: "stebel.crm.v1", outbox: "stebel.outbox.v1", cleared: "stebel.outbox.cleared" };
  const PAGES = { start: "start.html", shop: "shop.html", channels: "channels.html", crm: "crm.html", lab: "lab.html", pay: "pay.html" };
  const DOC_LIMIT = 240000;
  const $ = (id) => document.getElementById(id);
  const frame = $("frame");

  // ---------- вкладки ----------
  function pageFromHash() {
    const [name, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
    return { name: PAGES[name] ? name : "start", sub: rest.join("/") };
  }
  function markTab(name) {
    document.querySelectorAll("#tabs a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === "#" + name ? "page" : "false"));
  }
  function framePath() {
    try { return frame.contentWindow.location.pathname.split("/").pop() + frame.contentWindow.location.hash; } catch (e) { return ""; }
  }
  function open() {
    const { name, sub } = pageFromHash();
    markTab(name);
    const want = PAGES[name] + (sub ? "#" + encodeURIComponent(sub) : "");
    if (framePath() !== want) frame.src = want;
  }
  // Переходы по ссылкам внутри раздела отражаются во вкладках и адресе.
  frame.addEventListener("load", () => {
    let file = "";
    try { file = frame.contentWindow.location.pathname.split("/").pop(); } catch (e) { return; }
    const name = Object.keys(PAGES).find((k) => PAGES[k] === file);
    if (!name) return;
    markTab(name);
    if (pageFromHash().name !== name) history.replaceState(null, "", "#" + name);
    try { frame.contentDocument.title && (document.title = "Стебель — " + frame.contentDocument.title.replace(/ — Стебель$/, "")); } catch (e) { /* без заголовка */ }
  });
  addEventListener("hashchange", open);
  open();

  // ---------- общий режим ----------
  const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* без локальной копии */ } };
  const status = (state, text) => { $("sync").dataset.state = state; $("sync").textContent = text; };

  let db = null;
  let writable = true;
  const remote = { crm: null, outbox: null, cleared: 0, crmSeen: false, outboxSeen: false };
  let chain = Promise.resolve();
  let timer = null;

  // Общая копия → своя. Если у себя есть то, чего нет в общей, — отправляем.
  function pull() {
    const local = read(KEYS.crm);
    const merged = sync.mergeCrm(local, remote.crm).db;
    if (sync.canonCrm(merged) !== sync.canonCrm(local)) write(KEYS.crm, JSON.stringify(merged));

    const cleared = Math.max(Number(read(KEYS.cleared)) || 0, remote.cleared || 0);
    if (cleared > (Number(read(KEYS.cleared)) || 0)) write(KEYS.cleared, String(cleared));
    const ob = sync.mergeOutbox(read(KEYS.outbox), remote.outbox, cleared);
    if (sync.canonOutbox(ob) !== sync.canonOutbox(read(KEYS.outbox))) write(KEYS.outbox, JSON.stringify(ob));

    if (sync.canonCrm(merged) !== sync.canonCrm(remote.crm) || sync.canonOutbox(ob) !== sync.canonOutbox(remote.outbox) || cleared > (remote.cleared || 0)) schedulePush();
  }

  // Своя копия → общая. Одна запись в документ за раз.
  async function push() {
    if (!db || !writable || !remote.crmSeen || !remote.outboxSeen) return;
    const merged = sync.mergeCrm(read(KEYS.crm), remote.crm).db;
    const crmStr = JSON.stringify(merged);
    if (crmStr.length > DOC_LIMIT) {
      status("full", "Общая база стенда заполнена. Удалите тестовые заявки на пульте.");
      return;
    }
    if (sync.canonCrm(merged) !== sync.canonCrm(remote.crm)) {
      await db.doc("stand/crm").set({ data: crmStr });
      remote.crm = crmStr;
    }
    if (sync.canonCrm(merged) !== sync.canonCrm(read(KEYS.crm))) write(KEYS.crm, crmStr);

    const cleared = Math.max(Number(read(KEYS.cleared)) || 0, remote.cleared || 0);
    const ob = sync.mergeOutbox(read(KEYS.outbox), remote.outbox, cleared);
    if (sync.canonOutbox(ob) !== sync.canonOutbox(remote.outbox) || cleared > (remote.cleared || 0)) {
      await db.doc("stand/outbox").set({ data: JSON.stringify(ob), clearedAt: cleared });
      remote.outbox = ob;
      remote.cleared = cleared;
    }
  }

  function schedulePush() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      chain = chain.then(push).catch(onWriteError);
    }, 400);
  }

  function onWriteError(e) {
    const code = e && e.code;
    if (code === "invalid_argument" || code === "not_granted") {
      writable = false;
      status("readonly", "Вы видите общие заявки, но ваши заказы остаются только у вас. Попросите владельца пригласить вас по email как редактора.");
    } else if (code === "quota_exceeded") {
      status("full", "Общая база стенда заполнена. Удалите тестовые заявки на пульте.");
    } else {
      setTimeout(schedulePush, 2000 + Math.random() * 2000);
    }
  }

  // Изменения из разделов (они во фрейме) приходят событием storage.
  addEventListener("storage", (e) => {
    if (e.key === KEYS.crm || e.key === KEYS.outbox || e.key === KEYS.cleared || e.key === null) schedulePush();
  });

  async function connect() {
    if (!window.claude || typeof window.claude.use !== "function") {
      status("local", "Локальный режим: заказы видны только в этом браузере.");
      return;
    }
    db = await window.claude.use("db");
    if (!db) {
      status("local", "Локальный режим: заказы видны только в этом браузере.");
      return;
    }
    const user = await window.claude.use("user");
    const can = user ? await user.can("data.write") : null;
    if (can === false) {
      writable = false;
      status("readonly", "Вы видите общие заявки, но ваши заказы остаются только у вас. Попросите владельца пригласить вас по email как редактора.");
    } else {
      status("shared", "Общий режим: заявки и журнал видят все участники стенда.");
    }
    const fail = (e) => { if (e && e.code === "revoked") status("local", "Общий режим отключён: доступ к странице изменился."); };
    db.doc("stand/crm").onSnapshot((snap) => {
      remote.crm = snap.exists ? snap.data().data : null;
      remote.crmSeen = true;
      pull();
    }, fail);
    db.doc("stand/outbox").onSnapshot((snap) => {
      const d = snap.exists ? snap.data() : {};
      remote.outbox = d.data || null;
      remote.cleared = Number(d.clearedAt) || 0;
      remote.outboxSeen = true;
      pull();
    }, fail);
  }
  connect();
})();
