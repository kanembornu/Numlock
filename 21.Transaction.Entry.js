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
  var purchases = expenses.filter(function(e) { return e.purchaseRequired; })
    .map(function(e) { return { expenseItemId: e.expenseItemId, item: e.item, category: e.category, group: e.group, kind: e.kind, uom: "" }; });
  return { sales: sales, expenses: expenses, purchases: purchases };
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
      if (expenseGate.mode === "REFUSE") {
        // U5 (T11.2 §22 recovery): admission mode is NEVER re-evaluated for a
        // persisted single-commit operation. Before the fail-closed refusal,
        // probe the operation store by exact (OperationType, RequestKey); a
        // hit routes into the core lookup-first resume path (stored immutable
        // plan, artifact verification, zero admission gate). No hit -> the
        // refusal stands with zero writes. ABSENT/PREPARED-never-activated
        // never probes (no single-commit operation can exist without
        // activation), so the legacy path stays byte-identical.
        var recoveryType = expenseSingleCommitRecoveryRoute_(payload, ss, runtime, expenseGate);
        if (recoveryType === EXPENSE_SINGLE_COMMIT_V1.OPERATION_TYPE) {
          return expenseSingleCommitDispatch_(payload, ss, runtime, null, expenseGate);
        }
        if (recoveryType === PURCHASE_SINGLE_COMMIT_V1.OPERATION_TYPE) {
          return purchaseSingleCommitDispatch_(payload, ss, runtime, null, expenseGate);
        }
        return expenseSingleCommitRefusal_(expenseGate);
      }
      if (expenseGate.mode === "ACTIVE") {
        expensePreResolvedItems = readCanonicalTable(ss, "ExpenseItems",
          ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]);
        var expensePreRoute = resolveExpensePurchasePolicy_(payload && payload.expenseItemId,
          expensePreResolvedItems);
        // T11.5 U3 — an ACTIVE Purchase-routed item now converges into the
        // PURCHASE_SINGLE_COMMIT_SAVE core (T11.2 §5): the legacy cash gate,
        // the separate postPolicyCPurchaseEvent_ accounting step and the
        // PURCHASE_PENDING multistep are unreachable from the ACTIVE path.
        // ABSENT/PREPARED keeps the exact legacy purchase route below.
        if (expensePolicyIsPurchase_(expensePreRoute)) {
          return purchaseSingleCommitDispatch_(payload, ss, runtime, expensePreResolvedItems, expenseGate);
        }
        return expenseSingleCommitDispatch_(payload, ss, runtime, expensePreResolvedItems, expenseGate);
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

// U5 recovery-before-admission probe (T11.2 §22): exact (OperationType,
// RequestKey) lookup against the operation store while the config gate has
// REFUSED (PAUSED / REJECT / invalid / sticky PREPARED). Returns the matching
// operation type ("EXPENSE_SINGLE_COMMIT_SAVE" or "PURCHASE_SINGLE_COMMIT_SAVE")
// so the dispatcher can route into the core resume path, or "" for a plain
// refusal. Read-only, zero writes, fail-closed on any lookup error.
function expenseSingleCommitRecoveryRoute_(payload, ss, dispatcherRuntime, gate) {
  var key = expenseSingleCommitPayloadKey_(payload);
  if (!key) return "";
  try {
    var core = expenseSingleCommitCoreRuntime_(ss, dispatcherRuntime, null, gate);
    var operation = core.repository.findOperation(
      EXPENSE_SINGLE_COMMIT_V1.OPERATION_TYPE, key) ||
      core.repository.findOperation(PURCHASE_SINGLE_COMMIT_V1.OPERATION_TYPE, key);
    return operation ? String(operation.OperationType) : "";
  } catch (error) {
    return "";
  }
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

// T11.8/U6 original-content equality for the business row: the original's
// content is immutable, and the ONLY tolerated delta after a committed
// correction is the canonical lifecycle marker (IsActive true -> false with
// UpdatedAt/UpdatedBy). Any other field change is tampering.
function expenseSingleCommitBusinessContentEqual_(actual, expected) {
  var expectedActive = isCanonicalActive(expected.IsActive);
  var actualActive = isCanonicalActive(actual.IsActive);
  var lifecycleFlipped = expectedActive && !actualActive;
  var contentEqual = CANONICAL_ENTRY.EXPENSE_HEADERS.every(function(header) {
    if (lifecycleFlipped && (header === "IsActive" || header === "UpdatedAt" ||
        header === "UpdatedBy")) {
      return true;
    }
    return expenseSingleCommitFieldEqual_(actual[header], expected[header]);
  });
  return contentEqual && (actualActive === expectedActive || lifecycleFlipped);
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
  // T11.8/U6: a committed EXPENSE_SINGLE_COMMIT_VOID/CORRECT appends its
  // mirror journal under the SAME (SourceType, SourceID) with the dedicated
  // reversal JournalID EXPJV-<ID_Trx>. That legitimate sibling is owned by the
  // correction operation's plan, not this save plan, so the save's
  // source-set identity check excludes exactly that journal — replay of the
  // committed save stays zero-write after a later cancel/correct, while any
  // other foreign journal still fails closed.
  var reversalJournalID = EXPENSE_SINGLE_COMMIT_CORRECTION.JOURNAL_ID_PREFIX +
    plan.entryID;
  var journalBySource = ledger.filter(function(row) {
    return String(row.SourceType) === plan.sourceType &&
      String(row.SourceID) === plan.entryID &&
      String(row.JournalID) !== reversalJournalID;
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
    if (!expenseSingleCommitBusinessContentEqual_(businessMatches[0], plan.businessRow)) {
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

// ---------------------------------------------------------------------------
// T11.5 U3 — PURCHASE_SINGLE_COMMIT_SAVE durable core (T11.2 §5/§6/§7/§8/§9).
//
// ONE normal Purchase intent -> ONE immutable plan -> ONE atomic
// spreadsheets.batchUpdate [PurchaseEvents, BalanceLedger(2), Logs] -> DONE.
// The legacy split (event append with AccountingStatus=PENDING -> separate
// postPolicyCPurchaseEvent_ ledger append -> AccountingStatus update -> possible
// PURCHASE_PENDING / AP SETTLEMENT_PENDING) is unreachable from this path: the
// event row is FINAL at append (PaymentStatus=PAID, CashAccountCode=1040,
// AccountingStatus=POSTED per Policy C prospective Dr6210/Cr1040), no payment
// channel is requested or accepted, no Cr2000, no AP lifecycle, no Treasury
// workflow, no Inventory authority. Inert unless the frozen
// SINGLE_COMMIT_TRANSACTION_V1 config resolves ACTIVE; ABSENT/PREPARED keeps
// the legacy purchase writer byte-for-byte, PAUSED/REJECT/invalid fail closed.
//
// The dispatcher (or the operational adapter's own single outer lock) owns the
// single outer ScriptLock; this core never locks, so no nested lock is
// possible. Intent, batch, readback and commit remain multistep: only the
// single batchUpdate is atomic.
// ---------------------------------------------------------------------------
var PURCHASE_SINGLE_COMMIT_V1 = Object.freeze({
  OPERATION_TYPE: "PURCHASE_SINGLE_COMMIT_SAVE",
  PLAN_VERSION: 1,
  // The ONLY surfaces the single batch may ever touch. Payments, Settlements,
  // TreasuryReceipts, InventoryReceipts, InventoryLedger, Cash, Fulfillment,
  // Accounts, tabops and AccountsPayable writes are forbidden artifacts.
  WRITE_SURFACES: Object.freeze(["PurchaseEvents", "BalanceLedger", "Logs"]),
  // Policy C prospective journal identity (T11.2 §5): reuses the frozen
  // Policy C shape with the credit side frozen to 1040 for the normal flow.
  JOURNAL_ID_PREFIX: "POLICYC-PEXP-PURCHASE-",
  EVENT_ID_PREFIX: "PE-",
  RECOVERY_KEY_PREFIX: "pe-receipt-",
  MOVEMENT_TYPE: "PURCHASE_RECOGNITION",
  SOURCE_TYPE: "PURCHASE_EVENT",
  DEBIT_ACCOUNT_CODE: "6210",
  MONEY_ACCOUNT_CODE: "1040",
  // PurchaseEvent final state, backend-derived, written directly in the append:
  // paid-at-Save (D4/D8). NEVER operator choices.
  PAYMENT_STATUS: "PAID",
  ACCOUNTING_STATUS: "POSTED",
  REGIME: "PROSPECTIVE_PURCHASE_EXPENSE",
  AUDIT_MODULE: "TransactionEntry",
  AUDIT_ACTION: "CREATE_PURCHASE",
  // NOTE: the PurchaseEvents headers live in PURCHASE_EVENT_POLICY (47) and
  // are referenced lazily at call time — Apps Script evaluates top-level
  // initializers in filename order, so 21 must never dereference 47 at load.
  ITEM_HEADERS: Object.freeze(["ID_Ops", "Item", "Kategori", "Kind", "Group",
    "AccountCode", "IsActive"]),
  // Strict normalizer allowlist. cashAccountCode is tolerated only as an
  // ABSENT value: the shared legacy-shaped clients always carry payment
  // fields, and any explicit channel/payment selection is refused on the
  // ACTIVE path (D1/D2/D4/D8). supplierID is OPTIONAL business metadata
  // (D9); it never appears in the history-readable NormalizedPayload.
  ALLOWED_FIELDS: Object.freeze(["transactionType", "requestKey", "expenseItemId",
    "input", "supplierID", "cashAccountCode"]),
  PAYMENT_FIELDS: Object.freeze(["paidVia", "paymentMethod", "PaymentMethod",
    "paymentStatus", "PaymentStatus", "receiveVia", "ReceiveVia",
    "destination", "destinationAccountCode", "evidenceRef", "EvidenceRef",
    "settlementId", "SettlementID", "cashAccount", "treasuryReceipt",
    "evidenceType", "paymentID", "PaymentID", "supplierId"]),
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
    PAYLOAD_INVALID: "PURCHASE_SINGLE_COMMIT_PAYLOAD_INVALID",
    PAYMENT_FIELD_REFUSED: "PURCHASE_SINGLE_COMMIT_PAYMENT_FIELD_REFUSED",
    FIELD_REFUSED: "PURCHASE_SINGLE_COMMIT_FIELD_REFUSED",
    SCHEMA_NOT_READY: "PURCHASE_SINGLE_COMMIT_SCHEMA_NOT_READY",
    OPERATION_PAYLOAD_CONFLICT: "OPERATION_PAYLOAD_CONFLICT",
    DUPLICATE_OPERATION_EVIDENCE: "DUPLICATE_OPERATION_EVIDENCE",
    BATCH_BOUNDS_EXCEEDED: "PURCHASE_SINGLE_COMMIT_BATCH_BOUNDS_EXCEEDED",
    ARTIFACTS_INCOMPLETE: "PURCHASE_SINGLE_COMMIT_ARTIFACTS_INCOMPLETE",
    IDENTITY_CONFLICT: "PURCHASE_SINGLE_COMMIT_IDENTITY_CONFLICT",
    PLAN_MALFORMED: "PURCHASE_SINGLE_COMMIT_PLAN_MALFORMED",
    INTENT_READBACK_FAILED: "PURCHASE_SINGLE_COMMIT_INTENT_READBACK_FAILED",
    BATCH_OUTCOME_UNKNOWN: "PURCHASE_SINGLE_COMMIT_BATCH_OUTCOME_UNKNOWN",
    READBACK_UNKNOWN: "PURCHASE_SINGLE_COMMIT_READBACK_UNKNOWN",
    COMMIT_OUTCOME_UNKNOWN: "PURCHASE_SINGLE_COMMIT_COMMIT_OUTCOME_UNKNOWN",
    SAVE_EXECUTION_UNKNOWN: "PURCHASE_SINGLE_COMMIT_SAVE_EXECUTION_UNKNOWN",
    INVALID_OPERATION_STATE: "PURCHASE_SINGLE_COMMIT_INVALID_OPERATION_STATE",
    ACCOUNT_PREFLIGHT_FAILED: "PURCHASE_SINGLE_COMMIT_ACCOUNT_PREFLIGHT_FAILED",
    JOURNAL_SIGNATURE_INVALID: "PURCHASE_SINGLE_COMMIT_JOURNAL_SIGNATURE_INVALID",
    REGIME_NOT_PROSPECTIVE: "PURCHASE_SINGLE_COMMIT_REGIME_NOT_PROSPECTIVE",
    SUPPLIER_INVALID: "PURCHASE_SINGLE_COMMIT_SUPPLIER_INVALID"
  })
});

// Envelope result. NEVER a { success: false } DTO without identity: UNKNOWN /
// RECOVERY_REQUIRED retain requestKey + operation linkage so an uncertain
// outcome can never collapse into a definite loss of identity.
function purchaseSingleCommitResult_(status, fields) {
  return Object.assign({
    status: status, code: "", requestKey: "", operationID: "", entryID: "",
    journalID: "", auditID: "", writeCount: 0, replay: false, field: "",
    detail: "", entry: null
  }, fields || {});
}

function purchaseSingleCommitError_(code, field, message) {
  var error = new Error(message || code);
  error.purchaseSingleCommitCode = code;
  error.field = field || "";
  return error;
}

// Zero-write refusal envelope for a gate that refuses before any read/write.
function purchaseSingleCommitRefusal_(gate) {
  var result = purchaseSingleCommitResult_(PURCHASE_SINGLE_COMMIT_V1.STATUS.REFUSED,
    { code: gate.code, detail: gate.detail || "", writeCount: 0 });
  return purchaseSingleCommitEnvelope_(result);
}

// Dispatcher-shaped envelope. DONE carries the legacy Purchase DTO contract the
// existing clients expect (success + status OPERATIONAL_POSTED + projected
// event data); every non-DONE status keeps the legacy
// { success:false, status, reason, writeCount } shape with `unknown: true`
// added only for UNKNOWN so the client never renders a definite failure for an
// unresolved outcome. `accountingPending` is never set; AccountingStatus on
// the event row is POSTED by the batch itself.
function purchaseSingleCommitEnvelope_(result) {
  var save = PURCHASE_SINGLE_COMMIT_V1;
  var envelope = {
    status: result.status,
    code: result.code,
    reason: result.status === save.STATUS.DONE ? null : (result.detail || result.code || result.status),
    writeCount: result.writeCount,
    requestKey: result.requestKey,
    operationID: result.operationID,
    eventId: result.entryID,
    journalID: result.journalID,
    accountingStatus: result.status === save.STATUS.DONE ? save.ACCOUNTING_STATUS : undefined
  };
  if (result.status === save.STATUS.DONE) {
    envelope.success = true;
    envelope.status = "OPERATIONAL_POSTED";
    envelope.data = result.entry;
    envelope.accountingStatus = save.ACCOUNTING_STATUS;
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
// Config gate (T11.2 §20). Read-only: resolves SINGLE_COMMIT_TRANSACTION_V1
// once per new dispatch, exactly like the Expense/Sales gates. ABSENT/PREPARED
// => LEGACY (today's writer, byte identical); ACTIVE => the single-commit
// core; PAUSED => fail closed; REJECT or an unresolved value => fail closed.
// Never a silent legacy fallback.
// ---------------------------------------------------------------------------
function purchaseSingleCommitGate_(runtime) {
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

// ---------------------------------------------------------------------------
// Pure input normalization (T11.2 §17 minimum input). Definite refusals fail
// here before any read or write. The receipt-path evidence semantics
// (SupplierSource + Attested + ExternalRef/ExternalDocumentStatus pairing,
// 47:151-155) are reused VERBATIM through the history-compatible normalizer,
// so every produced NormalizedPayload round-trips through
// purchaseEventHistory_ (the transaction-history read path) byte-exactly.
// supplierID (D9) is OPTIONAL: validated later against the supplier master
// when supplied, never failing solely on absence, and never persisted into
// the history-readable NormalizedPayload (a PAID event with a supplierId
// payment-authority key is a legacy CONFLICTING_PAYMENT_AUTHORITY shape).
// ---------------------------------------------------------------------------
function purchaseSingleCommitNormalize_(payload) {
  var save = PURCHASE_SINGLE_COMMIT_V1, codes = save.CODES;
  var p = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  var keys = Object.keys(p);
  var payment = keys.filter(function(key) {
    return save.PAYMENT_FIELDS.indexOf(key) !== -1 && p[key] !== undefined &&
      p[key] !== null && String(p[key]).trim() !== "";
  });
  if (payment.length) {
    throw purchaseSingleCommitError_(codes.PAYMENT_FIELD_REFUSED, payment[0],
      "PAYMENT_FIELD_REFUSED:" + payment.join(","));
  }
  var unknown = keys.filter(function(key) {
    return save.ALLOWED_FIELDS.indexOf(key) === -1;
  });
  if (unknown.length) {
    throw purchaseSingleCommitError_(codes.FIELD_REFUSED, unknown[0],
      "FIELD_REFUSED:" + unknown.join(","));
  }
  // The legacy-shaped clients always carry cashAccountCode; on the ACTIVE path
  // it must be absent. An explicit channel selection is refused, never
  // silently dropped (D1/D2/D8).
  var cash = p.cashAccountCode;
  if (cash !== undefined && cash !== null && String(cash).trim() !== "") {
    throw purchaseSingleCommitError_(codes.PAYMENT_FIELD_REFUSED, "cashAccountCode",
      "CASH_ACCOUNT_REFUSED");
  }
  if (String(p.transactionType === undefined || p.transactionType === null ?
      "" : p.transactionType) !== "EXPENSE") {
    throw purchaseSingleCommitError_(codes.PAYLOAD_INVALID, "transactionType",
      "TRANSACTION_TYPE_MUST_BE_EXPENSE");
  }
  var supplierID = p.supplierID === undefined || p.supplierID === null ?
    "" : String(p.supplierID).trim();
  var normalized;
  try {
    // allowLegacyPaymentStatus=true: the payment-authority KEYS are simply
    // absent from the constructed payload, so no payment validation runs and
    // the output is the exact history-compatible structure.
    normalized = normalizePurchaseEventRequestWithCompatibility_({
      transactionType: "EXPENSE", requestKey: p.requestKey,
      expenseItemId: p.expenseItemId, input: p.input
    }, true);
  } catch (error) {
    throw purchaseSingleCommitError_(codes.PAYLOAD_INVALID, "input", error.message);
  }
  // T11.2 §17: Qty + purchase UOM are REQUIRED business facts for the normal
  // Purchase (the legacy "blank quantity" compatibility path stays legacy-only).
  if (!normalized.input.PurchaseQty || !normalized.input.PurchaseUOM) {
    throw purchaseSingleCommitError_(codes.PAYLOAD_INVALID, "input",
      "PURCHASE_QUANTITY_UOM_REQUIRED");
  }
  return { requestKey: normalized.requestKey, expenseItemId: normalized.expenseItemId,
    supplierID: supplierID, input: normalized.input };
}

// The exact history-compatible NormalizedPayload subset persisted in the
// PurchaseEvent row (no payment keys, no supplierID): key order is the frozen
// normalizePurchaseEventRequestWithCompatibility_ construction order, so
// purchaseEventHistory_ round-trips it byte-exactly.
function purchaseSingleCommitEventPayload_(normalized) {
  return { transactionType: "EXPENSE", requestKey: normalized.requestKey,
    expenseItemId: normalized.expenseItemId, input: normalized.input };
}

function purchaseSingleCommitPayloadKey_(payload) {
  return payload && payload.requestKey !== undefined && payload.requestKey !== null ?
    String(payload.requestKey) : "";
}

// ---------------------------------------------------------------------------
// Zero-write schema gate: every surface the save reads or writes must exist
// with its exact canonical headers before anything else is attempted. Header
// reads only; never recomputes mutable master rows. Re-run on resume.
// ---------------------------------------------------------------------------
function purchaseSingleCommitSchemaGate_(ss) {
  var exact = [
    ["PurchaseEvents", PURCHASE_EVENT_POLICY.headers],
    ["Logs", CANONICAL_ENTRY.LOG_HEADERS],
    ["BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS],
    [TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.SHEET, TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS]
  ];
  var present = [
    ["Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS],
    ["ExpenseItems", PURCHASE_SINGLE_COMMIT_V1.ITEM_HEADERS],
    ["Suppliers", SUPPLIER_MASTER_CONTRACT.HEADERS]
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

// Core runtime assembled from the already-locked context. The
// `purchaseSingleCommit` object on the runtime is the local fixture seam
// (repository / batch / crash); production defaults are read-only transport
// factories.
function purchaseSingleCommitCoreRuntime_(ss, dispatcherRuntime, items, gate) {
  var seam = dispatcherRuntime && dispatcherRuntime.purchaseSingleCommit || {};
  return {
    spreadsheet: ss,
    now: dispatcherRuntime.now,
    uuid: dispatcherRuntime.uuid,
    flush: dispatcherRuntime.flush,
    invalidate: dispatcherRuntime.invalidate,
    items: items,
    gate: gate,
    batch: seam.batch || purchaseSingleCommitBatchRequest_,
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
// Immutable OperationPlan freeze (T11.2 §7): the exact PurchaseEvent row
// (backend-derived PaymentStatus=PAID, CashAccountCode=1040,
// AccountingStatus=POSTED written directly in the append), the Policy C
// journal pair (Dr6210 / Cr1040), the audit row, the journal signature and a
// canonical integrity digest — derived once. The plan is the single source of
// truth for every later step; no mutable master is re-read after freeze.
// ---------------------------------------------------------------------------
function purchaseSingleCommitPlan_(input) {
  var save = PURCHASE_SINGLE_COMMIT_V1;
  var normalized = input.normalized, now = input.now, nowISO = now.toISOString();
  var timestamp = input.timestamp, actor = input.actor;
  var eventID = save.EVENT_ID_PREFIX + normalized.requestKey;
  var journalID = save.JOURNAL_ID_PREFIX + eventID;
  var amount = Number(normalized.input.AcquisitionValue);
  var economicDate = input.economicDate;
  var eventPayload = purchaseSingleCommitEventPayload_(normalized);
  var eventRow = {
    EventID: eventID,
    ExpenseID: normalized.expenseItemId,
    BusinessLabel: input.itemLabel,
    PolicyVersion: input.policyVersion,
    PolicyRevision: input.policyRevision,
    CostType: input.route.CostType,
    PurchaseRelationship: input.route.PurchaseRelationship,
    ExpenseDate: normalized.input.ExpenseDate,
    ReceiptDate: normalized.input.ReceiptDate,
    PurchaseQty: normalized.input.PurchaseQty,
    PurchaseUOM: normalized.input.PurchaseUOM,
    AcquisitionValue: normalized.input.AcquisitionValue,
    SupplierSource: normalized.input.SupplierSource,
    ExternalRef: normalized.input.ExternalRef || '',
    ExternalDocumentStatus: normalized.input.ExternalDocumentStatus || (normalized.input.ExternalRef ? 'AVAILABLE' : 'EXTERNAL_DOCUMENT_UNAVAILABLE'),
    Attestation: JSON.stringify({ attested: normalized.input.Attested === true,
      conversionEvidenceConfirmed: normalized.input.ConversionEvidenceConfirmed === true }),
    AllocationStatus: input.allocationStatus,
    RequestKey: normalized.requestKey,
    NormalizedPayload: JSON.stringify(eventPayload),
    ReceiptPlan: "null",
    Lifecycle: PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL,
    RecoveryKey: save.RECOVERY_KEY_PREFIX + normalized.requestKey,
    CreatedAt: nowISO,
    CreatedBy: actor,
    IsActive: true,
    PaymentStatus: save.PAYMENT_STATUS,
    CashAccountCode: save.MONEY_ACCOUNT_CODE,
    SupplierID: normalized.supplierID,
    AccountingStatus: save.ACCOUNTING_STATUS
  };
  var journalRows = [
    { JournalID: journalID, LineID: journalID + "-1", Tanggal: economicDate,
      AccountCode: save.DEBIT_ACCOUNT_CODE, Debit: amount, Credit: 0,
      MovementType: save.MOVEMENT_TYPE, SourceType: save.SOURCE_TYPE,
      SourceID: eventID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor },
    { JournalID: journalID, LineID: journalID + "-2", Tanggal: economicDate,
      AccountCode: save.MONEY_ACCOUNT_CODE, Debit: 0, Credit: amount,
      MovementType: save.MOVEMENT_TYPE, SourceType: save.SOURCE_TYPE,
      SourceID: eventID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: actor, UpdatedAt: nowISO, UpdatedBy: actor }
  ];
  var journalSignature = policyCJournalSignature_(journalRows);
  var auditRow = {
    ID_Log: input.auditID,
    Timestamp: timestamp,
    Level: "INFO",
    Module: save.AUDIT_MODULE,
    Action: save.AUDIT_ACTION,
    RecordID: eventID,
    User: CANONICAL_ENTRY.USER,
    Message: "Purchase single-commit recorded.",
    Metadata: JSON.stringify({ source: CANONICAL_ENTRY.SOURCE, ledger: "PurchaseEvents",
      journalID: journalID })
  };
  var plan = {
    planVersion: save.PLAN_VERSION,
    operationType: save.OPERATION_TYPE,
    operationID: input.operationID,
    requestKey: normalized.requestKey,
    payloadHash: input.hash,
    normalizedPayload: normalized,
    eventNormalizedPayload: eventPayload,
    entryID: eventID,
    journalID: journalID,
    auditID: input.auditID,
    actor: actor,
    savedAt: nowISO,
    transactionTimestamp: timestamp,
    economicDate: economicDate,
    expenseDate: normalized.input.ExpenseDate,
    amount: amount,
    supplierID: normalized.supplierID,
    expenseItem: {
      expenseItemId: normalized.expenseItemId,
      item: input.itemLabel,
      category: input.category,
      kind: input.kind,
      group: input.group,
      costType: input.route.CostType,
      purchaseRelationship: input.route.PurchaseRelationship,
      inventoryItemIds: (input.route.inventoryItemIds || []).slice()
    },
    accounts: { purchase: save.DEBIT_ACCOUNT_CODE, money: save.MONEY_ACCOUNT_CODE },
    regime: save.REGIME,
    paymentStatus: save.PAYMENT_STATUS,
    cashAccountCode: save.MONEY_ACCOUNT_CODE,
    accountingStatus: save.ACCOUNTING_STATUS,
    movementType: save.MOVEMENT_TYPE,
    sourceType: save.SOURCE_TYPE,
    journalSignature: journalSignature,
    eventRow: eventRow,
    journalRows: journalRows,
    auditRow: auditRow
  };
  plan.planDigest = transactionPayloadHash_(plan);
  return plan;
}

// Plan integrity + shape invariants. Runs at freeze time (definite REFUSED,
// before any write) and on every resume (fail closed, ZERO additional writes).
// Malformed shape and derivational/content disagreement both fail closed.
function purchaseSingleCommitVerifyPlan_(plan) {
  var save = PURCHASE_SINGLE_COMMIT_V1;
  function malformed(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function tampered(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return malformed("PLAN_NOT_OBJECT");
  if (plan.planVersion !== save.PLAN_VERSION) return malformed("PLAN_VERSION_MISMATCH");
  if (plan.operationType !== save.OPERATION_TYPE) return malformed("OPERATION_TYPE_MISMATCH");
  if (typeof plan.requestKey !== "string" || !plan.requestKey) return malformed("REQUEST_KEY_MISSING");
  if (plan.operationID !== transactionOperationID_(save.OPERATION_TYPE, plan.requestKey)) {
    return tampered("OPERATION_ID_MISMATCH");
  }
  if (!plan.entryID || plan.entryID !== save.EVENT_ID_PREFIX + plan.requestKey ||
      plan.journalID !== save.JOURNAL_ID_PREFIX + plan.entryID) {
    return tampered("JOURNAL_ID_MISMATCH");
  }
  if (typeof plan.payloadHash !== "string" ||
      plan.payloadHash !== transactionPayloadHash_(plan.normalizedPayload)) {
    return tampered("PAYLOAD_HASH_MISMATCH");
  }
  // The normalized payload may never carry a channel/payment fact (D1/D2/D8),
  // and the history-readable event subset must be the exact derivation.
  var payload = plan.normalizedPayload || {};
  var paymentKey = Object.keys(payload).filter(function(key) {
    return key !== "cashAccountCode" && save.PAYMENT_FIELDS.indexOf(key) !== -1 &&
      payload[key] !== undefined && payload[key] !== null &&
      String(payload[key]).trim() !== "";
  });
  if (paymentKey.length) return tampered("PAYMENT_FIELD_IN_PLAN");
  if (payload.cashAccountCode !== undefined && payload.cashAccountCode !== null &&
      String(payload.cashAccountCode).trim() !== "") {
    return tampered("CASH_ACCOUNT_IN_PLAN");
  }
  if (typeof payload.supplierID !== "string") return malformed("SUPPLIER_ID_MALFORMED");
  if (JSON.stringify(plan.eventNormalizedPayload) !==
      JSON.stringify(purchaseSingleCommitEventPayload_(payload))) {
    return tampered("EVENT_PAYLOAD_MISMATCH");
  }
  var amount = plan.amount;
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return malformed("AMOUNT_INVALID");
  }
  if (Number(payload.input && payload.input.AcquisitionValue) !== amount) {
    return tampered("ACQUISITION_VALUE_MISMATCH");
  }
  if (plan.accounts.money !== save.MONEY_ACCOUNT_CODE) return tampered("MONEY_ACCOUNT_MISMATCH");
  if (plan.accounts.purchase !== save.DEBIT_ACCOUNT_CODE) return tampered("PURCHASE_ACCOUNT_MISMATCH");
  if (plan.accounts.purchase === plan.accounts.money) return tampered("PURCHASE_ACCOUNT_IS_MONEY_ACCOUNT");
  if (plan.paymentStatus !== save.PAYMENT_STATUS || plan.cashAccountCode !== save.MONEY_ACCOUNT_CODE ||
      plan.accountingStatus !== save.ACCOUNTING_STATUS || plan.regime !== save.REGIME) {
    return tampered("DERIVED_AUTHORITY_MISMATCH");
  }
  if (plan.sourceType !== save.SOURCE_TYPE || plan.movementType !== save.MOVEMENT_TYPE) {
    return tampered("SOURCE_IDENTITY_MISMATCH");
  }
  var row = plan.eventRow;
  if (!row || row.EventID !== plan.entryID || row.RequestKey !== plan.requestKey ||
      row.ExpenseID !== plan.expenseItem.expenseItemId ||
      row.BusinessLabel !== plan.expenseItem.item ||
      row.PaymentStatus !== save.PAYMENT_STATUS ||
      row.CashAccountCode !== save.MONEY_ACCOUNT_CODE ||
      row.AccountingStatus !== save.ACCOUNTING_STATUS ||
      row.SupplierID !== plan.supplierID ||
      row.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL ||
      row.IsActive !== true ||
      row.RecoveryKey !== save.RECOVERY_KEY_PREFIX + plan.requestKey ||
      row.NormalizedPayload !== JSON.stringify(plan.eventNormalizedPayload)) {
    return tampered("EVENT_ROW_MISMATCH");
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
  var ok = plan.journalRows.every(function(journalRow) {
    return journalRow.SourceType === save.SOURCE_TYPE && journalRow.SourceID === plan.entryID &&
      journalRow.MovementType === save.MOVEMENT_TYPE && journalRow.IsActive === true &&
      expenseSingleCommitFieldEqual_(journalRow.Tanggal, plan.economicDate);
  });
  if (!ok) return tampered("JOURNAL_SOURCE_MISMATCH");
  if (debitRow.AccountCode !== save.DEBIT_ACCOUNT_CODE || debitRow.Debit !== amount ||
      Number(debitRow.Credit) !== 0) {
    return tampered("DEBIT_LEG_MISMATCH");
  }
  if (creditRow.AccountCode !== save.MONEY_ACCOUNT_CODE ||
      Number(creditRow.Debit) !== 0 || creditRow.Credit !== amount) {
    return tampered("CREDIT_LEG_MISMATCH");
  }
  var totalDebit = 0, totalCredit = 0;
  plan.journalRows.forEach(function(journalRow) {
    totalDebit += Number(journalRow.Debit || 0);
    totalCredit += Number(journalRow.Credit || 0);
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
function purchaseSingleCommitValueRanges_(plan) {
  var save = PURCHASE_SINGLE_COMMIT_V1;
  function rowValues(row, headers) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }
  var ranges = [
    { range: "PurchaseEvents", values: [rowValues(plan.eventRow, PURCHASE_EVENT_POLICY.headers)] },
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

// ONE spreadsheets.batchUpdate body: exactly three appendCells subrequests
// (one per write surface, by sheetId). Throws BEFORE issuing any request if a
// sheetId is missing, so the batch is rejected atomically rather than partly.
// RAW CellData only (stringValue / numberValue / boolValue), never
// formulaValue; the boolean IsActive cell is transported as boolValue, the
// canonical representation the readback verification expects.
function purchaseSingleCommitBatchBody_(valueRanges, sheetIds) {
  var save = PURCHASE_SINGLE_COMMIT_V1;
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

// Cell / request safety bounds: evaluated BEFORE the intent write (an unsafe
// plan is never persisted) and re-evaluated on resume against the STORED plan.
function purchaseSingleCommitBounds_(plan) {
  var save = PURCHASE_SINGLE_COMMIT_V1, ranges;
  try { ranges = purchaseSingleCommitValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "SAVE_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  save.WRITE_SURFACES.forEach(function(name) { sentinel[name] = 2147483647; });
  var body;
  try { body = purchaseSingleCommitBatchBody_(ranges, sentinel); }
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

// T11.8/U6 original-content equality for a PurchaseEvent row: financial
// truth (PaymentStatus/CashAccountCode/AccountingStatus/amount/dates/keys)
// is immutable; the ONLY tolerated delta after a committed cancel/correct is
// the canonical lifecycle marker (CAPTURED_OPERATIONAL+active -> VOIDED or
// CORRECTED+inactive).
function purchaseSingleCommitEventContentEqual_(actual, expected) {
  var transitioned = expected.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL &&
    isCanonicalActive(expected.IsActive) &&
    (actual.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED ||
      actual.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED) &&
    !isCanonicalActive(actual.IsActive);
  var contentEqual = PURCHASE_EVENT_POLICY.headers.every(function(header) {
    if (transitioned && (header === "Lifecycle" || header === "IsActive")) return true;
    return expenseSingleCommitFieldEqual_(actual[header], expected[header]);
  });
  return contentEqual && (transitioned ||
    (actual.Lifecycle === expected.Lifecycle &&
      isCanonicalActive(actual.IsActive) === isCanonicalActive(expected.IsActive)));
}

// Exact artifact verification against the frozen plan over the three surfaces.
// Distinguishes NONE (intent only) / PARTIAL (incomplete) / CONFLICT (identity
// or content disagreement) / EXACT / UNKNOWN (read failure).
function purchaseSingleCommitInspect_(plan, ss) {
  var save = PURCHASE_SINGLE_COMMIT_V1,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var events, ledger, logs;
  try {
    events = readCanonicalTable(ss, "PurchaseEvents", PURCHASE_EVENT_POLICY.headers);
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
  events.forEach(function(row) {
    if (row.EventID === plan.entryID && row.RequestKey !== plan.requestKey) {
      conflicts.push("EVENT_ROW_SOURCE_CROSS_OWNER");
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
  var eventMatches = events.filter(function(row) { return row.EventID === plan.entryID; });
  // T11.8/U6: PURCHASE_EVENT_VOID/CORRECT append their Policy C reversal pair
  // under the SAME (PURCHASE_EVENT, EventID) with dedicated reversal
  // JournalIDs. Those rows belong to the correction plan; the save's
  // source-set identity check excludes exactly them so a committed save
  // replays zero-write after a later cancel/correct.
  var reversalJournalIds = {};
  reversalJournalIds[PURCHASE_EVENT_CORRECTION.VOID_JOURNAL_ID_PREFIX +
    plan.entryID] = true;
  reversalJournalIds[PURCHASE_EVENT_CORRECTION.CORRECT_JOURNAL_ID_PREFIX +
    plan.entryID] = true;
  var journalBySource = ledger.filter(function(row) {
    return String(row.SourceType) === plan.sourceType &&
      String(row.SourceID) === plan.entryID &&
      reversalJournalIds[String(row.JournalID)] !== true;
  });
  var journalById = ledger.filter(function(row) { return row.JournalID === plan.journalID; });
  var auditById = logs.filter(function(row) { return row.ID_Log === plan.auditID; });
  var present = eventMatches.length || journalBySource.length || journalById.length ||
    auditById.length;
  if (!present) {
    if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
    return { state: "NONE", detail: "NO_ARTIFACTS" };
  }
  if (eventMatches.length > 1) conflicts.push("EVENT_ROW_DUPLICATE");
  else if (eventMatches.length === 1) {
    if (!purchaseSingleCommitEventContentEqual_(eventMatches[0], plan.eventRow)) {
      conflicts.push("EVENT_ROW_TAMPERED");
    }
  } else missing.push("EVENT_ROW");
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

// The legacy-shaped Purchase DTO returned to the client on DONE (projected
// from the frozen plan's event row — the business authority).
function purchaseSingleCommitEntry_(plan) {
  return projectPurchaseEventTransaction_(plan.eventRow);
}

// COMMITTED transition: full ten-field readback of the committed operation
// against the expected in-memory row. Lost or mismatched readback after a
// successful update returns UNKNOWN (never DONE); the next retry verifies again.
function purchaseSingleCommitCommit_(operation, runtime) {
  var save = PURCHASE_SINGLE_COMMIT_V1, codes = save.CODES,
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
function purchaseSingleCommitApplyBatch_(plan, operation, runtime) {
  var save = PURCHASE_SINGLE_COMMIT_V1, codes = save.CODES;
  function outcome(status, fields) {
    return purchaseSingleCommitResult_(status, Object.assign({
      requestKey: plan.requestKey, operationID: plan.operationID, entryID: plan.entryID,
      journalID: plan.journalID, auditID: plan.auditID
    }, fields || {}));
  }
  var ranges = null;
  try { ranges = purchaseSingleCommitValueRanges_(plan); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message, writeCount: "UNKNOWN" });
  }
  var rows = 0;
  ranges.forEach(function(range) { rows += range.values.length; });
  if (runtime.crash) runtime.crash("PURCHASE_BEFORE_BATCH");
  var batchError = null;
  try { runtime.batch(ranges); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("PURCHASE_AFTER_BATCH");
  var inspection = purchaseSingleCommitInspect_(plan, runtime.spreadsheet);
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
  if (runtime.crash) runtime.crash("PURCHASE_AFTER_READBACK");
  if (runtime.crash) runtime.crash("PURCHASE_BEFORE_COMMIT");
  var commit = purchaseSingleCommitCommit_(operation, runtime);
  if (!commit.ok) {
    return outcome(commit.status,
      { code: commit.code, writeCount: rows, detail: commit.detail });
  }
  if (runtime.crash) runtime.crash("PURCHASE_AFTER_COMMIT");
  return outcome(save.STATUS.DONE, { writeCount: rows, entry: purchaseSingleCommitEntry_(plan) });
}

// Resume path: exact (OperationType, RequestKey) lookup hit. Compares the
// payload hash AND the exact persisted normalized structure; verifies the
// stored plan digest + shape; validates State; re-checks schema + stored
// bounds (no mutable master recomputation) before touching artifacts. A
// tampered or partial state fails closed with ZERO additional writes.
function purchaseSingleCommitResume_(operation, hash, normalized, runtime) {
  var save = PURCHASE_SINGLE_COMMIT_V1, codes = save.CODES;
  function outcome(status, fields) {
    return purchaseSingleCommitResult_(status, Object.assign({
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
  var verify = purchaseSingleCommitVerifyPlan_(plan);
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
  var schema = purchaseSingleCommitSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(","),
      entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var bounds = purchaseSingleCommitBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail,
      entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
  }
  var inspection = purchaseSingleCommitInspect_(plan, runtime.spreadsheet);
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
      if (runtime.crash) runtime.crash("PURCHASE_AFTER_COMMIT");
      return outcome(save.STATUS.DONE, {
        replay: true, writeCount: 0, entry: purchaseSingleCommitEntry_(plan),
        entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
    }
    if (runtime.crash) runtime.crash("PURCHASE_AFTER_READBACK");
    if (runtime.crash) runtime.crash("PURCHASE_BEFORE_COMMIT");
    var commit = purchaseSingleCommitCommit_(operation, runtime);
    if (!commit.ok) {
      return outcome(commit.status, {
        code: commit.code, detail: commit.detail,
        entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
    }
    if (runtime.crash) runtime.crash("PURCHASE_AFTER_COMMIT");
    return outcome(save.STATUS.DONE, {
      replay: true, writeCount: 0, entry: purchaseSingleCommitEntry_(plan),
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
    return purchaseSingleCommitApplyBatch_(plan, operation, runtime);
  }
  // Partial or conflicting uncommitted artifacts: fail closed, never append.
  return outcome(save.STATUS.RECOVERY_REQUIRED, {
    code: closedCode, detail: inspection.detail,
    entryID: plan.entryID, journalID: plan.journalID, auditID: plan.auditID });
}

// New-intent path (outer lock held, lookup returned absent). Every gate is
// re-validated inside the lock immediately before plan freeze; every refusal
// writes zero and no legacy fallback exists on any refusal path.
function purchaseSingleCommitNewIntent_(normalized, hash, runtime) {
  var save = PURCHASE_SINGLE_COMMIT_V1, codes = save.CODES;
  function outcome(status, fields) {
    return purchaseSingleCommitResult_(status,
      Object.assign({ requestKey: normalized.requestKey }, fields || {}));
  }
  var gate = runtime.gate || purchaseSingleCommitGate_(runtime);
  if (gate.mode !== "ACTIVE") {
    return outcome(save.STATUS.REFUSED, { code: gate.code || codes.PAYLOAD_INVALID,
      detail: gate.detail || "SINGLE_COMMIT_NOT_ACTIVE" });
  }
  var schema = purchaseSingleCommitSchemaGate_(runtime.spreadsheet);
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
  // Policy C debit account 6210 validated per the existing account/master
  // contract BEFORE any mutation: present, unique, active, Expense/DEBIT.
  // Fail closed; never created, never inferred; no Policy C weakening.
  var purchaseAccounts = accountRows.filter(function(row) {
    return row && typeof row === "object" &&
      String(row.AccountCode === undefined || row.AccountCode === null ? "" :
        row.AccountCode).trim() === save.DEBIT_ACCOUNT_CODE;
  });
  if (purchaseAccounts.length !== 1) {
    return outcome(save.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED, field: save.DEBIT_ACCOUNT_CODE,
      detail: purchaseAccounts.length ? "PURCHASE_ACCOUNT_DUPLICATE" : "PURCHASE_ACCOUNT_ABSENT" });
  }
  var purchaseAccount = purchaseAccounts[0];
  if (!isCanonicalActive(purchaseAccount.IsActive)) {
    return outcome(save.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED, field: save.DEBIT_ACCOUNT_CODE,
      detail: "PURCHASE_ACCOUNT_INACTIVE" });
  }
  if (String(purchaseAccount.AccountType || "").trim() !== "Expense" ||
      String(purchaseAccount.NormalBalance || "").trim() !== "DEBIT") {
    return outcome(save.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED, field: save.DEBIT_ACCOUNT_CODE,
      detail: "PURCHASE_ACCOUNT_METADATA_MISMATCH" });
  }
  // Prospective Policy C regime only: a pre-transition economic date is
  // LEGACY_PRE_TRANSITION authority and never enters this normal flow.
  var economicDate = capitalEquityDateKey(normalized.input.ExpenseDate);
  var regime = resolvePolicyCAccountingRegime_(normalized.input.ExpenseDate);
  if (regime.status !== "RESOLVED" || regime.regime !== save.REGIME) {
    return outcome(save.STATUS.REFUSED, {
      code: codes.REGIME_NOT_PROSPECTIVE, field: "ExpenseDate",
      detail: String(regime.reason || regime.regime || "") });
  }
  var now = runtime.now();
  var timestamp = new Date(normalized.input.ExpenseDate + "T00:00:00+07:00");
  // Business authority: ExpenseItems master -> Policy C route (CostType /
  // PurchaseRelationship / business label). Never operator-derived.
  var items = runtime.items || readCanonicalTable(runtime.spreadsheet,
    "ExpenseItems", save.ITEM_HEADERS);
  var itemRow = items.filter(function(row) {
    return String(row.ID_Ops).trim() === normalized.expenseItemId &&
      isCanonicalActive(row.IsActive);
  })[0];
  if (!itemRow) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, field: "expenseItemId",
        detail: "EXPENSE_ITEM_NOT_ACTIVE_OR_MAPPED" });
  }
  var route;
  try { route = resolveExpensePurchasePolicy_(normalized.expenseItemId, items); }
  catch (error) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, field: "expenseItemId", detail: error.message });
  }
  if (!expensePolicyIsPurchase_(route)) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, field: "expenseItemId", detail: "NOT_PURCHASE_POLICY" });
  }
  var itemLabel = String(itemRow.Item || "").trim();
  if (!itemLabel) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, field: "expenseItemId", detail: "ITEM_LABEL_MISSING" });
  }
  // SupplierID (D9): OPTIONAL business metadata. Supplied => validated against
  // the existing supplier master authority; absent => never a refusal reason.
  if (normalized.supplierID) {
    var supplierRows;
    try {
      supplierRows = readCanonicalTable(runtime.spreadsheet, SUPPLIER_MASTER_CONTRACT.SHEET,
        SUPPLIER_MASTER_CONTRACT.HEADERS);
    } catch (error) {
      return outcome(save.STATUS.REFUSED,
        { code: codes.SUPPLIER_INVALID, field: "supplierID", detail: "SUPPLIERS_NOT_READY" });
    }
    var supplier = supplierRows.filter(function(row) {
      return String(row.SupplierID || "").trim() === normalized.supplierID;
    })[0];
    if (!supplier || !masterSelectionEligible(supplier.IsActive)) {
      return outcome(save.STATUS.REFUSED,
        { code: codes.SUPPLIER_INVALID, field: "supplierID", detail: "SUPPLIER_INACTIVE" });
    }
  }
  var eventID = save.EVENT_ID_PREFIX + normalized.requestKey;
  // Foreign-artifact defenses (dedupe before any write): a PurchaseEvent row
  // or a Policy C journal already bound to this identity without an operation
  // row is a conflict, never a second append.
  var existingEvents;
  try {
    existingEvents = readCanonicalTable(runtime.spreadsheet, "PurchaseEvents", PURCHASE_EVENT_POLICY.headers);
  } catch (error) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: "PURCHASE_EVENTS:" + error.message });
  }
  if (existingEvents.some(function(row) {
      return String(row.RequestKey || "") === normalized.requestKey ||
        String(row.EventID || "") === eventID; })) {
    return outcome(save.STATUS.CONFLICT,
      { code: codes.IDENTITY_CONFLICT, detail: "EVENT_IDENTITY_EXISTS" });
  }
  var ledgerRows;
  try {
    ledgerRows = readCanonicalTable(runtime.spreadsheet, "BalanceLedger",
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  } catch (error) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: "BALANCE_LEDGER:" + error.message });
  }
  var journalState = policyCExistingJournalState_(ledgerRows, save.SOURCE_TYPE, eventID);
  if (journalState.status !== "NONE") {
    return outcome(save.STATUS.CONFLICT,
      { code: codes.IDENTITY_CONFLICT, detail: "JOURNAL_IDENTITY_EXISTS:" + journalState.status });
  }
  // Deterministic identity: (OperationType, RequestKey) -> operation; the
  // business ID keeps the exact PE-<requestKey> shape (T11.2 §6).
  var operationID = transactionOperationID_(save.OPERATION_TYPE, normalized.requestKey);
  var auditID = "LOG-ENTRY-" + runtime.uuid();
  var allocationStatus = route.PurchaseRelationship.indexOf("HPP_COST_POOL") === 0 ?
    "COST_POOL_ALLOCATION_UNDEFINED" : "QUANTITY_PACKAGE_UNRESOLVED";
  var plan;
  try {
    plan = purchaseSingleCommitPlan_({
      normalized: normalized, hash: hash, operationID: operationID, auditID: auditID,
      actor: runtime.actor(), now: now, timestamp: timestamp, economicDate: economicDate,
      itemLabel: itemLabel, category: String(itemRow.Kategori || ""),
      kind: String(itemRow.Kind || ""), group: String(itemRow.Group || ""),
      policyVersion: EXPENSE_PURCHASE_POLICY.version,
      policyRevision: EXPENSE_PURCHASE_POLICY.revision,
      route: route, allocationStatus: allocationStatus
    });
  } catch (error) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, detail: "PLAN_BUILD:" + error.message });
  }
  var verify = purchaseSingleCommitVerifyPlan_(plan);
  if (!verify.ok) {
    return outcome(save.STATUS.REFUSED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason });
  }
  var bounds = purchaseSingleCommitBounds_(plan);
  if (!bounds.ok) {
    return outcome(save.STATUS.REFUSED,
      { code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail });
  }
  if (runtime.crash) runtime.crash("PURCHASE_BEFORE_INTENT");
  var operation;
  try {
    operation = transactionResolveOperation_(runtime.repository, save.OPERATION_TYPE,
      normalized.requestKey, hash, eventID, plan, runtime.now());
  } catch (error) {
    return outcome(error.code === "OPERATION_PAYLOAD_CONFLICT" ?
      save.STATUS.CONFLICT : save.STATUS.RECOVERY_REQUIRED, {
      code: error.code === "OPERATION_PAYLOAD_CONFLICT" ?
        codes.OPERATION_PAYLOAD_CONFLICT : codes.DUPLICATE_OPERATION_EVIDENCE,
      detail: error.message, entryID: eventID, journalID: plan.journalID,
      auditID: plan.auditID });
  }
  if (runtime.crash) runtime.crash("PURCHASE_AFTER_INTENT_PERSIST");
  // Exact readback of all ten operation fields (Date-safe) BEFORE any
  // business write.
  var readback = null;
  try { readback = runtime.repository.findOperation(save.OPERATION_TYPE, normalized.requestKey); }
  catch (error) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.INTENT_READBACK_FAILED, detail: "INTENT_READBACK_FAILED:" + error.message,
      entryID: eventID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (!readback) {
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.INTENT_READBACK_FAILED, detail: "INTENT_ROW_MISSING",
      entryID: eventID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (readback.State !== "IN_PROGRESS" ||
      !expenseSingleCommitFieldsExact_(readback, operation,
        TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS)) {
    var mismatch = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS.filter(function(header) {
      return !expenseSingleCommitFieldEqual_(readback[header], operation[header]);
    });
    return outcome(save.STATUS.RECOVERY_REQUIRED, {
      code: codes.INTENT_READBACK_FAILED, detail: "INTENT_ROW_MISMATCH:" + mismatch.join(","),
      entryID: eventID, journalID: plan.journalID, auditID: plan.auditID });
  }
  if (runtime.crash) runtime.crash("PURCHASE_AFTER_INTENT");
  return purchaseSingleCommitApplyBatch_(plan, operation, runtime);
}

// Durable save core. Fixed order: normalize -> exact (OperationType,
// RequestKey) lookup BEFORE any mutable master read -> resume or new intent.
// Never acquires a lock (the dispatcher/adapter owns the single outer lock).
function purchaseSingleCommitSaveWithRuntime_(payload, runtime) {
  var save = PURCHASE_SINGLE_COMMIT_V1, codes = save.CODES;
  var normalized;
  try { normalized = purchaseSingleCommitNormalize_(payload); }
  catch (error) {
    return purchaseSingleCommitResult_(save.STATUS.REFUSED, {
      code: error.purchaseSingleCommitCode || codes.PAYLOAD_INVALID,
      requestKey: purchaseSingleCommitPayloadKey_(payload),
      field: error.field || "", detail: error.message });
  }
  var existing = null;
  try {
    existing = runtime.repository.findOperation(save.OPERATION_TYPE, normalized.requestKey);
  } catch (error) {
    return purchaseSingleCommitResult_(save.STATUS.RECOVERY_REQUIRED, {
      code: error && error.message === "DUPLICATE_OPERATION" ?
        codes.DUPLICATE_OPERATION_EVIDENCE : codes.IDENTITY_CONFLICT,
      requestKey: normalized.requestKey,
      detail: error && error.message ? error.message : "" });
  }
  var hash = transactionPayloadHash_(normalized);
  var result = existing ?
    purchaseSingleCommitResume_(existing, hash, normalized, runtime) :
    purchaseSingleCommitNewIntent_(normalized, hash, runtime);
  // Post-commit freshness: ONLY a DONE result (fresh commit or COMMITTED
  // replay) may invalidate the shared dashboard cache. Ephemeral best-effort
  // maintenance: never retried, never allowed to contradict the durable DONE.
  if (result.status === save.STATUS.DONE && typeof runtime.invalidate === "function") {
    try { runtime.invalidate(); }
    catch (cacheError) {
      Logger.log("Purchase single-commit post-commit cache invalidation skipped: " +
        String(cacheError && cacheError.message || cacheError));
    }
  }
  return result;
}

// Resolve the three write-surface sheetIds from spreadsheet metadata
// (read-only). A missing sheetId throws BEFORE the batchUpdate is issued:
// atomic rejection, no partial batch.
function purchaseSingleCommitSheetIdsRequest_() {
  var save = PURCHASE_SINGLE_COMMIT_V1;
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
// appendCells subrequests over the Purchase write surfaces, reusing the
// sanitized migration transport (43). The single batchUpdate is atomic (all
// three subrequests or none); intent/batch/readback/commit remain multistep —
// no database-global atomicity is claimed.
function purchaseSingleCommitBatchRequest_(valueRanges) {
  var sheetIds = purchaseSingleCommitSheetIdsRequest_();
  var body = purchaseSingleCommitBatchBody_(valueRanges, sheetIds);
  return inventoryReceiptMigrationRequest_("post", ":batchUpdate", body);
}

// Dispatcher seam: builds the core runtime from the already-locked context and
// maps the envelope. An unexpected failure AFTER a durable intent may exist is
// UNKNOWN (identity preserved), never a definite failure.
function purchaseSingleCommitDispatch_(payload, ss, dispatcherRuntime, items, gate) {
  var save = PURCHASE_SINGLE_COMMIT_V1;
  var core;
  try {
    core = purchaseSingleCommitCoreRuntime_(ss, dispatcherRuntime, items, gate);
  } catch (error) {
    return purchaseSingleCommitEnvelope_(purchaseSingleCommitResult_(save.STATUS.REFUSED, {
      code: save.CODES.SCHEMA_NOT_READY, requestKey: purchaseSingleCommitPayloadKey_(payload),
      detail: "RUNTIME_UNAVAILABLE:" + String(error && error.message || error) }));
  }
  try {
    return purchaseSingleCommitEnvelope_(purchaseSingleCommitSaveWithRuntime_(payload, core));
  } catch (error) {
    // Unknown only after a durable intent may exist: retain the request
    // identity AND resolve the operation linkage read-only so the client can
    // re-check the SAME intent instead of minting a new one.
    var identity = { requestKey: purchaseSingleCommitPayloadKey_(payload), operationID: "" };
    try {
      var pending = core.repository.findOperation(save.OPERATION_TYPE, identity.requestKey);
      if (pending) identity.operationID = pending.OperationID;
    } catch (lookupError) { /* requestKey remains the recoverable identity */ }
    return purchaseSingleCommitEnvelope_(purchaseSingleCommitResult_(save.STATUS.UNKNOWN,
      Object.assign({
        code: save.CODES.SAVE_EXECUTION_UNKNOWN,
        detail: String(error && error.message || error)
      }, identity)));
  }
}

// ---------------------------------------------------------------------------
// T11.8/U6 — Expense corrections (T11.2 §10, T11.4 §16):
//   EXPENSE_SINGLE_COMMIT_VOID   = Cancel
//   EXPENSE_SINGLE_COMMIT_CORRECT = Correct
//
// One operator action -> one durable intent -> one outer lock -> ONE
// immutable plan -> ONE atomic batch per operation. Originals are immutable:
// Cancel appends the mirror journal Dr1040 / Cr expenseAccount
// (JournalID EXPJV-<ID_Trx>, same MovementType/SourceType/SourceID per
// T11.2 §10) + the canonical lifecycle marker + one signed Logs entry; the
// cancel marker's event authority is the append-only Logs row and the
// committed operation plan. Correct appends that FULL reversal plus a
// complete replacement single-commit Expense (deterministic RequestKey-
// derived identity, own EXPJ- journal Dr expense/Cr1040, lineage in Logs)
// in the SAME plan and batch — never reverse()->success then a second
// durable replacementSave(). No Treasury workflow, no EvidenceRef, no
// PaymentMethod/cash account, no 2010/2000, no legacy settlement, no
// historical rewrite; tabops business/accounting content is never edited
// in place (only the canonical IsActive/UpdatedAt/UpdatedBy lifecycle
// marker changes, inside the same atomic batch).
//
// Admission (NEW intents only): SINGLE_COMMIT_TRANSACTION_V1 must resolve
// ACTIVE (T11.7 §3 routing: ABSENT/PREPARED/PAUSED/REJECT/invalid all refuse
// fail-closed with zero writes; never a legacy fallback). Persisted
// IN_PROGRESS intents resume from the frozen plan regardless of a later
// PAUSED config — recovery never re-evaluates admission.
// ---------------------------------------------------------------------------
var EXPENSE_SINGLE_COMMIT_CORRECTION = Object.freeze({
  VOID: "EXPENSE_SINGLE_COMMIT_VOID",
  CORRECT: "EXPENSE_SINGLE_COMMIT_CORRECT",
  OPERATION_TYPES: Object.freeze(["EXPENSE_SINGLE_COMMIT_VOID",
    "EXPENSE_SINGLE_COMMIT_CORRECT"]),
  PLAN_VERSION: 1,
  // Mirror-journal identity (T11.2 §10 / T11.4 §16): EXPJV-<ID_Trx>.
  JOURNAL_ID_PREFIX: "EXPJV-",
  MOVEMENT_TYPE: "EXPENSE_SINGLE_COMMIT",
  SOURCE_TYPE: "EXPENSE_SINGLE_COMMIT_V1",
  MONEY_ACCOUNT_CODE: "1040",
  AUDIT_MODULE: "TransactionLifecycle",
  AUDIT_ACTIONS: Object.freeze({
    VOID: "VOID_EXPENSE_SINGLE_COMMIT",
    CORRECT_VOID: "CORRECT_VOID_EXPENSE_SINGLE_COMMIT",
    CORRECT_CREATE: "CORRECT_CREATE_EXPENSE_SINGLE_COMMIT"
  }),
  WRITE_SURFACES: Object.freeze(["tabops", "BalanceLedger", "Logs"]),
  ALLOWED_FIELDS: Object.freeze(["requestKey", "transactionId", "reason",
    "expenseItemId", "amount", "expenseDate"]),
  VOID_FIELDS: Object.freeze(["requestKey", "transactionId", "reason"]),
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
    REASON_INVALID: "EXPENSE_SINGLE_COMMIT_REASON_INVALID",
    SCHEMA_NOT_READY: "EXPENSE_SINGLE_COMMIT_SCHEMA_NOT_READY",
    ACCOUNT_PREFLIGHT_FAILED: "EXPENSE_SINGLE_COMMIT_ACCOUNT_PREFLIGHT_FAILED",
    CORRECTION_NOT_ACTIVE: "EXPENSE_SINGLE_COMMIT_CORRECTION_NOT_ACTIVE",
    TARGET_NOT_FOUND: "EXPENSE_SINGLE_COMMIT_TARGET_NOT_FOUND",
    TARGET_NOT_SUPPORTED: "EXPENSE_SINGLE_COMMIT_TARGET_NOT_SUPPORTED",
    TARGET_ALREADY_VOIDED: "EXPENSE_SINGLE_COMMIT_TARGET_ALREADY_VOIDED",
    TARGET_ALREADY_CORRECTED: "EXPENSE_SINGLE_COMMIT_TARGET_ALREADY_CORRECTED",
    TARGET_NOT_CLEAN: "EXPENSE_SINGLE_COMMIT_TARGET_NOT_CLEAN",
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
    INVALID_OPERATION_STATE: "EXPENSE_SINGLE_COMMIT_INVALID_OPERATION_STATE",
    CORRECTION_EXECUTION_UNKNOWN: "EXPENSE_SINGLE_COMMIT_CORRECTION_EXECUTION_UNKNOWN",
    OUTER_LOCK_UNAVAILABLE: "OUTER_LOCK_UNAVAILABLE",
    CORRECTION_RUNTIME_UNAVAILABLE: "EXPENSE_SINGLE_COMMIT_CORRECTION_RUNTIME_UNAVAILABLE"
  })
});

function expenseCorrectionResult_(status, fields) {
  return Object.assign({
    status: status, code: "", requestKey: "", operationID: "", targetID: "",
    replacementID: "", writeCount: 0, replay: false, field: "", detail: ""
  }, fields || {});
}

function expenseCorrectionPayloadKey_(payload) {
  return payload && payload.requestKey !== undefined && payload.requestKey !== null ?
    String(payload.requestKey) : "";
}

// Pure normalization for a correction intent. Strict allowlist per operation;
// payment/channel/evidence fields and unknown fields refuse before any read.
function expenseCorrectionNormalize_(operationType, payload) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, save = EXPENSE_SINGLE_COMMIT_V1;
  var p = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  var keys = Object.keys(p);
  var payment = keys.filter(function(key) {
    return save.PAYMENT_FIELDS.indexOf(key) !== -1 && p[key] !== undefined &&
      p[key] !== null && String(p[key]).trim() !== "";
  });
  if (payment.length) {
    throw expenseSingleCommitError_(c.CODES.PAYMENT_FIELD_REFUSED, payment[0],
      "PAYMENT_FIELD_REFUSED:" + payment.join(","));
  }
  var allowed = operationType === c.VOID ? c.VOID_FIELDS : c.ALLOWED_FIELDS;
  var unknown = keys.filter(function(key) { return allowed.indexOf(key) === -1; });
  if (unknown.length) {
    throw expenseSingleCommitError_(c.CODES.FIELD_REFUSED, unknown[0],
      "FIELD_REFUSED:" + unknown.join(","));
  }
  var requestKey = p.requestKey === undefined || p.requestKey === null ?
    "" : String(p.requestKey).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{3,127}$/.test(requestKey)) {
    throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "requestKey",
      "REQUEST_KEY_REQUIRED");
  }
  var transactionId = p.transactionId === undefined || p.transactionId === null ?
    "" : String(p.transactionId).trim();
  if (!transactionId) {
    throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "transactionId",
      "TRANSACTION_ID_REQUIRED");
  }
  var reason = typeof p.reason === "string" ? p.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500 || !/[A-Za-z0-9]/.test(reason)) {
    throw expenseSingleCommitError_(c.CODES.REASON_INVALID, "reason",
      "REASON_INVALID");
  }
  var normalized = { requestKey: requestKey, transactionId: transactionId,
    reason: reason };
  if (operationType === c.CORRECT) {
    var expenseItemId = p.expenseItemId === undefined || p.expenseItemId === null ?
      "" : String(p.expenseItemId).trim();
    if (!expenseItemId) {
      throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "expenseItemId",
        "EXPENSE_ITEM_REQUIRED");
    }
    var amount = p.amount;
    if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
      throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "amount", "INVALID_AMOUNT");
    }
    var expenseDate = "";
    if (p.expenseDate !== undefined) {
      expenseDate = p.expenseDate === null ? "" : String(p.expenseDate).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || !capitalEquityDateKey(expenseDate)) {
        throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "expenseDate",
          "EXPENSE_DATE_INVALID");
      }
    }
    normalized.expenseItemId = expenseItemId;
    normalized.amount = amount;
    normalized.expenseDate = expenseDate;
  }
  return normalized;
}

// All operation rows (read-only). Corrections need cross-key scans: committed
// save lineage for the target and every other correction bound to it.
function expenseCorrectionOperationRows_(ss) {
  try {
    return readCanonicalTable(ss, TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.SHEET,
      TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
  } catch (error) {
    throw expenseSingleCommitError_(EXPENSE_SINGLE_COMMIT_CORRECTION.CODES.SCHEMA_NOT_READY,
      "", "OPERATIONS_READ_FAILED:" + error.message);
  }
}

// Eligibility + immutable target evidence. Fail closed on anything that is
// not a genuine committed T11 single-commit Expense: legacy/historical rows,
// uncommitted saves, already-voided/corrected targets, malformed evidence —
// each a zero-write REFUSED with a distinct code.
function expenseCorrectionResolveTarget_(operationType, normalized, runtime) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, save = EXPENSE_SINGLE_COMMIT_V1,
    codes = c.CODES, ss = runtime.spreadsheet;
  function refuse(code, detail) { return { ok: false, code: code, detail: detail }; }
  var ops;
  try { ops = expenseCorrectionOperationRows_(ss); }
  catch (error) { return refuse(codes.SCHEMA_NOT_READY, error.message); }
  var saveOps = ops.filter(function(op) {
    return String(op.OperationType) === save.OPERATION_TYPE &&
      String(op.BusinessID) === normalized.transactionId;
  });
  if (!saveOps.length) {
    return refuse(codes.TARGET_NOT_SUPPORTED, "NOT_SINGLE_COMMIT");
  }
  if (saveOps.length > 1) {
    return refuse(codes.TARGET_NOT_SUPPORTED, "DUPLICATE_SAVE_OPS");
  }
  var saveOp = saveOps[0];
  if (String(saveOp.State) !== "COMMITTED") {
    return refuse(codes.TARGET_NOT_SUPPORTED, "SAVE_STATE:" + String(saveOp.State));
  }
  var savePlan = null;
  try { savePlan = JSON.parse(String(saveOp.OperationPlan || "")); }
  catch (error) { return refuse(codes.TARGET_NOT_SUPPORTED, "SAVE_PLAN_JSON"); }
  if (!savePlan || typeof savePlan !== "object" || Array.isArray(savePlan) ||
      String(savePlan.entryID) !== normalized.transactionId) {
    return refuse(codes.TARGET_NOT_SUPPORTED, "SAVE_PLAN_MISMATCH");
  }
  // One active correction branch per original: any other committed or
  // in-progress correction intent already bound to this target decides the
  // refusal code (VOID lineage -> ALREADY_VOIDED, CORRECT lineage ->
  // ALREADY_CORRECTED). Zero writes.
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    if (c.OPERATION_TYPES.indexOf(String(op.OperationType)) === -1) continue;
    if (String(op.OperationType) === operationType &&
        String(op.RequestKey) === normalized.requestKey) continue;
    var opPlan = null;
    try { opPlan = JSON.parse(String(op.OperationPlan || "")); }
    catch (error) { return refuse(codes.TARGET_NOT_CLEAN, "CORRECTION_PLAN_JSON"); }
    if (!opPlan || String(opPlan.targetID) !== normalized.transactionId) continue;
    return refuse(String(op.OperationType) === c.VOID ?
      codes.TARGET_ALREADY_VOIDED : codes.TARGET_ALREADY_CORRECTED,
      String(op.OperationType) + ":" + String(op.RequestKey) + ":" + String(op.State));
  }
  var tabops = null;
  try {
    tabops = readCanonicalTable(ss, "tabops", CANONICAL_ENTRY.EXPENSE_HEADERS);
  } catch (error) { return refuse(codes.SCHEMA_NOT_READY, "tabops:" + error.message); }
  var rows = tabops.filter(function(row) {
    return String(row.ID_Trx) === normalized.transactionId;
  });
  if (!rows.length) return refuse(codes.TARGET_NOT_FOUND, "TABOPS");
  if (rows.length > 1) return refuse(codes.TARGET_NOT_CLEAN, "DUPLICATE_BUSINESS_ROW");
  var row = rows[0];
  if (String(row.Source) !== CANONICAL_ENTRY.SOURCE) {
    return refuse(codes.TARGET_NOT_SUPPORTED, "SOURCE:" + String(row.Source));
  }
  if (!isCanonicalActive(row.IsActive)) {
    return refuse(codes.TARGET_ALREADY_VOIDED, "INACTIVE");
  }
  var ledger = null;
  try {
    ledger = readCanonicalTable(ss, "BalanceLedger",
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  } catch (error) { return refuse(codes.SCHEMA_NOT_READY, "BalanceLedger:" + error.message); }
  var originalJournalID = save.JOURNAL_ID_PREFIX + normalized.transactionId;
  var journalRows = ledger.filter(function(r) {
    return String(r.JournalID) === originalJournalID;
  });
  var amount = Number(row.Nilai);
  var debitRow = journalRows.filter(function(r) {
    return Number(r.Debit) === amount && Number(r.Credit) === 0;
  })[0];
  var creditRow = journalRows.filter(function(r) {
    return String(r.AccountCode) === c.MONEY_ACCOUNT_CODE &&
      Number(r.Credit) === amount && Number(r.Debit) === 0;
  })[0];
  if (journalRows.length !== 2 || !debitRow || !creditRow ||
      String(debitRow.SourceType) !== save.SOURCE_TYPE ||
      String(debitRow.SourceID) !== normalized.transactionId ||
      String(creditRow.SourceType) !== save.SOURCE_TYPE ||
      String(creditRow.SourceID) !== normalized.transactionId ||
      !isFinite(amount) || amount <= 0 ||
      Number(savePlan.amount) !== amount) {
    return refuse(codes.TARGET_NOT_CLEAN, "ORIGINAL_JOURNAL");
  }
  var target = {
    transactionId: normalized.transactionId,
    rowNumber: row.sourceRowIndex + 1,
    amount: amount,
    expenseAccount: String(debitRow.AccountCode),
    originalJournalID: originalJournalID,
    originalEconomicDate: String(debitRow.Tanggal),
    saveOperationID: String(saveOp.OperationID),
    saveRequestKey: String(saveOp.RequestKey),
    row: row
  };
  if (target.expenseAccount === c.MONEY_ACCOUNT_CODE || !target.expenseAccount) {
    return refuse(codes.TARGET_NOT_CLEAN, "ORIGINAL_EXPENSE_ACCOUNT");
  }
  return { ok: true, target: target, targetEvidence: {
    businessRow: transactionPayloadHash_(row),
    journal: transactionPayloadHash_(journalRows),
    savePlan: transactionPayloadHash_(savePlan)
  } };
}

// Immutable plan freeze. Every identity, row, signature and digest is
// derived once; the plan (persisted in OperationPlan) is the single source
// of truth for every later step — recovery never re-plans from masters.
function expenseCorrectionPlan_(operationType, input) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, save = EXPENSE_SINGLE_COMMIT_V1;
  var normalized = input.normalized, target = input.target,
    now = input.now, nowISO = now.toISOString();
  var reversalJournalID = c.JOURNAL_ID_PREFIX + target.transactionId;
  // Cancel/Correct reversal: exact mirror of the original journal at ACTION
  // date — Dr1040 / Cr original expense account, bound to the original
  // (same MovementType/SourceType/SourceID), ExternalRef = original journal.
  var reversalJournalRows = [
    { JournalID: reversalJournalID, LineID: reversalJournalID + "-1",
      Tanggal: input.economicDate, AccountCode: c.MONEY_ACCOUNT_CODE,
      Debit: target.amount, Credit: 0, MovementType: c.MOVEMENT_TYPE,
      SourceType: c.SOURCE_TYPE, SourceID: target.transactionId,
      ExternalRef: target.originalJournalID, Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: input.actor, UpdatedAt: nowISO,
      UpdatedBy: input.actor },
    { JournalID: reversalJournalID, LineID: reversalJournalID + "-2",
      Tanggal: input.economicDate, AccountCode: target.expenseAccount,
      Debit: 0, Credit: target.amount, MovementType: c.MOVEMENT_TYPE,
      SourceType: c.SOURCE_TYPE, SourceID: target.transactionId,
      ExternalRef: target.originalJournalID, Keterangan: "", IsActive: true,
      CreatedAt: nowISO, CreatedBy: input.actor, UpdatedAt: nowISO,
      UpdatedBy: input.actor }
  ];
  var reversalJournalSignature = policyCJournalSignature_(reversalJournalRows);
  // Canonical lifecycle marker (the only original-row delta; same atomic
  // batch): IsActive=false + UpdatedAt/UpdatedBy. Content stays byte-true.
  var lifecycleRow = {};
  CANONICAL_ENTRY.EXPENSE_HEADERS.forEach(function(header) {
    lifecycleRow[header] = target.row[header];
  });
  lifecycleRow.IsActive = false;
  lifecycleRow.UpdatedAt = now;
  lifecycleRow.UpdatedBy = CANONICAL_ENTRY.USER;
  var auditAction = operationType === c.VOID ? c.AUDIT_ACTIONS.VOID :
    c.AUDIT_ACTIONS.CORRECT_VOID;
  var auditMetadata = { reason: normalized.reason,
    requestKey: normalized.requestKey, operationID: input.operationID,
    transactionType: "EXPENSE", singleCommit: true,
    targetJournalID: target.originalJournalID,
    reversalJournalID: reversalJournalID };
  if (input.replacement) auditMetadata.replacementId = input.replacement.entryID;
  var auditRow = {
    ID_Log: input.auditID, Timestamp: now, Level: "INFO",
    Module: c.AUDIT_MODULE, Action: auditAction, RecordID: target.transactionId,
    User: CANONICAL_ENTRY.USER,
    Message: operationType === c.VOID ?
      "Single-commit expense cancelled." : "Single-commit expense correction reversal recorded.",
    Metadata: JSON.stringify(auditMetadata)
  };
  var plan = {
    planVersion: c.PLAN_VERSION, operationType: operationType,
    operationID: input.operationID, requestKey: normalized.requestKey,
    payloadHash: input.hash, normalizedPayload: normalized,
    targetID: target.transactionId,
    businessID: operationType === c.VOID ? target.transactionId : "",
    reason: normalized.reason, actor: input.actor, actionAt: nowISO,
    economicDate: input.economicDate, amount: target.amount,
    accounts: { expense: target.expenseAccount, money: c.MONEY_ACCOUNT_CODE },
    sourceType: c.SOURCE_TYPE, movementType: c.MOVEMENT_TYPE,
    target: target, targetEvidence: input.targetEvidence,
    reversalJournalID: reversalJournalID,
    reversalJournalRows: reversalJournalRows,
    reversalJournalSignature: reversalJournalSignature,
    lifecycle: { rowNumber: target.rowNumber, afterRow: lifecycleRow },
    auditID: input.auditID, auditRow: auditRow,
    replacement: null
  };
  if (operationType === c.CORRECT) {
    var replacement = input.replacement;
    plan.businessID = replacement.entryID;
    plan.replacement = replacement;
  }
  plan.planDigest = transactionPayloadHash_(plan);
  return plan;
}

// Plan integrity + shape invariants. Runs at freeze time (definite REFUSED,
// before any write) and on every resume (fail closed, ZERO additional writes).
function expenseCorrectionVerifyPlan_(plan) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, save = EXPENSE_SINGLE_COMMIT_V1;
  function malformed(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function tampered(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return malformed("PLAN_NOT_OBJECT");
  if (plan.planVersion !== c.PLAN_VERSION) return malformed("PLAN_VERSION_MISMATCH");
  if (plan.operationType !== c.VOID && plan.operationType !== c.CORRECT) {
    return malformed("OPERATION_TYPE_MISMATCH");
  }
  if (typeof plan.requestKey !== "string" || !plan.requestKey) return malformed("REQUEST_KEY_MISSING");
  if (plan.operationID !== transactionOperationID_(plan.operationType, plan.requestKey)) {
    return tampered("OPERATION_ID_MISMATCH");
  }
  if (typeof plan.payloadHash !== "string" ||
      plan.payloadHash !== transactionPayloadHash_(plan.normalizedPayload)) {
    return tampered("PAYLOAD_HASH_MISMATCH");
  }
  if (typeof plan.targetID !== "string" || !plan.targetID) return malformed("TARGET_ID_MISSING");
  var payload = plan.normalizedPayload || {};
  if (payload.transactionId !== plan.targetID) return tampered("TARGET_ID_MISMATCH");
  if (typeof payload.reason !== "string" || !payload.reason) return malformed("REASON_MISSING");
  if (plan.reason !== payload.reason) return tampered("REASON_MISMATCH");
  var amount = plan.amount;
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return malformed("AMOUNT_INVALID");
  }
  if (plan.accounts.money !== c.MONEY_ACCOUNT_CODE) return tampered("MONEY_ACCOUNT_MISMATCH");
  if (!plan.accounts.expense || plan.accounts.expense === c.MONEY_ACCOUNT_CODE) {
    return tampered("EXPENSE_ACCOUNT_MISMATCH");
  }
  if (plan.sourceType !== c.SOURCE_TYPE || plan.movementType !== c.MOVEMENT_TYPE) {
    return tampered("SOURCE_IDENTITY_MISMATCH");
  }
  if (typeof plan.economicDate !== "string" || !capitalEquityDateKey(plan.economicDate)) {
    return malformed("ECONOMIC_DATE_INVALID");
  }
  if (typeof plan.actor !== "string" || !plan.actor || typeof plan.actionAt !== "string" ||
      !plan.actionAt) {
    return malformed("ACTOR_OR_TIMESTAMP_MISSING");
  }
  // Target evidence + original row (pre-state) + lifecycle marker.
  var target = plan.target;
  if (!target || typeof target !== "object") return malformed("TARGET_MISSING");
  if (String(target.transactionId) !== plan.targetID) return tampered("TARGET_TRANSACTION_MISMATCH");
  if (typeof target.expenseAccount !== "string" || target.expenseAccount !== plan.accounts.expense) {
    return tampered("TARGET_ACCOUNT_MISMATCH");
  }
  if (String(target.originalJournalID) !== save.JOURNAL_ID_PREFIX + plan.targetID) {
    return tampered("TARGET_JOURNAL_MISMATCH");
  }
  if (Number(target.amount) !== amount) return tampered("TARGET_AMOUNT_MISMATCH");
  if (!isFinite(Number(target.rowNumber)) || Number(target.rowNumber) < 2 ||
      Number(target.rowNumber) !== Number(plan.lifecycle.rowNumber)) {
    return tampered("TARGET_ROW_NUMBER_MISMATCH");
  }
  if (!target.row || target.row.ID_Trx !== plan.targetID ||
      Number(target.row.Nilai) !== amount ||
      String(target.row.Source) !== CANONICAL_ENTRY.SOURCE ||
      !isCanonicalActive(target.row.IsActive) ||
      Number(target.row.sourceRowIndex) + 1 !== Number(target.rowNumber)) {
    return tampered("TARGET_ROW_MISMATCH");
  }
  ["businessRow", "journal", "savePlan"].forEach(function(key) {
    if (typeof plan.targetEvidence[key] !== "string" || !plan.targetEvidence[key]) {
      throw new Error("TARGET_EVIDENCE_" + key.toUpperCase() + "_MISSING");
    }
  });
  var after = plan.lifecycle.afterRow;
  if (!after || typeof after !== "object") return malformed("LIFECYCLE_ROW_MISSING");
  if (after.ID_Trx !== plan.targetID || after.ID_Ops !== target.row.ID_Ops ||
      Number(after.Nilai) !== amount || String(after.Source) !== CANONICAL_ENTRY.SOURCE ||
      after.IsActive !== false || after.UpdatedBy !== CANONICAL_ENTRY.USER ||
      after.UpdatedAt === undefined || after.UpdatedAt === null || after.UpdatedAt === "" ||
      !expenseSingleCommitFieldEqual_(after.Tanggal, target.row.Tanggal) ||
      !expenseSingleCommitFieldEqual_(after.CreatedAt, target.row.CreatedAt) ||
      !expenseSingleCommitFieldEqual_(after.CreatedBy, target.row.CreatedBy)) {
    return tampered("LIFECYCLE_ROW_MISMATCH");
  }
  // Reversal journal: exact mirror, balanced, signed, at ACTION date.
  var rows = plan.reversalJournalRows;
  if (!Array.isArray(rows) || rows.length !== 2) return malformed("REVERSAL_JOURNAL_ROW_COUNT");
  var r0 = rows[0], r1 = rows[1];
  if (r0.LineID !== plan.reversalJournalID + "-1" || r1.LineID !== plan.reversalJournalID + "-2" ||
      r0.JournalID !== plan.reversalJournalID || r1.JournalID !== plan.reversalJournalID ||
      plan.reversalJournalID !== c.JOURNAL_ID_PREFIX + plan.targetID) {
    return tampered("REVERSAL_JOURNAL_ID_MISMATCH");
  }
  var rowsOk = rows.every(function(row) {
    return row.SourceType === c.SOURCE_TYPE && row.SourceID === plan.targetID &&
      row.MovementType === c.MOVEMENT_TYPE && row.IsActive === true &&
      row.ExternalRef === target.originalJournalID &&
      expenseSingleCommitFieldEqual_(row.Tanggal, plan.economicDate);
  });
  if (!rowsOk) return tampered("REVERSAL_JOURNAL_SOURCE_MISMATCH");
  if (r0.AccountCode !== c.MONEY_ACCOUNT_CODE || Number(r0.Debit) !== amount ||
      Number(r0.Credit) !== 0 || r1.AccountCode !== plan.accounts.expense ||
      Number(r1.Debit) !== 0 || Number(r1.Credit) !== amount) {
    return tampered("REVERSAL_JOURNAL_MAPPING_MISMATCH");
  }
  if (policyCJournalSignature_(rows) !== plan.reversalJournalSignature) {
    return tampered("REVERSAL_JOURNAL_SIGNATURE_MISMATCH");
  }
  // Audit row: append-only cancel/correction marker (event authority).
  var audit = plan.auditRow;
  var expectedAction = plan.operationType === c.VOID ? c.AUDIT_ACTIONS.VOID :
    c.AUDIT_ACTIONS.CORRECT_VOID;
  if (!audit || audit.ID_Log !== plan.auditID || audit.RecordID !== plan.targetID ||
      audit.Module !== c.AUDIT_MODULE || audit.Action !== expectedAction) {
    return tampered("AUDIT_ROW_MISMATCH");
  }
  var auditMeta = null;
  try { auditMeta = JSON.parse(String(audit.Metadata || "{}")); }
  catch (error) { return malformed("AUDIT_METADATA_JSON_INVALID"); }
  if (!auditMeta || auditMeta.requestKey !== plan.requestKey ||
      auditMeta.operationID !== plan.operationID || auditMeta.singleCommit !== true ||
      auditMeta.targetJournalID !== target.originalJournalID ||
      auditMeta.reversalJournalID !== plan.reversalJournalID) {
    return tampered("AUDIT_METADATA_MISMATCH");
  }
  // Replacement sections (CORRECT only): complete replacement save in-plan.
  if (plan.operationType === c.VOID) {
    if (plan.replacement !== null && plan.replacement !== undefined) {
      return malformed("REPLACEMENT_IN_VOID");
    }
    if (plan.businessID !== plan.targetID) return tampered("BUSINESS_ID_MISMATCH");
    if (payload.expenseItemId !== undefined || payload.amount !== undefined ||
        payload.expenseDate !== undefined) {
      return tampered("REPLACEMENT_FIELDS_IN_VOID");
    }
  } else {
    var rep = plan.replacement;
    if (!rep || typeof rep !== "object") return malformed("REPLACEMENT_MISSING");
    var expectedEntryID = transactionStableBusinessID_("OPS-APP-", plan.operationType,
      plan.requestKey);
    if (rep.entryID !== expectedEntryID || plan.businessID !== rep.entryID) {
      return tampered("REPLACEMENT_ID_DERIVATION_MISMATCH");
    }
    if (payload.expenseItemId !== rep.expenseItem.expenseItemId ||
        Number(payload.amount) !== Number(rep.amount)) {
      return tampered("REPLACEMENT_PAYLOAD_MISMATCH");
    }
    if ((payload.expenseDate || plan.economicDate) !== rep.economicDate) {
      return tampered("REPLACEMENT_DATE_MISMATCH");
    }
    if (!rep.businessRow || rep.businessRow.ID_Trx !== rep.entryID ||
        Number(rep.businessRow.Nilai) !== Number(rep.amount) ||
        String(rep.businessRow.Source) !== CANONICAL_ENTRY.SOURCE ||
        rep.businessRow.IsActive !== true ||
        !expenseSingleCommitFieldEqual_(rep.businessRow.ID_Ops, rep.expenseItem.expenseItemId)) {
      return tampered("REPLACEMENT_BUSINESS_ROW_MISMATCH");
    }
    if (!rep.expenseItem || !rep.expenseItem.accountCode ||
        rep.expenseItem.accountCode === c.MONEY_ACCOUNT_CODE) {
      return tampered("REPLACEMENT_ACCOUNT_MISMATCH");
    }
    if (rep.journalID !== save.JOURNAL_ID_PREFIX + rep.entryID) {
      return tampered("REPLACEMENT_JOURNAL_ID_MISMATCH");
    }
    if (!Array.isArray(rep.journalRows) || rep.journalRows.length !== 2) {
      return malformed("REPLACEMENT_JOURNAL_ROW_COUNT");
    }
    var j0 = rep.journalRows[0], j1 = rep.journalRows[1];
    var replOk = rep.journalRows.every(function(row) {
      return row.SourceType === save.SOURCE_TYPE && row.SourceID === rep.entryID &&
        row.MovementType === save.MOVEMENT_TYPE && row.IsActive === true &&
        expenseSingleCommitFieldEqual_(row.Tanggal, rep.economicDate);
    });
    if (!replOk || j0.LineID !== rep.journalID + "-1" || j1.LineID !== rep.journalID + "-2" ||
        j0.JournalID !== rep.journalID || j1.JournalID !== rep.journalID) {
      return tampered("REPLACEMENT_JOURNAL_SOURCE_MISMATCH");
    }
    if (j0.AccountCode !== rep.expenseItem.accountCode || Number(j0.Debit) !== Number(rep.amount) ||
        Number(j0.Credit) !== 0 || j1.AccountCode !== c.MONEY_ACCOUNT_CODE ||
        Number(j1.Debit) !== 0 || Number(j1.Credit) !== Number(rep.amount)) {
      return tampered("REPLACEMENT_JOURNAL_MAPPING_MISMATCH");
    }
    if (policyCJournalSignature_(rep.journalRows) !== rep.journalSignature) {
      return tampered("REPLACEMENT_JOURNAL_SIGNATURE_MISMATCH");
    }
    var repAudit = rep.auditRow;
    var repMeta = null;
    try { repMeta = JSON.parse(String(repAudit && repAudit.Metadata || "{}")); }
    catch (error) { return malformed("REPLACEMENT_AUDIT_METADATA_JSON_INVALID"); }
    if (!repAudit || repAudit.ID_Log !== rep.auditID || repAudit.RecordID !== rep.entryID ||
        repAudit.Module !== c.AUDIT_MODULE ||
        repAudit.Action !== c.AUDIT_ACTIONS.CORRECT_CREATE || !repMeta ||
        repMeta.originalId !== plan.targetID || repMeta.requestKey !== plan.requestKey ||
        repMeta.operationID !== plan.operationID) {
      return tampered("REPLACEMENT_AUDIT_MISMATCH");
    }
    if (!isFinite(Number(rep.amount)) || Number(rep.amount) <= 0) {
      return malformed("REPLACEMENT_AMOUNT_INVALID");
    }
  }
  var digestInput = Object.assign({}, plan);
  delete digestInput.planDigest;
  if (plan.planDigest !== transactionPayloadHash_(digestInput)) {
    return tampered("PLAN_DIGEST_MISMATCH");
  }
  return { ok: true, kind: "", reason: "" };
}

function expenseCorrectionRowValues_(row, headers) {
  return headers.map(function(header) {
    return row[header] === undefined ? "" : row[header];
  });
}

// The ONE batch's logical ranges (frozen plan order). tabops may appear twice
// on CORRECT (lifecycle update of the original + append of the replacement);
// surfaces stay exactly {tabops, BalanceLedger, Logs}.
function expenseCorrectionValueRanges_(plan) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION;
  var ranges = [
    { range: "tabops", updateRow: plan.lifecycle.rowNumber,
      values: [expenseCorrectionRowValues_(plan.lifecycle.afterRow,
        CANONICAL_ENTRY.EXPENSE_HEADERS)] }
  ];
  if (plan.replacement) {
    ranges.push({ range: "tabops",
      values: [expenseCorrectionRowValues_(plan.replacement.businessRow,
        CANONICAL_ENTRY.EXPENSE_HEADERS)] });
  }
  ranges.push({ range: "BalanceLedger",
    values: plan.reversalJournalRows
      .concat(plan.replacement ? plan.replacement.journalRows : [])
      .map(function(row) {
        return expenseCorrectionRowValues_(row,
          BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
      }) });
  var auditRows = [plan.auditRow];
  if (plan.replacement) auditRows.push(plan.replacement.auditRow);
  ranges.push({ range: "Logs", values: auditRows.map(function(row) {
    return expenseCorrectionRowValues_(row, CANONICAL_ENTRY.LOG_HEADERS);
  }) });
  var unique = [];
  ranges.forEach(function(range) {
    if (unique.indexOf(range.range) === -1) unique.push(range.range);
  });
  unique.sort();
  var expected = c.WRITE_SURFACES.slice().sort();
  if (JSON.stringify(unique) !== JSON.stringify(expected)) {
    throw new Error("CORRECTION_SURFACE_MISMATCH");
  }
  return ranges;
}

// ONE spreadsheets.batchUpdate body: appendCells for appended rows,
// updateCells for the canonical lifecycle marker — all subrequests inside ONE
// atomic batchUpdate. Throws BEFORE issuing any request if a sheetId is
// missing, so the batch is rejected atomically rather than partly. RAW
// CellData only (stringValue/numberValue/boolValue), never formulaValue.
function expenseCorrectionBatchBody_(valueRanges, sheetIds) {
  var requests = valueRanges.map(function(range) {
    var sheetId = sheetIds[range.range];
    if (typeof sheetId !== "number" || !isFinite(sheetId)) {
      throw new Error("SHEET_ID_UNAVAILABLE:" + range.range);
    }
    var rows = range.values.map(function(row) {
      return { values: row.map(function(cell) {
        return { userEnteredValue: expenseSingleCommitCellValue_(cell) };
      }) };
    });
    if (range.updateRow !== undefined) {
      if (!isFinite(range.updateRow) || range.updateRow < 2) {
        throw new Error("UNSAFE_UPDATE_ROW:" + range.range);
      }
      return { updateCells: { start: { sheetId: sheetId,
        rowIndex: range.updateRow - 1, columnIndex: 0 },
        rows: rows, fields: "userEnteredValue" } };
    }
    return { appendCells: { sheetId: sheetId, fields: "userEnteredValue", rows: rows } };
  });
  return { requests: requests };
}

function expenseCorrectionBounds_(plan) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, ranges;
  try { ranges = expenseCorrectionValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "CORRECTION_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  c.WRITE_SURFACES.forEach(function(name) { sentinel[name] = 2147483647; });
  var body;
  try { body = expenseCorrectionBatchBody_(ranges, sentinel); }
  catch (error) { return { ok: false, detail: "UNSAFE_BATCH:" + error.message }; }
  var bytes = expenseSingleCommitUtf8Bytes_(JSON.stringify(body)) +
    EXPENSE_SINGLE_COMMIT_V1.REQUEST_OVERHEAD_BYTES;
  var planJson = "";
  try { planJson = JSON.stringify(plan); }
  catch (error) { return { ok: false, detail: "PLAN_JSON_INVALID" }; }
  if (planJson.length > EXPENSE_SINGLE_COMMIT_V1.MAX_CELL_CHARS) {
    return { ok: false, detail: "UNSAFE_PLAN_CELL_CHARS:" + planJson.length };
  }
  var ok = cells <= EXPENSE_SINGLE_COMMIT_V1.MAX_BATCH_CELLS &&
    bytes <= EXPENSE_SINGLE_COMMIT_V1.MAX_REQUEST_BYTES;
  return { ok: ok, cells: cells, bytes: bytes, planChars: planJson.length,
    detail: ok ? "" : "BATCH_BOUNDS cells=" + cells + " bytes=" + bytes };
}

// Exact artifact verification against the frozen plan over the three
// surfaces. NONE / PARTIAL / CONFLICT / EXACT / UNKNOWN. The original is
// verified in BOTH its pre-state (frozen content) and its post-lifecycle
// state; the append-only reversal + Logs marker must match the plan exactly.
function expenseCorrectionInspect_(plan, ss) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, save = EXPENSE_SINGLE_COMMIT_V1,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var tabops, ledger, logs, ops;
  try {
    tabops = readCanonicalTable(ss, "tabops", CANONICAL_ENTRY.EXPENSE_HEADERS);
    ledger = readCanonicalTable(ss, "BalanceLedger", ledgerHeaders);
    logs = readCanonicalTable(ss, "Logs", CANONICAL_ENTRY.LOG_HEADERS);
    ops = expenseCorrectionOperationRows_(ss);
  } catch (error) {
    return { state: "UNKNOWN", detail: "READBACK_FAILED:" + error.message };
  }
  var conflicts = [], missing = [];
  var lifecycleApplied = false;
  var rows = tabops.filter(function(row) {
    return String(row.ID_Trx) === plan.targetID;
  });
  if (rows.length !== 1) {
    conflicts.push(rows.length ? "TARGET_ROW_DUPLICATE" : "TARGET_ROW_MISSING");
  } else if (rows[0].sourceRowIndex + 1 !== Number(plan.lifecycle.rowNumber)) {
    conflicts.push("TARGET_ROW_DRIFT");
  } else {
    var post = expenseSingleCommitRowExact_(rows[0], plan.lifecycle.afterRow,
      CANONICAL_ENTRY.EXPENSE_HEADERS);
    var pre = expenseSingleCommitRowExact_(rows[0], plan.target.row,
      CANONICAL_ENTRY.EXPENSE_HEADERS);
    if (post) lifecycleApplied = true;
    else if (!pre) conflicts.push("TARGET_ROW_TAMPERED");
  }
  // Save lineage must remain the immutable authority this plan reverses.
  var saveOps = ops.filter(function(op) {
    return String(op.OperationType) === save.OPERATION_TYPE &&
      String(op.BusinessID) === plan.targetID;
  });
  if (saveOps.length !== 1 || String(saveOps[0].State) !== "COMMITTED") {
    conflicts.push("SAVE_LINEAGE_MISSING");
  } else {
    var lineagePlan = null;
    try { lineagePlan = JSON.parse(String(saveOps[0].OperationPlan || "")); }
    catch (error) { lineagePlan = null; }
    if (!lineagePlan || transactionPayloadHash_(lineagePlan) !== plan.targetEvidence.savePlan) {
      conflicts.push("SAVE_LINEAGE_TAMPERED");
    }
  }
  // Reversal journal identity + exactness.
  var reversalById = ledger.filter(function(row) {
    return String(row.JournalID) === plan.reversalJournalID;
  });
  var reversalBySource = reversalById.filter(function(row) {
    return String(row.SourceID) === plan.targetID &&
      String(row.SourceType) === plan.sourceType &&
      String(row.MovementType) === plan.movementType;
  });
  if (reversalById.length || reversalBySource.length) {
    var idSet = reversalById.map(function(row) { return String(row.LineID); }).sort().join("");
    var sourceSet = reversalBySource.map(function(row) { return String(row.LineID); }).sort().join("");
    if (idSet !== sourceSet) conflicts.push("REVERSAL_IDENTITY_CROSSOVER");
    if (reversalBySource.length === 2) {
      var sorted = reversalBySource.slice().sort(function(left, right) {
        return String(left.LineID) < String(right.LineID) ? -1 : 1;
      });
      for (var i = 0; i < 2; i++) {
        if (!expenseSingleCommitRowExact_(sorted[i], plan.reversalJournalRows[i],
            ledgerHeaders)) {
          conflicts.push("REVERSAL_JOURNAL_TAMPERED");
        }
      }
      if (policyCJournalSignature_(reversalBySource) !== plan.reversalJournalSignature) {
        conflicts.push("REVERSAL_JOURNAL_SIGNATURE_MISMATCH");
      }
      var debit = 0, credit = 0;
      reversalBySource.forEach(function(row) {
        debit += Number(row.Debit); credit += Number(row.Credit);
      });
      if (!(debit === credit && debit === Number(plan.amount))) {
        conflicts.push("REVERSAL_JOURNAL_BALANCE_MISMATCH");
      }
    } else if (reversalBySource.length === 1) {
      var only = reversalBySource[0], planned = null;
      plan.reversalJournalRows.forEach(function(row) {
        if (String(row.LineID) === String(only.LineID)) planned = row;
      });
      if (!planned || !expenseSingleCommitRowExact_(only, planned, ledgerHeaders)) {
        conflicts.push("REVERSAL_JOURNAL_TAMPERED");
      } else missing.push("REVERSAL_JOURNAL_LINE");
    } else if (reversalBySource.length === 0) missing.push("REVERSAL_JOURNAL_LINE");
    else conflicts.push("REVERSAL_JOURNAL_DUPLICATE");
  } else missing.push("REVERSAL_JOURNAL");
  // No foreign journal may claim the target's source identity.
  ledger.forEach(function(row) {
    if (String(row.SourceType) === plan.sourceType &&
        String(row.SourceID) === plan.targetID &&
        String(row.JournalID) !== plan.target.originalJournalID &&
        String(row.JournalID) !== plan.reversalJournalID) {
      conflicts.push("FOREIGN_JOURNAL_CLAIM");
    }
  });
  // Cancel / correction marker (append-only Logs event authority).
  var auditById = logs.filter(function(row) { return row.ID_Log === plan.auditID; });
  if (auditById.length) {
    if (auditById.length > 1) conflicts.push("AUDIT_DUPLICATE");
    else if (!expenseSingleCommitRowExact_(auditById[0], plan.auditRow,
        CANONICAL_ENTRY.LOG_HEADERS)) {
      conflicts.push("AUDIT_TAMPERED");
    }
  } else missing.push("AUDIT");
  // Nothing written yet (intent only) — the resume path applies the frozen
  // plan exactly once; checked before the replacement branches so a CORRECT
  // plan with zero artifacts classifies NONE, never PARTIAL.
  if (!lifecycleApplied && !reversalById.length && !auditById.length) {
    return { state: "NONE", detail: "NO_ARTIFACTS" };
  }
  // Replacement sections (CORRECT).
  var replacement = plan.replacement;
  if (replacement) {
    var repRows = tabops.filter(function(row) {
      return String(row.ID_Trx) === replacement.entryID;
    });
    if (repRows.length !== 1) {
      if (repRows.length) conflicts.push("REPLACEMENT_ROW_DUPLICATE");
      else missing.push("REPLACEMENT_ROW");
    } else if (!expenseSingleCommitRowExact_(repRows[0], replacement.businessRow,
        CANONICAL_ENTRY.EXPENSE_HEADERS)) {
      conflicts.push("REPLACEMENT_ROW_TAMPERED");
    }
    var repJournal = ledger.filter(function(row) {
      return String(row.JournalID) === replacement.journalID;
    });
    var repJournalBySource = repJournal.filter(function(row) {
      return String(row.SourceID) === replacement.entryID &&
        String(row.SourceType) === save.SOURCE_TYPE;
    });
    if (repJournal.length !== 2 || repJournalBySource.length !== 2) {
      if (!repJournal.length && !repJournalBySource.length) missing.push("REPLACEMENT_JOURNAL");
      else if (repJournal.length === 1 || repJournalBySource.length === 1) {
        missing.push("REPLACEMENT_JOURNAL_LINE");
      } else conflicts.push("REPLACEMENT_JOURNAL_DUPLICATE");
    } else {
      var repSorted = repJournalBySource.slice().sort(function(left, right) {
        return String(left.LineID) < String(right.LineID) ? -1 : 1;
      });
      for (var j = 0; j < 2; j++) {
        if (!expenseSingleCommitRowExact_(repSorted[j], replacement.journalRows[j],
            ledgerHeaders)) {
          conflicts.push("REPLACEMENT_JOURNAL_TAMPERED");
        }
      }
      if (policyCJournalSignature_(repJournalBySource) !== replacement.journalSignature) {
        conflicts.push("REPLACEMENT_JOURNAL_SIGNATURE_MISMATCH");
      }
    }
    var repAudit = logs.filter(function(row) { return row.ID_Log === replacement.auditID; });
    if (repAudit.length !== 1) {
      if (!repAudit.length) missing.push("REPLACEMENT_AUDIT");
      else conflicts.push("REPLACEMENT_AUDIT_DUPLICATE");
    } else if (!expenseSingleCommitRowExact_(repAudit[0], replacement.auditRow,
        CANONICAL_ENTRY.LOG_HEADERS)) {
      conflicts.push("REPLACEMENT_AUDIT_TAMPERED");
    }
    if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
    if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
    if (!lifecycleApplied) return { state: "PARTIAL", detail: "LIFECYCLE" };
    return { state: "EXACT", detail: "" };
  }
  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  var present = lifecycleApplied || reversalById.length || auditById.length;
  if (!present) return { state: "NONE", detail: "NO_ARTIFACTS" };
  if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
  if (!lifecycleApplied) return { state: "PARTIAL", detail: "LIFECYCLE" };
  return { state: "EXACT", detail: "" };
}

// Pre-batch guard: the frozen plan's original row must still exist exactly
// at its planned row (append-only sheets keep row numbers stable). A drifted
// or externally changed target fails closed BEFORE any batch — the frozen
// plan is never re-planned against changed rows.
function expenseCorrectionRowGuard_(plan, ss) {
  var tabops;
  try {
    tabops = readCanonicalTable(ss, "tabops", CANONICAL_ENTRY.EXPENSE_HEADERS);
  } catch (error) { return { ok: false, detail: "READ_FAILED:" + error.message }; }
  var rows = tabops.filter(function(row) {
    return String(row.ID_Trx) === plan.targetID;
  });
  if (rows.length !== 1) return { ok: false, detail: "ROW_COUNT:" + rows.length };
  if (rows[0].sourceRowIndex + 1 !== Number(plan.lifecycle.rowNumber)) {
    return { ok: false, detail: "ROW_DRIFT" };
  }
  if (!expenseSingleCommitRowExact_(rows[0], plan.target.row, CANONICAL_ENTRY.EXPENSE_HEADERS)) {
    return { ok: false, detail: "ROW_CHANGED" };
  }
  return { ok: true, detail: "" };
}

function expenseCorrectionOutcome_(plan, status, fields) {
  return expenseCorrectionResult_(status, Object.assign({
    requestKey: plan.requestKey, operationID: plan.operationID, targetID: plan.targetID,
    replacementID: plan.replacement ? plan.replacement.entryID : ""
  }, fields || {}));
}

// Batch -> exact inspect -> COMMITTED + exact readback. Never retries a
// failed batch inside one call; an unknown outcome is inspected once and, if
// unresolved, reported as UNKNOWN with the request identity preserved.
function expenseCorrectionApplyBatch_(plan, operation, runtime) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, codes = c.CODES;
  function outcome(status, fields) {
    return expenseCorrectionOutcome_(plan, status, fields);
  }
  var guard = expenseCorrectionRowGuard_(plan, runtime.spreadsheet);
  if (!guard.ok) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, detail: "TARGET_ROW_" + guard.detail,
        writeCount: "UNKNOWN" });
  }
  var ranges = null;
  try { ranges = expenseCorrectionValueRanges_(plan); }
  catch (error) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message, writeCount: "UNKNOWN" });
  }
  var rows = 0;
  ranges.forEach(function(range) { rows += range.values.length; });
  if (runtime.crash) runtime.crash("EXPENSE_CORR_BEFORE_BATCH");
  var batchError = null;
  try { runtime.batch(ranges); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("EXPENSE_CORR_AFTER_BATCH");
  var inspection = expenseCorrectionInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(c.STATUS.UNKNOWN,
      { code: codes.READBACK_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "NONE" && batchError) {
    return outcome(c.STATUS.UNKNOWN,
      { code: codes.BATCH_OUTCOME_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state !== "EXACT") {
    return outcome(c.STATUS.RECOVERY_REQUIRED, {
      code: inspection.state === "CONFLICT" ?
        (inspection.detail.indexOf("SIGNATURE") !== -1 ?
          codes.ARTIFACTS_INCOMPLETE : codes.IDENTITY_CONFLICT) :
        codes.ARTIFACTS_INCOMPLETE,
      writeCount: "UNKNOWN", detail: inspection.state + ":" + inspection.detail });
  }
  if (runtime.crash) runtime.crash("EXPENSE_CORR_AFTER_READBACK");
  if (runtime.crash) runtime.crash("EXPENSE_CORR_BEFORE_COMMIT");
  var commit = expenseSingleCommitCommit_(operation, runtime);
  if (!commit.ok) {
    return outcome(commit.status, { code: commit.code, writeCount: rows, detail: commit.detail });
  }
  if (runtime.crash) runtime.crash("EXPENSE_CORR_AFTER_COMMIT");
  return outcome(c.STATUS.DONE, { writeCount: rows });
}

// Resume path: exact (OperationType, RequestKey) lookup hit. Digest +
// normalized structure + shape + state + schema + stored bounds, then exact
// artifact inspection. NEVER re-evaluates admission (a later PAUSED config
// cannot block recovery of a persisted intent — T11.7 §3).
function expenseCorrectionResume_(operationType, operation, hash, normalized, runtime) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, codes = c.CODES;
  function outcome(status, fields) {
    return expenseCorrectionResult_(status, Object.assign({
      requestKey: normalized.requestKey, operationID: operation.OperationID || "",
      targetID: operation.BusinessID || ""
    }, fields || {}));
  }
  if (operation.OperationType !== operationType || !operation.BusinessID ||
      operation.RequestKey !== normalized.requestKey || operation.PayloadHash !== hash) {
    return outcome(c.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT });
  }
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); }
  catch (error) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: "PLAN_JSON:" + error.message });
  }
  if (!plan || plan.requestKey !== normalized.requestKey || plan.payloadHash !== hash ||
      plan.operationID !== operation.OperationID ||
      plan.businessID !== operation.BusinessID ||
      plan.targetID !== normalized.transactionId) {
    return outcome(c.STATUS.CONFLICT,
      { code: codes.OPERATION_PAYLOAD_CONFLICT, detail: "PLAN_IDENTITY_MISMATCH" });
  }
  if (!plan.normalizedPayload ||
      JSON.stringify(plan.normalizedPayload) !== JSON.stringify(normalized)) {
    return outcome(c.STATUS.CONFLICT,
      { code: codes.OPERATION_PAYLOAD_CONFLICT, detail: "NORMALIZED_PAYLOAD_MISMATCH" });
  }
  var verify;
  try { verify = expenseCorrectionVerifyPlan_(plan); }
  catch (error) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  if (!verify.ok) {
    return outcome(c.STATUS.RECOVERY_REQUIRED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason });
  }
  if (operation.State !== "IN_PROGRESS" && operation.State !== "COMMITTED") {
    return outcome(c.STATUS.RECOVERY_REQUIRED, {
      code: codes.INVALID_OPERATION_STATE, detail: "STATE:" + String(operation.State) });
  }
  var schema = expenseSingleCommitSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(",") });
  }
  var bounds = expenseCorrectionBounds_(plan);
  if (!bounds.ok) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail });
  }
  var inspection = expenseCorrectionInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(c.STATUS.UNKNOWN,
      { code: codes.READBACK_UNKNOWN, detail: inspection.detail });
  }
  var closedCode = inspection.state === "CONFLICT" ?
    (inspection.detail.indexOf("SIGNATURE") !== -1 ?
      codes.ARTIFACTS_INCOMPLETE : codes.IDENTITY_CONFLICT) :
    codes.ARTIFACTS_INCOMPLETE;
  if (inspection.state === "EXACT") {
    if (operation.State === "COMMITTED") {
      if (runtime.crash) runtime.crash("EXPENSE_CORR_AFTER_COMMIT");
      return outcome(c.STATUS.DONE, { replay: true, writeCount: 0,
        targetID: plan.targetID,
        replacementID: plan.replacement ? plan.replacement.entryID : "" });
    }
    if (runtime.crash) runtime.crash("EXPENSE_CORR_AFTER_READBACK");
    if (runtime.crash) runtime.crash("EXPENSE_CORR_BEFORE_COMMIT");
    var commit = expenseSingleCommitCommit_(operation, runtime);
    if (!commit.ok) {
      return outcome(commit.status, { code: commit.code, detail: commit.detail });
    }
    if (runtime.crash) runtime.crash("EXPENSE_CORR_AFTER_COMMIT");
    return outcome(c.STATUS.DONE, { replay: true, writeCount: 0,
      targetID: plan.targetID,
      replacementID: plan.replacement ? plan.replacement.entryID : "" });
  }
  if (operation.State === "COMMITTED") {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: closedCode, detail: inspection.detail });
  }
  if (inspection.state === "NONE") {
    return expenseCorrectionApplyBatch_(plan, operation, runtime);
  }
  return outcome(c.STATUS.RECOVERY_REQUIRED,
    { code: closedCode, detail: inspection.detail });
}

// New-intent path (outer lock held, lookup returned absent). Admission first
// (ACTIVE only, fail closed, zero writes), then schema/account/target
// eligibility, complete immutable plan freeze, bounds, durable IN_PROGRESS
// intent + exact ten-field readback, then the ONE atomic batch.
function expenseCorrectionNewIntent_(operationType, normalized, hash, runtime) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, save = EXPENSE_SINGLE_COMMIT_V1,
    codes = c.CODES;
  function outcome(status, fields) {
    return expenseCorrectionResult_(status,
      Object.assign({ requestKey: normalized.requestKey, targetID: normalized.transactionId },
        fields || {}));
  }
  var gate = runtime.gate === undefined || runtime.gate === null ?
    expenseSingleCommitGate_(runtime) : runtime.gate;
  if (gate.mode !== "ACTIVE") {
    return outcome(c.STATUS.REFUSED, {
      code: gate.code || codes.CORRECTION_NOT_ACTIVE,
      detail: gate.detail || "SINGLE_COMMIT_NOT_ACTIVE" });
  }
  var schema = expenseSingleCommitSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(c.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(",") });
  }
  var accountRows;
  try {
    accountRows = readCanonicalTable(runtime.spreadsheet, "Accounts",
      CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  } catch (error) {
    return outcome(c.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: "ACCOUNTS:" + error.message });
  }
  // T11.2 §11: 1040 precondition for every correction (the reversal moves
  // 1040). Absent/duplicate/inactive/mismatched => REFUSED zero writes; no
  // fallback to 1000/1010/1020/1030.
  var moneyPreflight = preflightSingleCommitMoneyAccount(accountRows);
  if (moneyPreflight.status !== "PASS") {
    var moneyError = moneyPreflight.errors[0] || {};
    return outcome(c.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED,
      field: moneyError.accountCode || c.MONEY_ACCOUNT_CODE,
      detail: "MONEY_ACCOUNT_PREFLIGHT_FAILED:" + String(moneyError.code || "") });
  }
  var resolved = expenseCorrectionResolveTarget_(operationType, normalized, runtime);
  if (!resolved.ok) {
    return outcome(c.STATUS.REFUSED, { code: resolved.code, detail: resolved.detail });
  }
  var target = resolved.target;
  var accountMap = buildCanonicalMasterMap(accountRows, "AccountCode", "Accounts");
  var originalAccount = accountMap[target.expenseAccount];
  if (!originalAccount || !isCanonicalActive(originalAccount.IsActive)) {
    return outcome(c.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED, field: target.expenseAccount,
      detail: "ORIGINAL_EXPENSE_ACCOUNT_INACTIVE" });
  }
  var now = runtime.now();
  var economicDate = capitalEquityDateKey(now);
  if (!economicDate) {
    return outcome(c.STATUS.REFUSED, { code: codes.PAYLOAD_INVALID,
      detail: "ACTION_DATE_INVALID" });
  }
  var operationID = transactionOperationID_(operationType, normalized.requestKey);
  var input = { operationType: operationType, requestKey: normalized.requestKey,
    normalized: normalized, hash: hash, target: target,
    targetEvidence: resolved.targetEvidence, actor: runtime.actor(), now: now,
    economicDate: economicDate, operationID: operationID,
    auditID: "LOG-ENTRY-" + runtime.uuid() };
  if (operationType === c.CORRECT) {
    // Replacement resolved ONCE for this intent (accounts re-derived here,
    // then frozen in the plan); retries use the stored plan and never
    // re-read masters.
    var items = runtime.items || readCanonicalTable(runtime.spreadsheet,
      "ExpenseItems", save.ITEM_HEADERS);
    var replacementTimestamp = normalized.expenseDate ?
      new Date(normalized.expenseDate + "T00:00:00+07:00") : now;
    var replacementEconomicDate = capitalEquityDateKey(replacementTimestamp);
    if (!replacementEconomicDate) {
      return outcome(c.STATUS.REFUSED,
        { code: codes.PAYLOAD_INVALID, detail: "REPLACEMENT_DATE_INVALID" });
    }
    var replacementEntry;
    try {
      replacementEntry = prepareCanonicalExpenseEntry(
        { expenseItemId: normalized.expenseItemId, amount: normalized.amount },
        { timestamp: replacementTimestamp, expenseItems: items, accounts: accountRows });
    } catch (error) {
      return outcome(c.STATUS.REFUSED, {
        code: error.expenseSingleCommitCode || error.entryCode || codes.ACCOUNT_PREFLIGHT_FAILED,
        field: error.entryField || error.field || "expenseItemId",
        detail: error.message });
    }
    var itemRow = items.filter(function(row) {
      return String(row.ID_Ops).trim() === replacementEntry.expenseItemId;
    })[0];
    var replacementAccountCode = itemRow ? String(itemRow.AccountCode || "").trim() : "";
    if (!replacementAccountCode) {
      return outcome(c.STATUS.REFUSED, {
        code: codes.ACCOUNT_PREFLIGHT_FAILED, field: "expenseItemId",
        detail: "REPLACEMENT_EXPENSE_ACCOUNT_CODE_MISSING" });
    }
    var replacementAccount = accountMap[replacementAccountCode];
    if (!replacementAccount || !isCanonicalActive(replacementAccount.IsActive)) {
      return outcome(c.STATUS.REFUSED, {
        code: codes.ACCOUNT_PREFLIGHT_FAILED, field: replacementAccountCode,
        detail: "REPLACEMENT_EXPENSE_ACCOUNT_INACTIVE" });
    }
    var replacementEntryID = transactionStableBusinessID_("OPS-APP-", operationType,
      normalized.requestKey);
    var replacementJournalID = save.JOURNAL_ID_PREFIX + replacementEntryID;
    var replacementNowISO = replacementTimestamp.toISOString();
    var replacementJournalRows = [
      { JournalID: replacementJournalID, LineID: replacementJournalID + "-1",
        Tanggal: replacementEconomicDate, AccountCode: replacementAccountCode,
        Debit: normalized.amount, Credit: 0, MovementType: save.MOVEMENT_TYPE,
        SourceType: save.SOURCE_TYPE, SourceID: replacementEntryID,
        ExternalRef: "", Keterangan: "", IsActive: true,
        CreatedAt: replacementNowISO, CreatedBy: input.actor,
        UpdatedAt: replacementNowISO, UpdatedBy: input.actor },
      { JournalID: replacementJournalID, LineID: replacementJournalID + "-2",
        Tanggal: replacementEconomicDate, AccountCode: c.MONEY_ACCOUNT_CODE,
        Debit: 0, Credit: normalized.amount, MovementType: save.MOVEMENT_TYPE,
        SourceType: save.SOURCE_TYPE, SourceID: replacementEntryID,
        ExternalRef: "", Keterangan: "", IsActive: true,
        CreatedAt: replacementNowISO, CreatedBy: input.actor,
        UpdatedAt: replacementNowISO, UpdatedBy: input.actor }
    ];
    var replacementBusinessRow = {
      ID_Trx: replacementEntryID, Tanggal: replacementTimestamp,
      ID_Ops: replacementEntry.expenseItemId, Nilai: normalized.amount,
      Source: CANONICAL_ENTRY.SOURCE, IsActive: true,
      CreatedAt: replacementTimestamp, CreatedBy: CANONICAL_ENTRY.USER,
      UpdatedAt: "", UpdatedBy: ""
    };
    var replacementAuditID = "LOG-ENTRY-" + runtime.uuid();
    var replacementAuditRow = {
      ID_Log: replacementAuditID, Timestamp: now, Level: "INFO",
      Module: c.AUDIT_MODULE, Action: c.AUDIT_ACTIONS.CORRECT_CREATE,
      RecordID: replacementEntryID, User: CANONICAL_ENTRY.USER,
      Message: "Single-commit expense correction replacement recorded.",
      Metadata: JSON.stringify({ reason: normalized.reason,
        requestKey: normalized.requestKey, operationID: operationID,
        originalId: target.transactionId, transactionType: "EXPENSE",
        singleCommit: true })
    };
    input.replacement = {
      entryID: replacementEntryID, amount: normalized.amount,
      economicDate: replacementEconomicDate, timestamp: replacementTimestamp,
      expenseItem: { expenseItemId: replacementEntry.expenseItemId,
        item: replacementEntry.item, category: replacementEntry.category,
        kind: replacementEntry.kind, group: replacementEntry.group,
        accountCode: replacementAccountCode },
      businessRow: replacementBusinessRow, journalID: replacementJournalID,
      journalRows: replacementJournalRows,
      journalSignature: policyCJournalSignature_(replacementJournalRows),
      auditID: replacementAuditID, auditRow: replacementAuditRow
    };
  }
  var plan;
  try { plan = expenseCorrectionPlan_(operationType, input); }
  catch (error) {
    return outcome(c.STATUS.REFUSED,
      { code: codes.PLAN_MALFORMED, detail: "PLAN_BUILD:" + error.message });
  }
  var verify;
  try { verify = expenseCorrectionVerifyPlan_(plan); }
  catch (error) {
    return outcome(c.STATUS.REFUSED,
      { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  if (!verify.ok) {
    return outcome(c.STATUS.REFUSED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason });
  }
  var bounds = expenseCorrectionBounds_(plan);
  if (!bounds.ok) {
    return outcome(c.STATUS.REFUSED,
      { code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail });
  }
  if (runtime.crash) runtime.crash("EXPENSE_CORR_BEFORE_INTENT");
  var operation;
  try {
    operation = transactionResolveOperation_(runtime.repository, operationType,
      normalized.requestKey, hash, plan.businessID, plan, runtime.now());
  } catch (error) {
    return outcome(error.code === "OPERATION_PAYLOAD_CONFLICT" ?
      c.STATUS.CONFLICT : c.STATUS.RECOVERY_REQUIRED, {
      code: error.code === "OPERATION_PAYLOAD_CONFLICT" ?
        codes.OPERATION_PAYLOAD_CONFLICT : codes.DUPLICATE_OPERATION_EVIDENCE,
      detail: error.message });
  }
  if (runtime.crash) runtime.crash("EXPENSE_CORR_AFTER_INTENT_PERSIST");
  var readback = null;
  try { readback = runtime.repository.findOperation(operationType, normalized.requestKey); }
  catch (error) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, detail: "INTENT_READBACK_FAILED:" + error.message });
  }
  if (!readback) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, detail: "INTENT_ROW_MISSING" });
  }
  if (readback.State !== "IN_PROGRESS" ||
      !expenseSingleCommitFieldsExact_(readback, operation,
        TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS)) {
    var mismatch = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS.filter(function(header) {
      return !expenseSingleCommitFieldEqual_(readback[header], operation[header]);
    });
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, detail: "INTENT_ROW_MISMATCH:" + mismatch.join(",") });
  }
  if (runtime.crash) runtime.crash("EXPENSE_CORR_AFTER_INTENT");
  return expenseCorrectionApplyBatch_(plan, operation, runtime);
}

// Durable correction core. Fixed order: normalize -> exact (OperationType,
// RequestKey) lookup BEFORE any mutable target read -> resume or new intent.
// Never acquires a lock (the public entry owns the single outer ScriptLock).
function expenseCorrectionRun_(operationType, normalized, runtime) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, codes = c.CODES;
  var existing = null;
  try {
    existing = runtime.repository.findOperation(operationType, normalized.requestKey);
  } catch (error) {
    return expenseCorrectionResult_(c.STATUS.RECOVERY_REQUIRED, {
      code: error && error.message === "DUPLICATE_OPERATION" ?
        codes.DUPLICATE_OPERATION_EVIDENCE : codes.IDENTITY_CONFLICT,
      requestKey: normalized.requestKey,
      detail: error && error.message ? error.message : "" });
  }
  var hash = transactionPayloadHash_(normalized);
  var result = existing ?
    expenseCorrectionResume_(operationType, existing, hash, normalized, runtime) :
    expenseCorrectionNewIntent_(operationType, normalized, hash, runtime);
  if (result.status === c.STATUS.DONE && typeof runtime.invalidate === "function") {
    try { runtime.invalidate(); }
    catch (cacheError) {
      Logger.log("Expense correction post-commit cache invalidation skipped: " +
        String(cacheError && cacheError.message || cacheError));
    }
  }
  return result;
}

// Dispatcher seam: normalize first (definite refusals write zero), then the
// durable core over the already-assembled runtime. An unresolved gate is
// resolved from the DISPATCHER runtime (which owns the injected
// single-commit config seam) exactly once here; production dispatchers
// without the seam fall through to the read-only config property.
function expenseCorrectionDispatch_(operationType, payload, ss, dispatcherRuntime, gate) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION;
  var normalized;
  try { normalized = expenseCorrectionNormalize_(operationType, payload); }
  catch (error) {
    return expenseCorrectionResult_(c.STATUS.REFUSED, {
      code: error.expenseSingleCommitCode || c.CODES.PAYLOAD_INVALID,
      requestKey: expenseCorrectionPayloadKey_(payload),
      field: error.field || "", detail: error.message });
  }
  if (gate === undefined || gate === null) {
    gate = expenseSingleCommitGate_(dispatcherRuntime);
  }
  var core;
  try {
    core = expenseSingleCommitCoreRuntime_(ss, dispatcherRuntime, null, gate);
  } catch (error) {
    return expenseCorrectionResult_(c.STATUS.REFUSED, {
      code: c.CODES.CORRECTION_RUNTIME_UNAVAILABLE, requestKey: normalized.requestKey,
      detail: "RUNTIME_UNAVAILABLE:" + String(error && error.message || error) });
  }
  try {
    return expenseCorrectionRun_(operationType, normalized, core);
  } catch (error) {
    var identity = { requestKey: normalized.requestKey, operationID: "" };
    try {
      var pending = core.repository.findOperation(operationType, normalized.requestKey);
      if (pending) identity.operationID = pending.OperationID;
    } catch (lookupError) { /* requestKey remains the recoverable identity */ }
    return expenseCorrectionResult_(c.STATUS.UNKNOWN, Object.assign({
      code: c.CODES.CORRECTION_EXECUTION_UNKNOWN,
      detail: String(error && error.message || error),
      targetID: normalized.transactionId
    }, identity));
  }
}

// Production transport: ONE spreadsheets.batchUpdate (appendCells +
// updateCells subrequests) over the correction's own write surfaces. The
// single batchUpdate is atomic; intent/batch/readback/commit remain
// multistep — no database-global atomicity is claimed.
function expenseCorrectionBatchRequest_(valueRanges) {
  var sheetIds = expenseSingleCommitSheetIdsRequest_();
  var body = expenseCorrectionBatchBody_(valueRanges, sheetIds);
  return inventoryReceiptMigrationRequest_("post", ":batchUpdate", body);
}

// Public operator entries: the ONLY outer lock, acquired BEFORE
// normalize/lookup and released exactly once. Lock or runtime failure happens
// before any durable intent (definite REFUSED); only post-intent execution
// uncertainty is UNKNOWN. Zero production invocation in local tests.
function expenseCorrectionPublic_(operationType, payload) {
  var c = EXPENSE_SINGLE_COMMIT_CORRECTION, codes = c.CODES;
  var requestKey = expenseCorrectionPayloadKey_(payload);
  var ss = null, dispatcher = null, gate = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    dispatcher = {
      now: function() { return new Date(); },
      uuid: function() { return Utilities.getUuid(); },
      flush: function() { SpreadsheetApp.flush(); },
      invalidate: function() { invalidateDashboardCache(); },
      expenseSingleCommit: { batch: function(ranges) {
        return expenseCorrectionBatchRequest_(ranges);
      } }
    };
    gate = expenseSingleCommitGate_(dispatcher);
  } catch (error) {
    return expenseCorrectionResult_(c.STATUS.REFUSED, {
      code: codes.CORRECTION_RUNTIME_UNAVAILABLE, requestKey: requestKey,
      detail: String(error && error.message || error) });
  }
  var lock = null, acquired = false;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return expenseCorrectionResult_(c.STATUS.REFUSED, {
      code: codes.OUTER_LOCK_UNAVAILABLE, requestKey: requestKey,
      detail: String(error && error.message || error) });
  }
  try {
    return expenseCorrectionDispatch_(operationType, payload, ss, dispatcher, gate);
  } catch (error) {
    return expenseCorrectionResult_(c.STATUS.UNKNOWN, {
      code: codes.CORRECTION_EXECUTION_UNKNOWN, requestKey: requestKey,
      detail: String(error && error.message || error) });
  } finally {
    if (acquired) {
      try { lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
}

function expenseSingleCommitDurableVoid(payload) {
  return expenseCorrectionPublic_(EXPENSE_SINGLE_COMMIT_CORRECTION.VOID, payload);
}

function expenseSingleCommitDurableCorrect(payload) {
  return expenseCorrectionPublic_(EXPENSE_SINGLE_COMMIT_CORRECTION.CORRECT, payload);
}

// ---------------------------------------------------------------------------
// T11.8/U6 — Purchase corrections (T11.2 §10, T11.5 §26):
//   PURCHASE_EVENT_VOID   = Cancel
//   PURCHASE_EVENT_CORRECT = Correct
//
// One operator action -> one durable intent -> one outer lock -> ONE
// immutable plan -> ONE atomic batch per operation. Cancel appends the
// signed Policy C reversal pair (MovementType POLICY_C_REVERSAL via the
// frozen policyCReverseJournal shape: exact inverse Dr1040 / Cr6210 of the
// original journal, ExternalRef = original JournalID, bound to the original
// SourceID) + the canonical lifecycle marker (VOIDED + IsActive=false) + one
// signed Logs entry — all inside ONE atomic batch. Correct appends that full
// reversal + a complete replacement event (deterministic corr- identity,
// final PaymentStatus=PAID / CashAccountCode=1040 / AccountingStatus=POSTED,
// composed Dr6210/Cr1040 journal) with original lifecycle -> CORRECTED in
// the SAME plan and batch — never reverse() then replacementSave(). Original
// financial truth (PAID/1040/POSTED, amount, dates, keys, payload) is never
// edited; only the canonical Lifecycle/IsActive marker changes, atomically.
// No AP/2000, no Inventory, no 5000/1100, no Treasury, no payment-status
// change (backend-derived PAID only), no historical rewrite.
//
// Admission (NEW intents only): SINGLE_COMMIT_TRANSACTION_V1 must resolve
// ACTIVE (T11.7 §3 routing — ABSENT/PREPARED/PAUSED/REJECT/invalid refuse
// fail-closed, zero writes, never a legacy fallback). Persisted IN_PROGRESS
// intents resume from the frozen plan regardless of a later PAUSED config.
// ---------------------------------------------------------------------------
var PURCHASE_EVENT_CORRECTION = Object.freeze({
  VOID: "PURCHASE_EVENT_VOID",
  CORRECT: "PURCHASE_EVENT_CORRECT",
  OPERATION_TYPES: Object.freeze(["PURCHASE_EVENT_VOID", "PURCHASE_EVENT_CORRECT"]),
  PLAN_VERSION: 1,
  VOID_JOURNAL_ID_PREFIX: "POLICYC-PEXP-VOID-",
  CORRECT_JOURNAL_ID_PREFIX: "POLICYC-PEXP-CORRECT-",
  REVERSAL_MOVEMENT_TYPE: "POLICY_C_REVERSAL",
  REVERSAL_SOURCE_TYPE: "PURCHASE_EVENT",
  MONEY_ACCOUNT_CODE: "1040",
  DEBIT_ACCOUNT_CODE: "6210",
  AUDIT_MODULE: "TransactionLifecycle",
  AUDIT_ACTIONS: Object.freeze({
    VOID: "VOID_PURCHASE_SINGLE_COMMIT",
    CORRECT_VOID: "CORRECT_VOID_PURCHASE_SINGLE_COMMIT",
    CORRECT_CREATE: "CORRECT_CREATE_PURCHASE_SINGLE_COMMIT"
  }),
  WRITE_SURFACES: Object.freeze(["PurchaseEvents", "BalanceLedger", "Logs"]),
  ALLOWED_FIELDS: Object.freeze(["requestKey", "transactionId", "reason",
    "expenseItemId", "input", "supplierID"]),
  VOID_FIELDS: Object.freeze(["requestKey", "transactionId", "reason"]),
  STATUS: Object.freeze({
    DONE: "DONE",
    REFUSED: "REFUSED",
    CONFLICT: "CONFLICT",
    UNKNOWN: "UNKNOWN",
    RECOVERY_REQUIRED: "RECOVERY_REQUIRED"
  }),
  CODES: Object.freeze({
    PAYLOAD_INVALID: "PURCHASE_EVENT_CORRECTION_PAYLOAD_INVALID",
    PAYMENT_FIELD_REFUSED: "PURCHASE_EVENT_CORRECTION_PAYMENT_FIELD_REFUSED",
    FIELD_REFUSED: "PURCHASE_EVENT_CORRECTION_FIELD_REFUSED",
    REASON_INVALID: "PURCHASE_EVENT_CORRECTION_REASON_INVALID",
    SCHEMA_NOT_READY: "PURCHASE_EVENT_CORRECTION_SCHEMA_NOT_READY",
    ACCOUNT_PREFLIGHT_FAILED: "PURCHASE_EVENT_CORRECTION_ACCOUNT_PREFLIGHT_FAILED",
    CORRECTION_NOT_ACTIVE: "PURCHASE_EVENT_CORRECTION_NOT_ACTIVE",
    TARGET_NOT_FOUND: "PURCHASE_EVENT_CORRECTION_TARGET_NOT_FOUND",
    TARGET_NOT_SUPPORTED: "PURCHASE_EVENT_CORRECTION_TARGET_NOT_SUPPORTED",
    TARGET_ALREADY_VOIDED: "PURCHASE_EVENT_CORRECTION_TARGET_ALREADY_VOIDED",
    TARGET_ALREADY_CORRECTED: "PURCHASE_EVENT_CORRECTION_TARGET_ALREADY_CORRECTED",
    TARGET_NOT_CLEAN: "PURCHASE_EVENT_CORRECTION_TARGET_NOT_CLEAN",
    OPERATION_PAYLOAD_CONFLICT: "OPERATION_PAYLOAD_CONFLICT",
    DUPLICATE_OPERATION_EVIDENCE: "DUPLICATE_OPERATION_EVIDENCE",
    BATCH_BOUNDS_EXCEEDED: "PURCHASE_EVENT_CORRECTION_BATCH_BOUNDS_EXCEEDED",
    ARTIFACTS_INCOMPLETE: "PURCHASE_EVENT_CORRECTION_ARTIFACTS_INCOMPLETE",
    IDENTITY_CONFLICT: "PURCHASE_EVENT_CORRECTION_IDENTITY_CONFLICT",
    PLAN_MALFORMED: "PURCHASE_EVENT_CORRECTION_PLAN_MALFORMED",
    INTENT_READBACK_FAILED: "PURCHASE_EVENT_CORRECTION_INTENT_READBACK_FAILED",
    BATCH_OUTCOME_UNKNOWN: "PURCHASE_EVENT_CORRECTION_BATCH_OUTCOME_UNKNOWN",
    READBACK_UNKNOWN: "PURCHASE_EVENT_CORRECTION_READBACK_UNKNOWN",
    COMMIT_OUTCOME_UNKNOWN: "PURCHASE_EVENT_CORRECTION_COMMIT_OUTCOME_UNKNOWN",
    INVALID_OPERATION_STATE: "PURCHASE_EVENT_CORRECTION_INVALID_OPERATION_STATE",
    CORRECTION_EXECUTION_UNKNOWN: "PURCHASE_EVENT_CORRECTION_EXECUTION_UNKNOWN",
    OUTER_LOCK_UNAVAILABLE: "OUTER_LOCK_UNAVAILABLE",
    CORRECTION_RUNTIME_UNAVAILABLE: "PURCHASE_EVENT_CORRECTION_RUNTIME_UNAVAILABLE"
  })
});

function purchaseCorrectionResult_(status, fields) {
  return Object.assign({
    status: status, code: "", requestKey: "", operationID: "", targetID: "",
    replacementID: "", writeCount: 0, replay: false, field: "", detail: ""
  }, fields || {});
}

function purchaseCorrectionPayloadKey_(payload) {
  return payload && payload.requestKey !== undefined && payload.requestKey !== null ?
    String(payload.requestKey) : "";
}

// Pure normalization for a Purchase correction intent. Strict per-operation
// allowlist; payment/channel/evidence fields refuse before any read. CORRECT
// keys must satisfy the existing corr- contract (8-64, no corr- prefix) so
// the deterministic replacement key "corr-<requestKey>" stays legacy-valid.
function purchaseCorrectionNormalize_(operationType, payload) {
  var c = PURCHASE_EVENT_CORRECTION;
  var p = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  var keys = Object.keys(p);
  var payment = keys.filter(function(key) {
    return PURCHASE_SINGLE_COMMIT_V1.PAYMENT_FIELDS.indexOf(key) !== -1 &&
      p[key] !== undefined && p[key] !== null && String(p[key]).trim() !== "";
  });
  if (payment.length) {
    throw expenseSingleCommitError_(c.CODES.PAYMENT_FIELD_REFUSED, payment[0],
      "PAYMENT_FIELD_REFUSED:" + payment.join(","));
  }
  var allowed = operationType === c.VOID ? c.VOID_FIELDS : c.ALLOWED_FIELDS;
  var unknown = keys.filter(function(key) { return allowed.indexOf(key) === -1; });
  if (unknown.length) {
    throw expenseSingleCommitError_(c.CODES.FIELD_REFUSED, unknown[0],
      "FIELD_REFUSED:" + unknown.join(","));
  }
  var requestKey = p.requestKey === undefined || p.requestKey === null ?
    "" : String(p.requestKey).trim();
  if (!requestKey) {
    throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "requestKey",
      "REQUEST_KEY_REQUIRED");
  }
  if (operationType === c.CORRECT && !validatePurchaseCorrectionKey_(requestKey)) {
    throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "requestKey",
      "CORRECTION_KEY_INVALID");
  }
  if (operationType === c.VOID &&
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{3,127}$/.test(requestKey)) {
    throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "requestKey",
      "REQUEST_KEY_INVALID");
  }
  var transactionId = p.transactionId === undefined || p.transactionId === null ?
    "" : String(p.transactionId).trim();
  if (!transactionId) {
    throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "transactionId",
      "TRANSACTION_ID_REQUIRED");
  }
  var reason = typeof p.reason === "string" ? p.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500 || !/[A-Za-z0-9]/.test(reason)) {
    throw expenseSingleCommitError_(c.CODES.REASON_INVALID, "reason", "REASON_INVALID");
  }
  var normalized = { requestKey: requestKey, transactionId: transactionId,
    reason: reason };
  if (operationType === c.CORRECT) {
    var expenseItemId = p.expenseItemId === undefined || p.expenseItemId === null ?
      "" : String(p.expenseItemId).trim();
    if (!expenseItemId) {
      throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "expenseItemId",
        "EXPENSE_ITEM_REQUIRED");
    }
    if (!p.input || typeof p.input !== "object" || Array.isArray(p.input)) {
      throw expenseSingleCommitError_(c.CODES.PAYLOAD_INVALID, "input",
        "REPLACEMENT_INPUT_REQUIRED");
    }
    var supplierID = p.supplierID === undefined || p.supplierID === null ?
      "" : String(p.supplierID).trim();
    normalized.expenseItemId = expenseItemId;
    normalized.input = p.input;
    normalized.supplierID = supplierID;
  }
  return normalized;
}

// Eligibility + immutable target evidence for a Purchase correction. Genuine
// committed T11 single-commit lineage only (exact PURCHASE_SINGLE_COMMIT_SAVE
// operation + committed Policy C prospective journal); legacy/UNPAID/AP/
// historical events fail closed with a distinct zero-write code.
function purchaseCorrectionResolveTarget_(operationType, normalized, runtime) {
  var c = PURCHASE_EVENT_CORRECTION, save = PURCHASE_SINGLE_COMMIT_V1,
    codes = c.CODES, ss = runtime.spreadsheet;
  function refuse(code, detail) { return { ok: false, code: code, detail: detail }; }
  var ops;
  try { ops = expenseCorrectionOperationRows_(ss); }
  catch (error) { return refuse(codes.SCHEMA_NOT_READY, error.message); }
  var saveOps = ops.filter(function(op) {
    return String(op.OperationType) === save.OPERATION_TYPE &&
      String(op.BusinessID) === normalized.transactionId;
  });
  if (!saveOps.length) return refuse(codes.TARGET_NOT_SUPPORTED, "NOT_SINGLE_COMMIT");
  if (saveOps.length > 1) return refuse(codes.TARGET_NOT_SUPPORTED, "DUPLICATE_SAVE_OPS");
  var saveOp = saveOps[0];
  if (String(saveOp.State) !== "COMMITTED") {
    return refuse(codes.TARGET_NOT_SUPPORTED, "SAVE_STATE:" + String(saveOp.State));
  }
  var savePlan = null;
  try { savePlan = JSON.parse(String(saveOp.OperationPlan || "")); }
  catch (error) { return refuse(codes.TARGET_NOT_SUPPORTED, "SAVE_PLAN_JSON"); }
  if (!savePlan || typeof savePlan !== "object" || Array.isArray(savePlan) ||
      String(savePlan.entryID) !== normalized.transactionId) {
    return refuse(codes.TARGET_NOT_SUPPORTED, "SAVE_PLAN_MISMATCH");
  }
  // One active correction branch per original (same rule as Sales/Expense).
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    if (c.OPERATION_TYPES.indexOf(String(op.OperationType)) === -1) continue;
    if (String(op.OperationType) === operationType &&
        String(op.RequestKey) === normalized.requestKey) continue;
    var opPlan = null;
    try { opPlan = JSON.parse(String(op.OperationPlan || "")); }
    catch (error) { return refuse(codes.TARGET_NOT_CLEAN, "CORRECTION_PLAN_JSON"); }
    if (!opPlan || String(opPlan.targetID) !== normalized.transactionId) continue;
    return refuse(String(op.OperationType) === c.VOID ?
      codes.TARGET_ALREADY_VOIDED : codes.TARGET_ALREADY_CORRECTED,
      String(op.OperationType) + ":" + String(op.RequestKey) + ":" + String(op.State));
  }
  var events = null;
  try {
    events = readCanonicalTable(ss, "PurchaseEvents", PURCHASE_EVENT_POLICY.headers);
  } catch (error) { return refuse(codes.SCHEMA_NOT_READY, "PurchaseEvents:" + error.message); }
  var rows = events.filter(function(row) {
    return String(row.EventID) === normalized.transactionId;
  });
  if (!rows.length) return refuse(codes.TARGET_NOT_FOUND, "PURCHASE_EVENT");
  if (rows.length > 1) return refuse(codes.TARGET_NOT_CLEAN, "DUPLICATE_EVENT_ROW");
  var row = rows[0];
  if (row.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL ||
      !isCanonicalActive(row.IsActive)) {
    return refuse(String(row.Lifecycle) === PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED ?
      codes.TARGET_ALREADY_VOIDED :
      (String(row.Lifecycle) === PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED ?
        codes.TARGET_ALREADY_CORRECTED : codes.TARGET_NOT_CLEAN),
      "LIFECYCLE:" + String(row.Lifecycle));
  }
  // Financial truth of a T11 event: PAID / 1040 / POSTED exactly.
  if (String(row.PaymentStatus) !== save.PAYMENT_STATUS ||
      String(row.CashAccountCode) !== save.MONEY_ACCOUNT_CODE ||
      String(row.AccountingStatus) !== save.ACCOUNTING_STATUS) {
    return refuse(codes.TARGET_NOT_SUPPORTED, "PAYMENT_AUTHORITY");
  }
  var ledger = null;
  try {
    ledger = readCanonicalTable(ss, "BalanceLedger",
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  } catch (error) { return refuse(codes.SCHEMA_NOT_READY, "BalanceLedger:" + error.message); }
  var originalJournalID = String(savePlan.journalID);
  var journalRows = ledger.filter(function(r) {
    return String(r.JournalID) === originalJournalID;
  });
  var amount = Number(row.AcquisitionValue);
  var debitRow = journalRows.filter(function(r) {
    return String(r.AccountCode) === c.DEBIT_ACCOUNT_CODE &&
      Number(r.Debit) === amount && Number(r.Credit) === 0;
  })[0];
  var creditRow = journalRows.filter(function(r) {
    return String(r.AccountCode) === c.MONEY_ACCOUNT_CODE &&
      Number(r.Credit) === amount && Number(r.Debit) === 0;
  })[0];
  if (journalRows.length !== 2 || !debitRow || !creditRow ||
      String(debitRow.SourceType) !== save.SOURCE_TYPE ||
      String(debitRow.SourceID) !== normalized.transactionId ||
      String(debitRow.MovementType) !== save.MOVEMENT_TYPE ||
      String(creditRow.SourceType) !== save.SOURCE_TYPE ||
      String(creditRow.SourceID) !== normalized.transactionId ||
      !isFinite(amount) || amount <= 0 || Number(savePlan.amount) !== amount) {
    return refuse(codes.TARGET_NOT_CLEAN, "ORIGINAL_JOURNAL");
  }
  return { ok: true, target: {
    transactionId: normalized.transactionId,
    rowNumber: row.sourceRowIndex + 1,
    amount: amount,
    purchaseAccount: c.DEBIT_ACCOUNT_CODE,
    originalJournalID: originalJournalID,
    originalEconomicDate: String(debitRow.Tanggal),
    originalJournalRows: journalRows,
    saveOperationID: String(saveOp.OperationID),
    saveRequestKey: String(saveOp.RequestKey),
    row: row
  }, targetEvidence: {
    eventRow: transactionPayloadHash_(row),
    journal: transactionPayloadHash_(journalRows),
    savePlan: transactionPayloadHash_(savePlan)
  } };
}

// Immutable plan freeze: Policy C reversal pair (exact inverse, ACTION date,
// ExternalRef linkage) + canonical lifecycle marker + signed Logs marker +
// optional complete replacement (event row + composed journal + audit) — all
// derived once and owned by ONE plan digest.
function purchaseCorrectionPlan_(operationType, input) {
  var c = PURCHASE_EVENT_CORRECTION, save = PURCHASE_SINGLE_COMMIT_V1;
  var normalized = input.normalized, target = input.target,
    now = input.now, nowISO = now.toISOString();
  var journalIDPrefix = operationType === c.VOID ? c.VOID_JOURNAL_ID_PREFIX :
    c.CORRECT_JOURNAL_ID_PREFIX;
  var reversalJournalID = journalIDPrefix + target.transactionId;
  var reversal = policyCReverseJournal(target.originalJournalRows, reversalJournalID,
    input.economicDate, c.REVERSAL_SOURCE_TYPE, target.transactionId);
  if (reversal.status !== "READY" || !reversal.rows || reversal.rows.length !== 2) {
    throw expenseSingleCommitError_(c.CODES.TARGET_NOT_CLEAN, "",
      "REVERSAL_BUILD_FAILED:" + String(reversal.reason || reversal.status));
  }
  var reversalJournalRows = reversal.rows.map(function(row) {
    row.CreatedAt = nowISO; row.CreatedBy = input.actor;
    row.UpdatedAt = nowISO; row.UpdatedBy = input.actor;
    return row;
  });
  var reversalJournalSignature = policyCJournalSignature_(reversalJournalRows);
  var lifecycleRow = {};
  PURCHASE_EVENT_POLICY.headers.forEach(function(header) {
    lifecycleRow[header] = target.row[header];
  });
  lifecycleRow.Lifecycle = operationType === c.VOID ?
    PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED :
    PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED;
  lifecycleRow.IsActive = false;
  var auditAction = operationType === c.VOID ? c.AUDIT_ACTIONS.VOID :
    c.AUDIT_ACTIONS.CORRECT_VOID;
  var auditMetadata = { reason: normalized.reason,
    requestKey: normalized.requestKey, operationID: input.operationID,
    transactionType: "PURCHASE", singleCommit: true,
    targetJournalID: target.originalJournalID,
    reversalJournalID: reversalJournalID };
  if (input.replacement) {
    auditMetadata.replacementId = input.replacement.eventRow.EventID;
  }
  var auditRow = {
    ID_Log: input.auditID, Timestamp: now, Level: "INFO",
    Module: c.AUDIT_MODULE, Action: auditAction, RecordID: target.transactionId,
    User: CANONICAL_ENTRY.USER,
    Message: operationType === c.VOID ?
      "Single-commit purchase cancelled." :
      "Single-commit purchase correction reversal recorded.",
    Metadata: JSON.stringify(auditMetadata)
  };
  var plan = {
    planVersion: c.PLAN_VERSION, operationType: operationType,
    operationID: input.operationID, requestKey: normalized.requestKey,
    payloadHash: input.hash, normalizedPayload: normalized,
    targetID: target.transactionId,
    businessID: operationType === c.VOID ? target.transactionId : "",
    reason: normalized.reason, actor: input.actor, actionAt: nowISO,
    economicDate: input.economicDate, amount: target.amount,
    accounts: { purchase: c.DEBIT_ACCOUNT_CODE, money: c.MONEY_ACCOUNT_CODE },
    sourceType: c.REVERSAL_SOURCE_TYPE, movementType: c.REVERSAL_MOVEMENT_TYPE,
    target: target, targetEvidence: input.targetEvidence,
    reversalJournalID: reversalJournalID,
    reversalJournalRows: reversalJournalRows,
    reversalJournalSignature: reversalJournalSignature,
    lifecycle: { rowNumber: target.rowNumber, afterRow: lifecycleRow },
    auditID: input.auditID, auditRow: auditRow,
    replacement: null
  };
  if (operationType === c.CORRECT) {
    plan.businessID = input.replacement.eventRow.EventID;
    plan.replacement = input.replacement;
  }
  plan.planDigest = transactionPayloadHash_(plan);
  return plan;
}

// Plan integrity + shape invariants (freeze time + every resume, zero writes).
function purchaseCorrectionVerifyPlan_(plan) {
  var c = PURCHASE_EVENT_CORRECTION, save = PURCHASE_SINGLE_COMMIT_V1;
  function malformed(reason) { return { ok: false, kind: "MALFORMED", reason: reason }; }
  function tampered(reason) { return { ok: false, kind: "TAMPERED", reason: reason }; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return malformed("PLAN_NOT_OBJECT");
  if (plan.planVersion !== c.PLAN_VERSION) return malformed("PLAN_VERSION_MISMATCH");
  if (plan.operationType !== c.VOID && plan.operationType !== c.CORRECT) {
    return malformed("OPERATION_TYPE_MISMATCH");
  }
  if (typeof plan.requestKey !== "string" || !plan.requestKey) return malformed("REQUEST_KEY_MISSING");
  if (plan.operationID !== transactionOperationID_(plan.operationType, plan.requestKey)) {
    return tampered("OPERATION_ID_MISMATCH");
  }
  if (typeof plan.payloadHash !== "string" ||
      plan.payloadHash !== transactionPayloadHash_(plan.normalizedPayload)) {
    return tampered("PAYLOAD_HASH_MISMATCH");
  }
  if (typeof plan.targetID !== "string" || !plan.targetID) return malformed("TARGET_ID_MISSING");
  var payload = plan.normalizedPayload || {};
  if (payload.transactionId !== plan.targetID) return tampered("TARGET_ID_MISMATCH");
  if (typeof payload.reason !== "string" || !payload.reason || plan.reason !== payload.reason) {
    return tampered("REASON_MISMATCH");
  }
  var amount = plan.amount;
  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return malformed("AMOUNT_INVALID");
  }
  if (plan.accounts.money !== c.MONEY_ACCOUNT_CODE ||
      plan.accounts.purchase !== c.DEBIT_ACCOUNT_CODE) {
    return tampered("ACCOUNT_MAPPING_MISMATCH");
  }
  if (plan.sourceType !== c.REVERSAL_SOURCE_TYPE ||
      plan.movementType !== c.REVERSAL_MOVEMENT_TYPE) {
    return tampered("SOURCE_IDENTITY_MISMATCH");
  }
  if (typeof plan.economicDate !== "string" || !capitalEquityDateKey(plan.economicDate)) {
    return malformed("ECONOMIC_DATE_INVALID");
  }
  if (typeof plan.actor !== "string" || !plan.actor || typeof plan.actionAt !== "string" ||
      !plan.actionAt) {
    return malformed("ACTOR_OR_TIMESTAMP_MISSING");
  }
  var target = plan.target;
  if (!target || typeof target !== "object") return malformed("TARGET_MISSING");
  if (String(target.transactionId) !== plan.targetID) return tampered("TARGET_TRANSACTION_MISMATCH");
  if (String(target.originalJournalID) !== save.JOURNAL_ID_PREFIX + plan.targetID &&
      String(target.originalJournalID).indexOf(save.JOURNAL_ID_PREFIX) !== 0) {
    return tampered("TARGET_JOURNAL_MISMATCH");
  }
  if (Number(target.amount) !== amount) return tampered("TARGET_AMOUNT_MISMATCH");
  if (!isFinite(Number(target.rowNumber)) || Number(target.rowNumber) < 2 ||
      Number(target.rowNumber) !== Number(plan.lifecycle.rowNumber)) {
    return tampered("TARGET_ROW_NUMBER_MISMATCH");
  }
  if (!target.row || target.row.EventID !== plan.targetID ||
      Number(target.row.AcquisitionValue) !== amount ||
      target.row.PaymentStatus !== save.PAYMENT_STATUS ||
      target.row.CashAccountCode !== save.MONEY_ACCOUNT_CODE ||
      target.row.AccountingStatus !== save.ACCOUNTING_STATUS ||
      target.row.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL ||
      !isCanonicalActive(target.row.IsActive) ||
      Number(target.row.sourceRowIndex) + 1 !== Number(target.rowNumber)) {
    return tampered("TARGET_ROW_MISMATCH");
  }
  ["eventRow", "journal", "savePlan"].forEach(function(key) {
    if (typeof plan.targetEvidence[key] !== "string" || !plan.targetEvidence[key]) {
      throw new Error("TARGET_EVIDENCE_" + key.toUpperCase() + "_MISSING");
    }
  });
  var after = plan.lifecycle.afterRow;
  if (!after || typeof after !== "object") return malformed("LIFECYCLE_ROW_MISSING");
  var expectedLifecycle = plan.operationType === c.VOID ?
    PURCHASE_EVENT_LIFECYCLE_STATES.VOIDED : PURCHASE_EVENT_LIFECYCLE_STATES.CORRECTED;
  if (after.EventID !== plan.targetID || after.Lifecycle !== expectedLifecycle ||
      after.IsActive !== false ||
      after.PaymentStatus !== save.PAYMENT_STATUS ||
      after.CashAccountCode !== save.MONEY_ACCOUNT_CODE ||
      after.AccountingStatus !== save.ACCOUNTING_STATUS ||
      Number(after.AcquisitionValue) !== amount ||
      after.RequestKey !== target.row.RequestKey ||
      after.NormalizedPayload !== target.row.NormalizedPayload ||
      after.RecoveryKey !== target.row.RecoveryKey) {
    return tampered("LIFECYCLE_ROW_MISMATCH");
  }
  // Reversal pair: exact Policy C inverse (6210 credit + 1040 debit).
  var rows = plan.reversalJournalRows;
  if (!Array.isArray(rows) || rows.length !== 2) return malformed("REVERSAL_JOURNAL_ROW_COUNT");
  var r0 = rows[0], r1 = rows[1];
  if (r0.LineID !== plan.reversalJournalID + "-1" || r1.LineID !== plan.reversalJournalID + "-2" ||
      r0.JournalID !== plan.reversalJournalID || r1.JournalID !== plan.reversalJournalID ||
      plan.reversalJournalID !== (plan.operationType === c.VOID ?
        c.VOID_JOURNAL_ID_PREFIX : c.CORRECT_JOURNAL_ID_PREFIX) + plan.targetID) {
    return tampered("REVERSAL_JOURNAL_ID_MISMATCH");
  }
  var rowsOk = rows.every(function(row) {
    return row.SourceType === c.REVERSAL_SOURCE_TYPE && row.SourceID === plan.targetID &&
      row.MovementType === c.REVERSAL_MOVEMENT_TYPE && row.IsActive === true &&
      row.ExternalRef === target.originalJournalID &&
      expenseSingleCommitFieldEqual_(row.Tanggal, plan.economicDate);
  });
  if (!rowsOk) return tampered("REVERSAL_JOURNAL_SOURCE_MISMATCH");
  if (r0.AccountCode !== c.DEBIT_ACCOUNT_CODE || Number(r0.Debit) !== 0 ||
      Number(r0.Credit) !== amount || r1.AccountCode !== c.MONEY_ACCOUNT_CODE ||
      Number(r1.Debit) !== amount || Number(r1.Credit) !== 0) {
    return tampered("REVERSAL_JOURNAL_MAPPING_MISMATCH");
  }
  if (policyCJournalSignature_(rows) !== plan.reversalJournalSignature) {
    return tampered("REVERSAL_JOURNAL_SIGNATURE_MISMATCH");
  }
  var audit = plan.auditRow;
  var expectedAction = plan.operationType === c.VOID ? c.AUDIT_ACTIONS.VOID :
    c.AUDIT_ACTIONS.CORRECT_VOID;
  if (!audit || audit.ID_Log !== plan.auditID || audit.RecordID !== plan.targetID ||
      audit.Module !== c.AUDIT_MODULE || audit.Action !== expectedAction) {
    return tampered("AUDIT_ROW_MISMATCH");
  }
  var auditMeta = null;
  try { auditMeta = JSON.parse(String(audit.Metadata || "{}")); }
  catch (error) { return malformed("AUDIT_METADATA_JSON_INVALID"); }
  if (!auditMeta || auditMeta.requestKey !== plan.requestKey ||
      auditMeta.operationID !== plan.operationID || auditMeta.singleCommit !== true ||
      auditMeta.targetJournalID !== target.originalJournalID ||
      auditMeta.reversalJournalID !== plan.reversalJournalID) {
    return tampered("AUDIT_METADATA_MISMATCH");
  }
  if (plan.operationType === c.VOID) {
    if (plan.replacement !== null && plan.replacement !== undefined) {
      return malformed("REPLACEMENT_IN_VOID");
    }
    if (plan.businessID !== plan.targetID) return tampered("BUSINESS_ID_MISMATCH");
    if (payload.expenseItemId !== undefined || payload.input !== undefined ||
        payload.supplierID !== undefined) {
      return tampered("REPLACEMENT_FIELDS_IN_VOID");
    }
  } else {
    var rep = plan.replacement;
    if (!rep || typeof rep !== "object") return malformed("REPLACEMENT_MISSING");
    var expectedRequestKey = "corr-" + plan.requestKey;
    var expectedEventID = save.EVENT_ID_PREFIX + expectedRequestKey;
    if (rep.eventRow.EventID !== expectedEventID ||
        rep.eventRow.RequestKey !== expectedRequestKey ||
        plan.businessID !== expectedEventID) {
      return tampered("REPLACEMENT_ID_DERIVATION_MISMATCH");
    }
    if (payload.expenseItemId !== rep.eventRow.ExpenseID ||
        payload.supplierID !== String(rep.eventRow.SupplierID || "")) {
      return tampered("REPLACEMENT_PAYLOAD_MISMATCH");
    }
    var repEvent = rep.eventRow;
    if (repEvent.PaymentStatus !== save.PAYMENT_STATUS ||
        repEvent.CashAccountCode !== save.MONEY_ACCOUNT_CODE ||
        repEvent.AccountingStatus !== save.ACCOUNTING_STATUS ||
        repEvent.Lifecycle !== PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL ||
        repEvent.IsActive !== true ||
        repEvent.RecoveryKey !== save.RECOVERY_KEY_PREFIX + expectedRequestKey ||
        Number(repEvent.AcquisitionValue) !== Number(rep.amount)) {
      return tampered("REPLACEMENT_EVENT_AUTHORITY_MISMATCH");
    }
    if (!rep.eventNormalizedPayload ||
        JSON.stringify(rep.eventNormalizedPayload) !== String(repEvent.NormalizedPayload) ||
        rep.eventNormalizedPayload.requestKey !== expectedRequestKey ||
        rep.eventNormalizedPayload.transactionType !== "EXPENSE") {
      return tampered("REPLACEMENT_EVENT_PAYLOAD_MISMATCH");
    }
    // Re-derive the replacement save normalization from the persisted raw
    // payload: a redigested plan can never smuggle a different input.
    if (!rep.saveNormalized || typeof payload.input !== "object" || !payload.input) {
      return malformed("REPLACEMENT_INPUT_MISSING");
    }
    var rederived;
    try {
      rederived = purchaseSingleCommitNormalize_({ transactionType: "EXPENSE",
        requestKey: expectedRequestKey, expenseItemId: payload.expenseItemId,
        input: payload.input, supplierID: payload.supplierID });
    } catch (error) {
      return malformed("REPLACEMENT_INPUT_INVALID");
    }
    if (JSON.stringify(rederived) !== JSON.stringify(rep.saveNormalized) ||
        JSON.stringify(purchaseSingleCommitEventPayload_(rederived)) !==
          JSON.stringify(rep.eventNormalizedPayload)) {
      return tampered("REPLACEMENT_INPUT_MISMATCH");
    }
    if (rep.journalID !== save.JOURNAL_ID_PREFIX + expectedEventID) {
      return tampered("REPLACEMENT_JOURNAL_ID_MISMATCH");
    }
    if (!Array.isArray(rep.journalRows) || rep.journalRows.length !== 2) {
      return malformed("REPLACEMENT_JOURNAL_ROW_COUNT");
    }
    var j0 = rep.journalRows[0], j1 = rep.journalRows[1];
    var replOk = rep.journalRows.every(function(row) {
      return row.SourceType === save.SOURCE_TYPE && row.SourceID === expectedEventID &&
        row.MovementType === save.MOVEMENT_TYPE && row.IsActive === true &&
        expenseSingleCommitFieldEqual_(row.Tanggal, rep.economicDate);
    });
    if (!replOk || j0.LineID !== rep.journalID + "-1" || j1.LineID !== rep.journalID + "-2" ||
        j0.JournalID !== rep.journalID || j1.JournalID !== rep.journalID) {
      return tampered("REPLACEMENT_JOURNAL_SOURCE_MISMATCH");
    }
    if (j0.AccountCode !== c.DEBIT_ACCOUNT_CODE || Number(j0.Debit) !== Number(rep.amount) ||
        Number(j0.Credit) !== 0 || j1.AccountCode !== c.MONEY_ACCOUNT_CODE ||
        Number(j1.Debit) !== 0 || Number(j1.Credit) !== Number(rep.amount)) {
      return tampered("REPLACEMENT_JOURNAL_MAPPING_MISMATCH");
    }
    if (policyCJournalSignature_(rep.journalRows) !== rep.journalSignature) {
      return tampered("REPLACEMENT_JOURNAL_SIGNATURE_MISMATCH");
    }
    var repAudit = rep.auditRow;
    var repMeta = null;
    try { repMeta = JSON.parse(String(repAudit && repAudit.Metadata || "{}")); }
    catch (error) { return malformed("REPLACEMENT_AUDIT_METADATA_JSON_INVALID"); }
    if (!repAudit || repAudit.ID_Log !== rep.auditID ||
        repAudit.RecordID !== expectedEventID ||
        repAudit.Module !== c.AUDIT_MODULE ||
        repAudit.Action !== c.AUDIT_ACTIONS.CORRECT_CREATE || !repMeta ||
        repMeta.originalId !== plan.targetID ||
        repMeta.requestKey !== plan.requestKey ||
        repMeta.operationID !== plan.operationID) {
      return tampered("REPLACEMENT_AUDIT_MISMATCH");
    }
    if (!isFinite(Number(rep.amount)) || Number(rep.amount) <= 0) {
      return malformed("REPLACEMENT_AMOUNT_INVALID");
    }
  }
  var digestInput = Object.assign({}, plan);
  delete digestInput.planDigest;
  if (plan.planDigest !== transactionPayloadHash_(digestInput)) {
    return tampered("PLAN_DIGEST_MISMATCH");
  }
  return { ok: true, kind: "", reason: "" };
}

function purchaseCorrectionRowValues_(row, headers) {
  return headers.map(function(header) {
    return row[header] === undefined ? "" : row[header];
  });
}

// The ONE batch's logical ranges (frozen plan order). PurchaseEvents may
// appear twice on CORRECT (lifecycle update of the original + append of the
// replacement); surfaces stay exactly {PurchaseEvents, BalanceLedger, Logs}.
function purchaseCorrectionValueRanges_(plan) {
  var c = PURCHASE_EVENT_CORRECTION;
  var ranges = [
    { range: "PurchaseEvents", updateRow: plan.lifecycle.rowNumber,
      values: [purchaseCorrectionRowValues_(plan.lifecycle.afterRow,
        PURCHASE_EVENT_POLICY.headers)] }
  ];
  if (plan.replacement) {
    ranges.push({ range: "PurchaseEvents",
      values: [purchaseCorrectionRowValues_(plan.replacement.eventRow,
        PURCHASE_EVENT_POLICY.headers)] });
  }
  ranges.push({ range: "BalanceLedger",
    values: plan.reversalJournalRows
      .concat(plan.replacement ? plan.replacement.journalRows : [])
      .map(function(row) {
        return purchaseCorrectionRowValues_(row,
          BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
      }) });
  var auditRows = [plan.auditRow];
  if (plan.replacement) auditRows.push(plan.replacement.auditRow);
  ranges.push({ range: "Logs", values: auditRows.map(function(row) {
    return purchaseCorrectionRowValues_(row, CANONICAL_ENTRY.LOG_HEADERS);
  }) });
  var unique = [];
  ranges.forEach(function(range) {
    if (unique.indexOf(range.range) === -1) unique.push(range.range);
  });
  unique.sort();
  var expected = c.WRITE_SURFACES.slice().sort();
  if (JSON.stringify(unique) !== JSON.stringify(expected)) {
    throw new Error("CORRECTION_SURFACE_MISMATCH");
  }
  return ranges;
}

function purchaseCorrectionBounds_(plan) {
  var c = PURCHASE_EVENT_CORRECTION, ranges;
  try { ranges = purchaseCorrectionValueRanges_(plan); }
  catch (error) { return { ok: false, detail: "CORRECTION_SURFACE_MISMATCH" }; }
  var cells = 0;
  ranges.forEach(function(range) {
    range.values.forEach(function(row) { cells += row.length; });
  });
  var sentinel = {};
  c.WRITE_SURFACES.forEach(function(name) { sentinel[name] = 2147483647; });
  var body;
  try { body = expenseCorrectionBatchBody_(ranges, sentinel); }
  catch (error) { return { ok: false, detail: "UNSAFE_BATCH:" + error.message }; }
  var bytes = expenseSingleCommitUtf8Bytes_(JSON.stringify(body)) +
    PURCHASE_SINGLE_COMMIT_V1.REQUEST_OVERHEAD_BYTES;
  var planJson = "";
  try { planJson = JSON.stringify(plan); }
  catch (error) { return { ok: false, detail: "PLAN_JSON_INVALID" }; }
  if (planJson.length > PURCHASE_SINGLE_COMMIT_V1.MAX_CELL_CHARS) {
    return { ok: false, detail: "UNSAFE_PLAN_CELL_CHARS:" + planJson.length };
  }
  var ok = cells <= PURCHASE_SINGLE_COMMIT_V1.MAX_BATCH_CELLS &&
    bytes <= PURCHASE_SINGLE_COMMIT_V1.MAX_REQUEST_BYTES;
  return { ok: ok, cells: cells, bytes: bytes, planChars: planJson.length,
    detail: ok ? "" : "BATCH_BOUNDS cells=" + cells + " bytes=" + bytes };
}

// Exact artifact verification against the frozen plan over the three
// surfaces. NONE / PARTIAL / CONFLICT / EXACT / UNKNOWN.
function purchaseCorrectionInspect_(plan, ss) {
  var c = PURCHASE_EVENT_CORRECTION, save = PURCHASE_SINGLE_COMMIT_V1,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var events, ledger, logs, ops;
  try {
    events = readCanonicalTable(ss, "PurchaseEvents", PURCHASE_EVENT_POLICY.headers);
    ledger = readCanonicalTable(ss, "BalanceLedger", ledgerHeaders);
    logs = readCanonicalTable(ss, "Logs", CANONICAL_ENTRY.LOG_HEADERS);
    ops = expenseCorrectionOperationRows_(ss);
  } catch (error) {
    return { state: "UNKNOWN", detail: "READBACK_FAILED:" + error.message };
  }
  var conflicts = [], missing = [];
  var lifecycleApplied = false;
  var rows = events.filter(function(row) {
    return String(row.EventID) === plan.targetID;
  });
  if (rows.length !== 1) {
    conflicts.push(rows.length ? "TARGET_ROW_DUPLICATE" : "TARGET_ROW_MISSING");
  } else if (rows[0].sourceRowIndex + 1 !== Number(plan.lifecycle.rowNumber)) {
    conflicts.push("TARGET_ROW_DRIFT");
  } else {
    var post = expenseSingleCommitRowExact_(rows[0], plan.lifecycle.afterRow,
      PURCHASE_EVENT_POLICY.headers);
    var pre = expenseSingleCommitRowExact_(rows[0], plan.target.row,
      PURCHASE_EVENT_POLICY.headers);
    if (post) lifecycleApplied = true;
    else if (!pre) conflicts.push("TARGET_ROW_TAMPERED");
  }
  var saveOps = ops.filter(function(op) {
    return String(op.OperationType) === save.OPERATION_TYPE &&
      String(op.BusinessID) === plan.targetID;
  });
  if (saveOps.length !== 1 || String(saveOps[0].State) !== "COMMITTED") {
    conflicts.push("SAVE_LINEAGE_MISSING");
  } else {
    var lineagePlan = null;
    try { lineagePlan = JSON.parse(String(saveOps[0].OperationPlan || "")); }
    catch (error) { lineagePlan = null; }
    if (!lineagePlan || transactionPayloadHash_(lineagePlan) !== plan.targetEvidence.savePlan) {
      conflicts.push("SAVE_LINEAGE_TAMPERED");
    }
  }
  var reversalById = ledger.filter(function(row) {
    return String(row.JournalID) === plan.reversalJournalID;
  });
  var reversalBySource = reversalById.filter(function(row) {
    return String(row.SourceID) === plan.targetID &&
      String(row.SourceType) === plan.sourceType &&
      String(row.MovementType) === plan.movementType;
  });
  if (reversalById.length || reversalBySource.length) {
    var idSet = reversalById.map(function(row) { return String(row.LineID); }).sort().join("");
    var sourceSet = reversalBySource.map(function(row) { return String(row.LineID); }).sort().join("");
    if (idSet !== sourceSet) conflicts.push("REVERSAL_IDENTITY_CROSSOVER");
    if (reversalBySource.length === 2) {
      var sorted = reversalBySource.slice().sort(function(left, right) {
        return String(left.LineID) < String(right.LineID) ? -1 : 1;
      });
      for (var i = 0; i < 2; i++) {
        if (!expenseSingleCommitRowExact_(sorted[i], plan.reversalJournalRows[i],
            ledgerHeaders)) {
          conflicts.push("REVERSAL_JOURNAL_TAMPERED");
        }
      }
      if (policyCJournalSignature_(reversalBySource) !== plan.reversalJournalSignature) {
        conflicts.push("REVERSAL_JOURNAL_SIGNATURE_MISMATCH");
      }
      var debit = 0, credit = 0;
      reversalBySource.forEach(function(row) {
        debit += Number(row.Debit); credit += Number(row.Credit);
      });
      if (debit !== credit) conflicts.push("REVERSAL_JOURNAL_BALANCE_MISMATCH");
    } else if (reversalBySource.length === 1) {
      var only = reversalBySource[0], planned = null;
      plan.reversalJournalRows.forEach(function(row) {
        if (String(row.LineID) === String(only.LineID)) planned = row;
      });
      if (!planned || !expenseSingleCommitRowExact_(only, planned, ledgerHeaders)) {
        conflicts.push("REVERSAL_JOURNAL_TAMPERED");
      } else missing.push("REVERSAL_JOURNAL_LINE");
    } else if (reversalBySource.length === 0) missing.push("REVERSAL_JOURNAL_LINE");
    else conflicts.push("REVERSAL_JOURNAL_DUPLICATE");
  } else missing.push("REVERSAL_JOURNAL");
  ledger.forEach(function(row) {
    if (String(row.SourceType) === plan.sourceType &&
        String(row.SourceID) === plan.targetID &&
        String(row.JournalID) !== plan.target.originalJournalID &&
        String(row.JournalID) !== plan.reversalJournalID) {
      conflicts.push("FOREIGN_JOURNAL_CLAIM");
    }
  });
  var auditById = logs.filter(function(row) { return row.ID_Log === plan.auditID; });
  if (auditById.length) {
    if (auditById.length > 1) conflicts.push("AUDIT_DUPLICATE");
    else if (!expenseSingleCommitRowExact_(auditById[0], plan.auditRow,
        CANONICAL_ENTRY.LOG_HEADERS)) {
      conflicts.push("AUDIT_TAMPERED");
    }
  } else missing.push("AUDIT");
  // Nothing written yet (intent only) — checked before the replacement
  // branches so a CORRECT plan with zero artifacts classifies NONE, never
  // PARTIAL (the resume path then applies the frozen plan exactly once).
  if (!lifecycleApplied && !reversalById.length && !auditById.length) {
    return { state: "NONE", detail: "NO_ARTIFACTS" };
  }
  var replacement = plan.replacement;
  if (replacement) {
    var expectedEventID = save.EVENT_ID_PREFIX + "corr-" + plan.requestKey;
    var repRows = events.filter(function(row) {
      return String(row.EventID) === expectedEventID;
    });
    if (repRows.length !== 1) {
      if (repRows.length) conflicts.push("REPLACEMENT_ROW_DUPLICATE");
      else missing.push("REPLACEMENT_ROW");
    } else if (!expenseSingleCommitRowExact_(repRows[0], replacement.eventRow,
        PURCHASE_EVENT_POLICY.headers)) {
      conflicts.push("REPLACEMENT_ROW_TAMPERED");
    }
    var repJournal = ledger.filter(function(row) {
      return String(row.JournalID) === replacement.journalID;
    });
    var repJournalBySource = repJournal.filter(function(row) {
      return String(row.SourceID) === expectedEventID &&
        String(row.SourceType) === save.SOURCE_TYPE;
    });
    if (repJournal.length !== 2 || repJournalBySource.length !== 2) {
      if (!repJournal.length && !repJournalBySource.length) missing.push("REPLACEMENT_JOURNAL");
      else if (repJournal.length === 1 || repJournalBySource.length === 1) {
        missing.push("REPLACEMENT_JOURNAL_LINE");
      } else conflicts.push("REPLACEMENT_JOURNAL_DUPLICATE");
    } else {
      var repSorted = repJournalBySource.slice().sort(function(left, right) {
        return String(left.LineID) < String(right.LineID) ? -1 : 1;
      });
      for (var j = 0; j < 2; j++) {
        if (!expenseSingleCommitRowExact_(repSorted[j], replacement.journalRows[j],
            ledgerHeaders)) {
          conflicts.push("REPLACEMENT_JOURNAL_TAMPERED");
        }
      }
      if (policyCJournalSignature_(repJournalBySource) !== replacement.journalSignature) {
        conflicts.push("REPLACEMENT_JOURNAL_SIGNATURE_MISMATCH");
      }
    }
    var repAudit = logs.filter(function(row) { return row.ID_Log === replacement.auditID; });
    if (repAudit.length !== 1) {
      if (!repAudit.length) missing.push("REPLACEMENT_AUDIT");
      else conflicts.push("REPLACEMENT_AUDIT_DUPLICATE");
    } else if (!expenseSingleCommitRowExact_(repAudit[0], replacement.auditRow,
        CANONICAL_ENTRY.LOG_HEADERS)) {
      conflicts.push("REPLACEMENT_AUDIT_TAMPERED");
    }
    if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
    if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
    if (!lifecycleApplied) return { state: "PARTIAL", detail: "LIFECYCLE" };
    return { state: "EXACT", detail: "" };
  }
  if (conflicts.length) return { state: "CONFLICT", detail: conflicts.join(",") };
  var present = lifecycleApplied || reversalById.length || auditById.length;
  if (!present) return { state: "NONE", detail: "NO_ARTIFACTS" };
  if (missing.length) return { state: "PARTIAL", detail: missing.join(",") };
  if (!lifecycleApplied) return { state: "PARTIAL", detail: "LIFECYCLE" };
  return { state: "EXACT", detail: "" };
}

// Pre-batch guard: the frozen target row must still exist exactly at its
// planned row before the ONE batch is issued (never re-plan changed rows).
function purchaseCorrectionRowGuard_(plan, ss) {
  var events;
  try {
    events = readCanonicalTable(ss, "PurchaseEvents", PURCHASE_EVENT_POLICY.headers);
  } catch (error) { return { ok: false, detail: "READ_FAILED:" + error.message }; }
  var rows = events.filter(function(row) {
    return String(row.EventID) === plan.targetID;
  });
  if (rows.length !== 1) return { ok: false, detail: "ROW_COUNT:" + rows.length };
  if (rows[0].sourceRowIndex + 1 !== Number(plan.lifecycle.rowNumber)) {
    return { ok: false, detail: "ROW_DRIFT" };
  }
  if (!expenseSingleCommitRowExact_(rows[0], plan.target.row, PURCHASE_EVENT_POLICY.headers)) {
    return { ok: false, detail: "ROW_CHANGED" };
  }
  return { ok: true, detail: "" };
}

function purchaseCorrectionOutcome_(plan, status, fields) {
  return purchaseCorrectionResult_(status, Object.assign({
    requestKey: plan.requestKey, operationID: plan.operationID, targetID: plan.targetID,
    replacementID: plan.replacement ? plan.replacement.eventRow.EventID : ""
  }, fields || {}));
}

function purchaseCorrectionApplyBatch_(plan, operation, runtime) {
  var c = PURCHASE_EVENT_CORRECTION, codes = c.CODES;
  function outcome(status, fields) {
    return purchaseCorrectionOutcome_(plan, status, fields);
  }
  var guard = purchaseCorrectionRowGuard_(plan, runtime.spreadsheet);
  if (!guard.ok) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.ARTIFACTS_INCOMPLETE, detail: "TARGET_ROW_" + guard.detail,
        writeCount: "UNKNOWN" });
  }
  var ranges = null;
  try { ranges = purchaseCorrectionValueRanges_(plan); }
  catch (error) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message, writeCount: "UNKNOWN" });
  }
  var rows = 0;
  ranges.forEach(function(range) { rows += range.values.length; });
  if (runtime.crash) runtime.crash("PURCHASE_CORR_BEFORE_BATCH");
  var batchError = null;
  try { runtime.batch(ranges); } catch (error) { batchError = error; }
  if (!batchError && runtime.crash) runtime.crash("PURCHASE_CORR_AFTER_BATCH");
  var inspection = purchaseCorrectionInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(c.STATUS.UNKNOWN,
      { code: codes.READBACK_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state === "NONE" && batchError) {
    return outcome(c.STATUS.UNKNOWN,
      { code: codes.BATCH_OUTCOME_UNKNOWN, writeCount: "UNKNOWN", detail: inspection.detail });
  }
  if (inspection.state !== "EXACT") {
    return outcome(c.STATUS.RECOVERY_REQUIRED, {
      code: inspection.state === "CONFLICT" ?
        (inspection.detail.indexOf("SIGNATURE") !== -1 ?
          codes.ARTIFACTS_INCOMPLETE : codes.IDENTITY_CONFLICT) :
        codes.ARTIFACTS_INCOMPLETE,
      writeCount: "UNKNOWN", detail: inspection.state + ":" + inspection.detail });
  }
  if (runtime.crash) runtime.crash("PURCHASE_CORR_AFTER_READBACK");
  if (runtime.crash) runtime.crash("PURCHASE_CORR_BEFORE_COMMIT");
  var commit = expenseSingleCommitCommit_(operation, runtime);
  if (!commit.ok) {
    return outcome(commit.status, { code: commit.code, writeCount: rows, detail: commit.detail });
  }
  if (runtime.crash) runtime.crash("PURCHASE_CORR_AFTER_COMMIT");
  return outcome(c.STATUS.DONE, { writeCount: rows });
}

// Resume path: admission is NEVER re-evaluated here — a persisted
// IN_PROGRESS intent recovers from its frozen plan regardless of a later
// PAUSED config (T11.7 §3).
function purchaseCorrectionResume_(operationType, operation, hash, normalized, runtime) {
  var c = PURCHASE_EVENT_CORRECTION, codes = c.CODES;
  function outcome(status, fields) {
    return purchaseCorrectionResult_(status, Object.assign({
      requestKey: normalized.requestKey, operationID: operation.OperationID || "",
      targetID: operation.BusinessID || ""
    }, fields || {}));
  }
  if (operation.OperationType !== operationType || !operation.BusinessID ||
      operation.RequestKey !== normalized.requestKey || operation.PayloadHash !== hash) {
    return outcome(c.STATUS.CONFLICT, { code: codes.OPERATION_PAYLOAD_CONFLICT });
  }
  var plan = null;
  try { plan = JSON.parse(operation.OperationPlan); }
  catch (error) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: "PLAN_JSON:" + error.message });
  }
  if (!plan || plan.requestKey !== normalized.requestKey || plan.payloadHash !== hash ||
      plan.operationID !== operation.OperationID ||
      plan.businessID !== operation.BusinessID ||
      plan.targetID !== normalized.transactionId) {
    return outcome(c.STATUS.CONFLICT,
      { code: codes.OPERATION_PAYLOAD_CONFLICT, detail: "PLAN_IDENTITY_MISMATCH" });
  }
  if (!plan.normalizedPayload ||
      JSON.stringify(plan.normalizedPayload) !== JSON.stringify(normalized)) {
    return outcome(c.STATUS.CONFLICT,
      { code: codes.OPERATION_PAYLOAD_CONFLICT, detail: "NORMALIZED_PAYLOAD_MISMATCH" });
  }
  var verify;
  try { verify = purchaseCorrectionVerifyPlan_(plan); }
  catch (error) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  if (!verify.ok) {
    return outcome(c.STATUS.RECOVERY_REQUIRED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason });
  }
  if (operation.State !== "IN_PROGRESS" && operation.State !== "COMMITTED") {
    return outcome(c.STATUS.RECOVERY_REQUIRED, {
      code: codes.INVALID_OPERATION_STATE, detail: "STATE:" + String(operation.State) });
  }
  var schema = purchaseSingleCommitSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(",") });
  }
  var bounds = purchaseCorrectionBounds_(plan);
  if (!bounds.ok) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail });
  }
  var inspection = purchaseCorrectionInspect_(plan, runtime.spreadsheet);
  if (inspection.state === "UNKNOWN") {
    return outcome(c.STATUS.UNKNOWN,
      { code: codes.READBACK_UNKNOWN, detail: inspection.detail });
  }
  var closedCode = inspection.state === "CONFLICT" ?
    (inspection.detail.indexOf("SIGNATURE") !== -1 ?
      codes.ARTIFACTS_INCOMPLETE : codes.IDENTITY_CONFLICT) :
    codes.ARTIFACTS_INCOMPLETE;
  if (inspection.state === "EXACT") {
    if (operation.State === "COMMITTED") {
      if (runtime.crash) runtime.crash("PURCHASE_CORR_AFTER_COMMIT");
      return outcome(c.STATUS.DONE, { replay: true, writeCount: 0,
        targetID: plan.targetID,
        replacementID: plan.replacement ? plan.replacement.eventRow.EventID : "" });
    }
    if (runtime.crash) runtime.crash("PURCHASE_CORR_AFTER_READBACK");
    if (runtime.crash) runtime.crash("PURCHASE_CORR_BEFORE_COMMIT");
    var commit = expenseSingleCommitCommit_(operation, runtime);
    if (!commit.ok) {
      return outcome(commit.status, { code: commit.code, detail: commit.detail });
    }
    if (runtime.crash) runtime.crash("PURCHASE_CORR_AFTER_COMMIT");
    return outcome(c.STATUS.DONE, { replay: true, writeCount: 0,
      targetID: plan.targetID,
      replacementID: plan.replacement ? plan.replacement.eventRow.EventID : "" });
  }
  if (operation.State === "COMMITTED") {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: closedCode, detail: inspection.detail });
  }
  if (inspection.state === "NONE") {
    return purchaseCorrectionApplyBatch_(plan, operation, runtime);
  }
  return outcome(c.STATUS.RECOVERY_REQUIRED,
    { code: closedCode, detail: inspection.detail });
}

// New-intent path (outer lock held, lookup returned absent): admission,
// schema, {1040, 6210} preflight, target eligibility, ONE immutable plan
// (reversal + optional complete replacement), bounds, durable IN_PROGRESS
// intent + exact readback, then the ONE atomic batch.
function purchaseCorrectionNewIntent_(operationType, normalized, hash, runtime) {
  var c = PURCHASE_EVENT_CORRECTION, save = PURCHASE_SINGLE_COMMIT_V1,
    codes = c.CODES;
  function outcome(status, fields) {
    return purchaseCorrectionResult_(status,
      Object.assign({ requestKey: normalized.requestKey, targetID: normalized.transactionId },
        fields || {}));
  }
  var gate = runtime.gate === undefined || runtime.gate === null ?
    purchaseSingleCommitGate_(runtime) : runtime.gate;
  if (gate.mode !== "ACTIVE") {
    return outcome(c.STATUS.REFUSED, {
      code: gate.code || codes.CORRECTION_NOT_ACTIVE,
      detail: gate.detail || "SINGLE_COMMIT_NOT_ACTIVE" });
  }
  var schema = purchaseSingleCommitSchemaGate_(runtime.spreadsheet);
  if (schema.status !== "PASS") {
    return outcome(c.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: schema.badSheets.join(",") });
  }
  var accountRows;
  try {
    accountRows = readCanonicalTable(runtime.spreadsheet, "Accounts",
      CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  } catch (error) {
    return outcome(c.STATUS.REFUSED,
      { code: codes.SCHEMA_NOT_READY, detail: "ACCOUNTS:" + error.message });
  }
  // Preflight {1040, 6210} — no fallback, no inference (T11.2 §11 + Policy C).
  var moneyPreflight = preflightSingleCommitMoneyAccount(accountRows);
  if (moneyPreflight.status !== "PASS") {
    var moneyError = moneyPreflight.errors[0] || {};
    return outcome(c.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED,
      field: moneyError.accountCode || c.MONEY_ACCOUNT_CODE,
      detail: "MONEY_ACCOUNT_PREFLIGHT_FAILED:" + String(moneyError.code || "") });
  }
  var purchaseAccounts = accountRows.filter(function(row) {
    return row && typeof row === "object" &&
      String(row.AccountCode === undefined || row.AccountCode === null ? "" :
        row.AccountCode).trim() === c.DEBIT_ACCOUNT_CODE;
  });
  if (purchaseAccounts.length !== 1) {
    return outcome(c.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED, field: c.DEBIT_ACCOUNT_CODE,
      detail: purchaseAccounts.length ? "PURCHASE_ACCOUNT_DUPLICATE" :
        "PURCHASE_ACCOUNT_ABSENT" });
  }
  var purchaseAccount = purchaseAccounts[0];
  if (!isCanonicalActive(purchaseAccount.IsActive)) {
    return outcome(c.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED, field: c.DEBIT_ACCOUNT_CODE,
      detail: "PURCHASE_ACCOUNT_INACTIVE" });
  }
  if (String(purchaseAccount.AccountType || "").trim() !== "Expense" ||
      String(purchaseAccount.NormalBalance || "").trim() !== "DEBIT") {
    return outcome(c.STATUS.REFUSED, {
      code: codes.ACCOUNT_PREFLIGHT_FAILED, field: c.DEBIT_ACCOUNT_CODE,
      detail: "PURCHASE_ACCOUNT_METADATA_MISMATCH" });
  }
  var resolved = purchaseCorrectionResolveTarget_(operationType, normalized, runtime);
  if (!resolved.ok) {
    return outcome(c.STATUS.REFUSED, { code: resolved.code, detail: resolved.detail });
  }
  var target = resolved.target;
  var now = runtime.now();
  var economicDate = capitalEquityDateKey(now);
  if (!economicDate) {
    return outcome(c.STATUS.REFUSED,
      { code: codes.PAYLOAD_INVALID, detail: "ACTION_DATE_INVALID" });
  }
  var operationID = transactionOperationID_(operationType, normalized.requestKey);
  var input = { operationType: operationType, requestKey: normalized.requestKey,
    normalized: normalized, hash: hash, target: target,
    targetEvidence: resolved.targetEvidence, actor: runtime.actor(), now: now,
    economicDate: economicDate, operationID: operationID,
    auditID: "LOG-ENTRY-" + runtime.uuid() };
  if (operationType === c.CORRECT) {
    // Complete replacement purchase resolved ONCE for this intent, then
    // frozen in the plan (accounts/authority re-derived here only).
    var replacementRequestKey = "corr-" + normalized.requestKey;
    var replacementSaveNormalized;
    try {
      replacementSaveNormalized = purchaseSingleCommitNormalize_({
        transactionType: "EXPENSE", requestKey: replacementRequestKey,
        expenseItemId: normalized.expenseItemId, input: normalized.input,
        supplierID: normalized.supplierID });
    } catch (error) {
      return outcome(c.STATUS.REFUSED, {
        code: error.purchaseSingleCommitCode || codes.PAYLOAD_INVALID,
        field: error.field || "input",
        detail: "REPLACEMENT_PAYLOAD:" + error.message });
    }
    var replacementEconomicDate = capitalEquityDateKey(
      replacementSaveNormalized.input.ExpenseDate);
    var regime = resolvePolicyCAccountingRegime_(replacementSaveNormalized.input.ExpenseDate);
    if (regime.status !== "RESOLVED" || regime.regime !== save.REGIME) {
      return outcome(c.STATUS.REFUSED, {
        code: save.CODES.REGIME_NOT_PROSPECTIVE, field: "ExpenseDate",
        detail: String(regime.reason || regime.regime || "") });
    }
    if (!replacementEconomicDate) {
      return outcome(c.STATUS.REFUSED,
        { code: codes.PAYLOAD_INVALID, detail: "REPLACEMENT_DATE_INVALID" });
    }
    var items = runtime.items || readCanonicalTable(runtime.spreadsheet,
      "ExpenseItems", save.ITEM_HEADERS);
    var itemRow = items.filter(function(row) {
      return String(row.ID_Ops).trim() === replacementSaveNormalized.expenseItemId &&
        isCanonicalActive(row.IsActive);
    })[0];
    if (!itemRow) {
      return outcome(c.STATUS.REFUSED, {
        code: codes.PAYLOAD_INVALID, field: "expenseItemId",
        detail: "EXPENSE_ITEM_NOT_ACTIVE_OR_MAPPED" });
    }
    var route;
    try {
      route = resolveExpensePurchasePolicy_(replacementSaveNormalized.expenseItemId, items);
    } catch (error) {
      return outcome(c.STATUS.REFUSED,
        { code: codes.PAYLOAD_INVALID, field: "expenseItemId", detail: error.message });
    }
    if (!expensePolicyIsPurchase_(route)) {
      return outcome(c.STATUS.REFUSED,
        { code: codes.PAYLOAD_INVALID, field: "expenseItemId", detail: "NOT_PURCHASE_POLICY" });
    }
    var itemLabel = String(itemRow.Item || "").trim();
    if (!itemLabel) {
      return outcome(c.STATUS.REFUSED,
        { code: codes.PAYLOAD_INVALID, field: "expenseItemId", detail: "ITEM_LABEL_MISSING" });
    }
    if (replacementSaveNormalized.supplierID) {
      var supplierRows;
      try {
        supplierRows = readCanonicalTable(runtime.spreadsheet,
          SUPPLIER_MASTER_CONTRACT.SHEET, SUPPLIER_MASTER_CONTRACT.HEADERS);
      } catch (error) {
        return outcome(c.STATUS.REFUSED,
          { code: codes.PAYLOAD_INVALID, field: "supplierID",
            detail: "SUPPLIERS_NOT_READY" });
      }
      var supplier = supplierRows.filter(function(row) {
        return String(row.SupplierID || "").trim() === replacementSaveNormalized.supplierID;
      })[0];
      if (!supplier || !masterSelectionEligible(supplier.IsActive)) {
        return outcome(c.STATUS.REFUSED,
          { code: codes.PAYLOAD_INVALID, field: "supplierID",
            detail: "SUPPLIER_INACTIVE" });
      }
    }
    // Foreign-artifact defenses for the replacement identity: an existing
    // event row or Policy C journal on the replacement identity is a
    // conflict, never a second append.
    var replacementEventID = save.EVENT_ID_PREFIX + replacementRequestKey;
    var existingEvents;
    try {
      existingEvents = readCanonicalTable(runtime.spreadsheet, "PurchaseEvents",
        PURCHASE_EVENT_POLICY.headers);
    } catch (error) {
      return outcome(c.STATUS.REFUSED,
        { code: codes.SCHEMA_NOT_READY, detail: "PURCHASE_EVENTS:" + error.message });
    }
    if (existingEvents.some(function(row) {
        return String(row.RequestKey || "") === replacementRequestKey ||
          String(row.EventID || "") === replacementEventID; })) {
      return outcome(c.STATUS.CONFLICT,
        { code: codes.IDENTITY_CONFLICT, detail: "REPLACEMENT_EVENT_IDENTITY_EXISTS" });
    }
    var ledgerRows;
    try {
      ledgerRows = readCanonicalTable(runtime.spreadsheet, "BalanceLedger",
        BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
    } catch (error) {
      return outcome(c.STATUS.REFUSED,
        { code: codes.SCHEMA_NOT_READY, detail: "BALANCE_LEDGER:" + error.message });
    }
    var journalState = policyCExistingJournalState_(ledgerRows, save.SOURCE_TYPE,
      replacementEventID);
    if (journalState.status !== "NONE") {
      return outcome(c.STATUS.CONFLICT, { code: codes.IDENTITY_CONFLICT,
        detail: "REPLACEMENT_JOURNAL_IDENTITY_EXISTS:" + journalState.status });
    }
    var replacementJournalID = save.JOURNAL_ID_PREFIX + replacementEventID;
    var replacementAmount = Number(replacementSaveNormalized.input.AcquisitionValue);
    var replacementNowISO = now.toISOString();
    var replacementJournalRows = [
      { JournalID: replacementJournalID, LineID: replacementJournalID + "-1",
        Tanggal: replacementEconomicDate, AccountCode: c.DEBIT_ACCOUNT_CODE,
        Debit: replacementAmount, Credit: 0, MovementType: save.MOVEMENT_TYPE,
        SourceType: save.SOURCE_TYPE, SourceID: replacementEventID,
        ExternalRef: "", Keterangan: "", IsActive: true,
        CreatedAt: replacementNowISO, CreatedBy: input.actor,
        UpdatedAt: replacementNowISO, UpdatedBy: input.actor },
      { JournalID: replacementJournalID, LineID: replacementJournalID + "-2",
        Tanggal: replacementEconomicDate, AccountCode: c.MONEY_ACCOUNT_CODE,
        Debit: 0, Credit: replacementAmount, MovementType: save.MOVEMENT_TYPE,
        SourceType: save.SOURCE_TYPE, SourceID: replacementEventID,
        ExternalRef: "", Keterangan: "", IsActive: true,
        CreatedAt: replacementNowISO, CreatedBy: input.actor,
        UpdatedAt: replacementNowISO, UpdatedBy: input.actor }
    ];
    var replacementEventPayload = purchaseSingleCommitEventPayload_(
      replacementSaveNormalized);
    var allocationStatus = route.PurchaseRelationship.indexOf("HPP_COST_POOL") === 0 ?
      "COST_POOL_ALLOCATION_UNDEFINED" : "QUANTITY_PACKAGE_UNRESOLVED";
    var replacementEventRow = {
      EventID: replacementEventID,
      ExpenseID: replacementSaveNormalized.expenseItemId,
      BusinessLabel: itemLabel,
      PolicyVersion: EXPENSE_PURCHASE_POLICY.version,
      PolicyRevision: EXPENSE_PURCHASE_POLICY.revision,
      CostType: route.CostType,
      PurchaseRelationship: route.PurchaseRelationship,
      ExpenseDate: replacementSaveNormalized.input.ExpenseDate,
      ReceiptDate: replacementSaveNormalized.input.ReceiptDate,
      PurchaseQty: replacementSaveNormalized.input.PurchaseQty,
      PurchaseUOM: replacementSaveNormalized.input.PurchaseUOM,
      AcquisitionValue: replacementSaveNormalized.input.AcquisitionValue,
      SupplierSource: replacementSaveNormalized.input.SupplierSource,
      ExternalRef: replacementSaveNormalized.input.ExternalRef,
      ExternalDocumentStatus: replacementSaveNormalized.input.ExternalDocumentStatus,
      Attestation: JSON.stringify({ attested: true,
        conversionEvidenceConfirmed:
          replacementSaveNormalized.input.ConversionEvidenceConfirmed }),
      AllocationStatus: allocationStatus,
      RequestKey: replacementRequestKey,
      NormalizedPayload: JSON.stringify(replacementEventPayload),
      ReceiptPlan: "null",
      Lifecycle: PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL,
      RecoveryKey: save.RECOVERY_KEY_PREFIX + replacementRequestKey,
      CreatedAt: replacementNowISO, CreatedBy: input.actor, IsActive: true,
      PaymentStatus: save.PAYMENT_STATUS,
      CashAccountCode: save.MONEY_ACCOUNT_CODE,
      SupplierID: replacementSaveNormalized.supplierID,
      AccountingStatus: save.ACCOUNTING_STATUS
    };
    var replacementAuditID = "LOG-ENTRY-" + runtime.uuid();
    var replacementAuditRow = {
      ID_Log: replacementAuditID, Timestamp: now, Level: "INFO",
      Module: c.AUDIT_MODULE, Action: c.AUDIT_ACTIONS.CORRECT_CREATE,
      RecordID: replacementEventID, User: CANONICAL_ENTRY.USER,
      Message: "Single-commit purchase correction replacement recorded.",
      Metadata: JSON.stringify({ reason: normalized.reason,
        requestKey: normalized.requestKey, operationID: operationID,
        originalId: target.transactionId, transactionType: "PURCHASE",
        singleCommit: true })
    };
    input.replacement = {
      eventRow: replacementEventRow,
      eventNormalizedPayload: replacementEventPayload,
      saveNormalized: replacementSaveNormalized,
      amount: replacementAmount, economicDate: replacementEconomicDate,
      journalID: replacementJournalID, journalRows: replacementJournalRows,
      journalSignature: policyCJournalSignature_(replacementJournalRows),
      auditID: replacementAuditID, auditRow: replacementAuditRow
    };
  }
  var plan;
  try { plan = purchaseCorrectionPlan_(operationType, input); }
  catch (error) {
    return outcome(c.STATUS.REFUSED, {
      code: error.purchaseSingleCommitCode || codes.PLAN_MALFORMED,
      field: error.field || "", detail: "PLAN_BUILD:" + error.message });
  }
  var verify;
  try { verify = purchaseCorrectionVerifyPlan_(plan); }
  catch (error) {
    return outcome(c.STATUS.REFUSED,
      { code: codes.PLAN_MALFORMED, detail: error.message });
  }
  if (!verify.ok) {
    return outcome(c.STATUS.REFUSED, {
      code: verify.kind === "TAMPERED" ? codes.IDENTITY_CONFLICT : codes.PLAN_MALFORMED,
      detail: verify.reason });
  }
  var bounds = purchaseCorrectionBounds_(plan);
  if (!bounds.ok) {
    return outcome(c.STATUS.REFUSED,
      { code: codes.BATCH_BOUNDS_EXCEEDED, detail: bounds.detail });
  }
  if (runtime.crash) runtime.crash("PURCHASE_CORR_BEFORE_INTENT");
  var operation;
  try {
    operation = transactionResolveOperation_(runtime.repository, operationType,
      normalized.requestKey, hash, plan.businessID, plan, runtime.now());
  } catch (error) {
    return outcome(error.code === "OPERATION_PAYLOAD_CONFLICT" ?
      c.STATUS.CONFLICT : c.STATUS.RECOVERY_REQUIRED, {
      code: error.code === "OPERATION_PAYLOAD_CONFLICT" ?
        codes.OPERATION_PAYLOAD_CONFLICT : codes.DUPLICATE_OPERATION_EVIDENCE,
      detail: error.message });
  }
  if (runtime.crash) runtime.crash("PURCHASE_CORR_AFTER_INTENT_PERSIST");
  var readback = null;
  try { readback = runtime.repository.findOperation(operationType, normalized.requestKey); }
  catch (error) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, detail: "INTENT_READBACK_FAILED:" + error.message });
  }
  if (!readback) {
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, detail: "INTENT_ROW_MISSING" });
  }
  if (readback.State !== "IN_PROGRESS" ||
      !expenseSingleCommitFieldsExact_(readback, operation,
        TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS)) {
    var mismatch = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS.filter(function(header) {
      return !expenseSingleCommitFieldEqual_(readback[header], operation[header]);
    });
    return outcome(c.STATUS.RECOVERY_REQUIRED,
      { code: codes.INTENT_READBACK_FAILED, detail: "INTENT_ROW_MISMATCH:" + mismatch.join(",") });
  }
  if (runtime.crash) runtime.crash("PURCHASE_CORR_AFTER_INTENT");
  return purchaseCorrectionApplyBatch_(plan, operation, runtime);
}

function purchaseCorrectionRun_(operationType, normalized, runtime) {
  var c = PURCHASE_EVENT_CORRECTION, codes = c.CODES;
  var existing = null;
  try {
    existing = runtime.repository.findOperation(operationType, normalized.requestKey);
  } catch (error) {
    return purchaseCorrectionResult_(c.STATUS.RECOVERY_REQUIRED, {
      code: error && error.message === "DUPLICATE_OPERATION" ?
        codes.DUPLICATE_OPERATION_EVIDENCE : codes.IDENTITY_CONFLICT,
      requestKey: normalized.requestKey,
      detail: error && error.message ? error.message : "" });
  }
  var hash = transactionPayloadHash_(normalized);
  var result = existing ?
    purchaseCorrectionResume_(operationType, existing, hash, normalized, runtime) :
    purchaseCorrectionNewIntent_(operationType, normalized, hash, runtime);
  if (result.status === c.STATUS.DONE && typeof runtime.invalidate === "function") {
    try { runtime.invalidate(); }
    catch (cacheError) {
      Logger.log("Purchase correction post-commit cache invalidation skipped: " +
        String(cacheError && cacheError.message || cacheError));
    }
  }
  return result;
}

function purchaseCorrectionDispatch_(operationType, payload, ss, dispatcherRuntime, gate) {
  var c = PURCHASE_EVENT_CORRECTION;
  var normalized;
  try { normalized = purchaseCorrectionNormalize_(operationType, payload); }
  catch (error) {
    return purchaseCorrectionResult_(c.STATUS.REFUSED, {
      code: error.expenseSingleCommitCode || c.CODES.PAYLOAD_INVALID,
      requestKey: purchaseCorrectionPayloadKey_(payload),
      field: error.field || "", detail: error.message });
  }
  if (gate === undefined || gate === null) {
    gate = purchaseSingleCommitGate_(dispatcherRuntime);
  }
  var core;
  try {
    core = purchaseSingleCommitCoreRuntime_(ss, dispatcherRuntime, null, gate);
  } catch (error) {
    return purchaseCorrectionResult_(c.STATUS.REFUSED, {
      code: c.CODES.CORRECTION_RUNTIME_UNAVAILABLE, requestKey: normalized.requestKey,
      detail: "RUNTIME_UNAVAILABLE:" + String(error && error.message || error) });
  }
  try {
    return purchaseCorrectionRun_(operationType, normalized, core);
  } catch (error) {
    var identity = { requestKey: normalized.requestKey, operationID: "" };
    try {
      var pending = core.repository.findOperation(operationType, normalized.requestKey);
      if (pending) identity.operationID = pending.OperationID;
    } catch (lookupError) { /* requestKey remains the recoverable identity */ }
    return purchaseCorrectionResult_(c.STATUS.UNKNOWN, Object.assign({
      code: c.CODES.CORRECTION_EXECUTION_UNKNOWN,
      detail: String(error && error.message || error),
      targetID: normalized.transactionId
    }, identity));
  }
}

// Production transport: ONE spreadsheets.batchUpdate (appendCells +
// updateCells) over the correction's own write surfaces.
function purchaseCorrectionBatchRequest_(valueRanges) {
  var sheetIds = purchaseSingleCommitSheetIdsRequest_();
  var body = expenseCorrectionBatchBody_(valueRanges, sheetIds);
  return inventoryReceiptMigrationRequest_("post", ":batchUpdate", body);
}

// Public operator entries: the ONLY outer lock, acquired BEFORE
// normalize/lookup, released exactly once. Lock/runtime failure happens
// before any durable intent (definite REFUSED); post-intent uncertainty is
// UNKNOWN with identity retained. Zero production invocation in local tests.
function purchaseCorrectionPublic_(operationType, payload) {
  var c = PURCHASE_EVENT_CORRECTION, codes = c.CODES;
  var requestKey = purchaseCorrectionPayloadKey_(payload);
  var ss = null, dispatcher = null, gate = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    dispatcher = {
      now: function() { return new Date(); },
      uuid: function() { return Utilities.getUuid(); },
      flush: function() { SpreadsheetApp.flush(); },
      invalidate: function() { invalidateDashboardCache(); },
      purchaseSingleCommit: { batch: function(ranges) {
        return purchaseCorrectionBatchRequest_(ranges);
      } }
    };
    gate = purchaseSingleCommitGate_(dispatcher);
  } catch (error) {
    return purchaseCorrectionResult_(c.STATUS.REFUSED, {
      code: codes.CORRECTION_RUNTIME_UNAVAILABLE, requestKey: requestKey,
      detail: String(error && error.message || error) });
  }
  var lock = null, acquired = false;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000);
    acquired = true;
  } catch (error) {
    return purchaseCorrectionResult_(c.STATUS.REFUSED, {
      code: codes.OUTER_LOCK_UNAVAILABLE, requestKey: requestKey,
      detail: String(error && error.message || error) });
  }
  try {
    return purchaseCorrectionDispatch_(operationType, payload, ss, dispatcher, gate);
  } catch (error) {
    return purchaseCorrectionResult_(c.STATUS.UNKNOWN, {
      code: codes.CORRECTION_EXECUTION_UNKNOWN, requestKey: requestKey,
      detail: String(error && error.message || error) });
  } finally {
    if (acquired) {
      try { lock.releaseLock(); } catch (lockError) { /* lock auto-expires */ }
    }
  }
}

function purchaseEventDurableVoid(payload) {
  return purchaseCorrectionPublic_(PURCHASE_EVENT_CORRECTION.VOID, payload);
}

function purchaseEventDurableCorrect(payload) {
  return purchaseCorrectionPublic_(PURCHASE_EVENT_CORRECTION.CORRECT, payload);
}
