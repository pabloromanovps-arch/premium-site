// Нейросеть: локальная модель (подделана в тесте) ведёт диалог, факты остаются от бота.
const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

watchErrors(test);

// Поддельная Ollama: пересказывает черновик системы, добавляя живое начало.
async function fakeOllama(page, opening = "Конечно!") {
  await page.route("http://localhost:11434/api/chat", async (route) => {
    const body = JSON.parse(route.request().postData());
    const draft = body.messages.at(-1).content.split("ЧЕРНОВИК СИСТЕМЫ (факты не менять):\n")[1] || "";
    await route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ message: { role: "assistant", content: JSON.stringify({ reply: `${opening} ${draft}` }) } }) });
  });
}

test("страница «Нейросеть»: сравнение ответов, включение для чата на сайте", async ({ page }) => {
  await fakeOllama(page);
  await page.goto("/brain.html");
  await page.getByText("Локальная: Ollama").click();
  await expect(page.locator("#prov-help")).toContainText("OLLAMA_ORIGINS");
  await page.locator("#run").click();
  await expect(page.locator("#run-status")).toContainText("Готово: нейросеть ответила", { timeout: 20000 });
  const first = page.locator(".turn").first();
  await expect(first.locator(".ans").first()).toContainText("закончились");
  await expect(first.locator(".ans.llm")).toContainText("Конечно!");
  await expect(page.locator(".turn .ans.llm").last()).toContainText(/СТ-\d+/);

  await page.locator("#save").click();
  await expect(page.locator("#save-status")).toContainText("Ollama");
  await page.goto("/shop.html");
  await page.locator("#chat-open").click();
  await page.locator("#chat-text").fill("хочу пионы маме");
  await page.locator("#chat-text").press("Enter");
  await expect(page.locator("#chat-log li.bot").last()).toContainText("Конечно!");
  await expect(page.locator("#chat-options button").first()).toBeVisible();
});

test("модель выдумала цену — клиент получает ответ бота", async ({ page }) => {
  await page.route("http://localhost:11434/api/chat", (route) => route.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ message: { content: "{\"reply\":\"Есть всё, отдам за 999 ₽!\"}" } }) }));
  await page.goto("/brain.html");
  await page.getByText("Локальная: Ollama").click();
  await page.locator("#save").click();
  await page.goto("/channels.html#telegram");
  const tg = page.locator('.phone[data-ch="telegram"]');
  const input = tg.locator(".composer input");
  await input.fill("хочу пионы маме");
  await input.press("Enter");
  await expect(tg.locator(".bubble:not(.me)").last()).not.toContainText("999");
  await expect(tg.locator(".bubble:not(.me)").last()).toContainText(/₽/);
});
