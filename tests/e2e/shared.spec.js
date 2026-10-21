// Общий режим: два участника в разных браузерах видят одни и те же заявки.
// Вместо базы claude.ai — поддельная база с тем же интерфейсом (doc().set / onSnapshot), общая для обоих браузеров.
const { test, expect } = require("@playwright/test");

async function participant(browser, shared, { canWrite = true } = {}) {
  const context = await browser.newContext({ locale: "ru-RU", timezoneId: "Europe/Moscow", reducedMotion: "reduce" });
  await context.exposeFunction("__dbGet", (path) => shared.get(path) ?? null);
  await context.exposeFunction("__dbSet", (path, json) => { shared.set(path, json); });
  await context.addInitScript((canWrite) => {
    if (window.parent !== window) return;
    window.claude = {
      use: async (name) => {
        if (name === "user") return { can: async () => canWrite };
        if (name !== "db") return null;
        return {
          doc: (path) => ({
            set: async (data) => {
              if (!canWrite) throw { code: "invalid_argument", message: "read only" };
              await window.__dbSet(path, JSON.stringify(data));
            },
            onSnapshot(next) {
              let last;
              const tick = async () => {
                const v = await window.__dbGet(path);
                if (v === last) return;
                last = v;
                next({ exists: v != null, data: () => (v == null ? undefined : JSON.parse(v)), metadata: {} });
              };
              tick();
              const t = setInterval(tick, 250);
              return () => clearInterval(t);
            },
          }),
        };
      },
    };
  }, canWrite);
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  return { context, page, frame: page.frameLocator("#frame") };
}

async function callbackFromChat(p, name) {
  await p.page.goto("/#shop");
  await p.frame.getByRole("button", { name: "Чат с флористом" }).click();
  const input = p.frame.getByLabel("Сообщение");
  await input.fill("позовите флориста");
  await input.press("Enter");
  await input.fill(`${name} 9160000000`);
  await input.press("Enter");
  await expect(p.frame.locator("#chat-log li.bot").last()).toContainText("ЗВ-");
}

test.describe("общий режим", () => {
  test.skip(({ isMobile }) => isMobile, "достаточно одного прогона");

  test("заявка партнёра появляется у владельца, а смена этапа — у партнёра", async ({ browser }) => {
    const shared = new Map();
    const owner = await participant(browser, shared);
    const partner = await participant(browser, shared);

    await owner.page.goto("/#crm");
    await expect(owner.page.locator("#sync")).toHaveAttribute("data-state", "shared");
    await expect(owner.frame.locator("#empty")).toContainText("Заявок пока нет");

    await callbackFromChat(partner, "Партнёр");
    await expect(owner.frame.locator(".deal")).toContainText("Партнёр", { timeout: 10000 });

    await owner.frame.locator(".deal").getByRole("button", { name: "Перезвонили клиенту" }).click();
    await partner.page.goto("/#crm");
    await expect(partner.frame.locator('.column[data-column="done"] .deal')).toContainText("Партнёр", { timeout: 10000 });

    // журнал отправок тоже общий
    await partner.page.goto("/#lab");
    await expect(partner.frame.locator("#log")).toContainText("Заявка на звонок", { timeout: 10000 });

    expect(owner.page.errors).toEqual([]);
    expect(partner.page.errors).toEqual([]);
    await owner.context.close();
    await partner.context.close();
  });

  test("одновременные заявки обоих сохраняются под разными номерами", async ({ browser }) => {
    const shared = new Map();
    const a = await participant(browser, shared);
    const b = await participant(browser, shared);
    await Promise.all([callbackFromChat(a, "Анна"), callbackFromChat(b, "Борис")]);
    for (const p of [a, b]) {
      await p.page.goto("/#crm");
      await expect(p.frame.locator(".deal")).toHaveCount(2, { timeout: 10000 });
    }
    const ids = await a.frame.locator(".deal").evaluateAll((els) => els.map((e) => e.dataset.id));
    expect(new Set(ids).size).toBe(2);
    await a.context.close();
    await b.context.close();
  });

  test("участник без права записи видит общие заявки и честное предупреждение", async ({ browser }) => {
    const shared = new Map();
    const owner = await participant(browser, shared);
    const viewer = await participant(browser, shared, { canWrite: false });
    await callbackFromChat(owner, "Ольга");
    await viewer.page.goto("/#crm");
    await expect(viewer.page.locator("#sync")).toHaveAttribute("data-state", "readonly");
    await expect(viewer.page.locator("#sync")).toContainText("пригласить вас по email как редактора");
    await expect(viewer.frame.locator(".deal")).toContainText("Ольга", { timeout: 10000 });
    await owner.context.close();
    await viewer.context.close();
  });
});
