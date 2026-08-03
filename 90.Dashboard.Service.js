function getDashboardData(filter, customStart, customEnd) {

  var ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

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
    customEnd
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

function buildDashboardResponse(processedData, filter, customStart, customEnd, referenceDate) {

  var dateRange =
    resolveDashboardDateRange(
      filter,
      customStart,
      customEnd,
      referenceDate
    );

  var filteredData =
    filterTransactionsByDateRange(
      processedData,
      dateRange
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
