// Менеджер в CRM: воронка, карточка, оплата, звонки, фильтры.
const { test, expect } = require("@playwright/test");
const { noHorizontalScroll, watchErrors, orderOnSite } = require("./helpers");

watchErrors(test);

test("заказ с доставкой проходит воронку одной главной кнопкой и оплачивается", async ({ page, context }) => {
  const id = await orderOnSite(page);
  await page.goto("/crm.html#" + encodeURIComponent(id));
  await expect(page.locator("#d-explain")).toContainText("Клиент ждёт звонка");

  await page.locator("#d-moves").getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(page.locator("#d-status")).toHaveText("Подтверждён");
  await expect(page.locator(`.column[data-column="confirmed"] .deal[data-id="${id}"]`)).toBeVisible();
  await expect(page.locator("#d-meta")).toContainText("Не оплачен");

  // клиент платит по ссылке: сначала отказ банка, потом успешно
  const [pay] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: "Страница оплаты клиента" }).click()]);
  await expect(pay.locator("#sum")).toHaveText("4 390 ₽");
  await pay.getByRole("button", { name: "Симулировать отказ банка" }).click();
  await expect(pay.locator("#result")).toContainText("Банк отклонил");
  await pay.getByRole("button", { name: "Оплатить картой" }).click();
  await expect(pay.locator("#result")).toContainText("Оплата прошла");
  await pay.close();

  await page.reload();
  await expect(page.locator("#d-meta")).toContainText("Оплачен");
  await expect(page.locator("#d-history")).toContainText("Банк отклонил оплату");

  for (const [btn, status] of [["Начать сборку", "Собирается"], ["Передать курьеру", "В доставке"], ["Отметить доставленным", "Выполнен"]]) {
    await page.locator("#d-moves").getByRole("button", { name: btn }).click();
    await expect(page.locator("#d-status")).toHaveText(status);
  }
  await expect(page.locator("#d-moves button")).toHaveCount(0);
  await expect(page.locator(`.column[data-column="done"] .deal[data-id="${id}"]`)).toBeVisible();

  await page.locator("#d-text").fill("Вручили лично в руки");
  await page.getByRole("button", { name: "Добавить комментарий" }).click();
  await expect(page.locator("#d-history li").first()).toContainText("Вручили лично в руки");
});

test("самовывоз: вместо курьера — «Букет готов к выдаче»; быстрая кнопка на карточке", async ({ page }) => {
  const id = await orderOnSite(page, { product: "bordo", pickup: true, name: "Самовывоз Тест" });
  await page.goto("/crm.html");
  const card = page.locator(`.deal[data-id="${id}"]`);
  await card.getByRole("button", { name: "Подтвердить заказ" }).click();
  await page.locator(`.deal[data-id="${id}"]`).getByRole("button", { name: "Начать сборку" }).click();
  await expect(page.locator(`.deal[data-id="${id}"]`).getByRole("button", { name: "Букет готов к выдаче" })).toBeVisible();
  await expect(page.locator(`.deal[data-id="${id}"]`).getByRole("button", { name: "Передать курьеру" })).toHaveCount(0);
});

test("отмена заказа спрашивает подтверждение и закрывает заявку", async ({ page }) => {
  const id = await orderOnSite(page);
  await page.goto("/crm.html#" + encodeURIComponent(id));
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Отменить заказ" }).click();
  await expect(page.locator("#d-status")).toHaveText("Новый");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Отменить заказ" }).click();
  await expect(page.locator("#d-status")).toHaveText("Отменён");
  await expect(page.locator(`.column[data-column="cancelled"] .deal[data-id="${id}"]`)).toBeVisible();
});

test("пустая CRM, демо-данные, поиск, фильтры, список, CSV, очистка", async ({ page }) => {
  await page.goto("/crm.html");
  await expect(page.locator("#empty")).toContainText("Заявок пока нет");
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: "Добавить демо-данные" }).click();
  await expect(page.locator(".deal")).toHaveCount(4);
  await expect(page.locator("#stat-new")).toHaveText("2");
  await expect(page.locator("#stat-work")).toHaveText("2");
  await expect(page.locator("#stat-unpaid")).toHaveText("2");

  const search = page.getByPlaceholder("Номер, имя или телефон");
  await search.fill("Соколова");
  await expect(page.locator(".deal")).toHaveCount(1);
  await search.fill("нет такого");
  await expect(page.locator("#empty")).toContainText("По этим фильтрам заявок нет");
  await search.fill("");
  await page.locator("#filters select[name=source]").selectOption("chat");
  await expect(page.locator(".deal")).toHaveCount(2);
  await page.locator("#filters select[name=source]").selectOption("");

  await page.getByRole("button", { name: "Список" }).click();
  await expect(page.locator("#rows tr")).toHaveCount(4);
  await page.locator("#filters select[name=status]").selectOption("assembling");
  await expect(page.locator("#rows tr")).toHaveCount(1);
  await page.locator("#filters select[name=status]").selectOption("");
  await page.getByRole("button", { name: "Воронка" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать CSV" }).click();
  expect((await download).suggestedFilename()).toBe("stebel-crm.csv");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Удалить все заявки" }).click();
  await expect(page.locator("#empty")).toContainText("Заявок пока нет");
});

test("подсказку «Как вести заказы» можно скрыть, и она не возвращается", async ({ page }) => {
  await page.goto("/crm.html");
  await page.getByRole("button", { name: "Скрыть подсказку" }).click();
  await page.reload();
  await expect(page.locator("#howto")).toBeHidden();
});

test("CRM обновляется сама, когда заявка приходит из соседней вкладки", async ({ page, context }) => {
  await page.goto("/crm.html");
  await expect(page.locator(".deal")).toHaveCount(0);
  const shop = await context.newPage();
  await shop.goto("/");
  await shop.getByRole("button", { name: "Чат с флористом" }).click();
  const input = shop.getByLabel("Сообщение");
  await input.fill("позовите флориста");
  await input.press("Enter");
  await input.fill("Вера 9160000000");
  await input.press("Enter");
  await expect(page.locator(".deal")).toHaveCount(1);
  await expect(page.locator(".deal")).toContainText("Вера");
  await page.locator(".deal").getByRole("button", { name: "Перезвонили клиенту" }).click();
  await expect(page.locator(`.column[data-column="done"] .deal`)).toHaveCount(1);
});
