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

  var activeDaysCount =
    Object.keys(aggregate.activeDays).length;

  var totalProfit =
    Object.keys(aggregate.monthlyProfit)
      .reduce(function(total, month)
      {
        return total + aggregate.monthlyProfit[month];
      }, 0);

  var expectedBestSeller = null;
  var highestQty = 0;

  Object.keys(aggregate.productQty)
    .forEach(function(product)
    {
      if(aggregate.productQty[product] > highestQty)
      {
        highestQty = aggregate.productQty[product];
        expectedBestSeller = product;
      }
    });

  var expectedTopRevenueProduct = null;
  var highestRevenue = 0;

  Object.keys(aggregate.productRevenue)
    .forEach(function(product)
    {
      if(aggregate.productRevenue[product] > highestRevenue)
      {
        highestRevenue = aggregate.productRevenue[product];
        expectedTopRevenueProduct = product;
      }
    });

  if((aggregate.activeDaysCount || 0) !== activeDaysCount)
  {
    throw new Error("Aggregate active-day count invariant failed");
  }

  if(totalProfit !== aggregate.revenue - aggregate.expense)
  {
    throw new Error("Aggregate profit total invariant failed");
  }

  if(aggregate.bestSeller !== expectedBestSeller)
  {
    throw new Error("Aggregate best-seller invariant failed");
  }

  if(aggregate.topRevenueProduct !== expectedTopRevenueProduct)
  {
    throw new Error("Aggregate top-revenue-product invariant failed");
  }

  Logger.log("========== Aggregate Validation ==========");

  Logger.log(
    "Revenue : " + aggregate.revenue
  );

  Logger.log(
    "Expense : " + aggregate.expense
  );

  Logger.log(
    "Units : " + aggregate.unitsSold
  );

  Logger.log(
    "Best Seller : " + aggregate.bestSeller
  );

  Logger.log(
    "Top Revenue Product : " + aggregate.topRevenueProduct
  );

  Logger.log(
    "Active Days : " + aggregate.activeDaysCount
  );

  Logger.log("==========================================");
}

function createSummaryFixtures()
{
  return [
    {
      name: "mixed sales purchases repeated products and zero values",
      data: [
        {
          date: new Date(2026, 0, 10, 9, 0, 0),
          category: "Hot",
          transactionType: "Sales",
          product: "Latte",
          purchaseCategory: "",
          qty: 2,
          revenue: 60000,
          expense: 0
        },
        {
          date: new Date(2026, 0, 10, 10, 0, 0),
          category: "Hot",
          transactionType: "Sales",
          product: "Espresso",
          purchaseCategory: "",
          qty: 4,
          revenue: 200000,
          expense: 0
        },
        {
          date: new Date(2026, 0, 11, 9, 0, 0),
          category: "Cold",
          transactionType: "Sales",
          product: "Latte",
          purchaseCategory: "",
          qty: 3,
          revenue: 90000,
          expense: 0
        },
        {
          date: new Date(2026, 0, 12, 9, 0, 0),
          category: "",
          transactionType: "Purchase",
          product: "",
          purchaseCategory: "Supplies",
          qty: 0,
          revenue: 0,
          expense: 50000
        },
        {
          date: new Date(2026, 0, 12, 10, 0, 0),
          category: "Cold",
          transactionType: "Sales",
          product: "Water",
          purchaseCategory: "",
          qty: 0,
          revenue: 0,
          expense: 0
        }
      ],
      expected: {
        revenue: 350000,
        expense: 50000,
        profit: 300000,
        unitsSold: 9,
        bestSeller: "Latte",
        topRevenueProduct: "Espresso",
        avgDailyRevenue: 175000,
        activeDays: 2
      }
    },
    {
      name: "empty dataset",
      data: [],
      expected: {
        revenue: 0,
        expense: 0,
        profit: 0,
        unitsSold: 0,
        bestSeller: "",
        topRevenueProduct: "",
        avgDailyRevenue: 0,
        activeDays: 1
      }
    }
  ];
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

function createRevenueTrendFixtures()
{
  var today = new Date();
  var currentMonthDate =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      15,
      12,
      0,
      0
    );

  var currentMonthLabel =
    currentMonthDate.getFullYear() +
    "-" +
    ("0" + (currentMonthDate.getMonth() + 1)).slice(-2);

  return [
    {
      name: "unsorted completed months with current-month exclusion",
      data: [
        {
          date: new Date(2025, 2, 20, 12, 0, 0),
          transactionType: "Sales",
          product: "Latte",
          purchaseCategory: "",
          category: "Hot",
          qty: 1,
          revenue: 30000,
          expense: 0
        },
        {
          date: new Date(2024, 11, 5, 12, 0, 0),
          transactionType: "Sales",
          product: "Espresso",
          purchaseCategory: "",
          category: "Hot",
          qty: 1,
          revenue: 10000,
          expense: 0
        },
        {
          date: currentMonthDate,
          transactionType: "Sales",
          product: "Current Month Sentinel",
          purchaseCategory: "",
          category: "Cold",
          qty: 1,
          revenue: 999999,
          expense: 0
        },
        {
          date: new Date(2025, 0, 10, 12, 0, 0),
          transactionType: "Sales",
          product: "Americano",
          purchaseCategory: "",
          category: "Cold",
          qty: 1,
          revenue: 20000,
          expense: 0
        },
        {
          date: new Date(2024, 11, 25, 12, 0, 0),
          transactionType: "Sales",
          product: "Espresso",
          purchaseCategory: "",
          category: "Hot",
          qty: 1,
          revenue: 5000,
          expense: 0
        },
        {
          date: new Date(2025, 1, 12, 12, 0, 0),
          transactionType: "Purchase",
          product: "",
          purchaseCategory: "Supplies",
          category: "",
          qty: 0,
          revenue: 0,
          expense: 7000
        },
        {
          date: new Date(2025, 3, 8, 12, 0, 0),
          transactionType: "Sales",
          product: "Water",
          purchaseCategory: "",
          category: "Cold",
          qty: 0,
          revenue: 0,
          expense: 0
        },
        {
          date: new Date(2025, 2, 2, 12, 0, 0),
          transactionType: "Sales",
          product: "Latte",
          purchaseCategory: "",
          category: "Hot",
          qty: 1,
          revenue: 2500,
          expense: 0
        }
      ],
      expected: {
        labels: ["2024-12", "2025-01", "2025-03"],
        values: [15000, 20000, 32500]
      },
      excludedCurrentMonthLabel: currentMonthLabel
    },
    {
      name: "empty dataset",
      data: [],
      expected: {
        labels: [],
        values: []
      },
      excludedCurrentMonthLabel: currentMonthLabel
    }
  ];
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

    if(
      actual.labels.indexOf(
        fixture.excludedCurrentMonthLabel
      ) !== -1
    )
    {
      throw new Error(
        "Revenue Trend fixture included current month: " +
        fixture.excludedCurrentMonthLabel
      );
    }
  });

  return {
    passed: true,
    fixtures: fixtures.length,
    fields: ["labels", "values"]
  };
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
    { name: "testSummaryFixtures", run: testSummaryFixtures },
    { name: "testRevenueTrendFixtures", run: testRevenueTrendFixtures },
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
