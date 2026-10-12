// Treasury T5 canonical clearing projection + global 1030 reconciliation for
// TREASURY_RECEIPT_V1: the SINGLE canonical read-side model all future UI and
// readers consume. Pure read-only service over the canonical Sales Recognition
// V2 authority (U3 verifier reuse), the T3 Treasury foundation, and the T4
// durable artifacts: per-exposure projection rows (uncleared / cleared /
// exception with frozen quality codes), Sales lifecycle voids, orphan
// artifacts, and the separate global 1030 ledger reconciliation (debit-positive
// ledger evidence vs canonical business outstanding, deterministic exception
// attribution, unexplained residual). Zero writer side effects: no sheet
// mutation, no ledger write, no config/property write, no mutation recovery
// (the T4 pre-save resolver stays an internal safety gate; this module only
// reads and reports IN_PROGRESS as recovery-needed quality). No cache: reads
// are computed on demand at V1 scale, so staleness is structurally impossible.
// Authority: docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md
// (sections 7, 8, 9, 15, 19, 20) + T4 durable core semantics, reusing
// T3/T4/U3 helpers without forking their formulas.
var TREASURY_CLEARING_PROJECTION = Object.freeze({
  CONTRACT: "TREASURY_CLEARING_PROJECTION_V1",
  RECONCILIATION_CONTRACT: "TREASURY_1030_RECONCILIATION_V1",
  // Derived statuses only. PARTIAL is never a normal status (T2 section 19).
  STATUSES: Object.freeze(["UNCLEARED", "CLEARED", "EXCEPTION"]),
  INTEGRITY: Object.freeze({ VALID: "VALID", INVALID: "INVALID" }),
  // Frozen projection row contract — exact field order, no ad-hoc additions.
  ROW_FIELDS: Object.freeze(["RecognitionID", "OrderID", "RevisionID",
    "SalesEconomicDate", "RecognizedAmount", "RecognitionIntegrity",
    "ActiveReceiptCount", "ActiveReceiptID", "DestinationAccountCode",
    "ReceiptDate", "ReceiptEconomicDate", "ClearedAmount", "ReversalAmount",
    "OutstandingAmount", "ClearingStatus", "JournalID", "OperationID",
    "QualityCodes"]),
  // Frozen machine-readable quality-code catalog (stable strings, superset of
  // the T2 section 19 start list). No aliases, no invented runtime codes.
  QUALITY_CODES: Object.freeze(["SALES_AUTHORITY_INVALID",
    "SALES_REVERSAL_CONFLICT", "UNKNOWN_REVERSAL", "LINEAGE_CONFLICT",
    "OPERATION_MISSING", "OPERATION_MISMATCH", "OPERATION_NOT_COMMITTED",
    "OP_IN_PROGRESS", "OPERATION_DUPLICATE", "OPERATION_PLAN_MALFORMED",
    "RECEIPT_MISSING", "RECEIPT_ID_DUPLICATE", "DUPLICATE_ACTIVE_RECEIPTS",
    "RECEIPT_UNVERIFIED", "UNKNOWN_RECEIPT_TYPE", "AMOUNT_MISMATCH",
    "CLEARING_PARTIAL", "CLEARING_OVER", "NEGATIVE_OUTSTANDING",
    "AMOUNT_RESIDUAL", "DESTINATION_INVALID", "DESTINATION_LEDGER_MISMATCH",
    "JOURNAL_MISSING", "JOURNAL_DUPLICATE", "JOURNAL_IDENTITY_MISMATCH",
    "JOURNAL_AMOUNT_MISMATCH", "JOURNAL_ACCOUNT_MISMATCH",
    "JOURNAL_DATE_MISMATCH", "SIGNATURE_MISMATCH", "AUDIT_MISSING",
    "AUDIT_DUPLICATE", "AUDIT_MISMATCH", "DATE_INCONSISTENT",
    "RECEIPT_REVERSAL_CONFLICT", "ORPHAN_RECEIPT", "ORPHAN_OPERATION",
    "ORPHAN_AUDIT", "ORPHAN_JOURNAL", "ORPHAN_1030_MOVEMENT",
    "NON_V2_1030_MOVEMENT", "FUTURE_REFUND_CREDIT_STATE",
    "FUTURE_CORRECTION_REVERSAL_STATE"]),
  // Deterministic reconciliation exception categories (T2 section 20 bucket).
  EXCEPTION_CATEGORIES: Object.freeze(["HISTORICAL_NON_V2_1030_MOVEMENT",
    "TREASURY_INTEGRITY_EXCEPTION", "LIFECYCLE_CONFLICT",
    "FUTURE_REFUND_CREDIT_TRANSFER", "FUTURE_CORRECTION_REVERSAL_STATE"]),
  // Forward-compatible deterministic matchers for future writer states: a 1030
  // movement carrying one of these types is attributed to its own bucket
  // instead of being left unexplained (T6+ future refund/correction shapes).
  FUTURE_REFUND_MOVEMENTS: Object.freeze(["TREASURY_REFUND",
    "CUSTOMER_CREDIT_TRANSFER"]),
  FUTURE_CORRECTION_MOVEMENTS: Object.freeze(["TREASURY_RECEIPT_CORRECTION",
    "TREASURY_CORRECTION_REVERSAL"]),
  READ_ENTRYPOINTS: Object.freeze(["getTreasuryClearingProjection",
    "getTreasuryClearingExposure", "getTreasury1030Reconciliation"]),
  ORPHAN_REASONS: Object.freeze({ RECEIPT_UNRESOLVED: "RECOGNITION_UNRESOLVED",
    RECEIPT_LINEAGE: "LINEAGE_MISSING", OPERATION_NO_RECEIPT: "NO_RECEIPT",
    AUDIT_NO_RECEIPT: "NO_RECEIPT", JOURNAL_NO_RECEIPT: "NO_RECEIPT" }),
  RECONCILIATION_STATUS: Object.freeze({ OK: "OK",
    UNEXPLAINED_RESIDUAL: "UNEXPLAINED_RESIDUAL",
    MALFORMED_1030_LINE: "MALFORMED_1030_LINE" })
});

function treasuryClearingQualitySet_() {
  var set = Object.create(null);
  TREASURY_CLEARING_PROJECTION.QUALITY_CODES.forEach(function(code) {
    set[code] = true;
  });
  return set;
}

function treasuryClearingPushCode_(codes, code) {
  if (!treasuryClearingQualitySet_()[code]) {
    throw new Error("TREASURY_T5_UNKNOWN_QUALITY_CODE:" + code);
  }
  if (codes.indexOf(code) === -1) codes.push(code);
}

// Strict request normalization: every date bound is an explicit Asia/Jakarta
// business date key (YYYY-MM-DD, already timezone-free). Invalid bounds fail
// closed; no host-local instant conversion exists anywhere in this module —
// treasuryDateKey remains the canonical instant-to-date authority at write
// time (T3), and this read model only ever compares date keys.
function treasuryClearingNormalizeRequest_(request) {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  var req = request && typeof request === "object" && !Array.isArray(request) ?
    request : {};
  function bound(value, field) {
    if (value === undefined || value === null || String(value).trim() === "") {
      return "";
    }
    var text = String(value).trim();
    if (treasuryValidateReceiptDate(text).status !== "PASS") {
      throw treasuryContractError_(codes.DATE_INVALID,
        "treasuryClearing " + field + " must be a YYYY-MM-DD date key");
    }
    return text;
  }
  var end = bound(req.endDate, "endDate");
  var asOf = bound(req.asOfDate, "asOfDate");
  if (!asOf) asOf = end; // period end is the default as-of boundary
  var start = bound(req.startDate, "startDate");
  if (start && end && start > end) {
    throw treasuryContractError_(codes.DATE_INVALID,
      "treasuryClearing startDate must not be after endDate");
  }
  return { asOf: asOf, start: start, end: end };
}

function treasuryClearingIncludedAsOf_(dateKey, asOf) {
  if (!asOf) return true;
  if (treasuryValidateReceiptDate(dateKey).status !== "PASS") return true; // fail visible
  return String(dateKey) <= asOf;
}

function treasuryClearingInPeriod_(dateKey, start, end) {
  if (start && treasuryValidateReceiptDate(dateKey).status === "PASS" &&
      String(dateKey) < start) return false;
  if (end && treasuryValidateReceiptDate(dateKey).status === "PASS" &&
      String(dateKey) > end) return false;
  return true;
}

// T11.2 §15 clearing-source index: active BalanceLedger lines with
// SourceType SALES_MONEY_V2 (composed money leg) or
// TRANSITIONAL_CLEARING_CLOSE (§18 close), grouped by bound SourceID
// (RecognitionID), as-of bounded exactly like receipt money. Read-only;
// no TreasuryReceipts row is ever synthesized for a composed leg.
function treasuryClearingMoneyIndex_(ledgerAll, bounds) {
  var moneyType = SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_SOURCE_TYPE,
    closeType = "TRANSITIONAL_CLEARING_CLOSE";
  var money = Object.create(null), close = Object.create(null);
  ledgerAll.forEach(function(line) {
    var sourceType = String(line.SourceType || "");
    if (sourceType !== moneyType && sourceType !== closeType) return;
    if (!treasuryClearingIncludedAsOf_(line.Tanggal, bounds.asOf)) return;
    var bucket = sourceType === moneyType ? money : close;
    var key = String(line.SourceID || "");
    (bucket[key] = bucket[key] || []).push(line);
  });
  return { money: money, close: close };
}

// T11.2 §15 composed-money expectation: committed
// SALES_RECOGNITION_V2_SAVE operation rows whose frozen plan carries
// composedMoney:true. Only these commits EXPECT a money leg — a legacy or
// PREPARED save never demands one, so legacy exposures stay untouched.
function treasuryClearingComposedPlanIndex_(operationRows) {
  var byRecognition = Object.create(null);
  (operationRows || []).forEach(function(row) {
    if (String(row.OperationType || "") !== SALES_RECOGNITION_V2_SAVE.OPERATION_TYPE) return;
    var plan = null;
    try { plan = JSON.parse(String(row.OperationPlan || "")); } catch (error) { plan = null; }
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) return;
    if (plan.composedMoney !== true) return;
    var id = String(plan.recognitionID || "");
    if (!id) return;
    (byRecognition[id] = byRecognition[id] || []).push({ operation: row, plan: plan });
  });
  return byRecognition;
}

// T11.2 §15 per-exposure composed clearing state. Validates every bound
// clearing group (exact two-line journal, one 1040 + one 1030, balanced,
// SALES_MONEY movement, amount equal to the canonical event amount, plan
// journal identity + signature when a composed plan exists) and returns the
// debit-positive 1030 net. ONLY a fully valid state contributes clearing —
// malformed, duplicate, missing-leg, identity, or signature disagreement
// surfaces as frozen quality codes (EXCEPTION) and clears nothing. The
// transitional close (§18) uses the same shape rules without plan
// expectations. A valid void whose money fully reversed leaves the exposure
// through the pre-existing voided path; reversal-bound groups (SourceID =
// void recognitionID) are included so U6 money reversals net correctly.
function treasuryClearingExposureClearingState_(ids, recognitionById, eventVerdicts,
    indexes, planIndex) {
  var codes = [], groups = [];
  ids.forEach(function(id) {
    var moneyLines = indexes.money[id] || [];
    var closeLines = indexes.close[id] || [];
    if (moneyLines.length) groups.push({ id: id, kind: "money", lines: moneyLines });
    else if ((planIndex[id] || []).length) treasuryClearingPushCode_(codes, "JOURNAL_MISSING");
    if (closeLines.length) groups.push({ id: id, kind: "close", lines: closeLines });
  });
  var net1030 = 0, seenJournals = Object.create(null);
  groups.forEach(function(group) {
    var byJournal = Object.create(null);
    group.lines.forEach(function(line) {
      var jid = String(line.JournalID || "");
      (byJournal[jid] = byJournal[jid] || []).push(line);
    });
    var journalIDs = Object.keys(byJournal);
    if (journalIDs.length > 1) treasuryClearingPushCode_(codes, "JOURNAL_DUPLICATE");
    journalIDs.forEach(function(jid) {
      if (seenJournals[jid]) treasuryClearingPushCode_(codes, "JOURNAL_DUPLICATE");
      seenJournals[jid] = true;
      var lines = byJournal[jid];
      if (lines.length !== 2) {
        treasuryClearingPushCode_(codes, "JOURNAL_AMOUNT_MISMATCH");
        return;
      }
      var money = lines.filter(function(line) {
        return String(line.AccountCode || "") === SINGLE_COMMIT_MONEY_POLICY.ACCOUNT_CODE;
      });
      var clearing = lines.filter(function(line) {
        return String(line.AccountCode || "") ===
          TREASURY_RECEIPT_V1_CONTRACT.CLEARING_ACCOUNT_CODE;
      });
      if (money.length !== 1 || clearing.length !== 1) {
        treasuryClearingPushCode_(codes, "JOURNAL_ACCOUNT_MISMATCH");
        return;
      }
      if (group.kind === "money" && !lines.every(function(line) {
        return String(line.MovementType || "") ===
          SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_MOVEMENT_TYPE;
      })) {
        treasuryClearingPushCode_(codes, "JOURNAL_IDENTITY_MISMATCH");
        return;
      }
      var moneyDebit = Number(money[0].Debit), moneyCredit = Number(money[0].Credit),
        clearDebit = Number(clearing[0].Debit), clearCredit = Number(clearing[0].Credit);
      if (!isFinite(moneyDebit) || !isFinite(moneyCredit) ||
          !isFinite(clearDebit) || !isFinite(clearCredit)) {
        treasuryClearingPushCode_(codes, "JOURNAL_AMOUNT_MISMATCH");
        return;
      }
      var forward = moneyDebit > 0 && moneyCredit === 0 &&
        clearCredit === moneyDebit && clearDebit === 0;
      var reverse = clearDebit > 0 && clearCredit === 0 &&
        moneyCredit === clearDebit && moneyDebit === 0;
      if (!forward && !reverse) {
        treasuryClearingPushCode_(codes, "JOURNAL_AMOUNT_MISMATCH");
        return;
      }
      var amount = forward ? moneyDebit : clearDebit;
      if (group.kind === "money") {
        var verdict = eventVerdicts[group.id];
        if (verdict && isFinite(verdict.amount) && verdict.amount > 0 &&
            amount !== verdict.amount) {
          treasuryClearingPushCode_(codes, "JOURNAL_AMOUNT_MISMATCH");
          return;
        }
        var plans = planIndex[group.id] || [];
        if (plans.length) {
          var plan = plans[0].plan;
          if (String(plan.moneyJournalID || "") !== jid) {
            treasuryClearingPushCode_(codes, "JOURNAL_IDENTITY_MISMATCH");
          }
          if (String(plan.moneyJournalSignature || "") !== "" &&
              policyCJournalSignature_(lines) !== String(plan.moneyJournalSignature)) {
            treasuryClearingPushCode_(codes, "SIGNATURE_MISMATCH");
          }
          var planTotal = Number(plan.orderTotal);
          if (isFinite(planTotal) && planTotal > 0 && planTotal !== amount) {
            treasuryClearingPushCode_(codes, "JOURNAL_AMOUNT_MISMATCH");
          }
        } else {
          var event = recognitionById[group.id];
          if (event && String(event.EventType || "") === "RECOGNITION") {
            var expectedJournal = transactionStableBootstrapId_(
              SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_JOURNAL_PREFIX,
              [String(event.OrderID || "")]);
            if (expectedJournal && jid !== expectedJournal) {
              treasuryClearingPushCode_(codes, "JOURNAL_IDENTITY_MISMATCH");
            }
          }
        }
      }
      net1030 += clearDebit - clearCredit;
    });
  });
  return { present: groups.length > 0, codes: codes, valid: codes.length === 0,
    net1030: net1030, clearing: codes.length === 0 ? -net1030 : 0 };
}

// Narrow read helper: T4's read-only exposure source reader (six authority
// tables) plus the three independent Treasury sheets and the Accounts master.
// All reads; no sheet is ever created or mutated here.
function treasuryClearingReadSources_(ss) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  var sources = treasuryReadExposureSources_(ss);
  sources.TreasuryReceipts = readCanonicalTable(ss,
    contract.SCHEMAS.RECEIPTS.SHEET, contract.SCHEMAS.RECEIPTS.HEADERS);
  sources.TreasuryOperations = readCanonicalTable(ss,
    contract.SCHEMAS.OPERATIONS.SHEET, contract.SCHEMAS.OPERATIONS.HEADERS);
  sources.TreasuryAudits = readCanonicalTable(ss,
    contract.SCHEMAS.AUDITS.SHEET, contract.SCHEMAS.AUDITS.HEADERS);
  sources.Accounts = readCanonicalTable(ss, "Accounts",
    CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
  return sources;
}

// Receipt integrity (T2 section 7.1 authority, read-side): a receipt counts
// as a clearing ONLY when every artifact link is exact. Phase 1 is intrinsic
// (receipt row + operation + destination + journal + signature + audit);
// phase 2 is exposure-scoped (date order, lineage match, reversal targets).
// Malformed receipts never silently become healthy and never silently vanish:
// they stay surfaced on the row (or in the orphan list) and their ledger
// effect is attributed in reconciliation, never netted into canonical
// outstanding.
// Operation-audit coverage for a receipt with no audit row keyed to it (T2
// sections 9 and 12): the single frozen audit of the receipt's own COMMITTED
// operation satisfies the link ONLY when (1) exactly one operation row owns
// this receipt (type, state, request key, recognition all exact), (2) the
// frozen OperationPlan names this receipt as its own (primary or explicitly
// planned member), and (3) the single operation audit is byte-exact against
// the plan's frozen audit row plus its independent linkages (operation, request
// key, recognition, order, payload hash). Any unrelated or cross-owner audit,
// missing membership, or plan disagreement returns false -> AUDIT_MISSING.
function treasuryClearingOperationAuditCovers_(receipt, ctx, contract,
    recognitionID, orderID, receiptID) {
  var operationRows = ctx.operationRowsById[String(receipt.OperationID)] || [];
  if (operationRows.length !== 1) return false;
  var operation = operationRows[0];
  if (contract.OPERATION_TYPES.indexOf(String(operation.OperationType || "")) === -1 ||
      String(operation.State === undefined || operation.State === null ? "" :
        operation.State) !== "COMMITTED" ||
      String(operation.RequestKey || "") !== String(receipt.RequestKey || "") ||
      String(operation.RecognitionID || "") !== recognitionID) {
    return false;
  }
  var plan = null;
  try { plan = JSON.parse(String(operation.OperationPlan || "")); }
  catch (error) { return false; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return false;
  var member = String(plan.receiptID || "") === receiptID ||
    (Array.isArray(plan.plannedReceiptIds) && plan.plannedReceiptIds.indexOf(receiptID) !== -1);
  if (!member || String(plan.operationID || "") !== String(receipt.OperationID) ||
      String(plan.requestKey || "") !== String(receipt.RequestKey || "") ||
      String(plan.recognitionID || "") !== recognitionID ||
      !plan.auditRow || typeof plan.auditRow !== "object" || Array.isArray(plan.auditRow)) {
    return false;
  }
  var audits = ctx.auditsByOperationID[String(receipt.OperationID)] || [];
  if (audits.length !== 1) return false;
  var audit = audits[0];
  var exact = contract.SCHEMAS.AUDITS.HEADERS.every(function(header) {
    var expected = plan.auditRow[header];
    expected = expected === undefined || expected === null ? "" : expected;
    var actual = audit[header] === undefined || audit[header] === null ? "" : audit[header];
    return String(actual) === String(expected);
  });
  return exact &&
    String(audit.OperationID || "") === String(receipt.OperationID) &&
    String(audit.RequestKey || "") === String(receipt.RequestKey || "") &&
    String(audit.RecognitionID || "") === recognitionID &&
    String(audit.OrderID || "") === orderID &&
    String(audit.PayloadHash || "") === String(operation.PayloadHash || "");
}

function treasuryClearingReceiptAssessment_(receipt, ctx) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  var codes = [];
  var receiptID = String(receipt.TreasuryReceiptID === undefined ||
    receipt.TreasuryReceiptID === null ? "" : receipt.TreasuryReceiptID);
  var recognitionID = String(receipt.RecognitionID === undefined ||
    receipt.RecognitionID === null ? "" : receipt.RecognitionID);
  var orderID = String(receipt.OrderID === undefined || receipt.OrderID === null ?
    "" : receipt.OrderID);
  var revisionID = String(receipt.RevisionID === undefined ||
    receipt.RevisionID === null ? "" : receipt.RevisionID);
  if (receiptID === "" ||
      String(receipt.ContractVersion || "") !== contract.CONTRACT_VERSION) {
    treasuryClearingPushCode_(codes, "RECEIPT_UNVERIFIED");
  }
  var receiptType = String(receipt.ReceiptType === undefined ||
    receipt.ReceiptType === null ? "" : receipt.ReceiptType);
  if (receiptType !== "SALES_RECEIPT" && receiptType !== "SALES_RECEIPT_REVERSAL") {
    treasuryClearingPushCode_(codes, "UNKNOWN_RECEIPT_TYPE");
  }
  var amount = Number(receipt.GrossAmount);
  if (!isFinite(amount) || amount <= 0 || Math.floor(amount) !== amount) {
    treasuryClearingPushCode_(codes, "AMOUNT_MISMATCH");
  }
  if (String(receipt.PostingStatus || "") !== contract.POSTING_STATUS_COMMITTED) {
    treasuryClearingPushCode_(codes, "RECEIPT_UNVERIFIED");
  }
  if (treasuryValidateReceiptDate(receipt.ReceiptDate).status !== "PASS" ||
      treasuryValidateReceiptDate(receipt.EconomicDate).status !== "PASS" ||
      String(receipt.ReceiptDate) !== String(receipt.EconomicDate)) {
    treasuryClearingPushCode_(codes, "DATE_INCONSISTENT");
  }
  // SnapshotJSON is evidence only, never the Sales amount authority: it must
  // parse and agree on identity; its numeric fields are never read here.
  var snapshot = null;
  try { snapshot = JSON.parse(receipt.SnapshotJSON); } catch (error) { snapshot = null; }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    treasuryClearingPushCode_(codes, "RECEIPT_UNVERIFIED");
  } else if (snapshot.recognitionID !== undefined &&
      String(snapshot.recognitionID) !== recognitionID) {
    treasuryClearingPushCode_(codes, "RECEIPT_UNVERIFIED");
  }
  if (orderID === "" || revisionID === "" || !ctx.orderIds[orderID]) {
    treasuryClearingPushCode_(codes, "LINEAGE_CONFLICT");
  }
  // Operation linkage: exactly one matching COMMITTED treasury operation.
  var operationRows = ctx.operationRowsById[String(receipt.OperationID)] || [];
  if (operationRows.length === 0) {
    treasuryClearingPushCode_(codes, "OPERATION_MISSING");
  } else if (operationRows.length > 1) {
    treasuryClearingPushCode_(codes, "OPERATION_DUPLICATE");
  } else {
    var operation = operationRows[0];
    if (String(operation.RequestKey) !== String(receipt.RequestKey) ||
        String(operation.RecognitionID) !== recognitionID ||
        contract.OPERATION_TYPES.indexOf(String(operation.OperationType)) === -1) {
      treasuryClearingPushCode_(codes, "OPERATION_MISMATCH");
    }
    var state = String(operation.State === undefined || operation.State === null ?
      "" : operation.State);
    if (state === "IN_PROGRESS") {
      treasuryClearingPushCode_(codes, "OP_IN_PROGRESS");
    } else if (state !== "COMMITTED") {
      treasuryClearingPushCode_(codes, "OPERATION_NOT_COMMITTED");
    } else {
      var plan = null;
      try { plan = JSON.parse(operation.OperationPlan); } catch (planError) { plan = null; }
      if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
        treasuryClearingPushCode_(codes, "OPERATION_PLAN_MALFORMED");
      }
    }
  }
  // Destination eligibility against the frozen cash-universe rule (T3).
  if (!treasuryDestinationEligible(receipt.DestinationAccountCode,
      ctx.accounts).eligible) {
    treasuryClearingPushCode_(codes, "DESTINATION_INVALID");
  }
  // Journal: exactly two active source-keyed lines, exact legs, exact
  // amounts, exact date, exact signature recomputed from persisted rows.
  var journalID = String(receipt.JournalID === undefined ||
    receipt.JournalID === null ? "" : receipt.JournalID);
  var lines = ctx.ledgerLinesByReceiptID[receiptID] || [];
  if (lines.length === 0 || lines.length === 1) {
    treasuryClearingPushCode_(codes, "JOURNAL_MISSING");
  } else if (lines.length > 2) {
    treasuryClearingPushCode_(codes, "JOURNAL_DUPLICATE");
  } else {
    var identityOk = lines.every(function(line) {
      return String(line.JournalID) === journalID;
    }) && lines.map(function(line) { return String(line.LineID); }).sort().join(",") ===
      [journalID + "-1", journalID + "-2"].sort().join(",");
    if (!identityOk) {
      treasuryClearingPushCode_(codes, "JOURNAL_IDENTITY_MISMATCH");
    } else {
      var destination = String(receipt.DestinationAccountCode);
      var clearingCode = contract.CLEARING_ACCOUNT_CODE;
      var ordinary = receiptType === "SALES_RECEIPT";
      var movement = ordinary ? contract.MOVEMENT_TYPE : contract.MOVEMENT_TYPE_REVERSAL;
      var destinationLine = lines.filter(function(line) {
        return String(line.AccountCode) === destination;
      });
      var clearingLine = lines.filter(function(line) {
        return String(line.AccountCode) === clearingCode;
      });
      var foreignLine = lines.filter(function(line) {
        var code = String(line.AccountCode);
        return code !== destination && code !== clearingCode;
      });
      if (destinationLine.length !== 1) {
        // The journal's destination leg does not post the receipt's own
        // destination account (T2 section 8.1 authority mismatch).
        treasuryClearingPushCode_(codes, "DESTINATION_LEDGER_MISMATCH");
      }
      if (foreignLine.length || destinationLine.length !== 1 ||
          clearingLine.length !== 1) {
        treasuryClearingPushCode_(codes, "JOURNAL_ACCOUNT_MISMATCH");
      } else {
        var destLine = destinationLine[0], clearLine = clearingLine[0];
        var destDebit = Number(destLine.Debit), destCredit = Number(destLine.Credit);
        var clearDebit = Number(clearLine.Debit), clearCredit = Number(clearLine.Credit);
        // The 1030 leg direction is exact: an ordinary receipt credits 1030,
        // a committed reversal debits 1030. Anything else is an account/direction
        // failure, never a tolerated variant.
        var clearingOk = ordinary ?
          (clearDebit === 0 && clearCredit === amount) :
          (clearDebit === amount && clearCredit === 0);
        var destinationOk = ordinary ?
          (destDebit === amount && destCredit === 0) :
          (destDebit === 0 && destCredit === amount);
        if (!clearingOk) {
          treasuryClearingPushCode_(codes, "JOURNAL_ACCOUNT_MISMATCH");
        }
        if (!destinationOk) {
          treasuryClearingPushCode_(codes, "JOURNAL_AMOUNT_MISMATCH");
        }
        var directionOk = lines.every(function(line) {
          return String(line.MovementType) === movement;
        });
        if (!directionOk) {
          treasuryClearingPushCode_(codes, "JOURNAL_ACCOUNT_MISMATCH");
        }
        if (!lines.every(function(line) {
            return String(line.Tanggal) === String(receipt.EconomicDate);
          })) {
          treasuryClearingPushCode_(codes, "JOURNAL_DATE_MISMATCH");
        }
        if (treasuryJournalSignature(lines) !== String(receipt.JournalSignature || "")) {
          treasuryClearingPushCode_(codes, "SIGNATURE_MISMATCH");
        }
      }
    }
  }
  // Audit: exactly one 11-column row, all linkages exact. T2 section 9 keeps
  // ONE audit per operation: a multi-artifact operation freezes a single audit
  // for its planned primary receipt, and that operation audit may satisfy a
  // planned sibling receipt ONLY after exact operation ownership and planned
  // receipt membership are proven against the frozen plan. Unrelated or
  // cross-owner audits never satisfy the link (fail closed as missing).
  var audits = ctx.auditsByReceiptID[receiptID] || [];
  if (audits.length === 0) {
    if (!treasuryClearingOperationAuditCovers_(receipt, ctx, contract,
        recognitionID, orderID, receiptID)) {
      treasuryClearingPushCode_(codes, "AUDIT_MISSING");
    }
  } else if (audits.length > 1) {
    treasuryClearingPushCode_(codes, "AUDIT_DUPLICATE");
  } else {
    var audit = audits[0];
    var operationRowsForAudit = ctx.operationRowsById[String(receipt.OperationID)] || [];
    var payloadHash = operationRowsForAudit.length === 1 ?
      String(operationRowsForAudit[0].PayloadHash) : "";
    if (String(audit.ContractVersion || "") !== contract.CONTRACT_VERSION ||
        String(audit.OperationID || "") !== String(receipt.OperationID) ||
        String(audit.RequestKey || "") !== String(receipt.RequestKey) ||
        String(audit.RecognitionID || "") !== recognitionID ||
        String(audit.OrderID || "") !== orderID ||
        String(audit.JournalID || "") !== journalID ||
        String(audit.PayloadHash || "") !== payloadHash ||
        String(audit.Actor || "") !== String(receipt.Actor || "") ||
        String(audit.SavedAt || "") !== String(receipt.ReceivedAt || "")) {
      treasuryClearingPushCode_(codes, "AUDIT_MISMATCH");
    }
  }
  return codes;
}

// Exposure-scoped receipt rules (phase 2): date order against the Sales
// recognition and reversal target resolution.
function treasuryClearingReceiptRowCodes_(receipt, recognitionEvent, attachedById, codes) {
  var receiptType = String(receipt.ReceiptType || "");
  if (treasuryValidateReceiptDate(receipt.EconomicDate).status === "PASS" &&
      treasuryValidateReceiptDate(recognitionEvent.EconomicDate).status === "PASS" &&
      String(receipt.EconomicDate) < String(recognitionEvent.EconomicDate)) {
    treasuryClearingPushCode_(codes, "DATE_INCONSISTENT"); // receipt before recognition
  }
  if (String(receipt.OrderID) !== String(recognitionEvent.OrderID) ||
      String(receipt.RevisionID) !== String(recognitionEvent.RevisionID)) {
    treasuryClearingPushCode_(codes, "LINEAGE_CONFLICT");
  }
  if (receiptType === "SALES_RECEIPT_REVERSAL") {
    var target = String(receipt.ReversalOfReceiptID === undefined ||
      receipt.ReversalOfReceiptID === null ? "" : receipt.ReversalOfReceiptID);
    var targetEntry = target ? attachedById[target] : null;
    if (!targetEntry) {
      treasuryClearingPushCode_(codes, "UNKNOWN_REVERSAL");
      return;
    }
    // attachedById stores {receipt, codes, ...} entries; the target's TYPE and
    // AMOUNT authority is the target receipt ROW itself (T2 section 12).
    var targetReceipt = targetEntry.receipt || targetEntry;
    if (String(targetReceipt.ReceiptType || "") !== "SALES_RECEIPT") {
      treasuryClearingPushCode_(codes, "RECEIPT_REVERSAL_CONFLICT");
    }
    if (Number(receipt.GrossAmount) !== Number(targetReceipt.GrossAmount)) {
      treasuryClearingPushCode_(codes, "AMOUNT_MISMATCH");
    }
  }
}
// One deterministic analysis pass shared by the projection, the single-
// exposure read, and the global reconciliation: same sources, same formulas,
// same quality decisions — no second public formula exists.
function treasuryClearingAnalyze_(sources, request) {
  var bounds = treasuryClearingNormalizeRequest_(request);
  var contract = TREASURY_RECEIPT_V1_CONTRACT,
    salesContract = SALES_RECOGNITION_V2_CONTRACT;
  var rows = [], voidedExposures = [], salesIssues = [];
  var orderIds = Object.create(null), orderLineCounts = Object.create(null);
  sources.Orders.forEach(function(order) { orderIds[String(order.OrderID)] = true; });
  sources.OrderLines.forEach(function(line) {
    var key = String(line.OrderID);
    orderLineCounts[key] = (orderLineCounts[key] || 0) + 1;
  });
  var salesContext = { sources: { rows: sources }, orderIds: orderIds };

  // Sales V2 event census + one U3 verdict per event (reuse, never fork).
  var recognitionEvents = [], reversalEvents = [], eventVerdicts = Object.create(null);
  var recognitionById = Object.create(null);
  sources.SalesRecognitionEvents.forEach(function(event) {
    if (String(event.ContractVersion || "") !== salesContract.CONTRACT_VERSION) return;
    var eventID = String(event.RecognitionID || "");
    var eventType = String(event.EventType || "");
    if (eventType === "RECOGNITION") {
      recognitionEvents.push(event);
      recognitionById[eventID] = event;
    } else if (eventType === "REVERSAL") {
      reversalEvents.push(event);
    } else {
      salesIssues.push({ recognitionID: eventID, eventType: eventType,
        reversalOfRecognitionID: "", code: "SALES_AUTHORITY_INVALID",
        detail: "UNKNOWN_EVENT_TYPE" });
      return;
    }
    var verdict = null;
    try {
      verdict = eventType === "RECOGNITION" ?
        salesProjectionVerifyV2Event_(event, salesContext) :
        salesProjectionVerifyV2Reversal_(event, salesContext);
    } catch (error) { verdict = null; }
    eventVerdicts[eventID] = {
      valid: !!verdict && verdict.status === "RECOGNIZED",
      eventType: eventType,
      amount: Number(event.Amount),
      included: treasuryClearingIncludedAsOf_(event.EconomicDate, bounds.asOf)
    };
  });
  reversalEvents.forEach(function(event) {
    var target = String(event.ReversalOfRecognitionID || "");
    if (!target || !recognitionById[target]) {
      salesIssues.push({ recognitionID: String(event.RecognitionID || ""),
        eventType: "REVERSAL", reversalOfRecognitionID: target,
        code: "UNKNOWN_REVERSAL", detail: "TARGET_NOT_AN_ACTIVE_RECOGNITION" });
    }
  });

  // Index every sheet the receipt/operation/audit/journal checks read.
  var ledgerAll = sources.BalanceLedger.filter(function(line) {
    return isCanonicalActive(line.IsActive);
  });
  // T11.2 §15 composed clearing sources + plan expectations (read-only).
  var clearingIndexes = treasuryClearingMoneyIndex_(ledgerAll, bounds);
  var composedPlans = treasuryClearingComposedPlanIndex_(sources.TransactionOperations);
  var operationRowsById = Object.create(null), operationKeyCounts = Object.create(null);
  sources.TreasuryOperations.forEach(function(operation) {
    var id = String(operation.TreasuryOperationID || "");
    (operationRowsById[id] = operationRowsById[id] || []).push(operation);
    var key = String(operation.OperationType) + "|" + String(operation.RequestKey);
    operationKeyCounts[key] = (operationKeyCounts[key] || 0) + 1;
  });
  var auditsByReceiptID = Object.create(null), auditsByOperationID = Object.create(null);
  sources.TreasuryAudits.forEach(function(audit) {
    var key = String(audit.TreasuryReceiptID || "");
    (auditsByReceiptID[key] = auditsByReceiptID[key] || []).push(audit);
    var operationKey = String(audit.OperationID || "");
    (auditsByOperationID[operationKey] = auditsByOperationID[operationKey] || []).push(audit);
  });
  var ledgerLinesByReceiptID = Object.create(null);
  ledgerAll.forEach(function(line) {
    if (String(line.SourceType) !== contract.SOURCE_TYPE) return;
    var key = String(line.SourceID || "");
    (ledgerLinesByReceiptID[key] = ledgerLinesByReceiptID[key] || []).push(line);
  });
  var ctx = { orderIds: orderIds, accounts: sources.Accounts,
    operationRowsById: operationRowsById, auditsByReceiptID: auditsByReceiptID,
    auditsByOperationID: auditsByOperationID,
    ledgerLinesByReceiptID: ledgerLinesByReceiptID };

  // Receipt census: unresolved RecognitionID => full orphan (never attached);
  // lineage-missing receipts attach with LINEAGE_CONFLICT AND appear in the
  // orphan list (surfaced twice, counted zero times).
  var receiptsById = Object.create(null), orphanReceipts = [];
  var receiptIdCounts = Object.create(null);
  sources.TreasuryReceipts.forEach(function(receipt) {
    var id = String(receipt.TreasuryReceiptID || "");
    receiptIdCounts[id] = (receiptIdCounts[id] || 0) + 1;
  });
  var visibleReceipts = [];
  sources.TreasuryReceipts.forEach(function(receipt) {
    var id = String(receipt.TreasuryReceiptID || "");
    var recognitionID = String(receipt.RecognitionID || "");
    var visible = treasuryClearingIncludedAsOf_(receipt.EconomicDate, bounds.asOf);
    var unresolved = !recognitionById[recognitionID];
    var lineageMissing = String(receipt.OrderID || "") === "" ||
      String(receipt.RevisionID || "") === "" || !orderIds[String(receipt.OrderID)];
    if (unresolved) {
      var orphanCodes = [];
      treasuryClearingPushCode_(orphanCodes, "ORPHAN_RECEIPT");
      orphanReceipts.push({ treasuryReceiptID: id, recognitionID: recognitionID,
        orderID: String(receipt.OrderID || ""),
        revisionID: String(receipt.RevisionID || ""),
        grossAmount: Number(receipt.GrossAmount),
        receiptDate: String(receipt.ReceiptDate || ""),
        economicDate: String(receipt.EconomicDate || ""),
        reason: TREASURY_CLEARING_PROJECTION.ORPHAN_REASONS.RECEIPT_UNRESOLVED,
        codes: orphanCodes.slice(), visible: visible });
      // Retained so reconciliation can distinguish "ledger movement with a
      // malformed receipt row" (ORPHAN_RECEIPT) from "ledger movement with no
      // receipt row at all" (ORPHAN_1030_MOVEMENT). Never attached to a row.
      receiptsById[id] = { receipt: receipt, codes: orphanCodes,
        visible: visible, recognitionID: recognitionID };
      return;
    }
    if (lineageMissing) {
      var lineageCodes = [];
      treasuryClearingPushCode_(lineageCodes, "ORPHAN_RECEIPT");
      orphanReceipts.push({ treasuryReceiptID: id, recognitionID: recognitionID,
        orderID: String(receipt.OrderID || ""),
        revisionID: String(receipt.RevisionID || ""),
        grossAmount: Number(receipt.GrossAmount),
        receiptDate: String(receipt.ReceiptDate || ""),
        economicDate: String(receipt.EconomicDate || ""),
        reason: TREASURY_CLEARING_PROJECTION.ORPHAN_REASONS.RECEIPT_LINEAGE,
        codes: lineageCodes, visible: visible });
    }
    var codes = treasuryClearingReceiptAssessment_(receipt, ctx);
    if (receiptIdCounts[id] > 1) {
      treasuryClearingPushCode_(codes, "RECEIPT_ID_DUPLICATE");
    }
    receiptsById[id] = { receipt: receipt, codes: codes, visible: visible,
      recognitionID: recognitionID };
    if (visible) visibleReceipts.push(receiptsById[id]);
  });
  orphanReceipts.sort(function(a, b) {
    return a.treasuryReceiptID < b.treasuryReceiptID ? -1 :
      (a.treasuryReceiptID > b.treasuryReceiptID ? 1 : 0);
  });

  // Orphan operations: identity unresolved OR no receipt row references the
  // operation (recoverable intent is REPORTED, never executed by this reader).
  var referencedOperationIds = Object.create(null);
  sources.TreasuryReceipts.forEach(function(receipt) {
    referencedOperationIds[String(receipt.OperationID)] = true;
  });
  var orphanOperations = [];
  sources.TreasuryOperations.forEach(function(operation) {
    var recognitionID = String(operation.RecognitionID || "");
    var unresolved = !recognitionById[recognitionID];
    var hasReceipt = !!referencedOperationIds[String(operation.TreasuryOperationID)];
    if (!unresolved && hasReceipt) return;
    var state = String(operation.State === undefined || operation.State === null ?
      "" : operation.State);
    var orphanCodes = [];
    treasuryClearingPushCode_(orphanCodes, "ORPHAN_OPERATION");
    orphanOperations.push({ treasuryOperationID: String(operation.TreasuryOperationID || ""),
      operationType: String(operation.OperationType || ""),
      recognitionID: recognitionID, requestKey: String(operation.RequestKey || ""),
      state: state, reason: unresolved ?
        TREASURY_CLEARING_PROJECTION.ORPHAN_REASONS.RECEIPT_UNRESOLVED :
        TREASURY_CLEARING_PROJECTION.ORPHAN_REASONS.OPERATION_NO_RECEIPT,
      codes: orphanCodes });
  });

  // Orphan audits: durable audit rows whose receipt identity does not exist.
  var receiptIdSet = Object.create(null);
  sources.TreasuryReceipts.forEach(function(receipt) {
    receiptIdSet[String(receipt.TreasuryReceiptID)] = true;
  });
  var orphanAudits = [];
  sources.TreasuryAudits.forEach(function(audit) {
    var receiptID = String(audit.TreasuryReceiptID || "");
    if (receiptIdSet[receiptID]) return;
    var orphanCodes = [];
    treasuryClearingPushCode_(orphanCodes, "ORPHAN_AUDIT");
    orphanAudits.push({ auditID: String(audit.AuditID || ""),
      treasuryReceiptID: receiptID, operationID: String(audit.OperationID || ""),
      recognitionID: String(audit.RecognitionID || ""),
      reason: TREASURY_CLEARING_PROJECTION.ORPHAN_REASONS.AUDIT_NO_RECEIPT,
      codes: orphanCodes });
  });

  // Orphan treasury journals: source-keyed ledger lines (any account) whose
  // receipt row does not exist, bounded by the same as-of rule as money.
  var receiptSourceSet = Object.create(null);
  sources.TreasuryReceipts.forEach(function(receipt) {
    receiptSourceSet[String(receipt.TreasuryReceiptID)] = true;
  });
  var orphanJournalGroups = Object.create(null);
  ledgerAll.forEach(function(line) {
    if (String(line.SourceType) !== contract.SOURCE_TYPE) return;
    if (!treasuryClearingIncludedAsOf_(line.Tanggal, bounds.asOf)) return;
    var sourceID = String(line.SourceID || "");
    if (receiptSourceSet[sourceID]) return;
    var key = sourceID === "" ? "JOURNAL:" + String(line.JournalID || "") : sourceID;
    var group = orphanJournalGroups[key];
    if (!group) {
      group = orphanJournalGroups[key] = { sourceID: sourceID, journalIDs: [],
        lineCount: 0, net1030Effect: 0 };
    }
    if (group.journalIDs.indexOf(String(line.JournalID)) === -1) {
      group.journalIDs.push(String(line.JournalID));
    }
    group.lineCount += 1;
    if (String(line.AccountCode) === contract.CLEARING_ACCOUNT_CODE) {
      group.net1030Effect += (Number(line.Debit) || 0) - (Number(line.Credit) || 0);
    }
  });
  var orphanJournals = Object.keys(orphanJournalGroups).sort().map(function(key) {
    var group = orphanJournalGroups[key];
    var codes = [];
    treasuryClearingPushCode_(codes, "ORPHAN_JOURNAL");
    return { sourceID: group.sourceID, journalIDs: group.journalIDs.sort().join(","),
      lineCount: group.lineCount, net1030Effect: group.net1030Effect,
      reason: TREASURY_CLEARING_PROJECTION.ORPHAN_REASONS.JOURNAL_NO_RECEIPT,
      codes: codes };
  });

  // Operation-level exposure codes: duplicate keys, non-COMMITTED state,
  // malformed plan, COMMITTED without receipt artifacts.
  var opCodesByRecognition = Object.create(null);
  sources.TreasuryOperations.forEach(function(operation) {
    var recognitionID = String(operation.RecognitionID || "");
    if (!recognitionById[recognitionID]) return;
    var codes = opCodesByRecognition[recognitionID] ||
      (opCodesByRecognition[recognitionID] = []);
    var key = String(operation.OperationType) + "|" + String(operation.RequestKey);
    if (operationKeyCounts[key] > 1) {
      treasuryClearingPushCode_(codes, "OPERATION_DUPLICATE");
    }
    var state = String(operation.State === undefined || operation.State === null ?
      "" : operation.State);
    if (state === "IN_PROGRESS") {
      treasuryClearingPushCode_(codes, "OP_IN_PROGRESS");
    } else if (state !== "COMMITTED") {
      treasuryClearingPushCode_(codes, "OPERATION_NOT_COMMITTED");
    }
    if (state === "COMMITTED") {
      var plan = null;
      try { plan = JSON.parse(operation.OperationPlan); } catch (error) { plan = null; }
      if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
        treasuryClearingPushCode_(codes, "OPERATION_PLAN_MALFORMED");
      }
      if (!referencedOperationIds[String(operation.TreasuryOperationID)]) {
        treasuryClearingPushCode_(codes, "RECEIPT_MISSING");
      }
    }
    if (contract.OPERATION_TYPES.indexOf(String(operation.OperationType)) === -1) {
      treasuryClearingPushCode_(codes, "OPERATION_MISMATCH");
    }
  });

  // Per-exposure projection rows.
  var visibleReceiptByRecognition = Object.create(null);
  visibleReceipts.forEach(function(entry) {
    var list = visibleReceiptByRecognition[entry.recognitionID] ||
      (visibleReceiptByRecognition[entry.recognitionID] = []);
    list.push(entry);
  });
  var totalRecognized = 0, totalCleared = 0, totalOutstanding = 0,
    totalVoidAdjustment = 0, unclearedCount = 0, clearedCount = 0,
    exceptionCount = 0;
  recognitionEvents.forEach(function(event) {
    var recognitionID = String(event.RecognitionID);
    var eventState = eventVerdicts[recognitionID];
    if (!eventState.included) return;
    if (!treasuryClearingInPeriod_(event.EconomicDate, bounds.start, bounds.end)) return;
    var codes = [];
    if (!eventState.valid) treasuryClearingPushCode_(codes, "SALES_AUTHORITY_INVALID");
    var recognizedAmount = Number(event.Amount);
    if (!isFinite(recognizedAmount) || recognizedAmount <= 0) {
      treasuryClearingPushCode_(codes, "SALES_AUTHORITY_INVALID");
      recognizedAmount = isFinite(recognizedAmount) ? recognizedAmount : 0;
    }
    if (!orderIds[String(event.OrderID)] || !String(event.RevisionID || "") ||
        !orderLineCounts[String(event.OrderID)]) {
      treasuryClearingPushCode_(codes, "LINEAGE_CONFLICT");
    }
    // Sales reversal (void) handling: full valid void with no receipt history
    // => the recognition leaves the exposure row set (surfaced as a lifecycle
    // void); any receipt history or invalid/partial void keeps the row and
    // fails closed as a lifecycle conflict — NEVER an automatic refund path.
    var validVoidAmount = 0, voidCount = 0, latestVoidDate = "";
    var voidEvents = reversalEvents.filter(function(reversal) {
      return String(reversal.ReversalOfRecognitionID || "") === recognitionID &&
        treasuryClearingIncludedAsOf_(reversal.EconomicDate, bounds.asOf);
    });
    voidEvents.forEach(function(reversal) {
      var state = eventVerdicts[String(reversal.RecognitionID)];
      if (state && state.valid) {
        validVoidAmount += Number(reversal.Amount);
        voidCount += 1;
        if (String(reversal.EconomicDate) > latestVoidDate) {
          latestVoidDate = String(reversal.EconomicDate);
        }
      } else {
        treasuryClearingPushCode_(codes, "SALES_REVERSAL_CONFLICT");
      }
    });
    if (voidCount && validVoidAmount !== recognizedAmount) {
      treasuryClearingPushCode_(codes, "SALES_REVERSAL_CONFLICT");
    }
    (opCodesByRecognition[recognitionID] || []).forEach(function(code) {
      treasuryClearingPushCode_(codes, code);
    });
    // T11.2 §15: composed SALES_MONEY_V2 (and §18 transitional-close) lines
    // bound to this recognition family. A valid group is AUTHORITATIVE
    // clearing (no receipt row, no synthesis); every malformed/missing leg
    // pushes frozen quality codes here so the row fails visible as
    // EXCEPTION and clears nothing — never silently clear 1030.
    var clearingState = treasuryClearingExposureClearingState_(
      [recognitionID].concat(voidEvents.map(function(reversal) {
        return String(reversal.RecognitionID);
      })), recognitionById, eventVerdicts, clearingIndexes, composedPlans);
    clearingState.codes.forEach(function(code) {
      treasuryClearingPushCode_(codes, code);
    });
    var recognizedActive = (eventState.valid ? recognizedAmount : 0) - validVoidAmount;
    // Receipts attached to this exposure (visible, RecognitionID resolved).
    var attachedEntries = visibleReceiptByRecognition[recognitionID] || [];
    var attachedById = Object.create(null);
    attachedEntries.forEach(function(entry) {
      attachedById[String(entry.receipt.TreasuryReceiptID)] = entry;
    });
    attachedEntries.forEach(function(entry) {
      treasuryClearingReceiptRowCodes_(entry.receipt, event, attachedById, entry.codes);
      entry.codes.forEach(function(code) { treasuryClearingPushCode_(codes, code); });
    });
    var ordinary = [], reversalReceipts = [];
    attachedEntries.forEach(function(entry) {
      var type = String(entry.receipt.ReceiptType || "");
      if (type === "SALES_RECEIPT") ordinary.push(entry);
      else if (type === "SALES_RECEIPT_REVERSAL") reversalReceipts.push(entry);
    });
    function byId(a, b) {
      var x = String(a.receipt.TreasuryReceiptID),
        y = String(b.receipt.TreasuryReceiptID);
      return x < y ? -1 : (x > y ? 1 : 0);
    }
    ordinary.sort(byId);
    reversalReceipts.sort(byId);
    var validOrdinary = ordinary.filter(function(entry) {
      return entry.codes.length === 0;
    });
    var validReversals = reversalReceipts.filter(function(entry) {
      return entry.codes.length === 0;
    });
    // Duplicate-active counts ONLY valid non-reversed ordinary receipts (T2
    // section 12): a reversed original plus its valid replacement is a healthy
    // lineage, not a duplicate; two genuinely active ordinary receipts still
    // fail closed.
    var activeOrdinaryCount = validOrdinary.filter(function(entry) {
      var target = String(entry.receipt.TreasuryReceiptID);
      return !validReversals.some(function(reversal) {
        return String(reversal.receipt.ReversalOfReceiptID) === target;
      });
    }).length;
    if (activeOrdinaryCount > 1) {
      treasuryClearingPushCode_(codes, "DUPLICATE_ACTIVE_RECEIPTS");
    }
    // One reversal max per target (T2 section 12 read-side rule).
    var reversalTargetCounts = Object.create(null);
    validReversals.forEach(function(entry) {
      var target = String(entry.receipt.ReversalOfReceiptID || "");
      reversalTargetCounts[target] = (reversalTargetCounts[target] || 0) + 1;
    });
    validReversals.forEach(function(entry) {
      var target = String(entry.receipt.ReversalOfReceiptID || "");
      if (reversalTargetCounts[target] > 1) {
        treasuryClearingPushCode_(codes, "RECEIPT_REVERSAL_CONFLICT");
        treasuryClearingPushCode_(entry.codes, "RECEIPT_REVERSAL_CONFLICT");
      }
    });
    // Recompute validity after row-scoped duplicate-reversal codes.
    validOrdinary = validOrdinary.filter(function(entry) {
      return entry.codes.length === 0;
    });
    validReversals = validReversals.filter(function(entry) {
      return entry.codes.length === 0;
    });
    var ordinarySum = validOrdinary.reduce(function(total, entry) {
      return total + Number(entry.receipt.GrossAmount);
    }, 0);
    var reversalSum = validReversals.reduce(function(total, entry) {
      return total + Number(entry.receipt.GrossAmount);
    }, 0);
    // Net Treasury clearing: every posted ordinary receipt is subtracted
    // (including one later reversed), committed receipt reversals add back —
    // the T2 section 7.2 formula with the double-count trap avoided — plus
    // T11.2 §15 composed money / transitional-close clearing (valid groups
    // only; invalid groups were coded EXCEPTION above and clear nothing).
    var cleared = ordinarySum - reversalSum + clearingState.clearing;
    // Outstanding = RecognizedActive - ActiveReceiptClearings + CommittedReversals
    // (single canonical formula; T4 parity proven on healthy fixtures).
    var outstanding = recognizedActive - cleared;
    if (cleared > recognizedActive && recognizedActive >= 0) {
      treasuryClearingPushCode_(codes, "CLEARING_OVER");
    }
    if (outstanding < 0) treasuryClearingPushCode_(codes, "NEGATIVE_OUTSTANDING");
    if (outstanding > 0 && cleared > 0) {
      treasuryClearingPushCode_(codes, "CLEARING_PARTIAL");
    }
    // Sales void on an exposure with clearing history = lifecycle conflict.
    if (voidCount && validOrdinary.length) {
      treasuryClearingPushCode_(codes, "SALES_REVERSAL_CONFLICT");
    }
    // Fully Sales-voided with zero receipt history: no longer an exposure.
    if (!codes.length && voidCount && recognizedActive <= 0 &&
        attachedEntries.length === 0) {
      voidedExposures.push({ recognitionID: recognitionID,
        orderID: String(event.OrderID), revisionID: String(event.RevisionID),
        salesEconomicDate: String(event.EconomicDate),
        recognizedAmount: recognizedAmount, voidEconomicDate: latestVoidDate });
      totalRecognized += recognizedAmount;
      totalVoidAdjustment += validVoidAmount;
      return;
    }
    // Identity fields: prefer the first valid active ordinary receipt.
    var activeOrdinary = validOrdinary.filter(function(entry) {
      var target = String(entry.receipt.TreasuryReceiptID);
      return !validReversals.some(function(reversal) {
        return String(reversal.receipt.ReversalOfReceiptID) === target;
      });
    });
    var identityEntry = activeOrdinary[0] || validOrdinary[0] || ordinary[0] || null;
    var identityReceipt = identityEntry ? identityEntry.receipt : null;
    var status;
    if (codes.length || outstanding < 0) {
      status = "EXCEPTION";
    } else if (outstanding > 0) {
      status = "UNCLEARED";
    } else if (recognizedActive > 0 && cleared === recognizedActive &&
        (activeOrdinary.length >= 1 ||
         (clearingState.present && clearingState.valid))) {
      // T11.2 §15.2: receipt-based rows keep the ActiveReceiptCount >= 1
      // rule; a composed-cleared row (no receipt identity) is CLEARED on
      // exact full clearing alone.
      status = "CLEARED";
    } else {
      treasuryClearingPushCode_(codes, "AMOUNT_RESIDUAL");
      status = "EXCEPTION";
    }
    rows.push({ RecognitionID: recognitionID, OrderID: String(event.OrderID),
      RevisionID: String(event.RevisionID),
      SalesEconomicDate: String(event.EconomicDate),
      RecognizedAmount: recognizedAmount,
      RecognitionIntegrity: eventState.valid ?
        TREASURY_CLEARING_PROJECTION.INTEGRITY.VALID :
        TREASURY_CLEARING_PROJECTION.INTEGRITY.INVALID,
      ActiveReceiptCount: activeOrdinary.length,
      ActiveReceiptID: identityEntry && activeOrdinary.length ?
        String(identityEntry.receipt.TreasuryReceiptID) :
        (identityReceipt ? String(identityReceipt.TreasuryReceiptID) : ""),
      DestinationAccountCode: identityReceipt ?
        String(identityReceipt.DestinationAccountCode || "") : "",
      ReceiptDate: identityReceipt ? String(identityReceipt.ReceiptDate || "") : "",
      ReceiptEconomicDate: identityReceipt ?
        String(identityReceipt.EconomicDate || "") : "",
      ClearedAmount: cleared, ReversalAmount: reversalSum,
      OutstandingAmount: outstanding, ClearingStatus: status,
      JournalID: identityReceipt ? String(identityReceipt.JournalID || "") : "",
      OperationID: identityReceipt ? String(identityReceipt.OperationID || "") : "",
      QualityCodes: codes });
    totalRecognized += recognizedAmount;
    totalCleared += cleared;
    totalOutstanding += outstanding;
    totalVoidAdjustment += validVoidAmount;
    if (status === "UNCLEARED") unclearedCount += 1;
    else if (status === "CLEARED") clearedCount += 1;
    else exceptionCount += 1;
  });
  voidedExposures.sort(function(a, b) {
    return a.recognitionID < b.recognitionID ? -1 :
      (a.recognitionID > b.recognitionID ? 1 : 0);
  });
  rows.sort(function(a, b) {
    return a.RecognitionID < b.RecognitionID ? -1 :
      (a.RecognitionID > b.RecognitionID ? 1 : 0);
  });
  salesIssues.sort(function(a, b) {
    return a.recognitionID < b.recognitionID ? -1 :
      (a.recognitionID > b.recognitionID ? 1 : 0);
  });
  return { bounds: bounds, rows: rows, voidedExposures: voidedExposures,
    salesIssues: salesIssues, orphanReceipts: orphanReceipts,
    orphanOperations: orphanOperations, orphanAudits: orphanAudits,
    orphanJournals: orphanJournals, eventVerdicts: eventVerdicts,
    receiptsById: receiptsById,
    ledgerActive: ledgerAll, orderIds: orderIds,
    totals: { recognizedExposure: totalRecognized,
      activeClearings: totalCleared, outstandingTotal: totalOutstanding,
      salesVoidAdjustment: totalVoidAdjustment, unclearedCount: unclearedCount,
      clearedCount: clearedCount, exceptionCount: exceptionCount } };
}

function treasuryClearingProjectionResponse_(analysis) {
  return { contract: TREASURY_CLEARING_PROJECTION.CONTRACT,
    asOfDate: analysis.bounds.asOf, startDate: analysis.bounds.start,
    endDate: analysis.bounds.end, rows: analysis.rows,
    voidedExposures: analysis.voidedExposures, salesIssues: analysis.salesIssues,
    orphans: { receipts: analysis.orphanReceipts,
      operations: analysis.orphanOperations, audits: analysis.orphanAudits,
      journals: analysis.orphanJournals },
    totals: analysis.totals };
}

// Canonical period projection (single canonical read model).
function buildTreasuryClearingProjection_(ss, request) {
  var sources = treasuryClearingReadSources_(ss);
  var analysis = treasuryClearingAnalyze_(sources, request || {});
  return treasuryClearingProjectionResponse_(analysis);
}

// Single-RecognitionID bounded read.
function buildTreasuryClearingExposure_(ss, request) {
  var codes = TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES;
  var req = request && typeof request === "object" ? request : {};
  var recognitionID = String(req.recognitionID === undefined ||
    req.recognitionID === null ? "" : req.recognitionID).trim();
  if (!/^SCR-[A-Za-z0-9-]{3,127}$/.test(recognitionID)) {
    throw treasuryContractError_(codes.PAYLOAD_INVALID,
      "treasuryClearingExposure requires a SCR- recognitionID");
  }
  var sources = treasuryClearingReadSources_(ss);
  var analysis = treasuryClearingAnalyze_(sources,
    { asOfDate: req.asOfDate, startDate: req.startDate, endDate: req.endDate });
  var row = analysis.rows.filter(function(entry) {
    return entry.RecognitionID === recognitionID;
  })[0] || null;
  if (row) return { contract: TREASURY_CLEARING_PROJECTION.CONTRACT,
    status: "OK", asOfDate: analysis.bounds.asOf, row: row };
  var voided = analysis.voidedExposures.filter(function(entry) {
    return entry.recognitionID === recognitionID;
  })[0] || null;
  if (voided) return { contract: TREASURY_CLEARING_PROJECTION.CONTRACT,
    status: "VOIDED", asOfDate: analysis.bounds.asOf, voidedExposure: voided };
  return { contract: TREASURY_CLEARING_PROJECTION.CONTRACT,
    status: "NOT_FOUND", asOfDate: analysis.bounds.asOf,
    recognitionID: recognitionID };
}
// Deterministic attribution of one 1030 ledger group (SourceType+SourceID)
// that disagrees with the canonical expectation. Every entry carries
// identity, amount, provenance, quality code, and source artifact; anything
// that cannot be attributed by these rules stays in the unexplained residual.
function treasuryClearingAttributeGroup_(group, expected, analysis, ctx) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT;
  var categories = TREASURY_CLEARING_PROJECTION.EXCEPTION_CATEGORIES;
  var entry = { category: "", identity: "", amount: 0, qualityCode: "",
    provenance: "", sourceArtifact: "" };
  if (group.sourceType === contract.SOURCE_TYPE) {
    var state = ctx.receiptState[group.sourceID];
    entry.category = categories[1]; // TREASURY_INTEGRITY_EXCEPTION
    entry.identity = group.sourceID;
    entry.qualityCode = state && state.codes.length ? state.codes[0] :
      "ORPHAN_1030_MOVEMENT";
    entry.provenance = "TREASURY_RECEIPT_V1 ledger movement without a counted clearing";
  } else if (group.sourceType === SALES_RECOGNITION_V2_SAVE.JOURNAL_SOURCE_TYPE) {
    var eventState = ctx.eventVerdicts[group.sourceID];
    entry.category = categories[2]; // LIFECYCLE_CONFLICT
    entry.identity = group.sourceID;
    if (eventState && eventState.eventType === "REVERSAL") {
      entry.qualityCode = "SALES_REVERSAL_CONFLICT";
    } else {
      var row = ctx.rowsByRecognition[group.sourceID];
      entry.qualityCode = row && row.QualityCodes.length ? row.QualityCodes[0] :
        "SALES_AUTHORITY_INVALID";
    }
    entry.provenance = "SALES_RECOGNITION_V2 ledger movement not mirrored by valid canonical events";
  } else if (group.sourceType === SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_SOURCE_TYPE ||
      group.sourceType === "TRANSITIONAL_CLEARING_CLOSE") {
    // T11.2 §15.3/§15.5: known writer identities — a composed-money or
    // transitional-close group disagreeing with its canonical expectation is
    // a deterministic lifecycle conflict, never an unexplained residual and
    // never a HISTORICAL_NON_V2 misclassification.
    var recState = ctx.eventVerdicts[group.sourceID];
    entry.category = categories[2]; // LIFECYCLE_CONFLICT
    entry.identity = group.sourceID;
    entry.qualityCode = recState && recState.valid ? "AMOUNT_MISMATCH" :
      "JOURNAL_IDENTITY_MISMATCH";
    entry.provenance = group.sourceType ===
      SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_SOURCE_TYPE ?
      "composed-money 1030 movement disagreeing with its canonical expectation" :
      "transitional clearing close 1030 movement disagreeing with its canonical expectation";
  } else {
    var movementTypes = group.movementTypes;
    var sourceID = group.sourceID;
    var refund = movementTypes.some(function(type) {
      return TREASURY_CLEARING_PROJECTION.FUTURE_REFUND_MOVEMENTS.indexOf(type) !== -1;
    });
    var correction = movementTypes.some(function(type) {
      return TREASURY_CLEARING_PROJECTION.FUTURE_CORRECTION_MOVEMENTS.indexOf(type) !== -1;
    });
    if (refund && sourceID) {
      entry.category = categories[3]; // FUTURE_REFUND_CREDIT_TRANSFER
      entry.qualityCode = "FUTURE_REFUND_CREDIT_STATE";
      entry.identity = sourceID;
      entry.provenance = "future refund/credit-shaped 1030 movement";
    } else if (correction && sourceID) {
      entry.category = categories[4]; // FUTURE_CORRECTION_REVERSAL_STATE
      entry.qualityCode = "FUTURE_CORRECTION_REVERSAL_STATE";
      entry.identity = sourceID;
      entry.provenance = "future correction/reversal-shaped 1030 movement";
    } else if (group.sourceType && sourceID) {
      entry.category = categories[0]; // HISTORICAL_NON_V2_1030_MOVEMENT
      entry.qualityCode = "NON_V2_1030_MOVEMENT";
      entry.identity = sourceID;
      entry.provenance = "1030 movement outside the V2 Sales + Treasury V1 writer set";
    } else {
      return null; // no deterministic identity => unexplained residual
    }
  }
  entry.amount = group.net - expected;
  entry.sourceArtifact = "BalanceLedger:" + group.lineIDs.sort().join(",");
  return entry.amount === 0 ? null : entry;
}

// Global 1030 reconciliation — accounting evidence vs business authority,
// compared, never derived from each other. Debit-positive convention made
// explicit:
//   LedgerNet1030  = SUM(active 1030 debits) - SUM(active 1030 credits)
//   UnexplainedResidual = LedgerNet1030 - OutstandingTotal - ExplicitExceptionAmount
// OutstandingTotal comes ONLY from the canonical projection rows; LedgerNet1030
// comes ONLY from BalanceLedger. Target: residual 0.
function buildTreasury1030Reconciliation_(ss, request) {
  var contract = TREASURY_RECEIPT_V1_CONTRACT,
    recon = TREASURY_CLEARING_PROJECTION.RECONCILIATION_STATUS;
  var req = request && typeof request === "object" ? request : {};
  // The reconciliation is global: as-of bounded, never period-filtered.
  var sources = treasuryClearingReadSources_(ss);
  var analysis = treasuryClearingAnalyze_(sources,
    { asOfDate: req.asOfDate, endDate: req.endDate });
  var asOf = analysis.bounds.asOf;
  var ledgerDr1030 = 0, ledgerCr1030 = 0, malformed = [];
  var lines1030 = analysis.ledgerActive.filter(function(line) {
    if (String(line.AccountCode) !== contract.CLEARING_ACCOUNT_CODE) return false;
    if (!treasuryClearingIncludedAsOf_(line.Tanggal, asOf)) return false;
    return true;
  });
  lines1030.forEach(function(line) {
    var debit = Number(line.Debit), credit = Number(line.Credit);
    if (!isFinite(debit) || !isFinite(credit)) {
      malformed.push({ lineID: String(line.LineID || ""),
        journalID: String(line.JournalID || ""), detail: "NON_FINITE_AMOUNT" });
      return;
    }
    if (treasuryValidateReceiptDate(line.Tanggal).status !== "PASS") {
      malformed.push({ lineID: String(line.LineID || ""),
        journalID: String(line.JournalID || ""), detail: "INVALID_TANGGAL_DATE" });
    }
    ledgerDr1030 += debit;
    ledgerCr1030 += credit;
  });
  var ledgerNet1030 = ledgerDr1030 - ledgerCr1030;

  // Group the visible 1030 lines by writer identity and compare each group
  // against the canonical expectation derived from business authority only.
  var groups = Object.create(null);
  lines1030.forEach(function(line) {
    var debit = Number(line.Debit), credit = Number(line.Credit);
    if (!isFinite(debit) || !isFinite(credit)) return;
    var sourceType = String(line.SourceType || "");
    var sourceID = String(line.SourceID || "");
    var key = sourceType + String.fromCharCode(1) + sourceID;
    var group = groups[key];
    if (!group) {
      group = groups[key] = { sourceType: sourceType, sourceID: sourceID,
        net: 0, lineIDs: [], movementTypes: [] };
    }
    group.net += debit - credit;
    group.lineIDs.push(String(line.LineID || ""));
    var movement = String(line.MovementType || "");
    if (group.movementTypes.indexOf(movement) === -1) {
      group.movementTypes.push(movement);
    }
  });
  var rowsByRecognition = Object.create(null);
  analysis.rows.forEach(function(row) {
    rowsByRecognition[row.RecognitionID] = row;
  });
  // Receipt-side expectation: only a counted, integrity-full, as-of-visible
  // clearing moves canonical outstanding; every other treasury ledger
  // movement is an explicit exception entry. Ordinary and reversal receipts
  // are separate source identities, each with its own exact expectation.
  var receiptState = Object.create(null);
  var expectedByReceipt = Object.create(null);
  Object.keys(analysis.receiptsById).forEach(function(receiptID) {
    var entry = analysis.receiptsById[receiptID];
    var counted = entry.visible && entry.codes.length === 0;
    receiptState[receiptID] = { codes: entry.codes, counted: counted };
    if (!counted) { expectedByReceipt[receiptID] = 0; return; }
    var type = String(entry.receipt.ReceiptType);
    expectedByReceipt[receiptID] = type === "SALES_RECEIPT" ?
      -Number(entry.receipt.GrossAmount) : Number(entry.receipt.GrossAmount);
  });
  var ctx = { receiptState: receiptState, eventVerdicts: analysis.eventVerdicts,
    rowsByRecognition: rowsByRecognition };
  var exceptionEntries = [];
  Object.keys(groups).sort().forEach(function(key) {
    var group = groups[key];
    var expected = 0;
    if (group.sourceType === contract.SOURCE_TYPE) {
      expected = expectedByReceipt[group.sourceID] || 0;
    } else if (group.sourceType === SALES_RECOGNITION_V2_SAVE.JOURNAL_SOURCE_TYPE) {
      var state = analysis.eventVerdicts[group.sourceID];
      if (state && state.included && state.valid) {
        expected = state.eventType === "RECOGNITION" ? state.amount : -state.amount;
      }
    } else if (group.sourceType === SINGLE_COMMIT_MONEY_POLICY.SALES_MONEY_SOURCE_TYPE ||
        group.sourceType === "TRANSITIONAL_CLEARING_CLOSE") {
      // T11.2 §15.3/§15.5: expected 1030 net = negative of the expectation
      // of the (SALES_RECOGNITION_V2, same SourceID) group — recognition
      // +amount ⇒ clearing −amount; void reversal −amount ⇒ +amount. A
      // healthy composed sale therefore contributes net 0 to the residual.
      var recState = analysis.eventVerdicts[group.sourceID];
      if (recState && recState.included && recState.valid) {
        var recExpected = recState.eventType === "RECOGNITION" ?
          recState.amount : -recState.amount;
        expected = -recExpected;
      }
    }
    var entry = treasuryClearingAttributeGroup_(group, expected, analysis, ctx);
    if (entry) exceptionEntries.push(entry);
  });
  var explicitExceptionAmount = exceptionEntries.reduce(function(total, entry) {
    return total + entry.amount;
  }, 0);
  var outstandingTotal = analysis.totals.outstandingTotal;
  var unexplainedResidual = ledgerNet1030 - outstandingTotal - explicitExceptionAmount;
  var status = malformed.length ? recon.MALFORMED_1030_LINE :
    (unexplainedResidual !== 0 ? recon.UNEXPLAINED_RESIDUAL : recon.OK);
  return { contract: TREASURY_CLEARING_PROJECTION.RECONCILIATION_CONTRACT,
    asOfDate: asOf,
    ledgerDr1030: ledgerDr1030, ledgerCr1030: ledgerCr1030,
    ledgerNet1030: ledgerNet1030,
    recognizedExposure: analysis.totals.recognizedExposure,
    salesVoidAdjustment: analysis.totals.salesVoidAdjustment,
    activeClearings: analysis.totals.activeClearings,
    outstandingTotal: outstandingTotal,
    explicitExceptionAmount: explicitExceptionAmount,
    unexplainedResidual: unexplainedResidual,
    exceptionEntries: exceptionEntries,
    malformed1030Lines: malformed,
    reconciliationStatus: status };
}

// ---------------------------------------------------------------------------
// Public read-only entrypoints (bounded). Production wiring resolves the
// spreadsheet read-only; local tests exercise the WithRuntime cores or stub
// the resolver. No writer side effect exists anywhere in this call graph.
// ---------------------------------------------------------------------------
function getTreasuryClearingProjection(request) {
  return buildTreasuryClearingProjection_(requireNumlockProductionSpreadsheet(),
    request || {});
}

function getTreasuryClearingExposure(request) {
  return buildTreasuryClearingExposure_(requireNumlockProductionSpreadsheet(),
    request || {});
}

function getTreasury1030Reconciliation(request) {
  return buildTreasury1030Reconciliation_(requireNumlockProductionSpreadsheet(),
    request || {});
}
