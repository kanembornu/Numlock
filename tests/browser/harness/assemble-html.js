#!/usr/bin/env node
/**
 * assemble-html.js - Extracts and assembles full HTML from template partials
 * Based on package022-acceptance.js pattern
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const FIXTURES_DIR = path.join(__dirname, "../fixtures");

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

  // P0 blank-body: 190.View.Index.html now owns the 4 receipt/expense shell
  // IDs (expenseCostType/expenseDate/expenseDateError/expensePolicyFields).
  // Older builds lacked them so the harness patched </form>. Keep the patch
  // only as fallback to avoid duplicate IDs after the shell fix.
  if (!html.includes('id="expenseCostType"'))
  {
    const expenseCostTypeElement = `
    <input type="hidden" id="expenseCostType" value="FIXED_COST">
    <input type="hidden" id="expenseDate" value="">
    <p id="expenseDateError" class="transaction-entry-error" role="alert" hidden></p>
    <div id="expensePolicyFields" hidden></div>
  `;
    html = html.replace('</form>', `${expenseCostTypeElement}\n            </form>`);
  }

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

// Inject google.script.run shim for local harness
  const shimScript = `
    <script>
      window.google = {
        script: {
          run: {
            withSuccessHandler: function(handler) {
              return {
                withFailureHandler: function(failureHandler) {
                  // Return a proxy that handles any function call
                  return new Proxy({}, {
                    get: function(target, prop) {
                      // Return a function that calls the success handler with mock data
                      return function(...args) {
                        console.log('[Shim] Call:', prop, args);
                        let result = { success: true, data: {} };
                        switch(prop) {
                          case 'getDashboardData': {
                            const db = JSON.parse(JSON.stringify(window.__NUMLOCK_FIXTURES__.dashboard));
                            const ppArray = db.performanceAnalytics.productProfitability;
                            const categories = db.performanceAnalytics.classifications && db.performanceAnalytics.classifications.category
                              ? db.performanceAnalytics.classifications.category.map(c => c.category)
                              : ['Unknown'];
                            db.performanceAnalytics.productProfitability = ppArray.map((p, idx) => ({
                              ...p,
                              category: categories[idx % categories.length]
                            }));
                            result = db;
                            break;
                          }
                          case 'getTransactionEntryOptions':
                            result = window.__NUMLOCK_FIXTURES__.entryOptions; break;
                          case 'getOperationalTransactionAuthority':
                            result = window.__NUMLOCK_FIXTURES__.operationalAuth; break;
                          case 'getProductEntryPricing': {
                            const productId = args[0], type = args[1];
                            const product = window.__NUMLOCK_FIXTURES__.entryOptions.data.sales.find(p => p.productId === productId);
                            result = product && product.pricing && product.pricing[type]
                              ? { success: true, data: product.pricing[type] }
                              : { success: false, error: { code: 'PRICE_NOT_FOUND' } };
                            break;
                          }
                          case 'getTransactionsPage':
                            result = window.__NUMLOCK_FIXTURES__.transactionsPage; break;
                          case 'getProductProfitabilityData': {
                            const db = window.__NUMLOCK_FIXTURES__.dashboard;
                            const ppArray = db.performanceAnalytics.productProfitability;
                            const categories = db.performanceAnalytics.classifications && db.performanceAnalytics.classifications.category
                              ? db.performanceAnalytics.classifications.category.map(c => c.category)
                              : ['Unknown'];
                            const products = ppArray.map((p, idx) => ({
                              productId: p.label,
                              productName: p.label,
                              label: p.label,
                              category: categories[idx % categories.length],
                              type: 'Hot',
                              units: 100,
                              revenue: p.revenue,
                              cogs: p.cogs,
                              grossProfit: p.grossMargin,
                              grossMargin: p.grossMarginPercent,
                              revenueMix: 0.1,
                              grossProfitMix: 0.1,
                              revenueRank: 1,
                              grossProfitRank: 1
                            }));
                            const summary = {
                              revenue: products.reduce((s, p) => s + p.revenue, 0),
                              cogs: products.reduce((s, p) => s + p.cogs, 0),
                              grossProfit: products.reduce((s, p) => s + p.grossProfit, 0),
                              grossMargin: 60.0,
                              units: products.reduce((s, p) => s + p.units, 0),
                              distinctProductCount: products.length,
                              productVariantCount: products.length
                            };
                            // Canonical flat response per 50.Analytics.Product.js
                            result = {
                              status: 'SUCCESS',
                              products: products,
                              summary: summary,
                              period: db.period || { label: 'Current Year' },
                              quality: { status: 'GOOD', issueCount: 0 }
                            };
                            break;
                          }
                          case 'submitCanonicalTransaction':
                            result = { success: true, data: { id: 'TXN-' + Date.now() } }; break;
                          case 'submitOperationalOrder': {
                            const payload = args[0];
                            result = { OrderNumber: 'ORD-' + Date.now(), OrderType: payload.orderType, Lines: payload.lines, OrderTotal: 50000, salesCohort: 'V2_COMMITTED' };
                            break;
                          }
                          case 'lookupPurchaseEventStatus':
                            result = { status: 'NOT_FOUND' }; break;
                          default:
                            result = { success: true, data: {} };
                        }
                        setTimeout(() => handler(result), 0);
                      };
                    }
                  });
                }
              };
            }
          }
        }
      };
      console.log('[Local Harness] google.script.run shim installed');
    </script>
  `;

  // Insert fixture script and shim before closing head tag
  const errorCaptureScript = `
    <script>
      window.onerror = function(message, source, lineno, colno, error) {
        console.log('[BROWSER ERROR]', message, 'at', source, ':', lineno, ':', colno);
        if (error && error.stack) console.log('[STACK]', error.stack);
      };
    </script>
  `;
  html = html.replace("</head>", `${errorCaptureScript}\n${fixtureScript}\n${shimScript}\n</head>`);

  return html;
}

/**
 * Audit for duplicate IDs
 */
function auditDuplicateIds(html) {
  const ids = html.match(/id="([^"]+)"/g) || [];
  const counts = {};
  ids.forEach(id => {
    const match = id.match(/id="([^"]+)"/);
    if (match) counts[match[1]] = (counts[match[1]] || 0) + 1;
  });
  const dupes = Object.entries(counts).filter(([_, c]) => c > 1);
  if (dupes.length > 0) {
    console.error('[Local Harness] DUPLICATE IDs DETECTED:');
    dupes.forEach(([id, count]) => console.error(`  ${id}: ${count}`));
    throw new Error(`Duplicate IDs found: ${dupes.map(([id]) => id).join(', ')}`);
  }
  console.log('[Local Harness] Duplicate ID audit: PASS (0 duplicates)');
}

/**
 * Write assembled HTML to output file
 */
function writeAssembledHtml(outputPath) {
  const html = assembleHtml();
  auditDuplicateIds(html);
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