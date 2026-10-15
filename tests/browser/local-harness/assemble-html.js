#!/usr/bin/env node
/**
 * assemble-html.js - Extracts and assembles full HTML from template partials
 * Based on package022-acceptance.js pattern
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

/**
 * Read a file from the repository root
 */
function read(filename) {
  return fs.readFileSync(path.join(ROOT, filename), "utf8");
}

/**
 * Assemble the complete HTML by resolving all include() and HtmlService.createHtmlOutputFromFile() directives
 */
function assembleHtml() {
  let html = read("190.View.Index.html");

  // Resolve <?!= include('...'); ?> directives
  html = html.replace(/<\?!= include\('([^']+)'\); \?>/g, (_, name) => {
    const includePath = `${name}.html`;
    try {
      return read(includePath);
    } catch (error) {
      console.warn(`Warning: Could not read include ${includePath}: ${error.message}`);
      return `<!-- INCLUDE MISSING: ${includePath} -->`;
    }
  });

  // Resolve <?!= HtmlService.createHtmlOutputFromFile('...').getContent(); ?> directives
  html = html.replace(/<\?!= HtmlService\.createHtmlOutputFromFile\('([^']+)'\)\.getContent\(\); \?>/g, (_, name) => {
    const includePath = `${name}.html`;
    try {
      return read(includePath);
    } catch (error) {
      console.warn(`Warning: Could not read HtmlService include ${includePath}: ${error.message}`);
      return `<!-- HTMLSERVICE INCLUDE MISSING: ${includePath} -->`;
    }
  });

  // Replace remaining Apps Script template directives with placeholder
  html = html.replace(/<\?[\s\S]*?\?>/g, "LOCAL FIXTURE");

  // Add missing expenseCostType element for initializeStableDashboardElements
  // The JavaScript expects this element but it doesn't exist in the original HTML
  const expenseCostTypeElement = `
    <input type="hidden" id="expenseCostType" value="FIXED_COST">
    <input type="hidden" id="expenseDate" value="">
    <input type="hidden" id="expenseDateError" value="">
    <div id="expensePolicyFields" hidden></div>
    <div id="receiptChoicesState" role="status" aria-live="polite"></div>
    <button id="receiptRecovery" type="button" class="transaction-entry-secondary" hidden>Check purchase status</button>
    <button id="receiptRetry" type="button" class="transaction-entry-primary" hidden>Retry Purchase</button>
    <input type="hidden" id="receiptDate" value="">
    <input type="hidden" id="receiptDateError" value="">
    <input type="hidden" id="receiptQty" value="">
    <input type="hidden" id="receiptQtyError" value="">
    <input type="hidden" id="receiptUom" value="">
    <input type="hidden" id="receiptUomError" value="">
    <input type="hidden" id="receiptCost" value="">
    <input type="hidden" id="receiptCostError" value="">
    <input type="hidden" id="receiptSupplier" value="">
    <input type="hidden" id="receiptSupplierError" value="">
    <select id="receiptCashAccount" aria-describedby="receiptCashAccountError"><option value="">Select payment account…</option></select>
    <p id="receiptCashAccountError" class="transaction-entry-error" role="alert"></p>
  `;
  // Insert before the closing of the transactionEntryForm
  html = html.replace('</form>', `${expenseCostTypeElement}\n            </form>`);

  // Inject fixture data as global variables for the RPC shim
  const dashboardData = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "dashboard.json"), "utf8"));
  const entryOptions = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "entry-options.json"), "utf8"));
  const operationalAuth = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "operational-auth.json"), "utf8"));
  const pricingData = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "pricing.json"), "utf8"));
  const transactionsPage = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "transactions-page.json"), "utf8"));

  const fixtureScript = `
    <script>
      window.__NUMLOCK_FIXTURES__ = {
        dashboard: ${JSON.stringify(dashboardData)},
        entryOptions: ${JSON.stringify(entryOptions)},
        operationalAuth: ${JSON.stringify(operationalAuth)},
        pricing: ${JSON.stringify(pricingData)},
        transactionsPage: ${JSON.stringify(transactionsPage)}
      };
      console.log('[Local Harness] Fixtures injected:', Object.keys(window.__NUMLOCK_FIXTURES__));
    </script>
  `;

  // Insert fixture script before closing head tag
  html = html.replace("</head>", `${fixtureScript}\n</head>`);

  return html;
}

/**
 * Write assembled HTML to output file
 */
function writeAssembledHtml(outputPath) {
  const html = assembleHtml();
  fs.writeFileSync(outputPath, html, "utf8");
  console.log(`[Local Harness] Assembled HTML written to ${outputPath} (${html.length} chars)`);
  return html;
}

// CLI usage
if (require.main === module) {
  const outputPath = process.argv[2] || path.join(__dirname, "assembled.html");
  writeAssembledHtml(outputPath);
}

module.exports = { assembleHtml, writeAssembledHtml, read, ROOT, FIXTURES_DIR };