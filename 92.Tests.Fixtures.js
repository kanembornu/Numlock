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
