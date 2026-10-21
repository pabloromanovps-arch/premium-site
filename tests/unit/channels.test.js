// Каналы: Telegram, ВКонтакте, MAX, Алиса. Входящие события — в формате платформ.
const test = require("node:test");
const assert = require("node:assert/strict");
const ch = require("../../js/channels.js");
const bot = require("../../js/bot.js");
const S = require("../../js/store.js");

const NOW = new Date("2026-10-21T07:30:00Z");

function deps() {
  const store = S.createStore({ storage: S.memoryStorage(), now: () => NOW });
  const map = new Map();
  return {
    store,
    sessions: { get: async (k) => map.get(k), set: async (k, v) => map.set(k, v) },
    ctx: { now: () => NOW, create: (i) => store.create(i), lookup: (id) => store.get(id) },
  };
}

// Фабрики входящих событий в формате каждой платформы
const tg = {
  text: (text) => ({ update_id: 1, message: { message_id: 10, chat: { id: 555, type: "private" }, from: { id: 555 }, text } }),
  press: (call, label) => {
    const kb = call.body.reply_markup.inline_keyboard;
    const btn = kb.flat().find((b) => (label instanceof RegExp ? label.test(b.text) : b.text === label));
    assert.ok(btn, `нет кнопки ${label}`);
    return { update_id: 2, callback_query: { id: "cq1", from: { id: 555 }, data: btn.callback_data, message: { message_id: 11, chat: { id: 555 }, reply_markup: { inline_keyboard: kb } } } };
  },
};
const vk = {
  text: (text) => ({ type: "message_new", group_id: 1, secret: "s", object: { message: { peer_id: 2000000001, from_id: 7, text } } }),
  press: (call, label) => {
    const btn = JSON.parse(call.body.keyboard).buttons.flat().find((b) => (label instanceof RegExp ? label.test(b.action.label) : b.action.label === label));
    assert.ok(btn, `нет кнопки ${label}`);
    return { type: "message_new", group_id: 1, object: { message: { peer_id: 2000000001, from_id: 7, text: btn.action.label, payload: btn.action.payload } } };
  },
};
const max = {
  started: () => ({ update_type: "bot_started", chat_id: 9001, user: { user_id: 1 } }),
  text: (text) => ({ update_type: "message_created", message: { recipient: { chat_id: 9001 }, sender: { user_id: 1 }, body: { mid: "m1", text } } }),
  press: (call, label) => {
    const btn = call.body.attachments[0].payload.buttons.flat().find((b) => (label instanceof RegExp ? label.test(b.text) : b.text === label));
    assert.ok(btn, `нет кнопки ${label}`);
    return { update_type: "message_callback", callback: { callback_id: "cb1", payload: btn.payload }, message: { recipient: { chat_id: 9001 } } };
  },
};
const alice = {
  req: (text, { isNew = false, payload, state } = {}) => ({
    version: "1.0",
    session: { session_id: "sess-1", message_id: 1, new: isNew, user: { user_id: "u1" } },
    request: { command: (text || "").toLowerCase(), original_utterance: text || "", type: payload ? "ButtonPressed" : "SimpleUtterance", payload },
    state: state ? { session: state } : {},
  }),
};
const lastWithKb = (calls, key) => [...calls].reverse().find(key);

test("Telegram: /start, заказ кнопками и текстом, ответ на нажатие", async () => {
  const d = deps();
  let r = await ch.handle("telegram", tg.text("/start"), d);
  assert.equal(r.calls[0].method, "sendMessage");
  assert.equal(r.calls[0].body.chat_id, "555");
  let kb = lastWithKb(r.calls, (c) => c.body.reply_markup);
  r = await ch.handle("telegram", tg.press(kb, "Подобрать букет"), d);
  assert.equal(r.calls[0].method, "answerCallbackQuery", "нажатие подтверждается, чтобы у кнопки пропали часики");
  r = await ch.handle("telegram", tg.text("пионы маме завтра вечером, доставка"), d);
  kb = lastWithKb(r.calls, (c) => c.body.reply_markup);
  assert.match(kb.body.text, /• Утро на даче — 3 900 ₽/, "букеты списком в тексте");
  r = await ch.handle("telegram", tg.press(kb, /^Утро на даче/), d);
  for (const t of ["Остоженка 7, кв 12", "Мария", "+7 916 123-45-67"]) r = await ch.handle("telegram", tg.text(t), d);
  kb = lastWithKb(r.calls, (c) => c.body.reply_markup);
  r = await ch.handle("telegram", tg.press(kb, "Всё верно, оформить"), d);
  assert.match(r.calls.at(-1).body.text, /Заказ СТ-1001 принят/);
  assert.equal(d.store.get("1001").source, "telegram");
});

test("ВКонтакте: подтверждение сервера, кнопки с payload, заказ с источником vk", async () => {
  const d = deps();
  assert.equal((await ch.handle("vk", { type: "confirmation", group_id: 1 }, d)).kind, "confirmation");
  assert.equal((await ch.handle("vk", { type: "message_reply", object: {} }, d)).kind, "ignore");
  let r = await ch.handle("vk", vk.text("Начать"), d);
  let kb = lastWithKb(r.calls, (c) => c.body.keyboard);
  assert.equal(JSON.parse(kb.body.keyboard).inline, true);
  r = await ch.handle("vk", vk.press(kb, "Позвать флориста"), d);
  r = await ch.handle("vk", vk.text("Анна 89261112233"), d);
  assert.match(r.calls.at(-1).body.message, /ЗВ-1001/);
  assert.equal(d.store.get("1001").source, "vk");
  assert.ok(Number.isInteger(r.calls[0].body.random_id));
});

test("MAX: bot_started, нажатия через message_callback с ответом /answers", async () => {
  const d = deps();
  let r = await ch.handle("max", max.started(), d);
  assert.deepEqual(r.calls[0].query, { chat_id: "9001" });
  let kb = lastWithKb(r.calls, (c) => c.body.attachments);
  r = await ch.handle("max", max.press(kb, "Доставка и оплата"), d);
  assert.equal(r.calls[0].method, "POST /answers");
  assert.match(r.calls[1].body.text, /490/);
  r = await ch.handle("max", max.text("бордо на завтра утром, заберу сам"), d);
  for (const t of ["Игорь", "9037654321", "да"]) r = await ch.handle("max", max.text(t), d);
  assert.match(r.calls.at(-1).body.text, /СТ-1001 принят/);
  assert.equal(d.store.get("1001").source, "max");
});

test("Алиса: состояние живёт в session_state, голос без символов и ссылок", async () => {
  const d = deps();
  let r = await ch.handle("alice", alice.req("", { isNew: true }), d);
  let res = r.calls[0].body;
  assert.equal(res.version, "1.0");
  assert.equal(res.response.end_session, false);
  assert.ok(res.response.buttons.length > 0);
  let state = res.session_state;

  r = await ch.handle("alice", alice.req("хочу тюльпаны на завтра", { state }), d);
  res = r.calls[0].body;
  assert.match(res.response.text, /25 тюльпанов — 3 200 ₽/);
  assert.match(res.response.tts, /3200 рублей/);
  assert.doesNotMatch(res.response.tts, /[₽«»•]/);
  state = res.session_state;

  const btn = res.response.buttons.find((b) => /тюльпанов/.test(b.title));
  r = await ch.handle("alice", alice.req(btn.title, { payload: btn.payload, state }), d);
  assert.equal(r.state.draft.product, "tulip");
});

test("Алиса: номер заказа произносится по буквам", () => {
  assert.equal(ch.speak("Заказ СТ-1001 принят"), "Заказ эс тэ 1001 принят");
});

test("разные чаты одного канала не путаются", async () => {
  const d = deps();
  await ch.handle("telegram", tg.text("тюльпаны"), d);
  const other = { update_id: 3, message: { chat: { id: 777 }, text: "привет" } };
  const r = await ch.handle("telegram", other, d);
  assert.equal(r.state.step, "menu");
  assert.equal((await d.sessions.get("telegram:555")).step, "product");
});

test("служебные события игнорируются", async () => {
  const d = deps();
  assert.equal((await ch.handle("telegram", { update_id: 1, edited_message: {} }, d)).kind, "ignore");
  assert.equal((await ch.handle("max", { update_type: "message_edited" }, d)).kind, "ignore");
  await assert.rejects(ch.handle("whatsapp", {}, d), /Неизвестный канал/);
});

// Обходим все состояния бота, до которых можно дойти кнопками и типичными фразами,
// и проверяем каждый ответ на ограничения всех платформ.
test("контракт: каждый ответ бота укладывается в ограничения Telegram, VK, MAX и Алисы", () => {
  const store = S.createStore({ storage: S.memoryStorage(), now: () => NOW });
  store.create({ kind: "order", source: "site", name: "М", phone: "+79161234567", fulfillment: "delivery", address: "Остоженка 7", date: "2026-10-22", slot: "9-12", items: [{ id: "pole", name: "Полевой", price: 2400, qty: 1 }] });
  const ctx = { now: () => NOW, create: (i) => store.create(i), lookup: (id) => store.get(id) };
  const TEXTS = {
    menu: ["привет", "хочу розы до 4000 на завтра вечером", "сколько стоит доставка", "абракадабра"],
    product: ["тюльпаны", "подороже", "лилии"],
    date: ["в субботу", "сегодня", "когда-нибудь"],
    date_custom: ["25.10", "31.02"],
    slot: ["вечером", "в 3 ночи"],
    fulfillment: ["заберу сам", "что?"],
    address: ["Тверская улица, дом 7, квартира 12, подъезд 3, домофон 12К, этаж 5, позвонить за час до приезда и не звонить в дверь"],
    name: ["Мария", "ок"],
    phone: ["123", "+7 916 123-45-67"],
    confirm: ["нет", "да"],
    status: ["СТ-1001", "СТ-9999"],
    cb_name: ["Анна"],
    cb_phone: ["9261112233"],
  };
  const seen = new Set();
  const queue = [bot.start()];
  let checked = 0;
  const problems = new Set();
  while (queue.length && seen.size < 4000) {
    const res = queue.shift();
    const key = JSON.stringify([res.state.step, res.state.draft]);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const channel of ["telegram", "vk", "max", "alice"]) {
      const calls = ch.ADAPTERS[channel].render("1", res.messages, {});
      if (channel === "alice") calls[0].body.session_state = { bot: res.state };
      for (const e of ch.checkLimits(channel, calls)) problems.add(`${e} (шаг ${res.state.step})`);
      checked++;
    }
    if (res.state.draft && Object.keys(res.state.draft).length > 9) continue;
    const opts = res.messages.flatMap((m) => m.options || []);
    for (const o of opts) queue.push(bot.reply(res.state, { text: o.label, value: o.value }, ctx));
    for (const t of TEXTS[res.state.step] || []) queue.push(bot.reply(res.state, { text: t }, ctx));
  }
  assert.deepEqual([...problems], []);
  assert.ok(seen.size > 200, `проверено состояний: ${seen.size}`);
  assert.ok(checked > 800);
});
