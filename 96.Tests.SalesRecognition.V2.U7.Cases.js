// SALES_RECOGNITION_V2 U7 operator-flow tests: config-aware NEW-Sales routing
// (PREPARED/ACTIVE/PAUSED), server-enforced V2 retirements, request identity /
// UNKNOWN semantics, Correct/Void cohort routing, operator UI source
// contracts, and the 28-item source audit. Fixture-only: ACTIVE/PAUSED configs
// are injected per call (PropertiesService stub + explicit config), production
// config is never mutated, no T/ActivationID is written, no network, no clasp,
// no writes outside fixture memory.

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
function u7Config_(mode) {
  return { mode: mode, contractVersion: "SALES_RECOGNITION_V2",
    activationID: mode === "PREPARED" ? "" : "ACT-U7",
    activatedAt: mode === "PREPARED" ? "" : "2026-12-01T00:00:00.000Z",
    configVersion: 1 };
}

function u7WithConfig_(config, fn) {
  var original = typeof PropertiesService === "undefined" ? undefined : PropertiesService;
  PropertiesService = { getScriptProperties: function() {
    return { getProperty: function(key) {
      return key === SALES_V2_OPERATOR.CONFIG_PROPERTY && config ? JSON.stringify(config) : null;
    } };
  } };
  try { return fn(); }
  finally { PropertiesService = original; }
}

function u7Payload_(key, extras) {
  var payload = { requestKey: key, orderType: "DINE_IN",
    lines: [{ productID: "P1", productVariantID: "PV1", qty: 1 },
      { productID: "P1", productVariantID: "PV1", qty: 2 }] };
  return Object.assign(payload, extras || {});
}

// Repository that supports BOTH the U2 durable core (findOperation/
// createOperation/updateOperation) and the legacy durable order writer
// (findOrder/createOrder/updateOrder) plus rows() introspection — so the
// routing matrix test exercises whichever path the active mode selects.
function u7Repo_(initial) {
  var repo = transactionReadinessMemoryRepository_(initial);
  repo.rows = function() { return repo.state().operations.slice(); };
  return repo;
}

function u7FixtureRuntime_(options) {
  options = options || {};
  var fixture = options.fixture || salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var repository = options.repository || u7Repo_();
  return { fixture: fixture,
    runtime: salesV2SaveRuntime_(Object.assign({ fixture: fixture, repository: repository },
      options.runtime || {})) };
}

function u7OrderRow_(orderID) {
  return { OrderID: orderID, OrderNumber: orderID, OrderType: "DINE_IN",
    PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN", OrderTotal: 20000,
    HppTotalSnapshot: 2, CreatedAt: "2026-10-05T00:00:00Z", CreatedBy: "u7",
    PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "", UpdatedBy: "u7" };
}

function u7SeedOperation_(repository, type, businessID, key, state) {
  return repository.createOperation({ OperationID: "TXOP-U7-" + type + "-" + key,
    OperationType: type, BusinessID: businessID, RequestKey: key, State: state || "COMMITTED",
    PayloadHash: "H-U7", OperationPlan: "{}", CreatedAt: "", UpdatedAt: "", LastError: "" });
}

function u7Throw_(fn) {
  try { fn(); } catch (error) { return error; }
  return null;
}

// ---------------------------------------------------------------------------
// OPERATOR FLOW: Input -> OrderType -> lines -> Save -> Done. Fixture-only
// ACTIVE/PAUSED; PREPARED keeps current production behavior; no payment or
// fulfillment step, no legacy fallback, no client-total authority.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U7OperatorFlow() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U7_OPERATOR_FLOW:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, t = TRANSACTION_PRODUCTION_CONTRACT,
    contract = SALES_RECOGNITION_V2_CONTRACT;

  // T1: ACTIVE -> ONE U2 durable Save -> Done; multiline = one Sale.
  var active = u7FixtureRuntime_(), payload1 = u7Payload_("u7-save-1");
  var res1 = salesV2OperatorCreateWithRuntime_(payload1, active.runtime, u7Config_("ACTIVE"));
  check("T1a", res1.success === true && res1.requestKey === "u7-save-1" &&
    res1.data && res1.data.salesCohort === "V2_COMMITTED" &&
    res1.data.recognitionStatus === "RECOGNIZED", JSON.stringify(res1));
  var ops1 = active.runtime.repository.rows();
  check("T1b", ops1.length === 1 && ops1[0].OperationType === save.OPERATION_TYPE &&
    ops1[0].State === "COMMITTED" && ops1[0].BusinessID === res1.data.OrderID,
    JSON.stringify(ops1.map(function(op) { return [op.OperationType, op.State]; })));
  check("T1c", ops1.every(function(op) {
    return op.OperationType !== "ORDER_CREATE" && op.OperationType !== "PAYMENT";
  }));
  var orders1 = readCanonicalTable(active.fixture, "Orders", t.ORDERS.HEADERS);
  var lines1 = readCanonicalTable(active.fixture, "OrderLines", t.ORDER_LINES.HEADERS);
  var events1 = readCanonicalTable(active.fixture, "SalesRecognitionEvents", contract.HEADERS);
  check("T1d", orders1.length === 1 && lines1.length === 2 && events1.length === 1,
    JSON.stringify([orders1.length, lines1.length, events1.length]));
  // No Payment / Receive Via / fulfillment / CLOSED step; no fabricated method.
  check("T1e", !active.fixture.getSheetByName("Payments") &&
    !active.fixture.getSheetByName("Settlements") &&
    Number(orders1[0].OrderTotal) === 60000 &&
    orders1[0].PaymentStatus === "UNPAID" && orders1[0].FulfillmentStatus === "OPEN" &&
    orders1[0].CompletedAt === "" && orders1[0].PreparingAt === "");
  check("T1f", ["ReceiveVia", "receiveVia", "paymentMethod", "AccountCode", "PaidAt"].every(
    function(key) { return !Object.prototype.hasOwnProperty.call(res1.data, key); }));
  // T21: duplicate click / replay -> same RequestKey, one durable effect.
  var replay = salesV2OperatorCreateWithRuntime_(payload1, active.runtime, u7Config_("ACTIVE"));
  check("T21a", replay.success === true && replay.requestKey === "u7-save-1" &&
    readCanonicalTable(active.fixture, "SalesRecognitionEvents", contract.HEADERS).length === 1 &&
    readCanonicalTable(active.fixture, "Orders", t.ORDERS.HEADERS).length === 1 &&
    active.runtime.repository.rows().length === 1);
  // Client total is display-only: extra payload fields never reach authority.
  var manip = u7FixtureRuntime_();
  var manipRes = salesV2OperatorCreateWithRuntime_(
    u7Payload_("u7-total-1", { orderTotal: 1, total: 999999, revenue: 999999 }),
    manip.runtime, u7Config_("ACTIVE"));
  var manipPlan = JSON.parse(manip.runtime.repository.rows()[0].OperationPlan);
  check("T22a", manipRes.success === true && manipPlan.orderTotal === 60000 &&
    manipPlan.hppTotalSnapshot === 6 &&
    !Object.prototype.hasOwnProperty.call(manipPlan.normalizedPayload, "orderTotal") &&
    !Object.prototype.hasOwnProperty.call(manipPlan.normalizedPayload, "revenue") &&
    Object.keys(manipPlan.normalizedPayload).sort().join(",") === "lines,orderType,requestKey",
    JSON.stringify(manipPlan.normalizedPayload));

  // T2: PREPARED — legacy routing intact, no T, no V2 write.
  PropertiesService = undefined;
  var preparedRoute = salesV2OperatorResolvedRoute_();
  check("T2a", preparedRoute.mode === "PREPARED" && salesV2OperatorLegacySalesGuard_() === null);
  var defaultConfig = salesRecognitionV2DefaultConfig();
  check("T2b", defaultConfig.mode === "PREPARED" && defaultConfig.activationID === "" &&
    defaultConfig.activatedAt === "" &&
    !/\d{4}-\d{2}-\d{2}T/.test(JSON.stringify(salesRecognitionV2OperatorConfig())));
  var legacyFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var legacy = { fixture: legacyFixture, spreadsheet: legacyFixture,
    repository: transactionReadinessMemoryRepository_(),
    now: function() { return new Date("2026-10-15T02:03:04.000Z"); },
    actor: function() { return "u7@test"; } };
  var legacyRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-prepared-1"),
    legacy, u7Config_("PREPARED"));
  var legacyState = legacy.repository.state();
  check("T2c", legacyRes && legacyRes.OrderID && legacyState.orders.length === 1 &&
    legacyState.operations.length === 1 &&
    legacyState.operations[0].OperationType === "ORDER_CREATE" &&
    legacyState.operations[0].State === "COMMITTED", JSON.stringify(legacyState.operations));
  check("T2d", legacyState.operations.every(function(op) {
    return SALES_V2_OPERATOR.V2_OPERATION_TYPES.indexOf(op.OperationType) === -1;
  }) && Number(legacyState.orders[0].OrderTotal) === 60000 &&
    legacyState.orders[0].PaymentStatus === "UNPAID");
  // PREPARED legacy canonical Sales dispatch stays reachable (no guard refusal).
  check("T2e", salesV2OperatorCreateWithRuntime_ !== null &&
    submitCanonicalTransactionWithRuntime_.toString().indexOf("salesV2OperatorLegacySalesGuard_") !== -1);

  // T3: ACTIVE — legacy writer rejected / not invoked; V2 failure never falls back.
  var guardRuntime = {
    lock: { waitLock: function() { throw new Error("LOCK_MUST_NOT_RUN"); },
      releaseLock: function() {} },
    spreadsheet: function() { throw new Error("SPREADSHEET_MUST_NOT_RUN"); },
    environment: "LOCAL_FIXTURE" };
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    var refused = submitCanonicalTransactionWithRuntime_(
      { transactionType: "SALES", productId: "P1", type: "Hot", qty: 1, cashAccountCode: "1000" },
      guardRuntime);
    check("T3a", refused.success === false && refused.status === "REFUSED" &&
      refused.writeCount === 0 && refused.error.code === "SALES_V2_LEGACY_SALES_RETIRED",
      JSON.stringify(refused));
    // EXPENSE is not a Sale: unaffected by the Sales routing guard.
    var expenseRefused = submitCanonicalTransactionWithRuntime_(
      { transactionType: "EXPENSE", expenseItemId: "O1", amount: 50000, cashAccountCode: "1000" },
      guardRuntime);
    check("T3b", expenseRefused.error.code !== "SALES_V2_LEGACY_SALES_RETIRED");
  });
  u7WithConfig_(u7Config_("PAUSED"), function() {
    var refused = submitCanonicalTransactionWithRuntime_(
      { transactionType: "SALES", productId: "P1", type: "Hot", qty: 1, cashAccountCode: "1000" },
      guardRuntime);
    check("T3c", refused.status === "REFUSED" && refused.writeCount === 0 &&
      refused.error.code === "V2_MODE_PAUSED", JSON.stringify(refused));
  });
  // V2 failure -> fail closed (unknown flag), zero legacy fallback.
  var failing = u7FixtureRuntime_({ runtime: { batch: function() { throw new Error("BATCH_DOWN"); } } });
  var failRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-fail-1"),
    failing.runtime, u7Config_("ACTIVE"));
  check("T3d", failRes.success === false && failRes.unknown === true &&
    failRes.requestKey === "u7-fail-1", JSON.stringify(failRes));
  var failOps = failing.runtime.repository.rows();
  check("T3e", failOps.length === 1 && failOps[0].State === "IN_PROGRESS" &&
    failOps.every(function(op) { return op.OperationType === save.OPERATION_TYPE; }) &&
    readCanonicalTable(failing.fixture, "Orders", t.ORDERS.HEADERS).length === 0 &&
    !failing.fixture.getSheetByName("Payments"),
    JSON.stringify({ ops: failOps.map(function(op) { return [op.OperationType, op.State]; }),
      orders: readCanonicalTable(failing.fixture, "Orders", t.ORDERS.HEADERS).length }));
  // Production submitOperationalOrder wiring: ACTIVE -> U2 only; PAUSED -> reject.
  var originalSave = salesRecognitionV2DurableSave,
    originalLegacy = createDurableOperationalOrder_, saved = [], legacyCalls = 0;
  salesRecognitionV2DurableSave = function(p) {
    saved.push(p);
    return { status: "DONE", requestKey: p.requestKey, orderID: "ORD-U7-PROD" };
  };
  createDurableOperationalOrder_ = function() { legacyCalls++; throw new Error("LEGACY_MUST_NOT_RUN"); };
  try {
    var prodActive = salesV2OperatorModeCreateOrder_(u7Payload_("u7-prod-1"),
      salesV2OperatorRoute_(u7Config_("ACTIVE")));
    check("T3f", saved.length === 1 && saved[0].requestKey === "u7-prod-1" &&
      prodActive.success === true && prodActive.data.OrderID === "ORD-U7-PROD" &&
      prodActive.data.salesCohort === "V2_COMMITTED" && legacyCalls === 0);
    var prodPaused = salesV2OperatorModeCreateOrder_(u7Payload_("u7-prod-2"),
      salesV2OperatorRoute_(u7Config_("PAUSED")));
    check("T3g", prodPaused.success === false &&
      prodPaused.error.code === "V2_MODE_PAUSED" && saved.length === 1 && legacyCalls === 0);
    salesRecognitionV2DurableSave = function(p) {
      return { status: "UNKNOWN", code: "BATCH_OUTCOME_UNKNOWN", requestKey: p.requestKey };
    };
    var prodUnknown = salesV2OperatorModeCreateOrder_(u7Payload_("u7-prod-3"),
      salesV2OperatorRoute_(u7Config_("ACTIVE")));
    check("T3h", prodUnknown.success === false && prodUnknown.unknown === true &&
      prodUnknown.requestKey === "u7-prod-3" && legacyCalls === 0, JSON.stringify(prodUnknown));
  } finally {
    salesRecognitionV2DurableSave = originalSave;
    createDurableOperationalOrder_ = originalLegacy;
  }
  // Production seam source contract (no V2 literal in the legacy branch).
  var orderSource = submitOperationalOrder.toString();
  check("T3i", orderSource.indexOf("salesV2OperatorResolvedRoute_") !== -1 &&
    orderSource.indexOf("salesV2OperatorModeCreateOrder_") !== -1 &&
    orderSource.indexOf("createDurableOperationalOrder_") !== -1 &&
    orderSource.indexOf("SALES_RECOGNITION_V2_SAVE") === -1);

  // T4: PAUSED — new Sale rejected, zero writes; persisted V2 intent sticky.
  var paused = u7FixtureRuntime_();
  var pausedRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-paused-1"),
    paused.runtime, u7Config_("PAUSED"));
  check("T4a", pausedRes.success === false && pausedRes.error.code === "V2_MODE_PAUSED" &&
    paused.runtime.repository.rows().length === 0 &&
    readCanonicalTable(paused.fixture, "Orders", t.ORDERS.HEADERS).length === 0);
  var invalidRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-invalid-1"),
    paused.runtime, { mode: "ACTIVE", contractVersion: "OTHER", activationID: "",
      activatedAt: "", configVersion: 1 });
  check("T4b", invalidRes.success === false && invalidRes.error.code === "CONFIG_INVALID" &&
    paused.runtime.repository.rows().length === 0);
  // Sticky V2: IN_PROGRESS intent persists, then recovers under PAUSED.
  var sticky = u7FixtureRuntime_({ runtime: { crash: "V2_AFTER_INTENT_PERSIST",
    config: u7Config_("ACTIVE") } });
  var crashError = u7Throw_(function() {
    salesRecognitionV2SaveWithRuntime_(u7Payload_("u7-sticky-1"), sticky.runtime);
  });
  check("T4c", crashError !== null && sticky.runtime.repository.rows().length === 1 &&
    sticky.runtime.repository.rows()[0].State === "IN_PROGRESS");
  sticky.runtime.config = u7Config_("PAUSED");
  var stickyResume = salesRecognitionV2SaveWithRuntime_(u7Payload_("u7-sticky-1"), sticky.runtime);
  check("T4d", stickyResume.status === "DONE" && stickyResume.writeCount === 7 &&
    sticky.runtime.repository.rows()[0].State === "COMMITTED" &&
    sticky.runtime.repository.rows()[0].OperationType === save.OPERATION_TYPE,
    JSON.stringify(stickyResume));
  // New intent under PAUSED is still refused on a fresh runtime.
  var pausedNew = u7FixtureRuntime_({ runtime: { config: u7Config_("PAUSED") } });
  var pausedNewRes = salesRecognitionV2SaveWithRuntime_(u7Payload_("u7-paused-2"), pausedNew.runtime);
  check("T4e", pausedNewRes.status === "REFUSED" && pausedNewRes.code === "V2_MODE_PAUSED" &&
    pausedNew.runtime.repository.rows().length === 0);

  // T19: config sequence PREPARED -> ACTIVE -> PAUSED; no date-only fallback.
  check("T19a", salesV2OperatorRoute_(u7Config_("PREPARED")).mode === "PREPARED" &&
    salesV2OperatorRoute_(u7Config_("ACTIVE")).mode === "ACTIVE" &&
    salesV2OperatorRoute_(u7Config_("PAUSED")).mode === "PAUSED");
  var sequence = [];
  u7WithConfig_(u7Config_("PREPARED"), function() {
    sequence.push(salesV2OperatorResolvedRoute_().mode);
  });
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    sequence.push(salesV2OperatorResolvedRoute_().mode);
  });
  u7WithConfig_(u7Config_("PAUSED"), function() {
    sequence.push(salesV2OperatorResolvedRoute_().mode);
  });
  sequence.push(salesV2OperatorResolvedRoute_().mode);
  check("T19b", JSON.stringify(sequence) === JSON.stringify(
    ["PREPARED", "ACTIVE", "PAUSED", "PREPARED"]), JSON.stringify(sequence));
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    // A date on an order never classifies it as V2: no persisted evidence.
    var dated = classifySalesRecognitionCohort(
      { OrderID: "ORD-DATED-1", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
        CreatedAt: "2027-01-01T00:00:00Z" }, {});
    check("T19c", dated.cohort === "PRE_V2_ORDER" && dated.status === "OK" &&
      salesV2OperatorOrderCohort_("ORD-DATED-1",
        transactionReadinessMemoryRepository_(), undefined) === "");
  });
  // Production default remains PREPARED with no T after the whole sequence.
  var resolved = salesRecognitionV2OperatorConfig();
  check("T19d", resolved.mode === "PREPARED" && resolved.activationID === "" &&
    resolved.activatedAt === "");

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// RETIREMENT GUARDS: payment / Receive Via / fulfillment / CLOSED / cash
// posting / ProductVariant authority — all evidence-based, pre-mutation.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U7RetirementGuards() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U7_GUARDS:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE;
  var payRuntime = { spreadsheet: {}, now: function() { return new Date("2026-10-15T02:03:04.000Z"); },
    actor: function() { return "u7@test"; }, financeExists: function() { return true; },
    settle: function() { throw new Error("SETTLE_MUST_NOT_RUN"); }, flush: function() {} };

  // V2 target: every payment surface refuses BEFORE the first write.
  var v2Repo = transactionReadinessMemoryRepository_({ orders: [u7OrderRow_("ORD-V2-G1")] });
  u7SeedOperation_(v2Repo, save.OPERATION_TYPE, "ORD-V2-G1", "u7-v2-op-1");
  var beforeV2 = JSON.stringify(v2Repo.state());
  var payErr = u7Throw_(function() {
    createDurableOperationalPayment_("ORD-V2-G1",
      { requestKey: "u7-pay-v2", receiveVia: "CASH", amount: 20000 }, payRuntime, v2Repo);
  });
  check("G1a", payErr && payErr.code === "SALES_V2_PAYMENT_RETIRED",
    payErr && payErr.code);
  check("G1b", JSON.stringify(v2Repo.state()) === beforeV2,
    JSON.stringify(v2Repo.state()));
  var payRepoErr = u7Throw_(function() {
    payOperationalOrderWithRepository("ORD-V2-G1",
      { requestKey: "u7-pay-v2b", receiveVia: "CASH", amount: 20000 }, payRuntime, v2Repo);
  });
  check("G1c", payRepoErr && payRepoErr.code === "SALES_V2_PAYMENT_RETIRED" &&
    JSON.stringify(v2Repo.state()) === beforeV2);
  // Receive Via / settlement path is the same refusal; no fabricated channel.
  check("G1d", payErr.field === "orderID" &&
    ["ReceiveVia", "receiveVia", "1030"].every(function(token) {
      return String(payErr.message || "").indexOf(token) === -1;
    }));

  // Fulfillment / mark-ready / Complete / CLOSED transitions refuse for V2.
  var fulErr = u7Throw_(function() {
    transitionOperationalFulfillmentWithRepository("ORD-V2-G1", "PREPARING", payRuntime, v2Repo);
  });
  check("G2a", fulErr && fulErr.code === "SALES_V2_FULFILLMENT_RETIRED" &&
    JSON.stringify(v2Repo.state()) === beforeV2, fulErr && fulErr.code);
  var closedErr = u7Throw_(function() {
    transitionOperationalFulfillmentWithRepository("ORD-V2-G1", "COMPLETED", payRuntime, v2Repo);
  });
  check("G2b", closedErr && closedErr.code === "SALES_V2_FULFILLMENT_RETIRED" &&
    v2Repo.state().orders[0].FulfillmentStatus === "OPEN" &&
    v2Repo.state().orders[0].PaymentStatus === "UNPAID");
  // Guard sources are evidence-based: no date/amount inference anywhere.
  check("G2c", salesV2OperatorOrderCohort_.toString().indexOf("CreatedAt") === -1 &&
    salesV2OperatorOrderCohort_.toString().indexOf("Tanggal") === -1 &&
    salesV2OperatorOrderCohort_.toString().indexOf("new Date") === -1);

  // Pre-V2 historical servicing stays intact (same repo shape, legacy evidence).
  var oldRepo = transactionReadinessMemoryRepository_({ orders: [u7OrderRow_("ORD-OLD-1")] });
  u7SeedOperation_(oldRepo, "ORDER_CREATE", "ORD-OLD-1", "u7-old-op-1");
  var oldPaid = null;
  var oldPayError = u7Throw_(function() {
    oldPaid = createDurableOperationalPayment_("ORD-OLD-1",
      { requestKey: "u7-pay-old", receiveVia: "CASH", amount: 20000 }, payRuntime, oldRepo);
  });
  check("G3a", oldPayError === null && oldPaid && oldPaid.order.PaymentStatus === "PAID" &&
    oldRepo.state().payments.length === 1 &&
    oldRepo.state().operations.filter(function(op) {
      return op.OperationType === "PAYMENT"; }).length === 1,
    JSON.stringify({ error: oldPayError && oldPayError.code,
      operations: oldRepo.state().operations.map(function(op) { return op.OperationType; }) }));
  var oldTransition = transitionOperationalFulfillmentWithRepository("ORD-OLD-1",
    "PREPARING", payRuntime, oldRepo);
  check("G3b", oldTransition.order.FulfillmentStatus === "PREPARING" &&
    oldRepo.state().orders[0].PaymentStatus === "PAID");
  // Mixed repository: a V2 operation for ANOTHER order never leaks onto the
  // old order (cohort evidence must be bound to the exact OrderID). The second
  // payment reaches the legacy duplicate-payment rule, not a V2 refusal.
  u7SeedOperation_(oldRepo, save.OPERATION_TYPE, "ORD-V2-OTHER", "u7-v2-op-2");
  var secondOldPay = u7Throw_(function() {
    createDurableOperationalPayment_("ORD-OLD-1",
      { requestKey: "u7-pay-old-2", receiveVia: "CASH", amount: 20000 }, payRuntime, oldRepo);
  });
  check("G3c", secondOldPay && secondOldPay.code === "SECOND_PAYMENT_REFUSED" &&
    secondOldPay.code !== "SALES_V2_PAYMENT_RETIRED" &&
    oldRepo.state().orders[0].PaymentStatus === "PAID",
    secondOldPay && secondOldPay.code);

  // Cash posting: a V2 sale can never become a posting candidate.
  var v2Settlement = cashFoundationSettlement({ RelatedTransactionType: "Order",
    RelatedTransactionID: "ORD-V2-CASH", SourceID: "PAY-V2-CASH" });
  var blocked = buildCashPostingCandidate(v2Settlement,
    { accounts: cashFoundationTestAccounts(), transactions: [], balanceLedgerRows: [],
      settlements: [],
      salesRecognitionOperations: [{ OperationType: save.OPERATION_TYPE,
        BusinessID: "ORD-V2-CASH", State: "COMMITTED" }] });
  check("G4a", blocked.status === "REFUSED" && blocked.reason === "SALES_V2_NO_CASH_POST" &&
    blocked.writeCount === 0 && blocked.readOnly === true, JSON.stringify(blocked));
  var blockedByEvent = buildCashPostingCandidate(v2Settlement,
    { accounts: cashFoundationTestAccounts(), transactions: [], balanceLedgerRows: [],
      settlements: [], salesRecognitionEvents: [{ OrderID: "ORD-V2-CASH",
        ContractVersion: "SALES_RECOGNITION_V2" }] });
  check("G4b", blockedByEvent.status === "REFUSED" &&
    blockedByEvent.reason === "SALES_V2_NO_CASH_POST");
  var notBlocked = buildCashPostingCandidate(v2Settlement,
    { accounts: cashFoundationTestAccounts(), transactions: [], balanceLedgerRows: [],
      settlements: [] });
  check("G4c", notBlocked.reason !== "SALES_V2_NO_CASH_POST",
    JSON.stringify(notBlocked));

  // ProductVariant: explicit ProductVariantID authority, no Tipe fallback.
  var pv = u7FixtureRuntime_();
  var missingVariant = salesV2OperatorCreateWithRuntime_(
    { requestKey: "u7-pv-1", orderType: "DINE_IN", lines: [{ productID: "P1", qty: 1 }] },
    pv.runtime, u7Config_("ACTIVE"));
  check("G5a", missingVariant.success === false && missingVariant.requestKey === "u7-pv-1" &&
    pv.runtime.repository.rows().length === 0, JSON.stringify(missingVariant));
  var tipeOnly = salesV2OperatorCreateWithRuntime_(
    { requestKey: "u7-pv-2", orderType: "DINE_IN",
      lines: [{ productID: "P1", tipe: "HOT", qty: 1 }] },
    pv.runtime, u7Config_("ACTIVE"));
  check("G5b", tipeOnly.success === false && pv.runtime.repository.rows().length === 0,
    JSON.stringify(tipeOnly));
  var withStrayTipe = salesV2OperatorCreateWithRuntime_(
    u7Payload_("u7-pv-3", { lines: [{ productID: "P1", productVariantID: "PV1",
      qty: 1, tipe: "COLD" }] }), pv.runtime, u7Config_("ACTIVE"));
  var pvPlan = pv.runtime.repository.rows()[0] &&
    JSON.parse(pv.runtime.repository.rows()[0].OperationPlan);
  check("G5c", withStrayTipe.success === true && pvPlan.lineRows[0].Tipe === "HOT" &&
    pvPlan.lineRows[0].ProductVariantID === "PV1" &&
    !Object.prototype.hasOwnProperty.call(pvPlan.normalizedPayload.lines[0], "tipe"),
    JSON.stringify(pvPlan && pvPlan.normalizedPayload));
  check("G5d", salesRecognitionV2NormalizeSave_.toString()
    .indexOf("productVariantID: String(line && line.productVariantID") !== -1 &&
    salesRecognitionV2NormalizeSave_.toString().indexOf("line.tipe") === -1);

  // Recovery dispatcher: persisted V2 op -> V2 recovery only.
  var rec = u7FixtureRuntime_({ runtime: { crash: "V2_AFTER_INTENT_PERSIST",
    config: u7Config_("ACTIVE") } });
  var recCrash = u7Throw_(function() {
    salesRecognitionV2SaveWithRuntime_(u7Payload_("u7-rec-1"), rec.runtime);
  });
  var recOp = rec.runtime.repository.rows()[0];
  check("G6a", recCrash !== null && recOp.State === "IN_PROGRESS" &&
    recOp.OperationType === save.OPERATION_TYPE);
  var recovered = recoverTransactionOperationWithRuntime_(recOp.OperationID, rec.runtime);
  check("G6b", recovered.State === "COMMITTED" &&
    rec.runtime.repository.rows().length === 1 &&
    rec.runtime.repository.rows()[0].OperationType === save.OPERATION_TYPE,
    JSON.stringify(rec.runtime.repository.rows().map(function(op) { return op.OperationType; })));
  check("G6c", readCanonicalTable(rec.fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS).length === 1 &&
    readCanonicalTable(rec.fixture, "Orders", TRANSACTION_PRODUCTION_CONTRACT.ORDERS.HEADERS).length === 1);
  var recoverySource = recoverTransactionOperationWithRuntime_.toString();
  check("G6d", recoverySource.indexOf("salesV2OperatorIsRecoveryOperation_") !== -1 &&
    recoverySource.indexOf("salesV2OperatorRecoverWithRuntime_") !== -1 &&
    recoverySource.indexOf("salesV2OperatorIsRecoveryOperation_") <
      recoverySource.indexOf('operation.OperationType === "ORDER_CREATE"') &&
    recoverySource.indexOf("SALES_RECOGNITION_V2_SAVE") === -1 &&
    salesV2OperatorIsRecoveryOperation_(save.OPERATION_TYPE) === true &&
    salesV2OperatorIsRecoveryOperation_("SALES_V2_VOID") === true &&
    salesV2OperatorIsRecoveryOperation_("SALES_V2_CORRECT") === true &&
    salesV2OperatorIsRecoveryOperation_("PAYMENT") === false &&
    salesV2OperatorIsRecoveryOperation_("ORDER_CREATE") === false);

  // Old Order servicing under ACTIVE: historical actions retained, not V2.
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    var cleanOldRepo = transactionReadinessMemoryRepository_(
      { orders: [u7OrderRow_("ORD-OLD-2")] });
    u7SeedOperation_(cleanOldRepo, "ORDER_CREATE", "ORD-OLD-2", "u7-old-op-2");
    u7SeedOperation_(cleanOldRepo, save.OPERATION_TYPE, "ORD-V2-OTHER", "u7-v2-op-3");
    check("G7a", salesV2OperatorOrderCohort_("ORD-OLD-2", cleanOldRepo, undefined) === "",
      "evidence for another order must not reclassify the old order");
    check("G7b", salesV2OperatorOrderCohort_("ORD-V2-OTHER", cleanOldRepo, undefined) ===
      "V2_COMMITTED");
    // Route stays mode-aware but servicing guards never consult the mode.
    check("G7c", salesV2OperatorResolvedRoute_().mode === "ACTIVE" &&
      typeof salesV2OperatorPaymentGuard_ === "function" &&
      typeof salesV2OperatorFulfillmentGuard_ === "function");
  });

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// REQUEST IDENTITY / UNKNOWN: one stable RequestKey, uncertain outcomes keep
// the identity, payload immutable while pending, Done only on confirmed state.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U7RequestIdentity() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U7_IDENTITY:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, t = TRANSACTION_PRODUCTION_CONTRACT;

  // UNKNOWN after the durable intent: identity retained, never definite-failure.
  var unknown = u7FixtureRuntime_({ runtime: { crash: "V2_BEFORE_COMMIT",
    config: u7Config_("ACTIVE") } });
  var unknownRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-unknown-1"),
    unknown.runtime, u7Config_("ACTIVE"));
  check("I1a", unknownRes.success === false && unknownRes.unknown === true &&
    unknownRes.requestKey === "u7-unknown-1" &&
    unknownRes.error.code !== undefined, JSON.stringify(unknownRes));
  var unknownOps = unknown.runtime.repository.rows();
  check("I1b", unknownOps.length === 1 && unknownOps[0].State === "IN_PROGRESS" &&
    unknownOps[0].RequestKey === "u7-unknown-1");
  // Retry of the SAME operation with the SAME identity resolves to Done.
  var retried = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-unknown-1"),
    unknown.runtime, u7Config_("ACTIVE"));
  check("I1c", retried.success === true && retried.requestKey === "u7-unknown-1" &&
    unknown.runtime.repository.rows().length === 1 &&
    unknown.runtime.repository.rows()[0].State === "COMMITTED" &&
    readCanonicalTable(unknown.fixture, "SalesRecognitionEvents",
      SALES_RECOGNITION_V2_CONTRACT.HEADERS).length === 1);

  // Lost response after commit: same key replays Done with zero new writes.
  var lost = u7FixtureRuntime_({ runtime: { crash: "V2_AFTER_COMMIT",
    config: u7Config_("ACTIVE") } });
  var lostRes = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-lost-1"),
    lost.runtime, u7Config_("ACTIVE"));
  check("I2a", lostRes.success === false && lostRes.unknown === true &&
    lostRes.requestKey === "u7-lost-1" &&
    lost.runtime.repository.rows()[0].State === "COMMITTED", JSON.stringify(lostRes));
  var lostReplay = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-lost-1"),
    lost.runtime, u7Config_("ACTIVE"));
  check("I2b", lostReplay.success === true && lostReplay.requestKey === "u7-lost-1" &&
    readCanonicalTable(lost.fixture, "Orders", t.ORDERS.HEADERS).length === 1 &&
    readCanonicalTable(lost.fixture, "SalesRecognitionEvents",
      SALES_RECOGNITION_V2_CONTRACT.HEADERS).length === 1);

  // Payload mutation while pending: same key + changed payload = conflict;
  // the frozen original intent is never overwritten.
  var pending = u7FixtureRuntime_({ runtime: { crash: "V2_AFTER_INTENT_PERSIST",
    config: u7Config_("ACTIVE") } });
  u7Throw_(function() {
    salesRecognitionV2SaveWithRuntime_(u7Payload_("u7-pending-1"), pending.runtime);
  });
  var frozenPlan = pending.runtime.repository.rows()[0].OperationPlan;
  var changed = salesV2OperatorCreateWithRuntime_(
    u7Payload_("u7-pending-1", { lines: [{ productID: "P1", productVariantID: "PV1", qty: 9 }] }),
    pending.runtime, u7Config_("ACTIVE"));
  check("I3a", changed.success === false && changed.unknown !== true &&
    changed.requestKey === "u7-pending-1" &&
    changed.error.code === "OPERATION_PAYLOAD_CONFLICT", JSON.stringify(changed));
  check("I3b", pending.runtime.repository.rows().length === 1 &&
    pending.runtime.repository.rows()[0].OperationPlan === frozenPlan &&
    pending.runtime.repository.rows()[0].State === "IN_PROGRESS",
    JSON.stringify(pending.runtime.repository.rows().map(function(op) { return op.State; })));
  // A definitively resolved intent may use a new identity afterwards.
  var resolved = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-pending-1"),
    pending.runtime, u7Config_("ACTIVE"));
  check("I3c", resolved.success === true);
  var freshKey = salesV2OperatorCreateWithRuntime_(u7Payload_("u7-pending-2"),
    pending.runtime, u7Config_("ACTIVE"));
  check("I3d", freshKey.success === true && freshKey.requestKey === "u7-pending-2" &&
    pending.runtime.repository.rows().length === 2);

  // Response mapping: DONE/REFUSED/CONFLICT/UNKNOWN each keep the requestKey.
  var doneMap = salesV2OperatorSaveResponse_({ status: "DONE", requestKey: "k-done",
    orderID: "ORD-1" }, null);
  var refusedMap = salesV2OperatorSaveResponse_({ status: "REFUSED", code: "X",
    requestKey: "k-refused" }, null);
  var conflictMap = salesV2OperatorSaveResponse_({ status: "CONFLICT",
    code: "OPERATION_PAYLOAD_CONFLICT", requestKey: "k-conflict" }, null);
  var recoveryMap = salesV2OperatorSaveResponse_({ status: "RECOVERY_REQUIRED",
    code: "ARTIFACTS_INCOMPLETE", requestKey: "k-recovery" }, null);
  check("I4a", doneMap.success === true && doneMap.requestKey === "k-done" &&
    doneMap.data.recognitionStatus === "RECOGNIZED");
  check("I4b", refusedMap.success === false && !refusedMap.unknown &&
    refusedMap.requestKey === "k-refused");
  check("I4c", conflictMap.success === false && !conflictMap.unknown &&
    conflictMap.requestKey === "k-conflict");
  check("I4d", recoveryMap.success === false && recoveryMap.unknown === true &&
    recoveryMap.requestKey === "k-recovery");

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// CORRECT/VOID COHORT ROUTING + HISTORICAL SERVICING + STATUS SEMANTICS.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U7CorrectVoidRouting() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U7_ROUTING:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var protectedSheets = ["Payments", "Settlements", "InventoryLedger", "tabsal", "tabops", "Logs"];
  function sheetText(fixture, names) {
    return JSON.stringify(names.map(function(name) {
      var sheet = fixture.getSheetByName(name);
      return sheet ? sheet.values : null;
    }));
  }

  // T12: V2 Correct/Void -> U6 operation types only; legacy surfaces frozen.
  var v2Fixture = u6PricedFixture_("u7-routing-1", 20000,
    [{ productID: "P1", productVariantID: "PV1", qty: 1 }]);
  var v2Rt = u6NovRuntime_({ fixture: v2Fixture.fixture,
    repository: v2Fixture.runtime.repository });
  var protectedBefore = sheetText(v2Fixture.fixture, protectedSheets);
  var voidRes = salesRecognitionV2VoidWithRuntime_(
    { requestKey: "u7-void-1", orderID: v2Fixture.orderID, reason: "u7 routing void" }, v2Rt);
  check("R1a", voidRes.status === "DONE" && voidRes.requestKey === "u7-void-1" &&
    voidRes.targetOrderID === v2Fixture.orderID, JSON.stringify(voidRes));
  var voidOps = v2Rt.repository.rows().filter(function(op) {
    return op.OperationType === "SALES_V2_VOID"; });
  check("R1b", voidOps.length === 1 && voidOps[0].State === "COMMITTED" &&
    v2Rt.repository.rows().every(function(op) {
      return op.OperationType === "SALES_V2_VOID" ||
        op.OperationType === SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE;
    }), JSON.stringify(v2Rt.repository.rows().map(function(op) { return op.OperationType; })));
  check("R1c", sheetText(v2Fixture.fixture, protectedSheets) === protectedBefore,
    "protected surfaces changed");
  var noReason = salesRecognitionV2VoidWithRuntime_(
    { requestKey: "u7-void-2", orderID: v2Fixture.orderID }, v2Rt);
  check("R1d", noReason.status === "REFUSED" && noReason.code === "REASON_REQUIRED" &&
    v2Rt.repository.rows().filter(function(op) {
      return op.RequestKey === "u7-void-2"; }).length === 0);
  var correctFixture = u6PricedFixture_("u7-routing-2", 20000,
    [{ productID: "P1", productVariantID: "PV1", qty: 1 }]);
  var correctRt = u6NovRuntime_({ fixture: correctFixture.fixture,
    repository: correctFixture.runtime.repository });
  var correctRes = salesRecognitionV2CorrectWithRuntime_(
    { requestKey: "u7-correct-1", orderID: correctFixture.orderID,
      reason: "u7 routing correct", orderType: "TAKE_AWAY",
      lines: [{ productID: "P1", productVariantID: "PV1", qty: 3 }] }, correctRt);
  check("R2a", correctRes.status === "DONE" && correctRes.requestKey === "u7-correct-1" &&
    correctRt.repository.rows().filter(function(op) {
      return op.OperationType === "SALES_V2_CORRECT"; }).length === 1 &&
    sheetText(correctFixture.fixture, ["Payments", "Settlements", "InventoryLedger",
      "tabsal", "tabops", "Logs"]) === sheetText(correctFixture.fixture,
      ["Payments", "Settlements", "InventoryLedger", "tabsal", "tabops", "Logs"]),
    JSON.stringify(correctRes));
  check("R2b", typeof salesRecognitionV2DurableCorrect === "function" &&
    typeof salesRecognitionV2DurableVoid === "function");

  // T13: legacy Correct/Void never route to V2; V2 identities never reach the
  // legacy writer (legacy rejects with zero writes).
  var legacyVoid = u4RunWithFixture_(v2Fixture.fixture, function() {
    return voidCanonicalTransaction({ transactionId: "ORDER:" + v2Fixture.orderID,
      reason: "u7 legacy route probe" });
  });
  check("R3a", legacyVoid.success === false &&
    legacyVoid.error.code === "TRANSACTION_NOT_FOUND", JSON.stringify(legacyVoid));
  var legacyCorrect = u4RunWithFixture_(correctFixture.fixture, function() {
    return correctCanonicalTransaction({ transactionId: "ORDER:" + correctFixture.orderID,
      reason: "u7 legacy route probe", productId: "P1", type: "Hot", qty: 1 });
  });
  check("R3b", legacyCorrect.success === false, JSON.stringify(legacyCorrect));
  var u6RejectsLegacy = salesRecognitionV2VoidWithRuntime_(
    { requestKey: "u7-legacy-id", orderID: "SAL-U7-1", reason: "probe" }, v2Rt);
  check("R3c", u6RejectsLegacy.status === "REFUSED" &&
    u6RejectsLegacy.code === "SALES_V2_LEGACY_IDENTITY_REJECTED" &&
    u6RejectsLegacy.writeCount === 0);
  check("R3d", voidCanonicalTransaction.toString().indexOf("salesRecognitionV2Durable") === -1 &&
    correctCanonicalTransaction.toString().indexOf("salesRecognitionV2Durable") === -1 &&
    canonicalLifecycleLedgerSpec.toString().indexOf('indexOf("SAL-")') !== -1 &&
    canonicalLifecycleLedgerSpec.toString().indexOf('indexOf("OPS-")') !== -1);

  // T14: Old Order historical servicing; cohort from persisted authority.
  var legacyFixture = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendSale_(legacyFixture, { ID_Trx: "SAL-U7-1", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 1000, HJ: 5000, Source: CANONICAL_ENTRY.SOURCE });
  u7WithConfig_(u7Config_("ACTIVE"), function() {
    var original = globalThis.SpreadsheetApp;
    globalThis.SpreadsheetApp = { getActiveSpreadsheet: function() { return legacyFixture; },
      flush: function() {} };
    try {
      var detail = getCanonicalTransactionDetail("SAL-U7-1");
      check("R4a", detail.success === true && detail.data.canVoid === true &&
        detail.data.salesCohort === "TABSAL_LEGACY", JSON.stringify(detail));
    } finally { globalThis.SpreadsheetApp = original; }
    // A persisted V2 order stays V2 across modes; a legacy order never becomes
    // V2 by date/current-mode alone.
    var v2Verdict = classifySalesRecognitionCohort({ OrderID: "ORD-V2-G1" },
      { operations: [{ OrderID: "ORD-V2-G1", ContractVersion: "SALES_RECOGNITION_V2",
        State: "COMMITTED" }] });
    check("R4b", v2Verdict.cohort === "V2_COMMITTED");
  });

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// OPERATOR UI source contracts (client controller boundaries): Save/RequestKey
// semantics, V2 status rendering, Correct/Void cohort routing, no fabricated
// payment method, no Paid/Unpaid/Fulfillment lifecycle for V2.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U7UiContracts() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U7_UI:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var actions = String(typeof _htmlActions === "string" ? _htmlActions : "");
  var render = String(typeof _htmlRender === "string" ? _htmlRender : "");
  var index = String(typeof _htmlIndex === "string" ? _htmlIndex : "");

  // Save flow: one RequestKey per intent, reuse while pending, Done only after
  // confirmed success, UNKNOWN keeps identity, refusal is definite only.
  check("U1a", actions.indexOf(
    'pending = operationalTransactionState.pending = { type: "ORDER_CREATE", requestKey: operationalRequestKey_') !== -1 &&
    actions.indexOf("requestKey: pending.requestKey") !== -1 &&
    actions.indexOf('pending.state = "CONFIRMED"; operationalTransactionState.pending = null') !== -1);
  var callIndex = actions.indexOf("function operationalServerCall(");
  var callRegion = actions.slice(callIndex, actions.indexOf("function saveOperationalOrder()"));
  check("U1b", callRegion.indexOf("response.unknown === true") !== -1 &&
    callRegion.indexOf("response.unknown === true") < callRegion.indexOf("response.success !== true") &&
    callRegion.indexOf("onUnknown()") !== -1, "unknown classified before refusal");
  check("U1c", actions.indexOf("jangan membuat transaksi baru") !== -1 &&
    actions.indexOf('result.operation.State === "COMMITTED"') !== -1);
  // Done only after a confirmed durable success: the UNKNOWN path never clears
  // the pending identity and never reaches the Done transition.
  var unknownIndex = actions.indexOf("function operationalUnknown_");
  var unknownRegion = actions.slice(unknownIndex, actions.indexOf("function addSelectedSalesOrderLine"));
  check("U1d", unknownRegion.indexOf("pending.state") !== -1 &&
    unknownRegion.indexOf("operationalTransactionState.pending = null") === -1 &&
    unknownRegion.indexOf("reconcileOperationalUnknown") !== -1);
  // Line edits are locked while the same intent is durable-pending.
  var addIndex = actions.indexOf("function addSelectedSalesOrderLine");
  var addRegion = actions.slice(addIndex, actions.indexOf("function removeOperationalOrderLine"));
  check("U1e", addRegion.indexOf("operationalTransactionState.pending") !== -1 &&
    addRegion.indexOf("operationalTransactionState.pending") < addRegion.indexOf("operationalTransactionState.lines.push"));
  check("U1f", index.indexOf('id="operationalPaymentFields"') !== -1 &&
    actions.indexOf('operationalServerCall("submitOperationalPayment"') !== -1 &&
    actions.indexOf('operationalServerCall("submitOperationalFulfillment"') !== -1);

  // V2 status rendering: recognition semantics only; no payment lifecycle, no
  // fabricated payment method, no Receive Via on the V2 path.
  var v2StatusIndex = actions.indexOf("function renderOperationalOrderStatus");
  var v2StatusRegion = actions.slice(v2StatusIndex, actions.indexOf("function confirmOperationalPayment"));
  var v2Branch = v2StatusRegion.slice(0, v2StatusRegion.indexOf("return;"));
  check("U2a", v2StatusRegion.indexOf("salesV2OperatorVisibleOrder_(order)") !== -1 &&
    v2Branch.indexOf("Recognized") !== -1 && v2Branch.indexOf("PaymentStatus") === -1 &&
    v2Branch.indexOf("FulfillmentStatus") === -1 && v2Branch.indexOf("Receive Via") === -1,
    v2Branch);
  var showIndex = actions.indexOf("function showOperationalOrder");
  var showRegion = actions.slice(showIndex, actions.indexOf("function loadOperationalOrder"));
  check("U2b", showRegion.indexOf('operationalElement("operationalPaymentFields").hidden = true') !== -1 &&
    showRegion.indexOf("salesV2OperatorVisibleOrder_(order)") !== -1);
  var responseSource = salesV2OperatorSaveResponse_.toString();
  check("U2c", responseSource.indexOf("ReceiveVia") === -1 &&
    responseSource.indexOf("paymentMethod") === -1 &&
    responseSource.indexOf('"CASH"') === -1 &&
    responseSource.indexOf("recognitionStatus") !== -1);

  // Correct/Void cohort routing: V2 region binds only to U6 entrypoints and
  // runs before the legacy handlers; legacy handlers stay intact.
  var v2Start = actions.indexOf("var salesV2MutationState");
  var v2End = actions.indexOf("function loadTransactionForMutation(transactionId, mode)");
  check("U3a", v2Start !== -1 && v2End > v2Start, "V2 mutation block present");
  var v2Region = actions.slice(v2Start, v2End);
  check("U3b", v2Region.indexOf('"salesRecognitionV2DurableCorrect"') !== -1 &&
    v2Region.indexOf('"salesRecognitionV2DurableVoid"') !== -1 &&
    v2Region.indexOf("correctCanonicalTransaction") === -1 &&
    v2Region.indexOf("voidCanonicalTransaction") === -1 &&
    v2Region.indexOf("submitOperationalPayment") === -1 &&
    v2Region.indexOf("submitOperationalFulfillment") === -1, "U6 only");
  var loadRegion = actions.slice(v2End, actions.indexOf("function openTransactionLifecycleDialog(mode)"));
  check("U3c", loadRegion.indexOf("isSalesV2MutationTarget_(detail)") !== -1 &&
    loadRegion.indexOf("isSalesV2MutationTarget_(detail)") <
      loadRegion.indexOf("openTransactionCorrection(detail)") &&
    loadRegion.indexOf("openSalesV2MutationDialog(detail, mode)") !== -1);
  var submitV2Index = actions.indexOf("function submitSalesV2Mutation()");
  var submitV2Region = actions.slice(submitV2Index, actions.indexOf("function salesV2MutationUnknown_"));
  check("U3d", submitV2Region.indexOf('if (response.status === "DONE")') !== -1 &&
    submitV2Region.indexOf("salesV2MutationOutcomeSuccess_") >
      submitV2Region.indexOf('if (response.status === "DONE")') &&
    submitV2Region.indexOf('salesV2MutationState.mode === "correct" ? "salesRecognitionV2DurableCorrect" : "salesRecognitionV2DurableVoid"') !== -1,
    "Done only after confirmed status");
  var unknownV2Region = actions.slice(actions.indexOf("function salesV2MutationUnknown_"),
    actions.indexOf("function reconcileSalesV2Mutation()"));
  check("U3e", unknownV2Region.indexOf("persistSalesV2MutationRecovery_()") !== -1 &&
    unknownV2Region.indexOf("salesV2MutationState.requestKey =") === -1 &&
    unknownV2Region.indexOf("jangan membuat transaksi baru") !== -1,
    "unknown keeps the requestKey");
  check("U3f", actions.indexOf("function openTransactionCorrection(detail)") !== -1 &&
    actions.indexOf("function renderTransactionVoidConfirmation(detail)") !== -1 &&
    actions.indexOf("voidCanonicalTransaction({ transactionId:") !== -1 &&
    actions.indexOf("correctCanonicalTransaction(payload)") !== -1,
    "legacy handlers preserved");
  check("U3g", actions.indexOf("salesV2MutationReason") !== -1 &&
    actions.indexOf("function salesV2MutationValid_()") !== -1 &&
    v2Region.indexOf("reason") !== -1, "reason required per U6");

  // Row surfaces: V2 recognized rows expose Correct/Void; legacy gating intact.
  check("U4a", render.indexOf('var salesV2Row = r.transactionType === "Sales" && (r.salesCohort === "V2_COMMITTED")') !== -1 &&
    render.indexOf('(r.source === "APP_ENTRY" || salesV2Row)') !== -1);
  check("U4b", render.indexOf("transactions-row-action--correct") !== -1 &&
    render.indexOf("transactions-row-action--void") !== -1 &&
    render.indexOf("runTransactionRowAction") !== -1 &&
    render.indexOf("salesV2Row") !== -1);

  // Status/quality: V2 detail status is recognition/lineage, never payment.
  var detailSource = buildSalesRecognitionOrderDetail_.toString();
  check("U5a", detailSource.indexOf('status: voided ? "VOIDED" : "ACTIVE"') !== -1 &&
    detailSource.indexOf("canCorrect: false") !== -1);
  var detailRegion = actions.slice(actions.indexOf("function renderTransactionDetail(detail)"),
    actions.indexOf("function renderTransactionVoidConfirmation"));
  check("U5b", detailRegion.indexOf('["Status", detail.status]') !== -1 &&
    detailRegion.indexOf("paymentStatus") === -1 &&
    detailRegion.indexOf("fulfillmentStatus") === -1 &&
    detailRegion.indexOf("PaymentStatus") === -1,
    "detail renders recognition status only");

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// 28-item source audit: every item maps to a concrete source/fixture check.
// ---------------------------------------------------------------------------
function testSalesRecognitionV2U7SourceAudit() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U7_AUDIT:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var actions = String(typeof _htmlActions === "string" ? _htmlActions : "");
  var orderSource = submitOperationalOrder.toString();
  var createSource = createDurableOperationalOrder_.toString();
  var paymentSource = createDurableOperationalPayment_.toString();
  var fulfillmentSource = transitionOperationalFulfillmentWithRepository.toString();
  var payRepoSource = payOperationalOrderWithRepository.toString();
  var dispatcherSource = submitCanonicalTransactionWithRuntime_.toString();
  var recoverySource = recoverTransactionOperationWithRuntime_.toString();
  var cashSource = buildCashPostingCandidate.toString();
  var guardSource = salesV2OperatorOrderCohort_.toString();
  var durableSaveSource = salesRecognitionV2DurableSave.toString();
  var durableMutationSource = salesRecognitionV2DurableMutation_.toString();
  var detailSource = buildSalesRecognitionOrderDetail_.toString();

  // 1 V2 flow Input->Save->Done
  check(1, actions.indexOf("function addSelectedSalesOrderLine") !== -1 &&
    actions.indexOf("function saveOperationalOrder()") !== -1 &&
    actions.indexOf('pending.state = "CONFIRMED"') !== -1);
  // 2 ProductVariantID required
  check(2, resolveOperationalProduct_.toString().indexOf("PRODUCT_VARIANT_REQUIRED") !== -1 &&
    salesRecognitionV2NormalizeSave_.toString().indexOf("productVariantID") !== -1);
  // 3 no normal V2 Payment
  check(3, paymentSource.indexOf("salesV2OperatorPaymentGuard_") !== -1 &&
    payRepoSource.indexOf("salesV2OperatorPaymentGuard_") !== -1 &&
    actions.indexOf('operationalElement("operationalPaymentFields").hidden = true') !== -1);
  // 4 no normal V2 Fulfillment
  check(4, fulfillmentSource.indexOf("salesV2OperatorFulfillmentGuard_") !== -1 &&
    actions.indexOf('operationalElement("operationalFulfillmentFields").hidden = true') !== -1);
  // 5 Save->U2 only
  check(5, dispatcherSource.indexOf("salesV2OperatorLegacySalesGuard_") !== -1 &&
    orderSource.indexOf("salesV2OperatorModeCreateOrder_") !== -1);
  // 6/7 Correct->U6 only, Void->U6 only
  check(6, actions.indexOf('"salesRecognitionV2DurableCorrect"') !== -1);
  check(7, actions.indexOf('"salesRecognitionV2DurableVoid"') !== -1);
  // 8 legacy Correct/Void legacy
  check(8, actions.indexOf("voidCanonicalTransaction({ transactionId:") !== -1 &&
    actions.indexOf("openTransactionCorrection(detail)") !== -1 &&
    voidCanonicalTransaction.toString().indexOf("salesRecognitionV2Durable") === -1);
  // 9/10 pre-V2 payment/fulfillment cohort-limited (evidence only)
  check(9, guardSource.indexOf("BusinessID") !== -1 &&
    guardSource.indexOf("CreatedAt") === -1);
  check(10, guardSource.indexOf("V2_OPERATION_TYPES") !== -1 &&
    fulfillmentSource.indexOf("salesV2OperatorFulfillmentGuard_") !== -1);
  // 11/12 V2 server payment/fulfillment fail closed
  check(11, SALES_V2_OPERATOR.PAYMENT_CODE === "SALES_V2_PAYMENT_RETIRED");
  check(12, SALES_V2_OPERATOR.FULFILLMENT_CODE === "SALES_V2_FULFILLMENT_RETIRED");
  // 13 cash posting cannot post a V2 sale
  check(13, cashSource.indexOf("salesV2OperatorCashPostBlocked_") !== -1 &&
    SALES_V2_OPERATOR.CASH_POST_CODE === "SALES_V2_NO_CASH_POST");
  // 14 recovery never reinterprets V2 as legacy
  check(14, recoverySource.indexOf("salesV2OperatorIsRecoveryOperation_") !== -1 &&
    recoverySource.indexOf("salesV2OperatorRecoverWithRuntime_") !== -1 &&
    salesV2OperatorRecoverWithRuntime_.toString().indexOf("salesRecognitionV2SaveWithRuntime_") !== -1);
  // 15 ACTIVE no legacy fallback
  check(15, salesV2OperatorModeCreateOrder_.toString().indexOf('route.mode !== "ACTIVE"') !== -1 &&
    salesV2OperatorCreateWithRuntime_.toString().indexOf('route.mode === "ACTIVE"') !== -1);
  // 16 PAUSED fail closed
  check(16, salesV2OperatorRoute_.toString().indexOf("V2_MODE_PAUSED") !== -1 &&
    salesRecognitionV2RequestGate(salesV2SavePausedConfigForAudit_()).allowed === false);
  // 17 persisted V2 recovery under PAUSED (resume paths have no mode gate)
  check(17, salesRecognitionV2SaveResume_.toString().indexOf("salesRecognitionV2RequestGate") === -1 &&
    salesRecognitionV2MutationResume_.toString().indexOf("salesRecognitionV2RequestGate") === -1);
  // 18 PREPARED production inactive for V2, no T
  check(18, SALES_RECOGNITION_V2_CONTRACT.DEFAULT_CONFIG.mode === "PREPARED" &&
    SALES_RECOGNITION_V2_CONTRACT.DEFAULT_CONFIG.activationID === "" &&
    SALES_RECOGNITION_V2_CONTRACT.DEFAULT_CONFIG.activatedAt === "");
  // 19 UNKNOWN retains RequestKey
  check(19, salesV2OperatorSaveResponse_.toString().indexOf("unknown: true") !== -1 &&
    actions.indexOf("jangan membuat transaksi baru") !== -1);
  // 20 Done requires confirmed durable success
  check(20, actions.indexOf('if (response.status === "DONE")') !== -1 &&
    actions.indexOf('pending.state = "CONFIRMED"; operationalTransactionState.pending = null') !== -1);
  // 21 duplicate click one effect (server idempotency authoritative)
  check(21, salesRecognitionV2SaveWithRuntime_.toString().indexOf("salesRecognitionV2SaveResume_") !== -1 &&
    actions.indexOf("if (operationalTransactionState.inFlight.order) return;") !== -1);
  // 22 client total not authority
  check(22, salesRecognitionV2NormalizeSave_.toString().indexOf("orderTotal") === -1 &&
    actions.indexOf("state.pricing.price") !== -1);
  // 23 no fabricated payment method
  check(23, salesV2OperatorSaveResponse_.toString().indexOf("ReceiveVia") === -1 &&
    salesV2OperatorSaveResponse_.toString().indexOf("paymentMethod") === -1);
  // 24 U4 statuses: recognition status, not payment lifecycle
  check(24, detailSource.indexOf('status: voided ? "VOIDED" : "ACTIVE"') !== -1 &&
    detailSource.indexOf("paymentStatus: header.paymentStatus") !== -1);
  // 25 no production T / ActivationID written by U7
  var u7Sources = salesV2OperatorConfigState_.toString() +
    salesRecognitionV2OperatorConfig.toString() + salesV2OperatorResolvedRoute_.toString();
  check(25, u7Sources.indexOf("setProperty") === -1 &&
    u7Sources.indexOf("activatedAt =") === -1 && u7Sources.indexOf("activationID =") === -1);
  // 26 no Treasury surface
  var auditText = requireU7AuditText_();
  check(26, auditText.indexOf("Treasury") === -1 && auditText.indexOf("2010") === -1 &&
    auditText.indexOf("Cash-Bank") === -1);
  // 27 V2 PREPARED/disabled by default
  check(27, salesRecognitionV2RequestGate(salesRecognitionV2DefaultConfig()).allowed === false &&
    salesRecognitionV2RequestGate(salesRecognitionV2DefaultConfig()).code === "V2_NOT_ACTIVATED");
  // 28 no U8+ scope
  check(28, auditText.indexOf("U8") === -1 && auditText.indexOf("U9") === -1);

  return { total: pass, pass: pass, fail: 0 };
}

// Config helper for audit item 16 (PAUSED config requires activation fields).
function salesV2SavePausedConfigForAudit_() {
  return u7Config_("PAUSED");
}

// Concatenated U7 production sources for text-level audit items 26 and 28.
function requireU7AuditText_() {
  return [
    salesV2OperatorConfigState_.toString(),
    salesRecognitionV2OperatorConfig.toString(),
    salesV2OperatorRoute_.toString(),
    salesV2OperatorResolvedRoute_.toString(),
    salesV2OperatorOrderCohort_.toString(),
    salesV2OperatorSaveResponse_.toString(),
    salesV2OperatorModeCreateOrder_.toString(),
    salesV2OperatorCreateWithRuntime_.toString(),
    salesV2OperatorLegacySalesGuard_.toString(),
    salesV2OperatorPaymentGuard_.toString(),
    salesV2OperatorFulfillmentGuard_.toString(),
    salesV2OperatorCashPostBlocked_.toString(),
    salesV2OperatorRecoverWithRuntime_.toString(),
    salesV2OperatorAnnotateOrder_.toString(),
    submitOperationalOrder.toString(),
    createDurableOperationalPayment_.toString(),
    transitionOperationalFulfillmentWithRepository.toString()
  ].join("\n");
}
