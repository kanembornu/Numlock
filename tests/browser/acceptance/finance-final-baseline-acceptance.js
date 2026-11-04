#!/usr/bin/env node
/**
 * Read-only Finance Final Baseline browser acceptance harness.
 * Usage: node tests/browser/finance-final-baseline-acceptance.js <targetUrl>
 * stdout: one JSON report. Exit 0 once report is emitted; verdicts carry failures.
 */

const { chromium } = require("playwright");

const TARGET_URL = process.argv[2];
const TIMEOUT = 60_000;
const POLL_MS = 200;
const items = {};
const pageErrors = [];
const consoleErrors = [];
const consoleMessages = [];
const diagnostics = { transactions: null };
let activeContext = "bootstrap";
let browser;

function verdict(id, status, note) {
  items[id] = { verdict: status, evidence: String(note || "").slice(0, 1000) };
}

function validTarget(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch (error) {
    return false;
  }
}

function relevant(errors, context) {
  return errors.filter((entry) => entry.context === context && !/favicon|third-party cookie|net::err_aborted|\b404\b/i.test(entry.text));
}

function overall(ids) {
  const states = ids.map((id) => items[id] && items[id].verdict);
  if (states.includes("FAIL")) return "FAIL";
  if (states.every((state) => state === "PASS")) return "PASS";
  return "UNVERIFIED";
}

function report() {
  const transactionIds = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
  const financeIds = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"];
  console.log(JSON.stringify({
    targetUrl: TARGET_URL || null,
    timestamp: new Date().toISOString(),
    items,
    pageErrors,
    consoleErrors,
    consoleMessages,
    diagnostics,
    overallTransactions: overall(transactionIds),
    overallFinanceUi: overall(financeIds),
    readOnly: true,
    readOnlyGuarantee: "Navigation, DOM reads, and non-persistent view/query controls only; no form submission, download, file write, or direct google.script.run invocation."
  }, null, 2));
}

async function inspectShell(scope) {
  const shell = scope.locator("#appShell");
  const attached = await shell.count().catch(() => 0);
  return attached && await shell.first().isVisible().catch(() => false);
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

async function waitForQuery(scope, rootSelector, terminalSelector) {
  await scope.locator(rootSelector).waitFor({ state: "visible", timeout: TIMEOUT });
  await scope.waitForFunction(({ root, terminal }) => {
    const container = document.querySelector(root);
    const terminalNode = document.querySelector(terminal);
    return Boolean(container && !container.hidden && container.getAttribute("aria-busy") !== "true" && terminalNode &&
      !/loading|visible recent transactions/i.test(terminalNode.textContent || ""));
  }, { root: rootSelector, terminal: terminalSelector }, { timeout: TIMEOUT });
}

async function text(scope, selector) {
  return scope.locator(selector).first().textContent().then((value) => String(value || "").trim()).catch(() => null);
}

async function sampleTransactions(scope, durationMs) {
  const samples = [];
  const deadline = Date.now() + durationMs;
  do {
    samples.push(await scope.evaluate(() => {
      const section = document.querySelector("#transactions");
      const visiblePages = Array.from(document.querySelectorAll(".page:not([hidden])")).map((element) => element.id);
      const children = section ? Array.from(section.querySelectorAll("*")).filter((element) => {
        const value = (element.textContent || "").trim();
        return value && !element.hidden && getComputedStyle(element).display !== "none";
      }) : [];
      return {
        atMs: Date.now(),
        hidden: section ? section.hasAttribute("hidden") : null,
        active: section ? section.classList.contains("active") : null,
        heading: (document.querySelector("#transactionsResultHeading") || {}).textContent || null,
        range: (document.querySelector("#transactionsRangeSummary") || {}).textContent || null,
        contentBearingChildCount: children.length,
        visiblePages
      };
    }));
    if (samples[samples.length - 1].hidden === false) break;
    await scope.waitForTimeout(POLL_MS);
  } while (Date.now() < deadline);
  return samples;
}

async function waitForTransactionsTerminal(scope) {
  const startedAt = Date.now();
  const deadline = startedAt + TIMEOUT;
  let loadingObserved = false;
  let initial = null;
  let final = null;
  do {
    final = await scope.evaluate(() => {
      const heading = ((document.querySelector("#transactionsResultHeading") || {}).textContent || "").trim();
      const range = ((document.querySelector("#transactionsRangeSummary") || {}).textContent || "").trim();
      const scopeText = ((document.querySelector("#transactionsScopeText") || {}).textContent || "").trim();
      const body = ((document.querySelector("#tableBody") || {}).textContent || "").trim();
      const filter = typeof transactionsDateFilter === "object" && transactionsDateFilter ? Object.assign({}, transactionsDateFilter) : null;
      const readiness = typeof transactionsReadinessState === "string" ? transactionsReadinessState : null;
      return {
        heading, range, scopeText, body, filter, readiness,
        rowCount: document.querySelectorAll("#tableBody .transactions-table-row").length,
        requestSequence: typeof transactionsRequestSequence === "number" ? transactionsRequestSequence : null,
        pendingKey: typeof transactionsPendingKey === "string" ? transactionsPendingKey : null
      };
    });
    if (!initial) initial = final;
    loadingObserved = loadingObserved || final.readiness === "LOADING" || /loading/i.test(final.heading) || /loading/i.test(final.body);
    if (final.readiness === "ERROR" || /transactions unavailable/i.test(final.heading)) {
      return { classification: "ERROR", initial, final, loadingObserved, elapsedMs: Date.now() - startedAt };
    }
    const renderedHeading = Boolean(final.heading) && !/^(?:visible recent transactions|loading transactions…?)$/i.test(final.heading);
    const loaded = final.readiness === "LOADED_EMPTY" || final.readiness === "LOADED_NONEMPTY";
    if (renderedHeading && loaded) {
      return { classification: "TERMINAL_REACHED", initial, final, loadingObserved, elapsedMs: Date.now() - startedAt };
    }
    await scope.waitForTimeout(POLL_MS);
  } while (Date.now() < deadline);
  return { classification: "WAIT_TIMEOUT", initial, final, loadingObserved, elapsedMs: Date.now() - startedAt };
}

async function visibleErrors(scope) {
  return scope.locator('[role="alert"], .error, .error-message, #appError, [class*="banner" i]').evaluateAll((elements) => elements.filter((element) => {
    const style = getComputedStyle(element);
    return !element.hidden && style.display !== "none" && style.visibility !== "hidden";
  }).map((element) => (element.textContent || "").trim()).filter(Boolean)).catch(() => []);
}

function fillUnverified(ids, message) {
  ids.forEach((id) => { if (!items[id]) verdict(id, "UNVERIFIED", message); });
}

(async () => {
  if (!validTarget(TARGET_URL)) {
    verdict("INPUT", "FAIL", "Missing or invalid HTTP(S) target URL. Usage: node tests/browser/finance-final-baseline-acceptance.js <targetUrl>");
    report();
    return;
  }

  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: false });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.on("pageerror", (error) => pageErrors.push({ context: activeContext, text: error.message || String(error) }));
    page.on("console", (message) => {
      const entry = { context: activeContext, type: message.type(), text: message.text() };
      consoleMessages.push(entry);
      if (message.type() === "error") consoleErrors.push(entry);
    });

    activeContext = "bootstrap";
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    const shell = await waitForAppShell(page);
    const app = shell.app;

    activeContext = "transactions";
    try {
      const transactionNav = app.locator('[data-navigation-destination="transactions"]').first();
      if (await transactionNav.count() !== 1) throw new Error("Transactions navigation control missing");
      const clickTarget = await transactionNav.evaluate((element) => ({
        tag: element.tagName,
        page: element.getAttribute("data-page"),
        destination: element.getAttribute("data-navigation-destination"),
        outerHTML: element.outerHTML.slice(0, 500)
      }));
      const consoleStart = consoleMessages.length;
      await transactionNav.click();
       const hiddenSamples = await sampleTransactions(app, TIMEOUT);
       const lastSample = hiddenSamples[hiddenSamples.length - 1];
       const transactionVisible = lastSample && lastSample.hidden === false;
       const terminal = transactionVisible ? await waitForTransactionsTerminal(app) : { classification: "WAIT_TIMEOUT", initial: null, final: null, loadingObserved: false, elapsedMs: 0 };
       const errorSurfaces = await visibleErrors(app);
       diagnostics.transactions = {
         clickTarget,
         hiddenSamples,
         terminal,
         heading: await text(app, "#transactionsResultHeading"),
         rangeSummary: await text(app, "#transactionsRangeSummary"),
        visibleErrorSurfaces: errorSurfaces,
        consoleDuringNav: consoleMessages.slice(consoleStart),
        finalVisiblePages: lastSample ? lastSample.visiblePages : [],
        anyContentBearingChild: Boolean(lastSample && lastSample.contentBearingChildCount)
      };
      verdict("T1", transactionVisible ? "PASS" : "FAIL", `click=${JSON.stringify(clickTarget)}; hidden samples=${hiddenSamples.length}; final=${JSON.stringify(lastSample)}; errors=${JSON.stringify(errorSurfaces)}`);

      const transactionPageErrors = relevant(pageErrors, "transactions");
      verdict("T2", transactionPageErrors.length ? "FAIL" : "PASS", transactionPageErrors.length ? JSON.stringify(transactionPageErrors) : "No relevant Transactions page errors");
      const transactionHeading = diagnostics.transactions.heading;
      const rangeSummary = diagnostics.transactions.rangeSummary;
       const loadingResolved = transactionVisible && terminal.classification === "TERMINAL_REACHED" && Boolean(transactionHeading) && !/loading|unavailable|visible recent transactions/i.test(transactionHeading);
       verdict("T3", loadingResolved ? "PASS" : "FAIL", `terminal=${terminal.classification}; loadingObserved=${terminal.loadingObserved}; elapsedMs=${terminal.elapsedMs}; initial=${JSON.stringify(terminal.initial)}; final=${JSON.stringify(terminal.final)}; heading=${JSON.stringify(transactionHeading)}; range=${JSON.stringify(rangeSummary)}`);

      const rowCount = await app.locator("#tableBody .transactions-table-row").count();
      verdict("T4", rowCount > 0 ? "PASS" : "FAIL", `Rendered transaction rows=${rowCount}`);
      const purchaseTab = app.locator('[data-transactions-tab="purchases"]');
      let purchaseCount = 0;
      let purchaseMarkers = [];
      if (transactionVisible && await purchaseTab.count()) {
        await purchaseTab.click();
        await app.waitForTimeout(500);
        purchaseCount = await app.locator("#tableBody .transactions-table-row").count();
        purchaseMarkers = await app.locator("#tableBody .transaction-type").allInnerTexts();
      }
      verdict("T5", purchaseCount > 0 ? "PASS" : transactionVisible ? "FAIL" : "UNVERIFIED", `Purchase tab rows=${purchaseCount}; type markers=${JSON.stringify(purchaseMarkers)}`);

      const lifecycle = app.locator("#transactionsIsActive");
      const lifecycleOptions = await lifecycle.locator("option").allTextContents();
      let filterOperated = false;
      if (transactionVisible && lifecycleOptions.length > 1) {
        await lifecycle.selectOption("all");
        await app.waitForTimeout(500);
        filterOperated = await lifecycle.inputValue() === "all";
      }
      const transactionDom = await app.locator("#transactions").textContent().catch(() => "");
      const invalidPaymentEvidence = pageErrors.concat(consoleErrors).map((entry) => entry.text).concat(transactionDom || "").filter((value) => /INVALID_PAYMENT_STATUS/i.test(value));
      verdict("T6", invalidPaymentEvidence.length ? "FAIL" : "PASS", invalidPaymentEvidence.length ? JSON.stringify(invalidPaymentEvidence) : "No INVALID_PAYMENT_STATUS in errors or Transactions DOM");
      verdict("T7", filterOperated ? "PASS" : transactionVisible ? "FAIL" : "UNVERIFIED", `Status filter options=${JSON.stringify(lifecycleOptions)}; selected=${await lifecycle.inputValue().catch(() => null)}`);
      const transactionConsoleErrors = relevant(consoleErrors, "transactions");
      verdict("T8", transactionConsoleErrors.length ? "FAIL" : "PASS", transactionConsoleErrors.length ? JSON.stringify(transactionConsoleErrors) : "No relevant Transactions console errors");
    } catch (error) {
      if (!items.T1) verdict("T1", "FAIL", `Transactions harness error: ${error.message}`);
      fillUnverified(["T2", "T3", "T4", "T5", "T6", "T7", "T8"], `Transactions checks stopped: ${error.message}`);
    }

    activeContext = "finance";
    try {
    const financeNav = app.locator('[data-navigation-destination="profit-loss"]').first();
    if (!await financeNav.count()) throw new Error("Profit & Loss navigation control missing");
    await financeNav.click();
    await waitForQuery(app, "#finance", "#financePeriodLabel");
    const financeVisible = await app.locator("#finance").isVisible();
    verdict("F1", financeVisible ? "PASS" : "FAIL", `navigation destination=profit-loss; #finance visible=${financeVisible}`);

    const summaryValues = await app.locator("#financeContent .finance-kpis dd").allInnerTexts();
    const summaryPopulated = summaryValues.length >= 6 && summaryValues.every((value) => value.trim().length > 0);
    verdict("F2", summaryPopulated ? "PASS" : "FAIL", `Summary values=${JSON.stringify(summaryValues)}`);

    const financeFilter = app.locator("#financeFilter");
    const financeOptions = await financeFilter.locator("option").allTextContents();
    const selectedPeriod = await financeFilter.inputValue();
    verdict("F3", financeOptions.length > 1 && Boolean(selectedPeriod) ? "PASS" : "FAIL", `Period options=${JSON.stringify(financeOptions)}; selected=${selectedPeriod}; control enabled=${await financeFilter.isEnabled()}`);

    const nullFields = await app.evaluate(() => {
      const read = (id) => {
        const element = document.getElementById(id);
        return { id, label: element && element.parentElement && element.parentElement.querySelector("dt") ? element.parentElement.querySelector("dt").textContent.trim() : null, value: element ? element.textContent.trim() : null };
      };
      return ["financeCogs", "financeGrossProfit", "financeStatementCogs", "financeStatementGrossProfit"].map(read);
    });
    const unavailable = /not available|not established|unavailable|^—$/i;
    const grossFields = nullFields.filter((field) => /Gross Profit/i.test(field.label || "") || /GrossProfit/.test(field.id));
    const falseZeroGross = grossFields.filter((field) => /^(?:Rp\s*)?0(?:[.,]0+)?$/i.test(field.value || ""));
    const grossUnavailable = grossFields.length === 2 && grossFields.every((field) => unavailable.test(field.value || ""));
    const policyProspective = nullFields.some((field) => /Material Purchases Expensed/i.test(field.label || ""));
    const f4Pass = policyProspective ? grossUnavailable && falseZeroGross.length === 0 : falseZeroGross.length === 0;
    verdict("F4", f4Pass ? "PASS" : "FAIL", `prospectiveMarker=${policyProspective}; fields=${JSON.stringify(nullFields)}; unavailable markers accepted=Not available/Not established/Unavailable/—; falseZeroGross=${JSON.stringify(falseZeroGross)}`);

    const statementValues = await app.locator("#financeContent .finance-statement-list dd").allInnerTexts();
    const garbage = statementValues.filter((value) => !unavailable.test(value.trim()) && !/^(?:−Rp|Rp)\s*[\d.]+$/i.test(value.trim()));
    const malformedNegative = statementValues.filter((value) => /^-|^Rp\s*[-−]/.test(value.trim()));
    verdict("F5", statementValues.length >= 6 && garbage.length === 0 && malformedNegative.length === 0 ? "PASS" : "FAIL", `P&L values=${JSON.stringify(statementValues)}; summary=${JSON.stringify(summaryValues)}; expected negative convention=−Rp 9.341.454; non-numeric garbage=${JSON.stringify(garbage)}; malformed negatives=${JSON.stringify(malformedNegative)}; no accounting recomputation performed`);

    const cashNav = app.locator('[data-navigation-destination="cash-flow"]').first();
    if (await cashNav.count()) {
      await cashNav.click();
      await waitForQuery(app, "#finance", "#financePeriodLabel");
      const cashValues = await app.locator("#financeCashFlowContent dd").allInnerTexts();
      const cashVisible = await app.locator("#financeCashFlowContent").isVisible();
      verdict("F6", cashVisible && cashValues.length > 0 ? "PASS" : "FAIL", `Cash Flow visible=${cashVisible}; values=${JSON.stringify(cashValues)}`);
    } else {
      verdict("F6", "FAIL", "Cash Flow navigation destination not found");
    }

    const equityNav = app.locator('[data-navigation-destination="capital-equity"]').first();
    if (await equityNav.count() && await equityNav.isVisible()) {
      await equityNav.click();
      await waitForQuery(app, "#finance", "#financePeriodLabel");
      const equityVisible = await app.locator("#financeCapitalEquityContent").isVisible();
      const equityValues = await app.locator("#financeCapitalEquityContent dd").allInnerTexts();
      verdict("F7", equityVisible && equityValues.length > 0 ? "PASS" : "FAIL", `Capital & Equity visible=${equityVisible}; observed values=${JSON.stringify(equityValues.slice(0, 12))}`);
    } else {
      verdict("F7", "UNVERIFIED", "NOT_EXPOSED: Capital & Equity navigation control absent or hidden");
    }

    const financePageErrors = relevant(pageErrors, "finance");
    verdict("F8", financePageErrors.length ? "FAIL" : "PASS", financePageErrors.length ? JSON.stringify(financePageErrors) : "No relevant Finance page errors");
    const financeConsoleErrors = relevant(consoleErrors, "finance");
    verdict("F9", financeConsoleErrors.length ? "FAIL" : "PASS", financeConsoleErrors.length ? JSON.stringify(financeConsoleErrors) : "No relevant Finance console errors");
    } catch (error) {
      if (!items.F1) verdict("F1", "FAIL", `Finance harness error: ${error.message}`);
      fillUnverified(["F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"], `Finance checks stopped: ${error.message}`);
    }
  } catch (error) {
    verdict("BOOTSTRAP", "FAIL", error.message);
    fillUnverified(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"], `Bootstrap stopped: ${error.message}`);
    fillUnverified(["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"], `Bootstrap stopped: ${error.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    report();
  }
})().catch((error) => {
  verdict("HARNESS", "FAIL", error.message || String(error));
  report();
});
