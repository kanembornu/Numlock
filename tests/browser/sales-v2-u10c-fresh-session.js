// SALES_RECOGNITION_V2 U10C fresh-session production UI acceptance.
//
// Read-only: opens the target web-app /exec (default: CANONICAL) in a
// genuinely fresh browser
// context and verifies the ACTIVE V2 operator surface exactly as the owner
// specified. Apps Script serves the app inside an iframe beneath the standard
// unverified-app warning bar, so every assertion targets that frame. It stops
// BEFORE Save — no transaction is submitted, no Payment, no Fulfillment, no
// write of any kind.
//
// Usage: node tests/browser/sales-v2-u10c-fresh-session.js [targetUrl]
//   default target remains the CANONICAL production /exec; the optional
//   argv[2] override exists so local-only validation runs against a local
//   fixture serving the same assembled app (no production contact).
// Evidence: docs/evidence/u10c-fresh-session/{results.json,*.png}
var fs = require("fs");
var path = require("path");
var chromium = require("playwright").chromium;

var CANONICAL = "https://script.google.com/macros/s/AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q/exec";
var TARGET = process.argv[2] || CANONICAL;
var OUT = path.join("docs", "evidence", "u10c-fresh-session");
var WRITERS = ["submitOperationalOrder", "submitCanonicalTransaction",
  "submitOperationalPayment", "submitOperationalFulfillment"];

function fmtRp(value) {
  // Matches the app's authoritative formatEntryCurrency: "Rp " + id-ID
  // thousand separators (existing money formatting is the frozen authority).
  return "Rp " + String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function run() {
  var results = {
    task: "U10C-SURFACE-CLOSURE-01",
    canonical: CANONICAL.replace(/\/macros\/s\/[^/]+/, "/macros/s/<canonical-deployment-id>"),
    target: TARGET.replace(/\/macros\/s\/[^/]+/, "/macros/s/<canonical-deployment-id>"),
    startedAt: new Date().toISOString(), steps: [], checks: [], errors: [],
    requests: [], total: 0, passed: 0, failed: 0, reachedSave: false
  };
  function step(name) { results.steps.push({ at: new Date().toISOString(), name: name }); }
  function ok(id, value, detail) {
    results.total++;
    results.checks.push({ id: id, value: Boolean(value), detail: detail === undefined ? null : detail });
    if (value) results.passed++; else results.failed++;
    return Boolean(value);
  }

  return (async function() {
    var browser;
    try {
      step("launch fresh context");
      browser = await chromium.launch({ channel: "chrome", headless: true });
      // Fresh context: no cookies, no localStorage, no service workers.
      // UA pinned to a normal desktop Chrome string.
      var context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        locale: "id-ID", timezoneId: "Asia/Jakarta"
      });
      var page = await context.newPage();
      page.on("pageerror", function(error) { results.errors.push("pageerror: " + String(error).slice(0, 300)); });
      // Every server interaction is recorded so the evidence can show that no
      // Save/Payment/Fulfillment writer was ever dispatched.
      page.on("request", function(request) {
        var url = String(request.url());
        if (url.indexOf("script.google") === -1) return;
        var postData = request.postData() || "";
        results.requests.push({ method: request.method(), type: request.resourceType(),
          url: url.replace(/\/macros\/s\/[^/]+/, "/macros/s/<canonical-deployment-id>"),
          postData: postData.slice(0, 800) });
      });

      step("goto target");
      await page.goto(TARGET, { waitUntil: "load", timeout: 120000 });
      results.loadedUrl = String(page.url()).replace(/\/macros\/s\/[^/]+/, "/macros/s/<canonical-deployment-id>");

      // Apps Script nests the app below the unverified-app warning bar:
      // main document -> bootstrap iframe -> userHtmlFrame (the app itself).
      var app = null;
      var frameDeadline = Date.now() + 90000;
      while (Date.now() < frameDeadline && !app) {
        var frames = page.frames();
        for (var fi = 0; fi < frames.length; fi++) {
          var found = await frames[fi].evaluate(function() {
            return Boolean(document.getElementById("appShell"));
          }).catch(function() { return false; });
          if (found) { app = frames[fi]; break; }
        }
        if (!app) await page.waitForTimeout(500);
      }
      if (!app) throw new Error("U10C_APP_FRAME_NOT_FOUND");
      await app.locator("#appShell").waitFor({ state: "visible", timeout: 60000 });
      ok("F1", true, "app shell rendered in fresh session");

      async function visible(selector) {
        return app.locator(selector).isVisible().catch(function() { return false; });
      }
      async function hidden(selector) { return !(await visible(selector)); }
      async function waitForCheck(predicate, timeout) {
        var started = Date.now();
        while (Date.now() - started < (timeout || 60000)) {
          var value = await predicate().catch(function() { return false; });
          if (value) return true;
          await page.waitForTimeout(400);
        }
        return false;
      }
      async function texts() {
        return app.locator("body").innerText().catch(function() { return ""; });
      }

      step("open Transactions page");
      await app.locator('button[data-page="transactions"]').click();
      await app.locator("#transactions").waitFor({ state: "visible", timeout: 30000 });
      await app.locator("#newTransactionButton").waitFor({ state: "visible", timeout: 30000 });
      ok("F1b", true, "Transactions page visible");

      step("open New Transaction");
      await app.locator("#newTransactionButton").click();
      await app.locator("#transactionEntryOverlay").waitFor({ state: "visible", timeout: 30000 });
      ok("F2", true, "New Transaction opened");

      step("select Sales");
      await app.locator("#transactionTypeSales").click();
      await app.locator("#salesEntryFields").waitFor({ state: "visible", timeout: 30000 });
      ok("F3", true, "Sales selected");

      // The ACTIVE surface is only reachable if the server resolved config
      // ACTIVE and shipped that mode on the authority bootstrap. Read the
      // client mode state directly: "Save Order hidden" alone is also true for
      // PAUSED/unknown fail-closed surfaces.
      step("wait for server-derived ACTIVE mode");
      await waitForCheck(function() {
        return app.evaluate(function() {
          return typeof salesV2ClientModeState_ !== "undefined" && salesV2ClientModeState_.status === "READY";
        });
      }, 60000);
      var modeState = await app.evaluate(function() {
        return typeof salesV2ClientModeState_ !== "undefined" ? salesV2ClientModeState_ : null;
      });
      var authorityMode = await app.evaluate(function() {
        return operationalTransactionState.authority ?
          { status: operationalTransactionState.authorityStatus, mode: operationalTransactionState.authority.salesV2Mode } : null;
      });
      results.clientMode = modeState;
      results.authorityMode = authorityMode;
      ok("F4", Boolean(modeState && modeState.status === "READY" && modeState.mode === "ACTIVE"),
        JSON.stringify(modeState));
      ok("F4b", Boolean(authorityMode && authorityMode.mode === "ACTIVE"),
        JSON.stringify(authorityMode));
      var activeSurface = await waitForCheck(function() {
        return app.locator("#operationalSaveOrder").evaluate(function(el) { return el.hidden === true; });
      }, 30000);
      ok("F4c", activeSurface, "legacy Save Order hidden on ACTIVE surface");

      step("surface assertions");
      ok("A1-a", await visible("#salesEntryFields"), "Sales details visible");
      // U8B: Order Type moved out of the legacy order block into Sales Details
      // (Product | Order Type row); assert the contract control itself.
      ok("A1-b", await visible("#operationalOrderType"), "Order Type control visible inside Sales Details");
      ok("A1-c", await hidden("#operationalOrderHeading"), "Order review heading hidden");
      ok("A1-d", await hidden("#operationalSaveOrder"), "Save Order hidden");
      ok("A1-e", await hidden("#operationalOrderLookupControl"), "Continue existing order / Find Order hidden");
      ok("A1-f", await hidden("#operationalOpenOrders"), "No open orders block hidden");
      ok("A11-a", await hidden("#operationalPaymentFields"), "Payment / Receive Via hidden");
      ok("A11-b", await hidden("#operationalFulfillmentFields"), "Fulfillment / Complete hidden");

      var bodyText = await texts();
      var forbidden = ["Order review", "Save Order", "Continue existing order", "Find Order",
        "No open orders", "Receive Via", "Unpaid", "Start Preparing", "Mark Ready"];
      var presentForbidden = forbidden.filter(function(text) { return bodyText.indexOf(text) !== -1; });
      ok("A10-a", presentForbidden.length === 0, presentForbidden.join(", "));

      var orderTypeOptions = await app.locator("#operationalOrderType option").evaluateAll(function(nodes) {
        return nodes.map(function(node) { return node.value; });
      });
      ok("A2-a", orderTypeOptions.indexOf("DINE_IN") !== -1 && orderTypeOptions.indexOf("TAKE_AWAY") !== -1,
        orderTypeOptions.join(","));
      // Operator order-level choice set BEFORE any line; the Add-Line reset
      // must never touch it (U8B frozen contract).
      await app.locator("#operationalOrderType").selectOption("TAKE_AWAY");

      var saveLabels = await app.locator("button").evaluateAll(function(nodes) {
        return nodes.filter(function(node) {
          return node.offsetParent !== null && /^(Save Transaction|Save Order|Save Purchase|Save Expense)$/
            .test((node.innerText || "").trim());
        }).map(function(node) { return (node.innerText || "").trim(); });
      });
      ok("A5-a", saveLabels.length === 1 && saveLabels[0] === "Save Transaction", saveLabels.join(","));

      ok("A4-a", await app.locator("#submitTransactionEntryButton").isDisabled(), "Save disabled before a committed line");

      step("choose product / serving type / qty");
      var optionsReady = await waitForCheck(function() {
        return app.locator("#transactionEntryOptionsState").innerText().then(function(text) {
          return text.indexOf("Entry options ready") !== -1;
        });
      }, 60000);
      ok("F6", optionsReady, "entry options loaded");
      // The product combobox opens on input, not on click.
      await app.locator("#productEntrySearch").evaluate(function(el) {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await app.locator("#productEntryListbox button").first().waitFor({ state: "visible", timeout: 30000 });
      results.product = await app.locator("#productEntryListbox button").first().innerText();
      await app.locator("#productEntryListbox button").first().click();
      await app.locator("#salesTypeHot").click();
      // Pricing is server-resolved; Add Line requires it before the draft line
      // can carry an authoritative product/variant/qty state. U8B retired the
      // rendered #salesPreviewPrice dd (Price Preview now shows committed
      // lines only), so readiness is measured on the pricing state itself:
      // a resolved pricing object from server/master-cache authority.
      var priceReady = await waitForCheck(function() {
        return app.evaluate(function() {
          var state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
          return Boolean(state && state.pricing && !state.loadingPricing &&
            (state.pricingSource === "server" || state.pricingSource === "master-cache"));
        });
      }, 60000);
      ok("F7", priceReady, "server pricing preview resolved");
      await app.locator("#salesEntryQty").fill("1");
      await app.locator("#salesEntryQty").dispatchEvent("input");
      ok("A2-b", priceReady, "product + serving type + qty entered");
      var preAddPricing = await app.evaluate(function() {
        var state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
        return state && state.pricing
          ? { price: Number(state.pricing.price), hpp: Number(state.pricing.hpp), margin: Number(state.pricing.unitMargin), type: String(state.selectedType) }
          : null;
      });

      step("Add Line");
      await app.locator("#operationalAddLine").click();
      var lineAdded = await waitForCheck(function() {
        return app.locator("#operationalOrderLines").evaluate(function(el) { return el.children.length >= 1; });
      }, 20000);
      // U8B: the draft lives in the Order Preview column (#salesOrderPreview),
      // no longer inside the legacy #operationalOrderFields block.
      var draft = lineAdded ? await app.locator("#salesOrderPreview").evaluate(function(root) {
        var lines = root.querySelector("#operationalOrderLines");
        return { count: lines.children.length, text: lines.innerText,
          total: root.querySelector("#operationalOrderTotal").innerText };
      }) : { count: -1, text: "", total: "" };
      ok("A3", draft.count === 1, JSON.stringify(draft));
      ok("A5-b", draft.count === 1 && /Rp/.test(draft.total), draft.total);

      ok("A4-b", !(await app.locator("#submitTransactionEntryButton").isDisabled()), "Save enabled after a valid line");
      var saveAfterLine = await app.locator("button").evaluateAll(function(nodes) {
        return nodes.filter(function(node) {
          return node.offsetParent !== null && /^(Save Transaction|Save Order)$/.test((node.innerText || "").trim());
        }).map(function(node) { return (node.innerText || "").trim(); });
      });
      ok("A5-c", saveAfterLine.length === 1 && saveAfterLine[0] === "Save Transaction", saveAfterLine.join(","));

      // ---- U8B exact single-order + reset + multi-order + price preview ----
      var singleRow = await app.locator("#operationalOrderLines > div").first().evaluate(function(row) {
        var label = row.querySelector(".transaction-order-line-label");
        var amount = row.querySelector(".transaction-order-line-total");
        return { label: label ? String(label.textContent) : null, amount: amount ? String(amount.textContent) : null };
      });
      var hotUnit = preAddPricing ? preAddPricing.price : NaN;
      var expectedSingleLabel = "Hot × 1 @ " + fmtRp(hotUnit);
      var expectedSingleAmount = fmtRp(hotUnit);
      var singleDigits = Number(((singleRow.amount || "").match(/\d+/g) || []).join(""));
      ok("A3-b", singleRow.label === expectedSingleLabel && singleRow.amount === expectedSingleAmount &&
        singleDigits === hotUnit && draft.total === "Total: " + fmtRp(hotUnit),
        JSON.stringify({ singleRow: singleRow, expectedLabel: expectedSingleLabel,
          expectedAmount: expectedSingleAmount, total: draft.total, price: hotUnit }));

      // U8B Add-Line reset: Product clears, Serving Type none, Quantity=1,
      // Order Type preserved; Price Preview repr stays backed by committed
      // lines only (reset-then-expect-empty: committed rows ALLOWED).
      var resetState = await app.evaluate(function() {
        var state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
        var search = document.getElementById("productEntrySearch");
        var qty = document.getElementById("salesEntryQty");
        var hot = document.getElementById("salesTypeHot");
        var cold = document.getElementById("salesTypeCold");
        var repr = document.getElementById("salesPricingLines");
        return {
          selectedProduct: state ? state.selectedProduct : "n/a",
          selectedType: state ? state.selectedType : "n/a",
          qty: state ? state.qty : "n/a",
          searchValue: search ? search.value : null,
          qtyValue: qty ? qty.value : null,
          hotAria: hot ? hot.getAttribute("aria-checked") : null,
          coldAria: cold ? cold.getAttribute("aria-checked") : null,
          orderType: (document.getElementById("operationalOrderType") || {}).value,
          reprChildren: repr ? repr.children.length : null,
          committedLines: state && operationalTransactionState ? operationalTransactionState.lines.length : null
        };
      });
      ok("A2-c", resetState.selectedProduct === null && resetState.selectedType === null &&
        resetState.qty === 1 && resetState.searchValue === "" && resetState.qtyValue === "1" &&
        resetState.hotAria === "false" && resetState.coldAria === "false" &&
        resetState.reprChildren === resetState.committedLines,
        JSON.stringify(resetState));
      ok("A2-d", resetState.orderType === "TAKE_AWAY", "Order Type preserved through Add Line: " + resetState.orderType);

      step("second line (multi-order)");
      await app.locator("#productEntrySearch").evaluate(function(el) {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await app.locator("#productEntryListbox button").first().waitFor({ state: "visible", timeout: 30000 });
      await app.locator("#productEntryListbox button").first().click();
      await app.locator("#salesTypeCold").click();
      var coldReady = await waitForCheck(function() {
        return app.evaluate(function() {
          var state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
          return Boolean(state && state.selectedType === "Cold" && state.pricing && !state.loadingPricing);
        });
      }, 30000);
      var coldPricing = coldReady ? await app.evaluate(function() {
        var state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
        return state && state.pricing
          ? { price: Number(state.pricing.price), hpp: Number(state.pricing.hpp), margin: Number(state.pricing.unitMargin) }
          : null;
      }) : null;
      await app.locator("#salesEntryQty").fill("2");
      await app.locator("#salesEntryQty").dispatchEvent("input");
      await app.locator("#operationalAddLine").click();
      var multiAdded = await waitForCheck(function() {
        return app.locator("#operationalOrderLines").evaluate(function(el) { return el.children.length >= 2; });
      }, 20000);
      var multi = multiAdded ? await app.locator("#salesOrderPreview").evaluate(function(root) {
        var lines = root.querySelector("#operationalOrderLines");
        var rows = Array.prototype.map.call(lines.children, function(row) {
          var label = row.querySelector(".transaction-order-line-label");
          var amount = row.querySelector(".transaction-order-line-total");
          return { label: label ? String(label.textContent) : null, amount: amount ? String(amount.textContent) : null };
        });
        return { count: lines.children.length, rows: rows,
          total: root.querySelector("#operationalOrderTotal").innerText };
      }) : { count: -1, rows: [], total: "" };
      var coldUnit = coldPricing ? coldPricing.price : NaN;
      var expectedMultiLabel = "Cold × 2 @ " + fmtRp(coldUnit);
      var expectedMultiAmount = fmtRp(coldUnit * 2);
      var expectedOverall = "Total: " + fmtRp(hotUnit + coldUnit * 2);
      var noCounter = multi.rows.every(function(row) { return row.label && !/^[\d#]/.test(row.label); });
      ok("A6", multiAdded && multi.count === 2 && multi.rows[1] &&
        multi.rows[1].label === expectedMultiLabel && multi.rows[1].amount === expectedMultiAmount &&
        multi.total === expectedOverall && noCounter,
        JSON.stringify({ multi: multi, expectedLabel: expectedMultiLabel,
          expectedAmount: expectedMultiAmount, expectedOverall: expectedOverall, noCounter: noCounter }));

      var pricePreview = await app.locator("#salesPricingPreview").evaluate(function(section) {
        var groups = section.querySelectorAll(".transaction-price-line");
        var rows = Array.prototype.map.call(groups, function(group) {
          var hpp = group.querySelector(".transaction-price-line-hpp");
          var margin = group.querySelector(".transaction-price-line-margin");
          return { hpp: hpp ? String(hpp.textContent) : null, margin: margin ? String(margin.textContent) : null };
        });
        var totals = section.querySelector("#salesPricingTotals");
        var state = typeof transactionEntryState !== "undefined" ? transactionEntryState : null;
        var lines = (typeof operationalTransactionState !== "undefined" && operationalTransactionState &&
          Array.isArray(operationalTransactionState.lines)) ? operationalTransactionState.lines : [];
        return {
          groupCount: groups.length, rows: rows,
          totalsText: totals ? String(totals.textContent).replace(/\s+/g, " ").trim() : null,
          sectionText: String(section.textContent || ""),
          stateLines: lines.map(function(line) { return { qty: Number(line.qty), hpp: Number(line.hpp), margin: Number(line.margin) }; }),
          pricing: state && state.pricing ? { price: Number(state.pricing.price), hpp: Number(state.pricing.hpp), margin: Number(state.pricing.unitMargin) } : null
        };
      });
      // After the second Add Line the selection reset cleared state.pricing;
      // the committed lines carry their own HPP/Margin authority. Expected
      // totals come from the pre-Add captures (hotPricing/coldPricing).
      var expectedHppTotal = (preAddPricing ? preAddPricing.hpp : NaN) * 1 + (coldPricing ? coldPricing.hpp : NaN) * 2;
      var expectedMarginTotal = (preAddPricing ? preAddPricing.margin : NaN) * 1 + (coldPricing ? coldPricing.margin : NaN) * 2;
      var noRevenue = pricePreview.sectionText.indexOf("Revenue") === -1;
      var noPercent = pricePreview.sectionText.indexOf("%") === -1;
      var totalsOk = pricePreview.totalsText !== null &&
        pricePreview.totalsText.indexOf("Total HPP: " + fmtRp(expectedHppTotal)) !== -1 &&
        pricePreview.totalsText.indexOf("Total Margin: " + fmtRp(expectedMarginTotal)) !== -1;
      var perLineOk = pricePreview.rows.length === 2 &&
        pricePreview.rows[0].hpp === "HPP × 1 @ " + fmtRp(preAddPricing ? preAddPricing.hpp : NaN) + " = " + fmtRp((preAddPricing ? preAddPricing.hpp : NaN) * 1) &&
        pricePreview.rows[0].margin === "Margin × 1 @ " + fmtRp(preAddPricing ? preAddPricing.margin : NaN) + " = " + fmtRp((preAddPricing ? preAddPricing.margin : NaN) * 1) &&
        pricePreview.rows[1].hpp === "HPP × 2 @ " + fmtRp(coldPricing ? coldPricing.hpp : NaN) + " = " + fmtRp((coldPricing ? coldPricing.hpp : NaN) * 2) &&
        pricePreview.rows[1].margin === "Margin × 2 @ " + fmtRp(coldPricing ? coldPricing.margin : NaN) + " = " + fmtRp((coldPricing ? coldPricing.margin : NaN) * 2);
      ok("A7", pricePreview.groupCount === 2 && perLineOk && totalsOk && noRevenue && noPercent,
        JSON.stringify({ groupCount: pricePreview.groupCount, rows: pricePreview.rows,
          totalsText: pricePreview.totalsText, expectedHppTotal: fmtRp(expectedHppTotal),
          expectedMarginTotal: fmtRp(expectedMarginTotal), noRevenue: noRevenue, noPercent: noPercent }));
      // ---- end U8B exact/reset/multi/price-preview block ----

      step("screenshot BEFORE Save — no submission");
      if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
      results.screenshot = path.join(OUT, "active-surface-before-save.png");
      await page.screenshot({ path: results.screenshot });
      results.reachedSave = true;
      results.stopReason = "STOPPED_BEFORE_SAVE_BY_CONTRACT";

      var postBodies = results.requests.filter(function(r) { return r.method === "POST"; })
        .map(function(r) { return r.postData; }).join("\n");
      var dispatched = WRITERS.filter(function(name) { return postBodies.indexOf(name) !== -1; });
      ok("F5-no-write", dispatched.length === 0, dispatched.join(","));
      results.postRequestCount = results.requests.filter(function(r) { return r.method === "POST"; }).length;
      results.writerDispatch = dispatched;
    } catch (error) {
      results.errors.push(String(error && error.stack ? error.stack : error).slice(0, 900));
      results.stopReason = "ERROR";
    } finally {
      if (browser) { try { await browser.close(); } catch (e) {} }
      results.finishedAt = new Date().toISOString();
      results.status = results.failed === 0 && results.reachedSave ? "FRESH_SESSION_UI_ACCEPTED" :
        (results.reachedSave ? "FRESH_SESSION_UI_REJECTED" : "FRESH_SESSION_UI_BLOCKED");
      if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
      console.log(JSON.stringify({ status: results.status, total: results.total,
        passed: results.passed, failed: results.failed, reachedSave: results.reachedSave,
        failedChecks: results.checks.filter(function(c) { return !c.value; }),
        steps: results.steps.map(function(s) { return s.name; }),
        errors: results.errors, writerDispatch: results.writerDispatch }, null, 1));
    }
  })();
}

module.exports = run;
if (require.main === module) { run().then(function() { process.exit(0); }); }
