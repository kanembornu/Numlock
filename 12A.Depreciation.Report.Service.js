function getDepreciationDataWithRuntime(runtime, filter, customStart, customEnd) {
  var ss = runtime.spreadsheet;
  var period = resolveDashboardDateRange(filter, customStart, customEnd);
  var asOfDate = period.endDate;

  var assets = readCanonicalTable(ss, "Assets", DEPRECIATION_POLICY.ASSET_HEADERS);
  var accounts = readCanonicalTable(ss, "Accounts", [
    "AccountCode", "AccountName", "AccountType", "StatementGroup", "CashFlowGroup", "IsActive"
  ]);

  var dryRunReport = buildDepreciationDryRun(assets, DEPRECIATION_POLICY.TARGET_PERIOD);
  var fixedAssetPosition = buildPartialBalanceFixedAssetPosition(dryRunReport.rows, asOfDate);

  var depreciationSource = buildFinanceDepreciationSource(dryRunReport.rows, assets);
  var scopedDepreciation = scopeFinanceDepreciation(depreciationSource, period);

  var accountMap = buildCanonicalMasterMap(accounts, "AccountCode", "Accounts");
  var missingAccountCodes = DEPRECIATION_POLICY.ACCOUNT_CODES.filter(function(code) {
    return !accountMap[code];
  });

  var assetResult = buildAssetRows(assets, dryRunReport.rows, fixedAssetPosition, period);
  var reconciliation = buildDepreciationReconciliation(fixedAssetPosition, scopedDepreciation, assetResult);
  var quality = buildDepreciationQuality(dryRunReport, missingAccountCodes, depreciationSource);
  var policy = buildDepreciationPolicy();

  var hasApplicableAssets = fixedAssetPosition.assetCount > 0;

  return {
    status: hasApplicableAssets ? "AVAILABLE" : "EMPTY",
    error: null,
    period: { filter: period.filter, startDate: period.startDate, endDate: period.endDate, label: period.label },
    asOfDate: asOfDate,
    summary: {
      assetCount: dryRunReport.assetCount,
      activeAssetCount: assetResult.activeCount,
      fullyDepreciatedAssetCount: dryRunReport.fullyDepreciatedAssetCount,
      disposedAssetCount: assetResult.disposedCount,
      acquisitionCost: dryRunReport.totalAcquisitionCost,
      residualValue: dryRunReport.totalResidualValue,
      depreciableBase: dryRunReport.totalDepreciableBase,
      periodDepreciation: scopedDepreciation.depreciationExpense,
      accumulatedDepreciation: dryRunReport.accumulatedDepreciationThroughTarget,
      netBookValue: dryRunReport.closingNetBookValue,
      remainingDepreciableAmount: dryRunReport.closingNetBookValue - dryRunReport.totalResidualValue
    },
    assets: assetResult.rows,
    reconciliation: reconciliation,
    quality: quality,
    policy: policy
  };
}

function getDepreciationData(filter, customStart, customEnd) {
  return getDepreciationDataWithRuntime({
    spreadsheet: requireNumlockProductionSpreadsheet()
  }, filter, customStart, customEnd);
}

function buildAssetRows(assets, scheduleRows, fixedAssetPosition, period) {
  var periodStart = period.startDate;
  var periodEnd = period.endDate;
  var asOfDate = period.endDate;
  var assetPeriodDepreciation = {};

  scheduleRows.forEach(function(row) {
    var id = String(row.ID_Asset || "").trim();
    var parts = row.Period.split("-");
    var year = Number(parts[0]), month = Number(parts[1]);
    var monthEnd = financeDateKey(year, month, new Date(year, month, 0).getDate());
    if (row.Period <= periodEnd && monthEnd >= periodStart) {
      if (!assetPeriodDepreciation[id]) assetPeriodDepreciation[id] = 0;
      assetPeriodDepreciation[id] += row.Depreciation;
    }
  });

  var rows = [];
  var activeCount = 0, disposedCount = 0;
  var seen = {};
  (assets || []).forEach(function(asset) {
    var id = String(asset && asset.ID_Asset || "").trim();
    if (!id || seen[id]) return;
    seen[id] = true;

    var normalized = validateDepreciationAsset(asset);
    var position = (fixedAssetPosition.positions || {})[id] || null;
    var nbv = position ? position.netBookValue : normalized.cost;
    var life = normalized.life || 0;
    var elapsed = computeElapsedLifeMonths(normalized.acquisition, periodEnd, life);

    if (!normalized.errors.length) {
      if (normalized.disposal) disposedCount++; else activeCount++;
    }

    rows.push({
      id: id,
      name: String(asset && asset.Nama || "").trim(),
      category: String(asset && asset.Kategori || "").trim(),
      acquisitionDate: normalized.acquisition,
      cost: normalized.cost,
      residualValue: normalized.residual,
      usefulLife: life,
      method: String(asset && asset.DepreciationMethod || "").trim(),
      disposedAt: normalized.disposal,
      accumulatedDepreciation: position ? position.accumulatedDepreciation : 0,
      netBookValue: nbv,
      periodDepreciation: assetPeriodDepreciation[id] || 0,
      depreciableBase: normalized.cost - normalized.residual,
      elapsedLifeMonths: elapsed,
      remainingLifeMonths: Math.max(life - elapsed, 0),
      fullyDepreciated: nbv === normalized.residual,
      latestDepreciationPeriod: position ? position.latestPeriod : null
    });
  });

  return { rows: rows, activeCount: activeCount, disposedCount: disposedCount };
}

function computeElapsedLifeMonths(acquisitionPeriod, asOfDate, usefulLife) {
  if (!acquisitionPeriod || !asOfDate) return 0;
  var acq = acquisitionPeriod.split("-");
  var asOf = asOfDate.split("-");
  var months = (Number(asOf[0]) - Number(acq[0])) * 12 + (Number(asOf[1]) - Number(acq[1])) + 1;
  return Math.min(Math.max(months, 0), usefulLife);
}

function buildDepreciationReconciliation(fixedAssetPosition, scopedDepreciation, assetResult) {
  var periodDepreciation = scopedDepreciation.depreciationExpense;
  var assetPeriodTotal = (assetResult.rows || []).reduce(function(sum, row) {
    return sum + (row.periodDepreciation || 0);
  }, 0);
  var nbvFromFormula = fixedAssetPosition.totalGrossCost - fixedAssetPosition.totalAccumulatedDepreciation;
  var accumExpected = fixedAssetPosition.totalGrossCost - fixedAssetPosition.totalNBV;
  var periodDiff = assetPeriodTotal - periodDepreciation;
  var accumDiff = fixedAssetPosition.totalAccumulatedDepreciation - accumExpected;
  var nbvDiff = fixedAssetPosition.totalNBV - nbvFromFormula;

  function reconStatus(refValue, diff) {
    if (refValue == null) return "UNAVAILABLE";
    return diff === 0 ? "RECONCILED" : "DIFFERENCE";
  }

  return {
    periodDepreciation: {
      status: reconStatus(periodDepreciation, periodDiff),
      reportValue: assetPeriodTotal,
      referenceValue: periodDepreciation,
      difference: periodDiff
    },
    accumulatedDepreciation: {
      status: reconStatus(accumExpected, accumDiff),
      reportValue: fixedAssetPosition.totalAccumulatedDepreciation,
      referenceValue: accumExpected,
      difference: accumDiff
    },
    netBookValue: {
      status: reconStatus(nbvFromFormula, nbvDiff),
      reportValue: fixedAssetPosition.totalNBV,
      referenceValue: nbvFromFormula,
      difference: nbvDiff
    }
  };
}

function buildDepreciationQuality(dryRunReport, missingAccountCodes, depreciationSource) {
  var issues = [];

  (dryRunReport.invalidAssets || []).forEach(function(asset) {
    (asset.errors || []).forEach(function(errorCode) {
      issues.push({
        code: errorCode,
        severity: "ERROR",
        domain: "ASSET",
        assetId: asset.id || null,
        ledgerId: null
      });
    });
  });

  (dryRunReport.reconciliationFailures || []).forEach(function(failure) {
    issues.push({
      code: "RECONCILIATION_FAILURE",
      severity: "ERROR",
      domain: "ASSET",
      assetId: failure.assetId || null,
      ledgerId: null
    });
  });

  (dryRunReport.duplicateLogicalKeys || []).forEach(function(entry) {
    issues.push({
      code: "DUPLICATE_LOGICAL_KEY",
      severity: "WARNING",
      domain: "ASSET",
      assetId: entry.assetId || null,
      ledgerId: null
    });
  });

  (missingAccountCodes || []).forEach(function(code) {
    issues.push({
      code: "MISSING_ACCOUNT_CODE",
      severity: "WARNING",
      domain: "ACCOUNT",
      assetId: null,
      ledgerId: null
    });
  });

  var scopeQuality = depreciationSource.quality || {};

  (scopeQuality.duplicateLogicalKeys || []).forEach(function(entry) {
    issues.push({
      code: "LEDGER_DUPLICATE_LOGICAL_KEY",
      severity: "WARNING",
      domain: "LEDGER",
      assetId: null,
      ledgerId: entry.ledgerId || null
    });
  });

  (scopeQuality.invalidDepreciationRows || []).forEach(function(entry) {
    issues.push({
      code: "LEDGER_INVALID_DEPRECIATION_ROW",
      severity: "ERROR",
      domain: "LEDGER",
      assetId: null,
      ledgerId: entry.ledgerId || null
    });
  });

  (scopeQuality.invalidPeriodRows || []).forEach(function(entry) {
    issues.push({
      code: "LEDGER_INVALID_PERIOD_ROW",
      severity: "ERROR",
      domain: "LEDGER",
      assetId: null,
      ledgerId: entry.ledgerId || null
    });
  });

  (scopeQuality.unresolvedAssetReferences || []).forEach(function(entry) {
    issues.push({
      code: "LEDGER_UNRESOLVED_ASSET_REFERENCE",
      severity: "WARNING",
      domain: "LEDGER",
      assetId: entry.assetId || null,
      ledgerId: entry.ledgerId || null
    });
  });

  return {
    status: issues.length === 0 ? "GOOD" : "ATTENTION",
    issueCount: issues.length,
    issues: issues
  };
}

function buildDepreciationPolicy() {
  return {
    method: "STRAIGHT_LINE",
    granularity: "MONTHLY",
    rounding: "INTEGER_RUPIAH_FINAL_TRUE_UP",
    startRule: "ACQUISITION_MONTH",
    residualTreatment: "PRESERVE_RESIDUAL_FLOOR",
    source: "DEPRECIATION_LEDGER"
  };
}
