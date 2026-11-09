// Аналитика: период, сравнение, графики с подсказками, рекомендации, данные стенда.
const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

watchErrors(test);

test("аналитика: месяц, день, год, подсказка на графике и рекомендации", async ({ page }) => {
  await page.goto("/analytics.html");
  await expect(page.locator(".kpi")).toHaveCount(8);
  await expect(page.locator("#insights li").first()).toBeVisible();
  await expect(page.locator("#insights")).toContainText("Ночью написали");
  await page.locator("#view button", { hasText: "День" }).click();
  await expect(page.locator("#chart .hit")).toHaveCount(24);
  await page.locator("#view button", { hasText: "Год" }).click();
  await expect(page.locator("#chart .hit")).toHaveCount(12);
  await page.locator("#prev").click();
  await expect(page.locator("#period-title")).toHaveText(String(new Date().getFullYear() - 1));
  await page.locator("#chart .hit").nth(2).hover();
  await expect(page.locator("#tip")).toBeVisible();
  await expect(page.locator("#tip")).toContainText("март");
  await page.locator("#metric button", { hasText: "Конверсия" }).click();
  await expect(page.locator("#chart text").first()).toContainText("%");
});

test("аналитика по заявкам стенда: демо-заказы CRM попадают в отчёт", async ({ page }) => {
  await page.goto("/crm.html");
  await page.evaluate(() => { localStorage.removeItem("stebel.analytics.ui"); });
  await page.goto("/analytics.html");
  await page.locator("#source").selectOption("crm");
  await expect(page.locator("#source-note")).toContainText("Заявки стенда");
  await page.locator("#view button", { hasText: "Год" }).click();
  await expect(page.locator(".kpi").first()).toBeVisible();
});
