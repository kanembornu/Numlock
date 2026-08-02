function getDashboardData() {

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

  var cache =
  buildAnalyticsCache(
    processedData
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
        buildRecentTransactions(processedData),

      diagnosis:
        buildDiagnosis(processedData, cache),

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

    };
}

function validateAggregate(data)
{
  var aggregate =
    buildAggregate(data);

  var summary =
    buildSummary(data);

  Logger.log("========== Aggregate Validation ==========");

  Logger.log(
    "Revenue : " +
    aggregate.revenue +
    " | " +
    summary.revenue
  );

  Logger.log(
    "Expense : " +
    aggregate.expense +
    " | " +
    summary.expense
  );

  Logger.log(
    "Units : " +
    aggregate.unitsSold +
    " | " +
    summary.unitsSold
  );

  Logger.log(
    "Best Seller : " +
    aggregate.bestSeller +
    " | " +
    summary.bestSeller
  );

  Logger.log(
    "Top Revenue Product : " +
    aggregate.topRevenueProduct +
    " | " +
    summary.topRevenueProduct
  );

  Logger.log(
    "Active Days : " +
    aggregate.activeDaysCount +
    " | " +
    summary.activeDays
  );

  Logger.log("==========================================");
}

function testAggregate()
{
  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  validateAggregate(processed);
}



function testSummaryMigration() {
  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateSummaryMigration(processed);
}





function testRevenueTrendMigration()
{
  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateRevenueTrendMigration(processed);
}










function testProfitTrendMigration() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateProfitTrendMigration(
    processed
  );

}










function testHotColdMigration() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateHotColdMigration(
    processed
  );

}




function testProductMigration() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateProductMigration(
    processed
  );

}




function testExpenseBreakdownMigration() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateExpenseBreakdownMigration(
    processed
  );

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
