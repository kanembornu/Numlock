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

function addDashboardFixtureDateKeys(rows)
{
  return rows.map(function(row)
  {
    var copy = {};
    Object.keys(row).forEach(function(key) { copy[key] = row[key]; });
    var date = new Date(row.date);
    if (!isNaN(date.getTime()))
    {
      copy.dateKey = date.getFullYear() + "-" +
        ("0" + (date.getMonth() + 1)).slice(-2) + "-" +
        ("0" + date.getDate()).slice(-2);
      copy.monthKey = copy.dateKey.slice(0, 7);
    }
    return copy;
  });
}

function createDashboardDateFilterFixtures()
{
  return {
    referenceDate:
      new Date(2026, 5, 15, 12, 0, 0),

    rows: addDashboardFixtureDateKeys([
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
    ]),

    trendRows: addDashboardFixtureDateKeys([
      { date: new Date(2025, 11, 31, 12, 0, 0), transactionType: "Sales", product: "December", purchaseCategory: "", category: "Hot", qty: 1, revenue: 120, expense: 0 },
      { date: new Date(2026, 0, 1, 12, 0, 0), transactionType: "Sales", product: "January", purchaseCategory: "", category: "Cold", qty: 1, revenue: 10, expense: 0 },
      { date: new Date(2026, 4, 20, 12, 0, 0), transactionType: "Sales", product: "May", purchaseCategory: "", category: "Hot", qty: 1, revenue: 50, expense: 0 },
      { date: new Date(2026, 5, 1, 12, 0, 0), transactionType: "Sales", product: "June Start", purchaseCategory: "", category: "Hot", qty: 1, revenue: 60, expense: 0 },
      { date: new Date(2026, 5, 15, 12, 0, 0), transactionType: "Sales", product: "June Current", purchaseCategory: "", category: "Cold", qty: 1, revenue: 150, expense: 0 },
      { date: new Date(2026, 6, 31, 12, 0, 0), transactionType: "Sales", product: "July", purchaseCategory: "", category: "Hot", qty: 1, revenue: 70, expense: 0 },
      { date: new Date(2026, 7, 1, 12, 0, 0), transactionType: "Sales", product: "August Start", purchaseCategory: "", category: "Cold", qty: 1, revenue: 80, expense: 0 },
      { date: new Date(2026, 7, 3, 12, 0, 0), transactionType: "Purchase", product: "", purchaseCategory: "Supplies", category: "", qty: 0, revenue: 0, expense: 5 }
    ])
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
      'renderPeriodComparison(context.comparison);'
    ]
  };
}
