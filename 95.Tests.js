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

function createTopProductsFixtures()
{
  return [
    {
      name: "aggregated products with stable ties and top-ten truncation",
      data: [
        { date: new Date(2025, 0, 1), transactionType: "Sales", product: "Alpha", purchaseCategory: "", category: "Hot", qty: 3, revenue: 300, expense: 0 },
        { date: new Date(2025, 0, 2), transactionType: "Sales", product: "Bravo", purchaseCategory: "", category: "Hot", qty: 10, revenue: 1000, expense: 0 },
        { date: new Date(2025, 0, 3), transactionType: "Sales", product: "Charlie", purchaseCategory: "", category: "Cold", qty: 8, revenue: 800, expense: 0 },
        { date: new Date(2025, 0, 4), transactionType: "Sales", product: "Delta", purchaseCategory: "", category: "Cold", qty: 8, revenue: 0, expense: 0 },
        { date: new Date(2025, 0, 5), transactionType: "Sales", product: "Echo", purchaseCategory: "", category: "Hot", qty: 7, revenue: 700, expense: 0 },
        { date: new Date(2025, 0, 6), transactionType: "Sales", product: "Foxtrot", purchaseCategory: "", category: "Hot", qty: 6, revenue: 600, expense: 0 },
        { date: new Date(2025, 0, 7), transactionType: "Sales", product: "Golf", purchaseCategory: "", category: "Cold", qty: 5, revenue: 500, expense: 0 },
        { date: new Date(2025, 0, 8), transactionType: "Sales", product: "Hotel", purchaseCategory: "", category: "Cold", qty: 4, revenue: 400, expense: 0 },
        { date: new Date(2025, 0, 9), transactionType: "Sales", product: "India", purchaseCategory: "", category: "Hot", qty: 3, revenue: 300, expense: 0 },
        { date: new Date(2025, 0, 10), transactionType: "Sales", product: "Juliet", purchaseCategory: "", category: "Hot", qty: 2, revenue: 200, expense: 0 },
        { date: new Date(2025, 0, 11), transactionType: "Sales", product: "Kilo", purchaseCategory: "", category: "Cold", qty: 1, revenue: 100, expense: 0 },
        { date: new Date(2025, 0, 12), transactionType: "Sales", product: "Lima", purchaseCategory: "", category: "Cold", qty: 1, revenue: 90, expense: 0 },
        { date: new Date(2025, 0, 13), transactionType: "Sales", product: "ZeroQty", purchaseCategory: "", category: "Hot", qty: 0, revenue: 50, expense: 0 },
        { date: new Date(2025, 0, 14), transactionType: "Sales", product: "Alpha", purchaseCategory: "", category: "Hot", qty: 2, revenue: 250, expense: 0 },
        { date: new Date(2025, 0, 15), transactionType: "Purchase", product: "", purchaseCategory: "Supplies", category: "", qty: 0, revenue: 0, expense: 500 }
      ],
      expected: [
        { name: "Bravo", qty: 10, revenue: 1000 },
        { name: "Charlie", qty: 8, revenue: 800 },
        { name: "Delta", qty: 8, revenue: 0 },
        { name: "Echo", qty: 7, revenue: 700 },
        { name: "Foxtrot", qty: 6, revenue: 600 },
        { name: "Alpha", qty: 5, revenue: 550 },
        { name: "Golf", qty: 5, revenue: 500 },
        { name: "Hotel", qty: 4, revenue: 400 },
        { name: "India", qty: 3, revenue: 300 },
        { name: "Juliet", qty: 2, revenue: 200 }
      ],
      excludedNames: ["Kilo", "Lima", "ZeroQty"]
    },
    {
      name: "empty dataset",
      data: [],
      expected: [],
      excludedNames: []
    }
  ];
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

function createExpenseBreakdownFixtures()
{
  return [
    {
      name: "ordered categories with repeated zero negative and ignored rows",
      data: [
        {
          date: new Date(2025, 0, 1, 12, 0, 0),
          transactionType: "Purchase",
          product: "",
          purchaseCategory: "Supplies",
          category: "",
          qty: 0,
          revenue: 0,
          expense: 100
        },
        {
          date: new Date(2025, 0, 2, 12, 0, 0),
          transactionType: "Purchase",
          product: "",
          purchaseCategory: "Rent",
          category: "",
          qty: 0,
          revenue: 0,
          expense: 500
        },
        {
          date: new Date(2025, 0, 3, 12, 0, 0),
          transactionType: "Purchase",
          product: "",
          purchaseCategory: "Supplies",
          category: "",
          qty: 0,
          revenue: 0,
          expense: 50
        },
        {
          date: new Date(2025, 0, 4, 12, 0, 0),
          transactionType: "Purchase",
          product: "",
          purchaseCategory: "Utilities",
          category: "",
          qty: 0,
          revenue: 0,
          expense: 0
        },
        {
          date: new Date(2025, 0, 5, 12, 0, 0),
          transactionType: "Purchase",
          product: "",
          purchaseCategory: "Refunds",
          category: "",
          qty: 0,
          revenue: 0,
          expense: -25
        },
        {
          date: new Date(2025, 0, 6, 12, 0, 0),
          transactionType: "Purchase",
          product: "",
          purchaseCategory: "",
          category: "",
          qty: 0,
          revenue: 0,
          expense: 999
        },
        {
          date: new Date(2025, 0, 7, 12, 0, 0),
          transactionType: "Sales",
          product: "Latte",
          purchaseCategory: "",
          category: "Hot",
          qty: 1,
          revenue: 300,
          expense: 250
        }
      ],
      expected: {
        breakdown: [
          { category: "Supplies", amount: 150 },
          { category: "Rent", amount: 500 },
          { category: "Utilities", amount: 0 },
          { category: "Refunds", amount: -25 }
        ],
        topExpense: {
          category: "Rent",
          amount: 500
        }
      }
    },
    {
      name: "empty dataset",
      data: [],
      expected: {
        breakdown: [],
        topExpense: null
      }
    }
  ];
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

function runAllBackendTests()
{
  var tests = [
    { name: "getDashboardData", run: getDashboardData },
    { name: "testAggregate", run: testAggregate },
    { name: "testSummaryFixtures", run: testSummaryFixtures },
    { name: "testRevenueTrendFixtures", run: testRevenueTrendFixtures },
    { name: "testExpenseBreakdownFixtures", run: testExpenseBreakdownFixtures },
    { name: "testTopProductsFixtures", run: testTopProductsFixtures },
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
