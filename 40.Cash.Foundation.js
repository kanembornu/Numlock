var CASH_FOUNDATION_POLICY = Object.freeze({
  ACCOUNT_CODES: Object.freeze(["1000", "1010", "1020"]),
  ACCOUNT_METADATA: Object.freeze({
    "1000": Object.freeze({ AccountName: "Cash on Hand", AccountType: "Asset",
      StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT", IsActive: true }),
    "1010": Object.freeze({ AccountName: "DANA Business", AccountType: "Asset",
      StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT", IsActive: true }),
    "1020": Object.freeze({ AccountName: "Cash in Owner Custody - BluBCA", AccountType: "Asset",
      StatementGroup: "Current Assets", CashFlowGroup: "Operating", NormalBalance: "DEBIT", IsActive: true })
  }),
  SETTLEMENT_HEADERS: Object.freeze(["SettlementID", "Tanggal", "Direction", "AccountCode",
    "CounterAccountCode", "Amount", "Currency", "SourceType", "SourceID", "RelatedTransactionType",
    "RelatedTransactionID", "TransferID", "ExternalRef", "Status", "Keterangan", "ReversalOf",
    "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  DIRECTIONS: Object.freeze(["INFLOW", "OUTFLOW", "TRANSFER"]),
  STATUSES: Object.freeze(["PENDING", "POSTED", "FAILED", "CANCELLED", "REVERSED"]),
  NON_POSTING_STATUSES: Object.freeze(["PENDING", "FAILED", "CANCELLED"]),
  CURRENCY: "IDR",
  REVENUE_ACCOUNT: "4000",
  CUTOVER_DATE: "2026-09-30"
});

var CASH_SCHEMA_MIGRATION = Object.freeze({
  VERSION: "10F.1",
  MIGRATION_ID: "CASH-SCHEMA-20260930",
  ACCOUNTS_SHEET: "Accounts",
  SETTLEMENTS_SHEET: "Settlements",
  BALANCE_LEDGER_SHEET: "BalanceLedger",
  OPENING_SHEET: "FinanceOpeningBalances",
  ACCOUNTS_HEADERS: Object.freeze(["AccountCode", "AccountName", "AccountType", "StatementGroup",
    "CashFlowGroup", "IsActive", "CreatedAt", "UpdatedAt", "NormalBalance"]),
  BALANCE_LEDGER_HEADERS: BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS
});

var CASH_SCHEMA_RUNTIME = Object.freeze({
  PRODUCTION_MODE: "PRODUCTION",
  DISPOSABLE_MODE: "DISPOSABLE_RUNTIME_PROOF",
  DISPOSABLE_NAME_PREFIX: "NUMLOCK Cash Foundation Disposable "
});

function cashRequireSchemaExecutionRuntime(runtime) {
  if (!runtime || !runtime.spreadsheet || typeof runtime.spreadsheet.getId !== "function" ||
      typeof runtime.flush !== "function") {
    throw new Error("Cash schema executor requires explicit storage and runtime context");
  }
  var spreadsheetId = String(runtime.spreadsheet.getId() || "");
  if (runtime.mode === CASH_SCHEMA_RUNTIME.PRODUCTION_MODE) {
    if (spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID) {
      throw new Error("Cash production runtime requires canonical storage");
    }
  } else if (runtime.mode === CASH_SCHEMA_RUNTIME.DISPOSABLE_MODE) {
    var ownership = runtime.disposableOwnership;
    if (!ownership || !ownership.token || spreadsheetId !== String(ownership.spreadsheetId || "") ||
        spreadsheetId === NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID ||
        typeof runtime.spreadsheet.getName !== "function" ||
        runtime.spreadsheet.getName() !== ownership.spreadsheetName ||
        ownership.spreadsheetName.indexOf(CASH_SCHEMA_RUNTIME.DISPOSABLE_NAME_PREFIX) !== 0) {
      throw new Error("Cash disposable runtime identity verification failed");
    }
  } else {
    throw new Error("Cash schema executor requires an explicit valid mode");
  }
  return runtime;
}

function buildCashAccountTaxonomyCandidates(accounts) {
  var seen = {}, errors = [], input = (accounts || []).map(function(account) {
    return Object.assign({}, account);
  });
  input.forEach(function(account, index) {
    var code = String(account.AccountCode || "").trim();
    if (!code) return;
    if (seen[code]) errors.push({ row: index + 1, accountCode: code, code: "DUPLICATE_ACCOUNT_CODE" });
    seen[code] = true;
  });
  if (errors.length) return { status: "FAIL", readOnly: true, writeCount: 0, rows: [], errors: errors };
  var targets = {};
  CASH_FOUNDATION_POLICY.ACCOUNT_CODES.forEach(function(code) { targets[code] = true; });
  var rows = input.map(function(account) {
    var code = String(account.AccountCode || "").trim();
    return targets[code] ? Object.assign({}, account, CASH_FOUNDATION_POLICY.ACCOUNT_METADATA[code]) : account;
  });
  CASH_FOUNDATION_POLICY.ACCOUNT_CODES.forEach(function(code) {
    if (!seen[code]) rows.push(Object.assign({ AccountCode: code }, CASH_FOUNDATION_POLICY.ACCOUNT_METADATA[code]));
  });
  return { status: "PASS", readOnly: true, writeCount: 0, rows: rows, errors: [] };
}

function cashAccountMap(accounts) {
  var map = {}, duplicates = {};
  (accounts || []).forEach(function(account) {
    var code = String(account && account.AccountCode || "").trim();
    if (!code) return;
    if (map[code]) duplicates[code] = true;
    map[code] = account;
  });
  return { accounts: map, duplicates: duplicates };
}

function isAllowedActiveCashAccount(code, accountIndex) {
  code = String(code || "").trim();
  var account = accountIndex.accounts[code];
  return CASH_FOUNDATION_POLICY.ACCOUNT_CODES.indexOf(code) !== -1 && account &&
    isCanonicalActive(account.IsActive) && !accountIndex.duplicates[code];
}

function validateCashSettlements(rows, accounts) {
  var accountIndex = cashAccountMap(accounts), ids = {}, errors = [], activePostedRows = [], nonPostingRows = [];
  (rows || []).forEach(function(row, index) {
    var rowErrors = balanceContractMissingFields(row, CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS);
    var id = String(row && row.SettlementID || "").trim();
    var direction = String(row && row.Direction || "").trim();
    var status = String(row && row.Status || "").trim();
    var accountCode = String(row && row.AccountCode || "").trim();
    var counterCode = String(row && row.CounterAccountCode || "").trim();
    var amount = Number(row && row.Amount);
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_SETTLEMENT_ID");
    ids[id] = true;
    if (!capitalEquityDateKey(row && row.Tanggal)) rowErrors.push("INVALID_DATE");
    if (CASH_FOUNDATION_POLICY.DIRECTIONS.indexOf(direction) === -1) rowErrors.push("INVALID_DIRECTION");
    if (CASH_FOUNDATION_POLICY.STATUSES.indexOf(status) === -1) rowErrors.push("INVALID_STATUS");
    if (!isFinite(amount) || amount <= 0) rowErrors.push("INVALID_AMOUNT");
    if (String(row && row.Currency || "").trim() !== CASH_FOUNDATION_POLICY.CURRENCY) rowErrors.push("INVALID_CURRENCY");
    if (!isAllowedActiveCashAccount(accountCode, accountIndex)) rowErrors.push("INACTIVE_OR_INVALID_CASH_ACCOUNT");
    if (direction === "TRANSFER") {
      if (!counterCode) rowErrors.push("MISSING_COUNTER_ACCOUNT");
      else if (!isAllowedActiveCashAccount(counterCode, accountIndex)) rowErrors.push("INACTIVE_OR_INVALID_COUNTER_CASH_ACCOUNT");
      if (accountCode && accountCode === counterCode) rowErrors.push("TRANSFER_SAME_ACCOUNT");
      if (!String(row && row.TransferID || "").trim()) rowErrors.push("MISSING_TRANSFER_ID");
    } else if (counterCode) rowErrors.push("UNEXPECTED_COUNTER_ACCOUNT");
    if (rowErrors.length) errors.push({ row: index + 1, settlementId: id, errors: rowErrors });
    if (!rowErrors.length && isCanonicalActive(row.IsActive) && status === "POSTED") activePostedRows.push(row);
    else if (!rowErrors.length) nonPostingRows.push(row);
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, activePostedRows: activePostedRows,
    nonPostingRows: nonPostingRows };
}

function cashTransactionById(transactions, id, type) {
  var matches = (transactions || []).filter(function(transaction) {
    return String(transaction && transaction.id || transaction && transaction.ID_Trx || "").trim() === id &&
      String(transaction && transaction.canonicalTransactionType || "").trim() === type &&
      isCanonicalActive(transaction.isActive === undefined ? transaction.IsActive : transaction.isActive);
  });
  return matches.length === 1 ? matches[0] : null;
}

function cashLedgerLine(journalId, suffix, settlement, accountCode, debit, credit, movementType, sourceType, sourceId) {
  return { JournalID: journalId, LineID: journalId + "-" + suffix, Tanggal: capitalEquityDateKey(settlement.Tanggal),
    AccountCode: accountCode, Debit: debit, Credit: credit, MovementType: movementType,
    SourceType: sourceType, SourceID: sourceId, ExternalRef: String(settlement.ExternalRef || ""),
    Keterangan: String(settlement.Keterangan || ""), IsActive: true,
    CreatedAt: settlement.CreatedAt || "", CreatedBy: settlement.CreatedBy || "",
    UpdatedAt: settlement.UpdatedAt || "", UpdatedBy: settlement.UpdatedBy || "" };
}

function cashJournalSignature(rows) {
  return (rows || []).map(function(row) {
    return [String(row.AccountCode), Number(row.Debit), Number(row.Credit), String(row.MovementType),
      String(row.SourceType), String(row.SourceID), capitalEquityDateKey(row.Tanggal)].join("|");
  }).sort().join("||");
}

function cashExistingSourceRows(rows, sourceType, sourceId) {
  return (rows || []).filter(function(row) {
    return isCanonicalActive(row.IsActive) && String(row.SourceType || "").trim() === sourceType &&
      String(row.SourceID || "").trim() === sourceId;
  });
}

function cashTransactionEffectAlreadyPosted(rows, transactionId, accountCode, side) {
  return (rows || []).some(function(row) {
    return isCanonicalActive(row.IsActive) && String(row.SourceID || "").trim() === transactionId &&
      String(row.AccountCode || "").trim() === accountCode && Number(row[side]) > 0;
  });
}

function buildCashPostingCandidate(settlement, context) {
  context = context || {};
  var validation = validateCashSettlements([settlement], context.accounts || []);
  if (validation.status !== "PASS") return { status: "REFUSED", reason: "INVALID_SETTLEMENT",
    errors: validation.errors, readOnly: true, writeCount: 0 };
  if (!isCanonicalActive(settlement.IsActive) || String(settlement.Status) !== "POSTED") {
    return { status: "NO_POST", reason: "SETTLEMENT_NOT_ACTIVE_POSTED", readOnly: true, writeCount: 0, rows: [] };
  }
  var direction = String(settlement.Direction), amount = Number(settlement.Amount);
  var sourceType = String(settlement.SourceType || "").trim(), sourceId = String(settlement.SourceID || "").trim();
  if (!sourceType || !sourceId) return { status: "REFUSED", reason: "MISSING_SOURCE_KEY", readOnly: true, writeCount: 0 };
  var journalId = "CASH-" + sourceType + "-" + sourceId;
  var lines = [], transactionId = String(settlement.RelatedTransactionID || "").trim();
  if (direction === "TRANSFER") {
    if (sourceType !== "CASH_TRANSFER" || sourceId !== String(settlement.TransferID || "").trim()) {
      return { status: "REFUSED", reason: "INVALID_TRANSFER_SOURCE_KEY", readOnly: true, writeCount: 0 };
    }
    lines = [
      cashLedgerLine(journalId, "1", settlement, String(settlement.CounterAccountCode), amount, 0,
        "CASH_TRANSFER", sourceType, sourceId),
      cashLedgerLine(journalId, "2", settlement, String(settlement.AccountCode), 0, amount,
        "CASH_TRANSFER", sourceType, sourceId)
    ];
  } else if (direction === "INFLOW") {
    var sale = cashTransactionById(context.transactions, transactionId, "Sales");
    if (!sale || String(settlement.RelatedTransactionType || "") !== "Sales" ||
        sale.paymentTiming !== "AT_RECOGNITION" || Number(sale.approvedPaidAmount) !== amount ||
        Number(sale.amount) !== amount || capitalEquityDateKey(sale.dateKey || sale.Tanggal) !== capitalEquityDateKey(settlement.Tanggal)) {
      return { status: "REFUSED", reason: "REFUSED_UNSUPPORTED_ACCRUAL_SETTLEMENT", readOnly: true, writeCount: 0 };
    }
    var revenueAccount = String(sale.revenueAccountCode || CASH_FOUNDATION_POLICY.REVENUE_ACCOUNT).trim();
    if (cashTransactionEffectAlreadyPosted(context.balanceLedgerRows, transactionId, revenueAccount, "Credit")) {
      return { status: "REFUSED", reason: "TRANSACTION_EFFECT_ALREADY_POSTED", readOnly: true, writeCount: 0 };
    }
    lines = [
      cashLedgerLine(journalId, "1", settlement, String(settlement.AccountCode), amount, 0,
        "PAID_SALE", sourceType, sourceId),
      cashLedgerLine(journalId, "2", settlement, revenueAccount, 0, amount,
        "PAID_SALE", sourceType, sourceId)
    ];
  } else {
    var expense = cashTransactionById(context.transactions, transactionId, "Expense");
    if (!expense || String(settlement.RelatedTransactionType || "") !== "Expense" ||
        expense.paymentTiming !== "AT_RECOGNITION" || Number(expense.approvedPaidAmount) !== amount ||
        Number(expense.amount) !== amount || capitalEquityDateKey(expense.dateKey || expense.Tanggal) !== capitalEquityDateKey(settlement.Tanggal) ||
        !String(expense.expenseAccountCode || "").trim()) {
      return { status: "REFUSED", reason: "REFUSED_UNSUPPORTED_ACCRUAL_SETTLEMENT", readOnly: true, writeCount: 0 };
    }
    if (cashTransactionEffectAlreadyPosted(context.balanceLedgerRows, transactionId,
        String(expense.expenseAccountCode).trim(), "Debit")) {
      return { status: "REFUSED", reason: "TRANSACTION_EFFECT_ALREADY_POSTED", readOnly: true, writeCount: 0 };
    }
    lines = [
      cashLedgerLine(journalId, "1", settlement, String(expense.expenseAccountCode), amount, 0,
        "PAID_EXPENSE", sourceType, sourceId),
      cashLedgerLine(journalId, "2", settlement, String(settlement.AccountCode), 0, amount,
        "PAID_EXPENSE", sourceType, sourceId)
    ];
  }
  var ledgerValidation = validateBalanceLedgerCandidates(lines, context.accounts || []);
  if (ledgerValidation.status !== "PASS") return { status: "REFUSED", reason: "INVALID_BALANCED_JOURNAL",
    errors: ledgerValidation.errors, readOnly: true, writeCount: 0 };
  var existing = cashExistingSourceRows(context.balanceLedgerRows, sourceType, sourceId);
  if (existing.length) {
    return cashJournalSignature(existing) === cashJournalSignature(lines) ?
      { status: "ALREADY_POSTED", readOnly: true, writeCount: 0, rows: existing } :
      { status: "REFUSED", reason: "REFUSED_DUPLICATE_SOURCE", readOnly: true, writeCount: 0 };
  }
  return { status: "READY", readOnly: true, writeCount: 0, rows: lines, journalId: journalId,
    externalCashFlowClassification: direction === "TRANSFER" ? "EXCLUDED" : "BY_TRANSACTION_SUBSTANCE" };
}

function buildCashReversalCandidate(reversal, context) {
  context = context || {};
  var originals = (context.settlements || []).filter(function(row) {
    return String(row.SettlementID || "").trim() === String(reversal.ReversalOf || "").trim();
  });
  if (originals.length !== 1 || String(originals[0].Status) !== "POSTED" || !isCanonicalActive(originals[0].IsActive)) {
    return { status: "REFUSED", reason: "INVALID_REVERSAL_ORIGINAL", readOnly: true, writeCount: 0 };
  }
  var original = originals[0];
  if (Number(reversal.Amount) !== Number(original.Amount)) {
    return { status: "REFUSED", reason: "REFUSED_UNSUPPORTED_PARTIAL_REVERSAL", readOnly: true, writeCount: 0 };
  }
  var alreadyReversed = (context.settlements || []).some(function(row) {
    return isCanonicalActive(row.IsActive) && String(row.ReversalOf || "").trim() === String(original.SettlementID).trim() &&
      String(row.Status || "").trim() === "POSTED";
  });
  if (alreadyReversed) return { status: "REFUSED", reason: "ALREADY_REVERSED", readOnly: true, writeCount: 0 };
  var originalRows = cashExistingSourceRows(context.balanceLedgerRows,
    String(original.SourceType || "").trim(), String(original.SourceID || "").trim());
  if (!originalRows.length) return { status: "REFUSED", reason: "ORIGINAL_JOURNAL_NOT_FOUND", readOnly: true, writeCount: 0 };
  var sourceType = "SETTLEMENT_REVERSAL", sourceId = String(reversal.SettlementID || "").trim();
  if (!sourceId) return { status: "REFUSED", reason: "MISSING_REVERSAL_SETTLEMENT_ID", readOnly: true, writeCount: 0 };
  var journalId = "CASH-REVERSAL-" + sourceId;
  var lines = originalRows.map(function(row, index) {
    return cashLedgerLine(journalId, String(index + 1), reversal, String(row.AccountCode), Number(row.Credit),
      Number(row.Debit), "SETTLEMENT_REVERSAL", sourceType, sourceId);
  });
  var ledgerValidation = validateBalanceLedgerCandidates(lines, context.accounts || []);
  if (ledgerValidation.status !== "PASS") return { status: "REFUSED", reason: "INVALID_BALANCED_JOURNAL",
    errors: ledgerValidation.errors, readOnly: true, writeCount: 0 };
  var existing = cashExistingSourceRows(context.balanceLedgerRows, sourceType, sourceId);
  if (existing.length) return cashJournalSignature(existing) === cashJournalSignature(lines) ?
    { status: "ALREADY_POSTED", readOnly: true, writeCount: 0, rows: existing } :
    { status: "REFUSED", reason: "REFUSED_DUPLICATE_SOURCE", readOnly: true, writeCount: 0 };
  return { status: "READY", readOnly: true, writeCount: 0, rows: lines, journalId: journalId,
    originalSettlementPreserved: true };
}

function buildCashBalanceReadModel(accounts, openingRows, ledgerRows, observedBalances) {
  var accountIndex = cashAccountMap(accounts), observed = observedBalances || {}, results = [];
  var openingValidation = validateCashOpeningRows(openingRows, accounts);
  CASH_FOUNDATION_POLICY.ACCOUNT_CODES.forEach(function(code) {
    var account = accountIndex.accounts[code];
    if (!account || !isCanonicalActive(account.IsActive) || accountIndex.duplicates[code]) return;
    var openings = (openingRows || []).filter(function(row) {
      return isCanonicalActive(row.IsActive) && String(row.AccountCode || "").trim() === code;
    });
    var validOpening = openingValidation.status === "PASS" && openings.length === 1;
    if (!validOpening) {
      results.push({ AccountCode: code, AccountName: String(account.AccountName || ""), OpeningBalance: null,
        Debits: null, Credits: null, ClosingBalance: null, CutoverDate: CASH_FOUNDATION_POLICY.CUTOVER_DATE,
        ReconciliationStatus: "UNAVAILABLE" });
      return;
    }
    var debits = 0, credits = 0;
    (ledgerRows || []).forEach(function(row) {
      var date = capitalEquityDateKey(row.Tanggal);
      if (isCanonicalActive(row.IsActive) && String(row.AccountCode || "").trim() === code &&
          date && date > CASH_FOUNDATION_POLICY.CUTOVER_DATE) {
        debits += Number(row.Debit); credits += Number(row.Credit);
      }
    });
    var opening = Number(openings[0].Debit), closing = opening + debits - credits;
    var hasObserved = Object.prototype.hasOwnProperty.call(observed, code) && isFinite(Number(observed[code]));
    results.push({ AccountCode: code, AccountName: String(account.AccountName || ""), OpeningBalance: opening,
      Debits: debits, Credits: credits, ClosingBalance: closing, CutoverDate: CASH_FOUNDATION_POLICY.CUTOVER_DATE,
      ReconciliationStatus: !hasObserved ? "UNRECONCILED" : Number(observed[code]) === closing ? "RECONCILED" : "MISMATCH" });
  });
  return { status: results.some(function(row) { return row.ReconciliationStatus === "UNAVAILABLE"; }) ?
    "UNAVAILABLE" : "AVAILABLE", readOnly: true, writeCount: 0, accounts: results };
}

function cashExactHeaders(values, headers) {
  return values && values.length && JSON.stringify(values[0].map(String)) === JSON.stringify(headers) &&
    values.every(function(row) { return row.length === headers.length; });
}

function cashRowsFromPhysical(state) {
  return !state || !state.exists ? [] : balanceFoundationRowsFromValues(state.values || []);
}

function cashAccountMetadataMatches(row, code) {
  var expected = CASH_FOUNDATION_POLICY.ACCOUNT_METADATA[code];
  return expected && ["AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "NormalBalance"]
    .every(function(field) { return String(row[field] == null ? "" : row[field]).trim() === expected[field]; }) &&
    isCanonicalActive(row.IsActive);
}

function classifyCashAccountsState(state) {
  if (!state || !state.exists || !cashExactHeaders(state.values, CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS)) return "INVALID";
  var rows = cashRowsFromPhysical(state), index = cashAccountMap(rows), present = [];
  if (Object.keys(index.duplicates).length || rows.some(function(row) { return !String(row.AccountCode || "").trim(); }) ||
      !index.accounts["1000"] || !isCanonicalActive(index.accounts["1000"].IsActive)) return "INVALID";
  if (["Cash", "Cash on Hand"].indexOf(String(index.accounts["1000"].AccountName || "").trim()) === -1 ||
      String(index.accounts["1000"].AccountType || "").trim() !== "Asset" ||
      String(index.accounts["1000"].StatementGroup || "").trim() !== "Current Assets" ||
      String(index.accounts["1000"].CashFlowGroup || "").trim() !== "Operating") return "INVALID";
  for (var i = 0; i < CASH_FOUNDATION_POLICY.ACCOUNT_CODES.length; i++) {
    var code = CASH_FOUNDATION_POLICY.ACCOUNT_CODES[i], row = index.accounts[code];
    if (!row) continue;
    present.push(code);
    if (code !== "1000" && !cashAccountMetadataMatches(row, code)) return "INVALID";
  }
  if (present.length === 3 && CASH_FOUNDATION_POLICY.ACCOUNT_CODES.every(function(code) {
    return cashAccountMetadataMatches(index.accounts[code], code);
  })) return "CASH_TAXONOMY_READY";
  if (present.length === 1 && String(index.accounts["1000"].AccountName || "").trim() === "Cash" &&
      String(index.accounts["1000"].NormalBalance || "").trim() === "") return "LEGACY_CASH_TAXONOMY";
  return "PARTIAL_CASH_TAXONOMY";
}

function classifyCashTableState(state, headers, validator, accounts) {
  if (!state || !state.exists) return "ABSENT";
  if (!cashExactHeaders(state.values, headers)) return "INVALID";
  var rows = cashRowsFromPhysical(state);
  if (!rows.length) return "EMPTY_VALID";
  return validator(rows, accounts).status === "PASS" ? "POPULATED_VALID" : "INVALID";
}

function validateCashOpeningRows(rows, accounts) {
  var accountIndex = cashAccountMap(accounts), seen = {}, ids = {}, errors = [], activeRows = [];
  (rows || []).forEach(function(row, index) {
    if (!isCanonicalActive(row.IsActive) || CASH_FOUNDATION_POLICY.ACCOUNT_CODES.indexOf(String(row.AccountCode || "").trim()) === -1) return;
    activeRows.push(row);
    var rowErrors = balanceContractMissingFields(row, BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS);
    var code = String(row.AccountCode || "").trim(), date = capitalEquityDateKey(row.EffectiveDate);
    var debit = Number(row.Debit), credit = Number(row.Credit), key = date + "|" + code;
    var id = String(row.ID || "").trim();
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_ID");
    ids[id] = true;
    if (!cashAccountMetadataMatches(accountIndex.accounts[code], code)) rowErrors.push("INACTIVE_OR_INVALID_CASH_ACCOUNT");
    if (date !== CASH_FOUNDATION_POLICY.CUTOVER_DATE) rowErrors.push("INVALID_CASH_OPENING_DATE");
    if (!isFinite(debit) || debit < 0) rowErrors.push("INVALID_CASH_DEBIT");
    if (!isFinite(credit) || credit !== 0) rowErrors.push("INVALID_CASH_CREDIT");
    if (!String(row.Source || "").trim()) rowErrors.push("MISSING_SOURCE");
    if (!String(row.ExternalRef || "").trim()) rowErrors.push("MISSING_CASH_OPENING_EXTERNAL_REF");
    if (!String(row.Keterangan || "").trim()) rowErrors.push("MISSING_CASH_OPENING_KETERANGAN");
    if (debit === 0 && (!String(row.ExternalRef || "").trim() ||
        String(row.Keterangan || "").toLowerCase().indexOf("observed balance = 0") === -1)) {
      rowErrors.push("MISSING_ZERO_OPENING_EVIDENCE");
    }
    if (seen[key]) rowErrors.push("DUPLICATE_ACTIVE_DATE_ACCOUNT");
    seen[key] = true;
    if (rowErrors.length) errors.push({ row: index + 1, accountCode: code, errors: rowErrors });
  });
  return { status: errors.length ? "FAIL" : "PASS", activeRows: activeRows, errors: errors };
}

function classifyCashOpeningState(state, accounts) {
  if (!state || !state.exists || !cashExactHeaders(state.values, BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS)) return "INVALID";
  var rows = cashRowsFromPhysical(state), cashRows = rows.filter(function(row) {
    return isCanonicalActive(row.IsActive) && CASH_FOUNDATION_POLICY.ACCOUNT_CODES.indexOf(String(row.AccountCode || "").trim()) !== -1;
  });
  var nonCashRows = rows.filter(function(row) { return CASH_FOUNDATION_POLICY.ACCOUNT_CODES.indexOf(String(row.AccountCode || "").trim()) === -1; });
  var ids = {};
  if (rows.some(function(row) { var id = String(row.ID || "").trim(); if (!id || ids[id]) return true; ids[id] = true; return false; })) return "INVALID";
  if (validateFinanceOpeningBalanceCandidates(nonCashRows, accounts).status !== "PASS" ||
      validateCashOpeningRows(cashRows, accounts).status !== "PASS") return "INVALID";
  var codes = {};
  cashRows.forEach(function(row) { codes[String(row.AccountCode).trim()] = true; });
  var count = Object.keys(codes).length;
  return count === 0 ? "READY_NO_CASH_OPENINGS" : count === 3 && cashRows.length === 3 ?
    "READY_WITH_CASH_OPENINGS" : "PARTIAL_CASH_OPENINGS";
}

function buildCashAccountsTarget(state, timestamp) {
  var classification = classifyCashAccountsState(state);
  if (["LEGACY_CASH_TAXONOMY", "PARTIAL_CASH_TAXONOMY", "CASH_TAXONOMY_READY"].indexOf(classification) === -1) {
    return { status: "REFUSED", reason: "INVALID_ACCOUNTS", writeCount: 0 };
  }
  var rows = cashRowsFromPhysical(state), index = cashAccountMap(rows), changed = false;
  var targetRows = rows.map(function(row) {
    var code = String(row.AccountCode || "").trim(), expected = CASH_FOUNDATION_POLICY.ACCOUNT_METADATA[code];
    if (!expected) return Object.assign({}, row);
    var target = Object.assign({}, row, expected);
    if (!cashAccountMetadataMatches(row, code)) { target.UpdatedAt = timestamp; changed = true; }
    return target;
  });
  ["1010", "1020"].forEach(function(code) {
    if (!index.accounts[code]) {
      targetRows.push(Object.assign({ AccountCode: code, CreatedAt: timestamp, UpdatedAt: timestamp },
        CASH_FOUNDATION_POLICY.ACCOUNT_METADATA[code]));
      changed = true;
    }
  });
  var values = [CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.slice()].concat(targetRows.map(function(row) {
    return CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }));
  return { status: "PASS", changed: changed, writeCount: changed ? 1 : 0, values: values, rows: targetRows };
}

function buildCashSchemaMigrationPlan(state, timestamp) {
  var accountsClass = classifyCashAccountsState(state.accounts);
  var accounts = cashRowsFromPhysical(state.accounts);
  var classes = { accounts: accountsClass,
    financeOpeningBalances: classifyCashOpeningState(state.opening, accounts),
    settlements: classifyCashTableState(state.settlements, CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS,
      validateCashSettlements, accounts),
    balanceLedger: classifyCashTableState(state.balanceLedger, CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS,
      validateBalanceLedgerCandidates, accounts) };
  if (Object.keys(classes).some(function(key) { return classes[key] === "INVALID"; }) ||
      classes.financeOpeningBalances === "PARTIAL_CASH_OPENINGS") {
    return { status: "REFUSED", reason: "INVALID_OR_PARTIAL_STATE", classifications: classes, writeCount: 0 };
  }
  var target = buildCashAccountsTarget(state.accounts, timestamp);
  if (target.status !== "PASS") return { status: "REFUSED", reason: target.reason, classifications: classes, writeCount: 0 };
  var createSettlements = classes.settlements === "ABSENT";
  var createBalanceLedger = classes.balanceLedger === "ABSENT";
  var writeCount = target.writeCount + (createSettlements ? 1 : 0) + (createBalanceLedger ? 1 : 0);
  return { status: writeCount ? "READY" : "ALREADY_MIGRATED", classifications: classes,
    operations: { writeAccounts: !!target.writeCount, createSettlements: createSettlements,
      createBalanceLedger: createBalanceLedger }, writeCount: writeCount, targetAccounts: target.values };
}

function cashPhysicalSnapshot(sheet) {
  if (!sheet) return { exists: false };
  var values = balanceFoundationSheetSnapshot(sheet);
  var formulas = values.length ? sheet.getRange(1, 1, values.length, values[0].length).getFormulas() : [];
  return { exists: true, values: values, formulas: formulas, maxRows: sheet.getMaxRows(), maxColumns: sheet.getMaxColumns() };
}

function readCashSchemaMigrationState(ss) {
  return { accounts: cashPhysicalSnapshot(ss.getSheetByName(CASH_SCHEMA_MIGRATION.ACCOUNTS_SHEET)),
    opening: cashPhysicalSnapshot(ss.getSheetByName(CASH_SCHEMA_MIGRATION.OPENING_SHEET)),
    settlements: cashPhysicalSnapshot(ss.getSheetByName(CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET)),
    balanceLedger: cashPhysicalSnapshot(ss.getSheetByName(CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_SHEET)) };
}

function cashFingerprint(value) {
  var text = JSON.stringify(value), hash = 2166136261;
  for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24); }
  return (hash >>> 0).toString(16);
}

function cashRestoreSheet(sheet, snapshot) {
  balanceFoundationRestoreGridDimensions(sheet, snapshot);
  sheet.getDataRange().clearContent();
  if (snapshot.values.length) sheet.getRange(1, 1, snapshot.values.length, snapshot.values[0].length).setValues(snapshot.values);
  (snapshot.formulas || []).forEach(function(row, rowIndex) {
    row.forEach(function(formula, columnIndex) {
      if (formula) sheet.getRange(rowIndex + 1, columnIndex + 1).setFormula(formula);
    });
  });
}

function cashEnsureSheetRows(sheet, targetRows) {
  if (sheet.getMaxRows() < targetRows) sheet.insertRowsAfter(sheet.getMaxRows(), targetRows - sheet.getMaxRows());
}

function validateCashMigrationAcceptance(before, plan, after) {
  var accountsReady = classifyCashAccountsState(after.accounts) === "CASH_TAXONOMY_READY";
  var settlementsClass = classifyCashTableState(after.settlements, CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS,
    validateCashSettlements, cashRowsFromPhysical(after.accounts));
  var ledgerClass = classifyCashTableState(after.balanceLedger, CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS,
    validateBalanceLedgerCandidates, cashRowsFromPhysical(after.accounts));
  var openingSame = cashFingerprint(before.opening) === cashFingerprint(after.opening);
  var populatedPreserved = (!before.settlements.exists || cashFingerprint(before.settlements) === cashFingerprint(after.settlements)) &&
    (!before.balanceLedger.exists || cashFingerprint(before.balanceLedger) === cashFingerprint(after.balanceLedger));
  return { status: accountsReady && ["EMPTY_VALID", "POPULATED_VALID"].indexOf(settlementsClass) !== -1 &&
    ["EMPTY_VALID", "POPULATED_VALID"].indexOf(ledgerClass) !== -1 && openingSame && populatedPreserved ? "PASS" : "FAIL",
    accounts: accountsReady, settlements: settlementsClass, balanceLedger: ledgerClass,
    openingUnchanged: openingSame, preExistingStoragePreserved: populatedPreserved };
}

function executeCashFoundationSchemaRecoveryWithRuntime(runtime, record) {
  cashRequireSchemaExecutionRuntime(runtime);
  if (!record || record.migrationId !== CASH_SCHEMA_MIGRATION.MIGRATION_ID || record.version !== CASH_SCHEMA_MIGRATION.VERSION ||
      !record.snapshot || !record.acceptedPostState || record.preStateFingerprint !== cashFingerprint(record.snapshot) ||
      record.postStateFingerprint !== cashFingerprint(record.acceptedPostState)) {
    return { status: "REFUSED", reason: "INCOMPLETE_OR_UNIDENTIFIED_SNAPSHOT", writeCount: 0 };
  }
  var current = readCashSchemaMigrationState(runtime.spreadsheet);
  if (cashFingerprint(current.accounts) !== cashFingerprint(record.acceptedPostState.accounts)) {
    return { status: "REFUSED", reason: "ACCOUNTS_POST_IMAGE_CHANGED", writeCount: 0 };
  }
  var owned = record.createdSheets || {};
  for (var name in owned) if (owned[name]) {
    var key = name === CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET ? "settlements" : "balanceLedger";
    var headers = key === "settlements" ? CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS : CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS;
    if (record.snapshot[key].exists || classifyCashTableState(current[key], headers,
        key === "settlements" ? validateCashSettlements : validateBalanceLedgerCandidates,
        cashRowsFromPhysical(current.accounts)) !== "EMPTY_VALID") {
      return { status: "REFUSED", reason: "CREATED_STORAGE_NOT_HEADER_ONLY", writeCount: 0 };
    }
  }
  var writes = 0;
  try {
    cashRestoreSheet(runtime.spreadsheet.getSheetByName(CASH_SCHEMA_MIGRATION.ACCOUNTS_SHEET), record.snapshot.accounts); writes++;
    [CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET, CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_SHEET].forEach(function(name) {
      if (owned[name]) { runtime.spreadsheet.deleteSheet(runtime.spreadsheet.getSheetByName(name)); writes++; }
    });
    runtime.flush();
    var restored = readCashSchemaMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    if (cashFingerprint(restored) !== cashFingerprint(record.snapshot)) throw new Error("RECOVERY_VERIFICATION_FAILED");
    return { status: "RECOVERED", writeCount: writes };
  } catch (error) { return { status: "FAILED_ROLLBACK", reason: error.message, writeCount: writes }; }
}

function executeCashFoundationSchemaMigrationWithRuntime(runtime) {
  cashRequireSchemaExecutionRuntime(runtime);
  var before = readCashSchemaMigrationState(runtime.spreadsheet);
  var plan = buildCashSchemaMigrationPlan(before, runtime.timestamp);
  if (plan.status === "REFUSED" || plan.status === "ALREADY_MIGRATED") return Object.assign({}, plan, { writeCount: 0 });
  var created = {}, writes = 0, record = { migrationId: CASH_SCHEMA_MIGRATION.MIGRATION_ID,
    version: CASH_SCHEMA_MIGRATION.VERSION, timestamp: runtime.timestamp, snapshot: before,
    preStateFingerprint: cashFingerprint(before), writeCount: plan.writeCount };
  try {
    if (plan.operations.writeAccounts) {
      var accountsSheet = runtime.spreadsheet.getSheetByName(CASH_SCHEMA_MIGRATION.ACCOUNTS_SHEET);
      cashEnsureSheetRows(accountsSheet, plan.targetAccounts.length);
      balanceFoundationReplaceSheetValues(accountsSheet, plan.targetAccounts); writes++;
    }
    if (plan.operations.createSettlements) {
      var settlementsSheet = runtime.spreadsheet.insertSheet(CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET);
      created[CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET] = true;
      settlementsSheet.getRange(1, 1, 1, CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.length)
        .setValues([CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.slice()]); writes++;
    }
    if (plan.operations.createBalanceLedger) {
      var balanceLedgerSheet = runtime.spreadsheet.insertSheet(CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_SHEET);
      created[CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_SHEET] = true;
      balanceLedgerSheet.getRange(1, 1, 1, CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS.length)
        .setValues([CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS.slice()]); writes++;
    }
    runtime.flush();
    var after = readCashSchemaMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    var acceptance = validateCashMigrationAcceptance(before, plan, after);
    if (acceptance.status !== "PASS") throw new Error("CASH_SCHEMA_ACCEPTANCE_FAILED");
    record.createdSheets = created; record.acceptedPostState = after; record.postStateFingerprint = cashFingerprint(after);
    return { status: "MIGRATED", writeCount: writes, classifications: plan.classifications,
      acceptance: acceptance, migrationRecord: record };
  } catch (error) {
    record.createdSheets = created;
    record.acceptedPostState = readCashSchemaMigrationState(runtime.spreadsheet);
    record.postStateFingerprint = cashFingerprint(record.acceptedPostState);
    var recovery = executeCashFoundationSchemaRecoveryWithRuntime(runtime, record);
    return { status: recovery.status === "RECOVERED" ? "FAILED_ROLLED_BACK" : "FAILED_ROLLBACK",
      reason: error.message, rollback: recovery, writeCount: writes };
  }
}

function runCashFoundationSchemaMigration() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeCashFoundationSchemaMigrationWithRuntime({ mode: CASH_SCHEMA_RUNTIME.PRODUCTION_MODE,
      spreadsheet: spreadsheet,
      freshSpreadsheet: function() { return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } }); },
      flush: function() { SpreadsheetApp.flush(); }, timestamp: new Date() });
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function runCashFoundationSchemaRecovery(migrationRecord) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeCashFoundationSchemaRecoveryWithRuntime({ mode: CASH_SCHEMA_RUNTIME.PRODUCTION_MODE,
      spreadsheet: spreadsheet,
      freshSpreadsheet: function() { return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } }); },
      flush: function() { SpreadsheetApp.flush(); } }, migrationRecord);
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function cashDisposableRuntimeProofRequire(condition, message) {
  if (!condition) throw new Error("Disposable Cash Foundation runtime proof failed: " + message);
}

function cashDisposableFixtureValues() {
  var audit = new Date(2026, 7, 13, 5, 0, 0);
  var accounts = BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CODES.map(function(code) {
    var core = BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE[code];
    return [code, core[0], core[1], core[2], core[3], true,
      new Date(audit.getTime()), new Date(audit.getTime()), ""];
  });
  var openingAudit = new Date(2026, 8, 1, 15, 40, 15);
  var opening = {
    ID: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_ID,
    EffectiveDate: new Date(2026, 6, 31), AccountCode: "3200", Debit: 0, Credit: 7407000,
    Source: CAPITAL_EQUITY_POLICY.SOURCE, ExternalRef: "",
    Keterangan: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_DESCRIPTION,
    IsActive: true, CreatedAt: new Date(openingAudit.getTime()),
    CreatedBy: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER,
    UpdatedAt: new Date(openingAudit.getTime()),
    UpdatedBy: BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.OPENING_USER
  };
  return {
    accounts: [CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.slice()].concat(accounts),
    opening: [BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.slice(),
      BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS.map(function(header) { return opening[header]; })]
  };
}

function cashDisposableSettlementRow() {
  return { SettlementID: "DISPOSABLE-SET-1", Tanggal: new Date(2026, 9, 1), Direction: "INFLOW",
    AccountCode: "1000", CounterAccountCode: "", Amount: 1000, Currency: "IDR",
    SourceType: "DISPOSABLE_PROOF", SourceID: "DISPOSABLE-SOURCE-1", RelatedTransactionType: "Sales",
    RelatedTransactionID: "DISPOSABLE-SALE-1", TransferID: "", ExternalRef: "DISPOSABLE",
    Status: "POSTED", Keterangan: "Disposable proof row", ReversalOf: "", IsActive: true,
    CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
}

function cashDisposableLedgerRows() {
  var common = { JournalID: "DISPOSABLE-JOURNAL-1", Tanggal: new Date(2026, 9, 1),
    MovementType: "DISPOSABLE_PROOF", SourceType: "DISPOSABLE_PROOF", SourceID: "DISPOSABLE-SOURCE-1",
    ExternalRef: "DISPOSABLE", Keterangan: "Disposable proof row", IsActive: true,
    CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  return [Object.assign({}, common, { LineID: "DISPOSABLE-LINE-1", AccountCode: "1000", Debit: 1000, Credit: 0 }),
    Object.assign({}, common, { LineID: "DISPOSABLE-LINE-2", AccountCode: "4000", Debit: 0, Credit: 1000 })];
}

function cashDisposableRowsToValues(headers, rows) {
  return [headers.slice()].concat(rows.map(function(row) {
    return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
  }));
}

function cashDisposableCreateFixture(runtime, canonicalId, owned, label, storageState) {
  var token = runtime.createToken(), name = CASH_SCHEMA_RUNTIME.DISPOSABLE_NAME_PREFIX + label + " " + token;
  var spreadsheet = runtime.createSpreadsheet(name, 1000, CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.length);
  var id = String(spreadsheet && spreadsheet.getId ? spreadsheet.getId() : "");
  var ownership = { token: token, spreadsheetId: id, spreadsheetName: name };
  owned.push(ownership);
  cashDisposableRuntimeProofRequire(id && id !== canonicalId && id !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
    "disposable identity must differ from production");
  cashDisposableRuntimeProofRequire(spreadsheet.getName() === name && spreadsheet.getSheets().length === 1,
    "new disposable spreadsheet identity and initial sheet set");
  var fixture = cashDisposableFixtureValues(), accounts = spreadsheet.getSheets()[0];
  accounts.setName(CASH_SCHEMA_MIGRATION.ACCOUNTS_SHEET);
  balanceFoundationResizeDisposableSheet(accounts, fixture.accounts.length, fixture.accounts[0].length);
  accounts.getRange(1, 1, fixture.accounts.length, fixture.accounts[0].length).setValues(fixture.accounts);
  var opening = spreadsheet.insertSheet(CASH_SCHEMA_MIGRATION.OPENING_SHEET);
  balanceFoundationResizeDisposableSheet(opening, fixture.opening.length, fixture.opening[0].length);
  opening.getRange(1, 1, fixture.opening.length, fixture.opening[0].length).setValues(fixture.opening);
  if (storageState) {
    var settlementsValues = cashDisposableRowsToValues(CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS,
      storageState === "POPULATED" ? [cashDisposableSettlementRow()] : []);
    var settlements = spreadsheet.insertSheet(CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET);
    balanceFoundationResizeDisposableSheet(settlements, settlementsValues.length, settlementsValues[0].length);
    settlements.getRange(1, 1, settlementsValues.length, settlementsValues[0].length).setValues(settlementsValues);
    var ledgerValues = cashDisposableRowsToValues(CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS,
      storageState === "POPULATED" ? cashDisposableLedgerRows() : []);
    var ledger = spreadsheet.insertSheet(CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_SHEET);
    balanceFoundationResizeDisposableSheet(ledger, ledgerValues.length, ledgerValues[0].length);
    ledger.getRange(1, 1, ledgerValues.length, ledgerValues[0].length).setValues(ledgerValues);
  }
  runtime.flush();
  var expectedNames = [CASH_SCHEMA_MIGRATION.ACCOUNTS_SHEET, CASH_SCHEMA_MIGRATION.OPENING_SHEET]
    .concat(storageState ? [CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET, CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_SHEET] : [])
    .sort();
  var actualNames = spreadsheet.getSheets().map(function(sheet) { return sheet.getName(); }).sort();
  cashDisposableRuntimeProofRequire(JSON.stringify(actualNames) === JSON.stringify(expectedNames),
    "unexpected disposable fixture sheet set");
  return ownership;
}

function cashDisposableExecutionContext(runtime, ownership) {
  var spreadsheet = runtime.openById(ownership.spreadsheetId);
  return cashRequireSchemaExecutionRuntime({ mode: CASH_SCHEMA_RUNTIME.DISPOSABLE_MODE,
    disposableOwnership: ownership, spreadsheet: spreadsheet, timestamp: runtime.timestamp,
    flush: runtime.flush, freshSpreadsheet: function() { return runtime.openById(ownership.spreadsheetId); } });
}

function cashDisposableAppendRow(sheet, headers, row) {
  var nextRow = sheet.getLastRow() + 1;
  if (sheet.getMaxRows() < nextRow) sheet.insertRowsAfter(sheet.getMaxRows(), nextRow - sheet.getMaxRows());
  sheet.getRange(nextRow, 1, 1, headers.length).setValues([headers.map(function(header) {
    return row[header] === undefined ? "" : row[header];
  })]);
}

function cashDisposableAssertFixture(state) {
  cashDisposableRuntimeProofRequire(classifyCashAccountsState(state.accounts) === "LEGACY_CASH_TAXONOMY" &&
    state.accounts.values.length === 17 && state.accounts.maxColumns === 9, "exact Accounts fixture");
  cashDisposableRuntimeProofRequire(classifyCashOpeningState(state.opening, cashRowsFromPhysical(state.accounts)) ===
    "READY_NO_CASH_OPENINGS" && state.opening.values.length === 2 && state.opening.maxColumns === 13,
    "exact FinanceOpeningBalances fixture");
  cashDisposableRuntimeProofRequire(!state.settlements.exists && !state.balanceLedger.exists,
    "storage sheets initially absent");
}

function cashDisposableAssertMigration(first, spreadsheet) {
  var state = readCashSchemaMigrationState(spreadsheet), accounts = cashRowsFromPhysical(state.accounts);
  cashDisposableRuntimeProofRequire(first.status === "MIGRATED" && first.writeCount === 3,
    "first migration result");
  cashDisposableRuntimeProofRequire(classifyCashAccountsState(state.accounts) === "CASH_TAXONOMY_READY" &&
    classifyCashTableState(state.settlements, CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS,
      validateCashSettlements, accounts) === "EMPTY_VALID" &&
    classifyCashTableState(state.balanceLedger, CASH_SCHEMA_MIGRATION.BALANCE_LEDGER_HEADERS,
      validateBalanceLedgerCandidates, accounts) === "EMPTY_VALID" &&
    classifyCashOpeningState(state.opening, accounts) === "READY_NO_CASH_OPENINGS",
    "fresh-read migration classifications");
  cashDisposableRuntimeProofRequire(state.settlements.values.length === 1 && state.balanceLedger.values.length === 1,
    "migration fabricated no business rows");
}

function executeCashFoundationDisposableRuntimeProofWithRuntime(runtime) {
  var owned = [], failure = null, cleanupFailures = [], result = null, canonical = null, productionBefore = null;
  try {
    canonical = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
    cashDisposableRuntimeProofRequire(canonical && canonical.getId &&
      String(canonical.getId()) === NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
      "canonical production identity unavailable");
    productionBefore = cashFingerprint(readCashSchemaMigrationState(canonical));

    var primary = cashDisposableCreateFixture(runtime, canonical.getId(), owned, "Primary");
    var primaryContext = cashDisposableExecutionContext(runtime, primary);
    var original = readCashSchemaMigrationState(primaryContext.spreadsheet);
    cashDisposableAssertFixture(original);
    var first = executeCashFoundationSchemaMigrationWithRuntime(primaryContext);
    cashDisposableAssertMigration(first, runtime.openById(primary.spreadsheetId));
    var beforeSecond = cashFingerprint(readCashSchemaMigrationState(runtime.openById(primary.spreadsheetId)));
    var second = executeCashFoundationSchemaMigrationWithRuntime(cashDisposableExecutionContext(runtime, primary));
    var afterSecond = cashFingerprint(readCashSchemaMigrationState(runtime.openById(primary.spreadsheetId)));
    cashDisposableRuntimeProofRequire(second.status === "ALREADY_MIGRATED" && second.writeCount === 0 &&
      beforeSecond === afterSecond, "second-run idempotency");
    var recovery = executeCashFoundationSchemaRecoveryWithRuntime(
      cashDisposableExecutionContext(runtime, primary), first.migrationRecord);
    cashDisposableRuntimeProofRequire(recovery.status === "RECOVERED" &&
      cashFingerprint(readCashSchemaMigrationState(runtime.openById(primary.spreadsheetId))) === cashFingerprint(original),
      "exact controlled recovery");

    var business = cashDisposableCreateFixture(runtime, canonical.getId(), owned, "Business Refusal");
    var businessContext = cashDisposableExecutionContext(runtime, business);
    var businessMigration = executeCashFoundationSchemaMigrationWithRuntime(businessContext);
    cashDisposableAppendRow(businessContext.spreadsheet.getSheetByName(CASH_SCHEMA_MIGRATION.SETTLEMENTS_SHEET),
      CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS, cashDisposableSettlementRow());
    runtime.flush();
    var businessFingerprint = cashFingerprint(readCashSchemaMigrationState(businessContext.spreadsheet));
    var businessRecovery = executeCashFoundationSchemaRecoveryWithRuntime(businessContext,
      businessMigration.migrationRecord);
    cashDisposableRuntimeProofRequire(businessRecovery.status === "REFUSED" && businessRecovery.writeCount === 0 &&
      cashFingerprint(readCashSchemaMigrationState(businessContext.spreadsheet)) === businessFingerprint,
      "business-data recovery refusal");

    var modified = cashDisposableCreateFixture(runtime, canonical.getId(), owned, "Modified Refusal");
    var modifiedContext = cashDisposableExecutionContext(runtime, modified);
    var modifiedMigration = executeCashFoundationSchemaMigrationWithRuntime(modifiedContext);
    modifiedContext.spreadsheet.getSheetByName(CASH_SCHEMA_MIGRATION.ACCOUNTS_SHEET).getRange(2, 2, 1, 1)
      .setValues([["Disposable modified post-image"]]);
    runtime.flush();
    var modifiedFingerprint = cashFingerprint(readCashSchemaMigrationState(modifiedContext.spreadsheet));
    var modifiedRecovery = executeCashFoundationSchemaRecoveryWithRuntime(modifiedContext,
      modifiedMigration.migrationRecord);
    cashDisposableRuntimeProofRequire(modifiedRecovery.status === "REFUSED" && modifiedRecovery.writeCount === 0 &&
      cashFingerprint(readCashSchemaMigrationState(modifiedContext.spreadsheet)) === modifiedFingerprint,
      "modified post-image recovery refusal");

    ["EMPTY", "POPULATED"].forEach(function(storageState) {
      var preserved = cashDisposableCreateFixture(runtime, canonical.getId(), owned,
        "Pre-existing " + storageState, storageState);
      var preservedContext = cashDisposableExecutionContext(runtime, preserved);
      var preservedBefore = readCashSchemaMigrationState(preservedContext.spreadsheet);
      var preservedMigration = executeCashFoundationSchemaMigrationWithRuntime(preservedContext);
      cashDisposableRuntimeProofRequire(preservedMigration.status === "MIGRATED" && preservedMigration.writeCount === 1 &&
        preservedMigration.acceptance.preExistingStoragePreserved, "pre-existing " + storageState + " migration");
      var preservedRecovery = executeCashFoundationSchemaRecoveryWithRuntime(preservedContext,
        preservedMigration.migrationRecord);
      cashDisposableRuntimeProofRequire(preservedRecovery.status === "RECOVERED" &&
        cashFingerprint(readCashSchemaMigrationState(preservedContext.spreadsheet)) === cashFingerprint(preservedBefore),
        "pre-existing " + storageState + " recovery preservation");
    });

    var invalidScenarios = [
      { name: "conflicting 1010", mutate: function(ss) {
        cashDisposableAppendRow(ss.getSheetByName("Accounts"), CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS,
          { AccountCode: "1010", AccountName: "Conflict", AccountType: "Liability", StatementGroup: "Other",
            CashFlowGroup: "Operating", IsActive: true, CreatedAt: "", UpdatedAt: "", NormalBalance: "CREDIT" });
      } },
      { name: "conflicting 1020", mutate: function(ss) {
        cashDisposableAppendRow(ss.getSheetByName("Accounts"), CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS,
          { AccountCode: "1020", AccountName: "Conflict", AccountType: "Liability", StatementGroup: "Other",
            CashFlowGroup: "Operating", IsActive: true, CreatedAt: "", UpdatedAt: "", NormalBalance: "CREDIT" });
      } },
      { name: "duplicate AccountCode", mutate: function(ss) {
        var accounts = ss.getSheetByName("Accounts"), duplicate = accounts.getRange(2, 1, 1, 9).getValues()[0];
        cashDisposableAppendRow(accounts, CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS,
          CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS.reduce(function(row, header, index) { row[header] = duplicate[index]; return row; }, {}));
      } },
      { name: "invalid Settlements schema", mutate: function(ss) {
        var sheet = ss.insertSheet("Settlements"); sheet.getRange(1, 1, 1, 1).setValues([["WrongHeader"]]);
      } },
      { name: "invalid BalanceLedger schema", mutate: function(ss) {
        var sheet = ss.insertSheet("BalanceLedger"); sheet.getRange(1, 1, 1, 1).setValues([["WrongHeader"]]);
      } },
      { name: "partial Cash openings", mutate: function(ss) {
        cashDisposableAppendRow(ss.getSheetByName("FinanceOpeningBalances"),
          BALANCE_FOUNDATION_POLICY.OPENING_V2_HEADERS,
          { ID: "DISPOSABLE-OPEN-1000", EffectiveDate: new Date(2026, 8, 30), AccountCode: "1000",
            Debit: 1, Credit: 0, Source: "DISPOSABLE_PROOF", ExternalRef: "DISPOSABLE",
            Keterangan: "Disposable partial opening", IsActive: true, CreatedAt: "", CreatedBy: "",
            UpdatedAt: "", UpdatedBy: "" });
      } }
    ];
    invalidScenarios.forEach(function(scenario) {
      var invalid = cashDisposableCreateFixture(runtime, canonical.getId(), owned, "Invalid " + scenario.name);
      var invalidContext = cashDisposableExecutionContext(runtime, invalid);
      scenario.mutate(invalidContext.spreadsheet); runtime.flush();
      var invalidBefore = cashFingerprint(readCashSchemaMigrationState(invalidContext.spreadsheet));
      var invalidResult = executeCashFoundationSchemaMigrationWithRuntime(invalidContext);
      cashDisposableRuntimeProofRequire(invalidResult.status === "REFUSED" && invalidResult.writeCount === 0 &&
        cashFingerprint(readCashSchemaMigrationState(invalidContext.spreadsheet)) === invalidBefore,
        scenario.name + " must fail closed");
    });

    var contract = cashDisposableCreateFixture(runtime, canonical.getId(), owned, "Opening and Cutover");
    var contractState = readCashSchemaMigrationState(runtime.openById(contract.spreadsheetId));
    var readyRows = buildCashAccountsTarget(contractState.accounts, runtime.timestamp).rows;
    var verifiedZero = { ID: "DISPOSABLE-ZERO-1000", EffectiveDate: "2026-09-30", AccountCode: "1000",
      Debit: 0, Credit: 0, Source: "DISPOSABLE_PROOF", ExternalRef: "DISPOSABLE-EVIDENCE",
      Keterangan: "Verified observed balance = 0", IsActive: true, CreatedAt: "", CreatedBy: "",
      UpdatedAt: "", UpdatedBy: "" };
    cashDisposableRuntimeProofRequire(validateCashOpeningRows([verifiedZero], readyRows).status === "PASS" &&
      buildCashBalanceReadModel(readyRows, [], [], {}).status === "UNAVAILABLE" &&
      validateCashOpeningRows([Object.assign({}, verifiedZero, { ExternalRef: "", Keterangan: "Zero" })], readyRows).status === "FAIL" &&
      contractState.opening.values.length === 2, "zero-opening contract");
    var cutoverOpenings = CASH_FOUNDATION_POLICY.ACCOUNT_CODES.map(function(code) {
      return Object.assign({}, verifiedZero, { ID: "DISPOSABLE-OPEN-" + code, AccountCode: code, Debit: 100 });
    });
    var cutoverLedger = [
      { Tanggal: "2026-09-30", AccountCode: "1000", Debit: 50, Credit: 0, IsActive: true },
      { Tanggal: "2026-10-01", AccountCode: "1000", Debit: 25, Credit: 0, IsActive: true }
    ];
    var cutover = buildCashBalanceReadModel(readyRows, cutoverOpenings, cutoverLedger, { "1000": 125 });
    var cash1000 = cutover.accounts.filter(function(row) { return row.AccountCode === "1000"; })[0];
    cashDisposableRuntimeProofRequire(cash1000.Debits === 25 && cash1000.ClosingBalance === 125 &&
      cash1000.CutoverDate === "2026-09-30" && capitalEquityDateKey(contractState.opening.values[1][1]) === "2026-07-31",
      "cutover boundary and retained-earnings authority");

    var productionAfter = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
    cashDisposableRuntimeProofRequire(productionAfter &&
      cashFingerprint(readCashSchemaMigrationState(productionAfter)) === productionBefore,
      "production fingerprint changed");
    result = { status: "PASS", mode: CASH_SCHEMA_RUNTIME.DISPOSABLE_MODE, productionMutation: false,
      firstMigration: { status: first.status, writeCount: first.writeCount },
      secondMigration: { status: second.status, writeCount: second.writeCount }, recovery: "PASS",
      refusalScenarios: "PASS", zeroOpening: "PASS", cutoverBoundary: "PASS", cleanup: "PENDING" };
  } catch (error) { failure = error; }
  finally {
    owned.forEach(function(ownership) {
      try {
        cashDisposableRuntimeProofRequire(ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
          "cleanup refused production identity");
        runtime.trashOwnedSpreadsheet(ownership);
        if (!runtime.isOwnedSpreadsheetTrashed(ownership)) throw new Error("trash verification failed");
      } catch (cleanupError) { cleanupFailures.push(ownership.spreadsheetName + ": " + cleanupError.message); }
    });
    if (productionBefore !== null) {
      try {
        var finalProduction = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
        if (!finalProduction || cashFingerprint(readCashSchemaMigrationState(finalProduction)) !== productionBefore) {
          throw new Error("production fingerprint changed during failed proof");
        }
      } catch (productionError) {
        if (failure) failure.productionFingerprintFailure = productionError.message;
        else failure = productionError;
      }
    }
  }
  if (failure) {
    if (cleanupFailures.length) failure.cleanupFailure = cleanupFailures.join(" | ");
    throw failure;
  }
  if (cleanupFailures.length) throw new Error("Disposable Cash cleanup failed: " + cleanupFailures.join(" | "));
  result.cleanup = "PASS";
  return result;
}

function runCashFoundationDisposableRuntimeProof() {
  var result = executeCashFoundationDisposableRuntimeProofWithRuntime({
    storage: { openById: function(id) { return SpreadsheetApp.openById(id); } },
    createToken: function() { return new Date().getTime() + "-" + Utilities.getUuid(); },
    createSpreadsheet: function(name, rows, columns) { return SpreadsheetApp.create(name, rows, columns); },
    openById: function(id) { return SpreadsheetApp.openById(id); },
    flush: function() { SpreadsheetApp.flush(); }, timestamp: new Date(),
    trashOwnedSpreadsheet: function(ownership) {
      DriveApp.getFileById(ownership.spreadsheetId).setTrashed(true);
    },
    isOwnedSpreadsheetTrashed: function(ownership) {
      return DriveApp.getFileById(ownership.spreadsheetId).isTrashed();
    }
  });
  Logger.log(JSON.stringify(result));
  return result;
}
