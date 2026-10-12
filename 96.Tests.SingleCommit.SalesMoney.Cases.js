// T11.3 U1 — Sales composed money leg (SINGLE_COMMIT_TRANSACTION_V1 gated).
// Focused local suites over the injected runtime: config gate + inert parity,
// 1040 preflight matrix, one-plan/one-batch composition, durability
// (replay/conflict/UNKNOWN/crash/tamper), and isolation audits (Treasury,
// payment fields, digest coverage, correction lineage). Fixtures only — no
// production access, no clasp, no config writes, no PropertiesService.

function t11Runtime_(options) {
  options = options || {};
  var runtime = salesV2SaveRuntime_(options);
  if (Object.prototype.hasOwnProperty.call(options, "singleCommitConfig")) {
    runtime.singleCommitConfig = options.singleCommitConfig;
  }
  return runtime;
}

function t11ConfigRaw_(mode) {
  mode = mode === undefined ? "ACTIVE" : mode;
  var config = { mode: mode, contractVersion: "SINGLE_COMMIT_TRANSACTION_V1",
    activationID: "", activatedAt: "", configVersion: 1 };
  // U5 schema: ACTIVE/PAUSED always carry the server activation identity;
  // PREPARED/REJECT persist blank identity (sticky intent = identity present).
  if (mode === "ACTIVE" || mode === "PAUSED") {
    config.activationID = "ACT-U5-" + mode;
    config.activatedAt = "2026-10-07T00:00:00.000Z";
  }
  return JSON.stringify(config);
}

function t11Account1040_(overrides) {
  return Object.assign({ AccountCode: "1040", AccountName: "Operational Funds",
    AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating",
    IsActive: true, CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" }, overrides || {});
}

function t11PushAccount_(sheets, row) {
  var headers = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  sheets.Accounts.push(headers.map(function(header) {
    return row[header] === undefined ? "" : row[header];
  }));
}

function t11Sheets1040_(mutate) {
  var sheets = salesV2SaveBaseSheets_();
  t11PushAccount_(sheets, t11Account1040_());
  if (mutate) mutate(sheets);
  return sheets;
}

function t11Snapshot_(fixture) {
  var names = SALES_RECOGNITION_V2_SAVE.WRITE_SURFACES
    .concat(["TransactionOperations", "Accounts"]);
  var out = {};
  names.forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    out[name] = sheet ? JSON.stringify(sheet.values) : null;
  });
  return JSON.stringify(out);
}

function t11Ledger_(fixture) {
  return readCanonicalTable(fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
}

function t11PlanOf_(repository) {
  return JSON.parse(repository.rows()[0].OperationPlan);
}

// Strip plan-digest + money context so an inert plan and a composed plan for
// the SAME intent can be compared for byte-identical recognition content.
function t11StripPlan_(plan) {
  var copy = JSON.parse(JSON.stringify(plan));
  delete copy.planDigest;
  delete copy.composedMoney;
  delete copy.moneyJournalID;
  delete copy.moneyRows;
  delete copy.moneyJournalSignature;
  if (copy.accounts) delete copy.accounts.money;
  return JSON.stringify(copy);
}

// ---------------------------------------------------------------------------
// Config gate + inert parity (A): absent/PREPARED/invalid behavior matrix.
// ---------------------------------------------------------------------------
function testSalesComposedMoneyGateInert() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("T11_3_U1_GATE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, sc = SINGLE_COMMIT_TRANSACTION_V1;

  // G1: config absent -> current Sales V2 exactly (recognition only).
  var rtG1 = t11Runtime_();
  var resG1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-g1"), rtG1);
  var planG1 = t11PlanOf_(rtG1.repository);
  check("G1a", resG1.status === "DONE" && resG1.writeCount === 7, JSON.stringify(resG1));
  check("G1b", planG1.composedMoney === undefined && planG1.moneyRows === undefined &&
    planG1.moneyJournalID === undefined && planG1.accounts.money === undefined);
  check("G1c", JSON.stringify(rtG1.events.batches[0].map(function(r) {
      return r.values.length; })) === JSON.stringify([1, 2, 1, 2, 1]) &&
    t11Ledger_(rtG1.spreadsheet).length === 2 &&
    save.WRITE_SURFACES.length === 5);

  // G2: explicit PREPARED raw value -> byte-identical plan to the absent run.
  var rtG2 = t11Runtime_({ singleCommitConfig: t11ConfigRaw_("PREPARED") });
  var resG2 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-g1"), rtG2);
  check("G2a", resG2.status === "DONE" && resG2.writeCount === 7);
  check("G2b", t11StripPlan_(t11PlanOf_(rtG2.repository)) === t11StripPlan_(planG1));

  // G3: explicit null raw -> ABSENT semantics.
  var rtG3 = t11Runtime_({ singleCommitConfig: null });
  var resG3 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-g3"), rtG3);
  check("G3a", resG3.status === "DONE" && resG3.writeCount === 7);
  check("G3b", t11PlanOf_(rtG3.repository).composedMoney === undefined);

  // G4-G8: PAUSED / invalid / REJECT / bad version / unknown mode refuse the
  // NEW intent fail-closed with zero writes of any kind.
  [{ raw: t11ConfigRaw_("PAUSED"), code: sc.CODES.SINGLE_COMMIT_MODE_PAUSED, id: "G4" },
   { raw: "{not-json", code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "G5" },
   { raw: t11ConfigRaw_("REJECT"), code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "G6" },
   { raw: JSON.stringify({ mode: "ACTIVE", configVersion: 0 }),
     code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "G7" },
   { raw: JSON.stringify({ mode: "READY", configVersion: 1 }),
     code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "G8" }
  ].forEach(function(scen) {
    var fixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
    var before = t11Snapshot_(fixture);
    var runtime = t11Runtime_({ fixture: fixture, singleCommitConfig: scen.raw });
    var result = salesRecognitionV2SaveWithRuntime_(
      salesV2SavePayload_("t11-" + scen.id.toLowerCase()), runtime);
    check(scen.id, result.status === "REFUSED" && result.code === scen.code &&
      runtime.repository.rows().length === 0 && runtime.events.batches.length === 0 &&
      runtime.events.authorityReads === 0 && t11Snapshot_(fixture) === before,
      JSON.stringify(result));
  });

  // G9: pure parser state matrix (versioned, fail-closed-when-invalid).
  check("G9a", singleCommitTransactionConfigState_(null).state === "ABSENT" &&
    singleCommitTransactionConfigState_(undefined).state === "ABSENT" &&
    singleCommitTransactionConfigState_("").state === "ABSENT");
  check("G9b", singleCommitTransactionConfigState_(t11ConfigRaw_("ACTIVE")).state === "VALID" &&
    singleCommitTransactionConfigState_(t11ConfigRaw_("ACTIVE")).mode === "ACTIVE" &&
    singleCommitTransactionConfigState_(JSON.parse(t11ConfigRaw_("PAUSED"))).state === "VALID" &&
    singleCommitTransactionConfigState_(t11ConfigRaw_("PAUSED")).config.activationID !== "");
  check("G9c", singleCommitTransactionConfigState_("{oops").state === "UNRESOLVED" &&
    singleCommitTransactionConfigState_(JSON.stringify({ configVersion: 1 })).state === "UNRESOLVED" &&
    singleCommitTransactionConfigState_(JSON.stringify({ mode: "ACTIVE" })).state === "UNRESOLVED" &&
    singleCommitTransactionConfigState_(JSON.stringify({ mode: "ACTIVE", configVersion: "1" }))
      .state === "UNRESOLVED");

  // G10: pure gate decision matrix (inert/active/paused/reject).
  var gateAbs = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_(null));
  var gatePrepared = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_(t11ConfigRaw_("PREPARED")));
  var gateActive = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_(t11ConfigRaw_("ACTIVE")));
  var gatePaused = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_(t11ConfigRaw_("PAUSED")));
  var gateReject = singleCommitTransactionSalesGate_(
    singleCommitTransactionConfigState_("{bad"));
  check("G10a", gateAbs.allowed === true && gateAbs.composedMoney === false &&
    gatePrepared.allowed === true && gatePrepared.composedMoney === false);
  check("G10b", gateActive.allowed === true && gateActive.composedMoney === true);
  check("G10c", gatePaused.allowed === false &&
    gatePaused.code === sc.CODES.SINGLE_COMMIT_MODE_PAUSED &&
    gateReject.allowed === false && gateReject.code === sc.CODES.SINGLE_COMMIT_CONFIG_INVALID);

  // G11: Sales V2 activation state stays authoritative for V2 routing — a
  // PREPARED V2 config refuses BEFORE the composed-money mode is consulted
  // (never overload one activation state to mean the other).
  var rtG11 = t11Runtime_({ config: salesRecognitionV2DefaultConfig(),
    singleCommitConfig: t11ConfigRaw_("ACTIVE") });
  var snapG11 = t11Snapshot_(rtG11.spreadsheet);
  var resG11 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-g11"), rtG11);
  check("G11", resG11.status === "REFUSED" && resG11.code === "V2_NOT_ACTIVATED" &&
    rtG11.repository.rows().length === 0 && rtG11.events.batches.length === 0 &&
    t11Snapshot_(rtG11.spreadsheet) === snapG11, JSON.stringify(resG11));

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// 1040 precondition (frozen §11): ACTIVE refuses CLOSED before any business
// mutation when 1040 is missing/duplicate/inactive/inconsistent. No fallback.
// ---------------------------------------------------------------------------
function testSalesComposedMoneyPreflight1040() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("T11_3_U1_PREFLIGHT:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var codes = SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES;

  function runScenario(id, sheets) {
    var fixture = salesV2SaveFixture_(sheets);
    var before = t11Snapshot_(fixture);
    var runtime = t11Runtime_({ fixture: fixture, singleCommitConfig: t11ConfigRaw_() });
    var result = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-p-" + id),
      runtime);
    return { result: result, runtime: runtime, before: before, after: t11Snapshot_(fixture) };
  }

  // P1: 1040 absent -> REFUSED before any write.
  var p1 = runScenario("missing", salesV2SaveBaseSheets_());
  check("P1", p1.result.status === "REFUSED" &&
    p1.result.code === codes.ACCOUNT_ABSENT && p1.result.field === "1040" &&
    p1.result.detail === "MONEY_ACCOUNT_PREFLIGHT_FAILED" &&
    p1.runtime.repository.rows().length === 0 && p1.runtime.events.batches.length === 0 &&
    p1.runtime.events.authorityReads === 0 && p1.before === p1.after, JSON.stringify(p1.result));

  // P2: duplicate 1040 -> REFUSED.
  var p2 = runScenario("dup", t11Sheets1040_(function(sheets) {
    t11PushAccount_(sheets, t11Account1040_());
  }));
  check("P2", p2.result.status === "REFUSED" &&
    p2.result.code === codes.ACCOUNT_DUPLICATE &&
    p2.runtime.repository.rows().length === 0 && p2.runtime.events.batches.length === 0 &&
    p2.before === p2.after, JSON.stringify(p2.result));

  // P3: inactive 1040 -> REFUSED.
  var p3 = runScenario("inactive", t11Sheets1040_(function(sheets) {
    sheets.Accounts[sheets.Accounts.length - 1][
      CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("IsActive")] = false;
  }));
  check("P3", p3.result.status === "REFUSED" &&
    p3.result.code === codes.ACCOUNT_INACTIVE &&
    p3.runtime.repository.rows().length === 0 && p3.before === p3.after,
    JSON.stringify(p3.result));

  // P4: wrong AccountType -> REFUSED (metadata must match the frozen row).
  var p4 = runScenario("type", t11Sheets1040_(function(sheets) {
    sheets.Accounts[sheets.Accounts.length - 1][
      CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("AccountType")] = "Liability";
  }));
  check("P4", p4.result.status === "REFUSED" &&
    p4.result.code === codes.ACCOUNT_METADATA_MISMATCH &&
    p4.runtime.repository.rows().length === 0 && p4.before === p4.after,
    JSON.stringify(p4.result));

  // P5: wrong NormalBalance -> REFUSED.
  var p5 = runScenario("balance", t11Sheets1040_(function(sheets) {
    sheets.Accounts[sheets.Accounts.length - 1][
      CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("NormalBalance")] = "CREDIT";
  }));
  check("P5", p5.result.status === "REFUSED" &&
    p5.result.code === codes.ACCOUNT_METADATA_MISMATCH &&
    p5.runtime.repository.rows().length === 0 && p5.before === p5.after,
    JSON.stringify(p5.result));

  // P6: exact valid 1040 -> composed save proceeds (details in PlanBatch).
  var p6 = runScenario("valid", t11Sheets1040_());
  check("P6", p6.result.status === "DONE" && p6.result.writeCount === 9 &&
    p6.runtime.events.batches.length === 1, JSON.stringify(p6.result));

  // P7: pure preflight unit matrix (zero-write, exact-match).
  var validRow = t11Account1040_();
  check("P7a", preflightSingleCommitMoneyAccount([validRow]).status === "PASS");
  check("P7b", preflightSingleCommitMoneyAccount([]).status === "FAIL" &&
    preflightSingleCommitMoneyAccount([]).errors[0].code === codes.ACCOUNT_ABSENT &&
    preflightSingleCommitMoneyAccount("not-an-array").status === "FAIL");
  check("P7c", preflightSingleCommitMoneyAccount([validRow, null]).status === "FAIL" &&
    preflightSingleCommitMoneyAccount([validRow, null]).errors[0].code ===
      codes.ACCOUNT_ROW_INVALID);
  var blankBalance = t11Account1040_({ NormalBalance: "" });
  check("P7d", preflightSingleCommitMoneyAccount([blankBalance]).status === "FAIL" &&
    preflightSingleCommitMoneyAccount([blankBalance]).errors[0].code ===
      codes.ACCOUNT_METADATA_MISMATCH);

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// One immutable plan + ONE atomic batch: recognition byte-identical, money
// pair exact, net Dr1040/Cr4000, per-Sale 1030 net zero, Revenue unchanged.
// ---------------------------------------------------------------------------
function testSalesComposedMoneyPlanBatch() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("T11_3_U1_PLAN:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, contract = SALES_RECOGNITION_V2_CONTRACT,
    policy = SINGLE_COMMIT_MONEY_POLICY, ledgerHeaders =
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var key = "t11-money-1";

  // Inert baseline and composed save for the SAME intent on separate fixtures.
  var inertRt = t11Runtime_();
  var inertRes = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(key), inertRt);
  var inertPlan = t11PlanOf_(inertRt.repository);

  var compFixture = salesV2SaveFixture_(t11Sheets1040_());
  var compRt = t11Runtime_({ fixture: compFixture, singleCommitConfig: t11ConfigRaw_() });
  var compRes = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(key), compRt);
  var compPlan = t11PlanOf_(compRt.repository);
  var ledger = t11Ledger_(compFixture);

  // M1: one durable operation, DONE, +2 ledger rows (writeCount 7 -> 9).
  check("M1a", inertRes.status === "DONE" && inertRes.writeCount === 7 &&
    compRes.status === "DONE" && compRes.writeCount === 9 &&
    compRt.repository.rows().length === 1, JSON.stringify(compRes));
  check("M1b", compRes.orderID === inertRes.orderID &&
    compRes.recognitionID === inertRes.recognitionID &&
    compRes.journalID === inertRes.journalID && compRes.auditID === inertRes.auditID);

  // M2: ONE atomic batch, same five surfaces, BalanceLedger carries 4 rows.
  check("M2a", compRt.events.batches.length === 1 &&
    JSON.stringify(compRt.events.batches[0].map(function(r) { return r.range; })) ===
      JSON.stringify(save.WRITE_SURFACES) &&
    JSON.stringify(compRt.events.batches[0].map(function(r) { return r.values.length; })) ===
      JSON.stringify([1, 2, 1, 4, 1]));
  var ledgerValues = compRt.events.batches[0][3].values;
  check("M2b", String(ledgerValues[0][0]).indexOf("SRV2J-") === 0 &&
    String(ledgerValues[2][0]).indexOf(policy.SALES_MONEY_JOURNAL_PREFIX) === 0,
    JSON.stringify(ledgerValues.map(function(row) { return row[0]; })));

  // M3: plan carries the frozen money context + verifies.
  check("M3a", compPlan.composedMoney === true &&
    compPlan.moneyJournalID === transactionStableBootstrapId_(
      policy.SALES_MONEY_JOURNAL_PREFIX, [compPlan.orderID]) &&
    String(compPlan.moneyJournalID).indexOf(policy.SALES_MONEY_JOURNAL_PREFIX) === 0 &&
    Array.isArray(compPlan.moneyRows) && compPlan.moneyRows.length === 2 &&
    typeof compPlan.moneyJournalSignature === "string" &&
    compPlan.moneyJournalSignature.length > 0 && compPlan.accounts.money === "1040");
  check("M3b", salesRecognitionV2SaveVerifyPlan_(compPlan).ok === true &&
    salesRecognitionV2SaveVerifyPlan_(inertPlan).ok === true);

  // M4: composed pair exact (Dr1040 / Cr1030, identities + signature).
  var m0 = compPlan.moneyRows[0], m1 = compPlan.moneyRows[1];
  check("M4a", m0.AccountCode === "1040" && Number(m0.Debit) === 60000 &&
    Number(m0.Credit) === 0 && m1.AccountCode === "1030" &&
    Number(m1.Debit) === 0 && Number(m1.Credit) === 60000);
  check("M4b", m0.JournalID === compPlan.moneyJournalID &&
    m1.JournalID === compPlan.moneyJournalID &&
    m0.LineID === compPlan.moneyJournalID + "-1" &&
    m1.LineID === compPlan.moneyJournalID + "-2" &&
    m0.SourceType === policy.SALES_MONEY_SOURCE_TYPE &&
    m1.SourceType === policy.SALES_MONEY_SOURCE_TYPE &&
    m0.MovementType === policy.SALES_MONEY_MOVEMENT_TYPE &&
    m1.MovementType === policy.SALES_MONEY_MOVEMENT_TYPE &&
    m0.SourceID === compPlan.recognitionID && m1.SourceID === compPlan.recognitionID &&
    m0.Tanggal === compPlan.economicDate && m1.Tanggal === compPlan.economicDate);
  check("M4c", policyCJournalSignature_(compPlan.moneyRows) ===
    compPlan.moneyJournalSignature);

  // M5: recognition artifacts byte-identical (semantic content unchanged).
  check("M5a", JSON.stringify(compPlan.journalRows) === JSON.stringify(inertPlan.journalRows) &&
    JSON.stringify(compPlan.eventRow) === JSON.stringify(inertPlan.eventRow) &&
    JSON.stringify(compPlan.auditRow) === JSON.stringify(inertPlan.auditRow));
  check("M5b", JSON.stringify(compPlan.orderRow) === JSON.stringify(inertPlan.orderRow) &&
    JSON.stringify(compPlan.lineRows) === JSON.stringify(inertPlan.lineRows) &&
    JSON.stringify(compPlan.lineAuthority) === JSON.stringify(inertPlan.lineAuthority));

  // M6: stripping money context + digest leaves byte-identical plans — the
  // ONLY plan delta is the composed-money representation.
  check("M6", t11StripPlan_(compPlan) === t11StripPlan_(inertPlan));

  // M7: net normal Sale = Dr1040 / Cr4000 (derived, never a third journal).
  var net = {};
  ledger.forEach(function(row) {
    var code = String(row.AccountCode);
    net[code] = (net[code] || 0) + Number(row.Debit) - Number(row.Credit);
  });
  check("M7", Number(net["1040"]) === 60000 && Number(net["4000"]) === -60000 &&
    Number(net["1030"] || 0) === 0, JSON.stringify(net));

  // M8: per-Sale 1030 net zero across recognition + money artifacts.
  var net1030 = 0;
  ledger.forEach(function(row) {
    if (String(row.AccountCode) === "1030") {
      net1030 += Number(row.Debit) - Number(row.Credit);
    }
  });
  check("M8", net1030 === 0);

  // M9: existing Sales RequestKey remains the sole operator intent key.
  var opRow = compRt.repository.rows()[0];
  var normalized = salesRecognitionV2NormalizeSave_(salesV2SavePayload_(key));
  check("M9", opRow.OperationType === save.OPERATION_TYPE &&
    opRow.RequestKey === key && opRow.BusinessID === compPlan.orderID &&
    compPlan.requestKey === key && compPlan.payloadHash === transactionPayloadHash_(normalized) &&
    opRow.PayloadHash === compPlan.payloadHash &&
    compRt.repository.rows().filter(function(row) { return row.RequestKey === key; }).length === 1);

  // M10: U3 Revenue unchanged — identical events, identical projection totals
  // (operations mirrored into the sheet evidence surface, U3 reader contract).
  var inertEvents = readCanonicalTable(inertRt.spreadsheet, "SalesRecognitionEvents",
    contract.HEADERS);
  var compEvents = readCanonicalTable(compFixture, "SalesRecognitionEvents", contract.HEADERS);
  check("M10a", JSON.stringify(compEvents) === JSON.stringify(inertEvents) &&
    compEvents.length === 1 && Number(compEvents[0].Amount) === 60000);
  u3MirrorOperations_(inertRt.spreadsheet, inertRt.repository);
  u3MirrorOperations_(compFixture, compRt.repository);
  var inertProjection = buildRecognizedSalesProjectionFromSpreadsheet_(inertRt.spreadsheet);
  var compProjection = buildRecognizedSalesProjectionFromSpreadsheet_(compFixture);
  check("M10b", compProjection.totals.recognizedRevenue ===
      inertProjection.totals.recognizedRevenue &&
    compProjection.totals.recognizedRevenue === 60000 &&
    compProjection.totals.ledgerRevenueCredits === inertProjection.totals.ledgerRevenueCredits &&
    compProjection.totals.ledgerRevenueCredits === 60000,
    JSON.stringify({ inert: inertProjection.totals, composed: compProjection.totals }));
  check("M10c", JSON.stringify(compProjection.events) ===
    JSON.stringify(inertProjection.events) &&
    compProjection.activeView.totals.recognizedRevenue ===
      inertProjection.activeView.totals.recognizedRevenue &&
    compProjection.activeView.totals.recognizedRevenue === 60000);

  // M11: recognition event/audit linkage preserved (signature over the
  // recognition pair only — money never enters the U3 signature contract).
  check("M11", compEvents[0].RecognitionJournalID === inertEvents[0].RecognitionJournalID &&
    compEvents[0].JournalSignature === inertEvents[0].JournalSignature &&
    compEvents[0].JournalSignature === compPlan.journalSignature &&
    compPlan.journalSignature === policyCJournalSignature_(compPlan.journalRows));

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// RequestKey replay/conflict, UNKNOWN + crash recovery from the frozen plan,
// tamper fail-closed, sticky recovery independent of current config.
// ---------------------------------------------------------------------------
function testSalesComposedMoneyDurability() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("T11_3_U1_DURABILITY:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, ledgerHeaders =
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;

  function composedFixtureRuntime_(key, extra) {
    var options = Object.assign({ fixture: salesV2SaveFixture_(t11Sheets1040_()),
      singleCommitConfig: t11ConfigRaw_() }, extra || {});
    return t11Runtime_(options);
  }
  // Frozen composed plan with NO artifacts yet (intent persisted, crash before
  // batch) — the tamper target for plan-integrity checks.
  function pendingComposed_(key) {
    var runtime = composedFixtureRuntime_(key, { crash: "V2_AFTER_INTENT" });
    try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(key), runtime); }
    catch (error) { /* expected crash */ }
    return runtime;
  }
  // Resume never re-gates: run WITHOUT the single-commit config on purpose.
  function resume_(runtime, key) {
    return salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_(key),
      t11Runtime_({ fixture: runtime.spreadsheet, repository: runtime.repository }));
  }

  // D1: exact replay of a committed composed sale -> zero new rows.
  var rtD1 = composedFixtureRuntime_("t11-d1");
  var firstD1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d1"), rtD1);
  var countsD1 = t11Snapshot_(rtD1.spreadsheet);
  var replayRt = t11Runtime_({ fixture: rtD1.spreadsheet, repository: rtD1.repository });
  var replayD1 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d1"), replayRt);
  check("D1a", firstD1.status === "DONE" && replayD1.status === "DONE" &&
    replayD1.replay === true && replayD1.writeCount === 0, JSON.stringify(replayD1));
  check("D1b", t11Snapshot_(rtD1.spreadsheet) === countsD1 &&
    rtD1.repository.rows().length === 1 && replayRt.events.batches.length === 0 &&
    replayRt.events.authorityReads === 0);

  // D2: same key, different payload -> deterministic CONFLICT, zero writes.
  var conflictPayload = salesV2SavePayload_("t11-d1");
  conflictPayload.lines[1].qty = 3;
  var conflictRt = t11Runtime_({ fixture: rtD1.spreadsheet, repository: rtD1.repository });
  var conflictD1 = salesRecognitionV2SaveWithRuntime_(conflictPayload, conflictRt);
  check("D2", conflictD1.status === "CONFLICT" &&
    conflictD1.code === "OPERATION_PAYLOAD_CONFLICT" && conflictD1.writeCount === 0 &&
    t11Snapshot_(rtD1.spreadsheet) === countsD1 && conflictRt.events.batches.length === 0,
    JSON.stringify(conflictD1));

  // D3: UNKNOWN BEFORE the batch -> IN_PROGRESS, zero artifacts; resume from
  // the frozen plan (no config present) completes recognition + money together.
  var rtD3 = composedFixtureRuntime_("t11-d3");
  rtD3.batch = function() { throw new Error("ETIMEDOUT"); };
  var unknownD3 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d3"), rtD3);
  check("D3a", unknownD3.status === "UNKNOWN" &&
    unknownD3.code === "BATCH_OUTCOME_UNKNOWN" && unknownD3.requestKey === "t11-d3" &&
    unknownD3.operationID !== "" && unknownD3.writeCount === "UNKNOWN" &&
    rtD3.repository.rows()[0].State === "IN_PROGRESS" &&
    rtD3.spreadsheet.getSheetByName("Orders").getLastRow() === 1 &&
    rtD3.spreadsheet.getSheetByName("BalanceLedger").getLastRow() === 1,
    JSON.stringify(unknownD3));
  var resumeD3 = t11Runtime_({ fixture: rtD3.spreadsheet, repository: rtD3.repository });
  var doneD3 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d3"), resumeD3);
  check("D3b", doneD3.status === "DONE" && doneD3.writeCount === 9 &&
    rtD3.repository.rows()[0].State === "COMMITTED" &&
    t11Ledger_(rtD3.spreadsheet).length === 4, JSON.stringify(doneD3));

  // D4: crash AFTER the batch (post-batch UNKNOWN boundary) -> resume proves
  // exact artifacts and commits without any second write.
  var rtD4 = composedFixtureRuntime_("t11-d4", { crash: "V2_AFTER_BATCH" });
  var threwD4 = null;
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d4"), rtD4); }
  catch (error) { threwD4 = error; }
  var countsD4 = t11Snapshot_(rtD4.spreadsheet);
  check("D4a", !!threwD4 && threwD4.message === "CRASH:V2_AFTER_BATCH" &&
    rtD4.repository.rows()[0].State === "IN_PROGRESS" &&
    rtD4.spreadsheet.getSheetByName("BalanceLedger").getLastRow() === 5 &&
    t11Ledger_(rtD4.spreadsheet).length === 4);
  var doneD4 = resume_(rtD4, "t11-d4");
  check("D4b", doneD4.status === "DONE" && doneD4.writeCount === 0 &&
    doneD4.replay === true && rtD4.repository.rows()[0].State === "COMMITTED" &&
    t11Snapshot_(rtD4.spreadsheet) === countsD4, JSON.stringify(doneD4));

  // D5: crash at the readback boundary -> resume commits from the plan.
  var rtD5 = composedFixtureRuntime_("t11-d5", { crash: "V2_AFTER_READBACK" });
  try { salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d5"), rtD5); }
  catch (error) { /* expected crash */ }
  var doneD5 = resume_(rtD5, "t11-d5");
  check("D5", doneD5.status === "DONE" && doneD5.replay === true &&
    rtD5.repository.rows()[0].State === "COMMITTED" &&
    t11Ledger_(rtD5.spreadsheet).length === 4, JSON.stringify(doneD5));

  // D6-D9: tampered PENDING plan money context -> fail closed, ZERO writes.
  [{ id: "D6", mutate: function(plan) { plan.moneyRows[0].Debit = 1; },
     detail: "MONEY_AMOUNT_MISMATCH" },
   { id: "D7", mutate: function(plan) { plan.moneyJournalSignature = "forged"; },
     detail: "MONEY_SIGNATURE_MISMATCH" },
   { id: "D8", mutate: function(plan) { plan.moneyRows[0].SourceType = "SALES_RECOGNITION_V2"; },
     detail: "MONEY_CLASSIFICATION_MISMATCH" },
   { id: "D9", mutate: function(plan) { plan.accounts.money = "1030"; },
     detail: "MONEY_ACCOUNT_MAPPING_MISMATCH" }
  ].forEach(function(scen) {
    var runtime = pendingComposed_("t11-" + scen.id.toLowerCase());
    var stored = runtime.repository.rows()[0];
    var plan = JSON.parse(stored.OperationPlan);
    scen.mutate(plan);
    stored.OperationPlan = JSON.stringify(plan);
    var before = t11Snapshot_(runtime.spreadsheet);
    var result = resume_(runtime, "t11-" + scen.id.toLowerCase());
    check(scen.id, result.status === "RECOVERY_REQUIRED" &&
      result.code === "IDENTITY_CONFLICT" &&
      String(result.detail).indexOf(scen.detail) !== -1 &&
      runtime.repository.rows()[0].State === "IN_PROGRESS" &&
      t11Snapshot_(runtime.spreadsheet) === before &&
      result.requestKey === "t11-" + scen.id.toLowerCase(),
      JSON.stringify({ result: result, stored: stored.State }));
  });

  // D10: T11 plan stripped of its money leg -> legacy digest never validates.
  var rtD10 = pendingComposed_("t11-d10");
  var storedD10 = rtD10.repository.rows()[0];
  var planD10 = JSON.parse(storedD10.OperationPlan);
  delete planD10.composedMoney; delete planD10.moneyJournalID;
  delete planD10.moneyRows; delete planD10.moneyJournalSignature;
  delete planD10.accounts.money;
  storedD10.OperationPlan = JSON.stringify(planD10);
  var beforeD10 = t11Snapshot_(rtD10.spreadsheet);
  var resD10 = resume_(rtD10, "t11-d10");
  check("D10", resD10.status === "RECOVERY_REQUIRED" &&
    String(resD10.detail).indexOf("PLAN_DIGEST_MISMATCH") !== -1 &&
    t11Snapshot_(rtD10.spreadsheet) === beforeD10 &&
    rtD10.repository.rows()[0].State === "IN_PROGRESS", JSON.stringify(resD10));

  // D11: legacy (recognition-only) plan injected with money fields -> fail
  // closed (never a half-transaction, never silent augmentation).
  var rtD11 = t11Runtime_();
  var legacyRes = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d11"), rtD11);
  var legacyStored = rtD11.repository.rows()[0];
  var legacyPlan = JSON.parse(legacyStored.OperationPlan);
  legacyPlan.composedMoney = true;
  legacyPlan.moneyRows = [];
  legacyStored.OperationPlan = JSON.stringify(legacyPlan);
  var beforeD11 = t11Snapshot_(rtD11.spreadsheet);
  var resD11 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d11"),
    t11Runtime_({ fixture: rtD11.spreadsheet, repository: rtD11.repository }));
  check("D11a", legacyRes.status === "DONE");
  check("D11b", resD11.status === "RECOVERY_REQUIRED" &&
    resD11.code === "PLAN_MALFORMED" &&
    String(resD11.detail).indexOf("MONEY_PLAN_INCOMPLETE") !== -1 &&
    t11Snapshot_(rtD11.spreadsheet) === beforeD11, JSON.stringify(resD11));

  // D12: legacy committed plan augmented with a WELL-FORMED money context
  // (digest not recomputed) -> integrity digest refuses before any artifact
  // interpretation; a legacy digest can never validate a T11 plan shape.
  var rtD12 = t11Runtime_();
  salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d12"), rtD12);
  var storedD12 = rtD12.repository.rows()[0];
  var planD12 = JSON.parse(storedD12.OperationPlan);
  var moneyPolicy12 = SINGLE_COMMIT_MONEY_POLICY;
  var moneyJournalID12 = transactionStableBootstrapId_(
    moneyPolicy12.SALES_MONEY_JOURNAL_PREFIX, [planD12.orderID]);
  var moneyRows12 = [
    { JournalID: moneyJournalID12, LineID: moneyJournalID12 + "-1",
      Tanggal: planD12.economicDate, AccountCode: "1040",
      Debit: planD12.orderTotal, Credit: 0,
      MovementType: moneyPolicy12.SALES_MONEY_MOVEMENT_TYPE,
      SourceType: moneyPolicy12.SALES_MONEY_SOURCE_TYPE,
      SourceID: planD12.recognitionID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: planD12.savedAt, CreatedBy: planD12.actor,
      UpdatedAt: planD12.savedAt, UpdatedBy: planD12.actor },
    { JournalID: moneyJournalID12, LineID: moneyJournalID12 + "-2",
      Tanggal: planD12.economicDate, AccountCode: "1030",
      Debit: 0, Credit: planD12.orderTotal,
      MovementType: moneyPolicy12.SALES_MONEY_MOVEMENT_TYPE,
      SourceType: moneyPolicy12.SALES_MONEY_SOURCE_TYPE,
      SourceID: planD12.recognitionID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: planD12.savedAt, CreatedBy: planD12.actor,
      UpdatedAt: planD12.savedAt, UpdatedBy: planD12.actor }
  ];
  planD12.composedMoney = true;
  planD12.moneyJournalID = moneyJournalID12;
  planD12.moneyRows = moneyRows12;
  planD12.moneyJournalSignature = policyCJournalSignature_(moneyRows12);
  planD12.accounts.money = "1040";
  storedD12.OperationPlan = JSON.stringify(planD12);
  var beforeD12 = t11Snapshot_(rtD12.spreadsheet);
  var resD12 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d12"),
    t11Runtime_({ fixture: rtD12.spreadsheet, repository: rtD12.repository }));
  check("D12", resD12.status === "RECOVERY_REQUIRED" &&
    String(resD12.detail).indexOf("PLAN_DIGEST_MISMATCH") !== -1 &&
    t11Snapshot_(rtD12.spreadsheet) === beforeD12, JSON.stringify(resD12));

  // D13: tampered COMMITTED money artifact -> IDENTITY_CONFLICT, no repair.
  var rtD13 = composedFixtureRuntime_("t11-d13");
  var doneD13 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d13"), rtD13);
  var ledgerSheetD13 = rtD13.spreadsheet.getSheetByName("BalanceLedger");
  var creditIndex = ledgerSheetD13.values[0].map(String).indexOf("Credit");
  ledgerSheetD13.values[3][creditIndex] = 1;
  var beforeD13 = t11Snapshot_(rtD13.spreadsheet);
  var resD13 = resume_(rtD13, "t11-d13");
  check("D13", doneD13.status === "DONE" && resD13.status === "RECOVERY_REQUIRED" &&
    resD13.code === "IDENTITY_CONFLICT" &&
    String(resD13.detail).indexOf("MONEY_TAMPERED") !== -1 &&
    t11Snapshot_(rtD13.spreadsheet) === beforeD13 &&
    rtD13.repository.rows()[0].State === "COMMITTED", JSON.stringify(resD13));

  // D14: money artifacts missing on a COMMITTED sale -> ARTIFACTS_INCOMPLETE
  // (recognition without money can never verify as complete).
  var rtD14 = composedFixtureRuntime_("t11-d14");
  salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d14"), rtD14);
  var ledgerSheetD14 = rtD14.spreadsheet.getSheetByName("BalanceLedger");
  ledgerSheetD14.values.pop();
  ledgerSheetD14.values.pop();
  var beforeD14 = t11Snapshot_(rtD14.spreadsheet);
  var resD14 = resume_(rtD14, "t11-d14");
  check("D14", resD14.status === "RECOVERY_REQUIRED" &&
    resD14.code === "ARTIFACTS_INCOMPLETE" &&
    String(resD14.detail).indexOf("MONEY_JOURNAL") !== -1 &&
    t11Snapshot_(rtD14.spreadsheet) === beforeD14, JSON.stringify(resD14));

  // D15: duplicate/foreign money artifact bound to this recognition ->
  // IDENTITY_CONFLICT (money exists at most once per operation identity).
  var rtD15 = composedFixtureRuntime_("t11-d15");
  var doneD15 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d15"), rtD15);
  var planD15 = t11PlanOf_(rtD15.repository);
  var ledgerSheetD15 = rtD15.spreadsheet.getSheetByName("BalanceLedger");
  var extraMoney = Object.assign({}, planD15.moneyRows[0],
    { LineID: planD15.moneyJournalID + "-X" });
  ledgerSheetD15.getRange(ledgerSheetD15.getLastRow() + 1, 1, 1, ledgerHeaders.length)
    .setValues([ledgerHeaders.map(function(header) { return extraMoney[header]; })]);
  var beforeD15 = t11Snapshot_(rtD15.spreadsheet);
  var resD15 = resume_(rtD15, "t11-d15");
  check("D15", doneD15.status === "DONE" && resD15.status === "RECOVERY_REQUIRED" &&
    resD15.code === "IDENTITY_CONFLICT" &&
    String(resD15.detail).indexOf("MONEY_DUPLICATE") !== -1 &&
    t11Snapshot_(rtD15.spreadsheet) === beforeD15, JSON.stringify(resD15));

  // D16: legacy sale + foreign money journal under its derived SRV2M identity
  // -> fail closed (recognition-only plans can never host a money leg).
  var rtD16 = t11Runtime_();
  var legacyD16 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d16"), rtD16);
  var planD16 = t11PlanOf_(rtD16.repository);
  var forgedJournal16 = transactionStableBootstrapId_(
    SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_JOURNAL_PREFIX, [planD16.orderID]);
  var ledgerSheetD16 = rtD16.spreadsheet.getSheetByName("BalanceLedger");
  var forged = Object.assign({}, planD16.journalRows[0], {
    JournalID: forgedJournal16, LineID: forgedJournal16 + "-1",
    SourceType: "SALES_MONEY_V2", SourceID: "FOREIGN-SOURCE" });
  ledgerSheetD16.getRange(ledgerSheetD16.getLastRow() + 1, 1, 1, ledgerHeaders.length)
    .setValues([ledgerHeaders.map(function(header) { return forged[header]; })]);
  var beforeD16 = t11Snapshot_(rtD16.spreadsheet);
  var resD16 = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-d16"),
    t11Runtime_({ fixture: rtD16.spreadsheet, repository: rtD16.repository }));
  check("D16", legacyD16.status === "DONE" && resD16.status === "RECOVERY_REQUIRED" &&
    resD16.code === "IDENTITY_CONFLICT" &&
    String(resD16.detail).indexOf("MONEY_LEG_UNEXPECTED") !== -1 &&
    t11Snapshot_(rtD16.spreadsheet) === beforeD16, JSON.stringify(resD16));

  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Isolation audits: no Treasury workflow, no payment/channel input, digest
// coverage, no legacy money fallback, transitional fixture untouched, reader
// and writer purity (K/H/E/correction-lineage readiness).
// ---------------------------------------------------------------------------
function testSalesComposedMoneyIsolation() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("T11_3_U1_ISOLATION:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var save = SALES_RECOGNITION_V2_SAVE, policy = SINGLE_COMMIT_MONEY_POLICY;

  var fixture = salesV2SaveFixture_(t11Sheets1040_());
  var runtime = t11Runtime_({ fixture: fixture, singleCommitConfig: t11ConfigRaw_() });
  var result = salesRecognitionV2SaveWithRuntime_(salesV2SavePayload_("t11-iso-1"), runtime);
  var plan = t11PlanOf_(runtime.repository);
  var ledger = t11Ledger_(fixture);
  var planJson = JSON.stringify(plan);

  // I1: batch/surface isolation — the five Sales surfaces only; no
  // TreasuryReceipts/Payments/Settlements/InventoryLedger artifact possible.
  check("I1a", result.status === "DONE" &&
    JSON.stringify(save.WRITE_SURFACES) === JSON.stringify(
      ["Orders", "OrderLines", "SalesRecognitionEvents", "BalanceLedger",
        "SalesRecognitionAudits"]) &&
    JSON.stringify(runtime.events.batches[0].map(function(r) { return r.range; })) ===
      JSON.stringify(save.WRITE_SURFACES));
  check("I1b", ["TreasuryReceipts", "Payments", "Settlements", "InventoryLedger",
      "TreasuryOperations", "Fulfillment"].every(function(name) {
      return !fixture.getSheetByName(name); }) &&
    save.WRITE_SURFACES.indexOf("Accounts") === -1);

  // I2: no payment/channel/evidence input or artifact anywhere in the plan.
  check("I2a", ["PaymentMethod", "paidVia", "ReceiveVia", "destination",
      "EvidenceRef", "ReceiptDate", "MANUAL_VERIFIED", "TreasuryReceipt",
      "TRANSITIONAL_CLEARING_CLOSE"].every(function(token) {
      return planJson.indexOf(token) === -1; }), planJson.slice(0, 200));
  check("I2b", JSON.stringify(Object.keys(plan.normalizedPayload)) ===
      JSON.stringify(["requestKey", "orderType", "lines"]) &&
    plan.normalizedPayload.lines.every(function(line) {
      return JSON.stringify(Object.keys(line)) ===
        JSON.stringify(["productID", "productVariantID", "qty"]); }));

  // I3: no 1000/1010/1020 fallback — the composed leg posts ONLY 1040/1030;
  // recognition keeps 1030/4000; no legacy money account is touched.
  var accountCodes = {};
  ledger.forEach(function(row) { accountCodes[String(row.AccountCode)] = true; });
  check("I3a", Object.keys(accountCodes).every(function(code) {
      return code === "1030" || code === "4000" || code === "1040"; }),
    JSON.stringify(accountCodes));
  check("I3b", plan.moneyRows.every(function(row) {
      return row.AccountCode === "1040" || row.AccountCode === "1030"; }) &&
    ["1000", "1010", "1020"].every(function(code) {
      return !accountCodes[code]; }));

  // I4: transitional 24k fixture untouched — composed save writes only the
  // two frozen writer identities; no TRANSITIONAL movement, no SCR-CE122B27.
  check("I4a", ledger.every(function(row) {
      return row.SourceType === save.JOURNAL_SOURCE_TYPE ||
        row.SourceType === policy.SALES_MONEY_SOURCE_TYPE; }) &&
    ledger.every(function(row) {
      return row.MovementType === save.JOURNAL_MOVEMENT_TYPE ||
        row.MovementType === policy.SALES_MONEY_MOVEMENT_TYPE; }));
  check("I4b", planJson.indexOf("SCR-CE122B27") === -1 &&
    JSON.stringify(ledger).indexOf("SCR-CE122B27") === -1 &&
    JSON.stringify(ledger).indexOf("TRANSITIONAL") === -1);

  // I5: digest coverage — money context is inside the plan digest; removing
  // or changing it without recompute must break the digest.
  var copyAmount = JSON.parse(planJson);
  copyAmount.moneyRows[0].Debit = 1;
  delete copyAmount.planDigest;
  check("I5a", transactionPayloadHash_(copyAmount) !== plan.planDigest);
  var copyStrip = JSON.parse(planJson);
  delete copyStrip.moneyRows; delete copyStrip.moneyJournalID;
  delete copyStrip.moneyJournalSignature; delete copyStrip.composedMoney;
  delete copyStrip.accounts.money; delete copyStrip.planDigest;
  check("I5b", transactionPayloadHash_(copyStrip) !== plan.planDigest &&
    salesRecognitionV2SaveVerifyPlan_(JSON.parse(JSON.stringify(plan))).ok === true);

  // I6: config reader purity — read-only resolution; no writer anywhere.
  var gateSource = salesV2SingleCommitGate_.toString();
  var stateSource = singleCommitTransactionConfigState_.toString();
  var foundationSource = singleCommitTransactionSalesGate_.toString() +
    preflightSingleCommitMoneyAccount.toString() + stateSource +
    JSON.stringify(SINGLE_COMMIT_TRANSACTION_V1) + JSON.stringify(SINGLE_COMMIT_MONEY_POLICY);
  check("I6a", gateSource.indexOf("setProperty") === -1 &&
    gateSource.indexOf("getProperty") !== -1);
  check("I6b", foundationSource.indexOf("setProperty") === -1 &&
    foundationSource.indexOf("appendRow") === -1 &&
    foundationSource.indexOf("setValues") === -1 &&
    foundationSource.indexOf("batchUpdate") === -1);

  // I7: source audit — new-intent path reaches the money preflight and never
  // a receipt/evidence concept; batch transport stays append-only RAW cells.
  var newIntentSource = salesRecognitionV2SaveNewIntent_.toString();
  var rangeSource = salesRecognitionV2SaveValueRanges_.toString();
  var bodySource = salesRecognitionV2SaveBatchBody_.toString() +
    salesRecognitionV2SaveAppendBlocks_.toString();
  check("I7a", newIntentSource.indexOf("preflightSingleCommitMoneyAccount") !== -1 &&
    newIntentSource.indexOf("salesV2SingleCommitGate_") !== -1 &&
    newIntentSource.indexOf("salesRecognitionV2RequestGate(config)") !== -1);
  check("I7b", ["TreasuryReceipt", "EvidenceRef", "MANUAL_VERIFIED", "Settlements",
      "Payments", "InventoryLedger"].every(function(token) {
      return newIntentSource.indexOf(token) === -1 &&
        rangeSource.indexOf(token) === -1 && bodySource.indexOf(token) === -1; }));
  check("I7c", bodySource.indexOf("appendCells") !== -1 &&
    bodySource.indexOf("updateCells") === -1 && bodySource.indexOf("formulaValue") === -1);

  // I8: resume never re-gates (sticky recovery) — config gate lives ONLY in
  // the new-intent path; resume runs no mode gate at all.
  var resumeSource = salesRecognitionV2SaveResume_.toString();
  check("I8", resumeSource.indexOf("salesV2SingleCommitGate_") === -1 &&
    resumeSource.indexOf("salesRecognitionV2RequestGate") === -1 &&
    resumeSource.indexOf("salesRecognitionV2SaveVerifyPlan_") !== -1);

  // I9: correction-lineage readiness (U6 locator, plumbing only) — the
  // composed-money leg is deterministically findable by frozen conventions
  // (stable-bootstrap JournalID + SourceType/SourceID bound to recognition).
  check("I9a", plan.moneyJournalID === transactionStableBootstrapId_(
      policy.SALES_MONEY_JOURNAL_PREFIX, [plan.orderID]) &&
    String(plan.moneyJournalID).indexOf(policy.SALES_MONEY_JOURNAL_PREFIX) === 0 &&
    plan.moneyRows.every(function(row) {
      return row.SourceType === policy.SALES_MONEY_SOURCE_TYPE &&
        row.SourceID === plan.recognitionID &&
        row.MovementType === policy.SALES_MONEY_MOVEMENT_TYPE; }));
  check("I9b", JSON.stringify(Object.keys(SINGLE_COMMIT_MONEY_POLICY)) ===
    JSON.stringify(["ACCOUNT_CODE", "ACCOUNT_EXPECTATION", "SALES_MONEY_MOVEMENT_TYPE",
      "SALES_MONEY_SOURCE_TYPE", "SALES_MONEY_JOURNAL_PREFIX"]) &&
    policy.SALES_MONEY_JOURNAL_PREFIX === "SRV2M-" &&
    policy.SALES_MONEY_SOURCE_TYPE === "SALES_MONEY_V2");

  return { total: pass, pass: pass, fail: 0 };
}
