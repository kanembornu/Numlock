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
        row.canonicalTransactionType ||
          (row.transactionType === "Purchase" ? "Expense" : row.transactionType),

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
  return buildLifecycleTransactionRows(recent);
}

function buildLifecycleTransactionRows(data) {
  return data.map(function(row) {
    return {
      id: row.id,
      date: Utilities.formatDate(new Date(row.date), Session.getScriptTimeZone(), "yyyy-MM-dd"),
      transactionType: row.canonicalTransactionType ||
        (row.transactionType === "Purchase" ? "Expense" : row.transactionType),
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
