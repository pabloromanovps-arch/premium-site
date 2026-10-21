// Бот в Telegram, ВКонтакте, MAX и Алисе через симулятор мессенджеров.
const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

watchErrors(test);

const phone = (page, ch) => page.locator(`.phone[data-ch="${ch}"]`);
async function type(page, ch, text) {
  const p = phone(page, ch);
  await p.locator(".composer input").fill(text);
  await p.locator(".composer input").press("Enter");
}

test("Telegram: заказ текстом и кнопками, попадает в CRM с меткой канала", async ({ page }) => {
  await page.goto("/channels.html");
  const tg = phone(page, "telegram");
  await expect(tg.locator(".bubble").first()).toContainText("Здравствуйте");
  await type(page, "telegram", "пионы маме на завтра вечером, доставка");
  await tg.locator(".kb button:not([disabled])", { hasText: "Утро на даче" }).click();
  await type(page, "telegram", "Остоженка 7, кв 12");
  await type(page, "telegram", "Мария");
  await type(page, "telegram", "+7 916 123-45-67");
  await tg.locator(".kb button:not([disabled])", { hasText: "Всё верно, оформить" }).click();
  await expect(tg.locator(".bubble").last()).toContainText("принят");
  const id = (await tg.locator(".bubble").last().textContent()).match(/СТ-\d+/)[0];

  await tg.locator(".raw summary").click();
  await expect(tg.locator(".limits")).toHaveText("Ограничения платформы соблюдены.");
  await expect(tg.locator(".raw pre")).toContainText('"method": "sendMessage"');

  await page.goto("/crm.html");
  await expect(page.locator(`.deal[data-id="${id}"]`)).toContainText("Telegram");
});

test("ВКонтакте: просьба перезвонить становится заявкой на звонок", async ({ page }) => {
  await page.goto("/channels.html");
  const vk = phone(page, "vk");
  await vk.locator(".kb button:not([disabled])", { hasText: "Позвать флориста" }).click();
  await type(page, "vk", "Анна 89261112233");
  await expect(vk.locator(".bubble").last()).toContainText("ЗВ-");
  await vk.locator(".raw summary").click();
  await expect(vk.locator(".raw pre")).toContainText('"method": "messages.send"');
  await page.goto("/crm.html");
  await expect(page.locator(".deal").filter({ hasText: "ВКонтакте" })).toContainText("Анна");
});

test("MAX: кнопки работают через callback, вопрос о доставке", async ({ page }) => {
  await page.goto("/channels.html");
  const mx = phone(page, "max");
  await mx.locator(".kb button:not([disabled])", { hasText: "Доставка и оплата" }).click();
  await expect(mx.locator(".bubble").last()).toContainText("490");
  await mx.locator(".raw summary").click();
  await expect(mx.locator(".raw pre")).toContainText('"update_type": "message_callback"');
});

test("Алиса: подсказки-кнопки, голосовой текст и заказ", async ({ page }) => {
  await page.goto("/channels.html");
  const al = phone(page, "alice");
  await expect(al.locator(".tts").first()).toContainText("Алиса произнесёт");
  await type(page, "alice", "бордо на завтра утром, заберу сам");
  await type(page, "alice", "Игорь");
  await type(page, "alice", "9037654321");
  await al.locator(".suggest button", { hasText: "Всё верно, оформить" }).click();
  await expect(al.locator(".bubble").last()).toContainText("принят");
  await expect(al.locator(".tts").last()).toContainText("эс тэ");
  await page.goto("/crm.html");
  await expect(page.locator(".deal").filter({ hasText: "Алиса" })).toContainText("Игорь");
});

test("диалог в мессенджере переживает перезагрузку, «Начать заново» его сбрасывает", async ({ page }) => {
  await page.goto("/channels.html");
  await type(page, "telegram", "хочу тюльпаны");
  await page.reload();
  await expect(phone(page, "telegram").locator(".bubble.me")).toHaveText(["хочу тюльпаны"]);
  await phone(page, "telegram").getByRole("button", { name: "Начать заново" }).click();
  await expect(phone(page, "telegram").locator(".bubble.me")).toHaveCount(0);
});
