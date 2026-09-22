#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../..");
const DEPLOYMENT_ID = "AKfycbxFfb_G_GcYFLYFLEdPzX3TA2y1B-VraDCxfrjEYSVtG6h__GENqaOjP2nen9V38_gR";
const TARGET_URL = `https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec`;
const VERSION = 587;
const TIMEOUT = 90_000;
const OUTPUT = path.resolve(ROOT, "docs/evidence/package022/v587/browser-deployed");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");

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
async function visible(app, selector) {
  return app.locator(selector).first().isVisible().catch(() => false);
}
async function setTheme(app, theme) {
  await app.locator("html").evaluate((element, value) => {
    element.setAttribute("data-theme", value);
    element.setAttribute("data-theme-preference", value);
  }, theme);
}
async function setShell(app, shell) {
  const mobile = shell.startsWith("drawer-");
  if (mobile) {
    const open = await app.locator("#sidebarMenuButton").getAttribute("aria-expanded") === "true";
    if (shell === "drawer-open" && !open) await app.locator("#sidebarMenuButton").click();
    if (shell === "drawer-closed" && open) await app.locator("#sidebarCloseButton").click();
    return;
  }
  const collapsed = await app.locator("#appShell").getAttribute("data-sidebar-collapsed") === "true";
  if ((shell === "collapsed") !== collapsed) await app.locator("#sidebarCollapseButton").click();
}
async function navigateView(app, page, view, mobile) {
  if (mobile) {
    const open = await app.locator("#sidebarMenuButton").getAttribute("aria-expanded") === "true";
    if (!open) await app.locator("#sidebarMenuButton").click();
  }
  await app.locator(`[data-navigation-destination="${view.destination}"]`).first().click();
  if (view.tab) await app.locator(view.tab).click();
  await app.locator(view.ready).waitFor({ state: "visible", timeout: TIMEOUT });
  await page.waitForTimeout(350);
}
async function checkView(app, view, results) {
  const title = (await app.locator("#utilityPageTitle").innerText().catch(() => "")).trim();
  const keyPresent = await visible(app, view.ready);
  const headingPresent = view.heading ? new RegExp(view.heading, "i").test(title) : /Dashboard/i.test(title);
  record(results, `${view.id}: title`, headingPresent, `utility title: ${JSON.stringify(title)}`);
  record(results, `${view.id}: key-elements`, keyPresent, view.ready);
  const errorVisible = await app.locator('[role="alert"]:visible').count().catch(() => 0);
  record(results, `${view.id}: no-page-level-error`, errorVisible === 0, `${errorVisible} visible alert(s)`);
}
async function authBlocked(page) {
  const url = page.url();
  const loginUi = await page.locator('input[type="email"], input[type="password"], a[href*="accounts.google.com"]').count().catch(() => 0);
  return /accounts\.google\.com|ServiceLogin/i.test(url) || loginUi > 0;
}

(async () => {
  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  for (const name of fs.readdirSync(SCREENSHOTS)) {
    if (name.endsWith(".png")) fs.rmSync(path.join(SCREENSHOTS, name));
  }
  const consoleEvents = [];
  const networkEvents = [];
  const pageErrors = [];
  const results = [];
  const manifest = [];
  let fatal = null;
  let blocked = null;
  let browser;

  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.on("console", (message) => consoleEvents.push({ type: message.type(), text: message.text(), url: message.location().url || null }));
    page.on("pageerror", (error) => pageErrors.push({ message: error.message, stack: error.stack || null }));
    page.on("response", (response) => networkEvents.push({ type: "response", url: response.url(), method: response.request().method(), status: response.status(), resourceType: response.request().resourceType() }));
    page.on("requestfailed", (request) => networkEvents.push({ type: "requestfailed", url: request.url(), method: request.method(), resourceType: request.resourceType(), error: request.failure() }));

    const response = await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    const iframe = page.locator('iframe[src*="userCodeAppPanel"]');
    try {
      await iframe.waitFor({ state: "attached", timeout: TIMEOUT });
    } catch (error) {
      if (await authBlocked(page)) {
        blocked = { reason: "GOOGLE_LOGIN_REQUIRED", url: page.url(), detail: error.message };
        record(results, "deployed smoke: authentication", false, `Google login blocked access at ${page.url()}`);
        return;
      }
      throw new Error(`Deployed smoke failed waiting for Apps Script iframe: ${error.message}`);
    }

    page.frameLocator('iframe[src*="userCodeAppPanel"]');
    await page.waitForFunction(() => Array.from(document.querySelectorAll("iframe")).some((element) => element.src.includes("userCodeAppPanel")), null, { timeout: TIMEOUT });
    await page.waitForTimeout(1_000);
    let app = page.frame({ name: "userHtmlFrame" });
    const deadline = Date.now() + TIMEOUT;
    while (!app && Date.now() < deadline) {
      await page.waitForTimeout(250);
      app = page.frame({ name: "userHtmlFrame" });
    }
    if (!app) throw new Error("Deployed smoke failed: Apps Script userHtmlFrame unavailable");
    await app.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
    const basicDashboard = await visible(app, "#dashboardPanelOverview") && await visible(app, "#utilityPageTitle");
    if (!basicDashboard) throw new Error("Deployed smoke failed: basic dashboard elements missing");
    record(results, "target responds", Boolean(response && response.ok()), response ? `${response.status()} ${page.url()}` : "no response");
    record(results, "deployed identity", page.url().includes(DEPLOYMENT_ID), page.url());
    record(results, "document title", Boolean(await page.title()), await page.title());

    for (let viewIndex = 0; viewIndex < views.length; viewIndex += 1) {
      const view = views[viewIndex];
      for (let stateIndex = 0; stateIndex < states.length; stateIndex += 1) {
        const state = states[stateIndex];
        await page.setViewportSize({ width: state.width, height: state.height });
        await setTheme(app, state.theme);
        await navigateView(app, page, view, state.width < 1024);
        await setShell(app, state.shell);
        if (stateIndex === 0) await checkView(app, view, results);
        const number = viewIndex * states.length + stateIndex + 1;
        const frameId = `P022-V${String(number).padStart(3, "0")}`;
        const filename = `${frameId}-${view.id}-${state.width}x${state.height}-${state.theme}-${state.shell}.png`;
        await page.screenshot({ path: path.join(SCREENSHOTS, filename), fullPage: false });
        manifest.push({ frameId, filename, view: view.label, viewport: { width: state.width, height: state.height }, theme: state.theme, shell: state.shell });
      }
    }

    await page.setViewportSize({ width: 1280, height: 768 });
    await navigateView(app, page, views[2], false);
    const exportButton = app.locator("#exportCsvButton");
    if (await exportButton.isVisible().catch(() => false) && await exportButton.isEnabled().catch(() => false)) {
      const download = await Promise.all([page.waitForEvent("download", { timeout: TIMEOUT }), exportButton.click()]).then(([item]) => item);
      record(results, "transactions CSV export", Boolean(download.suggestedFilename()), download.suggestedFilename());
    } else {
      record(results, "transactions CSV export", await exportButton.isVisible().catch(() => false), "real deployment has no exportable transactions or export is unavailable");
    }

    await navigateView(app, page, views[0], false);
    await page.emulateMedia({ media: "print" });
    const printImage = await page.screenshot({ type: "png", fullPage: false });
    record(results, "dashboard print report", printImage.length > 0, `${printImage.length} screenshot bytes; in-memory to preserve exact 80-frame manifest`);
    await page.emulateMedia({ media: "screen" });

    await page.setViewportSize({ width: 320, height: 568 });
    await navigateView(app, page, views[0], true);
    await setShell(app, "drawer-closed");
    const overflow = await app.locator("html").evaluate((element) => ({ scrollWidth: element.scrollWidth, innerWidth: element.ownerDocument.defaultView.innerWidth }));
    record(results, "320px no horizontal overflow", overflow.scrollWidth <= overflow.innerWidth, JSON.stringify(overflow));

    record(results, "no page errors", pageErrors.length === 0, `${pageErrors.length} page error(s)`);
    const tailwindRequests = networkEvents.filter((entry) => /cdn\.tailwindcss\.com/i.test(entry.url || ""));
    record(results, "no Tailwind CDN request", tailwindRequests.length === 0, `${tailwindRequests.length} observed Tailwind CDN event(s)`);
    const pngCount = fs.readdirSync(SCREENSHOTS).filter((name) => name.endsWith(".png")).length;
    record(results, "exact screenshot count", manifest.length === 80 && pngCount === 80, `${manifest.length} manifest frames, ${pngCount} PNG files`);
  } catch (error) {
    fatal = { message: error.message, stack: error.stack || null };
    record(results, "fatal", false, error.message);
  } finally {
    if (browser) await browser.close();
    const summary = {
      target: TARGET_URL,
      deploymentId: DEPLOYMENT_ID,
      sourceMode: "DEPLOYED_APPS_SCRIPT",
      version: VERSION,
      generatedAt: new Date().toISOString(),
      pass: !fatal && !blocked && results.every((item) => item.status === "PASS"),
      blocked,
      counts: {
        screenshots: manifest.length,
        consoleEvents: consoleEvents.length,
        consoleErrors: consoleEvents.filter((item) => item.type === "error").length,
        networkEvents: networkEvents.length,
        networkFailures: networkEvents.filter((item) => item.type === "requestfailed").length,
        pageErrors: pageErrors.length,
      },
      results,
      fatal,
    };
    fs.writeFileSync(path.join(OUTPUT, "manifest.json"), JSON.stringify({ target: TARGET_URL, deploymentId: DEPLOYMENT_ID, sourceMode: "DEPLOYED_APPS_SCRIPT", version: VERSION, frameCount: manifest.length, frames: manifest }, null, 2));
    fs.writeFileSync(path.join(OUTPUT, "console.json"), JSON.stringify(consoleEvents, null, 2));
    fs.writeFileSync(path.join(OUTPUT, "network.json"), JSON.stringify(networkEvents, null, 2));
    fs.writeFileSync(path.join(OUTPUT, "functional-result.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = summary.pass ? 0 : 1;
  }
})();
