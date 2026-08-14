function runAllBackendTests()
{
  var tests = [
    { name: "getDashboardData", run: getDashboardData },
    { name: "testAggregate", run: testAggregate },
    { name: "testCanonicalTransactionAdapter", run: testCanonicalTransactionAdapter },
    { name: "testProductPricingResolution", run: testProductPricingResolution },
    { name: "testCanonicalTransactionEntryService", run: testCanonicalTransactionEntryService },
    { name: "testCanonicalTransactionLifecycleService", run: testCanonicalTransactionLifecycleService },
    { name: "testCanonicalLifecycleTransportSerialization", run: testCanonicalLifecycleTransportSerialization },
    { name: "testLegacyTransactionSyncService", run: testLegacyTransactionSyncService },
    { name: "testLegacyTransactionSyncTriggerDelegation", run: testLegacyTransactionSyncTriggerDelegation },
    { name: "testLegacySyncRuntimeAcceptanceHarness", run: testLegacySyncRuntimeAcceptanceHarness },
    { name: "testCanonicalHistoricalAndOverlapControls", run: testCanonicalHistoricalAndOverlapControls },
    { name: "testSummaryFixtures", run: testSummaryFixtures },
    { name: "testRevenueTrendFixtures", run: testRevenueTrendFixtures },
    { name: "testExpenseBreakdownFixtures", run: testExpenseBreakdownFixtures },
    { name: "testTopProductsFixtures", run: testTopProductsFixtures },
    { name: "testProfitTrendFixtures", run: testProfitTrendFixtures },
    { name: "testHotColdFixtures", run: testHotColdFixtures },
    { name: "testSparseDatasetResilience", run: testSparseDatasetResilience },
    { name: "testDashboardDateFilter", run: testDashboardDateFilter },
    { name: "testPeriodComparison", run: testPeriodComparison },
    { name: "testBusinessPriorityContract", run: testBusinessPriorityContract },
    { name: "testKpiTargetContract", run: testKpiTargetContract },
    { name: "testDashboardStateContract", run: testDashboardStateContract },
    { name: "testAccessibilityContract", run: testAccessibilityContract },
    { name: "testExecutivePresentationContract", run: testExecutivePresentationContract },
    { name: "testPrintReportContract", run: testPrintReportContract },
    { name: "testCsvExportContract", run: testCsvExportContract },
    { name: "testClientRenderPerformanceContract", run: testClientRenderPerformanceContract },
    { name: "testResponsiveShellContract", run: testResponsiveShellContract },
    { name: "testThemeParityTokenContract", run: testThemeParityTokenContract },
    { name: "testUiShellThemeContract", run: testUiShellThemeContract },
    { name: "testNineDestinationNavigationContract", run: testNineDestinationNavigationContract },
    { name: "testFullShellVisualContract", run: testFullShellVisualContract },
    { name: "testDashboardTabFrameworkContract", run: testDashboardTabFrameworkContract },
    { name: "testDashboardOverviewContract", run: testDashboardOverviewContract },
    { name: "testDashboardHighFidelityCompositionContract", run: testDashboardHighFidelityCompositionContract },
    { name: "testPerformanceAnalyticsVisualContract", run: testPerformanceAnalyticsVisualContract },
    { name: "testIntelligencePlanningVisualContract", run: testIntelligencePlanningVisualContract },
    { name: "testSecondaryDestinationsHighFidelityContract", run: testSecondaryDestinationsHighFidelityContract },
    { name: "testTransactionEntryUiContract", run: testTransactionEntryUiContract },
    { name: "testTransactionLifecycleUiContract", run: testTransactionLifecycleUiContract },
    { name: "testTransactionsVisualContract", run: testTransactionsVisualContract },
    { name: "testSettingsVisualContract", run: testSettingsVisualContract },
    { name: "testLogsVisualContract", run: testLogsVisualContract },
    { name: "testBoundedUiRefactorContract", run: testBoundedUiRefactorContract },
    { name: "testUiUx2ClosureContract", run: testUiUx2ClosureContract },
    { name: "testUiFinalStabilizationContract", run: testUiFinalStabilizationContract },
    { name: "testChartPresentationContract", run: testChartPresentationContract },
    { name: "testFrontendDependencyContract", run: testFrontendDependencyContract },
    { name: "testReportingMetadata", run: testReportingMetadata },
    { name: "testDataQualityDiagnostics", run: testDataQualityDiagnostics },
    { name: "testSourceDataQualityPipeline", run: testSourceDataQualityPipeline }
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
