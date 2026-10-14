// T11.13/U10 — dedicated TRANSITIONAL_CLEARING_CLOSE writer tests (task
// Phases 3-10 matrix): happy path + exact journal, fail-closed preflight
// refusals (zero write), durability (replay / ALREADY_COMMITTED / ambiguous
// transport / partial / tamper / duplicate), T5 + reader integration (CLEARED
// from the canonical journal, 1030 zero, 1040 +once, Revenue/P&L untouched,
// Cash Flow counted exactly once, U9-style Sale untouched), forbidden
// artifact audits, static source audits, and the T11-13 retirement gate
// (production entry + write wiring removed; frozen retirement invariant
// proven statically + zero-write dynamic probe; historical accounting
// assertions unweakened). In-memory fixtures only; no production access, no
// network, no clasp, no config writes. The production writer is NEVER
// invoked; construction uses the injected-runtime core against fixtures.

function trccCheck_(id, value, detail) {
  if (!value) throw new Error("U10_TRANSITIONAL_CLOSE:" + id +
    (detail === undefined ? "" : "|" + detail));
}

// Fixture sheets: Treasury T4 base (full sheet inventory incl. Treasury* and
// the Sales authority tables) + the frozen §11 1040 account.
function trccSheets_(mutate) {
  var sheets = treasuryT4BaseSheets_();
  t11PushAccount_(sheets, t11Account1040_());
  if (mutate) mutate(sheets);
  return sheets;
}

// Seeds the REAL frozen transitional exposure through the committed-U3
// artifact builder: op + audit + event + SRV2J- Dr1030/Cr4000 24,000 journal
// + order lineage, with the exact production identities.
function trccTransitionalSeed_(fixture) {
  return u3CommittedAppend_(fixture, {
    orderID: "ORD-677BE5CE-SALESRECOGNI",
    recognitionID: "SCR-CE122B27-ORD677BE5CES",
    revisionID: "REV-CE122B27-ORD677BE5CE",
    amount: 24000, date: "2026-10-05",
    recognizedAt: "2026-10-05T03:00:00.000Z",
    requestKey: "u2-transitional-ce122b27"
  });
}

function trccFixture_(mutate, postSeed) {
  var fixture = salesV2SaveFixture_(trccSheets_(mutate));
  trccTransitionalSeed_(fixture);
  if (postSeed) postSeed(fixture);
  return fixture;
}

// A U9-style genuine Sale: committed V2 recognition of Rp120,000 plus its
// composed SALES_MONEY_V2 leg (Dr1040/Cr1030) with the canonical
// SRV2M journal identity — the close must leave every byte of it untouched.
function trccU9StyleSale_(fixture) {
  var seeded = u3CommittedAppend_(fixture, {
    orderID: "ORD-U9STYLE-0003", amount: 120000, date: "2026-10-12",
    recognizedAt: "2026-10-12T03:00:00.000Z", requestKey: "u3-u9style-0003"
  });
  var moneyJournal = transactionStableBootstrapId_(
    SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_JOURNAL_PREFIX, ["ORD-U9STYLE-0003"]);
  u3AppendLedger_(fixture, [
    { JournalID: moneyJournal, LineID: moneyJournal + "-1", Tanggal: "2026-10-12",
      AccountCode: "1040", Debit: 120000, Credit: 0,
      MovementType: SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_MOVEMENT_TYPE,
      SourceType: SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_SOURCE_TYPE,
      SourceID: seeded.recognitionID },
    { JournalID: moneyJournal, LineID: moneyJournal + "-2", Tanggal: "2026-10-12",
      AccountCode: "1030", Debit: 0, Credit: 120000,
      MovementType: SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_MOVEMENT_TYPE,
      SourceType: SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_SOURCE_TYPE,
      SourceID: seeded.recognitionID }
  ]);
  return seeded;
}

// Post-seed contamination shapes for the refusal matrix. Every seed is a
// legitimate-looking artifact set that must make the close refuse BEFORE any
// write of its own.
function trccApplyAfterSeed_(fixture, seed) {
  if (seed === "moneyLeg") {
    // A fully valid composed money leg bound to the transitional recognition
    // (canonical SRV2M journal identity): the exposure is already CLEARED.
    var moneyJournal = transactionStableBootstrapId_(
      SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_JOURNAL_PREFIX,
      ["ORD-677BE5CE-SALESRECOGNI"]);
    u3AppendLedger_(fixture, [
      { JournalID: moneyJournal, LineID: moneyJournal + "-1", Tanggal: "2026-10-13",
        AccountCode: "1040", Debit: 24000, Credit: 0,
        MovementType: SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_MOVEMENT_TYPE,
        SourceType: SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_SOURCE_TYPE,
        SourceID: "SCR-CE122B27-ORD677BE5CES" },
      { JournalID: moneyJournal, LineID: moneyJournal + "-2", Tanggal: "2026-10-13",
        AccountCode: "1030", Debit: 0, Credit: 24000,
        MovementType: SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_MOVEMENT_TYPE,
        SourceType: SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_SOURCE_TYPE,
        SourceID: "SCR-CE122B27-ORD677BE5CES" }
    ]);
  } else if (seed === "receipt") {
    u3AppendRow_(fixture, "TreasuryReceipts",
      TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.RECEIPTS.HEADERS,
      { TreasuryReceiptID: "TR-U10-SEED-1",
        RecognitionID: "SCR-CE122B27-ORD677BE5CES" });
  } else if (seed === "foreignOp") {
    u3AppendOperation_(fixture, {
      OperationID: "TXOP-FOREIGN-CLOSE", OperationType: "TRANSITIONAL_CLEARING_CLOSE",
      BusinessID: "SCR-CE122B27-ORD677BE5CES", RequestKey: "TRCC-OTHER-KEY",
      State: "COMMITTED", PayloadHash: "H-X", OperationPlan: "{}",
      CreatedAt: "2026-10-13T00:00:00.000Z", UpdatedAt: "2026-10-13T00:00:00.000Z",
      LastError: "" });
  } else if (seed === "strayCloseLines") {
    u3AppendLedger_(fixture, [
      { JournalID: "TRCC-FOREIGN-1", LineID: "TRCC-FOREIGN-1-1", Tanggal: "2026-10-13",
        AccountCode: "1040", Debit: 24000, Credit: 0,
        MovementType: "TRANSITIONAL_CLEARING_CLOSE",
        SourceType: "TRANSITIONAL_CLEARING_CLOSE",
        SourceID: "SCR-CE122B27-ORD677BE5CES" },
      { JournalID: "TRCC-FOREIGN-1", LineID: "TRCC-FOREIGN-1-2", Tanggal: "2026-10-13",
        AccountCode: "1030", Debit: 0, Credit: 24000,
        MovementType: "TRANSITIONAL_CLEARING_CLOSE",
        SourceType: "TRANSITIONAL_CLEARING_CLOSE",
        SourceID: "SCR-CE122B27-ORD677BE5CES" }
    ]);
  } else if (seed === "contaminated1030") {
    // An extra 1030 movement outside the canonical writer set: the frozen
    // pre-state (LedgerNet1030 / exception amount) no longer matches.
    u3AppendLedger_(fixture, [
      { JournalID: "JF-FOREIGN-1030", LineID: "JF-FOREIGN-1030-1", Tanggal: "2026-10-13",
        AccountCode: "1030", Debit: 0, Credit: 5000,
        MovementType: "PAID_SALE", SourceType: "SALE_SETTLEMENT", SourceID: "PAY-X" }
    ]);
  }
}

function trccRuntime_(options) {
  options = options || {};
  var fixture = options.fixture || trccFixture_(options.mutate, options.postSeed);
  if (options.afterSeed) trccApplyAfterSeed_(fixture, options.afterSeed);
  var events = { batches: [], appliedRows: 0, cacheCalls: 0 };
  var crashPoint = options.crash || null;
  var runtime = {
    spreadsheet: fixture,
    singleCommitConfig: Object.prototype.hasOwnProperty.call(options, "config") ?
      options.config : t11ConfigRaw_("ACTIVE"),
    now: options.now || function() { return new Date("2026-10-14T02:03:04.000Z"); },
    actor: function() { return "tester@numlock.test"; },
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
      sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, cols)
        .setValues(range.values);
      events.appliedRows += range.values.length;
    });
  };
  return runtime;
}

function trccLedger_(fixture) {
  return readCanonicalTable(fixture, "BalanceLedger",
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
}
function trccOperations_(fixture) {
  return readCanonicalTable(fixture, "TransactionOperations",
    TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
}
function trccLogs_(fixture) {
  return readCanonicalTable(fixture, "Logs", CANONICAL_ENTRY.LOG_HEADERS);
}
function trccRowCounts_(fixture) {
  var names = ["Orders", "OrderLines", "TransactionOperations",
    "SalesRecognitionEvents", "SalesRecognitionAudits", "BalanceLedger", "Accounts",
    "Logs", "Payments", "Settlements", "tabsal", "tabops", "InventoryLedger",
    "PurchaseEvents", "TreasuryReceipts", "TreasuryOperations", "TreasuryAudits"];
  var out = {};
  names.forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    out[name] = sheet ? sheet.getLastRow() : -1;
  });
  return out;
}
function trccCloseLines_(fixture) {
  return trccLedger_(fixture).filter(function(row) {
    return String(row.SourceType || "") === "TRANSITIONAL_CLEARING_CLOSE";
  });
}
// Byte snapshot over the three write surfaces: proves a refusal wrote nothing.
function trccSurfaceSnapshot_(fixture) {
  return JSON.stringify(["TransactionOperations", "BalanceLedger", "Logs"].map(
    function(name) {
      var sheet = fixture.getSheetByName(name);
      return sheet ? sheet.values : null;
    }));
}
function trccAccountNet_(fixture, code) {
  return trccLedger_(fixture).reduce(function(sum, row) {
    if (!isCanonicalActive(row.IsActive) || String(row.AccountCode) !== code) {
      return sum;
    }
    return sum + (Number(row.Debit) || 0) - (Number(row.Credit) || 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Happy path: ONE atomic commit, exact journal/operation/audit artifacts,
// deterministic identity, zero-parameter frozen surface.
// ---------------------------------------------------------------------------
function testTransitionalCloseHappyPath() {
  var pass = 0;
  function check(id, value, detail) { trccCheck_(id, value, detail); pass++; }
  var close = TRANSITIONAL_CLEARING_CLOSE_V1;
  var runtime = trccRuntime_();
  var fixture = runtime.spreadsheet;
  var before = trccRowCounts_(fixture);
  var result = transitionalClearingCloseWithRuntime_(runtime);

  // H1 envelope + deterministic identity (derived from the frozen transition,
  // never from a caller argument or the clock).
  check("H1", result.status === close.STATUS.DONE && result.code === "" &&
    result.replay === false && result.writeCount === 4 &&
    result.requestKey === "TRCC-SCR-CE122B27-ORD677BE5CES" &&
    result.journalID === "TRCC-SCR-CE122B27-ORD677BE5CES" &&
    result.recognitionID === "SCR-CE122B27-ORD677BE5CES" &&
    result.orderID === "ORD-677BE5CE-SALESRECOGNI" &&
    result.amount === 24000 && result.economicDate === "2026-10-14" &&
    result.operationID === transactionOperationID_(
      close.OPERATION_TYPE, "TRCC-SCR-CE122B27-ORD677BE5CES") &&
    result.auditID === transactionStableBootstrapId_("TRCCA-",
      ["TRCC-SCR-CE122B27-ORD677BE5CES"]),
    JSON.stringify(result));

  // H2 exact delta: +1 operation / +2 ledger lines / +1 log; everything else
  // byte-identical (append-only; no Sales/Treasury/Payment/Settlement surface).
  var after = trccRowCounts_(fixture);
  check("H2", after.TransactionOperations === before.TransactionOperations + 1 &&
    after.BalanceLedger === before.BalanceLedger + 2 &&
    after.Logs === before.Logs + 1 &&
    ["Orders", "OrderLines", "SalesRecognitionEvents", "SalesRecognitionAudits",
      "Accounts", "Payments", "Settlements", "tabsal", "tabops", "InventoryLedger",
      "PurchaseEvents", "TreasuryReceipts", "TreasuryOperations", "TreasuryAudits"]
      .every(function(name) { return after[name] === before[name]; }),
    JSON.stringify({ before: before, after: after }));

  // H3 exact journal: exactly two lines, Dr1040 24,000 / Cr1030 24,000,
  // balanced, same JournalID, canonical source keys, action-date Tanggal.
  var closeLines = trccCloseLines_(fixture);
  var debit = closeLines.filter(function(r) { return String(r.AccountCode) === "1040"; });
  var credit = closeLines.filter(function(r) { return String(r.AccountCode) === "1030"; });
  check("H3", closeLines.length === 2 && debit.length === 1 && credit.length === 1 &&
    Number(debit[0].Debit) === 24000 && Number(debit[0].Credit) === 0 &&
    Number(credit[0].Debit) === 0 && Number(credit[0].Credit) === 24000 &&
    closeLines.every(function(r) {
      return r.JournalID === "TRCC-SCR-CE122B27-ORD677BE5CES" &&
        r.MovementType === "TRANSITIONAL_CLEARING_CLOSE" &&
        r.SourceType === "TRANSITIONAL_CLEARING_CLOSE" &&
        r.SourceID === "SCR-CE122B27-ORD677BE5CES" &&
        r.ExternalRef === "TRCC-SCR-CE122B27-ORD677BE5CES" &&
        String(r.Tanggal) === "2026-10-14" && isCanonicalActive(r.IsActive) &&
        String(r.CreatedBy) === "tester@numlock.test";
    }) &&
    debit[0].LineID === "TRCC-SCR-CE122B27-ORD677BE5CES-1" &&
    credit[0].LineID === "TRCC-SCR-CE122B27-ORD677BE5CES-2",
    JSON.stringify(closeLines));

  // H4 operation authority: exactly one COMMITTED row, exact plan digest.
  var operations = trccOperations_(fixture).filter(function(op) {
    return String(op.OperationType || "") === "TRANSITIONAL_CLEARING_CLOSE";
  });
  check("H4", operations.length === 1 && operations[0].State === "COMMITTED" &&
    operations[0].BusinessID === "SCR-CE122B27-ORD677BE5CES" &&
    operations[0].RequestKey === "TRCC-SCR-CE122B27-ORD677BE5CES" &&
    String(operations[0].LastError || "") === "" &&
    JSON.parse(operations[0].OperationPlan).journalID ===
      "TRCC-SCR-CE122B27-ORD677BE5CES",
    JSON.stringify(operations));

  // H5 audit row: truthful internal attestation only — no fabricated
  // external evidence, no payment/channel/destination/settlement claim.
  var logs = trccLogs_(fixture).filter(function(row) {
    return String(row.Module || "") === "TransitionalClearingClose";
  });
  var metadata = logs.length === 1 ? JSON.parse(logs[0].Metadata) : null;
  check("H5", logs.length === 1 && String(logs[0].Action) === "TRANSITIONAL_CLEARING_CLOSE" &&
    logs[0].RecordID === "TRCC-SCR-CE122B27-ORD677BE5CES" &&
    String(logs[0].Level) === "INFO" &&
    metadata.attestation === "OWNER_AUTHORIZED_INTERNAL_ARCHITECTURE_TRANSITION" &&
    metadata.recognitionID === "SCR-CE122B27-ORD677BE5CES" &&
    metadata.amount === 24000 && metadata.debitAccountCode === "1040" &&
    metadata.creditAccountCode === "1030" &&
    metadata.serverTimestamp === "2026-10-14T02:03:04.000Z" &&
    ["evidenceRef", "EvidenceRef", "paymentMethod", "channel", "destination",
      "settlementID", "treasuryReceiptID", "receiveVia"].every(function(token) {
      return logs[0].Metadata.indexOf(token) === -1;
    }),
    logs.length ? logs[0].Metadata : "NO_LOG");

  // H6 ONE atomic batch: a single call, exactly the three frozen surfaces
  // (operation authority + two ledger lines + audit), never a second write.
  check("H6", runtime.events.batches.length === 1 &&
    JSON.stringify(runtime.events.batches[0].map(function(r) { return r.range; })) ===
      JSON.stringify(["TransactionOperations", "BalanceLedger", "Logs"]) &&
    runtime.events.batches[0][0].values.length === 1 &&
    runtime.events.batches[0][1].values.length === 2 &&
    runtime.events.batches[0][2].values.length === 1,
    JSON.stringify(runtime.events.batches.map(function(b) {
      return b.map(function(r) { return r.range + ":" + r.values.length; });
    })));

  // H7 frozen surface (construction core): the injected-runtime core takes
  // only the runtime and ignores any extra argument; amount and identities
  // are frozen constants — no caller can move them. Production
  // callability of the retired entry is asserted by
  // testTransitionalCloseRetirement (entry absent), not here.
  check("H7", transitionalClearingCloseWithRuntime_.length === 1 &&
    close.AMOUNT === 24000 && close.MONEY_ACCOUNT_CODE === "1040" &&
    close.CLEARING_ACCOUNT_CODE === "1030" &&
    close.RECOGNITION_ID === "SCR-CE122B27-ORD677BE5CES" &&
    close.ORDER_ID === "ORD-677BE5CE-SALESRECOGNI" &&
    close.SOURCE_TYPE === "TRANSITIONAL_CLEARING_CLOSE",
    "frozen surface");

  // Extra-argument invocation on a fresh fixture still writes exactly the
  // frozen 24,000 journal (the second parameter is ignored by construction).
  var runtime2 = trccRuntime_();
  var result2 = transitionalClearingCloseWithRuntime_(runtime2, {
    amount: 1, accountCode: "1000", recognitionID: "SCR-EVIL" });
  check("H8", result2.status === close.STATUS.DONE &&
    trccCloseLines_(runtime2.spreadsheet).length === 2 &&
    trccAccountNet_(runtime2.spreadsheet, "1040") === 24000 &&
    trccAccountNet_(runtime2.spreadsheet, "1030") === 0,
    JSON.stringify(result2));

  console.log("U10_TRANSITIONAL_CLOSE_HAPPY checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Fail-closed preflight matrix: every wrong state refuses with ZERO WRITE.
// ---------------------------------------------------------------------------
function testTransitionalClosePreflightRefusals() {
  var pass = 0;
  function check(id, value, detail) { trccCheck_(id, value, detail); pass++; }
  var close = TRANSITIONAL_CLEARING_CLOSE_V1, codes = close.CODES;

  function refused_(id, options, expectedCode) {
    var runtime = trccRuntime_(options);
    var before = trccRowCounts_(runtime.spreadsheet);
    var surfacesBefore = trccSurfaceSnapshot_(runtime.spreadsheet);
    var result = transitionalClearingCloseWithRuntime_(runtime);
    var after = trccRowCounts_(runtime.spreadsheet);
    check(id, result.status === close.STATUS.REFUSED &&
      result.code === expectedCode &&
      runtime.events.batches.length === 0 &&
      JSON.stringify(before) === JSON.stringify(after) &&
      surfacesBefore === trccSurfaceSnapshot_(runtime.spreadsheet),
      JSON.stringify(result));
  }

  // C1 config matrix: ABSENT / PREPARED / PAUSED / malformed / REJECT all
  // refuse fail-closed (the global control plane stays authoritative and this
  // writer never widens it).
  refused_("C1a", { config: null }, codes.CONFIG_NOT_ACTIVE);
  refused_("C1b", { config: t11ConfigRaw_("PREPARED") }, codes.CONFIG_NOT_ACTIVE);
  refused_("C1c", { config: t11ConfigRaw_("PAUSED") }, codes.CONFIG_NOT_ACTIVE);
  refused_("C1d", { config: "{not-json" }, codes.CONFIG_NOT_ACTIVE);
  refused_("C1e", { config: undefined }, codes.CONFIG_NOT_ACTIVE);

  // C2 1040 matrix: absent / duplicate / inactive / metadata mismatch.
  refused_("C2a", { mutate: function(sheets) {
    sheets.Accounts = sheets.Accounts.filter(function(row) {
      return String(row[0]) !== "1040";
    });
  } }, codes.ACCOUNT_PREFLIGHT_FAILED);
  refused_("C2b", { mutate: function(sheets) {
    t11PushAccount_(sheets, t11Account1040_());
  } }, codes.ACCOUNT_PREFLIGHT_FAILED);
  refused_("C2c", { mutate: function(sheets) {
    sheets.Accounts = sheets.Accounts.map(function(row) {
      if (String(row[0]) !== "1040") return row;
      var copy = row.slice();
      copy[CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("IsActive")] = false;
      return copy;
    });
  } }, codes.ACCOUNT_PREFLIGHT_FAILED);
  refused_("C2d", { mutate: function(sheets) {
    sheets.Accounts = sheets.Accounts.map(function(row) {
      if (String(row[0]) !== "1040") return row;
      var copy = row.slice();
      copy[CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("AccountName")] = "Cash";
      return copy;
    });
  } }, codes.ACCOUNT_PREFLIGHT_FAILED);

  // C3 1030 authority: mutated clearing account refuses.
  refused_("C3", { mutate: function(sheets) {
    sheets.Accounts = sheets.Accounts.map(function(row) {
      if (String(row[0]) !== "1030") return row;
      var copy = row.slice();
      copy[CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("AccountName")] = "Wrong";
      return copy;
    });
  } }, codes.ACCOUNT_PREFLIGHT_FAILED);

  // C4 recognition authority: wrong order, wrong amount, unknown id.
  // (Post-seed mutations — the exposure artifacts are already committed.)
  refused_("C4a", { postSeed: function(fixture) {
    var sheet = fixture.getSheetByName("SalesRecognitionEvents");
    sheet.values[1][SALES_RECOGNITION_V2_CONTRACT.HEADERS.indexOf("OrderID")] =
      "ORD-WRONG";
  } }, codes.RECOGNITION_AUTHORITY_FAILED);
  refused_("C4b", { postSeed: function(fixture) {
    var sheet = fixture.getSheetByName("SalesRecognitionEvents");
    sheet.values[1][SALES_RECOGNITION_V2_CONTRACT.HEADERS.indexOf("Amount")] = 20000;
  } }, codes.AMOUNT_MISMATCH);

  // C5 exposure already cleared by a valid composed money leg: refuses
  // (never a second close over a cleared exposure).
  refused_("C5", { mutate: null, afterSeed: "moneyLeg" }, codes.EXPOSURE_NOT_UNCLEARED);

  // C6 a TreasuryReceipt row for the exposure refuses before any write.
  refused_("C6", { afterSeed: "receipt" }, codes.TREASURY_RECEIPT_EXISTS);

  // C7 prior close artifacts: foreign close operation row / stray close
  // ledger lines refuse (no second close journal ever).
  refused_("C7a", { afterSeed: "foreignOp" }, codes.PRIOR_CLOSE_ARTIFACT_EXISTS);
  refused_("C7b", { afterSeed: "strayCloseLines" }, codes.PRIOR_CLOSE_ARTIFACT_EXISTS);

  // C8 schema: a missing authority/write surface refuses.
  refused_("C8", { mutate: function(sheets) { delete sheets.Logs; } },
    codes.SCHEMA_NOT_READY);

  // C9 global 1030 contamination: an extra 1030 movement breaks the frozen
  // pre-state (LedgerNet1030 / exception amount) and refuses.
  refused_("C9", { afterSeed: "contaminated1030" }, codes.RECONCILIATION_NOT_CLEAN);

  // C10 T11 inactive because the projection itself fails visible: a
  // tampered recognition journal (amount drift on the committed ledger line)
  // refuses via the exposure integrity codes.
  refused_("C10", { postSeed: function(fixture) {
    var sheet = fixture.getSheetByName("BalanceLedger");
    sheet.values[1][BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf("Debit")] =
      23999;
  } }, codes.RECOGNITION_AUTHORITY_FAILED);

  console.log("U10_TRANSITIONAL_CLOSE_REFUSALS checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Durability: replay/ALREADY_COMMITTED, semantic repeat, ambiguous transport
// resolved by readback (never a blind duplicate), partial/failure states,
// tamper and duplicate-operation conflicts.
// ---------------------------------------------------------------------------
function testTransitionalCloseDurability() {
  var pass = 0;
  function check(id, value, detail) { trccCheck_(id, value, detail); pass++; }
  var close = TRANSITIONAL_CLEARING_CLOSE_V1, codes = close.CODES;

  // D1 replay after commit: ALREADY_COMMITTED, zero writes, ONE journal.
  var runtime = trccRuntime_();
  var first = transitionalClearingCloseWithRuntime_(runtime);
  var before = trccRowCounts_(runtime.spreadsheet);
  var replay = transitionalClearingCloseWithRuntime_(runtime);
  check("D1", first.status === close.STATUS.DONE &&
    replay.status === close.STATUS.ALREADY_COMMITTED &&
    replay.replay === true && replay.writeCount === 0 &&
    replay.journalID === first.journalID &&
    runtime.events.batches.length === 1 &&
    JSON.stringify(before) === JSON.stringify(trccRowCounts_(runtime.spreadsheet)) &&
    trccCloseLines_(runtime.spreadsheet).length === 2,
    JSON.stringify(replay));

  // D2 semantic repeat (concurrent second invocation, serialized by the
  // production ScriptLock): same identity, never a second journal.
  var repeat = transitionalClearingCloseWithRuntime_(runtime);
  check("D2", repeat.status === close.STATUS.ALREADY_COMMITTED &&
    trccCloseLines_(runtime.spreadsheet).length === 2 &&
    trccOperations_(runtime.spreadsheet).filter(function(op) {
      return String(op.OperationType || "") === "TRANSITIONAL_CLEARING_CLOSE";
    }).length === 1,
    JSON.stringify(repeat));

  // D3 ambiguous transport with artifacts committed: the batch throws AFTER
  // applying — readback resolves it to the committed result, never UNKNOWN.
  var appliedThenThrew = trccRuntime_();
  appliedThenThrew.batch = function(ranges) {
    appliedThenThrew.events.batches.push(ranges);
    ranges.forEach(function(range) {
      var sheet = appliedThenThrew.spreadsheet.getSheetByName(range.range);
      var cols = range.values[0] ? range.values[0].length : 0;
      sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, cols)
        .setValues(range.values);
    });
    throw new Error("SIMULATED_TRANSPORT_TIMEOUT");
  };
  var ambiguous = transitionalClearingCloseWithRuntime_(appliedThenThrew);
  check("D3", ambiguous.status === close.STATUS.DONE &&
    ambiguous.writeCount === 4 && ambiguous.replay === false &&
    trccCloseLines_(appliedThenThrew.spreadsheet).length === 2,
    JSON.stringify(ambiguous));

  // D4 failed batch with ZERO artifacts: UNKNOWN with identity preserved;
  // the recovery re-invocation commits exactly once (readback proved absence
  // — no blind duplicate, still one journal).
  var failedRuntime = trccRuntime_({
    batch: function() { throw new Error("SIMULATED_BATCH_FAILURE"); }
  });
  var unknown = transitionalClearingCloseWithRuntime_(failedRuntime);
  check("D4a", unknown.status === close.STATUS.UNKNOWN &&
    unknown.code === codes.BATCH_OUTCOME_UNKNOWN &&
    unknown.requestKey === "TRCC-SCR-CE122B27-ORD677BE5CES" &&
    unknown.writeCount === "UNKNOWN" &&
    trccRowCounts_(failedRuntime.spreadsheet).BalanceLedger === 3,
    JSON.stringify(unknown));
  // The transport recovers; the re-invocation with a working batch commits
  // exactly once (readback proved absence — no blind duplicate).
  failedRuntime.batch = function(ranges) {
    failedRuntime.events.batches.push(ranges);
    ranges.forEach(function(range) {
      var sheet = failedRuntime.spreadsheet.getSheetByName(range.range);
      var cols = range.values[0] ? range.values[0].length : 0;
      sheet.getRange(sheet.getLastRow() + 1, 1, range.values.length, cols)
        .setValues(range.values);
    });
  };
  var recovered = transitionalClearingCloseWithRuntime_(failedRuntime);
  check("D4b", recovered.status === close.STATUS.DONE &&
    recovered.writeCount === 4 &&
    trccCloseLines_(failedRuntime.spreadsheet).length === 2,
    JSON.stringify(recovered));

  // D5 PARTIAL state (ledger committed, operation/audit missing — the exact
  // forbidden partial shape can no longer be produced by the writer itself,
  // but a foreign partial still fails visible and never re-batches).
  var partialRuntime = trccRuntime_();
  partialRuntime.batch = function(ranges) {
    var ledgerRange = ranges.filter(function(r) {
      return r.range === "BalanceLedger";
    })[0];
    var sheet = partialRuntime.spreadsheet.getSheetByName("BalanceLedger");
    sheet.getRange(sheet.getLastRow() + 1, 1, ledgerRange.values.length,
      ledgerRange.values[0].length).setValues(ledgerRange.values);
  };
  var partial = transitionalClearingCloseWithRuntime_(partialRuntime);
  check("D5a", partial.status === close.STATUS.RECOVERY_REQUIRED &&
    partial.code === codes.ARTIFACTS_INCOMPLETE,
    JSON.stringify(partial));
  var partialAgain = transitionalClearingCloseWithRuntime_(partialRuntime);
  check("D5b", partialAgain.status === close.STATUS.REFUSED &&
    partialAgain.code === codes.PRIOR_CLOSE_ARTIFACT_EXISTS &&
    trccCloseLines_(partialRuntime.spreadsheet).length === 2,
    JSON.stringify(partialAgain));

  // D6 crash before the batch: zero writes persisted; the clean re-run
  // commits exactly once.
  var crashRuntime = trccRuntime_({ crash: "TRANSITIONAL_CLOSE_BEFORE_BATCH" });
  var crashed = null, crashError = null;
  try { crashed = transitionalClearingCloseWithRuntime_(crashRuntime); }
  catch (error) { crashError = error; }
  check("D6a", crashed === null && crashError && /CRASH/.test(crashError.message) &&
    trccRowCounts_(crashRuntime.spreadsheet).BalanceLedger === 3 &&
    trccCloseLines_(crashRuntime.spreadsheet).length === 0,
    String(crashError && crashError.message));
  var afterCrash = transitionalClearingCloseWithRuntime_(crashRuntime);
  check("D6b", afterCrash.status === close.STATUS.DONE &&
    trccCloseLines_(crashRuntime.spreadsheet).length === 2,
    JSON.stringify(afterCrash));

  // D7 committed op with a tampered payload hash: CONFLICT, zero writes.
  var tamperRuntime = trccRuntime_();
  transitionalClearingCloseWithRuntime_(tamperRuntime);
  var opSheet = tamperRuntime.spreadsheet.getSheetByName("TransactionOperations");
  var opsHeaders = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS;
  var opRowIndex = opSheet.values.findIndex(function(row, i) {
    return i > 0 && String(row[0]).indexOf("TXOP-") === 0 &&
      String(row[opsHeaders.indexOf("OperationType")]) === "TRANSITIONAL_CLEARING_CLOSE";
  });
  opSheet.values[opRowIndex][opsHeaders.indexOf("PayloadHash")] = "H-TAMPERED";
  var tamperedHash = transitionalClearingCloseWithRuntime_(tamperRuntime);
  check("D7a", tamperedHash.status === close.STATUS.CONFLICT &&
    tamperedHash.code === codes.OPERATION_PAYLOAD_CONFLICT,
    JSON.stringify(tamperedHash));
  // Restore the hash, tamper a committed ledger line instead: replay fails
  // visible (IDENTITY_CONFLICT), never repairs, never appends.
  opSheet.values[opRowIndex][opsHeaders.indexOf("PayloadHash")] =
    transitionalClearingClosePayloadHash_();
  var ledgerSheet = tamperRuntime.spreadsheet.getSheetByName("BalanceLedger");
  var ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var closeRow = ledgerSheet.values.findIndex(function(row, i) {
    return i > 0 && String(row[ledgerHeaders.indexOf("SourceType")]) ===
      "TRANSITIONAL_CLEARING_CLOSE" &&
      String(row[ledgerHeaders.indexOf("AccountCode")]) === "1040";
  });
  ledgerSheet.values[closeRow][ledgerHeaders.indexOf("Debit")] = 24001;
  var tamperedLedger = transitionalClearingCloseWithRuntime_(tamperRuntime);
  check("D7b", tamperedLedger.status === close.STATUS.RECOVERY_REQUIRED &&
    tamperedLedger.code === codes.JOURNAL_SIGNATURE_INVALID &&
    tamperedLedger.detail.indexOf("JOURNAL_TAMPERED") !== -1 &&
    trccCloseLines_(tamperRuntime.spreadsheet).length === 2 &&
    trccRowCounts_(tamperRuntime.spreadsheet).BalanceLedger === 5,
    JSON.stringify(tamperedLedger));

  // D8 duplicate operation evidence: two close operation rows fail closed.
  var duplicateRuntime = trccRuntime_();
  var duplicateFixture = duplicateRuntime.spreadsheet;
  u3AppendOperation_(duplicateFixture, {
    OperationID: "TXOP-DUPLICATE-1", OperationType: "TRANSITIONAL_CLEARING_CLOSE",
    BusinessID: "SCR-CE122B27-ORD677BE5CES", RequestKey: "TRCC-SCR-CE122B27-ORD677BE5CES",
    State: "COMMITTED", PayloadHash: "H-X", OperationPlan: "{}",
    CreatedAt: "2026-10-13T00:00:00.000Z", UpdatedAt: "2026-10-13T00:00:00.000Z",
    LastError: "" });
  u3AppendOperation_(duplicateFixture, {
    OperationID: "TXOP-DUPLICATE-2", OperationType: "TRANSITIONAL_CLEARING_CLOSE",
    BusinessID: "SCR-CE122B27-ORD677BE5CES", RequestKey: "TRCC-SCR-CE122B27-ORD677BE5CES",
    State: "COMMITTED", PayloadHash: "H-Y", OperationPlan: "{}",
    CreatedAt: "2026-10-13T00:00:00.000Z", UpdatedAt: "2026-10-13T00:00:00.000Z",
    LastError: "" });
  var duplicate = transitionalClearingCloseWithRuntime_(duplicateRuntime);
  check("D8", duplicate.status === close.STATUS.CONFLICT &&
    duplicate.code === codes.DUPLICATE_OPERATION_EVIDENCE &&
    trccCloseLines_(duplicateFixture).length === 0,
    JSON.stringify(duplicate));

  // D9 committed operation with malformed stored plan: RECOVERY_REQUIRED,
  // never a second batch.
  var malformedRuntime = trccRuntime_();
  transitionalClearingCloseWithRuntime_(malformedRuntime);
  var malformedOps = malformedRuntime.spreadsheet.getSheetByName("TransactionOperations");
  var malformedIndex = malformedOps.values.findIndex(function(row, i) {
    return i > 0 && String(row[opsHeaders.indexOf("OperationType")]) ===
      "TRANSITIONAL_CLEARING_CLOSE";
  });
  malformedOps.values[malformedIndex][opsHeaders.indexOf("OperationPlan")] = "{}";
  var malformed = transitionalClearingCloseWithRuntime_(malformedRuntime);
  check("D9", malformed.status === close.STATUS.RECOVERY_REQUIRED &&
    malformed.code === codes.PLAN_MALFORMED &&
    trccCloseLines_(malformedRuntime.spreadsheet).length === 2,
    JSON.stringify(malformed));

  // D10 committed operation with an unexpected state: CONFLICT, zero repair.
  var stateRuntime = trccRuntime_();
  transitionalClearingCloseWithRuntime_(stateRuntime);
  var stateOps = stateRuntime.spreadsheet.getSheetByName("TransactionOperations");
  var stateIndex = stateOps.values.findIndex(function(row, i) {
    return i > 0 && String(row[opsHeaders.indexOf("OperationType")]) ===
      "TRANSITIONAL_CLEARING_CLOSE";
  });
  stateOps.values[stateIndex][opsHeaders.indexOf("State")] = "IN_PROGRESS";
  var badState = transitionalClearingCloseWithRuntime_(stateRuntime);
  check("D10", badState.status === close.STATUS.CONFLICT &&
    badState.code === codes.INVALID_OPERATION_STATE,
    JSON.stringify(badState));

  console.log("U10_TRANSITIONAL_CLOSE_DURABILITY checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// T5 + reader integration: exposure CLEARED from the canonical journal,
// global 1030/1040 arithmetic, Revenue/P&L untouched, Cash Flow counted
// exactly once, U9-style Sale untouched, forbidden artifacts absent.
// ---------------------------------------------------------------------------
function testTransitionalCloseT5Readers() {
  var pass = 0;
  function check(id, value, detail) { trccCheck_(id, value, detail); pass++; }
  var runtime = trccRuntime_();
  var fixture = runtime.spreadsheet;
  var u9 = trccU9StyleSale_(fixture);
  var eventsBefore = JSON.stringify(readCanonicalTable(fixture,
    "SalesRecognitionEvents", SALES_RECOGNITION_V2_CONTRACT.HEADERS));
  var revenueBefore = trccAccountNet_(fixture, "4000");
  var statementBefore = buildCashFlowStatement(trccLedger_(fixture),
    readCanonicalTable(fixture, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS),
    { startDate: "2026-10-01", endDate: "2026-10-31" }, { openingCash: 0 });

  var result = transitionalClearingCloseWithRuntime_(runtime);
  trccCheck_("P0", result.status === "DONE", JSON.stringify(result));

  // P1 T5 derives CLEARED (24,000) from the canonical close journal: no
  // receipt, no quality codes, no projection adaptation, no hand-edit.
  var exposure = buildTreasuryClearingExposure_(fixture,
    { recognitionID: "SCR-CE122B27-ORD677BE5CES" });
  var row = exposure.row;
  check("P1", exposure.status === "OK" && row.ClearingStatus === "CLEARED" &&
    Number(row.RecognizedAmount) === 24000 &&
    Number(row.ClearedAmount) === 24000 &&
    Number(row.OutstandingAmount) === 0 &&
    Number(row.ActiveReceiptCount) === 0 &&
    (row.QualityCodes || []).length === 0 &&
    row.RecognitionIntegrity === "VALID",
    JSON.stringify(row));

  // P2 global reconciliation: fixture 1030 net zero (Dr 144,000 = transitional
  // 24,000 + U9-style 120,000 recognitions; Cr = close 24,000 + U9-style
  // money leg 120,000), LedgerNet1030 zero, outstanding zero, residual zero,
  // no explicit exception for the close.
  var reconciliation = buildTreasury1030Reconciliation_(fixture, {});
  check("P2", reconciliation.reconciliationStatus === "OK" &&
    Number(reconciliation.ledgerNet1030) === 0 &&
    Number(reconciliation.ledgerDr1030) === 144000 &&
    Number(reconciliation.ledgerCr1030) === 144000 &&
    Number(reconciliation.outstandingTotal) === 0 &&
    Number(reconciliation.unexplainedResidual) === 0 &&
    Number(reconciliation.explicitExceptionAmount) === 0 &&
    reconciliation.exceptionEntries.length === 0,
    JSON.stringify(reconciliation));

  // P3 1040 +24,000 exactly once (the close) + 120,000 (U9-style money leg);
  // the close journal is present exactly once.
  check("P3", trccAccountNet_(fixture, "1040") === 144000 &&
    trccCloseLines_(fixture).length === 2 &&
    trccLedger_(fixture).filter(function(line) {
      return String(line.JournalID || "") === "TRCC-SCR-CE122B27-ORD677BE5CES";
    }).length === 2,
    String(trccAccountNet_(fixture, "1040")));

  // P4 Revenue / P&L / Sales authority untouched: event rows byte-identical,
  // 4000 net unchanged, both recognitions still VALID.
  var eventsAfter = JSON.stringify(readCanonicalTable(fixture,
    "SalesRecognitionEvents", SALES_RECOGNITION_V2_CONTRACT.HEADERS));
  var projection = buildTreasuryClearingProjection_(fixture, {});
  var transitionalRow = projection.rows.filter(function(r) {
    return String(r.RecognitionID) === "SCR-CE122B27-ORD677BE5CES";
  })[0];
  var u9Row = projection.rows.filter(function(r) {
    return String(r.RecognitionID) === u9.recognitionID;
  })[0];
  check("P4", eventsAfter === eventsBefore &&
    trccAccountNet_(fixture, "4000") === revenueBefore &&
    transitionalRow.RecognitionIntegrity === "VALID" &&
    u9Row.RecognitionIntegrity === "VALID",
    JSON.stringify({ revenueBefore: revenueBefore,
      revenueAfter: trccAccountNet_(fixture, "4000") }));

  // P5 Cash Flow: the close counts exactly ONCE as the Operating inflow of
  // the sale's cash lifecycle (frozen T11.2 §12 treatment, same shape as a
  // composed money leg) — never twice, never ambiguous. Before: U9-style
  // money leg only. After: +24,000, linear.
  var accounts = readCanonicalTable(fixture, "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  var statementAfter = buildCashFlowStatement(trccLedger_(fixture), accounts,
    { startDate: "2026-10-01", endDate: "2026-10-31" }, { openingCash: 0 });
  check("P5a", statementBefore.operating === 120000 &&
    statementBefore.ambiguous.length === 0 &&
    statementAfter.operating === 144000 &&
    statementAfter.netChange === 144000 &&
    statementAfter.ambiguous.length === 0 &&
    statementAfter.operating === statementBefore.operating + 24000,
    JSON.stringify({ before: statementBefore, after: statementAfter }));
  // Recognition journals never count as cash; the close is the ONLY new
  // cash-classified line; a replay adds nothing.
  var replay = transitionalClearingCloseWithRuntime_(runtime);
  var statementReplay = buildCashFlowStatement(trccLedger_(fixture), accounts,
    { startDate: "2026-10-01", endDate: "2026-10-31" }, { openingCash: 0 });
  check("P5b", replay.status === "ALREADY_COMMITTED" &&
    statementReplay.operating === 144000 &&
    statementReplay.ambiguous.length === 0,
    JSON.stringify(statementReplay));

  // P6 U9-style genuine Sale untouched: every byte of its artifacts stays
  // identical and its exposure stays CLEARED at 120,000.
  var u9LedgerLines = trccLedger_(fixture).filter(function(line) {
    return String(line.SourceID || "") === u9.recognitionID;
  });
  check("P6a", u9LedgerLines.length === 4 &&
    u9Row.ClearingStatus === "CLEARED" &&
    Number(u9Row.RecognizedAmount) === 120000 &&
    Number(u9Row.OutstandingAmount) === 0,
    JSON.stringify(u9Row));
  var u9OrderLines = readCanonicalTable(fixture, "Orders",
    TRANSACTION_PRODUCTION_CONTRACT.ORDERS.HEADERS).filter(function(order) {
      return String(order.OrderID) === "ORD-U9STYLE-0003";
    });
  check("P6b", u9OrderLines.length === 1 &&
    Number(u9OrderLines[0].OrderTotal) === 120000,
    JSON.stringify(u9OrderLines));

  // P7 forbidden artifacts: no Treasury/Payment/Settlement/Inventory/AP/
  // Expense/Purchase/5000/1100/2000/2010 movement and no Dr5000Cr1100 pair
  // anywhere in the close writer's reachable surfaces.
  var closeAccountCodes = trccCloseLines_(fixture).map(function(line) {
    return String(line.AccountCode);
  }).sort();
  check("P7", JSON.stringify(closeAccountCodes) === JSON.stringify(["1030", "1040"]) &&
    ["5000", "1100", "2000", "2010", "6100", "6210"].every(function(code) {
      return !trccCloseLines_(fixture).some(function(line) {
        return String(line.AccountCode) === code;
      });
    }) &&
    readCanonicalTable(fixture, "TreasuryReceipts",
      TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.RECEIPTS.HEADERS).length === 0 &&
    readCanonicalTable(fixture, "Payments",
      TRANSACTION_PRODUCTION_CONTRACT.PAYMENTS.HEADERS).length === 0,
    JSON.stringify(closeAccountCodes));

  console.log("U10_TRANSITIONAL_CLOSE_READERS checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Static source audit: zero-parameter entry, frozen single-purpose surface,
// truthful attestation only, no payment/evidence/Treasury vocabulary in the
// writer, no control-plane reach-back.
// ---------------------------------------------------------------------------
function testTransitionalCloseSourceAudit() {
  var pass = 0;
  function check(id, value, detail) { trccCheck_(id, value, detail); pass++; }
  var source = fs.readFileSync("102.Transitional.Clearing.Close.js", "utf8");

  // S1 the production entry surface is GONE (retired): no zero-argument
  // public entry declaration, no lock acquisition anywhere in the file; the
  // injected-runtime core remains the construction/verification authority.
  check("S1", source.indexOf("function closeTransitionalClearingProduction") === -1 &&
    typeof closeTransitionalClearingProduction === "undefined" &&
    /function transitionalClearingCloseWithRuntime_\s*\(\s*runtime\s*\)/.test(source) &&
    source.split("LockService.getScriptLock").length - 1 === 0,
    "retired entry surface");

  // S2 frozen single-purpose constants; no generic journal/adjustment
  // parameter surface exists anywhere in the file, and the retired entry
  // identifier is fully absent (declaration, call, or comment reference).
  check("S2", source.indexOf("AMOUNT: 24000") !== -1 &&
    source.indexOf("RECOGNITION_ID: \"SCR-CE122B27-ORD677BE5CES\"") !== -1 &&
    source.indexOf("ORDER_ID: \"ORD-677BE5CE-SALESRECOGNI\"") !== -1 &&
    source.indexOf("MONEY_ACCOUNT_CODE: \"1040\"") !== -1 &&
    source.indexOf("CLEARING_ACCOUNT_CODE: \"1030\"") !== -1 &&
    source.indexOf("TRANSITIONAL_CLEARING_CLOSE") !== -1 &&
    source.indexOf("closeTransitionalClearingProduction") === -1,
    "frozen constants");

  // S3 truthful internal attestation only: no fabricated external evidence,
  // no Treasury receipt routing, no payment/channel/destination vocabulary
  // as an implemented claim.
  check("S3", source.indexOf("MANUAL_VERIFIED") === -1 &&
    !/evidenceRef\s*:/.test(source) &&
    !/EvidenceRef\s*:/.test(source) &&
    source.indexOf("receiveVia") === -1 &&
    !/appendCells[^\n]*TreasuryReceipts|TreasuryReceipts[^\n]*appendCells/.test(source),
    "attestation hygiene");

  // S4 the control plane stays closed: 101 never references this writer and
  // this writer never mutates the config property.
  var control = fs.readFileSync("101.SingleCommit.Config.Control.js", "utf8");
  check("S4", control.indexOf("TRANSITIONAL_CLEARING_CLOSE") === -1 &&
    control.indexOf("closeTransitionalClearing") === -1 &&
    source.indexOf("setProperty(") === -1,
    "control plane isolation");

  // S5 no config-mode literal that the U8 routing audit forbids outside the
  // routing tables, and the writer is inert from every application path —
  // the retired entry does not exist at runtime.
  check("S5", !/mode: ?"ACTIVE"/.test(source) && !/mode = ?"ACTIVE"/.test(source) &&
    source.indexOf("google.script.run") === -1 &&
    typeof closeTransitionalClearingProduction === "undefined",
    "routing hygiene");

  console.log("U10_TRANSITIONAL_CLOSE_SOURCE_AUDIT checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}

// ---------------------------------------------------------------------------
// Retirement gate (T11-13): the consumed writer's production surface is
// removed and provably inert. The frozen retirement invariant holds
// independently of balances / T5 state / RequestKey replay / operator
// behavior: NO callable path can create another TRANSITIONAL_CLEARING_CLOSE
// financial write. The writer is never invoked to "prove" retirement — the
// proof is static (source + call graph) plus one zero-write dynamic probe
// with the injected transport removed. Accounting assertions above remain
// unweakened and construct the historical journal only through the in-memory
// fixture core.
// ---------------------------------------------------------------------------
function testTransitionalCloseRetirement() {
  var pass = 0;
  function check(id, value, detail) { trccCheck_(id, value, detail); pass++; }
  var source = fs.readFileSync("102.Transitional.Clearing.Close.js", "utf8");

  // A1/B1 entry absent: no public production entry exists in source or at
  // runtime (mechanism A: entry removed, not guarded).
  check("A1", source.indexOf("function closeTransitionalClearingProduction") === -1 &&
    typeof closeTransitionalClearingProduction === "undefined" &&
    source.indexOf("closeTransitionalClearingProduction") === -1,
    "entry absent");

  // A2 production wiring fully removed from the writer file: lock wrapper,
  // runtime factory, production sheet-identity lookup, REST batch transport,
  // production spreadsheet/service handles, cache invalidation, HTTP/network
  // and UI-run surfaces.
  ["transitionalClearingLockedRun_", "transitionalClearingCloseRuntime_",
    "transitionalClearingCloseBatchRequest_", "transitionalClearingCloseSheetIdsRequest_",
    "requireNumlockProductionSpreadsheet", "inventoryReceiptMigrationRequest_",
    "NUMLOCK_PRODUCTION_STORAGE_POLICY", "LockService", "UrlFetchApp",
    "SpreadsheetApp", "PropertiesService", "Session.getActiveUser",
    "invalidateDashboardCache", "google.script.run"].forEach(function(token) {
      check("A2-" + token, source.indexOf(token) === -1, token);
    });

  // C1 no path from any other runtime/UI file to any writer symbol: neither
  // the retired entry nor the retained construction core is referenced
  // anywhere outside this writer file and its dedicated test file.
  var writerSymbols = ["closeTransitionalClearingProduction",
    "transitionalClearingCloseWithRuntime_", "transitionalClearingLockedRun_",
    "transitionalClearingCloseRuntime_", "transitionalClearingCloseBatchRequest_"];
  var scanned = fs.readdirSync(".").filter(function(name) {
    return (/\.js$|\.html$/).test(name) &&
      name !== "102.Transitional.Clearing.Close.js" &&
      name !== "96.Tests.SingleCommit.TransitionalClose.Cases.js" &&
      name !== "_test_runner.js";
  });
  var leaked = [];
  scanned.forEach(function(name) {
    var text = fs.readFileSync(name, "utf8");
    writerSymbols.forEach(function(symbol) {
      if (text.indexOf(symbol) !== -1) leaked.push(name + ":" + symbol);
    });
  });
  check("C1", leaked.length === 0, JSON.stringify(leaked));

  // A3 dynamic zero-write probe: with the injected batch transport removed,
  // the retained core cannot mutate anything — every write surface
  // byte-identical, zero batches, zero close lines. (This is a zero-write
  // probe against a fixture, never a production invocation.)
  var probe = trccRuntime_();
  var probeFixture = probe.spreadsheet;
  var surfacesBefore = trccSurfaceSnapshot_(probeFixture);
  var countsBefore = trccRowCounts_(probeFixture);
  delete probe.batch;
  var probeResult = transitionalClearingCloseWithRuntime_(probe);
  check("A3", probeResult.status === "UNKNOWN" &&
    probeResult.code === "TRANSITIONAL_CLOSE_BATCH_OUTCOME_UNKNOWN" &&
    probe.events.batches.length === 0 &&
    surfacesBefore === trccSurfaceSnapshot_(probeFixture) &&
    JSON.stringify(countsBefore) === JSON.stringify(trccRowCounts_(probeFixture)) &&
    trccCloseLines_(probeFixture).length === 0,
    JSON.stringify(probeResult));

  // D1-J1 historical artifacts remain readable and semantically valid
  // through canonical readers ONLY. Construct the committed journal once on
  // a fixture (construction authority, in-memory), then every check below
  // reads through readers/projections with no further writer call.
  var history = trccRuntime_();
  var fixture = history.spreadsheet;
  var revenueBefore = trccAccountNet_(fixture, "4000");
  var statementBefore = buildCashFlowStatement(trccLedger_(fixture),
    readCanonicalTable(fixture, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS),
    { startDate: "2026-10-01", endDate: "2026-10-31" }, { openingCash: 0 });
  var built = transitionalClearingCloseWithRuntime_(history);
  trccCheck_("D1p", built.status === "DONE", JSON.stringify(built));

  // D1 operation authority + journal + audit readable and valid: exactly one
  // COMMITTED operation whose stored plan verifies, two balanced close
  // lines, one truthful audit — all via the canonical readers.
  var ops = trccOperations_(fixture).filter(function(op) {
    return String(op.OperationType || "") === "TRANSITIONAL_CLEARING_CLOSE";
  });
  var storedPlan = ops.length === 1 ? JSON.parse(ops[0].OperationPlan) : null;
  var verify = storedPlan ? transitionalClearingCloseVerifyPlan_(storedPlan) :
    { ok: false, reason: "NO_OP" };
  var closeLines = trccCloseLines_(fixture);
  var audits = trccLogs_(fixture).filter(function(row) {
    return String(row.Module || "") === "TransitionalClearingClose";
  });
  check("D1", ops.length === 1 && ops[0].State === "COMMITTED" &&
    String(ops[0].LastError || "") === "" && verify.ok &&
    closeLines.length === 2 && audits.length === 1 &&
    String(audits[0].RecordID) === "TRCC-SCR-CE122B27-ORD677BE5CES" &&
    String(audits[0].ID_Log || "").indexOf("TRCCA-") === 0,
    JSON.stringify({ ops: ops.length, verify: verify, lines: closeLines.length,
      audits: audits.length }));

  // E1 T5 transitional stays CLEARED, derived from the historical journal.
  var exposure = buildTreasuryClearingExposure_(fixture,
    { recognitionID: "SCR-CE122B27-ORD677BE5CES" });
  check("E1", exposure.status === "OK" &&
    exposure.row.ClearingStatus === "CLEARED" &&
    Number(exposure.row.ClearedAmount) === 24000 &&
    Number(exposure.row.OutstandingAmount) === 0 &&
    exposure.row.RecognitionIntegrity === "VALID",
    JSON.stringify(exposure.row));

  // F1/G1 1030 zero; 1040 keeps the historical +24,000 exactly once.
  var recon = buildTreasury1030Reconciliation_(fixture, {});
  check("F1", recon.reconciliationStatus === "OK" &&
    Number(recon.ledgerNet1030) === 0 && Number(recon.outstandingTotal) === 0 &&
    Number(recon.unexplainedResidual) === 0, JSON.stringify(recon));
  check("G1", trccAccountNet_(fixture, "1040") === 24000 &&
    closeLines.filter(function(line) {
      return String(line.AccountCode) === "1040"; }).length === 1,
    String(trccAccountNet_(fixture, "1040")));

  // H1 Revenue / P&L unchanged by retirement semantics: the historical close
  // never touched Revenue recognition; the 4000 net is the seeded
  // recognition only, identical before and after journal construction.
  check("H1", trccAccountNet_(fixture, "4000") === revenueBefore &&
    revenueBefore === -24000, String(trccAccountNet_(fixture, "4000")));

  // I1 Cash Flow keeps exactly ONE historical Operating inflow from the
  // committed close; recognition journals never count as cash.
  var accounts = readCanonicalTable(fixture, "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  var statement = buildCashFlowStatement(trccLedger_(fixture), accounts,
    { startDate: "2026-10-01", endDate: "2026-10-31" }, { openingCash: 0 });
  check("I1", statementBefore.operating === 0 && statement.operating === 24000 &&
    statement.netChange === 24000 && statement.ambiguous.length === 0,
    JSON.stringify(statement));

  // J1 normal T11 Sale + Treasury surfaces unaffected: a U9-style genuine
  // Sale is seeded; across journal construction every non-close sheet stays
  // byte-identical (Orders/Sales/Treasury/Payments/Inventory/…).
  var saleRuntime = trccRuntime_();
  trccU9StyleSale_(saleRuntime.spreadsheet);
  var saleFixture = saleRuntime.spreadsheet;
  function nonCloseSheetBytes_() {
    return JSON.stringify(["Orders", "OrderLines", "SalesRecognitionEvents",
      "SalesRecognitionAudits", "Accounts", "Payments", "Settlements", "tabsal",
      "tabops", "InventoryLedger", "PurchaseEvents", "TreasuryReceipts",
      "TreasuryOperations", "TreasuryAudits"].map(function(name) {
        var sheet = saleFixture.getSheetByName(name);
        return name + ":" + JSON.stringify(sheet ? sheet.values : null);
      }));
  }
  var saleBefore = nonCloseSheetBytes_();
  var saleClose = transitionalClearingCloseWithRuntime_(saleRuntime);
  check("J1", saleClose.status === "DONE" &&
    nonCloseSheetBytes_() === saleBefore &&
    trccCloseLines_(saleFixture).length === 2,
    JSON.stringify(saleClose));

  console.log("U10_TRANSITIONAL_CLOSE_RETIREMENT checks=" + pass);
  return { total: pass, pass: pass, fail: 0 };
}
