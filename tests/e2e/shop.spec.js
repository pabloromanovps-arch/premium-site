// Сквозные сценарии: покупатель на сайте и в чате, менеджер в CRM.
const { test, expect } = require("@playwright/test");

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

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.errors = errors;
});
test.afterEach(async ({ page }) => {
  expect(page.errors, "ошибки JavaScript на странице").toEqual([]);
});

test("каталог: 8 букетов, корзина считает сумму и бесплатную доставку", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".product")).toHaveCount(8);
  await noHorizontalScroll(page);

  await page.locator('[data-add="kompliment"]').click();
  await page.locator('[data-add="kompliment"]').click();
  await expect(page.locator("#cart-count")).toHaveText("2");

  await page.locator("#cart-open").click();
  await expect(page.locator("#cart-total")).toHaveText("3 690 ₽");
  await expect(page.locator("#free-hint")).toContainText("1 800 ₽");

  await page.getByRole("button", { name: "Увеличить количество «Маленький комплимент»" }).click();
  await page.getByRole("button", { name: "Увеличить количество «Маленький комплимент»" }).click();
  await expect(page.locator("#cart-total")).toHaveText("6 400 ₽");
  await expect(page.locator("#free-hint")).toHaveText("Доставка бесплатная.");

  await page.getByLabel("Самовывоз с Покровки, 12").check();
  await expect(page.getByLabel("Адрес доставки")).toBeHidden();

  await page.getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByText("Корзина пуста")).toBeVisible();
  await expect(page.locator("#cart-count")).toHaveText("0");
});

test("корзина сохраняется после перезагрузки", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-add="bordo"]').click();
  await page.reload();
  await expect(page.locator("#cart-count")).toHaveText("1");
});

test("оформление: пустая форма показывает ошибки у полей", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-add="pole"]').click();
  await page.locator("#cart-open").click();
  await page.locator("#checkout-submit").click();
  await expect(page.locator("#err-name")).toHaveText("Укажите имя.");
  await expect(page.locator("#err-phone")).toContainText("10 цифр");
  await expect(page.locator("#err-address")).toBeVisible();
  await expect(page.getByLabel("Имя")).toBeFocused();
  await expect(page.locator("#cart-done")).toBeHidden();
});

test("заказ с сайта проходит весь путь в CRM до «Выполнен»", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-add="dacha"]').click();
  await page.locator("#cart-open").click();
  await page.getByLabel("Имя").fill("Мария Тест");
  await page.getByLabel("Телефон").fill("8 916 123 45 67");
  await page.getByLabel("Адрес доставки").fill("Остоженка, 7, кв. 12");
  await page.getByLabel("Дата").fill(tomorrowMsk());
  await page.getByLabel("Дата").dispatchEvent("change");
  await page.getByLabel("Интервал").selectOption("12-15");
  await page.getByLabel("Текст открытки").fill("С днём рождения!");
  await page.locator("#checkout-submit").click();

  await expect(page.locator("#cart-done")).toBeVisible();
  const id = await page.locator("#done-id").textContent();
  expect(id).toMatch(/^СТ-\d+$/);
  await expect(page.locator("#cart-count")).toHaveText("0");

  await page.locator("#done-crm").click();
  await expect(page).toHaveURL(/crm\.html#/);
  const row = page.locator(`tr[data-id="${id}"]`);
  await expect(row).toContainText("Мария Тест");
  await expect(row).toContainText("4 390 ₽");
  await expect(row).toContainText("Сайт");
  await expect(page.locator("#d-title")).toHaveText(`Заказ ${id}`);
  await expect(page.locator("#d-facts")).toContainText("С днём рождения!");

  for (const step of ["Подтверждён", "Собирается", "В доставке", "Выполнен"]) {
    await page.locator("#d-moves").getByRole("button", { name: step }).click();
    await expect(page.locator("#d-status")).toHaveText(step);
  }
  await expect(page.locator("#d-moves")).toContainText("Заявка закрыта");
  await expect(page.locator("#d-history li")).toHaveCount(5);

  await page.locator("#d-text").fill("Вручили лично в руки");
  await page.getByRole("button", { name: "Добавить комментарий" }).click();
  await expect(page.locator("#d-history li").first()).toContainText("Вручили лично в руки");

  // после перезагрузки всё на месте
  await page.reload();
  await expect(page.locator("#d-status")).toHaveText("Выполнен");
});

test("заказ через чат-бота появляется в CRM с источником «Чат-бот»", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Чат с флористом" }).click();
  const opts = page.locator("#chat-options");
  await opts.getByRole("button", { name: "Заказать букет" }).click();
  await opts.getByRole("button", { name: "От 6 000 ₽" }).click();
  await opts.getByRole("button", { name: /Бордо/ }).click();
  await opts.getByRole("button", { name: "Завтра" }).click();
  await opts.getByRole("button", { name: "18:00–21:00" }).click();
  await opts.getByRole("button", { name: /Самовывоз/ }).click();
  const input = page.getByLabel("Сообщение");
  await input.fill("Игорь");
  await input.press("Enter");
  await input.fill("+7 903 765-43-21");
  await input.press("Enter");
  await expect(page.locator("#chat-log li").last()).toContainText("Итого: 6 800 ₽");
  await opts.getByRole("button", { name: "Оформить заказ" }).click();
  const done = page.locator("#chat-log li.bot").last();
  await expect(done).toContainText("оформлен");
  const id = (await done.textContent()).match(/СТ-\d+/)[0];

  // статус через того же бота
  await opts.getByRole("button", { name: "Где мой заказ" }).click();
  await input.fill(id);
  await input.press("Enter");
  await expect(page.locator("#chat-log li.bot").last()).toContainText(`${id}: новый`);

  await page.goto("/crm.html");
  const row = page.locator(`tr[data-id="${id}"]`);
  await expect(row).toContainText("Чат-бот");
  await expect(row).toContainText("Самовывоз");
  await row.click();
  await page.locator("#d-moves").getByRole("button", { name: "Подтверждён" }).click();
  await page.locator("#d-moves").getByRole("button", { name: "Собирается" }).click();
  await expect(page.locator("#d-moves").getByRole("button", { name: "Готов к выдаче" })).toBeVisible();
  await expect(page.locator("#d-moves").getByRole("button", { name: "В доставке" })).toHaveCount(0);
});

test("заявка на звонок из чата и проверка ошибок ввода", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Спросить в чате" }).click();
  const input = page.getByLabel("Сообщение");
  await input.fill("перезвоните мне");
  await input.press("Enter");
  await input.fill("Анна");
  await input.press("Enter");
  await input.fill("123");
  await input.press("Enter");
  await expect(page.locator("#chat-log li.bot").last()).toContainText("10 цифр");
  await input.fill("9261112233");
  await input.press("Enter");
  const id = (await page.locator("#chat-log li.bot").last().textContent()).match(/ЗВ-\d+/)[0];

  await page.goto("/crm.html");
  await page.locator("#filters select[name=kind]").selectOption("callback");
  await expect(page.locator("#rows tr")).toHaveCount(1);
  await page.locator(`tr[data-id="${id}"]`).click();
  await page.locator("#d-moves").getByRole("button", { name: "Перезвонили" }).click();
  await expect(page.locator("#d-status")).toHaveText("Перезвонили");
});

test("CRM: пустое состояние, демо-данные, поиск, фильтры, CSV, очистка", async ({ page }) => {
  await page.goto("/crm.html");
  await expect(page.locator("#empty")).toContainText("Заявок пока нет");
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: "Добавить демо-данные" }).click();
  await expect(page.locator("#rows tr")).toHaveCount(4);
  await expect(page.locator("#stat-new")).toHaveText("2");
  await expect(page.locator("#stat-work")).toHaveText("2");

  await page.getByPlaceholder("Номер, имя или телефон").fill("Соколова");
  await expect(page.locator("#rows tr")).toHaveCount(1);
  await page.getByPlaceholder("Номер, имя или телефон").fill("нет такого");
  await expect(page.locator("#empty")).toContainText("По этим фильтрам заявок нет");
  await page.getByPlaceholder("Номер, имя или телефон").fill("");
  await page.locator("#filters select[name=source]").selectOption("chat");
  await expect(page.locator("#rows tr")).toHaveCount(2);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("stebel-crm.csv");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Удалить все заявки" }).click();
  await page.locator("#filters select[name=source]").selectOption("");
  await expect(page.locator("#empty")).toContainText("Заявок пока нет");
});

test("CRM обновляется сама, когда заказ приходит из соседней вкладки", async ({ page, context }) => {
  await page.goto("/crm.html");
  await expect(page.locator("#rows tr")).toHaveCount(0);

  const shop = await context.newPage();
  await shop.goto("/");
  await shop.getByRole("button", { name: "Чат с флористом" }).click();
  const input = shop.getByLabel("Сообщение");
  await input.fill("позвать флориста");
  await input.press("Enter");
  await input.fill("Вера");
  await input.press("Enter");
  await input.fill("9160000000");
  await input.press("Enter");

  await expect(page.locator("#rows tr")).toHaveCount(1);
  await expect(page.locator("#rows tr")).toContainText("Вера");
});
