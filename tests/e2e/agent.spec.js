// Агент: Авито, автопилот, настройка под другой бизнес, страница «Об агенте».
const { test, expect } = require("@playwright/test");
const { watchErrors } = require("./helpers");

watchErrors(test);

test("Авито: покупатель пишет по объявлению, отвечает цифрой, заказ в CRM с меткой Авито", async ({ page }) => {
  await page.goto("/channels.html#avito");
  const av = page.locator('.phone[data-ch="avito"]');
  await av.locator("[data-ad]").selectOption("4012345601");
  await av.locator(".suggest button", { hasText: "Здравствуйте, ещё актуально?" }).click();
  await expect(av.locator(".bubble").last()).toContainText("по объявлению «Бордо»");
  await expect(av.locator(".bubble").last()).toContainText("Да, в наличии");
  await av.locator(".suggest button", { hasText: /^\d — Завтра$/ }).click();
  await av.locator(".suggest button").first().click(); // первый свободный интервал
  await av.locator(".suggest button", { hasText: "Заберу сам" }).click();
  const input = av.locator(".composer input");
  await input.fill("Игорь");
  await input.press("Enter");
  await input.fill("+7 903 765-43-21");
  await input.press("Enter");
  await av.locator(".suggest button", { hasText: "Всё верно" }).click();
  await expect(av.locator(".bubble").last()).toContainText("принят");
  await expect(av.locator(".bubble.me").last()).toHaveText(/^\d$/);
  await av.locator(".raw summary").click();
  await expect(av.locator(".limits")).toHaveText("Ограничения платформы соблюдены.");
  const id = (await av.locator(".bubble").last().textContent()).match(/СТ-\d+/)[0];
  await page.goto("/crm.html#" + encodeURIComponent(id));
  await expect(page.locator("#d-meta")).toContainText("Авито");
});

test("автопилот: магазин работает сам, CRM заполняется, агент действует", async ({ page }) => {
  await page.goto("/autopilot.html");
  await page.getByRole("radio", { name: /Менеджеры заняты/ }).click();
  await page.getByRole("button", { name: "50 мин в секунду" }).click();
  await page.getByRole("button", { name: "Запустить" }).click();
  await expect(page.locator(".mini").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#feed li[data-type="agent"]').first()).toBeVisible({ timeout: 25000 });
  // поток покупателей случайный — ждём, пока цифры наберутся
  await expect.poll(async () => Number(await page.locator("#k-clients").textContent()), { timeout: 30000 }).toBeGreaterThan(3);
  await expect.poll(async () => Number(await page.locator("#k-saved").textContent()), { timeout: 30000 }).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Пауза" }).click();
  await page.goto("/crm.html");
  await expect(page.locator(".deal").first()).toBeVisible();
  await expect(page.locator("#a-agent")).not.toHaveText("0");
});

test("настройка агента: «Флора» на «ты» — бот, SMS и номера меняются, потом возврат к «Стеблю»", async ({ page }) => {
  await page.goto("/setup.html");
  await page.getByRole("button", { name: "Другая лавка: «Флора», на «ты»" }).click();
  await page.getByRole("button", { name: "Собрать базу знаний" }).click();
  await expect(page.locator("#f-address")).toHaveValue("ты");
  await expect(page.locator("#f-name")).toHaveValue("Флора");
  await expect(page.locator("#why-ids")).toContainText("ЦВ-2026-1001");
  await expect(page.locator("#quality")).toContainText("Ни одного слова-паразита");
  await expect(page.locator("#try-log li").first()).toContainText("Привет! Это «Флора»");
  await page.locator("#try-chips button", { hasText: "можно картой?" }).click();
  await expect(page.locator("#try-log li").last()).toContainText("Чем ещё помочь?");
  await page.getByRole("button", { name: "Применить на стенде" }).click();
  await expect(page.locator("#apply-status")).toContainText("«Флора»");

  await page.goto("/shop.html");
  await page.getByRole("button", { name: "Чат с флористом" }).click();
  await expect(page.locator("#chat-log li.bot").first()).toContainText("Привет! Это «Флора»");
  const input = page.getByLabel("Сообщение");
  for (const t of ["бордо на завтра утром, заберу сам", "Игорь", "9037654321"]) { await input.fill(t); await input.press("Enter"); }
  await page.locator("#chat-options").getByRole("button", { name: "Всё верно, оформить" }).click();
  await expect(page.locator("#chat-log li.bot").last()).toContainText(/Заказ ЦВ-2026-\d+ принят/);

  await page.goto("/setup.html");
  await page.getByRole("button", { name: "Вернуть «Стебель»" }).click();
  await page.goto("/shop.html");
  await page.getByRole("button", { name: "Чат с флористом" }).click();
  await expect(page.locator("#chat-log li.bot").first()).toContainText("Здравствуйте! Это «Стебель»");
});

test("страница «Об агенте»: живые ответы бота и калькулятор", async ({ page }) => {
  await page.goto("/agent.html");
  await expect(page.locator(".talk").first()).toContainText("Да, в наличии");
  await expect(page.locator(".talk").nth(2)).toContainText("Большой заказ флорист посчитает индивидуально");
  const before = await page.locator("#c-money").textContent();
  await page.getByLabel("Заявок в месяц").fill("1000");
  await expect(page.locator("#c-money")).not.toHaveText(before);
  await expect(page.locator("#c-formula")).toContainText("1000 заявок");
});
