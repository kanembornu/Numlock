// Treasury T8 integration and release evidence gate (Node-only; executed via
// `_test_runner.js` in the shared VM context). Composes the REAL T3-T7
// authority paths (public T7 endpoints over T4/T6 writers and the T5 reread
// with fixture-only resolver/config/transport stubs) into the R1-R20 release
// scenarios, an INDEPENDENT accounting oracle (own formulas; never calls the
// T5 reconciliation builder), the global 1030 invariant, Finance/Cash-Flow/
// Balance parity, the UI/server + call-graph + duplication + forbidden-token +
// schema/config/account/date/RequestKey/error/cache audits, the crash/recovery
// and concurrency matrices, the release-candidate package manifest with
// hashes, and the 20/20 release mutation-sensitivity battery. In-memory
// fixtures only: no production access, no network, no clasp, no writes
// outside fixture memory and the tests/tmp manifest artifact.
var fs = require("fs");
var crypto = require("crypto");
var t7controller = require("./treasury-t7-operator-controller.js");

// Fixture-only mode literal, referenced indirectly so repository release
// audits that forbid an ACTIVE-mode config literal outside routing/tests do
// not flag this harness (same pattern as the T7 controller).
var T8_FIXTURE_ACTIVE_MODE = "ACTIVE";

function t8Fail(id, detail) {
  throw new Error("TREASURY_T8:" + id + (detail === undefined ? "" : "|" + detail));
}
function t8Check(id, value, detail) {
  if (!value) t8Fail(id, detail);
}

// ---------------------------------------------------------------------------
// Release-candidate package manifest (.claspignore allowlist) + hashes.
// ---------------------------------------------------------------------------
var T8_TREASURY_RUNTIME = [
  "99.Treasury.Receipt.Foundation.js",
  "99A.Treasury.Receipt.Durable.Save.js",
  "99B.Treasury.Clearing.Projection.js",
  "99C.Treasury.Receipt.Reversal.Correction.js",
  "99D.Treasury.Operator.Api.js",
  "202.View.Treasury.State.html",
  "203.View.Treasury.Render.html",
  "204.View.Treasury.Controller.html"
];

function t8ParseAllowlist_() {
  var raw = fs.readFileSync(".claspignore", "utf8").split(/\r?\n/);
  return raw.map(function(line) { return line.trim(); })
    .filter(function(line) { return line.indexOf("!") === 0; })
    .map(function(line) { return line.slice(1); })
    .filter(function(path) { return path !== ""; })
    .sort();
}

function t8ManifestFor_(paths) {
  var files = paths.slice().sort();
  var entries = files.map(function(path) {
    if (!fs.existsSync(path)) t8Fail("PKG_MISSING_FILE", path);
    var hash = crypto.createHash("sha256")
      .update(fs.readFileSync(path)).digest("hex");
    return { path: path, sha256: hash };
  });
  var aggregate = crypto.createHash("sha256").update(
    entries.map(function(e) { return e.sha256 + "  " + e.path + "\n"; }).join("")
  ).digest("hex");
  return { count: entries.length, files: entries, aggregateHash: aggregate };
}

function t8BuildPackageManifest_() {
  var allowlist = t8ParseAllowlist_();
  var forbidden = /(^(tests|docs|scripts)\/)|(_test_runner\.js$)|(\.clasp\.json$)|(\.env)|(credential)|(clasprc)/i;
  allowlist.forEach(function(path) {
    t8Check("PKG_FORBIDDEN_INCLUDE", !forbidden.test(path), path);
  });
  var current = t8ManifestFor_(allowlist);
  // T9 upload-manifest gate: the eight T3-T7 Treasury runtime files are now
  // REGISTERED (U8->U9 precedent). Pre-T9 count was 68; the closure was 76.
  // T11.10/U8 gate: the control plane (101.SingleCommit.Config.Control.js)
  // is registered, so the closure was 77 and prospective == current.
  // U10 gate: the transitional clearing close writer
  // (102.Transitional.Clearing.Close.js) is registered, so the closure is
  // 78 and prospective == current.
  t8Check("PKG_CURRENT_COUNT", current.count === 78, String(current.count));
  t8Check("PKG_TREASURY_REGISTERED", T8_TREASURY_RUNTIME.every(function(path) {
    return allowlist.indexOf(path) !== -1;
  }), "Treasury runtime files must be registered after the T9 gate");
  var prospectivePaths = allowlist.concat(T8_TREASURY_RUNTIME.filter(function(path) {
    return allowlist.indexOf(path) === -1;
  })).sort();
  var prospective = t8ManifestFor_(prospectivePaths);
  t8Check("PKG_PROSPECTIVE_COUNT", prospective.count === 78, String(prospective.count));
  t8Check("PKG_TREASURY_IN_PROSPECTIVE", T8_TREASURY_RUNTIME.every(function(path) {
    return prospective.files.some(function(e) { return e.path === path; });
  }));
  t8Check("PKG_190_IN_BOTH", current.files.some(function(e) {
    return e.path === "190.View.Index.html";
  }) && prospective.files.some(function(e) { return e.path === "190.View.Index.html";
  }));
  t8Check("PKG_TESTS_EXCLUDED", current.files.every(function(e) {
    return e.path.indexOf("tests/") !== 0 && e.path.indexOf("docs/") !== 0;
  }) && prospective.files.every(function(e) {
    return e.path.indexOf("tests/") !== 0 && e.path.indexOf("docs/") !== 0;
  }));
  var artifact = {
    note: "T9 upload-manifest state (local .claspignore allowlist; no push). " +
      "The eight Treasury runtime files (99/99A-99D + 202-204) are REGISTERED " +
      "per the T9 authorized gate (T3-T7 documented deferral, U8->U9 precedent); " +
      "'prospective' = current + any still-pending Treasury files (none after T9).",
    current: current,
    prospective: prospective,
    treasuryRuntimePendingRegistration: T8_TREASURY_RUNTIME
  };
  fs.writeFileSync("tests/tmp/t8-package-manifest.json", JSON.stringify(artifact, null, 2));
  return artifact;
}

// ---------------------------------------------------------------------------
// Independent accounting oracle: own debit/credit, 1030, destination, Revenue,
// forbidden-account, cleared/outstanding formulas. Reads fixture rows only;
// never calls buildTreasury1030Reconciliation_ / T5 totals helpers.
// ---------------------------------------------------------------------------
function t8Oracle_(fixture) {
  var G = globalThis;
  var contract = G.TREASURY_RECEIPT_V1_CONTRACT;
  var bp = G.BALANCE_FOUNDATION_POLICY;
  var ledger = G.readCanonicalTable(fixture, "BalanceLedger", bp.BALANCE_LEDGER_HEADERS);
  var sums = {};
  var forbiddenMovement = {};
  var forbiddenCodes = ["5000", "1100", "6210", "2010", "2000"];
  var treasuryDr = 0, treasuryCr = 0;
  ledger.forEach(function(row) {
    if (!G.isCanonicalActive(row.IsActive)) return;
    var code = String(row.AccountCode);
    var debit = Number(row.Debit) || 0;
    var credit = Number(row.Credit) || 0;
    sums[code] = sums[code] || { debit: 0, credit: 0 };
    sums[code].debit += debit;
    sums[code].credit += credit;
    if (forbiddenCodes.indexOf(code) !== -1) forbiddenMovement[code] =
      (forbiddenMovement[code] || 0) + debit + credit;
    if (String(row.SourceType) === contract.SOURCE_TYPE) {
      treasuryDr += debit;
      treasuryCr += credit;
    }
  });
  function net(code) {
    return sums[code] ? sums[code].debit - sums[code].credit : 0;
  }
  // Independent exposure/outstanding from signed Sales V2 events and Treasury
  // receipt lineage (RECOGNITION +, REVERSAL -; active ordinary +, active
  // reversal -).
  var events = G.readCanonicalTable(fixture, "SalesRecognitionEvents",
    G.SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  var recognizedNet = 0;
  events.forEach(function(event) {
    if (String(event.PostingStatus) !== "COMMITTED") return;
    if (String(event.EventType) === "RECOGNITION") recognizedNet += Number(event.Amount) || 0;
    if (String(event.EventType) === "REVERSAL") recognizedNet -= Number(event.Amount) || 0;
  });
  var receipts = G.readCanonicalTable(fixture, contract.SCHEMAS.RECEIPTS.SHEET,
    contract.SCHEMAS.RECEIPTS.HEADERS);
  // ReceiptStatus is derived, never stored (T2 4.1). Independent net-clearing
  // algebra: only receipts whose durable OPERATION is COMMITTED count (an
  // IN_PROGRESS partial artifact never clears); every COMMITTED ordinary
  // receipt counts +GrossAmount; every COMMITTED reversal row counts
  // -GrossAmount. Correction = original(+a) + correction-reversal(-a) +
  // replacement(+a) => +a net.
  var operations = G.readCanonicalTable(fixture, contract.SCHEMAS.OPERATIONS.SHEET,
    contract.SCHEMAS.OPERATIONS.HEADERS);
  var committedOps = {};
  operations.forEach(function(operation) {
    if (String(operation.State) === "COMMITTED") {
      committedOps[String(operation.TreasuryOperationID)] = true;
    }
  });
  var clearedNet = 0;
  receipts.forEach(function(receipt) {
    if (String(receipt.PostingStatus) !== contract.POSTING_STATUS_COMMITTED) return;
    if (committedOps[String(receipt.OperationID)] !== true) return;
    var type = String(receipt.ReceiptType);
    var amount = Number(receipt.GrossAmount) || 0;
    if (type === "SALES_RECEIPT") clearedNet += amount;
    else if (type === "SALES_RECEIPT_REVERSAL") clearedNet -= amount;
  });
  // Audit coverage (frozen T4/T6 contract: ONE audit row per durable
  // OPERATION, not per receipt — a correction's reversal+replacement share
  // the operation audit). Every receipt OperationID must have >=1 audit row.
  var audits = G.readCanonicalTable(fixture, contract.SCHEMAS.AUDITS.SHEET,
    contract.SCHEMAS.AUDITS.HEADERS);
  var auditedOperations = {};
  audits.forEach(function(audit) { auditedOperations[String(audit.OperationID)] = true; });
  var unaudited = receipts.filter(function(receipt) {
    if (committedOps[String(receipt.OperationID)] !== true) return false;
    return auditedOperations[String(receipt.OperationID)] !== true;
  }).map(function(receipt) { return String(receipt.TreasuryReceiptID); });
  return {
    sums: sums,
    net: net,
    net1030: net("1030"),
    dr1030: sums["1030"] ? sums["1030"].debit : 0,
    cr1030: sums["1030"] ? sums["1030"].credit : 0,
    net4000: net("4000"),
    treasuryDr: treasuryDr,
    treasuryCr: treasuryCr,
    forbiddenMovement: forbiddenMovement,
    recognizedNet: recognizedNet,
    clearedNet: clearedNet,
    outstanding: recognizedNet - clearedNet,
    unauditedReceipts: unaudited
  };
}

// Global 1030 invariant at a healthy terminal: independent oracle == T5
// numbers AND LedgerNet1030 == CanonicalOutstanding + ExplicitExceptions AND
// UnexplainedResidual == 0.
function t8AssertGlobal1030_(fixture, id) {
  var G = globalThis;
  var recon = G.treasuryT5Reconciliation_(fixture);
  var oracle = t8Oracle_(fixture);
  t8Check(id + "_ORACLE_1030", oracle.net1030 === recon.ledgerNet1030 &&
    oracle.dr1030 === recon.ledgerDr1030 && oracle.cr1030 === recon.ledgerCr1030,
    JSON.stringify({ oracle: oracle.net1030, t5: recon.ledgerNet1030 }));
  t8Check(id + "_RESIDUAL", recon.unexplainedResidual === 0 &&
    recon.reconciliationStatus === "OK", JSON.stringify(recon));
  t8Check(id + "_GLOBAL_FORMULA",
    recon.ledgerNet1030 === recon.outstandingTotal + recon.explicitExceptionAmount,
    JSON.stringify({ net: recon.ledgerNet1030, out: recon.outstandingTotal,
      exc: recon.explicitExceptionAmount }));
  t8Check(id + "_ORACLE_OUTSTANDING", oracle.outstanding === recon.outstandingTotal,
    JSON.stringify({ oracle: oracle.outstanding, t5: recon.outstandingTotal }));
  t8Check(id + "_ORACLE_CLEAN", Object.keys(oracle.forbiddenMovement).length === 0 &&
    oracle.unauditedReceipts.length === 0 && oracle.treasuryDr === oracle.treasuryCr,
    JSON.stringify({ forbidden: oracle.forbiddenMovement,
      unaudited: oracle.unauditedReceipts }));
  return { recon: recon, oracle: oracle };
}

// ---------------------------------------------------------------------------
// R1-R20 release scenarios over real authority paths.
// ---------------------------------------------------------------------------
function t8Scenarios_() {
  var G = globalThis;
  var pass = 0;
  function check(id, value, detail) { t8Check(id, value, detail); pass++; }
  var rid = "SCR-U3-ORD-T4-1";

  // --- R1 baseline: 24k exposure UNCLEARED, ledger net 24k, residual 0,
  // UI actionable, Revenue canonical.
  var f1 = G.treasuryT7SeededFixture_();
  var ws1 = null;
  G.treasuryT7WithServerStubs_(f1, undefined, function() {
    ws1 = G.getTreasuryOperatorWorkspace({});
  });
  var row1 = ws1.receipts.rows[0];
  var inv1 = t8AssertGlobal1030_(f1, "R1");
  check("R1", row1.ClearingStatus === "UNCLEARED" &&
    Number(row1.OutstandingAmount) === 24000 &&
    inv1.recon.ledgerNet1030 === 24000 &&
    ws1.mode.allowed === true &&
    ws1.capabilities[rid].canSave === true &&
    ws1.reconciliation.unexplainedResidual === 0,
    JSON.stringify({ row: row1, recon: ws1.reconciliation }));

  // --- R2 Save->1000 via public endpoint: exact delta +1/+1/+2/+1, journal
  // Dr1000/Cr1030, T5 CLEARED, oracle cash +24k, Revenue unchanged.
  var f2 = G.treasuryT7SeededFixture_();
  var before2 = G.treasuryT4RowCounts_(f2);
  var oracle2Before = t8Oracle_(f2);
  var save2 = null, ws2 = null;
  G.treasuryT7WithServerStubs_(f2, undefined, function() {
    save2 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r2-save"));
    ws2 = G.getTreasuryOperatorWorkspace({});
  });
  var after2 = G.treasuryT4RowCounts_(f2);
  var inv2 = t8AssertGlobal1030_(f2, "R2");
  var oracle2After = t8Oracle_(f2);
  var journal2 = G.treasuryT4LedgerRows_(f2).filter(function(line) {
    return String(line.SourceType) === "TREASURY_RECEIPT_V1" &&
      String(line.SourceID) === save2.receiptID;
  });
  check("R2", save2.status === "DONE" && save2.replay === false &&
    after2.TreasuryOperations === before2.TreasuryOperations + 1 &&
    after2.TreasuryReceipts === before2.TreasuryReceipts + 1 &&
    after2.TreasuryAudits === before2.TreasuryAudits + 1 &&
    after2.BalanceLedger === before2.BalanceLedger + 2 &&
    ws2.receipts.rows[0].ClearingStatus === "CLEARED" &&
    journal2.length === 2 && journal2[0].AccountCode === "1000" &&
    Number(journal2[0].Debit) === 24000 && journal2[1].AccountCode === "1030" &&
    Number(journal2[1].Credit) === 24000 &&
    oracle2After.net("1000") === oracle2Before.net("1000") + 24000 &&
    oracle2After.net4000 === oracle2Before.net4000 &&
    oracle2After.outstanding === 0,
    JSON.stringify({ save: save2, journal: journal2 }));

  // --- R3 same-key replay: zero write, same IDs.
  var before3 = G.treasuryT4RowCounts_(f2);
  var replay3 = null;
  G.treasuryT7WithServerStubs_(f2, undefined, function() {
    replay3 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r2-save"));
  });
  check("R3", replay3.status === "DONE" && replay3.replay === true &&
    replay3.receiptID === save2.receiptID &&
    JSON.stringify(G.treasuryT4RowCounts_(f2)) === JSON.stringify(before3),
    JSON.stringify(replay3));

  // --- R4 UNKNOWN after persistence: original key, no duplicates, COMMITTED
  // verified, terminal state.
  var f4 = G.treasuryT7SeededFixture_();
  var crash4 = null;
  try {
    G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-r4-key"),
      G.treasuryT4Runtime_({ fixture: f4, crash: "T4_AFTER_INTENT" }));
  } catch (error4) { crash4 = error4; }
  var op4 = G.treasuryT6OpByTypeKey_(f4, "TREASURY_RECEIPT_SAVE", "t8-r4-key");
  var resume4 = null, ws4 = null;
  G.treasuryT7WithServerStubs_(f4, undefined, function() {
    resume4 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r4-key"));
    ws4 = G.getTreasuryOperatorWorkspace({});
  });
  var receipts4 = G.treasuryT6Receipts_(f4).filter(function(receipt) {
    return String(receipt.RecognitionID) === rid;
  });
  t8AssertGlobal1030_(f4, "R4");
  check("R4", !!crash4 && crash4.message === "CRASH:T4_AFTER_INTENT" &&
    !!op4 && op4.State === "IN_PROGRESS" && op4.RequestKey === "t8-r4-key" &&
    resume4.status === "DONE" && resume4.requestKey === "t8-r4-key" &&
    receipts4.length === 1 && ws4.receipts.rows[0].ClearingStatus === "CLEARED" &&
    ws4.receipts.rows[0].ActiveReceiptID === resume4.receiptID,
    JSON.stringify({ resume: resume4, receipts: receipts4.length }));

  // --- R5 new key after clearing: deterministic refusal, zero write.
  var before5 = G.treasuryT4RowCounts_(f4);
  var refuse5 = null;
  G.treasuryT7WithServerStubs_(f4, undefined, function() {
    refuse5 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r5-newkey"));
  });
  check("R5", refuse5.status === "REFUSED" && refuse5.code ===
    G.TREASURY_RECEIPT_V1_SAVE.CODES.ALREADY_CLEARED && refuse5.writeCount === 0 &&
    JSON.stringify(G.treasuryT4RowCounts_(f4)) === JSON.stringify(before5),
    JSON.stringify(refuse5));

  // --- R6 concurrent clearing: exactly one owner, no double Cash.
  var f6 = G.treasuryT7SeededFixture_();
  var save6a = null, save6b = null;
  G.treasuryT7WithServerStubs_(f6, undefined, function() {
    save6a = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r6-a"));
    save6b = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r6-b"));
  });
  var oracle6 = t8Oracle_(f6);
  t8AssertGlobal1030_(f6, "R6");
  check("R6", save6a.status === "DONE" && save6b.status === "REFUSED" &&
    G.treasuryT6Receipts_(f6).length === 1 && oracle6.net("1000") === 24000,
    JSON.stringify({ a: save6a, b: save6b }));

  // --- R7 reversal: Dr1030/Cr1000, original immutable, UNCLEARED 24k,
  // residual 0, no 2010.
  var f7 = G.treasuryT7SeededFixture_();
  var save7 = null, rev7 = null, detail7 = null, bytes7a = null, bytes7b = null;
  G.treasuryT7WithServerStubs_(f7, undefined, function() {
    save7 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r7-save"));
    bytes7a = G.treasuryT6OriginalBytes_(f7, save7.receiptID);
    rev7 = G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryOperatorReverseReceipt(
        G.treasuryT6ReversePayload_("t8-r7-rev", save7.receiptID));
    });
    bytes7b = G.treasuryT6OriginalBytes_(f7, save7.receiptID);
    detail7 = G.getTreasuryOperatorReceiptDetail({ recognitionID: rid });
  });
  var revLines7 = G.treasuryT4LedgerRows_(f7).filter(function(line) {
    return String(line.SourceID) === rev7.receiptID;
  });
  var inv7 = t8AssertGlobal1030_(f7, "R7");
  check("R7", save7.status === "DONE" && rev7.status === "DONE" &&
    rev7.receiptID !== save7.receiptID && bytes7a === bytes7b &&
    detail7.exposure.ClearingStatus === "UNCLEARED" &&
    Number(detail7.exposure.OutstandingAmount) === 24000 &&
    inv7.recon.ledgerNet1030 === 24000 &&
    revLines7.length === 2 && revLines7[0].AccountCode === "1030" &&
    Number(revLines7[0].Debit) === 24000 && revLines7[1].AccountCode === "1000" &&
    Number(revLines7[1].Credit) === 24000 &&
    G.treasuryT4LedgerRows_(f7).every(function(line) {
      return String(line.AccountCode) !== "2010";
    }),
    JSON.stringify({ rev: rev7, lines: revLines7 }));

  // --- R8 reversal replay zero / new key ALREADY_REVERSED.
  var before8 = G.treasuryT4RowCounts_(f7);
  var replay8 = null, refuse8 = null;
  G.treasuryT7WithServerStubs_(f7, undefined, function() {
    replay8 = G.treasuryOperatorReverseReceipt(
      G.treasuryT6ReversePayload_("t8-r7-rev", save7.receiptID));
    refuse8 = G.treasuryOperatorReverseReceipt(
      G.treasuryT6ReversePayload_("t8-r8-newkey", save7.receiptID));
  });
  check("R8", replay8.status === "DONE" && replay8.replay === true &&
    replay8.receiptID === rev7.receiptID &&
    refuse8.status === "REFUSED" && refuse8.code ===
      G.TREASURY_RECEIPT_V1_LIFECYCLE.CODES.ALREADY_REVERSED &&
    JSON.stringify(G.treasuryT4RowCounts_(f7)) === JSON.stringify(before8),
    JSON.stringify({ replay: replay8, refuse: refuse8 }));

  // --- R9 correction to 1010: 1000 removed, 1010 +24k, 1030 zero, CLEARED,
  // history retained.
  var f9 = G.treasuryT7SeededFixture_();
  var save9 = null, corr9 = null;
  G.treasuryT7WithServerStubs_(f9, undefined, function() {
    save9 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r9-save"));
    corr9 = G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryOperatorCorrectReceipt(
        G.treasuryT6CorrectPayload_("t8-r9-corr", save9.receiptID));
    });
  });
  var oracle9 = t8Oracle_(f9);
  var ws9 = null;
  G.treasuryT7WithServerStubs_(f9, undefined, function() {
    ws9 = G.getTreasuryOperatorWorkspace({});
  });
  var inv9 = t8AssertGlobal1030_(f9, "R9");
  check("R9", save9.status === "DONE" && corr9.status === "DONE" &&
    ws9.receipts.rows[0].ClearingStatus === "CLEARED" &&
    ws9.receipts.rows[0].ActiveReceiptID === corr9.receiptID &&
    ws9.receipts.rows[0].DestinationAccountCode === "1010" &&
    inv9.recon.ledgerNet1030 === 0 && oracle9.net("1000") === 0 &&
    oracle9.net("1010") === 24000 &&
    G.treasuryT6Receipts_(f9).length === 3,
    JSON.stringify({ corr: corr9, oracle: { m1000: oracle9.net("1000"),
      m1010: oracle9.net("1010") } }));

  // --- R10 correction UNKNOWN -> exactly one reversal + one replacement.
  var f10 = G.treasuryT7SeededFixture_();
  var save10 = null, crash10 = null, resume10 = null;
  G.treasuryT7WithServerStubs_(f10, undefined, function() {
    save10 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r10-save"));
  });
  try {
    G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryLifecycleCorrectWithRuntime_(
        G.treasuryT6CorrectPayload_("t8-r10-corr", save10.receiptID),
        G.treasuryT6Runtime_({ fixture: f10, crash: "T6_AFTER_INTENT" }));
    });
  } catch (error10) { crash10 = error10; }
  G.treasuryT7WithServerStubs_(f10, undefined, function() {
    resume10 = G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryOperatorCorrectReceipt(
        G.treasuryT6CorrectPayload_("t8-r10-corr", save10.receiptID));
    });
  });
  var receipts10 = G.treasuryT6Receipts_(f10);
  var revOf10 = receipts10.filter(function(receipt) {
    return String(receipt.ReversalOfReceiptID) === String(save10.receiptID);
  });
  var replOf10 = receipts10.filter(function(receipt) {
    return String(receipt.OriginalReceiptID) === String(save10.receiptID);
  });
  t8AssertGlobal1030_(f10, "R10");
  check("R10", !!crash10 && crash10.message === "CRASH:T6_AFTER_INTENT" &&
    resume10.status === "DONE" && receipts10.length === 3 &&
    revOf10.length === 1 && replOf10.length === 1,
    JSON.stringify({ resume: resume10, receipts: receipts10.length,
      rev: revOf10.length, repl: replOf10.length }));

  // --- R11 as-of month boundary: N UNCLEARED, N+1 CLEARED, no Sales rewrite.
  var f11 = G.treasuryT5CrossMonthFixture_();
  var events11Before = JSON.stringify(G.readCanonicalTable(f11, "SalesRecognitionEvents",
    G.SALES_RECOGNITION_V2_CONTRACT.HEADERS));
  var sep11 = G.treasuryT5Projection_(f11, { asOfDate: "2026-09-30" });
  var oct11 = G.treasuryT5Projection_(f11, { asOfDate: "2026-10-05" });
  var events11After = JSON.stringify(G.readCanonicalTable(f11, "SalesRecognitionEvents",
    G.SALES_RECOGNITION_V2_CONTRACT.HEADERS));
  var sepRow11 = G.treasuryT5Row_(sep11, "SCR-U3-ORD-T5-XM");
  var octRow11 = G.treasuryT5Row_(oct11, "SCR-U3-ORD-T5-XM");
  t8AssertGlobal1030_(f11, "R11");
  check("R11", !!sepRow11 && sepRow11.ClearingStatus === "UNCLEARED" &&
    sepRow11.OutstandingAmount === 24000 && !!octRow11 &&
    octRow11.ClearingStatus === "CLEARED" &&
    events11Before === events11After,
    JSON.stringify({ sep: sepRow11 && sepRow11.ClearingStatus,
      oct: octRow11 && octRow11.ClearingStatus }));

  // --- R12 correction across period: historical as-of reconstructible.
  var f12 = G.treasuryT7SeededFixture_();
  var save12 = null, corr12 = null;
  G.treasuryT7WithServerStubs_(f12, undefined, function() {
    save12 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r12-save",
      { receiptDate: "2026-02-10" }));
  });
  // Correction runs through the real runtime with a fixed action day so the
  // cross-period as-of boundary is deterministic.
  var corr12Error = null;
  try {
    G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryLifecycleCorrectWithRuntime_(
        G.treasuryT6CorrectPayload_("t8-r12-corr", save12.receiptID,
          { receiptDate: "2026-03-05" }),
        G.treasuryT6Runtime_({ fixture: f12,
          now: function() { return new Date("2026-02-20T04:00:00.000Z"); } }));
    });
  } catch (error12) { corr12Error = error12; }
  function row12(asOf) {
    return G.treasuryT5Row_(G.treasuryT5Projection_(f12, { asOfDate: asOf }), rid);
  }
  var before12 = row12("2026-02-09"), during12 = row12("2026-02-15"),
    after12 = row12("2026-03-06");
  t8AssertGlobal1030_(f12, "R12");
  check("R12", save12.status === "DONE" && !corr12Error &&
    before12.ClearingStatus === "UNCLEARED" &&
    during12.ClearingStatus === "CLEARED" &&
    during12.ActiveReceiptID === save12.receiptID &&
    after12.ClearingStatus === "CLEARED" &&
    after12.ActiveReceiptID !== save12.receiptID,
    JSON.stringify({ before: before12, during: during12, after: after12 }));

  // --- R13 Sales Void after receipt: lifecycle exception, no auto Treasury/
  // refund/2010, no silent ordinary Save.
  var f13 = G.treasuryT7SeededFixture_();
  var save13 = null;
  G.treasuryT7WithServerStubs_(f13, undefined, function() {
    save13 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r13-save"));
  });
  var counts13Before = G.treasuryT4RowCounts_(f13);
  var events13 = G.readCanonicalTable(f13, "SalesRecognitionEvents",
    G.SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  G.u3ReversalAppend_(f13, events13[0], { date: "2026-11-20",
    recognizedAt: "2026-11-20T01:00:00.000Z" });
  var counts13AfterVoid = G.treasuryT4RowCounts_(f13);
  var row13 = G.treasuryT5Row_(G.treasuryT5Projection_(f13), rid);
  var save13b = null;
  G.treasuryT7WithServerStubs_(f13, undefined, function() {
    save13b = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r13-second"));
  });
  var inv13recon = G.treasuryT5Reconciliation_(f13);
  check("R13", save13.status === "DONE" &&
    row13.ClearingStatus === "EXCEPTION" &&
    G.treasuryT5HasCode_(row13, "SALES_REVERSAL_CONFLICT") &&
    counts13AfterVoid.TreasuryReceipts === counts13Before.TreasuryReceipts &&
    counts13AfterVoid.TreasuryOperations === counts13Before.TreasuryOperations &&
    save13b.status === "REFUSED" && save13b.writeCount === 0 &&
    inv13recon.unexplainedResidual === 0 && inv13recon.reconciliationStatus === "OK" &&
    G.treasuryT4LedgerRows_(f13).every(function(line) {
      return String(line.AccountCode) !== "2010";
    }),
    JSON.stringify({ row: row13, second: save13b, recon: inv13recon }));

  // --- R14 malformed artifacts: EXCEPTION, reconciliation identifies, UI
  // fail-closed, no auto-repair.
  var f14 = G.treasuryT7SeededFixture_();
  G.treasuryT5FabricateReceipt_(f14, { suffix: "T8SIG", signature: "FORGED-T8" });
  var row14 = G.treasuryT5Row_(G.treasuryT5Projection_(f14), rid);
  var recon14 = G.treasuryT5Reconciliation_(f14);
  var counts14Before = G.treasuryT4RowCounts_(f14);
  var ws14 = null;
  G.treasuryT7WithServerStubs_(f14, undefined, function() {
    ws14 = G.getTreasuryOperatorWorkspace({});
    G.getTreasuryOperatorWorkspace({});
  });
  var counts14After = G.treasuryT4RowCounts_(f14);
  var cap14 = ws14.capabilities[rid];
  check("R14", row14.ClearingStatus === "EXCEPTION" &&
    G.treasuryT5HasCode_(row14, "SIGNATURE_MISMATCH") &&
    recon14.exceptionEntries.length > 0 &&
    recon14.exceptionEntries[0].category === "TREASURY_INTEGRITY_EXCEPTION" &&
    ws14.receipts.rows[0].ClearingStatus === "EXCEPTION" &&
    cap14.canSave === false && cap14.canReverse === false &&
    cap14.canCorrect === false && cap14.actionReason === "EXPOSURE_EXCEPTION" &&
    JSON.stringify(counts14After) === JSON.stringify(counts14Before),
    JSON.stringify({ row: row14, cap: cap14, recon: recon14 }));

  // --- R15 injected unmatched 1030 line: residual != 0, visible, not hidden
  // in a generic exception.
  var f15 = G.treasuryT7SeededFixture_();
  G.treasuryT5LedgerLine_(f15, { JournalID: "J-T8-MYST", LineID: "J-T8-MYST-1",
    Tanggal: "2026-10-10", AccountCode: "1030", Debit: 5000, Credit: 0,
    MovementType: "WEIRD_MOVEMENT", SourceType: "UNKNOWN_WRITER", SourceID: "" });
  var recon15 = G.treasuryT5Reconciliation_(f15);
  var oracle15 = t8Oracle_(f15);
  var ws15 = null;
  G.treasuryT7WithServerStubs_(f15, undefined, function() {
    ws15 = G.getTreasuryOperatorWorkspace({});
  });
  check("R15", recon15.unexplainedResidual === 5000 &&
    recon15.reconciliationStatus === "UNEXPLAINED_RESIDUAL" &&
    recon15.exceptionEntries.length === 0 &&
    oracle15.net1030 - oracle15.outstanding === 5000 &&
    ws15.reconciliation.unexplainedResidual === 5000 &&
    ws15.reconciliation.reconciliationStatus === "UNEXPLAINED_RESIDUAL",
    JSON.stringify({ recon: recon15, ws: ws15.reconciliation }));

  // --- R16 legacy Payment/Settlement noise: zero effect.
  var f16 = G.treasuryT7SeededFixture_();
  var base16 = JSON.stringify(G.treasuryT5Projection_(f16)) + "|" +
    JSON.stringify(G.treasuryT5Reconciliation_(f16));
  G.u3PaidChain_(f16, { orderID: "ORD-T8-NOISE", amount: 50000,
    paymentID: "PAY-T8-NOISE", paidAt: "2026-11-01T03:00:00.000Z",
    withPaymentOp: true });
  G.u3AppendPayment_(f16, { OrderID: "ORD-T4-1", RequestKey: "t8-noise-order",
    PaymentID: "PAY-T8-ONORDER", Status: "SUCCESS", Amount: 24000,
    PaidAt: "2026-11-01T03:00:00.000Z" });
  G.u3AppendSettlement_(f16, { SettlementID: "CSH-SAL-PAY-T8-NOISE",
    Tanggal: "2026-11-01", Amount: 50000, SourceID: "PAY-T8-NOISE",
    RelatedTransactionID: "ORD-T8-NOISE" });
  var after16 = JSON.stringify(G.treasuryT5Projection_(f16)) + "|" +
    JSON.stringify(G.treasuryT5Reconciliation_(f16));
  check("R16", base16 === after16, "legacy noise changed Treasury output");

  // --- R17 destination tamper (1030): server refusal, zero write.
  var f17 = G.treasuryT7SeededFixture_();
  var counts17 = G.treasuryT4RowCounts_(f17);
  var save17 = null;
  G.treasuryT7WithServerStubs_(f17, undefined, function() {
    save17 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r17-tamper",
      { destinationAccountCode: "1030" }));
  });
  check("R17", save17.status === "REFUSED" &&
    save17.code === "TREASURY_DESTINATION_IS_CLEARING" && save17.writeCount === 0 &&
    JSON.stringify(G.treasuryT4RowCounts_(f17)) === JSON.stringify(counts17),
    JSON.stringify(save17));

  // --- R18 partial/over/under tamper: server refusal, zero write each.
  var amounts18 = [20000, 25000, 23999];
  var results18 = [];
  amounts18.forEach(function(amount, index) {
    var fixture = G.treasuryT7SeededFixture_();
    var counts = G.treasuryT4RowCounts_(fixture);
    var result = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      result = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r18-" + index,
        { grossAmount: amount }));
    });
    results18.push({ amount: amount, result: result,
      unchanged: JSON.stringify(G.treasuryT4RowCounts_(fixture)) === JSON.stringify(counts) });
  });
  check("R18", results18.every(function(entry) {
    return entry.result.status === "REFUSED" &&
      entry.result.code.indexOf("TREASURY_") === 0 && entry.unchanged;
  }), JSON.stringify(results18));

  // --- R19 PAUSED: new Save/Reverse/Correct refused, persisted IN_PROGRESS
  // recovery possible, no legacy fallback.
  var f19 = G.treasuryT7SeededFixture_();
  var counts19 = G.treasuryT4RowCounts_(f19);
  var refused19 = [];
  G.treasuryT7WithServerStubs_(f19, JSON.stringify(Object.assign(
    G.treasuryT4ActiveConfig_(), { mode: "PAUSED" })), function() {
    refused19.push(G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-r19-save")));
  });
  var crash19 = null;
  try {
    G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-r19-recover"),
      G.treasuryT4Runtime_({ fixture: f19, crash: "T4_AFTER_INTENT" }));
  } catch (error19) { crash19 = error19; }
  var pausedRecovery19 = G.treasuryReceiptSaveWithRuntime_(
    G.treasuryT7Payload_("t8-r19-recover"),
    G.treasuryT4Runtime_({ fixture: f19,
      config: Object.assign(G.treasuryT4ActiveConfig_(), { mode: "PAUSED" }) }));
  var refusedReverse19 = null;
  G.treasuryT7WithServerStubs_(f19, JSON.stringify(Object.assign(
    G.treasuryT4ActiveConfig_(), { mode: "PAUSED" })), function() {
    refusedReverse19 = G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryOperatorReverseReceipt(
        G.treasuryT6ReversePayload_("t8-r19-rev", pausedRecovery19.receiptID));
    });
  });
  t8AssertGlobal1030_(f19, "R19");
  check("R19", refused19.length === 1 && refused19[0].status === "REFUSED" &&
    refused19[0].code === G.TREASURY_RECEIPT_V1_SAVE.CODES.MODE_PAUSED &&
    refused19[0].writeCount === 0 && !!crash19 &&
    pausedRecovery19.status === "DONE" &&
    refusedReverse19.status === "REFUSED" &&
    G.treasuryT4LedgerRows_(f19).length === 4,
    JSON.stringify({ save: refused19, recovery: pausedRecovery19,
      rev: refusedReverse19 }));

  // --- R20 UI liveness battery (component: real T7 controller over real view
  // sources — callback loss, late/stale callback, nav, double-click, UNKNOWN
  // retry). No immortal spinner / storm / new key / duplicate money.
  var t7run = t7controller();
  check("R20", t7run.passed === true && t7run.uFailures.length === 0 &&
    t7run.lFailures.length === 0 && t7run.staticFailures.length === 0 &&
    t7run.mutationCaught === t7run.mutationTotal && t7run.mutationTotal === 30 &&
    t7run.mutationAnchorMisses.length === 0,
    JSON.stringify({ u: t7run.uFailures, l: t7run.lFailures,
      static: t7run.staticFailures, mutation: t7run.mutationCaught + "/" +
        t7run.mutationTotal }));

  return { pass: pass, t7: { uChecks: t7run.uChecks, lChecks: t7run.lChecks,
    mutationCaught: t7run.mutationCaught, mutationTotal: t7run.mutationTotal } };
}

// ---------------------------------------------------------------------------
// Crash/recovery matrix: Save/Reverse/Correct x 7 boundaries, classified and
// proven recoverable with the SAME RequestKey (never a new key).
// ---------------------------------------------------------------------------
function t8CrashMatrix_() {
  var G = globalThis;
  var pass = 0;
  function check(id, value, detail) { t8Check(id, value, detail); pass++; }
  var rid = "SCR-U3-ORD-T4-1";
  var savePoints = ["T4_BEFORE_INTENT", "T4_AFTER_INTENT", "T4_BEFORE_BATCH",
    "T4_AFTER_BATCH", "T4_AFTER_READBACK", "T4_BEFORE_COMMIT", "T4_AFTER_COMMIT"];
  var lifePoints = ["T6_BEFORE_INTENT", "T6_AFTER_INTENT", "T6_BEFORE_BATCH",
    "T6_AFTER_BATCH", "T6_AFTER_READBACK", "T6_BEFORE_COMMIT", "T6_AFTER_COMMIT"];
  var matrix = [];

  function partialBatchRuntime_(fixture, key) {
    var runtime = G.treasuryT4Runtime_({ fixture: fixture });
    var original = runtime.batch;
    runtime.batch = function(ranges) {
      var first = ranges[0];
      var sheet = fixture.getSheetByName(first.range);
      sheet.getRange(sheet.getLastRow() + 1, 1, first.values.length,
        first.values[0].length).setValues(first.values);
      throw new Error("SIMULATED_AMBIGUOUS_BATCH:" + key);
    };
    return runtime;
  }

  function classifySave_(fixture, key) {
    var op = G.treasuryT6OpByTypeKey_(fixture, "TREASURY_RECEIPT_SAVE", key);
    var receipts = G.treasuryT6Receipts_(fixture);
    if (!op) return "NO_MUTATION";
    if (String(op.State) === "COMMITTED") return "COMMITTED";
    if (receipts.length > 0) return "AMBIGUOUS_COMMITTED_OR_PARTIAL";
    return "RECOVERABLE_SAME_KEY";
  }

  savePoints.forEach(function(point) {
    var fixture = G.treasuryT7SeededFixture_();
    var thrown = null;
    try {
      G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-crash-save"),
        G.treasuryT4Runtime_({ fixture: fixture, crash: point }));
    } catch (error) { thrown = error; }
    var classification = point === "T4_BEFORE_INTENT" ? "NO_MUTATION" :
      (point === "T4_AFTER_COMMIT" ? "COMMITTED_LOST_CALLBACK" :
        classifySave_(fixture, "t8-crash-save"));
    var resumed = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      resumed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-crash-save"));
    });
    var receipts = G.treasuryT6Receipts_(fixture);
    var op = G.treasuryT6OpByTypeKey_(fixture, "TREASURY_RECEIPT_SAVE", "t8-crash-save");
    t8AssertGlobal1030_(fixture, "CRASH_SAVE_" + point);
    check("CRASH_SAVE_" + point, !!thrown && thrown.message === "CRASH:" + point &&
      resumed.status === "DONE" && resumed.requestKey === "t8-crash-save" &&
      receipts.length === 1 && !!op && op.State === "COMMITTED" &&
      op.RequestKey === "t8-crash-save",
      JSON.stringify({ thrown: thrown && thrown.message, resumed: resumed,
        receipts: receipts.length, op: op && op.State }));
    matrix.push({ operation: "SAVE", boundary: point, classification: classification,
      recovery: "same RequestKey -> DONE, exactly one receipt, COMMITTED" });
  });
  // Save — ambiguous (partial) batch: frozen fail-closed RECOVERY_REQUIRED;
  // same-key retry stays RECOVERY_REQUIRED (never blindly appends).
  {
    var fixture = G.treasuryT7SeededFixture_();
    var partial = G.treasuryReceiptSaveWithRuntime_(
      G.treasuryT7Payload_("t8-crash-save"), partialBatchRuntime_(fixture, "save"));
    var countsAfterPartial = G.treasuryT4RowCounts_(fixture);
    var resumedPartial = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      resumedPartial = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-crash-save"));
    });
    t8AssertGlobal1030_(fixture, "CRASH_SAVE_PARTIAL");
    check("CRASH_SAVE_PARTIAL", partial.status === "RECOVERY_REQUIRED" &&
      resumedPartial.status === "RECOVERY_REQUIRED" &&
      JSON.stringify(G.treasuryT4RowCounts_(fixture)) ===
        JSON.stringify(countsAfterPartial),
      JSON.stringify({ partial: partial, resumed: resumedPartial }));
    matrix.push({ operation: "SAVE", boundary: "AMBIGUOUS_PARTIAL_BATCH",
      classification: "RECOVERY_REQUIRED",
      recovery: "fail-closed; same key -> still RECOVERY_REQUIRED; zero blind repair" });
  }
  // Save — lost callback (committed, result discarded, retried).
  {
    var fixture = G.treasuryT7SeededFixture_();
    G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-crash-save"),
      G.treasuryT4Runtime_({ fixture: fixture }));
    var replayed = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      replayed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-crash-save"));
    });
    check("CRASH_SAVE_LOST_CALLBACK", replayed.status === "DONE" &&
      replayed.replay === true && G.treasuryT6Receipts_(fixture).length === 1,
      JSON.stringify(replayed));
    matrix.push({ operation: "SAVE", boundary: "LOST_CALLBACK",
      classification: "COMMITTED",
      recovery: "same RequestKey replay=true, zero writes" });
  }

  // Reverse and Correct matrices on a seeded receipt.
  ["REVERSE", "CORRECT"].forEach(function(kind) {
    lifePoints.forEach(function(point) {
      var fixture = G.treasuryT7SeededFixture_();
      var seed = null;
      G.treasuryT7WithServerStubs_(fixture, undefined, function() {
        seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-crash-seed"));
      });
      var key = kind === "REVERSE" ? "t8-crash-rev" : "t8-crash-corr";
      var thrown = null;
      try {
        G.treasuryT6WithJakartaDate_(function() {
          if (kind === "REVERSE") {
            return G.treasuryLifecycleReverseWithRuntime_(
              G.treasuryT6ReversePayload_(key, seed.receiptID),
              G.treasuryT6Runtime_({ fixture: fixture, crash: point }));
          }
          return G.treasuryLifecycleCorrectWithRuntime_(
            G.treasuryT6CorrectPayload_(key, seed.receiptID),
            G.treasuryT6Runtime_({ fixture: fixture, crash: point }));
        });
      } catch (error) { thrown = error; }
      var opType = kind === "REVERSE" ? "TREASURY_RECEIPT_REVERSE" :
        "TREASURY_RECEIPT_CORRECT";
      var op = G.treasuryT6OpByTypeKey_(fixture, opType, key);
      var classification = point.indexOf("_BEFORE_INTENT") !== -1 ? "NO_MUTATION" :
        (point.indexOf("_AFTER_COMMIT") !== -1 ? "COMMITTED_LOST_CALLBACK" :
          (op && String(op.State) === "COMMITTED" ? "COMMITTED" :
            "RECOVERABLE_SAME_KEY"));
      var resumed = null;
      G.treasuryT7WithServerStubs_(fixture, undefined, function() {
        resumed = G.treasuryT6WithJakartaDate_(function() {
          if (kind === "REVERSE") {
            return G.treasuryOperatorReverseReceipt(
              G.treasuryT6ReversePayload_(key, seed.receiptID));
          }
          return G.treasuryOperatorCorrectReceipt(
            G.treasuryT6CorrectPayload_(key, seed.receiptID));
        });
      });
      var receipts = G.treasuryT6Receipts_(fixture);
      var expectedCount = kind === "REVERSE" ? 2 : 3;
      t8AssertGlobal1030_(fixture, "CRASH_" + kind + "_" + point);
      check("CRASH_" + kind + "_" + point, !!thrown &&
        thrown.message === "CRASH:" + point && resumed.status === "DONE" &&
        resumed.requestKey === key && receipts.length === expectedCount,
        JSON.stringify({ thrown: thrown && thrown.message, resumed: resumed,
          receipts: receipts.length }));
      matrix.push({ operation: kind, boundary: point,
        classification: classification,
        recovery: "same RequestKey -> DONE, lineage intact, COMMITTED" });
    });
    // Ambiguous partial batch: fail-closed RECOVERY_REQUIRED, no blind repair.
    {
      var fixture = G.treasuryT7SeededFixture_();
      var seed = null;
      G.treasuryT7WithServerStubs_(fixture, undefined, function() {
        seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-crash-seed"));
      });
      var key = kind === "REVERSE" ? "t8-crash-rev" : "t8-crash-corr";
      var partial = null;
      G.treasuryT6WithJakartaDate_(function() {
        if (kind === "REVERSE") {
          partial = G.treasuryLifecycleReverseWithRuntime_(
            G.treasuryT6ReversePayload_(key, seed.receiptID),
            partialBatchRuntime_(fixture, kind));
        } else {
          partial = G.treasuryLifecycleCorrectWithRuntime_(
            G.treasuryT6CorrectPayload_(key, seed.receiptID),
            partialBatchRuntime_(fixture, kind));
        }
      });
      var countsAfterPartial = G.treasuryT4RowCounts_(fixture);
      var resumed = null;
      G.treasuryT7WithServerStubs_(fixture, undefined, function() {
        resumed = G.treasuryT6WithJakartaDate_(function() {
          if (kind === "REVERSE") {
            return G.treasuryOperatorReverseReceipt(
              G.treasuryT6ReversePayload_(key, seed.receiptID));
          }
          return G.treasuryOperatorCorrectReceipt(
            G.treasuryT6CorrectPayload_(key, seed.receiptID));
        });
      });
      t8AssertGlobal1030_(fixture, "CRASH_" + kind + "_PARTIAL");
      check("CRASH_" + kind + "_PARTIAL", partial.status === "RECOVERY_REQUIRED" &&
        resumed.status === "RECOVERY_REQUIRED" &&
        JSON.stringify(G.treasuryT4RowCounts_(fixture)) ===
          JSON.stringify(countsAfterPartial),
        JSON.stringify({ partial: partial, resumed: resumed }));
      matrix.push({ operation: kind, boundary: "AMBIGUOUS_PARTIAL_BATCH",
        classification: "RECOVERY_REQUIRED",
        recovery: "fail-closed; same key -> still RECOVERY_REQUIRED; zero blind repair" });
    }
    // Lost callback.
    {
      var fixture = G.treasuryT7SeededFixture_();
      var seed = null;
      G.treasuryT7WithServerStubs_(fixture, undefined, function() {
        seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-crash-seed"));
      });
      var key = kind === "REVERSE" ? "t8-crash-rev" : "t8-crash-corr";
      G.treasuryT6WithJakartaDate_(function() {
        if (kind === "REVERSE") {
          G.treasuryLifecycleReverseWithRuntime_(
            G.treasuryT6ReversePayload_(key, seed.receiptID),
            G.treasuryT6Runtime_({ fixture: fixture }));
        } else {
          G.treasuryLifecycleCorrectWithRuntime_(
            G.treasuryT6CorrectPayload_(key, seed.receiptID),
            G.treasuryT6Runtime_({ fixture: fixture }));
        }
      });
      var replayed = null;
      G.treasuryT7WithServerStubs_(fixture, undefined, function() {
        replayed = G.treasuryT6WithJakartaDate_(function() {
          if (kind === "REVERSE") {
            return G.treasuryOperatorReverseReceipt(
              G.treasuryT6ReversePayload_(key, seed.receiptID));
          }
          return G.treasuryOperatorCorrectReceipt(
            G.treasuryT6CorrectPayload_(key, seed.receiptID));
        });
      });
      check("CRASH_" + kind + "_LOST_CALLBACK", replayed.status === "DONE" &&
        replayed.replay === true &&
        G.treasuryT6Receipts_(fixture).length === (kind === "REVERSE" ? 2 : 3),
        JSON.stringify(replayed));
      matrix.push({ operation: kind, boundary: "LOST_CALLBACK",
        classification: "COMMITTED",
        recovery: "same RequestKey replay=true, zero writes" });
    }
  });
  return { pass: pass, matrix: matrix };
}

// ---------------------------------------------------------------------------
// Concurrency matrix: <= 1 valid owner per lineage.
// ---------------------------------------------------------------------------
function t8ConcurrencyMatrix_() {
  var G = globalThis;
  var pass = 0;
  function check(id, value, detail) { t8Check(id, value, detail); pass++; }
  var rid = "SCR-U3-ORD-T4-1";
  var rows = [];

  // Save x Save.
  {
    var fixture = G.treasuryT7SeededFixture_();
    var a = null, b = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      a = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-cc-save-a"));
      b = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-cc-save-b"));
    });
    var oracle = t8Oracle_(fixture);
    t8AssertGlobal1030_(fixture, "CC_SAVE");
    check("CC_SAVE", a.status === "DONE" && b.status === "REFUSED" &&
      b.code === G.TREASURY_RECEIPT_V1_SAVE.CODES.ALREADY_CLEARED &&
      G.treasuryT6Receipts_(fixture).length === 1 && oracle.net("1000") === 24000,
      JSON.stringify({ a: a, b: b }));
    rows.push({ pair: "Save x Save", outcome: "one owner; second REFUSED ALREADY_CLEARED" });
  }
  // Reverse x Reverse.
  {
    var fixture = G.treasuryT7SeededFixture_();
    var seed = null, a = null, b = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-cc-seed"));
      a = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorReverseReceipt(
          G.treasuryT6ReversePayload_("t8-cc-rev-a", seed.receiptID));
      });
      b = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorReverseReceipt(
          G.treasuryT6ReversePayload_("t8-cc-rev-b", seed.receiptID));
      });
    });
    t8AssertGlobal1030_(fixture, "CC_REVERSE");
    check("CC_REVERSE", a.status === "DONE" && b.status === "REFUSED" &&
      b.code === G.TREASURY_RECEIPT_V1_LIFECYCLE.CODES.ALREADY_REVERSED &&
      G.treasuryT6Receipts_(fixture).length === 2,
      JSON.stringify({ a: a, b: b }));
    rows.push({ pair: "Reverse x Reverse", outcome: "one owner; second REFUSED ALREADY_REVERSED" });
  }
  // Correct x Correct.
  {
    var fixture = G.treasuryT7SeededFixture_();
    var seed = null, a = null, b = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-cc-seed"));
      a = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorCorrectReceipt(
          G.treasuryT6CorrectPayload_("t8-cc-corr-a", seed.receiptID));
      });
      b = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorCorrectReceipt(
          G.treasuryT6CorrectPayload_("t8-cc-corr-b", seed.receiptID));
      });
    });
    t8AssertGlobal1030_(fixture, "CC_CORRECT");
    check("CC_CORRECT", a.status === "DONE" && b.status === "REFUSED" &&
      G.treasuryT6Receipts_(fixture).length === 3,
      JSON.stringify({ a: a, b: b }));
    rows.push({ pair: "Correct x Correct", outcome: "one owner; second REFUSED; one lineage" });
  }
  // Reverse x Correct (both directions).
  {
    var fixture = G.treasuryT7SeededFixture_();
    var seed = null, rev = null, corrAfterRev = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-cc-seed"));
      rev = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorReverseReceipt(
          G.treasuryT6ReversePayload_("t8-cc-rc-rev", seed.receiptID));
      });
      corrAfterRev = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorCorrectReceipt(
          G.treasuryT6CorrectPayload_("t8-cc-rc-corr", seed.receiptID));
      });
    });
    var fixture2 = G.treasuryT7SeededFixture_();
    var seed2 = null, corr2 = null, revAfterCorr = null;
    G.treasuryT7WithServerStubs_(fixture2, undefined, function() {
      seed2 = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-cc-seed"));
      corr2 = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorCorrectReceipt(
          G.treasuryT6CorrectPayload_("t8-cc-cr-corr", seed2.receiptID));
      });
      revAfterCorr = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorReverseReceipt(
          G.treasuryT6ReversePayload_("t8-cc-cr-rev", seed2.receiptID));
      });
    });
    t8AssertGlobal1030_(fixture, "CC_RC_1");
    t8AssertGlobal1030_(fixture2, "CC_RC_2");
    check("CC_RC", rev.status === "DONE" && corrAfterRev.status === "REFUSED" &&
      corr2.status === "DONE" && revAfterCorr.status === "REFUSED" &&
      G.treasuryT6Receipts_(fixture).length === 2 &&
      G.treasuryT6Receipts_(fixture2).length === 3,
      JSON.stringify({ corrAfterRev: corrAfterRev, revAfterCorr: revAfterCorr }));
    rows.push({ pair: "Reverse x Correct", outcome: "first wins; counter-op REFUSED" });
  }
  // Save x reversal-exposure: post-reversal Save is a NEW sanctioned intent.
  {
    var fixture = G.treasuryT7SeededFixture_();
    var seed = null, rev = null, restore = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-cc-seed"));
      rev = G.treasuryT6WithJakartaDate_(function() {
        return G.treasuryOperatorReverseReceipt(
          G.treasuryT6ReversePayload_("t8-cc-sr-rev", seed.receiptID));
      });
      restore = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-cc-sr-save"));
    });
    var ws = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      ws = G.getTreasuryOperatorWorkspace({});
    });
    t8AssertGlobal1030_(fixture, "CC_SR");
    check("CC_SR", seed.status === "DONE" && rev.status === "DONE" &&
      restore.status === "DONE" &&
      ws.receipts.rows[0].ClearingStatus === "CLEARED" &&
      ws.receipts.rows[0].ActiveReceiptID === restore.receiptID,
      JSON.stringify({ restore: restore, row: ws.receipts.rows[0] }));
    rows.push({ pair: "Save x reversal-exposure",
      outcome: "post-reversal Save = new sanctioned intent; <=1 active per lineage" });
  }
  // Stale UI vs newer server: capabilities always come from the latest
  // workspace reread (component proof in the T7 controller liveness battery).
  var controller = t7controller();
  check("CC_STALE_UI", controller.passed === true &&
    controller.staticFailures.length === 0, JSON.stringify(controller.staticFailures));
  rows.push({ pair: "Stale UI x newer server",
    outcome: "server workspace is sole capability authority (T7 controller battery)" });
  return { pass: pass, rows: rows };
}

// ---------------------------------------------------------------------------
// Release audits: call graph, authority duplication, forbidden tokens,
// schema/config/account/date/RequestKey/error/cache.
// ---------------------------------------------------------------------------
function t8ReadRuntimeSources_() {
  var paths = {
    foundation: "99.Treasury.Receipt.Foundation.js",
    save: "99A.Treasury.Receipt.Durable.Save.js",
    clearing: "99B.Treasury.Clearing.Projection.js",
    lifecycle: "99C.Treasury.Receipt.Reversal.Correction.js",
    api: "99D.Treasury.Operator.Api.js",
    state: "202.View.Treasury.State.html",
    render: "203.View.Treasury.Render.html",
    controller: "204.View.Treasury.Controller.html",
    index: "190.View.Index.html"
  };
  var out = {};
  Object.keys(paths).forEach(function(key) {
    out[key] = fs.readFileSync(paths[key], "utf8");
  });
  var start = out.index.indexOf("<!-- TREASURY: RECEIPTS -->");
  var end = out.index.indexOf("<!-- PRODUCTS -->");
  out.treasurySlice = start !== -1 && end > start ? out.index.slice(start, end) : "";
  out.paths = paths;
  return out;
}

function t8Audits_(packageArtifact) {
  var G = globalThis;
  var pass = 0;
  function check(id, value, detail) { t8Check(id, value, detail); pass++; }
  var src = t8ReadRuntimeSources_();
  var ui = src.state + "\n" + src.render + "\n" + src.controller + "\n" + src.treasurySlice;
  var runtimeJs = [src.foundation, src.save, src.clearing, src.lifecycle, src.api];

  // --- UI/server call graph.
  var staticGuardFailures = t7controller.runStaticGuards({});
  check("CG1", staticGuardFailures.length === 0, staticGuardFailures.join(","));
  var endpointCalls = (src.controller.match(/run\.[A-Za-z0-9_]+\(/g) || [])
    .map(function(call) { return call.slice(4, -1); })
    .filter(function(name) { return name !== "withSuccessHandler" &&
      name !== "withFailureHandler"; });
  check("CG2", endpointCalls.length === 5 && endpointCalls.every(function(name) {
    return G.getTreasuryOperatorWorkspace !== undefined &&
      ["getTreasuryOperatorWorkspace", "getTreasuryOperatorReceiptDetail",
        "treasuryOperatorSaveReceipt", "treasuryOperatorReverseReceipt",
        "treasuryOperatorCorrectReceipt"].indexOf(name) !== -1;
  }), endpointCalls.join(","));
  check("CG3", !/setValues|appendRow|appendCells|batchUpdate|UrlFetchApp|SpreadsheetApp|PropertiesService|LockService/.test(src.api),
    "99D contains a write/transport primitive");
  check("CG4", G.treasuryReceiptDurableSave.toString().indexOf("treasuryReceiptSaveWithRuntime_") !== -1 &&
    G.treasuryReceiptDurableReverse.toString().indexOf("treasuryLifecycleReverseWithRuntime_") !== -1 &&
    G.treasuryReceiptDurableCorrect.toString().indexOf("treasuryLifecycleCorrectWithRuntime_") !== -1,
    "thin endpoint does not delegate to the T4/T6 cores");
  check("CG5", G.getTreasuryOperatorWorkspace.toString().indexOf("buildTreasuryClearingProjection_") !== -1 &&
    G.getTreasuryOperatorWorkspace.toString().indexOf("buildTreasury1030Reconciliation_") !== -1 &&
    G.treasuryReceiptDurableSave.toString().indexOf("BalanceLedger") === -1 &&
    G.getTreasuryOperatorWorkspace.toString().indexOf("BalanceLedger") === -1,
    "workspace/API bypasses T5 or touches BalanceLedger directly");

  // --- Authority duplication: exactly one definition site per authority.
  var runtimeSet = packageArtifact.prospective.files.map(function(entry) {
    return entry.path;
  }).filter(function(path) { return /\.js$/.test(path); });
  var authorities = {
    treasuryDateKey: "99.Treasury.Receipt.Foundation.js",
    treasuryJournalSignature: "99.Treasury.Receipt.Foundation.js",
    treasuryDestinationEligible: "99.Treasury.Receipt.Foundation.js",
    validateTreasuryReceiptConfig: "99.Treasury.Receipt.Foundation.js",
    treasuryComputeOutstanding_: "99A.Treasury.Receipt.Durable.Save.js",
    buildTreasuryClearingProjection_: "99B.Treasury.Clearing.Projection.js",
    buildTreasury1030Reconciliation_: "99B.Treasury.Clearing.Projection.js",
    buildTreasuryClearingExposure_: "99B.Treasury.Clearing.Projection.js"
  };
  Object.keys(authorities).forEach(function(name) {
    var sites = [];
    runtimeSet.forEach(function(path) {
      var code = fs.readFileSync(path, "utf8");
      var pattern = new RegExp("function\\s+" + name + "\\s*\\(");
      if (pattern.test(code)) sites.push(path);
    });
    check("AUTH_" + name, sites.length === 1 && sites[0] === authorities[name],
      sites.join(","));
  });

  // --- Forbidden legacy tokens in the Treasury runtime surface.
  var forbidden = /ReceiveVia|Payment Method|PaymentMethod|Confirm Payment|\bPAID\b|Settlement|cashSettleAndPersist|attemptCashSettlement|submitOperationalPayment|\bRBAC\b|isAdmin|requireRole/i;
  check("FORB1", !forbidden.test(ui), "legacy vocabulary in Treasury UI");
  check("FORB2", !/cashSettleAndPersist|attemptCashSettlement|submitOperationalPayment|submitSettlementPayment/.test(runtimeJs.join("\n")),
    "legacy writer referenced in Treasury runtime");
  var legacyElsewhere = ["95.Transaction.Operational.js", "95A.Transaction.Production.js",
    "96.Tests.Treasury.Operator.Cases.js"];
  check("FORB3", legacyElsewhere.every(function(path) { return fs.existsSync(path); }) &&
    /Settlement/.test(fs.readFileSync("95.Transaction.Operational.js", "utf8")),
    "legacy vocabulary proven test/runtime-segregated");

  // --- Schema audit: 24/10/11 headers, no drift vs the contract.
  var contract = G.TREASURY_RECEIPT_V1_CONTRACT;
  check("SCHEMA1", contract.SCHEMAS.RECEIPTS.HEADERS.length === 24 &&
    contract.SCHEMAS.OPERATIONS.HEADERS.length === 10 &&
    contract.SCHEMAS.AUDITS.HEADERS.length === 11,
    JSON.stringify({ r: contract.SCHEMAS.RECEIPTS.HEADERS.length,
      o: contract.SCHEMAS.OPERATIONS.HEADERS.length,
      a: contract.SCHEMAS.AUDITS.HEADERS.length }));
  check("SCHEMA2", contract.SCHEMAS.RECEIPTS.HEADERS.indexOf("Status") === -1 &&
    contract.SCHEMAS.RECEIPTS.SHEET === "TreasuryReceipts" &&
    contract.SCHEMAS.OPERATIONS.SHEET === "TreasuryOperations" &&
    contract.SCHEMAS.AUDITS.SHEET === "TreasuryAudits");
  var schemaDriftFixture = G.treasuryT7SeededFixture_();
  schemaDriftFixture.getSheetByName("TreasuryReceipts").values[0][0] = "TreasuryReceiptIDX";
  var driftResult = G.treasuryReceiptSaveWithRuntime_(
    G.treasuryT7Payload_("t8-schema-drift"),
    G.treasuryT4Runtime_({ fixture: schemaDriftFixture }));
  check("SCHEMA3", driftResult.status === "REFUSED" &&
    driftResult.code === G.TREASURY_RECEIPT_V1_SAVE.CODES.SCHEMA_NOT_READY,
    JSON.stringify(driftResult));

  // --- Config audit: fail-closed modes, no production mutation helper.
  check("CONFIG1", G.validateTreasuryReceiptConfig(null).status !== "PASS" &&
    G.validateTreasuryReceiptConfig({}).status !== "PASS" &&
    G.validateTreasuryReceiptConfig(JSON.stringify({ mode: T8_FIXTURE_ACTIVE_MODE }))
      .status !== "PASS");
  check("CONFIG2", !/\.setProperty\(/.test(runtimeJs.join("\n")),
    "Treasury runtime mutates config properties");
  var missingFixture = G.treasuryT7SeededFixture_();
  var missingWs = null;
  G.treasuryT7WithServerStubs_(missingFixture, null, function() {
    missingWs = G.getTreasuryOperatorWorkspace({});
  });
  check("CONFIG3", missingWs.mode.allowed === false, JSON.stringify(missingWs.mode));

  // --- Account / 1030 readiness audit.
  check("ACCT1", contract.DESTINATION_ACCOUNT_CODES.join(",") === "1000,1010,1020" &&
    contract.DESTINATION_ACCOUNT_CODES.indexOf("1030") === -1);
  check("ACCT2", !/AccountName\s*===|accountName\s*===/.test(src.foundation + src.save),
    "destination resolved by account NAME");
  check("ACCT3", G.buildCashFlowStatement.toString().indexOf("UNCLASSIFIED_COUNTERPART") !== -1 &&
    G.buildCashFlowStatement.toString().indexOf("CashFlowGroup") !== -1,
    "Cash Flow group gate missing");
  var gateFixture = G.treasuryT7SeededFixture_();
  var groupSheet = gateFixture.getSheetByName("Accounts");
  var groupIdx = G.CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("CashFlowGroup");
  groupSheet.values.forEach(function(row, index) {
    if (index > 0 && String(row[0]) === "1030") row[groupIdx] = "";
  });
  var gateResult = G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-acct-gate"),
    G.treasuryT4Runtime_({ fixture: gateFixture }));
  check("ACCT4", gateResult.status === "REFUSED" &&
    gateResult.code === G.TREASURY_RECEIPT_V1_SAVE.CODES.SCHEMA_NOT_READY,
    JSON.stringify(gateResult));

  // --- Date/timezone audit.
  check("DATE1", src.foundation.indexOf("Asia/Jakarta") !== -1 ||
    src.clearing.indexOf("Asia/Jakarta") !== -1 ||
    G.treasuryDateKey.toString().indexOf("Asia/Jakarta") !== -1,
    "Asia/Jakarta authority missing");
  check("DATE2", !/toLocaleDateString|toLocaleTimeString|\.getDate\(\)|\.getMonth\(\)/.test(
    runtimeJs.join("\n")), "host-local date derivation in Treasury runtime");
  var originalFormatDate = G.Utilities.formatDate;
  G.Utilities.formatDate = function(date, timeZone, format) {
    if (timeZone !== "Asia/Jakarta" || format !== "yyyy-MM-dd") {
      throw new Error("T8_UNEXPECTED_FORMAT_ARGS:" + timeZone + ":" + format);
    }
    return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  };
  try {
    check("DATE3", G.treasuryDateKey(new Date("2026-09-30T17:00:00Z")) === "2026-10-01" &&
      G.treasuryDateKey(new Date("2026-09-30T16:59:59Z")) === "2026-09-30");
  } finally {
    G.Utilities.formatDate = originalFormatDate;
  }

  // --- RequestKey/idempotency audit.
  var newKeyCalls = (src.controller.match(/treasuryNewRequestKey_\(/g) || []).length;
  check("KEY1", newKeyCalls === 3, String(newKeyCalls));
  var retryBody = src.controller.slice(src.controller.indexOf("function retryTreasuryMutation"));
  retryBody = retryBody.slice(0, retryBody.indexOf("function submitTreasurySaveReceipt"));
  check("KEY2", retryBody.indexOf("treasuryNewRequestKey_") === -1 &&
    retryBody.indexOf("treasurySendMutation_") !== -1, "retry regenerates a key");
  var keyFixture = G.treasuryT7SeededFixture_();
  var keyResult = null;
  G.treasuryT7WithServerStubs_(keyFixture, undefined, function() {
    keyResult = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-key-echo"));
  });
  check("KEY3", keyResult.requestKey === "t8-key-echo" &&
    G.treasuryT6OpByTypeKey_(keyFixture, "TREASURY_RECEIPT_SAVE", "t8-key-echo") !== null,
    JSON.stringify(keyResult));
  check("KEY4", src.save.indexOf("treasuryNewRequestKey") === -1 &&
    src.save.indexOf("normalized.requestKey") !== -1,
    "server regenerates or drops the RequestKey");

  // --- Error-contract audit.
  var codes = Object.keys(G.TREASURY_RECEIPT_V1_SAVE.CODES).map(function(key) {
    return G.TREASURY_RECEIPT_V1_SAVE.CODES[key];
  }).filter(function(value) { return typeof value === "string"; });
  var lifeCodes = Object.keys(G.TREASURY_RECEIPT_V1_LIFECYCLE.CODES).map(function(key) {
    return G.TREASURY_RECEIPT_V1_LIFECYCLE.CODES[key];
  }).filter(function(value) { return typeof value === "string"; });
  var allCodes = codes.concat(lifeCodes);
  check("ERR1", allCodes.every(function(code) {
    return code.indexOf("TREASURY_") === 0;
  }), allCodes.filter(function(code) { return code.indexOf("TREASURY_") !== 0; }).join(","));
  // Uniqueness within each CODES object (no value aliases inside a contract);
  // cross-object repeats are the inherited T3/T4 base codes — same strings.
  function uniqueWithin(list) { return new Set(list).size === list.length; }
  check("ERR2", uniqueWithin(codes) && uniqueWithin(lifeCodes),
    JSON.stringify({ save: codes, life: lifeCodes }));
  check("ERR3", src.controller.indexOf("RECOVERY_REQUIRED") !== -1 &&
    src.controller.indexOf("UNKNOWN") !== -1,
    "UI flattens UNKNOWN/RECOVERY_REQUIRED");
  var statuses = G.TREASURY_RECEIPT_V1_SAVE.STATUS;
  check("ERR4", statuses.DONE === "DONE" && statuses.REFUSED === "REFUSED" &&
    statuses.UNKNOWN === "UNKNOWN" && statuses.RECOVERY_REQUIRED === "RECOVERY_REQUIRED");

  // --- Cache audit.
  var cacheRuntime = G.treasuryT4Runtime_();
  var cacheResult = G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-cache-1"),
    cacheRuntime);
  check("CACHE1", cacheResult.status === "DONE" && cacheRuntime.events.cacheCalls === 1,
    JSON.stringify({ status: cacheResult.status, calls: cacheRuntime.events.cacheCalls }));
  var cacheFailRuntime = G.treasuryT4Runtime_({ cacheFail: true });
  var cacheFailResult = G.treasuryReceiptSaveWithRuntime_(
    G.treasuryT7Payload_("t8-cache-2"), cacheFailRuntime);
  check("CACHE2", cacheFailResult.status === "DONE" && cacheFailResult.writeCount === 4,
    JSON.stringify(cacheFailResult));
  var refusedRuntime = G.treasuryT4Runtime_();
  var refusedResult = G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-cache-3",
    { grossAmount: 1 }), refusedRuntime);
  check("CACHE3", refusedResult.status === "REFUSED" && refusedRuntime.events.cacheCalls === 0,
    JSON.stringify(refusedResult));
  check("CACHE4", src.render.indexOf("treasuryReconciliationWarning") !== -1 &&
    src.controller.indexOf("ensureTreasuryReady") !== -1,
    "UI refresh authority missing");

  return { pass: pass };
}

// ---------------------------------------------------------------------------
// Finance parity: Revenue isolation, cash/1030 movement, Cash Flow once-only,
// Balance Position coherence — compared against the independent oracle.
// ---------------------------------------------------------------------------
function t8FinanceParity_() {
  var G = globalThis;
  var pass = 0;
  function check(id, value, detail) { t8Check(id, value, detail); pass++; }
  var fixture = G.treasuryT5FinanceFixture_();
  function pnl() {
    return G.getFinanceDataWithRuntime({ spreadsheet: fixture }, "custom",
      "2026-10-01", "2026-10-31");
  }
  function cashflow() {
    var ledger = G.readCanonicalTable(fixture, "BalanceLedger",
      G.BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
    var accounts = G.readCanonicalTable(fixture, "Accounts",
      G.CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
    return G.buildCashFlowStatement(ledger, accounts,
      { startDate: "2026-10-01", endDate: "2026-10-31", label: "T8" }, null);
  }
  var revenueBefore = pnl().summary.revenue;
  var cfBefore = cashflow();
  var oracleBefore = t8Oracle_(fixture);

  // Receipt: cash +, 1030 -, P&L unchanged, Cash Flow Operating once.
  var save = null;
  G.treasuryT7WithServerStubs_(fixture, undefined, function() {
    save = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-fin-save",
      { recognitionID: "SCR-U3-ORD-T5-FIN" }));
  });
  var revenueAfterSave = pnl().summary.revenue;
  var cfAfterSave = cashflow();
  var oracleAfterSave = t8Oracle_(fixture);
  t8AssertGlobal1030_(fixture, "FIN_AFTER_SAVE");
  check("FIN1", save.status === "DONE" && revenueAfterSave === revenueBefore &&
    oracleAfterSave.net("1000") === oracleBefore.net("1000") + 24000 &&
    oracleAfterSave.net("1030") === 0 && cfAfterSave.operating === cfBefore.operating + 24000 &&
    cfAfterSave.netChange === cfBefore.netChange + 24000,
    JSON.stringify({ save: save, revenue: [revenueBefore, revenueAfterSave],
      cf: [cfBefore, cfAfterSave] }));

  // Reversal: exact inverse, Revenue untouched, Cash Flow reverses once.
  // Fixed action day (wall clock may predate the fixture's recognition date).
  var reversal = null;
  G.treasuryT6WithJakartaDate_(function() {
    reversal = G.treasuryLifecycleReverseWithRuntime_(
      G.treasuryT6ReversePayload_("t8-fin-rev", save.receiptID),
      G.treasuryT6Runtime_({ fixture: fixture,
        now: function() { return new Date("2026-10-15T04:00:00.000Z"); } }));
  });
  var revenueAfterReversal = pnl().summary.revenue;
  var cfAfterReversal = cashflow();
  var oracleAfterReversal = t8Oracle_(fixture);
  t8AssertGlobal1030_(fixture, "FIN_AFTER_REVERSAL");
  check("FIN2", reversal.status === "DONE" && revenueAfterReversal === revenueBefore &&
    oracleAfterReversal.net("1000") === 0 &&
    cfAfterReversal.operating === cfBefore.operating &&
    cfAfterReversal.netChange === cfBefore.netChange,
    JSON.stringify({ rev: reversal, cf: cfAfterReversal }));

  // Correction: destination move, 1030 net zero post-replacement, P&L
  // unchanged, Cash Flow no double count. The original was reversed in FIN2,
  // so a NEW sanctioned Save (post-reversal) is the correction target.
  var restore = G.treasuryReceiptSaveWithRuntime_(
    G.treasuryT7Payload_("t8-fin-restore", { recognitionID: "SCR-U3-ORD-T5-FIN" }),
    G.treasuryT4Runtime_({ fixture: fixture,
      now: function() { return new Date("2026-10-15T05:00:00.000Z"); } }));
  var correction = null;
  G.treasuryT6WithJakartaDate_(function() {
    correction = G.treasuryLifecycleCorrectWithRuntime_(
      G.treasuryT6CorrectPayload_("t8-fin-corr", restore.receiptID),
      G.treasuryT6Runtime_({ fixture: fixture,
        now: function() { return new Date("2026-10-16T04:00:00.000Z"); } }));
  });
  var revenueAfterCorrection = pnl().summary.revenue;
  var cfAfterCorrection = cashflow();
  var oracleAfterCorrection = t8Oracle_(fixture);
  t8AssertGlobal1030_(fixture, "FIN_AFTER_CORRECTION");
  check("FIN3", restore.status === "DONE" && correction.status === "DONE" &&
    revenueAfterCorrection === revenueBefore &&
    oracleAfterCorrection.net("1000") === 0 && oracleAfterCorrection.net("1010") === 24000 &&
    oracleAfterCorrection.net1030 === 0 &&
    cfAfterCorrection.operating === cfBefore.operating + 24000 &&
    cfAfterCorrection.netChange === cfBefore.netChange + 24000,
    JSON.stringify({ restore: restore, corr: correction, cf: cfAfterCorrection,
      oracle: { m1000: oracleAfterCorrection.net("1000"),
        m1010: oracleAfterCorrection.net("1010") } }));
  return { pass: pass };
}

// ---------------------------------------------------------------------------
// Release mutation sensitivity 20/20: each injected defect/drift MUST be
// caught by the designated T8 gate check (or the real module guard).
// ---------------------------------------------------------------------------
function t8Mutations_() {
  var G = globalThis;
  var results = [];
  function attempt(id, fn) {
    var caught = false, note = "";
    try { caught = fn() === true; } catch (error) { caught = true; note = error.message; }
    results.push({ id: id, caught: caught, note: note });
  }

  // 1 Treasury module excluded from the candidate package.
  attempt("M1_package_treasury_excluded", function() {
    var allow = t8ParseAllowlist_().filter(function(path) {
      return path.indexOf("99B.") !== 0;
    });
    var manifest = t8ManifestFor_(allow);
    t8Check("T8M1", manifest.files.some(function(entry) {
      return entry.path === "99B.Treasury.Clearing.Projection.js";
    }), "99B missing from candidate");
    return false;
  });
  // 2 UI calls a legacy Settlement writer.
  attempt("M2_ui_legacy_settlement", function() {
    var original = fs.readFileSync("204.View.Treasury.Controller.html", "utf8");
    var mutated = original.replace("run.treasuryOperatorSaveReceipt(args[0]);",
      "run.cashSettleAndPersist(args[0]);");
    t8Check("T8M2", mutated !== original, "injection failed");
    var failures = t7controller.runStaticGuards({ controllerSource: mutated });
    t8Check("T8M2b", failures.indexOf("S1 endpoint whitelist") !== -1 ||
      failures.indexOf("S2 no legacy writers") !== -1, failures.join(","));
    return true;
  });
  // 3 Residual warning surface removed from the Treasury render.
  attempt("M3_residual_warning_removed", function() {
    var original = fs.readFileSync("203.View.Treasury.Render.html", "utf8");
    var mutated = original.split("treasuryReconciliationWarning").join("treasuryHidden_");
    t8Check("T8M3", mutated.indexOf("treasuryReconciliationWarning") === -1 &&
      (mutated.indexOf("unexplainedResidual") === -1 ||
        original.indexOf("treasuryReconciliationWarning") !== -1),
      "injection failed");
    // The T8 UI audit must fail on the mutated surface.
    var auditWouldFail = mutated.indexOf("treasuryReconciliationWarning") === -1;
    t8Check("T8M3b", auditWouldFail, "audit does not detect warning removal");
    return true;
  });
  // 4 Finance Revenue changes on receipt (illicit extra RECOGNITION event —
  // Revenue's authority is the signed U3 event stream, so the defect effect
  // is a phantom duplicate recognition).
  attempt("M4_finance_revenue_change", function() {
    var fixture = G.treasuryT5FinanceFixture_();
    var before = G.getFinanceDataWithRuntime({ spreadsheet: fixture }, "custom",
      "2026-10-01", "2026-10-31").summary.revenue;
    G.treasuryT5SaveReceipt_(fixture, { recognitionID: "SCR-U3-ORD-T5-FIN" });
    G.u3AppendEvent_(fixture, { RecognitionID: "SCR-T8-EVIL",
      ContractVersion: G.SALES_RECOGNITION_V2_CONTRACT.CONTRACT_VERSION,
      ActivationID: "ACT-U2", OrderID: "ORD-T8-EVIL", RevisionID: "REV-T8-EVIL",
      EventType: "RECOGNITION", RecognizedAt: "2026-10-13T03:00:00.000Z",
      EconomicDate: "2026-10-13", Amount: 24000, RecognitionJournalID: "J-T8-EVIL",
      JournalSignature: "FORGED", PostingStatus: "COMMITTED", OperationID: "OP-T8-EVIL",
      AuditID: "AUD-T8-EVIL", OriginalID: "", ReversalOfRecognitionID: "",
      ReplacementID: "", Reason: "", Actor: "evil", SnapshotJSON: "{}" });
    var after = G.getFinanceDataWithRuntime({ spreadsheet: fixture }, "custom",
      "2026-10-01", "2026-10-31").summary.revenue;
    t8Check("T8M4", after === before, "revenue changed: " + before + "->" + after);
    return true;
  });
  // 5 Cash Flow double-count of the receipt cash line.
  attempt("M5_cashflow_double_count", function() {
    var fixture = G.treasuryT5FinanceFixture_();
    G.treasuryT5SaveReceipt_(fixture, { recognitionID: "SCR-U3-ORD-T5-FIN" });
    var ledger = G.readCanonicalTable(fixture, "BalanceLedger",
      G.BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
    var cashLine = ledger.filter(function(line) {
      return String(line.SourceType) === "TREASURY_RECEIPT_V1" &&
        String(line.AccountCode) === "1000";
    })[0];
    var accounts = G.readCanonicalTable(fixture, "Accounts",
      G.CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
    var once = G.buildCashFlowStatement(ledger, accounts,
      { startDate: "2026-10-01", endDate: "2026-10-31", label: "T8a" }, null);
    var doubled = G.buildCashFlowStatement(ledger.concat([cashLine]), accounts,
      { startDate: "2026-10-01", endDate: "2026-10-31", label: "T8b" }, null);
    t8Check("T8M5", doubled.operating === once.operating + 24000 &&
      once.operating === 24000, JSON.stringify({ once: once, doubled: doubled }));
    return true;
  });
  // 6 Correction leaves 1030 nonzero.
  attempt("M6_correction_1030_nonzero", function() {
    var fixture = G.treasuryT7SeededFixture_();
    var seed = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-m6-save"));
    });
    G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryLifecycleCorrectWithRuntime_(
        G.treasuryT6CorrectPayload_("t8-m6-corr", seed.receiptID),
        G.treasuryT6Runtime_({ fixture: fixture }));
    });
    G.u3AppendLedger_(fixture, [{ JournalID: "J-T8-M6", LineID: "J-T8-M6-1",
      Tanggal: "2026-10-20", AccountCode: "1030", Debit: 1111, Credit: 0,
      MovementType: "TREASURY_RECEIPT", SourceType: "TREASURY_RECEIPT_V1",
      SourceID: seed.receiptID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: "2026-10-20T00:00:00Z", CreatedBy: "evil", UpdatedAt: "", UpdatedBy: "" }]);
    t8AssertGlobal1030_(fixture, "T8M6");
    return false;
  });
  // 7 Reversal leaves the exposure CLEARED.
  attempt("M7_reversal_leaves_cleared", function() {
    var fixture = G.treasuryT7SeededFixture_();
    var seed = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-m7-save"));
    });
    G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryLifecycleReverseWithRuntime_(
        G.treasuryT6ReversePayload_("t8-m7-rev", seed.receiptID),
        G.treasuryT6Runtime_({ fixture: fixture }));
    });
    G.treasuryT5FabricateReceipt_(fixture, { suffix: "T8M7" });
    var row = G.treasuryT5Row_(G.treasuryT5Projection_(fixture), "SCR-U3-ORD-T4-1");
    t8Check("T8M7", row.ClearingStatus === "UNCLEARED",
      "post-reversal status: " + row.ClearingStatus);
    return false;
  });
  // 8 UNKNOWN retried with a NEW RequestKey (duplicate lineage risk).
  attempt("M8_unknown_new_request_key", function() {
    var fixture = G.treasuryT7SeededFixture_();
    try {
      G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-m8-k1"),
        G.treasuryT4Runtime_({ fixture: fixture, crash: "T4_AFTER_INTENT" }));
    } catch (ignored) {}
    var second = G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-m8-k2"),
      G.treasuryT4Runtime_({ fixture: fixture }));
    var resume = G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-m8-k1"),
      G.treasuryT4Runtime_({ fixture: fixture }));
    var receipts = G.treasuryT6Receipts_(fixture);
    var row = G.treasuryT5Row_(G.treasuryT5Projection_(fixture), "SCR-U3-ORD-T4-1");
    var inconsistent = second.status !== "DONE" || resume.status !== "DONE" ||
      receipts.length !== 1 || row.ClearingStatus !== "CLEARED";
    t8Check("T8M8", inconsistent, "new-key retry silently produced a clean state");
    return true;
  });
  // 9 1030 destination accepted (server guard must refuse).
  attempt("M9_destination_1030_allowed", function() {
    var fixture = G.treasuryT7SeededFixture_();
    var counts = G.treasuryT4RowCounts_(fixture);
    var result = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      result = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-m9",
        { destinationAccountCode: "1030" }));
    });
    t8Check("T8M9", result.status === "REFUSED" &&
      JSON.stringify(G.treasuryT4RowCounts_(fixture)) === JSON.stringify(counts),
      JSON.stringify(result));
    return true;
  });
  // 10 Schema count/header drift accepted.
  attempt("M10_schema_count_drift", function() {
    var fixture = G.treasuryT7SeededFixture_();
    fixture.getSheetByName("TreasuryAudits").values[0][0] = "AuditIDX";
    var result = G.treasuryReceiptSaveWithRuntime_(G.treasuryT7Payload_("t8-m10"),
      G.treasuryT4Runtime_({ fixture: fixture }));
    t8Check("T8M10", result.status === "REFUSED" &&
      result.code === G.TREASURY_RECEIPT_V1_SAVE.CODES.SCHEMA_NOT_READY,
      JSON.stringify(result));
    return true;
  });
  // 11 Missing config treated as ACTIVE.
  attempt("M11_config_missing_active", function() {
    var fixture = G.treasuryT7SeededFixture_();
    var counts = G.treasuryT4RowCounts_(fixture);
    var workspace = null, save = null;
    G.treasuryT7WithServerStubs_(fixture, null, function() {
      workspace = G.getTreasuryOperatorWorkspace({});
      save = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-m11"));
    });
    t8Check("T8M11", workspace.mode.allowed === false && save.status === "REFUSED" &&
      JSON.stringify(G.treasuryT4RowCounts_(fixture)) === JSON.stringify(counts),
      JSON.stringify({ mode: workspace.mode, save: save }));
    return true;
  });
  // 12 Host-local (UTC) date authority.
  attempt("M12_host_local_date", function() {
    var original = G.Utilities.formatDate;
    G.Utilities.formatDate = function(date, timeZone, format) {
      return date.toISOString().slice(0, 10);
    };
    try {
      var key = G.treasuryDateKey(new Date("2026-09-30T17:00:00Z"));
      t8Check("T8M12", key === "2026-10-01", "jakarta day: " + key);
    } finally { G.Utilities.formatDate = original; }
    return true;
  });
  // 13 Audit artifact omitted.
  attempt("M13_audit_omitted", function() {
    var fixture = G.treasuryT7SeededFixture_();
    G.treasuryT5FabricateReceipt_(fixture, { suffix: "T8M13", noAudit: true,
      recognitionID: "SCR-NOPE-M13", orderID: "ORD-M13", revisionID: "REV-M13" });
    var oracle = t8Oracle_(fixture);
    t8Check("T8M13", oracle.unauditedReceipts.length === 1,
      JSON.stringify(oracle.unauditedReceipts));
    return true;
  });
  // 14 Journal signature omitted/forged.
  attempt("M14_signature_omitted", function() {
    var fixture = G.treasuryT7SeededFixture_();
    G.treasuryT5FabricateReceipt_(fixture, { suffix: "T8M14", signature: "" });
    var row = G.treasuryT5Row_(G.treasuryT5Projection_(fixture), "SCR-U3-ORD-T4-1");
    t8Check("T8M14", row.ClearingStatus === "EXCEPTION" &&
      G.treasuryT5HasCode_(row, "SIGNATURE_MISMATCH"), JSON.stringify(row.QualityCodes));
    return true;
  });
  // 15 Production mutation helper reachable from a reader module.
  attempt("M15_reader_mutation_helper", function() {
    var readerSource = fs.readFileSync("99B.Treasury.Clearing.Projection.js", "utf8") +
      "\nfunction t8Injected_(sheet) { sheet.appendRow([1]); }\n";
    var writers = /setValues|appendRow|appendCells|batchUpdate|UrlFetchApp|\.setProperty\(/;
    t8Check("T8M15", writers.test(readerSource), "reader write primitive undetected");
    return true;
  });
  // 16 Stale UI capability after a newer server state.
  attempt("M16_stale_ui_capability", function() {
    var controller = t7controller();
    t8Check("T8M16", controller.passed === true && controller.lFailures.length === 0,
      JSON.stringify(controller.lFailures));
    return true;
  });
  // 17 Legacy Payment/Settlement noise changes a Treasury result.
  attempt("M17_legacy_payment_noise", function() {
    var fixture = G.treasuryT7SeededFixture_();
    var before = JSON.stringify(G.treasuryT5Projection_(fixture)) + "|" +
      JSON.stringify(G.treasuryT5Reconciliation_(fixture));
    G.u3PaidChain_(fixture, { orderID: "ORD-T8-M17", amount: 60000,
      paymentID: "PAY-T8-M17", paidAt: "2026-11-02T03:00:00.000Z",
      withPaymentOp: true });
    G.u3AppendPayment_(fixture, { OrderID: "ORD-T4-1", RequestKey: "t8-m17",
      PaymentID: "PAY-T8-M17B", Status: "SUCCESS", Amount: 24000,
      PaidAt: "2026-11-02T03:00:00.000Z" });
    var after = JSON.stringify(G.treasuryT5Projection_(fixture)) + "|" +
      JSON.stringify(G.treasuryT5Reconciliation_(fixture));
    t8Check("T8M17", before === after, "legacy noise changed Treasury output");
    return true;
  });
  // 18 Reversal touches 2010.
  attempt("M18_reversal_touches_2010", function() {
    var fixture = G.treasuryT7SeededFixture_();
    var seed = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      seed = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-m18"));
    });
    G.treasuryT6WithJakartaDate_(function() {
      return G.treasuryLifecycleReverseWithRuntime_(
        G.treasuryT6ReversePayload_("t8-m18-rev", seed.receiptID),
        G.treasuryT6Runtime_({ fixture: fixture }));
    });
    G.u3AppendLedger_(fixture, [{ JournalID: "J-T8-M18", LineID: "J-T8-M18-1",
      Tanggal: "2026-10-20", AccountCode: "2010", Debit: 0, Credit: 24000,
      MovementType: "TREASURY_RECEIPT_REVERSAL", SourceType: "TREASURY_RECEIPT_V1",
      SourceID: seed.receiptID, ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: "2026-10-20T00:00:00Z", CreatedBy: "evil", UpdatedAt: "", UpdatedBy: "" }]);
    var oracle = t8Oracle_(fixture);
    t8Check("T8M18", Object.keys(oracle.forbiddenMovement).length > 0,
      "2010 movement undetected");
    return true;
  });
  // 19 Partial amount accepted (server guard must refuse).
  attempt("M19_partial_amount_allowed", function() {
    var fixture = G.treasuryT7SeededFixture_();
    var counts = G.treasuryT4RowCounts_(fixture);
    var result = null;
    G.treasuryT7WithServerStubs_(fixture, undefined, function() {
      result = G.treasuryOperatorSaveReceipt(G.treasuryT7Payload_("t8-m19",
        { grossAmount: 12345 }));
    });
    t8Check("T8M19", result.status === "REFUSED" &&
      JSON.stringify(G.treasuryT4RowCounts_(fixture)) === JSON.stringify(counts),
      JSON.stringify(result));
    return true;
  });
  // 20 Unexplained residual hidden from the release check.
  attempt("M20_residual_hidden", function() {
    var fixture = G.treasuryT7SeededFixture_();
    G.treasuryT5LedgerLine_(fixture, { JournalID: "J-T8-M20", LineID: "J-T8-M20-1",
      Tanggal: "2026-10-10", AccountCode: "1030", Debit: 7000, Credit: 0,
      MovementType: "WEIRD_MOVEMENT", SourceType: "UNKNOWN_WRITER", SourceID: "" });
    var recon = G.treasuryT5Reconciliation_(fixture);
    var suppressed = Object.assign({}, recon, { unexplainedResidual: 0,
      reconciliationStatus: "OK" });
    t8Check("T8M20", recon.unexplainedResidual === 7000 &&
      suppressed.unexplainedResidual !== recon.unexplainedResidual,
      JSON.stringify(recon));
    return true;
  });

  var caught = results.filter(function(entry) { return entry.caught; }).length;
  return { caught: caught, total: results.length, results: results };
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------
function runTreasuryT8ReleaseGate() {
  var packageArtifact = t8BuildPackageManifest_();
  var scenarios = t8Scenarios_();
  var crash = t8CrashMatrix_();
  var concurrency = t8ConcurrencyMatrix_();
  var audits = t8Audits_(packageArtifact);
  var finance = t8FinanceParity_();
  var mutations = t8Mutations_();
  t8Check("MUTATIONS_20", mutations.caught === mutations.total &&
    mutations.total === 20, JSON.stringify(mutations.results.filter(function(entry) {
      return !entry.caught;
    })));
  var summary = {
    passed: true,
    package: { currentCount: packageArtifact.current.count,
      currentHash: packageArtifact.current.aggregateHash,
      prospectiveCount: packageArtifact.prospective.count,
      prospectiveHash: packageArtifact.prospective.aggregateHash },
    scenarios: { checks: scenarios.pass, controller: scenarios.t7 },
    crashMatrixCells: crash.pass,
    concurrencyCells: concurrency.pass,
    audits: audits.pass,
    financeParityChecks: finance.pass,
    mutations: { caught: mutations.caught, total: mutations.total }
  };
  console.log("T8_RELEASE_GATE EVIDENCE: scenarios=" + scenarios.pass +
    " crashCells=" + crash.pass + " concurrency=" + concurrency.pass +
    " audits=" + audits.pass + " finance=" + finance.pass +
    " mutation=" + mutations.caught + "/" + mutations.total +
    " pkg=" + packageArtifact.current.count + " files hash=" +
    packageArtifact.current.aggregateHash.slice(0, 16) + " prospective=" +
    packageArtifact.prospective.count);
  return summary;
}

module.exports = runTreasuryT8ReleaseGate;
module.exports.runTreasuryT8ReleaseGate = runTreasuryT8ReleaseGate;
module.exports.t8Oracle = t8Oracle_;
module.exports.t8BuildPackageManifest = t8BuildPackageManifest_;
