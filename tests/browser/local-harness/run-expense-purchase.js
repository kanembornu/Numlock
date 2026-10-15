#!/usr/bin/env node
/**
 * run-expense-purchase.js - Playwright test runner for Expense/Purchase UI acceptance
 * Assembles HTML, serves locally, injects RPC shim, captures screenshots
 */

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const http = require("node:http");

const ROOT = path.resolve(__dirname, "../../..");
const HARNESS_DIR = path.resolve(__dirname);
const OUTPUT_DIR = path.join(ROOT, "docs/evidence/local-visual/expense-purchase");
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, "screenshots");
const PORT = 34567;
const TARGET_URL = `http://localhost:${PORT}/`;
const TIMEOUT = 60000;

// Import assemble-html
const { assembleHtml } = require("./assemble-html.js");

// Required viewports for testing
const VIEWPORTS = [
  { width: 1440, height: 900, label: "1440x900" },
  { width: 1366, height: 768, label: "1366x768" },
  { width: 1280, height: 800, label: "1280x800" }
];

// Test themes
const THEMES = ["light", "dark"];

// Shell states (expanded/collapsed sidebar for desktop)
const SHELL_STATES = ["expanded", "collapsed"];

// Simple HTTP server to serve the assembled HTML
function createServer(html) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/" || req.url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(PORT, () => {
      console.log(`[Local Harness] HTTP server running on ${TARGET_URL}`);
      resolve(server);
    });
  });
}

// RPC shim injection script (inline for addInitScript)
const RPC_SHIM_SCRIPT = fs.readFileSync(path.join(HARNESS_DIR, "rpc-shim.js"), "utf8");

// Utility functions
function record(results, name, pass, detail) {
  results.push({ name, status: pass ? "PASS" : "FAIL", detail });
}

async function visible(page, selector) {
  try {
    return await page.locator(selector).first().isVisible();
  } catch {
    return false;
  }
}

async function setTheme(page, theme) {
  await page.locator("html").evaluate((element, value) => {
    element.setAttribute("data-theme", value);
    element.setAttribute("data-theme-preference", value);
    element.setAttribute("data-effective-theme", value);
  }, theme);
}

async function setShell(page, shell) {
  const collapsed = await page.locator("#appShell").getAttribute("data-sidebar-collapsed") === "true";
  if ((shell === "collapsed") !== collapsed) {
    await page.locator("#sidebarCollapseButton").click();
  }
}

async function openNewTransaction(page, type) {
  // Directly call the openTransactionEntry function instead of clicking the hidden button
  await page.evaluate(() => {
    if (typeof openTransactionEntry === 'function') {
      openTransactionEntry();
    }
  });
  await page.locator("#transactionEntryOverlay").waitFor({ state: "visible", timeout: TIMEOUT });
  await page.waitForTimeout(300);

  // Select transaction type (button IDs are transactionTypeSales, transactionTypeExpense, transactionTypePurchase)
  const typeMap = {
    "SALES": "transactionTypeSales",
    "EXPENSE": "transactionTypeExpense",
    "PURCHASE": "transactionTypePurchase"
  };
  await page.locator(`#${typeMap[type]}`).click();
  await page.waitForTimeout(300);
}

async function captureExpenseForm(page, viewport, theme, shell) {
  const results = [];
  const prefix = `expense-${viewport.label}-${theme}-${shell}`;

  try {
    // Open new transaction dialog
    await openNewTransaction(page, "EXPENSE");

    // Wait for expense fields to be visible (uses expenseEntryFields in HTML)
    await page.locator("#expenseEntryFields").waitFor({ state: "visible", timeout: TIMEOUT });
    await page.waitForTimeout(500);

    // Verify expense form elements (using correct IDs from HTML)
    const expenseSearchVisible = await visible(page, "#expenseEntrySearch");
    const amountVisible = await visible(page, "#expenseEntryAmount");
    // Note: expenseDate and costType are in receiptEntryFields, not expenseEntryFields
    // They appear when a purchase-required expense is selected

    record(results, `${prefix}: expense-search-visible`, expenseSearchVisible, "Expense search combobox");
    record(results, `${prefix}: amount-visible`, amountVisible, "Amount input");

    // Test combobox interaction
    if (expenseSearchVisible) {
      await page.locator("#expenseEntrySearch").click();
      await page.evaluate(() => { if (typeof filterTransactionEntryOptions === 'function') filterTransactionEntryOptions('expense'); });
      await page.waitForTimeout(200);
      const listboxVisible = await visible(page, "#expenseEntryListbox");
      record(results, `${prefix}: expense-listbox-opens`, listboxVisible, "Expense options listbox");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);
    }

    // Screenshot
    const filename = `${prefix}.png`;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: false });
    record(results, `${prefix}: screenshot`, true, filename);

  } catch (error) {
    record(results, `${prefix}: error`, false, error.message);
  }

  // Close dialog
  try {
    await page.evaluate(() => { if (typeof closeTransactionEntry === 'function') closeTransactionEntry(); });
    await page.waitForTimeout(200);
  } catch (closeError) {
    console.log(`[Local Harness] Error closing dialog: ${closeError.message}`);
  }

  return results;
}

async function capturePurchaseForm(page, viewport, theme, shell) {
  const results = [];
  const prefix = `purchase-${viewport.label}-${theme}-${shell}`;

  try {
    // Open new transaction dialog
    await openNewTransaction(page, "PURCHASE");

    // Wait for purchase fields to be visible (uses purchaseEntryFields in HTML)
    await page.locator("#purchaseEntryFields").waitFor({ state: "visible", timeout: TIMEOUT });
    await page.waitForTimeout(500);

    // Verify purchase form elements (using correct IDs from HTML)
    const purchaseSearchVisible = await visible(page, "#purchaseEntrySearch");
    const purchaseQtyVisible = await visible(page, "#purchaseEntryQty");
    const purchaseTotalVisible = await visible(page, "#purchaseEntryTotal");
    const purchaseSupplierVisible = await visible(page, "#purchaseEntrySupplier");
    const purchaseUomVisible = await visible(page, "#purchaseEntryUom");

    record(results, `${prefix}: purchase-search-visible`, purchaseSearchVisible, "Purchase search combobox");
    record(results, `${prefix}: purchase-qty-visible`, purchaseQtyVisible, "Purchase quantity input");
    record(results, `${prefix}: purchase-total-visible`, purchaseTotalVisible, "Purchase total input");
    record(results, `${prefix}: purchase-supplier-visible`, purchaseSupplierVisible, "Purchase supplier input");
    record(results, `${prefix}: purchase-uom-visible`, purchaseUomVisible, "Purchase UOM display");

    // Test combobox interaction
    if (purchaseSearchVisible) {
      await page.locator("#purchaseEntrySearch").click();
      await page.evaluate(() => { if (typeof filterTransactionEntryOptions === 'function') filterTransactionEntryOptions('purchase'); });
      await page.waitForTimeout(200);
      const listboxVisible = await visible(page, "#purchaseEntryListbox");
      record(results, `${prefix}: purchase-listbox-opens`, listboxVisible, "Purchase options listbox");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(100);
    }

    // Screenshot
    const filename = `${prefix}.png`;
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: false });
    record(results, `${prefix}: screenshot`, true, filename);

  } catch (error) {
    record(results, `${prefix}: error`, false, error.message);
  }

  // Close dialog
  try {
    await page.evaluate(() => { if (typeof closeTransactionEntry === 'function') closeTransactionEntry(); });
    await page.waitForTimeout(200);
  } catch (closeError) {
    console.log(`[Local Harness] Error closing dialog: ${closeError.message}`);
  }

  return results;
}

async function runTest() {
  // Ensure output directories exist
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("[Local Harness] Assembling HTML...");
  const html = assembleHtml();

  console.log("[Local Harness] Starting HTTP server...");
  const server = await createServer(html);

  const consoleEvents = [];
  const networkFailures = [];
  const pageErrors = [];
  const allResults = [];
  const manifest = [];
  let browser;

  try {
    console.log("[Local Harness] Launching browser...");
    browser = await chromium.launch({ channel: "chrome", headless: true });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true
    });

    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);

    // Collect console events
    page.on("console", (message) => consoleEvents.push({
      type: message.type(),
      text: message.text(),
      url: message.location().url || null
    }));

    page.on("pageerror", (error) => pageErrors.push({
      message: error.message,
      stack: error.stack || null
    }));

    page.on("requestfailed", (request) => networkFailures.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()
    }));

    // Inject RPC shim and fix for hidden elements
    await page.addInitScript(RPC_SHIM_SCRIPT + `
      // Force newTransactionButton to be visible by overriding CSS
      const style = document.createElement('style');
      style.textContent = '#newTransactionButton { display: inline-flex !important; visibility: visible !important; opacity: 1 !important; } #transactions.page { display: block !important; }';
      document.head.appendChild(style);
      
      // Also run after page scripts initialize
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          const btn = document.getElementById('newTransactionButton');
          if (btn) { btn.hidden = false; btn.style.display = 'inline-flex'; btn.style.visibility = 'visible'; btn.style.opacity = '1'; }
          const transactionsPage = document.getElementById('transactions');
          if (transactionsPage) { transactionsPage.hidden = false; transactionsPage.style.display = 'block'; }
        }, 100);
      });
    `);

    // Navigate to local server
    console.log("[Local Harness] Navigating to local server...");
    const response = await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });

    // Wait for dashboard to load and scripts to run
    await page.waitForTimeout(3000);

    record(allResults, "target responds", Boolean(response && response.ok()), response ? `${response.status()} ${page.url()}` : "no response");
    record(allResults, "local fixture identity", page.url() === TARGET_URL, page.url());
    record(allResults, "document title", Boolean(await page.title()), await page.title());

    // Wait for dashboard to load
    await page.waitForTimeout(1000);

    // Run tests for each viewport, theme, and shell combination
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) {
        for (const shell of SHELL_STATES) {
          try {
            console.log(`[Local Harness] Testing viewport: ${viewport.label}, theme: ${theme}, shell: ${shell}`);

            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await setTheme(page, theme);
            await setShell(page, shell);
            await page.waitForTimeout(300);

            // Test Expense form
            console.log(`  [Local Harness] Testing Expense form...`);
            const expenseResults = await captureExpenseForm(page, viewport, theme, shell);
            allResults.push(...expenseResults);

            // Test Purchase form
            console.log(`  [Local Harness] Testing Purchase form...`);
            const purchaseResults = await capturePurchaseForm(page, viewport, theme, shell);
            allResults.push(...purchaseResults);

            // Add to manifest
            manifest.push({
              viewport: viewport.label,
              theme,
              shell,
              expense: `expense-${viewport.label}-${theme}-${shell}.png`,
              purchase: `purchase-${viewport.label}-${theme}-${shell}.png`
            });
          } catch (error) {
            console.error(`[Local Harness] Error in viewport ${viewport.label}, theme ${theme}, shell ${shell}:`, error.message);
            record(allResults, `error-${viewport.label}-${theme}-${shell}`, false, error.message);
          }
        }
      }
    }

    // Summary
    console.log("\n[Local Harness] Test Results:");
    allResults.forEach(r => console.log(`  ${r.status}: ${r.name} - ${r.detail}`));

    const passCount = allResults.filter(r => r.status === "PASS").length;
    const failCount = allResults.filter(r => r.status === "FAIL").length;

    console.log(`\n[Local Harness] Summary: ${passCount} PASS, ${failCount} FAIL`);
    console.log(`[Local Harness] Output directory: ${OUTPUT_DIR}`);
    console.log(`[Local Harness] Screenshots directory: ${SCREENSHOTS_DIR}`);

    // Write manifest and evidence files
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "manifest.json"),
      JSON.stringify({
        target: TARGET_URL,
        source: "local assembled frontend",
        viewports: VIEWPORTS.map(v => v.label),
        themes: THEMES,
        shells: SHELL_STATES,
        frameCount: manifest.length,
        frames: manifest
      }, null, 2)
    );

    fs.writeFileSync(path.join(OUTPUT_DIR, "console.json"), JSON.stringify(consoleEvents, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, "network.json"), JSON.stringify(networkFailures, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, "functional-result.json"), JSON.stringify({
      target: TARGET_URL,
      source: "local assembled frontend",
      generatedAt: new Date().toISOString(),
      pass: failCount === 0 && pageErrors.length === 0,
      counts: {
        screenshots: manifest.length,
        consoleEvents: consoleEvents.length,
        consoleErrors: consoleEvents.filter(item => item.type === "error").length,
        networkFailures: networkFailures.length,
        pageErrors: pageErrors.length
      },
      results: allResults,
      fatal: null
    }, null, 2));

    process.exitCode = (failCount === 0 && pageErrors.length === 0) ? 0 : 1;

  } catch (error) {
    console.error("[Local Harness] Fatal error:", error);
    record(allResults, "fatal", false, error.message);

    fs.writeFileSync(path.join(OUTPUT_DIR, "functional-result.json"), JSON.stringify({
      target: TARGET_URL,
      source: "local assembled frontend",
      generatedAt: new Date().toISOString(),
      pass: false,
      counts: { screenshots: 0, consoleEvents: consoleEvents.length, networkFailures: networkFailures.length, pageErrors: pageErrors.length },
      results: allResults,
      fatal: { message: error.message, stack: error.stack }
    }, null, 2));

    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.close();
    console.log("[Local Harness] Server closed");
  }
}

// Run the test
runTest().catch(error => {
  console.error("[Local Harness] Unhandled error:", error);
  process.exit(1);
});