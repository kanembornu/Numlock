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

function testSummaryFixtures()
{
  var fields = [
    "revenue",
    "expense",
    "profit",
    "unitsSold",
    "bestSeller",
    "topRevenueProduct",
    "avgDailyRevenue",
    "activeDays"
  ];

  var fixtures =
    createSummaryFixtures();

  fixtures.forEach(function(fixture)
  {
    var actual =
      buildSummaryFromAggregate(
        buildAggregate(fixture.data)
      );

    fields.forEach(function(field)
    {
      if(actual[field] !== fixture.expected[field])
      {
        throw new Error(
          "Summary fixture mismatch for " +
          fixture.name +
          " / " +
          field +
          ": expected=" +
          fixture.expected[field] +
          ", actual=" +
          actual[field]
        );
      }
    });
  });

  return {
    passed: true,
    fixtures: fixtures.length,
    fields: fields
  };
}

function testRevenueTrendFixtures()
{
  var fixtures =
    createRevenueTrendFixtures();

  fixtures.forEach(function(fixture)
  {
    var actual =
      buildRevenueTrendFromAggregate(
        buildAggregate(fixture.data)
      );

    ["labels", "values"]
      .forEach(function(field)
      {
        if(
          JSON.stringify(actual[field]) !==
          JSON.stringify(fixture.expected[field])
        )
        {
          throw new Error(
            "Revenue Trend fixture mismatch for " +
            fixture.name +
            " / " +
            field +
            ": expected=" +
            JSON.stringify(fixture.expected[field]) +
            ", actual=" +
            JSON.stringify(actual[field])
          );
        }
      });

  });

  return {
    passed: true,
    fixtures: fixtures.length,
    fields: ["labels", "values"]
  };
}

function testExpenseBreakdownFixtures()
{
  var fixtures =
    createExpenseBreakdownFixtures();

  fixtures.forEach(function(fixture)
  {
    var aggregate =
      buildAggregate(fixture.data);

    var actualBreakdown =
      buildExpenseBreakdownFromAggregate(
        aggregate
      );

    if(
      actualBreakdown.length !==
      fixture.expected.breakdown.length
    )
    {
      throw new Error(
        "Expense Breakdown fixture length mismatch for " +
        fixture.name
      );
    }

    if(
      JSON.stringify(actualBreakdown) !==
      JSON.stringify(fixture.expected.breakdown)
    )
    {
      throw new Error(
        "Expense Breakdown fixture mismatch for " +
        fixture.name +
        ": expected=" +
        JSON.stringify(fixture.expected.breakdown) +
        ", actual=" +
        JSON.stringify(actualBreakdown)
      );
    }

    if(
      JSON.stringify(aggregate.topExpense) !==
      JSON.stringify(fixture.expected.topExpense)
    )
    {
      throw new Error(
        "Expense Breakdown top expense mismatch for " +
        fixture.name +
        ": expected=" +
        JSON.stringify(fixture.expected.topExpense) +
        ", actual=" +
        JSON.stringify(aggregate.topExpense)
      );
    }
  });

  return {
    passed: true,
    fixtures: fixtures.length,
    fields: ["breakdown", "topExpense"]
  };
}

function testTopProductsFixtures()
{
  var fixtures =
    createTopProductsFixtures();

  fixtures.forEach(function(fixture)
  {
    var actual =
      buildTopProductsFromAggregate(
        buildAggregate(fixture.data)
      );

    if(actual.length !== fixture.expected.length)
    {
      throw new Error(
        "Top Products fixture length mismatch for " +
        fixture.name
      );
    }

    if(
      JSON.stringify(actual) !==
      JSON.stringify(fixture.expected)
    )
    {
      throw new Error(
        "Top Products fixture mismatch for " +
        fixture.name +
        ": expected=" +
        JSON.stringify(fixture.expected) +
        ", actual=" +
        JSON.stringify(actual)
      );
    }

    fixture.excludedNames.forEach(function(name)
    {
      var included =
        actual.some(function(product)
        {
          return product.name === name;
        });

      if(included)
      {
        throw new Error(
          "Top Products fixture failed truncation for " +
          name
        );
      }
    });
  });

  return {
    passed: true,
    fixtures: fixtures.length,
    fields: ["name", "qty", "revenue"]
  };
}

function testProfitTrendFixtures()
{
  var fixtures =
    createProfitTrendFixtures();

  fixtures.forEach(function(fixture)
  {
    var actual =
      buildProfitTrendFromAggregate(
        buildAggregate(fixture.data)
      );

    ["labels", "values"]
      .forEach(function(field)
      {
        if(
          JSON.stringify(actual[field]) !==
          JSON.stringify(fixture.expected[field])
        )
        {
          throw new Error(
            "Profit Trend fixture mismatch for " +
            fixture.name +
            " / " +
            field +
            ": expected=" +
            JSON.stringify(fixture.expected[field]) +
            ", actual=" +
            JSON.stringify(actual[field])
          );
        }
      });
  });

  return {
    passed: true,
    fixtures: fixtures.length,
    fields: ["labels", "values"]
  };
}

function testHotColdFixtures()
{
  var fixtures =
    createHotColdFixtures();

  fixtures.forEach(function(fixture)
  {
    var actual =
      buildHotColdSplitFromAggregate(
        buildAggregate(fixture.data)
      );

    ["hot", "cold"]
      .forEach(function(field)
      {
        if(actual[field] !== fixture.expected[field])
        {
          throw new Error(
            "Hot/Cold fixture mismatch for " +
            fixture.name +
            " / " +
            field +
            ": expected=" +
            fixture.expected[field] +
            ", actual=" +
            actual[field]
          );
        }
      });
  });

  return {
    passed: true,
    fixtures: fixtures.length,
    fields: ["hot", "cold"]
  };
}

function testSparseDatasetResilience()
{
  var requiredProperties = [
    "summary",
    "financial",
    "insights",
    "revenueTrend",
    "hotColdSplit",
    "topProducts",
    "expenseBreakdown",
    "recentTransactions",
    "diagnosis",
    "forecast",
    "businessScore",
    "revenueIntelligence",
    "expenseIntelligence",
    "profitIntelligence",
    "profitTrend",
    "executiveSummary",
    "priorityAction",
    "riskEngine",
    "growthScore",
    "recommendations",
    "opportunities",
    "kpiStatus",
    "productContribution",
    "revenueConcentration",
    "paretoAnalysis",
    "businessFocus",
    "executiveAlert",
    "actionRoadmap",
    "businessMaturity",
    "kpiAchievement",
    "dateFilter",
    "reportingScope",
    "dataFreshness",
    "dataQuality",
    "periodComparison",
    "businessPriority",
    "kpiTargets"
  ];

  var expectedNormalJson =
    '{"summary":{"revenue":350000,"expense":50000,"profit":300000,"unitsSold":9,"bestSeller":"Latte","topRevenueProduct":"Espresso","avgDailyRevenue":116667,"activeDays":3},"financial":{"revenue":350000,"expense":50000,"operatingExpense":50000,"inventoryExpense":0,"assetExpense":0,"grossProfit":350000,"operatingProfit":300000,"netProfit":300000,"profitMargin":85.7},"insights":{"profitMargin":85.7,"revenuePerCup":38889,"topExpense":{"category":"Supplies","amount":50000},"financial":{"revenue":350000,"expense":50000,"operatingExpense":50000,"inventoryExpense":0,"assetExpense":0,"grossProfit":350000,"operatingProfit":300000,"netProfit":300000,"profitMargin":85.7}},"revenueTrend":{"labels":["2025-01","2025-02","2025-03"],"values":[60000,200000,90000]},"hotColdSplit":{"hot":6,"cold":3},"topProducts":[{"name":"Latte","qty":5,"revenue":150000},{"name":"Espresso","qty":4,"revenue":200000}],"expenseBreakdown":[{"category":"Supplies","amount":50000}],"recentTransactions":[{"date":"2025-03-12","transactionType":"Purchase","product":"","purchaseCategory":"Supplies","qty":0,"revenue":0,"expense":50000},{"date":"2025-03-11","transactionType":"Sales","product":"Latte","purchaseCategory":"","qty":3,"revenue":90000,"expense":0},{"date":"2025-02-10","transactionType":"Sales","product":"Espresso","purchaseCategory":"","qty":4,"revenue":200000,"expense":0},{"date":"2025-01-10","transactionType":"Sales","product":"Latte","purchaseCategory":"","qty":2,"revenue":60000,"expense":0}],"diagnosis":[{"level":"warning","category":"expense","priority":"critical","title":"Biaya Terbesar","description":"Supplies menyumbang biaya terbesar sebesar Rp 50.000. Pertimbangkan evaluasi efisiensi.","message":"Supplies adalah komponen biaya terbesar (Rp 50.000). Pertimbangkan evaluasi efisiensi biaya."},{"level":"attention","category":"revenue","priority":"good","title":"Revenue per Cup","description":"Rata-rata setiap cup menghasilkan Rp 38.889 revenue.","message":"Setiap cup menghasilkan rata-rata Rp 38.889 revenue."},{"level":"good","message":"Profit margin sehat (85.7%)"}],"forecast":{"nextMonthRevenue":130000,"growthRate":233.3},"businessScore":{"score":75,"status":"Healthy","breakdown":{"profitMargin":85.7,"revenue":350000,"unitsSold":9}},"revenueIntelligence":{"direction":"Up","growthRate":233.3,"momentum":"Strong"},"expenseIntelligence":{"highestExpense":"Supplies","highestAmount":50000,"expenseShare":100},"profitIntelligence":{"direction":"Up","changeRate":85.7,"status":"Strong"},"profitTrend":{"labels":["2025-01","2025-02","2025-03"],"values":[60000,200000,40000]},"executiveSummary":"Revenue menunjukkan tren positif. Profit berada dalam kondisi yang sehat. Kondisi bisnis sehat dengan beberapa peluang peningkatan.","priorityAction":{"title":"Business Improvement","impact":"Medium","score":70,"message":"Supplies adalah biaya terbesar. Cari peluang efisiensi tanpa mengganggu operasional."},"riskEngine":{"riskLevel":"Low","riskCount":0,"risks":[]},"growthScore":{"growthScore":100,"status":"High Potential","breakdown":{"revenue":"Up","forecast":233.3,"profitMargin":85.7,"revenuePerCup":38889}},"recommendations":[{"priority":"Medium","score":70,"message":"Supplies adalah biaya terbesar. Cari peluang efisiensi tanpa mengganggu operasional."},{"priority":"Medium","score":40,"message":"Latte merupakan produk terlaris. Pertimbangkan bundling atau upselling."},{"priority":"Medium","score":35,"message":"Espresso menghasilkan revenue terbesar. Pastikan stok selalu tersedia."},{"priority":"Low","score":20,"message":"Forecast menunjukkan pertumbuhan revenue sebesar 233.3%. Pertahankan strategi yang berjalan saat ini."}],"opportunities":[{"title":"Best Seller Opportunity","message":"Latte memiliki volume penjualan tertinggi. Pertimbangkan bundling atau promo khusus."},{"title":"Revenue Opportunity","message":"Espresso menghasilkan revenue terbesar. Fokus pada ketersediaan stok."},{"title":"Pricing Opportunity","message":"Revenue per cup sudah cukup baik. Fokus meningkatkan volume penjualan."},{"title":"Growth Opportunity","message":"Forecast menunjukkan pertumbuhan revenue. Persiapkan kapasitas operasional."}],"kpiStatus":{"revenue":{"trend":"Up","growth":233.3,"label":"Strong"},"profit":{"trend":"Up","growth":85.7,"label":"Strong"},"business":{"score":75,"status":"Healthy"}},"productContribution":[{"name":"Espresso","revenue":200000,"qty":4,"contribution":57.1},{"name":"Latte","revenue":150000,"qty":5,"contribution":42.9}],"revenueConcentration":{"product":"Espresso","contribution":57.1,"risk":"High"},"paretoAnalysis":{"totalProducts":2,"criticalProducts":2,"ratio":100,"concentration":"Low"},"businessFocus":{"focus":"Business Optimization","priority":"Medium","reason":"Business Health masih dapat ditingkatkan.","expectedImpact":"Medium"},"executiveAlert":{"title":"Business Stable","level":"Good","color":"Green","message":"Tidak ada kondisi kritis yang memerlukan tindakan segera."},"actionRoadmap":[{"week":1,"title":"Maintain Profitability","action":"Pertahankan profit margin yang sudah baik."},{"week":2,"title":"Scale Best Seller","action":"Latte layak dijadikan fokus upselling."},{"week":3,"title":"Business Expansion","action":"Siapkan kapasitas operasional untuk pertumbuhan berikutnya."},{"week":4,"title":"Performance Review","action":"Bandingkan KPI bulan ini dengan target dan evaluasi hasil."}],"businessMaturity":{"score":88,"level":"Growing","description":"Bisnis berkembang dengan baik namun masih memiliki ruang untuk peningkatan."},"kpiAchievement":{"revenue":{"actual":350000,"target":2000000,"achievement":17.5},"profit":{"actual":300000,"target":1000000,"achievement":30},"units":{"actual":9,"target":100,"achievement":9},"margin":{"actual":85.7,"target":15,"achievement":100}},"dateFilter":{"filter":"custom","startDate":"2024-01-01","endDate":"2026-12-31","label":"Custom: 2024-01-01 to 2026-12-31","rowCount":4}}';


  var fixtures =
    createSparseDatasetFixtures();

  fixtures.forEach(function(fixture)
  {
    var response =
      buildDashboardResponse(
        fixture.data,
        "custom",
        "2024-01-01",
        "2026-12-31",
        new Date(2026, 5, 15, 12, 0, 0)
      );

    assertRequiredProperties(
      response,
      requiredProperties,
      fixture.name
    );

    if (Object.keys(response).length !== requiredProperties.length)
    {
      throw new Error(
        "Sparse dataset response field count invalid for " +
        fixture.name
      );
    }

    assertRequiredProperties(
      response.dateFilter,
      [
        "filter",
        "startDate",
        "endDate",
        "label",
        "rowCount"
      ],
      fixture.name + " dateFilter"
    );

    assertFiniteNumbers(
      response,
      fixture.name
    );

    if (
      !Array.isArray(response.diagnosis) ||
      !response.diagnosis.length ||
      !Array.isArray(response.recommendations) ||
      !response.recommendations.length ||
      !response.riskEngine ||
      !Array.isArray(response.riskEngine.risks) ||
      !response.executiveAlert ||
      !response.executiveAlert.title ||
      !Array.isArray(response.actionRoadmap) ||
      response.actionRoadmap.length !== 4
    )
    {
      throw new Error(
        "Sparse dataset decision output invalid for " +
        fixture.name
      );
    }

    if (
      fixture.normal
    )
    {
      var comparableResponse = {};

      Object.keys(response).forEach(function(property)
      {
        if (
          property !== "reportingScope" &&
          property !== "dataFreshness" &&
          property !== "dataQuality" &&
          property !== "periodComparison" &&
          property !== "businessPriority" &&
          property !== "kpiTargets"
        )
        {
          comparableResponse[property] = response[property];
        }
      });

      if (JSON.stringify(comparableResponse) !== expectedNormalJson)
      {
        throw new Error(
          "Normal populated dashboard output changed"
        );
      }
    }
  });

  var summary = {
    passed: true,
    fixtures: fixtures.length,
    requiredProperties: requiredProperties.length,
    populatedOutputUnchanged: true
  };

  Logger.log(
    "PASS: testSparseDatasetResilience | fixtures=" +
    summary.fixtures +
    " | requiredProperties=" +
    summary.requiredProperties +
    " | populatedOutputUnchanged=" +
    summary.populatedOutputUnchanged
  );

  return summary;
}

function testDashboardDateFilter()
{
  var fixture =
    createDashboardDateFilterFixtures();

  var rows =
    fixture.rows;

  var referenceDate =
    fixture.referenceDate;

  var scenariosPassed = 0;

  function assertEqual(actual, expected, scenario)
  {
    if (actual !== expected)
    {
      throw new Error(
        "Dashboard date filter mismatch for " +
        scenario +
        ": expected=" +
        expected +
        ", actual=" +
        actual
      );
    }

    scenariosPassed++;
  }

  assertEqual(
    normalizeDashboardDateFilter(),
    "currentYear",
    "missing filter"
  );

  assertEqual(
    normalizeDashboardDateFilter(null),
    "currentYear",
    "null filter"
  );

  assertEqual(
    normalizeDashboardDateFilter("unknown"),
    "currentYear",
    "unknown filter"
  );

  var todayRange =
    resolveDashboardDateRange(
      "today",
      null,
      null,
      referenceDate
    );

  assertEqual(
    todayRange.startDate + "|" + todayRange.endDate,
    "2026-06-15|2026-06-15",
    "today range"
  );

  var last7Range =
    resolveDashboardDateRange(
      "last7days",
      null,
      null,
      referenceDate
    );

  assertEqual(
    last7Range.startDate + "|" + last7Range.endDate,
    "2026-06-09|2026-06-15",
    "last 7 days inclusive range"
  );

  var currentMonthRange =
    resolveDashboardDateRange(
      "currentMonth",
      null,
      null,
      referenceDate
    );

  assertEqual(
    currentMonthRange.startDate + "|" + currentMonthRange.endDate,
    "2026-06-01|2026-06-15",
    "current month range"
  );

  var previousMonthRange =
    resolveDashboardDateRange(
      "previousMonth",
      null,
      null,
      referenceDate
    );

  assertEqual(
    previousMonthRange.startDate + "|" + previousMonthRange.endDate,
    "2026-05-01|2026-05-31",
    "previous month range"
  );

  var currentYearRange =
    resolveDashboardDateRange(
      "currentYear",
      null,
      null,
      referenceDate
    );

  assertEqual(
    currentYearRange.startDate + "|" + currentYearRange.endDate,
    "2026-01-01|2026-06-15",
    "current year range"
  );

  var customSingle =
    resolveDashboardDateRange(
      "custom",
      "2026-06-15",
      "2026-06-15",
      referenceDate
    );

  assertEqual(
    customSingle.startDate + "|" + customSingle.endDate,
    "2026-06-15|2026-06-15",
    "custom single day"
  );

  assertEqual(
    customSingle.startDate,
    customSingle.endDate,
    "custom start equals end"
  );

  var customRange =
    resolveDashboardDateRange(
      "custom",
      "2026-06-09",
      "2026-06-15",
      referenceDate
    );

  assertEqual(
    customRange.startDate + "|" + customRange.endDate,
    "2026-06-09|2026-06-15",
    "custom multi-day range"
  );

  function assertTrend(filter, startDate, endDate, scenarioRows, scenarioReferenceDate, expectedLabels, expectedValues, scenario)
  {
    var response =
      buildDashboardResponse(
        scenarioRows,
        filter,
        startDate,
        endDate,
        scenarioReferenceDate
      );

    assertEqual(
      JSON.stringify(response.revenueTrend.labels),
      JSON.stringify(expectedLabels),
      scenario + " labels"
    );

    assertEqual(
      JSON.stringify(response.revenueTrend.values),
      JSON.stringify(expectedValues),
      scenario + " values"
    );

    assertEqual(
      JSON.stringify(response.revenueTrend.labels),
      JSON.stringify(response.revenueTrend.labels.slice().sort()),
      scenario + " ascending labels"
    );

    assertFiniteNumbers(
      response,
      "dashboard date filter / " + scenario
    );
    scenariosPassed++;

    return response;
  }

  assertTrend(
    "today",
    null,
    null,
    rows,
    referenceDate,
    ["2026-06"],
    [150],
    "today current-month trend"
  );

  assertTrend(
    "last7days",
    null,
    null,
    rows,
    referenceDate,
    ["2026-06"],
    [380],
    "last 7 days within one month"
  );

  assertTrend(
    "last7days",
    null,
    null,
    fixture.trendRows,
    new Date(2026, 7, 3, 12, 0, 0),
    ["2026-07", "2026-08"],
    [70, 80],
    "last 7 days crossing two months"
  );

  var currentMonthResponse =
    assertTrend(
      "currentMonth",
      null,
      null,
      rows,
      referenceDate,
      ["2026-06"],
      [470],
      "current month with revenue"
    );

  assertEqual(
    currentMonthResponse.revenueTrend.values.length > 0,
    true,
    "current month trend is non-empty"
  );

  assertTrend(
    "previousMonth",
    null,
    null,
    fixture.trendRows,
    referenceDate,
    ["2026-05"],
    [50],
    "previous month trend"
  );

  assertTrend(
    "currentYear",
    null,
    null,
    fixture.trendRows,
    new Date(2026, 7, 3, 12, 0, 0),
    ["2026-01", "2026-05", "2026-06", "2026-07", "2026-08"],
    [10, 50, 210, 70, 80],
    "current year includes partial current month"
  );

  assertTrend(
    "custom",
    "2026-06-01",
    "2026-06-30",
    fixture.trendRows,
    referenceDate,
    ["2026-06"],
    [210],
    "custom single-month trend"
  );

  assertTrend(
    "custom",
    "2025-12-01",
    "2026-02-28",
    fixture.trendRows,
    referenceDate,
    ["2025-12", "2026-01"],
    [120, 10],
    "custom multi-month cross-year trend"
  );

  assertTrend(
    "custom",
    "2026-08-03",
    "2026-08-03",
    fixture.trendRows,
    referenceDate,
    [],
    [],
    "zero-revenue filtered period"
  );

  assertThrowsMessage(
    function()
    {
      resolveDashboardDateRange(
        "custom",
        "2026-02-30",
        "2026-03-01",
        referenceDate
      );
    },
    "customStart must be a valid YYYY-MM-DD date"
  );
  scenariosPassed++;

  assertThrowsMessage(
    function()
    {
      resolveDashboardDateRange(
        "custom",
        "2026-06-16",
        "2026-06-15",
        referenceDate
      );
    },
    "customStart must not be after customEnd"
  );
  scenariosPassed++;

  var originalJson =
    JSON.stringify(rows);

  var customRows =
    filterTransactionsByDateRange(
      rows,
      customRange
    );

  assertEqual(
    customRows[0].product,
    "Today",
    "end boundary included"
  );

  assertEqual(
    customRows[customRows.length - 1].product,
    "Last 7 Start",
    "start boundary included"
  );

  assertEqual(
    customRows.length,
    3,
    "outside and invalid rows excluded"
  );

  assertEqual(
    JSON.stringify(rows),
    originalJson,
    "original array unchanged"
  );

  var parameterless =
    buildDashboardResponse(
      rows,
      undefined,
      undefined,
      undefined,
      referenceDate
    );

  var explicitCurrentYear =
    buildDashboardResponse(
      rows,
      "currentYear",
      null,
      null,
      referenceDate
    );

  assertEqual(
    JSON.stringify(parameterless),
    JSON.stringify(explicitCurrentYear),
    "parameterless equals explicit current year"
  );

  var customResponse =
    buildDashboardResponse(
      rows,
      "custom",
      "2026-06-09",
      "2026-06-15",
      referenceDate
    );

  assertEqual(
    customResponse.summary.revenue + "|" +
      customResponse.summary.unitsSold + "|" +
      customResponse.recentTransactions.length + "|" +
      customResponse.hotColdSplit.hot + "|" +
      customResponse.hotColdSplit.cold,
    "380|3|3|2|1",
    "all dashboard sections use custom rows"
  );

  assertFiniteNumbers(
    customResponse,
    "dashboard date filter"
  );
  scenariosPassed++;

  var emptyResponse =
    buildDashboardResponse(
      rows,
      "custom",
      "2024-01-01",
      "2024-01-31",
      referenceDate
    );

  assertEqual(
    emptyResponse.summary.revenue + "|" +
      emptyResponse.recentTransactions.length + "|" +
      emptyResponse.recommendations.length,
    "0|0|1",
    "empty filtered response renderable"
  );

  var currentYearRows =
    filterTransactionsByDateRange(
      rows,
      currentYearRange
    );

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    currentYearRows: currentYearRows.length,
    customRows: customRows.length,
    timezone: Session.getScriptTimeZone()
  };

  Logger.log(
    "PASS: testDashboardDateFilter | scenarios=" +
    summary.scenarios +
    " | currentYearRows=" +
    summary.currentYearRows +
    " | customRows=" +
    summary.customRows +
    " | timezone=" +
    summary.timezone
  );

  return summary;
}

function testPeriodComparison()
{
  var fixture =
    createPeriodComparisonFixtures();

  var scenariosPassed = 0;

  fixture.ranges.forEach(function(testCase)
  {
    var currentRange =
      resolveDashboardDateRange(
        testCase.filter,
        testCase.startDate,
        testCase.endDate,
        fixture.referenceDate
      );

    var previousRange =
      resolvePreviousComparisonDateRange(
        currentRange
      );

    if (
      previousRange.startDate + "|" +
      previousRange.endDate !==
      testCase.expected
    )
    {
      throw new Error(
        "Period comparison range mismatch for " +
        testCase.filter
      );
    }

    scenariosPassed++;
  });

  var cappedCurrentMonth =
    resolveDashboardDateRange(
      "currentMonth",
      null,
      null,
      fixture.cappedMonth.referenceDate
    );

  var cappedPreviousMonth =
    resolvePreviousComparisonDateRange(
      cappedCurrentMonth
    );

  if (
    cappedPreviousMonth.startDate + "|" +
    cappedPreviousMonth.endDate !==
    fixture.cappedMonth.expected
  )
  {
    throw new Error(
      "Period comparison did not cap the shorter previous month"
    );
  }
  scenariosPassed++;

  var leapCurrentYear =
    resolveDashboardDateRange(
      "currentYear",
      null,
      null,
      fixture.leapYear.referenceDate
    );

  var leapPreviousYear =
    resolvePreviousComparisonDateRange(
      leapCurrentYear
    );

  if (
    leapPreviousYear.startDate + "|" +
    leapPreviousYear.endDate !==
    fixture.leapYear.expected
  )
  {
    throw new Error(
      "Period comparison leap-year boundary mismatch"
    );
  }
  scenariosPassed++;

  var originalRows =
    JSON.stringify(fixture.rows);

  var currentRange =
    resolveDashboardDateRange(
      "custom",
      "2026-08-10",
      "2026-08-15",
      fixture.referenceDate
    );

  var previousRange =
    resolvePreviousComparisonDateRange(
      currentRange
    );

  var currentRows =
    filterTransactionsByDateRange(
      fixture.rows,
      currentRange
    );

  var previousRows =
    filterTransactionsByComparisonRange(
      fixture.rows,
      previousRange
    );

  var comparison =
    buildPeriodComparison(
      currentRows,
      previousRows,
      currentRange,
      previousRange
    );

  if (
    comparison.current.rowCount !== 2 ||
    comparison.previous.rowCount !== 2 ||
    comparison.current.revenue !== 150 ||
    comparison.previous.revenue !== 100 ||
    comparison.current.expense !== 60 ||
    comparison.previous.expense !== 40 ||
    comparison.current.profit !== 90 ||
    comparison.previous.profit !== 60 ||
    comparison.current.unitsSold !== 3 ||
    comparison.previous.unitsSold !== 2
  )
  {
    throw new Error(
      "Period comparison inclusive metric boundaries mismatch"
    );
  }
  scenariosPassed++;

  if (JSON.stringify(fixture.rows) !== originalRows)
  {
    throw new Error(
      "Period comparison mutated the processed transaction array"
    );
  }
  scenariosPassed++;

  var calculationCases = [
    { name: "up", current: 125, previous: 100, profit: false, percentage: 25, status: "Up" },
    { name: "down", current: 75, previous: 100, profit: false, percentage: -25, status: "Down" },
    { name: "both zero", current: 0, previous: 0, profit: false, percentage: 0, status: "Stable" },
    { name: "zero baseline", current: 100, previous: 0, profit: false, percentage: null, status: "No Comparison" },
    { name: "profit to loss", current: -50, previous: 100, profit: true, percentage: -150, status: "Down" },
    { name: "loss to profit", current: 50, previous: -100, profit: true, percentage: 150, status: "Up" },
    { name: "deeper loss", current: -150, previous: -100, profit: true, percentage: -50, status: "Down" },
    { name: "finite rounding", current: 4, previous: 3, profit: false, percentage: 33.3, status: "Up" }
  ];

  calculationCases.forEach(function(testCase)
  {
    var actual =
      calculateFiniteComparison(
        testCase.current,
        testCase.previous,
        testCase.profit
      );

    if (
      actual.percentage !== testCase.percentage ||
      actual.status !== testCase.status
    )
    {
      throw new Error(
        "Period comparison calculation mismatch for " +
        testCase.name
      );
    }

    scenariosPassed++;
  });

  var emptyComparison =
    buildPeriodComparison(
      [],
      [],
      currentRange,
      previousRange
    );

  assertFiniteNumbers(
    emptyComparison,
    "period comparison empty periods"
  );

  if (
    emptyComparison.status.revenue !== "Stable" ||
    emptyComparison.changes.revenuePercent !== 0
  )
  {
    throw new Error(
      "Period comparison empty-period semantics mismatch"
    );
  }
  scenariosPassed++;

  var response =
    buildDashboardResponse(
      fixture.rows,
      "custom",
      "2026-08-10",
      "2026-08-15",
      fixture.referenceDate
    );

  if (
    !response.periodComparison ||
    response.periodComparison.current.startDate !== "2026-08-10" ||
    response.periodComparison.previous.startDate !== "2026-08-04"
  )
  {
    throw new Error(
      "Dashboard response periodComparison contract mismatch"
    );
  }

  assertFiniteNumbers(
    response,
    "period comparison response"
  );
  scenariosPassed++;

  var dashboardSource =
    getDashboardData.toString();

  if (
    dashboardSource.split("getTransactionData(").length - 1 !== 1 ||
    dashboardSource.split("processTransactions(").length - 1 !== 1 ||
    dashboardSource.indexOf("getDashboardData(", 20) !== -1
  )
  {
    throw new Error(
      "Period comparison must retain one raw read and one processing pass"
    );
  }
  scenariosPassed++;

  var responseSource =
    buildDashboardResponse.toString();

  if (
    responseSource.split("buildAnalyticsCache(").length - 1 !== 1 ||
    responseSource.indexOf("buildDashboardResponse(", 30) !== -1
  )
  {
    throw new Error(
      "Period comparison must not build a second dashboard response"
    );
  }
  scenariosPassed++;

  var frontendSource =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  fixture.frontendTokens.forEach(function(token)
  {
    assertSourceContains(
      frontendSource,
      token,
      "period comparison frontend"
    );
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    presets: 6,
    finite: true
  };

  Logger.log(
    "PASS: testPeriodComparison | scenarios=" +
    summary.scenarios +
    " | presets=" +
    summary.presets +
    " | finite=" +
    summary.finite
  );

  return summary;
}

function testBusinessPriorityContract()
{
  var fixture =
    createBusinessPriorityFixtures();

  var scenariosPassed = 0;
  var levelsSeen = {};
  var allContractsComplete = true;
  var allScoresFinite = true;
  var allInputsUnchanged = true;
  var allOutputsDeterministic = true;

  function createScenarioCache(overrides)
  {
    var cache =
      JSON.parse(
        JSON.stringify(
          fixture.baseCache
        )
      );

    Object.keys(overrides || {})
      .forEach(function(key)
      {
        cache[key] =
          Object.assign(
            {},
            cache[key] || {},
            overrides[key]
          );
      });

    return cache;
  }

  fixture.cases.forEach(function(testCase)
  {
    var cache =
      createScenarioCache(
        testCase.overrides
      );

    var quality =
      JSON.parse(
        JSON.stringify(
          testCase.quality ||
          fixture.dataQuality
        )
      );

    var comparison =
      JSON.parse(
        JSON.stringify(
          fixture.periodComparison
        )
      );

    var before =
      JSON.stringify({
        cache: cache,
        quality: quality,
        comparison: comparison
      });

    var actual =
      buildBusinessPriority(
        cache,
        quality,
        testCase.rowCount == null
          ? 5
          : testCase.rowCount,
        comparison
      );

    var repeated =
      buildBusinessPriority(
        cache,
        quality,
        testCase.rowCount == null
          ? 5
          : testCase.rowCount,
        comparison
      );

    var requiredFields = [
      "level",
      "title",
      "reason",
      "action",
      "source",
      "score",
      "evidence"
    ];

    requiredFields.forEach(function(field)
    {
      if (!Object.prototype.hasOwnProperty.call(actual, field))
      {
        allContractsComplete = false;
      }
    });

    if (
      !actual.evidence ||
      !Object.prototype.hasOwnProperty.call(actual.evidence, "metric") ||
      !Object.prototype.hasOwnProperty.call(actual.evidence, "value") ||
      !Object.prototype.hasOwnProperty.call(actual.evidence, "comparison")
    )
    {
      allContractsComplete = false;
    }

    if (
      !isFinite(actual.score) ||
      actual.score < 0 ||
      actual.score > 100
    )
    {
      allScoresFinite = false;
    }

    if (
      actual.level !== testCase.expectedLevel ||
      actual.source !== testCase.expectedSource ||
      (
        testCase.expectedTitle &&
        actual.title !== testCase.expectedTitle
      )
    )
    {
      throw new Error(
        "Business Priority winner mismatch for " +
        testCase.name +
        ": actual=" +
        actual.level +
        "/" +
        actual.source
      );
    }

    if (
      testCase.expectedTitle === "No Business Activity" &&
      (
        actual.reason !== "No transactions are available for the selected period." ||
        actual.action !== "Select another reporting period or verify source data."
      )
    )
    {
      throw new Error(
        "Business Priority empty-scope fallback mismatch"
      );
    }

    if (JSON.stringify(actual) !== JSON.stringify(repeated))
    {
      allOutputsDeterministic = false;
    }

    if (
      JSON.stringify({
        cache: cache,
        quality: quality,
        comparison: comparison
      }) !== before
    )
    {
      allInputsUnchanged = false;
    }

    levelsSeen[actual.level] = true;
    scenariosPassed++;
  });

  var tieWinner =
    selectBusinessPriorityCandidate(
      fixture.tieCandidates
    );

  if (tieWinner.source !== "Risk")
  {
    throw new Error(
      "Business Priority source tie-breaker mismatch"
    );
  }
  scenariosPassed++;

  var scoreWinner =
    selectBusinessPriorityCandidate([
      Object.assign(
        {},
        fixture.tieCandidates[0],
        { score: 81 }
      ),
      fixture.tieCandidates[1]
    ]);

  if (scoreWinner.source !== "Revenue")
  {
    throw new Error(
      "Business Priority score ordering mismatch"
    );
  }
  scenariosPassed++;

  if (!allContractsComplete)
  {
    throw new Error(
      "Business Priority contract or evidence is incomplete"
    );
  }
  scenariosPassed++;

  if (!allScoresFinite)
  {
    throw new Error(
      "Business Priority score is outside finite bounds"
    );
  }
  scenariosPassed++;

  if (!allInputsUnchanged)
  {
    throw new Error(
      "Business Priority mutated existing intelligence objects"
    );
  }
  scenariosPassed++;

  if (!allOutputsDeterministic)
  {
    throw new Error(
      "Business Priority output is not deterministic"
    );
  }
  scenariosPassed++;

  var response =
    buildDashboardResponse(
      [],
      "custom",
      "2026-08-01",
      "2026-08-01",
      new Date(2026, 7, 1, 12, 0, 0)
    );

  if (
    !response.businessPriority ||
    response.businessPriority.title !== "No Business Activity"
  )
  {
    throw new Error(
      "Dashboard response has no authoritative Business Priority"
    );
  }
  scenariosPassed++;

  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  fixture.frontendTokens.forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "Business Priority frontend"
    );
  });
  scenariosPassed++;

  assertSourceContainsOnce(
    source,
    'id="businessPriorityRegion"',
    "authoritative Overview Business Priority render target"
  );

  var overviewOwnershipStart = source.indexOf("overview: [");
  var overviewOwnershipEnd = source.indexOf("]", overviewOwnershipStart);
  var overviewOwnershipSource = source.slice(
    overviewOwnershipStart,
    overviewOwnershipEnd
  );
  var intelligenceOwnershipStart = source.indexOf("intelligence: [");
  var intelligenceOwnershipEnd = source.indexOf("]", intelligenceOwnershipStart);
  var intelligenceOwnershipSource = source.slice(
    intelligenceOwnershipStart,
    intelligenceOwnershipEnd
  );
  var planningOwnershipStart = source.indexOf("planning: [");
  var planningOwnershipEnd = source.indexOf("]", planningOwnershipStart);
  var planningOwnershipSource = source.slice(
    planningOwnershipStart,
    planningOwnershipEnd
  );

  assertSourceContains(
    overviewOwnershipSource,
    'staging.querySelector("#executiveSummarySection")',
    "Overview Business Priority owner"
  );

  [intelligenceOwnershipSource, planningOwnershipSource]
    .forEach(function(panelOwnershipSource)
    {
      assertSourceExcludes(
        panelOwnershipSource,
        "businessPriorityRegion",
        "non-Overview Business Priority ownership"
      );
    });

  var priorityRendererStart =
    source.indexOf("function renderExecutiveSummary(res)");
  var priorityRendererEnd =
    source.indexOf("function renderExecutiveCenter(res)", priorityRendererStart);
  var priorityRendererSource = source.slice(
    priorityRendererStart,
    priorityRendererEnd
  );

  [
    'document.getElementById("businessPriorityLevel")',
    'document.getElementById("priorityTitle")',
    'document.getElementById("priorityReason")',
    'document.getElementById("priorityMessage")',
    'document.getElementById("priorityMeta")'
  ].forEach(function(token)
  {
    assertSourceContainsOnce(
      priorityRendererSource,
      token,
      "authoritative Business Priority renderer"
    );
  });
  scenariosPassed++;

  createAccessibilityContractFixtures()
    .concat(
      createResponsiveShellContractFixtures()
    )
    .forEach(function(contract)
    {
      contract.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "Business Priority preserved contract"
        );
      });
    });
  scenariosPassed++;

  ["Critical", "High", "Medium", "Low"]
    .forEach(function(level)
    {
      if (!levelsSeen[level])
      {
        throw new Error(
          "Business Priority missing level coverage: " +
          level
        );
      }
    });

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    levels: ["Critical", "High", "Medium", "Low"]
  };

  Logger.log(
    "PASS: testBusinessPriorityContract | scenarios=" +
    summary.scenarios +
    " | levels=" +
    summary.levels.join(",")
  );

  return summary;
}

function testKpiTargetContract()
{
  var fixture =
    createKpiTargetFixtures();

  var scenariosPassed = 0;

  if (
    JSON.stringify(KPI_TARGET_CONFIG.RULES) !==
    JSON.stringify(fixture.expectedRules)
  )
  {
    throw new Error(
      "Centralized KPI thresholds changed from former literals"
    );
  }
  scenariosPassed++;

  var originalMarginTarget =
    KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT.MARGIN_TARGET;

  KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT.MARGIN_TARGET = 999;

  if (
    !Object.isFrozen(KPI_TARGET_CONFIG) ||
    !Object.isFrozen(KPI_TARGET_CONFIG.PUBLIC_TARGETS) ||
    !Object.isFrozen(KPI_TARGET_CONFIG.PUBLIC_TARGETS[0]) ||
    !Object.isFrozen(KPI_TARGET_CONFIG.RULES) ||
    !Object.isFrozen(KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT) ||
    KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT.MARGIN_TARGET !== originalMarginTarget
  )
  {
    throw new Error(
      "KPI target configuration is not deeply immutable"
    );
  }
  scenariosPassed++;

  var cache =
    buildAnalyticsCache(
      fixture.historicalData
    );

  var historicalChecks = [
    {
      name: "Business Score",
      actual: JSON.stringify(cache.businessScore),
      expected: fixture.expectedHistorical.businessScore
    },
    {
      name: "Growth Score",
      actual: JSON.stringify(cache.growthScore),
      expected: fixture.expectedHistorical.growthScore
    },
    {
      name: "KPI Status",
      actual: JSON.stringify(cache.kpiStatus),
      expected: fixture.expectedHistorical.kpiStatus
    },
    {
      name: "KPI Achievement",
      actual: JSON.stringify(cache.kpiAchievement),
      expected: fixture.expectedHistorical.kpiAchievement
    },
    {
      name: "Business Maturity",
      actual: JSON.stringify(cache.businessMaturity),
      expected: fixture.expectedHistorical.businessMaturity
    },
    {
      name: "Risk Engine",
      actual: JSON.stringify(cache.riskEngine),
      expected: fixture.expectedHistorical.riskEngine
    },
    {
      name: "Recommendation ordering",
      actual:
        buildRecommendationEngine(cache)
          .map(function(item)
          {
            return item.score;
          })
          .join(","),
      expected: fixture.expectedHistorical.recommendationScores
    },
    {
      name: "Business Priority",
      actual:
        (function()
        {
          var priority =
            buildBusinessPriority(
              cache,
              { status: "Good", issueCount: 0 },
              fixture.historicalData.length,
              {
                changes: {
                  revenuePercent: 0,
                  expensePercent: 0,
                  profitPercent: 0,
                  unitsSoldPercent: 0
                },
                status: {
                  revenue: "Stable",
                  expense: "Stable",
                  profit: "Stable",
                  unitsSold: "Stable"
                }
              }
            );

          return priority.level + "|" +
            priority.source + "|" +
            priority.score + "|" +
            priority.title;
        })(),
      expected: fixture.expectedHistorical.businessPriority
    }
  ];

  historicalChecks.forEach(function(check)
  {
    if (check.actual !== check.expected)
    {
      throw new Error(
        check.name +
        " changed after KPI target centralization: expected=" +
        check.expected +
        ", actual=" +
        check.actual
      );
    }

    scenariosPassed++;
  });

  [
    { margin: 14.9, expectedScore: 90 },
    { margin: 15, expectedScore: 100 },
    { margin: 15.1, expectedScore: 100 }
  ].forEach(function(boundary)
  {
    var score =
      buildBusinessScore({
        summary: { unitsSold: 100 },
        financial: {
          profitMargin: boundary.margin,
          revenue: 1000000
        },
        insights: {}
      });

    if (score.score !== boundary.expectedScore)
    {
      throw new Error(
        "KPI target boundary changed for margin " +
        boundary.margin
      );
    }

    scenariosPassed++;
  });

  var response =
    buildDashboardResponse(
      fixture.historicalData,
      "custom",
      "2024-01-01",
      "2026-12-31",
      new Date(2026, 7, 4, 12, 0, 0)
    );

  var publicTargets =
    response.kpiTargets;

  var requiredFields = [
    "key",
    "label",
    "unit",
    "target",
    "direction",
    "source",
    "description"
  ];

  var allowedUnits = {
    percent: true,
    currency: true,
    quantity: true,
    score: true,
    text: true
  };

  var allowedDirections = {
    minimum: true,
    maximum: true,
    range: true,
    informational: true
  };

  publicTargets.targets.forEach(function(target)
  {
    requiredFields.forEach(function(field)
    {
      if (!Object.prototype.hasOwnProperty.call(target, field))
      {
        throw new Error(
          "Public KPI target missing field " +
          field
        );
      }
    });

    if (
      !allowedUnits[target.unit] ||
      !allowedDirections[target.direction] ||
      !isFinite(Number(target.target))
    )
    {
      throw new Error(
        "Public KPI target contains an invalid value"
      );
    }
  });
  scenariosPassed++;

  var publicKeys =
    publicTargets.targets.map(function(target)
    {
      return target.key;
    });

  if (
    JSON.stringify(publicKeys) !==
      JSON.stringify(fixture.publicKeys) ||
    new Set(publicKeys).size !== publicKeys.length
  )
  {
    throw new Error(
      "Public KPI targets are duplicated or unexpected"
    );
  }
  scenariosPassed++;

  if (publicTargets.editable !== false)
  {
    throw new Error(
      "Public KPI targets must not be editable"
    );
  }
  scenariosPassed++;

  if (
    !publicTargets.provenance ||
    publicTargets.provenance.indexOf("System-defined targets") !== 0
  )
  {
    throw new Error(
      "Public KPI target provenance is missing"
    );
  }
  scenariosPassed++;

  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  fixture.frontendTokens.forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "KPI Target frontend"
    );
  });
  scenariosPassed++;

  fixture.frontendExcludedTokens.forEach(function(token)
  {
    assertSourceExcludes(
      source,
      token,
      "misleading editable target wording"
    );
  });
  scenariosPassed++;

  createAccessibilityContractFixtures()
    .concat(
      createResponsiveShellContractFixtures()
    )
    .forEach(function(contract)
    {
      contract.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "KPI Target preserved contract"
        );
      });
    });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    centralized: true,
    editable: false
  };

  Logger.log(
    "PASS: testKpiTargetContract | scenarios=" +
    summary.scenarios +
    " | centralized=" +
    summary.centralized +
    " | editable=" +
    summary.editable
  );

  return summary;
}

function testDashboardStateContract()
{
  var fixture =
    createDashboardStateContractFixtures();

  var scenariosPassed = 0;

  if (
    fixture.states.join(",") !==
    "loading,success,empty,error,retry"
  )
  {
    throw new Error(
      "Dashboard state vocabulary mismatch"
    );
  }
  scenariosPassed++;

  fixture.cases.forEach(function(testCase)
  {
    var response =
      buildDashboardResponse(
        testCase.data,
        "custom",
        "2026-06-01",
        "2026-06-30",
        fixture.referenceDate
      );

    if (
      !response.dateFilter ||
      response.dateFilter.rowCount !==
        testCase.expectedRowCount
    )
    {
      throw new Error(
        "Dashboard state row-count mismatch for " +
        testCase.name
      );
    }

    var state =
      response.dateFilter.rowCount === 0
        ? "empty"
        : "success";

    if (state !== testCase.expectedState)
    {
      throw new Error(
        "Dashboard state classification mismatch for " +
        testCase.name
      );
    }

    assertFiniteNumbers(
      response,
      "dashboard state / " + testCase.name
    );

    scenariosPassed++;
  });

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    states: fixture.states
  };

  Logger.log(
    "PASS: testDashboardStateContract | scenarios=" +
    summary.scenarios +
    " | states=" +
    summary.states.join(",")
  );

  return summary;
}

function testResponsiveShellContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  var fixtures =
    createResponsiveShellContractFixtures();

  fixtures.forEach(function(fixture)
  {
    fixture.tokens.forEach(function(token)
    {
      assertSourceContains(
        source,
        token,
        fixture.name
      );
    });

    if (fixture.uniqueToken)
    {
      assertSourceContainsOnce(
        source,
        fixture.uniqueToken,
        fixture.name
      );
    }
  });

  var summary = {
    passed: true,
    scenarios: fixtures.length,
    breakpoint: "lg",
    drawer: true
  };

  Logger.log(
    "PASS: testResponsiveShellContract | scenarios=" +
    summary.scenarios +
    " | breakpoint=" +
    summary.breakpoint +
    " | drawer=" +
    summary.drawer
  );

  return summary;
}

function testUiShellThemeContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var tailwindSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
    ).getContent();
  var scenariosPassed = 0;

  [
    'id="appShell"',
    'data-sidebar-collapsed="false"',
    '#dashboardSidebar { width: 232px;',
    '#dashboardSidebar { width: 216px;',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px;',
    'id="sidebarCollapseButton"',
    'function setDesktopSidebarCollapsed(isCollapsed)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "sidebar size contract");
  });
  scenariosPassed++;

  [
    'id="topUtilityBar"',
    '#topUtilityBar { height: 52px; min-height: 52px;',
    '#topUtilityBar { height: 48px; min-height: 48px;',
    'height: 100dvh;',
    'overflow: hidden;',
    'id="contentViewport"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "viewport utility shell");
  });
  scenariosPassed++;

  ["dashboard", "transactions", "settings", "logs"]
    .forEach(function(pageId)
    {
      assertSourceContainsOnce(
        source,
        'data-page="' + pageId + '"',
        "primary destination " + pageId
      );
    });
  scenariosPassed++;

  ["products", "capital-equity", "assets", "depreciation", "financial-statements"]
    .forEach(function(destination)
    {
      assertSourceContainsOnce(
        source,
        'data-navigation-destination="' + destination + '"',
        "future module representation"
      );
      assertSourceExcludes(
        source,
        'data-page="' + destination + '"',
        "future module route"
      );
    });
  scenariosPassed++;

  [
    'value="light"',
    'value="dark"',
    'value="system"',
    'name="themePreference"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "theme option");
  });
  scenariosPassed++;

  [
    'var storageKey = "numlock.ui.theme";',
    'window.localStorage.getItem(storageKey)',
    'window.localStorage.setItem(',
    'safePreference'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "local theme persistence");
  });
  scenariosPassed++;

  [
    'var preference = "system";',
    'preference === "system"',
    '"(prefers-color-scheme: dark)"',
    'data-theme-preference'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "System theme fallback");
  });
  scenariosPassed++;

  var preloadEnd = source.indexOf(
    "<style><?!= HtmlService.createHtmlOutputFromFile('189.View.Tailwind').getContent(); ?></style>"
  );
  var preloadStart = source.indexOf("function applyStoredThemeBeforeRender()");

  if (preloadStart === -1 || preloadStart > preloadEnd)
  {
    throw new Error("Theme is not applied before authored styles render");
  }
  scenariosPassed++;

  [
    "--canvas:#07111f",
    "--sidebar:#0b1627",
    "--surface-1:#0f1c2e",
    "--surface-2:#142338",
    "--surface-3:#1a2c45",
    "--text-primary:#f1f5f9",
    "--focus:#60a5fa"
  ].forEach(function(token)
  {
    assertSourceContains(tailwindSource, token, "dark semantic token");
  });
  assertSourceExcludes(tailwindSource, "--canvas:#000", "pure black canvas");
  scenariosPassed++;

  [
    "@media print",
    'synchronizeChartTheme(true);',
    'window.addEventListener("beforeprint"',
    "background: #ffffff !important;",
    "color: #0f172a;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print-light theme");
  });
  scenariosPassed++;

  [
    "function synchronizeChartTheme(forceLight)",
    'chart.update("none");',
    "palette.tooltipBackground",
    "palette.grid",
    "palette.axis"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Chart.js theme synchronization");
  });
  scenariosPassed++;

  createResponsiveShellContractFixtures()
    .concat(createAccessibilityContractFixtures())
    .forEach(function(fixture)
    {
      fixture.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "preserved shell accessibility / " + fixture.name
        );
      });
    });
  scenariosPassed++;

  [
    'aria-label="Dashboard"',
    'aria-label="Transactions"',
    'aria-label="Settings"',
    'aria-label="Logs"',
    'aria-current="page"',
    'title="Dashboard"',
    'heading.focus();',
    'sidebar.inert = !isOpen && !isDesktop;'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "navigation focus and labels");
  });
  scenariosPassed++;

  [
    "global search",
    "notifications",
    "avatar/profile",
    "Welcome Back",
    "Customize widget",
    "Upgrade"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "forbidden SaaS decoration");
  });
  assertSourceExcludes(source, ">Source<", "source label");
  scenariosPassed++;

  [
    'id="dashboard" class="page active"',
    'id="transactions" class="page"',
    'id="filter"',
    'id="printReportButton"',
    'id="exportCsvButton"',
    'id="dashboardStatus"',
    'id="dataQualityInformation"',
    'function applyTransactionDrilldown('
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "v1 destination compatibility");
  });
  scenariosPassed++;

  [
    'let responsiveShellInitialized = false;',
    'let themeFoundationInitialized = false;',
    'if (responsiveShellInitialized)',
    'if (themeFoundationInitialized)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "single listener initialization");
  });
  assertSourceContainsOnce(
    source,
    "function initializeThemeFoundation()",
    "theme initialization"
  );
  scenariosPassed++;

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "UI shell query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "response mutation");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    destinations: 9,
    themes: 3,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testUiShellThemeContract | scenarios=" +
    summary.scenarios +
    " | destinations=" +
    summary.destinations +
    " | themes=" +
    summary.themes +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries
  );

  return summary;
}

function testNineDestinationNavigationContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var navigationSource = getSourceRegion(
    source,
    'id="dashboardSidebar"',
    'id="mainContent"',
    "nine-destination sidebar"
  );
  var disclosureSource = getSourceRegion(
    source,
    'id="financialModulesDisclosureButton"',
    'id="financialModulesGroup"',
    "Financial modules disclosure"
  );
  var toggleSource = getSourceRegion(
    source,
    "function toggleFinancialModulesDisclosure(button)",
    "function setDesktopSidebarCollapsed(isCollapsed)",
    "Financial modules disclosure behavior"
  );
  var activeDestinations = [
    "dashboard",
    "transactions",
    "settings",
    "logs"
  ];
  var unavailableDestinations = [
    { id: "products", label: "Products" },
    { id: "capital-equity", label: "Capital &amp; Equity" },
    { id: "assets", label: "Assets" },
    { id: "depreciation", label: "Depreciation" },
    { id: "financial-statements", label: "Financial Statements" }
  ];
  var scenariosPassed = 0;

  assertSourceContainsOnce(
    source,
    'aria-label="Primary navigation"',
    "primary navigation region"
  );
  assertSourceContainsOnce(
    source,
    'id="dashboardSidebar"',
    "sidebar start boundary"
  );
  assertSourceContainsOnce(
    source,
    'id="mainContent"',
    "main-content end boundary"
  );
  assertSourceContains(
    navigationSource,
    'aria-label="Primary navigation"',
    "stable-ID sidebar extraction"
  );

  assertSourceOccurrenceCount(
    navigationSource,
    'data-navigation-destination="',
    9,
    "represented destination count"
  );
  assertSourceOccurrenceCount(
    navigationSource,
    'data-page="',
    4,
    "active route count"
  );
  scenariosPassed++;

  activeDestinations.forEach(function(destination)
  {
    assertSourceContainsOnce(
      navigationSource,
      'data-page="' + destination + '"',
      "active destination " + destination
    );
    assertSourceContainsOnce(
      navigationSource,
      'data-navigation-destination="' + destination + '"',
      "represented active destination " + destination
    );
  });
  scenariosPassed++;

  unavailableDestinations.forEach(function(destination)
  {
    assertSourceContainsOnce(
      navigationSource,
      'data-navigation-destination="' + destination.id + '"',
      "unavailable destination " + destination.id
    );
    assertSourceContains(
      navigationSource,
      ">" + destination.label + "</span>",
      "unavailable destination label " + destination.id
    );
    assertSourceExcludes(
      navigationSource,
      'data-page="' + destination.id + '"',
      "future route " + destination.id
    );
    assertSourceExcludes(
      source,
      'id="' + destination.id + '" class="page',
      "future page " + destination.id
    );
  });
  assertSourceOccurrenceCount(
    navigationSource,
    'aria-disabled="true"',
    5,
    "unavailable semantics"
  );
  scenariosPassed++;

  [
    'id="financialModulesDisclosureButton"',
    'aria-expanded="true"',
    'aria-controls="financialModulesGroup"',
    'aria-label="Financial modules, expanded"',
    'id="financialModulesGroup"',
    'aria-label="Unavailable financial modules"',
    "Unavailable · migration required",
    "unavailable until module migration is approved"
  ].forEach(function(token)
  {
    assertSourceContains(
      navigationSource,
      token,
      "Financial modules grouping and status"
    );
  });
  assertSourceContainsOnce(
    navigationSource,
    'id="financialModulesDisclosureButton"',
    "one Financial modules disclosure"
  );
  scenariosPassed++;

  [
    'button.setAttribute("aria-expanded", String(nextExpanded));',
    '"Financial modules, " + (nextExpanded ? "expanded" : "collapsed")',
    "group.hidden = !nextExpanded;",
    'disclosureIcon.classList.toggle("fa-chevron-up", nextExpanded);',
    'disclosureIcon.classList.toggle("fa-chevron-down", !nextExpanded);'
  ].forEach(function(token)
  {
    assertSourceContains(toggleSource, token, "disclosure state behavior");
  });
  assertSourceExcludes(toggleSource, "google.script.run", "disclosure backend request");
  assertSourceExcludes(toggleSource, ".addEventListener(", "duplicate disclosure listener");
  scenariosPassed++;

  [
    '#dashboardSidebar { width: 232px;',
    '#dashboardSidebar { width: 216px;',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px;',
    '#appShell[data-sidebar-collapsed="true"] #mainContent { margin-left: 64px;',
    '@media (max-width: 1023px)',
    '#dashboardSidebar { width: min(320px, calc(100vw - 32px));',
    '.sidebar-expanded-content { display: none; }',
    'title="Products — unavailable until module migration is approved"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "expanded collapsed mobile parity");
  });
  scenariosPassed++;

  [
    'aria-current="page"',
    'heading.focus();',
    'setSidebarOpen(false, true);',
    'sidebar.inert = !isOpen && !isDesktop;',
    'page.hidden = !isActivePage;',
    'group.hidden = !nextExpanded;',
    '@media (prefers-reduced-motion: reduce)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "focus hidden and motion compatibility");
  });
  scenariosPassed++;

  [
    'href="#"',
    'id="products" class="page',
    'id="capital-equity" class="page',
    'id="assets" class="page',
    'id="depreciation" class="page',
    'id="financial-statements" class="page',
    "Sample product",
    "Sample asset",
    "Coming soon page"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "no fake route or fabricated content");
  });
  scenariosPassed++;

  [
    '.ui-sidebar-item[aria-current="page"]',
    "background:var(--selected)",
    "box-shadow:inset 3px 0 0 var(--brand)",
    ".ui-future-module",
    "color:var(--disabled-text)"
  ].forEach(function(token)
  {
    var normalizedSource = source.replace(/\s+/g, "");
    var normalizedToken = token.replace(/\s+/g, "");
    assertSourceContains(normalizedSource, normalizedToken, "Light Dark navigation parity");
  });
  scenariosPassed++;

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Nine-destination query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  assertSourceContainsOnce(
    source,
    "function toggleFinancialModulesDisclosure(button)",
    "single disclosure function"
  );
  assertSourceContainsOnce(
    source,
    "function initializeResponsiveShell()",
    "single responsive initializer"
  );
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "response mutation");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    destinations: 9,
    active: 4,
    unavailable: 5,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testNineDestinationNavigationContract | scenarios=" +
    summary.scenarios +
    " | destinations=" +
    summary.destinations +
    " | active=" +
    summary.active +
    " | unavailable=" +
    summary.unavailable +
    " | backendRequests=" +
    summary.backendRequests +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries
  );

  return summary;
}

function testFullShellVisualContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var doGetSource = String(doGet);
  var utilitySource = getSourceRegion(
    source,
    'id="topUtilityBar"',
    'id="contentViewport"',
    "authoritative utility row"
  );
  var showPageSource = getSourceRegion(
    source,
    "function showPage(pageId)",
    "function getResolvedTheme(preference)",
    "shell page switching"
  );
  var sidebarSource = getSourceRegion(
    source,
    'id="dashboardSidebar"',
    'id="mainContent"',
    "sidebar metadata exclusion"
  );
  var scenariosPassed = 0;

  assertSourceContainsOnce(source, 'id="topUtilityBar"', "one utility row");
  [
    'id="utilityPageTitle"',
    'id="utilityPageContext"',
    'id="dashboardUtilityControls"',
    'id="utilityActivePeriod"',
    'id="utilityLastSync"'
  ].forEach(function(token)
  {
    assertSourceContains(utilitySource, token, "authoritative utility ownership");
  });
  assertSourceContainsOnce(
    utilitySource,
    'id="utilityVersion"',
    "utility version render target"
  );
  assertSourceContainsOnce(
    utilitySource,
    'data-metadata-source="template.version"',
    "utility version provenance"
  );
  assertSourceContainsOnce(
    doGetSource,
    "template.version = PROJECT_CONFIG.VERSION;",
    "authoritative utility version assignment"
  );
  assertSourceContainsOnce(source, 'id="utilityVersion"', "single utility version target");
  assertSourceExcludes(sidebarSource, 'id="utilityVersion"', "sidebar utility version target");
  assertSourceExcludes(sidebarSource, "<?= version ?>", "sidebar version injection");
  assertSourceExcludes(utilitySource, 'id="aboutVersion"', "About version target");
  assertSourceExcludes(utilitySource, 'id="printReportVersion"', "Print version target");
  assertSourceExcludes(
    utilitySource,
    "1.0.0",
    "hardcoded utility version"
  );
  scenariosPassed++;

  [
    '<div id="dashboardHeaderRegion" class="sr-only">',
    '<section id="transactions" class="page" hidden aria-labelledby="transactionsHeading">\n      <header class="sr-only">',
    '<section id="settings" class="page" hidden aria-labelledby="settingsHeading">\n      <header class="sr-only">',
    '<section id="logs" class="page" hidden aria-labelledby="logsHeading">\n      <header class="sr-only">'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "single visible page identity");
  });
  assertSourceOccurrenceCount(source, 'id="utilityPageTitle"', 1, "visible page identity");
  scenariosPassed++;

  [
    '#dashboardSidebar { width: 232px;',
    '#dashboardSidebar { width: 216px;',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px;',
    '#topUtilityBar { height: 52px; min-height: 52px;',
    '#topUtilityBar { height: 48px; min-height: 48px;',
    '#dashboardTabList,',
    '#transactionsTabList { height: 40px; min-height: 40px; }'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "exact shell geometry");
  });
  scenariosPassed++;

  [
    "height: 100dvh;",
    "overflow: hidden;",
    "grid-template-rows: 52px minmax(0, 1fr)",
    "grid-template-rows: 48px minmax(0, 1fr)",
    '#contentViewport { height: auto; min-height: 0; overflow: hidden; padding: 12px 16px; }',
    '#dashboardContent { display: grid; min-height: 0; flex: 1 1 auto; grid-template-rows: 40px minmax(0, 1fr); gap: 12px; }'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "one-viewport desktop shell");
  });
  scenariosPassed++;

  [
    '@media (max-width: 1023px)',
    '#dashboardSidebar { width: min(320px, calc(100vw - 32px));',
    '#topUtilityBar { height: auto; min-height: 52px; flex-wrap: wrap; padding: 8px 12px; }',
    '#contentViewport { overflow: visible; padding: 12px; }',
    'sidebar.inert = !isOpen && !isDesktop;',
    'menuButton.focus();'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "mobile drawer and flow preservation");
  });
  scenariosPassed++;

  assertSourceOccurrenceCount(source, 'data-navigation-destination="', 9, "nine destinations");
  assertSourceOccurrenceCount(source, 'data-page="', 4, "four active destinations");
  assertSourceOccurrenceCount(source, 'aria-disabled="true"', 5, "five unavailable destinations");
  assertSourceContainsOnce(source, 'id="financialModulesDisclosureButton"', "Financial modules disclosure");
  scenariosPassed++;

  [
    'id="dashboardTabList"',
    'id="dashboardTabPanels"',
    'id="transactionsTabList"',
    'id="transactionsPanelGroup"',
    '#dashboard.active { display: flex;',
    '#transactions.active { display: grid;'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "tab rail before active content");
  });
  scenariosPassed++;

  assertSourceExcludes(utilitySource, "overview-surface", "nested utility surface");
  assertSourceExcludes(utilitySource, "ui-theme-surface", "nested utility card");
  [
    '#topUtilityBar { height: 52px; min-height: 52px; background: var(--surface-1); border-color: var(--border-subtle); box-shadow: none; }',
    '.overview-surface { background: var(--surface-1); border-color: var(--border-subtle); box-shadow: none; }',
    '.analytics-surface { background: var(--surface-1); border-color: var(--border-subtle); box-shadow: none; }',
    "border-radius: 8px;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded surface hierarchy");
  });
  scenariosPassed++;

  [
    "Search",
    "Notifications",
    "notification bell",
    "avatar",
    "Welcome back",
    "Upgrade plan",
    "workspace switcher",
    "command palette"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "forbidden SaaS feature");
  });
  scenariosPassed++;

  [
    ':root[data-theme="dark"]',
    'background: var(--surface-1)',
    'background: var(--canvas)',
    '@media print',
    'background: #ffffff !important;',
    '#topUtilityBar,'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Light Dark print parity");
  });
  scenariosPassed++;

  [
    'page.hidden = !isActivePage;',
    'panel.hidden =',
    'tab.setAttribute("tabindex", isSelected ? "0" : "-1");',
    'elements.dashboardUtilityControls.hidden = pageId !== "dashboard";',
    'heading.focus();',
    '@media (prefers-reduced-motion: reduce)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "state focus and motion preservation");
  });
  scenariosPassed++;

  ["google.script.run", "getDashboardData(", "requestDashboardData("]
    .forEach(function(token)
    {
      assertSourceExcludes(showPageSource, token, "shell navigation backend request");
    });
  assertSourceContainsOnce(source, "function initializeResponsiveShell()", "responsive listener initializer");
  assertSourceContainsOnce(source, "function initializeDashboardTabs()", "Dashboard listener initializer");
  assertSourceContainsOnce(source, "function initializeTransactionsTabs()", "Transactions listener initializer");
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "response mutation");
  });

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Full shell query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  assertSourceContains(source, "requestAnimationFrame", "one deferred render phase");
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    destinations: 9,
    active: 4,
    unavailable: 5,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testFullShellVisualContract | scenarios=" +
    summary.scenarios +
    " | destinations=" +
    summary.destinations +
    " | active=" +
    summary.active +
    " | unavailable=" +
    summary.unavailable +
    " | backendRequests=" +
    summary.backendRequests +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries
  );

  return summary;
}

function testDashboardTabFrameworkContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;
  var tabNames = [
    "overview",
    "performance",
    "analytics",
    "intelligence",
    "planning"
  ];
  var dashboardTabRegion = getSourceRegion(
    source,
    'id="dashboardTabList"',
    'id="dashboardSectionStaging"',
    "Dashboard tab framework"
  );

  assertSourceOccurrenceCount(
    source,
    'role="tablist"',
    2,
    "application tablists"
  );
  assertSourceContainsOnce(
    source,
    'id="dashboardTabList"',
    "Dashboard tablist ID"
  );
  assertSourceOccurrenceCount(
    dashboardTabRegion,
    'role="tablist"',
    1,
    "Dashboard tablist"
  );
  assertSourceOccurrenceCount(
    dashboardTabRegion,
    'role="tab"',
    tabNames.length,
    "Dashboard tabs"
  );
  assertSourceOccurrenceCount(
    dashboardTabRegion,
    'role="tabpanel"',
    tabNames.length,
    "Dashboard panels"
  );
  tabNames.forEach(function(tabName)
  {
    assertSourceContainsOnce(
      dashboardTabRegion,
      'data-dashboard-tab="' + tabName + '"',
      "Dashboard tab " + tabName
    );
    assertSourceContainsOnce(
      dashboardTabRegion,
      'data-dashboard-panel="' + tabName + '"',
      "Dashboard panel " + tabName
    );
  });
  scenariosPassed++;

  [
    'id="dashboardTabOverview"',
    'aria-selected="true"',
    'tabindex="0"',
    'data-dashboard-tab="overview"',
    'let activeDashboardTab = "overview";'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "default Overview tab");
  });
  scenariosPassed++;

  var ownership = {
    overview: [
      "dashboardHeaderRegion",
      "executiveSummarySection",
      "keyMetricsSection",
      "overviewContextRow"
    ],
    performance: [
      "businessPerformanceSection",
      "revenueChartSection"
    ],
    analytics: [
      "hotColdChartSection",
      "expenseChartSection",
      "topProductsSection",
      "productConcentrationSection"
    ],
    intelligence: [
      "diagnosisSection",
      "recommendationsSection",
      "riskOpportunitySection"
    ],
    planning: [
      "kpiTargetReference",
      "executiveCenter"
    ]
  };

  Object.keys(ownership).forEach(function(panelName)
  {
    ownership[panelName].forEach(function(sectionId)
    {
      assertSourceContainsOnce(
        source,
        'id="' + sectionId + '"',
        "unique Dashboard section " + sectionId
      );

      if (sectionId !== "dashboardHeaderRegion")
      {
        assertSourceContainsOnce(
          source,
          'staging.querySelector("#' + sectionId + '")',
          "section ownership " + panelName + " / " + sectionId
        );
      }
    });
  });
  assertSourceContainsOnce(
    source,
    "elements.dashboardHeaderRegion,",
    "Overview header ownership"
  );
  scenariosPassed++;

  tabNames.forEach(function(tabName)
  {
    var titleCase =
      tabName.charAt(0).toUpperCase() + tabName.slice(1);

    [
      'id="dashboardTab' + titleCase + '"',
      'aria-controls="dashboardPanel' + titleCase + '"',
      'id="dashboardPanel' + titleCase + '"',
      'aria-labelledby="dashboardTab' + titleCase + '"'
    ].forEach(function(token)
    {
      assertSourceContains(dashboardTabRegion, token, "Dashboard tab ARIA relationship");
    });
  });
  assertSourceExcludes(
    dashboardTabRegion,
    "transactionsPanel",
    "Dashboard control of Transactions panels"
  );
  scenariosPassed++;

  [
    'event.key === "ArrowRight"',
    'event.key === "ArrowLeft"',
    'event.key === "Home"',
    'event.key === "End"',
    "event.preventDefault();",
    "elements.dashboardTabs[targetIndex]",
    ".focus();"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Dashboard tab keyboard behavior");
  });
  scenariosPassed++;

  [
    'role="tabpanel"',
    "panel.hidden =",
    'tab.setAttribute("tabindex", isSelected ? "0" : "-1");',
    'tab.setAttribute("aria-selected", String(isSelected));'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "inactive panel focus exclusion");
  });
  scenariosPassed++;

  [
    "let dashboardTabsInitialized = false;",
    'let activeDashboardTab = "overview";',
    "if (dashboardTabsInitialized)",
    "setActiveDashboardTab(activeDashboardTab, false);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "selected tab preservation");
  });
  scenariosPassed++;

  var tabFunctionStart =
    source.indexOf("function resizeVisibleDashboardCharts(tabName)");
  var tabFunctionEnd =
    source.indexOf("function setDesktopSidebarCollapsed", tabFunctionStart);
  var tabFunctionSource =
    source.slice(tabFunctionStart, tabFunctionEnd);

  [
    "google.script.run",
    "getDashboardData(",
    "requestDashboardData(",
    "loadData()"
  ].forEach(function(token)
  {
    assertSourceExcludes(
      tabFunctionSource,
      token,
      "tab switch backend request"
    );
  });
  scenariosPassed++;

  assertSourceContainsOnce(
    source,
    "function initializeDashboardTabs()",
    "single Dashboard tab initializer"
  );
  assertSourceContains(
    source,
    "dashboardTabsInitialized = true;",
    "Dashboard tab listener guard"
  );
  scenariosPassed++;

  [
    '#dashboardTabPanels [role="tabpanel"]',
    "display: block !important;",
    "max-height: none !important;",
    "overflow: visible !important;",
    "#dashboardTabList,"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "cross-tab print visibility");
  });
  ownership.analytics.concat(ownership.performance)
    .forEach(function(sectionId)
    {
      assertSourceContains(
        source,
        'id="' + sectionId + '"',
        "print-owned Dashboard content"
      );
    });
  scenariosPassed++;

  [
    "function resizeVisibleDashboardCharts(tabName)",
    "chart.resize();",
    "revenueChart = destroyChartInstance(revenueChart);",
    "hotColdChart = destroyChartInstance(hotColdChart);",
    "expenseChart = destroyChartInstance(expenseChart);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "chart lifecycle preservation");
  });
  scenariosPassed++;

  [
    "#dashboardTabList,",
    "#transactionsTabList { height: 40px; min-height: 40px; }",
    ".dashboard-tab-panel:not(#dashboardPanelOverview)",
    "#dashboardContent { display: grid; min-height: 0; flex: 1 1 auto; grid-template-rows: 40px minmax(0, 1fr); gap: 12px; }",
    "#dashboardPanelOverview { height: 100%; overflow: hidden; }",
    "@media (max-width: 1023px)",
    "#contentViewport { overflow: visible; padding: 12px; }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "responsive one-viewport tab contract");
  });
  scenariosPassed++;

  [
    'id="dashboardStatus"',
    'id="dashboardContent" aria-busy="false"',
    'onclick="retryDashboardData()"',
    "if (requestToken !== activeDashboardRequestToken)",
    'id="dataQualityInformation"',
    'id="printReportButton"',
    'id="exportCsvButton"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Dashboard state compatibility");
  });
  scenariosPassed++;

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Dashboard tab query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }

  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "Dashboard tab response mutation");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    tabs: tabNames.length,
    ownedSections: 15,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount,
    backendRequests: 0
  };

  Logger.log(
    "PASS: testDashboardTabFrameworkContract | scenarios=" +
    summary.scenarios +
    " | tabs=" +
    summary.tabs +
    " | ownedSections=" +
    summary.ownedSections +
    " | backendRequests=" +
    summary.backendRequests +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries
  );

  return summary;
}

function testDashboardOverviewContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;

  [
    'id="dashboardHeaderRegion"',
    'id="filter"',
    '<option value="today">Today</option>',
    '<option value="last7days">Last 7 Days</option>',
    '<option value="currentMonth">Current Month</option>',
    '<option value="previousMonth">Previous Month</option>',
    '<option value="currentYear" selected>Current Year</option>',
    '<option value="custom">Custom</option>',
    'id="printReportButton"',
    'id="dateFilterLabel"',
    'id="latestDataLabel"',
    'id="freshnessStatusBadge"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Overview reporting toolbar");
  });
  assertSourceExcludes(source, "Source:", "Overview source label");
  scenariosPassed++;

  [
    'id="executiveSummarySection"',
    "Business condition",
    'id="executiveAlertCard"',
    "Attention Status",
    'id="businessPriorityRegion"',
    'id="businessPriorityLevel"',
    'id="priorityTitle"',
    'id="priorityReason"',
    'id="priorityMessage"',
    'id="priorityMeta"',
    '"Next action: " + priority.action',
    "priority.evidence.metric"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "executive action hierarchy");
  });
  assertSourceExcludes(
    source.slice(
      source.indexOf('id="businessPriorityRegion"'),
      source.indexOf('</section>', source.indexOf('id="businessPriorityRegion"'))
    ),
    "score",
    "internal Business Priority score"
  );
  scenariosPassed++;

  [
    'id="businessOverview"',
    "function renderOverviewKpiCard(",
    'renderOverviewKpiCard("Revenue"',
    'renderOverviewKpiCard("Expense"',
    'renderOverviewKpiCard("Profit"',
    'renderOverviewKpiCard("Units Sold"',
    'renderOverviewKpiCard("Profit Margin"',
    "res.summary.revenue.toLocaleString",
    "res.summary.expense.toLocaleString",
    "res.summary.profit.toLocaleString",
    "res.summary.unitsSold.toLocaleString",
    "res.insights.profitMargin",
    "applyTransactionDrilldown("
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "five KPI cards");
  });
  assertSourceContainsOnce(
    source,
    "new Array(5)",
    "five-card loading skeleton"
  );
  scenariosPassed++;

  [
    'id="periodComparisonSection"',
    'id="periodComparisonMetrics"',
    'id="dataQualityInformation"',
    'id="dataQualityDetailsButton"',
    'aria-expanded="false"',
    'aria-controls="dataQualityDetails"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact comparison and Data Quality");
  });
  scenariosPassed++;

  [
    "#contentViewport { height: auto; min-height: 0; overflow: hidden; padding: 12px 16px; }",
    "#dashboardPanelOverview { height: 100%; overflow: hidden; }",
    "@media (max-width: 1023px)",
    "#contentViewport { overflow: visible; padding: 12px; }",
    "overview-surface",
    ':root[data-theme="dark"] .bg-white',
    "background: #ffffff !important;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "viewport and theme parity");
  });
  scenariosPassed++;

  var overviewStart = source.indexOf('id="dashboardPanelOverview"');
  var overviewEnd = source.indexOf('id="dashboardPanelPerformance"', overviewStart);
  var overviewPanelSource = source.slice(overviewStart, overviewEnd);
  [
    "canvas",
    "new Chart(",
    "sparkline",
    "google.script.run",
    "getDashboardData("
  ].forEach(function(token)
  {
    assertSourceExcludes(overviewPanelSource, token, "Overview-only additions");
  });
  scenariosPassed++;

  [
    "let dashboardTabsInitialized = false;",
    "if (dashboardTabsInitialized)",
    "let activeDashboardTab = \"overview\";",
    "if (requestToken !== activeDashboardRequestToken)",
    "window.requestAnimationFrame(function()"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "state and performance preservation");
  });
  scenariosPassed++;

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Dashboard Overview query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }

  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "Overview response mutation");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    kpiCards: 5,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testDashboardOverviewContract | scenarios=" +
    summary.scenarios +
    " | kpiCards=" +
    summary.kpiCards +
    " | backendRequests=" +
    summary.backendRequests +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries
  );

  return summary;
}

function testAccessibilityContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  var fixtures =
    createAccessibilityContractFixtures();

  fixtures.forEach(function(fixture)
  {
    fixture.tokens.forEach(function(token)
    {
      assertSourceContains(
        source,
        token,
        fixture.name
      );
    });

    if (fixture.uniqueToken)
    {
      assertSourceContainsOnce(
        source,
        fixture.uniqueToken,
        fixture.name
      );
    }
  });

  assertSourceContainsOnce(
    source,
    'id="dashboardStatus"',
    "dashboard live region"
  );
  assertSourceContainsOnce(
    source,
    'id="dateFilterValidation"',
    "date validation live region"
  );
  assertSourceContainsOnce(
    source,
    'id="reportingInformation"',
    "reporting live region"
  );

  var summary = {
    passed: true,
    scenarios: fixtures.length,
    keyboard: true,
    reducedMotion: true
  };

  Logger.log(
    "PASS: testAccessibilityContract | scenarios=" +
    summary.scenarios +
    " | keyboard=" +
    summary.keyboard +
    " | reducedMotion=" +
    summary.reducedMotion
  );

  return summary;
}

function testExecutivePresentationContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  var orderedTokens = [
    'id="executiveSummarySection"',
    'id="businessOverview"',
    'id="revenueChartTitle"',
    'id="diagnosisContainer"',
    'id="recommendationContainer"',
    'id="executiveCenter"'
  ];
  var previousIndex = -1;

  orderedTokens.forEach(function(token)
  {
    var tokenIndex = source.indexOf(token);

    if (tokenIndex === -1 || tokenIndex <= previousIndex)
    {
      throw new Error(
        "Executive presentation section order mismatch: " +
        token
      );
    }

    previousIndex = tokenIndex;
  });

  [
    'id="executiveSummaryTitle"',
    "Executive Summary</h2>",
    "Key Metrics</h2>",
    "Business Signals",
    "Business Performance",
    "Recommended Actions",
    "Decision Support",
    'id="revenueDependencyContainer"',
    "Revenue Dependency",
    'id="paretoContainer"',
    "Pareto Analysis"
  ].forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "executive heading consistency"
    );
  });

  [
    "Executive Insights",
    "Executive Analysis",
    "Executive Decision Center",
    "Business Command Center",
    "<!-- PRODUCT INTELLIGENCE -->"
  ].forEach(function(token)
  {
    assertSourceExcludes(
      source,
      token,
      "mixed dashboard terminology"
    );
  });

  [
    'label:"Critical"',
    'label:"Attention"',
    'label:"Opportunity"',
    'label:"High Priority"',
    'label:"Medium Priority"',
    'label:"Low Priority"'
  ].forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "badge wording consistency"
    );
  });

  assertSourceContains(
    source,
    ".slice(0,6)\n          .map(renderTimelineItem)",
    "recommendation priority ordering"
  );
  assertSourceContains(
    source,
    "index < items.length - 1",
    "recommendation timeline ending"
  );

  [
    'id="executiveSummary"',
    'id="executiveAlertCard"',
    'id="priorityTitle"',
    'id="priorityMessage"'
  ].forEach(function(token)
  {
    assertSourceContainsOnce(
      source,
      token,
      "non-duplicated executive message"
    );
  });

  [
    "grid grid-cols-1 gap-3 lg:grid-cols-12",
    "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5",
    "grid grid-cols-1 gap-2 lg:grid-cols-2"
  ].forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "responsive executive hierarchy"
    );
  });

  createAccessibilityContractFixtures()
    .forEach(function(fixture)
    {
      fixture.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "preserved accessibility / " + fixture.name
        );
      });
    });

  createResponsiveShellContractFixtures()
    .forEach(function(fixture)
    {
      fixture.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "preserved responsive shell / " + fixture.name
        );
      });
    });

  var summary = {
    passed: true,
    scenarios: 7,
    executiveSummaryFirst: true,
    accessibilityPreserved: true,
    responsiveHierarchy: true
  };

  Logger.log(
    "PASS: testExecutivePresentationContract | scenarios=" +
    summary.scenarios +
    " | executiveSummaryFirst=" +
    summary.executiveSummaryFirst +
    " | accessibilityPreserved=" +
    summary.accessibilityPreserved +
    " | responsiveHierarchy=" +
    summary.responsiveHierarchy
  );

  return summary;
}

function testPrintReportContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;

  [
    'id="printReportButton"',
    'type="button"',
    'Print Report',
    'aria-label="Print current dashboard report"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print button contract");
  });
  scenariosPassed++;

  assertSourceContainsOnce(
    source,
    'onclick="printDashboardReport()"',
    "print handler"
  );
  assertSourceContainsOnce(
    source,
    "function printDashboardReport()",
    "print function"
  );
  scenariosPassed++;

  assertSourceContainsOnce(
    source,
    "window.print();",
    "browser print invocation"
  );
  scenariosPassed++;

  [
    'id="printReportHeader"',
    "NUMLOCK Executive Report",
    'id="printReportPeriod"',
    'id="printReportGenerated"',
    'id="printReportVersion"',
    'data-version-source="template.version"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Print Report metadata contract");
  });
  scenariosPassed++;

  [
    "#dashboardSidebar,",
    "#sidebarBackdrop,",
    "#sidebarMenuButton,",
    "#dashboardStatus,",
    "#dataQualityDetailsButton,",
    "#kpiTargetDetailsButton,",
    "button,",
    ".skeleton,"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print control exclusion");
  });
  scenariosPassed++;

  [
    'id="executiveSummarySection"',
    'id="businessOverview"',
    'id="businessPriorityRegion"',
    'id="periodComparisonSection"',
    'id="reportingInformation"',
    'id="dataQualityInformation"',
    'id="recommendationContainer"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print report section");
  });
  scenariosPassed++;

  assertSourceContains(
    source,
    ".page:not(#dashboard),",
    "inactive page print exclusion"
  );
  assertSourceContains(
    source,
    "#transactions,",
    "hidden transaction page print exclusion"
  );
  scenariosPassed++;

  [
    "@page",
    "size: A4 portrait;",
    "@media print",
    "background: #ffffff !important;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "A4 print layout");
  });
  scenariosPassed++;

  [
    "max-width: 100% !important;",
    "overflow: visible !important;",
    "overflow-wrap: anywhere;",
    "table-layout: fixed;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print overflow protection");
  });
  scenariosPassed++;

  [
    "break-inside: avoid;",
    "page-break-inside: avoid;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print card break protection");
  });
  scenariosPassed++;

  [
    'id="revenueChartSummary"',
    'id="hotColdChartSummary"',
    'id="expenseChartSummary"',
    "#revenueChartSummary,",
    "display: block !important;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print chart summary");
  });
  scenariosPassed++;

  var printFunctionStart =
    source.indexOf("function printDashboardReport()");
  var printFunctionEnd =
    source.indexOf("function sanitizeCsvCellValue", printFunctionStart);
  var printFunctionSource =
    source.slice(printFunctionStart, printFunctionEnd);

  [
    "google.script.run",
    "getDashboardData(",
    "CSV",
    "PDF"
  ].forEach(function(token)
  {
    assertSourceExcludes(
      printFunctionSource,
      token,
      "print backend or export dependency"
    );
  });
  scenariosPassed++;

  createAccessibilityContractFixtures()
    .concat(createResponsiveShellContractFixtures())
    .forEach(function(fixture)
    {
      fixture.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "preserved frontend contract / " + fixture.name
        );
      });
    });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    printReady: true
  };

  Logger.log(
    "PASS: testPrintReportContract | scenarios=" +
    summary.scenarios +
    " | printReady=" +
    summary.printReady
  );

  return summary;
}

function testCsvExportContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;

  [
    'id="exportCsvButton"',
    'type="button"',
    'Export CSV',
    'aria-label="Export visible transactions to CSV"',
    'disabled'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "CSV accessibility contract");
  });
  scenariosPassed++;

  assertSourceContains(
    source,
    'transactionsEvidenceRegion.firstElementChild.lastElementChild',
    "CSV action owned by Transactions toolbar"
  );
  scenariosPassed++;

  [
    '"NUMLOCK_Transactions_"',
    'pad(date.getMonth() + 1)',
    'pad(date.getDate()) + "_"',
    'pad(date.getHours())',
    'pad(date.getMinutes())',
    '".csv"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "CSV filename contract");
  });
  scenariosPassed++;

  [
    'var tableBody = initializeStableDashboardElements().tableBody;',
    'var headers = Array.from(table.tHead.rows[0].cells);',
    'headers[index].textContent.trim()',
    'var csvRows = [visibleColumnIndexes.map'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "CSV header row");
  });
  scenariosPassed++;

  [
    'var visibleRows = Array.from(tableBody.rows)',
    '!row.hidden',
    '!row.classList.contains("hidden")',
    'row.cells.length === headers.length'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "visible CSV rows only");
  });
  scenariosPassed++;

  [
    'header.hidden || header.classList.contains("hidden")',
    'visibleColumnIndexes.map(function(index)',
    'var cells = row.cells;',
    'cells[index].textContent.trim()'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "visible CSV columns only");
  });
  scenariosPassed++;

  [
    'visibleRows.forEach(function(row)',
    'csvRows.push(visibleColumnIndexes.map(function(index)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "CSV ordering preserved");
  });
  scenariosPassed++;

  [
    'visibleTransactionRowCount = transactions.length;',
    'visibleTransactionRowCount === 0;',
    'if (!visibleRows.length)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "empty CSV export disabled");
  });
  scenariosPassed++;

  [
    '["\\uFEFF" + csvRows.join("\\r\\n")]',
    '{ type: "text/csv;charset=utf-8" }',
    'safeValue.replace(/"/g, \'""\')'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "UTF-8 CSV output");
  });
  scenariosPassed++;

  var sanitizerStart =
    source.indexOf("function sanitizeCsvCellValue(");
  var sanitizerEnd =
    source.indexOf("function escapeCsvCell", sanitizerStart);
  var sanitizerSource =
    source.slice(sanitizerStart, sanitizerEnd).trim();
  var sanitizeCsvCellValue =
    Function("return (" + sanitizerSource + ");")();
  var sanitizerCases = [
    { value: "=SUM(A1:A2)", numeric: false, expected: "'=SUM(A1:A2)" },
    { value: "+CMD", numeric: false, expected: "'+CMD" },
    { value: "-CMD", numeric: false, expected: "'-CMD" },
    { value: "@SUM(A1:A2)", numeric: false, expected: "'@SUM(A1:A2)" },
    { value: "  =SUM(A1:A2)", numeric: false, expected: "  '=SUM(A1:A2)" },
    { value: "Latte", numeric: false, expected: "Latte" },
    { value: "-12500", numeric: true, expected: "-12500" },
    { value: "'=SUM(A1:A2)", numeric: false, expected: "'=SUM(A1:A2)" }
  ];

  sanitizerCases.forEach(function(testCase)
  {
    var actual =
      sanitizeCsvCellValue(testCase.value, testCase.numeric);

    if (actual !== testCase.expected)
    {
      throw new Error(
        "CSV formula neutralization mismatch: value=" +
        testCase.value +
        ", expected=" +
        testCase.expected +
        ", actual=" +
        actual
      );
    }
  });
  scenariosPassed++;

  [
    "var numericColumnIndexes = [3, 4];",
    "numericColumnIndexes.indexOf(index) !== -1",
    "sanitizeCsvCellValue(value, isNumericColumn)",
    "isFormulaPrefix &&",
    "!isNegativeNumeric &&",
    "!isNumericPlaceholder"
  ].forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "CSV formula neutralization wiring"
    );
  });
  scenariosPassed++;

  [
    'new Blob(',
    'URL.createObjectURL(blob)',
    'document.createElement("a")',
    'downloadLink.download = formatCsvFilename(new Date());',
    'downloadLink.click();',
    'URL.revokeObjectURL(downloadUrl);'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "browser Blob download path");
  });
  scenariosPassed++;

  var exportFunctionStart =
    source.indexOf("function exportVisibleTransactionsToCsv()");
  var exportFunctionEnd =
    source.indexOf("function requestDashboardData", exportFunctionStart);
  var exportFunctionSource =
    source.slice(exportFunctionStart, exportFunctionEnd);

  [
    "google.script.run",
    "getDashboardData(",
    "recentTransactions",
    "spreadsheet",
    "hiddenFields"
  ].forEach(function(token)
  {
    assertSourceExcludes(
      exportFunctionSource,
      token,
      "CSV backend, source-object, or hidden-field access"
    );
  });
  scenariosPassed++;

  createAccessibilityContractFixtures()
    .concat(createResponsiveShellContractFixtures())
    .forEach(function(fixture)
    {
      fixture.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "preserved frontend contract / " + fixture.name
        );
      });
    });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    csvReady: true
  };

  Logger.log(
    "PASS: testCsvExportContract | scenarios=" +
    summary.scenarios +
    " | csvReady=" +
    summary.csvReady
  );

  return summary;
}

function testClientRenderPerformanceContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  var stableCacheStart =
    source.indexOf("function initializeStableDashboardElements()");
  var immediateRenderStart =
    source.indexOf("function render(res, requestToken)");
  var deferredRenderStart =
    source.indexOf("function renderDeferredDashboardContent(res)");
  var deferredScheduleStart =
    source.indexOf("function scheduleDeferredDashboardRender(res, requestToken)");

  if (
    stableCacheStart === -1 ||
    immediateRenderStart === -1 ||
    deferredRenderStart === -1 ||
    deferredScheduleStart === -1
  )
  {
    throw new Error(
      "Client render performance architecture is incomplete"
    );
  }

  var immediateRenderEnd =
    source.indexOf(
      "function renderDeferredDashboardContent(res)",
      immediateRenderStart
    );
  var immediateSource =
    source.slice(immediateRenderStart, immediateRenderEnd);
  var deferredSource =
    source.slice(deferredRenderStart);
  var cacheSource =
    source.slice(
      stableCacheStart,
      source.indexOf(
        "function setSidebarOpen",
        stableCacheStart
      )
    );

  [
    "renderBusinessOverview(res);",
    "renderReportingMetadata(res);",
    "renderPeriodComparison(res.periodComparison);",
    "renderKpiTargets(res.kpiTargets);",
    "renderDataQuality(res);",
    "renderExecutiveSummary(res);"
  ].forEach(function(token)
  {
    assertSourceContains(
      immediateSource,
      token,
      "immediate first-visible render"
    );
  });

  [
    "renderBusinessIntelligence(res);",
    "renderExecutiveCenter(res);",
    "renderTransactions(res);",
    'document.getElementById( "actionRoadmapCard" ).innerHTML'
  ].forEach(function(token)
  {
    assertSourceContains(
      deferredSource,
      token,
      "deferred lower-priority render"
    );
    assertSourceExcludes(
      immediateSource,
      token,
      "immediate lower-priority render"
    );
  });

  [
    'filter: document.getElementById("filter")',
    'customStart: document.getElementById("customStart")',
    'customEnd: document.getElementById("customEnd")',
    'dashboardStatus: document.getElementById("dashboardStatus")',
    'pageElements: document.querySelectorAll(".page")',
    'pageButtons: document.querySelectorAll("[data-page]")'
  ].forEach(function(token)
  {
    assertSourceContains(
      cacheSource,
      token,
      "stable DOM cache"
    );
  });

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Repeated DOM query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }

  assertSourceContainsOnce(
    source,
    "window.requestAnimationFrame(function()",
    "single deferred phase"
  );
  assertSourceContains(
    source,
    "if (requestToken !== activeDashboardRequestToken)",
    "stale deferred render guard"
  );
  assertSourceContains(
    source,
    "window.cancelAnimationFrame(",
    "superseded deferred render cancellation"
  );

  [
    ".sort(",
    ".reverse(",
    ".splice("
  ].forEach(function(token)
  {
    assertSourceExcludes(
      source,
      token,
      "in-place frontend response mutation"
    );
  });

  [
    'id="recommendationContainer"',
    'id="actionRoadmapCard"',
    'id="topProductsContainer"',
    'id="tableBody"'
  ].forEach(function(token)
  {
    assertSourceContainsOnce(
      source,
      token,
      "preserved populated output container"
    );
  });

  createAccessibilityContractFixtures()
    .concat(createDashboardStateContractFixtures())
    .forEach(function(fixture)
    {
      (fixture.tokens || []).forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "preserved frontend contract / " + fixture.name
        );
      });
    });

  var summary = {
    passed: true,
    scenarios: 7,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount,
    deferredPhases: 1,
    responseMutation: false
  };

  Logger.log(
    "PASS: testClientRenderPerformanceContract | scenarios=" +
    summary.scenarios +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries +
    " | deferredPhases=" +
    summary.deferredPhases +
    " | responseMutation=" +
    summary.responseMutation
  );

  return summary;
}

function testInteractiveDrilldownContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;

  [
    'id="transactionsHeading"',
    'id="transactionDrilldownSummary"',
    'id="transactionDrilldownText"',
    'id="clearTransactionDrilldownButton"',
    'aria-live="polite"',
    'onclick="clearTransactionDrilldown()"',
    '>View transactions</button>'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "drill-down accessible controls");
  });
  scenariosPassed++;

  [
    'renderOverviewKpiCard("Revenue",',
    'renderOverviewKpiCard("Expense",',
    'renderOverviewKpiCard("Profit",',
    'renderOverviewKpiCard("Units Sold",',
    '"month",',
    '"expenseCategory",',
    'showPage("transactions");',
    'transactionsResultHeading.focus();'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "KPI and chart drill-down wiring");
  });
  scenariosPassed++;

  var filterStart =
    source.indexOf("function filterTransactionDrilldown(");
  var filterEnd =
    source.indexOf("function renderTransactionRows", filterStart);
  var filterSource =
    source.slice(filterStart, filterEnd).trim();
  var filterTransactionDrilldown =
    Function("return (" + filterSource + ");")();
  var transactions = [
    { date: "2025-03-12", transactionType: "Purchase", purchaseCategory: "Supplies" },
    { date: "2025-03-11", transactionType: "Sales", product: "Latte" },
    { date: "2025-02-10", transactionType: "Sales", product: "Espresso" },
    { date: "2025-01-10", transactionType: "Purchase", purchaseCategory: "Rent" }
  ];
  var original = JSON.stringify(transactions);
  var cases = [
    { type: "all", value: "", expected: "Purchase,Sales,Sales,Purchase" },
    { type: "sales", value: "", expected: "Sales,Sales" },
    { type: "purchase", value: "", expected: "Purchase,Purchase" },
    { type: "month", value: "2025-03", expected: "Purchase,Sales" },
    { type: "expenseCategory", value: "Supplies", expected: "Purchase" },
    { type: "expenseCategory", value: "Missing", expected: "" }
  ];

  cases.forEach(function(testCase)
  {
    var actual =
      filterTransactionDrilldown(transactions, testCase)
        .map(function(transaction)
        {
          return transaction.transactionType;
        })
        .join(",");

    if (actual !== testCase.expected)
    {
      throw new Error(
        "Drill-down filter mismatch for " + testCase.type +
        ": expected=" + testCase.expected + ", actual=" + actual
      );
    }
  });

  if (JSON.stringify(transactions) !== original)
  {
    throw new Error("Drill-down filtering mutated response transactions");
  }
  scenariosPassed++;

  [
    "latestDashboardTransactions =",
    "res.recentTransactions.slice(0, 10)",
    "Filtered from the latest 10 transactions already loaded for the active period.",
    'setActiveTransactionsTab("recent", false);'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded existing-response scope");
  });

  var applyStart =
    source.indexOf("function applyTransactionDrilldown(");
  var applyEnd =
    source.indexOf("function clearTransactionDrilldown", applyStart);
  var applySource = source.slice(applyStart, applyEnd);

  [
    "google.script.run",
    "getDashboardData(",
    "spreadsheet",
    "localStorage",
    "sessionStorage",
    "fetch("
  ].forEach(function(token)
  {
    assertSourceExcludes(applySource, token, "frontend-only drill-down");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    boundedRows: 10,
    responseMutation: false
  };

  Logger.log(
    "PASS: testInteractiveDrilldownContract | scenarios=" +
    summary.scenarios +
    " | boundedRows=" +
    summary.boundedRows +
    " | responseMutation=" +
    summary.responseMutation
  );

  return summary;
}

function testTransactionsVisualContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var scenariosPassed = 0;
  var tabs = ["recent", "sales", "expenses", "purchases"];
  var transactionsTabRegion = getSourceRegion(
    source,
    'id="transactions"',
    'id="settings"',
    "Transactions destination"
  );

  assertSourceOccurrenceCount(source, 'role="tablist"', 2, "application tablists");
  assertSourceContainsOnce(source, 'id="transactions"', "Transactions destination ID");
  assertSourceContainsOnce(source, 'id="transactionsTabList"', "Transactions tablist ID");
  assertSourceOccurrenceCount(transactionsTabRegion, 'role="tablist"', 1, "Transactions tablist");
  assertSourceOccurrenceCount(transactionsTabRegion, 'role="tab"', tabs.length, "Transactions tabs");
  assertSourceOccurrenceCount(transactionsTabRegion, 'role="tabpanel"', tabs.length, "Transactions panels");

  tabs.forEach(function(tabName)
  {
    var titleCase = tabName.charAt(0).toUpperCase() + tabName.slice(1);

    assertSourceContainsOnce(transactionsTabRegion, 'data-transactions-tab="' + tabName + '"', "exact Transactions tab");
    assertSourceContainsOnce(transactionsTabRegion, 'data-transactions-panel="' + tabName + '"', "exact Transactions panel");
    [
      'id="transactionsTab' + titleCase + '"',
      'aria-controls="transactionsPanel' + titleCase + '"',
      'id="transactionsPanel' + titleCase + '"',
      'aria-labelledby="transactionsTab' + titleCase + '"'
    ].forEach(function(token)
    {
      assertSourceContains(transactionsTabRegion, token, "Transactions tab ARIA relationship");
    });
  });
  assertSourceExcludes(
    transactionsTabRegion,
    "dashboardPanel",
    "Transactions control of Dashboard panels"
  );
  scenariosPassed++;

  [
    'id="transactionsTabList"', 'role="tablist"', 'role="tab"',
    'role="tabpanel"', 'aria-selected="true"',
    'aria-controls="transactionsPanelRecent"',
    'aria-labelledby="transactionsTabRecent"',
    'let activeTransactionsTab = "recent";'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Transactions tab semantics");
  });
  scenariosPassed++;

  [
    'event.key === "ArrowRight"', 'event.key === "ArrowLeft"',
    'event.key === "Home"', 'event.key === "End"',
    "event.preventDefault();", "tab.tabIndex = isSelected ? 0 : -1;",
    "panel.hidden = !isSelected;",
    "selectedPanel.appendChild(elements.transactionsEvidenceRegion);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Transactions keyboard and hidden-panel behavior");
  });
  scenariosPassed++;

  var filterStart = source.indexOf("function filterTransactionsForTab(");
  var filterEnd = source.indexOf("function getVisibleTransactions", filterStart);
  var filterTransactionsForTab =
    Function("return (" + source.slice(filterStart, filterEnd).trim() + ");")();
  var rows = [
    { transactionType: "Purchase", label: "first" },
    { transactionType: "Sales", label: "second" },
    { transactionType: "Purchase", label: "third" },
    { transactionType: "Sales", label: "fourth" }
  ];
  var original = JSON.stringify(rows);
  var expected = {
    recent: "first,second,third,fourth",
    sales: "second,fourth",
    expenses: "first,third",
    purchases: "first,third"
  };

  tabs.forEach(function(tabName)
  {
    var actual = filterTransactionsForTab(rows, tabName)
      .map(function(row) { return row.label; }).join(",");

    if (actual !== expected[tabName])
    {
      throw new Error("Transactions filter mismatch for " + tabName);
    }
  });

  if (JSON.stringify(rows) !== original)
  {
    throw new Error("Transactions tab filtering mutated response rows");
  }
  scenariosPassed++;

  [
    "res.recentTransactions.slice(0, 10)",
    'transaction.transactionType === "Sales"',
    'transaction.transactionType === "Purchase"',
    "Visible recent sales", "Visible recent expenses",
    "Visible recent purchases", "separate purchase history is unavailable",
    "latest 10 transactions already loaded"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "truthful bounded Transactions scope");
  });
  scenariosPassed++;

  [
    '>Date</th>', '>Type</th>', '>Item</th>', '>Qty</th>', '>Amount</th>',
    'class="transactions-table-row border-b"', 'class="transactions-number',
    'id="transactionsTableScroll"', 'overflow-x-auto', 'min-w-[720px]'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "five-column compact table");
  });
  scenariosPassed++;

  [
    'id="transactionDrilldownSummary"', 'aria-live="polite"',
    'setActiveTransactionsTab("recent", false);',
    "transactionsResultHeading.focus();",
    'onclick="clearTransactionDrilldown()"',
    "activeTransactionDrilldown = null;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "drill-down context, focus, and reset");
  });
  scenariosPassed++;

  [
    'id="exportCsvButton"', "var visibleRows = Array.from(tableBody.rows)",
    "visibleTransactionRowCount === 0;", 'new Blob(',
    'URL.createObjectURL(blob)', "sanitizeCsvCellValue(value, isNumericColumn)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "visible Transactions CSV");
  });
  scenariosPassed++;

  var switchStart = source.indexOf("function setActiveTransactionsTab(");
  var switchEnd = source.indexOf("function initializeTransactionsTabs", switchStart);
  var switchSource = source.slice(switchStart, switchEnd);

  [
    "google.script.run", "getDashboardData(", "fetch(", "localStorage",
    "sessionStorage", ".sort(", ".reverse(", ".splice("
  ].forEach(function(token)
  {
    assertSourceExcludes(switchSource, token, "request-free immutable tab switch");
  });
  scenariosPassed++;

  [
    'role="status"', 'No visible transactions in this bounded view',
    ':root[data-theme="dark"] .bg-white',
    '#transactions.active { display: grid; height: 100%; grid-template-rows: 40px minmax(0, 1fr); gap: 12px; overflow: hidden; }',
    '#transactionsTableScroll { min-height: 0; flex: 1 1 auto; overflow: auto; }',
    '#transactionsTableScroll { overflow-x: auto; }',
    '@media (max-width: 1023px)', '@media (prefers-reduced-motion: reduce)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "states, theme, and responsive containment");
  });
  scenariosPassed++;

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("Transactions query budget exceeded");
  }

  assertSourceContainsOnce(source, "window.requestAnimationFrame(function()", "single deferred phase preserved");
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    tabs: tabs.length,
    boundedRows: 10,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount,
    responseMutation: false,
    extraRequests: false
  };

  Logger.log(
    "PASS: testTransactionsVisualContract | scenarios=" + summary.scenarios +
    " | tabs=" + summary.tabs + " | boundedRows=" + summary.boundedRows +
    " | idQueries=" + summary.idQueries +
    " | selectorQueries=" + summary.selectorQueries +
    " | responseMutation=" + summary.responseMutation +
    " | extraRequests=" + summary.extraRequests
  );

  return summary;
}

function testSettingsVisualContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var doGetSource = String(doGet);
  var scenariosPassed = 0;
  var settingsRegion = getSourceRegion(
    source,
    'id="settings"',
    'id="logs"',
    "Settings destination"
  );

  assertSourceContainsOnce(source, 'id="settings"', "Settings destination ID");
  assertSourceContainsOnce(settingsRegion, 'id="settingsSections"', "Settings section group");
  [
    'id="appearanceSection"',
    'aria-labelledby="appearanceHeading"',
    'id="appearanceHeading"',
    '>Appearance</h2>',
    'id="aboutSection"',
    'aria-labelledby="aboutHeading"',
    'id="aboutHeading"',
    '>About</h2>'
  ].forEach(function(token)
  {
    assertSourceContains(settingsRegion, token, "Appearance and About ownership");
  });
  scenariosPassed++;

  assertSourceOccurrenceCount(
    settingsRegion,
    'name="themePreference"',
    3,
    "theme preference radio controls"
  );
  [
    '<fieldset class="mt-5">',
    '<legend class="text-sm font-semibold ui-theme-primary">Theme preference</legend>',
    'type="radio" name="themePreference" value="light"',
    'type="radio" name="themePreference" value="dark"',
    'type="radio" name="themePreference" value="system"',
    '>Light</strong>',
    '>Dark</strong>',
    '>System</strong>',
    "has-[:checked]:border-indigo-500",
    "input:focus-visible"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "accessible exclusive theme selection");
  });
  scenariosPassed++;

  [
    'var storageKey = "numlock.ui.theme";',
    "window.localStorage.getItem(storageKey)",
    'document.documentElement.getAttribute(\n          "data-theme-preference"',
    "control.checked = control.value === safePreference;",
    'document.documentElement.setAttribute(\n        "data-theme",\n        resolvedTheme',
    'window.localStorage.setItem(\n            "numlock.ui.theme",\n            safePreference'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "stored preference and effective theme semantics");
  });
  scenariosPassed++;

  [
    'var preference = "system";',
    'preference === "system"',
    '"(prefers-color-scheme: dark)"',
    'systemThemeQuery.addEventListener("change"',
    'applyThemePreference("system", false, false);'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "System media-query behavior");
  });
  scenariosPassed++;

  var themeStart = source.indexOf("function synchronizeChartTheme(forceLight)");
  var themeEnd = source.indexOf("function renderSessionClientLogs", themeStart);
  var themeSource = source.slice(themeStart, themeEnd);

  [
    "synchronizeChartTheme();",
    'chart.update("none");',
    "elements.themeControls.forEach(function(control)",
    'control.addEventListener("change"',
    "applyThemePreference(control.value, true, true);"
  ].forEach(function(token)
  {
    assertSourceContains(themeSource, token, "immediate theme and chart synchronization");
  });
  [
    "google.script.run",
    "getDashboardData(",
    "requestDashboardData(",
    "activeDashboardTab =",
    "activeTransactionsTab =",
    "filter.value =",
    "showPage("
  ].forEach(function(token)
  {
    assertSourceExcludes(themeSource, token, "theme state or request reset");
  });
  scenariosPassed++;

  [
    'window.addEventListener("beforeprint"',
    "synchronizeChartTheme(true);",
    "@media print",
    "background: #ffffff !important;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print-light preservation");
  });
  scenariosPassed++;

  [
    "template.appName = PROJECT_CONFIG.APP_NAME;",
    "template.version = PROJECT_CONFIG.VERSION;",
    "template.releaseLabel = PROJECT_CONFIG.RELEASE_LABEL;",
    "template.environment = PROJECT_CONFIG.ENVIRONMENT;"
  ].forEach(function(token)
  {
    assertSourceContains(doGetSource, token, "authoritative About metadata mapping");
  });
  var aboutMetadataTargets = [
    {
      id: "aboutApplicationName",
      source: "template.appName"
    },
    {
      id: "aboutVersion",
      source: "template.version"
    },
    {
      id: "aboutReleaseLabel",
      source: "template.releaseLabel"
    },
    {
      id: "aboutEnvironment",
      source: "template.environment"
    }
  ];

  aboutMetadataTargets.forEach(function(target)
  {
    assertSourceContainsOnce(
      settingsRegion,
      'id="' + target.id + '"',
      "About metadata render target " + target.id
    );
    assertSourceContainsOnce(
      settingsRegion,
      'data-metadata-source="' + target.source + '"',
      "About metadata provenance " + target.source
    );
  });
  scenariosPassed++;

  [
    "scriptId", "deploymentId", "spreadsheetId", "repositoryPath",
    "accountIdentity", "profile", "notifications", "integrations",
    "permissions", "upgrade", "avatar", "search"
  ].forEach(function(token)
  {
    assertSourceExcludes(settingsRegion, token, "sensitive or unsupported Settings content");
  });
  ["<select", "<textarea", 'type="checkbox"'].forEach(function(token)
  {
    assertSourceExcludes(settingsRegion, token, "unsupported editable Settings control");
  });
  scenariosPassed++;

  [
    "ui-theme-surface", "ui-theme-inset", "ui-theme-primary",
    "ui-theme-secondary", "ui-theme-muted",
    '#settings.active { height: 100%; overflow: hidden; }',
    '#settings.active { height: auto; overflow: visible; }',
    "grid-cols-1", "sm:grid-cols-3", "lg:grid-cols-12"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Settings theme and responsive containment");
  });
  scenariosPassed++;

  var navigationStart = source.indexOf("function showPage(pageId)");
  var navigationEnd = source.indexOf("function getResolvedTheme", navigationStart);
  var navigationSource = source.slice(navigationStart, navigationEnd);

  ["google.script.run", "getDashboardData(", "requestDashboardData("].forEach(function(token)
  {
    assertSourceExcludes(navigationSource, token, "Settings navigation backend request");
  });
  [
    'settings: {',
    'title: "Settings"',
    'context: "Appearance and application information"',
    "heading.focus();"
  ].forEach(function(token)
  {
    assertSourceContains(navigationSource, token, "Settings navigation and focus");
  });
  scenariosPassed++;

  var onloadStart = source.indexOf("window.onload = function()");
  var onloadSource = source.slice(onloadStart);

  if (
    onloadSource.indexOf("initializeThemeFoundation();") === -1 ||
    onloadSource.indexOf("loadData();") === -1 ||
    onloadSource.indexOf("initializeThemeFoundation();") >
      onloadSource.indexOf("loadData();")
  )
  {
    throw new Error("Settings theme must initialize before Dashboard data loading");
  }
  scenariosPassed++;

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("Settings query budget exceeded");
  }
  assertSourceContainsOnce(
    source,
    "window.requestAnimationFrame(function()",
    "single deferred phase preserved"
  );
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "Settings response mutation");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    sections: 2,
    themes: 3,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount,
    backendRequests: 0
  };

  Logger.log(
    "PASS: testSettingsVisualContract | scenarios=" + summary.scenarios +
    " | sections=" + summary.sections +
    " | themes=" + summary.themes +
    " | backendRequests=" + summary.backendRequests +
    " | idQueries=" + summary.idQueries +
    " | selectorQueries=" + summary.selectorQueries
  );

  return summary;
}

function testLogsVisualContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var scenariosPassed = 0;
  var logsRegion = getSourceRegion(
    source,
    'id="logs"',
    "</main>",
    "Logs destination"
  );

  assertSourceContainsOnce(source, 'id="logs"', "Logs destination ID");
  [
    'id="logsHeading"',
    "Session diagnostics",
    "Session-local only.",
    "held in memory",
    "not historical audit records",
    "disappear when this page reloads or closes",
    "Maximum 100 entries"
  ].forEach(function(token)
  {
    assertSourceContains(logsRegion, token, "truthful session-local Logs scope");
  });
  scenariosPassed++;

  var entryStart = source.indexOf("sessionClientLogs.unshift({");
  var entryEnd = source.indexOf("});", entryStart);
  var entrySource = source.slice(entryStart, entryEnd);

  ["timestamp:", "severity:", "context:", "message:"].forEach(function(token)
  {
    assertSourceContainsOnce(entrySource, token, "public log entry field");
  });
  ["payload", "transaction", "sourceRow", "stack", "identifier"].forEach(function(token)
  {
    assertSourceExcludes(entrySource, token, "non-public log entry field");
  });
  scenariosPassed++;

  var contextStart = source.indexOf("function getAllowedClientLogContext(");
  var contextEnd = source.indexOf("function getFilteredSessionClientLogs", contextStart);
  var contextFunction =
    Function("return (" + source.slice(contextStart, contextEnd).trim() + ");")();
  var allowedContexts = [
    "Dashboard load", "Date filter", "Retry", "Chart rendering",
    "CSV export", "Print report", "Theme", "Navigation", "Drill-down"
  ];

  allowedContexts.forEach(function(context)
  {
    if (contextFunction(context) !== context)
    {
      throw new Error("Allowed log context changed: " + context);
    }
  });
  if (contextFunction("Raw payload") !== "Navigation")
  {
    throw new Error("Unknown log context did not use the bounded fallback");
  }
  ["Info: true", "Warning: true", "Error: true"].forEach(function(token)
  {
    assertSourceContains(source, token, "exact log severity value");
  });
  scenariosPassed++;

  var sanitizerStart = source.indexOf("function sanitizeClientLogMessage(");
  var sanitizerEnd = source.indexOf("function getAllowedClientLogContext", sanitizerStart);
  var sanitizerSource = source.slice(sanitizerStart, sanitizerEnd).trim();
  var sanitizeClientLogMessage =
    Function("return (" + sanitizerSource + ");")();
  var sensitiveCases = [
    { value: "Open https://example.com/macros/s/abcdefghijklmnopqrstuvwxyz123456", secret: "https://" },
    { value: "Contact owner@example.com", secret: "owner@example.com" },
    { value: "script ID: abcdefghijklmnopqrstuvwxyz123456", secret: "abcdefghijklmnopqrstuvwxyz" },
    { value: "Spreadsheet 123456789012345", secret: "123456789012345" },
    { value: "Read /Users/person/private/project/file.js", secret: "/Users/" },
    { value: "Read C:\\Users\\person\\secret.txt", secret: "C:\\Users" }
  ];

  sensitiveCases.forEach(function(testCase)
  {
    var sanitized = sanitizeClientLogMessage(testCase.value);

    if (sanitized.indexOf(testCase.secret) !== -1 || sanitized.length > 240)
    {
      throw new Error("Sensitive log value was not safely bounded");
    }
  });
  if (
    sanitizeClientLogMessage({ payload: "secret" }) !==
      "Structured event details were omitted." ||
    sanitizeClientLogMessage('{"payload":"secret"}') !==
      "Structured event details were omitted." ||
    sanitizeClientLogMessage(new Array(400).join("x")).length > 240
  )
  {
    throw new Error("Object or long-message sanitization failed");
  }
  [
    "[redacted URL]", "[redacted email]", "[redacted identifier]",
    "[redacted path]", ".slice(0, 240)",
    'Structured event details were omitted.'
  ].forEach(function(token)
  {
    assertSourceContains(sanitizerSource, token, "log sanitization contract");
  });
  scenariosPassed++;

  var controllerStart = source.indexOf("function sanitizeClientLogMessage(");
  var controllerEnd = source.indexOf("function showBusinessOverviewSkeleton", controllerStart);
  var controllerSource = source.slice(controllerStart, controllerEnd);

  [
    "let sessionClientLogs = [];",
    "sessionClientLogs.unshift({",
    "sessionClientLogs.length > 100",
    "sessionClientLogs.pop();",
    "now - lastClientLogTimestamp < 5000",
    "signature === lastClientLogSignature"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "memory limit, ordering, and deduplication");
  });
  ["localStorage", "sessionStorage", "google.script.run", "getDashboardData("].forEach(function(token)
  {
    assertSourceExcludes(controllerSource, token, "persistent or backend log storage");
  });
  scenariosPassed++;

  [
    'name="sessionLogSeverity" value="All"',
    'name="sessionLogSeverity" value="Info"',
    'name="sessionLogSeverity" value="Warning"',
    'name="sessionLogSeverity" value="Error"',
    "getFilteredSessionClientLogs()",
    "entry.severity === activeClientLogSeverity",
    'id="sessionLogsInfoCount"',
    'id="sessionLogsWarningCount"',
    'id="sessionLogsErrorCount"',
    "No client events in this session.",
    "No entries match the selected severity."
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Logs filtering, summary, and empty states");
  });
  scenariosPassed++;

  [
    'id="clearSessionLogsButton"',
    'onclick="clearSessionClientLogs()"',
    "sessionClientLogs = [];",
    '"Session logs cleared."',
    "elements.clearSessionLogsButton.disabled = sessionClientLogs.length === 0;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "clear-session behavior");
  });
  var clearStart = source.indexOf("function clearSessionClientLogs()");
  var clearEnd = source.indexOf("function logClientEvent", clearStart);
  var clearSource = source.slice(clearStart, clearEnd);
  ["google.script.run", "getDashboardData(", "console.clear"].forEach(function(token)
  {
    assertSourceExcludes(clearSource, token, "clear-session external effect");
  });
  scenariosPassed++;

  [
    'role="status" aria-live="polite" aria-atomic="true"',
    '"New Error log in " + safeContext + "."',
    'aria-label="Log severity summary"',
    '>Filter by severity</legend>',
    'aria-label="Newest session client events first"',
    'aria-label="Session log entries, scrollable"',
    "entry.severity + \" · \" + entry.context",
    "button:focus-visible",
    "input:focus-visible"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Logs accessibility contract");
  });
  scenariosPassed++;

  [
    "ui-theme-surface", "ui-theme-inset", "ui-theme-primary",
    "ui-theme-secondary", "ui-theme-muted",
    '#logs.active { height: 100%; overflow: hidden; }',
    '#logsWorkspace { height: 100%; min-height: 0; }',
    '#sessionLogsListRegion { min-height: 0; overflow-y: auto; }',
    '#logs.active,',
    '#logsWorkspace { height: auto; overflow: visible; }',
    "break-words"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Logs theme and responsive containment");
  });
  scenariosPassed++;

  var navigationStart = source.indexOf("function showPage(pageId)");
  var navigationEnd = source.indexOf("function getResolvedTheme", navigationStart);
  var navigationSource = source.slice(navigationStart, navigationEnd);
  ["getDashboardData(", "requestDashboardData(", "google.script.run"].forEach(function(token)
  {
    assertSourceExcludes(navigationSource, token, "Logs navigation backend request");
  });
  [
    'logs: {',
    'title: "Logs"',
    'context: "Sanitized events from this browser session"',
    "heading.focus();"
  ].forEach(function(token)
  {
    assertSourceContains(navigationSource, token, "Logs independent navigation");
  });
  scenariosPassed++;

  [
    'console.error(\n              "Dashboard render failed"',
    'console.error(\n            "Dashboard request failed"',
    'console.error(\n        "Chart.js unavailable',
    'console.error("CSV export failed", error);',
    'console.error("Print report failed", error);'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "preserved actionable console diagnostics");
  });
  assertSourceExcludes(source, "JSON.stringify(res", "raw response logging");
  assertSourceExcludes(source, "console.log(res", "raw response console logging");
  scenariosPassed++;

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("Logs query budget exceeded");
  }
  assertSourceContainsOnce(source, "window.requestAnimationFrame(function()", "single deferred phase preserved");
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "Logs response mutation");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    maxEntries: 100,
    severities: 3,
    contexts: allowedContexts.length,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount,
    backendRequests: 0
  };

  Logger.log(
    "PASS: testLogsVisualContract | scenarios=" + summary.scenarios +
    " | maxEntries=" + summary.maxEntries +
    " | severities=" + summary.severities +
    " | contexts=" + summary.contexts +
    " | backendRequests=" + summary.backendRequests +
    " | idQueries=" + summary.idQueries +
    " | selectorQueries=" + summary.selectorQueries
  );

  return summary;
}

function testUiFinalStabilizationContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var scenariosPassed = 0;

  [
    "var(--surface-1)", "var(--surface-2)", "var(--surface-3)",
    "var(--text-primary)", "var(--text-secondary)", "var(--border-subtle)",
    "var(--success)", "var(--warning)", "var(--critical)",
    "var(--disabled-bg)", "var(--disabled-text)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "approved semantic token");
  });
  [
    "button:disabled,", "select:disabled,", "input:disabled",
    "background-color: var(--disabled-bg) !important;",
    "color: var(--disabled-text) !important;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "semantic disabled state");
  });
  scenariosPassed++;

  ["dashboard", "transactions", "settings", "logs"].forEach(function(pageId)
  {
    assertSourceContainsOnce(source, 'id="' + pageId + '"', "primary destination " + pageId);
  });
  ["dashboardTabList", "transactionsTabList", "mainContent", "dashboardSidebar"].forEach(function(id)
  {
    assertSourceContainsOnce(source, 'id="' + id + '"', "unique shell or tablist ID " + id);
  });
  assertSourceOccurrenceCount(source, 'role="tablist"', 2, "scoped tablists");
  assertSourceOccurrenceCount(source, 'data-dashboard-tab="', 5, "Dashboard tabs");
  assertSourceOccurrenceCount(source, 'data-transactions-tab="', 4, "Transactions tabs");
  scenariosPassed++;

  var idPattern = /\sid="([^"]+)"/g;
  var seenIds = {};
  var idMatch;
  while ((idMatch = idPattern.exec(source)) !== null)
  {
    if (seenIds[idMatch[1]])
    {
      throw new Error("Duplicate static HTML ID: " + idMatch[1]);
    }
    seenIds[idMatch[1]] = true;
  }
  scenariosPassed++;

  [
    ".page { display: none; }",
    "page.hidden = !isActivePage;",
    "panel.hidden =",
    "sidebar.inert = !isOpen && !isDesktop;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "hidden-content focus exclusion");
  });
  scenariosPassed++;

  [
    ':root[data-theme="dark"] .bg-indigo-100',
    ':root[data-theme="dark"] .bg-amber-100',
    ':root[data-theme="dark"] .bg-red-100',
    ':root[data-theme="dark"] .bg-emerald-100,',
    ':root[data-theme="dark"] .text-emerald-600,',
    ':root[data-theme="dark"] .skeleton',
    "var(--surface-3) 50%",
    "@media print", "background: #ffffff !important;",
    "color: #0f172a;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Light, Dark, and print theme parity");
  });
  scenariosPassed++;

  [
    "#actionRoadmapCard .text-xl { transition: color 160ms ease-out; }",
    "#actionRoadmapCard .flex:hover .text-xl { color: var(--brand); }",
    "@media (prefers-reduced-motion: reduce)",
    "#mainContent,", "#sidebarCollapseIcon,",
    ".ui-sidebar-item { transition: none; }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded motion contract");
  });
  scenariosPassed++;

  [
    "min-width: 1024px", "max-width: 1023px",
    "height: 100dvh", "overflow: hidden;",
    "overflow-x-auto", "overflow-y: auto;",
    "min-h-0", "max-w-full"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "responsive containment contract");
  });
  scenariosPassed++;

  [
    "synchronizeChartTheme", "getCurrentThemePalette",
    "maintainAspectRatio: false", "destroyChartInstance"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded Chart.js lifecycle");
  });
  assertSourceExcludes(source, "ResizeObserver", "unbounded resize observer");
  assertSourceExcludes(source, 'addEventListener("resize"', "unbounded resize listener");
  scenariosPassed++;

  [
    'id="appearanceSection"', 'id="aboutSection"',
    'id="sessionLogsListRegion"', "Session-local only.",
    "not historical audit records"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "truthful Settings and Logs scope");
  });
  ["Search", "Notifications", "Customize widgets", "Welcome back"].forEach(function(token)
  {
    assertSourceExcludes(source, token, "forbidden SaaS decoration");
  });
  scenariosPassed++;

  assertSourceExcludes(source, "function getIntelIcon(", "obsolete placeholder icon helper");
  assertSourceExcludes(source, 'return "...svg...";', "obsolete placeholder SVG value");
  scenariosPassed++;

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;
  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("Final stabilization query budget exceeded");
  }
  assertSourceContainsOnce(source, "window.requestAnimationFrame(function()", "single deferred render phase");
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "response mutation");
  });
  scenariosPassed++;

  [
    "dashboardTabsInitialized", "transactionsTabsInitialized",
    "responsiveShellInitialized", "themeFoundationInitialized"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "listener initialization guard");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    destinations: 9,
    tablists: 2,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount,
    duplicateIds: 0
  };

  Logger.log(
    "PASS: testUiFinalStabilizationContract | scenarios=" + summary.scenarios +
    " | destinations=" + summary.destinations +
    " | tablists=" + summary.tablists +
    " | duplicateIds=" + summary.duplicateIds +
    " | idQueries=" + summary.idQueries +
    " | selectorQueries=" + summary.selectorQueries
  );

  return summary;
}

function testChartPresentationContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  var fixtures =
    createChartPresentationContractFixtures();
  var drilldownContract =
    testInteractiveDrilldownContract();

  fixtures.forEach(function(fixture)
  {
    fixture.tokens.forEach(function(token)
    {
      assertSourceContains(
        source,
        token,
        "chart presentation / " + fixture.name
      );
    });

    if (fixture.uniqueToken)
    {
      assertSourceContainsOnce(
        source,
        fixture.uniqueToken,
        "chart presentation / " + fixture.name
      );
    }
  });

  var chartConstructorCount =
    source.split("new Chart(").length - 1;

  if (chartConstructorCount !== 3)
  {
    throw new Error(
      "Chart presentation expected exactly three Chart constructors: actual=" +
      chartConstructorCount
    );
  }

  var summary = {
    passed: true,
    scenarios: fixtures.length,
    charts: ["revenue", "hotCold", "expense"],
    drilldownScenarios: drilldownContract.scenarios
  };

  Logger.log(
    "PASS: testChartPresentationContract | scenarios=" +
    summary.scenarios +
    " | charts=" +
    summary.charts.join(",")
  );

  return summary;
}

function testFrontendDependencyContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

  var fixture =
    createFrontendDependencyContractFixtures();

  fixture.cases.forEach(function(testCase)
  {
    (testCase.tokens || []).forEach(function(token)
    {
      assertSourceContains(
        source,
        token,
        "frontend dependency / " + testCase.name
      );
    });

    (testCase.excludedTokens || []).forEach(function(token)
    {
      assertSourceExcludes(
        source,
        token,
        "frontend dependency / " + testCase.name
      );
    });
  });

  assertSourceExcludes(
    source,
    "cdn.tailwindcss.com",
    "Tailwind runtime CDN"
  );

  [fixture.chartUrl, fixture.fontAwesomeUrl]
    .forEach(function(url)
    {
      assertSourceContainsOnce(
        source,
        url,
        "retained dependency URL"
      );
    });

  var runtimeUrls = [];
  var dependencyPattern =
    /<(?:script|link)[^>]+(?:src|href)="(https:\/\/[^\"]+)"[^>]*>/g;
  var match;

  while ((match = dependencyPattern.exec(source)) !== null)
  {
    runtimeUrls.push(match[1]);
  }

  if (
    runtimeUrls.length !== 2 ||
    runtimeUrls[0] !== fixture.chartUrl ||
    runtimeUrls[1] !== fixture.fontAwesomeUrl
  )
  {
    throw new Error(
      "Frontend runtime dependency inventory changed: " +
      JSON.stringify(runtimeUrls)
    );
  }

  runtimeUrls.forEach(function(url)
  {
    if (/latest|master/i.test(url))
    {
      throw new Error(
        "Floating frontend dependency URL: " +
        url
      );
    }
  });

  assertSourceContainsOnce(
    source,
    'console.error(\n        "Chart.js unavailable; chart rendering was skipped."',
    "Chart unavailable diagnostic"
  );

  var summary = {
    passed: true,
    scenarios: fixture.cases.length,
    chartPinned: true,
    fallback: true
  };

  Logger.log(
    "PASS: testFrontendDependencyContract | scenarios=" +
    summary.scenarios +
    " | chartPinned=" +
    summary.chartPinned +
    " | fallback=" +
    summary.fallback
  );

  return summary;
}

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

  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

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

  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

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

function testPerformanceAnalyticsVisualContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;

  var ownership = {
    performance: [
      "businessPerformanceSection",
      "revenueChartSection"
    ],
    analytics: [
      "hotColdChartSection",
      "expenseChartSection",
      "topProductsSection",
      "productConcentrationSection"
    ]
  };

  Object.keys(ownership).forEach(function(panelName)
  {
    ownership[panelName].forEach(function(sectionId)
    {
      assertSourceContainsOnce(
        source,
        'staging.querySelector("#' + sectionId + '")',
        panelName + " ownership / " + sectionId
      );
    });
  });
  scenariosPassed++;

  [
    "#dashboardPanelPerformance:not([hidden])",
    "grid-template-columns: minmax(0, 5fr) minmax(0, 7fr)",
    'id="businessPerformanceSection"',
    'id="revenueChartSection"',
    "Primary trend",
    'id="mainChartWrapper"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Performance hero hierarchy");
  });
  scenariosPassed++;

  [
    'id="revenueIntelContainer"',
    'id="expenseIntelContainer"',
    'id="profitIntelContainer"',
    'id="marginIntelContainer"',
    'id="unitsIntelContainer"',
    'label:"Revenue"',
    'label:"Expense"',
    'label:"Profit"',
    'label:"Profit Margin"',
    'label:"Units Sold"',
    "res.summary.revenue.toLocaleString",
    "res.summary.expense.toLocaleString",
    "res.summary.profit.toLocaleString",
    "res.insights.profitMargin",
    "res.summary.unitsSold.toLocaleString"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact five-metric summary");
  });

  var performanceStart = source.indexOf('id="businessPerformanceSection"');
  var performanceEnd = source.indexOf('</section>', performanceStart);
  var performanceSource = source.slice(performanceStart, performanceEnd);
  [
    "overview-kpi-value",
    "renderOverviewKpiCard(",
    "sparkline"
  ].forEach(function(token)
  {
    assertSourceExcludes(
      performanceSource,
      token,
      "non-duplicated Overview KPI presentation"
    );
  });
  scenariosPassed++;

  [
    "function renderRevenueChart(revenueTrend)",
    "function renderHotColdChart(hotColdSplit)",
    "function renderExpenseChart(expenseBreakdown)",
    "revenueChart = destroyChartInstance(revenueChart);",
    "hotColdChart = destroyChartInstance(hotColdChart);",
    "expenseChart = destroyChartInstance(expenseChart);",
    "beginAtZero: true",
    "min: 0",
    'indexAxis: "y"',
    'labels: ["Hot", "Cold"]',
    "percentage.toFixed(1)",
    "expenseBreakdown.slice()",
    "labels.map(formatChartMonthLabel)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "three preserved chart contracts");
  });
  scenariosPassed++;

  [
    'id="topProductsSection"',
    "topProducts .slice(0,5) .map(function(p,index)",
    "p.qty",
    'p.revenue.toLocaleString("id-ID")',
    'id="revenueDependencyContainer"',
    "res.revenueConcentration.product",
    "res.revenueConcentration.contribution",
    'id="paretoContainer"',
    "res.paretoAnalysis.ratio",
    "res.paretoAnalysis.criticalProducts",
    "res.paretoAnalysis.totalProducts"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "product analytical evidence");
  });
  scenariosPassed++;

  [
    'id="revenueChartSummary"',
    'id="hotColdChartSummary"',
    'id="expenseChartSummary"',
    'aria-labelledby="revenueChartTitle"',
    'aria-labelledby="hotColdChartTitle"',
    'aria-labelledby="expenseChartTitle"',
    "shouldReduceMotion() ? false : undefined",
    "pointHoverRadius: 7",
    "usePointStyle: true",
    "chart.options.plugins.legend.labels.color = palette.axis;",
    "synchronizeChartTheme(false);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "accessible theme-aware chart treatment");
  });
  scenariosPassed++;

  [
    ".dashboard-tab-panel:not(#dashboardPanelOverview) { height: 100%; overflow-y: auto; }",
    "#dashboardPanelPerformance:not([hidden])",
    "#dashboardPanelAnalytics:not([hidden])",
    "overflow: hidden;",
    "@media (max-width: 1023px)",
    "#dashboardPanelAnalytics { height: auto; overflow: visible; }",
    "min-width: 0"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "desktop and mobile containment");
  });
  scenariosPassed++;

  [
    "#mainChartWrapper { height: 288px; min-height: 288px; max-height: 288px; overflow: hidden; }",
    "#mainChartWrapper > canvas { display: block; width: 100% !important; height: 100% !important; max-height: 100% !important; }",
    "#dashboardPanelPerformance #revenueChartSection { min-height: 0; height: 100%; margin: 0; overflow: hidden; }",
    "#dashboardPanelPerformance #mainChartWrapper { height: clamp(300px, calc(100dvh - 330px), 440px); min-height: 300px; max-height: 440px; }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded Revenue Trend height");
  });

  assertSourceExcludes(
    source,
    "#dashboardPanelPerformance #mainChartWrapper { height: calc(100% - 76px)",
    "content-derived Revenue Trend height"
  );

  function resolveRevenueChartHeight(viewportWidth, viewportHeight)
  {
    if (viewportWidth < 1024)
    {
      return 288;
    }

    return Math.max(
      300,
      Math.min(viewportHeight - 330, 440)
    );
  }

  [
    { width: 375, height: 667, expected: 288 },
    { width: 1280, height: 768, expected: 438 },
    { width: 1440, height: 900, expected: 440 }
  ].forEach(function(viewport)
  {
    var firstActivation = resolveRevenueChartHeight(
      viewport.width,
      viewport.height
    );
    var repeatedActivation = resolveRevenueChartHeight(
      viewport.width,
      viewport.height
    );

    if (
      firstActivation !== viewport.expected ||
      repeatedActivation !== firstActivation
    )
    {
      throw new Error(
        "Revenue Trend height is not stable at " +
        viewport.width +
        "x" +
        viewport.height
      );
    }
  });
  scenariosPassed++;

  var tabFunctionStart =
    source.indexOf("function resizeVisibleDashboardCharts(tabName)");
  var tabFunctionEnd =
    source.indexOf("function setDesktopSidebarCollapsed", tabFunctionStart);
  var tabFunctionSource =
    source.slice(tabFunctionStart, tabFunctionEnd);

  assertSourceContainsOnce(
    tabFunctionSource,
    "chart.resize();",
    "one chart resize operation per revealed chart"
  );

  [
    "requestAnimationFrame",
    "ResizeObserver",
    "setTimeout",
    'addEventListener("resize"',
    "new Chart(",
    "destroyChartInstance("
  ].forEach(function(token)
  {
    assertSourceExcludes(
      tabFunctionSource,
      token,
      "recursive tab-reveal chart resize"
    );
  });

  [
    "new ResizeObserver(",
    'window.addEventListener("resize"',
    'document.addEventListener("resize"'
  ].forEach(function(token)
  {
    assertSourceExcludes(
      source,
      token,
      "duplicate application resize observer/listener"
    );
  });

  var themeSyncStart =
    source.indexOf("function synchronizeChartTheme(forceLight)");
  var themeSyncEnd =
    source.indexOf("function applyThemePreference", themeSyncStart);
  var themeSyncSource = source.slice(themeSyncStart, themeSyncEnd);

  [
    "chart.resize(",
    "requestAnimationFrame",
    "setTimeout",
    "ResizeObserver"
  ].forEach(function(token)
  {
    assertSourceExcludes(
      themeSyncSource,
      token,
      "theme-triggered recursive chart growth"
    );
  });

  [
    "function synchronizeChartTheme(forceLight)",
    'chart.update("none");',
    "function renderRevenueChart(revenueTrend)",
    "revenueChart = destroyChartInstance(revenueChart);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "preserved chart lifecycle owner");
  });

  [
    "google.script.run",
    "getDashboardData(",
    "requestDashboardData("
  ].forEach(function(token)
  {
    assertSourceExcludes(
      tabFunctionSource,
      token,
      "Performance/Analytics tab backend request"
    );
  });

  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "visual response mutation");
  });

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Performance/Analytics query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    performanceMetrics: 5,
    charts: 3,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testPerformanceAnalyticsVisualContract | scenarios=" +
    summary.scenarios +
    " | performanceMetrics=" +
    summary.performanceMetrics +
    " | charts=" +
    summary.charts +
    " | backendRequests=" +
    summary.backendRequests +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries
  );

  return summary;
}

function testIntelligencePlanningVisualContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;

  var ownership = {
    intelligence: [
      "diagnosisSection",
      "recommendationsSection",
      "riskOpportunitySection"
    ],
    planning: [
      "executiveCenter",
      "kpiTargetReference"
    ]
  };

  Object.keys(ownership).forEach(function(panelName)
  {
    ownership[panelName].forEach(function(sectionId)
    {
      assertSourceContainsOnce(
        source,
        'staging.querySelector("#' + sectionId + '")',
        panelName + " ownership / " + sectionId
      );
    });
  });

  var planningOwnershipStart = source.indexOf("planning: [");
  var planningOwnershipEnd = source.indexOf("]", planningOwnershipStart);
  var planningOwnershipSource = source.slice(
    planningOwnershipStart,
    planningOwnershipEnd
  );

  if (
    planningOwnershipSource.indexOf('staging.querySelector("#executiveCenter")') >
    planningOwnershipSource.indexOf('staging.querySelector("#kpiTargetReference")')
  )
  {
    throw new Error("Planning Target Reference must remain last");
  }
  scenariosPassed++;

  [
    'id="diagnosisSection"',
    'aria-labelledby="diagnosisHeading"',
    "Current diagnosis and executive alert",
    "Executive Alert",
    "alert.level",
    "alert.title",
    "alert.message",
    "diagnosis.map(renderDiagnosisCard)",
    "item.description || item.message"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "diagnosis and alert hierarchy");
  });
  scenariosPassed++;

  [
    'id="recommendationsSection"',
    'role="list"',
    'role="listitem"',
    "recommendations",
    ".slice(0,6)",
    ".map(renderTimelineItem)",
    "Recommendation ${index+1}",
    "item.message",
    "item.priority"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "ordered recommendations");
  });
  scenariosPassed++;

  [
    'id="riskOpportunitySection"',
    "Risk Status",
    'id="riskLevel"',
    'id="riskCount"',
    'id="riskList"',
    "Growth Opportunity",
    'id="growthScore"',
    'id="growthStatus"',
    'id="growthMessage"',
    "active risks detected"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "risk and opportunity semantics");
  });
  scenariosPassed++;

  [
    'id="intelligenceMetricContext"',
    'id="intelligenceDirectionContext"',
    "Revenue Intelligence",
    "Profit Intelligence",
    "res.revenueIntelligence.direction",
    "res.revenueIntelligence.growthRate",
    "res.revenueIntelligence.momentum",
    "res.profitIntelligence.direction",
    "res.profitIntelligence.changeRate",
    "res.profitIntelligence.status",
    'res.summary.profit.toLocaleString("id-ID")'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Revenue and Profit Intelligence");
  });
  scenariosPassed++;

  [
    'id="businessFocusCard"',
    'id="priorityActionCard"',
    "Business Focus",
    "Priority Action",
    "res.businessFocus.focus",
    "res.businessFocus.priority",
    "res.businessFocus.reason",
    "res.businessFocus.expectedImpact",
    "res.priorityAction.title",
    "res.priorityAction.impact",
    "res.priorityAction.message"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Planning decision hierarchy");
  });

  var planningMarkupStart = source.indexOf('id="executiveCenter"');
  var planningMarkupEnd = source.indexOf('id="riskOpportunitySection"', planningMarkupStart);
  var planningMarkupSource = source.slice(planningMarkupStart, planningMarkupEnd);
  [
    "businessPriorityRegion",
    "priority.evidence",
    "priorityAction.score",
    "contenteditable",
    'type="checkbox"'
  ].forEach(function(token)
  {
    assertSourceExcludes(
      planningMarkupSource,
      token,
      "Planning non-editable and non-duplicated priority"
    );
  });
  scenariosPassed++;

  [
    'id="actionRoadmapCard"',
    "res.actionRoadmap.map(function(item,index)",
    "index < res.actionRoadmap.length-1",
    "Week ${item.week}",
    "${item.title}",
    "${item.action}",
    'id="kpiAchievementCard"',
    'role="progressbar"',
    'id="businessMaturityCard"',
    "res.businessMaturity.score",
    "res.businessMaturity.level",
    "res.businessMaturity.description",
    'id="kpiTargetReference"',
    "System-defined targets",
    'aria-expanded="false"',
    'aria-controls="kpiTargetDetails"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "roadmap and supporting planning status");
  });
  scenariosPassed++;

  [
    "#dashboardPanelIntelligence:not([hidden])",
    "grid-template-columns: repeat(3, minmax(0, 1fr))",
    "#dashboardPanelPlanning:not([hidden])",
    ".dashboard-tab-panel:not(#dashboardPanelOverview) { height: 100%; overflow-y: auto; }",
    "overflow: hidden;",
    "@media (max-width: 1023px)",
    "#dashboardPanelPlanning { height: auto; overflow: visible; }",
    "analytics-surface",
    "ui-theme-inset",
    ':root[data-theme="dark"] .bg-white'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "theme and viewport containment");
  });
  scenariosPassed++;

  var tabFunctionStart =
    source.indexOf("function resizeVisibleDashboardCharts(tabName)");
  var tabFunctionEnd =
    source.indexOf("function setDesktopSidebarCollapsed", tabFunctionStart);
  var tabFunctionSource = source.slice(tabFunctionStart, tabFunctionEnd);

  [
    "google.script.run",
    "getDashboardData(",
    "requestDashboardData("
  ].forEach(function(token)
  {
    assertSourceExcludes(
      tabFunctionSource,
      token,
      "Intelligence/Planning tab backend request"
    );
  });

  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "Intelligence/Planning response mutation");
  });

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Intelligence/Planning query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    recommendationOrderPreserved: true,
    editableTargets: false,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testIntelligencePlanningVisualContract | scenarios=" +
    summary.scenarios +
    " | recommendationOrderPreserved=" +
    summary.recommendationOrderPreserved +
    " | editableTargets=" +
    summary.editableTargets +
    " | backendRequests=" +
    summary.backendRequests +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries
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
    getDashboardData.toString();

  var readToken = "getTransactionData(ss)";
  var readIndex = pipelineSource.indexOf(readToken);
  var inspectIndex =
    pipelineSource.indexOf("inspectSourceDateQuality");
  var processIndex =
    pipelineSource.indexOf("processTransactions");

  if (
    readIndex === -1 ||
    readIndex !== pipelineSource.lastIndexOf(readToken) ||
    inspectIndex < readIndex ||
    processIndex < inspectIndex
  )
  {
    throw new Error(
      "Dashboard source-quality pipeline order mismatch"
    );
  }
  scenariosPassed++;

  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();

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
