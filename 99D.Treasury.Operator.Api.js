// Treasury T7 operator API: THIN server endpoints for the operator-facing
// Receipts surface. Every function delegates to an existing T3-T6 authority;
// this module contains ZERO business formulas, ZERO sheet writes, and ZERO
// duplicated projections. Authority precedence: T2 contract > Sol correction >
// T5 canonical projection > T3 foundation > T4/T6 writers > this UI-facing
// adapter. Capabilities derived here are ADVISORY UX metadata only — T4/T6
// revalidate every mutation inside their locks.
// Authority: docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md,
// docs/TREASURY-T7-OPERATOR-UI-AND-APPLICATION-INTEGRATION.md.

var TREASURY_OPERATOR_API = Object.freeze({
  WORKSPACE_CONTRACT: "TREASURY_OPERATOR_WORKSPACE_V1",
  DETAIL_CONTRACT: "TREASURY_OPERATOR_DETAIL_V1"
});

// Advisory action capability from ONE canonical T5 row + the T3/T4 mode gate.
// Never recomputes outstanding/cleared/quality — it only reads server values
// already produced by the canonical projection, then applies the fail-closed
// action matrix. actionReason is "" exactly when the action is offered.
function treasuryOperatorRowCapability_(row, gate) {
  var capability = { canSave: false, canReverse: false, canCorrect: false, actionReason: "" };
  if (!gate || gate.allowed !== true) {
    capability.actionReason = gate && gate.code ? gate.code : "TREASURY_CONFIG_INVALID";
    return capability;
  }
  if (!row) { capability.actionReason = "EXPOSURE_NOT_FOUND"; return capability; }
  if (row.RecognitionIntegrity !== "VALID") {
    capability.actionReason = "SALES_AUTHORITY_INVALID";
    return capability;
  }
  if (!Array.isArray(row.QualityCodes) || row.QualityCodes.length > 0) {
    capability.actionReason = "EXPOSURE_EXCEPTION";
    return capability;
  }
  if (row.ClearingStatus === "UNCLEARED") {
    // Save eligibility: canonical healthy UNCLEARED only (T4 is the final gate).
    capability.canSave = true;
    return capability;
  }
  if (row.ClearingStatus === "CLEARED" && String(row.ActiveReceiptID || "") !== "") {
    // Reverse/Correct target the active ordinary receipt of a healthy CLEARED
    // exposure; T6 revalidates eligibility well beyond this advisory check.
    capability.canReverse = true;
    capability.canCorrect = true;
    return capability;
  }
  capability.actionReason = row.ClearingStatus === "CLEARED" ? "NO_ACTIVE_RECEIPT" :
    "EXPOSURE_EXCEPTION";
  return capability;
}

// Per-receipt capability for the detail surface. Target must be the active
// ordinary receipt of a healthy CLEARED exposure under an allowed mode.
function treasuryOperatorReceiptCapability_(receipt, exposureRow, gate, reversedIds) {
  var capability = { canReverse: false, canCorrect: false, actionReason: "" };
  if (!gate || gate.allowed !== true) {
    capability.actionReason = gate && gate.code ? gate.code : "TREASURY_CONFIG_INVALID";
    return capability;
  }
  if (!exposureRow) { capability.actionReason = "EXPOSURE_NOT_FOUND"; return capability; }
  if (exposureRow.RecognitionIntegrity !== "VALID") {
    capability.actionReason = "SALES_AUTHORITY_INVALID";
    return capability;
  }
  if (!Array.isArray(exposureRow.QualityCodes) || exposureRow.QualityCodes.length > 0) {
    capability.actionReason = "EXPOSURE_EXCEPTION";
    return capability;
  }
  if (exposureRow.ClearingStatus !== "CLEARED") {
    capability.actionReason = "NOT_CLEARED";
    return capability;
  }
  if (!receipt) { capability.actionReason = "NO_ACTIVE_RECEIPT"; return capability; }
  if (reversedIds && reversedIds[String(receipt.treasuryReceiptID)]) {
    capability.actionReason = "ALREADY_REVERSED";
    return capability;
  }
  if (String(receipt.receiptType) !== "SALES_RECEIPT") {
    capability.actionReason = "NOT_AN_ACTIVE_RECEIPT";
    return capability;
  }
  var activeIds = String(exposureRow.ActiveReceiptID || "").split(",");
  if (activeIds.indexOf(String(receipt.treasuryReceiptID)) === -1) {
    capability.actionReason = "NOT_AN_ACTIVE_RECEIPT";
    return capability;
  }
  capability.canReverse = true;
  capability.canCorrect = true;
  return capability;
}

// Display-only account name lookup. Submitted authority is ALWAYS the code;
// names are never consulted for eligibility (T2 section 6).
function treasuryOperatorAccountName_(accounts, code) {
  var matches = accounts.filter(function(row) {
    return String(row && row.AccountCode !== undefined && row.AccountCode !== null ?
      row.AccountCode : "").trim() === code;
  });
  return matches.length === 1 ? String(matches[0].AccountName || "") : "";
}

// Sanitized receipt row for the detail surface. SnapshotJSON is evidence and
// is never exposed to (or read by) the UI; JournalSignature stays server-side.
function treasuryOperatorSanitizeReceipt_(row, reversedIds) {
  var role = row.ReversalOfReceiptID ? "REVERSAL" :
    (row.OriginalReceiptID ? "REPLACEMENT" : "ORIGINAL");
  return {
    treasuryReceiptID: String(row.TreasuryReceiptID || ""),
    receiptType: String(row.ReceiptType || ""),
    lineageRole: role,
    receiptStatus: reversedIds[String(row.TreasuryReceiptID)] ? "REVERSED" : "ACTIVE",
    recognitionID: String(row.RecognitionID || ""),
    orderID: String(row.OrderID || ""),
    revisionID: String(row.RevisionID || ""),
    destinationAccountCode: String(row.DestinationAccountCode || ""),
    grossAmount: Number(row.GrossAmount),
    receiptDate: String(row.ReceiptDate || ""),
    economicDate: String(row.EconomicDate || ""),
    evidenceType: String(row.EvidenceType || ""),
    evidenceRef: String(row.EvidenceRef || ""),
    journalID: String(row.JournalID || ""),
    operationID: String(row.OperationID || ""),
    postingStatus: String(row.PostingStatus || ""),
    originalReceiptID: String(row.OriginalReceiptID || ""),
    reversalOfReceiptID: String(row.ReversalOfReceiptID || ""),
    replacementReceiptID: String(row.ReplacementReceiptID || ""),
    reason: String(row.Reason || ""),
    actor: String(row.Actor || ""),
    receivedAt: String(row.ReceivedAt || "")
  };
}

// ---------------------------------------------------------------------------
// Public operator endpoints (google.script.run targets). Read endpoints are
// bounded read-only compositions over the T5 canonical reader + T3 master;
// mutation endpoints are one-line delegations to the T4/T6 durable wrappers
// (same-key replay/recovery therefore needs NO separate endpoint).
// ---------------------------------------------------------------------------

// Workspace load: canonical projection + global 1030 reconciliation +
// T3-authorized destinations + advisory capabilities + mode, ONE response.
function getTreasuryOperatorWorkspace(request) {
  var ss = requireNumlockProductionSpreadsheet();
  var projection = buildTreasuryClearingProjection_(ss, request || {});
  var reconciliation = buildTreasury1030Reconciliation_(ss, request || {});
  var accounts = treasuryReceiptAccountRows_(ss);
  var gate = treasuryReceiptResolvedGate();
  var capabilities = {};
  projection.rows.forEach(function(row) {
    capabilities[String(row.RecognitionID)] = treasuryOperatorRowCapability_(row, gate);
  });
  var destinations = TREASURY_RECEIPT_V1_CONTRACT.DESTINATION_ACCOUNT_CODES
    .filter(function(code) {
      return treasuryDestinationEligible(code, accounts).eligible === true;
    })
    .map(function(code) {
      return { accountCode: code, accountName: treasuryOperatorAccountName_(accounts, code) };
    });
  return {
    contract: TREASURY_OPERATOR_API.WORKSPACE_CONTRACT,
    receipts: projection,
    reconciliation: reconciliation,
    destinations: destinations,
    capabilities: capabilities,
    mode: { mode: gate.mode, allowed: gate.allowed === true, code: gate.code || "" }
  };
}

// Receipt detail: ONE canonical exposure read + the exposure's receipt rows
// (lineage, derived ReceiptStatus, operation state) + advisory capability.
function getTreasuryOperatorReceiptDetail(request) {
  var ss = requireNumlockProductionSpreadsheet();
  var exposure = buildTreasuryClearingExposure_(ss, request || {});
  if (exposure.status !== "OK") {
    var unavailableReason = exposure.status === "VOIDED" ?
      "EXPOSURE_VOIDED" : "EXPOSURE_NOT_FOUND";
    return {
      contract: TREASURY_OPERATOR_API.DETAIL_CONTRACT,
      status: exposure.status,
      asOfDate: exposure.asOfDate,
      recognitionID: exposure.recognitionID || String((request || {}).recognitionID || ""),
      voidedExposure: exposure.voidedExposure || null,
      receipts: [],
      capabilities: { canReverse: false, canCorrect: false, actionReason: unavailableReason }
    };
  }
  var row = exposure.row;
  var schema = TREASURY_RECEIPT_V1_CONTRACT.SCHEMAS;
  var receiptRows = readCanonicalTable(ss, schema.RECEIPTS.SHEET, schema.RECEIPTS.HEADERS)
    .filter(function(entry) { return String(entry.RecognitionID) === String(row.RecognitionID); });
  var operations = readCanonicalTable(ss, schema.OPERATIONS.SHEET, schema.OPERATIONS.HEADERS);
  var operationStateById = Object.create(null);
  operations.forEach(function(entry) {
    operationStateById[String(entry.TreasuryOperationID)] = String(entry.State || "");
  });
  // Derived ReceiptStatus (T2 section 4.1): a committed reversal row targeting
  // this receipt reverses it. Lineage lookup only — never an accounting rule.
  var reversedIds = Object.create(null);
  receiptRows.forEach(function(entry) {
    if (String(entry.ReceiptType) === "SALES_RECEIPT_REVERSAL" &&
        String(entry.PostingStatus) === "COMMITTED" && entry.ReversalOfReceiptID) {
      reversedIds[String(entry.ReversalOfReceiptID)] = true;
    }
  });
  var receipts = receiptRows.map(function(entry) {
    var sanitized = treasuryOperatorSanitizeReceipt_(entry, reversedIds);
    sanitized.operationState = operationStateById[String(entry.OperationID)] || "";
    return sanitized;
  });
  var activeId = String(row.ActiveReceiptID || "").split(",")[0];
  var activeReceipt = receipts.filter(function(entry) {
    return entry.treasuryReceiptID === activeId;
  })[0] || null;
  var gate = treasuryReceiptResolvedGate();
  return {
    contract: TREASURY_OPERATOR_API.DETAIL_CONTRACT,
    status: "OK",
    asOfDate: exposure.asOfDate,
    recognitionID: String(row.RecognitionID),
    exposure: row,
    receipts: receipts,
    capabilities: treasuryOperatorReceiptCapability_(activeReceipt, row, gate, reversedIds)
  };
}

// Durable Save dispatch (T4). Same RequestKey replay/recovery = same call.
function treasuryOperatorSaveReceipt(payload) {
  return treasuryReceiptDurableSave(payload);
}

// Durable Reverse dispatch (T6). No editable ReversalDate exists on any path
// (T2 section 9: the server action day is the only reversal date authority).
function treasuryOperatorReverseReceipt(payload) {
  return treasuryReceiptDurableReverse(payload);
}

// Durable Correct dispatch (T6). Amount is never a client fact: T6 clears the
// full post-reversal exposure from the target receipt.
function treasuryOperatorCorrectReceipt(payload) {
  return treasuryReceiptDurableCorrect(payload);
}
