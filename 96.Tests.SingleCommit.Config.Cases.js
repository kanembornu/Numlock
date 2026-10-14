// T11.7/U5 — SINGLE_COMMIT_TRANSACTION_V1 control plane (config reader,
// reconciled routing, prep/activation/pause writers, idempotency/crash model,
// call-graph isolation, package measurement). In-memory fixtures only: no
// production access, no clasp, no writes outside fixture memory/property
// stubs. Public writer entries are NEVER invoked; every gate runs through the
// injected-runtime cores (T9/T10.5/97E precedent).

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
function u5Check_(counter, id, value, detail) {
  counter.pass++;
  if (!value) throw new Error("T11_7_U5:" + id + (detail === undefined ? "" : "|" + detail));
}

function u5PreparedRaw_() {
  return JSON.stringify(SINGLE_COMMIT_TRANSACTION_V1.DEFAULT_CONFIG);
}

// Script-Properties stub with write counting and crash-injection hooks.
function u5Properties_(map) {
  var store = {};
  Object.keys(map || {}).forEach(function(key) { store[key] = map[key]; });
  var props = {
    store: store, setCalls: [], failSet: false, readTamper: null,
    getProperty: function(key) {
      var value = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      if (props.readTamper && props.readTamper[key]) value = props.readTamper[key](value);
      return value;
    },
    setProperty: function(key, value) {
      if (props.failSet) throw new Error("SIMULATED_SET_FAILURE");
      props.setCalls.push(key);
      store[key] = String(value);
    }
  };
  return props;
}

// Full activation fixture: sales base + treasury base + expense/purchase
// surfaces + frozen §11 1040 + Policy C 6210 + Suppliers + ExpenseItems.
function u5BaseSheets_(options) {
  options = options || {};
  var base = treasuryT4BaseSheets_();
  base.ExpenseItems = [["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"]];
  base.Suppliers = [SUPPLIER_MASTER_CONTRACT.HEADERS.slice()];
  if (options.with1040 !== false) t11PushAccount_(base, t11Account1040_());
  if (options.with6210 !== false) t11PushAccount_(base, t11u3Account6210_());
  return base;
}

var U5_SHEET_NAMES_ = ["Orders", "OrderLines", "TransactionOperations",
  "SalesRecognitionEvents", "SalesRecognitionAudits", "BalanceLedger", "Accounts",
  "Products", "ProductPricing", "ProductVariants", "RecipeVersions",
  "RecipeVersionLines", "InventoryItems", "RecipeStandardCost",
  "InventoryUOMConversions", "tabsal", "Logs", "Payments", "Settlements",
  "TreasuryReceipts", "TreasuryOperations", "TreasuryAudits", "InventoryLedger",
  "PurchaseEvents", "tabops", "ExpenseItems", "Suppliers"];

function u5Snapshot_(fixture) {
  var out = {};
  U5_SHEET_NAMES_.forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    out[name] = sheet ? JSON.stringify(sheet.values) : null;
  });
  return JSON.stringify(out);
}

function u5ActivationProperties_(overrides) {
  var map = {
    SINGLE_COMMIT_TRANSACTION_V1: u5PreparedRaw_(),
    // Sales V2 stays a SEPARATE, compatible (VALID+ACTIVE) config.
    SALES_RECOGNITION_V2_CONFIG: JSON.stringify(salesV2SaveActiveConfig_())
  };
  Object.keys(overrides || {}).forEach(function(key) { map[key] = overrides[key]; });
  return u5Properties_(map);
}

function u5Runtime_(options) {
  options = options || {};
  var seq = { n: 0 };
  return {
    spreadsheet: options.spreadsheet || options.fixture ||
      salesV2SaveFixture_(u5BaseSheets_(options)),
    properties: options.properties || u5ActivationProperties_(options.propertyMap),
    now: options.now || function() { return new Date("2026-10-12T07:00:00.000Z"); },
    uuid: options.uuid || function() { return "u5uuid-" + (++seq.n); },
    uuidCalls: seq
  };
}

function u5ConfigFieldsOf_(raw) {
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// 1-9: config reader (pure parser/validator matrix over the frozen schema).
// ---------------------------------------------------------------------------
function testSingleCommitConfigReader() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }
  var state = singleCommitTransactionConfigState_;

  // 1 ABSENT: null/undefined/blank -> ABSENT (= PREPARED semantics), never a
  // persisted object, no identity invented.
  check(1, state(null).state === "ABSENT" && state(undefined).state === "ABSENT" &&
    state("   ").state === "ABSENT" && state(null).mode === "PREPARED" &&
    state(null).config === null);

  // 2 PREPARED: valid persisted object, blank activation identity, gate keeps
  // legacy routing (never-activated).
  var prepared = state(u5PreparedRaw_());
  check(2, prepared.state === "VALID" && prepared.mode === "PREPARED" &&
    prepared.config.activationID === "" && prepared.config.activatedAt === "" &&
    prepared.config.contractVersion === "SINGLE_COMMIT_TRANSACTION_V1" &&
    prepared.config.configVersion === 1 &&
    validateSingleCommitTransactionConfig_(prepared.config).status === "PASS");

  // 3 ACTIVE: server activation identity mandatory; gate composes the money leg.
  var active = state(t11ConfigRaw_("ACTIVE"));
  var gateActive = singleCommitTransactionSalesGate_(active);
  check(3, active.state === "VALID" && active.mode === "ACTIVE" &&
    active.config.activationID !== "" && active.config.activatedAt !== "" &&
    gateActive.allowed === true && gateActive.composedMoney === true);

  // 4 PAUSED: sticky identity present (PAUSED only exists after authority);
  // gate refuses with the frozen PAUSED code, never a legacy fallback.
  var paused = state(t11ConfigRaw_("PAUSED"));
  var gatePaused = singleCommitTransactionSalesGate_(paused);
  check(4, paused.state === "VALID" && paused.mode === "PAUSED" &&
    paused.config.activationID !== "" && gatePaused.allowed === false &&
    gatePaused.code === SINGLE_COMMIT_TRANSACTION_V1.CODES.SINGLE_COMMIT_MODE_PAUSED);

  // 5 malformed: broken JSON and non-object shapes -> UNRESOLVED, exact detail.
  check(5, state("{broken").state === "UNRESOLVED" &&
    state("{broken").detail === "CONFIG_JSON_INVALID" &&
    state("[1,2]").detail === "CONFIG_SHAPE_INVALID" &&
    state('"PREPARED"').detail === "CONFIG_SHAPE_INVALID");

  // 6 wrong contractVersion: missing or mismatched -> UNRESOLVED, never a
  // silent accept, never the legacy path.
  var wrongContract = JSON.stringify({ mode: "PREPARED", configVersion: 1,
    activationID: "", activatedAt: "" });
  check(6, state(wrongContract).state === "UNRESOLVED" &&
    state(wrongContract).detail === "CONFIG_CONTRACT_VERSION_INVALID" &&
    state(JSON.stringify({ mode: "PREPARED", contractVersion: "SINGLE_COMMIT_TRANSACTION_V2",
      configVersion: 1, activationID: "", activatedAt: "" }))
      .detail === "CONFIG_CONTRACT_VERSION_INVALID");

  // 7 invalid mode: unknown or non-string -> UNRESOLVED MODE_INVALID.
  var badMode = JSON.stringify({ mode: "READY", contractVersion: "SINGLE_COMMIT_TRANSACTION_V1",
    configVersion: 1, activationID: "", activatedAt: "" });
  check(7, state(badMode).state === "UNRESOLVED" && state(badMode).detail === "CONFIG_MODE_INVALID" &&
    state(JSON.stringify({ mode: 7, contractVersion: "SINGLE_COMMIT_TRANSACTION_V1",
      configVersion: 1, activationID: "", activatedAt: "" })).detail === "CONFIG_MODE_INVALID");

  // 8 invalid activation fields: PREPARED with identity refuses
  // (CONFIG_ACTIVATION_METADATA_PRESENT — sticky: once-activated can never
  // pose as PREPARED); non-string identity refuses (CONFIG_ACTIVATION_INVALID);
  // an ACTIVE config with blank identity refuses fail-closed (the missing-
  // identity rule fires before any timestamp rule on the same config).
  var preparedWithId = JSON.stringify({ mode: "PREPARED",
    contractVersion: "SINGLE_COMMIT_TRANSACTION_V1", configVersion: 1,
    activationID: "SCA-x", activatedAt: "2026-10-12T00:00:00.000Z" });
  var activeNoId = JSON.stringify({ mode: "ACTIVE", contractVersion: "SINGLE_COMMIT_TRANSACTION_V1",
    configVersion: 1, activationID: "", activatedAt: "" });
  var activeBadTime = JSON.stringify({ mode: "ACTIVE",
    contractVersion: "SINGLE_COMMIT_TRANSACTION_V1", configVersion: 1,
    activationID: "", activatedAt: "October 12" });
  var pausedNumState = state(JSON.stringify({ mode: "PAUSED",
    contractVersion: "SINGLE_COMMIT_TRANSACTION_V1", configVersion: 1,
    activationID: "SCA-x", activatedAt: 5 }));
  check(8, state(preparedWithId).state === "UNRESOLVED" &&
    state(preparedWithId).detail === "CONFIG_ACTIVATION_METADATA_PRESENT" &&
    pausedNumState.detail === "CONFIG_ACTIVATION_INVALID" &&
    state(activeNoId).state === "UNRESOLVED" &&
    state(activeNoId).detail === "CONFIG_ACTIVATION_METADATA_MISSING" &&
    state(activeBadTime).state === "UNRESOLVED" &&
    state(activeBadTime).detail === "CONFIG_ACTIVATION_METADATA_MISSING");

  // 9 configVersion: zero, fractional and string versions all UNRESOLVED.
  function versionRaw(value) {
    return JSON.stringify({ mode: "PREPARED", contractVersion: "SINGLE_COMMIT_TRANSACTION_V1",
      configVersion: value, activationID: "", activatedAt: "" });
  }
  check(9, state(versionRaw(0)).detail === "CONFIG_VERSION_INVALID" &&
    state(versionRaw(1.5)).detail === "CONFIG_VERSION_INVALID" &&
    state(versionRaw("1")).detail === "CONFIG_VERSION_INVALID" &&
    state(versionRaw(2)).state === "VALID");

  console.log("T11_7_U5_READER checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 10-18: reconciled routing — identical semantics across Sales/Expense/
// Purchase, sticky intent, recovery-while-PAUSED, invalid intents.
// ---------------------------------------------------------------------------
function testSingleCommitRoutingMatrix() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }
  var sc = SINGLE_COMMIT_TRANSACTION_V1;
  // 10 Sales: ABSENT/PREPARED -> allowed legacy (no composed leg); ACTIVE ->
  // composed required; PAUSED -> refuse.
  check(10, (function() {
    var absent = singleCommitTransactionSalesGate_(singleCommitTransactionConfigState_(null));
    var prepared = singleCommitTransactionSalesGate_(
      singleCommitTransactionConfigState_(u5PreparedRaw_()));
    var active = singleCommitTransactionSalesGate_(
      singleCommitTransactionConfigState_(t11ConfigRaw_("ACTIVE")));
    var paused = singleCommitTransactionSalesGate_(
      singleCommitTransactionConfigState_(t11ConfigRaw_("PAUSED")));
    return absent.allowed === true && absent.composedMoney === false &&
      prepared.allowed === true && prepared.composedMoney === false &&
      active.allowed === true && active.composedMoney === true &&
      paused.allowed === false && paused.code === sc.CODES.SINGLE_COMMIT_MODE_PAUSED;
  })());

  // 11 Expense: identical matrix through the dispatcher gate.
  check(11, (function() {
    var absent = expenseSingleCommitGate_({ singleCommitConfig: null });
    var prepared = expenseSingleCommitGate_({ singleCommitConfig: u5PreparedRaw_() });
    var active = expenseSingleCommitGate_({ singleCommitConfig: t11ConfigRaw_("ACTIVE") });
    var paused = expenseSingleCommitGate_({ singleCommitConfig: t11ConfigRaw_("PAUSED") });
    return absent.mode === "LEGACY" && prepared.mode === "LEGACY" &&
      active.mode === "ACTIVE" &&
      paused.mode === "REFUSE" && paused.code === sc.CODES.SINGLE_COMMIT_MODE_PAUSED;
  })());

  // 12 Purchase: identical matrix through the purchase gate.
  check(12, (function() {
    var absent = purchaseSingleCommitGate_({ singleCommitConfig: null });
    var prepared = purchaseSingleCommitGate_({ singleCommitConfig: u5PreparedRaw_() });
    var active = purchaseSingleCommitGate_({ singleCommitConfig: t11ConfigRaw_("ACTIVE") });
    var paused = purchaseSingleCommitGate_({ singleCommitConfig: t11ConfigRaw_("PAUSED") });
    return absent.mode === "LEGACY" && prepared.mode === "LEGACY" &&
      active.mode === "ACTIVE" &&
      paused.mode === "REFUSE" && paused.code === sc.CODES.SINGLE_COMMIT_MODE_PAUSED;
  })());

  // 13 no legacy fallback on PAUSED for every dispatcher surface: zero writes
  // of any kind (snapshot-identical, no operation row, no batch).
  var pausedExpense = t11u2Fixture_({ singleCommitConfig: t11u2ConfigRaw_("PAUSED") });
  var pausedExpenseBefore = t11u2Snapshot_(pausedExpense);
  var pausedExpenseResult = pausedExpense.run(Object.assign({ requestKey: "u5-pause-fallback" },
    pausedExpense.payload));
  var pausedPurchase = t11u3Fixture_({ singleCommitConfig: t11u3ConfigRaw_("PAUSED") });
  var pausedPurchaseBefore = t11u3Snapshot_(pausedPurchase);
  var pausedPurchaseResult = pausedPurchase.run(t11u3Payload_("u5-pause-fallback-p"));
  var pausedSalesRt = t11Runtime_({ singleCommitConfig: t11ConfigRaw_("PAUSED") });
  var pausedSalesResult = salesRecognitionV2SaveWithRuntime_(
    salesV2SavePayload_("u5-pause-fallback-s"), pausedSalesRt);
  check(13, pausedExpenseResult.success === false &&
    pausedExpenseResult.error.code === sc.CODES.SINGLE_COMMIT_MODE_PAUSED &&
    t11u2Snapshot_(pausedExpense) === pausedExpenseBefore &&
    pausedPurchaseResult.success === false &&
    pausedPurchaseResult.error.code === sc.CODES.SINGLE_COMMIT_MODE_PAUSED &&
    t11u3Snapshot_(pausedPurchase) === pausedPurchaseBefore &&
    pausedSalesResult.status === "REFUSED" &&
    pausedSalesResult.code === sc.CODES.SINGLE_COMMIT_MODE_PAUSED &&
    pausedSalesRt.repository.rows().length === 0,
    JSON.stringify({ e: pausedExpenseResult, p: pausedPurchaseResult, s: pausedSalesResult }));

  // 14 sticky intent: PREPARED carrying activation identity is UNRESOLVED ->
  // every domain refuses fail-closed with ZERO writes; a once-activated
  // config can never route back to the legacy workflow.
  var stickyRaw = JSON.stringify({ mode: "PREPARED",
    contractVersion: "SINGLE_COMMIT_TRANSACTION_V1", configVersion: 1,
    activationID: "SCA-u5", activatedAt: "2026-10-10T00:00:00.000Z" });
  var stickyExpense = t11u2Fixture_({ singleCommitConfig: stickyRaw });
  var stickyBefore = t11u2Snapshot_(stickyExpense);
  var stickyResult = stickyExpense.run(Object.assign({ requestKey: "u5-sticky-1" },
    stickyExpense.payload));
  check(14, singleCommitTransactionConfigState_(stickyRaw).state === "UNRESOLVED" &&
    singleCommitTransactionSalesGate_(singleCommitTransactionConfigState_(stickyRaw))
      .allowed === false &&
    expenseSingleCommitGate_({ singleCommitConfig: stickyRaw }).mode === "REFUSE" &&
    purchaseSingleCommitGate_({ singleCommitConfig: stickyRaw }).mode === "REFUSE" &&
    stickyResult.success === false &&
    stickyResult.error.code === sc.CODES.SINGLE_COMMIT_CONFIG_INVALID &&
    t11u2Snapshot_(stickyExpense) === stickyBefore,
    JSON.stringify(stickyResult));

  // 15 recovery-while-PAUSED (Sales): IN_PROGRESS intent resumes from the
  // immutable stored plan even while PAUSED — admission mode is never
  // re-evaluated for a persisted operation. The fixture carries the frozen
  // §11 1040 so the composed ACTIVE leg can plan/write on resume.
  var salesSheets = u5BaseSheets_();
  var salesFixture = salesV2SaveFixture_(salesSheets);
  var salesRt = t11Runtime_({ singleCommitConfig: t11ConfigRaw_("ACTIVE"),
    fixture: salesFixture, batch: function() { throw new Error("ETIMEDOUT"); } });
  var salesUnknown = salesRecognitionV2SaveWithRuntime_(
    salesV2SavePayload_("u5-rec-sales"), salesRt);
  var unknownRow0State = salesRt.repository.rows()[0] && salesRt.repository.rows()[0].State;
  var salesResume = t11Runtime_({ fixture: salesFixture,
    repository: salesRt.repository, singleCommitConfig: t11ConfigRaw_("PAUSED") });
  var salesResumed = salesRecognitionV2SaveWithRuntime_(
    salesV2SavePayload_("u5-rec-sales"), salesResume);
  check(15, salesUnknown.status === "UNKNOWN" &&
    salesUnknown.code === "BATCH_OUTCOME_UNKNOWN" &&
    unknownRow0State === "IN_PROGRESS" &&
    salesResumed.status === "DONE" &&
    salesRt.repository.rows()[0].State === "COMMITTED",
    JSON.stringify({ unknownStatus: salesUnknown.status, unknownCode: salesUnknown.code,
      unknownRow0State: unknownRow0State,
      resumedStatus: salesResumed.status, resumedCode: salesResumed.code }));

  // 16 recovery-while-PAUSED (Expense): the dispatcher probes the operation
  // store before the refusal and routes into the core resume path.
  var expenseFixture = t11u2Fixture_();
  expenseFixture.crashAt = "EXPENSE_BEFORE_BATCH";
  var expenseUnknown = expenseFixture.run(Object.assign({ requestKey: "u5-rec-exp" },
    expenseFixture.payload));
  var unknownOpsState = t11u2Ops_(expenseFixture)[0].State;
  expenseFixture.crashAt = null;
  expenseFixture.runtime.singleCommitConfig = t11u2ConfigRaw_("PAUSED");
  var expenseResumed = expenseFixture.run(Object.assign({ requestKey: "u5-rec-exp" },
    expenseFixture.payload));
  check(16, expenseUnknown.success === false && expenseUnknown.unknown === true &&
    unknownOpsState === "IN_PROGRESS" &&
    expenseResumed.success === true &&
    t11u2Ops_(expenseFixture)[0].State === "COMMITTED" &&
    expenseFixture.batches.length === 1,
    JSON.stringify({ unknownOpsState: unknownOpsState,
      unknown: expenseUnknown, resumed: expenseResumed }));

  // 17 recovery-while-PAUSED (Purchase): dispatcher route + the operational
  // adapter probe (submitOperationalPurchase) resolve the same recovery.
  var purchaseFixture = t11u3Fixture_();
  purchaseFixture.crashAt = "PURCHASE_BEFORE_BATCH";
  var purchaseUnknown = purchaseFixture.run(t11u3Payload_("u5-rec-pur"));
  purchaseFixture.crashAt = null;
  purchaseFixture.runtime.singleCommitConfig = t11u3ConfigRaw_("PAUSED");
  var purchaseResumed = purchaseFixture.run(t11u3Payload_("u5-rec-pur"));
  var originalRuntimeFactory = globalThis.transactionProductionRuntime_;
  var probeKeys = [];
  try {
    globalThis.transactionProductionRuntime_ = function() {
      return { repository: { findOperation: function(type, key) {
        probeKeys.push(type + ":" + key);
        return type === PURCHASE_SINGLE_COMMIT_V1.OPERATION_TYPE && key === "u5-op-key" ?
          { OperationType: type, RequestKey: key, State: "IN_PROGRESS" } : null;
      } } };
    };
    var probeHit = purchaseSingleCommitOperationalRecoveryRoute_({ requestKey: "u5-op-key" });
    var probeMiss = purchaseSingleCommitOperationalRecoveryRoute_({ requestKey: "u5-none" });
    var probeEmpty = purchaseSingleCommitOperationalRecoveryRoute_({});
  } finally {
    globalThis.transactionProductionRuntime_ = originalRuntimeFactory;
  }
  var operationalSource = fs.readFileSync("95A.Transaction.Production.js", "utf8");
  check(17, purchaseUnknown.success === false && purchaseUnknown.unknown === true &&
    purchaseResumed.success === true &&
    purchaseFixture.batches.length === 1 &&
    probeHit === true && probeMiss === false && probeEmpty === false &&
    probeKeys.length === 2 &&
    operationalSource.indexOf("purchaseSingleCommitOperationalRecoveryRoute_(payload)") !== -1 &&
    operationalSource.indexOf("return purchaseOperationalSingleCommit_(payload, gate);") !== -1,
    JSON.stringify({ unknown: purchaseUnknown, resumed: purchaseResumed }));

  // 18 invalid intent: REJECT + malformed configs refuse on every surface with
  // zero writes; the resolved-mode transport maps them to REJECT for the
  // client (never PREPARED, never ACTIVE).
  var invalidExpense = t11u2Fixture_({ singleCommitConfig: "{broken" });
  var invalidBefore = t11u2Snapshot_(invalidExpense);
  var invalidResult = invalidExpense.run(Object.assign({ requestKey: "u5-invalid-1" },
    invalidExpense.payload));
  var originalProperties = typeof PropertiesService === "undefined" ? undefined : PropertiesService;
  var resolved = [];
  try {
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return null; } };
    } };
    resolved.push(expenseSingleCommitResolvedMode_());
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return t11u2ConfigRaw_("ACTIVE"); } };
    } };
    resolved.push(expenseSingleCommitResolvedMode_());
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return t11u2ConfigRaw_("PAUSED"); } };
    } };
    resolved.push(expenseSingleCommitResolvedMode_());
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return "{broken"; } };
    } };
    resolved.push(expenseSingleCommitResolvedMode_());
  } finally {
    if (originalProperties === undefined) delete globalThis.PropertiesService;
    else PropertiesService = originalProperties;
  }
  check(18, invalidResult.success === false &&
    invalidResult.error.code === sc.CODES.SINGLE_COMMIT_CONFIG_INVALID &&
    t11u2Snapshot_(invalidExpense) === invalidBefore &&
    JSON.stringify(resolved) === JSON.stringify(["PREPARED", "ACTIVE", "REJECT", "REJECT"]),
    JSON.stringify({ result: invalidResult, resolved: resolved }));

  console.log("T11_7_U5_ROUTING checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 19-22: PREP writer (future-capable, inert; config-only).
// ---------------------------------------------------------------------------
function testSingleCommitPreparationWriter() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }
  var control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL, contract = SINGLE_COMMIT_TRANSACTION_V1;

  // 19 first PREP: ABSENT -> PREPARED, exactly one property write, exact
  // five-field readback, no spreadsheet capability in the runtime at all.
  var props = u5Properties_();
  var prep = singleCommitPreparationApplyWithRuntime_({ properties: props });
  var readback = JSON.parse(props.store[contract.CONFIG_PROPERTY]);
  check(19, prep.status === control.STATUS.PREPARED && prep.writes.config === 1 &&
    props.setCalls.length === 1 &&
    props.setCalls[0] === contract.CONFIG_PROPERTY &&
    JSON.stringify(readback) === JSON.stringify(contract.DEFAULT_CONFIG) &&
    JSON.stringify(prep.config) === JSON.stringify({
      contractVersion: contract.CONTRACT_VERSION, mode: "PREPARED",
      activationID: "", activatedAt: "", configVersion: 1 }) &&
    prep.writes.sheets === 0, JSON.stringify(prep));

  // 20 repeat PREP: NOOP_ALREADY_PREPARED, zero further writes, byte-identical
  // config, no configVersion inflation, no identity ever produced.
  var repeat = singleCommitPreparationApplyWithRuntime_({ properties: props });
  check(20, repeat.status === control.STATUS.NOOP_ALREADY_PREPARED &&
    repeat.writes.config === 0 && props.setCalls.length === 1 &&
    props.store[contract.CONFIG_PROPERTY] === JSON.stringify(contract.DEFAULT_CONFIG),
    JSON.stringify(repeat));

  // 21 unsafe PREP: never downgrades ACTIVE/PAUSED/REJECT, never repairs a
  // malformed value, never touches an unreadable property.
  function unsafeScenario(raw, expectedStatus) {
    var store = {};
    if (raw !== undefined) store[contract.CONFIG_PROPERTY] = raw;
    var p = u5Properties_(store);
    var r = singleCommitPreparationApplyWithRuntime_({ properties: p });
    return r.status === expectedStatus && p.setCalls.length === 0;
  }
  check(21, unsafeScenario(t11ConfigRaw_("ACTIVE"), control.STATUS.STOP_UNEXPECTED_MODE) &&
    unsafeScenario(t11ConfigRaw_("PAUSED"), control.STATUS.STOP_UNEXPECTED_MODE) &&
    unsafeScenario(t11ConfigRaw_("REJECT"), control.STATUS.STOP_UNEXPECTED_MODE) &&
    unsafeScenario("{broken", control.STATUS.STOP_CONFIG_MALFORMED) &&
    unsafeScenario(JSON.stringify({ mode: "PREPARED", configVersion: 1 }),
      control.STATUS.STOP_CONFIG_MALFORMED) &&
    (function() {
      var p = u5Properties_();
      p.getProperty = function() { throw new Error("PROP_DOWN"); };
      var r = singleCommitPreparationApplyWithRuntime_({ properties: p });
      return r.status === control.STATUS.STOP_CONFIG_MALFORMED && p.setCalls.length === 0;
    })());

  // 22 no financial capability: the prep runtime carries properties only; the
  // prep core source has no sheet/ledger/transaction token; activation is
  // never bundled into preparation.
  var source = fs.readFileSync("101.SingleCommit.Config.Control.js", "utf8");
  var prepCore = source.slice(source.indexOf("function singleCommitPreparationApplyWithRuntime_"),
    source.indexOf("// 2. ACTIVATION WRITER"));
  check(22, prepCore.indexOf("spreadsheet") === -1 &&
    prepCore.indexOf("batchUpdate") === -1 && prepCore.indexOf("appendRow") === -1 &&
    prepCore.indexOf("setValues") === -1 && prepCore.indexOf("activateSingleCommit") === -1 &&
    prepCore.indexOf("setProperty(") !== -1 &&
    typeof prepareSingleCommitTransactionV1Production === "function" &&
    prepareSingleCommitTransactionV1Production.length === 0,
    "prep isolation");

  console.log("T11_7_U5_PREP checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 23-37: ACTIVATION writer (future; inert; zero financial mutation).
// ---------------------------------------------------------------------------
function testSingleCommitActivationWriter() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }
  var control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL, contract = SINGLE_COMMIT_TRANSACTION_V1;

  // 23 valid PREPARED -> ACTIVE: exact five-field config, server identity,
  // one config write, evidence attached, every sheet byte-identical.
  var runtime = u5Runtime_();
  var before = u5Snapshot_(runtime.spreadsheet);
  var activated = singleCommitActivationApplyWithRuntime_(runtime);
  var stored = JSON.parse(runtime.properties.store[contract.CONFIG_PROPERTY]);
  check(23, activated.status === control.STATUS.ACTIVATED &&
    activated.writes.config === 1 && runtime.properties.setCalls.length === 1 &&
    stored.mode === "ACTIVE" &&
    stored.contractVersion === contract.CONTRACT_VERSION &&
    stored.activationID === "SCA-u5uuid-1" &&
    stored.activatedAt === "2026-10-12T07:00:00.000Z" &&
    stored.configVersion === 1 &&
    JSON.stringify(activated.config) === JSON.stringify({
      contractVersion: contract.CONTRACT_VERSION, mode: "ACTIVE",
      activationID: "SCA-u5uuid-1", activatedAt: "2026-10-12T07:00:00.000Z",
      configVersion: 1 }) &&
    u5Snapshot_(runtime.spreadsheet) === before,
    JSON.stringify(activated));

  // 24 ActivationID produced once, server-side, non-empty, prefixed, exact on
  // readback; the uuid factory ran exactly once.
  check(24, activated.config.activationID.indexOf(control.ACTIVATION_PREFIX) === 0 &&
    activated.config.activationID.trim() !== "" &&
    runtime.uuidCalls.n === 1 &&
    stored.activationID === activated.config.activationID);

  // 25 activatedAt is a strict ISO 8601 instant equal to the server clock.
  check(25, salesRecognitionIsoTimestampEpoch_(stored.activatedAt) !== null &&
    stored.activatedAt === new Date("2026-10-12T07:00:00.000Z").toISOString());

  // 26 repeat activation: ALREADY_ACTIVE, same identity, no version
  // increment, zero further mutation.
  var repeat = singleCommitActivationApplyWithRuntime_(runtime);
  check(26, repeat.status === control.STATUS.NOOP_ALREADY_ACTIVE &&
    repeat.writes.config === 0 && runtime.properties.setCalls.length === 1 &&
    repeat.config.activationID === stored.activationID &&
    repeat.config.configVersion === 1 && runtime.uuidCalls.n === 1,
    JSON.stringify(repeat));

  // 27 concurrent activation: one winner, the loser mutates zero times and
  // converges onto the SAME persisted identity.
  var sharedProps = u5ActivationProperties_();
  var winner = singleCommitActivationApplyWithRuntime_({ spreadsheet: runtime.spreadsheet,
    properties: sharedProps, now: runtime.now, uuid: runtime.uuid });
  var loser = singleCommitActivationApplyWithRuntime_({ spreadsheet: runtime.spreadsheet,
    properties: sharedProps, now: runtime.now, uuid: runtime.uuid });
  check(27, winner.status === control.STATUS.ACTIVATED &&
    loser.status === control.STATUS.NOOP_ALREADY_ACTIVE &&
    sharedProps.setCalls.length === 1 &&
    loser.config.activationID === winner.config.activationID,
    JSON.stringify({ winner: winner.status, loser: loser.status }));

  // 28 missing 1040 -> refuse BEFORE any write; config stays PREPARED.
  var missing1040 = u5Runtime_({ with1040: false });
  var missingResult = singleCommitActivationApplyWithRuntime_(missing1040);
  check(28, missingResult.status === control.STATUS.STOP_ACCOUNT_NOT_READY &&
    String(missingResult.detail).indexOf("1040:ACCOUNT_ABSENT") !== -1 &&
    missing1040.properties.setCalls.length === 0 &&
    JSON.parse(missing1040.properties.store[contract.CONFIG_PROPERTY]).mode === "PREPARED",
    JSON.stringify(missingResult));

  // 29 duplicate 1040 rows -> refuse.
  var duplicateRuntime = u5Runtime_();
  var dupSheet = duplicateRuntime.spreadsheet.fixtureSheet("Accounts");
  var dupHeaders = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  dupSheet.values.push(dupHeaders.map(function(header) {
    var row = t11Account1040_();
    return row[header] === undefined ? "" : row[header];
  }));
  var duplicateResult = singleCommitActivationApplyWithRuntime_(duplicateRuntime);
  check(29, duplicateResult.status === control.STATUS.STOP_ACCOUNT_NOT_READY &&
    String(duplicateResult.detail).indexOf("1040:ACCOUNT_DUPLICATE") !== -1 &&
    duplicateRuntime.properties.setCalls.length === 0, JSON.stringify(duplicateResult));

  // 30 malformed 1040 (inactive / metadata mismatch) -> refuse.
  var inactiveRuntime = u5Runtime_();
  var accountsSheet = inactiveRuntime.spreadsheet.fixtureSheet("Accounts");
  var headers = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  var codeIdx = headers.indexOf("AccountCode"), activeIdx = headers.indexOf("IsActive"),
    nameIdx = headers.indexOf("AccountName");
  for (var i = 1; i < accountsSheet.values.length; i++) {
    if (String(accountsSheet.values[i][codeIdx]) === "1040") {
      accountsSheet.values[i][activeIdx] = false;
    }
  }
  var inactiveResult = singleCommitActivationApplyWithRuntime_(inactiveRuntime);
  var mismatchRuntime = u5Runtime_();
  var mismatchSheet = mismatchRuntime.spreadsheet.fixtureSheet("Accounts");
  for (var j = 1; j < mismatchSheet.values.length; j++) {
    if (String(mismatchSheet.values[j][codeIdx]) === "1040") {
      mismatchSheet.values[j][nameIdx] = "Wrong Name";
    }
  }
  var mismatchResult = singleCommitActivationApplyWithRuntime_(mismatchRuntime);
  check(30, inactiveResult.status === control.STATUS.STOP_ACCOUNT_NOT_READY &&
    String(inactiveResult.detail).indexOf("1040:ACCOUNT_INACTIVE") !== -1 &&
    inactiveRuntime.properties.setCalls.length === 0 &&
    mismatchResult.status === control.STATUS.STOP_ACCOUNT_NOT_READY &&
    String(mismatchResult.detail).indexOf("1040:ACCOUNT_METADATA_MISMATCH") !== -1 &&
    mismatchRuntime.properties.setCalls.length === 0,
    JSON.stringify({ inactive: inactiveResult, mismatch: mismatchResult }));

  // 31 invalid 6210 (Policy C debit authority): absent / inactive / wrong
  // metadata all refuse before any write.
  var no6210 = u5Runtime_({ with6210: false });
  var no6210Result = singleCommitActivationApplyWithRuntime_(no6210);
  var inactive6210 = u5Runtime_();
  var sheet6210 = inactive6210.spreadsheet.fixtureSheet("Accounts");
  for (var k = 1; k < sheet6210.values.length; k++) {
    if (String(sheet6210.values[k][codeIdx]) === "6210") {
      sheet6210.values[k][activeIdx] = false;
    }
  }
  var inactive6210Result = singleCommitActivationApplyWithRuntime_(inactive6210);
  var wrong6210 = u5Runtime_();
  var sheetWrong = wrong6210.spreadsheet.fixtureSheet("Accounts");
  for (var m = 1; m < sheetWrong.values.length; m++) {
    if (String(sheetWrong.values[m][codeIdx]) === "6210") {
      sheetWrong.values[m][headers.indexOf("AccountType")] = "Asset";
    }
  }
  var wrong6210Result = singleCommitActivationApplyWithRuntime_(wrong6210);
  check(31, no6210Result.detail.indexOf("6210:ABSENT") !== -1 &&
    inactive6210Result.detail.indexOf("6210:INACTIVE") !== -1 &&
    wrong6210Result.detail.indexOf("6210:METADATA_MISMATCH") !== -1 &&
    no6210.properties.setCalls.length === 0 &&
    inactive6210.properties.setCalls.length === 0 &&
    wrong6210.properties.setCalls.length === 0,
    JSON.stringify([no6210Result.detail, inactive6210Result.detail, wrong6210Result.detail]));

  // 32 invalid 1030 -> refuse.
  var no1030 = u5Runtime_();
  var sheet1030 = no1030.spreadsheet.fixtureSheet("Accounts");
  for (var n = 1; n < sheet1030.values.length; n++) {
    if (String(sheet1030.values[n][codeIdx]) === "1030") {
      sheet1030.values.splice(n, 1);
      break;
    }
  }
  var no1030Result = singleCommitActivationApplyWithRuntime_(no1030);
  check(32, no1030Result.status === control.STATUS.STOP_ACCOUNT_NOT_READY &&
    String(no1030Result.detail).indexOf("1030:ABSENT") !== -1 &&
    no1030.properties.setCalls.length === 0, JSON.stringify(no1030Result));

  // 33 invalid 4000 (Revenue) -> refuse.
  var no4000 = u5Runtime_();
  var sheet4000 = no4000.spreadsheet.fixtureSheet("Accounts");
  for (var q = 1; q < sheet4000.values.length; q++) {
    if (String(sheet4000.values[q][codeIdx]) === "4000") {
      sheet4000.values.splice(q, 1);
      break;
    }
  }
  var no4000Result = singleCommitActivationApplyWithRuntime_(no4000);
  var mismatch4000 = u5Runtime_();
  var sheet4000b = mismatch4000.spreadsheet.fixtureSheet("Accounts");
  for (var r2 = 1; r2 < sheet4000b.values.length; r2++) {
    if (String(sheet4000b.values[r2][codeIdx]) === "4000") {
      sheet4000b.values[r2][headers.indexOf("AccountType")] = "Liability";
    }
  }
  var mismatch4000Result = singleCommitActivationApplyWithRuntime_(mismatch4000);
  check(33, String(no4000Result.detail).indexOf("4000:ABSENT") !== -1 &&
    String(mismatch4000Result.detail).indexOf("4000:METADATA_MISMATCH") !== -1 &&
    no4000.properties.setCalls.length === 0 &&
    mismatch4000.properties.setCalls.length === 0,
    JSON.stringify([no4000Result.detail, mismatch4000Result.detail]));

  // 34 incompatible Sales V2 state (separate key): PREPARED/ABSENT/MALFORMED
  // all refuse; a VALID PAUSED V2 also refuses.
  function v2Scenario(v2Raw) {
    var rt = u5Runtime_({ propertyMap: { SALES_RECOGNITION_V2_CONFIG: v2Raw } });
    var result = singleCommitActivationApplyWithRuntime_(rt);
    return { status: result.status, detail: result.detail,
      writes: rt.properties.setCalls.length };
  }
  var v2Prepared = v2Scenario(JSON.stringify(salesRecognitionV2DefaultConfig()));
  var v2Absent = v2Scenario(null);
  var v2Malformed = v2Scenario("{broken");
  var v2Paused = v2Scenario(JSON.stringify(Object.assign(
    {}, salesV2SaveActiveConfig_(), { mode: "PAUSED" })));
  check(34, v2Prepared.status === control.STATUS.STOP_PREREQUISITE_NOT_READY &&
    v2Prepared.detail === "SALES_V2:PREPARED" && v2Prepared.writes === 0 &&
    v2Absent.detail === "SALES_V2:ABSENT" && v2Absent.writes === 0 &&
    v2Malformed.detail === "SALES_V2:MALFORMED" && v2Malformed.writes === 0 &&
    v2Paused.detail === "SALES_V2:PAUSED" && v2Paused.writes === 0,
    JSON.stringify([v2Prepared, v2Absent, v2Malformed, v2Paused]));

  // 35 unexplained 1030 residual != 0 -> refuse, zero writes.
  var residualRuntime = u5Runtime_();
  u3AppendLedger_(residualRuntime.spreadsheet, [{ JournalID: "J-U5-RESID",
    LineID: "J-U5-RESID-1", Tanggal: "2026-10-11", AccountCode: "1030",
    Debit: 500, Credit: 0 }]);
  var residualResult = singleCommitActivationApplyWithRuntime_(residualRuntime);
  check(35, residualResult.status === control.STATUS.STOP_RECONCILIATION &&
    String(residualResult.detail).indexOf("RESIDUAL:500") !== -1 &&
    residualRuntime.properties.setCalls.length === 0, JSON.stringify(residualResult));

  // 36 transitional 24,000 state: LedgerNet1030 = 24,000 with residual 0 is
  // explainable and does NOT block activation (U10 owns the close).
  var transitional = u5Runtime_();
  u3CommittedAppend_(transitional.spreadsheet, { orderID: "ORD-U5-T11",
    amount: 24000, date: "2026-10-11", recognizedAt: "2026-10-11T03:00:00.000Z",
    requestKey: "u5-transitional-1" });
  var transitionalResult = singleCommitActivationApplyWithRuntime_(transitional);
  check(36, transitionalResult.status === control.STATUS.ACTIVATED &&
    transitionalResult.evidence.ledgerNet1030 === 24000 &&
    transitionalResult.evidence.unexplainedResidual === 0 &&
    transitionalResult.evidence.reconciliationStatus === "OK" &&
    transitional.properties.setCalls.length === 1, JSON.stringify(transitionalResult));

  // 37 zero financial rows: activation never touches a sheet (byte-identical
  // snapshot across every surface, Accounts row count unchanged — 1040 is
  // never created here).
  check(37, u5Snapshot_(runtime.spreadsheet) === before &&
    runtime.spreadsheet.getSheetByName("Accounts").getLastRow() ===
      salesV2SaveFixture_(u5BaseSheets_()).getSheetByName("Accounts").getLastRow() &&
    runtime.spreadsheet.getSheetByName("BalanceLedger").getLastRow() === 1 &&
    runtime.spreadsheet.getSheetByName("TransactionOperations").getLastRow() === 1,
    "activation mutated a financial surface");

  console.log("T11_7_U5_ACTIVATION checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 38-42: crash/failure model (PropertiesService is not batchUpdate).
// ---------------------------------------------------------------------------
function testSingleCommitControlFailures() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }
  var control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL, contract = SINGLE_COMMIT_TRANSACTION_V1;

  // 38 lock timeout / runtime failure on the public entries: returns before
  // any mutation.
  var props = u5ActivationProperties_();
  var originalProperties = typeof PropertiesService === "undefined" ? undefined : PropertiesService;
  var originalLock = typeof LockService === "undefined" ? undefined : LockService;
  var lockTimeout = null, runtimeUnavailable = null;
  try {
    PropertiesService = { getScriptProperties: function() { return props; } };
    LockService = { getScriptLock: function() {
      return { waitLock: function() { throw new Error("LOCK_BUSY"); },
        releaseLock: function() {} };
    } };
    lockTimeout = prepareSingleCommitTransactionV1Production();
    // The activation entry additionally requires the production spreadsheet —
    // unavailable locally, so it returns before the lock with zero writes.
    runtimeUnavailable = activateSingleCommitTransactionV1Production();
  } finally {
    if (originalProperties === undefined) delete globalThis.PropertiesService;
    else PropertiesService = originalProperties;
    if (originalLock === undefined) delete globalThis.LockService;
    else LockService = originalLock;
  }
  check(38, lockTimeout.status === control.STATUS.LOCK_TIMEOUT &&
    props.setCalls.length === 0 &&
    runtimeUnavailable.status === control.STATUS.RUNTIME_UNAVAILABLE &&
    typeof singleCommitControlLockedRun_ === "function" &&
    prepareSingleCommitTransactionV1Production.length === 0 &&
    activateSingleCommitTransactionV1Production.length === 0 &&
    pauseSingleCommitTransactionV1Production.length === 0,
    JSON.stringify({ lock: lockTimeout, runtime: runtimeUnavailable }));

  // 39 validation failure before setProperty: zero mutation, config untouched.
  var validationRuntime = u5Runtime_({ with1040: false });
  var validationResult = singleCommitActivationApplyWithRuntime_(validationRuntime);
  check(39, validationResult.status === control.STATUS.STOP_ACCOUNT_NOT_READY &&
    validationRuntime.properties.setCalls.length === 0 &&
    JSON.parse(validationRuntime.properties.store[contract.CONFIG_PROPERTY]).mode === "PREPARED");

  // 40 setProperty failure: definite refusal, store untouched, re-invocation
  // still sees a clean PREPARED state. The stub pushes the key onto setCalls
  // only on success, so a failed write leaves the count at 0.
  var failing = u5Runtime_();
  failing.properties.failSet = true;
  var writeFailure = singleCommitActivationApplyWithRuntime_(failing);
  var storeModeAfterFailure = JSON.parse(failing.properties.store[contract.CONFIG_PROPERTY]).mode;
  var setCallsAfterFailure = failing.properties.setCalls.length;
  failing.properties.failSet = false;
  var afterFailure = singleCommitActivationApplyWithRuntime_(failing);
  check(40, writeFailure.status === control.STATUS.STOP_CONFIG_WRITE_FAILED &&
    String(writeFailure.detail).indexOf("SIMULATED_SET_FAILURE") !== -1 &&
    setCallsAfterFailure === 0 &&
    storeModeAfterFailure === "PREPARED" &&
    afterFailure.status === control.STATUS.ACTIVATED &&
    afterFailure.config.activationID === "SCA-u5uuid-2" &&
    failing.uuidCalls.n === 2,
    JSON.stringify({ failure: writeFailure, retry: afterFailure.status,
      retryId: afterFailure.config && afterFailure.config.activationID,
      uuidN: failing.uuidCalls.n,
      storeModeAfterFailure: storeModeAfterFailure,
      setCallsAfterFailure: setCallsAfterFailure }));

  // 41 readback mismatch: the write is never claimed; the persisted identity
  // remains authoritative for the retry.
  var tampered = u5Runtime_();
  var writtenID = null;
  tampered.properties.readTamper = { SINGLE_COMMIT_TRANSACTION_V1: function(value) {
    if (value === null || value === undefined) return value;
    var config = JSON.parse(String(value));
    if (config.mode !== "ACTIVE") return value;
    writtenID = config.activationID;
    config.activationID = "SCA-FORGED";
    return JSON.stringify(config);
  } };
  var mismatch = singleCommitActivationApplyWithRuntime_(tampered);
  tampered.properties.readTamper = null;
  check(41, mismatch.status === control.STATUS.STOP_CONFIG_READBACK_MISMATCH &&
    String(mismatch.detail).indexOf("READBACK_FIELD_MISMATCH") !== -1 &&
    mismatch.config === null &&
    tampered.properties.setCalls.length === 1,
    JSON.stringify(mismatch));

  // 42 repeated invocation after an UNKNOWN (mismatch) converges to the SAME
  // activation identity with ZERO further mutation.
  var converged = singleCommitActivationApplyWithRuntime_(tampered);
  check(42, converged.status === control.STATUS.NOOP_ALREADY_ACTIVE &&
    converged.config.activationID === writtenID &&
    converged.config.activationID !== "SCA-FORGED" &&
    tampered.properties.setCalls.length === 1 && tampered.uuidCalls.n === 1,
    JSON.stringify(converged));

  console.log("T11_7_U5_FAILURES checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 43-48: PAUSE writer (§22 config flip; control-plane only).
// ---------------------------------------------------------------------------
function testSingleCommitPauseWriter() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }
  var control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL, contract = SINGLE_COMMIT_TRANSACTION_V1;

  // 43 ACTIVE -> PAUSED: one write, identity + version preserved, sheets
  // untouched.
  var runtime = u5Runtime_();
  var before = u5Snapshot_(runtime.spreadsheet);
  singleCommitActivationApplyWithRuntime_(runtime);
  var activeRaw = runtime.properties.store[contract.CONFIG_PROPERTY];
  var paused = singleCommitPauseApplyWithRuntime_(runtime);
  var pausedConfig = JSON.parse(runtime.properties.store[contract.CONFIG_PROPERTY]);
  check(43, paused.status === control.STATUS.PAUSED && paused.writes.config === 1 &&
    runtime.properties.setCalls.length === 2 &&
    pausedConfig.mode === "PAUSED" &&
    pausedConfig.activationID === JSON.parse(activeRaw).activationID &&
    pausedConfig.activatedAt === JSON.parse(activeRaw).activatedAt &&
    pausedConfig.configVersion === 1 &&
    u5Snapshot_(runtime.spreadsheet) === before, JSON.stringify(paused));

  // 44 repeat PAUSE: NOOP_ALREADY_PAUSED, zero further writes.
  var repeat = singleCommitPauseApplyWithRuntime_(runtime);
  check(44, repeat.status === control.STATUS.NOOP_ALREADY_PAUSED &&
    repeat.writes.config === 0 && runtime.properties.setCalls.length === 2);

  // 45 pause from PREPARED (never activated) is refused — PAUSED only exists
  // after authority (sticky identity), zero writes.
  var preparedRuntime = u5Runtime_();
  var fromPrepared = singleCommitPauseApplyWithRuntime_(preparedRuntime);
  check(45, fromPrepared.status === control.STATUS.STOP_UNEXPECTED_MODE &&
    String(fromPrepared.detail).indexOf("EXISTING_MODE_PREPARED") !== -1 &&
    preparedRuntime.properties.setCalls.length === 0);

  // 46 pause from ABSENT -> STOP_CONFIG_ABSENT, zero writes.
  var absentRuntime = u5Runtime_();
  delete absentRuntime.properties.store[contract.CONFIG_PROPERTY];
  var fromAbsent = singleCommitPauseApplyWithRuntime_(absentRuntime);
  check(46, fromAbsent.status === control.STATUS.STOP_CONFIG_ABSENT &&
    absentRuntime.properties.setCalls.length === 0);

  // 47 malformed / REJECT configs fail closed; the pause writer never repairs.
  var malformedRuntime = u5Runtime_();
  malformedRuntime.properties.store[contract.CONFIG_PROPERTY] = "{broken";
  var malformed = singleCommitPauseApplyWithRuntime_(malformedRuntime);
  var rejectRuntime = u5Runtime_();
  rejectRuntime.properties.store[contract.CONFIG_PROPERTY] = t11ConfigRaw_("REJECT");
  var rejected = singleCommitPauseApplyWithRuntime_(rejectRuntime);
  check(47, malformed.status === control.STATUS.STOP_CONFIG_MALFORMED &&
    malformed.config === null && malformedRuntime.properties.setCalls.length === 0 &&
    rejected.status === control.STATUS.STOP_UNEXPECTED_MODE &&
    rejectRuntime.properties.setCalls.length === 0,
    JSON.stringify({ malformed: malformed, reject: rejected }));

  // 48 control-plane only + deferred resume: PAUSED config keeps readers
  // truthful (VALID state, gates refuse writes); no reactivation function
  // exists anywhere; the activation writer refuses PAUSED (no second
  // activation identity ever).
  var pausedState = singleCommitTransactionConfigState_(
    runtime.properties.store[contract.CONFIG_PROPERTY]);
  var reactivate = singleCommitActivationApplyWithRuntime_({ spreadsheet: runtime.spreadsheet,
    properties: runtime.properties, now: runtime.now, uuid: runtime.uuid });
  var source = fs.readFileSync("101.SingleCommit.Config.Control.js", "utf8");
  check(48, pausedState.state === "VALID" && pausedState.mode === "PAUSED" &&
    pausedState.config.activationID !== "" &&
    reactivate.status === control.STATUS.STOP_UNEXPECTED_MODE &&
    runtime.properties.setCalls.length === 2 &&
    source.indexOf("function resumeSingleCommit") === -1 &&
    source.indexOf("function reactivateSingleCommit") === -1,
    JSON.stringify(reactivate));

  console.log("T11_7_U5_PAUSE checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 49-54: call-graph isolation proof (static + dynamic). Mutation authority =
// the one Script Properties key ONLY.
// ---------------------------------------------------------------------------
function testSingleCommitControlIsolation() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }
  var control = SINGLE_COMMIT_TRANSACTION_V1_CONTROL, contract = SINGLE_COMMIT_TRANSACTION_V1;
  var source = fs.readFileSync("101.SingleCommit.Config.Control.js", "utf8");
  var codeOnly = source.split("\n").filter(function(line) {
    return line.replace(/\s/g, "").indexOf("//") !== 0;
  }).join("\n");

  // 49 static: no financial writer, ledger writer, sheet writer, transport or
  // transitional-close concept is reachable from the control plane.
  var forbidden = ["batchUpdate", "appendCells", "appendRow", "setValues", "setValue(",
    "insertSheet", "UrlFetchApp", "SpreadsheetApp", "TRANSITIONAL_CLEARING_CLOSE",
    "EvidenceRef", "MANUAL_VERIFIED", "saveOperationalOrder",
    "salesRecognitionV2SaveWithRuntime_", "expenseSingleCommitApplyBatch_",
    "purchaseSingleCommitApplyBatch_", "submitCanonicalTransaction",
    "postPolicyCPurchaseEvent_", "runCashSettleAndPersist", "TreasuryReceipts",
    "BalanceLedger"].forEach;
  var hits = ["batchUpdate", "appendCells", "appendRow", "setValues", "setValue(",
    "insertSheet", "UrlFetchApp", "SpreadsheetApp", "TRANSITIONAL_CLEARING_CLOSE",
    "EvidenceRef", "MANUAL_VERIFIED", "saveOperationalOrder",
    "salesRecognitionV2SaveWithRuntime_", "expenseSingleCommitApplyBatch_",
    "purchaseSingleCommitApplyBatch_", "submitCanonicalTransaction",
    "postPolicyCPurchaseEvent_", "runCashSettleAndPersist", "TreasuryReceipts",
    "BalanceLedger"].filter(function(token) {
      return codeOnly.indexOf(token) !== -1;
    });
  check(49, hits.length === 0, JSON.stringify(hits));

  // 50 exactly ONE properties.setProperty per writer core (3 total), never in
  // the factories/entries, and always keyed through the contract constant.
  // Each writer is scoped to its own function body so a trailing comment in
  // one core cannot inflate another's token count.
  function coreOf_(name) {
    return codeOnly.slice(codeOnly.indexOf("function " + name), codeOnly.indexOf("\nfunction ", codeOnly.indexOf("function " + name) + 8));
  }
  var prepCoreText = coreOf_("singleCommitPreparationApplyWithRuntime_");
  var actCoreText = coreOf_("singleCommitActivationApplyWithRuntime_");
  var pauseCoreText = coreOf_("singleCommitPauseApplyWithRuntime_");
  var entryRegion = codeOnly.slice(
    codeOnly.indexOf("function prepareSingleCommitTransactionV1Production"));
  check(50,
    prepCoreText.split("properties.setProperty(").length - 1 === 1 &&
    actCoreText.split("properties.setProperty(").length - 1 === 1 &&
    pauseCoreText.split("properties.setProperty(").length - 1 === 1 &&
    [prepCoreText, actCoreText, pauseCoreText].every(function(text) {
      return text.indexOf(contract.CONFIG_PROPERTY) !== -1 &&
        text.indexOf('"SINGLE_COMMIT_TRANSACTION_V1"') === -1; }) &&
    entryRegion.indexOf("setProperty(") === -1 &&
    entryRegion.indexOf("getProperty(") === -1 &&
    [prepCoreText, actCoreText, pauseCoreText].every(function(text) {
      return text.indexOf("PropertiesService") === -1 && text.indexOf("LockService") === -1; }),
    [prepCoreText, actCoreText, pauseCoreText].map(function(text) {
      return text.split("properties.setProperty(").length - 1; }).join(","));

  // 51 dynamic: prep + activation + pause on one fixture mutate ONLY the
  // control key — every sheet byte-identical, sibling configs untouched.
  var runtime = u5Runtime_();
  var before = u5Snapshot_(runtime.spreadsheet);
  var v2RawBefore = runtime.properties.store.SALES_RECOGNITION_V2_CONFIG;
  delete runtime.properties.store[contract.CONFIG_PROPERTY];
  var prep = singleCommitPreparationApplyWithRuntime_({ properties: runtime.properties });
  var activation = singleCommitActivationApplyWithRuntime_(runtime);
  var pause = singleCommitPauseApplyWithRuntime_({ properties: runtime.properties });
  check(51, prep.status === control.STATUS.PREPARED &&
    activation.status === control.STATUS.ACTIVATED &&
    pause.status === control.STATUS.PAUSED &&
    runtime.properties.setCalls.length === 3 &&
    runtime.properties.setCalls.every(function(key) {
      return key === contract.CONFIG_PROPERTY; }) &&
    runtime.properties.store.SALES_RECOGNITION_V2_CONFIG === v2RawBefore &&
    u5Snapshot_(runtime.spreadsheet) === before,
    JSON.stringify({ prep: prep.status, activation: activation.status,
      pause: pause.status, setCalls: runtime.properties.setCalls,
      setLen: runtime.properties.setCalls.length,
      storeKeys: Object.keys(runtime.properties.store),
      sheetChanged: u5Snapshot_(runtime.spreadsheet) !== before }));

  // 52 no account-creation authority: a fixture WITHOUT 1040 is refused and
  // the Accounts sheet stays byte-identical (U7 owns account creation).
  var noAccountRuntime = u5Runtime_({ with1040: false });
  var accountsBefore = JSON.stringify(
    noAccountRuntime.spreadsheet.getSheetByName("Accounts").values);
  var refused = singleCommitActivationApplyWithRuntime_(noAccountRuntime);
  check(52, refused.status === control.STATUS.STOP_ACCOUNT_NOT_READY &&
    noAccountRuntime.properties.setCalls.length === 0 &&
    JSON.stringify(noAccountRuntime.spreadsheet.getSheetByName("Accounts").values) ===
      accountsBefore &&
    codeOnly.indexOf("insertSheet") === -1,
    JSON.stringify(refused));

  // 53 24k isolation: the control plane only READS T5/reconciliation
  // projections; no close writer, no receipt crafting, no fake evidence.
  var preflightSource = source.slice(
    source.indexOf("function singleCommitActivationPreflight_"),
    source.indexOf("function singleCommitActivationApplyWithRuntime_"));
  check(53, preflightSource.indexOf("buildTreasury1030Reconciliation_(") !== -1 &&
    preflightSource.indexOf("buildTreasuryClearingProjection_(") !== -1 &&
    preflightSource.indexOf("ledgerNet1030") !== -1 &&
    !/ledgerNet1030\s*(!==|===|<|>)\s*0\b/.test(preflightSource) &&
    preflightSource.indexOf("setProperty(") === -1 &&
    codeOnly.indexOf("TRANSITIONAL_CLEARING_CLOSE") === -1,
    "24k/activation gate shape");

  // 54 call-graph: business/UI/runtime files never reference the three
  // control entries; the entries take zero parameters.
  var businessFiles = ["21.Transaction.Entry.js", "95A.Transaction.Production.js",
    "97.SalesRecognition.V2.Foundation.js", "97A.SalesRecognition.V2.Save.js",
    "97B.SalesRecognition.V2.Projection.js", "97C.SalesRecognition.V2.Correction.js",
    "97D.SalesRecognition.V2.OperatorGuard.js", "97E.SalesRecognition.V2.Activation.js",
    "99.Treasury.Receipt.Foundation.js", "99A.Treasury.Receipt.Durable.Save.js",
    "99B.Treasury.Clearing.Projection.js", "99C.Treasury.Receipt.Reversal.Correction.js",
    "99D.Treasury.Operator.Api.js", "100.Code.js", "194.View.Transactions.Forms.html",
    "195.View.Transactions.Actions.html"];
  var leaked = businessFiles.filter(function(path) {
    var text = fs.readFileSync(path, "utf8");
    return text.indexOf("prepareSingleCommitTransactionV1Production") !== -1 ||
      text.indexOf("activateSingleCommitTransactionV1Production") !== -1 ||
      text.indexOf("pauseSingleCommitTransactionV1Production") !== -1;
  });
  check(54, leaked.length === 0, JSON.stringify(leaked));

  console.log("T11_7_U5_ISOLATION checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// 55-63: compatibility (U1-U4 semantics, Finance/Treasury, reader truth,
// config independence, transport).
// ---------------------------------------------------------------------------
function testSingleCommitCompatibility() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }

  // 55 U1: ABSENT/PREPARED sales semantics unchanged (allowed, no composed
  // leg) and the frozen refusal codes stay exact.
  check(55, JSON.stringify(SINGLE_COMMIT_TRANSACTION_V1.CODES) ===
    JSON.stringify({ SINGLE_COMMIT_CONFIG_INVALID: "SINGLE_COMMIT_CONFIG_INVALID",
      SINGLE_COMMIT_MODE_PAUSED: "SINGLE_COMMIT_MODE_PAUSED" }) &&
    singleCommitTransactionSalesGate_(singleCommitTransactionConfigState_(null))
      .composedMoney === false &&
    singleCommitTransactionSalesGate_(
      singleCommitTransactionConfigState_(u5PreparedRaw_())).composedMoney === false);

  // 56 U2/U3: legacy parity holds under the strengthened schema — ABSENT and
  // PREPARED produce zero T11 artifacts (operation rows, batches).
  var legacyExpense = t11u2Fixture_({ singleCommitConfig: u5PreparedRaw_() });
  var legacyExpenseResult = legacyExpense.run(Object.assign({ requestKey: "u5-compat-e",
    cashAccountCode: "1000" }, legacyExpense.payload));
  var legacyPurchase = t11u3Fixture_({ singleCommitConfig: u5PreparedRaw_() });
  var legacyPurchaseResult = legacyPurchase.run(t11u3LegacyPayload_("u5-compat-p"));
  check(56, legacyExpenseResult.success === true &&
    legacyExpenseResult.accountingPending === true &&
    t11u2Ops_(legacyExpense).length === 0 && legacyExpense.batches.length === 0 &&
    legacyPurchaseResult.success === true &&
    legacyPurchase.batches.length === 0 &&
    t11u3Ops_(legacyPurchase).length === 0,
    JSON.stringify({ e: legacyExpenseResult, p: legacyPurchaseResult }));

  // 57 Finance readiness gate: PAUSED blocks writes, never the read/report
  // authority — 1040 evidence is demanded only while VALID+ACTIVE, and the
  // Finance service never mutates config.
  var originalProperties = typeof PropertiesService === "undefined" ? undefined : PropertiesService;
  var financeStates = [];
  try {
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return t11ConfigRaw_("PAUSED"); } };
    } };
    financeStates.push(financeSingleCommitActive_());
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return t11ConfigRaw_("ACTIVE"); } };
    } };
    financeStates.push(financeSingleCommitActive_());
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return "{broken"; } };
    } };
    financeStates.push(financeSingleCommitActive_());
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return null; } };
    } };
    financeStates.push(financeSingleCommitActive_());
  } finally {
    if (originalProperties === undefined) delete globalThis.PropertiesService;
    else PropertiesService = originalProperties;
  }
  check(57, JSON.stringify(financeStates) === JSON.stringify([false, true, false, false]) &&
    fs.readFileSync("36.Finance.Service.js", "utf8").indexOf("setProperty") === -1,
    JSON.stringify(financeStates));

  // 58 PAUSED readers truthful: committed T11 data stays fully readable —
  // T5 composed clearing + aggregate funds ignore the write-mode gate.
  var composed = u4cComposedSale_({ key: "u5-compat-1" });
  var pausedGate = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_(t11ConfigRaw_("PAUSED")));
  var cleared = treasuryT5Row_(treasuryT5Projection_(composed.fixture),
    composed.recognitionID);
  var aggregate = buildAggregateFundsReadModel_(u4cLedgerRows_(composed.fixture));
  check(58, pausedGate.allowed === false &&
    cleared.ClearingStatus === "CLEARED" &&
    aggregate.status === "OK" && aggregate.totalFunds === composed.amount,
    JSON.stringify({ cleared: cleared.ClearingStatus, aggregate: aggregate.totalFunds }));

  // 59 config independence: the control plane never reads or writes the
  // Sales V2 or Treasury config keys as its own state (spy: every write hits
  // exactly the one T11 key; sibling stores byte-stable).
  var runtime = u5Runtime_();
  var treasuryRaw = JSON.stringify(treasuryT4ActiveConfig_());
  runtime.properties.store.TREASURY_RECEIPT_V1_CONFIG = treasuryRaw;
  var v2Before = runtime.properties.store.SALES_RECOGNITION_V2_CONFIG;
  singleCommitActivationApplyWithRuntime_(runtime);
  check(59, runtime.properties.setCalls.length === 1 &&
    runtime.properties.setCalls[0] === "SINGLE_COMMIT_TRANSACTION_V1" &&
    runtime.properties.store.SALES_RECOGNITION_V2_CONFIG === v2Before &&
    runtime.properties.store.TREASURY_RECEIPT_V1_CONFIG === treasuryRaw);

  // 60 sticky end-to-end: activation -> pause -> persisted identity survives;
  // no path re-activates or re-enables legacy (activation from PAUSED
  // refuses; PREPARED+identity can never be persisted by any writer).
  var stickyRuntime = u5Runtime_();
  var activation = singleCommitActivationApplyWithRuntime_(stickyRuntime);
  singleCommitPauseApplyWithRuntime_(stickyRuntime);
  var reactivation = singleCommitActivationApplyWithRuntime_(stickyRuntime);
  var persisted = singleCommitTransactionConfigState_(
    stickyRuntime.properties.store.SINGLE_COMMIT_TRANSACTION_V1);
  var prepAttempt = singleCommitPreparationApplyWithRuntime_(
    { properties: stickyRuntime.properties });
  check(60, activation.status === controlStatusActivated_() &&
    reactivation.status === "STOP_UNEXPECTED_MODE" &&
    prepAttempt.status === "STOP_UNEXPECTED_MODE" &&
    persisted.state === "VALID" && persisted.mode === "PAUSED" &&
    persisted.config.activationID === activation.config.activationID,
    JSON.stringify({ reactivation: reactivation, prep: prepAttempt }));

  // 61 resolved-mode transport stays byte-compatible with the U2 surface:
  // ABSENT/PREPARED -> PREPARED, ACTIVE -> ACTIVE, PAUSED/invalid -> REJECT.
  var resolvedModes = {};
  try {
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return null; } };
    } };
    resolvedModes.absent = expenseSingleCommitResolvedMode_();
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return u5PreparedRaw_(); } };
    } };
    resolvedModes.prepared = expenseSingleCommitResolvedMode_();
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return t11u2ConfigRaw_("ACTIVE"); } };
    } };
    resolvedModes.active = expenseSingleCommitResolvedMode_();
  } finally {
    if (originalProperties === undefined) delete globalThis.PropertiesService;
    else PropertiesService = originalProperties;
  }
  check(61, JSON.stringify(resolvedModes) ===
    JSON.stringify({ absent: "PREPARED", prepared: "PREPARED", active: "ACTIVE" }),
    JSON.stringify(resolvedModes));

  // 62 PREPARED inertness under the strengthened schema: a persisted PREPARED
  // (with contractVersion) keeps the composed dispatcher byte-inert — no
  // T11 operation, no batch, legacy outcome identical to ABSENT.
  var inertRt = t11Runtime_({ singleCommitConfig: u5PreparedRaw_() });
  var inertResult = salesRecognitionV2SaveWithRuntime_(
    salesV2SavePayload_("u5-compat-s"), inertRt);
  var inertPlan = JSON.parse(inertRt.repository.rows()[0].OperationPlan);
  check(62, inertResult.status === "DONE" && inertResult.writeCount === 7 &&
    inertPlan.composedMoney === undefined && inertPlan.moneyRows === undefined &&
    inertRt.events.batches[0].length === 5, JSON.stringify(inertResult));

  // 63 regression pins: frozen key/mode enum, default PREPARED, ABSENT
  // semantics, no reader dependency on the config, and the U4 global-1030
  // residual gate still reachable.
  check(63, contractPinsOk_() &&
    singleCommitTransactionConfigState_(null).state === "ABSENT" &&
    buildAggregateFundsReadModel_.toString().indexOf("SINGLE_COMMIT_TRANSACTION_V1") === -1 &&
    buildCashFlowStatement.toString().indexOf("SINGLE_COMMIT_TRANSACTION_V1") === -1 &&
    buildTreasury1030Reconciliation_.toString()
      .indexOf("SINGLE_COMMIT_TRANSACTION_V1") === -1);

  console.log("T11_7_U5_COMPAT checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

function controlStatusActivated_() {
  return SINGLE_COMMIT_TRANSACTION_V1_CONTROL.STATUS.ACTIVATED;
}

function contractPinsOk_() {
  var contract = SINGLE_COMMIT_TRANSACTION_V1;
  return contract.CONFIG_PROPERTY === "SINGLE_COMMIT_TRANSACTION_V1" &&
    contract.CONTRACT_VERSION === "SINGLE_COMMIT_TRANSACTION_V1" &&
    contract.CONFIG_VERSION === 1 &&
    JSON.stringify(contract.MODES) ===
      JSON.stringify(["PREPARED", "ACTIVE", "PAUSED", "REJECT"]) &&
    contract.DEFAULT_CONFIG.mode === "PREPARED" &&
    contract.DEFAULT_CONFIG.activationID === "" &&
    contract.DEFAULT_CONFIG.configVersion === 1;
}

// ---------------------------------------------------------------------------
// Package measurement (task L): current allowlist manifest, control-plane
// exclusion, and the exact prospective manifest if the file were registered.
// ---------------------------------------------------------------------------
function testSingleCommitPackageMeasurement() {
  var counter = { pass: 0 };
  function check(id, value, detail) { u5Check_(counter, id, value, detail); }
  var manifest = JSON.parse(fs.readFileSync("tests/tmp/t8-package-manifest.json", "utf8"));
  var allowlist = fs.readFileSync(".claspignore", "utf8").split(/\r?\n/)
    .map(function(line) { return line.trim(); })
    .filter(function(line) { return line.indexOf("!") === 0; })
    .map(function(line) { return line.slice(1); })
    .filter(function(path) { return path !== ""; });

  // P1 current package: 78 allowlisted runtime files (control plane
  // registered by the authorized U8 upload unit, transitional close writer
  // registered by the authorized U10 upload unit), tests/docs excluded.
  check("P1", manifest.current.count === 78 && allowlist.length === 78 &&
    manifest.current.files.every(function(entry) {
      return entry.path.indexOf("tests/") !== 0 && entry.path.indexOf("docs/") !== 0;
    }), String(manifest.current.count));

  // P2 the control-plane file IS registered now (U5 §17 / U7 §4 deferral
  // resolved by the T11.10/U8 authorized upload gate) and hashed in the
  // manifest exactly once.
  check("P2", allowlist.indexOf("101.SingleCommit.Config.Control.js") !== -1 &&
    manifest.current.files.filter(function(entry) {
      return entry.path === "101.SingleCommit.Config.Control.js"; }).length === 1 &&
    fs.existsSync("101.SingleCommit.Config.Control.js"));

  // P3 registered package aggregate: recomputed from the manifest entries
  // must equal the stored aggregate (no hash drift, exactly 78 entries).
  // V720-SA7: pin updated for the Sales modal final refinement upload unit
  // (189/190/195 UI-only changes; T8 manifest regenerated from disk).
  var nodeCrypto = globalThis.nodeCrypto;
  var controlHash = nodeCrypto.createHash("sha256")
    .update(fs.readFileSync("101.SingleCommit.Config.Control.js")).digest("hex");
  var registeredEntries = manifest.current.files
    .slice()
    .sort(function(a, b) { return a.path < b.path ? -1 : (a.path > b.path ? 1 : 0); });
  var registeredAggregate = nodeCrypto.createHash("sha256").update(
    registeredEntries.map(function(entry) {
      return entry.sha256 + "  " + entry.path + "\n"; }).join("")
  ).digest("hex");
  check("P3", registeredEntries.length === 78 &&
    registeredAggregate === manifest.current.aggregateHash &&
    registeredAggregate === "adf699d020629aea5b5c1af38323506957eebcaa37b16506a1ac2a3b93ab068a",
    registeredAggregate);

  console.log("T11_7_U5_PACKAGE current=" + manifest.current.count +
    " currentHash=" + manifest.current.aggregateHash +
    " registered=78 registeredHash=" + registeredAggregate +
    " controlSha256=" + controlHash);
  console.log("T11_7_U5_PACKAGE checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass,
    registeredHash: registeredAggregate, controlSha256: controlHash };
}
