const { expect } = require("@playwright/test");

// Завтрашняя дата по Москве в формате ISO — тесты не зависят от времени запуска.
function tomorrowMsk() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const d = new Date(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function noHorizontalScroll(page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
}

// Следит, чтобы на странице не было ошибок JavaScript.
function watchErrors(test) {
  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(e.message));
  });
  test.afterEach(async ({ page }) => {
    expect(page.errors, "ошибки JavaScript на странице").toEqual([]);
  });
}

// Оформляет заказ через корзину на сайте и возвращает его номер.
async function orderOnSite(page, { product = "dacha", name = "Мария Тест", pickup = false } = {}) {
  await page.goto("/");
  await page.locator(`[data-add="${product}"]`).click();
  await page.locator("#cart-open").click();
  if (pickup) await page.getByLabel("Самовывоз с Покровки, 12").check();
  await page.getByLabel("Имя").fill(name);
  await page.getByLabel("Телефон").fill("8 916 123 45 67");
  if (!pickup) await page.getByLabel("Адрес доставки").fill("Остоженка, 7, кв. 12");
  await page.getByLabel("Дата").fill(tomorrowMsk());
  await page.getByLabel("Дата").dispatchEvent("change");
  await page.getByLabel("Интервал").selectOption("12-15");
  await page.locator("#checkout-submit").click();
  await expect(page.locator("#cart-done")).toBeVisible();
  return (await page.locator("#done-id").textContent()).trim();
}

module.exports = { tomorrowMsk, noHorizontalScroll, watchErrors, orderOnSite };
