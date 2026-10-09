// Treasury T3 foundation tests (suites A-H + 15-point mutation sensitivity)
// for 99.Treasury.Receipt.Foundation.js. Fixture-only: pure inputs, in-memory
// mutation copies, a temporary Utilities.formatDate Jakarta-true stand-in
// (restored in finally), and a temporary read-only Properties mock (restored
// in finally). No spreadsheet access, no network, no clasp, no production.

function treasuryT3Accounts_() {
  function account(code, name, type, cashFlowGroup, normalBalance, active) {
    return { AccountCode: code, AccountName: name, AccountType: type,
      StatementGroup: "Current Assets", CashFlowGroup: cashFlowGroup,
      NormalBalance: normalBalance, IsActive: active };
  }
  return [
    account("1000", "Cash on Hand", "Asset", "Operating", "DEBIT", true),
    account("1010", "DANA Business", "Asset", "Operating", "DEBIT", true),
    account("1020", "Cash in Owner Custody - BluBCA", "Asset", "Operating", "DEBIT", true),
    account("1030", "Sales Settlement Clearing", "Asset", "Operating", "DEBIT", true),
    account("1100", "Inventory Asset", "Asset", "Operating", "DEBIT", true),
    account("2000", "Supplier Payable", "Liability", "Operating", "CREDIT", true),
    account("2010", "Customer Refund and Credit Payable", "Liability", "Operating", "CREDIT", true),
    account("5000", "Cost of Goods Sold", "Expense", "Operating", "DEBIT", true),
    account("6210", "Miscellaneous Expense", "Expense", "Operating", "DEBIT", true),
    // Production convention: 4000 carries a blank NormalBalance claim.
    account("4000", "Sales Revenue", "Revenue", "Operating", "", true)
  ];
}

function treasuryT3CheckFactory_(prefix) {
  return function check(id, value, detail) {
    if (!value) throw new Error(prefix + ":" + id + (detail === undefined ? "" : "|" + detail));
  };
}

// Simulated Apps Script production host date key (UTC getters — the proven
// host-local defect class). Host-agnostic: local machine timezone never
// influences these assertions.
function treasuryT3UtcHostDateKey_(date) {
  return date.getUTCFullYear() + "-" + ("0" + (date.getUTCMonth() + 1)).slice(-2) + "-" +
    ("0" + date.getUTCDate()).slice(-2);
}

// ---------------------------------------------------------------------------
// Suite A — contract constants (frozen T2 sections 1, 4, 5, 8, 24).
// ---------------------------------------------------------------------------
function testTreasuryT3ContractConstants() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_CONSTANTS");
  var c = TREASURY_RECEIPT_V1_CONTRACT;

  check("A1", c.CONTRACT_VERSION === "TREASURY_RECEIPT_V1", c.CONTRACT_VERSION);
  check("A2", c.CONFIG_PROPERTY === "TREASURY_RECEIPT_V1_CONFIG", c.CONFIG_PROPERTY);
  check("A3", JSON.stringify(c.MODES) === JSON.stringify(["PREPARED", "ACTIVE", "PAUSED"]));
  check("A4", c.SCHEMAS.RECEIPTS.HEADERS.length === 24 &&
    c.SCHEMAS.OPERATIONS.HEADERS.length === 10 &&
    c.SCHEMAS.AUDITS.HEADERS.length === 11);
  check("A5", c.SCHEMAS.RECEIPTS.SHEET === "TreasuryReceipts" &&
    c.SCHEMAS.OPERATIONS.SHEET === "TreasuryOperations" &&
    c.SCHEMAS.AUDITS.SHEET === "TreasuryAudits");
  check("A6", c.SCHEMAS.RECEIPTS.HEADERS.indexOf("Status") === -1 &&
    c.SCHEMAS.RECEIPTS.HEADERS[17] === "PostingStatus" &&
    c.SCHEMAS.RECEIPTS.HEADERS[0] === "TreasuryReceiptID" &&
    c.SCHEMAS.RECEIPTS.HEADERS[23] === "SnapshotJSON");
  check("A7", JSON.stringify(c.ID_PREFIXES) === JSON.stringify(
    { OPERATION: "TROP-", RECEIPT: "TRC-", JOURNAL: "TRJ-", AUDIT: "TRA-", ACTIVATION: "TRACT-" }));
  check("A8", c.DESTINATION_ACCOUNT_CODES === CASH_FOUNDATION_POLICY.ACCOUNT_CODES &&
    JSON.stringify(c.DESTINATION_ACCOUNT_CODES) === JSON.stringify(["1000", "1010", "1020"]));
  check("A9", JSON.stringify(c.FORBIDDEN_JOURNAL_ACCOUNTS) ===
    JSON.stringify(["4000", "5000", "1100", "2000", "2010", "6210"]));
  check("A10", c.TIMEZONE === "Asia/Jakarta" && c.DATE_PATTERN === "yyyy-MM-dd" &&
    c.MOVEMENT_TYPE === "TREASURY_RECEIPT" && c.SOURCE_TYPE === "TREASURY_RECEIPT_V1" &&
    c.EVIDENCE_TYPE === "MANUAL_VERIFIED" && c.CLEARING_ACCOUNT_CODE === "1030");
  check("A11", Object.keys(c.ERROR_CODES).every(function(key) {
    return c.ERROR_CODES[key].indexOf("TREASURY_") === 0;
  }) && c.ERROR_CODES.CONFIG_INVALID === "TREASURY_CONFIG_INVALID" &&
    c.ERROR_CODES.ECONOMIC_DATE_MISMATCH === "TREASURY_ECONOMIC_DATE_MISMATCH",
    JSON.stringify(c.ERROR_CODES));
}

// ---------------------------------------------------------------------------
// Suite B — exact schema validation: accept exact extent, reject missing /
// renamed / reordered / duplicated / added columns (T2 section 4).
// ---------------------------------------------------------------------------
function testTreasuryT3SchemaValidation() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_SCHEMA");
  var c = TREASURY_RECEIPT_V1_CONTRACT;

  check("B1", validateTreasurySchemaHeaders("RECEIPTS", c.SCHEMAS.RECEIPTS.HEADERS.slice()).status === "PASS");
  check("B2", validateTreasurySchemaHeaders("OPERATIONS", c.SCHEMAS.OPERATIONS.HEADERS.slice()).status === "PASS");
  check("B3", validateTreasurySchemaHeaders("AUDITS", c.SCHEMAS.AUDITS.HEADERS.slice()).status === "PASS");

  var missing = c.SCHEMAS.RECEIPTS.HEADERS.slice(0, 23);
  var missingResult = validateTreasurySchemaHeaders("RECEIPTS", missing);
  check("B4", missingResult.status === "FAIL" &&
    missingResult.errors[0].code === "TREASURY_SCHEMA_NOT_READY", JSON.stringify(missingResult));

  var renamed = c.SCHEMAS.RECEIPTS.HEADERS.slice();
  renamed[4] = "RecognitionRef";
  check("B5", validateTreasurySchemaHeaders("RECEIPTS", renamed).status === "FAIL");

  var reordered = c.SCHEMAS.RECEIPTS.HEADERS.slice();
  reordered[0] = reordered[1];
  reordered[1] = "TreasuryReceiptID";
  check("B6", validateTreasurySchemaHeaders("RECEIPTS", reordered).status === "FAIL");

  var duplicated = c.SCHEMAS.OPERATIONS.HEADERS.slice();
  duplicated[9] = "State";
  check("B7", validateTreasurySchemaHeaders("OPERATIONS", duplicated).status === "FAIL");

  var added = c.SCHEMAS.AUDITS.HEADERS.concat(["Notes"]);
  check("B8", validateTreasurySchemaHeaders("AUDITS", added).status === "FAIL");

  check("B9", validateTreasurySchemaHeaders("RECEIPTS", null).status === "FAIL" &&
    validateTreasurySchemaHeaders("UNKNOWN", c.SCHEMAS.RECEIPTS.HEADERS.slice()).status === "FAIL");
  check("B10", validateTreasurySchemaHeaders("RECEIPTS", ["x"]).status === "FAIL");
}

// ---------------------------------------------------------------------------
// Suite C — config validation + reader + classifier (T2 section 5).
// ---------------------------------------------------------------------------
function treasuryT3Config_(overrides) {
  var config = { mode: "ACTIVE", contractVersion: "TREASURY_RECEIPT_V1",
    activationID: "TRACT-TEST000001", activatedAt: "2026-10-10T00:00:00.000Z", configVersion: 1 };
  Object.keys(overrides || {}).forEach(function(key) { config[key] = overrides[key]; });
  return config;
}

function testTreasuryT3ConfigClassifier() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_CONFIG");
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;

  check("C1", validateTreasuryReceiptConfig(treasuryT3Config_({ mode: "PREPARED",
    activationID: "", activatedAt: "" })).status === "PASS");
  check("C2", validateTreasuryReceiptConfig(treasuryT3Config_()).status === "PASS");
  check("C3", validateTreasuryReceiptConfig(treasuryT3Config_({ mode: "PAUSED" })).status === "PASS");

  var gatePrepared = treasuryReceiptModeGate(treasuryT3Config_({ mode: "PREPARED",
    activationID: "", activatedAt: "" }));
  check("C4", gatePrepared.allowed === false && gatePrepared.code === codes.NOT_ACTIVATED,
    JSON.stringify(gatePrepared));
  var gateActive = treasuryReceiptModeGate(treasuryT3Config_());
  check("C5", gateActive.allowed === true && gateActive.code === "", JSON.stringify(gateActive));
  var gatePaused = treasuryReceiptModeGate(treasuryT3Config_({ mode: "PAUSED" }));
  check("C6", gatePaused.allowed === false && gatePaused.code === codes.MODE_PAUSED,
    JSON.stringify(gatePaused));

  var missingProperty = treasuryReceiptConfigFromRaw(null);
  check("C7", missingProperty.status === "FAIL" &&
    missingProperty.errors[0].code === codes.CONFIG_INVALID, JSON.stringify(missingProperty));
  check("C8", treasuryReceiptConfigFromRaw("   ").status === "FAIL" &&
    treasuryReceiptConfigFromRaw("{not json").errors[0].code === codes.CONFIG_INVALID);

  var wrongVersion = treasuryReceiptConfigFromRaw(JSON.stringify(
    treasuryT3Config_({ contractVersion: "TREASURY_RECEIPT_V2" })));
  check("C9", wrongVersion.status === "FAIL" &&
    wrongVersion.errors[0].code === codes.CONTRACT_VERSION_MISMATCH, JSON.stringify(wrongVersion));

  var blankMode = treasuryReceiptConfigFromRaw(JSON.stringify(treasuryT3Config_({ mode: "  " })));
  check("C10", blankMode.status === "FAIL" && blankMode.errors[0].code === codes.CONFIG_INVALID);
  var unknownMode = treasuryReceiptConfigFromRaw(JSON.stringify(treasuryT3Config_({ mode: "LIVE" })));
  check("C11", unknownMode.status === "FAIL" && unknownMode.errors[0].code === codes.CONFIG_INVALID);

  var activeNoIdentity = validateTreasuryReceiptConfig(treasuryT3Config_({ activationID: "",
    activatedAt: "" }));
  check("C12", activeNoIdentity.status === "FAIL" &&
    activeNoIdentity.errors[0].code === codes.ACTIVATION_METADATA_MISSING,
    JSON.stringify(activeNoIdentity));
  check("C13", treasuryReceiptModeGate(treasuryT3Config_({ activationID: "", activatedAt: "" }))
    .allowed === false);

  var preparedWithIdentity = validateTreasuryReceiptConfig(treasuryT3Config_({ mode: "PREPARED" }));
  check("C14", preparedWithIdentity.status === "FAIL" &&
    preparedWithIdentity.errors[0].code === codes.ACTIVATION_METADATA_PRESENT);

  check("C15", validateTreasuryReceiptConfig(treasuryT3Config_({ configVersion: 0 })).status === "FAIL" &&
    validateTreasuryReceiptConfig(treasuryT3Config_({ configVersion: 1.5 })).errors[0].code ===
      codes.CONFIG_VERSION_INVALID &&
    validateTreasuryReceiptConfig(treasuryT3Config_({ configVersion: "1" })).status === "FAIL");

  check("C16", validateTreasuryReceiptConfig(treasuryT3Config_(
    { activatedAt: "2026-10-10 00:00:00" })).errors[0].code === codes.ACTIVATION_METADATA_INVALID &&
    validateTreasuryReceiptConfig(treasuryT3Config_(
      { activatedAt: "2026-10-10T00:00:00+07:00" })).status === "FAIL" &&
    validateTreasuryReceiptConfig(treasuryT3Config_(
      { activatedAt: "2026-02-30T00:00:00Z" })).status === "FAIL");

  check("C17", validateTreasuryReceiptConfig(null).status === "FAIL" &&
    validateTreasuryReceiptConfig([1]).status === "FAIL" &&
    validateTreasuryReceiptConfig("ACTIVE").status === "FAIL");

  // Trimmed, case-sensitive mode normalization (T2 section 5).
  check("C18", validateTreasuryReceiptConfig(treasuryT3Config_({ mode: " ACTIVE " })).status === "PASS" &&
    validateTreasuryReceiptConfig(treasuryT3Config_({ mode: "active" })).status === "FAIL");

  // Reader: no Properties service => unavailable => FAIL, never ACTIVE; with
  // a read-only mock: exact key read, zero writes; resolved gate never allows
  // without a validated ACTIVE config.
  check("C19", typeof PropertiesService === "undefined" &&
    treasuryReceiptConfigState().status === "FAIL" &&
    treasuryReceiptResolvedGate().allowed === false);

  var originalProperties = globalThis.PropertiesService;
  try {
    var reads = [], writes = [], stored = null;
    globalThis.PropertiesService = {
      getScriptProperties: function() {
        return {
          getProperty: function(key) {
            reads.push(key);
            return stored;
          },
          setProperty: function(key, value) {
            writes.push({ key: key, value: value });
            stored = value;
          }
        };
      }
    };
    var absentState = treasuryReceiptConfigState();
    check("C20", absentState.status === "FAIL" && reads[0] === "TREASURY_RECEIPT_V1_CONFIG" &&
      writes.length === 0, JSON.stringify({ reads: reads, writes: writes }));

    stored = JSON.stringify(treasuryT3Config_());
    var activeState = treasuryReceiptConfigState();
    check("C21", activeState.status === "PASS" && activeState.config.mode === "ACTIVE" &&
      treasuryReceiptResolvedGate().allowed === true && writes.length === 0,
      JSON.stringify({ state: activeState, writes: writes }));

    stored = "{broken";
    check("C22", treasuryReceiptConfigState().status === "FAIL" &&
      treasuryReceiptResolvedGate().allowed === false && writes.length === 0);
  } finally {
    if (originalProperties === undefined) delete globalThis.PropertiesService;
    else globalThis.PropertiesService = originalProperties;
  }
}

// ---------------------------------------------------------------------------
// Suite D — destination eligibility + 1030 readiness preflight (T2 sections
// 6, 21). Deterministic on codes; names never consulted; fail closed.
// ---------------------------------------------------------------------------
function testTreasuryT3DestinationEligibility() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_ELIGIBILITY");
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  var accounts = treasuryT3Accounts_();
  var result1000 = treasuryDestinationEligible("1000", accounts);
  var result1010 = treasuryDestinationEligible("1010", accounts);
  var result1020 = treasuryDestinationEligible("1020", accounts);

  check("D1", result1000.eligible === true && result1000.code === "", JSON.stringify(result1000));
  check("D2", result1010.eligible === true && result1010.code === "", JSON.stringify(result1010));
  check("D3", result1020.eligible === true && result1020.code === "", JSON.stringify(result1020));

  var clearing = treasuryDestinationEligible("1030", accounts);
  check("D4", clearing.eligible === false && clearing.code === codes.DESTINATION_IS_CLEARING,
    JSON.stringify(clearing));

  ["4000", "5000", "1100", "2000", "2010", "6210"].forEach(function(code) {
    var refused = treasuryDestinationEligible(code, accounts);
    check("D5-" + code, refused.eligible === false &&
      refused.code === codes.INVALID_DESTINATION_ACCOUNT &&
      refused.reason === "NOT_IN_CASH_UNIVERSE", JSON.stringify(refused));
    check("D6-" + code, treasuryForbiddenJournalAccount(code) === true, code);
  });
  check("D7", treasuryForbiddenJournalAccount("1000") === false &&
    treasuryForbiddenJournalAccount("1030") === false &&
    treasuryForbiddenJournalAccount("") === false);

  var unknown = treasuryDestinationEligible("9999", accounts);
  check("D8", unknown.eligible === false && unknown.code === codes.INVALID_DESTINATION_ACCOUNT &&
    unknown.reason === "NOT_IN_CASH_UNIVERSE");
  var blank = treasuryDestinationEligible("  ", accounts);
  check("D9", blank.eligible === false && blank.code === codes.INVALID_DESTINATION_ACCOUNT);

  var duplicate = accounts.concat([{ AccountCode: "1010", AccountName: "Second 1010",
    AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating",
    NormalBalance: "DEBIT", IsActive: true }]);
  var duplicateResult = treasuryDestinationEligible("1010", duplicate);
  check("D10", duplicateResult.eligible === false &&
    duplicateResult.code === codes.INVALID_DESTINATION_ACCOUNT &&
    duplicateResult.reason === "DUPLICATE", JSON.stringify(duplicateResult));

  var absent = accounts.filter(function(row) { return row.AccountCode !== "1020"; });
  var absentResult = treasuryDestinationEligible("1020", absent);
  check("D11", absentResult.eligible === false && absentResult.reason === "ABSENT");

  var inactive = accounts.map(function(row) {
    return row.AccountCode === "1010" ?
      { AccountCode: "1010", AccountName: row.AccountName, AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT",
        IsActive: false } : row;
  });
  var inactiveResult = treasuryDestinationEligible("1010", inactive);
  check("D12", inactiveResult.eligible === false &&
    inactiveResult.code === codes.DESTINATION_ACCOUNT_INACTIVE, JSON.stringify(inactiveResult));
  var inactiveString = accounts.map(function(row) {
    return row.AccountCode === "1010" ?
      { AccountCode: "1010", AccountName: row.AccountName, AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT",
        IsActive: "FALSE" } : row;
  });
  check("D13", treasuryDestinationEligible("1010", inactiveString).code ===
    codes.DESTINATION_ACCOUNT_INACTIVE);

  var wrongType = accounts.map(function(row) {
    return row.AccountCode === "1020" ?
      { AccountCode: "1020", AccountName: row.AccountName, AccountType: "Liability",
        StatementGroup: "Current Liabilities", CashFlowGroup: "Operating", NormalBalance: "CREDIT",
        IsActive: true } : row;
  });
  var wrongTypeResult = treasuryDestinationEligible("1020", wrongType);
  check("D14", wrongTypeResult.eligible === false &&
    wrongTypeResult.code === codes.INVALID_DESTINATION_ACCOUNT &&
    wrongTypeResult.reason === "METADATA_MISMATCH", JSON.stringify(wrongTypeResult));

  var wrongBalance = accounts.map(function(row) {
    return row.AccountCode === "1000" ?
      { AccountCode: "1000", AccountName: row.AccountName, AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "CREDIT",
        IsActive: true } : row;
  });
  check("D15", treasuryDestinationEligible("1000", wrongBalance).reason === "METADATA_MISMATCH");

  // Name inference is impossible: renames never change results, and a
  // cash-looking name on a non-foundation code never helps.
  var renamed = accounts.map(function(row) {
    var copy = {};
    Object.keys(row).forEach(function(key) { copy[key] = row[key]; });
    if (copy.AccountCode === "1010") copy.AccountName = "Completely Different Label";
    return copy;
  });
  check("D16", treasuryDestinationEligible("1010", renamed).eligible === true);
  var nameBait = accounts.concat([{ AccountCode: "1999", AccountName: "Cash BluBCA DANA Wallet",
    AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating",
    NormalBalance: "DEBIT", IsActive: true }]);
  check("D17", treasuryDestinationEligible("1999", nameBait).eligible === false &&
    treasuryDestinationEligible("1999", nameBait).code === codes.INVALID_DESTINATION_ACCOUNT);

  // Malformed master fails closed; the 4000 blank-NormalBalance production
  // convention never breaks destination or clearing validation.
  check("D18", treasuryDestinationEligible("1010", null).reason === "MALFORMED_MASTER" &&
    treasuryDestinationEligible("1010", [null]).reason === "MALFORMED_MASTER" &&
    treasuryDestinationEligible("1010", accounts).eligible === true);

  check("D19", treasuryClearingPreflight(accounts).status === "PASS",
    JSON.stringify(treasuryClearingPreflight(accounts)));
  var clearingInactive = accounts.map(function(row) {
    return row.AccountCode === "1030" ?
      { AccountCode: "1030", AccountName: row.AccountName, AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT",
        IsActive: false } : row;
  });
  var preflightInactive = treasuryClearingPreflight(clearingInactive);
  check("D20", preflightInactive.status === "FAIL" &&
    preflightInactive.errors[0].code === codes.SCHEMA_NOT_READY &&
    preflightInactive.errors[0].reason === "INACTIVE", JSON.stringify(preflightInactive));
  var clearingMissing = accounts.filter(function(row) { return row.AccountCode !== "1030"; });
  check("D21", treasuryClearingPreflight(clearingMissing).errors[0].reason === "ABSENT");
  var clearingUnbalanced = accounts.map(function(row) {
    return row.AccountCode === "1030" ?
      { AccountCode: "1030", AccountName: row.AccountName, AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "", NormalBalance: "DEBIT",
        IsActive: true } : row;
  });
  var preflightGroup = treasuryClearingPreflight(clearingUnbalanced);
  check("D22", preflightGroup.status === "FAIL" &&
    preflightGroup.errors[0].reason === "CASH_FLOW_GROUP_UNCLASSIFIED",
    JSON.stringify(preflightGroup));
}

// ---------------------------------------------------------------------------
// Suite E — Asia/Jakarta date battery (T2 section 9). Temporary Jakarta-true
// Utilities.formatDate stand-in (UTC+7, no DST for 2020s dates) with argument
// capture; original stub restored in finally.
// ---------------------------------------------------------------------------
function testTreasuryT3DateAuthority() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_DATE");
  var calls = [];
  var originalFormatDate = Utilities.formatDate;
  Utilities.formatDate = function(date, timeZone, format) {
    calls.push({ timeZone: timeZone, format: format });
    if (format !== "yyyy-MM-dd") throw new Error("unexpected format " + format);
    var shifted = new Date(date.getTime() + 7 * 3600 * 1000);
    return shifted.toISOString().slice(0, 10);
  };
  try {
    var daytime = new Date("2026-10-11T08:00:00Z"); // 15:00 WIB same day
    check("E1", treasuryDateKey(daytime) === "2026-10-11", treasuryDateKey(daytime));
    check("E2", calls[0].timeZone === "Asia/Jakarta" && calls[0].format === "yyyy-MM-dd",
      JSON.stringify(calls[0]));

    // 23:59:59 / 00:00:00 WIB boundary (Jakarta = UTC+7).
    check("E3", treasuryDateKey(new Date("2026-10-11T16:59:59Z")) === "2026-10-11");
    check("E4", treasuryDateKey(new Date("2026-10-11T17:00:00Z")) === "2026-10-12");

    // UTC day differs from the Jakarta business day (the host-local defect).
    var utcDiverges = new Date("2026-10-11T20:00:00Z");
    check("E5", treasuryDateKey(utcDiverges) === "2026-10-12" &&
      treasuryT3UtcHostDateKey_(utcDiverges) === "2026-10-11",
      treasuryDateKey(utcDiverges) + " vs " + treasuryT3UtcHostDateKey_(utcDiverges));

    // Month and year boundaries (the proven boundary-defect replication).
    check("E6", treasuryDateKey(new Date("2026-09-30T17:00:00Z")) === "2026-10-01" &&
      treasuryT3UtcHostDateKey_(new Date("2026-09-30T17:00:00Z")) === "2026-09-30");
    check("E7", treasuryDateKey(new Date("2026-12-31T17:00:00Z")) === "2027-01-01" &&
      treasuryDateKey(new Date("2026-12-31T16:59:59Z")) === "2026-12-31");

    // Leap day (2028) across the Jakarta boundary.
    check("E8", treasuryDateKey(new Date("2028-02-28T17:00:00Z")) === "2028-02-29");

    // Malformed instants fail closed with the frozen code.
    var thrown = null;
    try { treasuryDateKey("2026-10-11T00:00:00Z"); } catch (e) { thrown = e; }
    check("E9", thrown && thrown.treasuryCode === "TREASURY_DATE_INVALID", String(thrown));
    var thrown2 = null;
    try { treasuryDateKey(new Date("not-a-date")); } catch (e) { thrown2 = e; }
    check("E10", thrown2 && thrown2.treasuryCode === "TREASURY_DATE_INVALID");
  } finally {
    Utilities.formatDate = originalFormatDate;
  }

  // ReceiptDate / EconomicDate contract (T2 section 9): strict calendar
  // strings, byte-equal in V1.
  check("E11", treasuryValidateReceiptDate("2026-10-11").status === "PASS" &&
    treasuryValidateReceiptDate("2024-02-29").status === "PASS");
  ["2026-02-30", "2026-13-01", "10-10-2026", "", "2026-10-11 ", null, undefined, 20261011]
    .forEach(function(value, index) {
      var result = treasuryValidateReceiptDate(value);
      check("E12-" + index, result.status === "FAIL" && result.code === "TREASURY_DATE_INVALID",
        JSON.stringify(value));
    });
  check("E13", treasuryValidateEconomicDate("2026-10-11", "2026-10-11").status === "PASS");
  var mismatch = treasuryValidateEconomicDate("2026-10-11", "2026-10-12");
  check("E14", mismatch.status === "FAIL" && mismatch.code === "TREASURY_ECONOMIC_DATE_MISMATCH",
    JSON.stringify(mismatch));
  var whitespace = treasuryValidateEconomicDate("2026-10-11", "2026-10-11 ");
  check("E15", whitespace.code === "TREASURY_DATE_INVALID", JSON.stringify(whitespace));
  check("E16", treasuryValidateEconomicDate("2026-10-11", "2026-02-30").code === "TREASURY_DATE_INVALID" &&
    treasuryValidateEconomicDate("", "").code === "TREASURY_DATE_INVALID");
}

// ---------------------------------------------------------------------------
// Suite F — identity namespaces (T2 section 8.2): four namespaces, frozen
// digest class, determinism, sensitivity, isolation.
// ---------------------------------------------------------------------------
function testTreasuryT3IdentityNamespaces() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_IDENTITY");
  var type = "TREASURY_RECEIPT_SAVE", key = "REQ-T3-0001";

  var operationId = treasuryOperationId(type, key);
  var primaryId = treasuryReceiptId(type, key, "PRIMARY");
  var journalId = treasuryJournalId(type, key, "PRIMARY");
  var auditId = treasuryAuditId(type, key, "PRIMARY");

  check("F1", /^TROP-[0-9A-F]+-[A-Z0-9]*$/.test(operationId), operationId);
  check("F2", /^TRC-[0-9A-F]+-[A-Z0-9]*$/.test(primaryId), primaryId);
  check("F3", /^TRJ-[0-9A-F]+-[A-Z0-9]*$/.test(journalId), journalId);
  check("F4", /^TRA-[0-9A-F]+-[A-Z0-9]*$/.test(auditId), auditId);

  check("F5", operationId === treasuryOperationId(type, key) &&
    primaryId === treasuryReceiptId(type, key, "PRIMARY") &&
    journalId === treasuryJournalId(type, key, "PRIMARY") &&
    auditId === treasuryAuditId(type, key, "PRIMARY"));

  // Same canonicalization class as the proven 95A helper — not a second scheme.
  check("F6", operationId === transactionStableBootstrapId_("TROP-", [type, key]) &&
    primaryId === transactionStableBootstrapId_("TRC-", [type, key, "PRIMARY"]),
    operationId + " / " + primaryId);

  var reversalId = treasuryReceiptId("TREASURY_RECEIPT_REVERSE", key, "REVERSAL");
  check("F7", reversalId !== primaryId && /^TRC-/.test(reversalId), reversalId);
  check("F8", treasuryReceiptId(type, key, "REPLACEMENT") !== primaryId &&
    treasuryReceiptId(type, "REQ-T3-0002", "PRIMARY") !== primaryId &&
    treasuryReceiptId("TREASURY_RECEIPT_CORRECT", key, "PRIMARY") !== primaryId);
  check("F9", operationId !== primaryId && primaryId !== journalId && journalId !== auditId &&
    operationId !== auditId);
}

function testTreasuryT3IdentityFailClosed() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_IDENTITY_FAILCLOSED");
  var thrown = null;
  try { treasuryOperationId("LEGACY_OPERATION", "REQ-1"); } catch (e) { thrown = e; }
  check("F11", thrown && thrown.treasuryCode === "TREASURY_PAYLOAD_INVALID", String(thrown));
  var thrown2 = null;
  try { treasuryReceiptId("TREASURY_RECEIPT_SAVE", "  ", "PRIMARY"); } catch (e) { thrown2 = e; }
  check("F12", thrown2 && thrown2.treasuryCode === "TREASURY_PAYLOAD_INVALID");
  var thrown3 = null;
  try { treasuryJournalId("TREASURY_RECEIPT_SAVE", "REQ-1", "SOMETHING_ELSE"); } catch (e) { thrown3 = e; }
  check("F13", thrown3 && thrown3.treasuryCode === "TREASURY_PAYLOAD_INVALID");
  var thrown4 = null;
  try { treasuryAuditId("TREASURY_RECEIPT_REVERSE", "REQ-1"); } catch (e) { thrown4 = e; }
  check("F14", thrown4 && thrown4.treasuryCode === "TREASURY_PAYLOAD_INVALID");
}

// ---------------------------------------------------------------------------
// Suite G — canonical journal signature (T2 section 8.1): proven pattern,
// sensitivity over every frozen field, order independence.
// ---------------------------------------------------------------------------
function testTreasuryT3JournalSignature() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_SIGNATURE");
  var rows = [
    { AccountCode: "1010", Debit: 24000, Credit: 0, MovementType: "TREASURY_RECEIPT",
      SourceType: "TREASURY_RECEIPT_V1", SourceID: "TRC-AAA-1", Tanggal: "2026-10-11" },
    { AccountCode: "1030", Debit: 0, Credit: 24000, MovementType: "TREASURY_RECEIPT",
      SourceType: "TREASURY_RECEIPT_V1", SourceID: "TRC-AAA-1", Tanggal: "2026-10-11" }
  ];
  var signature = treasuryJournalSignature(rows);
  check("G1", typeof signature === "string" && signature.indexOf("||") !== -1 &&
    signature.indexOf("1010|24000|0|TREASURY_RECEIPT|TREASURY_RECEIPT_V1|TRC-AAA-1|2026-10-11") !== -1,
    signature);
  check("G2", treasuryJournalSignature(rows.slice().reverse()) === signature);
  check("G3", signature === cashJournalSignature(rows),
    signature + " vs " + cashJournalSignature(rows));

  function mutate(index, field, value) {
    return rows.map(function(row, i) {
      var copy = {};
      Object.keys(row).forEach(function(key) { copy[key] = row[key]; });
      if (i === index) copy[field] = value;
      return copy;
    });
  }
  check("G4", treasuryJournalSignature(mutate(0, "Debit", 23999)) !== signature); // amount
  check("G5", treasuryJournalSignature(mutate(0, "AccountCode", "1000")) !== signature); // destination
  check("G6", treasuryJournalSignature(mutate(1, "AccountCode", "2010")) !== signature); // 1030 leg
  check("G7", treasuryJournalSignature(mutate(0, "SourceID", "TRC-BBB-1")) !== signature);
  check("G8", treasuryJournalSignature(mutate(0, "MovementType", "TREASURY_RECEIPT_REVERSAL")) !== signature);
  check("G9", treasuryJournalSignature(mutate(0, "Tanggal", "2026-10-12")) !== signature);
  check("G10", treasuryJournalSignature(mutate(0, "SourceType", "SALES_RECOGNITION_V2")) !== signature);
}

// ---------------------------------------------------------------------------
// Suite H — legacy isolation + inertness source audit over the loaded
// Treasury foundation source string (injected by the runner).
// ---------------------------------------------------------------------------
function testTreasuryT3LegacyIsolation() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_ISOLATION");
  var source = typeof _treasuryFoundationSource === "string" ? _treasuryFoundationSource : "";
  check("H1", source.length > 1000, String(source.length));

  ["Payment", "Settlement", "ReceiveVia", "PaymentMethod", "tabsal", "tabops"].forEach(function(token) {
    check("H2-" + token, source.indexOf(token) === -1, token);
  });
  ["setValues", "appendRow", "appendRows", "batchUpdate", "setValue", "setProperty",
    "insertRowAfter", "insertRowBefore", "getSheetByName", "createSheet", "insertSheet",
    "SpreadsheetApp", "canonicalDateKey", "getUuid"].forEach(function(token) {
    check("H3-" + token, source.indexOf(token) === -1, token);
  });

  // Read-only config path: the only properties access is a get on the frozen
  // key; the classifier surface exposes no writer or legacy route.
  check("H4", source.indexOf("getProperty") !== -1 &&
    source.indexOf("TREASURY_RECEIPT_V1_CONFIG") !== -1);
  var gateKeys = Object.keys(treasuryReceiptModeGate(treasuryT3Config_({ mode: "PREPARED",
    activationID: "", activatedAt: "" })));
  check("H5", JSON.stringify(gateKeys) === JSON.stringify(["allowed", "mode", "code", "errors"]),
    JSON.stringify(gateKeys));
  check("H6", typeof treasuryDateKey === "function" && treasuryDateKey.length === 1 &&
    treasuryJournalSignature.length === 1);
}

// ---------------------------------------------------------------------------
// Mutation sensitivity — 15 in-memory mutations; each must be caught by the
// real foundation. No mutation touches source or any external state.
// ---------------------------------------------------------------------------
function testTreasuryT3MutationSensitivity() {
  var check = treasuryT3CheckFactory_("TREASURY_T3_MUTATION");
  var c = TREASURY_RECEIPT_V1_CONTRACT, codes = c.ERROR_CODES;
  var accounts = treasuryT3Accounts_();

  // M1: removed header column.
  check("M1", validateTreasurySchemaHeaders("RECEIPTS",
    c.SCHEMAS.RECEIPTS.HEADERS.slice(1)).status === "FAIL");
  // M2: swapped header columns.
  var swapped = c.SCHEMAS.RECEIPTS.HEADERS.slice();
  var first = swapped[0]; swapped[0] = swapped[2]; swapped[2] = first;
  check("M2", validateTreasurySchemaHeaders("RECEIPTS", swapped).status === "FAIL");
  // M3: added stored Status column (rejected duplicate authority).
  check("M3", validateTreasurySchemaHeaders("RECEIPTS",
    c.SCHEMAS.RECEIPTS.HEADERS.concat(["Status"])).status === "FAIL");
  // M4: changed contractVersion in config.
  check("M4", validateTreasuryReceiptConfig(treasuryT3Config_(
    { contractVersion: "SALES_RECOGNITION_V2" })).errors[0].code === codes.CONTRACT_VERSION_MISMATCH);
  // M5: missing config must never resolve to an allowed ACTIVE route.
  check("M5", treasuryReceiptConfigFromRaw(null).status === "FAIL" &&
    treasuryReceiptModeGate(null).allowed === false &&
    (typeof PropertiesService === "undefined" ?
      treasuryReceiptResolvedGate().allowed === false : true));
  // M6: ACTIVE without activation identity.
  check("M6", validateTreasuryReceiptConfig(treasuryT3Config_(
    { activatedAt: "" })).errors[0].code === codes.ACTIVATION_METADATA_MISSING &&
    treasuryReceiptModeGate(treasuryT3Config_({ activatedAt: "" })).allowed === false);
  // M7: 1030 as destination.
  check("M7", treasuryDestinationEligible("1030", accounts).code === codes.DESTINATION_IS_CLEARING);
  // M8: non-foundation account as destination.
  check("M8", treasuryDestinationEligible("1100", accounts).code ===
    codes.INVALID_DESTINATION_ACCOUNT);
  // M9: name inference (rename must never change eligibility either way).
  var bait = accounts.concat([{ AccountCode: "2999", AccountName: "Cash Foundation BluBCA",
    AccountType: "Asset", StatementGroup: "Current Assets", CashFlowGroup: "Operating",
    NormalBalance: "DEBIT", IsActive: true }]);
  check("M9", treasuryDestinationEligible("2999", bait).eligible === false &&
    treasuryDestinationEligible("1010", accounts.map(function(row) {
      var copy = {};
      Object.keys(row).forEach(function(key) { copy[key] = row[key]; });
      if (copy.AccountCode === "1010") copy.AccountName = "Renamed Wallet";
      return copy;
    })).eligible === true);
  // M10: ignoring an inactive master row.
  check("M10", treasuryDestinationEligible("1020", accounts.map(function(row) {
    return row.AccountCode === "1020" ?
      { AccountCode: "1020", AccountName: row.AccountName, AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT",
        IsActive: false } : row;
  })).code === codes.DESTINATION_ACCOUNT_INACTIVE);
  // M11: ignoring a wrong normal balance.
  check("M11", treasuryDestinationEligible("1000", accounts.map(function(row) {
    return row.AccountCode === "1000" ?
      { AccountCode: "1000", AccountName: row.AccountName, AccountType: "Asset",
        StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "CREDIT",
        IsActive: true } : row;
  })).code === codes.INVALID_DESTINATION_ACCOUNT);
  // M12: host-local (UTC) date derivation would misstate the boundary day.
  var boundary = new Date("2026-09-30T17:00:00Z");
  var originalFormatDate = Utilities.formatDate;
  Utilities.formatDate = function(date, timeZone, format) {
    return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  };
  try {
    check("M12", treasuryDateKey(boundary) === "2026-10-01" &&
      treasuryT3UtcHostDateKey_(boundary) === "2026-09-30");
    // M13: broken Jakarta boundary handling (16:59:59Z vs 17:00:00Z must differ).
    check("M13", treasuryDateKey(new Date("2026-10-11T16:59:59Z")) !==
      treasuryDateKey(new Date("2026-10-11T17:00:00Z")));
  } finally {
    Utilities.formatDate = originalFormatDate;
  }
  // M14: merged identity namespaces (TRC/TRJ must never collide).
  check("M14", treasuryReceiptId("TREASURY_RECEIPT_SAVE", "REQ-M14", "PRIMARY") !==
    treasuryJournalId("TREASURY_RECEIPT_SAVE", "REQ-M14", "PRIMARY"));
  // M15: legacy fallback surface must not exist in the gate or the source.
  var source = typeof _treasuryFoundationSource === "string" ? _treasuryFoundationSource : "";
  var refused = treasuryReceiptModeGate(treasuryT3Config_({ mode: "PREPARED",
    activationID: "", activatedAt: "" }));
  check("M15", refused.allowed === false && refused.code === codes.NOT_ACTIVATED &&
    !Object.prototype.hasOwnProperty.call(refused, "fallback") &&
    !Object.prototype.hasOwnProperty.call(refused, "legacy") &&
    source.indexOf("Payment") === -1 && source.indexOf("Settlement") === -1);
}
