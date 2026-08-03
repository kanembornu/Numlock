function runAllBackendTests()
{
  var tests = [
    { name: "getDashboardData", run: getDashboardData },
    { name: "testAggregate", run: testAggregate },
    { name: "testSummaryFixtures", run: testSummaryFixtures },
    { name: "testRevenueTrendFixtures", run: testRevenueTrendFixtures },
    { name: "testExpenseBreakdownFixtures", run: testExpenseBreakdownFixtures },
    { name: "testTopProductsFixtures", run: testTopProductsFixtures },
    { name: "testProfitTrendFixtures", run: testProfitTrendFixtures },
    { name: "testHotColdFixtures", run: testHotColdFixtures },
    { name: "testSparseDatasetResilience", run: testSparseDatasetResilience },
    { name: "testDashboardDateFilter", run: testDashboardDateFilter }
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
