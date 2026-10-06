#!/usr/bin/env node
/**
 * Read-only Candidate v697 Transaction Entry browser acceptance probe (Phase C+D repair).
 * Usage: node tests/browser/transaction-entry-v697-probe.js <targetUrl>
 * stdout: one JSON report. Exit 0 once report is emitted; verdicts carry failures.
 *
 * NEVER clicks Save Order / Confirm Payment / Save Transaction / Save Purchase /
 * Save Expense. Never invokes mutation endpoints. Detect-only auth handling.
 *
 * CASE 1 probe repair (authoritative characterization):
 * - C/D/E measure variant/type authority through the REAL active Sales path:
 *   #productEntrySearch + entryOptions.sales + Hot/Cold (#salesTypeHot/#salesTypeCold)
 *   + server pricing via getProductEntryPricing → #salesPricingPreview/#salesPricingState.
 * - Operational variant controls (#operationalProduct/#operationalProductVariant in
 *   #operationalOrderFields) are permanently hidden at HEAD; recorded informational only.
 * - K inventory matcher narrowed: bare "on hand" dropped (Cash on Hand is a
 *   chart-of-accounts label, not inventory semantics).
 * - pollEntryState waits for BOTH entryOptionsLoaded AND authorityLoaded (AND, not OR)
 *   to avoid authority-RPC early-exit race; timeout → C/D/E NOT_MEASURABLE with reason.
 */

const { chromium } = require("playwright");

const TARGET_URL = process.argv[2];
const TIMEOUT = 60_000;
const AUTHORITY_TIMEOUT = 90_000;
const PRICING_TIMEOUT = 15_000;
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
let activeSalesPathEvidence = null;
let operationalPathInformational = null;
let browser;
let blocked = null;
let authorityObservation = {
  probeRpc: {
    rpcStartedAt: null,
    rpcSettledAt: null,
    rpcLatencyMs: null,
    rpcOutcome: "UNSETTLED_TIMEOUT",
    error: null,
    products: null,
    productVariants: null,
    suppliers: null,
    paymentMethods: null
  },
  applicationRpc: {
    authorityPresent: false,
    appliedAt: null,
    latencyMs: null
  },
  browserLegClassification: null
};

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
    activeSalesPathEvidence,
    operationalPathInformational,
    authorityObservation,
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

async function observeApplicationAuthority(app, startedAtMs, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  do {
    last = await app.evaluate(() => {
      const state = typeof operationalTransactionState !== "undefined" ? operationalTransactionState : null;
      return {
        authorityStatus: state && state.authorityStatus ? String(state.authorityStatus) : null,
        authorityReason: state && state.authorityReason ? String(state.authorityReason) : null,
        authorityPresent: Boolean(state && state.authority)
      };
    }).catch(() => null);
    const observedAtMs = Date.now();
    if (last && last.authorityStatus === "READY" && last.authorityPresent) {
      return {
        terminalState: "READY",
        authorityPresent: true,
        authorityReason: null,
        appliedAt: new Date(observedAtMs).toISOString(),
        readyMs: observedAtMs - startedAtMs,
        terminalMs: observedAtMs - startedAtMs
      };
    }
    if (last && last.authorityStatus === "UNAVAILABLE" && last.authorityReason && last.authorityReason !== "NOT_LOADED") {
      return {
        terminalState: "UNAVAILABLE",
        authorityPresent: false,
        authorityReason: last.authorityReason,
        appliedAt: null,
        readyMs: null,
        terminalMs: observedAtMs - startedAtMs
      };
    }
    await app.waitForTimeout(POLL_MS);
  } while (Date.now() < deadline);
  return {
    terminalState: "TIMEOUT",
    authorityPresent: false,
    authorityReason: last && last.authorityReason ? last.authorityReason : null,
    appliedAt: null,
    readyMs: null,
    terminalMs: Date.now() - startedAtMs
  };
}

async function invokeAuthorityProbe(app, timeoutMs) {
  return app.evaluate((timeout) => new Promise((resolve) => {
    const startedAtMs = Date.now();
    let settled = false;
    function own(object, property) {
      return Boolean(object && typeof object === "object" && Object.prototype.hasOwnProperty.call(object, property));
    }
    function safeValue(value, key) {
      if (/token|credential|secret/i.test(key || "")) return "[REDACTED]";
      if (value === undefined) return { valueType: "undefined" };
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
      if (Array.isArray(value)) return { valueType: "array", count: value.length };
      if (typeof value === "object") {
        const result = {};
        Object.keys(value).slice(0, 50).forEach((childKey) => {
          result[childKey] = safeValue(value[childKey], childKey);
        });
        return result;
      }
      return { valueType: typeof value, value: String(value).slice(0, 500) };
    }
    function finish(outcome, response, failure) {
      if (settled) return;
      settled = true;
      const settledAtMs = Date.now();
      const responseObject = response !== null && typeof response === "object" && !Array.isArray(response);
      const responseKeys = responseObject ? Object.keys(response) : [];
      const data = outcome === "SUCCESS_TRUE" && responseObject && response.data ? response.data : null;
      resolve({
        rpcStartedAt: new Date(startedAtMs).toISOString(),
        rpcSettledAt: new Date(settledAtMs).toISOString(),
        rpcLatencyMs: settledAtMs - startedAtMs,
        rpcOutcome: outcome,
        responseType: response === null ? "null" : typeof response,
        responseIsNull: response === null,
        responseIsArray: Array.isArray(response),
        responseKeys,
        successPropertyPresent: own(response, "success"),
        successValue: own(response, "success") ? safeValue(response.success, "success") : { propertyPresent: false },
        errorPropertyPresent: own(response, "error"),
        errorValue: own(response, "error") ? safeValue(response.error, "error") : { propertyPresent: false },
        status: own(response, "status") ? safeValue(response.status, "status") : { propertyPresent: false },
        code: own(response, "code") ? safeValue(response.code, "code") : { propertyPresent: false },
        message: own(response, "message") ? safeValue(response.message, "message") : { propertyPresent: false },
        sanitizedResponse: safeValue(response, "response"),
        failure: failure ? safeValue({ name: failure.name, message: failure.message || String(failure) }, "failure") : null,
        products: data && Array.isArray(data.products) ? data.products.length : null,
        productVariants: data && Array.isArray(data.productVariants) ? data.productVariants.length : null,
        suppliers: data && Array.isArray(data.suppliers) ? data.suppliers.length : null,
        paymentMethods: data && Array.isArray(data.paymentMethods) ? data.paymentMethods.length : null
      });
    }
    setTimeout(() => finish("UNSETTLED_TIMEOUT", undefined, null), timeout);
    google.script.run
      .withSuccessHandler((response) => finish(response && response.success === true ? "SUCCESS_TRUE" : "SUCCESS_FALSE", response, null))
      .withFailureHandler((error) => finish("FAILURE_HANDLER", undefined, error))
      .getOperationalTransactionAuthority();
  }), timeoutMs);
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
        loadingOptions: Boolean(entry && entry.loadingOptions),
        salesOptions: entry && entry.entryOptions && Array.isArray(entry.entryOptions.sales) ? entry.entryOptions.sales.length : 0,
        expenseOptions: entry && entry.entryOptions && Array.isArray(entry.entryOptions.expenses) ? entry.entryOptions.expenses.length : 0
      };
    }).catch(() => null);
    // AND-wait: both server authorities required before C/D/E snapshots (OR early-exit raced authority RPC).
    if (last && last.authorityLoaded && last.optionsLoaded) return last;
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
        text: String(element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
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
      salesPreviewPrice: read("salesPreviewPrice"),
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

function readSalesPricingState(app) {
  return app.evaluate(() => {
    const state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
    const price = document.getElementById("salesPreviewPrice");
    const pricingState = document.getElementById("salesPricingState");
    const hot = document.getElementById("salesTypeHot");
    const cold = document.getElementById("salesTypeCold");
    const search = document.getElementById("productEntrySearch");
    return {
      selectedType: state && state.selectedType ? String(state.selectedType) : null,
      selectedProductId: state && state.selectedProduct ? state.selectedProduct.productId : null,
      loadingPricing: Boolean(state && state.loadingPricing),
      pricing: state && state.pricing
        ? {
            productId: state.pricing.productId,
            type: state.pricing.type,
            price: state.pricing.price,
            hpp: state.pricing.hpp,
            unitMargin: state.pricing.unitMargin
          }
        : null,
      pricingSource: state && state.pricingSource ? String(state.pricingSource) : null,
      previewPriceText: price ? String(price.textContent || "").trim() : null,
      pricingStateText: pricingState ? String(pricingState.textContent || "").trim() : null,
      hotAriaChecked: hot ? hot.getAttribute("aria-checked") : null,
      coldAriaChecked: cold ? cold.getAttribute("aria-checked") : null,
      searchValue: search ? String(search.value) : null
    };
  }).catch(() => null);
}

async function waitForSalesPricing(app, timeoutMs, expectedType) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  do {
    last = await readSalesPricingState(app);
    if (last && last.selectedType === expectedType && !last.loadingPricing) {
      if (last.pricing || (last.previewPriceText && last.previewPriceText !== "—")) {
        return { settled: true, state: last };
      }
      if (last.pricingStateText && /could not|failed|error/i.test(last.pricingStateText)) {
        return { settled: true, state: last, failed: true };
      }
    }
    await app.waitForTimeout(POLL_MS);
  } while (Date.now() < deadline);
  return {
    settled: Boolean(last && last.selectedType === expectedType && !last.loadingPricing),
    state: last
  };
}

function pricingResolvedFromAuthority(state) {
  return Boolean(state && state.pricing && (state.pricingSource === "server" || state.pricingSource === "master-cache"));
}

function pricingFabricated(state) {
  return Boolean(
    state &&
    state.previewPriceText &&
    state.previewPriceText !== "—" &&
    !state.pricing &&
    state.pricingSource !== "server" &&
    state.pricingSource !== "master-cache"
  );
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
    const applicationRpcStartedAtMs = Date.now();
    await app.locator("#newTransactionButton").click();
    await app.locator("#transactionEntryDialog").waitFor({ state: "visible", timeout: TIMEOUT });
    const probeRpcPromise = invokeAuthorityProbe(app, AUTHORITY_TIMEOUT);
    const appShellReady = await inspectShell(app);
    const dialogVisible = await app.locator("#transactionEntryDialog").isVisible().catch(() => false);
    const openPageErrors = relevant(pageErrors).slice(openErrorsBefore);
    record("A", dialogVisible && appShellReady && openPageErrors.length === 0 ? "PASS" : "FAIL",
      `dialogVisible=${dialogVisible}; appShellReady=${appShellReady}; context=${shell.context}; openPageErrors=${JSON.stringify(openPageErrors)}`);
    if (await authBlocked(page)) {
      markAuthBlocked(page);
      return;
    }

    // Probe-owned RPC and application-owned authority load are independent state machines.
    const applicationTerminalPromise = observeApplicationAuthority(app, applicationRpcStartedAtMs, AUTHORITY_TIMEOUT);
    const entryStatePromise = pollEntryState(app, AUTHORITY_TIMEOUT);
    const [probeRpc, applicationRpc, entryState] = await Promise.all([
      probeRpcPromise,
      applicationTerminalPromise,
      entryStatePromise
    ]);
    authorityObservation.probeRpc = probeRpc;
    authorityObservation.applicationRpc = applicationRpc;
    authorityObservation.browserLegClassification =
      `PROBE_${probeRpc.rpcOutcome}_APPLICATION_${applicationRpc.terminalState}`;
    const dom = await snapshotDom(app);

    const authorityRpcResolved = Boolean(entryState && entryState.authorityLoaded);
    const optionsRpcResolved = Boolean(entryState && entryState.optionsLoaded);
    const bothReady = Boolean(entryState && entryState.authorityLoaded && entryState.optionsLoaded);
    const salesOptionsCount = entryState ? entryState.salesOptions : 0;
    const waitReason =
      `pollWait=BOTH(authorityLoaded,optionsLoaded); bothReady=${bothReady}; authorityRpcResolved=${authorityRpcResolved}` +
      `(authority RPC failure/timeout marked, not fabricated PASS); optionsRpcResolved=${optionsRpcResolved}` +
      `; salesOptions=${salesOptionsCount}; expenseOptions=${entryState ? entryState.expenseOptions : "n/a"}` +
      `; authority.products=${entryState ? entryState.products : "n/a"}; authority.productVariants=${entryState ? entryState.productVariants : "n/a"}`;

    // B. Product authority — operational select populated from server authority, or canonical sales options.
    // Assertion logic preserved; evidence extended with active-path + poll-wait facts.
    const productOptions = nonPromptOptions(dom.product);
    const productAuthorityPass = productOptions.length > 0 || salesOptionsCount > 0;
    record("B", productAuthorityPass ? "PASS" : "FAIL",
      `operationalProductOptions=${productOptions.length}; operationalProductPrompt=${JSON.stringify(dom.product.promptText)}; entryOptions.sales=${salesOptionsCount}; entryOptionsLoaded=${optionsRpcResolved}; authorityLoaded=${authorityRpcResolved}; bothReady=${bothReady}; authority.products=${entryState ? entryState.products : "n/a"}; productEntrySearchExists=${Boolean(dom.productSearch && dom.productSearch.exists)}; activeSalesPath=#productEntrySearch+entryOptions.sales+Hot/Cold; ${waitReason}`);

    // Switch to canonical SALES path (read-only type control) and re-snapshot visible sales path.
    await app.locator("#transactionTypeSales").click();
    await app.locator("#salesEntryFields").waitFor({ state: "visible", timeout: TIMEOUT });
    const salesVisible = await app.locator("#salesEntryFields").isVisible().catch(() => false);
    const salesStateText = await app.locator("#salesPricingState").textContent().catch(() => null);
    const salesSectionAfterSwitch = await app.evaluate(() => {
      const element = document.getElementById("salesEntryFields");
      return element ? { hidden: Boolean(element.hidden), text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400) } : null;
    });

    // Operational path — informational only (controls permanently hidden at HEAD; not used for C/D/E measurement).
    operationalPathInformational = await app.evaluate(() => {
      const section = document.getElementById("operationalOrderFields");
      const product = document.getElementById("operationalProduct");
      const variant = document.getElementById("operationalProductVariant");
      return {
        operationalOrderFieldsExists: Boolean(section),
        operationalOrderFieldsHidden: section ? Boolean(section.hidden) : null,
        operationalProductExists: Boolean(product),
        operationalProductHidden: product ? Boolean(product.hidden) : null,
        operationalProductVariantExists: Boolean(variant),
        updateOperationalVariantsAvailable: typeof updateOperationalVariants === "function",
        authorityProductVariantsCount: (typeof operationalTransactionState !== "undefined" && operationalTransactionState &&
          operationalTransactionState.authority && Array.isArray(operationalTransactionState.authority.productVariants))
          ? operationalTransactionState.authority.productVariants.length
          : null,
        note: "informational only — operational variant controls (#operationalProduct/#operationalProductVariant) hidden at HEAD; variant/type authority measured via active Sales path"
      };
    }).catch(() => ({
      operationalOrderFieldsExists: null,
      note: "operational path informational capture failed"
    }));

    activeSalesPathEvidence = {
      pollWait: "BOTH entryOptionsLoaded AND authorityLoaded (AND)",
      authorityRpcResolved,
      optionsRpcResolved,
      bothReady,
      salesEntryOptionsCount: salesOptionsCount,
      productEntrySearchExists: Boolean(dom.productSearch && dom.productSearch.exists),
      salesEntryFieldsVisible: salesVisible,
      typeButtons: {
        hotExists: Boolean(dom.salesTypeHot && dom.salesTypeHot.exists),
        coldExists: Boolean(dom.salesTypeCold && dom.salesTypeCold.exists)
      },
      productSelection: null,
      preTypePrompt: null,
      perTypeAvailabilityFromEntryOptions: null,
      pricingByType: { Hot: null, Cold: null },
      note: "Active Sales path: #productEntrySearch combobox populated from entryOptions.sales; Hot/Cold (#salesTypeHot/#salesTypeCold) act as type/variant selector; pricing resolved via getProductEntryPricing (server) or master-cache from getTransactionEntryOptions (both server-side ProductPricing authority) → #salesPricingPreview/#salesPricingState; no client-entered price input on active path"
    };

    // Gate C/D/E on AND-wait completeness. Timeout/incomplete → NOT_MEASURABLE with reason.
    if (!bothReady) {
      record("C", "NOT_MEASURABLE", `active-path snapshot gated: ${waitReason}`);
      record("D", "NOT_MEASURABLE", `active-path snapshot gated: ${waitReason}`);
      record("E", "NOT_MEASURABLE", `active-path snapshot gated: ${waitReason}`);
    } else if (salesOptionsCount === 0) {
      const emptyReason = `entryOptions.sales empty after AND-wait; ${waitReason}`;
      record("C", "NOT_MEASURABLE", emptyReason);
      record("D", "NOT_MEASURABLE", emptyReason);
      record("E", "NOT_MEASURABLE", emptyReason);
    } else {
      // Select product via #productEntrySearch combobox (fill + listbox option click; NO submit).
      const firstOption = await app.evaluate(() => {
        const state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
        const options = state && state.entryOptions && Array.isArray(state.entryOptions.sales) ? state.entryOptions.sales : [];
        const option = options.find((item) => item && item.product) || null;
        return option
          ? { product: option.product, productId: option.productId, category: option.category, kind: option.kind }
          : null;
      });

      let selection = { ok: false, reason: null };
      if (!firstOption) {
        selection.reason = "no non-empty entryOptions.sales option available for #productEntrySearch";
      } else {
        try {
          await app.locator("#productEntrySearch").fill(firstOption.product);
          await app.locator("#productEntryListbox").waitFor({ state: "visible", timeout: TIMEOUT });
          const listboxCount = await app.locator("#productEntryListbox button").count();
          if (listboxCount === 0) {
            selection.reason = `#productEntryListbox rendered 0 options for ${JSON.stringify(firstOption.product)}`;
          } else {
            await app.locator("#productEntryListbox button").first().click();
            const selected = await app.evaluate(() => {
              const state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
              const input = document.getElementById("productEntrySearch");
              const meta = document.getElementById("productEntryMeta");
              return {
                selectedProduct: state && state.selectedProduct
                  ? {
                      productId: state.selectedProduct.productId,
                      product: state.selectedProduct.product,
                      category: state.selectedProduct.category,
                      kind: state.selectedProduct.kind,
                      pricingKeys: state.selectedProduct.pricing ? Object.keys(state.selectedProduct.pricing) : []
                    }
                  : null,
                inputValue: input ? String(input.value) : null,
                productMeta: meta ? String(meta.textContent || "").trim() : null
              };
            });
            if (selected && selected.selectedProduct) {
              selection = {
                ok: true,
                productText: selected.selectedProduct.product,
                productId: selected.selectedProduct.productId,
                pricingKeys: selected.selectedProduct.pricingKeys,
                inputValue: selected.inputValue,
                productMeta: selected.productMeta
              };
            } else {
              selection.reason =
                `#productEntrySearch listbox click did not set transactionEntryState.selectedProduct; inputValue=${JSON.stringify(selected && selected.inputValue)}`;
            }
          }
        } catch (error) {
          selection.reason = `#productEntrySearch interaction failed: ${error.message}`;
        }
      }

      activeSalesPathEvidence.productSelection = selection;
      activeSalesPathEvidence.perTypeAvailabilityFromEntryOptions = selection.ok && Array.isArray(selection.pricingKeys)
        ? selection.pricingKeys
        : null;

      // Pre-type snapshot after product selection — E measures explicit type-selection requirement here.
      const postProductPreType = await readSalesPricingState(app);
      activeSalesPathEvidence.preTypePrompt = postProductPreType;

      const perTypeAvailability = activeSalesPathEvidence.perTypeAvailabilityFromEntryOptions;
      const typeAutoSelected = Boolean(postProductPreType && (postProductPreType.selectedType === "Hot" || postProductPreType.selectedType === "Cold"));
      const hotBefore = postProductPreType ? postProductPreType.hotAriaChecked : null;
      const coldBefore = postProductPreType ? postProductPreType.coldAriaChecked : null;
      const previewPriceBefore = postProductPreType ? postProductPreType.previewPriceText : null;
      const pricingStateBefore = postProductPreType ? postProductPreType.pricingStateText : null;
      const promptPresentBefore = Boolean(pricingStateBefore && pricingStateBefore.trim().length > 0);
      const previewEmptyBefore = previewPriceBefore === "—";

      // Click Hot then Cold sequentially — read-only type buttons = active-path variant selector; pricing RPC is read-only.
      const pricingByType = { Hot: null, Cold: null };
      if (selection.ok) {
        for (const type of ["Hot", "Cold"]) {
          const button = app.locator(type === "Hot" ? "#salesTypeHot" : "#salesTypeCold");
          await button.click();
          const settle = await waitForSalesPricing(app, PRICING_TIMEOUT, type);
          const state = settle.state || {};
          pricingByType[type] = {
            settled: settle.settled,
            failedRpc: Boolean(settle.failed),
            selectedByUser: state.selectedType === type,
            selectedType: state.selectedType || null,
            pricing: state.pricing || null,
            pricingSource: state.pricingSource || null,
            previewPriceText: state.previewPriceText ?? null,
            pricingStateText: state.pricingStateText ?? null,
            ariaChecked: type === "Hot" ? state.hotAriaChecked : state.coldAriaChecked,
            resolvedFromAuthority: pricingResolvedFromAuthority(state),
            fabricated: pricingFabricated(state)
          };
        }
      }
      activeSalesPathEvidence.pricingByType = pricingByType;

      const hotOutcome = pricingByType.Hot;
      const coldOutcome = pricingByType.Cold;
      const hotResolved = Boolean(hotOutcome && hotOutcome.selectedByUser && hotOutcome.resolvedFromAuthority);
      const coldResolved = Boolean(coldOutcome && coldOutcome.selectedByUser && coldOutcome.resolvedFromAuthority);
      const anyResolved = hotResolved || coldResolved;

      // C. Variant authority — active Sales path: #productEntrySearch + Hot/Cold + server pricing (NOT client-entered price).
      if (!selection.ok) {
        record("C", "NOT_MEASURABLE", `#productEntrySearch selection unavailable: ${selection.reason}; ${waitReason}`);
      } else if (!dom.productSearch.exists || !(dom.salesTypeHot && dom.salesTypeHot.exists) || !(dom.salesTypeCold && dom.salesTypeCold.exists)) {
        record("C", "FAIL",
          `active Sales path controls missing: productEntrySearchExists=${Boolean(dom.productSearch && dom.productSearch.exists)}; salesTypeHotExists=${Boolean(dom.salesTypeHot && dom.salesTypeHot.exists)}; salesTypeColdExists=${Boolean(dom.salesTypeCold && dom.salesTypeCold.exists)}; salesEntryFieldsVisible=${salesVisible}`);
      } else if (!anyResolved) {
        record("C", "NOT_MEASURABLE",
          `variant authority pricing unresolved for both types after user selection; Hot=${JSON.stringify(hotOutcome)}; Cold=${JSON.stringify(coldOutcome)}; selection=${JSON.stringify(selection)}; UI did not fabricate pricing (no client-entered price input on active path); ${waitReason}`);
      } else {
        const resolvedType = hotResolved ? "Hot" : "Cold";
        const resolvedState = hotResolved ? hotOutcome : coldOutcome;
        const authorityBacked = pricingResolvedFromAuthority(resolvedState);
        const fabricated = pricingFabricated(resolvedState);
        record("C", authorityBacked && !fabricated ? "PASS" : "FAIL",
          `active Sales path authority: product=${JSON.stringify(selection.productText)} (productId=${JSON.stringify(selection.productId)}) selected via #productEntrySearch combobox (entryOptions.sales=${salesOptionsCount}); type buttons #salesTypeHot/#salesTypeCold present; pricing resolved for ${resolvedType}: pricingSource=${JSON.stringify(resolvedState.pricingSource)} (server=getProductEntryPricing RPC; master-cache=ProductPricing via getTransactionEntryOptions — both server-side authority); previewPrice=${JSON.stringify(resolvedState.previewPriceText)}; pricing=${JSON.stringify(resolvedState.pricing)}; resolvedFromServerAuthority=${authorityBacked}; fabricated=${fabricated}; perTypeAvailabilityFromEntryOptions=${JSON.stringify(perTypeAvailability)}; no client-entered price input on active path`);
      }

      // D. Single-variant — re-scoped to active-path semantics: Hot/Cold type buttons act as variant selector.
      if (!selection.ok) {
        record("D", "NOT_MEASURABLE", `product selection unavailable: ${selection.reason}`);
      } else if (anyResolved) {
        const singleType = Array.isArray(perTypeAvailability) && perTypeAvailability.length === 1 ? perTypeAvailability[0] : null;
        const singleTypeOutcome = singleType ? pricingByType[singleType] : null;
        const singleTypeResolved = singleType ? Boolean(singleTypeOutcome && singleTypeOutcome.selectedByUser && singleTypeOutcome.resolvedFromAuthority) : null;
        const singleTypePass = singleType ? singleTypeResolved : true;
        const unavailableType = singleType === "Hot" ? "Cold" : singleType === "Cold" ? "Hot" : null;
        const unavailableOutcome = unavailableType ? pricingByType[unavailableType] : null;
        const unavailableDidNotFabricate = unavailableOutcome
          ? (!unavailableOutcome.resolvedFromAuthority && !unavailableOutcome.fabricated && (unavailableOutcome.previewPriceText === "—" || unavailableOutcome.previewPriceText === null))
          : null;
        record("D", singleTypePass ? "PASS" : "FAIL",
          `active-path variant selector = Hot/Cold type buttons; per-type pricing: Hot=${JSON.stringify(hotOutcome)}; Cold=${JSON.stringify(coldOutcome)}; entryOptions per-type availability=${JSON.stringify(perTypeAvailability)}${singleType ? `; exactly one active type=${JSON.stringify(singleType)} → auto-resolution expected; resolved=${singleTypeResolved}` : ""}; type buttons behave as variant selector (aria-checked + per-selection pricing request); unavailableType=${JSON.stringify(unavailableType)}; unavailableTypeDidNotFabricate=${unavailableDidNotFabricate}`);
      } else if (Array.isArray(perTypeAvailability) && perTypeAvailability.length > 0) {
        record("D", "FAIL",
          `server exposed per-type availability ${JSON.stringify(perTypeAvailability)} but pricing did not resolve after user selection; Hot=${JSON.stringify(hotOutcome)}; Cold=${JSON.stringify(coldOutcome)}`);
      } else {
        record("D", "NOT_MEASURABLE",
          `selected product has no active type pricing in server response (entryOptions.pricing keys empty); pricing not resolvable; UI correctly left preview empty; Hot=${JSON.stringify(hotOutcome)}; Cold=${JSON.stringify(coldOutcome)}`);
      }

      // E. Multiple variants — explicit Hot/Cold selection required before pricing resolves; no arbitrary default type.
      if (!selection.ok) {
        record("E", "NOT_MEASURABLE", `product selection unavailable: ${selection.reason}`);
      } else {
        const eReasons = [];
        if (typeAutoSelected) eReasons.push(`selectedType auto-applied without user selection: ${postProductPreType.selectedType}`);
        if (hotBefore === "true" || coldBefore === "true") eReasons.push(`type button aria-checked=true before user selection (Hot=${hotBefore}, Cold=${coldBefore})`);
        if (!previewEmptyBefore) eReasons.push(`preview price not "—" before type selection: ${JSON.stringify(previewPriceBefore)}`);
        if (postProductPreType && postProductPreType.pricing && !typeAutoSelected) eReasons.push(`pricing object present before type selection: ${JSON.stringify(postProductPreType.pricing)}`);
        if (!promptPresentBefore) eReasons.push(`pricing state prompt missing before type selection: ${JSON.stringify(pricingStateBefore)}`);
        const ePass = eReasons.length === 0;
        record("E", ePass ? "PASS" : "FAIL",
          `explicit type selection required on active path: selectedType=${JSON.stringify(postProductPreType && postProductPreType.selectedType)}; Hot aria-checked=${hotBefore}; Cold aria-checked=${coldBefore}; previewPrice=${JSON.stringify(previewPriceBefore)} (no fabricated default); pricingState=${JSON.stringify(pricingStateBefore)} prompts user until type chosen; entryOptions per-type availability=${JSON.stringify(perTypeAvailability)}; violations=${JSON.stringify(eReasons)}`);
      }
    }

    // F. Selling price — exists + readonly; display-only canonical format after variant handling.
    // Assertion logic preserved; evidence extended with active-path pricing facts.
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
    const activePathHot = activeSalesPathEvidence && activeSalesPathEvidence.pricingByType ? activeSalesPathEvidence.pricingByType.Hot : null;
    const activePathCold = activeSalesPathEvidence && activeSalesPathEvidence.pricingByType ? activeSalesPathEvidence.pricingByType.Cold : null;
    const activePathNote = `activeSalesPathPricing: Hot=${JSON.stringify(activePathHot && { pricingSource: activePathHot.pricingSource, previewPriceText: activePathHot.previewPriceText, pricing: activePathHot.pricing })}; Cold=${JSON.stringify(activePathCold && { pricingSource: activePathCold.pricingSource, previewPriceText: activePathCold.previewPriceText, pricing: activePathCold.pricing })} (server authority via getProductEntryPricing/master-cache; measured under C/D on #salesPreviewPrice)`;
    if (!priceDrive.exists) {
      record("F", "FAIL", `#operationalSellingPrice missing in DOM; ${activePathNote}`);
    } else if (!priceDrive.readonly) {
      record("F", "FAIL", `#operationalSellingPrice exists but readonly attribute absent; value=${JSON.stringify(priceDrive.after)}; ${activePathNote}`);
    } else if (priceDrive.after === "" && priceDrive.before === "") {
      record("F", "NOT_MEASURABLE", `price display not established on operational path (hidden at HEAD; no operational variant authority path completed); readonly=true; probe does NOT establish client-entered price; ${activePathNote}`);
    } else {
      const canonicalFormat = /^Rp\s/.test(priceDrive.after) || priceDrive.after === "Server validated at save";
      record("F", canonicalFormat ? "PASS" : "FAIL",
        `readonly=true; valueAfterDisplayFunction=${JSON.stringify(priceDrive.after)}; accepted=canonical "Rp …" format or "Server validated at save"; probe does NOT establish client-entered price; ${activePathNote}`);
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
      `#operationalSupplier.exists=${supplierDom.exists}; supplierInsidePurchaseFields=${supplierInPurchase}; supplierOptionCount=${supplierDom.exists && Array.isArray(supplierDom.options) ? supplierDom.options.filter((option) => option.value !== "").length : 0} (0 allowed: Suppliers ABSENT ok); salesSection.hasSupplier=${salesSection.hasSupplier}; orderSection.hasSupplier=${orderSection.hasSupplier}; entry loaded with authorityLoaded=${authorityRpcResolved}; bothReady=${bothReady}`);

    // K. Inventory independence — no stock/inventory UI in order/sales regions.
    // ID scan unchanged (clean). Text matcher narrowed: inventory semantics only; bare "on hand" dropped.
    const inventoryIds = [...(orderSection.ids || []), ...(salesSection.ids || [])].filter((id) => /stock|inventory|ledger|onhand/i.test(id));
    const scopedText = `${orderSection.text || ""} ${salesSection.text || ""}`;
    const inventoryTextHits = (scopedText.match(
      /\bstock\b|\binventory\b|\bledger\b|\binventory[\s-]*(?:receipt|ledger)\b|\bstock[\s-]+(?:on[\s-]+hand|validation|balance)\b|\binventory[\s-]+on[\s-]+hand\b/gi
    ) || []);
    record("K", inventoryIds.length === 0 && inventoryTextHits.length === 0 ? "PASS" : "FAIL",
      `scopedTo=#operationalOrderFields+#salesEntryFields; inventoryIdHits=${JSON.stringify(inventoryIds)} (ID scan unchanged); inventoryTextHits=${JSON.stringify(inventoryTextHits)}; matcher=NARROWED: whole-word stock|inventory|ledger + inventory-receipt/ledger compounds + stock/inventory adjacency for on hand; bare "on hand" dropped; KNOWN_CASH_ACCOUNT_LABEL="Cash on Hand" (#salesCashAccount1000, 190.View.Index.html:3575, chart-of-accounts) excluded by design — not inventory semantics`);

    // L. Customer independence — no Customer field in order/sales regions.
    const customerIds = [...(orderSection.ids || []), ...(salesSection.ids || [])].filter((id) => /customer/i.test(id));
    const customerTextHits = (scopedText.match(/customer/gi) || []);
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
