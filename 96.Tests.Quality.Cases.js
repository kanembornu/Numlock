function testReportingMetadata()
{
  var fixture =
    createReportingMetadataFixtures();

  var scenariosPassed = 0;

  fixture.cases.forEach(function(testCase)
  {
    var metadata =
      buildReportingMetadata(
        testCase.rows,
        { filter: "custom" },
        fixture.referenceDate
      );

    var scope =
      metadata.reportingScope;

    var actual =
      scope.transactionCount + "|" +
      scope.salesCount + "|" +
      scope.purchaseCount + "|" +
      scope.firstTransactionDate + "|" +
      scope.lastTransactionDate + "|" +
      metadata.dataFreshness.status;

    if (actual !== testCase.expected)
    {
      throw new Error(
        "Reporting metadata mismatch for " +
        testCase.name +
        ": expected=" +
        testCase.expected +
        ", actual=" +
        actual
      );
    }

    if (
      scope.rowCount !== scope.transactionCount ||
      metadata.dataFreshness.timezone !==
        Session.getScriptTimeZone()
    )
    {
      throw new Error(
        "Reporting count or timezone mismatch for " +
        testCase.name
      );
    }

    assertFiniteNumbers(
      metadata,
      "reporting metadata / " + testCase.name
    );

    scenariosPassed++;
  });

  fixture.periods.forEach(function(period)
  {
    var periodReferenceDate =
      period.referenceDate ||
      fixture.referenceDate;

    var range =
      resolveDashboardDateRange(
        period.filter,
        period.filter === "custom" ? "2026-06-01" : null,
        period.filter === "custom" ? "2026-06-30" : null,
        periodReferenceDate
      );

    var metadata =
      buildReportingMetadata(
        [],
        range,
        periodReferenceDate
      );

    if (
      metadata.reportingScope.isPartialPeriod !==
      period.expected
    )
    {
      throw new Error(
        "Reporting partial-period mismatch for " +
        period.filter
      );
    }

    scenariosPassed++;
  });

  var response =
    buildDashboardResponse(
      fixture.cases[3].rows,
      "custom",
      "2026-06-01",
      "2026-06-30",
      fixture.referenceDate
    );

  if (!response.reportingScope || !response.dataFreshness)
  {
    throw new Error(
      "Dashboard response missing reporting metadata"
    );
  }

  if (
    response.dataFreshness.generatedAt !==
      fixture.referenceDate.toISOString() ||
    response.dataFreshness.lastTransactionAt !==
      fixture.cases[3].rows[2].date.toISOString()
  )
  {
    throw new Error(
      "Reporting timestamps are not deterministic"
    );
  }

  scenariosPassed++;

  var source = getAssembledFrontendSource();

  fixture.frontendTokens.forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "reporting frontend"
    );
  });

  assertSourceExcludes(
    source,
    "freshness.lastTransactionAt",
    "raw freshness timestamp"
  );

  assertSourceExcludes(
    source,
    "freshness.generatedAt",
    "generated timestamp"
  );

  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    freshness: ["Current", "Stale", "No Data"]
  };

  Logger.log(
    "PASS: testReportingMetadata | scenarios=" +
    summary.scenarios +
    " | freshness=" +
    summary.freshness.join(",")
  );

  return summary;
}

function testDataQualityDiagnostics()
{
  var fixture =
    createDataQualityDiagnosticsFixtures();

  var scenariosPassed = 0;
  var statuses = {};
  var severityByCode = {
    INVALID_DATE: "High",
    UNKNOWN_TRANSACTION_TYPE: "High",
    MISSING_SALES_PRODUCT: "Medium",
    MISSING_PURCHASE_CATEGORY: "Medium",
    INVALID_QUANTITY: "Medium",
    INVALID_PURCHASE_AMOUNT: "Medium"
  };

  fixture.cases.forEach(function(testCase)
  {
    var actual =
      buildDataQualityDiagnostics(
        testCase.rows
      );

    if (
      testCase.expected &&
      JSON.stringify(actual) !==
        JSON.stringify(testCase.expected)
    )
    {
      throw new Error(
        "Data-quality output mismatch for " +
        testCase.name
      );
    }

    if (testCase.expectedIssue)
    {
      if (
        actual.issueRows !== 1 ||
        actual.issueCount !== 1 ||
        actual.issues.length !== 1 ||
        actual.issues[0].code !==
          testCase.expectedIssue[0] ||
        actual.status !==
          testCase.expectedIssue[1]
      )
      {
        throw new Error(
          "Data-quality issue mismatch for " +
          testCase.name
        );
      }

      if (
        testCase.expectedValidRows == null &&
        (
          actual.totalRows !== 1 ||
          actual.validRows !== 0
        )
      )
      {
        throw new Error(
          "Data-quality single-row mismatch for " +
          testCase.name
        );
      }
    }

    if (testCase.expectedCodes)
    {
      var actualCodes =
        actual.issues.map(function(issue)
        {
          return issue.code;
        });

      if (
        JSON.stringify(actualCodes) !==
          JSON.stringify(testCase.expectedCodes) ||
        actual.issueRows !== 1 ||
        actual.issueCount !==
          testCase.expectedCodes.length ||
        actual.status !== testCase.expectedStatus
      )
      {
        throw new Error(
          "Data-quality multi-issue mismatch for " +
          testCase.name
        );
      }
    }

    if (
      testCase.expectedValidRows != null &&
      actual.validRows !== testCase.expectedValidRows
    )
    {
      throw new Error(
        "Data-quality valid-row mismatch for " +
        testCase.name
      );
    }

    actual.issues.forEach(function(issue)
    {
      if (
        issue.severity !==
          severityByCode[issue.code] ||
        !issue.label ||
        issue.count < 1
      )
      {
        throw new Error(
          "Data-quality issue contract mismatch for " +
          testCase.name
        );
      }
    });

    statuses[actual.status] = true;
    scenariosPassed++;
  });

  var scopedRowsJson =
    JSON.stringify(fixture.scoped.rows);

  var inactiveOnly = buildDataQualityDiagnostics([], {
    sourceRows: 2,
    invalidDateRowIndexes: [],
    inactiveLedgerRows: 2,
    malformedRows: 0,
    unresolvedForeignKeys: 0
  });

  if (
    inactiveOnly.status !== "Good" ||
    inactiveOnly.issueCount !== 0 ||
    inactiveOnly.issues.length !== 0 ||
    inactiveOnly.lifecycle.inactiveCanonicalRows !== 2
  )
  {
    throw new Error("Valid inactive lifecycle rows changed data quality severity");
  }
  scenariosPassed++;

  var correctedLifecycle = buildDataQualityDiagnostics(
    fixture.cases[0].rows,
    {
      sourceRows: 2,
      invalidDateRowIndexes: [],
      inactiveLedgerRows: 1,
      malformedRows: 0,
      unresolvedForeignKeys: 0
    }
  );

  if (
    correctedLifecycle.status !== "Good" ||
    correctedLifecycle.issueCount !== 0 ||
    correctedLifecycle.lifecycle.inactiveCanonicalRows !== 1
  )
  {
    throw new Error("Valid corrected lifecycle chain changed data quality severity");
  }
  scenariosPassed++;

  var malformedCanonical = buildDataQualityDiagnostics([], {
    sourceRows: 1,
    invalidDateRowIndexes: [],
    inactiveLedgerRows: 0,
    malformedRows: 1,
    unresolvedForeignKeys: 0
  });
  var unresolvedForeignKey = buildDataQualityDiagnostics([], {
    sourceRows: 1,
    invalidDateRowIndexes: [],
    inactiveLedgerRows: 0,
    malformedRows: 0,
    unresolvedForeignKeys: 1
  });

  if (
    malformedCanonical.status !== "Attention" ||
    malformedCanonical.issueCount !== 1 ||
    unresolvedForeignKey.status !== "Attention" ||
    unresolvedForeignKey.issueCount !== 1
  )
  {
    throw new Error("Canonical anomaly severity mismatch");
  }
  scenariosPassed++;

  var scopedResponse =
    buildDashboardResponse(
      fixture.scoped.rows,
      "custom",
      "2026-06-01",
      "2026-06-30",
      fixture.scoped.referenceDate
    );

  if (
    scopedResponse.dataQuality.totalRows !== 2 ||
    scopedResponse.dataQuality.validRows !== 1 ||
    scopedResponse.dataQuality.issueRows !== 1 ||
    scopedResponse.dataQuality.issueCount !== 1 ||
    scopedResponse.dataQuality.status !== "Attention" ||
    scopedResponse.dataQuality.issues[0].code !==
      "MISSING_SALES_PRODUCT" ||
    scopedResponse.reportingScope.rowCount !== 2 ||
    scopedResponse.dateFilter.rowCount !== 2
  )
  {
    throw new Error(
      "Data-quality diagnostics are not scoped"
    );
  }
  scenariosPassed++;

  buildDataQualityDiagnostics(
    fixture.scoped.rows
  );

  if (
    JSON.stringify(fixture.scoped.rows) !==
      scopedRowsJson
  )
  {
    throw new Error(
      "Data-quality diagnostics mutated source rows"
    );
  }
  scenariosPassed++;

  var sourceTransactionsJson =
    JSON.stringify(fixture.processor.transactions);

  var processedRows =
    processTransactions(
      fixture.processor.transactions,
      fixture.processor.priceMap
    );

  var processedQuality =
    buildDataQualityDiagnostics(
      processedRows
    );

  var processedCodes =
    processedQuality.issues.map(function(issue)
    {
      return issue.code;
    });

  if (
    JSON.stringify(processedCodes) !==
      JSON.stringify([
        "INVALID_QUANTITY",
        "INVALID_PURCHASE_AMOUNT"
      ]) ||
    JSON.stringify(fixture.processor.transactions) !==
      sourceTransactionsJson
  )
  {
    throw new Error(
      "Processed-row data-quality provenance mismatch"
    );
  }
  scenariosPassed++;

  var source = getAssembledFrontendSource();

  fixture.frontendTokens.forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "data-quality frontend"
    );
  });

  fixture.internalCodes.forEach(function(code)
  {
    assertSourceExcludes(
      source,
      code,
      "internal data-quality code"
    );
  });

  scenariosPassed++;

  ["Quality issues", '"<strong>Lifecycle</strong>"',
    "quality.issueCount === 0 && inactiveCanonicalRows === 0",
    '" inactive canonical rows</p>"'].forEach(function(token)
  {
    assertSourceContains(source, token, "lifecycle quality presentation");
  });
  scenariosPassed++;

  var toggleQualityRegion = getSourceRegion(
    source,
    "function toggleDataQualityDetails()",
    "function renderDataQuality(res)",
    "Data Quality disclosure scope"
  );
  var renderQualityRegion = getSourceRegion(
    source,
    "function renderDataQuality(res)",
    "function renderOverviewKpiCard",
    "Data Quality render scope"
  );
  assertSourceExcludes(toggleQualityRegion, "inactiveCanonicalRows", "disclosure-only scope");
  assertSourceContains(renderQualityRegion, "var inactiveCanonicalRows =", "render-owned lifecycle count");

  var qualityElements = {};
  ["dataQualityStatusBadge", "dataQualityIssueCount", "dataQualityScopeSummary",
    "dataQualityDetailsButton", "dataQualityDetails"].forEach(function(id)
  {
    qualityElements[id] = {
      className: "",
      innerText: "",
      innerHTML: "",
      classList: { toggle: function() {}, add: function() {} },
      setAttribute: function() {}
    };
  });
  var renderQuality = new Function(
    "document",
    renderQualityRegion + "; return renderDataQuality;"
  )({
    getElementById: function(id) { return qualityElements[id]; }
  });
  renderQuality({
    dataQuality: {
      status: "Good",
      issueCount: 0,
      issues: [],
      lifecycle: { inactiveCanonicalRows: 2 },
      scope: { scopedRows: 10, excludedInvalidDateRows: 0 }
    }
  });
  if (
    qualityElements.dataQualityStatusBadge.innerText !== "Good" ||
    qualityElements.dataQualityScopeSummary.innerText.indexOf("2 inactive lifecycle") === -1
  )
  {
    throw new Error("Data Quality lifecycle render mismatch");
  }
  scenariosPassed++;

  var comparisonRegion = getSourceRegion(
    source,
    "function renderPeriodComparison(periodComparison)",
    "function normalizeOverviewContextResponse(res)",
    "period comparison render"
  );
  var comparisonElements = {
    periodComparisonLabel: { innerText: "" },
    periodComparisonLead: { innerText: "" },
    periodComparisonPeriod: { innerText: "" }
  };
  var renderComparison = new Function(
    "document", "formatDashboardPresentationPeriod",
    comparisonRegion + "; return renderPeriodComparison;"
  )({ getElementById: function(id) { return comparisonElements[id]; } }, function(value) { return value; });
  renderComparison({ previous: { startDate: "2026-01-01", endDate: "2026-01-31", rowCount: 1 }, changes: {}, status: {} });
  if (comparisonElements.periodComparisonLead.innerText !== "Compared with" ||
      comparisonElements.periodComparisonPeriod.innerText.indexOf("2026-01-01") === -1) {
    throw new Error("Available comparison did not render visible text");
  }
  renderComparison(null);
  if (comparisonElements.periodComparisonLead.innerText !== "Comparison unavailable" ||
      comparisonElements.periodComparisonPeriod.innerText !== "") {
    throw new Error("Unavailable comparison did not render a visible fallback");
  }
  scenariosPassed++;

  var normalizationRegion = getSourceRegion(
    source,
    "function normalizeOverviewContextResponse(res)",
    "function renderOverviewContext(res)",
    "overview context normalization"
  );
  var normalizeOverview = new Function(normalizationRegion + "; return normalizeOverviewContextResponse;")();
  var normalizedComparisonOnly = normalizeOverview({ periodComparison: {
    previous: { startDate: "2026-01-01", endDate: "2026-01-31" }, changes: {}, status: {}
  } });
  var normalizedQualityOnly = normalizeOverview({ dataQuality: {
    status: "Good", issueCount: 0, issues: [], lifecycle: { inactiveCanonicalRows: 2 }, scope: {}
  } });
  if (!normalizedComparisonOnly.comparison.previous || normalizedComparisonOnly.quality !== null ||
      normalizedQualityOnly.comparison.available !== false || normalizedQualityOnly.quality.status !== "Good") {
    throw new Error("Comparison and Data Quality are not independently normalized");
  }
  scenariosPassed++;

  [
    "grid-template-columns: minmax(0, 1fr) max-content !important; grid-template-rows: minmax(0, 1fr) !important;",
    "#dashboardPanelOverview #periodComparisonLabel { display: inline-flex !important; align-items: baseline !important; gap: 4px !important; white-space: nowrap !important; }",
    "#dashboardPanelOverview #periodComparisonLabel { display: flex !important; flex-direction: column !important; align-items: flex-start !important; gap: 0 !important; white-space: normal !important; }",
    "grid-template-columns: max-content max-content max-content !important;",
    "#dashboardPanelOverview #dataQualityScopeSummary { grid-column: 1 / -1 !important; }"
  ].forEach(function(token) {
    assertSourceContains(source, token, "responsive comparison and Data Quality structure");
  });
  scenariosPassed++;

  if (
    !statuses.Good ||
    !statuses.Attention ||
    !statuses.Critical
  )
  {
    throw new Error(
      "Data-quality status coverage incomplete"
    );
  }

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    statuses: ["Good", "Attention", "Critical"]
  };

  Logger.log(
    "PASS: testDataQualityDiagnostics | scenarios=" +
    summary.scenarios +
    " | statuses=" +
    summary.statuses.join(",")
  );

  return summary;
}

function testSourceDataQualityPipeline()
{
  var fixture =
    createSourceDataQualityPipelineFixtures();

  var scenariosPassed = 0;

  function buildFromRaw(rawRows, startDate, endDate)
  {
    var sourceQuality =
      inspectSourceDateQuality(rawRows);

    var processedRows =
      processTransactions(
        rawRows,
        fixture.priceMap
      );

    return buildDashboardResponse(
      processedRows,
      "custom",
      startDate || "2026-06-01",
      endDate || "2026-06-30",
      fixture.referenceDate,
      sourceQuality
    );
  }

  var validInspection =
    inspectSourceDateQuality(
      fixture.raw.validOnly
    );

  var validResponse =
    buildFromRaw(
      fixture.raw.validOnly
    );

  if (
    validInspection.sourceRows !== 2 ||
    validInspection.invalidDateRowIndexes.length !== 0 ||
    validResponse.dataQuality.status !== "Good"
  )
  {
    throw new Error(
      "Valid source-quality inspection mismatch"
    );
  }
  scenariosPassed++;

  var oneInvalidInspection =
    inspectSourceDateQuality(
      fixture.raw.oneInvalid
    );

  if (
    oneInvalidInspection.sourceRows !== 2 ||
    JSON.stringify(oneInvalidInspection.invalidDateRowIndexes) !==
      JSON.stringify([2])
  )
  {
    throw new Error(
      "Single invalid-date inspection mismatch"
    );
  }
  scenariosPassed++;

  var multipleInvalidInspection =
    inspectSourceDateQuality(
      fixture.raw.multipleInvalid
    );

  if (
    multipleInvalidInspection.sourceRows !== 2 ||
    multipleInvalidInspection.invalidDateRowIndexes.length !== 2
  )
  {
    throw new Error(
      "Multiple invalid-date inspection mismatch"
    );
  }
  scenariosPassed++;

  var combinedResponse =
    buildFromRaw(
      fixture.raw.invalidAndMedium
    );

  if (
    combinedResponse.dataQuality.issueRows !== 2 ||
    combinedResponse.dataQuality.issueCount !== 2 ||
    combinedResponse.dataQuality.validRows !== 0 ||
    combinedResponse.dataQuality.status !== "Critical" ||
    combinedResponse.dataQuality.issues[0].code !==
      "INVALID_DATE" ||
    combinedResponse.dataQuality.issues[1].code !==
      "MISSING_SALES_PRODUCT"
  )
  {
    throw new Error(
      "Source and scoped issue combination mismatch"
    );
  }
  scenariosPassed++;

  var outsideResponse =
    buildFromRaw(
      fixture.raw.invalidOutsidePeriod
    );

  if (
    outsideResponse.dateFilter.rowCount !== 0 ||
    outsideResponse.dataQuality.issueCount !== 1 ||
    outsideResponse.dataQuality.status !== "Critical"
  )
  {
    throw new Error(
      "Invalid date outside selected period is not visible"
    );
  }
  scenariosPassed++;

  var allInvalidResponse =
    buildFromRaw(
      fixture.raw.allInvalid
    );

  if (
    allInvalidResponse.dateFilter.rowCount !== 0 ||
    allInvalidResponse.dataQuality.totalRows !== 0 ||
    allInvalidResponse.dataQuality.validRows !== 0 ||
    allInvalidResponse.dataQuality.issueRows !== 2 ||
    allInvalidResponse.dataQuality.issueCount !== 2 ||
    allInvalidResponse.dataQuality.status !== "Critical"
  )
  {
    throw new Error(
      "All-invalid source response mismatch"
    );
  }
  scenariosPassed++;

  var emptyInspection =
    inspectSourceDateQuality(
      fixture.raw.empty
    );

  if (
    emptyInspection.sourceRows !== 0 ||
    emptyInspection.invalidDateRowIndexes.length !== 0
  )
  {
    throw new Error(
      "Empty raw source inspection mismatch"
    );
  }
  scenariosPassed++;

  var headerOnlyInspection =
    inspectSourceDateQuality(
      fixture.raw.headerOnly
    );

  if (
    headerOnlyInspection.sourceRows !== 0 ||
    headerOnlyInspection.invalidDateRowIndexes.length !== 0
  )
  {
    throw new Error(
      "Header-only source inspection mismatch"
    );
  }
  scenariosPassed++;

  var oneInvalidResponse =
    buildFromRaw(
      fixture.raw.oneInvalid
    );

  if (
    oneInvalidResponse.dataQuality.scope.sourceRows !== 2 ||
    oneInvalidResponse.dataQuality.scope.scopedRows !== 1 ||
    oneInvalidResponse.dataQuality.scope.excludedInvalidDateRows !== 1
  )
  {
    throw new Error(
      "Data-quality scope counts mismatch"
    );
  }
  scenariosPassed++;

  var rawJson =
    JSON.stringify(fixture.raw.invalidAndMedium);

  inspectSourceDateQuality(
    fixture.raw.invalidAndMedium
  );
  buildFromRaw(
    fixture.raw.invalidAndMedium
  );

  if (
    JSON.stringify(fixture.raw.invalidAndMedium) !==
      rawJson
  )
  {
    throw new Error(
      "Source-quality pipeline mutated raw rows"
    );
  }
  scenariosPassed++;

  var withInvalidRows =
    fixture.raw.validOnly.concat([
      fixture.raw.oneInvalid[2]
    ]);

  var withInvalidResponse =
    buildFromRaw(withInvalidRows);

  var comparableValid = {};
  var comparableWithInvalid = {};

  Object.keys(validResponse).forEach(function(property)
  {
    if (
      property !== "dataQuality" &&
      property !== "businessPriority"
    )
    {
      comparableValid[property] =
        validResponse[property];
    }
  });

  Object.keys(withInvalidResponse).forEach(function(property)
  {
    if (
      property !== "dataQuality" &&
      property !== "businessPriority"
    )
    {
      comparableWithInvalid[property] =
        withInvalidResponse[property];
    }
  });

  if (
    JSON.stringify(comparableValid) !==
      JSON.stringify(comparableWithInvalid)
  )
  {
    throw new Error(
      "Invalid source rows changed analytics output"
    );
  }
  scenariosPassed++;

  if (
    allInvalidResponse.dateFilter.rowCount !== 0 ||
    allInvalidResponse.dataQuality.status !== "Critical" ||
    allInvalidResponse.dataQuality.scope.scopedRows !== 0
  )
  {
    throw new Error(
      "Analytics-empty Critical quality state mismatch"
    );
  }
  scenariosPassed++;

  var deduplicated =
    buildDataQualityDiagnostics(
      [{
        date: new Date(2026, 5, 10),
        transactionType: "Sales",
        product: "",
        qty: 1,
        sourceRowIndex: 1
      }],
      {
        sourceRows: 1,
        invalidDateRowIndexes: [1]
      }
    );

  if (
    deduplicated.issueRows !== 1 ||
    deduplicated.issueCount !== 2
  )
  {
    throw new Error(
      "Data-quality issue-row identity was double-counted"
    );
  }
  scenariosPassed++;

  var pipelineSource =
    buildDashboardDataExecution.toString();

  var readToken = "getCanonicalTransactionData(ss, performance)";
  var readIndex = pipelineSource.indexOf(readToken);
  var inspectIndex = pipelineSource.indexOf("sourceQuality");
  var processIndex = pipelineSource.indexOf("canonicalData.records");

  if (
    readIndex === -1 ||
    readIndex !== pipelineSource.lastIndexOf(readToken) ||
    processIndex < readIndex ||
    inspectIndex < processIndex
  )
  {
    throw new Error(
      "Dashboard source-quality pipeline order mismatch"
    );
  }
  scenariosPassed++;

  var source = getAssembledFrontendSource();

  fixture.frontendTokens.forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "source-quality frontend"
    );
  });

  assertSourceExcludes(
    source,
    "dataQualitySource",
    "raw data-quality provenance"
  );

  assertSourceExcludes(
    source,
    "sourceRowIndex",
    "source row identity"
  );

  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    invalidDateVisibility: true,
    analyticsIsolation: true
  };

  Logger.log(
    "PASS: testSourceDataQualityPipeline | scenarios=" +
    summary.scenarios +
    " | invalidDateVisibility=" +
    summary.invalidDateVisibility +
    " | analyticsIsolation=" +
    summary.analyticsIsolation
  );

  return summary;
}
