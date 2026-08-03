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
    "kpiAchievement"
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
      fixture.normal &&
      JSON.stringify(response) !== expectedNormalJson
    )
    {
      throw new Error(
        "Normal populated dashboard output changed"
      );
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
