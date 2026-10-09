#!/usr/bin/env node
// U10E DIAGNOSTIC — read-only production browser probe of the Finance
// Profit & Loss surface (U5) for the first genuine V2 Sale revenue inclusion.
// Fresh session, canonical /exec, NO writes.
"use strict";
const { chromium } = require("playwright");
const CANONICAL = "https://script.google.com/macros/s/AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q/exec";
const TIMEOUT = 60_000;
let browser;
const pageErrors = [], consoleErrors = [];

async function appShell(page) {
  const deadline = Date.now() + 20_000;
  do {
    for (const frame of page.frames()) {
      if (await frame.locator("#appShell").count().catch(() => 0) > 0 &&
          await frame.locator("#appShell").first().isVisible().catch(() => false)) return frame;
    }
    await page.waitForTimeout(200);
  } while (Date.now() < deadline);
  throw new Error("App shell not ready");
}

(async () => {
  const report = { diagnostic: "U10E_U5_FINANCE_BROWSER_PROBE",
    timestamp: new Date().toISOString(), readOnly: true, pageErrors, consoleErrors };
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: false });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.on("pageerror", (e) => pageErrors.push(e.message || String(e)));
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    const netLog = [];
    page.on("response", async (r) => {
      const u = r.url();
      if (u.indexOf("/exec") !== -1 || u.indexOf("google.script") !== -1) {
        let bodyHead = "";
        try { bodyHead = (await r.text()).slice(0, 300); } catch (e) {}
        netLog.push({ method: r.request().method(), status: r.status(), url: u.slice(0, 120), bodyHead });
      }
    });
    report.netLog = netLog;
    await page.goto(CANONICAL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    const app = await appShell(page);
    await app.locator('[data-navigation-destination="profit-loss"]').first().click();
    const financeVisible = await app.locator("#finance").waitFor({ state: "visible", timeout: 420_000 })
      .then(() => true).catch(() => false);
    report.financeVisible = financeVisible;
    await app.waitForFunction(() => {
      const el = document.querySelector("#finance");
      const text = el ? (el.innerText || "") : "";
      return /Revenue/i.test(text) && !/loading/i.test(text.slice(0, 400));
    }, null, { timeout: 120_000 }).catch(() => {});
    await app.waitForTimeout(3000);
    report.financeText = await app.evaluate(() => {
      const el = document.querySelector("#finance");
      if (!el) return null;
      return { hidden: el.hidden, ariaBusy: el.getAttribute("aria-busy"),
        text: (el.innerText || el.textContent || "").slice(0, 9000) };
    });
    report.alerts = await app.evaluate(() => Array.from(document.querySelectorAll('[role="alert"]'))
      .map((a) => (a.textContent || "").trim()).filter(Boolean).slice(0, 5));
    // Optional: period control state on the finance page.
    report.period = await app.evaluate(() => {
      const controls = Array.from(document.querySelectorAll("select")).map((s) => ({
        id: s.id, value: s.value,
        selected: (s.options[s.selectedIndex] || {}).textContent || "" }));
      const label = document.querySelector("#dateFilterLabel");
      return { label: label ? label.textContent.trim() : null, selects: controls.slice(0, 6) };
    });
  } catch (error) {
    report.fatal = error && (error.stack || error.message) || String(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
    console.log(JSON.stringify(report, null, 2));
  }
})().catch((e) => console.log(JSON.stringify({ fatal: String(e && e.stack || e) }, null, 2)));
