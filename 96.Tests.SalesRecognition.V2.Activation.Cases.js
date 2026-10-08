// SALES_RECOGNITION_V2 U10 activation tests (A1-A12 + source audit). Fixture-
// only: injected PropertiesService mock + injected runtime; no production
// access, no network, no clasp. Client cannot supply T/ActivationID. Exactly
// one logical property write on happy path; zero business-sheet mutation.

function salesV2ActivationProperties_(initialRaw) {
  var store = { value: initialRaw === undefined ? null : initialRaw };
  var writes = [];
  return {
    store: store,
    writes: writes,
    getProperty: function(key) {
      if (key !== SALES_V2_OPERATOR.CONFIG_PROPERTY) return null;
      return store.value;
    },
    setProperty: function(key, value) {
      writes.push({ key: key, value: value });
      store.value = value;
      return value;
    }
  };
}

function salesV2ActivationUuidFactory_(prefix) {
  var n = 0;
  return function() { n += 1; return (prefix || "SRV2ACT-TEST-") + n; };
}

function salesV2ActivationRuntime_(options) {
  options = options || {};
  var fixture = options.fixture || salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var uuidSeq = options.uuidSeq || 0;
  return {
    spreadsheet: fixture,
    properties: options.properties || salesV2ActivationProperties_(options.rawProperty),
    now: options.now || function() { return new Date("2026-10-09T03:04:05.678Z"); },
    uuid: options.uuid || salesV2ActivationUuidFactory_(options.uuidPrefix),
    fixture: fixture
  };
}

function salesV2ActivationSheetCounts_(fixture) {
  var names = ["Orders", "OrderLines", "TransactionOperations", "SalesRecognitionEvents",
    "SalesRecognitionAudits", "BalanceLedger", "Payments", "Settlements", "InventoryLedger"];
  var out = {};
  names.forEach(function(name) {
    var sheet = fixture.getSheetByName(name);
    out[name] = sheet ? sheet.getLastRow() : -1;
  });
  return out;
}

function salesV2ActivationPreparedRaw_() {
  return JSON.stringify(salesRecognitionV2DefaultConfig());
}

function testSalesRecognitionV2ActivationCore() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_ACTIVATION:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var act = SALES_V2_ACTIVATION, contract = SALES_RECOGNITION_V2_CONTRACT,
    save = SALES_RECOGNITION_V2_SAVE;

  // A1 happy path PREPARED -> ACTIVE + one ID + one T + exactly one write.
  var runtime = salesV2ActivationRuntime_();
  var before = salesV2ActivationSheetCounts_(runtime.fixture);
  var res1 = salesRecognitionV2ActivateWithRuntime_(runtime);
  check("A1a", res1.status === act.STATUS.ACTIVATED && res1.code === "",
    JSON.stringify(res1));
  check("A1b", res1.config && res1.config.mode === act.ACTIVE_MODE &&
    res1.config.contractVersion === contract.CONTRACT_VERSION &&
    res1.config.activationID === "SRV2ACT-TEST-1" &&
    res1.config.activatedAt === "2026-10-09T03:04:05.678Z" &&
    res1.config.configVersion === 1, JSON.stringify(res1.config));
  check("A1c", runtime.properties.writes.length === 1 &&
    runtime.properties.writes[0].key === SALES_V2_OPERATOR.CONFIG_PROPERTY);
  var stored = JSON.parse(runtime.properties.store.value);
  check("A1d", stored.mode === act.ACTIVE_MODE && stored.activationID === "SRV2ACT-TEST-1" &&
    stored.activatedAt === "2026-10-09T03:04:05.678Z");

  // A2 atomic readback: returned config equals persisted config field-for-field.
  check("A2a", res1.config.mode === stored.mode &&
    res1.config.contractVersion === stored.contractVersion &&
    res1.config.activationID === stored.activationID &&
    res1.config.activatedAt === stored.activatedAt &&
    res1.config.configVersion === stored.configVersion);
  check("A2b", validateSalesRecognitionV2Config(stored).status === "PASS");

  // A3 reinvocation after exact activation -> ALREADY_ACTIVE, no new ID/T/write.
  var res3 = salesRecognitionV2ActivateWithRuntime_(runtime);
  check("A3a", res3.status === act.STATUS.ALREADY_ACTIVE &&
    res3.config.activationID === stored.activationID &&
    res3.config.activatedAt === stored.activatedAt, JSON.stringify(res3));
  check("A3b", runtime.properties.writes.length === 1 &&
    runtime.properties.store.value === JSON.stringify(stored));

  // A12 activation changes config only (business sheets untouched).
  var after = salesV2ActivationSheetCounts_(runtime.fixture);
  check("A12", JSON.stringify(before) === JSON.stringify(after),
    JSON.stringify([before, after]));

  // A11 client cannot choose T/ActivationID: extra args and runtime-attached
  // client fields are ignored; identity comes only from uuid/now factories.
  var a11Runtime = salesV2ActivationRuntime_();
  a11Runtime.activationID = "CLIENT-CHOSEN-ID";
  a11Runtime.activatedAt = "2020-01-01T00:00:00.000Z";
  var res11 = salesRecognitionV2ActivateWithRuntime_(a11Runtime, {
    activationID: "CLIENT-CHOSEN-ID",
    activatedAt: "2020-01-01T00:00:00.000Z",
    mode: act.ACTIVE_MODE
  });
  check("A11a", res11.status === act.STATUS.ACTIVATED &&
    res11.config.activationID === "SRV2ACT-TEST-1" &&
    res11.config.activatedAt === "2026-10-09T03:04:05.678Z" &&
    res11.config.activationID !== "CLIENT-CHOSEN-ID" &&
    res11.config.activatedAt !== "2020-01-01T00:00:00.000Z", JSON.stringify(res11));
  var a11Stored = JSON.parse(a11Runtime.properties.store.value);
  check("A11b", a11Stored.activationID !== "CLIENT-CHOSEN-ID" &&
    a11Stored.activatedAt !== "2020-01-01T00:00:00.000Z");
  check("A11c", salesRecognitionV2ActivateWithRuntime_.length === 1 &&
    salesRecognitionV2Activate.length === 0);

  return { total: pass, pass: pass, fail: 0 };
}

function testSalesRecognitionV2ActivationFailClosed() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_ACTIVATION:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var act = SALES_V2_ACTIVATION, contract = SALES_RECOGNITION_V2_CONTRACT;

  // A4 malformed ACTIVE fail closed (ACTIVE missing T/ID).
  var a4Raw = JSON.stringify({ mode: act.ACTIVE_MODE,
    contractVersion: contract.CONTRACT_VERSION, activationID: "SRV2ACT-X",
    activatedAt: "", configVersion: 1 });
  var a4 = salesV2ActivationRuntime_({ rawProperty: a4Raw });
  var res4 = salesRecognitionV2ActivateWithRuntime_(a4);
  check("A4a", res4.status === act.STATUS.REFUSED &&
    res4.code === act.CODES.ACTIVE_MALFORMED, JSON.stringify(res4));
  check("A4b", a4.properties.writes.length === 0 && a4.properties.store.value === a4Raw);

  // A4c garbage JSON property fail closed.
  var a4c = salesV2ActivationRuntime_({ rawProperty: "{not-json" });
  var res4c = salesRecognitionV2ActivateWithRuntime_(a4c);
  check("A4c", res4c.status === act.STATUS.REFUSED &&
    res4c.code === act.CODES.PROPERTY_MALFORMED && a4c.properties.writes.length === 0);

  // A5 PREPARED + existing T fail closed.
  var a5Raw = JSON.stringify({ mode: contract.MODES[0],
    contractVersion: contract.CONTRACT_VERSION, activationID: "",
    activatedAt: "2026-10-07T00:00:00.000Z", configVersion: 1 });
  var a5 = salesV2ActivationRuntime_({ rawProperty: a5Raw });
  var res5 = salesRecognitionV2ActivateWithRuntime_(a5);
  check("A5a", res5.status === act.STATUS.REFUSED &&
    res5.code === act.CODES.METADATA_PRESENT, JSON.stringify(res5));
  check("A5b", a5.properties.writes.length === 0 && a5.properties.store.value === a5Raw);

  // A6 PREPARED + existing ActivationID fail closed.
  var a6Raw = JSON.stringify({ mode: contract.MODES[0],
    contractVersion: contract.CONTRACT_VERSION, activationID: "SRV2ACT-LEAK",
    activatedAt: "", configVersion: 1 });
  var a6 = salesV2ActivationRuntime_({ rawProperty: a6Raw });
  var res6 = salesRecognitionV2ActivateWithRuntime_(a6);
  check("A6a", res6.status === act.STATUS.REFUSED &&
    res6.code === act.CODES.METADATA_PRESENT, JSON.stringify(res6));
  check("A6b", a6.properties.writes.length === 0 && a6.properties.store.value === a6Raw);

  // A7 wrong contractVersion fail closed.
  var a7Raw = JSON.stringify({ mode: contract.MODES[0],
    contractVersion: "LEGACY_V1", activationID: "", activatedAt: "", configVersion: 1 });
  var a7 = salesV2ActivationRuntime_({ rawProperty: a7Raw });
  var res7 = salesRecognitionV2ActivateWithRuntime_(a7);
  check("A7a", res7.status === act.STATUS.REFUSED &&
    res7.code === act.CODES.WRONG_CONTRACT, JSON.stringify(res7));
  check("A7b", a7.properties.writes.length === 0 && a7.properties.store.value === a7Raw);

  // A9 schema preflight failure -> no write (Events header wrong).
  var badFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  badFixture.getSheetByName("SalesRecognitionEvents").values[0][0] = "WrongID";
  var a9 = salesV2ActivationRuntime_({ fixture: badFixture,
    rawProperty: salesV2ActivationPreparedRaw_() });
  var res9 = salesRecognitionV2ActivateWithRuntime_(a9);
  check("A9a", res9.status === act.STATUS.REFUSED &&
    res9.code === act.CODES.SCHEMA_NOT_READY, JSON.stringify(res9));
  check("A9b", a9.properties.writes.length === 0);

  // A9c missing companion sheet fail closed.
  var missingFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  missingFixture.getSheetByName = (function(original) {
    return function(name) {
      if (name === "SalesRecognitionAudits") return null;
      return original(name);
    };
  })(missingFixture.getSheetByName);
  var a9c = salesV2ActivationRuntime_({ fixture: missingFixture });
  var res9c = salesRecognitionV2ActivateWithRuntime_(a9c);
  check("A9c", res9c.status === act.STATUS.REFUSED &&
    res9c.code === act.CODES.SCHEMA_NOT_READY && a9c.properties.writes.length === 0,
    JSON.stringify(res9c));

  // A8 account preflight failure -> no write (missing 1030).
  var no1030 = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var accountSheet = no1030.getSheetByName("Accounts");
  for (var removeIndex = accountSheet.values.length - 1; removeIndex >= 0; removeIndex--) {
    if (String(accountSheet.values[removeIndex][0]).trim() === "1030") {
      accountSheet.values.splice(removeIndex, 1);
    }
  }
  var a8 = salesV2ActivationRuntime_({ fixture: no1030 });
  var res8 = salesRecognitionV2ActivateWithRuntime_(a8);
  check("A8a", res8.status === act.STATUS.REFUSED &&
    res8.code === act.CODES.ACCOUNT_PREFLIGHT_FAILED &&
    res8.detail === "ACCOUNT_ABSENT" && res8.field === "1030", JSON.stringify(res8));
  check("A8b", a8.properties.writes.length === 0);

  // A10 unexpected V2 artifacts -> no write.
  var artifactFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  artifactFixture.getSheetByName("TransactionOperations").values.push(
    t.OPERATIONS.HEADERS.map(function(header) {
      var row = { OperationID: "TXOP-U10-1", OperationType: "SALES_RECOGNITION_V2_SAVE",
        BusinessID: "ORD-U10-1", RequestKey: "u10-artifact", State: "COMMITTED",
        PayloadHash: "H", OperationPlan: "{}", CreatedAt: "", UpdatedAt: "", LastError: "" };
      return row[header] === undefined ? "" : row[header];
    }));
  var a10 = salesV2ActivationRuntime_({ fixture: artifactFixture });
  var res10 = salesRecognitionV2ActivateWithRuntime_(a10);
  check("A10a", res10.status === act.STATUS.REFUSED &&
    res10.code === act.CODES.UNEXPECTED_V2_ARTIFACTS &&
    String(res10.detail).indexOf("V2_OPERATIONS_NOT_EMPTY") === 0, JSON.stringify(res10));
  check("A10b", a10.properties.writes.length === 0);

  // A10c Events already populated fail closed.
  var eventFixture = salesV2SaveFixture_(salesV2SaveBaseSheets_());
  eventFixture.getSheetByName("SalesRecognitionEvents").values.push(
    contract.HEADERS.map(function() { return "X"; }));
  var a10c = salesV2ActivationRuntime_({ fixture: eventFixture });
  var res10c = salesRecognitionV2ActivateWithRuntime_(a10c);
  check("A10c", res10c.status === act.STATUS.REFUSED &&
    res10c.code === act.CODES.UNEXPECTED_V2_ARTIFACTS &&
    a10c.properties.writes.length === 0, JSON.stringify(res10c));

  // PAUSED is not an activation target.
  var pausedRaw = JSON.stringify({ mode: "PAUSED",
    contractVersion: contract.CONTRACT_VERSION, activationID: "SRV2ACT-P",
    activatedAt: "2026-10-08T00:00:00.000Z", configVersion: 1 });
  var paused = salesV2ActivationRuntime_({ rawProperty: pausedRaw });
  var resPaused = salesRecognitionV2ActivateWithRuntime_(paused);
  check("P1", resPaused.status === act.STATUS.REFUSED &&
    resPaused.code === act.CODES.NOT_PREPARED && paused.properties.writes.length === 0,
    JSON.stringify(resPaused));

  // Forbidden activation instant never written (validator catches it if clock
  // ever collides with the frozen Policy-C T).
  var forbiddenNow = salesV2ActivationRuntime_({
    now: function() { return new Date(contract.FORBIDDEN_ACTIVATION_TIMESTAMP); } });
  var resForbidden = salesRecognitionV2ActivateWithRuntime_(forbiddenNow);
  check("F1", resForbidden.status === act.STATUS.REFUSED &&
    resForbidden.code === act.CODES.TIMESTAMP_INVALID &&
    forbiddenNow.properties.writes.length === 0, JSON.stringify(resForbidden));

  return { total: pass, pass: pass, fail: 0 };
}

function testSalesRecognitionV2ActivationSourceAudit() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_ACTIVATION_AUDIT:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var act = SALES_V2_ACTIVATION, contract = SALES_RECOGNITION_V2_CONTRACT;
  var core = salesRecognitionV2ActivateWithRuntime_.toString();
  var publicEntry = salesRecognitionV2Activate.toString();
  var runtimeFactory = salesRecognitionV2ActivateRuntime_.toString();
  var operator = salesV2OperatorConfigState_.toString() +
    salesRecognitionV2OperatorConfig.toString();

  // 1 only minimal activation capability
  check(1, typeof salesRecognitionV2Activate === "function" &&
    typeof salesRecognitionV2ActivateWithRuntime_ === "function");
  // 2 no generic config writer
  check(2, publicEntry.indexOf("setProperty") === -1 &&
    operator.indexOf("setProperty") === -1 &&
    core.split("setProperty(").length - 1 === 1 &&
    typeof salesRecognitionV2Activate === "function");
  // 3 PREPARED precondition
  check(3, core.indexOf("PREPARED_WITH_EXISTING_METADATA") !== -1 &&
    core.indexOf(act.PREPARED_MODE) !== -1);
  // 4 no T/ID overwrite on ALREADY_ACTIVE
  check(4, core.indexOf("ALREADY_ACTIVE") !== -1 &&
    salesRecognitionV2ActivationResult_(act.STATUS.ALREADY_ACTIVE).config === null);
  // 5 server T
  check(5, core.indexOf("now instanceof Date ? now.toISOString()") !== -1);
  // 6 server ActivationID
  check(6, core.indexOf("runtime.uuid()") !== -1 &&
    publicEntry.indexOf("activationID") === -1);
  // 7 preflight before write
  check(7, core.indexOf("salesRecognitionV2ActivationPreflight_") !== -1 &&
    core.indexOf("salesRecognitionV2ActivationPreflight_(runtime)") <
    core.indexOf("setProperty"));
  // 8 one logical mutation
  check(8, core.split("setProperty(").length - 1 === 1);
  // 9 readback after write
  check(9, core.indexOf("READBACK_MISMATCH") !== -1 &&
    core.indexOf("READBACK_FAILED") !== -1);
  // 10 reinvocation safe
  check(10, core.indexOf(act.STATUS.ALREADY_ACTIVE) !== -1);
  // 11 no Sales artifact
  check(11, core.indexOf("salesRecognitionV2Save") === -1 &&
    core.indexOf("createDurableOperational") === -1);
  // 12 no accounting artifact
  check(12, core.indexOf("BalanceLedger") === -1 &&
    core.indexOf("batchUpdate") === -1);
  // 13 no Treasury
  check(13, core.indexOf("2010") === -1 && core.indexOf("Treasury") === -1);
  // 14 no Payment/Fulfillment
  check(14, core.indexOf("Payment") === -1 && core.indexOf("Fulfillment") === -1);
  // 15 no historical mutation
  check(15, core.indexOf("appendRow") === -1 && core.indexOf("batchUpdate") === -1 &&
    core.indexOf("setValues") === -1);

  // Public entry takes no parameters (client cannot choose T/ID).
  check("PUB", salesRecognitionV2Activate.length === 0 &&
    salesRecognitionV2ActivateWithRuntime_.length === 1);
  check("NO_CLIENT_MODE", core.indexOf('payload.mode') === -1 &&
    core.indexOf("arguments[") === -1);

  // Forbidden timestamp constant still present in foundation authority.
  check("FORBIDDEN", contract.FORBIDDEN_ACTIVATION_TIMESTAMP === "2026-10-06T18:50:05.328Z");

  return { total: pass, pass: pass, fail: 0 };
}
