// T11.4 U2 — Expense durable single-commit core (SINGLE_COMMIT_TRANSACTION_V1
// gated). Focused local suites over the injected dispatcher runtime: gate
// routing + inert legacy parity, the 1040 preflight matrix, one-plan/one-batch
// composition (tabops + Dr expense/Cr1040 + Logs), durability (replay /
// conflict / UNKNOWN pre + post batch / artifact loss / tamper), and isolation
// audits (Treasury, payment fields, historical rows, correction lineage).
// Fixtures only — no production access, no clasp, no config writes, no
// PropertiesService mutation, no network transport.

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
function t11u2ConfigRaw_(mode) {
  return JSON.stringify({ mode: mode === undefined ? "ACTIVE" : mode, configVersion: 1 });
}

function t11u2Account1040_(overrides) {
  return Object.assign({ AccountCode: "1040", AccountName: "Operational Funds",
    AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating",
    IsActive: true, CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" }, overrides || {});
}

function t11u2Sheet_(headers) {
  var rows = [headers.slice()];
  function grid(r, c, h, w) {
    var out = [];
    for (var i = 0; i < h; i++) {
      var source = rows[r - 1 + i] || [];
      var line = [];
      for (var j = 0; j < w; j++) line.push(source[c - 1 + j] === undefined ? "" : source[c - 1 + j]);
      out.push(line);
    }
    return out;
  }
  function expand(r, h) {
    while (rows.length < r + h - 1) rows.push(new Array(headers.length).fill(""));
  }
  return {
    rows: rows,
    getLastRow: function() { return rows.length; },
    getLastColumn: function() { return rows[0].length; },
    getDataRange: function() {
      var self = this;
      return { getValues: function() { return grid(1, 1, rows.length, self.getLastColumn()); } };
    },
    getRange: function(r, c, h, w) {
      h = h || 1; w = w || 1;
      return {
        getValues: function() { return grid(r, c, h, w); },
        getValue: function() { return grid(r, c, 1, 1)[0][0]; },
        setValues: function(values) {
          expand(r, values.length);
          values.forEach(function(row, i) {
            var target = rows[r - 1 + i];
            if (!target) { rows[r - 1 + i] = row.slice(); return; }
            while (target.length < c - 1 + row.length) target.push("");
            row.forEach(function(value, j) { target[c - 1 + j] = value; });
          });
        },
        createTextFinder: function(value) {
          var wanted = String(value);
          return {
            matchEntireCell: function() { return this; },
            findNext: function() {
              for (var i = r - 1; i < Math.min(rows.length, r - 1 + h); i++) {
                if (String(rows[i] && rows[i][c - 1]) === wanted) return {};
              }
              return null;
            }
          };
        }
      };
    }
  };
}

// The transport mirror: the real batchUpdate writes RAW CellData, so a Date
// lands as an ISO string. The fixture batch reproduces that so readback
// comparisons are exercised exactly as production performs them.
function t11u2TransportValue_(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function t11u2Snapshot_(f) {
  var out = {};
  Object.keys(f.sheets).forEach(function(name) {
    out[name] = JSON.stringify(f.sheets[name].rows);
  });
  out.settlementAttempts = String(f.settlementAttempts);
  return JSON.stringify(out);
}

function t11u2Ledger_(f) {
  return readCanonicalTable({ getSheetByName: function(name) { return f.sheets[name] || null; } },
    "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
}

function t11u2Ops_(f) {
  return readCanonicalTable({ getSheetByName: function(name) { return f.sheets[name] || null; } },
    "TransactionOperations", TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
}

function t11u2Tabops_(f) {
  return readCanonicalTable({ getSheetByName: function(name) { return f.sheets[name] || null; } },
    "tabops", CANONICAL_ENTRY.EXPENSE_HEADERS);
}

function t11u2Logs_(f) {
  return readCanonicalTable({ getSheetByName: function(name) { return f.sheets[name] || null; } },
    "Logs", CANONICAL_ENTRY.LOG_HEADERS);
}

function t11u2Fixture_(options) {
  options = options || {};
  var accountsHeaders = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  var itemHeaders = EXPENSE_SINGLE_COMMIT_V1.ITEM_HEADERS;
  var sheets = {
    tabops: t11u2Sheet_(CANONICAL_ENTRY.EXPENSE_HEADERS),
    Logs: t11u2Sheet_(CANONICAL_ENTRY.LOG_HEADERS),
    BalanceLedger: t11u2Sheet_(BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS),
    TransactionOperations: t11u2Sheet_(TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS),
    Accounts: t11u2Sheet_(accountsHeaders),
    ExpenseItems: t11u2Sheet_(itemHeaders)
  };
  function push(name, headerValues) {
    sheets[name].rows.push(sheets[name].rows[0].map(function(header) {
      return headerValues[header] === undefined ? "" : headerValues[header];
    }));
  }
  // Historical monetary channels (never a live target of this operation).
  ["1000", "1010", "1020"].forEach(function(code) {
    push("Accounts", { AccountCode: code, AccountName: "Legacy " + code,
      AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating",
      IsActive: true, NormalBalance: "DEBIT" });
  });
  push("Accounts", { AccountCode: "6100", AccountName: "Utilities Expense",
    AccountType: "Expense", StatementGroup: "Utilities Expense", CashFlowGroup: "Operating",
    IsActive: true, NormalBalance: "DEBIT" });
  (options.accounts || [t11u2Account1040_()]).forEach(function(row) { push("Accounts", row); });
  // OSS01 is FIXED_COST/NONE -> an ORDINARY (non-Purchase) expense route.
  push("ExpenseItems", { ID_Ops: options.expenseItemId || "OSS01", Item: "Utilities",
    Kategori: "Utility", Kind: "Operating", Group: "Overhead", AccountCode: "6100",
    IsActive: true });
  (options.expenseItems || []).forEach(function(row) { push("ExpenseItems", row); });
  // Pre-existing historical evidence that must never be rewritten.
  sheets.tabops.rows.push(["OPS-APP-20260101-HISTORICAL01",
    new Date("2026-01-01T00:00:00Z"), "OSS01", 7000, "APP_ENTRY", true,
    new Date("2026-01-01T00:00:00Z"), "SYSTEM_APP_ENTRY", "", ""]);
  sheets.BalanceLedger.rows.push(["HISTJ-1", "HISTJ-1-1", "2026-01-01", "6100",
    7000, 0, "HISTORICAL", "HISTORICAL", "HIST-1", "", "", true, "", "", "", ""]);
  sheets.Logs.rows.push(["LOG-ENTRY-HISTORICAL01", new Date("2026-01-01T00:00:00Z"),
    "INFO", "TransactionEntry", "CREATE_EXPENSE", "OPS-APP-20260101-HISTORICAL01",
    "SYSTEM_APP_ENTRY", "Canonical transaction created.",
    JSON.stringify({ source: "APP_ENTRY", ledger: "tabops" })]);

  var f = {
    sheets: sheets,
    batches: [],
    settlementAttempts: 0,
    invalidations: 0,
    crashAt: null,
    batchFailure: null,
    sequence: 0
  };
  function ss() {
    return { getSheetByName: function(name) { return sheets[name] || null; } };
  }
  f.spreadsheet = ss;
  var seam = {
    batch: function(ranges) {
      if (f.batchFailure) throw new Error(f.batchFailure);
      f.batches.push(ranges.map(function(range) {
        return { range: range.range, rows: range.values.length };
      }));
      ranges.forEach(function(range) {
        var sheet = sheets[range.range];
        if (!sheet) throw new Error("SHEET_MISSING:" + range.range);
        range.values.forEach(function(row) {
          sheet.rows.push(row.map(t11u2TransportValue_));
        });
      });
    },
    crash: function(label) {
      if (f.crashAt === label) throw new Error("CRASH_" + label);
    }
  };
  f.runtime = {
    environment: "LOCAL_FIXTURE",
    lock: { waitLock: function() {}, releaseLock: function() {}, hasLock: function() { return true; } },
    spreadsheet: ss,
    now: function() { return new Date("2026-10-05T01:00:00Z"); },
    uuid: function() { return ("000000000000" + (++f.sequence)).slice(-12); },
    flush: function() {},
    invalidate: function() { f.invalidations++; },
    // Mirrors the production disposition: CASH_PRODUCTION_POLICY.ENABLED is
    // false, so the legacy path reports accountingPending. The single-commit
    // path must never reach this writer at all.
    settle: function() { f.settlementAttempts++; return { status: "DISABLED" }; },
    singleCommitConfig: options.singleCommitConfig === undefined ?
      t11u2ConfigRaw_("ACTIVE") : options.singleCommitConfig,
    expenseSingleCommit: seam
  };
  f.run = function(payload) {
    return submitCanonicalTransactionWithRuntime_(payload, f.runtime);
  };
  f.payload = options.payload || { transactionType: "EXPENSE", expenseItemId: "OSS01",
    amount: 25000, expenseDate: "2026-10-05" };
  return f;
}

function t11u2Save_(options) {
  var f = t11u2Fixture_(options);
  var result = f.run(Object.assign({ requestKey: (options && options.requestKey) ||
    "expense-u2-0001" }, f.payload));
  return { f: f, result: result };
}

function t11u2Check_(counter, id, value, detail) {
  counter.pass++;
  if (!value) {
    throw new Error("T11_4_U2:" + id + (detail === undefined ? "" : "|" + detail));
  }
}

// ---------------------------------------------------------------------------
// A. Config gate + inert legacy parity (routing precedence)
// ---------------------------------------------------------------------------
function testExpenseSingleCommitGateRouting() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u2Check_(counter, id, value, detail); }
  var sc = SINGLE_COMMIT_TRANSACTION_V1, save = EXPENSE_SINGLE_COMMIT_V1;

  // A1: config ABSENT -> the current non-T11 Expense path is unchanged:
  // tabops + Logs written, NO operation row, NO ledger rows, legacy
  // accountingPending still produced by the disabled settlement writer, and
  // no single-commit envelope.
  var absent = t11u2Fixture_({ singleCommitConfig: null });
  var absentResult = absent.run(Object.assign({ requestKey: "expense-legacy-1",
    cashAccountCode: "1000" }, absent.payload));
  check("A1a", absentResult.success === true && absentResult.data.id.indexOf("OPS-APP-") === 0,
    JSON.stringify(absentResult));
  check("A1b", t11u2Tabops_(absent).length === 2 && t11u2Logs_(absent).length === 3 &&
    t11u2Ledger_(absent).length === 1 && t11u2Ops_(absent).length === 0,
    "legacy path writes business+audit+settlement-pending only");
  check("A1c", absentResult.singleCommit === undefined &&
    absentResult.accountingPending === true && absent.batches.length === 0,
    JSON.stringify(absentResult));
  check("A1d", absentResult.error === undefined && absent.settlementAttempts === 1 &&
    t11u2Logs_(absent).filter(function(row) {
      return row.Action === "SETTLEMENT_PENDING";
    }).length === 1, "legacy multistep hazard still present when the gate is inert");

  // A2: explicit PREPARED behaves exactly like ABSENT (zero behavior change).
  var prepared = t11u2Fixture_({ singleCommitConfig: t11u2ConfigRaw_("PREPARED") });
  var preparedResult = prepared.run(Object.assign({ requestKey: "expense-legacy-2",
    cashAccountCode: "1010" }, prepared.payload));
  check("A2a", preparedResult.success === true && t11u2Ops_(prepared).length === 0 &&
    prepared.batches.length === 0 && preparedResult.accountingPending === true,
    JSON.stringify(preparedResult));
  check("A2b", JSON.stringify(t11u2Tabops_(prepared).map(function(r) { return r.Nilai; })) ===
    JSON.stringify(t11u2Tabops_(absent).map(function(r) { return r.Nilai; })),
    "PREPARED outcome identical to ABSENT");

  // A3: PAUSED / invalid JSON / REJECT / bad version / unknown mode all fail
  // closed with ZERO writes of any kind (never a legacy fallback).
  [{ raw: t11u2ConfigRaw_("PAUSED"), code: sc.CODES.SINGLE_COMMIT_MODE_PAUSED, id: "A3a" },
   { raw: "{not-json", code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "A3b" },
   { raw: t11u2ConfigRaw_("REJECT"), code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "A3c" },
   { raw: JSON.stringify({ mode: "ACTIVE", configVersion: 0 }),
     code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "A3d" },
   { raw: JSON.stringify({ mode: "READY", configVersion: 1 }),
     code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "A3e" },
   { raw: JSON.stringify({ mode: "PAUSED" }), code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID,
     id: "A3f" }
  ].forEach(function(scenario) {
    var f = t11u2Fixture_({ singleCommitConfig: scenario.raw });
    var before = t11u2Snapshot_(f);
    var result = f.run(Object.assign({ requestKey: "expense-refused-" + scenario.id }, f.payload));
    check(scenario.id, result.success === false && result.error.code === scenario.code &&
      result.writeCount === 0 && f.batches.length === 0 &&
      t11u2Ops_(f).length === 0 && t11u2Snapshot_(f) === before,
      JSON.stringify(result));
  });

  // A4: ACTIVE routes the ordinary Expense exclusively to the new core (no
  // cash account required, one operation row, one atomic batch).
  var active = t11u2Fixture_();
  var activeResult = active.run(Object.assign({ requestKey: "expense-active-1" }, active.payload));
  check("A4a", activeResult.success === true && activeResult.singleCommit.status === "DONE" &&
    activeResult.accountingPending === undefined, JSON.stringify(activeResult));
  check("A4b", t11u2Ops_(active).length === 1 && active.batches.length === 1,
    "one operation row, one batch");
  check("A4c", active.settlementAttempts === 0 && active.invalidations === 1,
    "no settlement attempt, cache invalidated once");

  // A5: ACTIVE routes the Purchase route to the T11.5 U3
  // PURCHASE_SINGLE_COMMIT_SAVE core (U3 owns Purchase; the U2-era "Purchase
  // stays legacy" behavior is superseded by the frozen T11.2 §5 convergence).
  // This payload carries legacy Expense fields (amount/expenseDate) and no
  // requestKey/input, so the purchase core's strict field allowlist refuses it
  // zero-write BEFORE the legacy cash gate could ever run: no
  // INVALID_CASH_ACCOUNT, no operation row, no batch, no mutation.
  var purchaseItem = EXPENSE_PURCHASE_POLICY.rows.filter(function(row) {
    return row.CostType === "VARIABLE_COST" && row.PurchaseRelationship === "DIRECT_HPP_COMPONENT";
  })[0];
  var purchase = t11u2Fixture_({ expenseItemId: purchaseItem.expenseItemId });
  var purchaseBefore = t11u2Snapshot_(purchase);
  var purchaseResult = purchase.run({ transactionType: "EXPENSE",
    expenseItemId: purchaseItem.expenseItemId, amount: 9000, expenseDate: "2026-10-05" });
  check("A5a", purchaseResult.success === false &&
    purchaseResult.error.code === "PURCHASE_SINGLE_COMMIT_FIELD_REFUSED",
    JSON.stringify(purchaseResult));
  check("A5b", t11u2Ops_(purchase).length === 0 && purchase.batches.length === 0 &&
    t11u2Snapshot_(purchase) === purchaseBefore,
    "Purchase route never enters EXPENSE_SINGLE_COMMIT_SAVE or the legacy cash gate");

  // A6: resolved mode helper (server authority bootstrap) — ABSENT/PREPARED
  // travel as PREPARED, never ACTIVE.
  var originalProperties = typeof PropertiesService === "undefined" ? undefined : PropertiesService;
  try {
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return null; } };
    } };
    check("A6a", expenseSingleCommitResolvedMode_() === "PREPARED");
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return t11u2ConfigRaw_("ACTIVE"); } };
    } };
    check("A6b", expenseSingleCommitResolvedMode_() === "ACTIVE");
    PropertiesService = { getScriptProperties: function() {
      return { getProperty: function() { return "{broken"; } };
    } };
    check("A6c", expenseSingleCommitResolvedMode_() === "REJECT");
  } finally {
    if (originalProperties === undefined) delete globalThis.PropertiesService;
    else PropertiesService = originalProperties;
  }

  // A7: PAUSED on a NEW intent refuses even before the legacy cash validation
  // would have produced INVALID_CASH_ACCOUNT — no silent legacy fallback.
  var paused = t11u2Fixture_({ singleCommitConfig: t11u2ConfigRaw_("PAUSED") });
  var pausedResult = paused.run({ transactionType: "EXPENSE", expenseItemId: "OSS01",
    amount: 1000 });
  check("A7a", pausedResult.success === false &&
    pausedResult.error.code === sc.CODES.SINGLE_COMMIT_MODE_PAUSED,
    JSON.stringify(pausedResult));
  check("A7b", t11u2Snapshot_(paused) === t11u2Snapshot_(t11u2Fixture_({
    singleCommitConfig: t11u2ConfigRaw_("PAUSED") })), "PAUSED writes nothing");

  console.log("T11_4_U2_GATE checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// B. Account 1040 preflight matrix (T11.2 §11)
// ---------------------------------------------------------------------------
function testExpenseSingleCommitPreflight1040() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u2Check_(counter, id, value, detail); }
  var save = EXPENSE_SINGLE_COMMIT_V1;

  function scenario(id, accounts, expectedCode) {
    var f = t11u2Fixture_({ accounts: accounts });
    var before = t11u2Snapshot_(f);
    var result = f.run(Object.assign({ requestKey: "expense-1040-" + id }, f.payload));
    check(id, result.success === false && result.error.code === expectedCode &&
      result.writeCount === 0 && f.batches.length === 0 && t11u2Ops_(f).length === 0 &&
      t11u2Tabops_(f).length === 1 && t11u2Ledger_(f).length === 1 &&
      t11u2Snapshot_(f) === before, JSON.stringify(result));
  }
  var codes = save.CODES.ACCOUNT_PREFLIGHT_FAILED;

  scenario("B1_missing", [], codes);
  scenario("B2_duplicate", [t11u2Account1040_(), t11u2Account1040_()], codes);
  scenario("B3_inactive", [t11u2Account1040_({ IsActive: false })], codes);
  scenario("B4_wrongType", [t11u2Account1040_({ AccountType: "Liability" })], codes);
  scenario("B5_wrongBalance", [t11u2Account1040_({ NormalBalance: "CREDIT" })], codes);
  scenario("B6_wrongName", [t11u2Account1040_({ AccountName: "Cash" })], codes);
  scenario("B7_wrongGroup", [t11u2Account1040_({ StatementGroup: "Fixed Assets" })], codes);
  scenario("B8_wrongCashFlow", [t11u2Account1040_({ CashFlowGroup: "Investing" })], codes);
  scenario("B9_codeReuse", [t11u2Account1040_({ AccountName: "Petty Cash",
    AccountType: "Asset", NormalBalance: "DEBIT" })], codes);

  // B10: a failed preflight never falls back to a legacy channel account.
  var fallback = t11u2Fixture_({ accounts: [] });
  var fallbackResult = fallback.run(Object.assign({ requestKey: "expense-1040-B10" },
    fallback.payload));
  var ledger = t11u2Ledger_(fallback);
  check("B10a", fallbackResult.success === false && ledger.length === 1 &&
    ledger[0].AccountCode === "6100" && ledger[0].SourceType === "HISTORICAL",
    JSON.stringify({ result: fallbackResult, ledger: ledger }));
  check("B10b", ledger.filter(function(row) {
    return ["1000", "1010", "1020", "1040"].indexOf(String(row.AccountCode)) !== -1;
  }).length === 0, "no fallback money account written");

  // B11: exact §11 metadata accepted -> the save proceeds to DONE.
  var ok = t11u2Fixture_();
  var okResult = ok.run(Object.assign({ requestKey: "expense-1040-B11" }, ok.payload));
  check("B11a", okResult.success === true && okResult.singleCommit.status === "DONE",
    JSON.stringify(okResult));
  var money = t11u2Ledger_(ok).filter(function(row) { return row.AccountCode === "1040"; });
  check("B11b", money.length === 1 && money[0].Debit === 0 && money[0].Credit === 25000,
    JSON.stringify(money));

  // B12: the preflight is pure — it never writes the Accounts sheet.
  check("B12", ok.sheets.Accounts.rows.length === 6 &&
    ok.sheets.Accounts.rows[0].length === CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.length,
    "Accounts sheet untouched (header + 3 legacy + 6100 + 1040)");

  console.log("T11_4_U2_1040 checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// C. One plan / one atomic batch / minimum input
// ---------------------------------------------------------------------------
function testExpenseSingleCommitPlanBatch() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u2Check_(counter, id, value, detail); }
  var save = EXPENSE_SINGLE_COMMIT_V1;
  var ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;

  var f = t11u2Fixture_();
  var result = f.run(Object.assign({ requestKey: "expense-plan-0001" }, f.payload));
  check("C1a", result.success === true && result.writeCount === 4,
    JSON.stringify(result));
  check("C1b", f.batches.length === 1 &&
    JSON.stringify(f.batches[0]) ===
      JSON.stringify([{ range: "tabops", rows: 1 }, { range: "BalanceLedger", rows: 2 },
        { range: "Logs", rows: 1 }]),
    JSON.stringify(f.batches));
  check("C1c", JSON.stringify(save.WRITE_SURFACES) ===
    JSON.stringify(["tabops", "BalanceLedger", "Logs"]), "exact frozen surfaces");

  var tabops = t11u2Tabops_(f);
  check("C2a", tabops.length === 2 && tabops[1].ID_Ops === "OSS01" &&
    tabops[1].Nilai === 25000 && tabops[1].Source === "APP_ENTRY" &&
    tabops[1].IsActive === true, JSON.stringify(tabops[1]));
  var ledger = t11u2Ledger_(f);
  var own = ledger.filter(function(row) { return row.SourceType === save.SOURCE_TYPE; });
  check("C3a", own.length === 2, JSON.stringify(own));
  check("C3b", own[0].AccountCode === "6100" && own[0].Debit === 25000 &&
    own[0].Credit === 0, JSON.stringify(own[0]));
  check("C3c", own[1].AccountCode === "1040" && own[1].Debit === 0 &&
    own[1].Credit === 25000, JSON.stringify(own[1]));
  check("C3d", own[0].JournalID === own[1].JournalID &&
    own[0].JournalID === "EXPJ-" + tabops[1].ID_Trx &&
    own[0].LineID === own[0].JournalID + "-1" &&
    own[1].LineID === own[1].JournalID + "-2", JSON.stringify(own));
  check("C3e", own[0].MovementType === save.MOVEMENT_TYPE &&
    own[1].MovementType === save.MOVEMENT_TYPE &&
    own[0].SourceID === tabops[1].ID_Trx && own[1].SourceID === tabops[1].ID_Trx,
    "writer identity");
  check("C3f", own[0].Tanggal === "2026-10-05" && own[1].Tanggal === "2026-10-05",
    JSON.stringify(own[0].Tanggal));
  check("C3g", own[0].Debit === own[1].Credit && own[1].Debit === 0 && own[0].Credit === 0 &&
    own[0].Debit + own[1].Debit === own[0].Credit + own[1].Credit, "balanced pair");

  var logs = t11u2Logs_(f);
  check("C4a", logs.length === 2 && logs[1].Action === "CREATE_EXPENSE" &&
    logs[1].Module === "TransactionEntry" && logs[1].RecordID === tabops[1].ID_Trx,
    JSON.stringify(logs[1]));

  var ops = t11u2Ops_(f);
  check("C5a", ops.length === 1 && ops[0].OperationType === save.OPERATION_TYPE &&
    ops[0].RequestKey === "expense-plan-0001" && ops[0].State === "COMMITTED" &&
    ops[0].BusinessID === tabops[1].ID_Trx, JSON.stringify(ops[0]));
  var plan = JSON.parse(ops[0].OperationPlan);
  check("C5b", plan.entryID === tabops[1].ID_Trx &&
    plan.journalID === own[0].JournalID && plan.auditID === logs[1].ID_Log,
    "one plan owns every identity");
  check("C5c", plan.payloadHash === transactionPayloadHash_(plan.normalizedPayload) &&
    plan.planDigest === transactionPayloadHash_(Object.assign({}, plan, { planDigest: undefined })),
    "payload hash + plan digest");
  check("C5d", plan.journalSignature === policyCJournalSignature_(own) &&
    plan.amount === 25000 && plan.accounts.money === "1040" &&
    plan.accounts.expense === "6100", JSON.stringify({
      signature: plan.journalSignature, accounts: plan.accounts }));

  // C6: one business projection identity across every surface.
  var identities = [result.data.id, tabops[1].ID_Trx, ops[0].BusinessID, own[0].SourceID,
    own[1].SourceID, logs[1].RecordID, plan.entryID];
  check("C6", identities.every(function(id) { return id === identities[0]; }),
    JSON.stringify(identities));

  // C7: minimum input — no cash account, no payment method, no Treasury input.
  var noCash = t11u2Fixture_();
  var noCashResult = noCash.run({ transactionType: "EXPENSE", expenseItemId: "OSS01",
    amount: 1000, expenseDate: "2026-10-05", requestKey: "expense-nocash-1" });
  check("C7a", noCashResult.success === true && noCashResult.singleCommit.status === "DONE",
    JSON.stringify(noCashResult));

  // C8: payment / channel / Treasury fields are refused on the normalizer.
  [{ field: "cashAccountCode", value: "1000" },
   { field: "paidVia", value: "DANA" },
   { field: "paymentStatus", value: "PAID" },
   { field: "PaymentMethod", value: "CASH" },
   { field: "ReceiveVia", value: "1000" },
   { field: "destination", value: "1040" },
   { field: "destinationAccountCode", value: "1040" },
   { field: "evidenceRef", value: "GDRIVE:X" },
   { field: "EvidenceRef", value: "GDRIVE:X" },
   { field: "settlementId", value: "CSH-EXP-1" }
  ].forEach(function(scenario, index) {
    var payload = Object.assign({ transactionType: "EXPENSE", expenseItemId: "OSS01",
      amount: 5000, expenseDate: "2026-10-05", requestKey: "expense-refuse-" + index });
    payload[scenario.field] = scenario.value;
    try {
      expenseSingleCommitNormalize_(payload);
      check("C8_" + scenario.field, false, "normalizer accepted a payment field");
    } catch (error) {
      check("C8_" + scenario.field,
        error.expenseSingleCommitCode === save.CODES.PAYMENT_FIELD_REFUSED,
        error.message);
    }
  });

  // C9: unknown / missing inputs refused with zero writes.
  var refused = [
    { payload: { transactionType: "EXPENSE", expenseItemId: "OSS01", amount: 1,
      requestKey: "expense-key-1", costType: "FIXED_COST" },
      code: save.CODES.FIELD_REFUSED, id: "C9a" },
    { payload: { transactionType: "EXPENSE", expenseItemId: "OSS01", amount: 1 },
      code: save.CODES.PAYLOAD_INVALID, id: "C9b" },
    { payload: { transactionType: "EXPENSE", amount: 1, requestKey: "expense-key-1" },
      code: "EXPENSE_ID_MALFORMED", id: "C9c" },
    { payload: { transactionType: "EXPENSE", expenseItemId: "OSS01", amount: 0,
      requestKey: "expense-key-1" }, code: save.CODES.PAYLOAD_INVALID, id: "C9d" },
    { payload: { transactionType: "EXPENSE", expenseItemId: "OSS01", amount: "5000",
      requestKey: "expense-key-1" }, code: save.CODES.PAYLOAD_INVALID, id: "C9e" },
    { payload: { transactionType: "EXPENSE", expenseItemId: "OSS01", amount: 1,
      expenseDate: "2026-13-45", requestKey: "expense-key-1" },
      code: save.CODES.PAYLOAD_INVALID, id: "C9f" },
    { payload: { transactionType: "EXPENSE", expenseItemId: "OSS01", amount: 1,
      requestKey: "k" }, code: save.CODES.PAYLOAD_INVALID, id: "C9g" }
  ];
  refused.forEach(function(scenario) {
    var f2 = t11u2Fixture_();
    var before = t11u2Snapshot_(f2);
    var result2 = f2.run(scenario.payload);
    check(scenario.id, result2.success === false && result2.error.code === scenario.code &&
      result2.writeCount === 0 && f2.batches.length === 0 && t11u2Ops_(f2).length === 0 &&
      t11u2Snapshot_(f2) === before, JSON.stringify(result2));
  });

  // C9g: the core refuses any non-EXPENSE transaction type outright.
  try {
    expenseSingleCommitNormalize_({ transactionType: "SALES", expenseItemId: "OSS01",
      amount: 1, requestKey: "k" });
    check("C9g", false, "normalizer accepted a non-EXPENSE type");
  } catch (error) {
    check("C9g", error.expenseSingleCommitCode === save.CODES.PAYLOAD_INVALID, error.message);
  }

  // C10: no accountingPending / SETTLEMENT_PENDING / Settlements on success.
  check("C10a", !Object.prototype.hasOwnProperty.call(result, "accountingPending"),
    JSON.stringify(Object.keys(result)));
  check("C10b", t11u2Logs_(f).filter(function(row) {
    return row.Action === "SETTLEMENT_PENDING";
  }).length === 0, "no SETTLEMENT_PENDING audit row");
  check("C10c", f.settlementAttempts === 0 && !f.sheets.Settlements,
    "no Settlements surface ever touched");

  // C11: Cash Flow source semantics are available for the U4 reader — the
  // money line touches 1040 exactly once, 1040 is Operating/DEBIT/Asset, and
  // the debit counterpart carries its own CashFlowGroup.
  var accounts = readCanonicalTable(f.spreadsheet(), "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  var money1040 = accounts.filter(function(row) { return row.AccountCode === "1040"; })[0];
  var debitAccount = accounts.filter(function(row) { return row.AccountCode === "6100"; })[0];
  check("C11a", own.filter(function(row) { return row.AccountCode === "1040"; }).length === 1 &&
    money1040.CashFlowGroup === "Operating" && money1040.NormalBalance === "DEBIT" &&
    money1040.AccountType === "Asset", JSON.stringify(money1040));
  check("C11b", debitAccount.CashFlowGroup === "Operating" &&
    debitAccount.AccountType === "Expense", JSON.stringify(debitAccount));
  check("C11c", SINGLE_COMMIT_MONEY_POLICY.ACCOUNT_EXPECTATION.CashFlowGroup === "Operating",
    "frozen 1040 expectation is Operating");

  // C12: every ledger row of this journal is Operating by substance (Expense
  // outflow) and carries the deterministic source identity U4 needs.
  check("C12", own.every(function(row) {
    return row.SourceType === save.SOURCE_TYPE && row.SourceID === tabops[1].ID_Trx &&
      row.MovementType === save.MOVEMENT_TYPE;
  }), JSON.stringify(own));

  console.log("T11_4_U2_PLAN checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// D. Durability: replay / conflict / UNKNOWN / artifact loss / tamper
// ---------------------------------------------------------------------------
function testExpenseSingleCommitDurability() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u2Check_(counter, id, value, detail); }
  var save = EXPENSE_SINGLE_COMMIT_V1;
  var opsHeader = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS;

  // D1: replay of a COMMITTED intent is zero-write DONE.
  var replay = t11u2Fixture_();
  var first = replay.run(Object.assign({ requestKey: "expense-replay-1" }, replay.payload));
  var afterFirst = t11u2Snapshot_(replay);
  var second = replay.run(Object.assign({ requestKey: "expense-replay-1" }, replay.payload));
  check("D1a", first.success === true && second.success === true &&
    second.singleCommit.replay === true && second.writeCount === 0,
    JSON.stringify(second));
  check("D1b", t11u2Snapshot_(replay) === afterFirst && replay.batches.length === 1 &&
    t11u2Ops_(replay).length === 1 && t11u2Tabops_(replay).length === 2,
    "replay writes nothing");

  // D2: same key + different payload -> CONFLICT, zero additional writes.
  var conflict = t11u2Fixture_();
  conflict.run(Object.assign({ requestKey: "expense-conflict-1" }, conflict.payload));
  var conflictBefore = t11u2Snapshot_(conflict);
  var conflictResult = conflict.run(Object.assign({ requestKey: "expense-conflict-1" },
    conflict.payload, { amount: 99999 }));
  check("D2a", conflictResult.success === false && conflictResult.status === "CONFLICT" &&
    conflictResult.error.code === save.CODES.OPERATION_PAYLOAD_CONFLICT,
    JSON.stringify(conflictResult));
  check("D2b", t11u2Snapshot_(conflict) === conflictBefore && conflict.batches.length === 1,
    "conflict never appends");

  // D3: UNKNOWN before the batch (crash before intent/batch) keeps identity
  // and resumes from the stored plan with no duplicate business row.
  var preBatch = t11u2Fixture_();
  preBatch.crashAt = "EXPENSE_BEFORE_BATCH";
  var preBatchResult = preBatch.run(Object.assign({ requestKey: "expense-prebatch-1" },
    preBatch.payload));
  check("D3a", preBatchResult.success === false && preBatchResult.unknown === true &&
    preBatchResult.requestKey === "expense-prebatch-1" && preBatchResult.operationID,
    JSON.stringify(preBatchResult));
  check("D3b", t11u2Ops_(preBatch).length === 1 &&
    t11u2Ops_(preBatch)[0].State === "IN_PROGRESS" &&
    t11u2Tabops_(preBatch).length === 1 && t11u2Ledger_(preBatch).length === 1,
    "intent only, zero business artifacts");
  preBatch.crashAt = null;
  var preBatchResume = preBatch.run(Object.assign({ requestKey: "expense-prebatch-1" },
    preBatch.payload));
  check("D3c", preBatchResume.success === true &&
    t11u2Tabops_(preBatch).length === 2 && t11u2Ledger_(preBatch).length === 3 &&
    preBatch.batches.length === 1, JSON.stringify(preBatchResume));

  // D4: UNKNOWN after the batch — artifacts exist, state still IN_PROGRESS;
  // the retry finalizes without a second batch.
  var postBatch = t11u2Fixture_();
  postBatch.crashAt = "EXPENSE_AFTER_BATCH";
  var postBatchResult = postBatch.run(Object.assign({ requestKey: "expense-postbatch-1" },
    postBatch.payload));
  check("D4a", postBatchResult.success === false && postBatchResult.unknown === true &&
    postBatchResult.requestKey === "expense-postbatch-1",
    JSON.stringify(postBatchResult));
  check("D4b", t11u2Tabops_(postBatch).length === 2 && t11u2Ledger_(postBatch).length === 3 &&
    t11u2Ops_(postBatch)[0].State === "IN_PROGRESS", "artifacts present, intent open");
  postBatch.crashAt = null;
  var postBatchResume = postBatch.run(Object.assign({ requestKey: "expense-postbatch-1" },
    postBatch.payload));
  check("D4c", postBatchResume.success === true && postBatch.batches.length === 1 &&
    t11u2Tabops_(postBatch).length === 2 && t11u2Ledger_(postBatch).length === 3,
    "finalize without a second batch: " + JSON.stringify(postBatchResume));

  // D5: batch transport failure -> UNKNOWN (never a definite failure).
  var failed = t11u2Fixture_();
  failed.batchFailure = "BATCH_DOWN";
  var failedResult = failed.run(Object.assign({ requestKey: "expense-batchdown-1" },
    failed.payload));
  check("D5a", failedResult.success === false && failedResult.unknown === true &&
    failedResult.status === "UNKNOWN", JSON.stringify(failedResult));
  failed.batchFailure = null;
  var failedResume = failed.run(Object.assign({ requestKey: "expense-batchdown-1" },
    failed.payload));
  check("D5b", failedResume.success === true && t11u2Tabops_(failed).length === 2,
    JSON.stringify(failedResume));

  // D6: missing business artifact after COMMITTED -> incomplete, no repair.
  var lostBusiness = t11u2Fixture_();
  var lostResult1 = lostBusiness.run(Object.assign({ requestKey: "expense-lost-1" },
    lostBusiness.payload));
  var lostEntryID = lostResult1.data.id;
  var lostIndex = lostBusiness.sheets.tabops.rows.findIndex(function(row) {
    return String(row[0]) === lostEntryID;
  });
  lostBusiness.sheets.tabops.rows.splice(lostIndex, 1);
  var lostResult = lostBusiness.run(Object.assign({ requestKey: "expense-lost-1" },
    lostBusiness.payload));
  check("D6a", lostResult.success === false &&
    lostResult.status === "RECOVERY_REQUIRED" &&
    lostResult.error.code === save.CODES.ARTIFACTS_INCOMPLETE,
    JSON.stringify(lostResult));

  // D7: missing ledger line -> incomplete.
  var lostLedger = t11u2Fixture_();
  lostLedger.run(Object.assign({ requestKey: "expense-lostledger-1" }, lostLedger.payload));
  var ledgerRows = t11u2Ledger_(lostLedger);
  var ownIndex = ledgerRows.map(function(row, index) {
    return row.SourceType === save.SOURCE_TYPE ? index : -1;
  }).filter(function(index) { return index !== -1; });
  lostLedger.sheets.BalanceLedger.rows.splice(1 + ownIndex[0], 1);
  var lostLedgerResult = lostLedger.run(Object.assign({ requestKey: "expense-lostledger-1" },
    lostLedger.payload));
  check("D7", lostLedgerResult.success === false &&
    lostLedgerResult.status === "RECOVERY_REQUIRED", JSON.stringify(lostLedgerResult));

  // D8: duplicate ledger line -> conflict (never a third append).
  var duplicate = t11u2Fixture_();
  duplicate.run(Object.assign({ requestKey: "expense-dup-1" }, duplicate.payload));
  var dupRows = t11u2Ledger_(duplicate);
  var dupOwn = dupRows.filter(function(row) { return row.SourceType === save.SOURCE_TYPE; })[0];
  duplicate.sheets.BalanceLedger.rows.push(
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.map(function(header) {
      return header === "LineID" ? dupOwn.JournalID + "-3" : dupOwn[header];
    }));
  var dupResult = duplicate.run(Object.assign({ requestKey: "expense-dup-1" },
    duplicate.payload));
  check("D8", dupResult.success === false && dupResult.status === "RECOVERY_REQUIRED" &&
    dupResult.error.code === save.CODES.IDENTITY_CONFLICT, JSON.stringify(dupResult));

  // D9-D11: stored-plan tampering (digest, amount, account) fails closed.
  [{ field: "planDigest", value: "TAMPERED", id: "D9" },
   { field: "amount", value: 1, id: "D10" },
   { field: "journalRows[0].AccountCode", value: "1000", id: "D11" }
  ].forEach(function(scenario) {
    var f = t11u2Fixture_();
    var key = "expense-tamper-" + scenario.id;
    f.run(Object.assign({ requestKey: key }, f.payload));
    var opRow = f.sheets.TransactionOperations.rows[1];
    var plan = JSON.parse(opRow[opsHeader.indexOf("OperationPlan")]);
    if (scenario.field === "journalRows[0].AccountCode") plan.journalRows[0].AccountCode = scenario.value;
    else plan[scenario.field] = scenario.value;
    opRow[opsHeader.indexOf("OperationPlan")] = JSON.stringify(plan);
    var before = t11u2Snapshot_(f);
    var result = f.run(Object.assign({ requestKey: key }, f.payload));
    check(scenario.id, result.success === false &&
      (result.status === "RECOVERY_REQUIRED" || result.status === "CONFLICT") &&
      t11u2Snapshot_(f) === before && f.batches.length === 1, JSON.stringify(result));
  });

  // D12: persisted ledger tamper after COMMITTED -> identity conflict.
  var rowTamper = t11u2Fixture_();
  rowTamper.run(Object.assign({ requestKey: "expense-rowtamper-1" }, rowTamper.payload));
  var tamperedLedger = t11u2Ledger_(rowTamper);
  tamperedLedger.forEach(function(row, index) {
    if (row.SourceType !== save.SOURCE_TYPE) return;
    row.Debit = 1;
    var sheetIndex = index + 1;
    rowTamper.sheets.BalanceLedger.rows[sheetIndex][
      BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf("Debit")] = 1;
  });
  var rowTamperResult = rowTamper.run(Object.assign({ requestKey: "expense-rowtamper-1" },
    rowTamper.payload));
  check("D12", rowTamperResult.success === false &&
    rowTamperResult.status === "RECOVERY_REQUIRED", JSON.stringify(rowTamperResult));

  // D13: an invalid persisted operation state is never committed.
  var badState = t11u2Fixture_();
  badState.run(Object.assign({ requestKey: "expense-badstate-1" }, badState.payload));
  badState.sheets.TransactionOperations.rows[1][opsHeader.indexOf("State")] = "BOGUS";
  var badStateResult = badState.run(Object.assign({ requestKey: "expense-badstate-1" },
    badState.payload));
  check("D13", badStateResult.success === false &&
    badStateResult.error.code === save.CODES.INVALID_OPERATION_STATE,
    JSON.stringify(badStateResult));

  // D14: a duplicated operation store row fails closed.
  var dupOp = t11u2Fixture_();
  dupOp.run(Object.assign({ requestKey: "expense-dupop-1" }, dupOp.payload));
  dupOp.sheets.TransactionOperations.rows.push(
    dupOp.sheets.TransactionOperations.rows[1].slice());
  var dupOpResult = dupOp.run(Object.assign({ requestKey: "expense-dupop-1" },
    dupOp.payload));
  check("D14", dupOpResult.success === false &&
    dupOpResult.error.code === save.CODES.DUPLICATE_OPERATION_EVIDENCE,
    JSON.stringify(dupOpResult));

  // D15: a second intent for the same payload never mints a second row.
  var twice = t11u2Fixture_();
  var r1 = twice.run(Object.assign({ requestKey: "expense-twice-1" }, twice.payload));
  var r2 = twice.run(Object.assign({ requestKey: "expense-twice-2" }, twice.payload));
  check("D15", r1.success === true && r2.success === true &&
    t11u2Tabops_(twice).length === 3 && t11u2Ops_(twice).length === 2 &&
    r1.data.id !== r2.data.id, JSON.stringify([r1.data.id, r2.data.id]));

  console.log("T11_4_U2_DURABILITY checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// E. Isolation: historical, Treasury, correction lineage, zero mutations
// ---------------------------------------------------------------------------
function testExpenseSingleCommitIsolation() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u2Check_(counter, id, value, detail); }
  var save = EXPENSE_SINGLE_COMMIT_V1;

  var f = t11u2Fixture_();
  var historicalBefore = JSON.stringify({
    tabops: f.sheets.tabops.rows[1],
    ledger: f.sheets.BalanceLedger.rows[1],
    log: f.sheets.Logs.rows[1],
    accounts: f.sheets.Accounts.rows
  });
  var result = f.run(Object.assign({ requestKey: "expense-iso-1" }, f.payload));
  var historicalAfter = JSON.stringify({
    tabops: f.sheets.tabops.rows[1],
    ledger: f.sheets.BalanceLedger.rows[1],
    log: f.sheets.Logs.rows[1],
    accounts: f.sheets.Accounts.rows
  });
  check("E1a", result.success === true && historicalBefore === historicalAfter,
    "historical Expense/ledger/Logs/Accounts evidence byte-identical");
  check("E1b", JSON.stringify(f.sheets.tabops.rows[0]) ===
    JSON.stringify(CANONICAL_ENTRY.EXPENSE_HEADERS.slice()) &&
    JSON.stringify(f.sheets.BalanceLedger.rows[0]) ===
      JSON.stringify(BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.slice()),
    "no header/schema change");

  // E2: no legacy channel account is ever written by this operation.
  check("E2", t11u2Ledger_(f).filter(function(row) {
    return ["1000", "1010", "1020"].indexOf(String(row.AccountCode)) !== -1;
  }).length === 0, "no 1000/1010/1020 postings");

  // E3: Treasury isolation — the batch may only ever touch the three frozen
  // surfaces, and neither the dispatcher nor the produced rows carry a
  // receipt / evidence / destination concept.
  var dispatcherSource = submitCanonicalTransactionWithRuntime_.toString();
  var normalizerTokens = ["expenseSingleCommitNormalize_", "expenseSingleCommitPlan_",
    "expenseSingleCommitValueRanges_", "expenseSingleCommitInspect_"];
  var writerTokens = ["expenseSingleCommitPlan_", "expenseSingleCommitValueRanges_",
    "expenseSingleCommitInspect_", "expenseSingleCommitApplyBatch_"];
  var normalizerSource = normalizerTokens.map(function(name) {
    check("E3_exists_" + name, typeof globalThis[name] === "function", name);
    return typeof globalThis[name] === "function" ? globalThis[name].toString() : "";
  }).join("\n");
  var writerSource = writerTokens.map(function(name) {
    return typeof globalThis[name] === "function" ? globalThis[name].toString() : "";
  }).join("\n");
  check("E3a", JSON.stringify(EXPENSE_SINGLE_COMMIT_V1.WRITE_SURFACES) ===
    JSON.stringify(["tabops", "BalanceLedger", "Logs"]), "no Treasury/Settlements surface");
  // The normalizer NAMES the payment fields it refuses (C8 proves the refusal);
  // the writer path must never reference a Treasury concept at all.
  ["TreasuryReceipt", "MANUAL_VERIFIED", "EvidenceRef", "SettlementID",
   "Settlements"].forEach(function(token, index) {
    check("E3b_" + index, writerSource.indexOf(token) === -1, token);
  });
  ["TreasuryReceipt", "MANUAL_VERIFIED", "destinationAccountCode",
   "TreasuryOperations"].forEach(function(token, index) {
    check("E3c_" + index, dispatcherSource.indexOf(token) === -1, token);
  });
  check("E3c5", normalizerSource.indexOf("TreasuryReceipt") === -1 &&
    normalizerSource.indexOf("MANUAL_VERIFIED") === -1, "no Treasury concept in the core");
  var storedPlan = JSON.parse(t11u2Ops_(f)[0].OperationPlan);
  check("E3d", storedPlan.journalRows.every(function(row) {
    var keys = Object.keys(row);
    return keys.every(function(key) {
      return BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf(key) !== -1;
    }) && row.ExternalRef === "";
  }), JSON.stringify(Object.keys(storedPlan.journalRows[0])));
  check("E3e", !f.sheets.TreasuryReceipts && !f.sheets.Settlements,
    "no Treasury/Settlements surface exists in the Expense fixture");

  // E4: no accountingPending / SETTLEMENT_PENDING success on the new path.
  check("E4a", result.accountingPending === undefined &&
    t11u2Logs_(f).filter(function(row) { return row.Action === "SETTLEMENT_PENDING"; })
      .length === 0, JSON.stringify(result));
  check("E4b", f.settlementAttempts === 0, "settlement writer never invoked");

  // E5: correction lineage is deterministic from the business artifact alone.
  var entryID = result.data.id;
  var journalRows = t11u2Ledger_(f).filter(function(row) {
    return row.SourceType === save.SOURCE_TYPE;
  });
  check("E5a", journalRows[0].JournalID === "EXPJ-" + entryID &&
    journalRows[0].SourceID === entryID && journalRows[1].SourceID === entryID,
    JSON.stringify(journalRows.map(function(row) { return row.JournalID; })));
  check("E5b", t11u2Logs_(f)[1].RecordID === entryID &&
    t11u2Ops_(f)[0].BusinessID === entryID,
    "U6 can resolve business row + exact journal from ID_Trx");
  check("E5c", result.data.id.indexOf("OPS-APP-") === 0 &&
    journalRows.every(function(row) { return row.MovementType === save.MOVEMENT_TYPE; }),
    "append-only originals with a stable movement type for signed reversal");

  // E6: historical transition identifiers are untouched by this operation.
  var allMovement = t11u2Ledger_(f).map(function(row) { return row.MovementType; });
  check("E6", allMovement.indexOf("TRANSITIONAL_CLEARING_CLOSE") === -1 &&
    allMovement.filter(function(type) { return type === "HISTORICAL"; }).length === 1,
    JSON.stringify(allMovement));

  // E7: no production/config mutation is reachable from the new core.
  var mutationTokens = ["setProperty(", "requireNumlockProductionSpreadsheet(",
    "clasp ", "SpreadsheetApp.getActiveSpreadsheet"];
  mutationTokens.forEach(function(token, index) {
    check("E7_" + index, normalizerSource.indexOf(token) === -1, token);
  });

  // E8: the dispatcher still owns exactly one outer lock and never nests a
  // second one for the single-commit path.
  check("E8", dispatcherSource.indexOf("lock.waitLock(30000)") !== -1 &&
    normalizerSource.indexOf("waitLock") === -1 &&
    writerSource.indexOf("waitLock") === -1, "core never acquires a lock");

  console.log("T11_4_U2_ISOLATION checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}
