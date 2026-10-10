// Treasury T4 durable receipt tests (suites A-H + 1030 CashFlowGroup gate +
// 20-boundary failure injection + 25-point mutation sensitivity) for
// 99A.Treasury.Receipt.Durable.Save.js. In-memory fixture spreadsheets only:
// reuses the U2 save fixture factory and the U3 committed-recognition helpers
// (same VM context) to seed authoritative V2 exposures. No production access,
// no network, no clasp, no writes outside fixture memory.

function treasuryT4Check_(id, value, detail) {
  if (!value) throw new Error("TREASURY_T4:" + id + (detail === undefined ? "" : "|" + detail));
}

function treasuryT4ActiveConfig_() {
  return { mode: "ACTIVE", contractVersion: "TREASURY_RECEIPT_V1",
    activationID: "TRACT-T4", activatedAt: "2026-10-01T00:00:00.000Z", configVersion: 1 };
}

function treasuryT4Accounts_() {
  var base = salesV2SaveBaseSheets_();
  var rows = base.Accounts.slice(1).map(function(row) { return row.slice(); });
  var headers = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  function account(code, name) {
    return headers.map(function(header) {
      var values = { AccountCode: code, AccountName: name, AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "Operating", IsActive: true,
        CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" };
      return values[header] === undefined ? "" : values[header];
    });
  }
  rows.push(account("1010", "DANA Business"));
  rows.push(account("1020", "Cash in Owner Custody - BluBCA"));
  return [headers.slice()].concat(rows);
}

// Base fixture: U3 sheets (Sales authority incl. tabsal/Logs/Payments/
// Settlements) + the three Treasury sheets + header-only isolation surfaces.
function treasuryT4BaseSheets_() {
  var base = u3BaseSheets_();
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  base.TreasuryReceipts = [contract.SCHEMAS.RECEIPTS.HEADERS.slice()];
  base.TreasuryOperations = [contract.SCHEMAS.OPERATIONS.HEADERS.slice()];
  base.TreasuryAudits = [contract.SCHEMAS.AUDITS.HEADERS.slice()];
  base.InventoryLedger = [BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.slice()];
  base.PurchaseEvents = [PURCHASE_EVENT_POLICY.headers.slice()];
  base.tabops = [CANONICAL_ENTRY.EXPENSE_HEADERS.slice()];
  base.Accounts = treasuryT4Accounts_();
  return base;
}

// Seeds ONE authoritative committed V2 exposure (amount 24000, order
// ORD-T4-1, RecognitionID SCR-U3-ORD-T4-1) through the real U3 artifact
// builder: op + audit + event + SRV2J- Dr1030/Cr4000 journal + order lineage.
function treasuryT4SeededFixture_() {
  var fixture = salesV2SaveFixture_(treasuryT4BaseSheets_());
  u3CommittedAppend_(fixture, {
    orderID: "ORD-T4-1", amount: 24000, date: "2026-10-11",
    recognizedAt: "2026-10-11T03:00:00.000Z", requestKey: "u3-t4-ord-1"
  });
  return fixture;
}

function treasuryT4Payload_(key, overrides) {
  return Object.assign({
    requestKey: key || "t4-key-001",
    recognitionID: "SCR-U3-ORD-T4-1",
    destinationAccountCode: "1000",
    grossAmount: 24000,
    receiptDate: "2026-10-12",
    evidenceType: "MANUAL_VERIFIED",
    evidenceRef: "WALLET-TRX-001",
    actor: "tester@numlock.test"
  }, overrides || {});
}

function treasuryT4Runtime_(options) {
  options = options || {};
  var fixture = options.fixture || treasuryT4SeededFixture_();
  var events = { batches: [], appliedRows: 0, cacheCalls: 0, flushes: 0 };
  var crashPoint = options.crash || null;
  var runtime = {
    spreadsheet: fixture,
    now: options.now || function() { return new Date("2026-10-15T02:03:04.000Z"); },
    actor: function() { return "tester@numlock.test"; },
    config: Object.prototype.hasOwnProperty.call(options, "config") ?
      options.config : treasuryT4ActiveConfig_(),
    flush: function() { events.flushes++; },
    crash: crashPoint ? function(point) {
      if (point === crashPoint) { crashPoint = null; throw new Error("CRASH:" + point); }
    } : null,
    invalidateCache: function() {
      events.cacheCalls++;
      if (options.cacheFail) throw new Error("SIMULATED_CACHE_FAILURE");
    },
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

// Row-count fingerprint over every sheet the Save may (or must not) touch.
function treasuryT4RowCounts_(fixture) {
  var names = ["TreasuryReceipts", "TreasuryOperations", "TreasuryAudits", "BalanceLedger",
    "Orders", "OrderLines", "SalesRecognitionEvents", "SalesRecognitionAudits",
    "TransactionOperations", "Payments", "Settlements", "tabsal", "tabops",
    "InventoryLedger", "PurchaseEvents", "Accounts"];
  var out = {};
  names.forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    out[name] = sheet ? sheet.getLastRow() : -1;
  });
  return out;
}

// Instruments data-read order (readCanonicalTable uses getDataRange; the
// schema gate uses getRange) to prove RequestKey lookup precedes exposure
// planning and outstanding re-reads happen inside the lock after exposure.
function treasuryT4TraceDataReads_(fixture) {
  var trace = [];
  ["TreasuryOperations", "SalesRecognitionEvents", "TreasuryReceipts"].forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    var original = sheet.getDataRange;
    sheet.getDataRange = function() { trace.push(name); return original.apply(sheet, arguments); };
  });
  return trace;
}

function treasuryT4NoDate_(value) {
  if (value instanceof Date) return false;
  if (Array.isArray(value)) return value.every(treasuryT4NoDate_);
  if (value && typeof value === "object") {
    return Object.keys(value).every(function(key) { return treasuryT4NoDate_(value[key]); });
  }
  return true;
}

function treasuryT4LedgerRows_(fixture) {
  return readCanonicalTable(fixture, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
}

function treasuryT4AccountSums_(fixture) {
  var sums = {};
  treasuryT4LedgerRows_(fixture).forEach(function(row) {
    if (!isCanonicalActive(row.IsActive)) return;
    var code = String(row.AccountCode);
    sums[code] = sums[code] || { debit: 0, credit: 0 };
    sums[code].debit += Number(row.Debit) || 0;
    sums[code].credit += Number(row.Credit) || 0;
  });
  return sums;
}

// ---------------------------------------------------------------------------
// Suite A — normal Save: exact delta, journal, durable sequence, envelope.
// ---------------------------------------------------------------------------
function testTreasuryT4SaveCore() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, contract = TREASURY_RECEIPT_V1_CONTRACT;
  var runtime = treasuryT4Runtime_(), fixture = runtime.spreadsheet;
  var before = treasuryT4RowCounts_(fixture);
  var trace = treasuryT4TraceDataReads_(fixture);
  var result = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_(), runtime);
  check("A1", result.status === "DONE" && result.code === "" && result.replay === false &&
    result.writeCount === save.FRESH_WRITE_COUNT && result.requestKey === "t4-key-001" &&
    result.operationID !== "" && result.receiptID !== "" && result.journalID !== "" &&
    result.auditID !== "" && result.recognitionID === "SCR-U3-ORD-T4-1", JSON.stringify(result));
  check("A2", treasuryT4NoDate_(result));
  // Exact successful delta: +1 op / +1 receipt / +2 ledger lines / +1 audit.
  var after = treasuryT4RowCounts_(fixture);
  check("A3", after.TreasuryOperations === before.TreasuryOperations + 1 &&
    after.TreasuryReceipts === before.TreasuryReceipts + 1 &&
    after.TreasuryAudits === before.TreasuryAudits + 1 &&
    after.BalanceLedger === before.BalanceLedger + 2 &&
    after.Orders === before.Orders && after.OrderLines === before.OrderLines &&
    after.SalesRecognitionEvents === before.SalesRecognitionEvents &&
    after.SalesRecognitionAudits === before.SalesRecognitionAudits &&
    after.TransactionOperations === before.TransactionOperations &&
    after.Payments === before.Payments && after.Settlements === before.Settlements &&
    after.tabsal === before.tabsal && after.tabops === before.tabops &&
    after.InventoryLedger === before.InventoryLedger &&
    after.PurchaseEvents === before.PurchaseEvents && after.Accounts === before.Accounts,
    JSON.stringify({ before: before, after: after }));
  // Durable sequence evidence: lookup (TreasuryOperations) before exposure
  // planning (SalesRecognitionEvents) and outstanding re-read (TreasuryReceipts)
  // after exposure resolution.
  check("A4", trace.indexOf("TreasuryOperations") === 0 &&
    trace.indexOf("SalesRecognitionEvents") > trace.indexOf("TreasuryOperations") &&
    trace.indexOf("TreasuryReceipts") > trace.indexOf("SalesRecognitionEvents"),
    trace.join(","));
  // Operation row: 10-column T3 schema, COMMITTED, clean LastError.
  var operations = readCanonicalTable(fixture, contract.SCHEMAS.OPERATIONS.SHEET,
    contract.SCHEMAS.OPERATIONS.HEADERS);
  check("A5", operations.length === 1 && operations[0].State === "COMMITTED" &&
    operations[0].OperationType === save.OPERATION_TYPE &&
    operations[0].TreasuryOperationID === result.operationID &&
    operations[0].RecognitionID === "SCR-U3-ORD-T4-1" &&
    operations[0].RequestKey === "t4-key-001" && operations[0].LastError === "");
  // Immutable plan: exact clearing, contract/config identity, verifiable digest.
  var plan = JSON.parse(operations[0].OperationPlan);
  check("A6", plan.receiptAmount === 24000 && plan.outstandingBefore === 24000 &&
    plan.recognizedAmount === 24000 && plan.destination.code === "1000" &&
    plan.destination.name === "Cash on Hand" && plan.receiptDate === "2026-10-12" &&
    plan.economicDate === plan.receiptDate && plan.actor === "tester@numlock.test" &&
    plan.config.activationID === "TRACT-T4" && plan.config.configVersion === 1 &&
    plan.contractVersion === "TREASURY_RECEIPT_V1" &&
    plan.operationID === operations[0].TreasuryOperationID &&
    plan.payloadHash === operations[0].PayloadHash &&
    treasuryReceiptVerifyPlan_(plan).ok === true, JSON.stringify(treasuryReceiptVerifyPlan_(plan)));
  // Receipt row: exact 24-column T3 schema, immutable shape, no stored Status.
  var receiptHeaders = contract.SCHEMAS.RECEIPTS.HEADERS;
  var receipts = readCanonicalTable(fixture, contract.SCHEMAS.RECEIPTS.SHEET, receiptHeaders);
  check("A7", receiptHeaders.length === 24 && receiptHeaders.indexOf("Status") === -1 &&
    receipts.length === 1 && receipts[0].TreasuryReceiptID === result.receiptID &&
    receipts[0].ContractVersion === "TREASURY_RECEIPT_V1" &&
    receipts[0].OperationID === result.operationID &&
    receipts[0].RequestKey === "t4-key-001" &&
    receipts[0].RecognitionID === "SCR-U3-ORD-T4-1" &&
    receipts[0].OrderID === plan.orderID && receipts[0].RevisionID === plan.revisionID &&
    receipts[0].ReceiptType === "SALES_RECEIPT" &&
    receipts[0].DestinationAccountCode === "1000" &&
    Number(receipts[0].GrossAmount) === 24000 &&
    receipts[0].ReceiptDate === "2026-10-12" && receipts[0].EconomicDate === "2026-10-12" &&
    receipts[0].EvidenceType === "MANUAL_VERIFIED" &&
    receipts[0].EvidenceRef === "WALLET-TRX-001" &&
    receipts[0].JournalID === result.journalID &&
    receipts[0].PostingStatus === "COMMITTED" && receipts[0].Reason === "" &&
    receipts[0].Actor === "tester@numlock.test" &&
    /^2026-10-15T02:03:04/.test(String(receipts[0].ReceivedAt)) &&
    treasuryReceiptRowExact_(receipts[0], plan.receiptRow, receiptHeaders) === true);
  // Journal: exactly Dr destination / Cr 1030, TREASURY_RECEIPT movement,
  // T3 SourceType/SourceID/JournalID, EconomicDate attribution, balanced.
  var ledger = treasuryT4LedgerRows_(fixture);
  check("A8", ledger.length === 4 && "baseline sales journal still present");
  var journal = ledger.filter(function(row) { return row.JournalID === result.journalID; });
  check("A9", journal.length === 2 && journal[0].LineID === result.journalID + "-1" &&
    journal[1].LineID === result.journalID + "-2" &&
    journal[0].AccountCode === "1000" && Number(journal[0].Debit) === 24000 &&
    Number(journal[0].Credit) === 0 && journal[1].AccountCode === "1030" &&
    Number(journal[1].Debit) === 0 && Number(journal[1].Credit) === 24000 &&
    journal[0].MovementType === "TREASURY_RECEIPT" &&
    journal[1].MovementType === "TREASURY_RECEIPT" &&
    journal[0].SourceType === "TREASURY_RECEIPT_V1" &&
    journal[0].SourceID === result.receiptID &&
    journal[1].SourceID === result.receiptID &&
    journal[0].Tanggal === "2026-10-12" && journal[1].Tanggal === "2026-10-12" &&
    journal[0].ExternalRef === "SCR-U3-ORD-T4-1" &&
    isCanonicalActive(journal[0].IsActive) && isCanonicalActive(journal[1].IsActive) &&
    journal.every(function(row) {
      return ["4000", "5000", "1100", "2000", "2010", "6210"].indexOf(String(row.AccountCode)) === -1;
    }));
  // Journal signature recomputed from persisted rows (T3 helper).
  var recomputed = treasuryJournalSignature(journal);
  check("A10", recomputed === plan.journalSignature &&
    receipts[0].JournalSignature === recomputed, recomputed);
  // Audit: exactly one, 11 columns, fully cross-linked.
  var audits = readCanonicalTable(fixture, contract.SCHEMAS.AUDITS.SHEET,
    contract.SCHEMAS.AUDITS.HEADERS);
  check("A11", audits.length === 1 && contract.SCHEMAS.AUDITS.HEADERS.length === 11 &&
    audits[0].AuditID === result.auditID &&
    audits[0].ContractVersion === "TREASURY_RECEIPT_V1" &&
    audits[0].OperationID === result.operationID && audits[0].RequestKey === "t4-key-001" &&
    audits[0].TreasuryReceiptID === result.receiptID &&
    audits[0].RecognitionID === "SCR-U3-ORD-T4-1" && audits[0].OrderID === plan.orderID &&
    audits[0].JournalID === result.journalID &&
    audits[0].PayloadHash === operations[0].PayloadHash &&
    audits[0].Actor === "tester@numlock.test" && audits[0].SavedAt === plan.savedAt);
  // ONE atomic batch call carrying all three surfaces / four rows.
  check("A12", runtime.events.batches.length === 1 &&
    runtime.events.batches[0].length === 3 && runtime.events.appliedRows === 4 &&
    runtime.events.cacheCalls === 1 && runtime.events.flushes > 0,
    JSON.stringify({ batches: runtime.events.batches.length,
      rows: runtime.events.appliedRows, cache: runtime.events.cacheCalls }));
  // SnapshotJSON exact T2 section 18 key set.
  var snapshot = JSON.parse(receipts[0].SnapshotJSON);
  var expectedKeys = ["contractVersion", "activationID", "configVersion", "operationType",
    "side", "recognitionID", "orderID", "revisionID", "recognizedAmount", "outstandingBefore",
    "receiptAmount", "destination", "receiptDate", "economicDate", "evidence", "journalID",
    "targetReceiptID", "reason"];
  check("A13", JSON.stringify(Object.keys(snapshot)) === JSON.stringify(expectedKeys) &&
    snapshot.side === "PRIMARY" && snapshot.targetReceiptID === "" && snapshot.reason === "" &&
    snapshot.evidence.type === "MANUAL_VERIFIED" && snapshot.destination.code === "1000" &&
    receipts[0].SnapshotJSON === JSON.stringify(plan.snapshot));
  // Outer-lock wrapper owns the single ScriptLock; core never locks.
  var wrapperSource = treasuryReceiptDurableSave.toString();
  var coreSource = treasuryReceiptSaveWithRuntime_.toString() +
    treasuryReceiptNewIntent_.toString() + treasuryReceiptResume_.toString() +
    treasuryReceiptApplyBatch_.toString();
  check("A14", wrapperSource.indexOf("waitLock(30000)") !== -1 &&
    wrapperSource.indexOf("releaseLock") !== -1 &&
    wrapperSource.indexOf("finally") !== -1 &&
    wrapperSource.indexOf("treasuryReceiptSaveWithRuntime_") !== -1 &&
    wrapperSource.indexOf("LOCK_TIMEOUT") !== -1 &&
    coreSource.indexOf("waitLock") === -1 && coreSource.indexOf("releaseLock") === -1);
  return { total: 14, pass: pass, fail: 14 - pass };
}
// ---------------------------------------------------------------------------
// Suite B — refusals: config/schema/account/1030/exposure/amount/evidence/
// date + PREPARED/PAUSED. Every refusal: WRITE_COUNT = 0, zero cache calls.
// ---------------------------------------------------------------------------
function testTreasuryT4Refusals() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES;
  var contract = TREASURY_RECEIPT_V1_CONTRACT;

  function assertRefused(id, runtime, payload, statusCode, expectDetail) {
    var fixture = runtime.spreadsheet;
    var before = JSON.stringify(treasuryT4RowCounts_(fixture));
    var result = treasuryReceiptSaveWithRuntime_(payload, runtime);
    check(id + "a", result.status === "REFUSED" && result.code === statusCode,
      JSON.stringify(result));
    check(id + "b", result.writeCount === 0 && runtime.events.batches.length === 0 &&
      runtime.events.cacheCalls === 0 && runtime.events.appliedRows === 0);
    check(id + "c", JSON.stringify(treasuryT4RowCounts_(fixture)) === before);
    if (expectDetail) {
      check(id + "d", String(result.detail).indexOf(expectDetail) !== -1, result.detail);
    }
    return result;
  }

  // B1 date/evidence normalization refusals (operator facts, pre-lookup).
  assertRefused("B1", treasuryT4Runtime_(), treasuryT4Payload_("t4-b1-01",
    { receiptDate: "2026-02-30" }), codes.DATE_INVALID);
  assertRefused("B2", treasuryT4Runtime_(), treasuryT4Payload_("t4-b2-01",
    { evidenceType: "BANK_STATEMENT" }), codes.EVIDENCE_TYPE_INVALID);
  assertRefused("B3", treasuryT4Runtime_(), treasuryT4Payload_("t4-b3-01",
    { evidenceRef: "ab" }), codes.EVIDENCE_REF_INVALID);
  assertRefused("B4", treasuryT4Runtime_(), treasuryT4Payload_("t4-b4-01",
    { evidenceRef: "note\nsecond line" }), codes.EVIDENCE_REF_INVALID);
  assertRefused("B5", treasuryT4Runtime_(), treasuryT4Payload_("t4-b5-01",
    { evidenceRef: "x".repeat(201) }), codes.EVIDENCE_REF_INVALID);
  assertRefused("B6", treasuryT4Runtime_(), treasuryT4Payload_("t4-b6-01",
    { grossAmount: "abc" }), codes.PAYLOAD_INVALID);
  assertRefused("B7", treasuryT4Runtime_(), treasuryT4Payload_("t4-b7-01",
    { requestKey: "ab" }), codes.PAYLOAD_INVALID);
  assertRefused("B8", treasuryT4Runtime_(), treasuryT4Payload_("t4-b8-01",
    { recognitionID: "LEGACY-123" }), codes.PAYLOAD_INVALID);

  // B9 amount precedence: <=0 / non-integer => AMOUNT_NOT_POSITIVE (before
  // ALREADY_CLEARED), evaluated against the real exposure.
  assertRefused("B9", treasuryT4Runtime_(), treasuryT4Payload_("t4-b9-01",
    { grossAmount: 0 }), codes.AMOUNT_NOT_POSITIVE);
  assertRefused("B10", treasuryT4Runtime_(), treasuryT4Payload_("t4-b10-01",
    { grossAmount: -500 }), codes.AMOUNT_NOT_POSITIVE);
  assertRefused("B11", treasuryT4Runtime_(), treasuryT4Payload_("t4-b11-01",
    { grossAmount: 1.5 }), codes.AMOUNT_NOT_POSITIVE);
  // B12 exact clearing: mismatch refuses (no tolerance/partial/over/under).
  assertRefused("B12", treasuryT4Runtime_(), treasuryT4Payload_("t4-b12-01",
    { grossAmount: 23999 }), codes.AMOUNT_MISMATCH, "EXPECTED:24000,ACTUAL:23999");
  assertRefused("B13", treasuryT4Runtime_(), treasuryT4Payload_("t4-b13-01",
    { grossAmount: 24001 }), codes.AMOUNT_MISMATCH);

  // B14 PREPARED: zero receipts possible, zero writes, no batch, no cache.
  assertRefused("B14", treasuryT4Runtime_({ config: { mode: "PREPARED",
    contractVersion: "TREASURY_RECEIPT_V1", activationID: "", activatedAt: "",
    configVersion: 1 } }), treasuryT4Payload_("t4-b14-01"), codes.NOT_ACTIVATED);
  // B15 PAUSED: refuse NEW writes.
  assertRefused("B15", treasuryT4Runtime_({ config: Object.assign(
    treasuryT4ActiveConfig_(), { mode: "PAUSED" }) }),
    treasuryT4Payload_("t4-b15-01"), codes.MODE_PAUSED);
  // B16/B17 invalid config never falls back.
  assertRefused("B16", treasuryT4Runtime_({ config: Object.assign(
    treasuryT4ActiveConfig_(), { contractVersion: "SALES_RECOGNITION_V2" }) }),
    treasuryT4Payload_("t4-b16-01"), codes.CONTRACT_VERSION_MISMATCH);
  assertRefused("B17", treasuryT4Runtime_({ config: null }),
    treasuryT4Payload_("t4-b17-01"), codes.CONFIG_INVALID);

  // B18 schema gate: renamed Treasury receipt column => SCHEMA_NOT_READY.
  var schemaFixture = treasuryT4SeededFixture_();
  schemaFixture.getSheetByName("TreasuryReceipts").values[0][9] = "AmountRenamed";
  assertRefused("B18", treasuryT4Runtime_({ fixture: schemaFixture }),
    treasuryT4Payload_("t4-b18-01"), codes.SCHEMA_NOT_READY, "TreasuryReceipts");
  // B19 missing/broken authority sheet header => SCHEMA_NOT_READY.
  var missingFixture = salesV2SaveFixture_(treasuryT4BaseSheets_());
  u3CommittedAppend_(missingFixture, { orderID: "ORD-T4-1", amount: 24000,
    date: "2026-10-11", recognizedAt: "2026-10-11T03:00:00.000Z", requestKey: "u3-t4-ord-1" });
  missingFixture.getSheetByName("OrderLines").values[0][0] = "OrderLineIDRenamed";
  assertRefused("B19", treasuryT4Runtime_({ fixture: missingFixture }),
    treasuryT4Payload_("t4-b19-01"), codes.SCHEMA_NOT_READY, "OrderLines");

  // B20 destination eligibility: unknown / clearing / inactive / duplicate.
  assertRefused("B20", treasuryT4Runtime_(), treasuryT4Payload_("t4-b20-01",
    { destinationAccountCode: "1100" }), codes.INVALID_DESTINATION_ACCOUNT);
  assertRefused("B21", treasuryT4Runtime_(), treasuryT4Payload_("t4-b21-01",
    { destinationAccountCode: "1030" }), codes.DESTINATION_IS_CLEARING);
  var inactiveFixture = treasuryT4SeededFixture_();
  var accountSheet = inactiveFixture.getSheetByName("Accounts");
  var accountHeaders = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  var activeIdx = accountHeaders.indexOf("IsActive");
  accountSheet.values.forEach(function(row, index) {
    if (index > 0 && String(row[0]) === "1000") row[activeIdx] = false;
  });
  assertRefused("B22", treasuryT4Runtime_({ fixture: inactiveFixture }),
    treasuryT4Payload_("t4-b22-01"), codes.DESTINATION_ACCOUNT_INACTIVE);
  var duplicateFixture = treasuryT4SeededFixture_();
  var dupSheet = duplicateFixture.getSheetByName("Accounts");
  dupSheet.getRange(dupSheet.getLastRow() + 1, 1, 1, accountHeaders.length)
    .setValues([dupSheet.values[1].slice()]);
  assertRefused("B23", treasuryT4Runtime_({ fixture: duplicateFixture }),
    treasuryT4Payload_("t4-b23-01"), codes.INVALID_DESTINATION_ACCOUNT);

  // B24 1030 CashFlowGroup hard gate: blank fails closed with the T3 reason.
  var blankGroupFixture = treasuryT4SeededFixture_();
  var blankSheet = blankGroupFixture.getSheetByName("Accounts");
  var groupIdx = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("CashFlowGroup");
  blankSheet.values.forEach(function(row, index) {
    if (index > 0 && String(row[0]) === "1030") row[groupIdx] = "";
  });
  assertRefused("B24", treasuryT4Runtime_({ fixture: blankGroupFixture }),
    treasuryT4Payload_("t4-b24-01"), codes.SCHEMA_NOT_READY, "CASH_FLOW_GROUP_UNCLASSIFIED");

  // B25 exposure authority: missing / non-V2 / voided / integrity / lineage.
  assertRefused("B25", treasuryT4Runtime_(), treasuryT4Payload_("t4-b25-01",
    { recognitionID: "SCR-MISSING-99" }), codes.RECOGNITION_MISSING);
  var nonV2Fixture = treasuryT4SeededFixture_();
  var eventSheet = nonV2Fixture.getSheetByName("SalesRecognitionEvents");
  eventSheet.values[1][SALES_RECOGNITION_V2_CONTRACT.HEADERS.indexOf("ContractVersion")] =
    "SALES_RECOGNITION_V1";
  assertRefused("B26", treasuryT4Runtime_({ fixture: nonV2Fixture }),
    treasuryT4Payload_("t4-b26-01"), codes.RECOGNITION_NOT_V2);
  var voidedFixture = treasuryT4SeededFixture_();
  u3ReversalAppend_(voidedFixture, {
    RecognitionID: "SCR-U3-ORD-T4-1", OrderID: "ORD-T4-1", Amount: 24000,
    ActivationID: "ACT-U2"
  }, { date: "2026-10-12", recognizedAt: "2026-10-12T03:00:00.000Z" });
  assertRefused("B27", treasuryT4Runtime_({ fixture: voidedFixture }),
    treasuryT4Payload_("t4-b27-01"), codes.RECOGNITION_INACTIVE, "REVERSAL_PRESENT");
  var integrityFixture = treasuryT4SeededFixture_();
  var salesLedger = integrityFixture.getSheetByName("BalanceLedger");
  salesLedger.values[1][BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf("Debit")] = 999;
  assertRefused("B28", treasuryT4Runtime_({ fixture: integrityFixture }),
    treasuryT4Payload_("t4-b28-01"), codes.RECOGNITION_INTEGRITY_FAILURE);
  var lineageFixture = treasuryT4SeededFixture_();
  lineageFixture.getSheetByName("OrderLines").values.pop();
  assertRefused("B29", treasuryT4Runtime_({ fixture: lineageFixture }),
    treasuryT4Payload_("t4-b29-01"), codes.ORDER_LINEAGE_MISSING);
  return { total: 29 * 3 + 1, pass: pass, fail: 29 * 3 + 1 - pass };
}
// ---------------------------------------------------------------------------
// Suite C — idempotency: exact same-key replay, deterministic conflict,
// already-cleared new key. Zero new writes on every non-fresh outcome.
// ---------------------------------------------------------------------------
function testTreasuryT4Idempotency() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var runtime = treasuryT4Runtime_(), fixture = runtime.spreadsheet;
  var fresh = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_(), runtime);
  check("C1", fresh.status === "DONE" && fresh.replay === false);
  var counts = JSON.stringify(treasuryT4RowCounts_(fixture));

  // C2 exact replay: same key + same payload => same IDs, zero new writes,
  // equivalent success envelope; committed replay re-invalidates the cache.
  var replayRuntime = treasuryT4Runtime_({ fixture: fixture });
  var replay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_(), replayRuntime);
  check("C2a", replay.status === "DONE" && replay.replay === true &&
    replay.writeCount === 0 && replay.code === "" &&
    replay.operationID === fresh.operationID && replay.receiptID === fresh.receiptID &&
    replay.journalID === fresh.journalID && replay.auditID === fresh.auditID &&
    replay.recognitionID === fresh.recognitionID && replay.requestKey === fresh.requestKey,
    JSON.stringify(replay));
  check("C2b", JSON.stringify(treasuryT4RowCounts_(fixture)) === counts &&
    replayRuntime.events.batches.length === 0 && replayRuntime.events.appliedRows === 0 &&
    replayRuntime.events.cacheCalls === 1);
  // Replay performs no exposure planning (no SalesRecognitionEvents data read).
  var replayTrace = treasuryT4TraceDataReads_(fixture);
  var replay2 = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_(),
    treasuryT4Runtime_({ fixture: fixture }));
  check("C2c", replay2.status === "DONE" &&
    replayTrace.indexOf("SalesRecognitionEvents") === -1, replayTrace.join(","));

  // C3 same key + different payload => deterministic conflict, state unchanged.
  var conflict = treasuryReceiptSaveWithRuntime_(
    treasuryT4Payload_("t4-key-001", { grossAmount: 12000 }),
    treasuryT4Runtime_({ fixture: fixture }));
  check("C3a", conflict.status === "CONFLICT" && conflict.code === codes.REQUEST_KEY_CONFLICT &&
    conflict.writeCount === 0 && conflict.requestKey === "t4-key-001" &&
    conflict.operationID === fresh.operationID, JSON.stringify(conflict));
  check("C3b", JSON.stringify(treasuryT4RowCounts_(fixture)) === counts);
  // Conflict variant: different recognitionID under the same key.
  var conflictRecognition = treasuryReceiptSaveWithRuntime_(
    treasuryT4Payload_("t4-key-001", { recognitionID: "SCR-U3R-OTHER-9" }),
    treasuryT4Runtime_({ fixture: fixture }));
  check("C3c", conflictRecognition.status === "CONFLICT" &&
    conflictRecognition.code === codes.REQUEST_KEY_CONFLICT &&
    JSON.stringify(treasuryT4RowCounts_(fixture)) === counts);
  // Conflict variant: different date (valid but changed operator fact).
  var conflictDate = treasuryReceiptSaveWithRuntime_(
    treasuryT4Payload_("t4-key-001", { receiptDate: "2026-10-13" }),
    treasuryT4Runtime_({ fixture: fixture }));
  check("C3d", conflictDate.status === "CONFLICT" &&
    conflictDate.code === codes.REQUEST_KEY_CONFLICT &&
    JSON.stringify(treasuryT4RowCounts_(fixture)) === counts);

  // C4 NEW key on the cleared exposure => TREASURY_ALREADY_CLEARED, never a
  // second receipt.
  var second = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-key-002"),
    treasuryT4Runtime_({ fixture: fixture }));
  check("C4a", second.status === "REFUSED" && second.code === codes.ALREADY_CLEARED &&
    second.writeCount === 0, JSON.stringify(second));
  check("C4b", JSON.stringify(treasuryT4RowCounts_(fixture)) === counts &&
    readCanonicalTable(fixture, contract.SCHEMAS.RECEIPTS.SHEET,
      contract.SCHEMAS.RECEIPTS.HEADERS).length === 1);

  // C5 duplicate operation rows (derivation collision) fail closed.
  var dupFixture = treasuryT4SeededFixture_();
  var dupRuntime = treasuryT4Runtime_({ fixture: dupFixture });
  var dupFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-dup-01"), dupRuntime);
  check("C5a", dupFirst.status === "DONE");
  var opsSheet = dupFixture.getSheetByName("TreasuryOperations");
  var opHeaders = contract.SCHEMAS.OPERATIONS.HEADERS;
  opsSheet.getRange(3, 1, 1, opHeaders.length).setValues([opsSheet.values[1].slice()]);
  var dupCounts = JSON.stringify(treasuryT4RowCounts_(dupFixture));
  var dupSecond = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-dup-01"),
    treasuryT4Runtime_({ fixture: dupFixture }));
  check("C5b", dupSecond.status === "RECOVERY_REQUIRED" &&
    dupSecond.code === codes.DUPLICATE_RECEIPT_ID &&
    JSON.stringify(treasuryT4RowCounts_(dupFixture)) === dupCounts, JSON.stringify(dupSecond));
  return { total: 15, pass: pass, fail: 15 - pass };
}

// ---------------------------------------------------------------------------
// Suite E — concurrency: the ScriptLock serializes whole executions; the
// exposure/outstanding state is re-read inside the lock immediately before
// plan freeze, so a stale advisory read can never produce a second clearing.
// ---------------------------------------------------------------------------
function testTreasuryT4Concurrency() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var fixture = treasuryT4SeededFixture_();

  // E1 "simultaneous" same-exposure requests with DIFFERENT keys: the second
  // (post-lock) execution re-reads outstanding = 0 => deterministic loser.
  var advisory = treasuryComputeOutstanding_("SCR-U3-ORD-T4-1", 24000, fixture, "");
  check("E1a", advisory.outstanding === 24000 && advisory.activeClearings === 0);
  var winner = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-cc-win"),
    treasuryT4Runtime_({ fixture: fixture }));
  check("E1b", winner.status === "DONE" && winner.writeCount === save.FRESH_WRITE_COUNT,
    JSON.stringify(winner));
  var staleLoser = treasuryReceiptSaveWithRuntime_(
    treasuryT4Payload_("t4-cc-lose", { grossAmount: advisory.outstanding }),
    treasuryT4Runtime_({ fixture: fixture }));
  check("E1c", staleLoser.status === "REFUSED" && staleLoser.code === codes.ALREADY_CLEARED &&
    staleLoser.writeCount === 0, JSON.stringify(staleLoser));
  // Exactly one clearing: one receipt, one Dr dest / one Cr1030 pair.
  var receipts = readCanonicalTable(fixture, contract.SCHEMAS.RECEIPTS.SHEET,
    contract.SCHEMAS.RECEIPTS.HEADERS);
  var treasuryJournalIds = {};
  receipts.forEach(function(row) { treasuryJournalIds[row.JournalID] = true; });
  var ledger = treasuryT4LedgerRows_(fixture);
  var treasuryLines = ledger.filter(function(row) {
    return String(row.SourceType) === "TREASURY_RECEIPT_V1";
  });
  var debitLines = treasuryLines.filter(function(row) { return Number(row.Debit) > 0; });
  var creditLines = treasuryLines.filter(function(row) { return Number(row.Credit) > 0; });
  check("E1d", receipts.length === 1 && Object.keys(treasuryJournalIds).length === 1 &&
    treasuryLines.length === 2 && debitLines.length === 1 &&
    debitLines[0].AccountCode === "1000" && creditLines.length === 1 &&
    creditLines[0].AccountCode === "1030");

  // E2 same RequestKey executed twice (serialized) => one op, one result.
  var sameKeyFixture = treasuryT4SeededFixture_();
  var first = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-cc-same"),
    treasuryT4Runtime_({ fixture: sameKeyFixture }));
  var second = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-cc-same"),
    treasuryT4Runtime_({ fixture: sameKeyFixture }));
  check("E2a", first.status === "DONE" && second.status === "DONE" &&
    second.replay === true && second.receiptID === first.receiptID);
  check("E2b", readCanonicalTable(sameKeyFixture, contract.SCHEMAS.OPERATIONS.SHEET,
    contract.SCHEMAS.OPERATIONS.HEADERS).length === 1 &&
    readCanonicalTable(sameKeyFixture, contract.SCHEMAS.RECEIPTS.SHEET,
      contract.SCHEMAS.RECEIPTS.HEADERS).length === 1);

  // E3 an IN_PROGRESS claim on the exposure blocks other keys (EXPOSURE_BUSY)
  // — never a second concurrent clearing.
  var busyRuntime = treasuryT4Runtime_({ fixture: treasuryT4SeededFixture_(),
    crash: "T4_AFTER_INTENT" });
  var threw = null;
  try { treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-cc-busy-1"), busyRuntime); }
  catch (error) { threw = error; }
  check("E3a", !!threw && threw.message === "CRASH:T4_AFTER_INTENT");
  var busyLoser = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-cc-busy-2"),
    treasuryT4Runtime_({ fixture: busyRuntime.spreadsheet }));
  check("E3b", busyLoser.status === "REFUSED" && busyLoser.code === codes.EXPOSURE_BUSY &&
    busyLoser.writeCount === 0, JSON.stringify(busyLoser));
  // The original key still recovers deterministically (intent-only resume
  // executes the frozen plan once: batch rows written, replay flag stays false).
  var busyRecovery = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-cc-busy-1"),
    treasuryT4Runtime_({ fixture: busyRuntime.spreadsheet }));
  check("E3c", busyRecovery.status === "DONE" && busyRecovery.replay === false &&
    busyRecovery.writeCount === save.FRESH_WRITE_COUNT, JSON.stringify(busyRecovery));
  return { total: 10, pass: pass, fail: 10 - pass };
}
// ---------------------------------------------------------------------------
// Suite D — recovery + 20-boundary failure injection matrix. Crash hooks at
// every durable boundary; where the single atomic batch prevents intermediate
// storage states, response-boundary ambiguity is simulated by an injected
// batch (partial apply / apply-then-throw) — never fabricated as a real
// transport state. Every uncertain outcome preserves identity and recovers
// deterministically with the ORIGINAL RequestKey.
// ---------------------------------------------------------------------------
function testTreasuryT4Recovery() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var receiptSheetRows = 2, ledgerRows = 5, auditSheetRows = 2;

  function artifactCounts(fixture) {
    return {
      receipts: fixture.getSheetByName("TreasuryReceipts").getLastRow(),
      ledger: fixture.getSheetByName("BalanceLedger").getLastRow(),
      audits: fixture.getSheetByName("TreasuryAudits").getLastRow()
    };
  }

  // FI1 before lock: the wrapper acquires the ScriptLock BEFORE the core and
  // refuses with TREASURY_LOCK_TIMEOUT (zero writes) when it cannot.
  var wrapperSource = treasuryReceiptDurableSave.toString();
  check("FI1", wrapperSource.indexOf("waitLock(30000)") <
    wrapperSource.indexOf("treasuryReceiptSaveWithRuntime_") &&
    wrapperSource.indexOf("save.CODES.LOCK_TIMEOUT") !== -1 &&
    wrapperSource.indexOf("releaseLock") !== -1);
  // FI2-FI7 pre-mutation gates (structural config, schema, destination, 1030
  // CashFlowGroup, recognition, amount/outstanding) — each REFUSED, zero writes.
  function fiRefused(id, runtime, payload, code) {
    var before = JSON.stringify(treasuryT4RowCounts_(runtime.spreadsheet));
    var result = treasuryReceiptSaveWithRuntime_(payload, runtime);
    check(id, result.status === "REFUSED" && result.code === code &&
      result.writeCount === 0 && runtime.events.batches.length === 0 &&
      runtime.events.cacheCalls === 0 &&
      JSON.stringify(treasuryT4RowCounts_(runtime.spreadsheet)) === before,
      JSON.stringify(result));
  }
  fiRefused("FI2", treasuryT4Runtime_({ config: null }),
    treasuryT4Payload_("t4-fi2-01"), codes.CONFIG_INVALID);
  var fiSchema = treasuryT4SeededFixture_();
  fiSchema.getSheetByName("TreasuryAudits").values[0][4] = "ReceiptIDRenamed";
  fiRefused("FI3", treasuryT4Runtime_({ fixture: fiSchema }),
    treasuryT4Payload_("t4-fi3-01"), codes.SCHEMA_NOT_READY);
  fiRefused("FI4", treasuryT4Runtime_(), treasuryT4Payload_("t4-fi4-01",
    { destinationAccountCode: "2010" }), codes.INVALID_DESTINATION_ACCOUNT);
  var fiGroup = treasuryT4SeededFixture_();
  var groupSheet = fiGroup.getSheetByName("Accounts");
  var groupIdx = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("CashFlowGroup");
  groupSheet.values.forEach(function(row, index) {
    if (index > 0 && String(row[0]) === "1030") row[groupIdx] = "Investing";
  });
  fiRefused("FI5", treasuryT4Runtime_({ fixture: fiGroup }),
    treasuryT4Payload_("t4-fi5-01"), codes.SCHEMA_NOT_READY);
  fiRefused("FI6", treasuryT4Runtime_(), treasuryT4Payload_("t4-fi6-01",
    { recognitionID: "SCR-NONE-001" }), codes.RECOGNITION_MISSING);
  fiRefused("FI7", treasuryT4Runtime_(), treasuryT4Payload_("t4-fi7-01",
    { grossAmount: 20000 }), codes.AMOUNT_MISMATCH);

  // FI8-FI10, FI15, FI17, FI18: crash at every durability boundary, then
  // resume with the SAME RequestKey.
  [{ point: "T4_BEFORE_INTENT", ops: 0, state: "", artifacts: 0, write: 4, replay: false },
   { point: "T4_AFTER_INTENT_PERSIST", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 4, replay: false },
   { point: "T4_AFTER_INTENT", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 4, replay: false },
   { point: "T4_BEFORE_BATCH", ops: 1, state: "IN_PROGRESS", artifacts: 0, write: 4, replay: false },
   { point: "T4_AFTER_BATCH", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "T4_AFTER_READBACK", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "T4_BEFORE_COMMIT", ops: 1, state: "IN_PROGRESS", artifacts: 1, write: 0, replay: true },
   { point: "T4_AFTER_COMMIT", ops: 1, state: "COMMITTED", artifacts: 1, write: 0, replay: true }
  ].forEach(function(scenario, index) {
    var id = "FI" + (8 + index) + "/" + (index + 1);
    var runtime = treasuryT4Runtime_({ crash: scenario.point });
    var fixture = runtime.spreadsheet;
    var threw = null;
    try { treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-crash-" + scenario.point), runtime); }
    catch (error) { threw = error; }
    check(id + "a", !!threw && threw.message === "CRASH:" + scenario.point);
    var operations = readCanonicalTable(fixture, contract.SCHEMAS.OPERATIONS.SHEET,
      contract.SCHEMAS.OPERATIONS.HEADERS);
    check(id + "b", operations.length === scenario.ops &&
      (scenario.ops === 0 || operations[0].State === scenario.state));
    var counts = artifactCounts(fixture);
    check(id + "c", scenario.artifacts ?
      (counts.receipts === receiptSheetRows && counts.ledger === ledgerRows &&
        counts.audits === auditSheetRows) :
      (counts.receipts === 1 && counts.ledger === 3 && counts.audits === 1));
    var resume = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-crash-" + scenario.point),
      treasuryT4Runtime_({ fixture: fixture }));
    check(id + "d", resume.status === "DONE" && resume.writeCount === scenario.write &&
      resume.replay === scenario.replay &&
      resume.requestKey === "t4-crash-" + scenario.point, JSON.stringify(resume));
    var finalOperations = readCanonicalTable(fixture, contract.SCHEMAS.OPERATIONS.SHEET,
      contract.SCHEMAS.OPERATIONS.HEADERS);
    var finalCounts = artifactCounts(fixture);
    check(id + "e", finalOperations.length === 1 &&
      finalOperations[0].State === "COMMITTED" &&
      finalCounts.receipts === receiptSheetRows && finalCounts.ledger === ledgerRows &&
      finalCounts.audits === auditSheetRows);
  });

  // FI9-ish D11: intent readback mismatch => INTENT_READBACK_FAILED (no batch),
  // then deterministic recovery once readback is truthful.
  var intentFixture = treasuryT4SeededFixture_();
  var originalFind = treasuryOperationFind_;
  var findCalls = 0;
  treasuryOperationFind_ = function(ss, operationType, requestKey) {
    findCalls++;
    var row = originalFind(ss, operationType, requestKey);
    if (findCalls === 2 && row) return Object.assign({}, row, { PayloadHash: "CORRUPT" });
    return row;
  };
  var intentResult;
  try {
    intentResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-intent-1"),
      treasuryT4Runtime_({ fixture: intentFixture }));
  } finally { treasuryOperationFind_ = originalFind; }
  check("FI_INTENTa", intentResult.status === "RECOVERY_REQUIRED" &&
    intentResult.code === codes.INTENT_READBACK_FAILED &&
    String(intentResult.detail).indexOf("INTENT_ROW_MISMATCH") !== -1 &&
    intentResult.writeCount === 0, JSON.stringify(intentResult));
  check("FI_INTENTb", artifactCounts(intentFixture).receipts === 1);
  var intentResume = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-intent-1"),
    treasuryT4Runtime_({ fixture: intentFixture }));
  check("FI_INTENTc", intentResume.status === "DONE" &&
    intentResume.writeCount === save.FRESH_WRITE_COUNT, JSON.stringify(intentResume));

  // FI11 after batch dispatch (nothing applied, response error) => UNKNOWN,
  // identity preserved, NO autonomous retry inside the call.
  var timeoutRuntime = treasuryT4Runtime_();
  var timeoutEvents = timeoutRuntime.events;
  timeoutRuntime.batch = function(ranges) {
    timeoutEvents.batches.push(ranges);
    throw new Error("ETIMEDOUT");
  };
  var timeoutResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-timeout-1"),
    timeoutRuntime);
  check("FI11a", timeoutResult.status === "UNKNOWN" &&
    timeoutResult.code === codes.BATCH_OUTCOME_UNKNOWN &&
    timeoutResult.writeCount === "UNKNOWN" &&
    timeoutResult.requestKey === "t4-fi-timeout-1" && timeoutResult.operationID !== "" &&
    timeoutResult.receiptID !== "" && timeoutResult.status !== "DONE",
    JSON.stringify(timeoutResult));
  check("FI11b", timeoutEvents.batches.length === 1 && timeoutEvents.cacheCalls === 0 &&
    artifactCounts(timeoutRuntime.spreadsheet).receipts === 1 &&
    readCanonicalTable(timeoutRuntime.spreadsheet, contract.SCHEMAS.OPERATIONS.SHEET,
      contract.SCHEMAS.OPERATIONS.HEADERS)[0].State === "IN_PROGRESS");
  var timeoutResume = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-timeout-1"),
    treasuryT4Runtime_({ fixture: timeoutRuntime.spreadsheet }));
  check("FI11c", timeoutResume.status === "DONE" &&
    timeoutResume.writeCount === save.FRESH_WRITE_COUNT, JSON.stringify(timeoutResume));

  // FI14 after audit (batch APPLIED, response lost) => readback authority:
  // exact artifacts win over the dispatch error -> COMMITTED -> DONE.
  var lostRuntime = treasuryT4Runtime_();
  var innerBatch = lostRuntime.batch;
  lostRuntime.batch = function(ranges) { innerBatch(ranges); throw new Error("ETIMEDOUT_AFTER_APPLY"); };
  var lostResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-lost-1"), lostRuntime);
  check("FI14", lostResult.status === "DONE" && lostResult.writeCount === save.FRESH_WRITE_COUNT &&
    artifactCounts(lostRuntime.spreadsheet).receipts === receiptSheetRows,
    JSON.stringify(lostResult));

  // FI12/FI13 response-boundary partial ambiguity: an injected non-atomic
  // observation applies a subset then fails => PARTIAL => fail closed
  // RECOVERY_REQUIRED, never append blindly on the next call.
  function partialBatchFor_(events, fixture, rangeCount) {
    return function(ranges) {
      events.batches.push(ranges);
      ranges.slice(0, rangeCount).forEach(function(range) {
        var sheet = fixture.getSheetByName(range.range);
        var cols = range.values[0] ? range.values[0].length : 0;
        sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, cols).setValues(range.values);
        events.appliedRows += range.values.length;
      });
      throw new Error("SIMULATED_PARTIAL_APPLY");
    };
  }
  var partialReceiptRuntime = treasuryT4Runtime_();
  var partialReceiptFixture = partialReceiptRuntime.spreadsheet;
  partialReceiptRuntime.batch = partialBatchFor_(partialReceiptRuntime.events,
    partialReceiptFixture, 1);
  var partialReceiptResult = treasuryReceiptSaveWithRuntime_(
    treasuryT4Payload_("t4-fi-partial-r"), partialReceiptRuntime);
  check("FI12a", partialReceiptResult.status === "RECOVERY_REQUIRED" &&
    partialReceiptResult.code === codes.ARTIFACTS_INCOMPLETE &&
    String(partialReceiptResult.detail).indexOf("JOURNAL") !== -1 &&
    String(partialReceiptResult.detail).indexOf("AUDIT") !== -1,
    JSON.stringify(partialReceiptResult));
  var partialReceiptCounts = JSON.stringify(treasuryT4RowCounts_(partialReceiptFixture));
  var partialReceiptReplay = treasuryReceiptSaveWithRuntime_(
    treasuryT4Payload_("t4-fi-partial-r"),
    treasuryT4Runtime_({ fixture: partialReceiptFixture }));
  check("FI12b", partialReceiptReplay.status === "RECOVERY_REQUIRED" &&
    partialReceiptReplay.code === codes.ARTIFACTS_INCOMPLETE &&
    JSON.stringify(treasuryT4RowCounts_(partialReceiptFixture)) === partialReceiptCounts,
    JSON.stringify(partialReceiptReplay));

  var partialLedgerRuntime = treasuryT4Runtime_();
  var partialLedgerFixture = partialLedgerRuntime.spreadsheet;
  partialLedgerRuntime.batch = partialBatchFor_(partialLedgerRuntime.events,
    partialLedgerFixture, 2);
  var partialLedgerResult = treasuryReceiptSaveWithRuntime_(
    treasuryT4Payload_("t4-fi-partial-l"), partialLedgerRuntime);
  check("FI13a", partialLedgerResult.status === "RECOVERY_REQUIRED" &&
    partialLedgerResult.code === codes.ARTIFACTS_INCOMPLETE &&
    String(partialLedgerResult.detail) === "AUDIT", JSON.stringify(partialLedgerResult));
  var partialLedgerCounts = JSON.stringify(treasuryT4RowCounts_(partialLedgerFixture));
  var partialLedgerReplay = treasuryReceiptSaveWithRuntime_(
    treasuryT4Payload_("t4-fi-partial-l"),
    treasuryT4Runtime_({ fixture: partialLedgerFixture }));
  check("FI13b", partialLedgerReplay.status === "RECOVERY_REQUIRED" &&
    JSON.stringify(treasuryT4RowCounts_(partialLedgerFixture)) === partialLedgerCounts);

  // FI16 signature verification: tampered receipt signature cell is caught by
  // the dedicated recomputation step (inspect excludes that column); a
  // tampered ledger row is caught as content tampering. Neither ever replays.
  var sigRuntime = treasuryT4Runtime_();
  var sigFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-sig-1"), sigRuntime);
  check("FI16a", sigFirst.status === "DONE");
  var sigFixture = sigRuntime.spreadsheet;
  var receiptSheet = sigFixture.getSheetByName("TreasuryReceipts");
  receiptSheet.values[1][contract.SCHEMAS.RECEIPTS.HEADERS.indexOf("JournalSignature")] =
    "FORGED-SIGNATURE";
  var sigReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-sig-1"),
    treasuryT4Runtime_({ fixture: sigFixture }));
  check("FI16b", sigReplay.status === "RECOVERY_REQUIRED" &&
    sigReplay.code === codes.JOURNAL_SIGNATURE_INVALID &&
    String(sigReplay.detail) === "RECEIPT_SIGNATURE_MISMATCH", JSON.stringify(sigReplay));
  // Restore the original signature from the persisted plan (content exact).
  var sigOperations = readCanonicalTable(sigFixture, contract.SCHEMAS.OPERATIONS.SHEET,
    contract.SCHEMAS.OPERATIONS.HEADERS);
  receiptSheet.values[1][contract.SCHEMAS.RECEIPTS.HEADERS.indexOf("JournalSignature")] =
    JSON.parse(sigOperations[0].OperationPlan).journalSignature;
  var tamperLedgerRuntime = treasuryT4Runtime_();
  var tamperFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-sig-2"),
    tamperLedgerRuntime);
  check("FI16c", tamperFirst.status === "DONE");
  var tamperLedgerFixture = tamperLedgerRuntime.spreadsheet;
  tamperLedgerFixture.getSheetByName("BalanceLedger").values[4]
    [BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf("Credit")] = 1;
  var tamperLedgerReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-sig-2"),
    treasuryT4Runtime_({ fixture: tamperLedgerFixture }));
  check("FI16d", tamperLedgerReplay.status === "RECOVERY_REQUIRED" &&
    String(tamperLedgerReplay.detail).indexOf("JOURNAL_TAMPERED") !== -1,
    JSON.stringify(tamperLedgerReplay));
  // After restoring the signature cell, the sig-1 fixture replays DONE
  // (tamper was reverted; no append ever happened).
  var sigRestored = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-sig-1"),
    treasuryT4Runtime_({ fixture: sigFixture }));
  check("FI16e", sigRestored.status === "DONE" && sigRestored.replay === true &&
    sigRestored.writeCount === 0, JSON.stringify(sigRestored));

  // FI19 COMMITTED readback: commit write failure and commit readback
  // mismatch both return UNKNOWN (never DONE), then recover exactly once.
  var commitWriteRuntime = treasuryT4Runtime_();
  var originalUpdate = treasuryOperationUpdate_;
  var updateFails = true;
  treasuryOperationUpdate_ = function() {
    if (updateFails) throw new Error("SIMULATED_UPDATE_TRANSPORT_FAILED");
    return originalUpdate.apply(null, arguments);
  };
  var commitWriteResult;
  try {
    commitWriteResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-cw-1"),
      commitWriteRuntime);
  } finally { treasuryOperationUpdate_ = originalUpdate; }
  check("FI19a", commitWriteResult.status === "UNKNOWN" &&
    commitWriteResult.code === codes.SAVE_EXECUTION_UNKNOWN &&
    commitWriteResult.writeCount === save.FRESH_WRITE_COUNT &&
    commitWriteResult.requestKey === "t4-fi-cw-1", JSON.stringify(commitWriteResult));
  check("FI19b", artifactCounts(commitWriteRuntime.spreadsheet).receipts === receiptSheetRows &&
    readCanonicalTable(commitWriteRuntime.spreadsheet, contract.SCHEMAS.OPERATIONS.SHEET,
      contract.SCHEMAS.OPERATIONS.HEADERS)[0].State === "IN_PROGRESS");
  var commitWriteResume = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-cw-1"),
    treasuryT4Runtime_({ fixture: commitWriteRuntime.spreadsheet }));
  check("FI19c", commitWriteResume.status === "DONE" &&
    commitWriteResume.replay === true && commitWriteResume.writeCount === 0,
    JSON.stringify(commitWriteResume));

  var commitReadRuntime = treasuryT4Runtime_();
  var armed = true;
  treasuryOperationFind_ = function(ss, operationType, requestKey) {
    var row = originalFind(ss, operationType, requestKey);
    if (armed && row && String(row.State) === "COMMITTED") {
      armed = false;
      return Object.assign({}, row, { State: "IN_PROGRESS" });
    }
    return row;
  };
  var commitReadResult;
  try {
    commitReadResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-cr-1"),
      commitReadRuntime);
  } finally { treasuryOperationFind_ = originalFind; }
  check("FI19d", commitReadResult.status === "UNKNOWN" &&
    commitReadResult.code === codes.READBACK_INCOMPLETE &&
    String(commitReadResult.detail).indexOf("COMMIT_READBACK_MISMATCH") !== -1,
    JSON.stringify(commitReadResult));
  check("FI19e", readCanonicalTable(commitReadRuntime.spreadsheet,
    contract.SCHEMAS.OPERATIONS.SHEET, contract.SCHEMAS.OPERATIONS.HEADERS)[0].State ===
    "COMMITTED");
  var commitReadResume = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-cr-1"),
    treasuryT4Runtime_({ fixture: commitReadRuntime.spreadsheet }));
  check("FI19f", commitReadResume.status === "DONE" && commitReadResume.replay === true &&
    commitReadResume.writeCount === 0, JSON.stringify(commitReadResume));

  // Artifact readback IO failure while IN_PROGRESS and while COMMITTED =>
  // explicit UNKNOWN (never DONE from status alone); restored readback
  // recovers deterministically with the original key.
  var ioRuntime = treasuryT4Runtime_({ fixture: treasuryT4SeededFixture_(),
    crash: "T4_AFTER_INTENT" });
  try { treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-io-1"), ioRuntime); }
  catch (ignoredIo) {}
  var ioReceipts = ioRuntime.spreadsheet.getSheetByName("TreasuryReceipts");
  var originalGetDataRange = ioReceipts.getDataRange;
  ioReceipts.getDataRange = function() { throw new Error("SIMULATED_READBACK_IO"); };
  var ioCounts = JSON.stringify(treasuryT4RowCounts_(ioRuntime.spreadsheet));
  var ioUnknown = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-io-1"),
    treasuryT4Runtime_({ fixture: ioRuntime.spreadsheet }));
  check("FI_IO1", ioUnknown.status === "UNKNOWN" &&
    ioUnknown.code === codes.READBACK_INCOMPLETE &&
    ioUnknown.requestKey === "t4-fi-io-1" && ioUnknown.operationID !== "" &&
    JSON.stringify(treasuryT4RowCounts_(ioRuntime.spreadsheet)) === ioCounts,
    JSON.stringify(ioUnknown));
  ioReceipts.getDataRange = originalGetDataRange;
  var ioResume = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-io-1"),
    treasuryT4Runtime_({ fixture: ioRuntime.spreadsheet }));
  check("FI_IO2", ioResume.status === "DONE" &&
    ioResume.writeCount === save.FRESH_WRITE_COUNT, JSON.stringify(ioResume));

  // Corrupt persisted plan => fail closed OPERATION_PLAN_MALFORMED, zero writes.
  var corruptRuntime = treasuryT4Runtime_({ fixture: treasuryT4SeededFixture_(),
    crash: "T4_AFTER_INTENT" });
  try { treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-plan-1"), corruptRuntime); }
  catch (ignoredPlan) {}
  var corruptOps = corruptRuntime.spreadsheet.getSheetByName("TreasuryOperations");
  var corruptPlan = JSON.parse(corruptOps.values[1][6]);
  corruptPlan.actor = "evil@intruder.test";
  corruptOps.values[1][6] = JSON.stringify(corruptPlan);
  var corruptCounts = JSON.stringify(treasuryT4RowCounts_(corruptRuntime.spreadsheet));
  var corruptResume = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-plan-1"),
    treasuryT4Runtime_({ fixture: corruptRuntime.spreadsheet }));
  check("FI_PLAN1", corruptResume.status === "RECOVERY_REQUIRED" &&
    corruptResume.code === codes.OPERATION_PLAN_MALFORMED &&
    String(corruptResume.detail) === "RECEIPT_ROW_MISMATCH" &&
    JSON.stringify(treasuryT4RowCounts_(corruptRuntime.spreadsheet)) === corruptCounts,
    JSON.stringify(corruptResume));

  // Corrupted persisted State => OPERATION_STATE_CORRUPTED, never committed.
  var stateRuntime = treasuryT4Runtime_({ fixture: treasuryT4SeededFixture_(),
    crash: "T4_AFTER_INTENT" });
  try { treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-state-1"), stateRuntime); }
  catch (ignoredState) {}
  stateRuntime.spreadsheet.getSheetByName("TreasuryOperations").values[1][4] = "BOGUS";
  var stateCounts = JSON.stringify(treasuryT4RowCounts_(stateRuntime.spreadsheet));
  var stateResume = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-state-1"),
    treasuryT4Runtime_({ fixture: stateRuntime.spreadsheet }));
  check("FI_STATE1", stateResume.status === "RECOVERY_REQUIRED" &&
    stateResume.code === codes.OPERATION_STATE_CORRUPTED &&
    String(stateResume.detail) === "STATE:BOGUS" &&
    JSON.stringify(treasuryT4RowCounts_(stateRuntime.spreadsheet)) === stateCounts,
    JSON.stringify(stateResume));

  // COMMITTED with artifacts missing/tampered => fail closed, no re-append.
  var goneRuntime = treasuryT4Runtime_();
  var goneFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-gone-1"), goneRuntime);
  check("FI_GONE0", goneFirst.status === "DONE");
  save.WRITE_SURFACES.forEach(function(name) {
    goneRuntime.spreadsheet.getSheetByName(name).values.splice(1);
  });
  var goneCounts = JSON.stringify(treasuryT4RowCounts_(goneRuntime.spreadsheet));
  var goneReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-gone-1"),
    treasuryT4Runtime_({ fixture: goneRuntime.spreadsheet }));
  check("FI_GONE1", goneReplay.status === "RECOVERY_REQUIRED" &&
    goneReplay.code === codes.ARTIFACTS_INCOMPLETE &&
    goneReplay.requestKey === "t4-fi-gone-1" && goneReplay.operationID !== "" &&
    JSON.stringify(treasuryT4RowCounts_(goneRuntime.spreadsheet)) === goneCounts,
    JSON.stringify(goneReplay));
  check("FI_GONE2", readCanonicalTable(goneRuntime.spreadsheet,
    contract.SCHEMAS.OPERATIONS.SHEET, contract.SCHEMAS.OPERATIONS.HEADERS)[0].State ===
    "COMMITTED");
  // Tampered audit after DONE => conflict-class fail closed.
  var auditRuntime = treasuryT4Runtime_();
  var auditFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-audit-1"), auditRuntime);
  check("FI_AUDIT0", auditFirst.status === "DONE");
  auditRuntime.spreadsheet.getSheetByName("TreasuryAudits").values[1]
    [contract.SCHEMAS.AUDITS.HEADERS.indexOf("Actor")] = "evil@intruder.test";
  var auditCounts = JSON.stringify(treasuryT4RowCounts_(auditRuntime.spreadsheet));
  var auditReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-audit-1"),
    treasuryT4Runtime_({ fixture: auditRuntime.spreadsheet }));
  check("FI_AUDIT1", auditReplay.status === "RECOVERY_REQUIRED" &&
    String(auditReplay.detail).indexOf("AUDIT_TAMPERED") !== -1 &&
    JSON.stringify(treasuryT4RowCounts_(auditRuntime.spreadsheet)) === auditCounts,
    JSON.stringify(auditReplay));
  // Planned journal LineID owned by a foreign row => identity conflict.
  var ownerRuntime = treasuryT4Runtime_();
  var ownerFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-owner-1"), ownerRuntime);
  check("FI_OWNER0", ownerFirst.status === "DONE");
  var ownerLedger = ownerRuntime.spreadsheet.getSheetByName("BalanceLedger");
  var foreignJournal = ownerLedger.values[ownerLedger.getLastRow() - 1].slice();
  foreignJournal[0] = "FOREIGN-J";
  ownerLedger.getRange(ownerLedger.getLastRow() + 1, 1, 1, foreignJournal.length)
    .setValues([foreignJournal]);
  var ownerReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-fi-owner-1"),
    treasuryT4Runtime_({ fixture: ownerRuntime.spreadsheet }));
  check("FI_OWNER1", ownerReplay.status === "RECOVERY_REQUIRED" &&
    String(ownerReplay.detail).indexOf("JOURNAL_LINE_CROSS_OWNER") !== -1,
    JSON.stringify(ownerReplay));
  return { total: 71, pass: pass, fail: 71 - pass };
}
// ---------------------------------------------------------------------------
// Suite F — integrity: deterministic identities, exact COMMITTED readback,
// full cross-link chain, signature authority, immutable receipt shape.
// ---------------------------------------------------------------------------
function testTreasuryT4Integrity() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, contract = TREASURY_RECEIPT_V1_CONTRACT;
  var runtime = treasuryT4Runtime_(), fixture = runtime.spreadsheet;
  var result = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_(), runtime);
  check("F1", result.status === "DONE");
  var opSchema = contract.SCHEMAS.OPERATIONS, receiptHeaders = contract.SCHEMAS.RECEIPTS.HEADERS,
    auditHeaders = contract.SCHEMAS.AUDITS.HEADERS;
  var operations = readCanonicalTable(fixture, opSchema.SHEET, opSchema.HEADERS);
  var receipts = readCanonicalTable(fixture, contract.SCHEMAS.RECEIPTS.SHEET, receiptHeaders);
  var audits = readCanonicalTable(fixture, contract.SCHEMAS.AUDITS.SHEET, auditHeaders);
  var ledger = treasuryT4LedgerRows_(fixture);
  var journal = ledger.filter(function(row) { return row.SourceID === result.receiptID; });
  // Deterministic T3 ID derivations reproduce every persisted identity.
  check("F2", treasuryOperationId(save.OPERATION_TYPE, "t4-key-001") === result.operationID &&
    treasuryReceiptId(save.OPERATION_TYPE, "t4-key-001", "PRIMARY") === result.receiptID &&
    treasuryJournalId(save.OPERATION_TYPE, "t4-key-001", "PRIMARY") === result.journalID &&
    treasuryAuditId(save.OPERATION_TYPE, "t4-key-001", "PRIMARY") === result.auditID &&
    result.operationID.indexOf("TROP-") === 0 && result.receiptID.indexOf("TRC-") === 0 &&
    result.journalID.indexOf("TRJ-") === 0 && result.auditID.indexOf("TRA-") === 0);
  // Cross-link chain: RequestKey -> OperationID -> ReceiptID -> JournalID ->
  // AuditID -> RecognitionID -> OrderID, all mutually consistent.
  var op = operations[0], receipt = receipts[0], audit = audits[0];
  check("F3", op.RequestKey === "t4-key-001" && receipt.OperationID === op.TreasuryOperationID &&
    receipt.TreasuryReceiptID === audit.TreasuryReceiptID &&
    receipt.JournalID === audit.JournalID && audit.OperationID === op.TreasuryOperationID &&
    audit.RequestKey === op.RequestKey && receipt.RecognitionID === audit.RecognitionID &&
    journal.length === 2 && journal.every(function(row) {
      return row.SourceType === "TREASURY_RECEIPT_V1" && row.JournalID === receipt.JournalID;
    }));
  // Exact COMMITTED readback: full ten-field row equals the expected commit.
  check("F4", op.State === "COMMITTED" && opSchema.HEADERS.length === 10 &&
    op.LastError === "" && op.PayloadHash === audit.PayloadHash);
  // Receipt immutability shape: 24 columns, no stored Status, exact plan row.
  var plan = JSON.parse(op.OperationPlan);
  check("F5", receiptHeaders.length === 24 && receiptHeaders.indexOf("Status") === -1 &&
    auditHeaders.length === 11 &&
    treasuryReceiptRowExact_(receipt, plan.receiptRow, receiptHeaders) &&
    treasuryReceiptRowExact_(audit, plan.auditRow, auditHeaders) &&
    journal.every(function(row, index) {
      return treasuryReceiptRowExact_(row, plan.journalRows[index],
        BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
    }));
  // Signature verified from persisted rows (plan + receipt + recomputation).
  var recomputed = treasuryJournalSignature(journal);
  check("F6", recomputed === plan.journalSignature &&
    receipt.JournalSignature === recomputed &&
    treasuryReceiptVerifySignature_(plan, fixture).status === "PASS");
  // Plan self-verification and persisted digest remain valid after commit.
  check("F7", treasuryReceiptVerifyPlan_(plan).ok === true && plan.planDigest !== "" &&
    plan.normalizedPayload.requestKey === "t4-key-001");
  // Journal balance + forbidden accounts structurally impossible.
  var debit = 0, credit = 0;
  journal.forEach(function(row) { debit += Number(row.Debit); credit += Number(row.Credit); });
  check("F8", debit === 24000 && credit === 24000 &&
    journal.map(function(row) { return String(row.AccountCode); }).sort().join(",") === "1000,1030");
  // Re-derivation of the exposure after commit: outstanding now 0 (T4 view).
  var after = treasuryComputeOutstanding_("SCR-U3-ORD-T4-1", 24000, fixture, "");
  check("F9", after.outstanding === 0 && after.activeClearings === 24000);
  return { total: 9, pass: pass, fail: 9 - pass };
}

// ---------------------------------------------------------------------------
// Suite G — isolation: Sales/Payment/Settlement/Inventory/Purchase/tab*
// untouched, no legacy writer reachable, financial non-impact proven on the
// ledger (1030 reduced by exactly X; Revenue/HPP/Inventory untouched).
// ---------------------------------------------------------------------------
function testTreasuryT4Isolation() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, contract = TREASURY_RECEIPT_V1_CONTRACT;
  var runtime = treasuryT4Runtime_(), fixture = runtime.spreadsheet;
  var isolated = ["Orders", "OrderLines", "SalesRecognitionEvents",
    "SalesRecognitionAudits", "TransactionOperations", "Payments", "Settlements",
    "tabsal", "tabops", "InventoryLedger", "PurchaseEvents", "Accounts", "Products",
    "ProductPricing", "Logs"];
  var before = u3SheetSnapshot_(fixture, isolated);
  var sumsBefore = treasuryT4AccountSums_(fixture);
  var result = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_(), runtime);
  check("G1", result.status === "DONE");
  var after = u3SheetSnapshot_(fixture, isolated);
  check("G2", after === before, "isolated sheet snapshot changed");
  // Exact delta surfaces only: WRITE_SURFACES + TreasuryOperations.
  check("G3", runtime.events.appliedRows === 4 && runtime.events.batches.length === 1 &&
    runtime.events.batches[0].map(function(range) { return range.range; }).join(",") ===
    save.WRITE_SURFACES.join(","));
  // Financial non-impact: before 1030 Dr 24000 -> after Cash/Bank Dr 24000 +
  // 1030 Cr 24000 (net 0); Revenue/4000/HPP/5000/1100/6210/2010/2000/Inventory
  // byte-identical sums.
  var sumsAfter = treasuryT4AccountSums_(fixture);
  function unchanged(code) {
    var a = sumsBefore[code] || { debit: 0, credit: 0 };
    var b = sumsAfter[code] || { debit: 0, credit: 0 };
    return a.debit === b.debit && a.credit === b.credit;
  }
  check("G4", sumsBefore["1030"].debit === 24000 && sumsBefore["1030"].credit === 0 &&
    sumsAfter["1030"].debit === 24000 && sumsAfter["1030"].credit === 24000 &&
    (sumsAfter["1030"].debit - sumsAfter["1030"].credit) === 0 &&
    (sumsAfter["1000"].debit - sumsAfter["1000"].credit) === 24000,
    JSON.stringify({ before: sumsBefore, after: sumsAfter }));
  check("G5", ["4000", "5000", "1100", "6210", "2010", "2000", "1500"].every(unchanged) &&
    unchanged("1030") === false,
    JSON.stringify(sumsAfter));
  // Every ledger row outside the treasury journal is untouched.
  var ledger = treasuryT4LedgerRows_(fixture);
  var nonTreasury = ledger.filter(function(row) {
    return String(row.SourceType) !== "TREASURY_RECEIPT_V1";
  });
  check("G6", nonTreasury.length === 2 &&
    nonTreasury.every(function(row) { return String(row.MovementType) === "SALES_RECOGNITION"; }));
  // Source audit: no legacy writer, no legacy vocabulary, no host-local date,
  // no production transport misuse; core T4 authorities present.
  var source = typeof _treasuryDurableSource === "string" ? _treasuryDurableSource : "";
  check("G7", source.length > 0, "source injection missing");
  var forbidden = ["cashSettleAndPersist", "attemptCashSettlement", "runCashSettleAndPersist",
    "ReceiveVia", "PaymentMethod", "canonicalDateKey(", "appendRow(", "getUuid",
    "UrlFetchApp", "clasp", "Payments", "Settlements", "tabsal", "tabops", "settlement"];
  forbidden.forEach(function(token, index) {
    check("G8." + index, source.indexOf(token) === -1, "forbidden token: " + token);
  });
  var required = ["waitLock(30000)", "releaseLock", "salesProjectionVerifyV2Event_",
    "treasuryJournalSignature(", "validateTreasurySchemaHeaders", "treasuryDestinationEligible",
    "treasuryClearingPreflight", "invalidateDashboardCache", "treasuryValidateReceiptDate",
    "transactionPayloadHash_", "inventoryReceiptMigrationRequest_", ":batchUpdate",
    "TREASURY_RECEIPT_SAVE", "IN_PROGRESS", "COMMITTED"];
  required.forEach(function(token, index) {
    check("G9." + index, source.indexOf(token) !== -1, "required token: " + token);
  });
  // Module writes only its three surfaces + the TreasuryOperations intent row.
  check("G10", source.indexOf("setValue(") === -1 && source.indexOf("appendRow") === -1 &&
    source.indexOf("createSheet") === -1 && source.indexOf("insertSheet") === -1);
  // No reversal/correction writer exists in T4 (T6 boundary): the module only
  // ever authorizes TREASURY_RECEIPT_SAVE operations.
  check("G11", source.indexOf("TREASURY_RECEIPT_REVERSE") === -1 &&
    source.indexOf("TREASURY_RECEIPT_CORRECT") === -1);
  return { total: 10 + 2 * (forbidden.length + required.length), pass: pass,
    fail: 10 + 2 * (forbidden.length + required.length) - pass };
}
// ---------------------------------------------------------------------------
// Suite H — cache invalidation: ONLY post-commit DONE touches the cache;
// refusals/conflicts/UNKNOWN/RECOVERY_REQUIRED never do; a cache failure can
// never convert a committed mutation into a retryable failure (U4 lesson).
// ---------------------------------------------------------------------------
function testTreasuryT4Cache() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;

  // H1 fresh commit => exactly one invalidation.
  var freshRuntime = treasuryT4Runtime_();
  var fresh = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-01"), freshRuntime);
  check("H1", fresh.status === "DONE" && freshRuntime.events.cacheCalls === 1);
  // H2 REFUSED => none.
  var refusedRuntime = treasuryT4Runtime_({ fixture: freshRuntime.spreadsheet });
  var refused = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-02",
    { grossAmount: 1 }), refusedRuntime);
  check("H2", refused.status === "REFUSED" && refusedRuntime.events.cacheCalls === 0);
  // H3 CONFLICT => none.
  var conflictRuntime = treasuryT4Runtime_({ fixture: freshRuntime.spreadsheet });
  var conflict = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-01",
    { evidenceRef: "OTHER-EVIDENCE-9" }), conflictRuntime);
  check("H3", conflict.status === "CONFLICT" && conflictRuntime.events.cacheCalls === 0);
  // H4 UNKNOWN (batch outcome lost) => none — never advertises DONE.
  var unknownRuntime = treasuryT4Runtime_();
  unknownRuntime.batch = function() { throw new Error("ETIMEDOUT"); };
  var unknown = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-04"), unknownRuntime);
  check("H4", unknown.status === "UNKNOWN" && unknown.status !== "DONE" &&
    unknownRuntime.events.cacheCalls === 0);
  // H5 RECOVERY_REQUIRED => none.
  var recoveryRuntime = treasuryT4Runtime_();
  var recoveryFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-05"), recoveryRuntime);
  check("H5a", recoveryFirst.status === "DONE");
  recoveryRuntime.spreadsheet.getSheetByName("TreasuryAudits").values[1]
    [contract.SCHEMAS.AUDITS.HEADERS.indexOf("Actor")] = "tampered@actor.test";
  var replayRuntime = treasuryT4Runtime_({ fixture: recoveryRuntime.spreadsheet });
  var recovery = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-05"), replayRuntime);
  check("H5b", recovery.status === "RECOVERY_REQUIRED" &&
    replayRuntime.events.cacheCalls === 0);
  // H6 committed replay => re-invalidation allowed (still zero writes).
  var reinvalidateRuntime = treasuryT4Runtime_({ fixture: freshRuntime.spreadsheet });
  var reinvalidate = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-01"),
    reinvalidateRuntime);
  check("H6", reinvalidate.status === "DONE" && reinvalidate.replay === true &&
    reinvalidateRuntime.events.cacheCalls === 1 &&
    reinvalidateRuntime.events.appliedRows === 0);
  // H7 cache failure must NOT convert committed DONE into a retryable failure.
  var cacheFailRuntime = treasuryT4Runtime_({ cacheFail: true });
  var cacheFail = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-07"), cacheFailRuntime);
  check("H7", cacheFail.status === "DONE" && cacheFail.writeCount === save.FRESH_WRITE_COUNT &&
    cacheFailRuntime.events.cacheCalls === 1, JSON.stringify(cacheFail));
  // H8 recovery that finishes the commit transition also invalidates (DONE).
  var finishRuntime = treasuryT4Runtime_({ fixture: treasuryT4SeededFixture_(),
    crash: "T4_AFTER_BATCH" });
  try { treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-08"), finishRuntime); }
  catch (ignoredFinish) {}
  var finishResumeRuntime = treasuryT4Runtime_({ fixture: finishRuntime.spreadsheet });
  var finish = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-08"), finishResumeRuntime);
  check("H8", finish.status === "DONE" && finishResumeRuntime.events.cacheCalls === 1 &&
    finishResumeRuntime.events.appliedRows === 0, JSON.stringify(finish));
  // H9 pre-mutation failure surfaces never invalidate: PREPARED refused.
  var preparedRuntime = treasuryT4Runtime_({ fixture: freshRuntime.spreadsheet,
    config: { mode: "PREPARED", contractVersion: "TREASURY_RECEIPT_V1",
      activationID: "", activatedAt: "", configVersion: 1 } });
  var prepared = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-h-09"), preparedRuntime);
  check("H9", prepared.status === "REFUSED" && prepared.code === codes.NOT_ACTIVATED &&
    preparedRuntime.events.cacheCalls === 0);
  return { total: 11, pass: pass, fail: 11 - pass };
}

// ---------------------------------------------------------------------------
// Suite I — 1030 CashFlowGroup hard gate: exact semantics proved from the
// existing Finance Cash Flow source, enforced fail-closed by the T3 preflight
// inside the T4 writer. Account 1030 is never mutated by any test.
// ---------------------------------------------------------------------------
function testTreasuryT4CashFlowGroupGate() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var codes = TREASURY_RECEIPT_V1_SAVE.CODES;
  // I1 prove semantics from the Finance source itself: cash movements are
  // classified by the counterpart account's CashFlowGroup; blank counterpart
  // group => UNCLASSIFIED_COUNTERPART (movement dropped) => hard gate.
  var cashFlowSource = buildCashFlowStatement.toString();
  check("I1a", cashFlowSource.indexOf("CashFlowGroup") !== -1 &&
    cashFlowSource.indexOf("UNCLASSIFIED_COUNTERPART") !== -1 &&
    cashFlowSource.indexOf('"Operating"') !== -1 &&
    cashFlowSource.indexOf('["1000", "1010", "1020"]') !== -1);
  // I2 correct group => gate passes and the receipt posts.
  var runtime = treasuryT4Runtime_();
  var result = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-i-02"), runtime);
  check("I2", result.status === "DONE" && result.writeCount === 4);
  // I3 functional classification proof: after the receipt, the TRJ journal's
  // cash line is classified Operating (counterpart 1030) — exactly once.
  var accounts = readCanonicalTable(runtime.spreadsheet, "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  var statement = buildCashFlowStatement(treasuryT4LedgerRows_(runtime.spreadsheet), accounts,
    { startDate: "2026-10-01", endDate: "2026-10-31", label: "T4" }, null);
  check("I3", statement.operating === 24000 && statement.netChange === 24000,
    JSON.stringify({ operating: statement.operating, net: statement.netChange }));
  // I4-I6 blank / wrong / malformed group => fail closed, zero writes.
  function gateRefused(id, groupValue) {
    var fixture = treasuryT4SeededFixture_();
    var sheet = fixture.getSheetByName("Accounts");
    var idx = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("CashFlowGroup");
    sheet.values.forEach(function(row, index) {
      if (index > 0 && String(row[0]) === "1030") row[idx] = groupValue;
    });
    var gateRuntime = treasuryT4Runtime_({ fixture: fixture });
    var before = JSON.stringify(treasuryT4RowCounts_(fixture));
    var gateResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-" + id), gateRuntime);
    check(id + "a", gateResult.status === "REFUSED" &&
      gateResult.code === codes.SCHEMA_NOT_READY && gateResult.writeCount === 0 &&
      String(gateResult.detail).indexOf("CASH_FLOW_GROUP_UNCLASSIFIED") !== -1,
      JSON.stringify(gateResult));
    check(id + "b", gateRuntime.events.batches.length === 0 &&
      JSON.stringify(treasuryT4RowCounts_(fixture)) === before);
  }
  gateRefused("I4", "");
  gateRefused("I5", "Investing");
  gateRefused("I6", 123);
  // I7 inactive 1030 fails the same preflight (never mutated).
  var inactiveFixture = treasuryT4SeededFixture_();
  var inactiveSheet = inactiveFixture.getSheetByName("Accounts");
  var activeIdx = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("IsActive");
  var groupCodeIdx = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("AccountCode");
  inactiveSheet.values.forEach(function(row, index) {
    if (index > 0 && String(row[groupCodeIdx]) === "1030") row[activeIdx] = false;
  });
  var inactiveRuntime = treasuryT4Runtime_({ fixture: inactiveFixture });
  var inactiveResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-i-07"),
    inactiveRuntime);
  check("I7", inactiveResult.status === "REFUSED" &&
    inactiveResult.code === codes.SCHEMA_NOT_READY &&
    String(inactiveResult.detail).indexOf("INACTIVE") !== -1 &&
    inactiveRuntime.events.batches.length === 0, JSON.stringify(inactiveResult));
  return { total: 12, pass: pass, fail: 12 - pass };
}
// ---------------------------------------------------------------------------
// Suite J — mutation sensitivity: 25 in-memory mutations of the durable Save
// contract; each MUST be caught by the real module behavior (or its frozen
// source structure). No mutation touches source or any external state, and
// nothing mutated is left behind.
// ---------------------------------------------------------------------------
function testTreasuryT4MutationSensitivity() {
  var pass = 0;
  function check(id, value, detail) { treasuryT4Check_(id, value, detail); pass++; }
  var save = TREASURY_RECEIPT_V1_SAVE, codes = save.CODES,
    contract = TREASURY_RECEIPT_V1_CONTRACT;
  var source = typeof _treasuryDurableSource === "string" ? _treasuryDurableSource : "";
  var wrapperSource = treasuryReceiptDurableSave.toString();

  // M1 remove ScriptLock: wrapper must own waitLock(30000) + releaseLock in
  // finally, exactly ONE lock acquisition exists in the module (the wrapper),
  // and the core never locks (no nested-lock downgrade).
  var coreSourceOnly = treasuryReceiptSaveWithRuntime_.toString() +
    treasuryReceiptNewIntent_.toString() + treasuryReceiptResume_.toString() +
    treasuryReceiptApplyBatch_.toString() + treasuryReceiptCommit_.toString();
  check("M1", wrapperSource.indexOf("waitLock(30000)") !== -1 &&
    wrapperSource.indexOf("releaseLock") !== -1 && wrapperSource.indexOf("finally") !== -1 &&
    wrapperSource.indexOf("save.CODES.LOCK_TIMEOUT") !== -1 &&
    coreSourceOnly.indexOf("waitLock") === -1 && coreSourceOnly.indexOf("releaseLock") === -1 &&
    (source.match(/waitLock/g) || []).length === 1);

  // M2 lookup-after-planning: RequestKey lookup must precede exposure reads.
  var traceFixture = treasuryT4SeededFixture_();
  var trace = treasuryT4TraceDataReads_(traceFixture);
  var traceResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m2-01"),
    treasuryT4Runtime_({ fixture: traceFixture }));
  check("M2", traceResult.status === "DONE" && trace[0] === "TreasuryOperations" &&
    trace.indexOf("SalesRecognitionEvents") > trace.indexOf("TreasuryOperations"),
    trace.join(","));

  // M3 allow PREPARED: must refuse NOT_ACTIVATED with zero writes.
  var preparedRuntime = treasuryT4Runtime_({ config: { mode: "PREPARED",
    contractVersion: "TREASURY_RECEIPT_V1", activationID: "", activatedAt: "",
    configVersion: 1 } });
  var prepared = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m3-01"), preparedRuntime);
  check("M3", prepared.status === "REFUSED" && prepared.code === codes.NOT_ACTIVATED &&
    prepared.writeCount === 0 && preparedRuntime.events.batches.length === 0);

  // M4 allow PAUSED (new write) — AND the T2 recovery distinction: PAUSED
  // must still complete a persisted IN_PROGRESS operation.
  var pausedRuntime = treasuryT4Runtime_({ config: Object.assign(
    treasuryT4ActiveConfig_(), { mode: "PAUSED" }) });
  var paused = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m4-01"), pausedRuntime);
  var pausedIntent = treasuryT4Runtime_({ fixture: treasuryT4SeededFixture_(),
    crash: "T4_AFTER_INTENT" });
  try { treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m4-02"), pausedIntent); }
  catch (ignoredPaused) {}
  var pausedRecovery = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m4-02"),
    treasuryT4Runtime_({ fixture: pausedIntent.spreadsheet,
      config: Object.assign(treasuryT4ActiveConfig_(), { mode: "PAUSED" }) }));
  check("M4", paused.status === "REFUSED" && paused.code === codes.MODE_PAUSED &&
    paused.writeCount === 0 && pausedRuntime.events.batches.length === 0 &&
    pausedRecovery.status === "DONE" && pausedRecovery.writeCount === save.FRESH_WRITE_COUNT,
    JSON.stringify({ paused: paused, recovery: pausedRecovery }));

  // M5 bypass schema gate: a renamed Treasury header must refuse.
  var schemaFixture = treasuryT4SeededFixture_();
  schemaFixture.getSheetByName("TreasuryOperations").values[0][4] = "StateRenamed";
  var schemaResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m5-01"),
    treasuryT4Runtime_({ fixture: schemaFixture }));
  check("M5", schemaResult.status === "REFUSED" &&
    schemaResult.code === codes.SCHEMA_NOT_READY);

  // M6 bypass destination eligibility: forbidden account must refuse.
  var destinationResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m6-01",
    { destinationAccountCode: "4000" }), treasuryT4Runtime_());
  check("M6", destinationResult.status === "REFUSED" &&
    destinationResult.code === codes.INVALID_DESTINATION_ACCOUNT);

  // M7 bypass 1030 CashFlowGroup: blank group must refuse, zero writes.
  var groupFixture = treasuryT4SeededFixture_();
  var groupSheet = groupFixture.getSheetByName("Accounts");
  var groupIdx = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("CashFlowGroup");
  groupSheet.values.forEach(function(row, index) {
    if (index > 0 && String(row[0]) === "1030") row[groupIdx] = "";
  });
  var groupRuntime = treasuryT4Runtime_({ fixture: groupFixture });
  var groupResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m7-01"), groupRuntime);
  check("M7", groupResult.status === "REFUSED" &&
    groupResult.code === codes.SCHEMA_NOT_READY && groupResult.writeCount === 0 &&
    groupRuntime.events.batches.length === 0);

  // M8 allow partial: partial artifacts must fail closed, never DONE.
  var partialRuntime = treasuryT4Runtime_();
  var partialFixture = partialRuntime.spreadsheet;
  partialRuntime.batch = function(ranges) {
    partialRuntime.events.batches.push(ranges);
    var range = ranges[0];
    var sheet = partialFixture.getSheetByName(range.range);
    sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, range.values[0].length)
      .setValues(range.values);
    throw new Error("SIMULATED_PARTIAL_APPLY");
  };
  var partial = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m8-01"), partialRuntime);
  check("M8", partial.status === "RECOVERY_REQUIRED" &&
    partial.code === codes.ARTIFACTS_INCOMPLETE && partial.status !== "DONE");

  // M9 allow second receipt: exposure already cleared => no second receipt.
  var clearedFixture = treasuryT4SeededFixture_();
  var clearedFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m9-01"),
    treasuryT4Runtime_({ fixture: clearedFixture }));
  var clearedSecond = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m9-02"),
    treasuryT4Runtime_({ fixture: clearedFixture }));
  check("M9", clearedFirst.status === "DONE" && clearedSecond.status === "REFUSED" &&
    clearedSecond.code === codes.ALREADY_CLEARED &&
    readCanonicalTable(clearedFixture, contract.SCHEMAS.RECEIPTS.SHEET,
      contract.SCHEMAS.RECEIPTS.HEADERS).length === 1);

  // M10 remove IN_PROGRESS intent: the durable op row must exist (with zero
  // business artifacts) BEFORE the batch runs.
  var intentRuntime = treasuryT4Runtime_({ fixture: treasuryT4SeededFixture_(),
    crash: "T4_BEFORE_BATCH" });
  var intentThrew = null;
  try { treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m10-01"), intentRuntime); }
  catch (error) { intentThrew = error; }
  var intentOps = readCanonicalTable(intentRuntime.spreadsheet,
    contract.SCHEMAS.OPERATIONS.SHEET, contract.SCHEMAS.OPERATIONS.HEADERS);
  check("M10", !!intentThrew && intentOps.length === 1 &&
    intentOps[0].State === "IN_PROGRESS" &&
    intentRuntime.spreadsheet.getSheetByName("TreasuryReceipts").getLastRow() === 1);

  // M11 split atomic mutation: ONE batch call must carry all three surfaces
  // (4 rows) — no four independent appends.
  var atomicRuntime = treasuryT4Runtime_();
  var atomic = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m11-01"), atomicRuntime);
  check("M11", atomic.status === "DONE" && atomicRuntime.events.batches.length === 1 &&
    atomicRuntime.events.batches[0].length === 3 &&
    atomicRuntime.events.appliedRows === 4 &&
    atomicRuntime.events.batches[0].map(function(range) { return range.range; }).join(",") ===
    save.WRITE_SURFACES.join(","));

  // M12 skip receipt readback: a missing receipt row must fail replay.
  var noReceiptRuntime = treasuryT4Runtime_();
  var noReceiptFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m12-01"),
    noReceiptRuntime);
  noReceiptRuntime.spreadsheet.getSheetByName("TreasuryReceipts").values.splice(1);
  var noReceiptReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m12-01"),
    treasuryT4Runtime_({ fixture: noReceiptRuntime.spreadsheet }));
  check("M12", noReceiptFirst.status === "DONE" &&
    noReceiptReplay.status === "RECOVERY_REQUIRED" &&
    noReceiptReplay.code === codes.ARTIFACTS_INCOMPLETE);

  // M13 skip signature: a tampered receipt signature cell must fail replay.
  var sigRuntime = treasuryT4Runtime_();
  var sigFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m13-01"), sigRuntime);
  var sigSheet = sigRuntime.spreadsheet.getSheetByName("TreasuryReceipts");
  sigSheet.values[1][contract.SCHEMAS.RECEIPTS.HEADERS.indexOf("JournalSignature")] = "FORGED";
  var sigReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m13-01"),
    treasuryT4Runtime_({ fixture: sigRuntime.spreadsheet }));
  check("M13", sigFirst.status === "DONE" && sigReplay.status === "RECOVERY_REQUIRED" &&
    sigReplay.code === codes.JOURNAL_SIGNATURE_INVALID);

  // M14 skip audit verification: a tampered audit row must fail replay.
  var auditRuntime = treasuryT4Runtime_();
  var auditFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m14-01"), auditRuntime);
  auditRuntime.spreadsheet.getSheetByName("TreasuryAudits").values[1]
    [contract.SCHEMAS.AUDITS.HEADERS.indexOf("PayloadHash")] = "FORGED-HASH";
  var auditReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m14-01"),
    treasuryT4Runtime_({ fixture: auditRuntime.spreadsheet }));
  check("M14", auditFirst.status === "DONE" && auditReplay.status === "RECOVERY_REQUIRED" &&
    String(auditReplay.detail).indexOf("AUDIT_TAMPERED") !== -1);

  // M15 DONE before COMMITTED: DONE may only be returned when the persisted
  // operation reads back COMMITTED with exact artifacts.
  var commitGateRuntime = treasuryT4Runtime_();
  var commitGateResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m15-01"),
    commitGateRuntime);
  var commitGateOps = readCanonicalTable(commitGateRuntime.spreadsheet,
    contract.SCHEMAS.OPERATIONS.SHEET, contract.SCHEMAS.OPERATIONS.HEADERS);
  var sourceImpliesOrder = treasuryReceiptApplyBatch_.toString()
      .indexOf('runtime.crash("T4_BEFORE_COMMIT")') <
    treasuryReceiptApplyBatch_.toString().indexOf("treasuryReceiptCommit_") &&
    treasuryReceiptApplyBatch_.toString().indexOf("return outcome(save.STATUS.DONE") >
    treasuryReceiptApplyBatch_.toString().indexOf("treasuryReceiptCommit_");
  check("M15", commitGateResult.status === "DONE" && commitGateOps[0].State === "COMMITTED" &&
    sourceImpliesOrder);

  // M16 replay append: exact replay must append zero rows.
  var replayFixture = clearedFixture;
  var replayCounts = JSON.stringify(treasuryT4RowCounts_(replayFixture));
  var replayRuntime = treasuryT4Runtime_({ fixture: replayFixture });
  var replay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m9-01"), replayRuntime);
  check("M16", replay.status === "DONE" && replay.replay === true && replay.writeCount === 0 &&
    replayRuntime.events.appliedRows === 0 &&
    JSON.stringify(treasuryT4RowCounts_(replayFixture)) === replayCounts);

  // M17 new-key double clear: second key on cleared exposure => refused,
  // one operation row, one receipt.
  check("M17", clearedSecond.code === codes.ALREADY_CLEARED && clearedSecond.writeCount === 0 &&
    readCanonicalTable(clearedFixture, contract.SCHEMAS.OPERATIONS.SHEET,
      contract.SCHEMAS.OPERATIONS.HEADERS).length === 1);

  // M18 stale outstanding under concurrency: an advisory pre-read value can
  // never authorize a second clearing — in-lock re-read wins.
  var staleFixture = treasuryT4SeededFixture_();
  var advisory = treasuryComputeOutstanding_("SCR-U3-ORD-T4-1", 24000, staleFixture, "");
  var staleFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m18-01",
    { grossAmount: advisory.outstanding }), treasuryT4Runtime_({ fixture: staleFixture }));
  var staleSecond = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m18-02",
    { grossAmount: advisory.outstanding }), treasuryT4Runtime_({ fixture: staleFixture }));
  check("M18", staleFirst.status === "DONE" && staleSecond.status === "REFUSED" &&
    staleSecond.code === codes.ALREADY_CLEARED);

  // M19 write 4000 not 1030: the plan verifier rejects a mutated clearing
  // leg, and a tampered persisted ledger leg fails replay.
  var tamperedPlan = JSON.parse(readCanonicalTable(staleFixture,
    contract.SCHEMAS.OPERATIONS.SHEET, contract.SCHEMAS.OPERATIONS.HEADERS)[0].OperationPlan);
  tamperedPlan.journalRows[1].AccountCode = "4000";
  var planVerdict = treasuryReceiptVerifyPlan_(tamperedPlan);
  check("M19a", planVerdict.ok === false &&
    planVerdict.reason === "JOURNAL_ACCOUNT_MAPPING_MISMATCH",
    JSON.stringify(planVerdict));
  var wrongAccountRuntime = treasuryT4Runtime_();
  var wrongAccountFirst = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m19-01"),
    wrongAccountRuntime);
  var wrongAccountLedger = wrongAccountRuntime.spreadsheet.getSheetByName("BalanceLedger");
  wrongAccountLedger.values[wrongAccountLedger.getLastRow() - 1]
    [BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf("AccountCode")] = "4000";
  var wrongAccountReplay = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m19-01"),
    treasuryT4Runtime_({ fixture: wrongAccountRuntime.spreadsheet }));
  check("M19b", wrongAccountFirst.status === "DONE" &&
    wrongAccountReplay.status === "RECOVERY_REQUIRED" &&
    String(wrongAccountReplay.detail).indexOf("JOURNAL_TAMPERED") !== -1,
    JSON.stringify(wrongAccountReplay));

  // M20 legacy Settlement path: no fallback route exists in the refusal
  // envelope or the module source.
  var legacyProbe = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m20-01",
    { destinationAccountCode: "1100" }), treasuryT4Runtime_());
  check("M20", legacyProbe.status === "REFUSED" &&
    !Object.prototype.hasOwnProperty.call(legacyProbe, "fallback") &&
    !Object.prototype.hasOwnProperty.call(legacyProbe, "legacy") &&
    source.indexOf("cashSettleAndPersist") === -1 &&
    source.indexOf("attemptCashSettlement") === -1 &&
    source.indexOf("Settlements") === -1);

  // M21 mutate SalesRecognitionEvent: the Save must leave Sales artifacts
  // byte-identical.
  var salesFixture = treasuryT4SeededFixture_();
  var salesBefore = u3SheetSnapshot_(salesFixture,
    ["SalesRecognitionEvents", "SalesRecognitionAudits", "Orders", "OrderLines",
      "TransactionOperations"]);
  var salesResult = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m21-01"),
    treasuryT4Runtime_({ fixture: salesFixture }));
  check("M21", salesResult.status === "DONE" &&
    u3SheetSnapshot_(salesFixture, ["SalesRecognitionEvents", "SalesRecognitionAudits",
      "Orders", "OrderLines", "TransactionOperations"]) === salesBefore);

  // M22 invalidate before commit: UNKNOWN outcomes must not touch the cache.
  var preCommitRuntime = treasuryT4Runtime_();
  preCommitRuntime.batch = function() { throw new Error("ETIMEDOUT"); };
  var preCommit = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m22-01"),
    preCommitRuntime);
  check("M22", preCommit.status === "UNKNOWN" &&
    preCommitRuntime.events.cacheCalls === 0);

  // M23 cache-failure -> retryable: a cache error must never convert a
  // committed DONE into a retryable failure.
  var cacheFailRuntime = treasuryT4Runtime_({ cacheFail: true });
  var cacheFail = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m23-01"),
    cacheFailRuntime);
  check("M23", cacheFail.status === "DONE" && cacheFail.writeCount === save.FRESH_WRITE_COUNT &&
    cacheFailRuntime.events.cacheCalls === 1, JSON.stringify(cacheFail));

  // M24 host-local date: EconomicDate derives from the operator's Asia/Jakarta
  // ReceiptDate, never from the server instant (UTC-host boundary lesson).
  var boundaryRuntime = treasuryT4Runtime_({
    now: function() { return new Date("2026-09-30T17:00:00.000Z"); } });
  var boundary = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m24-01",
    { receiptDate: "2026-10-01" }), boundaryRuntime);
  var boundaryOps = readCanonicalTable(boundaryRuntime.spreadsheet,
    contract.SCHEMAS.OPERATIONS.SHEET, contract.SCHEMAS.OPERATIONS.HEADERS);
  var boundaryPlan = JSON.parse(boundaryOps[0].OperationPlan);
  check("M24", boundary.status === "DONE" && boundaryPlan.economicDate === "2026-10-01" &&
    boundaryPlan.receiptDate === "2026-10-01" &&
    boundaryPlan.receiptRow.EconomicDate === "2026-10-01" &&
    source.indexOf("canonicalDateKey(") === -1 && source.indexOf("getMonth(") === -1,
    JSON.stringify({ economicDate: boundaryPlan.economicDate }));

  // M25 blank EvidenceRef: refused before any read or write.
  var blankEvidenceRuntime = treasuryT4Runtime_();
  var blankEvidence = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t4-m25-01",
    { evidenceRef: "   " }), blankEvidenceRuntime);
  check("M25", blankEvidence.status === "REFUSED" &&
    blankEvidence.code === codes.EVIDENCE_REF_INVALID && blankEvidence.writeCount === 0 &&
    blankEvidenceRuntime.events.batches.length === 0);
  return { total: 25, pass: pass, fail: 25 - pass };
}
