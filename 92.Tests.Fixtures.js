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

function createRevenueTrendFixtures()
{
  return [
    {
      name: "unsorted months including current-period data",
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
          date: new Date(2026, 5, 15, 12, 0, 0),
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
        labels: ["2024-12", "2025-01", "2025-03", "2026-06"],
        values: [15000, 20000, 32500, 999999]
      }
    },
    {
      name: "empty dataset",
      data: [],
      expected: {
        labels: [],
        values: []
      }
    }
  ];
}

function createProfitTrendFixtures()
{
  return [
    {
      name: "unsorted cross-year months with revenue expense and refunds",
      data: [
        { date: new Date(2025, 1, 20), transactionType: "Sales", product: "Latte", purchaseCategory: "", category: "Hot", qty: 1, revenue: 500, expense: 0 },
        { date: new Date(2024, 11, 5), transactionType: "Purchase", product: "", purchaseCategory: "Supplies", category: "", qty: 0, revenue: 0, expense: 300 },
        { date: new Date(2025, 0, 10), transactionType: "Sales", product: "Espresso", purchaseCategory: "", category: "Hot", qty: 2, revenue: 1000, expense: 0 },
        { date: new Date(2025, 2, 8), transactionType: "Sales", product: "Water", purchaseCategory: "", category: "Cold", qty: 0, revenue: 0, expense: 0 },
        { date: new Date(2024, 10, 15), transactionType: "Sales", product: "Tea", purchaseCategory: "", category: "Hot", qty: 1, revenue: 200, expense: 0 },
        { date: new Date(2025, 0, 25), transactionType: "Purchase", product: "", purchaseCategory: "Ingredients", category: "", qty: 0, revenue: 0, expense: 400 },
        { date: new Date(2025, 1, 2), transactionType: "Purchase", product: "", purchaseCategory: "Refund", category: "", qty: 0, revenue: 0, expense: -50 }
      ],
      expected: {
        labels: ["2024-11", "2024-12", "2025-01", "2025-02", "2025-03"],
        values: [200, -300, 600, 550, 0]
      }
    },
    {
      name: "empty dataset",
      data: [],
      expected: {
        labels: [],
        values: []
      }
    }
  ];
}

function createHotColdFixtures()
{
  return [
    {
      name: "case-sensitive sales-only quantity aggregation",
      data: [
        { date: new Date(2025, 0, 1), transactionType: "Sales", product: "Espresso", purchaseCategory: "", category: "Hot", qty: 3, revenue: 300, expense: 0 },
        { date: new Date(2025, 0, 2), transactionType: "Sales", product: "Iced Tea", purchaseCategory: "", category: "Cold", qty: 2, revenue: 200, expense: 0 },
        { date: new Date(2025, 0, 3), transactionType: "Sales", product: "Latte", purchaseCategory: "", category: "Hot", qty: 4, revenue: 400, expense: 0 },
        { date: new Date(2025, 0, 4), transactionType: "Sales", product: "Cold Brew", purchaseCategory: "", category: "Cold", qty: 5, revenue: 500, expense: 0 },
        { date: new Date(2025, 0, 5), transactionType: "Sales", product: "Zero", purchaseCategory: "", category: "Hot", qty: 0, revenue: 0, expense: 0 },
        { date: new Date(2025, 0, 6), transactionType: "Purchase", product: "", purchaseCategory: "Hot supplies", category: "Hot", qty: 100, revenue: 0, expense: 1000 },
        { date: new Date(2025, 0, 7), transactionType: "Return", product: "Returned drink", purchaseCategory: "", category: "Cold", qty: 50, revenue: 0, expense: 0 },
        { date: new Date(2025, 0, 8), transactionType: "Sales", product: "Unknown", purchaseCategory: "", category: "Warm", qty: 20, revenue: 2000, expense: 0 },
        { date: new Date(2025, 0, 9), transactionType: "Sales", product: "Lower Hot", purchaseCategory: "", category: "hot", qty: 30, revenue: 3000, expense: 0 },
        { date: new Date(2025, 0, 10), transactionType: "Sales", product: "Upper Cold", purchaseCategory: "", category: "COLD", qty: 40, revenue: 4000, expense: 0 },
        { date: new Date(2025, 0, 11), transactionType: "Sales", product: "Mixed Cold", purchaseCategory: "", category: "CoLd", qty: 60, revenue: 6000, expense: 0 }
      ],
      expected: {
        hot: 7,
        cold: 7
      }
    },
    {
      name: "empty dataset",
      data: [],
      expected: {
        hot: 0,
        cold: 0
      }
    }
  ];
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

function createSparseDatasetFixtures()
{
  var normalPopulatedData = [
    { date: new Date(2025, 0, 10), category: "Hot", transactionType: "Sales", product: "Latte", purchaseCategory: "", qty: 2, revenue: 60000, expense: 0 },
    { date: new Date(2025, 1, 10), category: "Hot", transactionType: "Sales", product: "Espresso", purchaseCategory: "", qty: 4, revenue: 200000, expense: 0 },
    { date: new Date(2025, 2, 11), category: "Cold", transactionType: "Sales", product: "Latte", purchaseCategory: "", qty: 3, revenue: 90000, expense: 0 },
    { date: new Date(2025, 2, 12), category: "", transactionType: "Purchase", product: "", purchaseCategory: "Supplies", qty: 0, revenue: 0, expense: 50000 }
  ];

  return [
    {
      name: "empty dataset",
      data: []
    },
    {
      name: "sales-only dataset",
      data: [
        { date: new Date(2025, 0, 1), category: "Hot", transactionType: "Sales", product: "Latte", purchaseCategory: "", qty: 2, revenue: 60000, expense: 0 },
        { date: new Date(2025, 1, 1), category: "Cold", transactionType: "Sales", product: "Tea", purchaseCategory: "", qty: 1, revenue: 20000, expense: 0 }
      ]
    },
    {
      name: "purchase-only dataset",
      data: [
        { date: new Date(2025, 0, 2), category: "", transactionType: "Purchase", product: "", purchaseCategory: "Supplies", qty: 0, revenue: 0, expense: 25000 },
        { date: new Date(2025, 1, 2), category: "", transactionType: "Purchase", product: "", purchaseCategory: "Rent", qty: 0, revenue: 0, expense: 50000 }
      ]
    },
    {
      name: "one sales row",
      data: [
        { date: new Date(2025, 0, 3), category: "Hot", transactionType: "Sales", product: "Espresso", purchaseCategory: "", qty: 1, revenue: 25000, expense: 0 }
      ]
    },
    {
      name: "one purchase row",
      data: [
        { date: new Date(2025, 0, 4), category: "", transactionType: "Purchase", product: "", purchaseCategory: "Utilities", qty: 0, revenue: 0, expense: 15000 }
      ]
    },
    {
      name: "sparse mixed dataset",
      data: [
        { date: new Date(2025, 0, 5), category: "", transactionType: "Sales", product: "", purchaseCategory: "", qty: 0, revenue: 0, expense: 0 },
        { date: new Date(2025, 1, 5), category: "Hot", transactionType: "Sales", product: "Latte", purchaseCategory: "", qty: 1, revenue: 30000, expense: 0 },
        { date: new Date(2025, 1, 6), category: "", transactionType: "Purchase", product: "", purchaseCategory: "", qty: 0, revenue: 0, expense: 5000 },
        { date: new Date(2025, 2, 6), category: "", transactionType: "Purchase", product: "", purchaseCategory: "Supplies", qty: 0, revenue: 0, expense: 10000 }
      ]
    },
    {
      name: "normal populated dataset",
      data: normalPopulatedData,
      normal: true
    }
  ];
}

function createDashboardDateFilterFixtures()
{
  return {
    referenceDate:
      new Date(2026, 5, 15, 12, 0, 0),

    rows: [
      { date: new Date(2026, 5, 15, 23, 59, 59), transactionType: "Sales", product: "Today", purchaseCategory: "", category: "Hot", qty: 1, revenue: 150, expense: 0 },
      { date: new Date(2026, 5, 14, 12, 0, 0), transactionType: "Sales", product: "Yesterday", purchaseCategory: "", category: "Cold", qty: 1, revenue: 140, expense: 0 },
      { date: new Date(2026, 5, 9, 0, 0, 0), transactionType: "Sales", product: "Last 7 Start", purchaseCategory: "", category: "Hot", qty: 1, revenue: 90, expense: 0 },
      { date: new Date(2026, 5, 8, 23, 59, 59), transactionType: "Sales", product: "Before Last 7", purchaseCategory: "", category: "Cold", qty: 1, revenue: 80, expense: 0 },
      { date: new Date(2026, 5, 1, 0, 0, 0), transactionType: "Sales", product: "Month Start", purchaseCategory: "", category: "Hot", qty: 1, revenue: 10, expense: 0 },
      { date: new Date(2026, 4, 31, 23, 59, 59), transactionType: "Purchase", product: "", purchaseCategory: "Previous End", category: "", qty: 0, revenue: 0, expense: 31 },
      { date: new Date(2026, 4, 1, 0, 0, 0), transactionType: "Purchase", product: "", purchaseCategory: "Previous Start", category: "", qty: 0, revenue: 0, expense: 1 },
      { date: new Date(2026, 3, 30, 23, 59, 59), transactionType: "Purchase", product: "", purchaseCategory: "Before Previous", category: "", qty: 0, revenue: 0, expense: 30 },
      { date: new Date(2026, 0, 1, 0, 0, 0), transactionType: "Sales", product: "Year Start", purchaseCategory: "", category: "Hot", qty: 1, revenue: 1, expense: 0 },
      { date: new Date(2025, 11, 31, 23, 59, 59), transactionType: "Sales", product: "Prior Year", purchaseCategory: "", category: "Cold", qty: 1, revenue: 999, expense: 0 },
      { date: "not-a-date", transactionType: "Sales", product: "Invalid Date", purchaseCategory: "", category: "Hot", qty: 1, revenue: 9999, expense: 0 }
    ],

    trendRows: [
      { date: new Date(2025, 11, 31, 12, 0, 0), transactionType: "Sales", product: "December", purchaseCategory: "", category: "Hot", qty: 1, revenue: 120, expense: 0 },
      { date: new Date(2026, 0, 1, 12, 0, 0), transactionType: "Sales", product: "January", purchaseCategory: "", category: "Cold", qty: 1, revenue: 10, expense: 0 },
      { date: new Date(2026, 4, 20, 12, 0, 0), transactionType: "Sales", product: "May", purchaseCategory: "", category: "Hot", qty: 1, revenue: 50, expense: 0 },
      { date: new Date(2026, 5, 1, 12, 0, 0), transactionType: "Sales", product: "June Start", purchaseCategory: "", category: "Hot", qty: 1, revenue: 60, expense: 0 },
      { date: new Date(2026, 5, 15, 12, 0, 0), transactionType: "Sales", product: "June Current", purchaseCategory: "", category: "Cold", qty: 1, revenue: 150, expense: 0 },
      { date: new Date(2026, 6, 31, 12, 0, 0), transactionType: "Sales", product: "July", purchaseCategory: "", category: "Hot", qty: 1, revenue: 70, expense: 0 },
      { date: new Date(2026, 7, 1, 12, 0, 0), transactionType: "Sales", product: "August Start", purchaseCategory: "", category: "Cold", qty: 1, revenue: 80, expense: 0 },
      { date: new Date(2026, 7, 3, 12, 0, 0), transactionType: "Purchase", product: "", purchaseCategory: "Supplies", category: "", qty: 0, revenue: 0, expense: 5 }
    ]
  };
}

function createDashboardStateContractFixtures()
{
  return {
    states: [
      "loading",
      "success",
      "empty",
      "error",
      "retry"
    ],
    referenceDate:
      new Date(2026, 5, 15, 12, 0, 0),
    cases: [
      {
        name: "valid empty response",
        data: [],
        expectedRowCount: 0,
        expectedState: "empty"
      },
      {
        name: "purchase-only response",
        data: [
          { date: new Date(2026, 5, 10, 12, 0, 0), transactionType: "Purchase", product: "", purchaseCategory: "Supplies", category: "", qty: 0, revenue: 0, expense: 5000 }
        ],
        expectedRowCount: 1,
        expectedState: "success"
      },
      {
        name: "sales-only response",
        data: [
          { date: new Date(2026, 5, 11, 12, 0, 0), transactionType: "Sales", product: "Latte", purchaseCategory: "", category: "Hot", qty: 1, revenue: 30000, expense: 0 }
        ],
        expectedRowCount: 1,
        expectedState: "success"
      },
      {
        name: "populated response",
        data: [
          { date: new Date(2026, 5, 11, 12, 0, 0), transactionType: "Sales", product: "Latte", purchaseCategory: "", category: "Hot", qty: 1, revenue: 30000, expense: 0 },
          { date: new Date(2026, 5, 12, 12, 0, 0), transactionType: "Purchase", product: "", purchaseCategory: "Supplies", category: "", qty: 0, revenue: 0, expense: 5000 }
        ],
        expectedRowCount: 2,
        expectedState: "success"
      }
    ]
  };
}

function createPeriodComparisonFixtures()
{
  var referenceDate =
    new Date(2026, 7, 12, 12, 0, 0);

  return {
    referenceDate: referenceDate,
    ranges: [
      {
        filter: "today",
        expected: "2026-08-11|2026-08-11"
      },
      {
        filter: "last7days",
        expected: "2026-07-30|2026-08-05"
      },
      {
        filter: "currentMonth",
        expected: "2026-07-01|2026-07-12"
      },
      {
        filter: "previousMonth",
        expected: "2026-06-01|2026-06-30"
      },
      {
        filter: "currentYear",
        expected: "2025-01-01|2025-08-12"
      },
      {
        filter: "previousYear",
        expected: "2024-01-01|2024-12-31"
      },
      {
        filter: "customMonth",
        startDate: "2026-03",
        expected: "2026-02-01|2026-02-28"
      },
      {
        filter: "customYear",
        startDate: "2024",
        expected: "2023-01-01|2023-12-31"
      },
      {
        filter: "custom",
        startDate: "2026-08-10",
        endDate: "2026-08-15",
        expected: "2026-08-04|2026-08-09"
      }
    ],
    cappedMonth: {
      referenceDate: new Date(2026, 2, 31, 12, 0, 0),
      expected: "2026-02-01|2026-02-28"
    },
    leapYear: {
      referenceDate: new Date(2024, 1, 29, 12, 0, 0),
      expected: "2023-01-01|2023-02-28"
    },
    rows: [
      { date: new Date(2026, 7, 4, 12, 0, 0), transactionType: "Sales", qty: 2, revenue: 100, expense: 0 },
      { date: new Date(2026, 7, 9, 12, 0, 0), transactionType: "Purchase", qty: 0, revenue: 0, expense: 40 },
      { date: new Date(2026, 7, 10, 12, 0, 0), transactionType: "Sales", qty: 3, revenue: 150, expense: 0 },
      { date: new Date(2026, 7, 15, 12, 0, 0), transactionType: "Purchase", qty: 0, revenue: 0, expense: 60 },
      { date: new Date(2026, 7, 16, 12, 0, 0), transactionType: "Sales", qty: 99, revenue: 9999, expense: 0 }
    ],
    frontendTokens: [
      'id="periodComparisonSection"',
      'id="periodComparisonLabel"',
      "function renderPeriodComparison(periodComparison)",
      'status === "No Comparison"',
      'status === "Stable"',
      'status === "Up" ? "▲ " : "▼ -"',
      'formatDashboardPresentationPeriod(comparison.previous.startDate, "day")',
      '"Comparison unavailable · " + previousPeriod + " has no data"',
      'renderPeriodComparison(res.periodComparison);'
    ]
  };
}

function createBusinessPriorityFixtures()
{
  return {
    baseCache: {
      summary: {
        revenue: 1000000,
        expense: 200000,
        profit: 800000,
        unitsSold: 100,
        bestSeller: "Latte",
        topRevenueProduct: "Latte"
      },
      financial: {
        netProfit: 800000,
        profitMargin: 20
      },
      riskEngine: {
        riskLevel: "Low",
        riskCount: 0,
        risks: []
      },
      revenueIntelligence: {
        direction: "Up",
        growthRate: 10
      },
      forecast: {
        growthRate: 5
      },
      expenseIntelligence: {
        highestExpense: "Supplies",
        highestAmount: 60000,
        expenseShare: 30
      },
      revenueConcentration: {
        product: "Latte",
        contribution: 40,
        risk: "Low"
      },
      businessScore: {
        score: 85,
        status: "Healthy"
      },
      recommendations: [
        { priority: "Low", score: 20, message: "Maintain strategy" }
      ],
      priorityAction: {
        title: "Existing priority",
        impact: "Low",
        score: 20,
        message: "Existing action"
      },
      businessFocus: {
        focus: "Existing focus",
        priority: "Low",
        reason: "Existing reason",
        expectedImpact: "Low"
      },
      executiveAlert: {
        title: "Existing alert",
        level: "Good",
        message: "Existing message"
      },
      diagnosis: [
        { level: "good", message: "Existing diagnosis" }
      ]
    },
    dataQuality: {
      status: "Good",
      issueCount: 0
    },
    periodComparison: {
      changes: {
        revenuePercent: 10,
        expensePercent: -5,
        profitPercent: 15,
        unitsSoldPercent: 8
      },
      status: {
        revenue: "Up",
        expense: "Down",
        profit: "Up",
        unitsSold: "Up"
      }
    },
    cases: [
      {
        name: "Critical Data Quality wins over business signals",
        quality: { status: "Critical", issueCount: 3 },
        overrides: {
          summary: { profit: -50000 },
          financial: { netProfit: -50000, profitMargin: -5 },
          riskEngine: { riskLevel: "High", riskCount: 4, risks: ["a", "b", "c", "d"] },
          revenueIntelligence: { direction: "Down", growthRate: -30 },
          forecast: { growthRate: -20 }
        },
        expectedLevel: "Critical",
        expectedSource: "Data Quality"
      },
      {
        name: "negative profit",
        overrides: {
          summary: { profit: -50000 },
          financial: { netProfit: -50000, profitMargin: -5 }
        },
        expectedLevel: "Critical",
        expectedSource: "Profitability"
      },
      {
        name: "critically low profit margin",
        overrides: {
          summary: { profit: 20000 },
          financial: { netProfit: 20000, profitMargin: 2 }
        },
        expectedLevel: "High",
        expectedSource: "Profitability"
      },
      {
        name: "High risk",
        overrides: {
          riskEngine: { riskLevel: "High", riskCount: 3, risks: ["a", "b", "c"] }
        },
        expectedLevel: "High",
        expectedSource: "Risk"
      },
      {
        name: "material revenue decline",
        overrides: {
          revenueIntelligence: { direction: "Down", growthRate: -20 }
        },
        expectedLevel: "High",
        expectedSource: "Revenue"
      },
      {
        name: "negative forecast",
        overrides: {
          forecast: { growthRate: -12 }
        },
        expectedLevel: "High",
        expectedSource: "Forecast"
      },
      {
        name: "expense concentration",
        overrides: {
          expenseIntelligence: { highestExpense: "Supplies", highestAmount: 140000, expenseShare: 70 }
        },
        expectedLevel: "Medium",
        expectedSource: "Expense"
      },
      {
        name: "product opportunity",
        overrides: {
          revenueConcentration: { product: "Latte", contribution: 60, risk: "High" }
        },
        expectedLevel: "Medium",
        expectedSource: "Product"
      },
      {
        name: "stable maintenance",
        overrides: {},
        expectedLevel: "Low",
        expectedSource: "Stability"
      },
      {
        name: "empty scope",
        rowCount: 0,
        overrides: {
          summary: { revenue: 0, expense: 0, profit: 0, unitsSold: 0 },
          financial: { netProfit: 0, profitMargin: 0 }
        },
        expectedLevel: "Low",
        expectedSource: "Stability",
        expectedTitle: "No Business Activity"
      }
    ],
    tieCandidates: [
      {
        level: "High",
        title: "Revenue tie",
        reason: "Revenue reason",
        action: "Revenue action",
        source: "Revenue",
        score: 80,
        evidence: { metric: "Revenue", value: 1, comparison: "Down" }
      },
      {
        level: "High",
        title: "Risk tie",
        reason: "Risk reason",
        action: "Risk action",
        source: "Risk",
        score: 80,
        evidence: { metric: "Risk", value: 1, comparison: "Current scope" }
      }
    ],
    frontendTokens: [
      'id="businessPriorityRegion"',
      'aria-labelledby="businessPriorityHeading"',
      'id="businessPriorityLevel"',
      'id="priorityTitle"',
      'id="priorityReason"',
      'id="priorityMessage"',
      'id="priorityMeta"',
      'priority.level + " Priority"',
      '"Next action: " + priority.action',
      'priority.evidence.metric',
      'priority.evidence.comparison'
    ]
  };
}

function createKpiTargetFixtures()
{
  return {
    expectedRules: {
      BUSINESS_SCORE: {
        PROFIT_MARGIN_CRITICAL: 5,
        PROFIT_MARGIN_WATCH: 10,
        PROFIT_MARGIN_HEALTHY: 15,
        MINIMUM_REVENUE: 1000000,
        MINIMUM_UNITS: 100,
        EXCELLENT_SCORE: 90,
        HEALTHY_SCORE: 75,
        WATCH_SCORE: 60
      },
      GROWTH_SCORE: {
        STRONG_FORECAST_GROWTH: 10,
        NON_NEGATIVE_FORECAST_GROWTH: 0,
        STRONG_PROFIT_MARGIN: 15,
        HEALTHY_PROFIT_MARGIN: 10,
        STRONG_REVENUE_PER_CUP: 15000,
        HEALTHY_REVENUE_PER_CUP: 12000,
        HIGH_POTENTIAL_SCORE: 80,
        MODERATE_POTENTIAL_SCORE: 60
      },
      KPI_ACHIEVEMENT: {
        REVENUE_STEP: 1000000,
        REVENUE_ADDITIONAL_STEP: 1000000,
        PROFIT_MINIMUM: 1000000,
        PROFIT_STEP: 500000,
        UNIT_STEP: 100,
        MARGIN_TARGET: 15,
        MAXIMUM_ACHIEVEMENT: 100
      },
      BUSINESS_MATURITY: {
        OPTIMIZED_SCORE: 90,
        GROWING_SCORE: 75,
        STABLE_SCORE: 60,
        EMERGING_SCORE: 40
      },
      DIAGNOSIS: {
        LOW_PROFIT_MARGIN: 10,
        CATEGORY_DOMINANCE: 60
      },
      RECOMMENDATION: {
        LOW_PROFIT_MARGIN: 10,
        BUSINESS_SCORE_FLOOR: 70,
        PRICING_OPPORTUNITY_REVENUE_PER_CUP: 12000
      },
      RISK_ENGINE: {
        LOW_PROFIT_MARGIN: 10,
        HIGH_RISK_COUNT: 3,
        MEDIUM_RISK_COUNT: 1
      },
      BUSINESS_FOCUS: {
        LOW_PROFIT_MARGIN: 10,
        OPTIMIZATION_SCORE: 80
      },
      EXECUTIVE_ALERT: {
        EXCELLENT_SCORE: 90
      },
      BUSINESS_PRIORITY: {
        CRITICALLY_LOW_PROFIT_MARGIN: 5,
        MATERIAL_REVENUE_DECLINE: -10,
        EXPENSE_CONCENTRATION: 50,
        PRODUCT_CONCENTRATION: 50
      }
    },
    historicalData: [
      { date: new Date(2025, 0, 10), category: "Hot", transactionType: "Sales", product: "Latte", purchaseCategory: "", qty: 2, revenue: 60000, expense: 0 },
      { date: new Date(2025, 1, 10), category: "Hot", transactionType: "Sales", product: "Espresso", purchaseCategory: "", qty: 4, revenue: 200000, expense: 0 },
      { date: new Date(2025, 2, 11), category: "Cold", transactionType: "Sales", product: "Latte", purchaseCategory: "", qty: 3, revenue: 90000, expense: 0 },
      { date: new Date(2025, 2, 12), category: "", transactionType: "Purchase", product: "", purchaseCategory: "Supplies", qty: 0, revenue: 0, expense: 50000 }
    ],
    expectedHistorical: {
      businessScore:
        '{"score":75,"status":"Healthy","breakdown":{"profitMargin":85.7,"revenue":350000,"unitsSold":9}}',
      growthScore:
        '{"growthScore":100,"status":"High Potential","breakdown":{"revenue":"Up","forecast":233.3,"profitMargin":85.7,"revenuePerCup":38889}}',
      kpiStatus:
        '{"revenue":{"trend":"Up","growth":233.3,"label":"Strong"},"profit":{"trend":"Up","growth":85.7,"label":"Strong"},"business":{"score":75,"status":"Healthy"}}',
      kpiAchievement:
        '{"revenue":{"actual":350000,"target":2000000,"achievement":17.5},"profit":{"actual":300000,"target":1000000,"achievement":30},"units":{"actual":9,"target":100,"achievement":9},"margin":{"actual":85.7,"target":15,"achievement":100}}',
      businessMaturity:
        '{"score":88,"level":"Growing","description":"Bisnis berkembang dengan baik namun masih memiliki ruang untuk peningkatan."}',
      riskEngine:
        '{"riskLevel":"Low","riskCount":0,"risks":[]}',
      recommendationScores: "70,40,35,20",
      businessPriority: "Medium|Expense|70|Review Expense Concentration"
    },
    publicKeys: ["revenue", "profit", "units", "margin"],
    frontendTokens: [
      'id="kpiTargetReference"',
      'id="kpiTargetDetailsButton"',
      'type="button"',
      'aria-expanded="false"',
      'aria-controls="kpiTargetDetails"',
      'onclick="toggleKpiTargetDetails()"',
      'id="kpiTargetDetails"',
      "System-defined targets",
      "function renderKpiTargets(kpiTargets)",
      "formatKpiTargetValue(target)",
      "renderKpiTargets(res.kpiTargets);"
    ],
    frontendExcludedTokens: [
      "User-defined targets",
      "Edit targets",
      ">Editable<"
    ]
  };
}

function createResponsiveShellContractFixtures()
{
  return [
    { name: "menu button", tokens: ['id="sidebarMenuButton"', 'aria-controls="dashboardSidebar"'] },
    { name: "drawer and backdrop", tokens: ['id="dashboardSidebar"', 'id="sidebarBackdrop"'] },
    { name: "menu accessibility", tokens: ['aria-label="Open navigation menu"', 'aria-expanded="false"'] },
    { name: "Escape closes drawer", tokens: ['event.key === "Escape"', 'setSidebarOpen(false, true);'] },
    { name: "navigation closes drawer", tokens: ['document.querySelectorAll("[data-page]")', 'showPage(button.getAttribute("data-page"));'] },
    { name: "body scroll lock", tokens: ['document.body.classList.toggle("overflow-hidden", isOpen);'] },
    { name: "focus restoration", tokens: ['menuButton.focus();'] },
    { name: "active navigation", tokens: ['button.setAttribute("aria-current", "page");'] },
    { name: "table scroll wrapper", tokens: ['id="transactionsTableScroll"', 'overflow-x-auto'] },
    { name: "narrow content width", tokens: ['<main id="mainContent" class="ml-0 min-w-0 w-full flex-1'] },
    { name: "desktop sidebar", tokens: ['#dashboardSidebar { width: 248px;', '#dashboardSidebar { width: 224px;', '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px;', 'lg:translate-x-0', 'grid-template-rows: 76px minmax(0, 1fr); margin-left: 248px;'] },
    { name: "single initialization guard", tokens: ['let responsiveShellInitialized = false;', 'if (responsiveShellInitialized)', 'responsiveShellInitialized = true;'], uniqueToken: 'function initializeResponsiveShell()' }
  ];
}

function createAccessibilityContractFixtures()
{
  return [
    { name: "document language", tokens: ['<html lang="en">'] },
    { name: "viewport metadata", tokens: ['<meta name="viewport" content="width=device-width, initial-scale=1.0">'] },
    { name: "document title", tokens: ['<title>NUMLOCK Coffee Shop Analytics</title>'] },
    { name: "primary main landmark", tokens: ['<main id="mainContent"'], uniqueToken: '<main id="mainContent"' },
    { name: "labelled navigation", tokens: ['<nav class="flex-1 overflow-y-auto p-3" aria-label="Primary navigation">'] },
    { name: "logical chart headings", tokens: ['<h2 id="revenueChartTitle"', '<h2 id="hotColdChartTitle"', '<h2 id="expenseChartTitle"'] },
    { name: "filter selector label", tokens: ['<label for="filter" class="sr-only">Reporting period</label>'] },
    { name: "custom date labels", tokens: ['<label for="customStart" class="sr-only">Custom start date</label>', '<label for="customEnd" class="sr-only">Custom end date</label>'] },
    { name: "invalid control state", tokens: ['function setDateFilterValidation(message)', '"aria-invalid",', 'String(hasError)'] },
    { name: "accessible validation message", tokens: ['id="dateFilterValidation"', 'aria-describedby="dateFilterValidation"', 'setDateFilterValidation("Select both custom dates");'] },
    { name: "active navigation semantics", tokens: ['aria-current="page"', 'button.setAttribute("aria-current", "page");', 'button.removeAttribute("aria-current");'] },
    { name: "table accessible name and empty state", tokens: ['<caption class="sr-only">Visible bounded transactions for the selected Transactions tab</caption>', 'colspan="6" class="p-8 text-center text-sm ui-theme-muted">No visible transactions in this bounded view for the selected period.</td>'] },
    { name: "scoped table headers", tokens: ['<th scope="col" class="px-4 text-left">Date</th>', '<th scope="col" class="px-4 text-right">Amount</th>'] },
    { name: "dynamic status regions", tokens: ['id="dashboardStatus"', 'id="reportingInformation"', 'role="status"', 'aria-live="polite"'] },
    { name: "visible keyboard focus", tokens: ['button:focus-visible,', 'select:focus-visible,', 'input:focus-visible,', 'outline: 3px solid var(--focus);'] },
    { name: "hidden drawer focus exclusion", tokens: ['sidebar.inert = !isOpen && !isDesktop;', 'sidebar.setAttribute(', '"aria-hidden",'] },
    { name: "Escape drawer close", tokens: ['event.key === "Escape"', 'setSidebarOpen(false, true);'] },
    { name: "Retry keyboard operation", tokens: ['id="dashboardRetryButton"', 'type="button"', 'onclick="retryDashboardData()"'] },
    { name: "Data Quality keyboard operation", tokens: ['id="dataQualityDetailsButton"', 'type="button"', 'onclick="toggleDataQualityDetails()"'] },
    { name: "reduced motion CSS", tokens: ['@media (prefers-reduced-motion: reduce)', '.skeleton { animation: none; }', '#dashboardSidebar { transition: none; }', '#actionRoadmapCard .text-xl { transition: none; }'] },
    { name: "Chart animation reduction", tokens: ['function shouldReduceMotion()', 'animation: shouldReduceMotion() ? false : undefined,'] },
    { name: "hidden page focus exclusion", tokens: ['id="transactions" class="page" hidden', 'page.hidden = !isActivePage;'] }
  ];
}

function createChartPresentationContractFixtures()
{
  return [
    { name: "Revenue Trend populated values", tokens: ["function renderRevenueChart(revenueTrend)", "data: values"] },
    { name: "Revenue Trend empty state", tokens: ['"No revenue data for the selected period."', "if (!chartAvailable || isEmpty)"] },
    { name: "daily and monthly two-line labels", tokens: ['return [parts[2] + " " + monthNames[Number(parts[1]) - 1], parts[0]];', 'return parts.length >= 2', '? [monthNames[Number(parts[1]) - 1], parts[0]]'] },
    { name: "daily and monthly Y-axis steps", tokens: ['stepSize: granularity === "day" ? 100000 : 1000000', 'callback: formatRevenueAxisTick', 'typeof value === "number" && value === 0'] },
    { name: "Rupiah tooltip formatting", tokens: ['Number(value || 0).toLocaleString("id-ID")', '"Revenue: " + formatChartCurrency(context.raw)'] },
    { name: "Revenue Trend zero baseline", tokens: ["y: { beginAtZero: true, min: 0", "spanGaps: false"] },
    { name: "stale chart cleared on empty transition", tokens: ["revenueChart = destroyChartInstance(revenueChart);", "context.clearRect(0, 0, canvas.width, canvas.height);"] },
    { name: "Hot Cold populated totals", tokens: ["data: [hot, cold]", "formatChartQuantity(hot)", "formatChartQuantity(cold)"] },
    { name: "Hot Cold zero-total behavior", tokens: ["var isEmpty = total === 0;", '"No Hot/Cold sales data for the selected period."'] },
    { name: "Hot Cold safe percentage", tokens: ["total > 0 ? (context.raw / total) * 100 : 0", 'percentage.toFixed(1) + "%)"'] },
    { name: "Expense populated values and ordering", tokens: ["var expenseData = expenseBreakdown.slice();", "item.category;", "item.amount;"] },
    { name: "Expense empty state", tokens: ['"No expense data for the selected period."', '"Expense breakdown has no represented categories."'] },
    { name: "long category labels", tokens: ['indexAxis: "y"', "ticks: { autoSkip: false, color: chartPalette.axis }"] },
    { name: "accessible titles and summaries", tokens: ['aria-labelledby="revenueChartTitle"', 'aria-labelledby="hotColdChartTitle"', 'aria-labelledby="expenseChartTitle"', 'id="revenueChartSummary"', 'id="hotColdChartSummary"', 'id="expenseChartSummary"'] },
    { name: "summary update behavior", tokens: ["summaryElement.innerText = summary;", "renderRevenueChart(revenueTrend);", "renderHotColdChart(hotColdSplit);", "renderExpenseChart(expenseBreakdown);"] },
    { name: "single chart lifecycle helper", tokens: ["function destroyChartInstance(chart)", "chart.destroy();"], uniqueToken: "function destroyChartInstance(chart)" },
    { name: "responsive chart containment", tokens: ['id="mainChartWrapper" class="relative h-72 min-w-0 sm:h-96"', 'id="hotColdWrapper" class="relative h-72 min-w-0 sm:h-96"', 'id="expenseWrapper" class="relative h-72 min-w-0 sm:h-96"'] }
  ];
}

function createFrontendDependencyContractFixtures()
{
  return {
    chartUrl: "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js",
    fontAwesomeUrl: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
    cases: [
      { name: "Tailwind remains local", tokens: ["HtmlService.createHtmlOutputFromFile('189.View.Tailwind')"] },
      { name: "Chart exact version", tokens: ["chart.js@4.5.1/dist/chart.umd.min.js"] },
      { name: "Font Awesome exact version", tokens: ["font-awesome/6.0.0/css/all.min.css"] },
      { name: "Chart availability detection", tokens: ['typeof Chart === "function"'] },
      { name: "Chart unavailable message", tokens: ['"Chart unavailable."'] },
      { name: "single actionable diagnostic", tokens: ['"Chart.js unavailable; chart rendering was skipped."', "chartUnavailableDiagnosticLogged = true;"] },
      { name: "safe existing instance destruction", tokens: ["revenueChart = destroyChartInstance(revenueChart);", "hotColdChart = destroyChartInstance(hotColdChart);", "expenseChart = destroyChartInstance(expenseChart);"] },
      { name: "accessible summaries retained", tokens: ['id="revenueChartSummary"', 'id="hotColdChartSummary"', 'id="expenseChartSummary"'] },
      { name: "non-chart continuation", tokens: ['document.getElementById("topProductsContainer").innerHTML'] },
      { name: "Chart available constructors", tokens: ["revenueChart = new Chart(", "hotColdChart = new Chart(", "expenseChart = new Chart("] },
      { name: "responsive contract retained", tokens: ['id="mainChartWrapper" class="relative h-72 min-w-0 sm:h-96"'] },
      { name: "chart contract retained", tokens: ["renderRevenueChart(revenueTrend);", "renderHotColdChart(hotColdSplit);", "renderExpenseChart(expenseBreakdown);"] },
      { name: "Font Awesome active usage", tokens: ['class="fas fa-times"', 'class="fas fa-chart-line w-6 text-center"', 'class="fas fa-arrow-right-arrow-left w-6 text-center"'] },
      { name: "no browser alert fallback", excludedTokens: ["alert(\"Chart unavailable.\")", "alert('Chart unavailable.')"] }
    ]
  };
}

function createReportingMetadataFixtures()
{
  var referenceDate =
    new Date(2026, 5, 15, 12, 0, 0);

  return {
    referenceDate: referenceDate,
    cases: [
      {
        name: "empty scoped data",
        rows: [],
        expected: "0|0|0|null|null|No Data"
      },
      {
        name: "sales only current data",
        rows: [
          { date: new Date(2026, 5, 15, 9, 0, 0), transactionType: "Sales" }
        ],
        expected: "1|1|0|2026-06-15|2026-06-15|Current"
      },
      {
        name: "purchase only stale data",
        rows: [
          { date: new Date(2026, 5, 12, 9, 0, 0), transactionType: "Purchase" }
        ],
        expected: "1|0|1|2026-06-12|2026-06-12|Stale"
      },
      {
        name: "mixed earliest latest and counts",
        rows: [
          { date: new Date(2026, 5, 14, 8, 0, 0), transactionType: "Sales" },
          { date: new Date(2026, 5, 10, 8, 0, 0), transactionType: "Purchase" },
          { date: new Date(2026, 5, 15, 10, 0, 0), transactionType: "Sales" }
        ],
        expected: "3|2|1|2026-06-10|2026-06-15|Current"
      },
      {
        name: "invalid date ignored safely",
        rows: [
          { date: "not-a-date", transactionType: "Sales" },
          { date: new Date(2026, 5, 11, 10, 0, 0), transactionType: "Purchase" }
        ],
        expected: "2|1|1|2026-06-11|2026-06-11|Stale"
      }
    ],
    periods: [
      { filter: "today", expected: false },
      { filter: "last7days", expected: false },
      { filter: "currentMonth", expected: true },
      { filter: "currentMonth", referenceDate: new Date(2026, 5, 30, 12, 0, 0), expected: false },
      { filter: "previousMonth", expected: false },
      { filter: "currentYear", expected: true },
      { filter: "currentYear", referenceDate: new Date(2026, 11, 31, 12, 0, 0), expected: false },
      { filter: "custom", expected: false }
    ],
    frontendTokens: [
      'id="reportingInformation"',
      'scope.transactionCount + " transactions"',
      '"Updated " + latestDate',
      '"No transaction data"',
      '"Current": "bg-emerald-100 text-emerald-700"',
      '"Stale": "bg-amber-100 text-amber-700"',
      '"No Data": "bg-slate-100 text-slate-600"',
      'flex flex-wrap items-center'
    ]
  };
}

function createDataQualityDiagnosticsFixtures()
{
  var validSales = {
    date: new Date(2026, 5, 10, 9, 0, 0),
    transactionType: "Sales",
    product: "Latte",
    purchaseCategory: "",
    qty: 1,
    revenue: 30000,
    expense: 0
  };

  var validPurchase = {
    date: new Date(2026, 5, 11, 9, 0, 0),
    transactionType: "Purchase",
    product: "",
    purchaseCategory: "Supplies",
    qty: 0,
    revenue: 0,
    expense: 5000
  };

  return {
    cases: [
      {
        name: "empty data",
        rows: [],
        expected: {
          totalRows: 0,
          validRows: 0,
          issueRows: 0,
          issueCount: 0,
          status: "Good",
          issues: [],
          lifecycle: {
            inactiveCanonicalRows: 0
          },
          scope: {
            sourceRows: 0,
            scopedRows: 0,
            excludedInvalidDateRows: 0
          }
        }
      },
      {
        name: "fully valid mixed rows",
        rows: [validSales, validPurchase],
        expected: {
          totalRows: 2,
          validRows: 2,
          issueRows: 0,
          issueCount: 0,
          status: "Good",
          issues: [],
          lifecycle: {
            inactiveCanonicalRows: 0
          },
          scope: {
            sourceRows: 2,
            scopedRows: 2,
            excludedInvalidDateRows: 0
          }
        }
      },
      {
        name: "invalid date",
        rows: [{ date: "not-a-date", transactionType: "Sales", product: "Latte", qty: 1, expense: 0 }],
        expectedIssue: ["INVALID_DATE", "Critical"]
      },
      {
        name: "unknown transaction type",
        rows: [{ date: new Date(2026, 5, 10), transactionType: "Refund", product: "Latte", qty: 1, expense: 0 }],
        expectedIssue: ["UNKNOWN_TRANSACTION_TYPE", "Critical"]
      },
      {
        name: "missing Sales product",
        rows: [{ date: new Date(2026, 5, 10), transactionType: "Sales", product: "", qty: 1, expense: 0 }],
        expectedIssue: ["MISSING_SALES_PRODUCT", "Attention"]
      },
      {
        name: "missing Purchase category",
        rows: [{ date: new Date(2026, 5, 10), transactionType: "Purchase", purchaseCategory: "", qty: 0, expense: 5000 }],
        expectedIssue: ["MISSING_PURCHASE_CATEGORY", "Attention"]
      },
      {
        name: "negative Sales quantity",
        rows: [{ date: new Date(2026, 5, 10), transactionType: "Sales", product: "Latte", qty: -1, expense: 0 }],
        expectedIssue: ["INVALID_QUANTITY", "Attention"]
      },
      {
        name: "non-finite Sales quantity",
        rows: [{ date: new Date(2026, 5, 10), transactionType: "Sales", product: "Latte", qty: "not-a-number", expense: 0 }],
        expectedIssue: ["INVALID_QUANTITY", "Attention"]
      },
      {
        name: "non-finite Purchase amount",
        rows: [{ date: new Date(2026, 5, 10), transactionType: "Purchase", purchaseCategory: "Supplies", qty: 0, expense: "not-a-number" }],
        expectedIssue: ["INVALID_PURCHASE_AMOUNT", "Attention"]
      },
      {
        name: "one row with multiple issues",
        rows: [{ date: "not-a-date", transactionType: "Sales", product: "", qty: -1, expense: 0 }],
        expectedCodes: ["INVALID_DATE", "MISSING_SALES_PRODUCT", "INVALID_QUANTITY"],
        expectedStatus: "Critical"
      },
      {
        name: "mixed valid and invalid rows",
        rows: [
          validSales,
          { date: new Date(2026, 5, 12), transactionType: "Purchase", purchaseCategory: "", qty: 0, expense: 5000 }
        ],
        expectedIssue: ["MISSING_PURCHASE_CATEGORY", "Attention"],
        expectedValidRows: 1
      }
    ],
    scoped: {
      referenceDate: new Date(2026, 5, 15, 12, 0, 0),
      rows: [
        validSales,
        { date: new Date(2026, 5, 12), transactionType: "Sales", product: "", purchaseCategory: "", qty: 1, revenue: 0, expense: 0 },
        { date: new Date(2026, 4, 31), transactionType: "Refund", product: "", purchaseCategory: "", qty: 0, revenue: 0, expense: 0 },
        { date: "not-a-date", transactionType: "Sales", product: "", purchaseCategory: "", qty: -1, revenue: 0, expense: 0 }
      ]
    },
    processor: {
      transactions: [
        ["Date", "Category", "Type", "Product", "Purchase Category", "Qty", "Amount"],
        [new Date(2026, 5, 10), "Hot", "Sales", "Latte", "", "not-a-number", 0],
        [new Date(2026, 5, 11), "", "Purchase", "", "Supplies", 0, "not-a-number"]
      ],
      priceMap: {
        Latte: { P26Hot: 30000 }
      }
    },
    frontendTokens: [
      'id="dataQualityInformation"',
      'id="dataQualityStatusBadge"',
      'id="dataQualityIssueCount"',
      'id="dataQualityDetailsButton"',
      'type="button"',
      'aria-expanded="false"',
      'aria-controls="dataQualityDetails"',
      'id="dataQualityDetails"',
      '"No data issues"',
      '"Good": "bg-emerald-100 text-emerald-700"',
      '"Attention": "bg-amber-100 text-amber-700"',
      '"Critical": "bg-red-100 text-red-700"',
      'flex flex-wrap items-center'
    ],
    internalCodes: [
      "INVALID_DATE",
      "UNKNOWN_TRANSACTION_TYPE",
      "MISSING_SALES_PRODUCT",
      "MISSING_PURCHASE_CATEGORY",
      "INVALID_QUANTITY",
      "INVALID_PURCHASE_AMOUNT"
    ]
  };
}

function createSourceDataQualityPipelineFixtures()
{
  var header = [
    "Date",
    "Category",
    "Type",
    "Product",
    "Purchase Category",
    "Qty",
    "Amount"
  ];

  var validSales = [
    new Date(2026, 5, 10, 9, 0, 0),
    "Hot",
    "Sales",
    "Latte",
    "",
    1,
    0
  ];

  var validPurchase = [
    new Date(2026, 5, 11, 9, 0, 0),
    "",
    "Purchase",
    "",
    "Supplies",
    0,
    5000
  ];

  var invalidDateSales = [
    "not-a-date",
    "Hot",
    "Sales",
    "Latte",
    "",
    1,
    0
  ];

  return {
    referenceDate:
      new Date(2026, 5, 15, 12, 0, 0),
    priceMap: {
      Latte: { P26Hot: 30000 }
    },
    raw: {
      validOnly: [header, validSales, validPurchase],
      oneInvalid: [header, validSales, invalidDateSales],
      multipleInvalid: [
        header,
        invalidDateSales,
        ["", "", "Purchase", "", "Supplies", 0, 5000]
      ],
      invalidAndMedium: [
        header,
        invalidDateSales,
        [new Date(2026, 5, 12), "Hot", "Sales", "", "", 1, 0]
      ],
      invalidOutsidePeriod: [
        header,
        invalidDateSales,
        [new Date(2026, 4, 20), "Hot", "Sales", "Latte", "", 1, 0]
      ],
      allInvalid: [
        header,
        invalidDateSales,
        ["invalid-again", "", "Purchase", "", "Supplies", 0, 5000]
      ],
      empty: [],
      headerOnly: [header]
    },
    frontendTokens: [
      'id="dataQualityScopeSummary"',
      'quality.scope.scopedRows.toLocaleString("id-ID")',
      '" rows · "',
      'quality.scope.excludedInvalidDateRows.toLocaleString("id-ID")',
      '" excluded · "'
    ]
  };
}
