var DEPRECIATION_POLICY = Object.freeze({
  METHOD: "StraightLine",
  TARGET_PERIOD: "2026-08-01",
  ASSET_HEADERS: Object.freeze(["ID_Asset", "Nama", "Kategori", "Jumlah", "TanggalPerolehan",
    "BiayaPerolehan", "UmurEkonomisBulan", "NilaiResidu", "DepreciationMethod", "IsActive",
    "DisposedAt", "Notes", "CreatedAt", "UpdatedAt"]),
  LEDGER_HEADERS: Object.freeze(["ID_Dep", "Period", "ID_Asset", "OpeningBookValue", "Depreciation",
    "AccumulatedDepreciation", "ClosingBookValue", "GeneratedAt"]),
  ACCOUNT_CODES: Object.freeze(["1500", "1590", "6900"])
});

var DEPRECIATION_BACKFILL_ACCEPTANCE = Object.freeze({
  assetCount: 69,
  generatedRowCount: 2679,
  earliestPeriod: "2020-12-01",
  latestPeriod: "2026-08-01",
  totalAcquisitionCost: 32880000,
  totalResidualValue: 3288000,
  totalDepreciableBase: 29592000,
  accumulatedDepreciationThroughTarget: 25060700,
  closingNetBookValue: 7819300,
  remainingDepreciableAmount: 4531300,
  fullyDepreciatedAssetCount: 49,
  stillDepreciatingAssetCount: 20
});

var DEPRECIATION_BACKFILL_BATCH_SIZE = 500;

function getAssetsReadModel() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var assets = readCanonicalTable(ss, "Assets", DEPRECIATION_POLICY.ASSET_HEADERS);
  var activeAssets = (assets || []).filter(function(row) { return isCanonicalActive(row.IsActive); });
  var totalCost = 0, activeCount = 0;
  activeAssets.forEach(function(row) {
    var cost = Number(row.BiayaPerolehan);
    if (isFinite(cost) && cost > 0) totalCost += cost;
    activeCount++;
  });
  function toISODate(value) {
    if (!value) return "";
    var d = value instanceof Date ? value : new Date(value);
    if (!d || isNaN(d.getTime())) return "";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  return {
    assets: activeAssets.map(function(row) {
      return {
        ID_Asset: String(row.ID_Asset || "").trim(),
        Nama: String(row.Nama || "").trim(),
        Kategori: String(row.Kategori || "").trim(),
        Jumlah: Number(row.Jumlah) || 0,
        TanggalPerolehan: toISODate(row.TanggalPerolehan),
        BiayaPerolehan: Number(row.BiayaPerolehan) || 0,
        UmurEkonomisBulan: Number(row.UmurEkonomisBulan) || 0,
        NilaiResidu: Number(row.NilaiResidu) || 0,
        DepreciationMethod: String(row.DepreciationMethod || "").trim(),
        IsActive: isCanonicalActive(row.IsActive),
        DisposedAt: toISODate(row.DisposedAt),
        Notes: String(row.Notes || "").trim()
      };
    }),
    summary: {
      totalAssets: activeAssets.length,
      activeAssets: activeCount,
      totalAcquisitionCost: totalCost
    }
  };
}

function depreciationPeriodKey(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return canonicalDateKey(value).slice(0, 7) + "-01";
  }
  var match = String(value == null ? "" : value).trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3] || 1);
  var date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return match[1] + "-" + match[2] + "-01";
}

function addDepreciationMonth(period, offset) {
  var parts = period.split("-");
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1 + offset, 1);
  return canonicalDateKey(date);
}

function depreciationLedgerId(assetId, period) {
  return "DEP-" + String(assetId).trim() + "-" + period.slice(0, 7).replace("-", "");
}

function validateDepreciationAsset(asset) {
  var id = String(asset && asset.ID_Asset || "").trim();
  var cost = Number(asset && asset.BiayaPerolehan);
  var residual = Number(asset && asset.NilaiResidu);
  var life = Number(asset && asset.UmurEkonomisBulan);
  var acquisition = depreciationPeriodKey(asset && asset.TanggalPerolehan);
  var method = String(asset && asset.DepreciationMethod || "").trim();
  var disposal = asset && asset.DisposedAt !== "" && asset.DisposedAt != null ?
    depreciationPeriodKey(asset.DisposedAt) : null;
  var errors = [];
  if (!id) errors.push("INVALID_ASSET_ID");
  if (!isFinite(cost) || cost <= 0 || Math.round(cost) !== cost) errors.push("INVALID_COST");
  if (!isFinite(residual) || residual < 0 || Math.round(residual) !== residual ||
      isFinite(cost) && residual > cost) errors.push("INVALID_RESIDUAL");
  if (!isFinite(life) || life <= 0 || Math.floor(life) !== life) errors.push("INVALID_USEFUL_LIFE");
  if (!acquisition) errors.push("INVALID_ACQUISITION_DATE");
  if (method !== DEPRECIATION_POLICY.METHOD) errors.push("UNSUPPORTED_METHOD");
  if (asset && asset.DisposedAt !== "" && asset.DisposedAt != null && !disposal) errors.push("INVALID_DISPOSAL_DATE");
  return { id: id, cost: cost, residual: residual, life: life, acquisition: acquisition,
    disposal: disposal, errors: errors };
}

function calculateDepreciationSchedule(asset, throughPeriod) {
  var normalized = validateDepreciationAsset(asset);
  var target = depreciationPeriodKey(throughPeriod);
  if (normalized.errors.length) throw new Error("Invalid depreciation asset " +
    (normalized.id || "UNKNOWN") + ": " + normalized.errors.join(","));
  if (!target) throw new Error("Invalid depreciation target period");
  if (target < normalized.acquisition) return [];

  var last = addDepreciationMonth(normalized.acquisition, normalized.life - 1);
  if (target < last) last = target;
  if (normalized.disposal && normalized.disposal < last) last = normalized.disposal;
  if (last < normalized.acquisition) return [];

  var base = normalized.cost - normalized.residual;
  var normalDepreciation = Math.round(base / normalized.life);
  var rows = [], opening = normalized.cost, accumulated = 0, period = normalized.acquisition;
  for (var monthIndex = 0; monthIndex < normalized.life && period <= last; monthIndex++) {
    var remaining = base - accumulated;
    var depreciation = monthIndex === normalized.life - 1 ? remaining : Math.min(normalDepreciation, remaining);
    depreciation = Math.max(0, depreciation);
    accumulated += depreciation;
    var closing = opening - depreciation;
    rows.push({ ID_Dep: depreciationLedgerId(normalized.id, period), Period: period,
      ID_Asset: normalized.id, OpeningBookValue: opening, Depreciation: depreciation,
      AccumulatedDepreciation: accumulated, ClosingBookValue: closing });
    opening = closing;
    period = addDepreciationMonth(period, 1);
  }
  return rows;
}

function buildDepreciationDryRun(assets, throughPeriod) {
  var target = depreciationPeriodKey(throughPeriod);
  if (!target) throw new Error("Invalid depreciation target period");
  var rows = [], invalidAssets = [], snapshots = [], logicalKeys = {};
  var duplicateLogicalKeys = [], reconciliationFailures = [];
  var totals = { acquisitionCost: 0, residualValue: 0, depreciableBase: 0,
    accumulatedDepreciation: 0, closingBookValue: 0 };

  (assets || []).forEach(function(asset) {
    var normalized = validateDepreciationAsset(asset);
    if (normalized.errors.length) {
      invalidAssets.push({ ID_Asset: normalized.id, errors: normalized.errors.slice() });
      return;
    }
    var schedule = calculateDepreciationSchedule(asset, target);
    var accumulated = schedule.length ? schedule[schedule.length - 1].AccumulatedDepreciation : 0;
    var closing = schedule.length ? schedule[schedule.length - 1].ClosingBookValue : normalized.cost;
    totals.acquisitionCost += normalized.cost;
    totals.residualValue += normalized.residual;
    totals.depreciableBase += normalized.cost - normalized.residual;
    totals.accumulatedDepreciation += accumulated;
    totals.closingBookValue += closing;
    if (normalized.cost !== accumulated + closing || accumulated > normalized.cost - normalized.residual ||
        closing < normalized.residual) reconciliationFailures.push(normalized.id);
    snapshots.push({ ID_Asset: normalized.id, fullyDepreciated: accumulated === normalized.cost - normalized.residual });
    schedule.forEach(function(row) {
      var key = row.ID_Asset + "|" + row.Period;
      if (logicalKeys[key]) duplicateLogicalKeys.push(key);
      logicalKeys[key] = true;
      rows.push(row);
    });
  });
  if (totals.acquisitionCost !== totals.accumulatedDepreciation + totals.closingBookValue ||
      totals.depreciableBase !== totals.accumulatedDepreciation +
        (totals.closingBookValue - totals.residualValue)) reconciliationFailures.push("TOTAL");

  var periods = rows.map(function(row) { return row.Period; }).sort();

  return { targetPeriod: target, assetCount: (assets || []).length, generatedRowCount: rows.length,
    earliestPeriod: periods.length ? periods[0] : null,
    latestPeriod: periods.length ? periods[periods.length - 1] : null,
    totalAcquisitionCost: totals.acquisitionCost, totalResidualValue: totals.residualValue,
    totalDepreciableBase: totals.depreciableBase,
    depreciationThroughTarget: totals.accumulatedDepreciation,
    accumulatedDepreciationThroughTarget: totals.accumulatedDepreciation,
    closingNetBookValue: totals.closingBookValue,
    fullyDepreciatedAssetCount: snapshots.filter(function(item) { return item.fullyDepreciated; }).length,
    stillDepreciatingAssetCount: snapshots.filter(function(item) { return !item.fullyDepreciated; }).length,
    invalidAssets: invalidAssets, reconciliationFailures: reconciliationFailures,
    duplicateLogicalKeys: duplicateLogicalKeys, rows: rows };
}

function depreciationReportSummary(report) {
  return { status: report.status, readOnly: report.readOnly, targetPeriod: report.targetPeriod,
    assetCount: report.assetCount, generatedRowCount: report.generatedRowCount,
    earliestPeriod: report.earliestPeriod, latestPeriod: report.latestPeriod,
    totalAcquisitionCost: report.totalAcquisitionCost, totalResidualValue: report.totalResidualValue,
    totalDepreciableBase: report.totalDepreciableBase,
    accumulatedDepreciationThroughTarget: report.accumulatedDepreciationThroughTarget,
    closingNetBookValue: report.closingNetBookValue,
    remainingDepreciableAmount: report.closingNetBookValue - report.totalResidualValue,
    fullyDepreciatedAssetCount: report.fullyDepreciatedAssetCount,
    stillDepreciatingAssetCount: report.stillDepreciatingAssetCount,
    invalidAssetCount: report.invalidAssets.length,
    reconciliationFailureCount: report.reconciliationFailures.length,
    duplicateLogicalKeyCount: report.duplicateLogicalKeys.length,
    depreciationLedgerRows: report.depreciationLedgerRows,
    missingAccountCodes: report.missingAccountCodes || [] };
}

function requireDepreciationAcceptanceValue(name, actual, expected) {
  if (actual !== expected) throw new Error("Depreciation backfill pre-write mismatch: " +
    name + " expected=" + expected + ", actual=" + actual);
}

function assertDepreciationBackfillCandidate(report) {
  if (!report || depreciationPeriodKey(report.targetPeriod) !== DEPRECIATION_POLICY.TARGET_PERIOD ||
      report.rows.length !== report.generatedRowCount || report.invalidAssets.length ||
      report.duplicateLogicalKeys.length || report.reconciliationFailures.length ||
      report.totalAcquisitionCost !== report.accumulatedDepreciationThroughTarget + report.closingNetBookValue ||
      report.totalDepreciableBase !== report.accumulatedDepreciationThroughTarget +
        report.closingNetBookValue - report.totalResidualValue) {
    throw new Error("Depreciation backfill logical validation failed");
  }
  var assets = {}, keys = {};
  report.rows.forEach(function(row) {
    var period = depreciationPeriodKey(row.Period), key = String(row.ID_Asset || "").trim() + "|" + period;
    if (!period || period > DEPRECIATION_POLICY.TARGET_PERIOD || keys[key] ||
        String(row.ID_Dep || "") !== depreciationLedgerId(row.ID_Asset, period) ||
        !isFinite(Number(row.Depreciation)) || Number(row.Depreciation) < 0) {
      throw new Error("Depreciation backfill row validation failed: " + key);
    }
    keys[key] = true; assets[String(row.ID_Asset)] = true;
  });
  if (Object.keys(assets).length !== report.assetCount || report.rows.some(function(row) {
      return row.Period === DEPRECIATION_POLICY.TARGET_PERIOD && !keys[row.ID_Asset + "|" + DEPRECIATION_POLICY.TARGET_PERIOD];
    })) throw new Error("Depreciation target-period completeness failed");
  return report;
}

function depreciationSpreadsheetDate(period) {
  var parts = period.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
}

function depreciationRowsForWrite(report, generatedAt) {
  return report.rows.map(function(row) {
    return [row.ID_Dep, depreciationSpreadsheetDate(row.Period), row.ID_Asset, row.OpeningBookValue,
      row.Depreciation, row.AccumulatedDepreciation, row.ClosingBookValue, generatedAt];
  });
}

function assertPhysicalDepreciationLedger(assets, physicalRows, candidate) {
  requireDepreciationAcceptanceValue("physicalRows", physicalRows.length, candidate.rows.length);
  var assetMap = buildCanonicalMasterMap(assets, "ID_Asset", "Assets");
  var expectedByKey = {}, ids = {}, keys = {}, grouped = {}, generatedAtValue = null;
  candidate.rows.forEach(function(row) { expectedByKey[row.ID_Asset + "|" + row.Period] = row; });

  physicalRows.forEach(function(row) {
    var id = String(row.ID_Dep || "").trim(), assetId = String(row.ID_Asset || "").trim();
    var period = depreciationPeriodKey(row.Period), key = assetId + "|" + period;
    if (ids[id]) throw new Error("Duplicate physical ID_Dep: " + id);
    if (keys[key]) throw new Error("Duplicate physical depreciation logical key: " + key);
    ids[id] = true; keys[key] = true;
    var expected = expectedByKey[key];
    if (!expected || id !== expected.ID_Dep) throw new Error("Unexpected physical depreciation identity: " + key);
    ["OpeningBookValue", "Depreciation", "AccumulatedDepreciation", "ClosingBookValue"].forEach(function(field) {
      if (Number(row[field]) !== expected[field] || Math.round(Number(row[field])) !== Number(row[field])) {
        throw new Error("Physical depreciation mismatch: " + key + ":" + field);
      }
    });
    if (!row.GeneratedAt) throw new Error("Physical depreciation GeneratedAt missing: " + key);
    var generatedKey = row.GeneratedAt instanceof Date ? row.GeneratedAt.getTime() : String(row.GeneratedAt);
    if (generatedAtValue === null) generatedAtValue = generatedKey;
    if (generatedAtValue !== generatedKey) throw new Error("Physical depreciation GeneratedAt is inconsistent");
    grouped[assetId] = grouped[assetId] || [];
    grouped[assetId].push({ period: period, opening: Number(row.OpeningBookValue),
      depreciation: Number(row.Depreciation), accumulated: Number(row.AccumulatedDepreciation),
      closing: Number(row.ClosingBookValue) });
  });

  var totals = { acquisition: 0, residual: 0, base: 0, accumulated: 0, closing: 0 };
  Object.keys(assetMap).forEach(function(assetId) {
    var normalized = validateDepreciationAsset(assetMap[assetId]);
    var rows = (grouped[assetId] || []).sort(function(left, right) { return left.period.localeCompare(right.period); });
    if (!rows.length) throw new Error("Physical depreciation rows missing for asset: " + assetId);
    totals.acquisition += normalized.cost; totals.residual += normalized.residual;
    totals.base += normalized.cost - normalized.residual;
    rows.forEach(function(row, index) {
      var prior = index ? rows[index - 1] : null;
      if ((!prior && row.opening !== normalized.cost) ||
          (prior && (row.period !== addDepreciationMonth(prior.period, 1) || row.opening !== prior.closing)) ||
          row.accumulated !== (prior ? prior.accumulated : 0) + row.depreciation ||
          row.closing !== row.opening - row.depreciation || row.closing < normalized.residual ||
          row.accumulated > normalized.cost - normalized.residual || row.period > DEPRECIATION_POLICY.TARGET_PERIOD) {
        throw new Error("Physical depreciation continuity failed: " + assetId + "|" + row.period);
      }
      var maturity = addDepreciationMonth(normalized.acquisition, normalized.life - 1);
      if (row.period > maturity || normalized.disposal && row.period > normalized.disposal) {
        throw new Error("Physical depreciation cutoff failed: " + assetId + "|" + row.period);
      }
      if (row.period === maturity && row.closing !== normalized.residual) {
        throw new Error("Physical depreciation final residual failed: " + assetId);
      }
    });
    var last = rows[rows.length - 1];
    totals.accumulated += last.accumulated; totals.closing += last.closing;
  });

  requireDepreciationAcceptanceValue("physicalAcquisitionCost", totals.acquisition, candidate.totalAcquisitionCost);
  requireDepreciationAcceptanceValue("physicalResidualValue", totals.residual, candidate.totalResidualValue);
  requireDepreciationAcceptanceValue("physicalDepreciableBase", totals.base, candidate.totalDepreciableBase);
  requireDepreciationAcceptanceValue("physicalAccumulatedDepreciation", totals.accumulated,
    candidate.accumulatedDepreciationThroughTarget);
  requireDepreciationAcceptanceValue("physicalClosingBookValue", totals.closing, candidate.closingNetBookValue);
  requireDepreciationAcceptanceValue("physicalRemainingDepreciableAmount", totals.closing - totals.residual,
    candidate.closingNetBookValue - candidate.totalResidualValue);
  return { physicalRows: physicalRows.length, uniqueIds: Object.keys(ids).length,
    uniqueLogicalKeys: Object.keys(keys).length, reconciliationFailures: 0 };
}

function rollbackDepreciationLedger(sheet, preWriteState, runtime) {
  // ponytail: admin execution disabled; restore only with verified owner authorization.
  throw new Error("Administrative execution is disabled");

  var dataRows = sheet.getLastRow() - 1;
  if (dataRows > 0) sheet.getRange(2, 1, dataRows, DEPRECIATION_POLICY.LEDGER_HEADERS.length).clearContent();
  runtime.flush();
  var remaining = readCanonicalTable(runtime.spreadsheet, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS);
  if (remaining.length !== 0) throw new Error("Depreciation ledger rollback failed; rows=" + remaining.length);
  var restoredHeader = sheet.getRange(1, 1, 1, DEPRECIATION_POLICY.LEDGER_HEADERS.length).getValues()[0];
  if (JSON.stringify(restoredHeader) !== JSON.stringify(preWriteState[0])) {
    throw new Error("Depreciation ledger rollback failed; header changed");
  }
}

function requireEmptyDepreciationLedger(ss) {
  var sheet = ss.getSheetByName("DepreciationLedger");
  requireCanonicalHeaders(sheet, DEPRECIATION_POLICY.LEDGER_HEADERS);
  var existing = readCanonicalTable(ss, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS);
  if (existing.length !== 0) throw new Error("Depreciation ledger must be empty before backfill; rows=" + existing.length);
  return sheet;
}

function persistDepreciationBackfill(ss, assets, candidate, generatedAt, preWriteState, runtime) {
  // ponytail: admin execution disabled; restore only with verified owner authorization.
  throw new Error("Administrative execution is disabled");

  var sheet = ss.getSheetByName("DepreciationLedger");
  requireCanonicalHeaders(sheet, DEPRECIATION_POLICY.LEDGER_HEADERS);
  var values = depreciationRowsForWrite(candidate, generatedAt);
  try {
    for (var offset = 0; offset < values.length; offset += DEPRECIATION_BACKFILL_BATCH_SIZE) {
      var batch = values.slice(offset, offset + DEPRECIATION_BACKFILL_BATCH_SIZE);
      sheet.getRange(offset + 2, 1, batch.length, DEPRECIATION_POLICY.LEDGER_HEADERS.length).setValues(batch);
    }
    runtime.flush();
    var physicalRows = readCanonicalTable(ss, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS);
    var physical = assertPhysicalDepreciationLedger(assets, physicalRows, candidate);
    var rerun = buildDepreciationDryRun(assets, candidate.targetPeriod);
    if (JSON.stringify(rerun.rows) !== JSON.stringify(candidate.rows)) {
      throw new Error("Depreciation candidate idempotency validation failed");
    }
    return physical;
  } catch (error) {
    rollbackDepreciationLedger(sheet, preWriteState, runtime);
    throw new Error(error.message + " | ROLLBACK — PASS");
  }
}

function validateDepreciationDryRun() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var assets = readCanonicalTable(ss, "Assets", DEPRECIATION_POLICY.ASSET_HEADERS);
  var accounts = readCanonicalTable(ss, "Accounts", ["AccountCode", "AccountName", "AccountType",
    "StatementGroup", "CashFlowGroup", "IsActive"]);
  var ledger = readCanonicalTable(ss, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS);
  var accountMap = buildCanonicalMasterMap(accounts, "AccountCode", "Accounts");
  var missingAccounts = DEPRECIATION_POLICY.ACCOUNT_CODES.filter(function(code) { return !accountMap[code]; });
  var report = buildDepreciationDryRun(assets, DEPRECIATION_POLICY.TARGET_PERIOD);
  report.targetPeriod = DEPRECIATION_POLICY.TARGET_PERIOD;
  report.readOnly = true;
  report.depreciationLedgerRows = ledger.length;
  report.missingAccountCodes = missingAccounts;
  report.status = !report.invalidAssets.length && !report.reconciliationFailures.length &&
    !report.duplicateLogicalKeys.length && !missingAccounts.length && ledger.length === 0 ? "PASS" : "FAIL";
  Logger.log(JSON.stringify(depreciationReportSummary(report)));
  if (report.status !== "PASS") throw new Error("Depreciation dry-run validation failed");
  return report;
}

function backfillDepreciationLedgerThrough202608() {
  // ponytail: admin execution disabled; restore only with verified owner authorization.
  throw new Error("Administrative execution is disabled");

  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = requireEmptyDepreciationLedger(ss);
    var assets = readCanonicalTable(ss, "Assets", DEPRECIATION_POLICY.ASSET_HEADERS);
    var candidate = assertDepreciationBackfillCandidate(
      buildDepreciationDryRun(assets, DEPRECIATION_POLICY.TARGET_PERIOD));
    sheet = requireEmptyDepreciationLedger(ss);
    var preWriteState = sheet.getDataRange().getValues().map(function(row) { return row.slice(); });
    var runtime = { spreadsheet: ss, flush: function() { SpreadsheetApp.flush(); } };
    var physical = persistDepreciationBackfill(ss, assets, candidate, new Date(), preWriteState, runtime);
    var result = depreciationReportSummary(candidate);
    result.status = "PASS"; result.readOnly = false; result.targetPeriod = DEPRECIATION_POLICY.TARGET_PERIOD;
    result.physicalRows = physical.physicalRows; result.uniqueIds = physical.uniqueIds;
    result.uniqueLogicalKeys = physical.uniqueLogicalKeys; result.reconciliationFailures = 0;
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function depreciationContinuationLatestPeriod(ss) {
  var ledger = readCanonicalTable(ss, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS);
  if (!ledger.length) return null;
  var latest = null;
  ledger.forEach(function(row) {
    var period = depreciationPeriodKey(row.Period);
    if (period && (!latest || period > latest)) latest = period;
  });
  return latest;
}

function buildDepreciationContinuationCandidates(assets, existingLedger, targetPeriod) {
  var target = depreciationPeriodKey(targetPeriod);
  if (!target) throw new Error("Invalid target period");
  var existingKeys = Object.create(null);
  (existingLedger || []).forEach(function(row) {
    var assetId = String(row.ID_Asset || "").trim(), period = depreciationPeriodKey(row.Period);
    if (assetId && period) existingKeys[assetId + "|" + period] = true;
  });
  var lastPeriodMap = Object.create(null);
  (existingLedger || []).forEach(function(row) {
    var a = String(row.ID_Asset || "").trim(), p = depreciationPeriodKey(row.Period);
    if (!a || !p) return;
    if (!lastPeriodMap[a] || p > lastPeriodMap[a].period)
      lastPeriodMap[a] = { period: p, closing: Number(row.ClosingBookValue), accumulated: Number(row.AccumulatedDepreciation) };
  });
  var candidates = [], skipped = 0, eligible = 0;
  (assets || []).forEach(function(asset) {
    var n = validateDepreciationAsset(asset);
    if (n.errors.length || !isCanonicalActive(asset.IsActive)) return;
    if (target < n.acquisition) return;
    var last = addDepreciationMonth(n.acquisition, n.life - 1);
    var effectiveLast = n.disposal && n.disposal < last ? n.disposal : last;
    var ls = lastPeriodMap[n.id];
    var startPeriod = ls ? (ls.period >= target ? null : addDepreciationMonth(ls.period, 1)) : n.acquisition;
    if (!startPeriod) return;
    var base = n.cost - n.residual, normDep = Math.round(base / n.life);
    var opening = ls ? ls.closing : n.cost, acc = ls ? ls.accumulated : 0;
    eligible++;
    var period = startPeriod;
    while (period <= target && period <= effectiveLast) {
      var key = n.id + "|" + period;
      if (existingKeys[key]) { skipped++; period = addDepreciationMonth(period, 1); continue; }
      var rem = base - acc, dep, isFinal = addDepreciationMonth(n.acquisition, n.life - 1) === period;
      dep = isFinal || (n.disposal && n.disposal === period) ? rem : Math.min(normDep, rem);
      dep = Math.max(0, dep); acc += dep;
      var closing = opening - dep;
      candidates.push({ ID_Dep: depreciationLedgerId(n.id, period), Period: period,
        ID_Asset: n.id, OpeningBookValue: opening, Depreciation: dep,
        AccumulatedDepreciation: acc, ClosingBookValue: closing });
      opening = closing; period = addDepreciationMonth(period, 1);
    }
  });
  return { candidates: candidates, eligibleAssetCount: eligible, skippedExistingCount: skipped, targetPeriod: target };
}

function executeDepreciationContinuation(ss, targetPeriod, dryRun) {
  // ponytail: admin execution disabled; restore only with verified owner authorization.
  throw new Error("Administrative execution is disabled");

  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var assets = readCanonicalTable(ss, "Assets", DEPRECIATION_POLICY.ASSET_HEADERS);
    var existingLedger = readCanonicalTable(ss, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS);
    var latestPeriod = depreciationContinuationLatestPeriod(ss);
    var plan = buildDepreciationContinuationCandidates(assets, existingLedger, targetPeriod);
    var lk = Object.create(null), dups = [];
    plan.candidates.forEach(function(r) { var k = r.ID_Asset + "|" + r.Period; if (lk[k]) dups.push(k); lk[k] = true; });
    if (dups.length) throw new Error("Duplicate keys: " + dups.length);
    var result = { targetPeriod: plan.targetPeriod, latestExistingPeriod: latestPeriod,
      candidateCount: plan.candidates.length, eligibleAssetCount: plan.eligibleAssetCount,
      skippedExistingCount: plan.skippedExistingCount, appendCount: 0,
      beforeRowCount: existingLedger.length, afterRowCount: existingLedger.length,
      verificationState: "NOT_EXECUTED", dryRun: !!dryRun };
    if (dryRun || !plan.candidates.length) {
      result.verificationState = plan.candidates.length === 0 ? "NO_CANDIDATES" : "DRY_RUN_PASS";
      return result;
    }
    var sheet = ss.getSheetByName("DepreciationLedger");
    if (!sheet) throw new Error("DepreciationLedger missing");
    var startRow = existingLedger.length + 2;
    var values = plan.candidates.map(function(r) {
      return [r.ID_Dep, r.Period, r.ID_Asset, r.OpeningBookValue, r.Depreciation,
        r.AccumulatedDepreciation, r.ClosingBookValue, new Date()];
    });
    for (var o = 0; o < values.length; o += DEPRECIATION_BACKFILL_BATCH_SIZE) {
      sheet.getRange(startRow + o, 1, Math.min(DEPRECIATION_BACKFILL_BATCH_SIZE, values.length - o),
        DEPRECIATION_POLICY.LEDGER_HEADERS.length).setValues(values.slice(o, o + DEPRECIATION_BACKFILL_BATCH_SIZE));
    }
    SpreadsheetApp.flush();
    var after = readCanonicalTable(ss, "DepreciationLedger", DEPRECIATION_POLICY.LEDGER_HEADERS);
    result.appendCount = after.length - existingLedger.length;
    result.afterRowCount = after.length;
    result.verificationState = result.appendCount === plan.candidates.length ? "PASS" : "APPEND_MISMATCH";
    return result;
  } finally { if (acquired) lock.releaseLock(); }
}

function runDepreciationContinuation() {
  // ponytail: admin execution disabled; restore only with verified owner authorization.
  throw new Error("Administrative execution is disabled");

  var target = arguments && arguments[0] ? String(arguments[0]) : null;
  if (!target) return { status: "INVALID_TARGET" };
  return executeDepreciationContinuation(SpreadsheetApp.getActiveSpreadsheet(), target, false);
}

function runDepreciationContinuationDryRun() {
  // ponytail: admin execution disabled; restore only with verified owner authorization.
  throw new Error("Administrative execution is disabled");

  var target = arguments && arguments[0] ? String(arguments[0]) : null;
  if (!target) return { status: "INVALID_TARGET" };
  return executeDepreciationContinuation(SpreadsheetApp.getActiveSpreadsheet(), target, true);
}
