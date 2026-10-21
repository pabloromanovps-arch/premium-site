// Живые примеры: разнообразные и созданные настоящими разговорами с ботом.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../js/store.js");
const sim = require("../../js/sim.js");
const demo = require("../../js/demo.js");

for (const [label, time] of [["днём", "2026-10-21T09:00:00Z"], ["поздно вечером", "2026-10-21T19:40:00Z"], ["ночью", "2026-10-21T23:30:00Z"]]) {
  test(`примеры собираются полностью и разнообразно (${label})`, () => {
    const storage = S.memoryStorage();
    const real = Date.parse(time);
    const s = sim.createSim({ storage, realNow: () => real });
    const ids = demo.fill({ storage, sim: s, realNow: () => real });
    const total = demo.CUSTOMERS.length + demo.SITE.length;
    assert.equal(ids.length, total, "каждый пример стал заявкой");
    const recs = S.createStore({ storage }).list();
    assert.equal(recs.length, total);
    assert.equal(new Set(recs.map((r) => r.id)).size, total);
    assert.equal(new Set(recs.map((r) => r.customer.name)).size, total, "все клиенты разные");
    assert.deepEqual([...new Set(recs.map((r) => r.source))].sort(), ["alice", "chat", "max", "site", "telegram", "vk"]);
    const products = new Set(recs.filter((r) => r.kind === "order").flatMap((r) => r.items.map((i) => i.id)));
    assert.ok(products.size >= 7, `букетов: ${products.size}`);
    const statuses = new Set(recs.map((r) => r.status));
    assert.ok(statuses.size >= 5, `этапов: ${[...statuses].join(", ")}`);
    assert.ok(recs.some((r) => r.payment === "paid") && recs.some((r) => r.kind === "order" && r.payment === "unpaid"));
    assert.ok(recs.some((r) => r.kind === "callback"));
    assert.ok(recs.some((r) => r.fulfillment === "pickup") && recs.some((r) => r.fulfillment === "delivery"));
    const bots = recs.filter((r) => r.source !== "site");
    assert.ok(bots.every((r) => r.dialog && r.dialog.some((d) => d.from === "client") && r.dialog.some((d) => d.from === "bot")), "у заявок из чатов есть переписка");
    assert.ok(recs.some((r) => r.history.some((h) => h.by === "Клиент")), "есть просьбы клиентов");
    assert.ok(recs.some((r) => r.history.some((h) => h.type === "comment" && h.by === "Менеджер")), "есть комментарии менеджеров");
    assert.ok(recs.some((r) => r.note), "есть тексты открыток");
    assert.ok(recs.every((r) => Date.parse(r.createdAt) <= real), "нет заявок из будущего");
    assert.ok(s.outbox.list("sms").length > 5, "клиентам ушли SMS");
  });
}
