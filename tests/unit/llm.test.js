// Нейросеть в диалоге: живая речь от модели, факты — от системы. Модели здесь поддельные.
const test = require("node:test");
const assert = require("node:assert/strict");
const llm = require("../../js/llm.js");
const bot = require("../../js/bot.js");
const S = require("../../js/store.js");
const profile = require("../../js/profile.js");

const NOW = new Date("2026-10-21T07:30:00Z");
function ctx() {
  const store = S.createStore({ storage: S.memoryStorage(), now: () => NOW });
  return { store, now: () => NOW, create: (i) => store.create(i), lookup: (id) => store.get(id) };
}
// Поддельная модель: отвечает тем, что вернёт say(промпт).
const fakeModel = (say, log = []) => async (url, init) => {
  const body = JSON.parse(init.body);
  log.push({ url, body });
  const text = say(body);
  if (url.endsWith("/api/chat")) return new Response(JSON.stringify({ message: { role: "assistant", content: text } }));
  if (url.endsWith("/chat/completions")) return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
  return new Response(JSON.stringify({ text }));
};
const lastDraft = (body) => body.messages.at(-1).content.split("ЧЕРНОВИК СИСТЕМЫ (факты не менять):\n")[1];

test("Ollama: модель переписывает ответ, кнопки и карточки остаются от системы", async () => {
  const c = ctx();
  const log = [];
  const cfg = { provider: "ollama", url: "http://localhost:11434", model: "qwen2.5:7b" };
  const r = await llm.reply(bot.start().state, { text: "хочу пионы маме на завтра" }, c, {
    cfg, history: [{ from: "client", text: "хочу пионы маме на завтра" }],
    fetchImpl: fakeModel(() => JSON.stringify({ reply: "Какой хороший повод! Для мамы подойдут нежные букеты — посмотрите варианты ниже." }), log),
  });
  assert.equal(r.meta.by, "llm");
  assert.equal(r.messages.length, 1);
  assert.match(r.messages[0].text, /Какой хороший повод/);
  assert.ok(r.messages[0].options.length > 0 && r.messages[0].cards.length > 0);
  assert.equal(log[0].url, "http://localhost:11434/api/chat");
  assert.equal(log[0].body.format, "json");
  assert.match(log[0].body.messages[0].content, /Обращайся на «вы»/);
  assert.match(log[0].body.messages.at(-1).content, /^Клиент: хочу пионы маме на завтра/);
});

test("OpenAI-совместимый (LM Studio, OpenAI): адрес, ключ и формат JSON", async () => {
  const log = [];
  const cfg = { provider: "openai", url: "https://api.example.com/v1/", model: "gpt-x", key: "sk-test" };
  const raw = await llm.complete(cfg, { system: "s", messages: [{ role: "user", content: "привет" }] }, async (url, init) => {
    log.push({ url, init });
    return new Response(JSON.stringify({ choices: [{ message: { content: "{\"reply\":\"ok\"}" } }] }));
  });
  assert.equal(raw, "{\"reply\":\"ok\"}");
  assert.equal(log[0].url, "https://api.example.com/v1/chat/completions");
  assert.equal(log[0].init.headers.Authorization, "Bearer sk-test");
  assert.deepEqual(JSON.parse(log[0].init.body).response_format, { type: "json_object" });
});

test("свой сервер: браузер шлёт разговор на /llm, ключей у браузера нет", async () => {
  const log = [];
  const raw = await llm.complete({ provider: "server", url: "https://bot.example.dev", model: "claude" }, { system: "s", messages: [] }, async (url, init) => {
    log.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return new Response(JSON.stringify({ text: "{\"reply\":\"ok\"}" }));
  });
  assert.equal(raw, "{\"reply\":\"ok\"}");
  assert.equal(log[0].url, "https://bot.example.dev/llm");
  assert.equal(log[0].body.provider, "claude");
  assert.equal(log[0].headers.Authorization, undefined);
});

test("факты защищены: выдуманная цена, потерянный номер, паразиты, «вы» в режиме «ты» — откат на ответ бота", async () => {
  const c = ctx();
  let r = bot.start();
  for (const t of ["бордо на завтра утром, заберу сам", "Игорь", "9037654321"]) r = bot.reply(r.state, { text: t }, c);
  const cfg = { provider: "ollama" };
  const bad = [
    ["Итого всего 5 900 ₽, скидка для вас!", /выдуманная сумма/],
    ["Готово, оформляю! Как бы всё верно?", /потерян факт|слово-паразит/],
    ["", /пустой ответ/],
  ];
  for (const [replyText, why] of bad) {
    const out = await llm.reply(r.state, { text: "да" }, c, { cfg, fetchImpl: fakeModel(() => JSON.stringify({ reply: replyText })) });
    assert.equal(out.meta.by, "rules");
    assert.match(out.meta.fallback.join("; "), why);
    assert.match(out.messages[0].text, /Заказ СТ-\d+ принят/, "клиент всё равно получает правильный ответ");
  }
});

test("модель сохраняет все факты — ответ принимается", async () => {
  const c = ctx();
  let r = bot.start();
  for (const t of ["бордо на завтра утром, заберу сам", "Игорь", "9037654321"]) r = bot.reply(r.state, { text: t }, c);
  const out = await llm.reply(r.state, { text: "да" }, c, {
    cfg: { provider: "ollama" },
    fetchImpl: fakeModel((body) => {
      const id = lastDraft(body).match(/СТ-\d+/)[0];
      return JSON.stringify({ reply: `Спасибо, Игорь! Заказ ${id} принят. Флорист позвонит в течение 15 минут, подтвердит детали и пришлёт ссылку на оплату. Если что-то понадобится — пишите сюда.` });
    }),
  });
  assert.equal(out.meta.by, "llm");
  assert.equal(c.store.list().length, 1, "заказ создан один раз, системой");
});

test("режим «на ты»: модель получает тон, а ответ на «вы» отклоняется", async () => {
  const p = profile.merge(profile.DEFAULT, { tone: { address: "ты", greeting: "Привет!" } });
  const c = { ...ctx(), profile: p };
  const out = await llm.reply(bot.start({ profile: p }).state, { text: "привет" }, c, {
    cfg: { provider: "ollama" },
    fetchImpl: fakeModel((body) => {
      assert.match(body.messages[0].content, /Обращайся на «ты»/);
      return JSON.stringify({ reply: "Здравствуйте! Чем вам помочь?" });
    }),
  });
  assert.equal(out.meta.by, "rules");
  assert.match(out.meta.fallback.join(), /обращение на «вы»/);
});

test("модель молчит дольше лимита — клиент не ждёт, отвечает бот", async () => {
  const c = ctx();
  const out = await llm.reply(bot.start().state, { text: "привет" }, c, {
    cfg: { provider: "ollama", timeoutMs: 50 },
    fetchImpl: () => new Promise(() => {}),
  });
  assert.equal(out.meta.by, "rules");
  assert.match(out.meta.fallback[0], /нет ответа/);
});

test("ответ модели в ``` или с текстом вокруг всё равно читается", () => {
  assert.equal(llm.parseReply("Вот ответ:\n```json\n{\"reply\": \"Привет!\"}\n```"), "Привет!");
  assert.equal(llm.parseReply("не JSON"), null);
  assert.equal(llm.parseReply({ reply: "ok" }), "ok");
});

test("без нейросети — обычный бот, сеть не трогаем", async () => {
  const c = ctx();
  const out = await llm.reply(bot.start().state, { text: "привет" }, c, { cfg: { provider: "none" }, fetchImpl: () => { throw new Error("сеть не нужна"); } });
  assert.equal(out.meta.by, "rules");
});

test("история для модели: последние 8 реплик и черновик системы в конце", () => {
  const h = Array.from({ length: 12 }, (_, i) => ({ from: i % 2 ? "bot" : "client", text: "m" + i }));
  const msgs = llm.buildMessages(h, "черновик");
  assert.ok(msgs.length <= 8);
  assert.match(msgs.at(-1).content, /ЧЕРНОВИК СИСТЕМЫ/);
  assert.equal(msgs.at(-1).role, "user");
  assert.equal(msgs[0].role, "user", "разговор начинается с клиента");
});
