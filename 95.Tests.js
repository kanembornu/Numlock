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
