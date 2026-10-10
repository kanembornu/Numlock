// Treasury T10.5 production activation tests (A1-A16 + call-graph/writer
// source audit) for activateTreasuryReceiptV1Production /
// treasuryActivationApplyWithRuntime_ in 100.Code.js. In-memory fixture
// spreadsheets, an in-memory Script Properties map, and the repo source text
// only: no production access, no network, no clasp, no writes outside fixture
// memory.

var TREASURY_T105_NOW = "2026-10-11T12:00:00.000Z";
var TREASURY_T105_UUID = "7f3c1d20-4a5e-4b7a-9c11-0e5d2f8a6b41";
var TREASURY_T105_ACTIVATION_ID = "TRACT-" + TREASURY_T105_UUID;

// Protected production surfaces mirrored by the fixture comparison (T10 set).
var TREASURY_T105_SURFACES = Object.freeze(["BalanceLedger", "Accounts",
  "SalesRecognitionEvents", "SalesRecognitionAudits", "TransactionOperations",
  "Orders", "OrderLines", "Payments", "Settlements", "InventoryLedger",
  "TreasuryReceipts", "TreasuryOperations", "TreasuryAudits", "tabsal",
  "tabops", "Logs", "Settings", "Products", "ProductPricing"]);

function treasuryT105Check_(id, value, detail) {
  if (!value) {
    throw new Error("TREASURY_T105:" + id + (detail === undefined ? "" : "|" + detail));
  }
}

function treasuryT105Prepared_() {
  return { contractVersion: TREASURY_RECEIPT_V1_CONTRACT.CONTRACT_VERSION,
    mode: "PREPARED", activationID: "", activatedAt: "", configVersion: 1 };
}

function treasuryT105Activate_(runtime) {
  return treasuryActivationApplyWithRuntime_(runtime);
}

function treasuryT105RawConfig_(runtime) {
  return runtime.properties.getProperty(TREASURY_RECEIPT_V1_CONTRACT.CONFIG_PROPERTY);
}

// Activation runtime over the finance fixture: one committed 24,000 V2
// recognition (UNCLEARED exposure, LedgerNet1030 24,000, residual 0), exact
// Treasury schemas with zero business rows, eligible destinations, ready 1030.
function treasuryT105Runtime_(options) {
  options = options || {};
  var runtime = treasuryT9Runtime_({
    fixture: options.fixture || treasuryT5FinanceFixture_(),
    config: options.config === undefined ? treasuryT105Prepared_() : options.config,
    properties: options.properties
  });
  runtime.now = options.now || function() { return new Date(TREASURY_T105_NOW); };
  runtime.uuid = options.uuid || function() { return TREASURY_T105_UUID; };
  return runtime;
}

function treasuryT105SurfaceSnapshot_(fixture) {
  var snapshot = {};
  TREASURY_T105_SURFACES.forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    snapshot[name] = sheet ? JSON.stringify(sheet.values) : null;
  });
  return snapshot;
}

function treasuryT105SheetCount_(fixture, name) {
  var sheet = fixture.getSheetByName(name);
  if (!sheet) return -1;
  var rows = sheet.values || [];
  return rows.length > 1 ? rows.length - 1 : 0;
}

// AMBIGUOUS RESPONSE contract (task contract): never re-invoke blindly. Re-read
// the config; a valid ACTIVE with a durable identity is accepted as recovered
// with zero further writes; only an unchanged PREPARED state retries.
function treasuryT105Recover_(runtime) {
  var state = treasuryReceiptConfigFromRaw(treasuryT105RawConfig_(runtime));
  if (state.status === "PASS" && state.config && state.config.mode === "ACTIVE") {
    return { recovered: true, reinvoked: false,
      config: treasuryActivationConfigFields_(state.config) };
  }
  return { recovered: false, reinvoked: true, result: treasuryT105Activate_(runtime) };
}

// A1: PREPARED -> ACTIVATED. One config write, zero sheet writes, exact five-
// field ACTIVE config that passes the frozen T3 validator.
function testTreasuryT105ActivationPreparedToActive() {
  var runtime = treasuryT105Runtime_({});
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A1", result.status === "ACTIVATED", JSON.stringify(result));
  treasuryT105Check_("A1b", result.writes.config === 1 && result.writes.sheets === 0,
    JSON.stringify(result.writes));
  treasuryT105Check_("A1c", runtime.properties.setCalls.length === 1,
    JSON.stringify(runtime.properties.setCalls.map(function(c) { return c.key; })));
  treasuryT105Check_("A1d", validateTreasuryReceiptConfig(result.config).status === "PASS",
    JSON.stringify(result.config));
  treasuryT105Check_("A1e", result.config.mode === "ACTIVE" &&
    result.config.contractVersion === TREASURY_RECEIPT_V1_CONTRACT.CONTRACT_VERSION,
    JSON.stringify(result.config));
}

// A2: a valid ACTIVE is idempotent — the stored identity is returned untouched
// and no second ActivationID/activatedAt/config write is ever produced.
function testTreasuryT105ActivationIdempotent() {
  var runtime = treasuryT105Runtime_({});
  var first = treasuryT105Activate_(runtime);
  treasuryT105Check_("A2", first.status === "ACTIVATED", JSON.stringify(first));
  var second = treasuryT105Activate_(runtime);
  treasuryT105Check_("A2b", second.status === "NOOP_ALREADY_ACTIVE", second.status);
  treasuryT105Check_("A2c", second.config.activationID === first.config.activationID &&
    second.config.activatedAt === first.config.activatedAt &&
    second.config.configVersion === first.config.configVersion,
    JSON.stringify({ first: first.config, second: second.config }));
  treasuryT105Check_("A2d", second.writes.config === 0 &&
    runtime.properties.setCalls.length === 1, JSON.stringify(second.writes));
}

// A3: absent config fails closed with zero writes (activation never defaults).
function testTreasuryT105ActivationAbsentConfig() {
  var runtime = treasuryT105Runtime_({ config: null });
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A3", result.status === "STOP_CONFIG_ABSENT" &&
    result.detail === "CONFIG_ABSENT", JSON.stringify(result));
  treasuryT105Check_("A3b", result.writes.config === 0 &&
    runtime.properties.setCalls.length === 0, JSON.stringify(result.writes));
}

// A4: present-but-malformed config fails closed, is never repaired, never
// interpreted as PREPARED or ACTIVE.
function testTreasuryT105ActivationMalformedConfig() {
  var runtime = treasuryT105Runtime_({});
  runtime.properties.store[TREASURY_RECEIPT_V1_CONTRACT.CONFIG_PROPERTY] = "{not json";
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A4", result.status === "STOP_CONFIG_MALFORMED" &&
    result.detail === "EXISTING_CONFIG_INVALID", JSON.stringify(result));
  treasuryT105Check_("A4b", runtime.properties.setCalls.length === 0,
    JSON.stringify(runtime.properties.setCalls));
}

// A5: PAUSED is refused — no unauthorized first transition out of PAUSED.
function testTreasuryT105ActivationPausedRefused() {
  var runtime = treasuryT105Runtime_({ config: {
    contractVersion: TREASURY_RECEIPT_V1_CONTRACT.CONTRACT_VERSION, mode: "PAUSED",
    activationID: "TRACT-PAUSED-0001", activatedAt: "2026-10-10T00:00:00.000Z",
    configVersion: 1 } });
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A5", result.status === "STOP_UNEXPECTED_MODE" &&
    result.detail === "EXISTING_MODE_PAUSED", JSON.stringify(result));
  treasuryT105Check_("A5b", result.writes.config === 0 &&
    runtime.properties.setCalls.length === 0, JSON.stringify(result.writes));
}

// A6: surface gates — a schema conflict and a non-zero business-row state both
// refuse activation with zero writes (receipts are Gate B only).
function testTreasuryT105ActivationSurfaceGates() {
  var badSchema = treasuryT105Runtime_({});
  badSchema.spreadsheet.getSheetByName("TreasuryOperations").values[0][0] = "WrongHeader";
  var schemaResult = treasuryT105Activate_(badSchema);
  treasuryT105Check_("A6", schemaResult.status === "STOP_SCHEMA_CONFLICT" &&
    schemaResult.detail.indexOf("TreasuryOperations") === 0,
    JSON.stringify(schemaResult));
  treasuryT105Check_("A6b", schemaResult.writes.config === 0 &&
    badSchema.properties.setCalls.length === 0, JSON.stringify(schemaResult.writes));

  var busy = treasuryT105Runtime_({});
  var row = new Array(TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS.RECEIPTS.HEADERS.length).fill("");
  row[0] = "TRC-UNEXPECTED";
  busy.spreadsheet.getSheetByName("TreasuryReceipts").values.push(row);
  var rowResult = treasuryT105Activate_(busy);
  treasuryT105Check_("A6c", rowResult.status === "STOP_BUSINESS_ROWS" &&
    rowResult.detail === "TreasuryReceipts(1)", JSON.stringify(rowResult));
  treasuryT105Check_("A6d", busy.properties.setCalls.length === 0,
    JSON.stringify(busy.properties.setCalls));
}

// A7: destination authority — an absent destination account refuses.
function testTreasuryT105ActivationAccountGate() {
  var runtime = treasuryT105Runtime_({});
  var accounts = runtime.spreadsheet.getSheetByName("Accounts");
  var codeIndex = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.indexOf("AccountCode");
  accounts.values.forEach(function(row, index) {
    if (String(row[codeIndex]) === "1010") accounts.values.splice(index, 1);
  });
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A7", result.status === "STOP_ACCOUNT_READINESS" &&
    result.detail.indexOf("DESTINATIONS:1010") !== -1, JSON.stringify(result));
  treasuryT105Check_("A7b", runtime.properties.setCalls.length === 0,
    JSON.stringify(runtime.properties.setCalls));
}

// A8: 1030 readiness — a blank CashFlowGroup fails closed (T2 section 21/28).
function testTreasuryT105ActivationClearingGate() {
  var runtime = treasuryT105Runtime_({});
  var accounts = runtime.spreadsheet.getSheetByName("Accounts");
  var headers = CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS;
  var codeIndex = headers.indexOf("AccountCode"), groupIndex = headers.indexOf("CashFlowGroup");
  accounts.values.forEach(function(row) {
    if (String(row[codeIndex]) === "1030") row[groupIndex] = "";
  });
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A8", result.status === "STOP_ACCOUNT_READINESS" &&
    result.detail.indexOf("CLEARING:FAIL") !== -1, JSON.stringify(result));
  treasuryT105Check_("A8b", runtime.properties.setCalls.length === 0,
    JSON.stringify(runtime.properties.setCalls));
}

// A9: reconciliation gate — an identity-less 1030 movement lands in the
// unexplained residual, so activation refuses with zero writes.
function testTreasuryT105ActivationResidualGate() {
  var runtime = treasuryT105Runtime_({});
  u3AppendLedger_(runtime.spreadsheet, [{ JournalID: "J-T105-STRAY",
    LineID: "J-T105-STRAY-1", Tanggal: "2026-10-10", AccountCode: "1030",
    Debit: 500, Credit: 0, MovementType: "", SourceType: "", SourceID: "" }]);
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A9", result.status === "STOP_RECONCILIATION", JSON.stringify(result));
  treasuryT105Check_("A9b", result.reconciliation &&
    result.reconciliation.unexplainedResidual === 500,
    JSON.stringify(result.reconciliation));
  treasuryT105Check_("A9c", runtime.properties.setCalls.length === 0,
    JSON.stringify(runtime.properties.setCalls));
}

// A10: a non-zero OUTSTANDING 1030 balance with residual 0 is allowed —
// activation never requires LedgerNet1030 = 0 and never clears money.
function testTreasuryT105ActivationOutstandingAllowed() {
  var runtime = treasuryT105Runtime_({});
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A10", result.status === "ACTIVATED", JSON.stringify(result));
  treasuryT105Check_("A10b", result.reconciliation.ledgerNet1030 === 24000 &&
    result.reconciliation.outstandingTotal === 24000 &&
    result.reconciliation.unexplainedResidual === 0,
    JSON.stringify(result.reconciliation));
  treasuryT105Check_("A10c", result.exposure.recognizedExposure === 24000 &&
    result.exposure.unclearedCount === 1, JSON.stringify(result.exposure));
}

// A11: exactly one write — the single config property — and every protected
// surface (19 sheets) is byte-identical before/after.
function testTreasuryT105ActivationConfigOnlyWrite() {
  var fixture = treasuryT5FinanceFixture_();
  var runtime = treasuryT105Runtime_({ fixture: fixture });
  var before = treasuryT105SurfaceSnapshot_(fixture);
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A11", result.status === "ACTIVATED", JSON.stringify(result));
  treasuryT105Check_("A11b", runtime.properties.setCalls.length === 1 &&
    runtime.properties.setCalls[0].key === TREASURY_RECEIPT_V1_CONTRACT.CONFIG_PROPERTY,
    JSON.stringify(runtime.properties.setCalls.map(function(c) { return c.key; })));
  var after = treasuryT105SurfaceSnapshot_(fixture);
  TREASURY_T105_SURFACES.forEach(function(name) {
    treasuryT105Check_("A11c-" + name, before[name] === after[name], name);
  });
}

// A12: Treasury business rows stay 0/0/0 (header-only) after activation.
function testTreasuryT105ActivationBusinessRowsUnchanged() {
  var fixture = treasuryT5FinanceFixture_();
  var runtime = treasuryT105Runtime_({ fixture: fixture });
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A12", result.status === "ACTIVATED", JSON.stringify(result));
  treasuryT105Check_("A12b", treasuryT105SheetCount_(fixture, "TreasuryReceipts") === 0 &&
    treasuryT105SheetCount_(fixture, "TreasuryOperations") === 0 &&
    treasuryT105SheetCount_(fixture, "TreasuryAudits") === 0, "Treasury rows changed");
  treasuryT105Check_("A12c", result.businessRows.TreasuryReceipts === 0 &&
    result.businessRows.TreasuryOperations === 0 &&
    result.businessRows.TreasuryAudits === 0, JSON.stringify(result.businessRows));
}

// A13: BalanceLedger is byte-identical — no 1030 clearing, no Cash/Bank line.
function testTreasuryT105ActivationLedgerUnchanged() {
  var fixture = treasuryT5FinanceFixture_();
  var runtime = treasuryT105Runtime_({ fixture: fixture });
  var before = JSON.stringify(fixture.getSheetByName("BalanceLedger").values);
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A13", result.status === "ACTIVATED", JSON.stringify(result));
  treasuryT105Check_("A13b",
    JSON.stringify(fixture.getSheetByName("BalanceLedger").values) === before,
    "BalanceLedger mutated");
}

// A14: Sales recognition authority is unchanged — no Sales V2 event/audit row.
function testTreasuryT105ActivationSalesUnchanged() {
  var fixture = treasuryT5FinanceFixture_();
  var runtime = treasuryT105Runtime_({ fixture: fixture });
  var eventsBefore = JSON.stringify(fixture.getSheetByName("SalesRecognitionEvents").values);
  var auditsBefore = JSON.stringify(fixture.getSheetByName("SalesRecognitionAudits").values);
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A14", result.status === "ACTIVATED", JSON.stringify(result));
  treasuryT105Check_("A14b",
    JSON.stringify(fixture.getSheetByName("SalesRecognitionEvents").values) === eventsBefore &&
    JSON.stringify(fixture.getSheetByName("SalesRecognitionAudits").values) === auditsBefore,
    "Sales authority mutated");
}

// A15: identity readback is exact — stored value, reported value and validator
// agree on all five fields; a readback that disagrees is never reported as
// ACTIVATED; configVersion follows the existing frozen scheme (no bump).
function testTreasuryT105ActivationIdentityReadback() {
  var runtime = treasuryT105Runtime_({});
  var result = treasuryT105Activate_(runtime);
  treasuryT105Check_("A15", result.status === "ACTIVATED", JSON.stringify(result));
  var stored = JSON.parse(String(treasuryT105RawConfig_(runtime)));
  treasuryT105Check_("A15b", JSON.stringify(stored) === JSON.stringify(result.config),
    JSON.stringify({ stored: stored, reported: result.config }));
  treasuryT105Check_("A15c", stored.activationID === TREASURY_T105_ACTIVATION_ID,
    stored.activationID);
  treasuryT105Check_("A15d", stored.activationID.indexOf("TRACT-") === 0 &&
    stored.activationID.length > "TRACT-".length, stored.activationID);
  treasuryT105Check_("A15e", stored.activatedAt === TREASURY_T105_NOW &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(stored.activatedAt),
    stored.activatedAt);
  treasuryT105Check_("A15f", stored.configVersion === 1 &&
    typeof stored.configVersion === "number", String(stored.configVersion));
  treasuryT105Check_("A15g", stored.mode === "ACTIVE" &&
    validateTreasuryReceiptConfig(stored).status === "PASS", JSON.stringify(stored));

  // A readback that disagrees with what was written must never be classified
  // ACTIVE: the config reads PREPARED first, then returns a tampered value.
  var liarRuntime = treasuryT105Runtime_({});
  var realProperties = liarRuntime.properties;
  var writtenRaw = null;
  liarRuntime.properties = {
    setCalls: realProperties.setCalls,
    getProperty: function(key) {
      if (writtenRaw !== null) {
        return JSON.stringify(Object.assign({}, JSON.parse(writtenRaw),
          { activationID: "TRACT-LIAR" }));
      }
      return realProperties.getProperty(key);
    },
    setProperty: function(key, value) {
      writtenRaw = String(value);
      realProperties.setProperty(key, value);
      return this;
    }
  };
  var mismatch = treasuryT105Activate_(liarRuntime);
  treasuryT105Check_("A15h", mismatch.status === "STOP_CONFIG_READBACK_MISMATCH" &&
    mismatch.detail === "READBACK_FIELD_MISMATCH", JSON.stringify(mismatch));
  treasuryT105Check_("A15i", mismatch.config === null, JSON.stringify(mismatch.config));
}

// A16: ambiguous response recovery — after an uncertain outcome the config is
// re-read first; a valid ACTIVE with a durable identity is accepted as
// recovered with zero additional writes and never a second identity.
function testTreasuryT105ActivationAmbiguousRecovery() {
  var runtime = treasuryT105Runtime_({});
  var first = treasuryT105Activate_(runtime);
  treasuryT105Check_("A16", first.status === "ACTIVATED", JSON.stringify(first));
  // Response "lost": the caller applies the recovery protocol, not a blind
  // second activation attempt.
  var recovered = treasuryT105Recover_(runtime);
  treasuryT105Check_("A16b", recovered.recovered === true &&
    recovered.reinvoked === false, JSON.stringify(recovered));
  treasuryT105Check_("A16c",
    recovered.config.activationID === first.config.activationID &&
    recovered.config.activatedAt === first.config.activatedAt &&
    recovered.config.configVersion === first.config.configVersion,
    JSON.stringify({ first: first.config, recovered: recovered.config }));
  treasuryT105Check_("A16d", runtime.properties.setCalls.length === 1,
    JSON.stringify(runtime.properties.setCalls));

  // Still-PREPARED state: the retry is safe and runs exactly one activation.
  var fresh = treasuryT105Runtime_({});
  var retry = treasuryT105Recover_(fresh);
  treasuryT105Check_("A16e", retry.reinvoked === true &&
    retry.result.status === "ACTIVATED", JSON.stringify(retry));
  treasuryT105Check_("A16f", fresh.properties.setCalls.length === 1,
    JSON.stringify(fresh.properties.setCalls));
}

// ---------------------------------------------------------------------------
// Call-graph / writer audit. Pure on the supplied source text so the mutation
// proof can feed tampered text without mutating a tracked file.
// ---------------------------------------------------------------------------

// Frozen denylist: surfaces the activation entry must never be able to reach.
var TREASURY_T105_FORBIDDEN_CALLS = Object.freeze([
  "treasuryReceiptSaveWithRuntime_", "treasuryReceiptDurableSave",
  "treasuryReceiptApplyBatch_", "treasuryReceiptCommit_",
  "treasuryLifecycleReverseWithRuntime_", "treasuryLifecycleCorrectWithRuntime_",
  "salesRecognitionV2SaveWithRuntime_", "salesRecognitionV2ActivateWithRuntime_",
  "prepareTreasuryReceiptV1Production", "appendRow", "setValues", "insertSheet",
  "clearContents", "deleteRange", "batchUpdate", "UrlFetchApp", "fetch",
  "inventoryReceiptMigrationRequest_", "runApplyRecipeStandardCost"
]);

function treasuryT105ActivationRegions_(codeText) {
  var code = String(codeText);
  var actStart = code.indexOf("var TREASURY_PRODUCTION_ACTIVATION");
  var runtimeStart = code.indexOf("function treasuryActivationRuntime_");
  var entryStart = code.indexOf("function activateTreasuryReceiptV1Production");
  var prepStart = code.indexOf("var TREASURY_PRODUCTION_PREPARATION");
  return { ok: actStart !== -1 && runtimeStart > actStart && entryStart > runtimeStart &&
      prepStart > entryStart,
    actStart: actStart, runtimeStart: runtimeStart, entryStart: entryStart,
    prepStart: prepStart,
    core: actStart === -1 ? "" : code.slice(actStart, runtimeStart),
    runtime: actStart === -1 ? "" : code.slice(runtimeStart, entryStart),
    entry: actStart === -1 ? "" : code.slice(entryStart, prepStart),
    prep: prepStart === -1 ? "" : code.slice(prepStart) };
}

function treasuryT105CodeOnly_(text) {
  return String(text).split("\n").filter(function(line) {
    return line.trim().indexOf("//") !== 0;
  }).join("\n");
}

function treasuryT105SourceAuditCheck_(codeText, uiText) {
  var regions = treasuryT105ActivationRegions_(codeText);
  treasuryT105Check_("A17", regions.ok, "activation regions missing or misordered");
  var core = treasuryT105CodeOnly_(regions.core);
  var runtimeText = treasuryT105CodeOnly_(regions.runtime);
  var entry = treasuryT105CodeOnly_(regions.entry);
  var prep = treasuryT105CodeOnly_(regions.prep);
  var activationBlock = core + "\n" + runtimeText + "\n" + entry;

  // ScriptLock: the entry owns the ONE outer lock, acquired before the core
  // (and therefore before every config read/classification) and released once.
  treasuryT105Check_("A18", entry.indexOf("LockService.getScriptLock()") !== -1 &&
    entry.indexOf("waitLock(30000)") !== -1 && entry.indexOf("releaseLock") !== -1,
    "entry does not own the ScriptLock");
  treasuryT105Check_("A18b",
    entry.indexOf("waitLock(30000)") !== -1 &&
    entry.indexOf("waitLock(30000)") < entry.indexOf("treasuryActivationApplyWithRuntime_(runtime)"),
    "core called before the lock is acquired");
  // PREPARED-in-lock: the entry performs no config read/write at all, so the
  // classification cannot happen outside the lock (no check-then-write).
  treasuryT105Check_("A19",
    entry.indexOf("getProperty(") === -1 && entry.indexOf("setProperty(") === -1 &&
    entry.indexOf("CONFIG_PROPERTY") === -1 &&
    entry.indexOf("treasuryPreparationInspect_") === -1 &&
    entry.indexOf("treasuryReceiptConfigFromRaw") === -1,
    "entry reads or writes the config outside the lock");
  treasuryT105Check_("A19b", core.indexOf("treasuryPreparationInspect_") !== -1 &&
    core.indexOf("contract.MODES[0]") !== -1,
    "core does not classify the config itself");
  treasuryT105Check_("A19c", entry.indexOf("function activateTreasuryReceiptV1Production()") !== -1,
    "activation entry must take no parameters");

  // Exactly ONE config write across the activation block, on the contract key.
  treasuryT105Check_("A20", core.split("setProperty(").length - 1 === 1,
    String(core.split("setProperty(").length - 1));
  treasuryT105Check_("A20b", runtimeText.indexOf("setProperty(") === -1 &&
    entry.indexOf("setProperty(") === -1, "config write outside the core");
  treasuryT105Check_("A20c", core.indexOf("CONFIG_PROPERTY") !== -1 &&
    core.indexOf("\"TREASURY_RECEIPT_V1_CONFIG\"") === -1,
    "config key not resolved from the contract");

  // No financial writer, ledger writer, sheet writer or transport is reachable.
  var called = (activationBlock.match(/[A-Za-z_$][\w$.]*\s*\(/g) || []).map(function(token) {
    return token.replace(/\s*\($/, "");
  });
  called.forEach(function(name) {
    TREASURY_T105_FORBIDDEN_CALLS.forEach(function(forbidden) {
      treasuryT105Check_("A21-" + forbidden,
        name.indexOf(forbidden) === -1, "forbidden call reachable: " + name);
    });
  });
  treasuryT105Check_("A21x",
    activationBlock.indexOf("BalanceLedger") === -1 &&
    activationBlock.indexOf("appendRow") === -1 &&
    activationBlock.indexOf("setValues") === -1,
    "financial write surface referenced");
  treasuryT105Check_("A21y", !/UrlFetchApp|batchUpdate|SpreadsheetApp/.test(activationBlock),
    "transport/write primitive in the activation block");
  treasuryT105Check_("A21z", !/\.setProperty\(/.test(runtimeText + entry),
    "property write outside the activation core");

  // Frozen gates present, forbidden shortcuts absent.
  treasuryT105Check_("A22", core.indexOf("unexplainedResidual") !== -1 &&
    core.indexOf("reconciliationStatus") !== -1, "reconciliation gate missing");
  treasuryT105Check_("A22b", !/ledgerNet1030\s*(!==|===|<|>)\s*0\b/.test(core),
    "activation must not require LedgerNet1030 = 0");
  treasuryT105Check_("A22c", core.indexOf("treasuryClearingPreflight") !== -1 &&
    core.indexOf("treasuryDestinationEligible") !== -1 &&
    core.indexOf("validateTreasurySchemaHeaders") === -1,
    "account/clearing validation shape changed");
  treasuryT105Check_("A22d", core.indexOf("businessRows !== 0") !== -1,
    "zero business-row gate missing");
  treasuryT105Check_("A22e", core.indexOf("runtime.now()") !== -1 &&
    !/activatedAt: ?"/.test(core) && !/activationID: ?"/.test(core),
    "identity must be server-generated, never a literal/client value");
  treasuryT105Check_("A22f", core.indexOf("nextConfigVersion = current.configVersion") !== -1 &&
    !/configVersion\s*\+\s*1/.test(core),
    "configVersion must follow the existing frozen scheme (no bump)");
  treasuryT105Check_("A22g", !/mode: ?"ACTIVE"|mode = ?"ACTIVE"/.test(activationBlock),
    "hardcoded ACTIVE-mode literal outside the frozen contract enum");
  treasuryT105Check_("A22h",
    core.indexOf("activated.mode") !== -1 &&
    core.indexOf("READBACK_FIELD_MISMATCH") !== -1,
    "exact identity readback missing");

  // The preparation entry is not overloaded: activation is never bundled into
  // it, and the preparation block keeps its single PREPARED-only write.
  treasuryT105Check_("A23", prep.indexOf("treasuryActivationApplyWithRuntime_") === -1 &&
    prep.indexOf("activateTreasuryReceiptV1Production") === -1,
    "activation bundled into the preparation path");
  treasuryT105Check_("A23b", prep.split("setProperty(").length - 1 === 1,
    String(prep.split("setProperty(").length - 1));
  treasuryT105Check_("A23c", !/mode: ?"ACTIVE"|mode = ?"ACTIVE"/.test(prep),
    "preparation block gained an ACTIVE-mode write");

  // Treasury UI stays byte-clean: no activation or mutation surface.
  treasuryT105Check_("A24", !/\.setProperty\(/.test(String(uiText)) &&
    String(uiText).indexOf("activateTreasuryReceiptV1Production") === -1,
    "Treasury UI gained an activation/mutation surface");
  return true;
}

function testTreasuryT105ActivationSourceAudit() {
  var fsFileReader = globalThis.fs;
  if (!fsFileReader) throw new Error("TREASURY_T105:FS_UNAVAILABLE");
  var source = fsFileReader.readFileSync("100.Code.js", "utf8");
  var ui = ["202.View.Treasury.State.html", "203.View.Treasury.Render.html",
    "204.View.Treasury.Controller.html"].map(function(path) {
      return fsFileReader.readFileSync(path, "utf8");
    }).join("\n");
  treasuryT105SourceAuditCheck_(source, ui);
  treasuryT105Check_("A16g", typeof activateTreasuryReceiptV1Production === "function" &&
    activateTreasuryReceiptV1Production.length === 0,
    "public activation entry missing or not zero-parameter");
  treasuryT105Check_("A25", typeof treasuryActivationApplyWithRuntime_ === "function" &&
    typeof treasuryActivationResult_ === "function",
    "activation core missing");
}
