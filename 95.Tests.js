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

function runAllBackendTests()
{
  var tests = [
    { name: "getDashboardData", run: getDashboardData },
    { name: "testAggregate", run: testAggregate },
    { name: "testSummaryMigration", run: testSummaryMigration },
    { name: "testRevenueTrendMigration", run: testRevenueTrendMigration },
    { name: "testExpenseBreakdownMigration", run: testExpenseBreakdownMigration },
    { name: "testProductMigration", run: testProductMigration },
    { name: "testProfitTrendMigration", run: testProfitTrendMigration },
    { name: "testHotColdMigration", run: testHotColdMigration }
  ];
  var passedTests = [];

  Logger.log("===== NUMLOCK BACKEND TEST SUITE START =====");

  for (var i = 0; i < tests.length; i++)
  {
    var test = tests[i];

    try
    {
      test.run();
      passedTests.push(test.name);
      Logger.log("PASS: " + test.name);
    }
    catch (error)
    {
      var message =
        error && error.message
          ? error.message
          : String(error);

      Logger.log("FAIL: " + test.name + " | " + message);
      throw error;
    }
  }

  Logger.log(
    "===== NUMLOCK BACKEND TEST SUITE PASS: " +
    passedTests.length +
    "/" +
    tests.length +
    " ====="
  );

  return {
    passed: passedTests.length,
    failed: tests.length - passedTests.length,
    total: tests.length,
    tests: passedTests
  };
}
