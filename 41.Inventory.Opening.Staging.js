var INVENTORY_OPENING_STAGING_POLICY = Object.freeze({
  VERSION: "11Q",
  MIGRATION_ID: "INVENTORY-OPENINGS-STAGING-20260905",
  SHEET: "InventoryOpenings",
  CUTOVER_DATE: "2026-09-30",
  EFFECTIVE_FROM: "2026-10-01",
  DEFAULT_LOCATION: "MAIN",
  PROHIBITED_ITEM_ID: "ING-018",
  ELIGIBLE_ITEM_IDS: Object.freeze(["ING-004", "ING-005", "ING-006", "ING-007", "ING-008", "ING-009",
    "ING-010", "ING-011", "ING-012", "ING-013", "ING-014", "ING-015", "ING-016", "ING-017",
    "ING-019", "ING-020", "ING-021", "ING-031", "ING-032", "ING-033", "ING-034"]),
  HEADERS: Object.freeze(["OpeningID", "SupersedesOpeningID", "OpeningBatchID", "CutoverDate", "ItemID", "Location", "BaseUOM",
    "ObservedQty", "ObservationTimestamp", "QuantityEvidenceRef", "UnitCost", "TotalValue", "ValuationBasis",
    "ValuationEvidenceRef", "AcquisitionEvidenceRef", "AccountingSourceRef", "EconomicOrigin", "PreparedBy",
    "PreparedAt", "ReviewedBy", "ReviewedAt", "ApprovalStatus", "IsActive", "CreatedAt", "CreatedBy",
    "UpdatedAt", "UpdatedBy"]),
  ECONOMIC_ORIGINS: Object.freeze(["PRIOR_PERIOD_EXPENSED", "CURRENT_PERIOD_EXPENSED", "OWNER_CONTRIBUTED",
    "UNPAID_SUPPLIER", "OTHER_SUPPORTED", "UNRESOLVED"]),
  APPROVAL_STATUSES: Object.freeze(["DRAFT", "COUNT_VERIFIED", "VALUATION_VERIFIED", "NEEDS_SOURCE_EVIDENCE",
    "CLASSIFICATION_CONFLICT", "READY_FOR_ACCOUNTING_REVIEW"]),
  BALANCING_AUTHORITY: "NONE",
  PRODUCTION_MUTATION: false
});

var INVENTORY_OPENING_REVIEW_POLICY = Object.freeze({
  VERSION: "11S",
  BATCH_ID: "INV-OPEN-20261001-V01",
  EXPECTED_COUNT: 21,
  ARTIFACT_FILE: "inventory-opening-evidence-intake.xlsx",
  ARTIFACT_VERSION: "V01",
  FROZEN_ARTIFACT_SHA256: "",
  MIGRATION_ID: "INVENTORY-OPENINGS-POPULATION-20260905",
  PRODUCTION_MUTATION: false
});

function inventoryOpeningStagingText(value) {
  return String(value == null ? "" : value).trim();
}

function inventoryOpeningStagingDecimalPlaces(value) {
  var text = inventoryOpeningStagingText(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return null;
  var decimal = text.indexOf(".");
  return decimal === -1 ? 0 : text.length - decimal - 1;
}

function inventoryOpeningStagingEligibleIndex() {
  var result = {};
  INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.forEach(function(id) { result[id] = true; });
  return result;
}

function inventoryOpeningStagingConversionReadiness(itemId, conversions, items) {
  return classifyInventoryConversionReadiness(itemId, INVENTORY_OPENING_STAGING_POLICY.EFFECTIVE_FROM,
    items || [], conversions || []).status;
}

function classifyInventoryOpeningStagingRow(row, item, conversions, items) {
  var quantityText = inventoryOpeningStagingText(row && row.ObservedQty);
  var quantity = Number(quantityText), totalValue = Number(row && row.TotalValue);
  var zero = quantityText !== "" && quantity === 0;
  var hasCount = quantityText !== "" && quantity >= 0 && isFinite(quantity) &&
    inventoryOpeningStagingDecimalPlaces(quantityText) <= 6 &&
    inventoryTimestampMillis(row && row.ObservationTimestamp) !== null &&
    inventoryTimestampDateKey(row && row.ObservationTimestamp) === INVENTORY_OPENING_STAGING_POLICY.CUTOVER_DATE &&
    !!inventoryOpeningStagingText(row && row.QuantityEvidenceRef);
  if (!hasCount) return "DRAFT";
  if (zero) return "COUNT_VERIFIED";
  var unitCostText = inventoryOpeningStagingText(row && row.UnitCost), unitCost = Number(unitCostText);
  var valued = unitCostText !== "" && unitCost >= 0 && isFinite(unitCost) &&
    inventoryOpeningStagingDecimalPlaces(unitCostText) <= 10 && isFinite(totalValue) && totalValue >= 0 &&
    Math.floor(totalValue) === totalValue && inventoryRoundRupiahHalfUp(quantity * unitCost) === totalValue &&
    !!inventoryOpeningStagingText(row && row.ValuationBasis) &&
    !!inventoryOpeningStagingText(row && row.ValuationEvidenceRef);
  if (!valued) return "COUNT_VERIFIED";
  var origin = inventoryOpeningStagingText(row && row.EconomicOrigin);
  if (origin === "UNRESOLVED" || !inventoryOpeningStagingText(row && row.AcquisitionEvidenceRef) ||
      !inventoryOpeningStagingText(row && row.AccountingSourceRef)) return "NEEDS_SOURCE_EVIDENCE";
  if (INVENTORY_OPENING_STAGING_POLICY.ECONOMIC_ORIGINS.indexOf(origin) === -1 ||
      origin === "UNPAID_SUPPLIER" && !/^AP:/.test(inventoryOpeningStagingText(row && row.AccountingSourceRef)) ||
      origin === "OWNER_CONTRIBUTED" && !/^OWNER:/.test(inventoryOpeningStagingText(row && row.AccountingSourceRef))) {
    return "CLASSIFICATION_CONFLICT";
  }
  var preparedBy = inventoryOpeningStagingText(row && row.PreparedBy);
  var reviewedBy = inventoryOpeningStagingText(row && row.ReviewedBy);
  var preparedAt = inventoryTimestampMillis(row && row.PreparedAt);
  var reviewedAt = inventoryTimestampMillis(row && row.ReviewedAt);
  if (!preparedBy || !reviewedBy || preparedBy === reviewedBy || preparedAt === null || reviewedAt === null ||
      reviewedAt <= preparedAt) return "VALUATION_VERIFIED";
  return inventoryOpeningStagingConversionReadiness(inventoryOpeningStagingText(row && row.ItemID), conversions, items) ===
    "SINGLE_OPERATOR_VERIFIED" || inventoryOpeningStagingConversionReadiness(
      inventoryOpeningStagingText(row && row.ItemID), conversions, items) === "VERIFIED" ?
    "READY_FOR_ACCOUNTING_REVIEW" : "VALUATION_VERIFIED";
}

function validateInventoryOpeningStagingRows(rows, items, conversions) {
  var itemMap = inventoryItemIndex(items), eligible = inventoryOpeningStagingEligibleIndex();
  var ids = {}, activeScopes = {}, errors = [], acceptedRows = [];
  (rows || []).forEach(function(row, index) {
    var rowErrors = balanceContractMissingFields(row, INVENTORY_OPENING_STAGING_POLICY.HEADERS);
    var id = inventoryOpeningStagingText(row && row.OpeningID);
    var supersedes = inventoryOpeningStagingText(row && row.SupersedesOpeningID);
    var batch = inventoryOpeningStagingText(row && row.OpeningBatchID);
    var itemId = inventoryOpeningStagingText(row && row.ItemID);
    var location = inventoryOpeningStagingText(row && row.Location);
    var scope = batch + "|" + itemId + "|" + location;
    if (!id || ids[id]) rowErrors.push("DUPLICATE_OR_MISSING_OPENING_ID");
    if (supersedes === id) rowErrors.push("INVALID_SELF_SUPERSESSION");
    ids[id] = true;
    if (!batch) rowErrors.push("MISSING_OPENING_BATCH_ID");
    if (capitalEquityDateKey(row && row.CutoverDate) !== INVENTORY_OPENING_STAGING_POLICY.CUTOVER_DATE) {
      rowErrors.push("INVALID_CUTOVER_DATE");
    }
    if (itemId === INVENTORY_OPENING_STAGING_POLICY.PROHIBITED_ITEM_ID) rowErrors.push("PROHIBITED_LEMON_ITEM");
    if (!eligible[itemId]) rowErrors.push("INELIGIBLE_ITEM_ID");
    var item = itemMap.items[itemId];
    if (!item || itemMap.duplicates[itemId] || !isCanonicalActive(item && item.IsActive)) rowErrors.push("UNRESOLVED_ITEM_ID");
    if (location !== INVENTORY_OPENING_STAGING_POLICY.DEFAULT_LOCATION) rowErrors.push("UNSUPPORTED_LOCATION");
    if (item && inventoryOpeningStagingText(row && row.BaseUOM) !== inventoryOpeningStagingText(item.BaseUOM)) {
      rowErrors.push("BASE_UOM_MISMATCH");
    }
    var quantityText = inventoryOpeningStagingText(row && row.ObservedQty);
    var quantity = Number(quantityText), quantityDecimals = inventoryOpeningStagingDecimalPlaces(quantityText);
    if (!quantityText) rowErrors.push("MISSING_OBSERVATION");
    else if (!isFinite(quantity) || quantity < 0 || quantityDecimals === null || quantityDecimals > 6) {
      rowErrors.push("INVALID_OBSERVED_QUANTITY");
    }
    if (inventoryTimestampMillis(row && row.ObservationTimestamp) === null ||
        inventoryTimestampDateKey(row && row.ObservationTimestamp) !== INVENTORY_OPENING_STAGING_POLICY.CUTOVER_DATE) {
      rowErrors.push("INVALID_OBSERVATION_TIMESTAMP");
    }
    if (!inventoryOpeningStagingText(row && row.QuantityEvidenceRef)) {
      rowErrors.push(quantity === 0 && quantityText ? "FALSE_ZERO_WITHOUT_EVIDENCE" : "MISSING_QUANTITY_EVIDENCE");
    }
    var unitCostText = inventoryOpeningStagingText(row && row.UnitCost), totalText = inventoryOpeningStagingText(row && row.TotalValue);
    if (quantityText && quantity === 0) {
      if (unitCostText) rowErrors.push("ZERO_UNIT_COST_MUST_BE_BLANK");
      if (Number(totalText) !== 0 || totalText === "") rowErrors.push("ZERO_TOTAL_VALUE_REQUIRED");
      if (inventoryOpeningStagingText(row && row.ValuationBasis) ||
          inventoryOpeningStagingText(row && row.ValuationEvidenceRef)) rowErrors.push("ZERO_VALUATION_MUST_BE_BLANK");
    } else if (quantity > 0) {
      var unitCost = Number(unitCostText), totalValue = Number(totalText), costDecimals = inventoryOpeningStagingDecimalPlaces(unitCostText);
      if (!unitCostText || !isFinite(unitCost) || unitCost < 0 || costDecimals === null || costDecimals > 10) {
        rowErrors.push("INVALID_UNIT_COST");
      }
      if (!isFinite(totalValue) || totalValue < 0 || Math.floor(totalValue) !== totalValue ||
          isFinite(unitCost) && inventoryRoundRupiahHalfUp(quantity * unitCost) !== totalValue) {
        rowErrors.push("INVALID_TOTAL_VALUE_ROUNDING");
      }
      if (!inventoryOpeningStagingText(row && row.ValuationBasis) ||
          !inventoryOpeningStagingText(row && row.ValuationEvidenceRef)) rowErrors.push("MISSING_VALUATION_EVIDENCE");
    }
    var origin = inventoryOpeningStagingText(row && row.EconomicOrigin);
    if (INVENTORY_OPENING_STAGING_POLICY.ECONOMIC_ORIGINS.indexOf(origin) === -1) rowErrors.push("INVALID_ECONOMIC_ORIGIN");
    var classified = classifyInventoryOpeningStagingRow(row, item, conversions, items);
    if (inventoryOpeningStagingText(row && row.ApprovalStatus) !== classified) rowErrors.push("APPROVAL_STATUS_MISMATCH");
    if (isCanonicalActive(row && row.IsActive)) {
      if (activeScopes[scope]) rowErrors.push("DUPLICATE_ACTIVE_CANDIDATE");
      activeScopes[scope] = true;
      acceptedRows.push(row);
    }
    if (rowErrors.length) errors.push({ row: index + 1, id: id, errors: rowErrors });
  });
  return { status: errors.length ? "FAIL" : "PASS", errors: errors, acceptedRows: acceptedRows,
    appendOnly: true, authoritativeLedger: false, accountingPostingAllowed: false,
    balancingAuthority: INVENTORY_OPENING_STAGING_POLICY.BALANCING_AUTHORITY,
    productionMutation: INVENTORY_OPENING_STAGING_POLICY.PRODUCTION_MUTATION };
}

function buildInventoryOpeningStagingCorrectionPlan(original, replacement) {
  var immutable = ["OpeningBatchID", "CutoverDate", "ItemID", "Location", "BaseUOM"];
  if (!original || !replacement || !isCanonicalActive(original.IsActive) || !isCanonicalActive(replacement.IsActive) ||
      !inventoryOpeningStagingText(original.OpeningID) || !inventoryOpeningStagingText(replacement.OpeningID) ||
      inventoryOpeningStagingText(original.OpeningID) === inventoryOpeningStagingText(replacement.OpeningID) ||
      inventoryOpeningStagingText(replacement.SupersedesOpeningID) !== inventoryOpeningStagingText(original.OpeningID) ||
      immutable.some(function(field) {
        return inventoryOpeningStagingText(original[field]) !== inventoryOpeningStagingText(replacement[field]);
      })) {
    return { status: "REFUSED", reason: "INVALID_CORRECTION_LINEAGE_OR_SCOPE", writeCount: 0, productionMutation: false };
  }
  return { status: "READY", writeCount: 2, productionMutation: false, appendOnlyEvidenceVersion: true,
    deactivateOpeningId: inventoryOpeningStagingText(original.OpeningID), appendOpeningId: inventoryOpeningStagingText(replacement.OpeningID),
    silentHistoricalMutationAllowed: false };
}

function classifyInventoryOpeningBatch(batchId, rows, items, conversions) {
  var target = inventoryOpeningStagingText(batchId), eligible = inventoryOpeningStagingEligibleIndex();
  var candidates = (rows || []).filter(function(row) {
    return isCanonicalActive(row && row.IsActive) && inventoryOpeningStagingText(row.OpeningBatchID) === target;
  });
  var validation = validateInventoryOpeningStagingRows(candidates, items, conversions), scopes = {};
  candidates.forEach(function(row) { scopes[inventoryOpeningStagingText(row.ItemID) + "|" + inventoryOpeningStagingText(row.Location)] = true; });
  var missing = INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.filter(function(id) { return !scopes[id + "|MAIN"]; });
  var conversionsReady = INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.every(function(id) {
    var readiness = inventoryOpeningStagingConversionReadiness(id, conversions, items);
    return readiness === "VERIFIED" || readiness === "SINGLE_OPERATOR_VERIFIED";
  });
  var complete = validation.status === "PASS" && candidates.length === 21 && !missing.length && conversionsReady &&
    Object.keys(scopes).every(function(scope) { return !!eligible[scope.split("|")[0]]; });
  var accountingReady = complete && candidates.every(function(row) {
    return Number(row.ObservedQty) === 0 || inventoryOpeningStagingText(row.ApprovalStatus) === "READY_FOR_ACCOUNTING_REVIEW";
  });
  return { status: complete ? "COMPLETE" : "INCOMPLETE", evidenceComplete: complete,
    accountingReadiness: accountingReady ? "READY_FOR_ACCOUNTING_REVIEW" : "NEEDS_SOURCE_EVIDENCE",
    accountingAuthorized: false, postingAllowed: false, balancingAuthority: "NONE", missingItemIds: missing,
    eligibleCount: INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.length, candidateCount: candidates.length,
    conversionsApplicable: conversionsReady, errors: validation.errors };
}

function buildInventoryOpeningPostingPlan() {
  return { status: "REFUSED", reason: "PHASE_11Q_STAGING_ONLY", writeCount: 0, inventoryLedgerRows: 0,
    balanceLedgerRows: 0, account1100Mutation: false, productionMutation: false, balancingAuthority: "NONE" };
}

function inventoryOpeningReviewArtifactIntegrity(identity, trustedIdentity) {
  var expected = trustedIdentity || { fileName: INVENTORY_OPENING_REVIEW_POLICY.ARTIFACT_FILE,
    version: INVENTORY_OPENING_REVIEW_POLICY.ARTIFACT_VERSION,
    sha256: INVENTORY_OPENING_REVIEW_POLICY.FROZEN_ARTIFACT_SHA256, frozen: true, reviewed: true };
  var expectedHash = inventoryOpeningStagingText(expected.sha256).toLowerCase();
  var actualHash = inventoryOpeningStagingText(identity && identity.sha256).toLowerCase();
  var valid = !!identity && identity.frozen === true && identity.reviewed === true &&
    expected.frozen === true && expected.reviewed === true && identity.fileName === expected.fileName &&
    identity.version === expected.version &&
    /^[a-f0-9]{64}$/.test(actualHash) && !!expectedHash && actualHash === expectedHash;
  return { status: valid ? "PASS" : "REFUSED_MUTABLE_OR_UNFROZEN_ARTIFACT",
    fileName: identity && identity.fileName || "", version: identity && identity.version || "",
    sha256: actualHash, configured: !!expectedHash, productionMutation: false };
}

function inventoryOpeningReviewCandidateFromIntake(row, items, conversions) {
  var candidate = {};
  INVENTORY_OPENING_STAGING_POLICY.HEADERS.forEach(function(header) { candidate[header] = ""; });
  ["OpeningID", "OpeningBatchID", "CutoverDate", "ItemID", "Location", "BaseUOM", "ObservedQty",
    "ObservationTimestamp", "QuantityEvidenceRef", "UnitCost", "TotalValue", "ValuationBasis",
    "ValuationEvidenceRef", "AcquisitionEvidenceRef", "AccountingSourceRef", "EconomicOrigin",
    "PreparedBy", "PreparedAt", "ReviewedBy", "ReviewedAt"].forEach(function(field) {
      candidate[field] = row && row[field] === undefined ? "" : row[field];
    });
  candidate.SupersedesOpeningID = "";
  candidate.IsActive = true;
  candidate.CreatedAt = candidate.ReviewedAt;
  candidate.CreatedBy = candidate.PreparedBy;
  candidate.UpdatedAt = candidate.ReviewedAt;
  candidate.UpdatedBy = candidate.PreparedBy;
  var item = inventoryItemIndex(items || []).items[inventoryOpeningStagingText(candidate.ItemID)];
  candidate.ApprovalStatus = classifyInventoryOpeningStagingRow(candidate, item, conversions || [], items || []);
  return candidate;
}

function classifyInventoryOpeningReviewReadiness(candidate, validationErrors) {
  if (validationErrors && validationErrors.length) return "INTAKE_INCOMPLETE";
  var status = inventoryOpeningStagingText(candidate && candidate.ApprovalStatus);
  return status === "DRAFT" ? "INTAKE_INCOMPLETE" : status;
}

function reviewInventoryOpeningIntakePackage(intakeRows, items, conversions, artifactIdentity, trustedIdentity) {
  var candidates = (intakeRows || []).map(function(row) {
    return inventoryOpeningReviewCandidateFromIntake(row, items, conversions);
  }).sort(function(left, right) {
    return left.ItemID < right.ItemID ? -1 : left.ItemID > right.ItemID ? 1 : 0;
  });
  var validation = validateInventoryOpeningStagingRows(candidates, items, conversions);
  var batch = classifyInventoryOpeningBatch(INVENTORY_OPENING_REVIEW_POLICY.BATCH_ID, candidates, items, conversions);
  var artifact = inventoryOpeningReviewArtifactIntegrity(artifactIdentity, trustedIdentity);
  var errorsByRow = {};
  validation.errors.forEach(function(error) { errorsByRow[error.row - 1] = error.errors; });
  var readiness = candidates.map(function(candidate, index) {
    return { ItemID: candidate.ItemID, Location: candidate.Location,
      status: classifyInventoryOpeningReviewReadiness(candidate, errorsByRow[index] || []) };
  });
  var ready = artifact.status === "PASS" && validation.status === "PASS" && batch.status === "COMPLETE";
  return { status: ready ? "PASS" : "BLOCKED", candidates: candidates, validation: validation, batch: batch,
    readiness: readiness, artifactIntegrity: artifact, exactColumnCount: INVENTORY_OPENING_STAGING_POLICY.HEADERS.length,
    accountingAuthorized: false, postingAllowed: false, balancingAuthority: "NONE", productionMutation: false };
}

function inventoryOpeningPopulationRowsMatch(actual, expected) {
  var headers = INVENTORY_OPENING_STAGING_POLICY.HEADERS;
  if (!actual || !expected || actual.length !== expected.length) return false;
  return actual.every(function(row, index) {
    return headers.every(function(header) {
      var left = row[header], right = expected[index][header];
      if (header === "ObservedQty" || header === "UnitCost" || header === "TotalValue") return Number(left) === Number(right);
      if (header === "IsActive") return isCanonicalActive(left) === isCanonicalActive(right);
      if (header === "CutoverDate") return capitalEquityDateKey(left) === capitalEquityDateKey(right);
      if (["ObservationTimestamp", "PreparedAt", "ReviewedAt", "CreatedAt", "UpdatedAt"].indexOf(header) !== -1) {
        return inventoryTimestampMillis(left) === inventoryTimestampMillis(right);
      }
      return inventoryOpeningStagingText(left) === inventoryOpeningStagingText(right);
    });
  });
}

function buildInventoryOpeningPopulationPlan(state, review) {
  if (!review || review.status !== "PASS" || review.artifactIntegrity.status !== "PASS") {
    return { status: "REFUSED", reason: "REVIEWED_FROZEN_ARTIFACT_REQUIRED", writeCount: 0, productionMutation: false };
  }
  if (!state || !inventoryMigrationExactHeaders(state.openings, INVENTORY_OPENING_STAGING_POLICY.HEADERS) ||
      state.openings.hasFormulas || state.openings.hasNotes ||
      !inventoryMigrationExactHeaders(state.items, BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS) ||
      !inventoryMigrationExactHeaders(state.conversions, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS) ||
      !inventoryMigrationExactHeaders(state.ledger, BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS) ||
      inventoryMigrationRows(state.ledger).length !== 0 || inventoryMigrationAccountState({ accounts: state.accounts }) !== "READY" ||
      inventoryOpeningStagingHasAccountCode(state.accounts, "3210") ||
      !state.balance.exists || !inventoryMigrationExactHeaders(state.balance, BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS) ||
      inventoryMigrationRows(state.balance).length !== 0) {
    return { status: "REFUSED", reason: "PRODUCTION_PREIMAGE_DRIFT", writeCount: 0, productionMutation: false };
  }
  var productionItems = inventoryMigrationRows(state.items), productionConversions = inventoryMigrationRows(state.conversions);
  if (!INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.every(function(itemId) {
      var status = inventoryOpeningStagingConversionReadiness(itemId, productionConversions, productionItems);
      return status === "VERIFIED" || status === "SINGLE_OPERATOR_VERIFIED";
    })) {
    return { status: "REFUSED", reason: "ACTIVE_CONVERSION_AUTHORITY_DRIFT", writeCount: 0, productionMutation: false };
  }
  var candidateValidation = validateInventoryOpeningStagingRows(review.candidates, productionItems, productionConversions);
  var candidateBatch = classifyInventoryOpeningBatch(INVENTORY_OPENING_REVIEW_POLICY.BATCH_ID,
    review.candidates, productionItems, productionConversions);
  if (candidateValidation.status !== "PASS" || candidateBatch.status !== "COMPLETE" ||
      review.candidates.length !== INVENTORY_OPENING_REVIEW_POLICY.EXPECTED_COUNT) {
    return { status: "REFUSED", reason: "INVALID_OR_INCOMPLETE_REVIEWED_CANDIDATES", writeCount: 0,
      productionMutation: false };
  }
  var rows = inventoryMigrationRows(state.openings);
  if (!rows.length) return { status: "READY", writeCount: 1,
    targetValues: inventoryMigrationValues(INVENTORY_OPENING_STAGING_POLICY.HEADERS, review.candidates), productionMutation: false };
  return inventoryOpeningPopulationRowsMatch(rows, review.candidates) ?
    { status: "ALREADY_POPULATED", writeCount: 0, productionMutation: false } :
    { status: "REFUSED", reason: "PARTIAL_MIXED_DRIFT_OR_DUPLICATE_ROWS", writeCount: 0, productionMutation: false };
}

function validateInventoryOpeningPopulationAcceptance(state, review) {
  var rows = inventoryMigrationRows(state.openings);
  return { status: rows.length === INVENTORY_OPENING_REVIEW_POLICY.EXPECTED_COUNT &&
      inventoryOpeningPopulationRowsMatch(rows, review.candidates) &&
      inventoryMigrationRows(state.ledger).length === 0 && inventoryMigrationRows(state.balance).length === 0 ? "PASS" : "FAIL",
    populatedRows: rows.length, inventoryLedgerRows: inventoryMigrationRows(state.ledger).length,
    balanceLedgerRows: inventoryMigrationRows(state.balance).length, postingAllowed: false,
    balancingAuthority: "NONE", productionMutation: false };
}

function executeInventoryOpeningPopulationWithRuntime(runtime, review) {
  inventoryMigrationRequireRuntime(runtime);
  var before = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  var plan = buildInventoryOpeningPopulationPlan(before, review);
  if (plan.status !== "READY") return plan;
  var writes = 0;
  try {
    runtime.spreadsheet.getSheetByName(INVENTORY_OPENING_STAGING_POLICY.SHEET)
      .getRange(2, 1, review.candidates.length, INVENTORY_OPENING_STAGING_POLICY.HEADERS.length)
      .setValues(plan.targetValues.slice(1));
    writes = 1; runtime.flush();
    var after = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    var acceptance = validateInventoryOpeningPopulationAcceptance(after, review);
    if (acceptance.status !== "PASS") throw new Error("INVENTORY_OPENING_POPULATION_ACCEPTANCE_FAILED");
    return { status: "POPULATED", writeCount: writes, acceptance: acceptance, productionMutation: false,
      migrationRecord: { migrationId: INVENTORY_OPENING_REVIEW_POLICY.MIGRATION_ID,
        version: INVENTORY_OPENING_REVIEW_POLICY.VERSION, preState: before,
        preStateFingerprint: inventoryOpeningStagingFingerprint(before), acceptedPostState: after,
        postStateFingerprint: inventoryOpeningStagingFingerprint(after), candidateRows: review.candidates } };
  } catch (error) {
    return { status: "FAILED_REQUIRES_OWNED_RECOVERY", reason: error.message, writeCount: writes, productionMutation: false };
  }
}

function executeInventoryOpeningPopulationRecoveryWithRuntime(runtime, record) {
  inventoryMigrationRequireRuntime(runtime);
  if (!record || record.migrationId !== INVENTORY_OPENING_REVIEW_POLICY.MIGRATION_ID ||
      record.version !== INVENTORY_OPENING_REVIEW_POLICY.VERSION || !record.preState || !record.acceptedPostState ||
      !record.candidateRows || record.preStateFingerprint !== inventoryOpeningStagingFingerprint(record.preState) ||
      record.postStateFingerprint !== inventoryOpeningStagingFingerprint(record.acceptedPostState)) {
    return { status: "REFUSED", reason: "INCOMPLETE_OR_UNIDENTIFIED_SNAPSHOT", writeCount: 0, productionMutation: false };
  }
  var current = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  if (inventoryMigrationRows(current.ledger).length || inventoryMigrationRows(current.balance).length) {
    return { status: "REFUSED", reason: "DOWNSTREAM_ACCOUNTING_DEPENDENCY_EXISTS", writeCount: 0, productionMutation: false };
  }
  if (inventoryOpeningStagingFingerprint(current) !== record.postStateFingerprint ||
      !inventoryOpeningPopulationRowsMatch(inventoryMigrationRows(current.openings), record.candidateRows)) {
    return { status: "REFUSED", reason: "POST_IMAGE_CHANGED_OR_NOT_OWNED", writeCount: 0, productionMutation: false };
  }
  runtime.spreadsheet.getSheetByName(INVENTORY_OPENING_STAGING_POLICY.SHEET)
    .getRange(2, 1, record.candidateRows.length, INVENTORY_OPENING_STAGING_POLICY.HEADERS.length).clearContent();
  runtime.flush();
  var restored = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  return { status: inventoryOpeningStagingFingerprint(restored) === record.preStateFingerprint ? "RECOVERED" : "FAILED_ROLLBACK",
    writeCount: 1, productionMutation: false };
}

function runInventoryOpeningPopulation() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    return { status: "REFUSED", reason: "FROZEN_REVIEWED_ARTIFACT_NOT_CONFIGURED", writeCount: 0,
      postingAllowed: false, balancingAuthority: "NONE", productionMutation: false };
  } finally { if (acquired) lock.releaseLock(); }
}

function inventoryOpeningReviewSyntheticPackage(state) {
  var items = inventoryMigrationRows(state.items), conversions = inventoryMigrationRows(state.conversions);
  var rows = INVENTORY_OPENING_STAGING_POLICY.ELIGIBLE_ITEM_IDS.map(function(itemId, index) {
    var item = inventoryItemIndex(items).items[itemId];
    return { OpeningID: "OPEN-" + itemId + "-MAIN-20260930-V01",
      OpeningBatchID: INVENTORY_OPENING_REVIEW_POLICY.BATCH_ID, CutoverDate: "2026-09-30",
      ItemID: itemId, Location: "MAIN", BaseUOM: item.BaseUOM, ObservedQty: "2.500000",
      ObservationTimestamp: "2026-09-30T23:00:00+07:00", QuantityEvidenceRef: "SYNTHETIC:COUNT:" + itemId,
      UnitCost: "40.4", TotalValue: 101, ValuationBasis: "SYNTHETIC_SUPPORTED_ACQUISITION_COST",
      ValuationEvidenceRef: "SYNTHETIC:VALUATION:" + itemId,
      AcquisitionEvidenceRef: "SYNTHETIC:ACQUISITION:" + itemId,
      AccountingSourceRef: "EXPENSE:SYNTHETIC:" + itemId, EconomicOrigin: "CURRENT_PERIOD_EXPENSED",
      PreparedBy: "Synthetic Preparer", PreparedAt: "2026-09-30T23:10:00+07:00",
      ReviewedBy: "Synthetic Reviewer", ReviewedAt: "2026-10-01T09:00:00+07:00", Sequence: index };
  });
  var identity = { fileName: "inventory-opening-evidence-intake-runtime-reviewed.xlsx", version: "V01-RUNTIME",
    sha256: new Array(65).join("d"), frozen: true, reviewed: true };
  return { rows: rows, items: items, conversions: conversions, identity: identity,
    review: reviewInventoryOpeningIntakePackage(rows, items, conversions, identity, identity) };
}

function inventoryOpeningReviewDisposableFixture(runtime, canonicalId, owned, label, sourceState) {
  var ownership = inventoryOpeningStagingDisposableFixture(runtime, canonicalId, owned, "11S_" + label, sourceState);
  var spreadsheet = runtime.openById(ownership.spreadsheetId);
  var openings = spreadsheet.insertSheet(INVENTORY_OPENING_STAGING_POLICY.SHEET);
  balanceFoundationResizeDisposableSheet(openings, Math.max(sourceState.openings.maxRows || 1000, 22), 27);
  openings.getRange(1, 1, 1, 27).setValues([INVENTORY_OPENING_STAGING_POLICY.HEADERS.slice()]);
  runtime.flush();
  return ownership;
}

function inventoryOpeningReviewDisposableContext(runtime, ownership) {
  return { mode: INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_MODE, disposableOwnership: ownership,
    spreadsheet: runtime.openById(ownership.spreadsheetId), freshSpreadsheet: function() {
      return runtime.openById(ownership.spreadsheetId);
    }, flush: runtime.flush };
}

function executeInventoryOpeningReviewDisposableRuntimeProofWithRuntime(runtime) {
  var owned = [], cleanupFailures = [], failure = null, result = null, productionBefore = null;
  try {
    var canonical = runtime.openCanonical();
    inventoryDisposableRuntimeProofRequire(canonical && String(canonical.getId()) ===
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, "canonical production identity unavailable");
    var productionState = readInventoryOpeningStagingMigrationState(canonical);
    productionBefore = inventoryOpeningStagingFingerprint(productionState);
    inventoryDisposableRuntimeProofRequire(classifyInventoryOpeningStagingStorage(productionState) === "POST_IMAGE",
      "production InventoryOpenings must be exact header-only authority");
    var synthetic = inventoryOpeningReviewSyntheticPackage(productionState), review = synthetic.review;
    inventoryDisposableRuntimeProofRequire(review.status === "PASS" && review.candidates.length === 21 &&
      review.exactColumnCount === 27 && review.batch.status === "COMPLETE", "review transformation exact21 exact27 complete");
    inventoryDisposableRuntimeProofRequire(review.readiness.every(function(row) {
      return row.status === "READY_FOR_ACCOUNTING_REVIEW";
    }), "ready review classification");
    var zero = Object.assign({}, synthetic.rows[0], { ObservedQty: 0, UnitCost: "", TotalValue: 0,
      ValuationBasis: "", ValuationEvidenceRef: "" });
    var unresolved = Object.assign({}, synthetic.rows[0], { AcquisitionEvidenceRef: "", AccountingSourceRef: "",
      EconomicOrigin: "UNRESOLVED" });
    var conflict = Object.assign({}, synthetic.rows[0], { EconomicOrigin: "UNPAID_SUPPLIER",
      AccountingSourceRef: "EXPENSE:SYNTHETIC" });
    var unreviewed = Object.assign({}, synthetic.rows[0], { ReviewedBy: "", ReviewedAt: "" });
    var incomplete = Object.assign({}, synthetic.rows[0], { ObservedQty: "", QuantityEvidenceRef: "" });
    [
      [incomplete, "INTAKE_INCOMPLETE"], [zero, "COUNT_VERIFIED"], [unreviewed, "VALUATION_VERIFIED"],
      [unresolved, "NEEDS_SOURCE_EVIDENCE"], [conflict, "CLASSIFICATION_CONFLICT"]
    ].forEach(function(entry) {
      var candidate = inventoryOpeningReviewCandidateFromIntake(entry[0], synthetic.items, synthetic.conversions);
      var validation = validateInventoryOpeningStagingRows([candidate], synthetic.items, synthetic.conversions);
      inventoryDisposableRuntimeProofRequire(classifyInventoryOpeningReviewReadiness(candidate,
        validation.errors.length ? validation.errors[0].errors : []) === entry[1], "readiness " + entry[1]);
    });
    inventoryDisposableRuntimeProofRequire(review.artifactIntegrity.status === "PASS" &&
      inventoryOpeningReviewArtifactIntegrity(Object.assign({}, synthetic.identity, { frozen: false }),
        synthetic.identity).status === "REFUSED_MUTABLE_OR_UNFROZEN_ARTIFACT", "artifact integrity and mutable refusal");

    var primaryOwnership = inventoryOpeningReviewDisposableFixture(runtime,
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, owned, "PRIMARY", productionState);
    var primary = inventoryOpeningReviewDisposableContext(runtime, primaryOwnership);
    var ready = buildInventoryOpeningPopulationPlan(readInventoryOpeningStagingMigrationState(primary.spreadsheet), review);
    inventoryDisposableRuntimeProofRequire(ready.status === "READY" && ready.writeCount === 1, "population READY planner");
    var populated = executeInventoryOpeningPopulationWithRuntime(primary, review);
    inventoryDisposableRuntimeProofRequire(populated.status === "POPULATED" && populated.writeCount === 1 &&
      populated.acceptance.status === "PASS" && populated.acceptance.populatedRows === 21 &&
      populated.acceptance.inventoryLedgerRows === 0 && populated.acceptance.balanceLedgerRows === 0 &&
      populated.acceptance.postingAllowed === false && populated.productionMutation === false,
      "one-write exact semantic post-image and posting isolation");
    var second = executeInventoryOpeningPopulationWithRuntime(primary, review);
    inventoryDisposableRuntimeProofRequire(second.status === "ALREADY_POPULATED" && second.writeCount === 0,
      "ALREADY_POPULATED writeCount=0");
    var recovery = executeInventoryOpeningPopulationRecoveryWithRuntime(primary, populated.migrationRecord);
    inventoryDisposableRuntimeProofRequire(recovery.status === "RECOVERED" && recovery.writeCount === 1,
      "exact owned recovery");

    var partialOwnership = inventoryOpeningReviewDisposableFixture(runtime,
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, owned, "PARTIAL", productionState);
    var partial = inventoryOpeningReviewDisposableContext(runtime, partialOwnership);
    partial.spreadsheet.getSheetByName(INVENTORY_OPENING_STAGING_POLICY.SHEET).getRange(2, 1, 1, 27)
      .setValues([inventoryMigrationValues(INVENTORY_OPENING_STAGING_POLICY.HEADERS, [review.candidates[0]])[1]]);
    inventoryDisposableRuntimeProofRequire(executeInventoryOpeningPopulationWithRuntime(partial, review).reason ===
      "PARTIAL_MIXED_DRIFT_OR_DUPLICATE_ROWS", "partial mixed drift refusal");
    var duplicateReview = Object.assign({}, review, { candidates: review.candidates.concat([Object.assign({}, review.candidates[0],
      { OpeningID: "SYNTHETIC-DUPLICATE" })]) });
    var duplicateOwnership = inventoryOpeningReviewDisposableFixture(runtime,
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, owned, "DUPLICATE", productionState);
    inventoryDisposableRuntimeProofRequire(buildInventoryOpeningPopulationPlan(readInventoryOpeningStagingMigrationState(
      runtime.openById(duplicateOwnership.spreadsheetId)), duplicateReview).reason ===
      "INVALID_OR_INCOMPLETE_REVIEWED_CANDIDATES", "duplicate candidate refusal");

    var dependencyOwnership = inventoryOpeningReviewDisposableFixture(runtime,
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, owned, "DEPENDENCY", productionState);
    var dependency = inventoryOpeningReviewDisposableContext(runtime, dependencyOwnership);
    var dependencyPopulation = executeInventoryOpeningPopulationWithRuntime(dependency, review);
    var balanceRow = BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS.map(function(header) {
      return header === "JournalID" ? "SYNTHETIC-DEPENDENCY" : "";
    });
    dependency.spreadsheet.getSheetByName("BalanceLedger").getRange(2, 1, 1, balanceRow.length).setValues([balanceRow]);
    runtime.flush();
    inventoryDisposableRuntimeProofRequire(executeInventoryOpeningPopulationRecoveryWithRuntime(dependency,
      dependencyPopulation.migrationRecord).reason === "DOWNSTREAM_ACCOUNTING_DEPENDENCY_EXISTS",
      "downstream dependency recovery refusal");
    var disabled = runInventoryOpeningPopulation();
    inventoryDisposableRuntimeProofRequire(!INVENTORY_OPENING_REVIEW_POLICY.FROZEN_ARTIFACT_SHA256 &&
      disabled.reason === "FROZEN_REVIEWED_ARTIFACT_NOT_CONFIGURED" && disabled.writeCount === 0,
      "real production executor disabled");
    inventoryDisposableRuntimeProofRequire(inventoryOpeningStagingFingerprint(readInventoryOpeningStagingMigrationState(
      runtime.openCanonical())) === productionBefore, "production fingerprint preserved");
    result = { status: "PASS", reviewedRows: 21, exactColumns: 27, readinessStates: 6,
      artifactIntegrity: "PASS", mutableArtifactRefusal: "PASS", populationWriteCount: 1,
      idempotentWriteCount: 0, recovery: "PASS", dependencyRollbackGuard: "PASS",
      postingAllowed: false, inventoryLedgerWrites: 0, balanceLedgerWrites: 0,
      account1100Mutation: false, productionExecutor: "DISABLED", reviewedArtifactConfigured: false,
      productionMutation: false };
  } catch (error) { failure = error; }
  finally {
    owned.forEach(function(ownership) {
      try {
        inventoryDisposableRuntimeProofRequire(ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
          "refuse canonical cleanup");
        runtime.trashOwnedSpreadsheet(ownership);
        inventoryDisposableRuntimeProofRequire(runtime.isOwnedSpreadsheetTrashed(ownership), "disposable cleanup verification");
      } catch (cleanupError) { cleanupFailures.push(cleanupError.message); }
    });
  }
  if (failure || cleanupFailures.length) throw new Error("INVENTORY_OPENING_REVIEW_DISPOSABLE_PROOF_FAILED:" +
    (failure ? failure.message : "") + (cleanupFailures.length ? ";CLEANUP:" + cleanupFailures.join("|") : ""));
  result.cleanup = "PASS"; return result;
}

function runInventoryOpeningReviewDisposableRuntimeProof() {
  var result = executeInventoryOpeningReviewDisposableRuntimeProofWithRuntime({
    openCanonical: function() { return resolveNumlockProductionSpreadsheetWithRuntime({
      openById: function(id) { return SpreadsheetApp.openById(id); }
    }); }, createToken: function() { return new Date().getTime() + "-" + Utilities.getUuid(); },
    createSpreadsheet: function(name, rows, columns) { return SpreadsheetApp.create(name, rows, columns); },
    openById: function(id) { return SpreadsheetApp.openById(id); }, flush: function() { SpreadsheetApp.flush(); },
    trashOwnedSpreadsheet: function(ownership) { DriveApp.getFileById(ownership.spreadsheetId).setTrashed(true); },
    isOwnedSpreadsheetTrashed: function(ownership) { return DriveApp.getFileById(ownership.spreadsheetId).isTrashed(); }
  });
  Logger.log(JSON.stringify(result)); return result;
}

function inventoryOpeningStagingSnapshot(sheet) {
  return inventoryConversionSchemaMigrationSnapshot(sheet);
}

function readInventoryOpeningStagingMigrationState(spreadsheet) {
  return { openings: inventoryOpeningStagingSnapshot(spreadsheet.getSheetByName(INVENTORY_OPENING_STAGING_POLICY.SHEET)),
    items: inventoryMigrationSnapshot(spreadsheet.getSheetByName("InventoryItems")),
    conversions: inventoryConversionSchemaMigrationSnapshot(spreadsheet.getSheetByName("InventoryUOMConversions")),
    ledger: inventoryMigrationSnapshot(spreadsheet.getSheetByName("InventoryLedger")),
    balance: inventoryMigrationSnapshot(spreadsheet.getSheetByName("BalanceLedger")),
    accounts: inventoryMigrationSnapshot(spreadsheet.getSheetByName("Accounts")) };
}

function inventoryOpeningStagingFingerprint(state) {
  return inventoryMigrationFingerprint(state);
}

function inventoryOpeningStagingHasAccountCode(accountsSnapshot, accountCode) {
  return inventoryMigrationRows(accountsSnapshot).some(function(row) {
    return inventoryOpeningStagingText(row.AccountCode) === accountCode;
  });
}

function classifyInventoryOpeningStagingStorage(state) {
  if (!state || !state.items.exists || !state.conversions.exists || !state.ledger.exists || !state.accounts.exists) {
    return "REFUSED_MISSING_FOUNDATION";
  }
  if (inventoryOpeningStagingHasAccountCode(state.accounts, "3210")) return "REFUSED_ACCOUNT_3210_PRESENT";
  if (!inventoryMigrationExactHeaders(state.items, BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS) ||
      !inventoryMigrationExactHeaders(state.conversions, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS) ||
      !inventoryMigrationExactHeaders(state.ledger, BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS) ||
      inventoryMigrationRows(state.ledger).length !== 0 || inventoryMigrationAccountState({ accounts: state.accounts }) !== "READY") {
    return "REFUSED_FOUNDATION_DRIFT";
  }
  if (!state.openings.exists) return "ABSENT";
  if (!inventoryMigrationExactHeaders(state.openings, INVENTORY_OPENING_STAGING_POLICY.HEADERS)) return "REFUSED_HEADER_DRIFT";
  if (state.openings.hasFormulas || state.openings.hasNotes) return "REFUSED_SHEET_CONTENT";
  return inventoryMigrationRows(state.openings).length === 0 ? "POST_IMAGE" : "REFUSED_BUSINESS_ROWS";
}

function buildInventoryOpeningStagingMigrationPlan(state) {
  var classification = classifyInventoryOpeningStagingStorage(state);
  if (classification === "POST_IMAGE") return { status: "ALREADY_MIGRATED", writeCount: 0, productionMutation: false };
  if (classification !== "ABSENT") return { status: "REFUSED", reason: classification, writeCount: 0, productionMutation: false };
  return { status: "READY", writeCount: 1, targetValues: [INVENTORY_OPENING_STAGING_POLICY.HEADERS.slice()],
    protectedFingerprint: inventoryOpeningStagingFingerprint({ items: state.items, conversions: state.conversions,
      ledger: state.ledger, balance: state.balance, accounts: state.accounts }), productionMutation: false };
}

function executeInventoryOpeningStagingMigrationWithRuntime(runtime) {
  inventoryMigrationRequireRuntime(runtime);
  var before = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  var plan = buildInventoryOpeningStagingMigrationPlan(before);
  if (plan.status !== "READY") return plan;
  var sheet = null, writes = 0;
  try {
    sheet = runtime.spreadsheet.insertSheet(INVENTORY_OPENING_STAGING_POLICY.SHEET);
    inventoryConversionWriteExactHeader(sheet, INVENTORY_OPENING_STAGING_POLICY.HEADERS); writes = 1;
    runtime.flush();
    var after = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    var accepted = classifyInventoryOpeningStagingStorage(after) === "POST_IMAGE" &&
      plan.protectedFingerprint === inventoryOpeningStagingFingerprint({ items: after.items, conversions: after.conversions,
        ledger: after.ledger, balance: after.balance, accounts: after.accounts });
    if (!accepted) throw new Error("INVENTORY_OPENING_STAGING_ACCEPTANCE_FAILED");
    return { status: "MIGRATED", writeCount: writes, productionMutation: false,
      migrationRecord: { migrationId: INVENTORY_OPENING_STAGING_POLICY.MIGRATION_ID,
        version: INVENTORY_OPENING_STAGING_POLICY.VERSION, preState: before,
        preStateFingerprint: inventoryOpeningStagingFingerprint(before), acceptedPostState: after,
        postStateFingerprint: inventoryOpeningStagingFingerprint(after) } };
  } catch (error) {
    if (sheet && runtime.spreadsheet.getSheetByName(INVENTORY_OPENING_STAGING_POLICY.SHEET) === sheet) {
      runtime.spreadsheet.deleteSheet(sheet); runtime.flush();
    }
    var restored = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    return { status: inventoryOpeningStagingFingerprint(restored) === inventoryOpeningStagingFingerprint(before) ?
      "FAILED_ROLLED_BACK" : "FAILED_ROLLBACK", reason: error.message, writeCount: writes, productionMutation: false };
  }
}

function executeInventoryOpeningStagingRecoveryWithRuntime(runtime, record) {
  inventoryMigrationRequireRuntime(runtime);
  if (!record || record.migrationId !== INVENTORY_OPENING_STAGING_POLICY.MIGRATION_ID ||
      record.version !== INVENTORY_OPENING_STAGING_POLICY.VERSION || !record.preState || !record.acceptedPostState ||
      record.preState.openings.exists || record.preStateFingerprint !== inventoryOpeningStagingFingerprint(record.preState) ||
      record.postStateFingerprint !== inventoryOpeningStagingFingerprint(record.acceptedPostState)) {
    return { status: "REFUSED", reason: "INCOMPLETE_OR_UNIDENTIFIED_SNAPSHOT", writeCount: 0, productionMutation: false };
  }
  var current = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  if (inventoryOpeningStagingFingerprint(current) !== record.postStateFingerprint ||
      classifyInventoryOpeningStagingStorage(current) !== "POST_IMAGE") {
    return { status: "REFUSED", reason: "POST_IMAGE_CHANGED_OR_BUSINESS_DATA_PRESENT", writeCount: 0, productionMutation: false };
  }
  runtime.spreadsheet.deleteSheet(runtime.spreadsheet.getSheetByName(INVENTORY_OPENING_STAGING_POLICY.SHEET));
  runtime.flush();
  var restored = readInventoryOpeningStagingMigrationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  return { status: inventoryOpeningStagingFingerprint(restored) === record.preStateFingerprint ? "RECOVERED" : "FAILED_ROLLBACK",
    writeCount: 1, productionMutation: false };
}

function runInventoryOpeningStagingMigration() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0, productionMutation: false };
    var result = executeInventoryOpeningStagingMigrationWithRuntime({ mode: INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE,
      spreadsheet: spreadsheet, freshSpreadsheet: function() {
        return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
      }, flush: function() { SpreadsheetApp.flush(); } });
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function runInventoryOpeningStagingRecovery(record) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0, productionMutation: false };
    var result = executeInventoryOpeningStagingRecoveryWithRuntime({ mode: INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE,
      spreadsheet: spreadsheet, freshSpreadsheet: function() {
        return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
      }, flush: function() { SpreadsheetApp.flush(); } }, record);
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function inventoryOpeningStagingDisposableFixture(runtime, canonicalId, owned, label, sourceState) {
  var token = runtime.createToken();
  var name = "NUMLOCK Inventory Opening Disposable Proof " + label + " " + token;
  var spreadsheet = runtime.createSpreadsheet(name, 1000, 27);
  var ownership = { token: token, spreadsheetId: String(spreadsheet.getId()), spreadsheetName: name };
  owned.push(ownership);
  inventoryDisposableRuntimeProofRequire(ownership.spreadsheetId && ownership.spreadsheetId !== canonicalId &&
    ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID && spreadsheet.getName() === name,
    "opening disposable identity");
  var targets = [
    ["InventoryItems", sourceState.items], ["InventoryUOMConversions", sourceState.conversions],
    ["InventoryLedger", sourceState.ledger], ["BalanceLedger", sourceState.balance], ["Accounts", sourceState.accounts]
  ];
  targets.forEach(function(target, index) {
    var snapshot = target[1];
    if (!snapshot.exists) return;
    var sheet = index === 0 ? spreadsheet.getSheets()[0] : spreadsheet.insertSheet(target[0]);
    if (index === 0) sheet.setName(target[0]);
    balanceFoundationResizeDisposableSheet(sheet, Math.max(snapshot.maxRows, snapshot.values.length, 1),
      Math.max(snapshot.maxColumns, snapshot.values[0] ? snapshot.values[0].length : 1));
    if (snapshot.values.length) sheet.getRange(1, 1, snapshot.values.length, snapshot.values[0].length).setValues(snapshot.values);
  });
  runtime.flush();
  return ownership;
}

function inventoryOpeningStagingDisposableContext(runtime, ownership) {
  return { mode: INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_MODE, disposableOwnership: ownership,
    spreadsheet: runtime.openById(ownership.spreadsheetId), freshSpreadsheet: function() {
      return runtime.openById(ownership.spreadsheetId);
    }, flush: runtime.flush };
}

function executeInventoryOpeningStagingDisposableRuntimeProofWithRuntime(runtime) {
  var owned = [], failure = null, cleanupFailures = [], result = null, productionBefore = null;
  try {
    var canonical = runtime.openCanonical();
    inventoryDisposableRuntimeProofRequire(canonical && String(canonical.getId()) ===
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, "canonical production identity unavailable");
    productionBefore = readInventoryOpeningStagingMigrationState(canonical);
    inventoryDisposableRuntimeProofRequire(classifyInventoryOpeningStagingStorage(productionBefore) === "ABSENT",
      "production InventoryOpenings precondition is not ABSENT");
    var localContract = testInventoryOpeningStagingContracts();
    inventoryDisposableRuntimeProofRequire(localContract.passed && localContract.productionMutation === false,
      "opening staging evidence contract");

    var primaryOwnership = inventoryOpeningStagingDisposableFixture(runtime,
      NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, owned, "PRIMARY", productionBefore);
    var primary = inventoryOpeningStagingDisposableContext(runtime, primaryOwnership);
    var ready = buildInventoryOpeningStagingMigrationPlan(readInventoryOpeningStagingMigrationState(primary.spreadsheet));
    inventoryDisposableRuntimeProofRequire(ready.status === "READY" && ready.writeCount === 1, "READY preflight");
    var migrated = executeInventoryOpeningStagingMigrationWithRuntime(primary);
    inventoryDisposableRuntimeProofRequire(migrated.status === "MIGRATED" && migrated.writeCount === 1,
      "MIGRATED writeCount=1");
    var postImage = readInventoryOpeningStagingMigrationState(primary.freshSpreadsheet());
    inventoryDisposableRuntimeProofRequire(classifyInventoryOpeningStagingStorage(postImage) === "POST_IMAGE" &&
      inventoryMigrationRows(postImage.openings).length === 0 &&
      inventoryMigrationExactHeaders(postImage.openings, INVENTORY_OPENING_STAGING_POLICY.HEADERS),
      "exact header-only post-image");
    var second = executeInventoryOpeningStagingMigrationWithRuntime(primary);
    inventoryDisposableRuntimeProofRequire(second.status === "ALREADY_MIGRATED" && second.writeCount === 0,
      "ALREADY_MIGRATED writeCount=0");
    var recovery = executeInventoryOpeningStagingRecoveryWithRuntime(primary, migrated.migrationRecord);
    inventoryDisposableRuntimeProofRequire(recovery.status === "RECOVERED" && recovery.writeCount === 1 &&
      classifyInventoryOpeningStagingStorage(readInventoryOpeningStagingMigrationState(primary.freshSpreadsheet())) === "ABSENT",
      "guarded recovery");

    [
      { label: "COLLISION", headers: ["UnexpectedHeader"], expected: "REFUSED_HEADER_DRIFT" },
      { label: "SCHEMA_DRIFT", headers: INVENTORY_OPENING_STAGING_POLICY.HEADERS.map(function(header, index) {
        return index === 0 ? " OpeningID" : header;
      }), expected: "REFUSED_HEADER_DRIFT" },
      { label: "PARTIAL_STATE", headers: INVENTORY_OPENING_STAGING_POLICY.HEADERS.slice(0, 26),
        expected: "REFUSED_HEADER_DRIFT" }
    ].forEach(function(scenario) {
      var ownership = inventoryOpeningStagingDisposableFixture(runtime,
        NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, owned, scenario.label, productionBefore);
      var context = inventoryOpeningStagingDisposableContext(runtime, ownership);
      var sheet = context.spreadsheet.insertSheet(INVENTORY_OPENING_STAGING_POLICY.SHEET);
      inventoryConversionWriteExactHeader(sheet, scenario.headers); runtime.flush();
      var refused = executeInventoryOpeningStagingMigrationWithRuntime(context);
      inventoryDisposableRuntimeProofRequire(refused.status === "REFUSED" && refused.reason === scenario.expected &&
        refused.writeCount === 0, scenario.label + " zero-write refusal");
    });
    [true, false].forEach(function(active) {
      var label = active ? "ACCOUNT_3210_ACTIVE" : "ACCOUNT_3210_INACTIVE";
      var ownership = inventoryOpeningStagingDisposableFixture(runtime,
        NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, owned, label, productionBefore);
      var context = inventoryOpeningStagingDisposableContext(runtime, ownership);
      var accountsSheet = context.spreadsheet.getSheetByName("Accounts");
      var headers = productionBefore.accounts.values[0];
      var account = { AccountCode: "3210", AccountName: "Unauthorized proposal", AccountType: "Equity",
        StatementGroup: "Owner Equity", CashFlowGroup: "Financing", IsActive: active,
        CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "", NormalBalance: "CREDIT" };
      accountsSheet.getRange(accountsSheet.getLastRow() + 1, 1, 1, headers.length).setValues([headers.map(function(header) {
        return account[header] === undefined ? "" : account[header];
      })]);
      runtime.flush();
      var refused = executeInventoryOpeningStagingMigrationWithRuntime(context);
      inventoryDisposableRuntimeProofRequire(refused.status === "REFUSED" &&
        refused.reason === "REFUSED_ACCOUNT_3210_PRESENT" && refused.writeCount === 0 &&
        !context.spreadsheet.getSheetByName(INVENTORY_OPENING_STAGING_POLICY.SHEET),
        label + " zero-write refusal");
    });
    inventoryDisposableRuntimeProofRequire(buildInventoryOpeningPostingPlan().status === "REFUSED" &&
      buildInventoryOpeningPostingPlan().productionMutation === false, "posting gate remains closed");
    inventoryDisposableRuntimeProofRequire(inventoryOpeningStagingFingerprint(readInventoryOpeningStagingMigrationState(
      runtime.openCanonical())) === inventoryOpeningStagingFingerprint(productionBefore), "production fingerprint preserved");
    result = { status: "PASS", schemaColumns: 27, eligibleItems: 21, ing018Authority: false,
      focusedScenarios: localContract.scenarios, account3210Refusal: "PASS",
      migration: "PASS", idempotency: "PASS", recovery: "PASS",
      postingAllowed: false, inventoryLedgerRowsWritten: 0, balanceLedgerRowsWritten: 0,
      account1100Mutation: false, account3200Mutation: false, account3210Mutation: false,
      productionMutation: false, cleanup: "PENDING" };
  } catch (error) { failure = error; }
  owned.slice().reverse().forEach(function(ownership) {
    try {
      inventoryDisposableRuntimeProofRequire(ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
        "refuse canonical cleanup");
      runtime.trashOwnedSpreadsheet(ownership);
      inventoryDisposableRuntimeProofRequire(runtime.isTrashed(ownership.spreadsheetId), "disposable cleanup verification");
    } catch (cleanupError) { cleanupFailures.push(cleanupError.message); }
  });
  if (cleanupFailures.length) throw new Error("Inventory opening disposable cleanup failed: " + cleanupFailures.join(" | "));
  if (failure) throw failure;
  result.cleanup = "PASS";
  return result;
}

function runInventoryOpeningStagingDisposableRuntimeProof() {
  var result = executeInventoryOpeningStagingDisposableRuntimeProofWithRuntime({
    openCanonical: function() { return resolveNumlockProductionSpreadsheetWithRuntime({
      openById: function(id) { return SpreadsheetApp.openById(id); }
    }); },
    createSpreadsheet: function(name, rows, columns) { return SpreadsheetApp.create(name, rows, columns); },
    openById: function(id) { return SpreadsheetApp.openById(id); },
    flush: function() { SpreadsheetApp.flush(); },
    createToken: function() { return Utilities.getUuid(); },
    trashOwnedSpreadsheet: function(ownership) { DriveApp.getFileById(ownership.spreadsheetId).setTrashed(true); },
    isTrashed: function(id) { return DriveApp.getFileById(id).isTrashed(); }
  });
  Logger.log(JSON.stringify(result));
  return result;
}
