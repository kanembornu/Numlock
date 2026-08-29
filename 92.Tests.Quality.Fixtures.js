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
