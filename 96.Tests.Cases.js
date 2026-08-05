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

  var firstViewportStart =
    source.indexOf(
      'id="executiveSummarySection"'
    );

  var firstViewportEnd =
    source.indexOf(
      "<!-- BUSINESS OVERVIEW -->"
    );

  var firstViewport =
    source.slice(
      firstViewportStart,
      firstViewportEnd
    );

  if (
    firstViewport.split('id="businessPriorityRegion"').length - 1 !== 1 ||
    firstViewport.indexOf("priorityAction") !== -1
  )
  {
    throw new Error(
      "First viewport must contain one authoritative Business Priority"
    );
  }
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
    '#dashboardSidebar { width: 240px;',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 72px;',
    'id="sidebarCollapseButton"',
    'function setDesktopSidebarCollapsed(isCollapsed)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "sidebar size contract");
  });
  scenariosPassed++;

  [
    'id="topUtilityBar"',
    '#topUtilityBar { height: 64px;',
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

  [
    "Products",
    "Capital & Equity",
    "Assets",
    "Depreciation",
    "Financial Statements"
  ].forEach(function(label)
  {
    assertSourceExcludes(source, 'data-page="' + label, "future module");
    assertSourceExcludes(source, ">" + label + "</", "future module label");
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
    destinations: 4,
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

  assertSourceContainsOnce(
    source,
    'role="tablist"',
    "single Dashboard tablist"
  );
  tabNames.forEach(function(tabName)
  {
    assertSourceContainsOnce(
      source,
      'data-dashboard-tab="' + tabName + '"',
      "Dashboard tab " + tabName
    );
    assertSourceContainsOnce(
      source,
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
      "keyMetricsSection"
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
      assertSourceContains(source, token, "tab ARIA relationship");
    });
  });
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
    "#dashboardTabList { height: 48px; }",
    ".dashboard-tab-panel:not(#dashboardPanelOverview)",
    "max-height: calc(100dvh - 152px);",
    "#dashboardPanelOverview { overflow: visible; }",
    "@media (max-width: 1023px)",
    "#contentViewport { overflow: visible; }"
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
    ownedSections: 14,
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
    "grid grid-cols-1 xl:grid-cols-3 gap-5",
    "grid grid-cols-1 xl:grid-cols-4 gap-5",
    "grid grid-cols-1 xl:grid-cols-2 gap-5"
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
    source.indexOf("function requestDashboardData", printFunctionStart);
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
    'printReportButton.nextElementSibling',
    "CSV action beside Print Report"
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
    'renderDrilldownMetric("Revenue",',
    'renderDrilldownMetric("Expense",',
    'renderDrilldownMetric("Profit",',
    'renderDrilldownMetric("Units Sold",',
    '"month",',
    '"expenseCategory",',
    'showPage("transactions");',
    'transactionsHeading.focus();'
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
    "res.recentTransactions.slice()",
    "Filtered from the latest 10 transactions already loaded for the active period.",
    "latestDashboardTransactions.slice()"
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
