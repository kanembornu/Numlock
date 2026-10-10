// Treasury T9 production preparation tests (T9A-T9T + source/package audit)
// for prepareTreasuryReceiptV1Production / treasuryProductionPreparationApplyWithRuntime_
// in 100.Code.js. In-memory fixture spreadsheets, an in-memory Script
// Properties map, and the repo `.claspignore` file only: no production access,
// no network, no clasp, no writes outside fixture memory.

function treasuryT9Check_(id, value, detail) {
  if (!value) throw new Error("TREASURY_T9:" + id + (detail === undefined ? "" : "|" + detail));
}

// Fixture spreadsheet with create-if-absent semantics (insertSheet + header
// write), mirroring the production runtime adapter without touching any real
// workbook.
function treasuryT9Fixture_(initial) {
  var sheets = Object.create(null);
  var order = [];
  function makeSheet(name, values) {
    var rows = (values || []).map(function(row) { return row.slice(); });
    return {
      getName: function() { return name; },
      getLastRow: function() { return rows.length; },
      getLastColumn: function() { return rows.length ? rows[0].length : 0; },
      getDataRange: function() {
        return { getValues: function() { return rows.map(function(row) { return row.slice(); }); } };
      },
      getRange: function(row, col, height, width) {
        return {
          getValues: function() {
            return rows.slice(row - 1, row - 1 + height).map(function(r) {
              return r.slice(col - 1, col - 1 + width);
            });
          },
          setValues: function(input) {
            input.forEach(function(r, i) {
              while (rows.length < row + i) rows.push([]);
              for (var j = 0; j < width; j++) rows[row - 1 + i][col - 1 + j] = r[j];
            });
            return this;
          }
        };
      },
      values: rows
    };
  }
  Object.keys(initial || {}).forEach(function(name) {
    sheets[name] = makeSheet(name, initial[name]);
    order.push(name);
  });
  return {
    getSheetByName: function(name) { return sheets[name] || null; },
    fixtureSheet: function(name) { return sheets[name] || null; },
    insertSheet: function(name) {
      if (sheets[name]) throw new Error("Sheet already exists: " + name);
      sheets[name] = makeSheet(name, []);
      order.push(name);
      return sheets[name];
    },
    sheetNames: function() { return order.slice(); }
  };
}

function treasuryT9Properties_(initial) {
  var store = Object.assign({}, initial || {});
  var properties = {
    setCalls: [],
    getProperty: function(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setProperty: function(key, value) {
      properties.setCalls.push({ key: key, value: String(value) });
      store[key] = String(value);
      return properties;
    },
    store: store
  };
  return properties;
}

function treasuryT9PreparedConfig_() {
  return {
    contractVersion: TREASURY_RECEIPT_V1_CONTRACT.CONTRACT_VERSION,
    mode: "PREPARED",
    activationID: "",
    activatedAt: "",
    configVersion: 1
  };
}

function treasuryT9Sheets_(options) {
  options = options || {};
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  var sheets = {
    Accounts: treasuryT4Accounts_(),
    BalanceLedger: (options.ledger || [BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.slice()])
  };
  if (options.receipts !== false) {
    sheets.TreasuryReceipts = [contract.SCHEMAS.RECEIPTS.HEADERS.slice()];
  }
  if (options.operations !== false) {
    sheets.TreasuryOperations = [contract.SCHEMAS.OPERATIONS.HEADERS.slice()];
  }
  if (options.audits !== false) {
    sheets.TreasuryAudits = [contract.SCHEMAS.AUDITS.HEADERS.slice()];
  }
  return sheets;
}

function treasuryT9Runtime_(options) {
  options = options || {};
  var fixture = options.fixture || treasuryT9Fixture_(options.sheets || treasuryT9Sheets_());
  var properties = options.properties || treasuryT9Properties_(options.config ? {
    TREASURY_RECEIPT_V1_CONFIG: JSON.stringify(options.config)
  } : {});
  var runtime = {
    spreadsheet: fixture,
    properties: properties,
    createFailFor: options.createFailFor || null,
    created: [],
    createSheet: function(name, headers) {
      if (runtime.createFailFor === name) throw new Error("SIMULATED_CREATE_FAILURE");
      var sheet = fixture.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      runtime.created.push(name);
      return sheet;
    }
  };
  return runtime;
}

function treasuryT9Prep_(runtime) {
  return treasuryProductionPreparationApplyWithRuntime_(runtime);
}

function treasuryT9RawConfig_(runtime) {
  return runtime.properties.getProperty(TREASURY_RECEIPT_V1_CONTRACT.CONFIG_PROPERTY);
}

// T9A: all three Treasury sheets absent -> created with exact T3 headers, zero
// business rows, PREPARED config written once, structured PREPARED result.
function testTreasuryT9PreparationCore() {
  var runtime = treasuryT9Runtime_({ sheets: treasuryT9Sheets_({ receipts: false,
    operations: false, audits: false }) });
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9A1", result.status === "PREPARED", result.status);
  treasuryT9Check_("T9A2", result.writes.sheets === 3 && result.writes.config === 1,
    JSON.stringify(result.writes));
  treasuryT9Check_("T9A3", result.createdSheets.join(",") ===
    "TreasuryReceipts,TreasuryOperations,TreasuryAudits", result.createdSheets.join(","));
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  [["RECEIPTS", "TreasuryReceipts", 24], ["OPERATIONS", "TreasuryOperations", 10],
   ["AUDITS", "TreasuryAudits", 11]].forEach(function(entry) {
    var sheet = runtime.spreadsheet.getSheetByName(entry[1]);
    treasuryT9Check_("T9A4-" + entry[1], sheet.getLastRow() === 1 &&
      sheet.getLastColumn() === entry[2], String(sheet.getLastRow()) + "x" +
      String(sheet.getLastColumn()));
    treasuryT9Check_("T9A5-" + entry[1], JSON.stringify(sheet.values[0]) ===
      JSON.stringify(contract.SCHEMAS[entry[0]].HEADERS.slice()), "header drift");
    treasuryT9Check_("T9A6-" + entry[1], result.schemas[entry[0]].headersExact === true &&
      result.businessRows[entry[1]] === 0, JSON.stringify(result.schemas[entry[0]]));
  });
  var config = JSON.parse(treasuryT9RawConfig_(runtime));
  treasuryT9Check_("T9A7", config.mode === "PREPARED" &&
    config.contractVersion === contract.CONTRACT_VERSION &&
    config.activationID === "" && config.activatedAt === "" &&
    config.configVersion === 1, JSON.stringify(config));
  treasuryT9Check_("T9A8", runtime.properties.setCalls.length === 1 &&
    runtime.properties.setCalls[0].key === contract.CONFIG_PROPERTY,
    JSON.stringify(runtime.properties.setCalls));
  treasuryT9Check_("T9A9", result.readiness && result.readiness.clearing === "PASS" &&
    result.readiness.destinations.length === 3 &&
    result.readiness.destinations.every(function(d) { return d.eligible === true; }),
    JSON.stringify(result.readiness));
}

// T9B: one sheet already exact -> only the absent ones are created; the
// existing sheet is never rewritten (byte-identical header row).
function testTreasuryT9PreparationPartial() {
  var sheets = treasuryT9Sheets_({ operations: false, audits: false });
  var fixture = treasuryT9Fixture_(sheets);
  var before = JSON.stringify(fixture.getSheetByName("TreasuryReceipts").values);
  var runtime = treasuryT9Runtime_({ fixture: fixture });
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9B1", result.status === "PREPARED", result.status);
  treasuryT9Check_("T9B2", result.writes.sheets === 2 && result.createdSheets.join(",") ===
    "TreasuryOperations,TreasuryAudits", JSON.stringify(result.createdSheets));
  treasuryT9Check_("T9B3", JSON.stringify(fixture.getSheetByName("TreasuryReceipts").values) ===
    before, "existing sheet rewritten");
}

// T9C: all sheets exact, config absent -> config-only write, still PREPARED.
function testTreasuryT9PreparationConfigOnly() {
  var runtime = treasuryT9Runtime_({});
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9C1", result.status === "PREPARED", result.status);
  treasuryT9Check_("T9C2", result.writes.sheets === 0 && result.writes.config === 1,
    JSON.stringify(result.writes));
  treasuryT9Check_("T9C3", result.createdSheets.length === 0, "unexpected creation");
}

// T9D-T9F: an existing sheet with a wrong header is a hard STOP (never
// overwritten, config never written).
function testTreasuryT9PreparationSchemaConflict() {
  [["RECEIPTS", "TreasuryReceipts"], ["OPERATIONS", "TreasuryOperations"],
   ["AUDITS", "TreasuryAudits"]].forEach(function(entry) {
    var sheets = treasuryT9Sheets_();
    var fixture = treasuryT9Fixture_(sheets);
    fixture.getSheetByName(entry[1]).values[0][0] = entry[1] + "IDRenamed";
    var runtime = treasuryT9Runtime_({ fixture: fixture });
    var before = JSON.stringify(fixture.getSheetByName(entry[1]).values);
    var result = treasuryT9Prep_(runtime);
    treasuryT9Check_("T9D1-" + entry[1], result.status === "STOP_SCHEMA_CONFLICT",
      result.status);
    treasuryT9Check_("T9D2-" + entry[1], result.detail === entry[1], result.detail);
    treasuryT9Check_("T9D3-" + entry[1], result.writes.sheets === 0 &&
      result.writes.config === 0, JSON.stringify(result.writes));
    treasuryT9Check_("T9D4-" + entry[1],
      JSON.stringify(fixture.getSheetByName(entry[1]).values) === before,
      "malformed sheet overwritten");
    treasuryT9Check_("T9D5-" + entry[1], treasuryT9RawConfig_(runtime) === null,
      "config written despite conflict");
  });
}

// T9G: a correct PREPARED state re-runs as NOOP_ALREADY_PREPARED with zero
// mutations (idempotency, second-run guarantee).
function testTreasuryT9PreparationIdempotent() {
  var runtime = treasuryT9Runtime_({ sheets: treasuryT9Sheets_({ receipts: false,
    operations: false, audits: false }) });
  var first = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9G1", first.status === "PREPARED", first.status);
  var after = { sheets: JSON.stringify(["TreasuryReceipts", "TreasuryOperations",
    "TreasuryAudits"].map(function(name) {
      return runtime.spreadsheet.getSheetByName(name).values;
    })), config: treasuryT9RawConfig_(runtime) };
  var setCalls = runtime.properties.setCalls.length;
  var created = runtime.created.length;
  var second = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9G2", second.status === "NOOP_ALREADY_PREPARED", second.status);
  treasuryT9Check_("T9G3", second.writes.sheets === 0 && second.writes.config === 0,
    JSON.stringify(second.writes));
  treasuryT9Check_("T9G4", runtime.properties.setCalls.length === setCalls &&
    runtime.created.length === created, "second run mutated state");
  treasuryT9Check_("T9G5", treasuryT9RawConfig_(runtime) === after.config &&
    JSON.stringify(["TreasuryReceipts", "TreasuryOperations", "TreasuryAudits"]
      .map(function(name) { return runtime.spreadsheet.getSheetByName(name).values; })) ===
    after.sheets, "state drifted on second run");
}

// T9H: a present-but-malformed config fails closed (never repaired, never
// defaulted, sheets untouched).
function testTreasuryT9PreparationMalformedConfig() {
  var runtime = treasuryT9Runtime_({
    sheets: treasuryT9Sheets_({}),
    properties: treasuryT9Properties_({ TREASURY_RECEIPT_V1_CONFIG: "{not json" })
  });
  var before = JSON.stringify(runtime.spreadsheet.getSheetByName("TreasuryReceipts").values);
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9H1", result.status === "STOP_CONFIG_MALFORMED", result.status);
  treasuryT9Check_("T9H2", result.writes.sheets === 0 && result.writes.config === 0,
    JSON.stringify(result.writes));
  treasuryT9Check_("T9H3", JSON.stringify(runtime.spreadsheet
    .getSheetByName("TreasuryReceipts").values) === before, "sheet mutated");
  treasuryT9Check_("T9H4", treasuryT9RawConfig_(runtime) === "{not json",
    "config repaired/overwritten");
}

// T9I/T9J: an existing non-PREPARED mode is never touched (no downgrade, no
// activation, no schema work).
function testTreasuryT9PreparationUnexpectedMode() {
  ["ACTIVE", "PAUSED"].forEach(function(mode) {
    var config = treasuryT9PreparedConfig_();
    config.mode = mode;
    config.activationID = "TRACT-" + mode;
    config.activatedAt = "2026-10-01T00:00:00.000Z";
    var runtime = treasuryT9Runtime_({
      sheets: treasuryT9Sheets_({ receipts: false }),
      properties: treasuryT9Properties_({ TREASURY_RECEIPT_V1_CONFIG: JSON.stringify(config) })
    });
    var raw = treasuryT9RawConfig_(runtime);
    var result = treasuryT9Prep_(runtime);
    treasuryT9Check_("T9I1-" + mode, result.status === "STOP_UNEXPECTED_MODE", result.status);
    treasuryT9Check_("T9I2-" + mode, result.detail === "EXISTING_MODE_" + mode, result.detail);
    treasuryT9Check_("T9I3-" + mode, result.writes.sheets === 0 && result.writes.config === 0,
      JSON.stringify(result.writes));
    treasuryT9Check_("T9I4-" + mode, treasuryT9RawConfig_(runtime) === raw &&
      runtime.spreadsheet.getSheetByName("TreasuryReceipts") === null,
      "unexpected mode mutated state");
  });
}

// T9K: destination-account authority failure stops before any write.
function testTreasuryT9PreparationAccountReadiness() {
  var sheets = treasuryT9Sheets_({ receipts: false, operations: false, audits: false });
  var accountSheet = sheets.Accounts;
  var headers = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  var idx = headers.indexOf("IsActive");
  accountSheet.forEach(function(row, index) {
    if (index > 0 && String(row[0]) === "1010") row[idx] = false;
  });
  var runtime = treasuryT9Runtime_({ sheets: sheets });
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9K1", result.status === "STOP_ACCOUNT_READINESS", result.status);
  treasuryT9Check_("T9K2", result.detail.indexOf("DESTINATIONS:1010") !== -1, result.detail);
  treasuryT9Check_("T9K3", result.writes.sheets === 0 && result.writes.config === 0 &&
    runtime.created.length === 0 && treasuryT9RawConfig_(runtime) === null,
    "write issued without account authority");
}

// T9L: the 1030 CashFlowGroup hard gate stops before any write.
function testTreasuryT9PreparationCashFlowGroupGate() {
  var sheets = treasuryT9Sheets_({ receipts: false, operations: false, audits: false });
  var headers = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  var idx = headers.indexOf("CashFlowGroup");
  sheets.Accounts.forEach(function(row, index) {
    if (index > 0 && String(row[0]) === "1030") row[idx] = "";
  });
  var runtime = treasuryT9Runtime_({ sheets: sheets });
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9L1", result.status === "STOP_ACCOUNT_READINESS", result.status);
  treasuryT9Check_("T9L2", result.detail.indexOf("CLEARING:FAIL") !== -1, result.detail);
  treasuryT9Check_("T9L3", result.writes.sheets === 0 && result.writes.config === 0 &&
    treasuryT9RawConfig_(runtime) === null, "write issued without 1030 authority");
}

// T9M: a create failure stops before the config write (fail closed).
function testTreasuryT9PreparationCreateFailure() {
  var runtime = treasuryT9Runtime_({ sheets: treasuryT9Sheets_({ receipts: false,
    operations: false, audits: false }), createFailFor: "TreasuryOperations" });
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9M1", result.status === "STOP_SHEET_CREATE_FAILED", result.status);
  treasuryT9Check_("T9M2", result.detail.indexOf("TreasuryOperations") === 0, result.detail);
  treasuryT9Check_("T9M3", treasuryT9RawConfig_(runtime) === null &&
    runtime.spreadsheet.getSheetByName("TreasuryAudits") === null,
    "config written after create failure");
}

// T9N: preparation never writes a business row and never touches the ledger or
// Accounts (byte-identical before/after).
function testTreasuryT9PreparationZeroBusinessRows() {
  var ledgerRow = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.map(function(header) {
    var values = { LineID: "BL-KEEP-1", JournalID: "JRNL-KEEP-1", Tanggal: "2026-10-01",
      AccountCode: "1000", Debit: 1000, Credit: 0, MovementType: "OPENING",
      SourceType: "LEGACY", SourceID: "LEGACY-1", Description: "", IsActive: true };
    return values[header] === undefined ? "" : values[header];
  });
  var sheets = treasuryT9Sheets_({ receipts: false, operations: false, audits: false,
    ledger: [BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.slice(), ledgerRow] });
  var fixture = treasuryT9Fixture_(sheets);
  var before = { ledger: JSON.stringify(fixture.getSheetByName("BalanceLedger").values),
    accounts: JSON.stringify(fixture.getSheetByName("Accounts").values) };
  var runtime = treasuryT9Runtime_({ fixture: fixture });
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9N1", result.status === "PREPARED", result.status);
  treasuryT9Check_("T9N2", JSON.stringify(fixture.getSheetByName("BalanceLedger").values) ===
    before.ledger, "BalanceLedger mutated");
  treasuryT9Check_("T9N3", JSON.stringify(fixture.getSheetByName("Accounts").values) ===
    before.accounts, "Accounts mutated");
  treasuryT9Check_("T9N4", ["TreasuryReceipts", "TreasuryOperations", "TreasuryAudits"]
    .every(function(name) {
      return fixture.getSheetByName(name).getLastRow() === 1;
    }), "business row written");
  treasuryT9Check_("T9N5", fixture.sheetNames().join(",") ===
    "Accounts,BalanceLedger,TreasuryReceipts,TreasuryOperations,TreasuryAudits",
    fixture.sheetNames().join(","));
}

// T9O: the written config read back through the NORMAL T3 reader classifies
// PREPARED (not malformed) and the mode gate refuses every future write.
function testTreasuryT9PreparationConfigClassification() {
  var runtime = treasuryT9Runtime_({});
  var result = treasuryT9Prep_(runtime);
  treasuryT9Check_("T9O1", result.status === "PREPARED", result.status);
  var state = treasuryReceiptConfigFromRaw(treasuryT9RawConfig_(runtime));
  treasuryT9Check_("T9O2", state.status === "PASS" && state.config.mode === "PREPARED",
    JSON.stringify(state));
  treasuryT9Check_("T9O3", validateTreasuryReceiptConfig(state.config).status === "PASS",
    "validator refuses the prepared config");
  var gate = treasuryReceiptModeGate(state.config);
  treasuryT9Check_("T9O4", gate.allowed === false && gate.mode === "PREPARED" &&
    gate.code === "TREASURY_NOT_ACTIVATED", JSON.stringify(gate));
  treasuryT9Check_("T9O5", JSON.stringify(state.config) === JSON.stringify(result.config),
    "result config differs from reader state");
}

// T9P: under the prepared config the REAL T4/T6 mutation cores refuse with
// TREASURY_NOT_ACTIVATED (zero writes) — source+local proof of the PREPARED
// refusal, before any production Save/Reverse/Correct probe.
function testTreasuryT9PreparationPreparedRefusal() {
  var prepared = treasuryT9PreparedConfig_();
  var fixture = treasuryT4SeededFixture_();
  var ledgerBefore = JSON.stringify(fixture.getSheetByName("BalanceLedger").values);
  var save = treasuryReceiptSaveWithRuntime_(treasuryT4Payload_("t9-refusal-save"),
    treasuryT4Runtime_({ fixture: fixture, config: prepared }));
  treasuryT9Check_("T9P1", save.status === "REFUSED" &&
    save.code === TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES.NOT_ACTIVATED, JSON.stringify(save));
  var reverse = treasuryLifecycleReverseWithRuntime_(
    treasuryT6ReversePayload_("t9-refusal-reverse", "TRC-ABSENT"),
    treasuryT6Runtime_({ fixture: fixture, config: prepared }));
  treasuryT9Check_("T9P2", reverse.status === "REFUSED" &&
    reverse.code === TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES.NOT_ACTIVATED, JSON.stringify(reverse));
  var correct = treasuryLifecycleCorrectWithRuntime_(
    treasuryT6CorrectPayload_("t9-refusal-correct", "TRC-ABSENT"),
    treasuryT6Runtime_({ fixture: fixture, config: prepared }));
  treasuryT9Check_("T9P3", correct.status === "REFUSED" &&
    correct.code === TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES.NOT_ACTIVATED, JSON.stringify(correct));
  treasuryT9Check_("T9P4",
    JSON.stringify(fixture.getSheetByName("BalanceLedger").values) === ledgerBefore,
    "refusal mutated the ledger");
  treasuryT9Check_("T9P5", fixture.getSheetByName("TreasuryReceipts").getLastRow() === 1 &&
    fixture.getSheetByName("TreasuryOperations").getLastRow() === 1 &&
    fixture.getSheetByName("TreasuryAudits").getLastRow() === 1, "refusal wrote an artifact");
}

// T9Q: upload-manifest registration is exact — the eight T3-T7 Treasury
// runtime files only, no tests/docs/tmp/harness/manifest, 76-file closure.
// Pure on the allowlist text so the sensitivity proof can feed tampered input
// without ever mutating a tracked file.
function treasuryT9PackageCheck_(allowlistText, t8ManifestText) {
  var fsFileReader = globalThis.fs;
  if (!fsFileReader) throw new Error("TREASURY_T9:FS_UNAVAILABLE");
  var allowlist = String(allowlistText).split(/\r?\n/)
    .map(function(line) { return line.trim(); })
    .filter(function(line) { return line.indexOf("!") === 0; })
    .map(function(line) { return line.slice(1); })
    .filter(function(path) { return path !== ""; });
  var pending = ["99.Treasury.Receipt.Foundation.js",
    "99A.Treasury.Receipt.Durable.Save.js", "99B.Treasury.Clearing.Projection.js",
    "99C.Treasury.Receipt.Reversal.Correction.js", "99D.Treasury.Operator.Api.js",
    "202.View.Treasury.State.html", "203.View.Treasury.Render.html",
    "204.View.Treasury.Controller.html"];
  treasuryT9Check_("T9Q1", allowlist.length === 76, String(allowlist.length));
  pending.forEach(function(file) {
    treasuryT9Check_("T9Q2-" + file, allowlist.indexOf(file) !== -1, "not registered");
    treasuryT9Check_("T9Q3-" + file, fsFileReader.existsSync(file), "registered file missing");
  });
  var forbidden = /(^(tests|docs|scripts)\/)|(_test_runner\.js$)|(\.clasp\.json$)|(\.env)|(credential)|(clasprc)|(t8-package-manifest)/i;
  allowlist.forEach(function(path) {
    treasuryT9Check_("T9Q4-" + path, !forbidden.test(path), path);
  });
  treasuryT9Check_("T9Q5", allowlist.filter(function(path) {
    return /^96\.Tests\.|^92\.Tests\.|^94\.Tests\.|^95\.Tests\./.test(path);
  }).length === 0, "test file allowlisted");
  var t8 = JSON.parse(String(t8ManifestText));
  treasuryT9Check_("T9Q6", t8.prospective.count === 76, String(t8.prospective.count));
  pending.forEach(function(file) {
    treasuryT9Check_("T9Q7-" + file, t8.prospective.files.some(function(entry) {
      return entry.path === file;
    }), "missing from the T8 prospective manifest");
  });
  return { count: allowlist.length, treasury: pending };
}

function testTreasuryT9PackageRegistration() {
  var fsFileReader = globalThis.fs;
  if (!fsFileReader) throw new Error("TREASURY_T9:FS_UNAVAILABLE");
  treasuryT9PackageCheck_(fsFileReader.readFileSync(".claspignore", "utf8"),
    fsFileReader.readFileSync("tests/tmp/t8-package-manifest.json", "utf8"));
}

// T9R: preparation source/UI audit, pure on the supplied text so the
// sensitivity proof can feed tampered source without mutating tracked files.
function treasuryT9SourceAuditCheck_(blockText, uiText, runtimeJsTexts) {
  var block = String(blockText);
  // Code-only view: full-line comments are documentation, not executable
  // surface; the mutation proof injects real code, so it never hides here.
  var codeOnly = block.split("\n").filter(function(line) {
    return line.trim().indexOf("//") !== 0;
  }).join("\n");
  treasuryT9Check_("T9R1", block.indexOf("var TREASURY_PRODUCTION_PREPARATION") !== -1,
    "preparation block missing");
  treasuryT9Check_("T9R2", block.split("setProperty(").length - 1 === 1,
    "unexpected setProperty count");
  treasuryT9Check_("T9R3", block.indexOf("TREASURY_RECEIPT_V1_CONFIG") === -1 &&
    block.indexOf("CONFIG_PROPERTY") !== -1, "config key not resolved from the contract");
  treasuryT9Check_("T9R4", !/mode: ?"ACTIVE"|mode = ?"ACTIVE"/.test(block),
    "ACTIVE-mode literal in the preparation block");
  treasuryT9Check_("T9R5", !/UrlFetchApp|inventoryReceiptMigrationRequest_|batchUpdate/.test(codeOnly),
    "transport/write primitive in the preparation block");
  treasuryT9Check_("T9R6", codeOnly.indexOf("NUMLOCK_PRODUCTION_STORAGE_POLICY") === -1 &&
    codeOnly.indexOf("1ubfWtRV") === -1, "hardcoded production spreadsheet identity");
  treasuryT9Check_("T9R7", codeOnly.indexOf("BalanceLedger") === -1 &&
    codeOnly.indexOf("appendRow") === -1, "financial write surface referenced");
  treasuryT9Check_("T9R8", (runtimeJsTexts || []).every(function(text) {
    return !/\.setProperty\(/.test(String(text));
  }), "Treasury runtime mutates config properties");
  treasuryT9Check_("T9R9", !/PropertiesService|SpreadsheetApp|LockService|UrlFetchApp/
    .test(String((runtimeJsTexts || [])[4] || "")),
    "99D gained a write/transport primitive");
  treasuryT9Check_("T9R11", !/\.setProperty\(/.test(String(uiText)) &&
    !/prepareTreasuryReceiptV1Production/.test(String(uiText)),
    "Treasury UI gained a preparation/mutation surface");
  return true;
}

function testTreasuryT9PreparationSourceAudit() {
  var fsFileReader = globalThis.fs;
  if (!fsFileReader) throw new Error("TREASURY_T9:FS_UNAVAILABLE");
  var source = fsFileReader.readFileSync("100.Code.js", "utf8");
  var start = source.indexOf("var TREASURY_PRODUCTION_PREPARATION");
  var block = start === -1 ? "" : source.slice(start);
  var runtimeJs = ["99.Treasury.Receipt.Foundation.js",
    "99A.Treasury.Receipt.Durable.Save.js", "99B.Treasury.Clearing.Projection.js",
    "99C.Treasury.Receipt.Reversal.Correction.js", "99D.Treasury.Operator.Api.js"]
    .map(function(path) { return fsFileReader.readFileSync(path, "utf8"); });
  var ui = ["202.View.Treasury.State.html", "203.View.Treasury.Render.html",
    "204.View.Treasury.Controller.html"].map(function(path) {
      return fsFileReader.readFileSync(path, "utf8");
    }).join("\n");
  treasuryT9SourceAuditCheck_(block, ui, runtimeJs);
  treasuryT9Check_("T9R10", typeof prepareTreasuryReceiptV1Production === "function" &&
    prepareTreasuryReceiptV1Production.length === 0,
    "public preparation entry missing or not zero-parameter");
}

// T9S: deployment-process invariant — the upload-manifest gate (`clasp status`)
// is observed BEFORE the single push, which is observed BEFORE the single
// version/deployment creation. Pure on the supplied step order so the
// sensitivity proof can feed a reordered plan.
var TREASURY_T9_DEPLOYMENT_STEPS = Object.freeze([
  "local_validation", "package_manifest_recalc", "clasp_status_gate",
  "clasp_push", "version_and_deployment", "production_preparation_invoke",
  "production_readback"
]);

function treasuryT9DeploymentOrderCheck_(steps) {
  var order = (steps || []).map(String);
  function pos(name) { return order.indexOf(name); }
  treasuryT9Check_("T9S1", order.length === TREASURY_T9_DEPLOYMENT_STEPS.length,
    String(order.length));
  treasuryT9Check_("T9S2", pos("clasp_status_gate") !== -1 &&
    pos("clasp_status_gate") < pos("clasp_push"), "status gate must precede the push");
  treasuryT9Check_("T9S3", pos("clasp_push") < pos("version_and_deployment"),
    "push must precede version/deployment");
  treasuryT9Check_("T9S4", pos("version_and_deployment") <
    pos("production_preparation_invoke"),
    "the deployed preparation entry is invoked only after the push");
  treasuryT9Check_("T9S5", pos("production_preparation_invoke") <
    pos("production_readback"), "preparation precedes readback");
  return true;
}

function testTreasuryT9DeploymentOrder() {
  treasuryT9DeploymentOrderCheck_(TREASURY_T9_DEPLOYMENT_STEPS);
}

