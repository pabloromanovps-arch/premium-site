// Слияние данных стенда между участниками: CRM и журнал отправок.
// Каждый работает со своей копией в браузере, а общая копия лежит в базе опубликованной страницы.
// Слияние не теряет заявки, созданные одновременно, и перенумеровывает заявки с совпавшими номерами.
(function (root, factory) {
  const mod = factory();
  if (typeof module === "object" && module.exports) module.exports = mod;
  else (root.Flora = root.Flora || {}).sync = mod;
})(typeof self !== "undefined" ? self : this, function () {
  const DELETED_LIMIT = 5000;
  const OUTBOX_LIMIT = 300;

  const parse = (s) => {
    if (!s) return null;
    if (typeof s !== "string") return s;
    try { return JSON.parse(s); } catch (e) { return null; }
  };
  const digits = (id) => Number(String(id).replace(/\D/g, "")) || 0;
  const lastAt = (r) => (r.history && r.history.length ? r.history[r.history.length - 1].at : r.createdAt);
  const histKey = (h) => [h.at, h.type, h.status || "", h.text || "", h.by || ""].join("|");

  function normCrm(x) {
    const d = parse(x) || {};
    return { seq: Number(d.seq) || 1000, items: Array.isArray(d.items) ? d.items : [], deleted: Array.isArray(d.deleted) ? d.deleted : [] };
  }

  // Одна и та же заявка — если совпадают время создания и телефон.
  const sameRecord = (a, b) => a.createdAt === b.createdAt && a.customer && b.customer && a.customer.phone === b.customer.phone && a.kind === b.kind;

  function unionHistory(a, b) {
    const seen = new Map();
    for (const h of [...a, ...b]) seen.set(histKey(h), h);
    return [...seen.values()].sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
  }

  // Сливает две копии CRM. remote — общая, local — своя. Возвращает новую копию и список перенумерованных.
  function mergeCrm(localRaw, remoteRaw) {
    const local = normCrm(localRaw);
    const remote = normCrm(remoteRaw);
    const deleted = [...new Set([...remote.deleted, ...local.deleted])].slice(-DELETED_LIMIT);
    const gone = new Set(deleted);
    const byId = new Map();
    for (const r of remote.items) byId.set(r.id, r);
    let seq = Math.max(local.seq, remote.seq, ...[...local.items, ...remote.items].map((r) => digits(r.id)));
    const renumbered = [];

    for (const r of local.items) {
      const other = byId.get(r.id);
      if (!other) { byId.set(r.id, r); continue; }
      if (sameRecord(other, r)) {
        const newer = lastAt(r) > lastAt(other) || (lastAt(r) === lastAt(other) && r.history.length > other.history.length) ? r : other;
        const history = unionHistory(other.history || [], r.history || []);
        // Статус и оплату берём из объединённой истории: правки обоих участников учитываются.
        const lastStatus = history.filter((h) => h.type === "status").pop();
        const merged = { ...newer, history, status: lastStatus ? lastStatus.status : newer.status };
        if (merged.kind === "order") merged.payment = history.some((h) => h.type === "payment" && h.ok) ? "paid" : newer.payment;
        byId.set(r.id, merged);
        continue;
      }
      // Два разных заказа получили один номер: общий оставляем, свой перенумеровываем.
      seq += 1;
      const id = r.id.replace(/\d+$/, String(seq));
      byId.set(id, { ...r, id, history: (r.history || []).concat({ at: lastAt(r), type: "comment", by: "Система", text: `Номер изменён с ${r.id}: такой номер уже был у заказа другого участника стенда.` }) });
      renumbered.push({ from: r.id, to: id });
    }

    const items = [...byId.values()]
      .filter((r) => !gone.has(r.id))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : digits(a.id) - digits(b.id)));
    return { db: { seq, items, deleted }, renumbered };
  }

  // Журнал: объединение по уникальному номеру записи; очистка журнала действует на записи до её момента.
  const entryTime = (e) => Number(String(e.n || "").split("-")[0]) || 0;
  function mergeOutbox(localList, remoteList, clearedAt = 0) {
    const all = new Map();
    for (const e of [...(parse(remoteList) || []), ...(parse(localList) || [])]) if (e && e.n) all.set(e.n, e);
    return [...all.values()]
      .filter((e) => entryTime(e) > clearedAt)
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : entryTime(b) - entryTime(a)))
      .slice(0, OUTBOX_LIMIT);
  }

  // Устойчивое сравнение: одинаковые данные дают одинаковую строку независимо от порядка.
  function canonCrm(x) {
    const d = normCrm(x);
    return JSON.stringify({ seq: d.seq, items: [...d.items].sort((a, b) => (a.id < b.id ? -1 : 1)), deleted: [...d.deleted].sort() });
  }
  const canonOutbox = (list) => JSON.stringify([...(parse(list) || [])].map((e) => e.n).sort());

  return { mergeCrm, mergeOutbox, canonCrm, canonOutbox, normCrm };
});
