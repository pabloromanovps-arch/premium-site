// Пульт тестирования: автопрогон, машина времени, сбои, журнал, Метрика.
const { test, expect } = require("@playwright/test");
const { watchErrors, orderOnSite, noHorizontalScroll } = require("./helpers");

watchErrors(test);

test("автопрогон: все сценарии проходят в браузере", async ({ page }) => {
  await page.goto("/lab.html");
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Запустить все сценарии" }).click();
  await expect(page.locator("#run-status")).toHaveText(/Все \d+ сценариев пройдены/, { timeout: 40000 });
  await expect(page.locator(".checks .bad")).toHaveCount(0);
  await page.getByRole("button", { name: "Удалить тестовые заявки из CRM" }).click();
  await expect(page.locator("#run-status")).toContainText("Удалено тестовых заявок");
});

test("машина времени: в 20:30 на сегодня нельзя выбрать интервал", async ({ page }) => {
  await page.goto("/lab.html");
  await page.getByRole("button", { name: "Вечер, 20:30" }).click();
  await expect(page.locator("#now")).toContainText("20:30");
  await expect(page.locator("#now")).toContainText("часы переведены");

  await page.goto("/");
  await page.locator('[data-add="pole"]').click();
  await page.locator("#cart-open").click();
  const today = await page.getByLabel("Дата").getAttribute("min");
  await page.getByLabel("Дата").fill(today);
  await page.getByLabel("Дата").dispatchEvent("change");
  await expect(page.getByLabel("Интервал")).toHaveText("Нет свободных интервалов");

  await page.goto("/lab.html");
  await page.getByRole("button", { name: "Вернуть реальное время" }).click();
  await expect(page.locator("#now")).toContainText("реальное время");
});

test("сбой Telegram: заказ сохраняется, в истории — ошибка отправки", async ({ page }) => {
  await page.goto("/lab.html");
  await page.getByLabel("Telegram менеджеру недоступен").check();
  await page.getByLabel("Задержка ответа сервисов").selectOption("0");
  const id = await orderOnSite(page);
  await page.goto("/crm.html#" + encodeURIComponent(id));
  await expect(page.locator("#d-history")).toContainText("Не отправлено во внешнюю CRM: Telegram недоступен");
  await page.goto("/lab.html");
  await page.getByLabel("Telegram менеджеру недоступен").uncheck();
});

test("журнал: SMS клиенту, сообщение менеджеру и цели Метрики после заказа", async ({ page }) => {
  await page.goto("/lab.html");
  await page.getByLabel("Задержка ответа сервисов").selectOption("0");
  const id = await orderOnSite(page);
  await page.goto("/crm.html#" + encodeURIComponent(id));
  await page.locator("#d-moves").getByRole("button", { name: "Подтвердить заказ" }).click();

  await page.goto("/lab.html");
  const log = page.locator("#log");
  await page.locator("#tabs").getByRole("button", { name: "SMS клиенту" }).click();
  await expect(log).toContainText(`заказ ${id} принят`);
  await expect(log.getByRole("link", { name: `pay.html#${id}` })).toBeVisible();
  await page.locator("#tabs").getByRole("button", { name: "Telegram менеджеру" }).click();
  await expect(log).toContainText(`Новый заказ ${id} (сайт)`);
  await page.locator("#tabs").getByRole("button", { name: "Яндекс.Метрика" }).click();
  for (const g of ["cart_add", "cart_open", "order_sent"]) await expect(log).toContainText(g);
});

test("сброс стенда очищает заявки, журнал и корзину", async ({ page }) => {
  await orderOnSite(page);
  await page.goto("/lab.html");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Сбросить весь стенд" }).click();
  await expect(page.locator("#log")).toContainText("Пока ничего");
  await page.goto("/crm.html");
  await expect(page.locator("#empty")).toContainText("Заявок пока нет");
});
