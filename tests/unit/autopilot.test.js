// Автопилот: сутки работы магазина без людей. Ни одна заявка не должна потеряться.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../js/store.js");
const sim = require("../../js/sim.js");
const AP = require("../../js/autopilot.js");

async function day(mode, hours = 24, seed = 7) {
  const storage = S.memoryStorage();
  const s = sim.createSim({ storage, realNow: () => Date.parse("2026-10-21T05:00:00Z"), sleep: () => Promise.resolve() });
  const ap = AP.create({ mode, seed, storage, sim: s, start: mode === "night" ? "2026-10-21T20:00:00+03:00" : "2026-10-21T08:00:00+03:00" });
  await ap.run(hours * 60);
  return { ap, s, snap: ap.snapshot(), recs: ap.store.list() };
}

test("обычный день: заявки из всех каналов, Авито — главный, бот ответил всем", async () => {
  const { ap, snap, recs } = await day("normal");
  assert.ok(snap.stats.clients >= 40, `клиентов: ${snap.stats.clients}`);
  const by = snap.stats.byChannel;
  assert.ok(Object.keys(by).length >= 6, JSON.stringify(by));
  assert.ok(Object.entries(by).every(([k, n]) => k === "avito" || n <= by.avito), "Авито — самый большой канал");
  assert.ok(snap.stats.botReplies > snap.stats.conversations * 3);
  assert.equal(new Set(recs.map((r) => r.id)).size, recs.length, "номера уникальны");
  assert.ok(recs.every((r) => r.tag === "autopilot"));
  assert.ok(snap.funnel.done > 0, "часть заказов дошла до конца");
  // каждый разговор чем-то закончился или ещё идёт — никто не завис без ответа бота
  for (const c of ap.convs) assert.ok(c.log.length >= 2 && c.log[1].from === "bot", `разговор ${c.id} без ответа бота`);
});

test("никакая заявка не висит без ответа дольше, чем позволяет агент", async () => {
  const { snap, recs, ap } = await day("busy");
  const now = ap.now();
  const stale = recs.filter((r) => r.kind === "order" && r.status === "new" && (now - new Date(r.createdAt)) / 60000 > 45 && ap.store && require("../../js/agent.js").isOpen(now, require("../../js/profile.js").DEFAULT));
  assert.deepEqual(stale.map((r) => r.id), []);
  assert.ok(snap.stats.autoConfirmed > 0, "когда менеджеры заняты, агент подтверждает сам");
  assert.ok(recs.some((r) => r.history.some((h) => h.type === "agent" && h.code === "auto_confirm")));
});

test("брошенные разговоры: агент напоминает, часть клиентов возвращается и оформляет", async () => {
  const { snap, ap } = await day("normal", 24, 11);
  assert.ok(snap.stats.abandoned > 0);
  assert.ok(snap.stats.followUps > 0);
  assert.ok(snap.stats.returned > 0);
  assert.ok(ap.events.some((e) => e.type === "rescued"), "есть спасённые заказы");
  assert.ok(ap.convs.some((c) => c.log.some((m) => m.from === "agent" && /осталось только/.test(m.text))));
});

test("неоплаченные заказы: агент напоминает, клиенты платят после напоминания", async () => {
  const { snap } = await day("normal", 24, 5);
  assert.ok(snap.agent.payReminders > 0);
  assert.ok(snap.stats.paidAfterReminder > 0);
  assert.ok(snap.stats.revenue > 0);
});

test("ночная смена: ночные заявки получают уведомление, менеджеры берут их утром", async () => {
  const { snap, recs } = await day("night", 16);
  assert.ok(snap.stats.night > 0);
  const nightRecs = recs.filter((r) => r.history.some((h) => h.code === "night_notice"));
  assert.ok(nightRecs.length > 0);
  for (const r of nightRecs) {
    const firstHuman = r.history.find((h) => h.type === "status" && h.status !== "new");
    if (firstHuman) assert.ok(new Date(firstHuman.at).getUTCHours() >= 6, `${r.id} подтверждён ночью: ${firstHuman.at}`);
  }
});

test("сбой Telegram: уведомления не уходят, но заявки целы и в работе", async () => {
  const { snap, recs, s } = await day("outage", 10);
  assert.ok(snap.stats.tgFailed > 0);
  assert.equal(s.outbox.list("telegram").length, 0);
  assert.ok(recs.length > 0 && recs.some((r) => r.status !== "new"));
});

test("наплыв перед праздником: заявок втрое больше, агент подхватывает", async () => {
  const normal = (await day("normal", 12)).snap;
  const rush = (await day("rush", 12)).snap;
  assert.ok(rush.stats.clients > normal.stats.clients * 2);
  assert.ok(rush.agent.touched > 0);
});

test("один и тот же seed — один и тот же день", async () => {
  const a = (await day("normal", 6, 42)).snap.stats;
  const b = (await day("normal", 6, 42)).snap.stats;
  assert.deepEqual(a, b);
});
