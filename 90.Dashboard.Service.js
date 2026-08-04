function getDashboardData(filter, customStart, customEnd) {

  var ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var sourceQuality =
    inspectSourceDateQuality(
      transactions
    );

  var priceMap =
    getPriceMap(ss);

  var processedData =
    processTransactions(
      transactions,
      priceMap);

  return buildDashboardResponse(
    processedData,
    filter,
    customStart,
    customEnd,
    null,
    sourceQuality
  );
}

function normalizeDashboardDateFilter(filter) {

  var normalized =
    filter == null
      ? ""
      : String(filter).trim();

  var allowed = {
    today: true,
    last7days: true,
    currentMonth: true,
    previousMonth: true,
    currentYear: true,
    custom: true
  };

  return allowed[normalized]
    ? normalized
    : "currentYear";
}

function createDashboardDateKey(year, month, day) {

  var date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return date.getUTCFullYear() +
    "-" +
    ("0" + (date.getUTCMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getUTCDate()).slice(-2);
}

function shiftDashboardDateKey(dateKey, days) {

  var parts =
    dateKey.split("-");

  return createDashboardDateKey(
    Number(parts[0]),
    Number(parts[1]),
    Number(parts[2]) + days
  );
}

function validateDashboardDateKey(value, fieldName) {

  var text =
    value == null
      ? ""
      : String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
  {
    throw new Error(
      fieldName +
      " must be a valid YYYY-MM-DD date"
    );
  }

  var parts =
    text.split("-");

  if (
    createDashboardDateKey(
      Number(parts[0]),
      Number(parts[1]),
      Number(parts[2])
    ) !== text
  )
  {
    throw new Error(
      fieldName +
      " must be a valid YYYY-MM-DD date"
    );
  }

  return text;
}

function resolveDashboardDateRange(filter, customStart, customEnd, referenceDate) {

  var normalizedFilter =
    normalizeDashboardDateFilter(filter);

  var timezone =
    Session.getScriptTimeZone();

  if (!timezone)
  {
    throw new Error(
      "Dashboard date filter requires a project timezone"
    );
  }

  var today =
    Utilities.formatDate(
      referenceDate || new Date(),
      timezone,
      "yyyy-MM-dd"
    );

  var todayParts =
    today.split("-");

  var year =
    Number(todayParts[0]);

  var month =
    Number(todayParts[1]);

  var startDate;
  var endDate;
  var label;

  if (normalizedFilter === "today")
  {
    startDate = today;
    endDate = today;
    label = "Today";
  }
  else if (normalizedFilter === "last7days")
  {
    startDate =
      shiftDashboardDateKey(
        today,
        -6
      );
    endDate = today;
    label = "Last 7 Days";
  }
  else if (normalizedFilter === "currentMonth")
  {
    startDate =
      createDashboardDateKey(
        year,
        month,
        1
      );
    endDate = today;
    label = "Current Month";
  }
  else if (normalizedFilter === "previousMonth")
  {
    endDate =
      shiftDashboardDateKey(
        createDashboardDateKey(
          year,
          month,
          1
        ),
        -1
      );

    var previousParts =
      endDate.split("-");

    startDate =
      createDashboardDateKey(
        Number(previousParts[0]),
        Number(previousParts[1]),
        1
      );
    label = "Previous Month";
  }
  else if (normalizedFilter === "custom")
  {
    startDate =
      validateDashboardDateKey(
        customStart,
        "customStart"
      );

    endDate =
      validateDashboardDateKey(
        customEnd,
        "customEnd"
      );

    if (startDate > endDate)
    {
      throw new Error(
        "customStart must not be after customEnd"
      );
    }

    label =
      "Custom: " +
      startDate +
      " to " +
      endDate;
  }
  else
  {
    startDate =
      createDashboardDateKey(
        year,
        1,
        1
      );
    endDate = today;
    label = "Current Year";
  }

  return {
    filter: normalizedFilter,
    startDate: startDate,
    endDate: endDate,
    label: label
  };
}

function filterTransactionsByDateRange(data, range) {

  var timezone =
    Session.getScriptTimeZone();

  return (data || []).filter(function(row)
  {
    var date =
      new Date(row && row.date);

    if (isNaN(date.getTime()))
    {
      return false;
    }

    var dateKey;

    try
    {
      dateKey =
        Utilities.formatDate(
          date,
          timezone,
          "yyyy-MM-dd"
        );
    }
    catch (error)
    {
      return false;
    }

    return dateKey >= range.startDate &&
      dateKey <= range.endDate;
  });
}

function buildReportingMetadata(scopedData, dateRange, referenceDate) {

  var timezone =
    Session.getScriptTimeZone();

  if (!timezone)
  {
    throw new Error(
      "Reporting metadata requires a project timezone"
    );
  }

  var generatedDate =
    new Date(referenceDate || new Date());

  var today =
    Utilities.formatDate(
      generatedDate,
      timezone,
      "yyyy-MM-dd"
    );

  var rows =
    scopedData || [];

  var salesCount = 0;
  var purchaseCount = 0;
  var firstTransactionDate = null;
  var lastTransactionDate = null;
  var latestTimestamp = null;

  rows.forEach(function(row)
  {
    if (row && row.transactionType === "Sales")
    {
      salesCount++;
    }

    if (row && row.transactionType === "Purchase")
    {
      purchaseCount++;
    }

    var transactionDate =
      new Date(row && row.date);

    if (isNaN(transactionDate.getTime()))
    {
      return;
    }

    var dateKey;

    try
    {
      dateKey =
        Utilities.formatDate(
          transactionDate,
          timezone,
          "yyyy-MM-dd"
        );
    }
    catch (error)
    {
      return;
    }

    if (
      firstTransactionDate === null ||
      dateKey < firstTransactionDate
    )
    {
      firstTransactionDate = dateKey;
    }

    if (
      lastTransactionDate === null ||
      dateKey > lastTransactionDate
    )
    {
      lastTransactionDate = dateKey;
    }

    if (
      latestTimestamp === null ||
      transactionDate.getTime() > latestTimestamp.getTime()
    )
    {
      latestTimestamp = transactionDate;
    }
  });

  var filter =
    dateRange.filter;

  var todayParts =
    today.split("-");

  var year =
    Number(todayParts[0]);

  var month =
    Number(todayParts[1]);

  var monthEnd =
    shiftDashboardDateKey(
      createDashboardDateKey(
        year,
        month + 1,
        1
      ),
      -1
    );

  var isPartialPeriod = false;

  if (filter === "currentMonth")
  {
    isPartialPeriod =
      today !== monthEnd;
  }
  else if (filter === "currentYear")
  {
    isPartialPeriod =
      today !== createDashboardDateKey(year, 12, 31);
  }

  var status = "Stale";

  if (rows.length === 0)
  {
    status = "No Data";
  }
  else if (lastTransactionDate === today)
  {
    status = "Current";
  }

  return {
    reportingScope: {
      rowCount: rows.length,
      transactionCount: rows.length,
      salesCount: salesCount,
      purchaseCount: purchaseCount,
      firstTransactionDate: firstTransactionDate,
      lastTransactionDate: lastTransactionDate,
      isPartialPeriod: isPartialPeriod
    },
    dataFreshness: {
      lastTransactionAt:
        latestTimestamp
          ? latestTimestamp.toISOString()
          : null,
      generatedAt:
        generatedDate.toISOString(),
      timezone: timezone,
      status: status
    }
  };
}

function buildDataQualityDiagnostics(scopedData, sourceQuality) {

  var definitions = [
    {
      code: "INVALID_DATE",
      label: "Invalid transaction date",
      severity: "High"
    },
    {
      code: "UNKNOWN_TRANSACTION_TYPE",
      label: "Unknown transaction type",
      severity: "High"
    },
    {
      code: "MISSING_SALES_PRODUCT",
      label: "Missing Sales product",
      severity: "Medium"
    },
    {
      code: "MISSING_PURCHASE_CATEGORY",
      label: "Missing Purchase category",
      severity: "Medium"
    },
    {
      code: "INVALID_QUANTITY",
      label: "Invalid Sales quantity",
      severity: "Medium"
    },
    {
      code: "INVALID_PURCHASE_AMOUNT",
      label: "Invalid Purchase amount",
      severity: "Medium"
    }
  ];

  var rows =
    scopedData || [];

  var sourceInspection =
    sourceQuality || null;

  var invalidDateRowIndexes =
    sourceInspection &&
    Array.isArray(sourceInspection.invalidDateRowIndexes)
      ? sourceInspection.invalidDateRowIndexes
      : [];

  var counts = {};
  var issueRowKeys = {};
  var scopedIssueRows = 0;
  var issueCount = 0;
  var hasHighSeverityIssue = false;

  definitions.forEach(function(definition)
  {
    counts[definition.code] = 0;
  });

  rows.forEach(function(row, rowIndex)
  {
    var rowIssues = [];
    var value = row || {};
    var transactionDate =
      new Date(value.date);

    if (
      !sourceInspection &&
      (
        value.date == null ||
        value.date === "" ||
        isNaN(transactionDate.getTime())
      )
    )
    {
      rowIssues.push("INVALID_DATE");
    }

    if (
      value.transactionType !== "Sales" &&
      value.transactionType !== "Purchase"
    )
    {
      rowIssues.push("UNKNOWN_TRANSACTION_TYPE");
    }

    if (value.transactionType === "Sales")
    {
      if (String(value.product || "").trim() === "")
      {
        rowIssues.push("MISSING_SALES_PRODUCT");
      }

      var quantitySource =
        value.dataQualitySource
          ? value.dataQualitySource.quantity
          : value.qty;

      var quantity =
        Number(quantitySource);

      if (!isFinite(quantity) || quantity < 0)
      {
        rowIssues.push("INVALID_QUANTITY");
      }
    }

    if (value.transactionType === "Purchase")
    {
      if (String(value.purchaseCategory || "").trim() === "")
      {
        rowIssues.push("MISSING_PURCHASE_CATEGORY");
      }

      var purchaseAmountSource =
        value.dataQualitySource
          ? value.dataQualitySource.purchaseAmount
          : value.expense;

      if (!isFinite(Number(purchaseAmountSource)))
      {
        rowIssues.push("INVALID_PURCHASE_AMOUNT");
      }
    }

    if (rowIssues.length)
    {
      scopedIssueRows++;

      var scopedRowKey =
        value.sourceRowIndex != null
          ? "source:" + value.sourceRowIndex
          : "scoped:" + rowIndex;

      issueRowKeys[scopedRowKey] = true;
    }

    rowIssues.forEach(function(code)
    {
      counts[code]++;
      issueCount++;
    });
  });

  invalidDateRowIndexes.forEach(function(sourceRowIndex)
  {
    counts.INVALID_DATE++;
    issueCount++;
    issueRowKeys["source:" + sourceRowIndex] = true;
  });

  var issues =
    definitions
      .filter(function(definition)
      {
        return counts[definition.code] > 0;
      })
      .map(function(definition)
      {
        if (definition.severity === "High")
        {
          hasHighSeverityIssue = true;
        }

        return {
          code: definition.code,
          label: definition.label,
          count: counts[definition.code],
          severity: definition.severity
        };
      });

  return {
    totalRows: rows.length,
    validRows:
      Math.max(
        rows.length - scopedIssueRows,
        0
      ),
    issueRows:
      Object.keys(issueRowKeys).length,
    issueCount: issueCount,
    status:
      issueCount === 0
        ? "Good"
        : hasHighSeverityIssue
          ? "Critical"
          : "Attention",
    issues: issues,
    scope: {
      sourceRows:
        sourceInspection
          ? sourceInspection.sourceRows
          : rows.length,
      scopedRows: rows.length,
      excludedInvalidDateRows:
        invalidDateRowIndexes.length
    }
  };
}

function buildDashboardResponse(processedData, filter, customStart, customEnd, referenceDate, sourceQuality) {

  var generatedDate =
    referenceDate
      ? new Date(referenceDate)
      : new Date();

  var dateRange =
    resolveDashboardDateRange(
      filter,
      customStart,
      customEnd,
      generatedDate
    );

  var filteredData =
    filterTransactionsByDateRange(
      processedData,
      dateRange
    );

  dateRange.rowCount =
    filteredData.length;

  var reportingMetadata =
    buildReportingMetadata(
      filteredData,
      dateRange,
      generatedDate
    );

  var dataQuality =
    buildDataQualityDiagnostics(
      filteredData,
      sourceQuality
    );

  var cache =
  buildAnalyticsCache(
    filteredData
  );

    return {
      summary:
        cache.summary,

      financial:
        cache.financial,

      insights:
        cache.insights,

      revenueTrend:
        cache.revenueTrend,

      hotColdSplit:
        cache.hotColdSplit,

      topProducts:
        cache.topProducts,

      expenseBreakdown:
        cache.expenseBreakdown,

      recentTransactions:
        buildRecentTransactions(filteredData),

      diagnosis:
        buildDiagnosis(filteredData, cache),

      forecast:
        cache.forecast,
      
      businessScore:
        cache.businessScore,

      revenueIntelligence:
        cache.revenueIntelligence,

      expenseIntelligence:
        cache.expenseIntelligence,

      profitIntelligence:
        cache.profitIntelligence,

      profitTrend:
        cache.profitTrend,

      executiveSummary:
        cache.executiveSummary,

      priorityAction:
        cache.priorityAction,

      riskEngine:
        cache.riskEngine,

      growthScore:
        cache.growthScore,

      recommendations:
        buildRecommendationEngine(cache),

      opportunities:
        buildOpportunityEngine(cache),

      kpiStatus:
        cache.kpiStatus,

      productContribution:
        cache.productContribution,

      revenueConcentration:
        cache.revenueConcentration,

      paretoAnalysis:
        cache.paretoAnalysis,

      businessFocus:
        cache.businessFocus,

      executiveAlert:
        cache.executiveAlert,
      
      actionRoadmap:
        cache.actionRoadmap,

      businessMaturity:
        cache.businessMaturity,

      kpiAchievement:
        cache.kpiAchievement,

      dateFilter:
        dateRange,

      reportingScope:
        reportingMetadata.reportingScope,

      dataFreshness:
        reportingMetadata.dataFreshness,

      dataQuality:
        dataQuality,

    };
}

function buildRecentTransactions(data) {

  var recent =
    data.slice(-10);

  recent.reverse();

  return recent.map(function(row){

    return {

      date:
          Utilities.formatDate(
            new Date(row.date),
            Session.getScriptTimeZone(),
            "yyyy-MM-dd"
          ),

      transactionType:
        row.transactionType,

      product:
        row.product,

      purchaseCategory:
        row.purchaseCategory,

      qty:
        row.qty,

      revenue:
        row.revenue,

      expense:
        row.expense

    };

  });

}

function buildAnalyticsCache(data) {

  var cache = {

    aggregate:
      buildAggregate(data),

    financial:
      buildFinancial(data)

  };

  cache.summary =
    buildSummaryFromAggregate(
      cache.aggregate
    );

  cache.expenseBreakdown =
    buildExpenseBreakdownFromAggregate(
      cache.aggregate
    );

  cache.insights =
    buildInsights(cache);

  cache.revenueTrend =
    buildRevenueTrendFromAggregate(
      cache.aggregate
    );

  cache.topProducts =
    buildTopProductsFromAggregate(
      cache.aggregate
    );

  cache.profitTrend =
    buildProfitTrendFromAggregate(
      cache.aggregate
    );

  cache.hotColdSplit =
    buildHotColdSplitFromAggregate(
      cache.aggregate
    );

  cache.trend =
    buildTrendEngine(cache);

  cache.forecast =
    buildForecast(cache);

  cache.productContribution =
    buildProductContribution(cache);

  cache.revenueConcentration =
    buildRevenueConcentration(cache);

  cache.paretoAnalysis =
    buildParetoAnalysis(cache);

  cache.revenueIntelligence =
    buildRevenueIntelligence(cache);

  cache.expenseIntelligence =
    buildExpenseIntelligence(cache);

  cache.profitIntelligence =
    buildProfitIntelligence(cache);

  cache.businessScore =
    buildBusinessScore(cache);  
  
  cache.executiveSummary =
    buildExecutiveSummary(cache);

  cache.priorityAction =
    buildPriorityAction(cache);

  cache.riskEngine =
    buildRiskEngine(cache);

  cache.growthScore =
    buildGrowthScore(cache);

  cache.businessFocus =
    buildBusinessFocus(cache);

  cache.executiveAlert =
    buildExecutiveAlert(cache);

  cache.kpiAchievement =
    buildKpiAchievement(cache);

  cache.kpiStatus =
    buildKPIStatus(cache);

  cache.actionRoadmap =
    buildActionRoadmap(cache);

  cache.businessMaturity =
    buildBusinessMaturity(cache);

  return cache;

}
