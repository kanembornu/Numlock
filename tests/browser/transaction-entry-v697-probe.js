#!/usr/bin/env node
/**
 * Read-only Candidate v697 Transaction Entry browser acceptance probe (Phase C).
 * Usage: node tests/browser/transaction-entry-v697-probe.js <targetUrl>
 * stdout: one JSON report. Exit 0 once report is emitted; verdicts carry failures.
 *
 * NEVER clicks Save Order / Confirm Payment / Save Transaction / Save Purchase /
 * Save Expense. Never invokes mutation endpoints. Detect-only auth handling.
 */

const { chromium } = require("playwright");

const TARGET_URL = process.argv[2];
const TIMEOUT = 60_000;
const AUTHORITY_TIMEOUT = 20_000;
const POLL_MS = 200;
const READ_ONLY_GUARANTEE =
  "Navigation, DOM reads, client-side select value assignment limited to authority fields, and client price/variant display functions only; no Save Order, Confirm Payment, Save Transaction, Save Purchase, Save Expense, no mutation endpoint invocation, no form submission.";

const ASSERTION_IDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const ASSERTION_NAMES = {
  A: "ENTRY_LOAD",
  B: "PRODUCT_AUTHORITY",
  C: "VARIANT_AUTHORITY",
  D: "SINGLE_VARIANT",
  E: "MULTIPLE_VARIANTS",
  F: "SELLING_PRICE",
  G: "ORDER_TYPE",
  H: "ORDER_STAGE_RECEIVE_VIA",
  I: "PAYMENT_STAGE_RECEIVE_VIA",
  J: "SUPPLIER_INDEPENDENCE",
  K: "INVENTORY_INDEPENDENCE",
  L: "CUSTOMER_INDEPENDENCE"
};

const pageErrors = [];
const consoleErrors = [];
const assertions = [];
const authWall = { url: null, reason: null };
let browser;
let blocked = null;

function validTarget(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch (error) {
    return false;
  }
}

function candidateDeploymentId(value) {
  const match = /\/macros\/s\/([^/?#]+)/.exec(String(value || ""));
  return match ? match[1] : null;
}

function relevant(errors) {
  return errors.filter((entry) => !/favicon|third-party cookie|net::err_aborted|\b404\b/i.test(entry.text || ""));
}

function record(id, status, evidence) {
  assertions.push({ id, name: ASSERTION_NAMES[id] || id, status, evidence: String(evidence || "").slice(0, 1200) });
}

function fillRemaining(status, message) {
  for (const id of ASSERTION_IDS) {
    if (!assertions.some((item) => item.id === id)) record(id, status, message);
  }
}

function counts() {
  const tally = { total: assertions.length, pass: 0, fail: 0, notMeasurable: 0 };
  for (const item of assertions) {
    if (item.status === "PASS") tally.pass += 1;
    else if (item.status === "FAIL") tally.fail += 1;
    else tally.notMeasurable += 1;
  }
  return tally;
}

function report() {
  console.log(JSON.stringify({
    targetUrl: TARGET_URL || null,
    candidateDeploymentId: candidateDeploymentId(TARGET_URL),
    assertions,
    counts: counts(),
    blocked,
    readOnlyGuarantee: READ_ONLY_GUARANTEE,
    pageErrors,
    consoleErrors
  }, null, 2));
}

async function inspectShell(scope) {
  const shell = scope.locator("#appShell");
  return await shell.count().catch(() => 0) > 0 && await shell.first().isVisible().catch(() => false);
}

async function waitForAppShell(page) {
  const deadline = Date.now() + 15_000;
  do {
    if (await inspectShell(page)) return { app: page, context: "TOP_LEVEL", frames: page.frames().length };
    const frames = page.frames();
    const named = frames.find((frame) => frame.name() === "userHtmlFrame");
    if (named && await inspectShell(named)) return { app: named, context: "USER_HTML_FRAME", frames: frames.length };
    for (const frame of frames) {
      if (frame !== page.mainFrame() && frame !== named && await inspectShell(frame)) {
        return { app: frame, context: "ENUMERATED_FRAME", frames: frames.length };
      }
    }
    await page.waitForTimeout(POLL_MS);
  } while (Date.now() < deadline);
  throw new Error(`App shell not ready; observed ${page.frames().length} frame(s)`);
}

async function authBlocked(page) {
  const url = page.url();
  const loginUi = await page.locator('input[type="email"], input[type="password"], a[href*="accounts.google.com"]').count().catch(() => 0);
  return /accounts\.google\.com|ServiceLogin/i.test(url) || loginUi > 0;
}

function markAuthBlocked(page) {
  blocked = { reason: "GOOGLE_LOGIN_REQUIRED", url: page.url() };
  authWall.url = page.url();
  authWall.reason = "GOOGLE_LOGIN_REQUIRED";
  fillRemaining("FAIL", "blocked: GOOGLE_LOGIN_REQUIRED — probe never interacts with login UI");
}

async function pollEntryState(app, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  do {
    last = await app.evaluate(() => {
      const authority = (typeof operationalTransactionState !== "undefined" && operationalTransactionState && operationalTransactionState.authority) || null;
      const entry = (typeof transactionEntryState !== "undefined" && transactionEntryState) || null;
      return {
        authorityLoaded: Boolean(authority),
        products: authority && Array.isArray(authority.products) ? authority.products.length : 0,
        productVariants: authority && Array.isArray(authority.productVariants) ? authority.productVariants.length : 0,
        suppliers: authority && Array.isArray(authority.suppliers) ? authority.suppliers.length : 0,
        paymentMethods: authority && Array.isArray(authority.paymentMethods) ? authority.paymentMethods.length : 0,
        optionsLoaded: Boolean(entry && entry.optionsLoaded),
        salesOptions: entry && entry.entryOptions && Array.isArray(entry.entryOptions.sales) ? entry.entryOptions.sales.length : 0,
        expenseOptions: entry && entry.entryOptions && Array.isArray(entry.entryOptions.expenses) ? entry.entryOptions.expenses.length : 0
      };
    }).catch(() => null);
    if (last && (last.authorityLoaded || last.optionsLoaded)) return last;
    await app.waitForTimeout(POLL_MS);
  } while (Date.now() < deadline);
  return last;
}

async function snapshotDom(app) {
  return app.evaluate(() => {
    function read(id) {
      const element = document.getElementById(id);
      if (!element) return { id, exists: false };
      const options = element.tagName === "SELECT"
        ? Array.from(element.options).map((option) => ({ value: option.value, text: (option.textContent || "").trim() }))
        : null;
      return {
        id,
        exists: true,
        tag: element.tagName,
        hidden: Boolean(element.hidden),
        readonly: element.hasAttribute("readonly"),
        value: "value" in element ? String(element.value) : null,
        onchange: element.getAttribute("onchange"),
        options,
        promptText: options && options[0] ? options[0].text : null
      };
    }
    function section(id) {
      const element = document.getElementById(id);
      if (!element) return { id, exists: false, hidden: null, text: "", ids: [] };
      return {
        id,
        exists: true,
        hidden: Boolean(element.hidden),
        text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 600),
        ids: Array.from(element.querySelectorAll("[id]")).map((node) => node.id),
        hasReceiveVia: Boolean(element.querySelector("#operationalReceiveVia") || element.querySelector('label[for="operationalReceiveVia"]')),
        hasSupplier: Boolean(element.querySelector("#operationalSupplier") || element.querySelector('label[for="operationalSupplier"]'))
      };
    }
    return {
      overlayHidden: (document.getElementById("transactionEntryOverlay") || { hidden: null }).hidden,
      dialogExists: Boolean(document.getElementById("transactionEntryDialog")),
      orderType: read("operationalOrderType"),
      product: read("operationalProduct"),
      variant: read("operationalProductVariant"),
      price: read("operationalSellingPrice"),
      receiveVia: read("operationalReceiveVia"),
      paymentAmount: read("operationalPaymentAmount"),
      supplier: read("operationalSupplier"),
      productSearch: read("productEntrySearch"),
      salesPricingState: read("salesPricingState"),
      salesPricingPreview: read("salesPricingPreview"),
      salesTypeHot: read("salesTypeHot"),
      salesTypeCold: read("salesTypeCold"),
      orderSection: section("operationalOrderFields"),
      paymentSection: section("operationalPaymentFields"),
      purchaseSection: section("operationalPurchaseFields"),
      salesSection: section("salesEntryFields")
    };
  });
}

function nonPromptOptions(selectDom) {
  if (!selectDom || !selectDom.exists || !Array.isArray(selectDom.options)) return [];
  return selectDom.options.filter((option) => option.value !== "");
}

(async () => {
  if (!validTarget(TARGET_URL)) {
    record("A", "FAIL", "Missing or invalid HTTP(S) target URL. Usage: node tests/browser/transaction-entry-v697-probe.js <targetUrl>");
    fillRemaining("FAIL", "blocked: invalid target — assertions not measurable");
    report();
    return;
  }

  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: false });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.on("pageerror", (error) => pageErrors.push({ text: error.message || String(error) }));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push({ text: message.text() });
    });

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    if (await authBlocked(page)) {
      markAuthBlocked(page);
      return;
    }

    const shell = await waitForAppShell(page);
    const app = shell.app;

    // Navigate to Transactions (read-only navigation control).
    const transactionNav = app.locator('[data-navigation-destination="transactions"]').first();
    if (await transactionNav.count() !== 1) throw new Error("Transactions navigation control missing");
    await transactionNav.click();
    await app.locator("#transactions").waitFor({ state: "visible", timeout: TIMEOUT });
    if (await authBlocked(page)) {
      markAuthBlocked(page);
      return;
    }

    // A. Entry load — open dialog via read-only trigger.
    const openErrorsBefore = relevant(pageErrors).length;
    await app.locator("#newTransactionButton").click();
    await app.locator("#transactionEntryDialog").waitFor({ state: "visible", timeout: TIMEOUT });
    const appShellReady = await inspectShell(app);
    const dialogVisible = await app.locator("#transactionEntryDialog").isVisible().catch(() => false);
    const openPageErrors = relevant(pageErrors).slice(openErrorsBefore);
    record("A", dialogVisible && appShellReady && openPageErrors.length === 0 ? "PASS" : "FAIL",
      `dialogVisible=${dialogVisible}; appShellReady=${appShellReady}; context=${shell.context}; openPageErrors=${JSON.stringify(openPageErrors)}`);
    if (await authBlocked(page)) {
      markAuthBlocked(page);
      return;
    }

    // Wait for server read-only RPCs fired on open (getTransactionEntryOptions + getOperationalTransactionAuthority).
    const entryState = await pollEntryState(app, AUTHORITY_TIMEOUT);
    const dom = await snapshotDom(app);

    // B. Product authority — operational select populated from server authority, or canonical sales options.
    const productOptions = nonPromptOptions(dom.product);
    const salesOptionCount = entryState ? entryState.salesOptions : 0;
    const productAuthorityPass = productOptions.length > 0 || salesOptionCount > 0;
    record("B", productAuthorityPass ? "PASS" : "FAIL",
      `operationalProductOptions=${productOptions.length}; operationalProductPrompt=${JSON.stringify(dom.product.promptText)}; entryOptions.sales=${salesOptionCount}; entryOptionsLoaded=${Boolean(entryState && entryState.optionsLoaded)}; authorityLoaded=${Boolean(entryState && entryState.authorityLoaded)}; authority.products=${entryState ? entryState.products : "n/a"}; productEntrySearchExists=${Boolean(dom.productSearch && dom.productSearch.exists)}`);

    // Switch to canonical SALES path (read-only type control) and re-snapshot visible sales path.
    await app.locator("#transactionTypeSales").click();
    await app.locator("#salesEntryFields").waitFor({ state: "visible", timeout: TIMEOUT });
    const salesVisible = await app.locator("#salesEntryFields").isVisible().catch(() => false);
    const salesStateText = await app.locator("#salesPricingState").textContent().catch(() => null);
    const salesSectionAfterSwitch = await app.evaluate(() => {
      const element = document.getElementById("salesEntryFields");
      return element ? { hidden: Boolean(element.hidden), text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400) } : null;
    });

    // Read-only product selection to drive variant authority (no save, no mutation).
    const selection = await app.evaluate(() => {
      const product = document.getElementById("operationalProduct");
      if (!product) return { ok: false, reason: "operationalProduct missing" };
      const option = Array.from(product.options).find((item) => item.value !== "");
      if (!option) return { ok: false, reason: "no non-prompt operationalProduct options" };
      product.value = option.value;
      if (typeof updateOperationalVariants === "function") updateOperationalVariants();
      else product.dispatchEvent(new Event("change", { bubbles: true }));
      const variant = document.getElementById("operationalProductVariant");
      return {
        ok: true,
        productValue: option.value,
        productText: (option.textContent || "").trim(),
        variantOptions: variant
          ? Array.from(variant.options).map((item) => ({ value: item.value, text: (item.textContent || "").trim() }))
          : [],
        variantValue: variant ? String(variant.value) : null
      };
    });

    const variantOptions = selection.ok ? selection.variantOptions.filter((option) => option.value !== "") : [];
    const variantValue = selection.ok ? selection.variantValue : null;

    // C. Variant authority — options carry ProductVariantID-like values; no fabricated HOT/COLD text beyond legitimate Tipe.
    if (!selection.ok) {
      record("C", "NOT_MEASURABLE", `product selection unavailable: ${selection.reason}`);
    } else if (variantOptions.length === 0) {
      record("C", "NOT_MEASURABLE",
        `selected product ${JSON.stringify(selection.productText)} yielded 0 active variants; variant authority not measurable without variants`);
    } else {
      const badOptions = variantOptions.filter((option) => !option.value || !option.text);
      const texts = variantOptions.map((option) => option.text);
      const hotColdTexts = texts.filter((text) => /^hot$/i.test(text) || /^cold$/i.test(text));
      const valuesUnique = new Set(variantOptions.map((option) => option.value)).size === variantOptions.length;
      const pass = badOptions.length === 0 && valuesUnique;
      record("C", pass ? "PASS" : "FAIL",
        `selectedProduct=${JSON.stringify(selection.productText)}; variantOptions=${JSON.stringify(variantOptions)}; badOptions=${JSON.stringify(badOptions)}; uniqueValues=${valuesUnique}; HOT/COLD-like texts=${JSON.stringify(hotColdTexts)} accepted only when non-empty ProductVariantID values present (legitimate Tipe values from server authority.productVariants)`);
    }

    // D. Single variant — auto-set when exactly 1 active variant.
    if (!selection.ok || variantOptions.length === 0) {
      record("D", "NOT_MEASURABLE", selection.ok
        ? `selected product yielded ${variantOptions.length} variants; single-variant condition not met`
        : `product selection unavailable: ${selection.reason}`);
    } else if (variantOptions.length === 1) {
      const expected = variantOptions[0].value;
      record("D", variantValue === expected ? "PASS" : "FAIL",
        `exactly 1 active variant; expected auto-set value=${JSON.stringify(expected)}; observed variantValue=${JSON.stringify(variantValue)}; onchange=${JSON.stringify(dom.variant.onchange)}`);
    } else {
      record("D", "NOT_MEASURABLE", `selected product yielded ${variantOptions.length} variants; single-variant condition not met`);
    }

    // E. Multiple variants — no auto-arbitrary HOT/COLD default; explicit selection required.
    if (!selection.ok || variantOptions.length === 0) {
      record("E", "NOT_MEASURABLE", selection.ok
        ? `selected product yielded ${variantOptions.length} variants; multi-variant condition not met`
        : `product selection unavailable: ${selection.reason}`);
    } else if (variantOptions.length > 1) {
      const emptyDefault = variantValue === "" || variantValue === null;
      record("E", emptyDefault ? "PASS" : "FAIL",
        `variant count=${variantOptions.length}; observed variantValue=${JSON.stringify(variantValue)}; expected empty value (no auto HOT/COLD default; explicit selection required before price resolves); option texts=${JSON.stringify(variantOptions.map((option) => option.text))}`);
    } else {
      record("E", "NOT_MEASURABLE", `selected product yielded ${variantOptions.length} variants; multi-variant condition not met`);
    }

    // F. Selling price — exists + readonly; display-only canonical format after variant handling.
    const priceDrive = await app.evaluate(() => {
      const price = document.getElementById("operationalSellingPrice");
      if (!price) return { exists: false };
      const before = String(price.value);
      if (typeof updateOperationalOrderPrice === "function") updateOperationalOrderPrice();
      return {
        exists: true,
        readonly: price.hasAttribute("readonly"),
        before,
        after: String(price.value)
      };
    });
    if (!priceDrive.exists) {
      record("F", "FAIL", "#operationalSellingPrice missing in DOM");
    } else if (!priceDrive.readonly) {
      record("F", "FAIL", `#operationalSellingPrice exists but readonly attribute absent; value=${JSON.stringify(priceDrive.after)}`);
    } else if (priceDrive.after === "" && priceDrive.before === "") {
      record("F", "NOT_MEASURABLE", "price display not established (no variant authority path completed); readonly=true; probe does NOT establish client-entered price");
    } else {
      const canonicalFormat = /^Rp\s/.test(priceDrive.after) || priceDrive.after === "Server validated at save";
      record("F", canonicalFormat ? "PASS" : "FAIL",
        `readonly=true; valueAfterDisplayFunction=${JSON.stringify(priceDrive.after)}; accepted=canonical "Rp …" format or "Server validated at save"; probe does NOT establish client-entered price`);
    }

    // G. Order type — options exactly DINE_IN and TAKE_AWAY.
    const orderTypeValues = dom.orderType && dom.orderType.exists && Array.isArray(dom.orderType.options)
      ? dom.orderType.options.map((option) => option.value)
      : [];
    const orderTypePass = orderTypeValues.length === 2 &&
      orderTypeValues.includes("DINE_IN") && orderTypeValues.includes("TAKE_AWAY");
    record("G", orderTypePass ? "PASS" : "FAIL",
      `#operationalOrderType options=${JSON.stringify(dom.orderType && dom.orderType.exists ? dom.orderType.options : null)}; expected exactly [DINE_IN, TAKE_AWAY]`);

    // H. Order-stage receive via — receiveVia NOT required for order construction.
    const orderSection = dom.orderSection || {};
    const paymentSection = dom.paymentSection || {};
    const orderNoReceiveVia = orderSection.exists && orderSection.hasReceiveVia === false;
    const orderTextNoPaymentPrompt = orderSection.exists && !/receive via|metode pembayaran/i.test(orderSection.text || "");
    const paymentHasReceiveVia = paymentSection.exists && paymentSection.hasReceiveVia === true;
    record("H", orderNoReceiveVia && orderTextNoPaymentPrompt && paymentHasReceiveVia ? "PASS" : "FAIL",
      `orderSection.exists=${orderSection.exists}; orderSection.hidden=${orderSection.hidden} (expected true: #operationalOrderFields not unhidden by SALES path at HEAD); hasReceiveViaInsideOrder=${orderSection.hasReceiveVia}; orderSection.text=${JSON.stringify(orderSection.text)}; paymentSection.hasReceiveVia=${paymentSection.hasReceiveVia}; receiveVia only in payment fields`);

    // I. Payment-stage receive via — DOM presence + prompt; hidden until order save (no save performed).
    const receiveViaDom = dom.receiveVia || {};
    const receiveViaPromptOk = receiveViaDom.exists && Array.isArray(receiveViaDom.options) &&
      receiveViaDom.options.some((option) => /Pilih metode pembayaran/i.test(option.text));
    record("I", paymentSection.exists && receiveViaDom.exists && receiveViaPromptOk ? "PASS" : "FAIL",
      `paymentSection.exists=${paymentSection.exists}; paymentSection.hidden=${paymentSection.hidden}; #operationalReceiveVia.exists=${receiveViaDom.exists}; hidden=${receiveViaDom.hidden}; options=${JSON.stringify(receiveViaDom.options)}; prompt "Pilih metode pembayaran" present=${receiveViaPromptOk}; payment section unhidden only after successful order save — probe performs NO save`);

    // J. Supplier independence — supplier under purchase fields only; entry loads regardless of Suppliers data.
    const supplierDom = dom.supplier || {};
    const purchaseSection = dom.purchaseSection || {};
    const salesSection = dom.salesSection || {};
    const supplierInPurchase = supplierDom.exists && purchaseSection.exists && purchaseSection.hasSupplier === true;
    const salesNoSupplier = salesSection.exists && salesSection.hasSupplier === false && !/supplier/i.test(salesSection.text || "");
    const orderNoSupplier = orderSection.exists && orderSection.hasSupplier === false && !/supplier/i.test(orderSection.text || "");
    record("J", supplierInPurchase && salesNoSupplier && orderNoSupplier ? "PASS" : "FAIL",
      `#operationalSupplier.exists=${supplierDom.exists}; supplierInsidePurchaseFields=${supplierInPurchase}; supplierOptionCount=${supplierDom.exists && Array.isArray(supplierDom.options) ? supplierDom.options.filter((option) => option.value !== "").length : 0} (0 allowed: Suppliers ABSENT ok); salesSection.hasSupplier=${salesSection.hasSupplier}; orderSection.hasSupplier=${orderSection.hasSupplier}; entry loaded with authorityLoaded=${Boolean(entryState && entryState.authorityLoaded)}`);

    // K. Inventory independence — no stock/on-hand/inventory UI in order/sales regions.
    const inventoryIds = [...(orderSection.ids || []), ...(salesSection.ids || [])].filter((id) => /stock|inventory|ledger|onhand/i.test(id));
    const inventoryText = `${orderSection.text || ""} ${salesSection.text || ""}`;
    const inventoryTextHits = (inventoryText.match(/stock|inventory|ledger|inventory\s*receipt|inventoryreceipt|on-hand|on hand/gi) || []);
    record("K", inventoryIds.length === 0 && inventoryTextHits.length === 0 ? "PASS" : "FAIL",
      `scopedTo=#operationalOrderFields+#salesEntryFields; inventoryIdHits=${JSON.stringify(inventoryIds)}; inventoryTextHits=${JSON.stringify(inventoryTextHits)}; no InventoryReceipt/Ledger references in sales path elements`);

    // L. Customer independence — no Customer field in order/sales regions.
    const customerIds = [...(orderSection.ids || []), ...(salesSection.ids || [])].filter((id) => /customer/i.test(id));
    const customerTextHits = (inventoryText.match(/customer/gi) || []);
    record("L", customerIds.length === 0 && customerTextHits.length === 0 ? "PASS" : "FAIL",
      `scopedTo=#operationalOrderFields+#salesEntryFields; customerIdHits=${JSON.stringify(customerIds)}; customerTextHits=${JSON.stringify(customerTextHits)}; salesPathSwitch=salesEntryFields visible=${salesVisible}; salesPricingState=${JSON.stringify(salesStateText)}; salesSectionHiddenAfterSwitch=${salesSectionAfterSwitch ? salesSectionAfterSwitch.hidden : "n/a"}`);
  } catch (error) {
    if (!blocked) fillRemaining("FAIL", `harness error: ${error.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    report();
  }
})().catch((error) => {
  fillRemaining("FAIL", `harness error: ${error.message || String(error)}`);
  report();
});
