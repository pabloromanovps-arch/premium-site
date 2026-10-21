// Те же сценарии, что на пульте тестирования (lab.html), — прогоняются без браузера.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../js/store.js");
const sim = require("../../js/sim.js");
const { SCENARIOS, run } = require("../../js/scenarios.js");

function env() {
  const storage = S.memoryStorage();
  const s = sim.createSim({ storage, sleep: () => Promise.resolve() });
  return { sim: s, store: S.createStore({ storage, now: s.now, webhook: s.webhook, onEvent: s.notify }) };
}

for (const sc of SCENARIOS) {
  test(`сценарий: ${sc.title}`, async () => {
    const res = await run(sc, env());
    const failed = res.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    assert.deepEqual(failed, []);
    assert.ok(res.checks.length >= 4);
  });
}

test("все сценарии подряд на одном окружении", async () => {
  const e = env();
  for (const sc of SCENARIOS) assert.equal((await run(sc, e)).ok, true, sc.title);
});

test("сценарии восстанавливают настройки симуляции", async () => {
  const e = env();
  e.sim.setSettings({ offsetMs: 12345 });
  await run(SCENARIOS.find((s) => s.id === "evening"), e);
  await run(SCENARIOS.find((s) => s.id === "telegram-down"), e);
  assert.equal(e.sim.settings().offsetMs, 12345);
  assert.equal(e.sim.settings().tgDown, false);
});

test("сломанная проверка показывается как провал, а не как успех", async () => {
  const res = await run({ id: "x", title: "x", run: async (_, t) => { t.ok("A", true); throw new Error("упало"); } }, env());
  assert.equal(res.ok, false);
  assert.equal(res.checks.at(-1).detail, "упало");
});

test("все сценарии можно прогнать несколько раз подряд — как на пульте и вдвоём", async () => {
  const e = env();
  for (let round = 1; round <= 3; round++) {
    for (const sc of SCENARIOS) {
      const res = await run(sc, e);
      assert.deepEqual(res.checks.filter((c) => !c.ok).map((c) => `${round}: ${c.name}: ${c.detail}`), [], sc.title);
    }
  }
  assert.equal(e.store.list({ q: "Нагрузка" }).length, 0, "нагрузочные заявки убраны за собой");
});
