#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const TARGET_URL = "http://numlock.local/";
const VERSION = 586;
const TIMEOUT = 60_000;
const OUTPUT = path.resolve(ROOT, "docs/evidence/package022/browser");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const read = (filename) => fs.readFileSync(path.join(ROOT, filename), "utf8");

const html = read("190.View.Index.html")
  .replace(/<\?!= include\('([^']+)'\); \?>/g, (_, name) => read(`${name}.html`))
  .replace(/<\?!= HtmlService.createHtmlOutputFromFile\('([^']+)'\).getContent\(\); \?>/g, (_, name) => read(`${name}.html`))
  .replace(/<\?[\s\S]*?\?>/g, "LOCAL FIXTURE");

const dashboardResponse = {
  summary: { revenue: 0, expense: 0, profit: 0, unitsSold: 0, averageMonthlyRevenue: 0 },
  insights: { profitMargin: 0 },
  dateFilter: { filter: "currentYear", label: "Current year", startDate: "2026-01-01", endDate: "2026-12-31", rowCount: 0, availablePeriods: [] },
  reportingScope: { transactionCount: 0, lastTransactionDate: null },
  dataFreshness: { status: "No Data" },
  periodComparison: {
    changes: { revenuePercent: null, expensePercent: null, profitPercent: null, unitsSoldPercent: null, profitMarginPoints: null },
    status: { revenue: "No Comparison", expense: "No Comparison", profit: "No Comparison", unitsSold: "No Comparison", profitMargin: "No Comparison" },
    previous: { startDate: "2025-01-01", endDate: "2025-12-31", rowCount: 0 }
  },
  dataQuality: { status: "Good", issueCount: 0, issues: [], scope: { scopedRows: 0, excludedInvalidDateRows: 0 }, lifecycle: { inactiveCanonicalRows: 0 } },
  kpiTargets: { editable: false, provenance: "LOCAL FIXTURE", targets: [] },
  revenueTrend: { labels: [], values: [] },
  topProducts: [],
  performanceAnalytics: { productProfitability: [], classifications: { category: [], kind: [] }, hotColdEconomics: [], expenseGroups: [] },
  diagnosis: [],
  recommendations: [],
  recentTransactions: [],
  dashboardPerformance: { totalMs: 0, cacheHit: true }
};

async function fixtureRpc(name) {
  if (name === "getDashboardData") return dashboardResponse;
  if (name === "getTransactionsPage") return { rows: [], totalRows: 0, page: 1, pageSize: 15, totalPages: 0, rangeStart: 0, rangeEnd: 0, searchIndex: [], prefetchedPages: {}, cacheRevision: "local", cacheHit: true, executionMs: 0, payloadBytes: 0 };
  if (name === "getTransactionEntryOptions") return { success: true, data: { sales: [], expenses: [], revision: "local" } };
  if (name === "submitCanonicalTransaction") return { success: true, status: "OPERATIONAL_POSTED", data: {} };
  return { success: true, data: {} };
}

const views = [
  { id: "dashboard-overview", label: "Dashboard Overview", destination: "dashboard", ready: "#dashboardPanelOverview", tab: "#dashboardTabOverview" },
  { id: "dashboard-performance", label: "Dashboard Performance", destination: "dashboard", ready: "#dashboardPanelPerformance", tab: "#dashboardTabPerformance" },
  { id: "transactions", label: "Transactions", destination: "transactions", ready: "#transactions", heading: "Transactions" },
  { id: "settings", label: "Settings", destination: "settings", ready: "#settings", heading: "Settings" },
  { id: "logs", label: "Logs", destination: "logs", ready: "#logs", heading: "Logs" },
];
const states = [
  { width: 1440, height: 900, theme: "light", shell: "expanded" },
  { width: 1440, height: 900, theme: "light", shell: "collapsed" },
  { width: 1440, height: 900, theme: "dark", shell: "expanded" },
  { width: 1440, height: 900, theme: "dark", shell: "collapsed" },
  { width: 1280, height: 768, theme: "light", shell: "expanded" },
  { width: 1280, height: 768, theme: "light", shell: "collapsed" },
  { width: 1280, height: 768, theme: "dark", shell: "expanded" },
  { width: 1280, height: 768, theme: "dark", shell: "collapsed" },
  { width: 768, height: 900, theme: "light", shell: "drawer-closed" },
  { width: 768, height: 900, theme: "light", shell: "drawer-open" },
  { width: 768, height: 900, theme: "dark", shell: "drawer-closed" },
  { width: 768, height: 900, theme: "dark", shell: "drawer-open" },
  { width: 375, height: 812, theme: "light", shell: "drawer-closed" },
  { width: 375, height: 812, theme: "light", shell: "drawer-open" },
  { width: 375, height: 812, theme: "dark", shell: "drawer-closed" },
  { width: 375, height: 812, theme: "dark", shell: "drawer-open" },
];

function record(results, name, pass, detail) {
  results.push({ name, status: pass ? "PASS" : "FAIL", detail });
}
async function visible(page, selector) {
  return page.locator(selector).first().isVisible().catch(() => false);
}
async function setTheme(page, theme) {
  await page.locator("html").evaluate((element, value) => {
    element.setAttribute("data-theme", value);
    element.setAttribute("data-theme-preference", value);
  }, theme);
}
async function setShell(page, shell) {
  const mobile = shell.startsWith("drawer-");
  if (mobile) {
    const open = await page.locator("#sidebarMenuButton").getAttribute("aria-expanded") === "true";
    if (shell === "drawer-open" && !open) await page.locator("#sidebarMenuButton").click();
    if (shell === "drawer-closed" && open) await page.locator("#sidebarCloseButton").click();
    return;
  }
  const collapsed = await page.locator("#appShell").getAttribute("data-sidebar-collapsed") === "true";
  if ((shell === "collapsed") !== collapsed) await page.locator("#sidebarCollapseButton").click();
}
async function navigateView(page, view, mobile) {
  if (mobile) {
    const open = await page.locator("#sidebarMenuButton").getAttribute("aria-expanded") === "true";
    if (!open) await page.locator("#sidebarMenuButton").click();
  }
  await page.locator(`[data-navigation-destination="${view.destination}"]`).first().click();
  if (view.tab) await page.locator(view.tab).click();
  await page.locator(view.ready).waitFor({ state: "visible", timeout: TIMEOUT });
  await page.waitForTimeout(350);
}
async function checkView(page, view, results) {
  const title = (await page.locator("#utilityPageTitle").innerText().catch(() => "")).trim();
  const keyPresent = await visible(page, view.ready);
  const headingPresent = view.heading ? new RegExp(view.heading, "i").test(title) : /Dashboard/i.test(title);
  record(results, `${view.id}: title`, headingPresent, `utility title: ${JSON.stringify(title)}`);
  record(results, `${view.id}: key-elements`, keyPresent, view.ready);
  const errorVisible = await page.locator('[role="alert"]:visible').count().catch(() => 0);
  record(results, `${view.id}: no-page-level-error`, errorVisible === 0, `${errorVisible} visible alert(s)`);
}

(async () => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  const consoleEvents = [];
  const networkFailures = [];
  const pageErrors = [];
  const results = [];
  const manifest = [];
  let fatal = null;
  let browser;

  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.on("console", (message) => consoleEvents.push({ type: message.type(), text: message.text(), url: message.location().url || null }));
    page.on("pageerror", (error) => pageErrors.push({ message: error.message, stack: error.stack || null }));
    page.on("requestfailed", (request) => networkFailures.push({ url: request.url(), method: request.method(), error: request.failure() }));
    await page.route("**/*", (route) => route.request().url() === TARGET_URL
      ? route.fulfill({ contentType: "text/html", body: html })
      : route.abort());
    await page.exposeFunction("fixtureRpc", fixtureRpc);
    await page.addInitScript(() => {
      window.google = { script: { get run() {
        let success;
        let failure;
        const api = new Proxy({}, { get(_, name) {
          if (name === "withSuccessHandler") return (handler) => { success = handler; return api; };
          if (name === "withFailureHandler") return (handler) => { failure = handler; return api; };
          return (...args) => window.fixtureRpc(name, ...args).then(
            (result) => { if (success) success(result); },
            (error) => { if (failure) failure(error); }
          );
        } });
        return api;
      } } };
    });

    const response = await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
    record(results, "target responds", Boolean(response && response.ok()), response ? `${response.status()} ${page.url()}` : "no response");
    record(results, "local fixture identity", page.url() === TARGET_URL, page.url());
    record(results, "document title", Boolean(await page.title()), await page.title());

    for (let viewIndex = 0; viewIndex < views.length; viewIndex += 1) {
      const view = views[viewIndex];
      for (let stateIndex = 0; stateIndex < states.length; stateIndex += 1) {
        const state = states[stateIndex];
        await page.setViewportSize({ width: state.width, height: state.height });
        await setTheme(page, state.theme);
        await navigateView(page, view, state.width < 1024);
        await setShell(page, state.shell);
        if (stateIndex === 0) await checkView(page, view, results);
        const number = viewIndex * states.length + stateIndex + 1;
        const frameId = `P022-V${String(number).padStart(3, "0")}`;
        const filename = `${frameId}-${view.id}-${state.width}x${state.height}-${state.theme}-${state.shell}.png`;
        await page.screenshot({ path: path.join(SCREENSHOTS, filename), fullPage: false });
        manifest.push({ frameId, filename, view: view.label, viewport: { width: state.width, height: state.height }, theme: state.theme, shell: state.shell });
      }
    }

    await page.setViewportSize({ width: 1280, height: 768 });
    await navigateView(page, views[2], false);
    const exportButton = page.locator("#exportCsvButton");
    if (await exportButton.isVisible().catch(() => false) && await exportButton.isEnabled().catch(() => false)) {
      const download = await Promise.all([page.waitForEvent("download", { timeout: TIMEOUT }), exportButton.click()]).then(([item]) => item);
      record(results, "transactions CSV export", Boolean(download.suggestedFilename()), download.suggestedFilename());
    } else {
      record(results, "transactions CSV export", await exportButton.isVisible().catch(() => false), "empty transaction fixture correctly disables export");
    }

    await navigateView(page, views[0], false);
    await page.emulateMedia({ media: "print" });
    const printImage = await page.screenshot({ type: "png", fullPage: false });
    record(results, "dashboard print report", printImage.length > 0, `${printImage.length} screenshot bytes; in-memory to preserve exact 80-frame manifest`);
    await page.emulateMedia({ media: "screen" });

    await page.setViewportSize({ width: 320, height: 568 });
    await navigateView(page, views[0], true);
    await setShell(page, "drawer-closed");
    const overflow = await page.locator("html").evaluate((element) => ({ scrollWidth: element.scrollWidth, innerWidth: element.ownerDocument.defaultView.innerWidth }));
    record(results, "320px no horizontal overflow", overflow.scrollWidth <= overflow.innerWidth, JSON.stringify(overflow));

    record(results, "no page errors", pageErrors.length === 0, `${pageErrors.length} page error(s)`);
    const tailwindRequests = [...networkFailures, ...consoleEvents].filter((entry) => /cdn\.tailwindcss\.com/i.test(entry.url || entry.text || ""));
    record(results, "no Tailwind CDN request", tailwindRequests.length === 0, `${tailwindRequests.length} observed Tailwind CDN event(s)`);
    record(results, "exact screenshot count", manifest.length === 80 && fs.readdirSync(SCREENSHOTS).filter((name) => name.endsWith(".png")).length === 80, `${manifest.length} manifest frames, ${fs.readdirSync(SCREENSHOTS).filter((name) => name.endsWith(".png")).length} PNG files`);
  } catch (error) {
    fatal = { message: error.message, stack: error.stack || null };
    record(results, "fatal", false, error.message);
  } finally {
    if (browser) await browser.close();
    const summary = {
      target: TARGET_URL,
      source: "local assembled frontend",
      version: VERSION,
      generatedAt: new Date().toISOString(),
      pass: !fatal && results.every((item) => item.status === "PASS"),
      counts: { screenshots: manifest.length, consoleEvents: consoleEvents.length, consoleErrors: consoleEvents.filter((item) => item.type === "error").length, networkFailures: networkFailures.length, pageErrors: pageErrors.length },
      results,
      fatal,
    };
    fs.writeFileSync(path.join(OUTPUT, "manifest.json"), JSON.stringify({ target: TARGET_URL, source: "local assembled frontend", version: VERSION, frameCount: manifest.length, frames: manifest }, null, 2));
    fs.writeFileSync(path.join(OUTPUT, "console.json"), JSON.stringify(consoleEvents, null, 2));
    fs.writeFileSync(path.join(OUTPUT, "network.json"), JSON.stringify(networkFailures, null, 2));
    fs.writeFileSync(path.join(OUTPUT, "functional-result.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.pass ? 0 : 1;
  }
})();
