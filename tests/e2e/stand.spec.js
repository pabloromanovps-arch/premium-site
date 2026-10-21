// Оболочка стенда: вкладки, разделы во фрейме, локальный режим вне claude.ai.
const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

watchErrors(test);

test("стартовая страница ведёт по маршруту, вкладки переключают разделы", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#sync")).toContainText("Локальный режим");
  const frame = page.frameLocator("#frame");
  await expect(frame.getByRole("heading", { level: 1 })).toHaveText("Цветочный магазин, который можно потрогать");
  await expect(page.getByRole("link", { name: "С чего начать" })).toHaveAttribute("aria-current", "page");

  await frame.getByRole("link", { name: "Открыть сайт" }).click();
  await expect(page.getByRole("link", { name: "Сайт" })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/#shop$/);
  await expect(frame.locator(".demo-bar")).toBeHidden();
  await expect(frame.locator(".product")).toHaveCount(8);

  await page.getByRole("link", { name: "CRM" }).click();
  await expect(frame.locator("#empty")).toContainText("Заявок пока нет");
  await expect(frame.locator(".crm-top")).toBeHidden();

  await page.getByRole("link", { name: "Мессенджеры" }).click();
  await expect(frame.locator(".tool-top")).toBeHidden();
  await expect(frame.locator('.phone[data-ch="manager"]')).toBeAttached();
});

test("прямая ссылка на раздел открывает его сразу", async ({ page }) => {
  await page.goto("/#lab");
  await expect(page.frameLocator("#frame").getByRole("heading", { name: "Пульт тестирования" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Пульт" })).toHaveAttribute("aria-current", "page");
});

test("заказ, оформленный во вкладке «Сайт», виден во вкладке CRM", async ({ page }) => {
  await page.goto("/#shop");
  const frame = page.frameLocator("#frame");
  await frame.getByRole("button", { name: "Чат с флористом" }).click();
  const input = frame.getByLabel("Сообщение");
  await input.fill("позовите флориста");
  await input.press("Enter");
  await input.fill("Вера 9160000000");
  await input.press("Enter");
  await expect(frame.locator("#chat-log li.bot").last()).toContainText("ЗВ-");
  await page.getByRole("link", { name: "CRM" }).click();
  await expect(frame.locator(".deal")).toContainText("Вера");
});
