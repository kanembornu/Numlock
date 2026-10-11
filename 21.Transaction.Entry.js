function requireCanonicalEntryText(value, code, message, field) {
  var normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw canonicalEntryError(code, message, field);
  return normalized;
}

function canonicalEntryMaster(rows, idField, id, missingCode, inactiveCode, field) {
  var map = buildCanonicalMasterMap(rows, idField, idField === "ID_Prod" ? "Products" : "ExpenseItems");
  var record = map[id];
  if (!record) throw canonicalEntryError(missingCode, "The selected record was not found.", field);
  if (!isCanonicalActive(record.IsActive)) {
    throw canonicalEntryError(inactiveCode, "The selected record is inactive.", field);
  }
  return record;
}

function resolveCanonicalEntryPrice(pricingRows, productId, type, timestamp) {
  var price;
  try {
    price = resolveProductPrice(buildProductPricingIndex(pricingRows), productId, type, timestamp, true);
  } catch (error) {
    var match = /found (\d+)$/.exec(error.message || "");
    var count = match ? Number(match[1]) : 0;
    throw canonicalEntryError(count > 1 ? "PRICE_AMBIGUOUS" : "PRICE_NOT_FOUND",
      count > 1 ? "Multiple effective prices were found." : "No effective price was found.", "type");
  }
  var hpp = price.HPP, sellingPrice = price.Harga;
  if (typeof hpp !== "number" || !isFinite(hpp) || hpp < 0) {
    throw canonicalEntryError("INVALID_HPP", "The effective HPP is invalid.", "productId");
  }
  if (typeof sellingPrice !== "number" || !isFinite(sellingPrice) || sellingPrice <= 0) {
    throw canonicalEntryError("INVALID_PRICE", "The effective selling price is invalid.", "productId");
  }
  return { hpp: hpp, price: sellingPrice };
}

function prepareCanonicalSalesEntry(payload, context) {
  var productId = requireCanonicalEntryText(payload && payload.productId,
    "PRODUCT_NOT_FOUND", "A product is required.", "productId");
  var type = requireCanonicalEntryText(payload && payload.type,
    "INVALID_SALES_TYPE", "Sales type must be Hot or Cold.", "type");
  if (type !== "Hot" && type !== "Cold") {
    throw canonicalEntryError("INVALID_SALES_TYPE", "Sales type must be Hot or Cold.", "type");
  }
  var qty = payload && payload.qty;
  if (typeof qty !== "number" || !isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
    throw canonicalEntryError("INVALID_QTY", "Quantity must be a positive whole number.", "qty");
  }
  var product = canonicalEntryMaster(context.products, "ID_Prod", productId,
    "PRODUCT_NOT_FOUND", "PRODUCT_INACTIVE", "productId");
  ["Produk", "Kategori", "Kind"].forEach(function(field) {
    if (!String(product[field] || "").trim()) {
      throw canonicalEntryError("INVALID_PRODUCT", "The selected product master is incomplete.", "productId");
    }
  });
  var resolved = resolveCanonicalEntryPrice(context.pricing, productId, type, context.timestamp);
  var cogs = qty * resolved.hpp, revenue = qty * resolved.price;
  return { timestamp: context.timestamp, productId: productId, product: String(product.Produk).trim(),
    category: String(product.Kategori).trim(), kind: String(product.Kind).trim(), type: type, qty: qty,
    unitHPP: resolved.hpp, unitPrice: resolved.price, cogs: cogs, revenue: revenue, margin: revenue - cogs };
}

function prepareCanonicalExpenseEntry(payload, context) {
  var expenseItemId = requireCanonicalEntryText(payload && payload.expenseItemId,
    "EXPENSE_ITEM_NOT_FOUND", "An expense item is required.", "expenseItemId");
  var amount = payload && payload.amount;
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    throw canonicalEntryError("INVALID_AMOUNT", "Amount must be a positive number.", "amount");
  }
  var item = canonicalEntryMaster(context.expenseItems, "ID_Ops", expenseItemId,
    "EXPENSE_ITEM_NOT_FOUND", "EXPENSE_ITEM_INACTIVE", "expenseItemId");
  ["Item", "Kategori", "Kind", "Group", "AccountCode"].forEach(function(field) {
    if (!String(item[field] || "").trim()) {
      throw canonicalEntryError(field === "AccountCode" ? "ACCOUNT_NOT_FOUND" : "INVALID_EXPENSE_ITEM",
        "The selected expense item master is incomplete.", "expenseItemId");
    }
  });
  var accounts = buildCanonicalMasterMap(context.accounts, "AccountCode", "Accounts");
  var account = accounts[String(item.AccountCode).trim()];
  if (!account) throw canonicalEntryError("ACCOUNT_NOT_FOUND", "The expense account was not found.", "expenseItemId");
  if (!isCanonicalActive(account.IsActive)) {
    throw canonicalEntryError("ACCOUNT_INACTIVE", "The expense account is inactive.", "expenseItemId");
  }
  return { timestamp: context.timestamp, expenseItemId: expenseItemId, item: String(item.Item).trim(),
    category: String(item.Kategori).trim(), kind: String(item.Kind).trim(), group: String(item.Group).trim(), amount: amount };
}

function persistCanonicalEntry(ss, specification, services) {
  var runtime = services || { flush: function() { SpreadsheetApp.flush(); }, uuid: function() { return Utilities.getUuid(); } };
  var sheet = ss.getSheetByName(specification.sheetName);
  var logs = ss.getSheetByName("Logs");
  requireCanonicalHeaders(sheet, specification.headers);
  requireCanonicalHeaders(logs, CANONICAL_ENTRY.LOG_HEADERS);
  var rowNumber = sheet.getLastRow() + 1;
  var logRowNumber = null;
  try {
    sheet.getRange(rowNumber, 1, 1, specification.values.length).setValues([specification.values]);
    runtime.flush();
    if (!canonicalEntryRowMatches(sheet.getRange(rowNumber, 1, 1, specification.values.length).getValues()[0], specification.values)) {
      throw canonicalEntryError("WRITE_FAILED", "The canonical transaction could not be verified.", null);
    }
    logRowNumber = logs.getLastRow() + 1;
    var logValues = ["LOG-ENTRY-" + runtime.uuid(), specification.timestamp, "INFO", "TransactionEntry",
      specification.action, specification.id, CANONICAL_ENTRY.USER, "Canonical transaction created.",
      JSON.stringify({ source: CANONICAL_ENTRY.SOURCE, ledger: specification.sheetName })];
    logs.getRange(logRowNumber, 1, 1, logValues.length).setValues([logValues]);
    runtime.flush();
    if (!canonicalEntryRowMatches(logs.getRange(logRowNumber, 1, 1, logValues.length).getValues()[0], logValues)) {
      throw canonicalEntryError("WRITE_FAILED", "The transaction audit record could not be verified.", null);
    }
  } catch (error) {
    if (logRowNumber !== null && String(logs.getRange(logRowNumber, 1).getValue()) === String(logValues[0])) {
      logs.deleteRow(logRowNumber);
    }
    if (String(sheet.getRange(rowNumber, 1).getValue()) === String(specification.id)) sheet.deleteRow(rowNumber);
    throw error;
  }
}

function canonicalEntryContext(ss, timestamp, transactionType) {
  var context = { timestamp: timestamp };
  if (transactionType === "SALES") {
    context.products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]);
    context.pricing = readCanonicalTable(ss, "ProductPricing", ["ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga", "IsActive"]);
  } else {
    context.expenseItems = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]);
    context.accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "IsActive"]);
  }
  return context;
}

function buildTransactionEntryOptions(products, expenseItems, pricingRows, referenceDate, registry) {
  var coverage = registry ? validateInventoryExpenseRouting_(expenseItems, registry).routes : validateExpensePurchasePolicy_(expenseItems);
  var pricingIndex = buildProductPricingIndex(pricingRows || []);
  var sales = products.filter(function(row) { return isCanonicalActive(row.IsActive); })
    .map(function(row) {
      var productId = String(row.ID_Prod);
      var pricing = {};
      ["Hot", "Cold"].forEach(function(type) {
        if (!pricingIndex[productId.trim() + "|" + type]) return;
        var price = resolveProductPrice(pricingIndex, productId, type, referenceDate || new Date(), true);
        pricing[type] = { productId: productId, product: String(row.Produk), type: type,
          hpp: Number(price.HPP) || 0, price: Number(price.Harga) || 0,
          unitMargin: (Number(price.Harga) || 0) - (Number(price.HPP) || 0) };
      });
      return { productId: productId, product: String(row.Produk), category: String(row.Kategori), kind: String(row.Kind), pricing: pricing };
    })
    .sort(function(a, b) { return a.product.localeCompare(b.product) || a.productId.localeCompare(b.productId); });
  var expenses = expenseItems.filter(function(row) {
    return isCanonicalActive(row.IsActive) && (registry ? coverage[String(row.ID_Ops).trim()].classification === "ORDINARY_EXPENSE" : coverage[String(row.ID_Ops).trim()].prospectiveEligible);
  })
    .map(function(row) { return { expenseItemId: String(row.ID_Ops), item: String(row.Item), category: String(row.Kategori), kind: String(row.Kind), group: String(row.Group),
      costType: registry ? null : coverage[row.ID_Ops].CostType,
      purchaseRequired: registry ? false : expensePolicyIsPurchase_(coverage[row.ID_Ops]) }; })
    .sort(function(a, b) { return a.item.localeCompare(b.item) || a.expenseItemId.localeCompare(b.expenseItemId); });
  return { sales: sales, expenses: expenses };
}

function getTransactionEntryOptions() {
  try {
    var revision = typeof getDashboardCacheRevision === "function" ? getDashboardCacheRevision() : "0";
    var cache = CacheService.getScriptCache();
    var cacheKey = "transaction-entry-options-v4|" + EXPENSE_PURCHASE_POLICY.version + "|" + revision;
    var cached = cache.get(cacheKey);
    if (cached) return { success: true, data: JSON.parse(cached), cacheHit: true };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]);
    var expenses = readCanonicalTable(ss, "ExpenseItems", ["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"]);
    var pricing = readCanonicalTable(ss, "ProductPricing", ["ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga", "IsActive"]);
    var data = buildTransactionEntryOptions(products, expenses, pricing, new Date());
    data.policyVersion = EXPENSE_PURCHASE_POLICY.version;
    data.purchaseEnabled = EXPENSE_PURCHASE_POLICY.enabled;
    data.revision = revision;
    cache.put(cacheKey, JSON.stringify(data), 300);
    return { success: true, data: data, cacheHit: false };
  } catch (error) { return canonicalEntryFailure(error); }
}

function getProductEntryPricing(productId, type) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), timestamp = new Date();
    var context = canonicalEntryContext(ss, timestamp, "SALES");
    var entry = prepareCanonicalSalesEntry({ productId: productId, type: type, qty: 1 }, context);
    return { success: true, data: { productId: entry.productId, product: entry.product, type: entry.type,
      hpp: entry.unitHPP, price: entry.unitPrice, unitMargin: entry.margin } };
  } catch (error) { return canonicalEntryFailure(error); }
}

var CASH_SETTLEMENT_CUTOVER = "2026-09-30";

function attemptCashSettlement(ss, sourceType, sourceId, cashAccountCode, amount, tanggal, relatedType, relatedId, transferId, settle) {
  var settlementPrefix = { SALE_SETTLEMENT: "SAL", EXPENSE_SETTLEMENT: "EXP", AP_SETTLEMENT: "AP" }[sourceType];
  var settlementId = "CSH-" + settlementPrefix + "-" + sourceId;
  var settlement = {
    SettlementID: settlementId,
    Tanggal: tanggal,
    Direction: sourceType === "SALE_SETTLEMENT" ? "INFLOW" : "OUTFLOW",
    AccountCode: cashAccountCode,
    CounterAccountCode: "",
    Amount: amount,
    Currency: "IDR",
    SourceType: sourceType,
    SourceID: settlementId,
    RelatedTransactionType: relatedType,
    RelatedTransactionID: relatedId,
    TransferID: transferId || "",
    ExternalRef: "",
    Status: "POSTED",
    Keterangan: "",
    ReversalOf: "",
    IsActive: true,
    CreatedAt: "",
    CreatedBy: "",
    UpdatedAt: "",
    UpdatedBy: ""
  };
  try {
    var result = (settle || runCashSettleAndPersist)({ settlement: settlement });
    return { settlementId: settlementId, result: result };
  } catch (e) {
    return { settlementId: settlementId, result: { status: "FAILED", reason: String(e && e.message || e) } };
  }
}

function logSettlementPending(ss, settlementId, sourceType, sourceId, cashAccountCode, amount, tanggal, reason, uuid) {
  try {
    var logs = ss.getSheetByName("Logs");
    if (!logs) return;
    var headers = CANONICAL_ENTRY.LOG_HEADERS;
    var logId = "LOG-SETTLE-" + (uuid ? uuid() : new Date().getTime());
    var metadata = JSON.stringify({
      settlementId: settlementId,
      sourceType: sourceType,
      sourceId: sourceId,
      cashAccountCode: cashAccountCode,
      amount: amount,
      tanggal: tanggal,
      reason: reason
    });
    var logValues = [logId, new Date(), "WARN", "CashSettlement", "SETTLEMENT_PENDING", settlementId,
      CANONICAL_ENTRY.USER, "Settlement pending: " + reason, metadata];
    var row = logs.getLastRow() + 1;
    logs.getRange(row, 1, 1, headers.length).setValues([logValues]);
  } catch (e) { /* log failure is non-fatal */ }
}

// The public boundary never accepts a client-supplied runtime or activation capability.
function submitCanonicalTransaction(payload) {
  return submitCanonicalTransactionWithRuntime_(payload, {
    environment: "PRODUCTION", lock: LockService.getScriptLock(),
    spreadsheet: function() { return SpreadsheetApp.getActiveSpreadsheet(); },
    now: function() { return new Date(); }, uuid: function() { return Utilities.getUuid(); },
    flush: function() { SpreadsheetApp.flush(); }, invalidate: function() { invalidateDashboardCache(); }
  });
}

// Private shared dispatcher: synthetic adapters exercise exactly the same routing and writer.
function submitCanonicalTransactionWithRuntime_(payload, runtime) {
  var type = payload && typeof payload.transactionType === "string" ? payload.transactionType : "";
  if (["SALES", "EXPENSE", "INVENTORY_RECEIPT"].indexOf(type) === -1) {
    var refused = canonicalEntryFailure(canonicalEntryError("INVALID_TRANSACTION_TYPE",
      "Transaction type must be SALES, EXPENSE or INVENTORY_RECEIPT.", "transactionType"));
    refused.status = "REFUSED"; refused.writeCount = 0; return refused;
  }
  // U7: config-aware routing for NEW Sales (server enforced, pre-lock, zero
  // writes). PREPARED keeps this legacy writer byte-for-byte; ACTIVE routes
  // new sales to Sales Recognition V2; PAUSED/invalid fail closed. Never a
  // legacy fallback, never a silent fall-through.
  if (type === "SALES") {
    var saleRouteRefusal = salesV2OperatorLegacySalesGuard_();
    if (saleRouteRefusal) {
      saleRouteRefusal.status = "REFUSED"; saleRouteRefusal.writeCount = 0;
      return saleRouteRefusal;
    }
  }
  if (type === "INVENTORY_RECEIPT") {
    try { validateInventoryReceiptRequest_(payload); }
    catch (error) { return inventoryReceiptOrchestrationResult_("NOT_STARTED", error.message, payload && payload.requestKey, null, 0); }
  }
  var lock = runtime.lock, acquired = false, scope = null;
  try {
    lock.waitLock(30000);
    acquired = true;
    scope = { lock: lock, active: true };
    var ss = runtime.spreadsheet(), timestamp = runtime.now();
    var settle = typeof runtime.settle === "function" ? runtime.settle : runCashSettleAndPersist;
    var settlementCashAccount = payload && typeof payload.cashAccountCode === "string" ? payload.cashAccountCode.trim() : "";
    var dateKey = canonicalDateKey(timestamp);
    // T11.4 U2 — single-commit routing for NEW normal Expense (T11.2 §4/§6).
    // Resolved BEFORE the legacy cash-account validation so an ACTIVE normal
    // Expense never requests, validates, or settles a payment channel. A
    // Purchase-routed item keeps the exact legacy path (U3 owns it); ABSENT or
    // PREPARED keeps today's Expense path byte-for-byte; PAUSED/REJECT/invalid
    // fail closed with zero writes and never fall back to the legacy writer.
    var expensePreResolvedItems = null;
    if (type === "EXPENSE") {
      var expenseGate = expenseSingleCommitGate_(runtime);
      if (expenseGate.mode === "REFUSE") return expenseSingleCommitRefusal_(expenseGate);
      if (expenseGate.mode === "ACTIVE") {
        expensePreResolvedItems = readCanonicalTable(ss, "ExpenseItems",
          ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]);
        var expensePreRoute = resolveExpensePurchasePolicy_(payload && payload.expenseItemId,
          expensePreResolvedItems);
        if (!expensePolicyIsPurchase_(expensePreRoute)) {
          return expenseSingleCommitDispatch_(payload, ss, runtime, expensePreResolvedItems, expenseGate);
        }
      }
    }
    // CashAccountCode validation — required for all non-INVENTORY_RECEIPT submissions
    var cashAccountCode = settlementCashAccount;
    if (type !== "INVENTORY_RECEIPT") {
      if (!cashAccountCode || ["1000", "1010", "1020"].indexOf(cashAccountCode) === -1) {
        var refused = canonicalEntryFailure(canonicalEntryError("INVALID_CASH_ACCOUNT",
          "A valid cash account (1000, 1010, or 1020) is required.", "cashAccountCode"));
        refused.status = "REFUSED"; refused.writeCount = 0; return refused;
      }
      try {
        var accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "IsActive"]);
        var accountMap = {};
        accounts.forEach(function(a) { accountMap[String(a.AccountCode || "").trim()] = a; });
        var acct = accountMap[cashAccountCode];
        if (!acct || !isCanonicalActive(acct.IsActive)) {
          var refusedAcct = canonicalEntryFailure(canonicalEntryError("INACTIVE_CASH_ACCOUNT",
            "The selected cash account is not active.", "cashAccountCode"));
          refusedAcct.status = "REFUSED"; refusedAcct.writeCount = 0; return refusedAcct;
        }
      } catch (e) { /* Accounts sheet read failure → skip authority check, validation above still enforced */ }
    }
    var context, entry, sheetName, headers, prefix, action, values;
    switch (type) {
      case "INVENTORY_RECEIPT":
        return orchestrateInventoryReceiptUnderLock_(payload, inventoryReceiptProductionRuntime_(ss, lock), scope);
      case "SALES":
        context = canonicalEntryContext(ss, timestamp, "SALES");
        entry = prepareCanonicalSalesEntry(payload, context);
        sheetName = "tabsal"; headers = CANONICAL_ENTRY.SALES_HEADERS; prefix = "SAL-APP-"; action = "CREATE_SALES";
        values = [null, timestamp, entry.productId, entry.type, entry.qty, entry.unitHPP, entry.unitPrice,
          CANONICAL_ENTRY.SOURCE, true, timestamp, CANONICAL_ENTRY.USER, "", ""];
        break;
      case "EXPENSE":
        context = { timestamp: timestamp, expenseItems: expensePreResolvedItems || readCanonicalTable(ss, "ExpenseItems",
          ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]) };
        var route = resolveExpensePurchasePolicy_(payload.expenseItemId, context.expenseItems);
        if (expensePolicyIsPurchase_(route)) {
          var purchaseRuntime = purchaseEventProductionRuntime_(ss, lock, context.expenseItems, timestamp);
          if (runtime.environment === "LOCAL_FIXTURE" && runtime.purchase && runtime.purchase.environment === "LOCAL_FIXTURE") {
            purchaseRuntime = Object.assign({}, runtime.purchase, { lock: lock, read: function() {
              var state = runtime.purchase.read();
              return Object.assign({}, state, { expenses: context.expenseItems });
            } });
          }
          var purchaseResult = orchestratePurchaseEventUnderLock_(payload, purchaseRuntime, scope);
          // Policy C purchase recognition owns PAID Cash or UNPAID AP. Later AP settlement is separate.
          if (purchaseResult.data && typeof runtime.postPurchaseAccounting === "function") {
            var accounting = runtime.postPurchaseAccounting(purchaseResult.eventId || purchaseResult.data.id);
            purchaseResult.accountingStatus = accounting.status;
            purchaseResult.accountingPending = accounting.status !== "POSTED" && accounting.status !== "ALREADY_POSTED";
            purchaseResult.accountingPendingReason = purchaseResult.accountingPending ? accounting.reason || accounting.status : null;
          }
          return purchaseResult;
        }
        Object.keys(payload).forEach(function(field) {
          if (["transactionType", "expenseItemId", "amount", "expenseDate", "cashAccountCode", "requestKey"].indexOf(field) === -1) inventoryReceiptFail_("EXPENSE_ROUTE_UNKNOWN_FIELD");
        });
        context.accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "IsActive"]);
        if (payload.expenseDate !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.expenseDate) || !capitalEquityDateKey(payload.expenseDate)) inventoryReceiptFail_("EXPENSE_ROUTE_INVALID_DATE");
          timestamp = new Date(payload.expenseDate + "T00:00:00+07:00");
          context.timestamp = timestamp;
        }
        entry = prepareCanonicalExpenseEntry(payload, context);
        sheetName = "tabops"; headers = CANONICAL_ENTRY.EXPENSE_HEADERS; prefix = "OPS-APP-"; action = "CREATE_EXPENSE";
        values = [null, timestamp, entry.expenseItemId, entry.amount, CANONICAL_ENTRY.SOURCE, true,
          timestamp, CANONICAL_ENTRY.USER, "", ""];
        break;
      default:
        throw canonicalEntryError("INVALID_TRANSACTION_TYPE", "Unsupported transaction type.", "transactionType");
    }
    var sheet = ss.getSheetByName(sheetName);
    var id = generateCanonicalEntryId(prefix, timestamp,
      runtime.uuid, function(candidate) { return canonicalSheetHasId(sheet, candidate); });
    values[0] = id;
    persistCanonicalEntry(ss, { sheetName: sheetName, headers: headers,
      values: values, timestamp: timestamp, id: id, action: action }, { flush: runtime.flush, uuid: runtime.uuid });
    dateKey = canonicalDateKey(timestamp);
    if (type === "SALES" && (runtime.environment === "PRODUCTION" || typeof runtime.postSalesHpp === "function")) {
      var hppSale = { ID_Trx: id, Tanggal: dateKey, HPP: entry.cogs };
      var hppResult = typeof runtime.postSalesHpp === "function" ? runtime.postSalesHpp(hppSale) :
        postPolicyCSalesHppFromSpreadsheet_(ss, hppSale, { actor: CANONICAL_ENTRY.USER, at: timestamp }, false);
      if (hppResult.status !== "POSTED" && hppResult.status !== "ALREADY_POSTED") {
        entry.id = id;
        entry.timestamp = Utilities.formatDate(timestamp, CANONICAL_ENTRY.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
        return { success: true, data: entry, accountingPending: true,
          accountingPendingReason: hppResult.reason || hppResult.status };
      }
    }
    if (settlementCashAccount && dateKey > CASH_SETTLEMENT_CUTOVER) {
      var sourceType = type === "SALES" ? "SALE_SETTLEMENT" : "EXPENSE_SETTLEMENT";
      var settlementAmount = type === "SALES" ? entry.revenue : entry.amount;
      var settlement = attemptCashSettlement(ss, sourceType, id, settlementCashAccount,
        settlementAmount, dateKey, type === "SALES" ? "Sales" : "Expense", id, null, settle);
      if (settlement.result.status !== "POSTED" && settlement.result.status !== "ALREADY_POSTED") {
        logSettlementPending(ss, settlement.settlementId, sourceType, id, settlementCashAccount,
          settlementAmount, dateKey, settlement.result.status + ": " + (settlement.result.reason || ""), runtime.uuid);
        entry.id = id;
        entry.timestamp = Utilities.formatDate(timestamp, CANONICAL_ENTRY.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
        return { success: true, data: entry, accountingPending: true,
          accountingPendingReason: settlement.result.status };
      }
    }
    runtime.invalidate();
    entry.id = id;
    entry.timestamp = Utilities.formatDate(timestamp, CANONICAL_ENTRY.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    return { success: true, data: entry };
  } catch (error) {
    var result = canonicalEntryFailure(error);
    // Only pre-persistence routing refusals carry a definite zero-write claim.
    if (/^(ROUTING_|EXPENSE_POLICY_|EXPENSE_ROUTE_|EXPENSE_ID_|EXPENSE_ITEM_NOT_ACTIVE_OR_MAPPED|INVALID_ROUTING_REGISTRY|UNKNOWN_PURCHASE_FIELD|INVALID_PURCHASE_DATE|INVALID_PURCHASE_REQUEST|INVALID_PURCHASE_QUANTITY|INVALID_PURCHASE_COST|PURCHASE_EVIDENCE_REQUIRED|NOT_PURCHASE_POLICY)/.test(error.message)) {
      result.status = "REFUSED"; result.writeCount = 0; result.tabopsWrites = 0;
      result.error.code = error.message;
      result.error.message = error.message;
    }
    return result;
  } finally { if (scope) scope.active = false; if (acquired) lock.releaseLock(); }
}

// ---------------------------------------------------------------------------
// T11.4 U2 — EXPENSE_SINGLE_COMMIT_SAVE durable core (T11.2 §4/§6/§7/§8/§9).
//
// ONE normal Expense intent -> ONE immutable plan -> ONE atomic
// spreadsheets.batchUpdate [tabops, BalanceLedger(2), Logs] -> DONE. The
// legacy persist-then-settle multistep (persistCanonicalEntry write #1 ->
// attemptCashSettlement write #2/#3 -> accountingPending / SETTLEMENT_PENDING)
// is unreachable from this path: no Settlements surface, no cash account, no
// payment method, no Treasury workflow. Inert unless the frozen
// SINGLE_COMMIT_TRANSACTION_V1 config resolves ACTIVE; ABSENT/PREPARED keeps
// the legacy Expense writer byte-for-byte, PAUSED/REJECT/invalid fail closed.
//
// The dispatcher owns the single outer ScriptLock (submitCanonicalTransaction
// -> submitCanonicalTransactionWithRuntime_); this core never locks, so no
// nested lock is possible. Intent, batch, readback and commit remain
// multistep: only the single batchUpdate is atomic.
// ---------------------------------------------------------------------------
var EXPENSE_SINGLE_COMMIT_V1 = Object.freeze({
  OPERATION_TYPE: "EXPENSE_SINGLE_COMMIT_SAVE",
  PLAN_VERSION: 1,
  // The ONLY surfaces the single batch may ever touch. Payments, Settlements,
  // TreasuryReceipts, InventoryLedger, Cash, Fulfillment and Accounts writes
  // are forbidden artifacts for this operation.
  WRITE_SURFACES: Object.freeze(["tabops", "BalanceLedger", "Logs"]),
  JOURNAL_ID_PREFIX: "EXPJ-",
  MOVEMENT_TYPE: "EXPENSE_SINGLE_COMMIT",
  SOURCE_TYPE: "EXPENSE_SINGLE_COMMIT_V1",
  MONEY_ACCOUNT_CODE: "1040",
  AUDIT_MODULE: "TransactionEntry",
  AUDIT_ACTION: "CREATE_EXPENSE",
  ITEM_HEADERS: Object.freeze(["ID_Ops", "Item", "Kategori", "Kind", "Group",
    "AccountCode", "IsActive"]),
  // Strict normalizer allowlist. cashAccountCode is tolerated only as an
  // ABSENT value: the shared client always builds the legacy-shaped payload,
  // and an explicit channel selection is refused on the ACTIVE path (D1/D2).
  ALLOWED_FIELDS: Object.freeze(["transactionType", "expenseItemId", "amount",
    "expenseDate", "requestKey", "cashAccountCode"]),
  PAYMENT_FIELDS: Object.freeze(["paidVia", "paymentMethod", "PaymentMethod",
    "paymentStatus", "PaymentStatus", "receiveVia", "ReceiveVia",
    "destination", "destinationAccountCode", "evidenceRef", "EvidenceRef",
    "settlementId", "SettlementID", "cashAccount", "treasuryReceipt",
    "evidenceType", "paymentID", "PaymentID"]),
  MAX_CELL_CHARS: 45000,
  MAX_BATCH_CELLS: 500,
  MAX_REQUEST_BYTES: 1000000,
  REQUEST_OVERHEAD_BYTES: 4096,
  STATUS: Object.freeze({
    DONE: "DONE",
    REFUSED: "REFUSED",
    CONFLICT: "CONFLICT",
    UNKNOWN: "UNKNOWN",
    RECOVERY_REQUIRED: "RECOVERY_REQUIRED"
  }),
  CODES: Object.freeze({
    PAYLOAD_INVALID: "EXPENSE_SINGLE_COMMIT_PAYLOAD_INVALID",
    PAYMENT_FIELD_REFUSED: "EXPENSE_SINGLE_COMMIT_PAYMENT_FIELD_REFUSED",
    FIELD_REFUSED: "EXPENSE_SINGLE_COMMIT_FIELD_REFUSED",
    SCHEMA_NOT_READY: "EXPENSE_SINGLE_COMMIT_SCHEMA_NOT_READY",
    OPERATION_PAYLOAD_CONFLICT: "OPERATION_PAYLOAD_CONFLICT",
    DUPLICATE_OPERATION_EVIDENCE: "DUPLICATE_OPERATION_EVIDENCE",
    BATCH_BOUNDS_EXCEEDED: "EXPENSE_SINGLE_COMMIT_BATCH_BOUNDS_EXCEEDED",
    ARTIFACTS_INCOMPLETE: "EXPENSE_SINGLE_COMMIT_ARTIFACTS_INCOMPLETE",
    IDENTITY_CONFLICT: "EXPENSE_SINGLE_COMMIT_IDENTITY_CONFLICT",
    PLAN_MALFORMED: "EXPENSE_SINGLE_COMMIT_PLAN_MALFORMED",
    INTENT_READBACK_FAILED: "EXPENSE_SINGLE_COMMIT_INTENT_READBACK_FAILED",
    BATCH_OUTCOME_UNKNOWN: "EXPENSE_SINGLE_COMMIT_BATCH_OUTCOME_UNKNOWN",
    READBACK_UNKNOWN: "EXPENSE_SINGLE_COMMIT_READBACK_UNKNOWN",
    COMMIT_OUTCOME_UNKNOWN: "EXPENSE_SINGLE_COMMIT_COMMIT_OUTCOME_UNKNOWN",
    SAVE_EXECUTION_UNKNOWN: "EXPENSE_SINGLE_COMMIT_SAVE_EXECUTION_UNKNOWN",
    INVALID_OPERATION_STATE: "EXPENSE_SINGLE_COMMIT_INVALID_OPERATION_STATE",
    ACCOUNT_PREFLIGHT_FAILED: "EXPENSE_SINGLE_COMMIT_ACCOUNT_PREFLIGHT_FAILED",
    JOURNAL_SIGNATURE_INVALID: "EXPENSE_SINGLE_COMMIT_JOURNAL_SIGNATURE_INVALID"
  })
});

// Envelope result. NEVER a { success: false } DTO without identity: UNKNOWN /
// RECOVERY_REQUIRED retain requestKey + operation linkage so an uncertain
// outcome can never collapse into a definite loss of identity.
function expenseSingleCommitResult_(status, fields) {
  return Object.assign({
    status: status, code: "", requestKey: "", operationID: "", entryID: "",
    journalID: "", auditID: "", writeCount: 0, replay: false, field: "",
    detail: "", entry: null
  }, fields || {});
}

function expenseSingleCommitError_(code, field, message) {
  var error = new Error(message || code);
  error.expenseSingleCommitCode = code;
  error.field = field || "";
  return error;
}

// ---------------------------------------------------------------------------
// Config gate (T11.2 §20). Read-only: resolves SINGLE_COMMIT_TRANSACTION_V1
// once per new dispatch. ABSENT/PREPARED => LEGACY (today's writer, byte
// identical); ACTIVE => the single-commit core; PAUSED => fail closed; REJECT
// or an unresolved value => fail closed. Never a silent legacy fallback.
// ---------------------------------------------------------------------------
function expenseSingleCommitGate_(runtime) {
  var contract = SINGLE_COMMIT_TRANSACTION_V1;
  var raw = null;
  if (runtime && Object.prototype.hasOwnProperty.call(runtime, "singleCommitConfig")) {
    raw = runtime.singleCommitConfig;
  } else {
    try {
      if (typeof PropertiesService !== "undefined") {
        raw = PropertiesService.getScriptProperties().getProperty(contract.CONFIG_PROPERTY);
      }
    } catch (error) {
      return { mode: "REFUSE", code: contract.CODES.SINGLE_COMMIT_CONFIG_INVALID,
        detail: "CONFIG_READ_FAILED" };
    }
  }
  var state = singleCommitTransactionConfigState_(raw);
  if (state.state === "UNRESOLVED") {
    return { mode: "REFUSE", code: contract.CODES.SINGLE_COMMIT_CONFIG_INVALID,
      detail: state.detail };
  }
  if (state.state === "ABSENT" || state.mode === "PREPARED") {
    return { mode: "LEGACY", code: "", detail: "" };
  }
  if (state.mode === "ACTIVE") return { mode: "ACTIVE", code: "", detail: "" };
  if (state.mode === "PAUSED") {
    return { mode: "REFUSE", code: contract.CODES.SINGLE_COMMIT_MODE_PAUSED, detail: "" };
  }
  return { mode: "REFUSE", code: contract.CODES.SINGLE_COMMIT_CONFIG_INVALID,
    detail: "MODE_REJECT" };
}

// Server-resolved mode for the operator authority bootstrap (the client never
// resolves config itself). Mirrors dto.salesV2Mode semantics: ABSENT and
// PREPARED both travel as PREPARED; an unresolved value travels as REJECT so
// the client fails closed instead of exposing a legacy payment surface.
function expenseSingleCommitResolvedMode_() {
  var gate = expenseSingleCommitGate_(null);
  if (gate.mode === "REFUSE") return "REJECT";
  if (gate.mode === "ACTIVE") return "ACTIVE";
  return "PREPARED";
}

// Zero-write refusal envelope for a gate that refuses before any read/write.
function expenseSingleCommitRefusal_(gate) {
  var result = expenseSingleCommitResult_(EXPENSE_SINGLE_COMMIT_V1.STATUS.REFUSED,
    { code: gate.code, detail: gate.detail || "", writeCount: 0 });
  return expenseSingleCommitEnvelope_(result);
}

// Dispatcher-shaped envelope. DONE carries the exact legacy Expense DTO so the
// existing client contract (success/data) is unchanged; every non-DONE status
// keeps the legacy { success:false, error:{code,message,field} } shape, with
// `unknown: true` added only for UNKNOWN so the client never renders a
// definite failure for an unresolved outcome. `accountingPending` is never set.
function expenseSingleCommitEnvelope_(result) {
  var save = EXPENSE_SINGLE_COMMIT_V1;
  var envelope = {
    status: result.status,
    code: result.code,
    writeCount: result.writeCount,
    requestKey: result.requestKey,
    operationID: result.operationID,
    entryID: result.entryID,
    journalID: result.journalID,
    auditID: result.auditID
  };
  if (result.status === save.STATUS.DONE) {
    envelope.success = true;
    envelope.data = result.entry;
    envelope.singleCommit = { status: "DONE", replay: result.replay === true,
      writeCount: result.writeCount };
    return envelope;
  }
  envelope.success = false;
  envelope.error = {
    code: result.code || result.status,
    message: result.detail || result.code || result.status,
    field: result.field || null
  };
  if (result.status === save.STATUS.UNKNOWN) envelope.unknown = true;
  return envelope;
}

// ---------------------------------------------------------------------------
// Pure input normalization (T11.2 §17 minimum input). Definite refusals fail
// here before any read or write. The exact normalized structure is persisted
// in the plan and compared verbatim on replay/conflict.
// ---------------------------------------------------------------------------
function expenseSingleCommitNormalize_(payload) {
  var save = EXPENSE_SINGLE_COMMIT_V1, codes = save.CODES;
  var p = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  var keys = Object.keys(p);
  var payment = keys.filter(function(key) {
    return save.PAYMENT_FIELDS.indexOf(key) !== -1 && p[key] !== undefined &&
      p[key] !== null && String(p[key]).trim() !== "";
  });
  if (payment.length) {
    throw expenseSingleCommitError_(codes.PAYMENT_FIELD_REFUSED, payment[0],
      "PAYMENT_FIELD_REFUSED:" + payment.join(","));
  }
  var unknown = keys.filter(function(key) {
    return save.ALLOWED_FIELDS.indexOf(key) === -1;
  });
  if (unknown.length) {
    throw expenseSingleCommitError_(codes.FIELD_REFUSED, unknown[0],
      "FIELD_REFUSED:" + unknown.join(","));
  }
  // The legacy-shaped client payload always carries cashAccountCode; on the
  // ACTIVE path it must be absent. An explicit channel selection is refused,
  // never silently dropped (D1/D2/D7).
  var cash = p.cashAccountCode;
  if (cash !== undefined && cash !== null && String(cash).trim() !== "") {
    throw expenseSingleCommitError_(codes.PAYMENT_FIELD_REFUSED, "cashAccountCode",
      "CASH_ACCOUNT_REFUSED");
  }
  if (String(p.transactionType === undefined || p.transactionType === null ?
      "" : p.transactionType) !== "EXPENSE") {
    throw expenseSingleCommitError_(codes.PAYLOAD_INVALID, "transactionType",
      "TRANSACTION_TYPE_MUST_BE_EXPENSE");
  }
  var requestKey = p.requestKey === undefined || p.requestKey === null ?
    "" : String(p.requestKey).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{3,127}$/.test(requestKey)) {
    throw expenseSingleCommitError_(codes.PAYLOAD_INVALID, "requestKey",
      "REQUEST_KEY_REQUIRED");
  }
  var expenseItemId = p.expenseItemId === undefined || p.expenseItemId === null ?
    "" : String(p.expenseItemId).trim();
  if (!expenseItemId) {
    throw expenseSingleCommitError_(codes.PAYLOAD_INVALID, "expenseItemId",
      "EXPENSE_ITEM_REQUIRED");
  }
  var amount = p.amount;
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    throw expenseSingleCommitError_(codes.PAYLOAD_INVALID, "amount", "INVALID_AMOUNT");
  }
  // Optional business date: absent keeps the authoritative current/business
  // date; present must be a real calendar date (unchanged legacy contract).
  var expenseDate = "";
  if (p.expenseDate !== undefined) {
    expenseDate = p.expenseDate === null ? "" : String(p.expenseDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || !capitalEquityDateKey(expenseDate)) {
      throw expenseSingleCommitError_(codes.PAYLOAD_INVALID, "expenseDate",
        "EXPENSE_DATE_INVALID");
    }
  }
  return { requestKey: requestKey, expenseItemId: expenseItemId, amount: amount,
    expenseDate: expenseDate };
}

function expenseSingleCommitPayloadKey_(payload) {
  return payload && payload.requestKey !== undefined && payload.requestKey !== null ?
    String(payload.requestKey) : "";
}

// Date-safe single-field equality (same comparison class as the U2/T4 readback:
// Date instances compare by instant against Dates or ISO strings).
function expenseSingleCommitFieldEqual_(actual, expected) {
  if (actual instanceof Date || expected instanceof Date) {
    var av = actual instanceof Date ? actual.getTime() :
      (actual === undefined || actual === null || actual === "" ? NaN : new Date(actual).getTime());
    var ev = expected instanceof Date ? expected.getTime() :
      (expected === undefined || expected === null || expected === "" ? NaN : new Date(expected).getTime());
    return !isNaN(av) && !isNaN(ev) && av === ev;
  }
  return String(actual === undefined || actual === null ? "" : actual) ===
    String(expected === undefined || expected === null ? "" : expected);
}

function expenseSingleCommitFieldsExact_(actual, expected, headers) {
  if (!actual || !expected) return false;
  return headers.every(function(header) {
    return expenseSingleCommitFieldEqual_(actual[header], expected[header]);
  });
}

function expenseSingleCommitRowExact_(actual, expected, headers) {
  if (!actual || !expected) return false;
  return headers.every(function(header) {
    return expenseSingleCommitFieldEqual_(actual[header], expected[header]);
  });
}

// Zero-write schema gate: every surface the save reads or writes must exist
// with its exact canonical headers before anything else is attempted. Header
// reads only; never recomputes mutable master rows. Re-run on resume so a
// vanished or corrupted surface fails closed before any batch.
function expenseSingleCommitSchemaGate_(ss) {
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  var exact = [
    ["tabops", CANONICAL_ENTRY.EXPENSE_HEADERS],
    ["Logs", CANONICAL_ENTRY.LOG_HEADERS],
    ["BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS],
    [t.OPERATIONS.SHEET, t.OPERATIONS.HEADERS]
  ];
  var present = [
    ["Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS],
    ["ExpenseItems", EXPENSE_SINGLE_COMMIT_V1.ITEM_HEADERS]
  ];
  var bad = [];
  exact.forEach(function(entry) {
    try { requireCanonicalHeaders(ss.getSheetByName(entry[0]), entry[1]); }
    catch (error) { bad.push(entry[0]); }
  });
  present.forEach(function(entry) {
    try { readCanonicalTable(ss, entry[0], entry[1]); }
    catch (error) { bad.push(entry[0]); }
  });
  return { status: bad.length ? "FAIL" : "PASS", badSheets: bad };
}

// ---------------------------------------------------------------------------
// TransactionOperations durable access (T11.2 §9: the common operation
// authority, keyed (OperationType, RequestKey); a duplicate store row is
// DUPLICATE_OPERATION and fails closed). Flush is injected so the local
// harness never touches SpreadsheetApp.
// ---------------------------------------------------------------------------
function expenseSingleCommitOperationRepository_(ss, flush) {
  var c = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS;
  function sheet() {
    var s = ss.getSheetByName(c.SHEET);
    if (!s) throw new Error("OPERATION_SHEET_MISSING");
    return s;
  }
  function rows() { return readCanonicalTable(ss, c.SHEET, c.HEADERS); }
  function write(row, rowNumber) {
    sheet().getRange(rowNumber, 1, 1, c.HEADERS.length).setValues([
      c.HEADERS.map(function(header) { return row[header] === undefined ? "" : row[header]; })
    ]);
    if (typeof flush === "function") flush();
  }
  function find(type, requestKey) {
    var found = rows().filter(function(row) {
      return row.OperationType === type && String(row.RequestKey) === requestKey;
    });
    if (found.length > 1) throw new Error("DUPLICATE_OPERATION");
    return found[0] || null;
  }
  return {
    findOperation: find,
    createOperation: function(row) {
      if (find(row.OperationType, row.RequestKey)) throw new Error("DUPLICATE_OPERATION");
      write(row, sheet().getLastRow() + 1);
      return row;
    },
    updateOperation: function(row) {
      var found = find(row.OperationType, row.RequestKey);
      if (!found || found.OperationID !== row.OperationID) {
        throw new Error("OPERATION_NOT_FOUND");
      }
      write(row, found.sourceRowIndex + 1);
      return row;
    }
  };
}

// Core runtime assembled from the dispatcher's already-locked context. The
// `expenseSingleCommit` object on the dispatcher runtime is the local fixture
// seam (repository / batch / crash); production defaults are read-only
// transport factories.
function expenseSingleCommitCoreRuntime_(ss, dispatcherRuntime, items, gate) {
  var seam = dispatcherRuntime && dispatcherRuntime.expenseSingleCommit || {};
  return {
    spreadsheet: ss,
    now: dispatcherRuntime.now,
    uuid: dispatcherRuntime.uuid,
    flush: dispatcherRuntime.flush,
    invalidate: dispatcherRuntime.invalidate,
    items: items,
    gate: gate,
    batch: seam.batch || expenseSingleCommitBatchRequest_,
    crash: seam.crash,
    actor: seam.actor || function() {
      try {
        return (typeof Session !== "undefined" && Session.getActiveUser &&
          Session.getActiveUser().getEmail()) || CANONICAL_ENTRY.USER;
      } catch (error) { return CANONICAL_ENTRY.USER; }
    },
    repository: seam.repository ||
      expenseSingleCommitOperationRepository_(ss, dispatcherRuntime.flush)
  };
}

// ---------------------------------------------------------------------------
// Immutable OperationPlan freeze (T11.2 §7): business row, expense authority
// snapshot, the exact two ledger rows (Dr expense / Cr 1040), the audit row,
// the journal signature and a canonical integrity digest — derived once.
// ---------------------------------------------------------------------------
function expenseSingleCommitPlan_(input) {
  var save = EXPENSE_SINGLE_COMMIT_V1;
  var normalized = input.normalized, now = input.now, nowISO = now.toISOString();
  var timestamp = input.timestamp, actor = input.actor;
  var entry = input.entry, entryID = input.entryID;
  var economicDate = capitalEquityDateKey(timestamp);
  var journalID = save.JOURNAL_ID_PREFIX + entryID;
  var amount = entry.amount;
  var businessRow = {
    ID_Trx: entryID,
    Tanggal: timestamp,
    ID_Ops: entry.expenseItemId,
    Nilai: amount,
    Source: CANONICAL_ENTRY.SOURCE,
    IsActive: true,
    CreatedAt: timestamp,
    CreatedBy: CANONICAL_ENTRY.USER,
    UpdatedAt: "",
    UpdatedBy: ""
  };
  var journalRows = [
    { JournalID: journalID, LineID: journalID + "-1", Tanggal: economicDate,
      AccountCode: input.expenseAccountCode, Debit: amount, Credit: 0,
      MovementType: save.MOVEMENT_TYPE, SourceType: save.SOURCE_TYPE,
      SourceID: entryID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor },
    { JournalID: journalID, LineID: journalID + "-2", Tanggal: economicDate,
      AccountCode: save.MONEY_ACCOUNT_CODE, Debit: 0, Credit: amount,
      MovementType: save.MOVEMENT_TYPE, SourceType: save.SOURCE_TYPE,
      SourceID: entryID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor }
  ];
  var journalSignature = policyCJournalSignature_(journalRows);
  var auditRow = {
    ID_Log: input.auditID,
    Timestamp: timestamp,
    Level: "INFO",
    Module: save.AUDIT_MODULE,
    Action: save.AUDIT_ACTION,
    RecordID: entryID,
    User: CANONICAL_ENTRY.USER,
    Message: "Canonical transaction created.",
    Metadata: JSON.stringify({ source: CANONICAL_ENTRY.SOURCE, ledger: "tabops" })
  };
  var plan = {
    planVersion: save.PLAN_VERSION,
    operationType: save.OPERATION_TYPE,
    operationID: input.operationID,
    requestKey: normalized.requestKey,
    payloadHash: input.hash,
    normalizedPayload: normalized,
    entryID: entryID,
    journalID: journalID,
    auditID: input.auditID,
    actor: actor,
    savedAt: nowISO,
    transactionTimestamp: timestamp,
    economicDate: economicDate,
    expenseDate: normalized.expenseDate || economicDate,
    amount: amount,
    expenseItem: {
      expenseItemId: entry.expenseItemId,
      item: entry.item,
      category: entry.category,
      kind: entry.kind,
      group: entry.group,
      accountCode: input.expenseAccountCode,
      accountActive: true
    },
    accounts: { expense: input.expenseAccountCode, money: save.MONEY_ACCOUNT_CODE },
    movementType: save.MOVEMENT_TYPE,
    sourceType: save.SOURCE_TYPE,
    journalSignature: journalSignature,
    businessRow: businessRow,
    journalRows: journalRows,
    auditRow: auditRow
  };
  plan.planDigest = transactionPayloadHash_(plan);
  return plan;
}

// Plan integrity + shape invariants. Runs at freeze time (definite REFUSED,
// before any write) and on every resume (fail closed, ZERO additional writes).
// Malformed shape and derivational/content disagreement both fail closed.
function expenseSingleCommitVerifyPlan_(plan) {
  var save = EXPENSE_SINGLE_COMMIT_V1;
  function malformed(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function tampered(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return malformed("PLAN_NOT_OBJECT");
  if (plan.planVersion !== save.PLAN_VERSION) return malformed("PLAN_VERSION_MISMATCH");
  if (plan.operationType !== save.OPERATION_TYPE) return malformed("OPERATION_TYPE_MISMATCH");
  if (typeof plan.requestKey !== "string" || !plan.requestKey) return malformed("REQUEST_KEY_MISSING");
  if (plan.operationID !== transactionOperationID_(save.OPERATION_TYPE, plan.requestKey)) {
    return tampered("OPERATION_ID_MISMATCH");
  }
  if (!plan.entryID || plan.journalID !== save.JOURNAL_ID_PREFIX + plan.entryID) {
    return tampered("JOURNAL_ID_MISMATCH");
  }
  if (typeof plan.payloadHash !== "string" ||
      plan.payloadHash !== transactionPayloadHash_(plan.normalizedPayload)) {
    return tampered("PAYLOAD_HASH_MISMATCH");
  }
  // The normalized payload may never carry a channel/payment fact (D1/D2).
  var payload = plan.normalizedPayload || {};
  var paymentKey = Object.keys(payload).filter(function(key) {
    return key !== "cashAccountCode" && save.PAYMENT_FIELDS.indexOf(key) !== -1;
  });
  if (paymentKey.length) return tampered("PAYMENT_FIELD_IN_PLAN");
  if (payload.cashAccountCode !== undefined && payload.cashAccountCode !== null &&
      String(payload.cashAccountCode).trim() !== "") {
    return tampered("CASH_ACCOUNT_IN_PLAN");
  }
  var amount = plan.amount;
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return malformed("AMOUNT_INVALID");
  }
  if (plan.accounts.money !== save.MONEY_ACCOUNT_CODE) return tampered("MONEY_ACCOUNT_MISMATCH");
  if (!plan.expenseItem || plan.expenseItem.accountCode !== plan.accounts.expense) {
    return tampered("EXPENSE_ACCOUNT_MISMATCH");
  }
  if (plan.expenseItem.accountCode === save.MONEY_ACCOUNT_CODE) {
    return tampered("EXPENSE_ACCOUNT_IS_MONEY_ACCOUNT");
  }
  if (plan.sourceType !== save.SOURCE_TYPE || plan.movementType !== save.MOVEMENT_TYPE) {
    return tampered("SOURCE_IDENTITY_MISMATCH");
  }
  if (!plan.businessRow || plan.businessRow.ID_Trx !== plan.entryID ||
      plan.businessRow.ID_Ops !== plan.expenseItem.expenseItemId ||
      plan.businessRow.Nilai !== amount || plan.businessRow.Source !== CANONICAL_ENTRY.SOURCE ||
      plan.businessRow.IsActive !== true) {
    return tampered("BUSINESS_ROW_MISMATCH");
  }
  if (!plan.auditRow || plan.auditRow.ID_Log !== plan.auditID ||
      plan.auditRow.RecordID !== plan.entryID ||
      plan.auditRow.Action !== save.AUDIT_ACTION ||
      plan.auditRow.Module !== save.AUDIT_MODULE) {
    return tampered("AUDIT_ROW_MISMATCH");
  }
  if (!Array.isArray(plan.journalRows) || plan.journalRows.length !== 2) {
    return malformed("JOURNAL_ROW_COUNT");
  }
  var debitRow = plan.journalRows[0], creditRow = plan.journalRows[1];
  if (debitRow.LineID !== plan.journalID + "-1" || creditRow.LineID !== plan.journalID + "-2") {
    return tampered("JOURNAL_LINE_ID_MISMATCH");
  }
  if (debitRow.JournalID !== plan.journalID || creditRow.JournalID !== plan.journalID) {
    return tampered("JOURNAL_ID_MISMATCH");
  }
  var ok = plan.journalRows.every(function(row) {
    return row.SourceType === save.SOURCE_TYPE && row.SourceID === plan.entryID &&
      row.MovementType === save.MOVEMENT_TYPE && row.IsActive === true &&
      expenseSingleCommitFieldEqual_(row.Tanggal, plan.economicDate);
  });
  if (!ok) return tampered("JOURNAL_SOURCE_MISMATCH");
  if (debitRow.AccountCode !== plan.accounts.expense || debitRow.Debit !== amount ||
      Number(debitRow.Credit) !== 0) {
    return tampered("DEBIT_LEG_MISMATCH");
  }
  if (creditRow.AccountCode !== save.MONEY_ACCOUNT_CODE ||
      Number(creditRow.Debit) !== 0 || creditRow.Credit !== amount) {
    return tampered("CREDIT_LEG_MISMATCH");
  }
  var totalDebit = 0, totalCredit = 0;
  plan.journalRows.forEach(function(row) {
    totalDebit += Number(row.Debit || 0);
    totalCredit += Number(row.Credit || 0);
  });
  if (totalDebit !== amount || totalCredit !== amount || totalDebit !== totalCredit) {
    return tampered("JOURNAL_NOT_BALANCED");
  }
  if (policyCJournalSignature_(plan.journalRows) !== plan.journalSignature) {
    return tampered("JOURNAL_SIGNATURE_MISMATCH");
  }
  var digestInput = Object.assign({}, plan);
  delete digestInput.planDigest;
  if (plan.planDigest !== transactionPayloadHash_(digestInput)) {
    return tampered("PLAN_DIGEST_MISMATCH");
  }
  return { ok: true, kind: "", reason: "" };
}

// ---------------------------------------------------------------------------
// The ONE batch's logical ranges: exactly three value ranges, exact write
// surfaces, frozen plan order (T11.2 §8).
// ---------------------------------------------------------------------------
function expenseSingleCommitValueRanges_(plan) {
  var save = EXPENSE_SINGLE_COMMIT_V1;
  function rowValues(row, headers) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }
  var ranges = [
    { range: "tabops", values: [rowValues(plan.businessRow, CANONICAL_ENTRY.EXPENSE_HEADERS)] },
    { range: "BalanceLedger", values: plan.journalRows.map(function(row) {
      return rowValues(row, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS); }) },
    { range: "Logs", values: [rowValues(plan.auditRow, CANONICAL_ENTRY.LOG_HEADERS)] }
  ];
  if (JSON.stringify(ranges.map(function(range) { return range.range; })) !==
      JSON.stringify(save.WRITE_SURFACES)) {
    throw new Error("SAVE_SURFACE_MISMATCH");
  }
  return ranges;
}

// Safe RAW CellData only: stringValue / numberValue / boolValue, never
// formulaValue. Date values serialize to ISO strings (the same identity the
// U2/T4 transport writes into date columns); readback is Date-safe.
function expenseSingleCommitCellValue_(value) {
  var save = EXPENSE_SINGLE_COMMIT_V1;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw new Error("UNSAFE_CELL_DATE");
    return { stringValue: value.toISOString() };
  }
  if (typeof value === "number") {
    if (!isFinite(value)) throw new Error("UNSAFE_CELL_NUMBER");
    return { numberValue: value };
  }
  if (typeof value === "boolean") return { boolValue: value };
  var text = String(value === undefined || value === null ? "" : value);
  if (text.length > save.MAX_CELL_CHARS) throw new Error("UNSAFE_CELL_CHARS:" + text.length);
  return { stringValue: text };
}

// ONE spreadsheets.batchUpdate body: exactly three appendCells subrequests
// (one per write surface, by sheetId). Throws BEFORE issuing any request if a
// sheetId is missing, so the batch is rejected atomically rather than partly.
function expenseSingleCommitBatchBody_(valueRanges, sheetIds) {
  var save = EXPENSE_SINGLE_COMMIT_V1;
  if (valueRanges.length !== save.WRITE_SURFACES.length) throw new Error("SAVE_SURFACE_MISMATCH");
  var requests = valueRanges.map(function(range) {
    var sheetId = sheetIds[range.range];
    if (typeof sheetId !== "number" || !isFinite(sheetId)) {
      throw new Error("SHEET_ID_UNAVAILABLE:" + range.range);
    }
    return { appendCells: { sheetId: sheetId, fields: "userEnteredValue",
      rows: range.values.map(function(row) {
        return { values: row.map(function(cell) {
          return { userEnteredValue: expenseSingleCommitCellValue_(cell) };
        }) };
      }) } };
  });
  return { requests: requests };
}

// UTF-8 byte count without Node APIs (Apps Script V8 safe).
function expenseSingleCommitUtf8Bytes_(text) {
  var bytes = 0;
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length &&
        text.charCodeAt(i + 1) >= 0xDC00 && text.charCodeAt(i + 1) <= 0xDFFF) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

// Cell / request safety bounds: evaluated BEFORE the intent write (an unsafe
// plan is never persisted) and re-evaluated on resume against the STORED plan.
function expenseSingleCommitBounds_(plan) {
  var save = EXPENSE_SINGLE_COMMIT_V1, ranges;
  try { ranges = expenseSingleCommitValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "SAVE_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  save.WRITE_SURFACES.forEach(function(name) { sentinel[name] = 2147483647; });
  var body;
  try { body = expenseSingleCommitBatchBody_(ranges, sentinel); }
  catch (error) { return { ok: false, detail: "UNSAFE_BATCH:" + error.message }; }
  var bytes = expenseSingleCommitUtf8Bytes_(JSON.stringify(body)) + save.REQUEST_OVERHEAD_BYTES;
  var planJson = "";
  try { planJson = JSON.stringify(plan); }
  catch (error) { return { ok: false, detail: "PLAN_JSON_INVALID" }; }
  if (planJson.length > save.MAX_CELL_CHARS) {
    return { ok: false, detail: "UNSAFE_PLAN_CELL_CHARS:" + planJson.length };
  }
  var ok = cells <= save.MAX_BATCH_CELLS && bytes <= save.MAX_REQUEST_BYTES;
  return { ok: ok, cells: cells, bytes: bytes, planChars: planJson.length,
    detail: ok ? "" : "BATCH_BOUNDS cells=" + cells + " bytes=" + bytes };
}

// Exact artifact verification against the frozen plan over the three surfaces.
// Distinguishes NONE (intent only) / PARTIAL (incomplete) / CONFLICT (identity
// or content disagreement) / EXACT / UNKNOWN (read failure).
function expenseSingleCommitInspect_(plan, ss) {
  var save = EXPENSE_SINGLE_COMMIT_V1,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var tabops, ledger, logs;
  try {
    tabops = readCanonicalTable(ss, "tabops", CANONICAL_ENTRY.EXPENSE_HEADERS);
    ledger = readCanonicalTable(ss, "BalanceLedger", ledgerHeaders);
    logs = readCanonicalTable(ss, "Logs", CANONICAL_ENTRY.LOG_HEADERS);
  } catch (error) {
    return { state: "UNKNOWN", detail: "READBACK_FAILED:" + error.message };
  }
  var conflicts = [], missing = [];
  var plannedLineIds = {};
  plan.journalRows.forEach(function(row) { plannedLineIds[row.LineID] = true; });
  ledger.forEach(function(row) {
    if (plannedLineIds[row.LineID] &&
        !(row.JournalID === plan.journalID && row.SourceType === plan.sourceType &&
          row.SourceID === plan.entryID)) {
      conflicts.push("JOURNAL_LINE_CROSS_OWNER");
    }
    if (String(row.SourceID) === plan.entryID && String(row.SourceType) !== plan.sourceType) {
      conflicts.push("JOURNAL_SOURCE_CROSS_OWNER");
    }
  });
  tabops.forEach(function(row) {
    if (row.ID_Trx === plan.entryID && row.Source !== CANONICAL_ENTRY.SOURCE) {
      conflicts.push("BUSINESS_ROW_SOURCE_CROSS_OWNER");
    }
  });
  logs.forEach(function(row) {
    if (row.ID_Log === plan.auditID && row.RecordID !== plan.entryID) {
      conflicts.push("AUDIT_RECORD_CROSS_OWNER");
    }
    if (row.RecordID === plan.entryID && row.Module === save.AUDIT_MODULE &&
        row.Action === save.AUDIT_ACTION && row.ID_Log !== plan.auditID) {
      conflicts.push("AUDIT_IDENTITY_CROSSOVER");
    }
  });
  var businessMatches = tabops.filter(function(row) { return row.ID_Trx === plan.entryID; });
  var journalBySource = ledger.filter(function(row) {
    return String(row.SourceType) === plan.sourceType && String(row.SourceID) === plan.entryID;
  });
  var journalById = ledger.filter(function(row) { return row.JournalID === plan.journalID; });
  var auditById = logs.filter(function(row) { return row.ID_Log === plan.auditID; });
  var present = businessMatches.length || journalBySource.length || journalById.length ||
    auditById.length;
  if (!present) {
    if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
    return { state: "NONE", detail: "NO_ARTIFACTS" };
  }
  if (businessMatches.length > 1) conflicts.push("BUSINESS_ROW_DUPLICATE");
  else if (businessMatches.length === 1) {
    if (!expenseSingleCommitRowExact_(businessMatches[0], plan.businessRow,
        CANONICAL_ENTRY.EXPENSE_HEADERS)) {
      conflicts.push("BUSINESS_ROW_TAMPERED");
    }
  } else missing.push("BUSINESS_ROW");
  if (journalBySource.length || journalById.length) {
    var sourceSet = journalBySource.map(function(row) { return String(row.LineID); }).sort().join("");
    var idSet = journalById.map(function(row) { return String(row.LineID); }).sort().join("");
    if (sourceSet !== idSet) conflicts.push("JOURNAL_IDENTITY_CROSSOVER");
    if (journalBySource.length === 1) missing.push("JOURNAL_LINE");
    else if (journalBySource.length === 2) {
      var byLine = {};
      journalBySource.forEach(function(row) { byLine[String(row.LineID)] = row; });
      var debit = 0, credit = 0;
      plan.journalRows.forEach(function(expected) {
        var actual = byLine[expected.LineID];
        if (!actual || !expenseSingleCommitRowExact_(actual, expected, ledgerHeaders)) {
          conflicts.push("JOURNAL_TAMPERED");
          return;
        }
        debit += Number(actual.Debit);
        credit += Number(actual.Credit);
      });
      if (!(debit === credit && debit === Number(plan.amount))) {
        conflicts.push("JOURNAL_BALANCE_MISMATCH");
      }
      if (policyCJournalSignature_(journalBySource) !== plan.journalSignature) {
        conflicts.push("JOURNAL_SIGNATURE_MISMATCH");
      }
    } else conflicts.push("JOURNAL_DUPLICATE");
  } else missing.push("JOURNAL");
  if (auditById.length) {
    if (auditById.length > 1) conflicts.push("AUDIT_DUPLICATE");
    else if (!expenseSingleCommitRowExact_(auditById[0], plan.auditRow, CANONICAL_ENTRY.LOG_HEADERS)) {
      conflicts.push("AUDIT_TAMPERED");
    }
  } else missing.push("AUDIT");
  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
  return { state: "EXACT", detail: "" };
}

// COMMITTED transition: full ten-field readback of the committed operation
// against the expected in-memory row. Lost or mismatched readback after a
// successful update returns UNKNOWN (never DONE); the next retry verifies again.
function expenseSingleCommitCommit_(operation, runtime) {
  var save = EXPENSE_SINGLE_COMMIT_V1, codes = save.CODES,
    schema = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS;
  var expected = Object.assign({}, operation, {
    State: "COMMITTED", UpdatedAt: runtime.now(), LastError: ""
  });
  try { runtime.repository.updateOperation(expected); }
  catch (error) {
    return { ok: false, status: save.STATUS.UNKNOWN, code: codes.COMMIT_OUTCOME_UNKNOWN,
      detail: "COMMIT_WRITE_FAILED:" + error.message };
  }
  var committed = null;
  try {
    committed = runtime.repository.findOperation(operation.OperationType, operation.RequestKey);
  } catch (error) {
    return { ok: false, status: save.STATUS.UNKNOWN, code: codes.COMMIT_OUTCOME_UNKNOWN,
      detail: "COMMIT_READBACK_FAILED:" + error.message };
  }
  if (!committed) {
    return { ok: false, status: save.STATUS.UNKNOWN, code: codes.COMMIT_OUTCOME_UNKNOWN,
      detail: "COMMIT_ROW_MISSING" };
  }
  if (committed.State !== "COMMITTED" ||
      !expenseSingleCommitFieldsExact_(committed, expected, schema.HEADERS)) {
    return { ok: false, status: save.STATUS.UNKNOWN, code: codes.COMMIT_OUTCOME_UNKNOWN,
      detail: "COMMIT_READBACK_MISMATCH" };
  }
  operation.State = "COMMITTED";
  operation.UpdatedAt = expected.UpdatedAt;
  operation.LastError = "";
  return { ok: true, status: save.STATUS.DONE, code: "", detail: "" };
}

// Batch -> exact inspect -> COMMITTED + exact readback. Never retries a failed
// batch inside one call: an unknown batch outcome is inspected once and, if
// unresolved, reported as UNKNOWN with the request identity preserved.
function expenseSingleCommitApplyBatch_(plan, operation, runtime) {
  var save = EXPENSE_SINGLE_COMMIT_V1, codes = save.CODES;
  function outcome(status, fields) {
    return expenseSingleCommitResult_(status, Object.assign({
      requestKey: plan.requestKey, operationID: plan.operationID, entryID: plan.entryID,
      journalID: plan.journalID, auditID: plan.auditID
    }, fields || {}));
  }
  var ranges = null;
  try { ranges = expenseSingleCommitValueRanges_(plan); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message, writeCount: "UNKNOWN" });
  }
  var rows = 0;
  ranges.forEach(function(range) { rows += range.values.length; });
  if (runtime.crash) runtime.crash("EXPENSE_BEFORE_BATCH");
  var batchError = null;
  try { runtime.batch(ranges); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("EXPENSE_AFTER_BATCH");
  var inspection = expenseSingleCommitInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(save.STATUS.UNKNOWN,
      { code: codes.READBACK_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "NONE") {
    if (batchError) {
      return outcome(save.STATUS.UNKNOWN,
        { code: codes.BATCH_OUTCOME_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
    }
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "PARTIAL") {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "CONFLICT") {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: inspection.detail.indexOf("SIGNATURE") !== -1 ?
        codes.JOURNAL_SIGNATURE_INVALID : codes.IDENTITY_CONFLICT,
      writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (runtime.crash) runtime.crash("EXPENSE_AFTER_READBACK");
  if (runtime.crash) runtime.crash("EXPENSE_BEFORE_COMMIT");
  var commit = expenseSingleCommitCommit_(operation, runtime);
  if (!commit.ok) {
    return outcome(commit.status,
      { code: commit.code, writeCount: rows, detail: commit.detail });
  }
  if (runtime.crash) runtime.crash("EXPENSE_AFTER_COMMIT");
  return outcome(save.STATUS.DONE, { writeCount: rows, entry: expenseSingleCommitEntry_(plan) });
}

// The legacy-shaped Expense DTO returned to the client on DONE.
function expenseSingleCommitEntry_(plan) {
  var timestamp = new Date(plan.transactionTimestamp);
  return {
    timestamp: Utilities.formatDate(timestamp, CANONICAL_ENTRY.TIMEZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX"),
    expenseItemId: plan.expenseItem.expenseItemId,
    item: plan.expenseItem.item,
    category: plan.expenseItem.category,
    kind: plan.expenseItem.kind,
    group: plan.expenseItem.group,
    amount: plan.amount,
    id: plan.entryID
  };
}

// Resume path: exact (OperationType, RequestKey) lookup hit. Compares the
// payload hash AND the exact persisted normalized structure; verifies the
// stored plan digest + shape; validates State; re-checks schema + stored
// bounds (no mutable master recomputation) before touching artifacts. A
// tampered or partial state fails closed with ZERO additional writes.
function expenseSingleCommitResume_(operation, hash, normalized, runtime) {
  var save = EXPENSE_SINGLE_COMMIT_V1, codes = save.CODES;
  function outcome(status, fields) {
    return expenseSingleCommitResult_(status, Object.assign({
      requestKey: normalized.requestKey, operationID: operation.OperationID || "",
      entryID: operation.BusinessID || ""
    }, fields || {}));
  }
  if (operation.OperationType !== save.OPERATION_TYPE || !operation.BusinessID ||
      operation.RequestKey !== normalized.requestKey || operation.PayloadHash !== hash) {
    return outcome(save.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT });
  }
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: "PLAN_JSON:" + error.message });
  }
  if (!plan || plan.requestKey !== normalized.requestKey || plan.payloadHash !== hash ||
      plan.operationID !== operation.OperationID || plan.entryID !== operation.BusinessID) {
    return outcome(save.STATUS.CONFLICT,
      { code: codes.OPERATION_PAYLOAD_CONFLICT, detail: "PLAN_IDENTITY_MISMATCH" });
  }
  if (!plan.normalizedPayload ||
      JSON.stringify(plan.normalizedPayload) !== JSON.stringify(normalized)) {
    return outcome(save.STATUS.CONFLICT,
      { code: codes.OPERATION_PAYLOAD_CONFLICT, detail: "NORMALIZED_PAYLOAD_MISMATCH" });
  }
  var verify = expenseSingleCommitVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason, entryID: plan.entryID || "", journalID: plan.journalID || "",
      auditID: plan.auditID || "" });
  }
  if (operation.State !== "IN_PROGRESS" && operation.State !== "COMMITTED") {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.INVALID_OPERATION_STATE, detail: "STATE:" + String(operation.State),
      entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var schema = expenseSingleCommitSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(","),
      entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var bounds = expenseSingleCommitBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail,
      entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var inspection = expenseSingleCommitInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(save.STATUS.UNKNOWN, {
      code: codes.READBACK_UNKNOWN, detail: inspection.detail,
      entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var closedCode = inspection.state === "CONFLICT" ?
    (inspection.detail.indexOf("SIGNATURE") !== -1 ?
      codes.JOURNAL_SIGNATURE_INVALID : codes.IDENTITY_CONFLICT) :
    codes.ARTIFACTS_INCOMPLETE;
  if (inspection.state === "EXACT") {
    if (operation.State === "COMMITTED") {
      // COMMITTED + exactly verified artifacts => replay DONE (response lost).
      if (runtime.crash) runtime.crash("EXPENSE_AFTER_COMMIT");
      return outcome(save.STATUS.DONE, {
        replay: true, writeCount: 0, entry: expenseSingleCommitEntry_(plan),
        entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
    }
    if (runtime.crash) runtime.crash("EXPENSE_AFTER_READBACK");
    if (runtime.crash) runtime.crash("EXPENSE_BEFORE_COMMIT");
    var commit = expenseSingleCommitCommit_(operation, runtime);
    if (!commit.ok) {
      return outcome(commit.status, {
        code: commit.code, detail: commit.detail,
        entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
    }
    if (runtime.crash) runtime.crash("EXPENSE_AFTER_COMMIT");
    return outcome(save.STATUS.DONE, {
      replay: true, writeCount: 0, entry: expenseSingleCommitEntry_(plan),
      entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (operation.State === "COMMITTED") {
    // COMMITTED without exact artifacts: fail closed, no repair, no rewrite.
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: closedCode, detail: inspection.detail,
      entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (inspection.state === "NONE") {
    // Intent-only: recover from the stored frozen plan exactly once.
    return expenseSingleCommitApplyBatch_(plan, operation, runtime);
  }
  // Partial or conflicting uncommitted artifacts: fail closed, never append.
  return outcome(save.STATUS.RECOVERY_REQUIRED, {
    code: closedCode, detail: inspection.detail,
    entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
}

// New-intent path (outer lock held, lookup returned absent). Every gate is
// re-validated inside the lock immediately before plan freeze; every refusal
// writes zero and no legacy fallback exists on any refusal path.
function expenseSingleCommitNewIntent_(normalized, hash, runtime) {
  var save = EXPENSE_SINGLE_COMMIT_V1, codes = save.CODES;
  function outcome(status, fields) {
    return expenseSingleCommitResult_(status,
      Object.assign({ requestKey: normalized.requestKey }, fields || {}));
  }
  var gate = runtime.gate || expenseSingleCommitGate_(runtime);
  if (gate.mode !== "ACTIVE") {
    return outcome(save.STATUS.REFUSED, { code: gate.code || codes.PAYLOAD_INVALID,
      detail: gate.detail || "SINGLE_COMMIT_NOT_ACTIVE" });
  }
  var schema = expenseSingleCommitSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(save.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(",") });
  }
  var accountRows;
  try {
    accountRows = readCanonicalTable(runtime.spreadsheet, "Accounts",
      CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  } catch (error) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: "ACCOUNTS:" + error.message });
  }
  // T11.2 §11: 1040 preflight BEFORE any business mutation. Absent, duplicate,
  // inactive or metadata-inconsistent => REFUSED zero writes. No fallback to
  // 1000/1010/1020/1030/2000 and no name-inferred account.
  var moneyPreflight = preflightSingleCommitMoneyAccount(accountRows);
  if (moneyPreflight.status !== "PASS") {
    var moneyError = moneyPreflight.errors[0] || {};
    return outcome(save.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED,
      field: moneyError.accountCode || save.MONEY_ACCOUNT_CODE,
      detail: "MONEY_ACCOUNT_PREFLIGHT_FAILED:" + String(moneyError.code || "") });
  }
  var now = runtime.now();
  var timestamp = normalized.expenseDate ?
    new Date(normalized.expenseDate + "T00:00:00+07:00") : now;
  // Business authority: ExpenseItems master -> authoritative debit account
  // (backend mapping, D7) + active account evidence. Never display-name based.
  var items = runtime.items || readCanonicalTable(runtime.spreadsheet,
    "ExpenseItems", EXPENSE_SINGLE_COMMIT_V1.ITEM_HEADERS);
  var entry;
  try {
    entry = prepareCanonicalExpenseEntry(normalized, {
      timestamp: timestamp,
      expenseItems: items,
      accounts: accountRows
    });
  } catch (error) {
    return outcome(save.STATUS.REFUSED, {
      code: error.expenseSingleCommitCode || error.entryCode || codes.PAYLOAD_INVALID,
      field: error.entryField || error.field || "expenseItemId",
      detail: error.message });
  }
  var itemRow = items.filter(function(row) {
    return String(row.ID_Ops).trim() === entry.expenseItemId;
  })[0];
  var expenseAccountCode = itemRow ? String(itemRow.AccountCode || "").trim() : "";
  if (!expenseAccountCode) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.ACCOUNT_PREFLIGHT_FAILED, field: "expenseItemId",
        detail: "EXPENSE_ACCOUNT_CODE_MISSING" });
  }
  var expenseAccount = buildCanonicalMasterMap(accountRows, "AccountCode", "Accounts")[
    expenseAccountCode];
  if (!expenseAccount || !isCanonicalActive(expenseAccount.IsActive)) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.ACCOUNT_PREFLIGHT_FAILED, field: expenseAccountCode,
        detail: "EXPENSE_ACCOUNT_INACTIVE" });
  }
  // Deterministic identity: (OperationType, RequestKey) -> operation; the
  // business ID keeps the exact legacy OPS-APP-<date>-<token> shape.
  var tabopsSheet = runtime.spreadsheet.getSheetByName("tabops");
  var entryID = generateCanonicalEntryId("OPS-APP-", timestamp, runtime.uuid,
    function(candidate) { return canonicalSheetHasId(tabopsSheet, candidate); });
  var operationID = transactionOperationID_(save.OPERATION_TYPE, normalized.requestKey);
  var auditID = "LOG-ENTRY-" + runtime.uuid();
  var plan;
  try {
    plan = expenseSingleCommitPlan_({
      normalized: normalized, hash: hash, entry: entry, entryID: entryID,
      operationID: operationID, auditID: auditID, actor: runtime.actor(),
      now: now, timestamp: timestamp, expenseAccountCode: expenseAccountCode
    });
  } catch (error) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, detail: "PLAN_BUILD:" + error.message });
  }
  var verify = expenseSingleCommitVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(save.STATUS.REFUSED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason });
  }
  var bounds = expenseSingleCommitBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail });
  }
  if (runtime.crash) runtime.crash("EXPENSE_BEFORE_INTENT");
  var operation;
  try {
    operation = transactionResolveOperation_(runtime.repository, save.OPERATION_TYPE,
      normalized.requestKey, hash, entryID, plan, runtime.now());
  } catch (error) {
    return outcome(error.code === "OPERATION_PAYLOAD_CONFLICT" ?
      save.STATUS.CONFLICT : save.STATUS.RECOVERY_REQUIRED, {
      code: error.code === "OPERATION_PAYLOAD_CONFLICT" ?
        codes.OPERATION_PAYLOAD_CONFLICT : codes.DUPLICATE_OPERATION_EVIDENCE,
      detail: error.message, entryID: entryID, journalID: plan.journalID,
      auditID: plan.auditID });
  }
  if (runtime.crash) runtime.crash("EXPENSE_AFTER_INTENT_PERSIST");
  // Exact readback of all ten operation fields (Date-safe) BEFORE any
  // business write.
  var readback = null;
  try { readback = runtime.repository.findOperation(save.OPERATION_TYPE, normalized.requestKey); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.INTENT_READBACK_FAILED, detail: "INTENT_READBACK_FAILED:" + error.message,
      entryID: entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (!readback) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.INTENT_READBACK_FAILED, detail: "INTENT_ROW_MISSING",
      entryID: entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (readback.State !== "IN_PROGRESS" ||
      !expenseSingleCommitFieldsExact_(readback, operation,
        TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS)) {
    var mismatch = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS.filter(function(header) {
      return !expenseSingleCommitFieldEqual_(readback[header], operation[header]);
    });
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.INTENT_READBACK_FAILED, detail: "INTENT_ROW_MISMATCH:" + mismatch.join(","),
      entryID: entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (runtime.crash) runtime.crash("EXPENSE_AFTER_INTENT");
  return expenseSingleCommitApplyBatch_(plan, operation, runtime);
}

// Durable save core. Fixed order: normalize -> exact (OperationType,
// RequestKey) lookup BEFORE any mutable master read -> resume or new intent.
// Never acquires a lock (the dispatcher owns the single outer ScriptLock).
function expenseSingleCommitSaveWithRuntime_(payload, runtime) {
  var save = EXPENSE_SINGLE_COMMIT_V1, codes = save.CODES;
  var normalized;
  try { normalized = expenseSingleCommitNormalize_(payload); }
  catch (error) {
    return expenseSingleCommitResult_(save.STATUS.REFUSED, {
      code: error.expenseSingleCommitCode || codes.PAYLOAD_INVALID,
      requestKey: expenseSingleCommitPayloadKey_(payload),
      field: error.field || "", detail: error.message });
  }
  var existing = null;
  try {
    existing = runtime.repository.findOperation(save.OPERATION_TYPE, normalized.requestKey);
  } catch (error) {
    return expenseSingleCommitResult_(save.STATUS.RECOVERY_REQUIRED, {
      code: error && error.message === "DUPLICATE_OPERATION" ?
        codes.DUPLICATE_OPERATION_EVIDENCE : codes.IDENTITY_CONFLICT,
      requestKey: normalized.requestKey,
      detail: error && error.message ? error.message : "" });
  }
  var hash = transactionPayloadHash_(normalized);
  var result = existing ?
    expenseSingleCommitResume_(existing, hash, normalized, runtime) :
    expenseSingleCommitNewIntent_(normalized, hash, runtime);
  // Post-commit freshness: ONLY a DONE result (fresh commit or COMMITTED
  // replay) may invalidate the shared dashboard cache. Ephemeral best-effort
  // maintenance: never retried, never allowed to contradict the durable DONE.
  if (result.status === save.STATUS.DONE && typeof runtime.invalidate === "function") {
    try { runtime.invalidate(); }
    catch (cacheError) {
      Logger.log("Expense single-commit post-commit cache invalidation skipped: " +
        String(cacheError && cacheError.message || cacheError));
    }
  }
  return result;
}

// Resolve the three write-surface sheetIds from spreadsheet metadata
// (read-only). A missing sheetId throws BEFORE the batchUpdate is issued:
// atomic rejection, no partial batch.
function expenseSingleCommitSheetIdsRequest_() {
  var save = EXPENSE_SINGLE_COMMIT_V1;
  var response = inventoryReceiptMigrationRequest_("get",
    "?fields=" + encodeURIComponent("spreadsheetId,sheets.properties(sheetId,title)"));
  if (!response || response.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) {
    throw new Error("PRODUCTION_IDENTITY_MISMATCH");
  }
  var ids = {};
  (response.sheets || []).forEach(function(sheet) {
    var properties = sheet && sheet.properties;
    if (properties && save.WRITE_SURFACES.indexOf(properties.title) !== -1 &&
        typeof properties.sheetId === "number") {
      ids[properties.title] = properties.sheetId;
    }
  });
  var missing = save.WRITE_SURFACES.filter(function(name) { return typeof ids[name] !== "number"; });
  if (missing.length) throw new Error("SHEET_ID_UNAVAILABLE:" + missing.join(","));
  return ids;
}

// ONE Sheets REST mutation: spreadsheets.batchUpdate with exactly three
// appendCells subrequests over the Expense write surfaces, reusing the
// sanitized migration transport (43). The single batchUpdate is atomic (all
// three subrequests or none); intent/batch/readback/commit remain multistep —
// no database-global atomicity is claimed.
function expenseSingleCommitBatchRequest_(valueRanges) {
  var sheetIds = expenseSingleCommitSheetIdsRequest_();
  var body = expenseSingleCommitBatchBody_(valueRanges, sheetIds);
  return inventoryReceiptMigrationRequest_("post", ":batchUpdate", body);
}

// Dispatcher seam: builds the core runtime from the already-locked context and
// maps the envelope. An unexpected failure AFTER a durable intent may exist is
// UNKNOWN (identity preserved), never a definite failure.
function expenseSingleCommitDispatch_(payload, ss, dispatcherRuntime, items, gate) {
  var save = EXPENSE_SINGLE_COMMIT_V1;
  var core;
  try {
    core = expenseSingleCommitCoreRuntime_(ss, dispatcherRuntime, items, gate);
  } catch (error) {
    return expenseSingleCommitEnvelope_(expenseSingleCommitResult_(save.STATUS.REFUSED, {
      code: save.CODES.SCHEMA_NOT_READY, requestKey: expenseSingleCommitPayloadKey_(payload),
      detail: "RUNTIME_UNAVAILABLE:" + String(error && error.message || error) }));
  }
  try {
    return expenseSingleCommitEnvelope_(expenseSingleCommitSaveWithRuntime_(payload, core));
  } catch (error) {
    // Unknown only after a durable intent may exist: retain the request
    // identity AND resolve the operation linkage read-only so the client can
    // re-check the SAME intent instead of minting a new one.
    var identity = { requestKey: expenseSingleCommitPayloadKey_(payload), operationID: "" };
    try {
      var pending = core.repository.findOperation(save.OPERATION_TYPE, identity.requestKey);
      if (pending) identity.operationID = pending.OperationID;
    } catch (lookupError) { /* requestKey remains the recoverable identity */ }
    return expenseSingleCommitEnvelope_(expenseSingleCommitResult_(save.STATUS.UNKNOWN,
      Object.assign({
        code: save.CODES.SAVE_EXECUTION_UNKNOWN,
        detail: String(error && error.message || error)
      }, identity)));
  }
}
