// Покупатель на сайте: каталог, корзина, оформление, чат.
const { test, expect } = require("@playwright/test");
const { noHorizontalScroll, watchErrors, orderOnSite } = require("./helpers");

watchErrors(test);

test("каталог: 8 букетов, корзина считает сумму и бесплатную доставку", async ({ page }) => {
  await page.goto("/shop.html");
  await expect(page.locator(".product")).toHaveCount(8);
  await noHorizontalScroll(page);
  await page.locator('[data-add="kompliment"]').click();
  await page.locator('[data-add="kompliment"]').click();
  await expect(page.locator("#cart-count")).toHaveText("2");
  await page.locator("#cart-open").click();
  await expect(page.locator("#cart-total")).toHaveText("3 690 ₽");
  await expect(page.locator("#free-hint")).toContainText("1 800 ₽");
  const plus = page.getByRole("button", { name: "Увеличить количество «Маленький комплимент»" });
  await plus.click();
  await plus.click();
  await expect(page.locator("#cart-total")).toHaveText("6 400 ₽");
  await expect(page.locator("#free-hint")).toHaveText("Доставка бесплатная.");
  await page.getByLabel("Самовывоз с Покровки, 12").check();
  await expect(page.getByLabel("Адрес доставки")).toBeHidden();
  await page.getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByText("Корзина пуста")).toBeVisible();
});

test("корзина сохраняется после перезагрузки", async ({ page }) => {
  await page.goto("/shop.html");
  await page.locator('[data-add="bordo"]').click();
  await page.reload();
  await expect(page.locator("#cart-count")).toHaveText("1");
});

test("оформление: пустая форма показывает ошибки у полей", async ({ page }) => {
  await page.goto("/shop.html");
  await page.locator('[data-add="pole"]').click();
  await page.locator("#cart-open").click();
  await page.locator("#checkout-submit").click();
  await expect(page.locator("#err-name")).toHaveText("Укажите имя.");
  await expect(page.locator("#err-phone")).toContainText("10 цифр");
  await expect(page.locator("#err-address")).toBeVisible();
  await expect(page.getByLabel("Имя")).toBeFocused();
});

test("заказ с сайта появляется в CRM в колонке «Новые»", async ({ page }) => {
  const id = await orderOnSite(page);
  expect(id).toMatch(/^СТ-\d+$/);
  await page.locator("#done-crm").click();
  const card = page.locator(`.column[data-column="new"] .deal[data-id="${id}"]`);
  await expect(card).toContainText("Мария Тест");
  await expect(card).toContainText("4 390 ₽");
  await expect(card).toContainText("Сайт");
  await expect(page.locator("#d-title")).toHaveText(`Заказ ${id}`);
});

test("чат на сайте понимает фразу целиком и оформляет заказ", async ({ page }) => {
  await page.goto("/shop.html");
  await page.getByRole("button", { name: "Чат с флористом" }).click();
  const input = page.getByLabel("Сообщение");
  await input.fill("бордо на завтра вечером, заберу сам");
  await input.press("Enter");
  await expect(page.locator("#chat-log li.bot").last()).toHaveText(/Как (к вам обращаться|вас зовут)/);
  await input.fill("Игорь");
  await input.press("Enter");
  await input.fill("+7 903 765-43-21");
  await input.press("Enter");
  await expect(page.locator("#chat-log li.bot").last()).toContainText("Итого: 6 800 ₽");
  await page.locator("#chat-options").getByRole("button", { name: "Всё верно, оформить" }).click();
  const done = page.locator("#chat-log li.bot").last();
  await expect(done).toContainText("принят");
  const id = (await done.textContent()).match(/СТ-\d+/)[0];

  await input.fill(`где заказ ${id}`);
  await input.press("Enter");
  await expect(page.locator("#chat-log li.bot").last()).toContainText(`${id}: новый`);

  await page.goto("/crm.html");
  await expect(page.locator(`.deal[data-id="${id}"]`)).toContainText("Чат на сайте");
});

test("чат показывает букеты карточками с картинками", async ({ page }) => {
  await page.goto("/shop.html");
  await page.getByRole("button", { name: "Чат с флористом" }).click();
  await page.locator("#chat-options").getByRole("button", { name: "Подобрать букет" }).click();
  await page.locator("#chat-options").getByRole("button", { name: "3 000–6 000 ₽" }).click();
  await expect(page.locator(".chat-cards li").first()).toBeVisible();
  await expect(page.locator(".chat-cards svg").first()).toBeVisible();
});

test.describe("с анимацией «печатает…»", () => {
  test.use({ reducedMotion: "no-preference" });
  test("сообщение, отправленное во время приветствия, не путает порядок ответов", async ({ page }) => {
    await page.goto("/shop.html");
    await page.getByRole("button", { name: "Чат с флористом" }).click();
    const input = page.getByLabel("Сообщение");
    await input.fill("хочу тюльпаны на завтра");
    await input.press("Enter");
    await expect(page.locator(".chat-cards")).toBeVisible({ timeout: 10000 });
    const texts = await page.locator("#chat-log li").allTextContents();
    const greet = texts.findIndex((t) => t.startsWith("Здравствуйте"));
    const mine = texts.findIndex((t) => t === "хочу тюльпаны на завтра");
    expect(greet).toBeGreaterThanOrEqual(0);
    expect(greet).toBeLessThan(texts.length - 1);
    expect(mine).toBeGreaterThan(-1);
    await expect(page.locator("#chat-options")).toContainText("25 тюльпанов");
  });
});
