// T11.5 U3 — Purchase durable single-commit core (SINGLE_COMMIT_TRANSACTION_V1
// gated). Focused local suites over the shared dispatcher runtime: gate
// routing + byte-identical legacy parity (ABSENT/PREPARED) vs the exclusive
// ACTIVE PURCHASE_SINGLE_COMMIT_SAVE path, the 1040 + 6210 preflight matrix,
// one-plan/ONE-batch composition (final PurchaseEvent append + Policy C
// Dr6210/Cr1040 + Logs), durability (replay / conflict / UNKNOWN pre + post
// batch / artifact loss / tamper), and isolation audits (Treasury/AP/
// Inventory, payment fields, historical rows, correction lineage).
// Fixtures only — no production access, no clasp, no config writes, no
// PropertiesService mutation, no network transport.

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
function t11u3ConfigRaw_(mode) {
  return JSON.stringify({ mode: mode === undefined ? "ACTIVE" : mode, configVersion: 1 });
}

function t11u3Account1040_(overrides) {
  return Object.assign({ AccountCode: "1040", AccountName: "Operational Funds",
    AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating",
    IsActive: true, CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" }, overrides || {});
}

function t11u3Account6210_(overrides) {
  return Object.assign({ AccountCode: "6210", AccountName: "Purchase Expense",
    AccountType: "Expense", StatementGroup: "Operating Expense", CashFlowGroup: "Operating",
    IsActive: true, CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" }, overrides || {});
}

function t11u3Sheet_(headers) {
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
function t11u3TransportValue_(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function t11u3Snapshot_(f) {
  var out = {};
  Object.keys(f.sheets).forEach(function(name) {
    out[name] = JSON.stringify(f.sheets[name].rows);
  });
  out.batches = f.batches.length;
  out.legacyWrites = JSON.stringify(f.legacyWrites);
  out.settlementAttempts = f.settlementAttempts;
  return JSON.stringify(out);
}

function t11u3Table_(f, name, headers) {
  return readCanonicalTable({ getSheetByName: function(sheetName) { return f.sheets[sheetName] || null; } },
    name, headers);
}

function t11u3Ledger_(f) {
  return t11u3Table_(f, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
}

function t11u3Ops_(f) {
  return t11u3Table_(f, "TransactionOperations", TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS);
}

function t11u3Logs_(f) {
  return t11u3Table_(f, "Logs", CANONICAL_ENTRY.LOG_HEADERS);
}

function t11u3Events_(f) {
  return t11u3Table_(f, "PurchaseEvents", PURCHASE_EVENT_POLICY.headers);
}

// A history-valid PurchaseEvent row (T11.2 §13 round-trip): the historical
// fixture and the foreign-identity conflict row both use this exact shape so
// purchaseEventHistory_ accepts the store byte-exactly.
function t11u3EventRow_(key, dateKey) {
  dateKey = dateKey || "2026-09-20";
  var normalized = normalizePurchaseEventRequestWithCompatibility_({
    transactionType: "EXPENSE", requestKey: key, expenseItemId: "OSK01",
    input: { ExpenseDate: dateKey, ReceiptDate: dateKey, PurchaseQty: "5",
      PurchaseUOM: "kg", AcquisitionValue: "90000", SupplierSource: "PT Historical",
      ExternalRef: "", ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE",
      Attested: true }
  }, true);
  var route = EXPENSE_PURCHASE_POLICY.rows.filter(function(row) {
    return row.expenseItemId === "OSK01";
  })[0];
  return { EventID: "PE-" + key, ExpenseID: "OSK01", BusinessLabel: "Test-OSK01",
    PolicyVersion: EXPENSE_PURCHASE_POLICY.version,
    PolicyRevision: EXPENSE_PURCHASE_POLICY.revision,
    CostType: route.CostType, PurchaseRelationship: route.PurchaseRelationship,
    ExpenseDate: normalized.input.ExpenseDate, ReceiptDate: normalized.input.ReceiptDate,
    PurchaseQty: normalized.input.PurchaseQty, PurchaseUOM: normalized.input.PurchaseUOM,
    AcquisitionValue: normalized.input.AcquisitionValue,
    SupplierSource: normalized.input.SupplierSource,
    ExternalRef: normalized.input.ExternalRef,
    ExternalDocumentStatus: normalized.input.ExternalDocumentStatus,
    Attestation: JSON.stringify({ attested: true, conversionEvidenceConfirmed: false }),
    AllocationStatus: "QUANTITY_PACKAGE_UNRESOLVED", RequestKey: key,
    NormalizedPayload: JSON.stringify(normalized), ReceiptPlan: "null",
    Lifecycle: PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL,
    RecoveryKey: "pe-receipt-" + key, CreatedAt: dateKey + "T01:00:00.000Z",
    CreatedBy: "SYSTEM_APP_ENTRY", IsActive: true, PaymentStatus: "PAID",
    CashAccountCode: "1000", SupplierID: "", AccountingStatus: "POSTED" };
}

function t11u3Fixture_(options) {
  options = options || {};
  var sheets = {
    PurchaseEvents: t11u3Sheet_(PURCHASE_EVENT_POLICY.headers),
    tabops: t11u3Sheet_(CANONICAL_ENTRY.EXPENSE_HEADERS),
    Logs: t11u3Sheet_(CANONICAL_ENTRY.LOG_HEADERS),
    BalanceLedger: t11u3Sheet_(BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS),
    TransactionOperations: t11u3Sheet_(TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS),
    Accounts: t11u3Sheet_(CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS),
    ExpenseItems: t11u3Sheet_(PURCHASE_SINGLE_COMMIT_V1.ITEM_HEADERS),
    Suppliers: t11u3Sheet_(SUPPLIER_MASTER_CONTRACT.HEADERS)
  };
  function push(name, values) {
    sheets[name].rows.push(sheets[name].rows[0].map(function(header) {
      return values[header] === undefined ? "" : values[header];
    }));
  }
  // Historical monetary channels + the AP account this operation must never
  // touch (1000/1010/1020 legacy cash, 2000 payables).
  ["1000", "1010", "1020", "2000"].forEach(function(code) {
    push("Accounts", { AccountCode: code, AccountName: "Legacy " + code,
      AccountType: code === "2000" ? "Liability" : "Asset",
      StatementGroup: code === "2000" ? "Current Liabilities" : "Current Assets",
      CashFlowGroup: "Operating", IsActive: true,
      NormalBalance: code === "2000" ? "CREDIT" : "DEBIT" });
  });
  push("Accounts", { AccountCode: "6100", AccountName: "Utilities Expense",
    AccountType: "Expense", StatementGroup: "Utilities Expense", CashFlowGroup: "Operating",
    IsActive: true, NormalBalance: "DEBIT" });
  (options.accounts || [t11u3Account1040_()]).forEach(function(row) { push("Accounts", row); });
  (options.purchaseAccounts || [t11u3Account6210_()]).forEach(function(row) { push("Accounts", row); });
  // Frozen-policy expense items: one ordinary route + two Purchase routes.
  push("ExpenseItems", { ID_Ops: "OSS01", Item: "Test-OSS01", Kategori: "Test",
    Kind: "Test", Group: "Test", AccountCode: "6100", IsActive: true });
  push("ExpenseItems", { ID_Ops: "OSK01", Item: "Test-OSK01", Kategori: "Test",
    Kind: "Test", Group: "Test", AccountCode: "6210", IsActive: true });
  push("ExpenseItems", { ID_Ops: "OSR01", Item: "Test-OSR01", Kategori: "Test",
    Kind: "Test", Group: "Test", AccountCode: "6210", IsActive: true });
  push("Suppliers", { SupplierID: "SUP-001", Name: "PT Maju Jaya", IsActive: true });
  (options.suppliers || []).forEach(function(row) { push("Suppliers", row); });
  // Pre-existing historical evidence that must never be rewritten.
  var historicalEvent = t11u3EventRow_("purchase-hist-0001");
  push("PurchaseEvents", historicalEvent);
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
    legacyWrites: [],
    settlementAttempts: 0,
    invalidations: 0,
    crashAt: null,
    batchFailure: null,
    sequence: 0,
    // Legacy-path in-memory event store: readCanonicalTable would inject
    // sourceRowIndex and break the production readback byte comparison, so the
    // legacy seam keeps object rows here (mirroring purchaseEventTestFixture_).
    legacyEvents: [historicalEvent]
  };
  function ss() {
    return { getSheetByName: function(name) { return sheets[name] || null; } };
  }
  f.spreadsheet = ss;
  var lock = { waitLock: function() {}, releaseLock: function() {}, hasLock: function() { return true; } };
  // Legacy LOCAL_FIXTURE purchase runtime: event append + separate Policy C
  // accounting step (the sequential-write hazard the ACTIVE path removes).
  var purchaseSeam = {
    environment: "LOCAL_FIXTURE",
    enabled: true,
    lock: lock,
    read: function() {
      return { events: f.legacyEvents.slice(),
        expenses: readCanonicalTable(ss(), "ExpenseItems", PURCHASE_SINGLE_COMMIT_V1.ITEM_HEADERS),
        items: [], conversions: [] };
    },
    audit: function() { return { actor: "SYSTEM_APP_ENTRY", at: "2026-10-05T01:00:00.000Z" }; },
    appendEvent: function(row) {
      f.legacyWrites.push("EVENT");
      f.legacyEvents.push(row);
      sheets.PurchaseEvents.rows.push(sheets.PurchaseEvents.rows[0].map(function(header) {
        return row[header] === undefined ? "" : row[header];
      }));
    },
    readLedger: function() {
      return readCanonicalTable(ss(), "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS);
    },
    writeLedger: function(rows) {
      f.legacyWrites.push("LEDGER");
      rows.forEach(function(row) {
        sheets.BalanceLedger.rows.push(sheets.BalanceLedger.rows[0].map(function(header) {
          return row[header] === undefined ? "" : row[header];
        }));
      });
    },
    flush: function() {},
    updatePurchaseAccounting: function(eventId, status) {
      f.legacyEvents.forEach(function(row) {
        if (String(row.EventID) === eventId) row.AccountingStatus = status;
      });
      var column = PURCHASE_EVENT_POLICY.headers.indexOf("AccountingStatus");
      var rows = sheets.PurchaseEvents.rows;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === eventId) { rows[i][column] = status; return; }
      }
      throw new Error("PURCHASE_ACCOUNTING_EVENT_NOT_UNIQUE");
    },
    readPurchaseEvent: function(eventId) {
      var found = f.legacyEvents.filter(function(row) { return String(row.EventID) === eventId; });
      return found.length === 1 ? found[0] : null;
    },
    receipt: {
      environment: "LOCAL_FIXTURE",
      lock: lock,
      read: function() {
        return { receipts: [], ledger: [], items: [], conversions: [], activation: { enabled: false } };
      },
      appendMovement: function() { throw new Error("MOVEMENT_NOT_EXPECTED"); }
    }
  };
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
          sheet.rows.push(row.map(t11u3TransportValue_));
        });
      });
    },
    crash: function(label) {
      if (f.crashAt === label) throw new Error("CRASH_" + label);
    },
    actor: function() { return "SYSTEM_APP_ENTRY"; }
  };
  f.runtime = {
    environment: "LOCAL_FIXTURE",
    lock: lock,
    spreadsheet: ss,
    now: function() { return new Date("2026-10-05T01:00:00Z"); },
    uuid: function() { return ("000000000000" + (++f.sequence)).slice(-12); },
    flush: function() {},
    invalidate: function() { f.invalidations++; },
    settle: function() { f.settlementAttempts++; return { status: "DISABLED" }; },
    singleCommitConfig: options.singleCommitConfig === undefined ?
      t11u3ConfigRaw_("ACTIVE") : options.singleCommitConfig,
    purchase: purchaseSeam,
    purchaseSingleCommit: seam
  };
  f.run = function(payload) {
    return submitCanonicalTransactionWithRuntime_(payload, f.runtime);
  };
  return f;
}

// Canonical ACTIVE-path payload: the frozen T11.2 §17 minimum input only.
function t11u3Payload_(key, overrides) {
  return Object.assign({
    transactionType: "EXPENSE",
    requestKey: key,
    expenseItemId: "OSK01",
    input: {
      ExpenseDate: "2026-10-05",
      ReceiptDate: "2026-10-05",
      PurchaseQty: "10",
      PurchaseUOM: "KG",
      AcquisitionValue: "150000",
      SupplierSource: "PT Maju Jaya",
      ExternalRef: "",
      ExternalDocumentStatus: "EXTERNAL_DOCUMENT_UNAVAILABLE",
      Attested: true
    }
  }, overrides || {});
}

// Legacy-shaped payload (payment authority present) for ABSENT/PREPARED
// byte-identical parity of the pre-U3 writer.
function t11u3LegacyPayload_(key) {
  var payload = t11u3Payload_(key);
  payload.paymentStatus = "PAID";
  payload.cashAccountCode = "1000";
  return payload;
}

function t11u3Check_(counter, id, value, detail) {
  counter.pass++;
  if (!value) {
    throw new Error("T11_5_U3:" + id + (detail === undefined ? "" : "|" + detail));
  }
}

// ---------------------------------------------------------------------------
// A. Config gate routing: legacy parity (ABSENT/PREPARED) vs exclusive ACTIVE
// ---------------------------------------------------------------------------
function testPurchaseSingleCommitGateRouting() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u3Check_(counter, id, value, detail); }
  var sc = SINGLE_COMMIT_TRANSACTION_V1, save = PURCHASE_SINGLE_COMMIT_V1;

  // G1: config ABSENT -> the exact legacy Purchase route: event append +
  // separate Policy C accounting step, NO operation row, NO batch, NO
  // single-commit envelope, no cache/settlement side effect.
  var absent = t11u3Fixture_({ singleCommitConfig: null });
  var absentResult = absent.run(t11u3LegacyPayload_("purchase-legacy-1"));
  check("G1a", absentResult.success === true && absentResult.status === "PURCHASE_CAPTURED" &&
    absentResult.singleCommit === undefined &&
    !Object.prototype.hasOwnProperty.call(absentResult, "accountingPending"),
    JSON.stringify(absentResult));
  check("G1b", absent.batches.length === 0 && t11u3Ops_(absent).length === 0 &&
    JSON.stringify(absent.legacyWrites) === JSON.stringify(["EVENT", "LEDGER"]) &&
    absentResult.writeCount === 1,
    JSON.stringify({ batches: absent.batches, legacyWrites: absent.legacyWrites }));
  check("G1c", absent.invalidations === 0 && absent.settlementAttempts === 0 &&
    t11u3Events_(absent).length === 2 && t11u3Ledger_(absent).length === 3,
    "legacy multistep only: historical + one event, historical + pair");

  // G2: explicit PREPARED behaves byte-identically to ABSENT (result and
  // every sheet byte-identical; the U3 gate changes nothing before ACTIVE).
  var prepared = t11u3Fixture_({ singleCommitConfig: t11u3ConfigRaw_("PREPARED") });
  var preparedResult = prepared.run(t11u3LegacyPayload_("purchase-legacy-1"));
  check("G2a", JSON.stringify(preparedResult) === JSON.stringify(absentResult),
    JSON.stringify({ prepared: preparedResult, absent: absentResult }));
  check("G2b", t11u3Snapshot_(prepared) === t11u3Snapshot_(absent),
    "PREPARED outcome byte-identical to ABSENT");

  // G3-G6: PAUSED / invalid JSON / REJECT / bad version all fail closed with
  // ZERO writes of any kind (never a legacy fallback, never a partial intent).
  [{ raw: t11u3ConfigRaw_("PAUSED"), code: sc.CODES.SINGLE_COMMIT_MODE_PAUSED, id: "G3" },
   { raw: "{not-json", code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "G4" },
   { raw: t11u3ConfigRaw_("REJECT"), code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "G5" },
   { raw: JSON.stringify({ mode: "ACTIVE", configVersion: 0 }),
     code: sc.CODES.SINGLE_COMMIT_CONFIG_INVALID, id: "G6" }
  ].forEach(function(scenario) {
    var f = t11u3Fixture_({ singleCommitConfig: scenario.raw });
    var before = t11u3Snapshot_(f);
    var result = f.run(t11u3Payload_("purchase-gate-" + scenario.id));
    check(scenario.id, result.success === false && result.error.code === scenario.code &&
      result.writeCount === 0 && f.batches.length === 0 && t11u3Ops_(f).length === 0 &&
      t11u3Snapshot_(f) === before, JSON.stringify(result));
  });

  // G7: ACTIVE routes the Purchase item exclusively to the new core: one
  // operation row, ONE atomic batch, zero legacy write units.
  var active = t11u3Fixture_();
  var activeResult = active.run(t11u3Payload_("purchase-active-1"));
  check("G7a", activeResult.success === true && activeResult.singleCommit.status === "DONE" &&
    activeResult.status === "OPERATIONAL_POSTED" &&
    !Object.prototype.hasOwnProperty.call(activeResult, "accountingPending"),
    JSON.stringify(activeResult));
  check("G7b", t11u3Ops_(active).length === 1 && active.batches.length === 1 &&
    active.legacyWrites.length === 0 && active.invalidations === 1 &&
    active.settlementAttempts === 0,
    JSON.stringify({ batches: active.batches, legacyWrites: active.legacyWrites }));

  // G8: explicit payment/channel input is refused on the ACTIVE path with
  // zero writes — never silently dropped, never routed to the legacy cash gate.
  [{ field: "cashAccountCode", value: "1000" },
   { field: "paidVia", value: "DANA" },
   { field: "paymentStatus", value: "PAID" }
  ].forEach(function(scenario) {
    var f = t11u3Fixture_();
    var before = t11u3Snapshot_(f);
    var payload = t11u3Payload_("purchase-pay-" + scenario.field);
    payload[scenario.field] = scenario.value;
    var result = f.run(payload);
    check("G8_" + scenario.field, result.success === false &&
      result.error.code === save.CODES.PAYMENT_FIELD_REFUSED && result.writeCount === 0 &&
      f.batches.length === 0 && t11u3Ops_(f).length === 0 && t11u3Snapshot_(f) === before,
      JSON.stringify(result));
  });

  // G9: the separate postPolicyCPurchaseEvent_ accounting step NEVER runs on
  // the ACTIVE path (event final at append); the legacy route still runs it
  // exactly once (the sequential-write hazard preserved only for legacy).
  var originalPost = globalThis.postPolicyCPurchaseEvent_;
  var postCalls = 0;
  globalThis.postPolicyCPurchaseEvent_ = function() {
    postCalls++;
    return originalPost.apply(this, arguments);
  };
  try {
    var spyActive = t11u3Fixture_();
    var spyActiveResult = spyActive.run(t11u3Payload_("purchase-spy-active"));
    var activeCalls = postCalls;
    var spyLegacy = t11u3Fixture_({ singleCommitConfig: null });
    var spyLegacyResult = spyLegacy.run(t11u3LegacyPayload_("purchase-spy-legacy"));
    check("G9a", spyActiveResult.success === true && activeCalls === 0,
      "ACTIVE: " + JSON.stringify({ activeCalls: activeCalls, result: spyActiveResult }));
    check("G9b", spyLegacyResult.success === true && postCalls === activeCalls + 1,
      "legacy accounting step runs exactly once: " + postCalls);
  } finally {
    globalThis.postPolicyCPurchaseEvent_ = originalPost;
  }

  console.log("T11_5_U3_GATE checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// B. Account preflight matrix: frozen 1040 (T11.2 §11) + Policy C debit 6210
// ---------------------------------------------------------------------------
function testPurchaseSingleCommitPreflightAccounts() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u3Check_(counter, id, value, detail); }
  var save = PURCHASE_SINGLE_COMMIT_V1;

  function scenario(id, options, expectedField) {
    var f = t11u3Fixture_(options);
    var before = t11u3Snapshot_(f);
    var result = f.run(t11u3Payload_("purchase-pre-" + id));
    check(id, result.success === false &&
      result.error.code === save.CODES.ACCOUNT_PREFLIGHT_FAILED &&
      result.writeCount === 0 && f.batches.length === 0 && t11u3Ops_(f).length === 0 &&
      t11u3Events_(f).length === 1 && t11u3Ledger_(f).length === 1 &&
      t11u3Snapshot_(f) === before, JSON.stringify(result));
    if (expectedField) {
      check(id + "_field", result.error.field === expectedField, String(result.error.field));
    }
  }

  scenario("P1_1040_missing", { accounts: [] });
  scenario("P2_1040_duplicate", { accounts: [t11u3Account1040_(), t11u3Account1040_()] });
  scenario("P3_1040_inactive", { accounts: [t11u3Account1040_({ IsActive: false })] });
  scenario("P4_1040_wrongType", { accounts: [t11u3Account1040_({ AccountType: "Liability" })] });
  scenario("P5_1040_wrongGroup", { accounts: [t11u3Account1040_({ CashFlowGroup: "Investing" })] });
  scenario("P6_1040_wrongBalance", { accounts: [t11u3Account1040_({ NormalBalance: "CREDIT" })] });

  // P7: a failed preflight never falls back to a legacy channel or AP account.
  var fallback = t11u3Fixture_({ accounts: [] });
  var fallbackResult = fallback.run(t11u3Payload_("purchase-pre-P7"));
  var fallbackLedger = t11u3Ledger_(fallback);
  check("P7a", fallbackResult.success === false && fallbackLedger.length === 1 &&
    fallbackLedger[0].SourceType === "HISTORICAL",
    JSON.stringify({ result: fallbackResult, ledger: fallbackLedger }));
  check("P7b", fallbackLedger.filter(function(row) {
    return ["1000", "1010", "1020", "2000", "1040"].indexOf(String(row.AccountCode)) !== -1;
  }).length === 0, "no fallback money/AP account written");

  scenario("P8_6210_missing", { purchaseAccounts: [] }, "6210");
  scenario("P9_6210_duplicate", { purchaseAccounts: [t11u3Account6210_(), t11u3Account6210_()] }, "6210");
  scenario("P10_6210_inactive", { purchaseAccounts: [t11u3Account6210_({ IsActive: false })] }, "6210");
  scenario("P11_6210_wrongType", { purchaseAccounts: [t11u3Account6210_({ AccountType: "Asset" })] }, "6210");
  scenario("P11b_6210_wrongBalance", { purchaseAccounts: [t11u3Account6210_({ NormalBalance: "CREDIT" })] }, "6210");

  // P12: exact §11 1040 metadata + valid 6210 -> DONE, and the preflight is
  // pure: the Accounts sheet is never mutated (no account is created).
  var ok = t11u3Fixture_();
  var okResult = ok.run(t11u3Payload_("purchase-pre-P12"));
  check("P12a", okResult.success === true && okResult.singleCommit.status === "DONE",
    JSON.stringify(okResult));
  check("P12b", ok.sheets.Accounts.rows.length === 8 &&
    JSON.stringify(ok.sheets.Accounts.rows[0]) ===
      JSON.stringify(CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.slice()),
    "Accounts untouched (header + 4 legacy + 6100 + 1040 + 6210)");

  console.log("T11_5_U3_PREFLIGHT checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// C. One plan / ONE batch / final PurchaseEvent state / minimum input
// ---------------------------------------------------------------------------
function testPurchaseSingleCommitPlanBatch() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u3Check_(counter, id, value, detail); }
  var save = PURCHASE_SINGLE_COMMIT_V1;
  var ledgerHeaders = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS;
  var key = "purchase-plan-0001";
  var eventID = "PE-" + key;
  var journalID = "POLICYC-PEXP-PURCHASE-" + eventID;

  var f = t11u3Fixture_();
  var result = f.run(t11u3Payload_(key));
  check("B1a", result.success === true && result.writeCount === 4, JSON.stringify(result));
  check("B1b", JSON.stringify(f.batches) === JSON.stringify([[
    { range: "PurchaseEvents", rows: 1 }, { range: "BalanceLedger", rows: 2 },
    { range: "Logs", rows: 1 }]]), JSON.stringify(f.batches));
  check("B1c", JSON.stringify(save.WRITE_SURFACES) ===
    JSON.stringify(["PurchaseEvents", "BalanceLedger", "Logs"]), "exact frozen surfaces");

  // Final PurchaseEvent state at append (backend-derived, never operator input).
  var eventMatches = t11u3Events_(f).filter(function(row) { return row.EventID === eventID; });
  check("B2a", eventMatches.length === 1 && t11u3Events_(f).length === 2,
    "event exactly once");
  var eventRow = eventMatches[0];
  check("B2b", eventRow.PaymentStatus === "PAID" && eventRow.CashAccountCode === "1040" &&
    eventRow.AccountingStatus === "POSTED" && eventRow.IsActive === true &&
    eventRow.Lifecycle === PURCHASE_EVENT_LIFECYCLE_STATES.CAPTURED_OPERATIONAL &&
    eventRow.RequestKey === key && eventRow.RecoveryKey === "pe-receipt-" + key,
    JSON.stringify({ PaymentStatus: eventRow.PaymentStatus,
      CashAccountCode: eventRow.CashAccountCode, AccountingStatus: eventRow.AccountingStatus }));
  var eventPayloadKeys = Object.keys(JSON.parse(eventRow.NormalizedPayload));
  check("B2c", JSON.stringify(eventPayloadKeys) === JSON.stringify(
    ["transactionType", "requestKey", "expenseItemId", "input"]),
    JSON.stringify(eventPayloadKeys));

  // Exact Policy C journal pair: Dr6210 / Cr1040, exactly two lines, one
  // JournalID, balanced, economic date.
  var ledger = t11u3Ledger_(f);
  var own = ledger.filter(function(row) {
    return row.SourceType === save.SOURCE_TYPE && row.SourceID === eventID;
  });
  check("B3a", own.length === 2, JSON.stringify(own));
  check("B3b", own[0].AccountCode === "6210" && own[0].Debit === 150000 &&
    own[0].Credit === 0, JSON.stringify(own[0]));
  check("B3c", own[1].AccountCode === "1040" && own[1].Debit === 0 &&
    own[1].Credit === 150000, JSON.stringify(own[1]));
  check("B3d", own[0].JournalID === journalID && own[1].JournalID === journalID &&
    own[0].LineID === journalID + "-1" && own[1].LineID === journalID + "-2",
    JSON.stringify(own.map(function(row) { return row.LineID; })));
  check("B3e", own[0].Tanggal === "2026-10-05" && own[1].Tanggal === "2026-10-05" &&
    own[0].MovementType === "PURCHASE_RECOGNITION" &&
    own[1].MovementType === "PURCHASE_RECOGNITION", JSON.stringify(own[0]));
  check("B3f", own[0].Debit === own[1].Credit && own[0].Credit === 0 &&
    own[1].Debit === 0 && own[0].Debit === own[1].Credit, "balanced exact pair");

  // ONE operation row owns the immutable plan; digest + signature exact.
  var ops = t11u3Ops_(f);
  var plan = JSON.parse(ops[0].OperationPlan);
  check("B4a", plan.journalSignature === policyCJournalSignature_(own) &&
    own.every(function(row) {
      return Object.keys(row).every(function(header) {
        // sourceRowIndex is the readCanonicalTable helper artifact, never a
        // stored value (stored-row purity is B1b + I5d).
        return header === "sourceRowIndex" || ledgerHeaders.indexOf(header) !== -1;
      });
    }), JSON.stringify({ signature: plan.journalSignature }));
  check("B4b", ops.length === 1 && ops[0].OperationType === save.OPERATION_TYPE &&
    ops[0].State === "COMMITTED" && ops[0].RequestKey === key &&
    ops[0].BusinessID === eventID &&
    ops[0].OperationID === transactionOperationID_(save.OPERATION_TYPE, key),
    JSON.stringify(ops[0]));
  var logs = t11u3Logs_(f);
  check("B4c", plan.entryID === eventID && plan.journalID === journalID &&
    plan.auditID === logs[1].ID_Log &&
    plan.payloadHash === transactionPayloadHash_(plan.normalizedPayload) &&
    plan.planDigest === transactionPayloadHash_(
      Object.assign({}, plan, { planDigest: undefined })) &&
    plan.amount === 150000, "one plan owns every identity");

  // One business identity across every surface + envelope linkage.
  var identities = [result.data.id, result.eventId, eventID, ops[0].BusinessID,
    own[0].SourceID, own[1].SourceID, logs[1].RecordID, plan.entryID];
  check("B5", identities.every(function(id) { return id === identities[0]; }),
    JSON.stringify(identities));

  check("B6a", logs.length === 2 && logs[1].Action === "CREATE_PURCHASE" &&
    logs[1].Module === "TransactionEntry" && logs[1].RecordID === eventID,
    JSON.stringify(logs[1]));
  check("B6b", !Object.prototype.hasOwnProperty.call(result, "accountingPending") &&
    result.accountingStatus === "POSTED" && result.requestKey === key &&
    result.operationID === ops[0].OperationID && result.journalID === journalID &&
    result.singleCommit.writeCount === 4 && result.data.id === eventID,
    JSON.stringify(result));

  // Minimum input: only the four allowed keys are required (T11.2 §17).
  var minPayload = t11u3Payload_("purchase-min-0001");
  check("B7a", JSON.stringify(Object.keys(minPayload).sort()) ===
    JSON.stringify(["expenseItemId", "input", "requestKey", "transactionType"]),
    JSON.stringify(Object.keys(minPayload).sort()));
  var minFixture = t11u3Fixture_();
  var minResult = minFixture.run(minPayload);
  check("B7b", minResult.success === true && minResult.singleCommit.status === "DONE",
    JSON.stringify(minResult));

  // Forbidden channel/payment inputs are refused on the normalizer (D1/D2/D4/D8).
  ["paidVia", "paymentStatus", "PaymentMethod", "paymentMethod", "ReceiveVia",
   "receiveVia", "destination", "destinationAccountCode", "evidenceRef", "EvidenceRef",
   "settlementId", "SettlementID", "cashAccount", "treasuryReceipt", "evidenceType",
   "paymentID", "PaymentID", "supplierId", "cashAccountCode"
  ].forEach(function(field) {
    var payload = t11u3Payload_("purchase-refuse-" + field);
    payload[field] = "X";
    try {
      purchaseSingleCommitNormalize_(payload);
      check("B8_" + field, false, "normalizer accepted " + field);
    } catch (error) {
      check("B8_" + field,
        error.purchaseSingleCommitCode === save.CODES.PAYMENT_FIELD_REFUSED,
        error.message);
    }
  });

  // Unknown (non-allowlist) fields refuse with zero writes.
  var unknownPayload = t11u3Payload_("purchase-unknown-1");
  unknownPayload.costType = "VARIABLE_COST";
  var unknownFixture = t11u3Fixture_();
  var unknownBefore = t11u3Snapshot_(unknownFixture);
  var unknownResult = unknownFixture.run(unknownPayload);
  check("B8z", unknownResult.success === false &&
    unknownResult.error.code === save.CODES.FIELD_REFUSED && unknownResult.writeCount === 0 &&
    unknownFixture.batches.length === 0 && t11u3Snapshot_(unknownFixture) === unknownBefore,
    JSON.stringify(unknownResult));

  // Qty + UOM are REQUIRED business facts for the normal Purchase.
  var noQty = t11u3Payload_("purchase-noqty-1");
  delete noQty.input.PurchaseQty;
  delete noQty.input.PurchaseUOM;
  var noQtyFixture = t11u3Fixture_();
  var noQtyBefore = t11u3Snapshot_(noQtyFixture);
  var noQtyResult = noQtyFixture.run(noQty);
  check("B9", noQtyResult.success === false &&
    noQtyResult.error.code === save.CODES.PAYLOAD_INVALID &&
    noQtyResult.writeCount === 0 && noQtyFixture.batches.length === 0 &&
    t11u3Snapshot_(noQtyFixture) === noQtyBefore, JSON.stringify(noQtyResult));

  // SupplierID (D9): omitted -> valid save; supplied -> validated + preserved.
  check("B10", eventRow.SupplierID === "", "SupplierID absence never refuses");
  var supplierFixture = t11u3Fixture_();
  var supplierPayload = t11u3Payload_("purchase-sup-0001");
  supplierPayload.supplierID = "SUP-001";
  var supplierResult = supplierFixture.run(supplierPayload);
  var supplierRow = t11u3Events_(supplierFixture).filter(function(row) {
    return row.EventID === "PE-purchase-sup-0001";
  })[0];
  check("B11a", supplierResult.success === true && supplierResult.singleCommit.status === "DONE" &&
    supplierRow.SupplierID === "SUP-001", JSON.stringify(supplierRow && supplierRow.SupplierID));
  var badSupplierFixture = t11u3Fixture_();
  var badSupplierBefore = t11u3Snapshot_(badSupplierFixture);
  var badSupplierPayload = t11u3Payload_("purchase-sup-0002");
  badSupplierPayload.supplierID = "SUP-999";
  var badSupplierResult = badSupplierFixture.run(badSupplierPayload);
  check("B11b", badSupplierResult.success === false &&
    badSupplierResult.error.code === save.CODES.SUPPLIER_INVALID &&
    badSupplierResult.writeCount === 0 && badSupplierFixture.batches.length === 0 &&
    t11u3Snapshot_(badSupplierFixture) === badSupplierBefore, JSON.stringify(badSupplierResult));
  var inactiveSupplierFixture = t11u3Fixture_({ suppliers: [
    { SupplierID: "SUP-002", Name: "PT Off", IsActive: false }] });
  var inactiveSupplierBefore = t11u3Snapshot_(inactiveSupplierFixture);
  var inactiveSupplierPayload = t11u3Payload_("purchase-sup-0003");
  inactiveSupplierPayload.supplierID = "SUP-002";
  var inactiveSupplierResult = inactiveSupplierFixture.run(inactiveSupplierPayload);
  check("B11c", inactiveSupplierResult.success === false &&
    inactiveSupplierResult.error.code === save.CODES.SUPPLIER_INVALID &&
    inactiveSupplierResult.writeCount === 0 &&
    t11u3Snapshot_(inactiveSupplierFixture) === inactiveSupplierBefore,
    JSON.stringify(inactiveSupplierResult));

  // Operating classification metadata available for the U4 reader.
  var accounts = readCanonicalTable(f.spreadsheet(), "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  var money1040 = accounts.filter(function(row) { return row.AccountCode === "1040"; })[0];
  var debit6210 = accounts.filter(function(row) { return row.AccountCode === "6210"; })[0];
  check("B12a", own.filter(function(row) { return row.AccountCode === "1040"; }).length === 1 &&
    money1040.CashFlowGroup === "Operating" && money1040.AccountType === "Asset" &&
    money1040.NormalBalance === "DEBIT", JSON.stringify(money1040));
  check("B12b", debit6210.CashFlowGroup === "Operating" &&
    debit6210.AccountType === "Expense" && debit6210.NormalBalance === "DEBIT",
    JSON.stringify(debit6210));
  check("B12c", plan.regime === "PROSPECTIVE_PURCHASE_EXPENSE" &&
    plan.movementType === "PURCHASE_RECOGNITION" && plan.sourceType === "PURCHASE_EVENT" &&
    plan.accounts.money === "1040" && plan.accounts.purchase === "6210" &&
    SINGLE_COMMIT_MONEY_POLICY.ACCOUNT_EXPECTATION.CashFlowGroup === "Operating",
    JSON.stringify({ regime: plan.regime, accounts: plan.accounts }));

  // No AP_PENDING / accountingPending / settlement anywhere on the new path.
  check("B13a", !Object.prototype.hasOwnProperty.call(result, "accountingPending") &&
    f.settlementAttempts === 0 && t11u3Logs_(f).filter(function(row) {
      return ["SETTLEMENT_PENDING", "AP_PENDING"].indexOf(String(row.Action)) !== -1;
    }).length === 0, JSON.stringify(result));
  check("B13b", eventRow.PaymentStatus === "PAID" &&
    own.every(function(row) {
      return ["6210", "1040"].indexOf(String(row.AccountCode)) !== -1;
    }) && ledger.filter(function(row) { return String(row.AccountCode) === "2000"; }).length === 0,
    "no AP/2000 recognition");

  console.log("T11_5_U3_PLAN checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// D. Durability: replay / conflict / UNKNOWN pre + post batch / artifact
// loss / duplicate / tamper
// ---------------------------------------------------------------------------
function testPurchaseSingleCommitDurability() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u3Check_(counter, id, value, detail); }
  var save = PURCHASE_SINGLE_COMMIT_V1;
  var opsHeader = TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS;
  var eventHeaders = PURCHASE_EVENT_POLICY.headers;

  // D1: replay of a COMMITTED intent is zero-write DONE.
  var replay = t11u3Fixture_();
  var replayKey = "purchase-replay-1";
  var first = replay.run(t11u3Payload_(replayKey));
  var afterFirst = t11u3Snapshot_(replay);
  var second = replay.run(t11u3Payload_(replayKey));
  check("D1a", first.success === true && second.success === true &&
    second.singleCommit.replay === true && second.writeCount === 0, JSON.stringify(second));
  check("D1b", t11u3Snapshot_(replay) === afterFirst && replay.batches.length === 1 &&
    t11u3Events_(replay).filter(function(row) {
      return row.EventID === "PE-" + replayKey;
    }).length === 1 && t11u3Ops_(replay).length === 1, "replay writes nothing");

  // D2: same key + different payload -> CONFLICT, zero additional writes.
  var conflict = t11u3Fixture_();
  conflict.run(t11u3Payload_("purchase-conflict-1"));
  var conflictBefore = t11u3Snapshot_(conflict);
  var conflictPayload = t11u3Payload_("purchase-conflict-1");
  conflictPayload.input.AcquisitionValue = "99999";
  var conflictResult = conflict.run(conflictPayload);
  check("D2a", conflictResult.success === false && conflictResult.status === "CONFLICT" &&
    conflictResult.error.code === save.CODES.OPERATION_PAYLOAD_CONFLICT,
    JSON.stringify(conflictResult));
  check("D2b", t11u3Snapshot_(conflict) === conflictBefore && conflict.batches.length === 1,
    "conflict never appends");

  // D3: UNKNOWN before the batch keeps identity and resumes from the stored
  // plan with no duplicate business row.
  var preBatch = t11u3Fixture_();
  preBatch.crashAt = "PURCHASE_BEFORE_BATCH";
  var preBatchResult = preBatch.run(t11u3Payload_("purchase-prebatch-1"));
  check("D3a", preBatchResult.success === false && preBatchResult.unknown === true &&
    preBatchResult.requestKey === "purchase-prebatch-1" && preBatchResult.operationID,
    JSON.stringify(preBatchResult));
  check("D3b", t11u3Ops_(preBatch).length === 1 &&
    t11u3Ops_(preBatch)[0].State === "IN_PROGRESS" &&
    t11u3Events_(preBatch).length === 1 && t11u3Ledger_(preBatch).length === 1,
    "intent only, zero business artifacts");
  preBatch.crashAt = null;
  var preBatchResume = preBatch.run(t11u3Payload_("purchase-prebatch-1"));
  check("D3c", preBatchResume.success === true &&
    t11u3Events_(preBatch).length === 2 && t11u3Ledger_(preBatch).length === 3 &&
    preBatch.batches.length === 1, JSON.stringify(preBatchResume));

  // D4: UNKNOWN after the batch — artifacts exist, state still IN_PROGRESS;
  // the retry finalizes without a second batch.
  var postBatch = t11u3Fixture_();
  postBatch.crashAt = "PURCHASE_AFTER_BATCH";
  var postBatchResult = postBatch.run(t11u3Payload_("purchase-postbatch-1"));
  check("D4a", postBatchResult.success === false && postBatchResult.unknown === true &&
    postBatchResult.requestKey === "purchase-postbatch-1", JSON.stringify(postBatchResult));
  check("D4b", t11u3Events_(postBatch).length === 2 && t11u3Ledger_(postBatch).length === 3 &&
    t11u3Ops_(postBatch)[0].State === "IN_PROGRESS", "artifacts present, intent open");
  postBatch.crashAt = null;
  var postBatchResume = postBatch.run(t11u3Payload_("purchase-postbatch-1"));
  check("D4c", postBatchResume.success === true && postBatch.batches.length === 1 &&
    t11u3Events_(postBatch).length === 2 && t11u3Ledger_(postBatch).length === 3,
    JSON.stringify(postBatchResume));

  // D5: batch transport failure -> UNKNOWN (never a definite failure), then
  // one clean recovery run.
  var down = t11u3Fixture_();
  down.batchFailure = "BATCH_DOWN";
  var downResult = down.run(t11u3Payload_("purchase-batchdown-1"));
  check("D5a", downResult.success === false && downResult.unknown === true &&
    downResult.status === "UNKNOWN" && downResult.requestKey === "purchase-batchdown-1",
    JSON.stringify(downResult));
  down.batchFailure = null;
  var downResume = down.run(t11u3Payload_("purchase-batchdown-1"));
  check("D5b", downResume.success === true && down.batches.length === 1 &&
    t11u3Events_(down).filter(function(row) {
      return row.EventID === "PE-purchase-batchdown-1";
    }).length === 1, JSON.stringify(downResume));

  // D6: missing event artifact after COMMITTED -> incomplete, no repair.
  var lostEvent = t11u3Fixture_();
  var lostEventKey = "purchase-lostevent-1";
  lostEvent.run(t11u3Payload_(lostEventKey));
  var lostIndex = lostEvent.sheets.PurchaseEvents.rows.findIndex(function(row) {
    return String(row[0]) === "PE-" + lostEventKey;
  });
  lostEvent.sheets.PurchaseEvents.rows.splice(lostIndex, 1);
  var lostEventResult = lostEvent.run(t11u3Payload_(lostEventKey));
  check("D6", lostEventResult.success === false &&
    lostEventResult.status === "RECOVERY_REQUIRED" &&
    lostEventResult.error.code === save.CODES.ARTIFACTS_INCOMPLETE,
    JSON.stringify(lostEventResult));

  // D7: missing ledger side -> incomplete.
  var lostLedger = t11u3Fixture_();
  var lostLedgerKey = "purchase-lostledger-1";
  lostLedger.run(t11u3Payload_(lostLedgerKey));
  var ownIndex = -1;
  lostLedger.sheets.BalanceLedger.rows.forEach(function(row, index) {
    if (String(row[8]) === "PE-" + lostLedgerKey) ownIndex = index;
  });
  lostLedger.sheets.BalanceLedger.rows.splice(ownIndex, 1);
  var lostLedgerResult = lostLedger.run(t11u3Payload_(lostLedgerKey));
  check("D7", lostLedgerResult.success === false &&
    lostLedgerResult.status === "RECOVERY_REQUIRED", JSON.stringify(lostLedgerResult));

  // D8: duplicate ledger line -> conflict (never a third append).
  var duplicate = t11u3Fixture_();
  var duplicateKey = "purchase-dup-1";
  duplicate.run(t11u3Payload_(duplicateKey));
  var duplicateOwn = t11u3Ledger_(duplicate).filter(function(row) {
    return row.SourceType === save.SOURCE_TYPE;
  })[0];
  duplicate.sheets.BalanceLedger.rows.push(
    BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.map(function(header) {
      return header === "LineID" ? duplicateOwn.JournalID + "-3" : duplicateOwn[header];
    }));
  var duplicateResult = duplicate.run(t11u3Payload_(duplicateKey));
  check("D8", duplicateResult.success === false &&
    duplicateResult.status === "RECOVERY_REQUIRED" &&
    duplicateResult.error.code === save.CODES.IDENTITY_CONFLICT, JSON.stringify(duplicateResult));

  // D9-D11: stored-plan tampering (digest, amount, account) fails closed with
  // zero additional writes.
  [{ field: "planDigest", value: "TAMPERED", id: "D9" },
   { field: "amount", value: 1, id: "D10" },
   { field: "journalRows[0].AccountCode", value: "1000", id: "D11" }
  ].forEach(function(scenario) {
    var f = t11u3Fixture_();
    var key = "purchase-tamper-" + scenario.id;
    f.run(t11u3Payload_(key));
    var opRow = f.sheets.TransactionOperations.rows[1];
    var plan = JSON.parse(opRow[opsHeader.indexOf("OperationPlan")]);
    if (scenario.field === "journalRows[0].AccountCode") {
      plan.journalRows[0].AccountCode = scenario.value;
    } else {
      plan[scenario.field] = scenario.value;
    }
    opRow[opsHeader.indexOf("OperationPlan")] = JSON.stringify(plan);
    var before = t11u3Snapshot_(f);
    var result = f.run(t11u3Payload_(key));
    check(scenario.id, result.success === false &&
      (result.status === "RECOVERY_REQUIRED" || result.status === "CONFLICT") &&
      t11u3Snapshot_(f) === before && f.batches.length === 1, JSON.stringify(result));
  });

  // D12: persisted event-row tamper (item qty/price) after COMMITTED -> fail
  // closed, no repair, no second batch.
  var rowTamper = t11u3Fixture_();
  var rowTamperKey = "purchase-rowtamper-1";
  rowTamper.run(t11u3Payload_(rowTamperKey));
  var rowIndex = -1;
  rowTamper.sheets.PurchaseEvents.rows.forEach(function(row, index) {
    if (String(row[0]) === "PE-" + rowTamperKey) rowIndex = index;
  });
  rowTamper.sheets.PurchaseEvents.rows[rowIndex][eventHeaders.indexOf("AcquisitionValue")] = "1";
  rowTamper.sheets.PurchaseEvents.rows[rowIndex][eventHeaders.indexOf("PurchaseQty")] = "999";
  var rowTamperBefore = t11u3Snapshot_(rowTamper);
  var rowTamperResult = rowTamper.run(t11u3Payload_(rowTamperKey));
  check("D12", rowTamperResult.success === false &&
    rowTamperResult.status === "RECOVERY_REQUIRED" &&
    t11u3Snapshot_(rowTamper) === rowTamperBefore && rowTamper.batches.length === 1,
    JSON.stringify(rowTamperResult));

  // D13: a foreign PurchaseEvent bound to this identity without an operation
  // row is a conflict, never a second append.
  var foreign = t11u3Fixture_();
  var foreignKey = "purchase-foreign-1";
  var foreignRow = t11u3EventRow_(foreignKey);
  foreign.sheets.PurchaseEvents.rows.push(foreign.sheets.PurchaseEvents.rows[0].map(
    function(header) { return foreignRow[header] === undefined ? "" : foreignRow[header]; }));
  var foreignBefore = t11u3Snapshot_(foreign);
  var foreignResult = foreign.run(t11u3Payload_(foreignKey));
  check("D13", foreignResult.success === false && foreignResult.status === "CONFLICT" &&
    foreignResult.error.code === save.CODES.IDENTITY_CONFLICT &&
    foreignResult.writeCount === 0 && foreign.batches.length === 0 &&
    t11u3Ops_(foreign).length === 0 && t11u3Snapshot_(foreign) === foreignBefore,
    JSON.stringify(foreignResult));

  console.log("T11_5_U3_DURABILITY checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}

// ---------------------------------------------------------------------------
// E. Isolation: historical rows, history round-trip, Treasury/AP/Inventory,
// Policy C preservation, correction lineage, zero production mutation
// ---------------------------------------------------------------------------
function testPurchaseSingleCommitIsolation() {
  var counter = { pass: 0 };
  function check(id, value, detail) { t11u3Check_(counter, id, value, detail); }
  var save = PURCHASE_SINGLE_COMMIT_V1;
  var key = "purchase-iso-1";
  var eventID = "PE-" + key;

  var f = t11u3Fixture_();
  var historicalBefore = JSON.stringify({
    event: f.sheets.PurchaseEvents.rows[1],
    ledger: f.sheets.BalanceLedger.rows[1],
    log: f.sheets.Logs.rows[1],
    tabops: f.sheets.tabops.rows[1],
    accounts: f.sheets.Accounts.rows,
    headers: [f.sheets.PurchaseEvents.rows[0], f.sheets.BalanceLedger.rows[0],
      f.sheets.Logs.rows[0], f.sheets.tabops.rows[0]]
  });
  var result = f.run(t11u3Payload_(key));
  var historicalAfter = JSON.stringify({
    event: f.sheets.PurchaseEvents.rows[1],
    ledger: f.sheets.BalanceLedger.rows[1],
    log: f.sheets.Logs.rows[1],
    tabops: f.sheets.tabops.rows[1],
    accounts: f.sheets.Accounts.rows,
    headers: [f.sheets.PurchaseEvents.rows[0], f.sheets.BalanceLedger.rows[0],
      f.sheets.Logs.rows[0], f.sheets.tabops.rows[0]]
  });
  check("I1a", result.success === true && historicalBefore === historicalAfter,
    "historical PurchaseEvent/ledger/Logs/tabops/Accounts evidence byte-identical");
  check("I1b", JSON.stringify(f.sheets.PurchaseEvents.rows[0]) ===
    JSON.stringify(PURCHASE_EVENT_POLICY.headers.slice()) &&
    JSON.stringify(f.sheets.BalanceLedger.rows[0]) ===
      JSON.stringify(BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.slice()),
    "no header/schema change");

  // I2: the whole store (historical + new row) still round-trips through the
  // transaction-history read path byte-exactly (T11.2 §13).
  var history = null;
  try {
    history = purchaseEventHistory_(t11u3Events_(f));
  } catch (error) {
    history = null;
  }
  check("I2", history !== null && Object.keys(history).length === 2 &&
    history[key] !== undefined && history["purchase-hist-0001"] !== undefined,
    history === null ? "PURCHASE_HISTORY_CONFLICT" : JSON.stringify(Object.keys(history)));

  // No legacy channel, AP, or inventory account is ever written by this
  // operation; the ordinary Expense surface stays untouched.
  var ledger = t11u3Ledger_(f);
  var own = ledger.filter(function(row) { return row.SourceType === save.SOURCE_TYPE; });
  check("I3a", own.length === 2 && own.every(function(row) {
    return ["6210", "1040"].indexOf(String(row.AccountCode)) !== -1;
  }), JSON.stringify(own.map(function(row) { return row.AccountCode; })));
  check("I3b", ledger.slice(2).filter(function(row) {
    return ["1000", "1010", "1020", "2000", "1100", "5000"].indexOf(
      String(row.AccountCode)) !== -1;
  }).length === 0 && f.sheets.tabops.rows.length === 2,
    "no legacy/AP/inventory postings, no tabops write");

  // No AP_PENDING / accountingPending / settlement on success.
  check("I4a", !Object.prototype.hasOwnProperty.call(result, "accountingPending") &&
    result.status === "OPERATIONAL_POSTED" && result.accountingStatus === "POSTED",
    JSON.stringify(result));
  check("I4b", f.settlementAttempts === 0 && t11u3Logs_(f).filter(function(row) {
    return ["SETTLEMENT_PENDING", "AP_PENDING"].indexOf(String(row.Action)) !== -1;
  }).length === 0, "no settlement/AP audit row");
  check("I4c", t11u3Events_(f).every(function(row) { return row.PaymentStatus !== "UNPAID"; }) &&
    f.sheets.Logs.rows.every(function(row) {
      return String(row[0]).indexOf("AP-") !== 0;
    }), "no UNPAID/AP identity");

  // Treasury isolation: exact frozen surfaces; the writer core carries no
  // Treasury/evidence/settlement concept at all.
  var writerTokens = ["purchaseSingleCommitPlan_", "purchaseSingleCommitValueRanges_",
    "purchaseSingleCommitInspect_", "purchaseSingleCommitApplyBatch_"];
  var normalizerTokens = ["purchaseSingleCommitNormalize_", "purchaseSingleCommitNewIntent_",
    "purchaseSingleCommitSaveWithRuntime_"];
  var writerSource = writerTokens.map(function(name) {
    check("I5_exists_" + name, typeof globalThis[name] === "function", name);
    return typeof globalThis[name] === "function" ? globalThis[name].toString() : "";
  }).join("\n");
  var normalizerSource = normalizerTokens.map(function(name) {
    return typeof globalThis[name] === "function" ? globalThis[name].toString() : "";
  }).join("\n");
  check("I5a", JSON.stringify(save.WRITE_SURFACES) ===
    JSON.stringify(["PurchaseEvents", "BalanceLedger", "Logs"]),
    JSON.stringify(save.WRITE_SURFACES));
  ["TreasuryReceipt", "TreasuryOperations", "MANUAL_VERIFIED", "EvidenceRef",
   "SettlementID", "Settlements"].forEach(function(token, index) {
    check("I5b_" + index, writerSource.indexOf(token) === -1 &&
      normalizerSource.indexOf(token) === -1, token);
  });
  check("I5c", !f.sheets.TreasuryReceipts && !f.sheets.Settlements,
    "no Treasury/Settlements surface exists in the fixture");
  var storedPlan = JSON.parse(t11u3Ops_(f)[0].OperationPlan);
  check("I5d", storedPlan.journalRows.every(function(row) {
    return row.ExternalRef === "" && row.Keterangan === "" &&
      Object.keys(row).every(function(header) {
        return BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.indexOf(header) !== -1;
      });
  }), JSON.stringify(Object.keys(storedPlan.journalRows[0])));

  // Inventory/HPP isolation: cost capture only — no receipt plan, no Inventory
  // surface, no inventory/COGS account.
  check("I6a", storedPlan.eventRow.ReceiptPlan === "null" &&
    !f.sheets.InventoryReceipts && !f.sheets.InventoryLedger,
    "no Inventory surface, receipt plan stays null");
  check("I6b", storedPlan.eventRow.AllocationStatus === "QUANTITY_PACKAGE_UNRESOLVED" &&
    own.every(function(row) {
      return ["6210", "1040"].indexOf(String(row.AccountCode)) !== -1;
    }), "no Dr5000/Cr1100/COGS recognition");

  // Policy C preservation: the exact prospective Policy C shape (§8/D8) with
  // the credit side frozen to 1040, signature identical to the builder.
  check("I7a", own[0].JournalID.indexOf("POLICYC-PEXP-PURCHASE-") === 0 &&
    own[0].AccountCode === "6210" && own[1].AccountCode === "1040",
    JSON.stringify(own.map(function(row) { return row.JournalID + ":" + row.AccountCode; })));
  var eventRow = t11u3Events_(f).filter(function(row) { return row.EventID === eventID; })[0];
  var candidate = buildPolicyCPurchaseJournal(eventRow, []);
  check("I7b", candidate.status === "READY" &&
    policyCJournalSignature_(candidate.rows) === policyCJournalSignature_(own),
    JSON.stringify({ status: candidate.status, journalId: candidate.journalId }));

  // Correction lineage readiness (U6): every identity is deterministic from
  // the business ID alone; append-only originals with stable movement type.
  check("I8a", eventRow.EventID === eventID && eventRow.RecoveryKey === "pe-receipt-" + key &&
    own[0].JournalID === "POLICYC-PEXP-PURCHASE-" + eventID &&
    own[0].SourceID === eventID && own[1].SourceID === eventID &&
    own[0].LineID === own[0].JournalID + "-1" &&
    t11u3Ops_(f)[0].BusinessID === eventID && t11u3Logs_(f)[1].RecordID === eventID,
    "identities recomputable from PE-<requestKey>");
  check("I8b", own.every(function(row) {
    return row.MovementType === "PURCHASE_RECOGNITION" &&
      row.SourceType === "PURCHASE_EVENT";
  }) && result.data.id.indexOf("PE-") === 0 && result.data.canonicalTransactionType === "PurchaseEvent",
    JSON.stringify(own.map(function(row) { return row.MovementType; })));

  // No production/config mutation is reachable from the core, and the core
  // never acquires a lock (the dispatcher owns the single outer lock).
  var dispatcherSource = submitCanonicalTransactionWithRuntime_.toString();
  ["setProperty(", "requireNumlockProductionSpreadsheet(", "clasp ",
   "SpreadsheetApp.getActiveSpreadsheet"].forEach(function(token, index) {
    check("I9_" + index, normalizerSource.indexOf(token) === -1 &&
      writerSource.indexOf(token) === -1, token);
  });
  check("I9z", dispatcherSource.indexOf("lock.waitLock(30000)") !== -1 &&
    normalizerSource.indexOf("waitLock") === -1 && writerSource.indexOf("waitLock") === -1,
    "core never acquires a lock");

  // Reporting identity for the U4 reader: one Operating money line with a
  // deterministic source identity.
  check("I10a", own.filter(function(row) { return row.AccountCode === "1040"; }).length === 1 &&
    own.every(function(row) {
      return row.SourceType === "PURCHASE_EVENT" && row.SourceID === eventID &&
        row.MovementType === "PURCHASE_RECOGNITION";
    }), JSON.stringify(own));
  var money1040 = readCanonicalTable(f.spreadsheet(), "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS).filter(function(row) {
      return row.AccountCode === "1040";
    })[0];
  check("I10b", money1040.CashFlowGroup === "Operating" &&
    SINGLE_COMMIT_MONEY_POLICY.ACCOUNT_CODE === "1040" && money1040.IsActive === true,
    JSON.stringify(money1040));

  console.log("T11_5_U3_ISOLATION checks=" + counter.pass);
  return { status: "PASS", checks: counter.pass };
}
