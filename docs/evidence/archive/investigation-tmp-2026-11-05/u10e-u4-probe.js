#!/usr/bin/env node
// U10E DIAGNOSTIC — read-only production browser probe of the U4 Transaction
// surfaces (Recent / Sales / detail / period / status filter) for the first
// genuine V2 Sale (OrderID ORD-677BE5CE-SALESRECOGNI, Amount 24000).
// Fresh session, canonical /exec, NO writes, NO Correct/Void/Save interaction.
"use strict";
const { chromium } = require("playwright");

const CANONICAL = "https://script.google.com/macros/s/AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q/exec";
const TIMEOUT = 60_000;
const TARGET_MARKERS = ["677BE5CE", "24.000", "24000", "SNT06", "SCC02"];
const pageErrors = [], consoleErrors = [];
let browser;

async function appShell(page) {
  const deadline = Date.now() + 20_000;
  do {
    const frames = page.frames();
    for (const frame of frames) {
      if (await frame.locator("#appShell").count().catch(() => 0) > 0 &&
          await frame.locator("#appShell").first().isVisible().catch(() => false)) return frame;
    }
    await page.waitForTimeout(200);
  } while (Date.now() < deadline);
  throw new Error("App shell not ready");
}

async function waitLoaded(scope) {
  await scope.locator("#transactions").waitFor({ state: "visible", timeout: TIMEOUT });
  await scope.waitForFunction(() => {
    const heading = document.querySelector("#transactionsResultHeading");
    const range = document.querySelector("#transactionsRangeSummary");
    return heading && range && !/loading/i.test(heading.textContent || "");
  }, null, { timeout: TIMEOUT });
}

async function snapshot(scope, label) {
  return await scope.evaluate((args) => {
    const labelValue = args.label, markers = args.markers;
    const rows = Array.from(document.querySelectorAll("#tableBody .transactions-table-row")).map((row) =>
      (row.textContent || "").replace(/\s+/g, " ").trim());
    const period = document.querySelector("#transactionsPeriod") || document.querySelector("#transactionsFilter") || document.querySelector("#filter");
    const heading = document.querySelector("#transactionsResultHeading");
    const range = document.querySelector("#transactionsRangeSummary");
    const status = document.querySelector("#transactionsIsActive");
    const pageIndicator = document.querySelector("#transactionsPageIndicator");
    const activeTab = document.querySelector('[data-transactions-tab][aria-selected="true"]');
    return {
      label: labelValue,
      period: period ? period.value : null,
      periodLabel: ((document.querySelector("#dateFilterLabel") || {}).textContent || "").trim() || null,
      statusFilter: status ? status.value : null,
      activeTab: activeTab ? activeTab.getAttribute("data-transactions-tab") : null,
      heading: heading ? heading.textContent.replace(/\s+/g, " ").trim() : null,
      range: range ? range.textContent.replace(/\s+/g, " ").trim() : null,
      pageIndicator: pageIndicator ? pageIndicator.textContent.replace(/\s+/g, " ").trim() : null,
      rowCount: rows.length,
      rows: rows.slice(0, 40),
      markerHits: rows.filter((text) => markers.some((m) => text.indexOf(m) !== -1))
    };
  }, { label, markers: TARGET_MARKERS });
}

async function selectTab(scope, tab) {
  const el = scope.locator(`[data-transactions-tab="${tab}"]`).first();
  if (!await el.count()) return false;
  await el.click();
  await scope.waitForTimeout(1200);
  return true;
}

async function setSearch(scope, value) {
  const input = scope.locator("#transactionsSearch").first();
  if (!await input.count()) return false;
  await input.fill(value);
  await scope.waitForTimeout(1500);
  return true;
}

async function setPeriod(scope, wanted) {
  let control = null;
  for (const sel of ["#transactionsPeriod", "#transactionsFilter", "#filter"]) {
    const candidate = scope.locator(sel).first();
    if (await candidate.count()) { control = candidate; break; }
  }
  if (!control) return { changed: false, error: "period control missing" };
  const options = await control.locator("option").evaluateAll((opts) => opts.map((o) => ({ value: o.value, text: (o.textContent || "").trim() })));
  const match = options.find((o) => o.value === wanted || o.text.toLowerCase() === wanted.toLowerCase());
  if (!match) return { changed: false, options };
  const before = await snapshot(scope, "before-period");
  await control.selectOption(match.value);
  await scope.waitForFunction((prior) => {
    const heading = document.querySelector("#transactionsResultHeading");
    const range = document.querySelector("#transactionsRangeSummary");
    return heading && range && !/loading/i.test(heading.textContent || "") &&
      range.textContent.replace(/\s+/g, " ").trim() !== prior;
  }, before.range, { timeout: 30_000 }).catch(() => {});
  await scope.waitForTimeout(800);
  return { changed: true, selected: match, options };
}

(async () => {
  const report = { diagnostic: "U10E_U4_BROWSER_PROBE", timestamp: new Date().toISOString(),
    target: "ORD-677BE5CE-SALESRECOGNI / 24000", readOnly: true, stages: [], fatal: null,
    pageErrors, consoleErrors };
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: false });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.on("pageerror", (e) => pageErrors.push(e.message || String(e)));
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    await page.goto(CANONICAL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    const app = await appShell(page);
    report.shell = "READY";
    await app.locator('[data-navigation-destination="transactions"]').first().click();
    await waitLoaded(app);

    report.stages.push(await snapshot(app, "A_default_recent"));
    await selectTab(app, "sales");
    report.stages.push(await snapshot(app, "B_default_sales"));

    // Search by exact order identity on Sales tab.
    await setSearch(app, "677BE5CE");
    report.stages.push(await snapshot(app, "C_sales_search_677BE5CE"));
    await setSearch(app, "");

    // Widest period + status All.
    report.periodChange = await setPeriod(app, "currentYear").catch((e) => ({ changed: false, error: String(e && e.message || e) }));
    const statusSelect = app.locator("#transactionsIsActive").first();
    if (await statusSelect.count()) { await statusSelect.selectOption("all"); await app.waitForTimeout(1200); }
    report.stages.push(await snapshot(app, "D_sales_currentYear_statusAll"));
    await selectTab(app, "recent");
    report.stages.push(await snapshot(app, "E_recent_currentYear_statusAll"));
    await setSearch(app, "677BE5CE");
    report.stages.push(await snapshot(app, "F_recent_search_677BE5CE"));
    await setSearch(app, "");

    // Detail lookup by exact identity (read-only navigation).
    const viewButtons = app.locator("#tableBody .transactions-row-action--view");
    report.detail = { attempted: false };
    const foundStage = report.stages.find((s) => s.markerHits && s.markerHits.length);
    if (foundStage) {
      report.detail.foundInStage = foundStage.label;
      const row = app.locator("#tableBody .transactions-table-row").filter({ hasText: "677BE5CE" }).first();
      if (await row.count()) {
        const view = row.locator(".transactions-row-action--view").first();
        if (await view.count()) {
          report.detail.attempted = true;
          await view.click();
          await app.waitForTimeout(6000);
          report.detail.dialog = await app.evaluate(() => {
            const hits = Array.from(document.querySelectorAll("body *")).filter((el) =>
              el.tagName !== "SCRIPT" && (el.innerText || "").indexOf("Transaction Details") !== -1);
            const leaf = hits.length ? hits[hits.length - 1] : null;
            const kids = Array.from(document.body.children).map((el) =>
              el.tagName + (el.id ? "#" + el.id : "") + (el.hidden ? ":hidden" : "") +
              ":" + String(el.className || "").slice(0, 50));
            return { hitCount: hits.length, bodyKids: kids,
              text: leaf ? (leaf.innerText || "").replace(/\n{2,}/g, "\n").slice(0, 6000) : null };
          });
        }
      }
    }
    report.viewButtonCount = await viewButtons.count().catch(() => null);
  } catch (error) {
    report.fatal = error && (error.stack || error.message) || String(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
    console.log(JSON.stringify(report, null, 2));
  }
})().catch((e) => console.log(JSON.stringify({ fatal: String(e && e.stack || e) }, null, 2)));
