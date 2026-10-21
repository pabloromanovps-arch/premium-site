// Сквозные тесты в настоящем браузере. В облачной среде Claude Chromium лежит в /opt/pw-browsers.
const { defineConfig, devices } = require("@playwright/test");
const fs = require("node:fs");

const localChromium = "/opt/pw-browsers/chromium";
const launchOptions = fs.existsSync(localChromium) ? { executablePath: localChromium } : {};

module.exports = defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", locale: "ru-RU", timezoneId: "Europe/Moscow", launchOptions },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions } },
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions } },
  ],
  webServer: { command: "node tests/serve.mjs", url: "http://localhost:4173", reuseExistingServer: true },
});
