function runAllBackendTests()
{
  var tests = [
    { name: "testExpensePurchasePolicyContracts", run: testExpensePurchasePolicyContracts },
    { name: "getDashboardData", run: getDashboardData },
    { name: "testAggregate", run: testAggregate },
    { name: "testCanonicalTransactionAdapter", run: testCanonicalTransactionAdapter },
    { name: "testBoundedCanonicalRead", run: testBoundedCanonicalRead },
    { name: "testProductPricingResolution", run: testProductPricingResolution },
    { name: "testCanonicalTransactionEntryService", run: testCanonicalTransactionEntryService },
    { name: "testCanonicalTransactionLifecycleService", run: testCanonicalTransactionLifecycleService },
    { name: "testCanonicalLifecycleTransportSerialization", run: testCanonicalLifecycleTransportSerialization },
    { name: "testCanonicalHistoricalAndOverlapControls", run: testCanonicalHistoricalAndOverlapControls },
    { name: "testFinanceCoreBackendContract", run: testFinanceCoreBackendContract },
    { name: "testFinancePAndLIsolation", run: testFinancePAndLIsolation },
    { name: "testFinanceCapitalEquityGracefulDegradation", run: testFinanceCapitalEquityGracefulDegradation },
    { name: "testFinanceCapitalEquitySuccess", run: testFinanceCapitalEquitySuccess },
    { name: "testFinanceErrorDestinationMessaging", run: testFinanceErrorDestinationMessaging },
    { name: "testFinanceResponseBackwardCompatibility", run: testFinanceResponseBackwardCompatibility },
    { name: "testFinanceProfitAndLossUiContract", run: testFinanceProfitAndLossUiContract },
    { name: "testFinanceDestinationSwitchContract", run: testFinanceDestinationSwitchContract },
    { name: "testFinancePpFieldSemantics", run: testFinancePpFieldSemantics },
    { name: "testFinancePeriodLabelSync", run: testFinancePeriodLabelSync },
    { name: "testFinanceWarmCacheKeyGeneration", run: testFinanceWarmCacheKeyGeneration },
    { name: "testFinanceCacheStructureExists", run: testFinanceCacheStructureExists },
    { name: "testFinanceCacheValidation", run: testFinanceCacheValidation },
    { name: "testFinanceCacheServesPnL", run: testFinanceCacheServesPnL },
    { name: "testFinanceCacheServesCE", run: testFinanceCacheServesCE },
    { name: "testFinanceCacheServesPP", run: testFinanceCacheServesPP },
    { name: "testFinanceInFlightDeduplication", run: testFinanceInFlightDeduplication },
    { name: "testFinanceCachePopulation", run: testFinanceCachePopulation },
    { name: "testFinanceSiblingWarmUp", run: testFinanceSiblingWarmUp },
    { name: "testFinanceBackgroundWarmFunctions", run: testFinanceBackgroundWarmFunctions },
    { name: "testFinanceCacheInvalidation", run: testFinanceCacheInvalidation },
    { name: "testFinanceCacheInvalidationOnMutation", run: testFinanceCacheInvalidationOnMutation },
    { name: "testFinanceStartupPreload", run: testFinanceStartupPreload },
    { name: "testFinanceDestinationBoundGuardsPreserved", run: testFinanceDestinationBoundGuardsPreserved },
    { name: "testFinanceNoCrossDestinationRender", run: testFinanceNoCrossDestinationRender },
    { name: "testFinanceFilterNotKeyedByDestination", run: testFinanceFilterNotKeyedByDestination },
    { name: "testFinanceStaleResponseCached", run: testFinanceStaleResponseCached },
    { name: "testFinanceSetFinanceDestinationDecoupled", run: testFinanceSetFinanceDestinationDecoupled },
    { name: "testFinanceWarmCacheMutationInvalidatesOutstandingRequest", run: testFinanceWarmCacheMutationInvalidatesOutstandingRequest },
    { name: "testDepreciationEngineContract", run: testDepreciationEngineContract },
    { name: "testCapitalEquityMigrationContract", run: testCapitalEquityMigrationContract },
    { name: "testCashFoundationContracts", run: testCashFoundationContracts },
    { name: "testInventorySchemaMigrationContract", run: testInventorySchemaMigrationContract },
    { name: "testInventoryConversionAuthorityContracts", run: testInventoryConversionAuthorityContracts },
    { name: "testInventoryOpeningStagingContracts", run: testInventoryOpeningStagingContracts },
    { name: "testSummaryFixtures", run: testSummaryFixtures },
    { name: "testRevenueTrendFixtures", run: testRevenueTrendFixtures },
    { name: "testExpenseBreakdownFixtures", run: testExpenseBreakdownFixtures },
    { name: "testTopProductsFixtures", run: testTopProductsFixtures },
    { name: "testProfitTrendFixtures", run: testProfitTrendFixtures },
    { name: "testHotColdFixtures", run: testHotColdFixtures },
    { name: "testDashboardPerformanceAnalytics", run: testDashboardPerformanceAnalytics },
    { name: "testPerformanceStabilizationContract", run: testPerformanceStabilizationContract },
    { name: "testSparseDatasetResilience", run: testSparseDatasetResilience },
    { name: "testDashboardDateFilter", run: testDashboardDateFilter },
    { name: "testPeriodComparison", run: testPeriodComparison },
    { name: "testBusinessPriorityContract", run: testBusinessPriorityContract },
    { name: "testKpiTargetContract", run: testKpiTargetContract },
    { name: "testDashboardStateContract", run: testDashboardStateContract },
    { name: "testAccessibilityContract", run: testAccessibilityContract },
    { name: "testExecutivePresentationContract", run: testExecutivePresentationContract },
    { name: "testDashboardOverviewStabilizationContract", run: testDashboardOverviewStabilizationContract },
    { name: "testCsvExportContract", run: testCsvExportContract },
    { name: "testClientRenderPerformanceContract", run: testClientRenderPerformanceContract },
    { name: "testResponsiveShellContract", run: testResponsiveShellContract },
    { name: "testThemeParityTokenContract", run: testThemeParityTokenContract },
    { name: "testChartRuntimeThemeSynchronizationContract", run: testChartRuntimeThemeSynchronizationContract },
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
    { name: "testSourceDataQualityPipeline", run: testSourceDataQualityPipeline },
    { name: "testProductProfitabilityBasicAggregation", run: testProductProfitabilityBasicAggregation },
    { name: "testProductProfitabilityProductTypeGrain", run: testProductProfitabilityProductTypeGrain },
    { name: "testProductProfitabilityHotColdSplit", run: testProductProfitabilityHotColdSplit },
    { name: "testProductProfitabilityGrossMargin", run: testProductProfitabilityGrossMargin },
    { name: "testProductProfitabilityPerUnitMetrics", run: testProductProfitabilityPerUnitMetrics },
    { name: "testProductProfitabilityMixMetrics", run: testProductProfitabilityMixMetrics },
    { name: "testProductProfitabilityRanking", run: testProductProfitabilityRanking },
    { name: "testProductProfitabilityPeriodFiltering", run: testProductProfitabilityPeriodFiltering },
    { name: "testProductProfitabilityComparison", run: testProductProfitabilityComparison },
    { name: "testProductProfitabilityInactiveExcluded", run: testProductProfitabilityInactiveExcluded },
    { name: "testProductProfitabilityZeroRevenueDenominator", run: testProductProfitabilityZeroRevenueDenominator },
    { name: "testProductProfitabilityZeroUnitsDenominator", run: testProductProfitabilityZeroUnitsDenominator },
    { name: "testProductProfitabilityMissingIdentityHandling", run: testProductProfitabilityMissingIdentityHandling },
    { name: "testProductProfitabilityReconcilesToFinance", run: testProductProfitabilityReconcilesToFinance },
    { name: "testProductProfitabilityFailureIsolation", run: testProductProfitabilityFailureIsolation },
    { name: "testProductProfitabilityResponseContract", run: testProductProfitabilityResponseContract },
    { name: "testProductProfitabilityUngovernedType", run: testProductProfitabilityUngovernedType },
    { name: "testProductProfitabilityZeroComparisonDenominator", run: testProductProfitabilityZeroComparisonDenominator },
    { name: "testProductProfitabilityAbsentVariantComparison", run: testProductProfitabilityAbsentVariantComparison },
    { name: "testProductProfitabilityEmptyDataset", run: testProductProfitabilityEmptyDataset },
    { name: "testColdBackendSegmentation", run: testColdBackendSegmentation }
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
