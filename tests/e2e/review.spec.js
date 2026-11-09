// Разбор диалогов: агент находит ошибку, исправление становится знанием во всех каналах.
const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

watchErrors(test);

test("разбор: исправляем ответ про 31 декабря — агент отвечает так в Telegram", async ({ page }) => {
  await page.goto("/review.html");
  await page.evaluate(() => localStorage.removeItem("stebel.profile.v1"));
  await page.reload();
  await expect(page.locator("#gaps")).toContainText("31 декабря");
  const dlg = page.locator("#dlg-Д-3");
  await expect(dlg.locator(".flag")).toContainText("Агент не понял");
  await dlg.locator("textarea").fill("31 декабря работаем до 18:00, 1 января — выходной. Заказы на 1 января примем заранее.");
  await dlg.locator("button[type=submit]").click();
  await expect(dlg.locator(".result")).toContainText("Теперь агент отвечает");
  await expect(page.locator("#learned")).toContainText("Работаете 31 декабря?");

  await page.goto("/channels.html#telegram");
  const tg = page.locator('.phone[data-ch="telegram"]');
  await tg.locator(".composer input").fill("а вы 31 декабря работаете?");
  await tg.locator(".composer input").press("Enter");
  await expect(tg.locator(".bubble:not(.me)").last()).toContainText("до 18:00");

  await page.goto("/review.html");
  await page.locator("#learned [data-forget]").first().click();
  await expect(page.locator("#learned")).not.toContainText("31 декабря");
});
