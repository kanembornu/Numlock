#!/usr/bin/env node
/**
 * NUMLOCK Browser Smoke Harness
 *
 * Read-only acceptance tooling for NUMLOCK production deployment.
 * Uses system Chrome via Playwright — no browser binary download.
 *
 * Usage:
 *   node tests/browser/smoke.js <url>
 *   NUMLOCK_SMOKE_URL=<url> node tests/browser/smoke.js
 *
 * Exit: 0 = all PASS, 1 = any FAIL
 */

const { chromium } = require("playwright");

// ---------------------------------------------------------------------------
// URL resolution: CLI arg > env var
// ---------------------------------------------------------------------------
const URL_ARG = process.argv[2];
const ENV_URL = process.env.NUMLOCK_SMOKE_URL;
const TARGET_URL = URL_ARG || ENV_URL;

if (!TARGET_URL) {
  console.error("Usage: node tests/browser/smoke.js <url>");
  console.error("  or: NUMLOCK_SMOKE_URL=<url> node tests/browser/smoke.js");
  process.exit(2);
}

const TIMEOUT = parseInt(process.env.NUMLOCK_SMOKE_TIMEOUT, 10) || 30_000;

// ---------------------------------------------------------------------------
// Helpers — reusable across acceptance suites
// ---------------------------------------------------------------------------

async function navigateTo(page, url) {
  return page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
}

async function waitForReady(page, timeout) {
  const ms = timeout || TIMEOUT;
  await page.waitForLoadState("domcontentloaded", { timeout: ms });
}

async function isVisible(page, selector) {
  try {
    return await page.locator(selector).isVisible({ timeout: 5_000 });
  } catch {
    return false;
  }
}

async function getText(page, selector) {
  try {
    return (await page.locator(selector).innerText({ timeout: 5_000 })).trim();
  } catch {
    return null;
  }
}

async function clickNav(page, text) {
  const loc = page.getByText(text, { exact: false }).first();
  await loc.click({ timeout: 5_000 });
}

async function waitForContent(page, selector, timeout) {
  const ms = timeout || TIMEOUT;
  await page.locator(selector).first().waitFor({ state: "visible", timeout: ms });
}

async function detectLoading(page, selector, timeout) {
  const ms = timeout || 10_000;
  try {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const vis = await isVisible(page, selector);
      if (!vis) return false; // loading resolved
      await page.waitForTimeout(500);
    }
    return true; // still visible after timeout — permanent loading
  } catch {
    return false;
  }
}

async function captureConsole(page) {
  const messages = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      messages.push(msg.text());
    }
  });
  return messages;
}

async function capturePageErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => {
    errors.push(err.message || String(err));
  });
  return errors;
}

function assertNoErrors(errors) {
  return {
    name: "no-page-errors",
    pass: errors.length === 0,
    detail: errors.length === 0
      ? "No JS errors"
      : `${errors.length} error(s): ${errors[0]}`,
  };
}

function result(name, pass, detail) {
  return { name, pass, detail };
}

// ---------------------------------------------------------------------------
// Finance-specific helpers
// ---------------------------------------------------------------------------

async function navigateToFinance(page) {
  await clickNav(page, "Finance");
  await page.waitForLoadState("domcontentloaded", { timeout: TIMEOUT });
}

async function navigateToDepreciation(page) {
  await clickNav(page, "Depreciation");
  await page.waitForLoadState("domcontentloaded", { timeout: TIMEOUT });
}

async function checkNoPermanentLoading(page, text) {
  const spinnerVisible = await detectLoading(
    page,
    '[class*="loading"], [class*="spinner"], .ant-spin',
    10_000
  );
  return result(
    `no-permanent-loading-${text || "general"}`,
    !spinnerVisible,
    spinnerVisible ? "Loading indicator stuck" : "No permanent loading"
  );
}

async function waitForTerminalState(page, timeout) {
  const ms = timeout || TIMEOUT;
  const start = Date.now();
  const states = ["AVAILABLE", "EMPTY", "ERROR", "LOADED", "READY"];

  while (Date.now() - start < ms) {
    const body = await page.locator("body").innerText().catch(() => "");
    for (const state of states) {
      if (body.toUpperCase().includes(state)) {
        return result("terminal-state", true, `Reached: ${state}`);
      }
    }
    await page.waitForTimeout(1_000);
  }
  return result("terminal-state", false, "No terminal state reached within timeout");
}

// ---------------------------------------------------------------------------
// Main acceptance run
// ---------------------------------------------------------------------------

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const consoleErrors = await captureConsole(page);
  const pageErrors = await capturePageErrors(page);

  const results = [];

  try {
    // 1. Navigate to target
    console.error(`[smoke] Navigating to ${TARGET_URL}`);
    await navigateTo(page, TARGET_URL);
    results.push(result("navigate", true, `Loaded: ${page.url()}`));

    // 2. DOM ready
    await waitForReady(page);
    results.push(result("dom-ready", true, "DOM content loaded"));

    // 3. Page title
    const title = await page.title();
    results.push(result("has-title", !!title, `Title: "${title}"`));

    // 4. Body has content
    const bodyText = await page.locator("body").innerText().catch(() => "");
    results.push(
      result("body-has-content", bodyText.length > 0, `${bodyText.length} chars`)
    );

    // 5. No permanent loading spinner
    const loadingCheck = await checkNoPermanentLoading(page, "initial");
    results.push(loadingCheck);

    // 6. Page error check
    results.push(assertNoErrors(pageErrors));

    // 7. Console error check
    results.push(
      result(
        "no-console-errors",
        consoleErrors.length === 0,
        consoleErrors.length === 0
          ? "Clean console"
          : `${consoleErrors.length} console error(s)`
      )
    );
  } catch (err) {
    results.push(result("fatal", false, err.message));
  } finally {
    await browser.close();
  }

  // Output structured results
  const allPass = results.every((r) => r.pass);

  console.log(
    JSON.stringify(
      {
        target: TARGET_URL,
        pass: allPass,
        results,
      },
      null,
      2
    )
  );

  process.exit(allPass ? 0 : 1);
})();
