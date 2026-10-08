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

// In-memory operations repository mirroring the spreadsheet repository:
// findOperation returns a FRESH copy (realistic sheet readback, so a commit
// mutation without a successful update never leaks into stored state) while
// updateOperation writes onto the stored row. rows() exposes stored references
// so tests can tamper persisted state directly.
function salesV2SaveOpsRepository_() {
  var operations = [];
  function findStored(type, key) {
    var matches = operations.filter(function(row) {
      return row.OperationType === type && row.RequestKey === key;
    });
    if (matches.length > 1) throw new Error("DUPLICATE_OPERATION");
    return matches[0] || null;
  }
  return {
    findOperation: function(type, key) {
      var stored = findStored(type, key);
      return stored ? Object.assign({}, stored) : null;
    },
    createOperation: function(row) {
      if (findStored(row.OperationType, row.RequestKey)) throw new Error("DUPLICATE_OPERATION");
      operations.push(Object.assign({}, row));
      return row;
    },
    updateOperation: function(row) {
      var stored = findStored(row.OperationType, row.RequestKey);
      if (!stored || stored.OperationID !== row.OperationID) throw new Error("OPERATION_NOT_FOUND");
      Object.assign(stored, row);
      return stored;
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
  // Exact normalized payload persisted verbatim + canonical plan integrity
  // digest + shape invariants all verify on the persisted plan.
  var expectedNormalized = { requestKey: "u2-key-1", orderType: "DINE_IN",
    lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 },
      { productID: "P1", productVariantID: "PV1", qty: 2 }] };
  check("A24", JSON.stringify(plan.normalizedPayload) === JSON.stringify(expectedNormalized) &&
    typeof plan.planDigest === "string" && plan.planDigest.length > 0 &&
    salesRecognitionV2SaveVerifyPlan_(plan).ok === true);
  // Complete analytical recipe/cost authority snapshot: components + UOM +
  // conversions + standard-cost authority + effective metadata reconstruct HPP.
  var auth0 = plan.lineAuthority[0];
  check("A25", Array.isArray(plan.lineAuthority) && plan.lineAuthority.length === 2 &&
    auth0.variant.ProductVariantID === "PV1" && auth0.variant.EffectiveFrom === "2026-01-01" &&
    auth0.recipe.RecipeVersionID === "RV1" && auth0.recipe.EffectiveTo === "" &&
    Array.isArray(auth0.components) && auth0.components.length === 1 &&
    auth0.components[0].ItemID === "I1" && auth0.components[0].BaseUOM === "gr" &&
    Array.isArray(auth0.components[0].conversions) &&
    auth0.components[0].item.BaseUOM === "gr" && auth0.components[0].item.ItemName === "Beans" &&
    auth0.components[0].standardCost.StandardCost === 2 &&
    auth0.components[0].standardCost.EffectiveFrom === "2026-01-01" &&
    Math.abs(auth0.components[0].QtyBase * auth0.components[0].standardCost.StandardCost -
      Number(lines[0].UnitHppSnapshot)) < 1e-9 &&
    auth0.price.Harga === 20000 && auth0.price.EffectiveFrom === "2026-01-01" &&
    Array.isArray(JSON.parse(events[0].SnapshotJSON).authority) &&
    JSON.parse(events[0].SnapshotJSON).authority.length === 2);
  // Ten-field operation readback helper: Date-safe equality (Date vs ISO).
  var opHeaders = t.OPERATIONS.HEADERS;
  var opRow = repository.rows()[0];
  var opAsIso = Object.assign({}, opRow,
    { CreatedAt: opRow.CreatedAt.toISOString(), UpdatedAt: opRow.UpdatedAt.toISOString() });
  check("A26", opHeaders.length === 10 &&
    salesRecognitionV2SaveFieldsExact_(opRow, opAsIso, opHeaders) === true &&
    salesRecognitionV2SaveFieldsExact_(null, opRow, opHeaders) === false &&
    salesRecognitionV2SaveFieldsExact_(opRow, null, opHeaders) === false);
  // Every one of the ten operation fields participates in exact readback.
  var everyFieldParticipates = opHeaders.every(function(header) {
    var clone = Object.assign({}, opRow);
    var value = clone[header];
    if (value instanceof Date) clone[header] = new Date(value.getTime() + 60000);
    else if (typeof value === "number") clone[header] = value + 1;
    else clone[header] = String(value) + "-TAMPERED";
    return salesRecognitionV2SaveFieldsExact_(clone, opRow, opHeaders) === false;
  });
  check("A27", everyFieldParticipates);
  return { total: 27, pass: pass, fail: 27 - pass };
}
function testSalesRecognitionV2SaveRecovery() {
  var pass = 0;
  function check(id, value) { if (!value) throw new Error("SALES_V2_SAVE_RECOVERY:" + id); pass++; }
  var contract = SALES_RECOGNITION_V2_CONTRACT, t = TRANSACTION_PRODUCTION_CONTRACT,
    ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  // Crash at every durability boundary, then resume with the same key.
  // Boundaries: before persist / after persist-before-readback / after intent /
  // batch / readback / before commit / after commit (response lost).
  [{ point: "V2_BEFORE_INTENT", ops: 0, state: "", artifacts: 0, write: 7, replay: false },
   { point: "V2_AFTER_INTENT_PERSIST", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 7, replay: false },
   { point: "V2_AFTER_INTENT", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 7, replay: false },
   { point: "V2_AFTER_BATCH", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2_AFTER_READBACK", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2_BEFORE_COMMIT", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "V2_AFTER_COMMIT", ops: 1, state: "COMMITTED", artifacts: 1, write: 0, replay: true }
  ].forEach(function(scenario, index) {
    var point = scenario.point, id = "BC" + (index + 1);
    var runtime = salesV2SaveRuntime_({ crash: point });
    var fixture = runtime.spreadsheet, repository = runtime.repository;
    var threw = null;
    try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("crash-" + point), runtime); }
    catch (error) { threw = error; }
    check(id + "a", !!threw && threw.message === "CRASH:" + point);
    var opsAfterCrash = repository.rows();
    check(id + "b", opsAfterCrash.length === scenario.ops &&
      (scenario.ops === 0 || opsAfterCrash[0].State === scenario.state));
    check(id + "c", fixture.getSheetByName("Orders").getLastRow() === (scenario.artifacts ? 2 : 1) &&
      fixture.getSheetByName("SalesRecognitionEvents").getLastRow() === (scenario.artifacts ? 2 : 1) &&
      fixture.getSheetByName("BalanceLedger").getLastRow() === (scenario.artifacts ? 3 : 1));
    var resume = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("crash-" + point),
      salesV2SaveRuntime_({ fixture: fixture, repository: repository }));
    check(id + "d", resume.status === "DONE" && resume.writeCount === scenario.write &&
      resume.replay === scenario.replay && resume.requestKey === "crash-" + point);
    check(id + "e", repository.rows().length === 1 && repository.rows()[0].State === "COMMITTED");
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
  // Duplicate operation identities: lookup and create collisions fail closed
  // as DUPLICATE_OPERATION_EVIDENCE with zero business writes.
  var dupInner = salesV2SaveOpsRepository_();
  var dupFindRepo = {
    findOperation: function() { throw new Error("DUPLICATE_OPERATION"); },
    createOperation: function(row) { return dupInner.createOperation(row); },
    updateOperation: function(row) { return dupInner.updateOperation(row); },
    rows: function() { return dupInner.rows(); } };
  var rtDup1 = salesV2SaveRuntime_({ repository: dupFindRepo });
  var resDup1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("dup-find-1"), rtDup1);
  check("B15a", resDup1.status === "RECOVERY_REQUIRED" &&
    resDup1.code === "DUPLICATE_OPERATION_EVIDENCE" && resDup1.requestKey === "dup-find-1" &&
    rtDup1.events.batches.length === 0 && dupInner.rows().length === 0);
  var dupCreateRepo = {
    findOperation: function(type, key) { return dupInner.findOperation(type, key); },
    createOperation: function() { throw new Error("DUPLICATE_OPERATION"); },
    updateOperation: function(row) { return dupInner.updateOperation(row); },
    rows: function() { return dupInner.rows(); } };
  var rtDup2 = salesV2SaveRuntime_({ repository: dupCreateRepo });
  var resDup2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("dup-create-1"), rtDup2);
  check("B15b", resDup2.status === "RECOVERY_REQUIRED" &&
    resDup2.code === "DUPLICATE_OPERATION_EVIDENCE" && resDup2.requestKey === "dup-create-1" &&
    rtDup2.events.batches.length === 0 && dupInner.rows().length === 0 &&
    rtDup2.spreadsheet.getSheetByName("Orders").getLastRow() === 1);
  // Commit update succeeds in memory but the row update fails: UNKNOWN with
  // identities preserved, stored state untouched; next retry verifies+commits.
  var commitInner = salesV2SaveOpsRepository_();
  var commitState = { failUpdate: true };
  var flakyRepo = {
    findOperation: function(type, key) { return commitInner.findOperation(type, key); },
    createOperation: function(row) { return commitInner.createOperation(row); },
    updateOperation: function(row) {
      if (commitState.failUpdate) throw new Error("UPDATE_TRANSPORT_FAILED");
      return commitInner.updateOperation(row);
    },
    rows: function() { return commitInner.rows(); } };
  var rtCommit = salesV2SaveRuntime_({ repository: flakyRepo });
  var resCommit1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("commit-flaky-1"), rtCommit);
  check("B16a", resCommit1.status === "UNKNOWN" && resCommit1.code === "COMMIT_OUTCOME_UNKNOWN" &&
    resCommit1.requestKey === "commit-flaky-1" && resCommit1.operationID !== "" &&
    commitInner.rows()[0].State === "IN_PROGRESS" &&
    rtCommit.spreadsheet.getSheetByName("SalesRecognitionEvents").getLastRow() === 2);
  commitState.failUpdate = false;
  var resCommit2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("commit-flaky-1"),
    salesV2SaveRuntime_({ fixture: rtCommit.spreadsheet, repository: flakyRepo }));
  check("B16b", resCommit2.status === "DONE" && resCommit2.writeCount === 0 &&
    commitInner.rows()[0].State === "COMMITTED");
  // Tampered PENDING plan (digest broken): fail closed with ZERO writes.
  var rtTamper = salesV2SaveRuntime_({ crash: "V2_AFTER_INTENT" });
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("tampered-plan-1"), rtTamper); }
  catch (error) {}
  var storedTamper = rtTamper.repository.rows()[0];
  var tamperedPlan = JSON.parse(storedTamper.OperationPlan);
  tamperedPlan.actor = "evil@intruder.test";
  storedTamper.OperationPlan = JSON.stringify(tamperedPlan);
  var countsTamper = JSON.stringify(salesV2SaveRowCounts_(rtTamper.spreadsheet));
  var resumeTamper = salesV2SaveRuntime_({ fixture: rtTamper.spreadsheet,
    repository: rtTamper.repository });
  var resTamper = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("tampered-plan-1"),
    resumeTamper);
  check("B17a", resTamper.status === "RECOVERY_REQUIRED" && resTamper.code === "IDENTITY_CONFLICT" &&
    resTamper.detail.indexOf("PLAN_DIGEST_MISMATCH") !== -1 &&
    resTamper.requestKey === "tampered-plan-1" && resTamper.operationID !== "");
  check("B17b", rtTamper.repository.rows()[0].State === "IN_PROGRESS" &&
    JSON.stringify(salesV2SaveRowCounts_(rtTamper.spreadsheet)) === countsTamper &&
    resumeTamper.events.batches.length === 0 && resumeTamper.events.authorityReads === 0);
  // Invalid persisted State is rejected, never committed.
  var rtState = salesV2SaveRuntime_({ crash: "V2_AFTER_INTENT" });
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("bad-state-1"), rtState); }
  catch (error) {}
  rtState.repository.rows()[0].State = "BOGUS";
  var countsState = JSON.stringify(salesV2SaveRowCounts_(rtState.spreadsheet));
  var resumeState = salesV2SaveRuntime_({ fixture: rtState.spreadsheet, repository: rtState.repository });
  var resState = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("bad-state-1"), resumeState);
  check("B18a", resState.status === "RECOVERY_REQUIRED" &&
    resState.code === "INVALID_OPERATION_STATE" && resState.detail === "STATE:BOGUS" &&
    resState.requestKey === "bad-state-1" && resState.operationID !== "");
  check("B18b", rtState.repository.rows()[0].State === "BOGUS" &&
    JSON.stringify(salesV2SaveRowCounts_(rtState.spreadsheet)) === countsState &&
    resumeState.events.batches.length === 0 && resumeState.events.authorityReads === 0);
  // Planned OrderLineID under a different OrderID -> IDENTITY_CONFLICT.
  var rtXLine = salesV2SaveRuntime_();
  var resXLine1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xowner-line-1"), rtXLine);
  var planXLine = JSON.parse(rtXLine.repository.rows()[0].OperationPlan);
  var foreignLine = Object.assign({}, planXLine.lineRows[0], { OrderID: "ORD-FOREIGN-99" });
  rtXLine.spreadsheet.getSheetByName("OrderLines").getRange(4, 1, 1, t.ORDER_LINES.HEADERS.length)
    .setValues([t.ORDER_LINES.HEADERS.map(function(header) { return foreignLine[header]; })]);
  var countsXLine = JSON.stringify(salesV2SaveRowCounts_(rtXLine.spreadsheet));
  var resXLine2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xowner-line-1"),
    salesV2SaveRuntime_({ fixture: rtXLine.spreadsheet, repository: rtXLine.repository }));
  check("B19a", resXLine1.status === "DONE" && resXLine2.status === "RECOVERY_REQUIRED" &&
    resXLine2.code === "IDENTITY_CONFLICT" &&
    resXLine2.detail.indexOf("ORDER_LINE_CROSS_OWNER") !== -1);
  check("B19b", JSON.stringify(salesV2SaveRowCounts_(rtXLine.spreadsheet)) === countsXLine &&
    rtXLine.repository.rows()[0].State === "COMMITTED");
  // Journal LineID collision / cross-owner record -> IDENTITY_CONFLICT.
  var rtXJournal = salesV2SaveRuntime_();
  var resXJournal1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xowner-journal-1"), rtXJournal);
  var planXJournal = JSON.parse(rtXJournal.repository.rows()[0].OperationPlan);
  var foreignJournal = Object.assign({}, planXJournal.journalRows[0],
    { JournalID: "FOREIGN-J", SourceID: "FOREIGN-S" });
  rtXJournal.spreadsheet.getSheetByName("BalanceLedger").getRange(4, 1, 1, ledgerHeaders.length)
    .setValues([ledgerHeaders.map(function(header) { return foreignJournal[header]; })]);
  var resXJournal2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xowner-journal-1"),
    salesV2SaveRuntime_({ fixture: rtXJournal.spreadsheet, repository: rtXJournal.repository }));
  check("B20a", resXJournal1.status === "DONE" && resXJournal2.status === "RECOVERY_REQUIRED" &&
    resXJournal2.code === "IDENTITY_CONFLICT" &&
    resXJournal2.detail.indexOf("JOURNAL_LINE_CROSS_OWNER") !== -1);
  // Source-set vs ID-set mismatch with EQUAL counts (2 vs 2, different rows).
  var rtXSet = salesV2SaveRuntime_();
  var resXSet1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xover-journal-1"), rtXSet);
  rtXSet.spreadsheet.getSheetByName("BalanceLedger").values[1][0] = "FOREIGN-J";
  rtXSet.spreadsheet.getSheetByName("BalanceLedger").values[2][8] = "FOREIGN-S";
  var resXSet2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xover-journal-1"),
    salesV2SaveRuntime_({ fixture: rtXSet.spreadsheet, repository: rtXSet.repository }));
  check("B21a", resXSet1.status === "DONE" && resXSet2.status === "RECOVERY_REQUIRED" &&
    resXSet2.code === "IDENTITY_CONFLICT" &&
    resXSet2.detail.indexOf("JOURNAL_IDENTITY_CROSSOVER") !== -1);
  // Audit ID-set vs operation-set mismatch with EQUAL counts (1 vs 1 rows).
  var rtXAudit = salesV2SaveRuntime_();
  var resXAudit1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xover-audit-1"), rtXAudit);
  var planXAudit = JSON.parse(rtXAudit.repository.rows()[0].OperationPlan);
  rtXAudit.spreadsheet.getSheetByName("SalesRecognitionAudits").values[1][2] = "TXOP-FOREIGN-AUDIT";
  var foreignAudit = Object.assign({}, planXAudit.auditRow, { AuditID: "SRA-FOREIGN-AUDIT" });
  rtXAudit.spreadsheet.getSheetByName("SalesRecognitionAudits")
    .getRange(3, 1, 1, SALES_RECOGNITION_V2_SAVE.AUDIT_HEADERS.length)
    .setValues([SALES_RECOGNITION_V2_SAVE.AUDIT_HEADERS.map(function(header) {
      return foreignAudit[header]; })]);
  var resXAudit2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xover-audit-1"),
    salesV2SaveRuntime_({ fixture: rtXAudit.spreadsheet, repository: rtXAudit.repository }));
  check("B22a", resXAudit1.status === "DONE" && resXAudit2.status === "RECOVERY_REQUIRED" &&
    resXAudit2.code === "IDENTITY_CONFLICT" &&
    resXAudit2.detail.indexOf("AUDIT_IDENTITY_CROSSOVER") !== -1);
  // OrderNumber and RecognitionID crossovers under foreign owners.
  var rtXOrder = salesV2SaveRuntime_();
  var resXOrder1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xowner-order-1"), rtXOrder);
  var planXOrder = JSON.parse(rtXOrder.repository.rows()[0].OperationPlan);
  var foreignOrder = Object.assign({}, planXOrder.orderRow,
    { OrderID: "ORD-FOREIGN-77", OrderNumber: planXOrder.orderNumber });
  rtXOrder.spreadsheet.getSheetByName("Orders").getRange(3, 1, 1, t.ORDERS.HEADERS.length)
    .setValues([t.ORDERS.HEADERS.map(function(header) { return foreignOrder[header]; })]);
  var foreignEvent = Object.assign({}, planXOrder.eventRow, { OrderID: "ORD-FOREIGN-77" });
  rtXOrder.spreadsheet.getSheetByName("SalesRecognitionEvents")
    .getRange(3, 1, 1, contract.HEADERS.length)
    .setValues([contract.HEADERS.map(function(header) { return foreignEvent[header]; })]);
  var resXOrder2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("xowner-order-1"),
    salesV2SaveRuntime_({ fixture: rtXOrder.spreadsheet, repository: rtXOrder.repository }));
  check("B23a", resXOrder1.status === "DONE" && resXOrder2.status === "RECOVERY_REQUIRED" &&
    resXOrder2.code === "IDENTITY_CONFLICT" &&
    resXOrder2.detail.indexOf("ORDER_NUMBER_CROSS_OWNER") !== -1);
  check("B23b", resXOrder2.detail.indexOf("RECOGNITION_IDENTITY_CROSSOVER") !== -1 &&
    resXOrder2.detail.indexOf("EVENT_OPERATION_CROSS_OWNER") !== -1);
  // COMMITTED with the ENTIRE artifact set missing -> fail closed, no re-append.
  var rtGone = salesV2SaveRuntime_();
  var resGone1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("committed-gone-1"), rtGone);
  SALES_RECOGNITION_V2_SAVE.WRITE_SURFACES.forEach(function(name) {
    rtGone.spreadsheet.getSheetByName(name).values.splice(1);
  });
  var countsGone = JSON.stringify(salesV2SaveRowCounts_(rtGone.spreadsheet));
  var resumeGone = salesV2SaveRuntime_({ fixture: rtGone.spreadsheet, repository: rtGone.repository });
  var resGone2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("committed-gone-1"), resumeGone);
  check("B24a", resGone1.status === "DONE" && resGone2.status === "RECOVERY_REQUIRED" &&
    resGone2.code === "ARTIFACTS_INCOMPLETE" && resGone2.requestKey === "committed-gone-1" &&
    resGone2.operationID !== "");
  check("B24b", rtGone.repository.rows()[0].State === "COMMITTED" &&
    JSON.stringify(salesV2SaveRowCounts_(rtGone.spreadsheet)) === countsGone &&
    resumeGone.events.batches.length === 0 && resumeGone.events.authorityReads === 0);
  // ---- Extended artifact-integrity matrix: reordered/mutated/duplicate/
  // missing/tampered artifacts, corrupted committed plan, and artifact-readback
  // IO failure all fail closed with zero repair writes (no blind append/delete/
  // repair/reconstruction); UNKNOWN readback preserves identity and recovers.
  function u2FreshSaved_(key) {
    var rt = salesV2SaveRuntime_();
    var res = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(key), rt);
    if (res.status !== "DONE") throw new Error("U2_FIXTURE_SAVE_FAILED:" + key);
    return rt;
  }
  function u2ResumeRun_(rt, key) {
    return salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(key),
      salesV2SaveRuntime_({ fixture: rt.spreadsheet, repository: rt.repository }));
  }
  // B25: reordered line rows -> deterministic conflict, no repair.
  var rt25 = u2FreshSaved_("int-reorder-1");
  var ol25 = rt25.spreadsheet.getSheetByName("OrderLines").values;
  var swap25 = ol25[1]; ol25[1] = ol25[2]; ol25[2] = swap25;
  var counts25 = JSON.stringify(salesV2SaveRowCounts_(rt25.spreadsheet));
  var res25 = u2ResumeRun_(rt25, "int-reorder-1");
  check("B25a", res25.status === "RECOVERY_REQUIRED" && res25.code === "IDENTITY_CONFLICT" &&
    res25.detail.indexOf("ORDER_LINE_ORDER") !== -1 && res25.requestKey === "int-reorder-1");
  check("B25b", JSON.stringify(salesV2SaveRowCounts_(rt25.spreadsheet)) === counts25 &&
    rt25.repository.rows()[0].State === "COMMITTED");
  // B26: mutated line quantity -> ORDER_LINE_TAMPERED, no repair.
  var rt26 = u2FreshSaved_("int-mutate-line-1");
  rt26.spreadsheet.getSheetByName("OrderLines").values[1][t.ORDER_LINES.HEADERS.indexOf("Qty")] = 5;
  var counts26 = JSON.stringify(salesV2SaveRowCounts_(rt26.spreadsheet));
  var res26 = u2ResumeRun_(rt26, "int-mutate-line-1");
  check("B26a", res26.status === "RECOVERY_REQUIRED" && res26.code === "IDENTITY_CONFLICT" &&
    res26.detail.indexOf("ORDER_LINE_TAMPERED") !== -1);
  check("B26b", JSON.stringify(salesV2SaveRowCounts_(rt26.spreadsheet)) === counts26 &&
    rt26.repository.rows()[0].State === "COMMITTED");
  // B27: duplicate RecognitionID (identical event row appended) -> fail closed.
  var rt27 = u2FreshSaved_("int-dupe-event-1");
  var ev27 = rt27.spreadsheet.getSheetByName("SalesRecognitionEvents");
  ev27.getRange(3, 1, 1, contract.HEADERS.length).setValues([ev27.values[1].slice()]);
  var counts27 = JSON.stringify(salesV2SaveRowCounts_(rt27.spreadsheet));
  var res27 = u2ResumeRun_(rt27, "int-dupe-event-1");
  check("B27a", res27.status === "RECOVERY_REQUIRED" && res27.code === "IDENTITY_CONFLICT" &&
    res27.detail.indexOf("EVENT_DUPLICATE") !== -1);
  check("B27b", JSON.stringify(salesV2SaveRowCounts_(rt27.spreadsheet)) === counts27 &&
    rt27.repository.rows()[0].State === "COMMITTED");
  // B28: missing Order with every other artifact present -> PARTIAL, no append.
  var rt28 = u2FreshSaved_("int-missing-order-1");
  rt28.spreadsheet.getSheetByName("Orders").values.pop();
  var counts28 = JSON.stringify(salesV2SaveRowCounts_(rt28.spreadsheet));
  var res28 = u2ResumeRun_(rt28, "int-missing-order-1");
  check("B28a", res28.status === "RECOVERY_REQUIRED" && res28.code === "ARTIFACTS_INCOMPLETE" &&
    res28.detail === "ORDER");
  check("B28b", JSON.stringify(salesV2SaveRowCounts_(rt28.spreadsheet)) === counts28 &&
    rt28.repository.rows()[0].State === "COMMITTED");
  // B29: missing Save audit -> PARTIAL, no append.
  var rt29 = u2FreshSaved_("int-missing-audit-1");
  rt29.spreadsheet.getSheetByName("SalesRecognitionAudits").values.pop();
  var counts29 = JSON.stringify(salesV2SaveRowCounts_(rt29.spreadsheet));
  var res29 = u2ResumeRun_(rt29, "int-missing-audit-1");
  check("B29a", res29.status === "RECOVERY_REQUIRED" && res29.code === "ARTIFACTS_INCOMPLETE" &&
    res29.detail === "AUDIT");
  check("B29b", JSON.stringify(salesV2SaveRowCounts_(rt29.spreadsheet)) === counts29 &&
    rt29.repository.rows()[0].State === "COMMITTED");
  // B30: one of the two journal lines missing -> PARTIAL, no append.
  var rt30 = u2FreshSaved_("int-missing-journal-1");
  rt30.spreadsheet.getSheetByName("BalanceLedger").values.pop();
  var counts30 = JSON.stringify(salesV2SaveRowCounts_(rt30.spreadsheet));
  var res30 = u2ResumeRun_(rt30, "int-missing-journal-1");
  check("B30a", res30.status === "RECOVERY_REQUIRED" && res30.code === "ARTIFACTS_INCOMPLETE" &&
    res30.detail === "JOURNAL_LINE");
  check("B30b", JSON.stringify(salesV2SaveRowCounts_(rt30.spreadsheet)) === counts30 &&
    rt30.repository.rows()[0].State === "COMMITTED");
  // B31: wrong journal account inside the artifact -> tampered, no repair.
  var rt31 = u2FreshSaved_("int-journal-account-1");
  rt31.spreadsheet.getSheetByName("BalanceLedger").values[1][ledgerHeaders.indexOf("AccountCode")] = "1100";
  var counts31 = JSON.stringify(salesV2SaveRowCounts_(rt31.spreadsheet));
  var res31 = u2ResumeRun_(rt31, "int-journal-account-1");
  check("B31a", res31.status === "RECOVERY_REQUIRED" && res31.code === "IDENTITY_CONFLICT" &&
    res31.detail.indexOf("JOURNAL_TAMPERED") !== -1);
  check("B31b", JSON.stringify(salesV2SaveRowCounts_(rt31.spreadsheet)) === counts31 &&
    rt31.repository.rows()[0].State === "COMMITTED");
  // B32: wrong journal amount inside the artifact -> tampered, no repair.
  var rt32 = u2FreshSaved_("int-journal-amount-1");
  rt32.spreadsheet.getSheetByName("BalanceLedger").values[1][ledgerHeaders.indexOf("Debit")] = 1;
  var counts32 = JSON.stringify(salesV2SaveRowCounts_(rt32.spreadsheet));
  var res32 = u2ResumeRun_(rt32, "int-journal-amount-1");
  check("B32a", res32.status === "RECOVERY_REQUIRED" && res32.code === "IDENTITY_CONFLICT" &&
    res32.detail.indexOf("JOURNAL_TAMPERED") !== -1);
  check("B32b", JSON.stringify(salesV2SaveRowCounts_(rt32.spreadsheet)) === counts32 &&
    rt32.repository.rows()[0].State === "COMMITTED");
  // B33: tampered Save audit -> tampered, no repair.
  var rt33 = u2FreshSaved_("int-audit-tamper-1");
  rt33.spreadsheet.getSheetByName("SalesRecognitionAudits").values[1]
    [SALES_RECOGNITION_V2_SAVE.AUDIT_HEADERS.indexOf("Actor")] = "evil@intruder.test";
  var counts33 = JSON.stringify(salesV2SaveRowCounts_(rt33.spreadsheet));
  var res33 = u2ResumeRun_(rt33, "int-audit-tamper-1");
  check("B33a", res33.status === "RECOVERY_REQUIRED" && res33.code === "IDENTITY_CONFLICT" &&
    res33.detail.indexOf("AUDIT_TAMPERED") !== -1);
  check("B33b", JSON.stringify(salesV2SaveRowCounts_(rt33.spreadsheet)) === counts33 &&
    rt33.repository.rows()[0].State === "COMMITTED");
  // B34: corrupted persisted plan on a COMMITTED operation -> fail closed with
  // zero writes; never replay Done from status alone.
  var rt34 = u2FreshSaved_("int-committed-plan-1");
  var stored34 = rt34.repository.rows()[0];
  var plan34 = JSON.parse(stored34.OperationPlan);
  plan34.actor = "evil@intruder.test";
  stored34.OperationPlan = JSON.stringify(plan34);
  var counts34 = JSON.stringify(salesV2SaveRowCounts_(rt34.spreadsheet));
  var res34 = u2ResumeRun_(rt34, "int-committed-plan-1");
  check("B34a", res34.status === "RECOVERY_REQUIRED" && res34.code === "IDENTITY_CONFLICT" &&
    res34.detail.indexOf("PLAN_DIGEST_MISMATCH") !== -1 && res34.requestKey === "int-committed-plan-1");
  check("B34b", JSON.stringify(salesV2SaveRowCounts_(rt34.spreadsheet)) === counts34 &&
    rt34.repository.rows()[0].State === "COMMITTED" &&
    stored34.OperationPlan.indexOf("evil@intruder.test") !== -1);
  // B35: artifact-readback IO failure while IN_PROGRESS -> explicit UNKNOWN /
  // READBACK_UNKNOWN with identity kept and ZERO writes; once the readback
  // works again the exact plan resumes and finishes with one batch.
  var rt35 = salesV2SaveRuntime_({ crash: "V2_AFTER_INTENT" });
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("int-readback-pending-1"), rt35); }
  catch (ignoredInt35) {}
  var ev35 = rt35.spreadsheet.getSheetByName("SalesRecognitionEvents");
  var origGet35 = ev35.getDataRange;
  ev35.getDataRange = function() { throw new Error("SIMULATED_READBACK_IO"); };
  var counts35 = JSON.stringify(salesV2SaveRowCounts_(rt35.spreadsheet));
  var res35 = u2ResumeRun_(rt35, "int-readback-pending-1");
  check("B35a", res35.status === "UNKNOWN" && res35.code === "READBACK_UNKNOWN" &&
    res35.requestKey === "int-readback-pending-1" && res35.operationID !== "" &&
    !("success" in res35) && rt35.repository.rows()[0].State === "IN_PROGRESS" &&
    JSON.stringify(salesV2SaveRowCounts_(rt35.spreadsheet)) === counts35);
  ev35.getDataRange = origGet35;
  var res35b = u2ResumeRun_(rt35, "int-readback-pending-1");
  check("B35b", res35b.status === "DONE" && res35b.writeCount === 7 &&
    rt35.repository.rows().length === 1 && rt35.repository.rows()[0].State === "COMMITTED" &&
    rt35.spreadsheet.getSheetByName("SalesRecognitionEvents").getLastRow() === 2);
  // B36: readback IO failure while COMMITTED -> UNKNOWN (never Done from status
  // alone); restored readback replays DONE with zero duplicate writes.
  var rt36 = u2FreshSaved_("int-readback-committed-1");
  var ev36 = rt36.spreadsheet.getSheetByName("SalesRecognitionEvents");
  var origGet36 = ev36.getDataRange;
  ev36.getDataRange = function() { throw new Error("SIMULATED_READBACK_IO"); };
  var counts36 = JSON.stringify(salesV2SaveRowCounts_(rt36.spreadsheet));
  var res36 = u2ResumeRun_(rt36, "int-readback-committed-1");
  check("B36a", res36.status === "UNKNOWN" && res36.code === "READBACK_UNKNOWN" &&
    res36.requestKey === "int-readback-committed-1" && res36.operationID !== "" &&
    rt36.repository.rows()[0].State === "COMMITTED" &&
    JSON.stringify(salesV2SaveRowCounts_(rt36.spreadsheet)) === counts36);
  ev36.getDataRange = origGet36;
  var res36b = u2ResumeRun_(rt36, "int-readback-committed-1");
  check("B36b", res36b.status === "DONE" && res36b.replay === true && res36b.writeCount === 0 &&
    JSON.stringify(salesV2SaveRowCounts_(rt36.spreadsheet)) === counts36 &&
    rt36.repository.rows().length === 1);
  return { total: 112, pass: pass, fail: 112 - pass };
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
  var transportSource = salesRecognitionV2SaveBatchRequest_.toString() +
    salesRecognitionV2SaveBatchBody_.toString() + salesRecognitionV2SaveSheetIdsRequest_.toString();
  check("C11b", ["Settlements", "Payments", "InventoryLedger", "Cash", "Fulfillment"].every(
    function(token) { return rangeSource.indexOf(token) === -1; }) &&
    transportSource.indexOf(":batchUpdate") !== -1 &&
    transportSource.indexOf("appendCells") !== -1 &&
    transportSource.indexOf("batchAppend") === -1 &&
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
  // ---- Mocked-real-transport: ONE spreadsheets.batchUpdate through the
  // sanitized transport (43 signature). URL/method/body/sheetIds/RAW cells/no
  // forbidden requests asserted against the actual transport code path.
  var ranges18 = salesRecognitionV2SaveValueRanges_(plan17);
  var idToName = { 101: "Orders", 102: "OrderLines", 103: "SalesRecognitionEvents",
    104: "BalanceLedger", 105: "SalesRecognitionAudits" };
  function metaSheet(sheetId, title) { return { properties: { sheetId: sheetId, title: title } }; }
  var metaFull = [metaSheet(101, "Orders"), metaSheet(102, "OrderLines"),
    metaSheet(103, "SalesRecognitionEvents"), metaSheet(104, "BalanceLedger"),
    metaSheet(105, "SalesRecognitionAudits"), metaSheet(999, "Payments")];
  var metaNoAudit = [metaSheet(101, "Orders"), metaSheet(102, "OrderLines"),
    metaSheet(103, "SalesRecognitionEvents"), metaSheet(104, "BalanceLedger"),
    metaSheet(999, "Payments")];
  var base18 = "https://sheets.googleapis.com/v4/spreadsheets/" +
    NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID;
  var recorded18 = [], postBody18 = null, postStatus18 = 200, postMode18 = "healthy";
  var applyTarget18 = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  function applyTransportBody18(fixture, body) {
    body.requests.forEach(function(request) {
      var append = request.appendCells;
      var values = append.rows.map(function(row) {
        return row.values.map(function(cell) {
          var data = cell.userEnteredValue;
          if (data.stringValue !== undefined) return data.stringValue;
          if (data.numberValue !== undefined) return data.numberValue;
          if (data.boolValue !== undefined) return data.boolValue;
          return null;
        });
      });
      var sheet = fixture.getSheetByName(idToName[append.sheetId]);
      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
    });
  }
  var hadScriptApp = Object.prototype.hasOwnProperty.call(globalThis, "ScriptApp");
  var hadUrlFetchApp = Object.prototype.hasOwnProperty.call(globalThis, "UrlFetchApp");
  var oldScriptApp = globalThis.ScriptApp, oldUrlFetchApp = globalThis.UrlFetchApp;
  try {
    globalThis.ScriptApp = { getOAuthToken: function() { return "local-test-token-000"; } };
    globalThis.UrlFetchApp = { fetch: function(url, options) {
      recorded18.push({ url: String(url), method: options.method });
      if (String(url).indexOf("?fields=") !== -1) {
        var meta = { spreadsheetId: NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
          sheets: postMode18 === "missing-audit" ? metaNoAudit : metaFull };
        return { getResponseCode: function() { return 200; },
          getContentText: function() { return JSON.stringify(meta); } };
      }
      if (postMode18 === "timeout") throw new Error("ETIMEDOUT");
      postBody18 = JSON.parse(options.payload);
      if (postStatus18 !== 200) {
        return { getResponseCode: function() { return postStatus18; },
          getContentText: function() { return JSON.stringify({ error: { code: postStatus18,
            status: "INVALID_ARGUMENT", message: "batch rejected",
            errors: [{ reason: "INVALID", domain: "global", message: "batch rejected" }] } }); } };
      }
      applyTransportBody18(applyTarget18, postBody18);
      return { getResponseCode: function() { return 200; },
        getContentText: function() { return JSON.stringify({ responses: [] }); } };
    } };
    // C18a: URL + method of the metadata GET and the single batchUpdate POST.
    recorded18 = [];
    salesRecognitionV2SaveBatchRequest_(ranges18);
    check("C18a", recorded18.length === 2 && recorded18[0].method === "get" &&
      recorded18[0].url.indexOf(base18 + "?fields=") === 0 &&
      recorded18[1].method === "post" && recorded18[1].url === base18 + ":batchUpdate");
    // C18b: five appendCells subrequests, correct sheetIds, RAW fields, counts.
    var reqs18 = postBody18.requests;
    check("C18b", reqs18.length === 5 &&
      JSON.stringify(reqs18.map(function(r) { return r.appendCells.sheetId; })) ===
        JSON.stringify([101, 102, 103, 104, 105]) &&
      JSON.stringify(reqs18.map(function(r) { return r.appendCells.rows.length; })) ===
        JSON.stringify([1, 2, 1, 2, 1]) &&
      reqs18.every(function(r) { return r.appendCells.fields === "userEnteredValue"; }));
    // C18c: safe RAW CellData only (no formulaValue), correct cell payloads.
    var hasFormula = false;
    reqs18.forEach(function(r) {
      r.appendCells.rows.forEach(function(row) {
        row.values.forEach(function(cell) {
          if (cell.userEnteredValue && cell.userEnteredValue.formulaValue !== undefined) hasFormula = true;
        });
      });
    });
    var orderCells18 = reqs18[0].appendCells.rows[0].values;
    var ledgerCells18 = reqs18[3].appendCells.rows[0].values;
    check("C18c", !hasFormula &&
      orderCells18[0].userEnteredValue.stringValue === plan17.orderID &&
      orderCells18[3].userEnteredValue.stringValue === "UNPAID" &&
      ledgerCells18[4].userEnteredValue.numberValue === 60000 &&
      ledgerCells18[11].userEnteredValue.boolValue === true &&
      typeof orderCells18[5].userEnteredValue.numberValue === "number");
    // C18d: no forbidden surfaces/endpoints; exactly two requests, no retries.
    var bodyText18 = JSON.stringify(postBody18);
    check("C18d", ["Payments", "Settlements", "InventoryLedger", "batchAppend"].every(
      function(token) { return bodyText18.indexOf(token) === -1; }) &&
      recorded18.every(function(entry) { return entry.url.indexOf("/v4/spreadsheets/") !== -1; }) &&
      recorded18.length === 2);
    // C18e: atomic rejection — a missing sheetId throws BEFORE any POST.
    postMode18 = "missing-audit";
    recorded18 = [];
    postBody18 = null;
    var atomicError = null;
    try { salesRecognitionV2SaveBatchRequest_(ranges18); } catch (error) { atomicError = error; }
    check("C18e", !!atomicError &&
      atomicError.message.indexOf("SHEET_ID_UNAVAILABLE") !== -1 &&
      recorded18.length === 1 && postBody18 === null);
    // C18f: server-side atomic rejection — single POST attempt, no retry.
    postMode18 = "healthy";
    postStatus18 = 400;
    recorded18 = [];
    var rejectError = null;
    try { salesRecognitionV2SaveBatchRequest_(ranges18); } catch (error) { rejectError = error; }
    check("C18f", !!rejectError && rejectError.message.indexOf("RECEIPT_SHEETS_HTTP_400") !== -1 &&
      recorded18.length === 2 && postBody18.requests.length === 5);
    postStatus18 = 200;
    // C18g: save-level timeout through the REAL transport -> UNKNOWN, identity
    // kept, no artifacts; C18h: recovery on the same key -> DONE.
    var transportFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
    applyTarget18 = transportFixture;
    var rtTransport = salesV2SaveRuntime_({ fixture: transportFixture });
    rtTransport.batch = function(ranges) { return salesRecognitionV2SaveBatchRequest_(ranges); };
    postMode18 = "timeout";
    recorded18 = [];
    var resTransport1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("transport-1"), rtTransport);
    check("C18g", resTransport1.status === "UNKNOWN" &&
      resTransport1.code === "BATCH_OUTCOME_UNKNOWN" &&
      resTransport1.requestKey === "transport-1" && resTransport1.operationID !== "" &&
      rtTransport.repository.rows()[0].State === "IN_PROGRESS" &&
      transportFixture.getSheetByName("Orders").getLastRow() === 1);
    postMode18 = "healthy";
    var resTransport2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("transport-1"),
      salesV2SaveRuntime_({ fixture: transportFixture, repository: rtTransport.repository }));
    check("C18h", resTransport2.status === "DONE" && resTransport2.writeCount === 7 &&
      rtTransport.repository.rows()[0].State === "COMMITTED" &&
      transportFixture.getSheetByName("SalesRecognitionEvents").getLastRow() === 2);
  } finally {
    if (hadScriptApp) globalThis.ScriptApp = oldScriptApp; else delete globalThis.ScriptApp;
    if (hadUrlFetchApp) globalThis.UrlFetchApp = oldUrlFetchApp; else delete globalThis.UrlFetchApp;
  }
  // ---- Cell-string safety bound: 50000-char Sheets cell refused conservatively
  // BEFORE any write (OperationPlan/SnapshotJSON covered by the same bound).
  var hugeKey = "u2-key-cell-" + new Array(46001).join("k");
  var rt19 = salesV2SaveRuntime_();
  var snap19 = snapshot(rt19.spreadsheet);
  var res19 = salesRecognitionV2SaveWithRuntime_(
    { requestKey: hugeKey, orderType: "DINE_IN",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 }] }, rt19);
  check("C19a", res19.status === "REFUSED" && res19.code === "BATCH_BOUNDS_EXCEEDED" &&
    res19.detail.indexOf("UNSAFE_CELL_CHARS") !== -1);
  check("C19b", rt19.repository.rows().length === 0 && rt19.events.batches.length === 0 &&
    snapshot(rt19.spreadsheet) === snap19 && save.MAX_CELL_CHARS === 45000 &&
    save.REQUEST_OVERHEAD_BYTES === 4096 &&
    salesRecognitionV2SaveUtf8Bytes_("é") === 2 && salesRecognitionV2SaveUtf8Bytes_("😀") === 4);
  // ---- Resume re-checks schema + stored bounds BEFORE the batch, with zero
  // authority (master) recomputation.
  var rt20 = salesV2SaveRuntime_({ crash: "V2_AFTER_INTENT" });
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("resume-schema-1"), rt20); }
  catch (error) {}
  rt20.spreadsheet.getSheetByName("Orders").values[0][1] = "CorruptedHeader";
  var counts20 = JSON.stringify(salesV2SaveRowCounts_(rt20.spreadsheet));
  var resume20 = salesV2SaveRuntime_({ fixture: rt20.spreadsheet, repository: rt20.repository });
  var res20 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("resume-schema-1"), resume20);
  check("C20a", res20.status === "RECOVERY_REQUIRED" && res20.code === "SALES_V2_SCHEMA_NOT_READY" &&
    res20.detail.indexOf("Orders") !== -1 && rt20.repository.rows()[0].State === "IN_PROGRESS" &&
    JSON.stringify(salesV2SaveRowCounts_(rt20.spreadsheet)) === counts20 &&
    resume20.events.batches.length === 0 && resume20.events.authorityReads === 0);
  var resumeSource = salesRecognitionV2SaveResume_.toString();
  check("C20b", resumeSource.indexOf("salesRecognitionV2SaveSchemaGate_") !== -1 &&
    resumeSource.indexOf("salesRecognitionV2SaveBounds_") !== -1 &&
    resumeSource.indexOf("salesRecognitionV2SaveVerifyPlan_") !== -1 &&
    resumeSource.indexOf("readAuthority") === -1 &&
    resumeSource.indexOf("transactionProductionAuthority_") === -1);
  // ---- Injected wrapper: outer lock BEFORE normalize/lookup, released exactly
  // once; pre-intent lock/runtime failure is a definite REFUSED.
  var lockTrace = [], lockMode = "ok";
  var innerWrapperRepo = salesV2SaveOpsRepository_();
  var wrapperRepo = {
    findOperation: function(type, key) { lockTrace.push("lookup");
      return innerWrapperRepo.findOperation(type, key); },
    createOperation: function(row) { lockTrace.push("create");
      return innerWrapperRepo.createOperation(row); },
    updateOperation: function(row) { lockTrace.push("update");
      return innerWrapperRepo.updateOperation(row); },
    rows: function() { return innerWrapperRepo.rows(); } };
  var wrapperFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var originalFactory = salesRecognitionV2SaveRuntime_;
  try {
    salesRecognitionV2SaveRuntime_ = function() {
      var inner = salesV2SaveRuntime_({ fixture: wrapperFixture, repository: wrapperRepo });
      return { spreadsheet: inner.spreadsheet, repository: inner.repository, now: inner.now,
        actor: inner.actor, config: inner.config, batch: inner.batch, events: inner.events,
        lock: { waitLock: function() { lockTrace.push("lock");
            if (lockMode === "fail") throw new Error("LOCK_BUSY"); },
          releaseLock: function() { lockTrace.push("release"); } } };
    };
    var lockOk = salesRecognitionV2DurableSave(salesV2SavePayload_("lock-ok-1"));
    check("C21a", lockOk.status === "DONE" && lockTrace[0] === "lock" &&
      lockTrace.indexOf("lookup") > 0 && lockTrace[lockTrace.length - 1] === "release");
    var rowsBeforeLockFail = innerWrapperRepo.rows().length;
    lockMode = "fail";
    lockTrace = [];
    var lockFail = salesRecognitionV2DurableSave(salesV2SavePayload_("lock-fail-1"));
    check("C21b", lockFail.status === "REFUSED" &&
      lockFail.code === "OUTER_LOCK_UNAVAILABLE" && lockFail.requestKey === "lock-fail-1" &&
      JSON.stringify(lockTrace) === JSON.stringify(["lock"]) &&
      innerWrapperRepo.rows().length === rowsBeforeLockFail);
    salesRecognitionV2SaveRuntime_ = function() { throw new Error("RUNTIME_OPEN_FAILED"); };
    lockTrace = [];
    var runtimeFail = salesRecognitionV2DurableSave(salesV2SavePayload_("runtime-fail-1"));
    check("C21c", runtimeFail.status === "REFUSED" &&
      runtimeFail.code === "SAVE_RUNTIME_UNAVAILABLE" &&
      runtimeFail.requestKey === "runtime-fail-1" && lockTrace.length === 0);
    salesRecognitionV2SaveRuntime_ = function() {
      var inner = salesV2SaveRuntime_({ fixture: wrapperFixture, repository: wrapperRepo });
      return { spreadsheet: inner.spreadsheet, repository: inner.repository, now: inner.now,
        actor: inner.actor, config: inner.config, batch: inner.batch, events: inner.events,
        lock: { waitLock: function() { lockTrace.push("lock"); },
          releaseLock: function() { lockTrace.push("release"); } } };
    };
    lockMode = "ok";
    lockTrace = [];
    var normalizeRefusal = salesRecognitionV2DurableSave({});
    check("C21d", normalizeRefusal.status === "REFUSED" &&
      normalizeRefusal.code === "REQUEST_KEY_REQUIRED" &&
      JSON.stringify(lockTrace) === JSON.stringify(["lock", "release"]));
  } finally {
    salesRecognitionV2SaveRuntime_ = originalFactory;
  }
  // ---- Authority effective-window gate: malformed nonblank end and reversed
  // windows fail closed with zero writes (freeze never reached).
  var sheetsW1 = salesV2SaveBaseSheets_();
  sheetsW1.ProductPricing = salesV2SaveTable_(PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS, [
    { ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: "2026-01-01", EffectiveTo: "not-a-date",
      HPP: 2, Harga: 20000, IsActive: true }]);
  var rtW1 = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(sheetsW1) });
  var snapW1 = snapshot(rtW1.spreadsheet);
  var resW1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("window-bad-end"), rtW1);
  check("C22a", resW1.status === "REFUSED" && resW1.code === "AUTHORITY_WINDOW_INVALID" &&
    resW1.detail.indexOf("PRODUCT_PRICING") !== -1 &&
    resW1.detail.indexOf("EFFECTIVE_TO_INVALID") !== -1 &&
    rtW1.repository.rows().length === 0 && rtW1.events.batches.length === 0 &&
    rtW1.events.authorityReads === 1 && snapshot(rtW1.spreadsheet) === snapW1);
  var sheetsW2 = salesV2SaveBaseSheets_();
  sheetsW2.RecipeVersions = salesV2SaveTable_(t.RECIPE_VERSIONS.HEADERS, [
    { RecipeVersionID: "RV1", ProductVariantID: "PV1", EffectiveFrom: "2026-06-01",
      EffectiveTo: "2026-01-01", IsActive: true, CreatedAt: "", CreatedBy: "",
      UpdatedAt: "", UpdatedBy: "" }]);
  var rtW2 = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(sheetsW2) });
  var snapW2 = snapshot(rtW2.spreadsheet);
  var resW2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("window-reversed"), rtW2);
  check("C22b", resW2.status === "REFUSED" && resW2.code === "AUTHORITY_WINDOW_INVALID" &&
    resW2.detail.indexOf("RECIPE_VERSION") !== -1 &&
    resW2.detail.indexOf("EFFECTIVE_WINDOW_REVERSED") !== -1 &&
    rtW2.repository.rows().length === 0 && rtW2.events.batches.length === 0 &&
    snapshot(rtW2.spreadsheet) === snapW2);
  // ---- Authority-sheet schema gate (Products/ProductPricing): required
  // columns present exactly once with compatible meaning; additive columns are
  // safe; missing/renamed/duplicated/reordered authority fails closed.
  function authorityGateSheets_(productHeaders, pricingHeaders) {
    var sheets = salesV2SaveBaseSheets_();
    sheets.Products = [productHeaders].concat(sheets.Products.slice(1).map(function(row) {
      return productHeaders.map(function(header) {
        var index = sheets.Products[0].indexOf(header);
        return index === -1 ? "" : row[index];
      });
    }));
    sheets.ProductPricing = [pricingHeaders].concat(sheets.ProductPricing.slice(1).map(function(row) {
      return pricingHeaders.map(function(header) {
        var index = sheets.ProductPricing[0].indexOf(header);
        return index === -1 ? "" : row[index];
      });
    }));
    return sheets;
  }
  var prodProductHeaders = PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS
    .concat(["CreatedAt", "UpdatedAt", "Notes"]);
  var prodPricingHeaders = ["ID_Price"]
    .concat(PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS.slice(0, 6), ["Source"],
      PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS.slice(6), ["CreatedAt", "UpdatedAt"]);
  // C23: minimal exact 7/7 authority headers pass.
  check("C23", salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(salesV2SaveBaseSheets_()))
    .status === "PASS");
  // C24: production-shaped 10-column Products (required prefix + trailing
  // CreatedAt/UpdatedAt/Notes) passes.
  check("C24", salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(
    authorityGateSheets_(prodProductHeaders, PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS)))
    .status === "PASS");
  // C25: production-shaped 11-column ProductPricing (ID_Price leading +
  // Source interleaved + CreatedAt/UpdatedAt trailing) passes.
  check("C25", salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(
    authorityGateSheets_(PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS, prodPricingHeaders)))
    .status === "PASS");
  // C26: harmless additive extras pass on both sheets.
  check("C26", salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(authorityGateSheets_(
    prodProductHeaders.concat(["ExtraFlag"]), prodPricingHeaders.concat(["ExtraFlag"]))))
    .status === "PASS");
  // C27: missing required column fails (ProductPricing without Harga).
  var gateC27 = salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(authorityGateSheets_(
    PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS,
    PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS.filter(function(h) { return h !== "Harga"; }))));
  check("C27", gateC27.status === "FAIL" && gateC27.badSheets.indexOf("ProductPricing") !== -1 &&
    gateC27.badSheets.indexOf("Products") === -1);
  // C28: duplicate required column fails (Products with a trailing IsActive
  // duplicate; last-wins name indexing must never be reachable).
  check("C28", salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(authorityGateSheets_(
    prodProductHeaders.concat(["IsActive"]), PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS)))
    .status === "FAIL");
  // C29: renamed authority column fails (Products Produk -> ProductName).
  check("C29", salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(authorityGateSheets_(
    PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS.map(function(h) {
      return h === "Produk" ? "ProductName" : h; }),
    PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS)))
    .status === "FAIL");
  // C30: wrong semantic authority fails (required Products columns present but
  // reordered -> positional authority violated).
  check("C30", salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(authorityGateSheets_(
    ["Produk", "ID_Prod"].concat(PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS.slice(2)),
    PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS)))
    .status === "FAIL");
  // C31: wrong semantic authority fails (ProductPricing Harga renamed to a
  // non-authoritative price name).
  check("C31", salesRecognitionV2SaveSchemaGate_(salesV2SaveFixture_(authorityGateSheets_(
    PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS,
    PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS.map(function(h) {
      return h === "Harga" ? "HargaIDR" : h; }))))
    .status === "FAIL");
  // C32: historical master reads unchanged — name-based canonical reads over
  // the additive production-shaped fixtures return the same required-field
  // values as the minimal exact fixtures.
  var additiveFixtureC32 = salesV2SaveFixture_(authorityGateSheets_(prodProductHeaders, prodPricingHeaders));
  var minimalFixtureC32 = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var minProductsC32 = readCanonicalTable(minimalFixtureC32, "Products",
    PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS);
  var addProductsC32 = readCanonicalTable(additiveFixtureC32, "Products",
    PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS);
  var minPricingC32 = readCanonicalTable(minimalFixtureC32, "ProductPricing",
    PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS);
  var addPricingC32 = readCanonicalTable(additiveFixtureC32, "ProductPricing",
    PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS);
  check("C32", minProductsC32.length === addProductsC32.length && minProductsC32.length > 0 &&
    minProductsC32.every(function(row, index) {
      return PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS.every(function(header) {
        return String(row[header]) === String(addProductsC32[index][header]); });
    }) &&
    minPricingC32.length === addPricingC32.length && minPricingC32.length > 0 &&
    minPricingC32.every(function(row, index) {
      return PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS.every(function(header) {
        return String(row[header]) === String(addPricingC32[index][header]); });
    }));
  // C33: U2 Save snapshot deterministic under additive production-shaped
  // authority headers — identical identities and identical frozen plan.
  var rtC33Base = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(salesV2SaveBaseSheets_()) });
  var rtC33Add = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(
    authorityGateSheets_(prodProductHeaders, prodPricingHeaders)) });
  var resC33Base = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("auth-snap-1"), rtC33Base);
  var resC33Add = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("auth-snap-1"), rtC33Add);
  check("C33", resC33Base.status === "DONE" && resC33Add.status === "DONE" &&
    resC33Base.orderID === resC33Add.orderID &&
    resC33Base.recognitionID === resC33Add.recognitionID &&
    resC33Base.journalID === resC33Add.journalID &&
    resC33Base.auditID === resC33Add.auditID &&
    rtC33Base.events.appliedRows === rtC33Add.events.appliedRows &&
    JSON.stringify(rtC33Base.repository.rows()[0].OperationPlan) ===
      JSON.stringify(rtC33Add.repository.rows()[0].OperationPlan));
  return { total: 51, pass: pass, fail: 51 - pass };
}
