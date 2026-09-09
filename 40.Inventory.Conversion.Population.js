var INVENTORY_CONVERSION_CANDIDATE_POPULATION = Object.freeze({
  VERSION: "11N.10",
  MIGRATION_ID: "INVENTORY-CONVERSION-CANDIDATES-20260904",
  SHEET: "InventoryUOMConversions",
  EXPECTED_COUNT: 21,
  MANIFESTS: Object.freeze([
    ["ING-004", "1Ap8E3MszGhPq7_FZOPIYRmGKjSWskW5G", "bb32a968439a6c9a9c2e5415c286fb60484b8cfd13888a7d3329be9dede23658"],
    ["ING-005", "1COJ6VHBTtwXyxHMaUEiltTfpjFIwsmiS", "5be3e74aea2183747b5c2dbdf7115fbe6b7677feb2cd61523882c4d5338a97d6"],
    ["ING-006", "1DABFPD6JvvgKlX2q8h79no5NHShLUMX8", "195dadbb8c8af5954d49f303c8140ff3fd2d85c30e7919135922976a068c9bdd"],
    ["ING-007", "1cijJJR9yhc0bjbepusXXP8_y3pvzO92z", "944788e2b3da4f27fcce51c7d856ae6d45bf18ac5b6bd805cb1c06cfa6c288f6"],
    ["ING-008", "1OdUGRnM1ej7BxperQ6ll-SC9MlDhHbK8", "d1a4ff37fb6612c91d81c8de75e766de32d53a9b0311c27a1eeaa488a27d4a72"],
    ["ING-009", "1Z68YNwu24vgB-LpPOw0OE2gUeXrG10Lu", "3150299ba9dd222b18627c98f2bb0cfebcb5853b324963962a9b79629c230952"],
    ["ING-010", "1I72DYM0cM-A1KaPwfm08os22hzxcS04o", "e0cb1b8e154aa1356f5cb2d48b2b00025461782425bd2908981e88799a7ae5cf"],
    ["ING-011", "1ceR6hcnDa8RSX9WpSqnJy3Q2HEfWZdqH", "48c564d886fea2153a699c9d3cfe60b068d248ebf8a2630c2479cbd706c9189e"],
    ["ING-012", "10syOIKRzmbDv8cdK3viTvRZyZJE0MD1W", "e2d42b429c30d439b6d2775fa77b81a816ddb54d6973d14968828eb452fd834a"],
    ["ING-013", "1ED9G_v5t2wFGt8jgMqaScOqeHkrf13rg", "47ad1f801739d5b72b61f3efc533b7a107e30f0e29160e0dfbe78da9016858a0"],
    ["ING-014", "1PUtKVLy37q7QmE-6fr0RDEeRHOTmUlFa", "141ca2d8f499d1a1f4ebbff4522ebcc9dfe62555f06b556d04edbe33047028ae"],
    ["ING-015", "1gby72WzDA0TttZEe3dy7ud9jY_-tvvd5", "a1385bb71d8d1e6e959d4993e1154c6161ad2bb68800e927b6a3f1ca1bd840e7"],
    ["ING-016", "1p04n7CX_j-vGUfTFfGnU7vBPqgDqAHTZ", "c1a4e1160478ff4d207fe9dc8ff5b108d38dc378176e91d5bb99cfd2e182fb99"],
    ["ING-017", "1p0cNXzgrLyEQTg8_pFHjhiJyg7nGmqXV", "244e43c08744ee32d59fc06dc6689d33ebf63f35e964533c207918e6d7c662bc"],
    ["ING-019", "1P0Va7oQdFOheUOS-jX6OJUJi7owVTmzI", "ccf259c6d30f92ce883a89d999658d5d1b660e0a98b7fad41d56b06d641c1668"],
    ["ING-020", "1QDDzoXP3hspf7y0ZEd3uTIMfAhaLvfXi", "2a0efdabb836160b2da3e9d15d3d34d45b7768183ac23c8c5757c92f5074951f"],
    ["ING-021", "1i-9-BTklC4zoOp0zSBO6gKPBFIKTt144", "c7419e2712ad8c1f023982ab81ff34e3dcae1db820af6ea595e48ec56ddc36fc"],
    ["ING-031", "19vpk8hzFcv982QPaGxlTq80EP44xrCGI", "7cfd078b205e77f634143c5fdf01b75532af45e5b9b19e3e2414f8343cffc470"],
    ["ING-032", "1u6Qd0UZhijNnXBrJOzL8wXq7Y5AU7sbq", "48322c6ceb144d0a61c5863c334885d0f620630acdedc5fcf1ab0d45e983f882"],
    ["ING-033", "1XQxWYLywKr2d_420myh6Asg1eACAL5Lx", "6eddce80dd4712c3f7f50ac265c83c7d215a1980b3d86dc2f1ace81cd6cf4120"],
    ["ING-034", "1HUeaime2QohkAzCZSULnTx7XWCHnzLDB", "9866b4ad3a070501a09d6aeb468cf1a2afd2cc57843f9cd4e5f8404e94259a4e"]
  ])
});

function inventoryConversionPopulationHex(bytes) {
  return bytes.map(function(value) { var hex = (value < 0 ? value + 256 : value).toString(16); return hex.length === 1 ? "0" + hex : hex; }).join("");
}

function inventoryConversionPopulationParseManifest(text) {
  var values = {};
  String(text || "").split("\n").forEach(function(line) {
    var match = line.match(/^([A-Za-z][A-Za-z0-9]*)=(.*)$/);
    if (match) values[match[1]] = JSON.parse(match[2]);
  });
  return values;
}

function buildInventoryConversionPopulationCandidates(runtime) {
  var rows = INVENTORY_CONVERSION_CANDIDATE_POPULATION.MANIFESTS.map(function(entry) {
    var bytes = runtime.readManifestBytes(entry[1]);
    var hash = inventoryConversionPopulationHex(runtime.sha256(bytes));
    if (hash !== entry[2]) throw new Error("MANIFEST_SHA256_MISMATCH:" + entry[0]);
    var manifest = inventoryConversionPopulationParseManifest(runtime.bytesToString(bytes));
    if (manifest.ItemID !== entry[0] || manifest.ManifestVersion !== "V01") {
      throw new Error("MANIFEST_IDENTITY_MISMATCH:" + entry[0]);
    }
    return { ConversionID: manifest.ConversionID, ItemID: manifest.ItemID, FromUOM: manifest.FromUOM,
      PackageIdentity: manifest.PackageIdentity, SupplierRef: manifest.SupplierRef, ToUOM: manifest.ToUOM,
      Numerator: manifest.Numerator, Denominator: manifest.Denominator, EffectiveFrom: manifest.EffectiveFrom,
      EffectiveTo: manifest.EffectiveTo, EvidenceType: manifest.EvidenceType,
      EvidenceRef: "GDRIVE:" + entry[1] + ":V01:SHA256:" + entry[2], EvidenceDate: manifest.EvidenceDate,
      PreparedBy: manifest.PreparedBy, PreparedAt: manifest.PreparedAt, ReviewedBy: "", ReviewedAt: "",
      ApprovalStatus: "SINGLE_OPERATOR_APPROVED", ApprovalNote: manifest.ApprovalNote, IsActive: false,
      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" };
  });
  rows.sort(function(left, right) { return left.ConversionID < right.ConversionID ? -1 : left.ConversionID > right.ConversionID ? 1 : 0; });
  return rows;
}

function readInventoryConversionPopulationState(spreadsheet) {
  return { conversions: inventoryConversionSchemaMigrationSnapshot(spreadsheet.getSheetByName("InventoryUOMConversions")),
    items: inventoryMigrationSnapshot(spreadsheet.getSheetByName("InventoryItems")),
    ledger: inventoryMigrationSnapshot(spreadsheet.getSheetByName("InventoryLedger")),
    accounts: inventoryMigrationSnapshot(spreadsheet.getSheetByName("Accounts")) };
}

function inventoryConversionPopulationFingerprint(state) {
  return inventoryMigrationFingerprint(state);
}

function inventoryConversionPopulationRowsMatch(actual, expected) {
  var headers = BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS;
  if (!actual || !expected || actual.length !== expected.length) return false;
  return actual.every(function(row, index) {
    return headers.every(function(header) {
      var left = row[header], right = expected[index][header];
      if (header === "Numerator" || header === "Denominator") return Number(left) === Number(right);
      if (header === "IsActive") return isCanonicalActive(left) === isCanonicalActive(right);
      if (header === "EffectiveFrom" || header === "EffectiveTo" || header === "EvidenceDate") {
        return capitalEquityDateKey(left) === capitalEquityDateKey(right);
      }
      if (header === "PreparedAt" || header === "ReviewedAt" || header === "CreatedAt" ||
          header === "UpdatedAt") {
        var leftMillis = inventoryTimestampMillis(left), rightMillis = inventoryTimestampMillis(right);
        return leftMillis === rightMillis || left === "" && right === "";
      }
      return String(left == null ? "" : left) === String(right == null ? "" : right);
    });
  });
}

function inventoryConversionPopulationFrozenIdentityValid(candidates) {
  return !!candidates && candidates.length === INVENTORY_CONVERSION_CANDIDATE_POPULATION.EXPECTED_COUNT &&
    INVENTORY_CONVERSION_CANDIDATE_POPULATION.MANIFESTS.every(function(entry, index) {
      var row = candidates[index];
      return row && row.ItemID === entry[0] && row.ConversionID === "CONV-ATT-" + entry[0] + "-V01" &&
        row.EvidenceRef === "GDRIVE:" + entry[1] + ":V01:SHA256:" + entry[2];
    });
}

function buildInventoryConversionPopulationPlan(state, candidates) {
  var headers = BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS;
  if (!state || !inventoryMigrationExactHeaders(state.conversions, headers) || state.conversions.hasFormulas ||
      state.conversions.hasNotes) return { status: "REFUSED", reason: "CONVERSION_SCHEMA_OR_CONTENT_DRIFT", writeCount: 0 };
  if (!inventoryMigrationExactHeaders(state.items, BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS) ||
      inventoryMigrationRows(state.items).length !== 22 || validateInventoryItemCandidates(inventoryMigrationRows(state.items)).status !== "PASS") {
    return { status: "REFUSED", reason: "INVENTORY_ITEMS_DRIFT", writeCount: 0 };
  }
  if (!inventoryMigrationExactHeaders(state.ledger, BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS) ||
      inventoryMigrationRows(state.ledger).length !== 0) return { status: "REFUSED", reason: "INVENTORY_LEDGER_DRIFT", writeCount: 0 };
  if (inventoryMigrationAccountState({ accounts: state.accounts }) !== "READY") {
    return { status: "REFUSED", reason: "ACCOUNT_1100_DRIFT", writeCount: 0 };
  }
  if (!inventoryConversionPopulationFrozenIdentityValid(candidates) || candidates.some(function(row) {
      return row.ItemID === "ING-018" || row.EvidenceType !== "OPERATOR_ATTESTATION" ||
        row.ApprovalStatus !== "SINGLE_OPERATOR_APPROVED" || row.IsActive !== false ||
        row.EffectiveFrom !== "2026-10-01" || row.ReviewedBy !== "" || row.ReviewedAt !== "";
    }) || new Set(candidates.map(function(row) { return row.ConversionID; })).size !== 21 ||
      validateInventoryUomConversions(candidates, inventoryMigrationRows(state.items)).status !== "PASS") {
    return { status: "REFUSED", reason: "INVALID_CANDIDATES", writeCount: 0 };
  }
  var target = inventoryMigrationValues(headers, candidates), currentRows = inventoryMigrationRows(state.conversions);
  if (currentRows.length === 0) return { status: "READY", writeCount: 1, targetValues: target };
  return inventoryConversionPopulationRowsMatch(currentRows, candidates) ?
    { status: "ALREADY_POPULATED", writeCount: 0, targetValues: target } :
    { status: "REFUSED", reason: "UNEXPECTED_CONVERSION_ROWS", writeCount: 0 };
}

function validateInventoryConversionPopulationAcceptance(after, candidates) {
  var plan = buildInventoryConversionPopulationPlan(after, candidates);
  var rows = inventoryMigrationRows(after.conversions);
  var readiness = candidates.map(function(row) {
    return classifyInventoryConversionReadiness(row.ItemID, "2026-10-01", inventoryMigrationRows(after.items), rows).status;
  });
  return { status: plan.status === "ALREADY_POPULATED" && rows.length === 21 &&
      rows.every(function(row) { return row.IsActive === false && row.ApprovalStatus === "SINGLE_OPERATOR_APPROVED"; }) &&
      readiness.every(function(value) { return value === "NEEDS_EVIDENCE"; }) ? "PASS" : "FAIL",
    populatedRows: rows.length, inactiveRows: rows.filter(function(row) { return row.IsActive === false; }).length,
    approvalStatusCount: rows.filter(function(row) { return row.ApprovalStatus === "SINGLE_OPERATOR_APPROVED"; }).length,
    conflicts: validateInventoryUomConversions(rows, inventoryMigrationRows(after.items)).errors.length,
    readiness: { NEEDS_EVIDENCE: readiness.filter(function(value) { return value === "NEEDS_EVIDENCE"; }).length,
      SINGLE_OPERATOR_VERIFIED: readiness.filter(function(value) { return value === "SINGLE_OPERATOR_VERIFIED"; }).length } };
}

function executeInventoryConversionCandidatePopulationWithRuntime(runtime) {
  inventoryMigrationRequireRuntime(runtime);
  var candidates;
  try { candidates = runtime.candidateRows ? runtime.candidateRows.map(function(row) { return Object.assign({}, row); }) :
    buildInventoryConversionPopulationCandidates(runtime); }
  catch (error) { return { status: "REFUSED", reason: error.message, writeCount: 0 }; }
  var before = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  var plan = buildInventoryConversionPopulationPlan(before, candidates);
  if (plan.status !== "READY") return plan;
  var sheet = runtime.spreadsheet.getSheetByName(INVENTORY_CONVERSION_CANDIDATE_POPULATION.SHEET), writes = 0;
  try {
    sheet.getRange(2, 1, candidates.length, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.length)
      .setValues(plan.targetValues.slice(1)); writes = 1;
    runtime.flush();
    var after = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    var acceptance = validateInventoryConversionPopulationAcceptance(after, candidates);
    if (acceptance.status !== "PASS") throw new Error("POPULATION_ACCEPTANCE_FAILED");
    return { status: "POPULATED", writeCount: writes, acceptance: acceptance,
      migrationRecord: { migrationId: INVENTORY_CONVERSION_CANDIDATE_POPULATION.MIGRATION_ID,
        version: INVENTORY_CONVERSION_CANDIDATE_POPULATION.VERSION, preState: before,
        preStateFingerprint: inventoryConversionPopulationFingerprint(before), acceptedPostState: after,
        postStateFingerprint: inventoryConversionPopulationFingerprint(after) } };
  } catch (error) {
    try {
      var current = readInventoryConversionPopulationState(runtime.spreadsheet);
      if (inventoryMigrationFingerprint(current.conversions.values) === inventoryMigrationFingerprint(plan.targetValues)) {
        sheet.getRange(2, 1, candidates.length, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.length).clearContent();
        runtime.flush();
      }
      var restored = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
      if (inventoryConversionPopulationFingerprint(restored) !== inventoryConversionPopulationFingerprint(before)) {
        throw new Error("RECOVERY_VERIFICATION_FAILED");
      }
      return { status: "FAILED_ROLLED_BACK", reason: error.message, writeCount: writes };
    } catch (rollbackError) {
      return { status: "FAILED_ROLLBACK", reason: error.message, rollbackReason: rollbackError.message, writeCount: writes };
    }
  }
}

function inventoryConversionPopulationDisposableFixture(runtime, canonicalId, owned, label, sourceState) {
  var token = runtime.createToken(), name = INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_NAME_PREFIX + "Population " + label + " " + token;
  var spreadsheet = runtime.createSpreadsheet(name, 1000, 26);
  var ownership = { token: token, spreadsheetId: String(spreadsheet.getId()), spreadsheetName: name };
  owned.push(ownership);
  inventoryDisposableRuntimeProofRequire(ownership.spreadsheetId && ownership.spreadsheetId !== canonicalId &&
    ownership.spreadsheetId !== NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID, "population disposable identity");
  var conversionSheet = spreadsheet.getSheets()[0];
  conversionSheet.setName("InventoryUOMConversions");
  balanceFoundationResizeDisposableSheet(conversionSheet, 1000, 26);
  conversionSheet.getRange(1, 1, 1, 24).setValues([BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.slice()]);
  [sourceState.items, sourceState.ledger, sourceState.accounts].forEach(function(snapshot, index) {
    var names = ["InventoryItems", "InventoryLedger", "Accounts"], sheet = spreadsheet.insertSheet(names[index]);
    balanceFoundationResizeDisposableSheet(sheet, snapshot.maxRows, snapshot.maxColumns);
    sheet.getRange(1, 1, snapshot.values.length, snapshot.values[0].length).setValues(snapshot.values);
  });
  runtime.flush();
  return ownership;
}

function inventoryConversionPopulationDisposableContext(runtime, ownership, candidates) {
  return { mode: INVENTORY_SCHEMA_RUNTIME.DISPOSABLE_MODE, disposableOwnership: ownership,
    spreadsheet: runtime.openById(ownership.spreadsheetId), freshSpreadsheet: function() { return runtime.openById(ownership.spreadsheetId); },
    flush: runtime.flush, candidateRows: candidates, readManifestBytes: runtime.readManifestBytes,
    sha256: runtime.sha256, bytesToString: runtime.bytesToString };
}

function executeInventoryConversionCandidateDisposableRuntimeProofWithRuntime(runtime) {
  var owned = [], failure = null, cleanupFailures = [], result = null, productionBefore = null;
  try {
    var canonical = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
    inventoryDisposableRuntimeProofRequire(canonical && String(canonical.getId()) === NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
      "canonical production identity unavailable");
    var productionState = readInventoryConversionPopulationState(canonical);
    productionBefore = inventoryConversionPopulationFingerprint(productionState);
    var candidates = buildInventoryConversionPopulationCandidates(runtime);
    inventoryDisposableRuntimeProofRequire(buildInventoryConversionPopulationPlan(productionState, candidates).status === "READY",
      "production pre-state must be READY without mutation");

    var primary = inventoryConversionPopulationDisposableFixture(runtime, canonical.getId(), owned, "Primary", productionState);
    var context = inventoryConversionPopulationDisposableContext(runtime, primary, candidates);
    var first = executeInventoryConversionCandidatePopulationWithRuntime(context);
    inventoryDisposableRuntimeProofRequire(first.status === "POPULATED" && first.writeCount === 1 &&
      first.acceptance.status === "PASS" && first.acceptance.populatedRows === 21 && first.acceptance.inactiveRows === 21,
      "population write and exact post-image");
    var second = executeInventoryConversionCandidatePopulationWithRuntime(context);
    inventoryDisposableRuntimeProofRequire(second.status === "ALREADY_POPULATED" && second.writeCount === 0,
      "population idempotency");
    var rows = inventoryMigrationRows(readInventoryConversionPopulationState(context.spreadsheet).conversions);
    inventoryDisposableRuntimeProofRequire(rows.every(function(row) {
      return gateInventoryMovementConversion({ ItemID: row.ItemID, MovementTimestamp: "2026-10-01T08:00:00+07:00" },
        inventoryMigrationRows(productionState.items), rows).status === "REFUSED";
    }), "inactive candidates cannot pass posting gate");

    var recovery = executeInventoryConversionCandidateRecoveryWithRuntime(context, first.migrationRecord);
    inventoryDisposableRuntimeProofRequire(recovery.status === "RECOVERED" && recovery.writeCount === 1,
      "guarded recovery");
    [
      { label: "partial", mutateSheet: function(sheet) { sheet.getRange(2, 1, 1, 24).setValues([inventoryMigrationValues(
          BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS, [candidates[0]])[1]]); } },
      { label: "duplicate conversion", candidateRows: candidates.concat([Object.assign({}, candidates[0])]) },
      { label: "wrong ItemID ConversionID binding", candidateRows: candidates.map(function(row, index) {
          return index === 0 ? Object.assign({}, row, { ConversionID: candidates[1].ConversionID }) :
            index === 1 ? Object.assign({}, row, { ConversionID: candidates[0].ConversionID }) : row;
        }) },
      { label: "wrong Drive ID mapping", candidateRows: candidates.map(function(row, index) { return index ? row :
          Object.assign({}, row, { EvidenceRef: row.EvidenceRef.replace(
            INVENTORY_CONVERSION_CANDIDATE_POPULATION.MANIFESTS[0][1], "format_valid_wrong_drive_id") }); }) },
      { label: "wrong SHA256 mapping", candidateRows: candidates.map(function(row, index) { return index ? row :
          Object.assign({}, row, { EvidenceRef: row.EvidenceRef.replace(/[a-f0-9]$/, "0") }); }) },
      { label: "cross-item EvidenceRef reuse", candidateRows: candidates.map(function(row, index) { return index ? row :
          Object.assign({}, row, { EvidenceRef: candidates[1].EvidenceRef }); }) },
      { label: "active candidate", candidateRows: candidates.map(function(row, index) { return index ? row :
          Object.assign({}, row, { IsActive: true }); }) }
    ].forEach(function(scenario) {
      var fixture = inventoryConversionPopulationDisposableFixture(runtime, canonical.getId(), owned, scenario.label, productionState);
      var refusedContext = inventoryConversionPopulationDisposableContext(runtime, fixture, scenario.candidateRows || candidates);
      if (scenario.mutateSheet) scenario.mutateSheet(refusedContext.spreadsheet.getSheetByName("InventoryUOMConversions"));
      var before = inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(refusedContext.spreadsheet));
      var refused = executeInventoryConversionCandidatePopulationWithRuntime(refusedContext);
      inventoryDisposableRuntimeProofRequire(refused.status === "REFUSED" && refused.writeCount === 0 &&
        inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(refusedContext.spreadsheet)) === before,
        scenario.label + " zero-write refusal");
    });
    inventoryDisposableRuntimeProofRequire(inventoryConversionPopulationFingerprint(
      readInventoryConversionPopulationState(resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage))) === productionBefore,
      "production fingerprint changed");
    result = { status: "PASS", productionMutation: false, preflight: "READY", population: first,
      idempotency: { status: second.status, writeCount: second.writeCount }, guardedRecovery: "PASS",
      refusalCoverage: "PASS", postingGate: "REFUSED_INACTIVE", cleanup: "PENDING" };
  } catch (error) { failure = error; }
  finally {
    owned.forEach(function(ownership) {
      try { runtime.trashOwnedSpreadsheet(ownership);
        if (!runtime.isOwnedSpreadsheetTrashed(ownership)) throw new Error("trash verification failed");
      } catch (cleanupError) { cleanupFailures.push(ownership.spreadsheetName + ": " + cleanupError.message); }
    });
    if (productionBefore !== null) {
      try { if (inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(
        resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage))) !== productionBefore) throw new Error("production fingerprint changed"); }
      catch (productionError) { if (!failure) failure = productionError; }
    }
  }
  if (failure) throw failure;
  if (cleanupFailures.length) throw new Error("Population cleanup failed: " + cleanupFailures.join(" | "));
  result.cleanup = "PASS"; return result;
}

function runInventoryConversionCandidateDisposableRuntimeProof() {
  var result = executeInventoryConversionCandidateDisposableRuntimeProofWithRuntime({
    storage: { openById: function(id) { return SpreadsheetApp.openById(id); } },
    createToken: function() { return new Date().getTime() + "-" + Utilities.getUuid(); },
    createSpreadsheet: function(name, rows, columns) { return SpreadsheetApp.create(name, rows, columns); },
    openById: function(id) { return SpreadsheetApp.openById(id); }, flush: function() { SpreadsheetApp.flush(); },
    readManifestBytes: function(id) { return DriveApp.getFileById(id).getBlob().getBytes(); },
    sha256: function(bytes) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes); },
    bytesToString: function(bytes) { return Utilities.newBlob(bytes).getDataAsString("UTF-8"); },
    trashOwnedSpreadsheet: function(ownership) { DriveApp.getFileById(ownership.spreadsheetId).setTrashed(true); },
    isOwnedSpreadsheetTrashed: function(ownership) { return DriveApp.getFileById(ownership.spreadsheetId).isTrashed(); }
  });
  Logger.log(JSON.stringify(result)); return result;
}

function executeInventoryConversionCandidateRecoveryWithRuntime(runtime, record) {
  inventoryMigrationRequireRuntime(runtime);
  if (!record || record.migrationId !== INVENTORY_CONVERSION_CANDIDATE_POPULATION.MIGRATION_ID ||
      record.version !== INVENTORY_CONVERSION_CANDIDATE_POPULATION.VERSION || !record.preState || !record.acceptedPostState ||
      record.preStateFingerprint !== inventoryConversionPopulationFingerprint(record.preState) ||
      record.postStateFingerprint !== inventoryConversionPopulationFingerprint(record.acceptedPostState)) {
    return { status: "REFUSED", reason: "INCOMPLETE_OR_UNIDENTIFIED_SNAPSHOT", writeCount: 0 };
  }
  var current = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  if (inventoryConversionPopulationFingerprint(current) !== record.postStateFingerprint) {
    return { status: "REFUSED", reason: "POST_IMAGE_CHANGED", writeCount: 0 };
  }
  var rows = inventoryMigrationRows(current.conversions);
  if (rows.length !== 21 || rows.some(function(row) { return row.IsActive !== false; })) {
    return { status: "REFUSED", reason: "POST_IMAGE_NOT_OWNED", writeCount: 0 };
  }
  runtime.spreadsheet.getSheetByName(INVENTORY_CONVERSION_CANDIDATE_POPULATION.SHEET)
    .getRange(2, 1, 21, BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.length).clearContent();
  runtime.flush();
  var restored = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  return inventoryConversionPopulationFingerprint(restored) === record.preStateFingerprint ?
    { status: "RECOVERED", writeCount: 1 } : { status: "FAILED_ROLLBACK", reason: "RECOVERY_VERIFICATION_FAILED", writeCount: 1 };
}

function inventoryConversionCandidateProductionRuntime(spreadsheet) {
  return { mode: INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE, spreadsheet: spreadsheet,
    freshSpreadsheet: function() { return resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } }); },
    flush: function() { SpreadsheetApp.flush(); },
    readManifestBytes: function(id) { return DriveApp.getFileById(id).getBlob().getBytes(); },
    sha256: function(bytes) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes); },
    bytesToString: function(bytes) { return Utilities.newBlob(bytes).getDataAsString("UTF-8"); } };
}

function runInventoryConversionCandidatePopulation() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeInventoryConversionCandidatePopulationWithRuntime(inventoryConversionCandidateProductionRuntime(spreadsheet));
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function runInventoryConversionCandidateRecovery(record) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeInventoryConversionCandidateRecoveryWithRuntime(inventoryConversionCandidateProductionRuntime(spreadsheet), record);
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

var INVENTORY_CONVERSION_ACTIVATION = Object.freeze({
  VERSION: "11N.11",
  MIGRATION_ID: "INVENTORY-CONVERSION-ACTIVATION-20261001",
  EFFECTIVE_FROM: "2026-10-01",
  EXPECTED_COUNT: 21
});

function inventoryConversionActivationRows(candidates, active) {
  return (candidates || []).map(function(row) { return Object.assign({}, row, { IsActive: active }); });
}

function inventoryConversionActivationReadiness(state, rows, postingDate) {
  var items = inventoryMigrationRows(state.items);
  var statuses = rows.map(function(row) {
    return classifyInventoryConversionReadiness(row.ItemID, postingDate, items, rows).status;
  });
  return {
    NEEDS_EVIDENCE: statuses.filter(function(value) { return value === "NEEDS_EVIDENCE"; }).length,
    SINGLE_OPERATOR_VERIFIED: statuses.filter(function(value) { return value === "SINGLE_OPERATOR_VERIFIED"; }).length,
    CONFLICT: statuses.filter(function(value) { return value === "CONFLICT"; }).length
  };
}

function buildInventoryConversionActivationPlan(state, candidates) {
  var populationPlan = buildInventoryConversionPopulationPlan(state, candidates);
  if (populationPlan.status !== "ALREADY_POPULATED") {
    return { status: "REFUSED", reason: populationPlan.reason || "FROZEN_INACTIVE_PREIMAGE_REQUIRED", writeCount: 0 };
  }
  var currentRows = inventoryMigrationRows(state.conversions);
  var activeRows = inventoryConversionActivationRows(candidates, true);
  if (inventoryConversionPopulationRowsMatch(currentRows, candidates)) {
    return { status: "READY", writeCount: 1, targetRows: activeRows };
  }
  if (inventoryConversionPopulationRowsMatch(currentRows, activeRows) &&
      validateInventoryUomConversions(currentRows, inventoryMigrationRows(state.items)).status === "PASS" &&
      inventoryConversionActivationReadiness(state, currentRows, INVENTORY_CONVERSION_ACTIVATION.EFFECTIVE_FROM)
        .SINGLE_OPERATOR_VERIFIED === INVENTORY_CONVERSION_ACTIVATION.EXPECTED_COUNT) {
    return { status: "ALREADY_ACTIVATED", writeCount: 0, targetRows: activeRows };
  }
  return { status: "REFUSED", reason: "ACTIVATION_PREIMAGE_DRIFT", writeCount: 0 };
}

function validateInventoryConversionActivationAcceptance(after, candidates) {
  var rows = inventoryMigrationRows(after.conversions);
  var expected = inventoryConversionActivationRows(candidates, true);
  var validation = validateInventoryUomConversions(rows, inventoryMigrationRows(after.items));
  var readiness = inventoryConversionActivationReadiness(after, rows, INVENTORY_CONVERSION_ACTIVATION.EFFECTIVE_FROM);
  return { status: rows.length === INVENTORY_CONVERSION_ACTIVATION.EXPECTED_COUNT &&
      inventoryConversionPopulationRowsMatch(rows, expected) && validation.status === "PASS" &&
      readiness.SINGLE_OPERATOR_VERIFIED === INVENTORY_CONVERSION_ACTIVATION.EXPECTED_COUNT &&
      readiness.CONFLICT === 0 ? "PASS" : "FAIL",
    activeRows: rows.filter(function(row) { return isCanonicalActive(row.IsActive); }).length,
    conflicts: validation.errors.length, readiness: readiness };
}

function executeInventoryConversionActivationWithRuntime(runtime) {
  inventoryMigrationRequireRuntime(runtime);
  var candidates;
  try { candidates = runtime.candidateRows ? runtime.candidateRows.map(function(row) { return Object.assign({}, row); }) :
    buildInventoryConversionPopulationCandidates(runtime); }
  catch (error) { return { status: "REFUSED", reason: error.message, writeCount: 0 }; }
  var before = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  var currentRows = inventoryMigrationRows(before.conversions);
  var activeRows = inventoryConversionActivationRows(candidates, true);
  if (inventoryConversionPopulationRowsMatch(currentRows, activeRows)) {
    var alreadyAcceptance = validateInventoryConversionActivationAcceptance(before, candidates);
    return alreadyAcceptance.status === "PASS" ? { status: "ALREADY_ACTIVATED", writeCount: 0, acceptance: alreadyAcceptance } :
      { status: "REFUSED", reason: "ACTIVATED_POSTIMAGE_INVALID", writeCount: 0 };
  }
  var plan = buildInventoryConversionActivationPlan(before, candidates);
  if (plan.status !== "READY") return plan;
  var sheet = runtime.spreadsheet.getSheetByName(INVENTORY_CONVERSION_CANDIDATE_POPULATION.SHEET), writes = 0;
  var activeColumn = BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.indexOf("IsActive") + 1;
  try {
    sheet.getRange(2, activeColumn, candidates.length, 1).setValues(candidates.map(function() { return [true]; }));
    writes = 1; runtime.flush();
    var after = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
    var acceptance = validateInventoryConversionActivationAcceptance(after, candidates);
    if (acceptance.status !== "PASS") throw new Error("ACTIVATION_ACCEPTANCE_FAILED");
    return { status: "ACTIVATED", writeCount: writes, acceptance: acceptance,
      migrationRecord: { migrationId: INVENTORY_CONVERSION_ACTIVATION.MIGRATION_ID,
        version: INVENTORY_CONVERSION_ACTIVATION.VERSION, preState: before,
        preStateFingerprint: inventoryConversionPopulationFingerprint(before), acceptedPostState: after,
        postStateFingerprint: inventoryConversionPopulationFingerprint(after) } };
  } catch (error) {
    try {
      var current = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
      if (inventoryConversionPopulationRowsMatch(inventoryMigrationRows(current.conversions), activeRows)) {
        sheet.getRange(2, activeColumn, candidates.length, 1).setValues(candidates.map(function() { return [false]; }));
        runtime.flush();
      }
      var restored = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
      if (inventoryConversionPopulationFingerprint(restored) !== inventoryConversionPopulationFingerprint(before)) {
        throw new Error("ACTIVATION_RECOVERY_VERIFICATION_FAILED");
      }
      return { status: "FAILED_ROLLED_BACK", reason: error.message, writeCount: writes };
    } catch (rollbackError) {
      return { status: "FAILED_ROLLBACK", reason: error.message, rollbackReason: rollbackError.message, writeCount: writes };
    }
  }
}

function inventoryConversionActivationHasLedgerDependency(state, candidates) {
  var ids = {};
  (candidates || []).forEach(function(row) { ids[String(row.ItemID || "").trim()] = true; });
  return inventoryMigrationRows(state && state.ledger).some(function(row) {
    var date = inventoryTimestampDateKey(row.MovementTimestamp);
    return ids[String(row.ItemID || "").trim()] && (!date || date >= INVENTORY_CONVERSION_ACTIVATION.EFFECTIVE_FROM);
  });
}

function executeInventoryConversionActivationRecoveryWithRuntime(runtime, record) {
  inventoryMigrationRequireRuntime(runtime);
  if (!record || record.migrationId !== INVENTORY_CONVERSION_ACTIVATION.MIGRATION_ID ||
      record.version !== INVENTORY_CONVERSION_ACTIVATION.VERSION || !record.preState || !record.acceptedPostState ||
      record.preStateFingerprint !== inventoryConversionPopulationFingerprint(record.preState) ||
      record.postStateFingerprint !== inventoryConversionPopulationFingerprint(record.acceptedPostState)) {
    return { status: "REFUSED", reason: "INCOMPLETE_OR_UNIDENTIFIED_SNAPSHOT", writeCount: 0 };
  }
  var current = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  var candidates = inventoryMigrationRows(record.preState.conversions);
  if (inventoryConversionActivationHasLedgerDependency(current, candidates)) {
    return { status: "REFUSED", reason: "DEPENDENT_LEDGER_MOVEMENTS_EXIST", writeCount: 0 };
  }
  if (inventoryConversionPopulationFingerprint(current) !== record.postStateFingerprint) {
    return { status: "REFUSED", reason: "POST_IMAGE_CHANGED", writeCount: 0 };
  }
  var activeRows = inventoryMigrationRows(current.conversions);
  if (!inventoryConversionPopulationRowsMatch(activeRows, inventoryConversionActivationRows(candidates, true))) {
    return { status: "REFUSED", reason: "POST_IMAGE_NOT_OWNED", writeCount: 0 };
  }
  var activeColumn = BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.indexOf("IsActive") + 1;
  runtime.spreadsheet.getSheetByName(INVENTORY_CONVERSION_CANDIDATE_POPULATION.SHEET)
    .getRange(2, activeColumn, candidates.length, 1).setValues(candidates.map(function() { return [false]; }));
  runtime.flush();
  var restored = readInventoryConversionPopulationState(runtime.freshSpreadsheet ? runtime.freshSpreadsheet() : runtime.spreadsheet);
  return inventoryConversionPopulationFingerprint(restored) === record.preStateFingerprint ?
    { status: "RECOVERED", writeCount: 1 } :
    { status: "FAILED_ROLLBACK", reason: "RECOVERY_VERIFICATION_FAILED", writeCount: 1 };
}

function inventoryConversionActivationDisposableFixture(runtime, canonicalId, owned, label, sourceState) {
  var ownership = inventoryConversionPopulationDisposableFixture(runtime, canonicalId, owned, "Activation " + label, sourceState);
  var spreadsheet = runtime.openById(ownership.spreadsheetId);
  spreadsheet.getSheetByName("InventoryUOMConversions").getRange(1, 1, sourceState.conversions.values.length, 24)
    .setValues(sourceState.conversions.values);
  runtime.flush(); return ownership;
}

function executeInventoryConversionActivationDisposableRuntimeProofWithRuntime(runtime) {
  var owned = [], failure = null, cleanupFailures = [], result = null, productionBefore = null;
  try {
    var canonical = resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage);
    inventoryDisposableRuntimeProofRequire(canonical && String(canonical.getId()) === NUMLOCK_PRODUCTION_STORAGE_POLICY.SPREADSHEET_ID,
      "canonical production identity unavailable");
    var productionState = readInventoryConversionPopulationState(canonical);
    productionBefore = inventoryConversionPopulationFingerprint(productionState);
    var candidates = buildInventoryConversionPopulationCandidates(runtime);
    inventoryDisposableRuntimeProofRequire(buildInventoryConversionActivationPlan(productionState, candidates).status === "READY",
      "production activation pre-state must be READY without mutation");

    var primary = inventoryConversionActivationDisposableFixture(runtime, canonical.getId(), owned, "Primary", productionState);
    var context = inventoryConversionPopulationDisposableContext(runtime, primary, candidates);
    var first = executeInventoryConversionActivationWithRuntime(context);
    inventoryDisposableRuntimeProofRequire(first.status === "ACTIVATED" && first.writeCount === 1 &&
      first.acceptance.status === "PASS" && first.acceptance.activeRows === 21 &&
      first.acceptance.readiness.SINGLE_OPERATOR_VERIFIED === 21, "activation write and exact post-image");
    var second = executeInventoryConversionActivationWithRuntime(context);
    inventoryDisposableRuntimeProofRequire(second.status === "ALREADY_ACTIVATED" && second.writeCount === 0,
      "activation idempotency");
    var activeRows = inventoryMigrationRows(readInventoryConversionPopulationState(context.spreadsheet).conversions);
    var items = inventoryMigrationRows(productionState.items);
    inventoryDisposableRuntimeProofRequire(activeRows.every(function(row) {
      return gateInventoryMovementConversion({ ItemID: row.ItemID, MovementTimestamp: "2026-09-30T23:59:59+07:00" }, items, activeRows).status === "REFUSED";
    }), "posting gate before EffectiveFrom");
    inventoryDisposableRuntimeProofRequire(activeRows.every(function(row) {
      return gateInventoryMovementConversion({ ItemID: row.ItemID, MovementTimestamp: "2026-10-01T00:00:00+07:00" }, items, activeRows).status === "ACCEPTED";
    }), "posting gate on or after EffectiveFrom");
    var recovery = executeInventoryConversionActivationRecoveryWithRuntime(context, first.migrationRecord);
    inventoryDisposableRuntimeProofRequire(recovery.status === "RECOVERED" && recovery.writeCount === 1,
      "guarded activation recovery");

    var scenarios = [
      { label: "missing row", mutate: function(rows) { rows.pop(); } },
      { label: "extra row", mutate: function(rows) { rows.push(Object.assign({}, rows[0], { ConversionID: "EXTRA" })); } },
      { label: "wrong evidence", mutate: function(rows) { rows[0].EvidenceRef += "-WRONG"; } },
      { label: "changed ratio", mutate: function(rows) { rows[0].Numerator = Number(rows[0].Numerator) + 1; } },
      { label: "changed UOM", mutate: function(rows) { rows[0].FromUOM = "wrong"; } },
      { label: "changed package", mutate: function(rows) { rows[0].PackageIdentity += "-WRONG"; } },
      { label: "wrong approval", mutate: function(rows) { rows[0].ApprovalStatus = "APPROVED"; } },
      { label: "partial active", mutate: function(rows) { rows[0].IsActive = true; } },
      { label: "duplicate", mutate: function(rows) { rows[1].ConversionID = rows[0].ConversionID; } },
      { label: "conflict", mutate: function(rows) { rows.push(Object.assign({}, rows[0], { ConversionID: "CONFLICT", IsActive: true })); } },
      { label: "high risk", mutate: function(rows) { rows[0].PackageIdentity = "loose variable estimated goods"; } },
      { label: "Lemon", mutate: function(rows) { rows[0].ItemID = "ING-018"; } }
    ];
    scenarios.forEach(function(scenario) {
      var fixture = inventoryConversionActivationDisposableFixture(runtime, canonical.getId(), owned, scenario.label, productionState);
      var refusedContext = inventoryConversionPopulationDisposableContext(runtime, fixture, candidates);
      var rows = inventoryMigrationRows(readInventoryConversionPopulationState(refusedContext.spreadsheet).conversions);
      scenario.mutate(rows);
      var values = inventoryMigrationValues(BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS, rows);
      var sheet = refusedContext.spreadsheet.getSheetByName("InventoryUOMConversions");
      sheet.getRange(1, 1, Math.max(values.length, productionState.conversions.values.length), 24).clearContent();
      sheet.getRange(1, 1, values.length, 24).setValues(values); runtime.flush();
      var before = inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(refusedContext.spreadsheet));
      var refused = executeInventoryConversionActivationWithRuntime(refusedContext);
      inventoryDisposableRuntimeProofRequire(refused.status === "REFUSED" && refused.writeCount === 0 &&
        inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(refusedContext.spreadsheet)) === before,
        scenario.label + " zero-write refusal");
    });

    ["schema drift", "formula contamination", "note contamination"].forEach(function(label) {
      var fixture = inventoryConversionActivationDisposableFixture(runtime, canonical.getId(), owned, label, productionState);
      var refusedContext = inventoryConversionPopulationDisposableContext(runtime, fixture, candidates);
      var sheet = refusedContext.spreadsheet.getSheetByName("InventoryUOMConversions");
      if (label === "schema drift") sheet.getRange(1, 1).setValue("UnexpectedHeader");
      if (label === "formula contamination") sheet.getRange(2, 24).setFormula("=1");
      if (label === "note contamination") sheet.getRange(2, 24).setNote("unexpected");
      runtime.flush();
      var before = inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(refusedContext.spreadsheet));
      var refused = executeInventoryConversionActivationWithRuntime(refusedContext);
      inventoryDisposableRuntimeProofRequire(refused.status === "REFUSED" && refused.writeCount === 0 &&
        inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(refusedContext.spreadsheet)) === before,
        label + " zero-write refusal");
    });

    var dependencyFixture = inventoryConversionActivationDisposableFixture(runtime, canonical.getId(), owned, "Dependency", productionState);
    var dependencyContext = inventoryConversionPopulationDisposableContext(runtime, dependencyFixture, candidates);
    var dependencyActivation = executeInventoryConversionActivationWithRuntime(dependencyContext);
    var ledgerValues = BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS.map(function(header) {
      if (header === "ID_Movement") return "MOV-DEPENDENT";
      if (header === "MovementTimestamp") return "2026-10-01T00:00:00+07:00";
      if (header === "ItemID") return candidates[0].ItemID;
      if (header === "IsActive") return true;
      return "";
    });
    dependencyContext.spreadsheet.getSheetByName("InventoryLedger").getRange(2, 1, 1, ledgerValues.length).setValues([ledgerValues]);
    runtime.flush();
    var dependencyRecovery = executeInventoryConversionActivationRecoveryWithRuntime(dependencyContext, dependencyActivation.migrationRecord);
    inventoryDisposableRuntimeProofRequire(dependencyRecovery.status === "REFUSED" &&
      dependencyRecovery.reason === "DEPENDENT_LEDGER_MOVEMENTS_EXIST" && dependencyRecovery.writeCount === 0,
      "dependent ledger rollback guard");
    inventoryDisposableRuntimeProofRequire(inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(
      resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage))) === productionBefore, "production fingerprint changed");
    result = { status: "PASS", productionMutation: false, preflight: "READY", activation: first,
      idempotency: { status: second.status, writeCount: second.writeCount }, readiness: "SINGLE_OPERATOR_VERIFIED_21",
      postingGateBeforeEffectiveFrom: "REFUSED", postingGateOnOrAfterEffectiveFrom: "ACCEPTED",
      guardedRecovery: "PASS", dependencyRollbackGuard: "PASS", refusalCoverage: "PASS", cleanup: "PENDING" };
  } catch (error) { failure = error; }
  finally {
    owned.forEach(function(ownership) {
      try { runtime.trashOwnedSpreadsheet(ownership);
        if (!runtime.isOwnedSpreadsheetTrashed(ownership)) throw new Error("trash verification failed");
      } catch (cleanupError) { cleanupFailures.push(ownership.spreadsheetName + ": " + cleanupError.message); }
    });
    if (productionBefore !== null) {
      try { if (inventoryConversionPopulationFingerprint(readInventoryConversionPopulationState(
        resolveNumlockProductionSpreadsheetWithRuntime(runtime.storage))) !== productionBefore) throw new Error("production fingerprint changed"); }
      catch (productionError) { if (!failure) failure = productionError; }
    }
  }
  if (failure) throw failure;
  if (cleanupFailures.length) throw new Error("Activation cleanup failed: " + cleanupFailures.join(" | "));
  result.cleanup = "PASS"; return result;
}

function runInventoryConversionActivationDisposableRuntimeProof() {
  var result = executeInventoryConversionActivationDisposableRuntimeProofWithRuntime({
    storage: { openById: function(id) { return SpreadsheetApp.openById(id); } },
    createToken: function() { return new Date().getTime() + "-" + Utilities.getUuid(); },
    createSpreadsheet: function(name, rows, columns) { return SpreadsheetApp.create(name, rows, columns); },
    openById: function(id) { return SpreadsheetApp.openById(id); }, flush: function() { SpreadsheetApp.flush(); },
    readManifestBytes: function(id) { return DriveApp.getFileById(id).getBlob().getBytes(); },
    sha256: function(bytes) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes); },
    bytesToString: function(bytes) { return Utilities.newBlob(bytes).getDataAsString("UTF-8"); },
    trashOwnedSpreadsheet: function(ownership) { DriveApp.getFileById(ownership.spreadsheetId).setTrashed(true); },
    isOwnedSpreadsheetTrashed: function(ownership) { return DriveApp.getFileById(ownership.spreadsheetId).isTrashed(); }
  });
  Logger.log(JSON.stringify(result)); return result;
}

function runInventoryConversionActivation() {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeInventoryConversionActivationWithRuntime(inventoryConversionCandidateProductionRuntime(spreadsheet));
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function runInventoryConversionActivationRecovery(record) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = resolveNumlockProductionSpreadsheetWithRuntime({ openById: function(id) { return SpreadsheetApp.openById(id); } });
    if (!spreadsheet) return { status: "REFUSED", reason: "CANONICAL_STORAGE_UNAVAILABLE", writeCount: 0 };
    var result = executeInventoryConversionActivationRecoveryWithRuntime(inventoryConversionCandidateProductionRuntime(spreadsheet), record);
    Logger.log(JSON.stringify(result)); return result;
  } finally { if (acquired) lock.releaseLock(); }
}

// Phase 11U.2A: additive Lemon authority. The frozen 21-row executors above are unchanged.
var INVENTORY_LEMON_PRODUCTION = Object.freeze({
  VERSION: "11U.2A", FILE_ID: "1Gyv4scq6wm-VpEKcxcQg3iVxeHmmIiKV", EVIDENCE_VERSION: "V01",
  SHA256: "7f3bf64c2678c0436beeadd317f1dbe0f638b3ee9aeedab6fe1d146f4f4b9ed0",
  SHEETS: Object.freeze(["InventoryUOMConversions", "InventoryItems", "InventoryOpenings", "InventoryLedger",
    "BalanceLedger", "Accounts", "FinanceOpeningBalances", "tabsal", "COGSRecipes"])
});

function inventoryLemonRefusal(reason) { return { status: "REFUSED", reason: reason, writeCount: 0 }; }

function buildInventoryLemonProductionEvidence(runtime) {
  var policy = INVENTORY_LEMON_PRODUCTION, bytes = runtime.readManifestBytes(policy.FILE_ID);
  if (inventoryConversionPopulationHex(runtime.sha256(bytes)) !== policy.SHA256) throw new Error("LEMON_SHA256_MISMATCH");
  var manifest = inventoryConversionPopulationParseManifest(runtime.bytesToString(bytes));
  var expected = { ManifestID: "MANIFEST-MOS-ING-018-V01", ManifestVersion: "V01",
    ConversionID: "CONV-MOS-ING-018-V01", ItemID: "ING-018", ItemName: "Lemon", BaseUOM: "slice",
    FromUOM: "gr", ToUOM: "slice", Numerator: 24, Denominator: 1000, EffectiveFrom: "2026-10-01", EffectiveTo: "",
    EvidenceType: "MANAGEMENT_OPERATIONAL_STANDARD", KnowledgeBasis: "MANAGEMENT_OPERATIONAL_STANDARD",
    GovernancePath: "SINGLE_OPERATOR", ApprovalStatus: "SINGLE_OPERATOR_APPROVED", IsActive: false,
    NoIndependentReview: true, SelfApprovalDisclosed: true, PhysicalObservation: false,
    ReviewedBy: "", ReviewedAt: "", PreparedBy: "Dekker", PreparedAt: "2026-09-05T21:27:54+07:00",
    EvidenceDate: "2026-09-05", RecipeAutoConsumption: false };
  if (Object.keys(expected).some(function(key) { return manifest[key] !== expected[key]; })) {
    throw new Error("LEMON_EVIDENCE_FIELDS_MISMATCH");
  }
  var lemon = {};
  BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.forEach(function(key) {
    lemon[key] = Object.prototype.hasOwnProperty.call(manifest, key) ? manifest[key] : "";
  });
  lemon.EvidenceRef = "GDRIVE:" + policy.FILE_ID + ":" + policy.EVIDENCE_VERSION + ":SHA256:" + policy.SHA256;
  if (inventoryLemonOperationalStandardErrors(lemon).length ||
      ["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"].some(function(key) { return lemon[key] !== ""; })) {
    throw new Error("LEMON_AUTHORITY_MISMATCH");
  }
  // All 21 manifests are retrieved and hash-checked too; caller-supplied candidate rows are never used.
  return { lemon: lemon, existing: inventoryConversionActivationRows(buildInventoryConversionPopulationCandidates(runtime), true) };
}

function readInventoryLemonProductionState(spreadsheet) {
  var state = {};
  INVENTORY_LEMON_PRODUCTION.SHEETS.forEach(function(name) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) { state[name] = { exists: false }; return; }
    var rows = sheet.getMaxRows(), columns = sheet.getMaxColumns(), range = sheet.getRange(1, 1, rows, columns);
    state[name] = { exists: true, maxRows: rows, maxColumns: columns,
      values: range.getValues(), formulas: range.getFormulas(), notes: range.getNotes() };
  });
  return state;
}

function inventoryLemonLogicalSnapshot(snapshot, headers) {
  if (!snapshot || !snapshot.exists) throw new Error("MISSING_STORAGE");
  if (snapshot.maxColumns < headers.length || JSON.stringify(snapshot.values[0].slice(0, headers.length)) !== JSON.stringify(headers) ||
      snapshot.values.some(function(row) { return row.slice(headers.length).some(function(value) { return value !== ""; }); }) ||
      [snapshot.formulas, snapshot.notes].some(function(grid) {
        return grid.some(function(row) { return row.some(function(value) { return value !== ""; }); });
      })) throw new Error("SCHEMA_FORMULA_NOTE_OR_OVERFLOW_DRIFT");
  return { exists: true, values: snapshot.values.map(function(row) { return row.slice(0, headers.length); }) };
}

function inventoryLemonRowsMatch(actual, expected) {
  var headers = BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS;
  return !!actual && !!expected && actual.length === expected.length && actual.every(function(row, index) {
    return headers.every(function(key) {
      var left = row[key], right = expected[index][key];
      if (right === "") return left === "";
      if (["EffectiveFrom", "EffectiveTo", "EvidenceDate"].indexOf(key) !== -1) {
        return !!capitalEquityDateKey(left) && capitalEquityDateKey(left) === capitalEquityDateKey(right);
      }
      if (["PreparedAt", "ReviewedAt", "CreatedAt", "UpdatedAt"].indexOf(key) !== -1) {
        return inventoryTimestampMillis(left) !== null && inventoryTimestampMillis(left) === inventoryTimestampMillis(right);
      }
      if (key === "Numerator" || key === "Denominator") return isFinite(Number(left)) && Number(left) === Number(right);
      return left === right;
    });
  });
}

function buildInventoryLemonProductionPlan(state, evidence, operation) {
  try {
    if (["population", "activation"].indexOf(operation) === -1) return inventoryLemonRefusal("INVALID_OPERATION");
    if (INVENTORY_LEMON_PRODUCTION.SHEETS.some(function(name) { return !state[name] || !state[name].exists; })) {
      return inventoryLemonRefusal("MISSING_PRESERVATION_STORAGE");
    }
    var policy = BALANCE_FOUNDATION_POLICY, headers = policy.INVENTORY_UOM_CONVERSION_HEADERS;
    var conversions = inventoryLemonLogicalSnapshot(state.InventoryUOMConversions, headers);
    var items = inventoryMigrationRows(inventoryLemonLogicalSnapshot(state.InventoryItems, policy.INVENTORY_ITEM_HEADERS));
    var ledger = inventoryLemonLogicalSnapshot(state.InventoryLedger, policy.INVENTORY_LEDGER_HEADERS);
    inventoryLemonLogicalSnapshot(state.InventoryOpenings, INVENTORY_OPENING_STAGING_POLICY.HEADERS);
    inventoryLemonLogicalSnapshot(state.BalanceLedger, policy.BALANCE_LEDGER_HEADERS);
    var accounts = inventoryLemonLogicalSnapshot(state.Accounts, INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_HEADERS);
    var accountRows = inventoryMigrationRows(accounts);
    if (inventoryMigrationRows(ledger).length || inventoryMigrationAccountState({ accounts: accounts }) !== "READY" ||
        accountRows.some(function(row) { return String(row.AccountCode).trim() === "3210"; }) ||
        accountRows.filter(function(row) { return String(row.AccountCode).trim() === "3200"; }).length !== 1 ||
        policy.RECIPE_AUTO_CONSUMPTION_ENABLED !== false || policy.HPP_AUTHORITY !== "tabsal.HPP") {
      return inventoryLemonRefusal("POSTING_ISOLATION_DRIFT");
    }
    var lemonItems = items.filter(function(row) { return row.ItemID === "ING-018"; });
    if (items.length !== 22 || validateInventoryItemCandidates(items).status !== "PASS" || lemonItems.length !== 1 ||
        lemonItems[0].ItemName !== "Lemon" || lemonItems[0].BaseUOM !== "slice" || !isCanonicalActive(lemonItems[0].IsActive)) {
      return inventoryLemonRefusal("INVENTORY_ITEMS_DRIFT");
    }
    var rows = inventoryMigrationRows(conversions), existing = rows.slice(0, 21);
    if (!inventoryLemonRowsMatch(existing, evidence.existing) || existing.some(function(row) { return row.IsActive !== true; }) ||
        evidence.existing.length !== 21 || validateInventoryUomConversions(rows, items).status !== "PASS" ||
        existing.some(function(row) {
          return classifyInventoryConversionReadiness(row.ItemID, "2026-10-01", items, rows).status !== "SINGLE_OPERATOR_VERIFIED";
        })) return inventoryLemonRefusal("EXISTING_21_OR_CONVERSION_DRIFT");
    // Contiguous frozen rows fix the only writable location at row 23; gaps are never repaired.
    if (!inventoryLemonRowsMatch(inventoryMigrationRows({ exists: true, values: conversions.values.slice(0, 22) }), evidence.existing) ||
        state.InventoryUOMConversions.maxRows < 23) return inventoryLemonRefusal("PHYSICAL_ROW_DRIFT");
    var lemonRows = rows.slice(21), active = Object.assign({}, evidence.lemon, { IsActive: true });
    var inactiveExact = lemonRows.length === 1 && lemonRows[0].IsActive === false &&
      inventoryLemonRowsMatch(lemonRows, [evidence.lemon]);
    var activeExact = lemonRows.length === 1 && lemonRows[0].IsActive === true &&
      inventoryLemonRowsMatch(lemonRows, [active]);
    if (rows.length > 21 && (conversions.values[22][0] !== evidence.lemon.ConversionID || (!inactiveExact && !activeExact))) {
      return inventoryLemonRefusal("UNEXPECTED_LEMON_ROW");
    }
    var status = operation === "population" ? (rows.length === 21 ? "READY" : inactiveExact ? "ALREADY_POPULATED" : "REFUSED") :
      (inactiveExact ? "READY" : activeExact ? "ALREADY_ACTIVATED" : "REFUSED");
    if (status === "REFUSED") return inventoryLemonRefusal("EXACT_OPERATION_PREIMAGE_REQUIRED");
    var readiness = classifyInventoryConversionReadiness("ING-018", "2026-10-01", items, rows).status;
    if ((activeExact && readiness !== "SINGLE_OPERATOR_VERIFIED") || (!activeExact && readiness !== "NEEDS_EVIDENCE")) {
      return inventoryLemonRefusal("LEMON_READINESS_DRIFT");
    }
    return { status: status, writeCount: 0, plannedWriteCount: status === "READY" ? 1 : 0,
      readiness: readiness, activeAuthorities: activeExact ? 22 : 21, conflicts: 0, targetRow: 23 };
  } catch (error) { return inventoryLemonRefusal(error.message); }
}

function inventoryLemonClone(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(inventoryLemonClone);
  if (value && typeof value === "object") {
    var result = {}; Object.keys(value).forEach(function(key) { result[key] = inventoryLemonClone(value[key]); }); return result;
  }
  return value;
}

function inventoryLemonStateEqual(left, right) {
  function comparable(state) {
    var copy = inventoryLemonClone(state), sheet = copy && copy.InventoryUOMConversions;
    if (sheet && sheet.exists) {
      sheet.values.slice(1).forEach(function(row) {
        [8, 9, 12].forEach(function(column) {
          if (row[column] !== "") row[column] = capitalEquityDateKey(row[column]) || row[column];
        });
        [14, 16, 20, 22].forEach(function(column) {
          if (row[column] !== "" && inventoryTimestampMillis(row[column]) !== null) row[column] = inventoryTimestampMillis(row[column]);
        });
      });
    }
    return JSON.stringify(copy);
  }
  return comparable(left) === comparable(right);
}

function inventoryLemonExpectedPostImage(before, evidence, operation) {
  var after = inventoryLemonClone(before), row = after.InventoryUOMConversions.values[22];
  if (operation === "population") {
    BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS.forEach(function(key, column) { row[column] = evidence.lemon[key]; });
  } else if (operation === "activation") row[19] = true;
  else throw new Error("INVALID_OPERATION");
  return after;
}

function inventoryLemonFreshState(runtime) {
  inventoryMigrationRequireRuntime(runtime);
  if (typeof runtime.freshSpreadsheet !== "function") throw new Error("FRESH_READ_REQUIRED");
  var spreadsheet = runtime.freshSpreadsheet();
  if (!spreadsheet || spreadsheet.getId() !== runtime.spreadsheet.getId()) throw new Error("FRESH_STORAGE_IDENTITY_DRIFT");
  inventoryMigrationRequireRuntime(Object.assign({}, runtime, { spreadsheet: spreadsheet }));
  return { spreadsheet: spreadsheet, state: readInventoryLemonProductionState(spreadsheet) };
}

function preflightInventoryLemonProductionWithRuntime(runtime, operation) {
  try {
    inventoryMigrationRequireRuntime(runtime);
    var evidence = buildInventoryLemonProductionEvidence(runtime), fresh = inventoryLemonFreshState(runtime);
    return buildInventoryLemonProductionPlan(fresh.state, evidence, operation || "population");
  } catch (error) { return inventoryLemonRefusal(error.message); }
}

function validateInventoryLemonProductionAcceptance(before, after, evidence, operation) {
  var plan = buildInventoryLemonProductionPlan(after, evidence, operation);
  var expectedStatus = operation === "population" ? "ALREADY_POPULATED" : "ALREADY_ACTIVATED";
  var items = inventoryMigrationRows(inventoryLemonLogicalSnapshot(after.InventoryItems, BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS));
  var conversions = inventoryMigrationRows(inventoryLemonLogicalSnapshot(after.InventoryUOMConversions,
    BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS));
  function gate(date) { return gateInventoryMovementConversion({ ItemID: "ING-018", MovementTimestamp: date + "T12:00:00+07:00" }, items, conversions).status; }
  var boundary = gate("2026-09-30") === "REFUSED" &&
    ["2026-10-01", "2026-10-02"].every(function(date) { return gate(date) === (operation === "activation" ? "ACCEPTED" : "REFUSED"); });
  return { status: plan.status === expectedStatus && boundary &&
      inventoryLemonStateEqual(after, inventoryLemonExpectedPostImage(before, evidence, operation)) ? "PASS" : "FAIL",
    readiness: plan.readiness, activeAuthorities: plan.activeAuthorities, conflicts: plan.conflicts,
    effectiveFrom: "2026-10-01", effectiveFromBoundary: boundary ? "PASS" : "FAIL" };
}

function executeInventoryLemonProductionWithRuntime(runtime, operation) {
  var before, expected, evidence, writeAttempted = false, writes = 0;
  try {
    inventoryMigrationRequireRuntime(runtime);
    evidence = buildInventoryLemonProductionEvidence(runtime);
    before = inventoryLemonFreshState(runtime).state;
    var plan = buildInventoryLemonProductionPlan(before, evidence, operation);
    if (plan.status !== "READY") return plan;
    expected = inventoryLemonExpectedPostImage(before, evidence, operation);
    // A second read immediately before writing refuses source changes since planning.
    var fresh = inventoryLemonFreshState(runtime);
    if (!inventoryLemonStateEqual(before, fresh.state)) return inventoryLemonRefusal("SOURCE_CHANGED_BEFORE_WRITE");
    var sheet = fresh.spreadsheet.getSheetByName("InventoryUOMConversions");
    writeAttempted = true;
    if (operation === "population") sheet.getRange(23, 1, 1, 24).setValues([expected.InventoryUOMConversions.values[22].slice(0, 24)]);
    else sheet.getRange(23, 20, 1, 1).setValues([[true]]);
    writes = 1; runtime.flush();
    var after = inventoryLemonFreshState(runtime).state;
    var acceptance = validateInventoryLemonProductionAcceptance(before, after, evidence, operation);
    if (acceptance.status !== "PASS") throw new Error("LEMON_POST_IMAGE_ACCEPTANCE_FAILED");
    return { status: operation === "population" ? "POPULATED" : "ACTIVATED", writeCount: 1, acceptance: acceptance,
      migrationRecord: { version: INVENTORY_LEMON_PRODUCTION.VERSION, operation: operation,
        before: before, expected: expected, failedWrite: false } };
  } catch (error) {
    if (!writeAttempted) return inventoryLemonRefusal(error.message);
    // Never retry or silently repair. A throwing write can have committed; retain uncertainty explicitly.
    return { status: "FAILED_REQUIRES_REVIEW", reason: error.message, writeCount: writes || null, writeAttemptCount: 1,
      migrationRecord: { version: INVENTORY_LEMON_PRODUCTION.VERSION, operation: operation,
        before: before, expected: expected, failedWrite: true } };
  }
}

function inventoryLemonRecoveryDependency(state) {
  var policy = BALANCE_FOUNDATION_POLICY;
  var ledger = inventoryLemonLogicalSnapshot(state.InventoryLedger, policy.INVENTORY_LEDGER_HEADERS);
  var openings = inventoryLemonLogicalSnapshot(state.InventoryOpenings, INVENTORY_OPENING_STAGING_POLICY.HEADERS);
  var balance = inventoryLemonLogicalSnapshot(state.BalanceLedger, policy.BALANCE_LEDGER_HEADERS);
  // Balance journals do not carry a reliable ItemID link: populated accounting is ambiguous, so refuse conservatively.
  if (inventoryMigrationRows(ledger).length || inventoryMigrationRows(balance).length ||
      inventoryMigrationRows(openings).some(function(row) {
        return Object.keys(row).some(function(key) { return /ING-018|CONV-MOS-ING-018-V01/.test(String(row[key])); });
      })) return true;
  var conversions = inventoryMigrationRows(inventoryLemonLogicalSnapshot(state.InventoryUOMConversions, policy.INVENTORY_UOM_CONVERSION_HEADERS));
  return conversions.length !== 22 || conversions.filter(function(row) { return row.ItemID === "ING-018"; }).length !== 1;
}

function executeInventoryLemonProductionRecoveryWithRuntime(runtime, record) {
  var attempted = false, writes = 0;
  try {
    inventoryMigrationRequireRuntime(runtime);
    if (!record || record.version !== INVENTORY_LEMON_PRODUCTION.VERSION || !record.before || !record.expected ||
        ["population", "activation"].indexOf(record.operation) === -1 ||
        (runtime.mode === INVENTORY_SCHEMA_RUNTIME.PRODUCTION_MODE && record.failedWrite !== true)) {
      return inventoryLemonRefusal("UNOWNED_OR_NONFAILED_RECOVERY_RECORD");
    }
    var evidence = buildInventoryLemonProductionEvidence(runtime);
    if (buildInventoryLemonProductionPlan(record.before, evidence, record.operation).status !== "READY" ||
        !inventoryLemonStateEqual(record.expected, inventoryLemonExpectedPostImage(record.before, evidence, record.operation))) {
      return inventoryLemonRefusal("RECOVERY_RECORD_DRIFT");
    }
    var current = inventoryLemonFreshState(runtime);
    if (inventoryLemonRecoveryDependency(current.state)) return inventoryLemonRefusal("DOWNSTREAM_OR_LATER_CONVERSION_DEPENDENCY");
    if (!inventoryLemonStateEqual(current.state, record.expected)) return inventoryLemonRefusal("POST_IMAGE_NOT_OWNED");
    var fresh = inventoryLemonFreshState(runtime);
    if (!inventoryLemonStateEqual(fresh.state, current.state)) return inventoryLemonRefusal("SOURCE_CHANGED_BEFORE_RECOVERY");
    var sheet = fresh.spreadsheet.getSheetByName("InventoryUOMConversions");
    attempted = true;
    if (record.operation === "population") sheet.getRange(23, 1, 1, 24).clearContent();
    else sheet.getRange(23, 20, 1, 1).setValues([[false]]);
    writes = 1; runtime.flush();
    return { status: inventoryLemonStateEqual(inventoryLemonFreshState(runtime).state, record.before) ? "RECOVERED" : "FAILED_RECOVERY",
      writeCount: 1 };
  } catch (error) {
    return attempted ? { status: "FAILED_RECOVERY", reason: error.message, writeCount: writes || null, writeAttemptCount: 1 } :
      inventoryLemonRefusal(error.message);
  }
}

function inventoryLemonProductionLocked(operation, record) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var spreadsheet = requireNumlockProductionSpreadsheet(), runtime = inventoryConversionCandidateProductionRuntime(spreadsheet);
    var result = operation === "preflight" ? preflightInventoryLemonProductionWithRuntime(runtime, "population") :
      operation === "recovery" ? executeInventoryLemonProductionRecoveryWithRuntime(runtime, record) :
      executeInventoryLemonProductionWithRuntime(runtime, operation);
    // Full recovery snapshots are returned, not logged (they include preserved business data).
    Logger.log(JSON.stringify({ status: result.status, reason: result.reason, writeCount: result.writeCount, acceptance: result.acceptance }));
    return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function runInventoryLemonProductionPreflight() { return inventoryLemonProductionLocked("preflight"); }
function runInventoryLemonProductionPopulation() { return inventoryLemonProductionLocked("population"); }
function runInventoryLemonProductionActivation() { return inventoryLemonProductionLocked("activation"); }
function runInventoryLemonProductionRecovery(record) { return inventoryLemonProductionLocked("recovery", record); }
