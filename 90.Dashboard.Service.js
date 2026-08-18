var DASHBOARD_CACHE = Object.freeze({
  REVISION_PROPERTY: "NUMLOCK_DASHBOARD_CACHE_REVISION",
  TTL_SECONDS: 300
});

function getDashboardCacheRevision() {
  return String(PropertiesService.getScriptProperties().getProperty(DASHBOARD_CACHE.REVISION_PROPERTY) || "0");
}

function invalidateDashboardCache() {
  var properties = PropertiesService.getScriptProperties();
  var revision = Number(properties.getProperty(DASHBOARD_CACHE.REVISION_PROPERTY) || 0) + 1;
  properties.setProperty(DASHBOARD_CACHE.REVISION_PROPERTY, String(revision));
  return revision;
}

function buildDashboardCacheKey(filter, customStart, customEnd, revision) {
  return ["dashboard-v1", revision, normalizeDashboardDateFilter(filter),
    String(customStart || ""), String(customEnd || "")].join("|");
}

function getDashboardData(filter, customStart, customEnd) {
  var execution = buildDashboardDataExecution(
    filter,
    customStart,
    customEnd
  );
  execution.response.dashboardPerformance = execution.performance;
  return execution.response;
}

function buildOptionalPerformanceAnalytics(aggregate, performance) {
  var startedAt = Date.now();
  try {
    return buildPerformanceAnalyticsFromAggregate(aggregate);
  } catch (error) {
    Logger.log("PerformanceProjectionError " + String(error && error.message || error));
    return {
      available: false,
      errorCode: "PERFORMANCE_PROJECTION_FAILED",
      productProfitability: [],
      totalGrossMargin: 0,
      classifications: { category: [], kind: [] },
      hotColdEconomics: [],
      expenseGroups: [],
      expenseGrouping: "Group"
    };
  } finally {
    if (performance) performance.performanceAnalyticsMs = Date.now() - startedAt;
  }
}

function buildGrossMarginComparison(currentPerformanceAnalytics, previousData) {
  var currentGrossMargin =
    Number(
      currentPerformanceAnalytics &&
      currentPerformanceAnalytics.totalGrossMargin != null
        ? currentPerformanceAnalytics.totalGrossMargin
        : 0
    );

  var previousPerformanceAnalytics =
    buildPerformanceAnalyticsFromAggregate(
      buildAggregate(previousData || [])
    );

  var previousGrossMargin =
    Number(
      previousPerformanceAnalytics &&
      previousPerformanceAnalytics.totalGrossMargin != null
        ? previousPerformanceAnalytics.totalGrossMargin
        : 0
    );

  var comparison =
    calculateFiniteComparison(
      currentGrossMargin,
      previousGrossMargin,
      true
    );

  return {
    currentGrossMargin: currentGrossMargin,
    previousGrossMargin: previousGrossMargin,
    grossMarginChangePercent: comparison.percentage,
    status: comparison.status
  };
}

function diagnoseDashboardPerformance(filter, customStart, customEnd) {

  return buildDashboardDataExecution(
    filter,
    customStart,
    customEnd
  ).performance;
}

function buildDashboardDataExecution(filter, customStart, customEnd) {

  var performance = {
    acquisitionMs: 0,
    salesReadMs: 0,
    expenseReadMs: 0,
    productReadMs: 0,
    expenseItemReadMs: 0,
    normalizeMs: 0,
    aggregateMs: 0,
    summaryMs: 0,
    revenueTrendMs: 0,
    topProductsMs: 0,
    expenseBreakdownMs: 0,
    performanceAnalyticsMs: 0,
    qualityMs: 0,
    recentTransactionsMs: 0,
    responseAssemblyMs: 0,
    comparisonMs: 0,
    lifecycleMs: 0,
    serializationMs: 0,
    cacheLookupMs: 0,
    cacheWriteMs: 0,
    cacheHit: false,
    totalMs: 0
  };
  var totalStartedAt = Date.now();
  var cacheStartedAt = Date.now();
  var revision = getDashboardCacheRevision();
  var cacheKey = buildDashboardCacheKey(filter, customStart, customEnd, revision);
  var dashboardCache = CacheService.getScriptCache();
  var cachedPayload = dashboardCache.get(cacheKey);
  performance.cacheLookupMs = Date.now() - cacheStartedAt;
  if (cachedPayload) {
    performance.cacheHit = true;
    var cachedResponse = JSON.parse(cachedPayload);
    performance.totalMs = Date.now() - totalStartedAt;
    Logger.log("DashboardPerf " + JSON.stringify(performance));
    return { response: cachedResponse, performance: performance };
  }
  var acquisitionStartedAt = Date.now();

  var ss =
    SpreadsheetApp
      .getActiveSpreadsheet();
  performance.acquisitionMs = Date.now() - acquisitionStartedAt;

  var canonicalData = getCanonicalTransactionData(ss, performance);
  var processedData = canonicalData.records;
  var sourceQuality = canonicalData.sourceQuality;

  var response = buildDashboardResponse(
    processedData,
    filter,
    customStart,
    customEnd,
    null,
    sourceQuality,
    performance
  );
  var lifecycleStartedAt = Date.now();
  response.recentLifecycleTransactions = buildRecentLifecycleTransactions(
    filterTransactionsByDateRange(canonicalData.lifecycleRecords || processedData, response.dateFilter)
  );
  performance.recentTransactionsMs += Date.now() - lifecycleStartedAt;
  performance.lifecycleMs = Date.now() - lifecycleStartedAt;
  var serializationStartedAt = Date.now();
  var serializedResponse = JSON.stringify(response);
  performance.serializationMs = Date.now() - serializationStartedAt;
  var cacheWriteStartedAt = Date.now();
  try {
    dashboardCache.put(cacheKey, serializedResponse, DASHBOARD_CACHE.TTL_SECONDS);
  } catch (cacheError) {
    Logger.log("Dashboard cache skipped: " + String(cacheError && cacheError.message || cacheError));
  }
  performance.cacheWriteMs = Date.now() - cacheWriteStartedAt;
  performance.totalMs = Date.now() - totalStartedAt;
  Logger.log("DashboardPerf " + JSON.stringify(performance));
  return { response: response, performance: performance };
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
    previousYear: true,
    customMonth: true,
    customYear: true,
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
  else if (normalizedFilter === "previousYear")
  {
    startDate = createDashboardDateKey(year - 1, 1, 1);
    endDate = createDashboardDateKey(year - 1, 12, 31);
    label = "Previous Year";
  }
  else if (normalizedFilter === "customMonth")
  {
    var customMonthValue = String(customStart || "").trim();

    if (!/^\d{4}-\d{2}$/.test(customMonthValue))
    {
      throw new Error("customStart must be a valid YYYY-MM month");
    }

    var customMonthParts = customMonthValue.split("-");
    var customMonthYear = Number(customMonthParts[0]);
    var customMonthNumber = Number(customMonthParts[1]);

    if (customMonthNumber < 1 || customMonthNumber > 12)
    {
      throw new Error("customStart must be a valid YYYY-MM month");
    }

    startDate = createDashboardDateKey(customMonthYear, customMonthNumber, 1);
    endDate = getDashboardMonthEndDateKey(customMonthYear, customMonthNumber);
    label = "Custom Month";
  }
  else if (normalizedFilter === "customYear")
  {
    var customYearValue = String(customStart || "").trim();

    if (!/^\d{4}$/.test(customYearValue))
    {
      throw new Error("customStart must be a valid YYYY year");
    }

    var customYearNumber = Number(customYearValue);
    startDate = createDashboardDateKey(customYearNumber, 1, 1);
    endDate = createDashboardDateKey(customYearNumber, 12, 31);
    label = "Custom Year";
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
  return (data || []).filter(function(row)
  {
    var dateKey = row && row.dateKey;
    if (!dateKey) {
      var date = new Date(row && row.date);
      if (isNaN(date.getTime())) return false;
      dateKey = canonicalDateKey(date);
    }

    return dateKey >= range.startDate &&
      dateKey <= range.endDate;
  });
}

function getDashboardMonthEndDateKey(year, month) {

  return shiftDashboardDateKey(
    createDashboardDateKey(
      year,
      month + 1,
      1
    ),
    -1
  );
}

function createCappedDashboardDateKey(year, month, day) {

  var monthEnd =
    getDashboardMonthEndDateKey(
      year,
      month
    );

  var maximumDay =
    Number(
      monthEnd.split("-")[2]
    );

  return createDashboardDateKey(
    year,
    month,
    Math.min(day, maximumDay)
  );
}

function getDashboardDateRangeDuration(range) {

  var startParts =
    range.startDate.split("-");

  var endParts =
    range.endDate.split("-");

  var startTime =
    Date.UTC(
      Number(startParts[0]),
      Number(startParts[1]) - 1,
      Number(startParts[2])
    );

  var endTime =
    Date.UTC(
      Number(endParts[0]),
      Number(endParts[1]) - 1,
      Number(endParts[2])
    );

  return Math.floor(
    (endTime - startTime) /
    86400000
  ) + 1;
}

function resolvePreviousComparisonDateRange(currentRange) {

  var filter =
    currentRange.filter;

  var startParts =
    currentRange.startDate.split("-");

  var endParts =
    currentRange.endDate.split("-");

  var startYear =
    Number(startParts[0]);

  var startMonth =
    Number(startParts[1]);

  var endYear =
    Number(endParts[0]);

  var endMonth =
    Number(endParts[1]);

  var endDay =
    Number(endParts[2]);

  var previousStart;
  var previousEnd;

  if (filter === "currentMonth")
  {
    previousStart =
      createDashboardDateKey(
        startYear,
        startMonth - 1,
        1
      );

    previousEnd =
      createCappedDashboardDateKey(
        startYear,
        startMonth - 1,
        endDay
      );
  }
  else if (
    filter === "previousMonth" ||
    filter === "customMonth"
  )
  {
    previousEnd =
      shiftDashboardDateKey(
        currentRange.startDate,
        -1
      );

    var priorMonthParts =
      previousEnd.split("-");

    previousStart =
      createDashboardDateKey(
        Number(priorMonthParts[0]),
        Number(priorMonthParts[1]),
        1
      );
  }
  else if (
    filter === "currentYear" ||
    filter === "previousYear" ||
    filter === "customYear"
  )
  {
    previousStart =
      createDashboardDateKey(
        startYear - 1,
        1,
        1
      );

    previousEnd =
      createCappedDashboardDateKey(
        endYear - 1,
        endMonth,
        endDay
      );
  }
  else
  {
    var duration =
      getDashboardDateRangeDuration(
        currentRange
      );

    previousEnd =
      shiftDashboardDateKey(
        currentRange.startDate,
        -1
      );

    previousStart =
      shiftDashboardDateKey(
        previousEnd,
        -(duration - 1)
      );
  }

  return {
    startDate: previousStart,
    endDate: previousEnd,
    label:
      "Compared with " +
      previousStart +
      " to " +
      previousEnd
  };
}

function filterTransactionsByComparisonRange(data, range) {

  return filterTransactionsByDateRange(
    data,
    range
  );
}

function buildPeriodComparisonMetrics(data, range) {

  var metrics = {
    startDate: range.startDate,
    endDate: range.endDate,
    rowCount: 0,
    revenue: 0,
    expense: 0,
    profit: 0,
    unitsSold: 0
  };

  (data || []).forEach(function(row)
  {
    var revenue =
      Number(row && row.revenue || 0);

    var expense =
      Number(row && row.expense || 0);

    var quantity =
      Number(row && row.qty || 0);

    metrics.rowCount++;
    metrics.revenue +=
      isFinite(revenue)
        ? revenue
        : 0;
    metrics.expense +=
      isFinite(expense)
        ? expense
        : 0;

    if (row && row.transactionType === "Sales")
    {
      metrics.unitsSold +=
        isFinite(quantity)
          ? quantity
          : 0;
    }
  });

  metrics.profit =
    metrics.revenue -
    metrics.expense;

  metrics.profitMargin =
    metrics.revenue > 0
      ? Number(((metrics.profit / metrics.revenue) * 100).toFixed(1))
      : 0;

  return metrics;
}

function calculateFiniteComparison(currentValue, previousValue, isProfit) {

  var current =
    Number(currentValue);

  var previous =
    Number(previousValue);

  if (!isFinite(current) || !isFinite(previous))
  {
    return {
      percentage: null,
      status: "No Comparison"
    };
  }

  if (previous === 0)
  {
    return current === 0
      ? {
          percentage: 0,
          status: "Stable"
        }
      : {
          percentage: null,
          status: "No Comparison"
        };
  }

  if (!isProfit && previous < 0)
  {
    return {
      percentage: null,
      status: "No Comparison"
    };
  }

  var denominator =
    isProfit
      ? Math.abs(previous)
      : previous;

  var percentage =
    ((current - previous) /
      denominator) * 100;

  if (!isFinite(percentage))
  {
    return {
      percentage: null,
      status: "No Comparison"
    };
  }

  return {
    percentage:
      Number(
        percentage.toFixed(1)
      ),
    status:
      current > previous
        ? "Up"
        : current < previous
          ? "Down"
          : "Stable"
  };
}

function buildPeriodComparison(currentRows, previousRows, currentRange, previousRange) {

  var current =
    buildPeriodComparisonMetrics(
      currentRows,
      currentRange
    );

  var previous =
    buildPeriodComparisonMetrics(
      previousRows,
      previousRange
    );

  var revenue =
    calculateFiniteComparison(
      current.revenue,
      previous.revenue,
      false
    );

  var expense =
    calculateFiniteComparison(
      current.expense,
      previous.expense,
      false
    );

  var profit =
    calculateFiniteComparison(
      current.profit,
      previous.profit,
      true
    );

  var unitsSold =
    calculateFiniteComparison(
      current.unitsSold,
      previous.unitsSold,
      false
    );

  if (current.rowCount === 0)
  {
    revenue = { percentage: null, status: "No Comparison" };
    expense = { percentage: null, status: "No Comparison" };
    profit = { percentage: null, status: "No Comparison" };
    unitsSold = { percentage: null, status: "No Comparison" };
  }

  var profitMarginPoints =
    current.rowCount > 0 && previous.rowCount > 0
      ? Number((current.profitMargin - previous.profitMargin).toFixed(1))
      : null;

  return {
    current: current,
    previous: previous,
    changes: {
      revenuePercent: revenue.percentage,
      expensePercent: expense.percentage,
      profitPercent: profit.percentage,
      profitMarginPoints: profitMarginPoints,
      unitsSoldPercent: unitsSold.percentage
    },
    status: {
      revenue: revenue.status,
      expense: expense.status,
      profit: profit.status,
      profitMargin:
        profitMarginPoints === null
          ? "No Comparison"
          : profitMarginPoints > 0
            ? "Up"
            : profitMarginPoints < 0
              ? "Down"
              : "Stable",
      unitsSold: unitsSold.status
    },
    label: previousRange.label
  };
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
    },
    {
      code: "UNRESOLVED_FOREIGN_KEY",
      label: "Unresolved canonical master relationship",
      severity: "Medium"
    },
    {
      code: "MALFORMED_CANONICAL_RECORD",
      label: "Malformed canonical ledger record",
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

  [
    ["UNRESOLVED_FOREIGN_KEY", "unresolvedForeignKeys"],
    ["MALFORMED_CANONICAL_RECORD", "malformedRows"]
  ].forEach(function(mapping)
  {
    var count = Number(sourceInspection && sourceInspection[mapping[1]]) || 0;
    counts[mapping[0]] += count;
    issueCount += count;

    for (var index = 0; index < count; index++)
    {
      issueRowKeys["canonical:" + mapping[1] + ":" + index] = true;
    }
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
    lifecycle: {
      inactiveCanonicalRows:
        Number(sourceInspection && sourceInspection.inactiveLedgerRows) || 0
    },
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

function buildDashboardResponse(processedData, filter, customStart, customEnd, referenceDate, sourceQuality, performance) {

  var responseStartedAt = Date.now();

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

  var availablePeriodKeys = {};
  var availableYearKeys = {};
  (processedData || []).forEach(function(row)
  {
    var monthKey = row && row.monthKey;
    if (!monthKey) return;
    availablePeriodKeys[monthKey] = true;
    availableYearKeys[monthKey.slice(0, 4)] = true;
  });

  dateRange.availableMonths = Object.keys(availablePeriodKeys).sort();
  dateRange.availableYears = Object.keys(availableYearKeys).sort();

  var filteredData =
    filterTransactionsByDateRange(
      processedData,
      dateRange
    );

  var previousRange =
    resolvePreviousComparisonDateRange(
      dateRange
    );

  var previousData =
    filterTransactionsByComparisonRange(
      processedData,
      previousRange
    );

  var comparisonStartedAt = Date.now();
  var periodComparison =
    buildPeriodComparison(
      filteredData,
      previousData,
      dateRange,
      previousRange
    );
  if (performance) performance.comparisonMs = Date.now() - comparisonStartedAt;

  dateRange.rowCount =
    filteredData.length;

  var reportingMetadata =
    buildReportingMetadata(
      filteredData,
      dateRange,
      generatedDate
    );

  var qualityStartedAt = Date.now();
  var dataQuality =
    buildDataQualityDiagnostics(
      filteredData,
      sourceQuality
    );
  if (performance) performance.qualityMs = Date.now() - qualityStartedAt;

  var cache =
  buildAnalyticsCache(
    filteredData,
    dateRange,
    performance
  );

  cache.performanceAnalytics.grossMarginComparison =
    buildGrossMarginComparison(
      cache.performanceAnalytics,
      previousData
    );

  var businessPriority =
    buildBusinessPriority(
      cache,
      dataQuality,
      filteredData.length,
      periodComparison
    );

  var kpiTargets =
    buildKpiTargets(
      cache
    );

    var recentStartedAt = Date.now();
    var recentTransactions = buildRecentTransactions(filteredData);
    if (performance) performance.recentTransactionsMs = Date.now() - recentStartedAt;

    var response = {
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

      performanceAnalytics:
        cache.performanceAnalytics,

      recentTransactions:
        recentTransactions,

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

      periodComparison:
        periodComparison,

      businessPriority:
        businessPriority,

      kpiTargets:
        kpiTargets,

    };
    if (performance) performance.responseAssemblyMs = Date.now() - responseStartedAt;
    return response;
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

function buildRecentLifecycleTransactions(data) {
  var recent = data.slice(-20);
  recent.reverse();
  return recent.map(function(row) {
    return {
      id: row.id,
      date: Utilities.formatDate(new Date(row.date), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      transactionType: row.transactionType,
      canonicalTransactionType: row.canonicalTransactionType,
      product: row.product,
      purchaseCategory: row.purchaseCategory,
      qty: row.qty,
      revenue: row.revenue,
      expense: row.expense,
      source: row.source,
      isActive: row.isActive !== false
    };
  });
}

function buildAnalyticsCache(data, dateRange, performance) {

  var aggregateStartedAt = Date.now();
  var aggregate = buildAggregate(data);
  if (performance) performance.aggregateMs = Date.now() - aggregateStartedAt;

  var cache = {

    aggregate:
      aggregate,

    financial:
      buildFinancial(data)

  };

  var summaryStartedAt = Date.now();
  cache.summary =
    buildSummaryFromAggregate(
      cache.aggregate
    );
  if (performance) performance.summaryMs = Date.now() - summaryStartedAt;

  var expenseBreakdownStartedAt = Date.now();
  cache.expenseBreakdown =
    buildExpenseBreakdownFromAggregate(
      cache.aggregate
    );
  if (performance) performance.expenseBreakdownMs = Date.now() - expenseBreakdownStartedAt;

  cache.performanceAnalytics =
    buildOptionalPerformanceAnalytics(
      cache.aggregate,
      performance
    );

  cache.insights =
    buildInsights(cache);

  var revenueTrendStartedAt = Date.now();
  cache.revenueTrend =
    dateRange && (
      dateRange.filter === "currentMonth" ||
      dateRange.filter === "previousMonth" ||
      dateRange.filter === "customMonth" ||
      (
        dateRange.filter === "custom" &&
        getDashboardDateRangeDuration(dateRange) <= 93
      )
    )
      ? buildDailyRevenueTrendFromAggregate(cache.aggregate, dateRange)
      : buildRevenueTrendFromAggregate(cache.aggregate);
  if (performance) performance.revenueTrendMs = Date.now() - revenueTrendStartedAt;

  var topProductsStartedAt = Date.now();
  cache.topProducts =
    buildTopProductsFromAggregate(
      cache.aggregate
    );
  if (performance) performance.topProductsMs = Date.now() - topProductsStartedAt;

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
