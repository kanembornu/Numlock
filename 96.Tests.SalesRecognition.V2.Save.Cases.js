// SALES_RECOGNITION_V2 U2 durable save tests: focused local suites over the
// injected runtime (fixture spreadsheet + in-memory operations repository +
// injected batch). No production access, no network, no clasp.

function salesV2SaveFixture_(initial) {
  var sheets = Object.create(null);
  function sheet(name, values) {
    var rows = (values || []).map(function(row) { return row.slice(); });
    return {
      getName: function() { return name; },
      getLastRow: function() { return rows.length; },
      getLastColumn: function() { return rows.length ? rows[0].length : 0; },
      getDataRange: function() { return { getValues: function() { return rows.map(function(row) { return row.slice(); }); } }; },
      getRange: function(row, col, height, width) {
        return {
          getValues: function() { return rows.slice(row - 1, row - 1 + height).map(function(r) { return r.slice(col - 1, col - 1 + width); }); },
          getFormulas: function() { return Array.from({ length: height }, function() { return Array(width).fill(""); }); },
          getNotes: function() { return Array.from({ length: height }, function() { return Array(width).fill(""); }); },
          setValues: function(input) {
            input.forEach(function(r, i) {
              while (rows.length < row + i) rows.push([]);
              r.forEach(function(v, j) { rows[row - 1 + i][col - 1 + j] = v; });
            });
            return this;
          }
        };
      },
      values: rows
    };
  }
  Object.keys(initial || {}).forEach(function(name) { sheets[name] = sheet(name, initial[name]); });
  return {
    getSheetByName: function(name) { return sheets[name] || null; },
    fixtureSheet: function(name) { return sheets[name] || null; }
  };
}

function salesV2SaveTable_(headers, rows) {
  return [headers.slice()].concat((rows || []).map(function(row) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }));
}

function salesV2SaveOpsRepository_() {
  var operations = [];
  function find(type, key) {
    var matches = operations.filter(function(row) {
      return row.OperationType === type && row.RequestKey === key;
    });
    if (matches.length > 1) throw new Error("DUPLICATE_OPERATION");
    return matches[0] || null;
  }
  return {
    findOperation: find,
    createOperation: function(row) {
      if (find(row.OperationType, row.RequestKey)) throw new Error("DUPLICATE_OPERATION");
      operations.push(Object.assign({}, row));
      return row;
    },
    updateOperation: function(row) {
      var found = find(row.OperationType, row.RequestKey);
      if (!found || found.OperationID !== row.OperationID) throw new Error("OPERATION_NOT_FOUND");
      Object.assign(found, row);
      return found;
    },
    rows: function() { return operations.slice(); }
  };
}

function salesV2SaveActiveConfig_() {
  return { mode: "ACTIVE", contractVersion: "SALES_RECOGNITION_V2", activationID: "ACT-U2",
    activatedAt: "2026-11-01T00:00:00.000Z", configVersion: 1 };
}

function salesV2SaveBaseSheets_() {
  var t = TRANSACTION_PRODUCTION_CONTRACT, contract = SALES_RECOGNITION_V2_CONTRACT,
    save = SALES_RECOGNITION_V2_SAVE,
    core4000 = BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE["4000"];
  var accounts = [
    { AccountCode: "1000", AccountName: "Cash on Hand", AccountType: "Asset", StatementGroup: "Current Assets",
      CashFlowGroup: "Operating", IsActive: true, CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" },
    { AccountCode: "1030", AccountName: "Sales Settlement Clearing", AccountType: "Asset",
      StatementGroup: "Current Assets", CashFlowGroup: "Operating", IsActive: true, CreatedAt: "",
      UpdatedAt: "", NormalBalance: "DEBIT" },
    { AccountCode: "2000", AccountName: "Accounts Payable", AccountType: "Liability",
      StatementGroup: "Current Liabilities", CashFlowGroup: "Operating", IsActive: true, CreatedAt: "",
      UpdatedAt: "", NormalBalance: "CREDIT" },
    { AccountCode: "2010", AccountName: "Customer Refund and Credit Payable", AccountType: "Liability",
      StatementGroup: "Current Liabilities", CashFlowGroup: "Operating", IsActive: true, CreatedAt: "",
      UpdatedAt: "", NormalBalance: "CREDIT" },
    { AccountCode: "4000", AccountName: core4000[0], AccountType: core4000[1],
      StatementGroup: core4000[2], CashFlowGroup: core4000[3], IsActive: true, CreatedAt: "",
      UpdatedAt: "", NormalBalance: "CREDIT" },
    { AccountCode: "6100", AccountName: "Salary Expense", AccountType: "Expense",
      StatementGroup: "Personnel Expense", CashFlowGroup: "Operating", IsActive: true, CreatedAt: "",
      UpdatedAt: "", NormalBalance: "DEBIT" }
  ];
  return {
    Orders: [t.ORDERS.HEADERS.slice()],
    OrderLines: [t.ORDER_LINES.HEADERS.slice()],
    TransactionOperations: [t.OPERATIONS.HEADERS.slice()],
    SalesRecognitionEvents: [contract.HEADERS.slice()],
    SalesRecognitionAudits: [save.AUDIT_HEADERS.slice()],
    BalanceLedger: [BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.slice()],
    Accounts: salesV2SaveTable_(CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS, accounts),
    Products: salesV2SaveTable_(PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS, [
      { ID_Prod: "P1", Produk: "Coffee", Kategori: "Drink", Kind: "Menu", RevenueAccountCode: "4000",
        COGSAccountCode: "5000", IsActive: true }]),
    ProductPricing: salesV2SaveTable_(PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS, [
      { ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: "2026-01-01", EffectiveTo: "", HPP: 2, Harga: 20000,
        IsActive: true }]),
    ProductVariants: salesV2SaveTable_(t.PRODUCT_VARIANTS.HEADERS, [
      { ProductVariantID: "PV1", ProductID: "P1", Tipe: "HOT", EffectiveFrom: "2026-01-01",
        EffectiveTo: "", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }]),
    RecipeVersions: salesV2SaveTable_(t.RECIPE_VERSIONS.HEADERS, [
      { RecipeVersionID: "RV1", ProductVariantID: "PV1", EffectiveFrom: "2026-01-01", EffectiveTo: "",
        IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }]),
    RecipeVersionLines: salesV2SaveTable_(t.RECIPE_VERSION_LINES.HEADERS, [
      { RecipeVersionLineID: "RVL1", RecipeVersionID: "RV1", ItemID: "I1", QtyBase: 1, BaseUOM: "gr" }]),
    InventoryItems: salesV2SaveTable_(BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS, [
      { ItemID: "I1", ItemName: "Beans", Classification: "RAW_MATERIAL", BaseUOM: "gr",
        EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "I1",
        CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }]),
    RecipeStandardCost: salesV2SaveTable_(RECIPE_STANDARD_COST_CONTRACT.HEADERS, [
      { ID: "C1", ItemID: "I1", StandardCost: 2, EffectiveFrom: "2026-01-01", EffectiveTo: "",
        IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }]),
    InventoryUOMConversions: [BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.slice()]
  };
}

function salesV2SaveRuntime_(options) {
  options = options || {};
  var fixture = options.fixture || salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var repository = options.repository || salesV2SaveOpsRepository_();
  var events = { authorityReads: 0, batches: [], appliedRows: 0 };
  var crashPoint = options.crash || null;
  var runtime = {
    spreadsheet: fixture,
    repository: repository,
    now: options.now || function() { return new Date("2026-10-15T02:03:04.000Z"); },
    actor: function() { return "tester@numlock.test"; },
    config: Object.prototype.hasOwnProperty.call(options, "config") ?
      options.config : salesV2SaveActiveConfig_(),
    readAuthority: function() {
      events.authorityReads++;
      return transactionProductionAuthority_(fixture);
    },
    crash: crashPoint ? function(point) {
      if (point === crashPoint) { crashPoint = null; throw new Error("CRASH:" + point); }
    } : null,
    events: events
  };
  runtime.batch = options.batch || function(ranges) {
    events.batches.push(ranges);
    ranges.forEach(function(range) {
      var sheet = fixture.getSheetByName(range.range);
      if (!sheet) throw new Error("Missing batch sheet: " + range.range);
      var cols = range.values[0] ? range.values[0].length : 0;
      sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, cols).setValues(range.values);
      events.appliedRows += range.values.length;
    });
  };
  return runtime;
}

function salesV2SavePayload_(key) {
  return { requestKey: key || "u2-key-1", orderType: "DINE_IN",
    lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 },
      { productID: "P1", productVariantID: "PV1", qty: 2 }] };
}

function salesV2SaveRowCounts_(fixture) {
  var names = SALES_RECOGNITION_V2_SAVE.WRITE_SURFACES.concat(["TransactionOperations"]);
  var out = {};
  names.forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    out[name] = sheet ? sheet.getLastRow() : -1;
  });
  return out;
}

function salesV2SaveNoDate_(value) {
  if (value instanceof Date) return false;
  if (Array.isArray(value)) return value.every(salesV2SaveNoDate_);
  if (value && typeof value === "object") {
    return Object.keys(value).every(function(key) { return salesV2SaveNoDate_(value[key]); });
  }
  return true;
}
function testSalesRecognitionV2SaveCore() {
  var pass = 0;
  function check(id, value) { if (!value) throw new Error("SALES_V2_SAVE_CORE:" + id); pass++; }
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    t = TRANSACTION_PRODUCTION_CONTRACT;
  var runtime = salesV2SaveRuntime_(), fixture = runtime.spreadsheet,
    repository = runtime.repository;
  var result = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(), runtime);
  check("A1", result.status === "DONE" && result.code === "" && result.replay === false &&
    result.writeCount === 7 && result.requestKey === "u2-key-1" && result.operationID !== "");
  var operations = repository.rows();
  check("A2", operations.length === 1 && operations[0].State === "COMMITTED" &&
    operations[0].OperationType === save.OPERATION_TYPE &&
    operations[0].BusinessID === result.orderID && operations[0].LastError === "");
  var plan = JSON.parse(operations[0].OperationPlan);
  check("A3", plan.orderTotal === 60000 && plan.hppTotalSnapshot === 6 &&
    plan.lineRows.length === 2 && plan.actor === "tester@numlock.test" &&
    plan.economicDate === capitalEquityDateKey(new Date("2026-10-15T02:03:04.000Z")) &&
    plan.activationID === "ACT-U2" && plan.contractVersion === "SALES_RECOGNITION_V2" &&
    plan.operationID === operations[0].OperationID && plan.payloadHash === operations[0].PayloadHash);
  var orders = readCanonicalTable(fixture, "Orders", t.ORDERS.HEADERS);
  check("A4", orders.length === 1 && orders[0].OrderID === result.orderID &&
    orders[0].OrderNumber === result.orderID && orders[0].OrderType === "DINE_IN" &&
    orders[0].PaymentStatus === "UNPAID" && orders[0].FulfillmentStatus === "OPEN" &&
    Number(orders[0].OrderTotal) === 60000 && Number(orders[0].HppTotalSnapshot) === 6 &&
    orders[0].CreatedBy === "tester@numlock.test" && orders[0].PreparingAt === "" &&
    orders[0].ReadyAt === "" && orders[0].CompletedAt === "");
  var lines = readCanonicalTable(fixture, "OrderLines", t.ORDER_LINES.HEADERS);
  check("A5", lines.length === 2 &&
    lines[0].OrderLineID === "OL-" + result.orderID + "-1" &&
    lines[1].OrderLineID === "OL-" + result.orderID + "-2" &&
    Number(lines[0].Qty) === 1 && Number(lines[1].Qty) === 2 &&
    lines[0].OrderID === result.orderID && lines[1].OrderID === result.orderID);
  check("A6", Number(lines[0].SellingPriceSnapshot) === 20000 &&
    Number(lines[1].SellingPriceSnapshot) === 20000 &&
    Number(lines[0].UnitHppSnapshot) === 2 && Number(lines[1].UnitHppSnapshot) === 2 &&
    Number(lines[0].LineTotal) === 20000 && Number(lines[1].LineTotal) === 40000 &&
    Number(lines[0].LineHpp) === 2 && Number(lines[1].LineHpp) === 4 &&
    lines[0].RecipeVersionID === "RV1" && lines[0].ProductVariantID === "PV1" &&
    lines[0].ProductID === "P1" && lines[0].Tipe === "HOT");
  var headerRow = fixture.getSheetByName("SalesRecognitionEvents").getRange(1, 1, 1, 20)
    .getValues()[0].map(String);
  check("A7", contract.HEADERS.length === 20 &&
    JSON.stringify(headerRow) === JSON.stringify(contract.HEADERS));
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents", contract.HEADERS);
  check("A8", events.length === 1 && events[0].ContractVersion === "SALES_RECOGNITION_V2" &&
    events[0].EventType === "RECOGNITION" && events[0].PostingStatus === "COMMITTED" &&
    Number(events[0].Amount) === 60000 && events[0].ActivationID === "ACT-U2" &&
    events[0].OrderID === result.orderID && events[0].RevisionID === plan.revisionID &&
    events[0].OperationID === operations[0].OperationID && events[0].AuditID === result.auditID &&
    events[0].Actor === "tester@numlock.test" &&
    events[0].EconomicDate === plan.economicDate && events[0].RecognizedAt === plan.savedAt &&
    events[0].OriginalID === "" && events[0].ReversalOfRecognitionID === "" &&
    events[0].ReplacementID === "" && events[0].Reason === "" &&
    typeof events[0].SnapshotJSON === "string" &&
    JSON.parse(events[0].SnapshotJSON).lines.length === 2);
  var ledger = readCanonicalTable(fixture, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
  check("A9", ledger.length === 2 && ledger[0].AccountCode === "1030" &&
    Number(ledger[0].Debit) === 60000 && Number(ledger[0].Credit) === 0 &&
    ledger[1].AccountCode === "4000" && ledger[1].AccountCode === plan.accounts.revenue &&
    Number(ledger[1].Debit) === 0 && Number(ledger[1].Credit) === 60000 &&
    isCanonicalActive(ledger[0].IsActive) && isCanonicalActive(ledger[1].IsActive));
  var debit = 0, credit = 0;
  ledger.forEach(function(row) { debit += Number(row.Debit); credit += Number(row.Credit); });
  check("A10", debit === 60000 && credit === 60000 &&
    ledger[0].MovementType === "SALES_RECOGNITION" && ledger[1].MovementType === "SALES_RECOGNITION" &&
    ledger[0].SourceType === "SALES_RECOGNITION_V2" && ledger[0].SourceID === events[0].RecognitionID &&
    ledger[0].Tanggal === events[0].EconomicDate && ledger[0].JournalID === ledger[1].JournalID &&
    ledger[0].LineID === ledger[0].JournalID + "-1" && ledger[1].LineID === ledger[1].JournalID + "-2" &&
    events[0].RecognitionJournalID === ledger[0].JournalID);
  check("A11", events[0].JournalSignature === policyCJournalSignature_(ledger) &&
    events[0].JournalSignature === plan.journalSignature);
  var audits = readCanonicalTable(fixture, "SalesRecognitionAudits", save.AUDIT_HEADERS);
  check("A12", audits.length === 1 && audits[0].AuditID === events[0].AuditID &&
    audits[0].OperationID === events[0].OperationID && audits[0].RequestKey === "u2-key-1" &&
    audits[0].PayloadHash === operations[0].PayloadHash && audits[0].JournalID === ledger[0].JournalID &&
    audits[0].RecognitionID === events[0].RecognitionID && audits[0].OrderID === result.orderID &&
    audits[0].ContractVersion === "SALES_RECOGNITION_V2" && audits[0].SavedAt === events[0].RecognizedAt &&
    audits[0].Actor === "tester@numlock.test");
  // Duplicate click: same key + same normalized payload -> one effect.
  var countsBefore = JSON.stringify(salesV2SaveRowCounts_(fixture));
  var retryRuntime = salesV2SaveRuntime_({ fixture: fixture, repository: repository });
  var retry = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(), retryRuntime);
  check("A13", retry.status === "DONE" && retry.replay === true && retry.writeCount === 0 &&
    retry.orderID === result.orderID && repository.rows().length === 1 &&
    JSON.stringify(salesV2SaveRowCounts_(fixture)) === countsBefore &&
    retryRuntime.events.authorityReads === 0 && retryRuntime.events.batches.length === 0);
  // Changed payload, same key -> conflict with zero additional writes.
  var conflictPayload = salesV2SavePayload_();
  conflictPayload.lines[1].qty = 3;
  var conflictRuntime = salesV2SaveRuntime_({ fixture: fixture, repository: repository });
  var conflict = salesRecognitionV2SaveWithRuntime_(conflictPayload, conflictRuntime);
  check("A14", conflict.status === "CONFLICT" && conflict.code === "OPERATION_PAYLOAD_CONFLICT" &&
    conflict.writeCount === 0 && conflict.requestKey === "u2-key-1" &&
    conflict.orderID === result.orderID && repository.rows().length === 1 &&
    repository.rows()[0].PayloadHash === operations[0].PayloadHash &&
    JSON.stringify(salesV2SaveRowCounts_(fixture)) === countsBefore &&
    conflictRuntime.events.authorityReads === 0 && conflictRuntime.events.batches.length === 0);
  // Distinct keys -> distinct intents.
  var secondRuntime = salesV2SaveRuntime_({ fixture: fixture, repository: repository });
  var second = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u2-key-2"), secondRuntime);
  check("A15", second.status === "DONE" && second.orderID !== result.orderID &&
    repository.rows().length === 2 && secondRuntime.events.batches.length === 1);
  // No date/product/amount dedup: identical content under a new key still saves.
  var third = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u2-key-3"),
    salesV2SaveRuntime_({ fixture: fixture, repository: repository }));
  check("A16", third.status === "DONE" && third.orderID !== result.orderID &&
    third.orderID !== second.orderID && repository.rows().length === 3);
  // PAUSED refuses new intents (sticky pending handled by resume, not legacy).
  var pausedRuntime = salesV2SaveRuntime_({ fixture: fixture, repository: repository,
    config: Object.assign(salesV2SaveActiveConfig_(), { mode: "PAUSED" }) });
  var paused = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u2-key-4"), pausedRuntime);
  check("A17", paused.status === "REFUSED" && paused.code === "V2_MODE_PAUSED" &&
    paused.requestKey === "u2-key-4" && repository.rows().length === 3 &&
    pausedRuntime.events.authorityReads === 0 && pausedRuntime.events.batches.length === 0);
  // Pending V2 must not become legacy: a legacy ORDER_CREATE operation under the
  // same request key is a different (OperationType, RequestKey) identity.
  repository.createOperation({ OperationID: "TXOP-LEGACY-1", OperationType: "ORDER_CREATE",
    BusinessID: "ORD-LEGACY-1", RequestKey: "u2-key-legacy", State: "IN_PROGRESS",
    PayloadHash: "H-LEGACY", OperationPlan: "{}", CreatedAt: new Date("2026-10-01T00:00:00Z"),
    UpdatedAt: new Date("2026-10-01T00:00:00Z"), LastError: "" });
  var v2OverLegacy = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u2-key-legacy"),
    salesV2SaveRuntime_({ fixture: fixture, repository: repository }));
  var legacyRows = repository.rows().filter(function(row) {
    return row.OperationType === "ORDER_CREATE" && row.RequestKey === "u2-key-legacy";
  });
  var v2Rows = repository.rows().filter(function(row) {
    return row.OperationType === save.OPERATION_TYPE && row.RequestKey === "u2-key-legacy";
  });
  check("A18", v2OverLegacy.status === "DONE" && legacyRows.length === 1 &&
    legacyRows[0].State === "IN_PROGRESS" && legacyRows[0].PayloadHash === "H-LEGACY" &&
    legacyRows[0].OperationPlan === "{}" && v2Rows.length === 1 &&
    v2Rows[0].State === "COMMITTED");
  // Envelope is Date-safe (no Date instances anywhere).
  check("A19", salesV2SaveNoDate_(result) && salesV2SaveNoDate_(retry) &&
    salesV2SaveNoDate_(conflict) && salesV2SaveNoDate_(paused));
  // Invalid order type: definite pre-intent refusal, no operation persisted.
  var invalidType = salesV2SavePayload_("u2-key-5");
  invalidType.orderType = "dine_in";
  var opsBefore = repository.rows().length;
  var invalid = salesRecognitionV2SaveWithRuntime_(invalidType,
    salesV2SaveRuntime_({ fixture: fixture, repository: repository }));
  check("A20", invalid.status === "REFUSED" && invalid.code === "INVALID_ORDER_TYPE" &&
    repository.rows().length === opsBefore);
  // ProductVariant effective-date authority: out-of-window variant refuses.
  var lateSheets = salesV2SaveBaseSheets_();
  lateSheets.ProductVariants = salesV2SaveTable_(t.PRODUCT_VARIANTS.HEADERS, [
    { ProductVariantID: "PV1", ProductID: "P1", Tipe: "HOT", EffectiveFrom: "2027-01-01",
      EffectiveTo: "", IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }]);
  var lateFixture = salesV2SaveFixture_(lateSheets);
  var lateRuntime = salesV2SaveRuntime_({ fixture: lateFixture });
  var lateCounts = JSON.stringify(salesV2SaveRowCounts_(lateFixture));
  var late = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u2-key-21"), lateRuntime);
  check("A21", late.status === "REFUSED" &&
    late.code === "PRODUCT_VARIANT_EFFECTIVE_WINDOW" && late.detail === "PV1" &&
    JSON.stringify(salesV2SaveRowCounts_(lateFixture)) === lateCounts &&
    lateRuntime.repository.rows().length === 0 && lateRuntime.events.batches.length === 0);
  // Outer-lock wrapper only; core sources never lock (no nested locks).
  var wrapperSource = salesRecognitionV2DurableSave.toString();
  var coreSource = salesRecognitionV2SaveWithRuntime_.toString() +
    salesRecognitionV2SaveNewIntent_.toString() + salesRecognitionV2SaveResume_.toString() +
    salesRecognitionV2SaveApplyBatch_.toString();
  check("A22", wrapperSource.indexOf("waitLock") !== -1 &&
    wrapperSource.indexOf("releaseLock") !== -1 && wrapperSource.indexOf("salesRecognitionV2SaveWithRuntime_") !== -1 &&
    coreSource.indexOf("waitLock") === -1 && coreSource.indexOf("releaseLock") === -1);
  // Exact lookup happens before any master/authority read.
  var trace = [];
  var baseRepo = salesV2SaveOpsRepository_();
  var tracedRepo = {
    findOperation: function(type, key) { trace.push("lookup"); return baseRepo.findOperation(type, key); },
    createOperation: function(row) { trace.push("create"); return baseRepo.createOperation(row); },
    updateOperation: function(row) { trace.push("update"); return baseRepo.updateOperation(row); },
    rows: function() { return baseRepo.rows(); }
  };
  var tracedRuntime = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(salesV2SaveBaseSheets_()),
    repository: tracedRepo });
  var innerRead = tracedRuntime.readAuthority;
  tracedRuntime.readAuthority = function() { trace.push("authority"); return innerRead(); };
  var tracedResult = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("u2-key-30"), tracedRuntime);
  check("A23", tracedResult.status === "DONE" && trace[0] === "lookup" &&
    trace.indexOf("lookup") < trace.indexOf("authority") &&
    trace.indexOf("lookup") < trace.indexOf("create"));
  return { total: 23, pass: pass, fail: 23 - pass };
}
function testSalesRecognitionV2SaveRecovery() {
  var pass = 0;
  function check(id, value) { if (!value) throw new Error("SALES_V2_SAVE_RECOVERY:" + id); pass++; }
  var contract = SALES_RECOGNITION_V2_CONTRACT, t = TRANSACTION_PRODUCTION_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  // Crash at every boundary, then resume with the same key.
  ["V2_AFTER_INTENT", "V2_AFTER_BATCH", "V2_BEFORE_COMMIT"].forEach(function(point, index) {
    var id = "B" + (index + 1);
    var runtime = salesV2SaveRuntime_({ crash: point });
    var fixture = runtime.spreadsheet, repository = runtime.repository;
    var threw = null;
    try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("crash-" + point), runtime); }
    catch (error) { threw = error; }
    check(id + "a", !!threw && threw.message === "CRASH:" + point);
    check(id + "b", repository.rows().length === 1 && repository.rows()[0].State === "IN_PROGRESS");
    var intentOnly = point === "V2_AFTER_INTENT";
    check(id + "c", fixture.getSheetByName("Orders").getLastRow() === (intentOnly ? 1 : 2) &&
      fixture.getSheetByName("SalesRecognitionEvents").getLastRow() === (intentOnly ? 1 : 2) &&
      fixture.getSheetByName("BalanceLedger").getLastRow() === (intentOnly ? 1 : 3));
    var resume = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("crash-" + point),
      salesV2SaveRuntime_({ fixture: fixture, repository: repository }));
    check(id + "d", resume.status === "DONE" && resume.writeCount === (intentOnly ? 7 : 0) &&
      resume.replay === !intentOnly);
    check(id + "e", repository.rows()[0].State === "COMMITTED");
    check(id + "f", fixture.getSheetByName("Orders").getLastRow() === 2 &&
      fixture.getSheetByName("OrderLines").getLastRow() === 3 &&
      fixture.getSheetByName("SalesRecognitionEvents").getLastRow() === 2 &&
      fixture.getSheetByName("BalanceLedger").getLastRow() === 3 &&
      fixture.getSheetByName("SalesRecognitionAudits").getLastRow() === 2);
  });
  // Batch timeout with no applied artifacts -> UNKNOWN, identity preserved,
  // no autonomous retry inside the call; a later invocation resumes deterministically.
  var rt4 = salesV2SaveRuntime_();
  var events4 = rt4.events;
  rt4.batch = function(ranges) { events4.batches.push(ranges); throw new Error("ETIMEDOUT"); };
  var res4 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("timeout-1"), rt4);
  check("B4a", res4.status === "UNKNOWN" && res4.code === "BATCH_OUTCOME_UNKNOWN" &&
    res4.requestKey === "timeout-1" && res4.operationID !== "" && res4.writeCount === "UNKNOWN");
  check("B4b", !("success" in res4) && salesV2SaveNoDate_(res4));
  check("B4c", rt4.repository.rows()[0].State === "IN_PROGRESS");
  check("B4d", rt4.spreadsheet.getSheetByName("Orders").getLastRow() === 1 &&
    rt4.events.batches.length === 1);
  var later = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("timeout-1"),
    salesV2SaveRuntime_({ fixture: rt4.spreadsheet, repository: rt4.repository }));
  check("B4e", later.status === "DONE" && later.writeCount === 7 &&
    rt4.repository.rows()[0].State === "COMMITTED");
  // Timeout AFTER the batch applied: inspection proves exact artifacts -> commit.
  var rt5 = salesV2SaveRuntime_();
  var innerBatch = rt5.batch;
  rt5.batch = function(ranges) { innerBatch(ranges); throw new Error("ETIMEDOUT_AFTER_APPLY"); };
  var res5 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("timeout-2"), rt5);
  check("B5a", res5.status === "DONE" && res5.writeCount === 7);
  check("B5b", rt5.repository.rows()[0].State === "COMMITTED" &&
    rt5.spreadsheet.getSheetByName("SalesRecognitionEvents").getLastRow() === 2);
  // Committed response lost: replay verifies exact artifacts and returns DONE.
  var rt6 = salesV2SaveRuntime_();
  var first6 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("lost-1"), rt6);
  var counts6 = JSON.stringify(salesV2SaveRowCounts_(rt6.spreadsheet));
  var replay6 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("lost-1"),
    salesV2SaveRuntime_({ fixture: rt6.spreadsheet, repository: rt6.repository }));
  check("B6a", first6.status === "DONE" && replay6.status === "DONE" && replay6.replay === true &&
    replay6.writeCount === 0 && replay6.requestKey === "lost-1" &&
    replay6.orderID === first6.orderID);
  check("B6b", JSON.stringify(salesV2SaveRowCounts_(rt6.spreadsheet)) === counts6 &&
    rt6.repository.rows().length === 1);
  // Partial uncommitted artifacts -> fail closed, zero repair writes.
  var rt7 = salesV2SaveRuntime_({ crash: "V2_AFTER_INTENT" });
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("partial-1"), rt7); } catch (error) {}
  var plan7 = JSON.parse(rt7.repository.rows()[0].OperationPlan);
  rt7.spreadsheet.getSheetByName("Orders").getRange(2, 1, 1, t.ORDERS.HEADERS.length)
    .setValues([t.ORDERS.HEADERS.map(function(header) { return plan7.orderRow[header]; })]);
  var counts7 = JSON.stringify(salesV2SaveRowCounts_(rt7.spreadsheet));
  var res7 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("partial-1"),
    salesV2SaveRuntime_({ fixture: rt7.spreadsheet, repository: rt7.repository }));
  check("B7a", res7.status === "RECOVERY_REQUIRED" && res7.code === "ARTIFACTS_INCOMPLETE" &&
    res7.requestKey === "partial-1");
  check("B7b", JSON.stringify(salesV2SaveRowCounts_(rt7.spreadsheet)) === counts7 &&
    rt7.repository.rows()[0].State === "IN_PROGRESS");
  // Duplicate journal artifact -> IDENTITY_CONFLICT, no blind delete/repair.
  var rt8 = salesV2SaveRuntime_();
  var res8a = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("dupe-1"), rt8);
  var plan8 = JSON.parse(rt8.repository.rows()[0].OperationPlan);
  var extraJournal = Object.assign({}, plan8.journalRows[0], { LineID: plan8.journalID + "-X" });
  rt8.spreadsheet.getSheetByName("BalanceLedger").getRange(4, 1, 1, ledgerHeaders.length)
    .setValues([ledgerHeaders.map(function(header) { return extraJournal[header]; })]);
  var counts8 = JSON.stringify(salesV2SaveRowCounts_(rt8.spreadsheet));
  var res8b = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("dupe-1"),
    salesV2SaveRuntime_({ fixture: rt8.spreadsheet, repository: rt8.repository }));
  check("B8a", res8a.status === "DONE" && res8b.status === "RECOVERY_REQUIRED" &&
    res8b.code === "IDENTITY_CONFLICT");
  check("B8b", JSON.stringify(salesV2SaveRowCounts_(rt8.spreadsheet)) === counts8 &&
    rt8.repository.rows()[0].State === "COMMITTED");
  // Tampered event -> IDENTITY_CONFLICT, no repair.
  var rt9 = salesV2SaveRuntime_();
  var res9a = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("tamper-1"), rt9);
  rt9.spreadsheet.getSheetByName("SalesRecognitionEvents").values[1][8] = 999999;
  var counts9 = JSON.stringify(salesV2SaveRowCounts_(rt9.spreadsheet));
  var res9b = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("tamper-1"),
    salesV2SaveRuntime_({ fixture: rt9.spreadsheet, repository: rt9.repository }));
  check("B9a", res9a.status === "DONE" && res9b.status === "RECOVERY_REQUIRED" &&
    res9b.code === "IDENTITY_CONFLICT" && res9b.detail.indexOf("EVENT_TAMPERED") !== -1);
  check("B9b", JSON.stringify(salesV2SaveRowCounts_(rt9.spreadsheet)) === counts9);
  // Missing artifact -> ARTIFACTS_INCOMPLETE, no blind append.
  var rt10 = salesV2SaveRuntime_();
  var res10a = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("missing-1"), rt10);
  rt10.spreadsheet.getSheetByName("OrderLines").values.pop();
  var counts10 = JSON.stringify(salesV2SaveRowCounts_(rt10.spreadsheet));
  var res10b = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("missing-1"),
    salesV2SaveRuntime_({ fixture: rt10.spreadsheet, repository: rt10.repository }));
  check("B10a", res10a.status === "DONE" && res10b.status === "RECOVERY_REQUIRED" &&
    res10b.code === "ARTIFACTS_INCOMPLETE");
  check("B10b", JSON.stringify(salesV2SaveRowCounts_(rt10.spreadsheet)) === counts10 &&
    rt10.repository.rows()[0].State === "COMMITTED");
  // Extra foreign line bound to this OrderID -> IDENTITY_CONFLICT.
  var rt11 = salesV2SaveRuntime_();
  var res11a = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("extra-1"), rt11);
  var plan11 = JSON.parse(rt11.repository.rows()[0].OperationPlan);
  var extraLine = Object.assign({}, plan11.lineRows[0], { OrderLineID: "OL-" + plan11.orderID + "-99" });
  rt11.spreadsheet.getSheetByName("OrderLines").getRange(4, 1, 1, t.ORDER_LINES.HEADERS.length)
    .setValues([t.ORDER_LINES.HEADERS.map(function(header) { return extraLine[header]; })]);
  var counts11 = JSON.stringify(salesV2SaveRowCounts_(rt11.spreadsheet));
  var res11b = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("extra-1"),
    salesV2SaveRuntime_({ fixture: rt11.spreadsheet, repository: rt11.repository }));
  check("B11a", res11a.status === "DONE" && res11b.status === "RECOVERY_REQUIRED" &&
    res11b.code === "IDENTITY_CONFLICT");
  check("B11b", JSON.stringify(salesV2SaveRowCounts_(rt11.spreadsheet)) === counts11);
  // Master-change snapshot freeze: resume never recomputes mutable masters.
  var rt12 = salesV2SaveRuntime_({ crash: "V2_AFTER_INTENT" });
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("freeze-1"), rt12); } catch (error) {}
  rt12.spreadsheet.getSheetByName("ProductPricing").values[1][5] = 99999;
  rt12.spreadsheet.getSheetByName("RecipeStandardCost").values[1][2] = 77;
  var resumeRt = salesV2SaveRuntime_({ fixture: rt12.spreadsheet, repository: rt12.repository });
  var res12 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("freeze-1"), resumeRt);
  check("B12a", res12.status === "DONE" && res12.writeCount === 7);
  check("B12b", resumeRt.events.authorityReads === 0 && resumeRt.events.batches.length === 1);
  var frozenLines = readCanonicalTable(rt12.spreadsheet, "OrderLines", t.ORDER_LINES.HEADERS);
  check("B12c", frozenLines.length === 2 && Number(frozenLines[0].SellingPriceSnapshot) === 20000 &&
    Number(frozenLines[1].SellingPriceSnapshot) === 20000 &&
    Number(frozenLines[0].UnitHppSnapshot) === 2 && Number(frozenLines[1].UnitHppSnapshot) === 2);
  // Pre-intent definite refusal: PREPARED default config, zero writes of any kind.
  var rt13 = salesV2SaveRuntime_({ config: salesRecognitionV2DefaultConfig() });
  var snap13 = JSON.stringify(salesV2SaveRowCounts_(rt13.spreadsheet));
  var res13 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("prepared-1"), rt13);
  check("B13a", res13.status === "REFUSED" && res13.code === "V2_NOT_ACTIVATED" &&
    res13.requestKey === "prepared-1");
  check("B13b", !("success" in res13) && rt13.repository.rows().length === 0 &&
    rt13.events.authorityReads === 0 && rt13.events.batches.length === 0);
  check("B13c", JSON.stringify(salesV2SaveRowCounts_(rt13.spreadsheet)) === snap13);
  // Intent-only pending save resumes under PAUSED and stays V2 (never legacy).
  var rt14 = salesV2SaveRuntime_({ crash: "V2_AFTER_INTENT" });
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("pending-1"), rt14); } catch (error) {}
  check("B14a", rt14.repository.rows().length === 1 && rt14.repository.rows()[0].State === "IN_PROGRESS");
  var pausedConfig = Object.assign(salesV2SaveActiveConfig_(), { mode: "PAUSED" });
  var res14 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("pending-1"),
    salesV2SaveRuntime_({ fixture: rt14.spreadsheet, repository: rt14.repository, config: pausedConfig }));
  check("B14b", res14.status === "DONE" && res14.writeCount === 7 &&
    rt14.repository.rows()[0].State === "COMMITTED");
  var events14 = readCanonicalTable(rt14.spreadsheet, "SalesRecognitionEvents", contract.HEADERS);
  var verdict = classifySalesRecognitionCohort({ OrderID: res14.orderID },
    { events: events14, mode: "PAUSED", config: pausedConfig });
  check("B14c", verdict.cohort === "V2_COMMITTED" && verdict.status === "OK");
  var verdictPrepared = classifySalesRecognitionCohort({ OrderID: res14.orderID },
    { events: events14, config: salesRecognitionV2DefaultConfig() });
  check("B14d", verdictPrepared.cohort === "V2_COMMITTED" &&
    verdictPrepared.cohort !== "PRE_V2_ORDER" && verdictPrepared.cohort !== "TABSAL_LEGACY");
  return { total: 47, pass: pass, fail: 47 - pass };
}
function testSalesRecognitionV2SaveGates() {
  var pass = 0;
  function check(id, value) { if (!value) throw new Error("SALES_V2_SAVE_GATES:" + id); pass++; }
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    t = TRANSACTION_PRODUCTION_CONTRACT;
  var allSheetNames = ["Orders", "OrderLines", "TransactionOperations", "SalesRecognitionEvents",
    "SalesRecognitionAudits", "BalanceLedger", "Accounts", "Products", "ProductPricing",
    "ProductVariants", "RecipeVersions", "RecipeVersionLines", "InventoryItems",
    "RecipeStandardCost", "InventoryUOMConversions"];
  function snapshot(fixture) {
    var out = {};
    allSheetNames.forEach(function(name) {
      var sheet = fixture.getSheetByName(name);
      out[name] = sheet ? sheet.getLastRow() : -1;
    });
    return JSON.stringify(out);
  }
  // Schema gate: missing audit sheet -> zero-write refusal.
  var sheets1 = salesV2SaveBaseSheets_();
  delete sheets1.SalesRecognitionAudits;
  var rt1 = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(sheets1) });
  var snap1 = snapshot(rt1.spreadsheet);
  var res1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("gate-audit"), rt1);
  check("C1a", res1.status === "REFUSED" && res1.code === "SALES_V2_SCHEMA_NOT_READY" &&
    res1.detail.indexOf("SalesRecognitionAudits") !== -1);
  check("C1b", rt1.events.batches.length === 0 && rt1.repository.rows().length === 0 &&
    rt1.events.authorityReads === 0 && snapshot(rt1.spreadsheet) === snap1);
  // Schema gate: corrupted Orders header -> zero-write refusal.
  var sheets2 = salesV2SaveBaseSheets_();
  sheets2.Orders = [sheets2.Orders[0].slice()];
  sheets2.Orders[0][1] = "OrderNumberCorrupted";
  var rt2 = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(sheets2) });
  var snap2 = snapshot(rt2.spreadsheet);
  var res2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("gate-headers"), rt2);
  check("C2", res2.status === "REFUSED" && res2.code === "SALES_V2_SCHEMA_NOT_READY" &&
    res2.detail.indexOf("Orders") !== -1 && rt2.events.batches.length === 0 &&
    rt2.repository.rows().length === 0 && snapshot(rt2.spreadsheet) === snap2);
  // Account gate: absent 1030 -> zero-write refusal.
  var sheets3 = salesV2SaveBaseSheets_();
  sheets3.Accounts = sheets3.Accounts.filter(function(row, index) {
    return index === 0 || String(row[0]) !== "1030";
  });
  var rt3 = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(sheets3) });
  var snap3 = snapshot(rt3.spreadsheet);
  var res3 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("gate-accounts"), rt3);
  check("C3a", res3.status === "REFUSED" && res3.code === "ACCOUNT_ABSENT" &&
    res3.field === "1030");
  check("C3b", rt3.events.batches.length === 0 && rt3.repository.rows().length === 0 &&
    rt3.events.authorityReads === 0 && snapshot(rt3.spreadsheet) === snap3);
  // Account gate: inactive 4000.
  var sheets4 = salesV2SaveBaseSheets_();
  sheets4.Accounts = sheets4.Accounts.map(function(row) {
    return String(row[0]) === "4000" ? [row[0], row[1], row[2], row[3], row[4], false, row[6], row[7], row[8]] : row;
  });
  var rt4 = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(sheets4) });
  var res4 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("gate-inactive"), rt4);
  check("C4", res4.status === "REFUSED" && res4.code === "ACCOUNT_INACTIVE" &&
    res4.field === "4000" && rt4.repository.rows().length === 0);
  // Account gate: duplicate 2010.
  var sheets5 = salesV2SaveBaseSheets_();
  sheets5.Accounts = sheets5.Accounts.concat([sheets5.Accounts[4].slice()]);
  sheets5.Accounts[sheets5.Accounts.length - 1][0] = "2010";
  var rt5 = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(sheets5) });
  var res5 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("gate-duplicate"), rt5);
  check("C5", res5.status === "REFUSED" && res5.code === "ACCOUNT_DUPLICATE" &&
    res5.field === "2010" && rt5.repository.rows().length === 0);
  // Config gate: wrong contract version -> CONFIG_INVALID, zero reads of masters.
  var rt6 = salesV2SaveRuntime_({ config: { mode: "ACTIVE", contractVersion: "SALES_RECOGNITION_V1",
    activationID: "ACT-U2", activatedAt: "2026-11-01T00:00:00.000Z", configVersion: 1 } });
  var res6 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("gate-config"), rt6);
  check("C6", res6.status === "REFUSED" && res6.code === "CONFIG_INVALID" &&
    rt6.events.authorityReads === 0 && rt6.events.batches.length === 0 &&
    rt6.repository.rows().length === 0);
  // Cohort gate: persisted V2 event for the deterministic OrderID blocks a new intent.
  var sheets7 = salesV2SaveBaseSheets_();
  var fixture7 = salesV2SaveFixture_(sheets7);
  var orderID7 = transactionStableBusinessID_("ORD-", save.OPERATION_TYPE, "cohort-1");
  var planted = { RecognitionID: "SCR-PLANTED", ContractVersion: "SALES_RECOGNITION_V2",
    ActivationID: "ACT-U2", OrderID: orderID7, RevisionID: "REV-PLANTED", EventType: "RECOGNITION",
    RecognizedAt: "2026-10-10T00:00:00.000Z", EconomicDate: "2026-10-10", Amount: 1,
    RecognitionJournalID: "SRV2J-PLANTED", JournalSignature: "planted", PostingStatus: "PENDING",
    OperationID: "TXOP-PLANTED", AuditID: "SRA-PLANTED", OriginalID: "", ReversalOfRecognitionID: "",
    ReplacementID: "", Reason: "", Actor: "tester@numlock.test", SnapshotJSON: "{}" };
  fixture7.getSheetByName("SalesRecognitionEvents").getRange(2, 1, 1, contract.HEADERS.length)
    .setValues([contract.HEADERS.map(function(header) { return planted[header]; })]);
  var rt7 = salesV2SaveRuntime_({ fixture: fixture7 });
  var snap7 = snapshot(fixture7);
  var res7 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("cohort-1"), rt7);
  check("C7a", res7.status === "REFUSED" && res7.code === "SALES_V2_COHORT_NOT_CLEAR" &&
    res7.detail.indexOf("V2_PENDING") !== -1);
  check("C7b", rt7.repository.rows().length === 0 && rt7.events.batches.length === 0 &&
    rt7.events.authorityReads === 0 && snapshot(fixture7) === snap7);
  // Cohort gate: unbound evidence (missing OrderID) refuses globally.
  var sheets8 = salesV2SaveBaseSheets_();
  var fixture8 = salesV2SaveFixture_(sheets8);
  var unbound = Object.assign({}, planted, { OrderID: "", RecognitionID: "SCR-UNBOUND" });
  fixture8.getSheetByName("SalesRecognitionEvents").getRange(2, 1, 1, contract.HEADERS.length)
    .setValues([contract.HEADERS.map(function(header) { return unbound[header]; })]);
  var rt8 = salesV2SaveRuntime_({ fixture: fixture8 });
  var res8 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("cohort-2"), rt8);
  check("C8", res8.status === "REFUSED" && res8.code === "SALES_V2_COHORT_NOT_CLEAR" &&
    res8.detail.indexOf("EVIDENCE_UNBOUND") !== -1 && rt8.repository.rows().length === 0);
  // Bounds: line-count limit refused BEFORE any write (no operation persisted).
  var rt9 = salesV2SaveRuntime_();
  var snap9 = snapshot(rt9.spreadsheet);
  var payload9 = { requestKey: "gate-lines", orderType: "DINE_IN", lines: [] };
  for (var i = 0; i < 51; i++) {
    payload9.lines.push({ productID: "P1", productVariantID: "PV1", qty: 1 });
  }
  var res9 = salesRecognitionV2SaveWithRuntime_(payload9, rt9);
  check("C9a", res9.status === "REFUSED" && res9.code === "BATCH_BOUNDS_EXCEEDED");
  check("C9b", rt9.repository.rows().length === 0 && rt9.events.batches.length === 0 &&
    snapshot(rt9.spreadsheet) === snap9);
  // Bounds function: cell and byte limits are enforced directly.
  var fatPlan = { orderRow: {}, auditRow: {}, journalRows: [], eventRow: { SnapshotJSON: "" },
    lineRows: [] };
  for (var j = 0; j < 400; j++) fatPlan.lineRows.push({ OrderLineID: "X" + j });
  var cellsBounds = salesRecognitionV2SaveBounds_(fatPlan);
  var bytePlan = { orderRow: {}, auditRow: {}, journalRows: [],
    eventRow: { SnapshotJSON: new Array(1100002).join("x") }, lineRows: [] };
  var bytesBounds = salesRecognitionV2SaveBounds_(bytePlan);
  var okPlan = { orderRow: {}, auditRow: {}, journalRows: [],
    eventRow: { SnapshotJSON: "{}" }, lineRows: [] };
  check("C10", cellsBounds.ok === false && bytesBounds.ok === false &&
    salesRecognitionV2SaveBounds_(okPlan).ok === true && save.MAX_BATCH_CELLS === 4000 &&
    save.MAX_REQUEST_BYTES === 1000000 && save.MAX_ORDER_LINES === 50);
  // Batch adapter: exactly the five write surfaces, correct row counts, no
  // forbidden surface tokens in the range builder or transport.
  var rt11 = salesV2SaveRuntime_();
  var res11 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("ranges-1"), rt11);
  var ranges = rt11.events.batches[0];
  check("C11a", res11.status === "DONE" &&
    JSON.stringify(ranges.map(function(range) { return range.range; })) ===
      JSON.stringify(save.WRITE_SURFACES) &&
    JSON.stringify(ranges.map(function(range) { return range.values.length; })) ===
      JSON.stringify([1, 2, 1, 2, 1]));
  var rangeSource = salesRecognitionV2SaveValueRanges_.toString();
  var transportSource = salesRecognitionV2SaveBatchRequest_.toString();
  check("C11b", ["Settlements", "Payments", "InventoryLedger", "Cash", "Fulfillment"].every(
    function(token) { return rangeSource.indexOf(token) === -1; }) &&
    transportSource.indexOf("values:batchAppend") !== -1 &&
    transportSource.indexOf("inventoryReceiptMigrationRequest_") !== -1);
  // Forbidden artifacts: no extra sheets, no rows outside the five surfaces.
  check("C12", !rt11.spreadsheet.getSheetByName("Payments") &&
    !rt11.spreadsheet.getSheetByName("Settlements") &&
    !rt11.spreadsheet.getSheetByName("InventoryLedger") &&
    JSON.stringify(Object.keys(salesV2SaveBaseSheets_()).sort()) ===
      JSON.stringify(allSheetNames.slice().sort()) &&
    readCanonicalTable(rt11.spreadsheet, "BalanceLedger",
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS).length === 2);
  // Core is lockless; the injected runtime works without any lock object.
  check("C13", !("lock" in rt11) && res11.status === "DONE" &&
    salesRecognitionV2SaveWithRuntime_.toString().indexOf("LockService") === -1);
  // Seam default: a runtime with no config falls back to PREPARED and refuses.
  var bareRuntime = { spreadsheet: salesV2SaveFixture_(salesV2SaveBaseSheets_()),
    repository: salesV2SaveOpsRepository_(),
    now: function() { return new Date("2026-10-15T02:03:04.000Z"); },
    actor: function() { return "tester@numlock.test"; },
    batch: function() { throw new Error("BATCH_MUST_NOT_RUN"); } };
  var res14 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("seam-1"), bareRuntime);
  check("C14", res14.status === "REFUSED" && res14.code === "V2_NOT_ACTIVATED" &&
    bareRuntime.repository.rows().length === 0);
  // Legacy paths unchanged; U1 foundation contract frozen.
  var legacySource = createDurableOperationalOrder_.toString() +
    submitOperationalOrder.toString() + recoverTransactionOperation.toString();
  check("C15", legacySource.indexOf("ORDER_CREATE") !== -1 &&
    legacySource.indexOf("ORDER_READBACK_INCOMPLETE") !== -1 &&
    legacySource.indexOf("createDurableOperationalOrder_") !== -1 &&
    legacySource.indexOf("SALES_RECOGNITION_V2_SAVE") === -1 &&
    contract.HEADERS.length === 20 && typeof classifySalesRecognitionCohort === "function" &&
    typeof preflightSalesRecognitionAccounts === "function" &&
    typeof validateSalesRecognitionV2Config === "function");
  // Wrapper wiring: production runtime factory + REST transport tokens only.
  var factorySource = salesRecognitionV2SaveRuntime_.toString();
  check("C16", factorySource.indexOf("requireNumlockProductionSpreadsheet") !== -1 &&
    factorySource.indexOf("createTransactionSpreadsheetRepository") !== -1 &&
    factorySource.indexOf("salesRecognitionV2DefaultConfig") !== -1 &&
    factorySource.indexOf("salesRecognitionV2SaveBatchRequest_") !== -1 &&
    factorySource.indexOf("salesRecognitionV2RequestGate") === -1);
  // Frozen plan JSON round-trips exactly (stable replay comparisons).
  var plan17 = JSON.parse(rt11.repository.rows()[0].OperationPlan);
  check("C17", JSON.stringify(JSON.parse(JSON.stringify(plan17))) ===
    JSON.stringify(plan17) && plan17.operationType === save.OPERATION_TYPE &&
    plan17.accounts.settlement === "1030" && plan17.accounts.revenue === "4000");
  return { total: 22, pass: pass, fail: 22 - pass };
}
