#!/usr/bin/env node
/**
 * Read-only Transactions reporting-period probe.
 * Usage: node tests/browser/transactions-period-probe.js <targetUrl>
 * stdout: one JSON report. Exit 0 once report is emitted.
 */

const { chromium } = require("playwright");

const TARGET_URL = process.argv[2];
const TIMEOUT = 60_000;
const QUERY_TIMEOUT = 30_000;
const POLL_MS = 200;
const pageErrors = [];
const consoleErrors = [];
let browser;

if (!TARGET_URL) {
  console.error("Usage: node tests/browser/transactions-period-probe.js <targetUrl>");
  process.exit(2);
}

function validTarget(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch (error) {
    return false;
  }
}

async function inspectShell(scope) {
  const shell = scope.locator("#appShell");
  return await shell.count().catch(() => 0) > 0 && await shell.first().isVisible().catch(() => false);
}

async function waitForAppShell(page) {
  const deadline = Date.now() + 15_000;
  do {
    if (await inspectShell(page)) return { app: page, context: "TOP_LEVEL", frameCount: page.frames().length };
    const frames = page.frames();
    const named = frames.find((frame) => frame.name() === "userHtmlFrame");
    if (named && await inspectShell(named)) return { app: named, context: "USER_HTML_FRAME", frameCount: frames.length };
    for (const frame of frames) {
      if (frame !== page.mainFrame() && frame !== named && await inspectShell(frame)) {
        return { app: frame, context: "ENUMERATED_FRAME", frameCount: frames.length };
      }
    }
    await page.waitForTimeout(POLL_MS);
  } while (Date.now() < deadline);
  throw new Error(`App shell not ready; observed ${page.frames().length} frame(s)`);
}

async function waitForTransactions(scope) {
  await scope.locator("#transactions").waitFor({ state: "visible", timeout: TIMEOUT });
  await scope.waitForFunction(() => {
    const heading = document.querySelector("#transactionsResultHeading");
    const range = document.querySelector("#transactionsRangeSummary");
    return heading && range && !/loading/i.test(heading.textContent || "");
  }, null, { timeout: TIMEOUT });
}

async function periodControl(scope) {
  const candidates = ["#transactionsPeriod", "#transactionsFilter", "#filter"];
  for (const selector of candidates) {
    const control = scope.locator(selector).first();
    if (await control.count()) {
      return {
        selector,
        control,
        value: await control.inputValue(),
        options: await control.locator("option").evaluateAll((options) => options.map((option) => ({
          value: option.value,
          text: (option.textContent || "").trim(),
          selected: option.selected,
          disabled: option.disabled
        })))
      };
    }
  }
  throw new Error(`Transactions period control not found; tried ${candidates.join(", ")}`);
}

async function capture(scope, label) {
  const period = await periodControl(scope);
  const status = scope.locator("#transactionsIsActive").first();
  const activeTab = await scope.locator('[data-transactions-tab][aria-selected="true"]').first().getAttribute("data-transactions-tab").catch(() => null);
  const base = await scope.evaluate(() => ({
    heading: ((document.querySelector("#transactionsResultHeading") || {}).textContent || "").trim() || null,
    range: ((document.querySelector("#transactionsRangeSummary") || {}).textContent || "").trim() || null,
    rowCount: document.querySelectorAll("#tableBody .transactions-table-row").length,
    transactionTypes: Array.from(document.querySelectorAll("#tableBody .transaction-type")).map((node) => (node.textContent || "").trim())
  }));

  let purchaseRows = base.transactionTypes.filter((text) => /^Purchase$/i.test(text)).length;
  let purchaseMeasurement = "transaction-type markers in current tab";
  const purchaseTab = scope.locator('[data-transactions-tab="purchases"]').first();
  if (await purchaseTab.count()) {
    await purchaseTab.click();
    await scope.waitForTimeout(500);
    purchaseRows = await scope.locator("#tableBody .transactions-table-row").count();
    purchaseMeasurement = "purchases tab row count";
    const restoreTab = activeTab && activeTab !== "purchases"
      ? scope.locator(`[data-transactions-tab="${activeTab}"]`).first()
      : null;
    if (restoreTab && await restoreTab.count()) {
      await restoreTab.click();
      await scope.waitForTimeout(300);
    }
  }

  return {
    label,
    periodControl: { selector: period.selector, value: period.value, options: period.options },
    statusFilterValue: await status.inputValue().catch(() => null),
    heading: base.heading,
    range: base.range,
    rowCount: base.rowCount,
    purchaseRows,
    purchaseMeasurement
  };
}

function selectCandidate(options, preference) {
  const enabled = options.filter((option) => !option.disabled);
  for (const wanted of preference) {
    const found = enabled.find((option) => option.value === wanted || option.text.toLowerCase() === wanted.toLowerCase());
    if (found) return found;
  }
  return null;
}

async function selectPeriodAndWait(scope, candidate) {
  const period = await periodControl(scope);
  const before = await scope.evaluate(() => ({
    periodLabel: ((document.querySelector("#dateFilterLabel") || {}).textContent || "").trim(),
    range: ((document.querySelector("#transactionsRangeSummary") || {}).textContent || "").trim(),
    rows: document.querySelectorAll("#tableBody .transactions-table-row").length
  }));
  if (!candidate) return { changed: false, note: "No requested discrete period option available" };
  if (period.value === candidate.value) return { changed: false, note: `Already selected: ${candidate.text}` };

  await period.control.selectOption(candidate.value);
  await scope.waitForFunction(({ priorPeriodLabel, priorRange, priorRows }) => {
    const heading = ((document.querySelector("#transactionsResultHeading") || {}).textContent || "").trim();
    const periodLabel = ((document.querySelector("#dateFilterLabel") || {}).textContent || "").trim();
    const range = ((document.querySelector("#transactionsRangeSummary") || {}).textContent || "").trim();
    const rows = document.querySelectorAll("#tableBody .transactions-table-row").length;
    const section = document.querySelector("#transactions");
    return section && section.getAttribute("aria-busy") !== "true" && !/loading/i.test(heading) &&
      (periodLabel !== priorPeriodLabel || range !== priorRange || rows !== priorRows);
  }, { priorPeriodLabel: before.periodLabel, priorRange: before.range, priorRows: before.rows }, { timeout: QUERY_TIMEOUT });
  return { changed: true, note: `Selected ${candidate.text}` };
}

(async () => {
  const report = {
    targetUrl: TARGET_URL,
    timestamp: new Date().toISOString(),
    shell: null,
    default: null,
    widest: null,
    extra: null,
    interactions: [],
    discriminationInputs: null,
    pageErrors,
    consoleErrors,
    readOnly: true,
    readOnlyGuarantee: "Navigation, DOM reads, and non-persistent reporting-period/tab selection only; no business form submission, download, screenshot, file write, or direct server API invocation."
  };

  try {
    if (!validTarget(TARGET_URL)) throw new Error("Invalid HTTP(S) target URL");
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: false });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.on("pageerror", (error) => pageErrors.push(error.message || String(error)));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    const shell = await waitForAppShell(page);
    report.shell = { appShellReached: true, context: shell.context, frameCount: shell.frameCount };
    const app = shell.app;

    const nav = app.locator('[data-navigation-destination="transactions"]').first();
    if (!await nav.count()) throw new Error("Transactions navigation control missing");
    await nav.click();
    await waitForTransactions(app);

    report.default = await capture(app, "default");
    const options = report.default.periodControl.options;
    const widestCandidate = selectCandidate(options, ["currentYear", "This Year", "previousMonth", "Previous Month"]);
    report.interactions.push({ phase: "widest", candidate: widestCandidate, ...(await selectPeriodAndWait(app, widestCandidate)) });
    report.widest = await capture(app, "widest");

    const previousMonth = selectCandidate(options, ["previousMonth", "Previous Month"]);
    if (previousMonth && previousMonth.value !== report.widest.periodControl.value) {
      report.interactions.push({ phase: "extra", candidate: previousMonth, ...(await selectPeriodAndWait(app, previousMonth)) });
      report.extra = await capture(app, "previousMonth");
    } else {
      report.extra = { label: "previousMonth", skipped: true, reason: previousMonth ? "Already captured as widest" : "Option unavailable" };
    }

    report.discriminationInputs = {
      default: { period: report.default.periodControl.value, rows: report.default.rowCount, purchaseRows: report.default.purchaseRows },
      widest: { period: report.widest.periodControl.value, rows: report.widest.rowCount, purchaseRows: report.widest.purchaseRows },
      extra: report.extra && !report.extra.skipped
        ? { period: report.extra.periodControl.value, rows: report.extra.rowCount, purchaseRows: report.extra.purchaseRows }
        : null
    };
  } catch (error) {
    report.fatalError = error.message || String(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
    console.log(JSON.stringify(report, null, 2));
  }
})().catch((error) => {
  console.log(JSON.stringify({
    targetUrl: TARGET_URL,
    timestamp: new Date().toISOString(),
    fatalError: error.message || String(error),
    pageErrors,
    consoleErrors,
    readOnly: true
  }, null, 2));
});
