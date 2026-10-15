/**
 * rpc-shim.js - google.script.run proxy with complete fixture responses for Expense/Purchase forms
 * This is injected into the browser context via Playwright's addInitScript
 */

// Fixture data will be injected by assemble-html.js via window.__NUMLOCK_FIXTURES__
const FIXTURES = new Proxy({}, {
  get: (_, key) => (window.__NUMLOCK_FIXTURES__ || {})[key]
});

/**
 * Simulated google.script.run with fixture responses
 */
window.google = {
  script: {
    get run() {
      let successHandler = null;
      let failureHandler = null;

      const api = new Proxy({}, {
        get(_, methodName) {
          // Handler chain methods
          if (methodName === "withSuccessHandler") {
            return (handler) => {
              console.log(`[RPC Shim] withSuccessHandler called for ${methodName}`, { handler: handler.name || 'anonymous' });
              successHandler = handler;
              return api;
            };
          }
          if (methodName === "withFailureHandler") {
            return (handler) => {
              console.log(`[RPC Shim] withFailureHandler called for ${methodName}`, { handler: handler.name || 'anonymous' });
              failureHandler = handler;
              return api;
            };
          }

// RPC method implementations
           return (...args) => {
             console.log(`[RPC Shim] RPC method invoked: ${methodName}`, { args, successHandler: !!successHandler, failureHandler: !!failureHandler });
             const result = rpcHandler(methodName, ...args);

             // Return a promise that resolves/rejects based on result
             const promise = Promise.resolve(result).then(
               (resolved) => {
                 console.log(`[RPC Shim] Promise resolved for ${methodName}`, { resolved, successHandler: !!successHandler });
                 if (successHandler) {
                   console.log(`[RPC Shim] Calling success handler for ${methodName} with result:`, resolved);
                   successHandler(resolved);
                 }
                 return resolved;
               },
               (rejected) => {
                 console.log(`[RPC Shim] Promise rejected for ${methodName}`, { rejected, failureHandler: !!failureHandler });
                 if (failureHandler) {
                   console.log(`[RPC Shim] Calling failure handler for ${methodName} with error:`, rejected);
                   failureHandler(rejected);
                 }
                 throw rejected;
               }
             );
             console.log(`[RPC Shim] Returning promise for ${methodName}`);
             return promise;
           };
        }
      });

      return api;
    }
  }
};

/**
 * Main RPC handler that routes to fixture responses
 */
function rpcHandler(methodName, ...args) {
  switch (methodName) {
    case "getDashboardData":
      return FIXTURES.dashboard || getDefaultDashboard();

    case "getTransactionEntryOptions":
      return FIXTURES.entryOptions || getDefaultEntryOptions();

    case "getOperationalTransactionAuthority":
      return FIXTURES.operationalAuth || getDefaultOperationalAuth();

    case "getProductEntryPricing":
      // args: [productId, type]
      return handlePricingRequest(args[0], args[1]);

    case "getTransactionsPage":
      // args: [{ tab, page, pageSize, ... }]
      return FIXTURES.transactionsPage || getDefaultTransactionsPage();

    case "submitCanonicalTransaction":
      return handleSubmitTransaction(args[0]);

    case "submitOperationalOrder":
      return handleSubmitOperationalOrder(args[0]);

    case "submitOperationalPurchase":
      return handleSubmitOperationalPurchase(args[0]);

    case "submitOperationalExpense":
      return handleSubmitOperationalExpense(args[0]);

    case "previewCanonicalTransactionCorrection":
      return handlePreviewCorrection(args[0]);

    case "submitCanonicalTransactionCorrection":
      return handleSubmitCorrection(args[0]);

    case "lookupPurchaseEventStatus":
      return handleLookupPurchaseStatus(args[0], args[1]);

    case "getCanonicalTransactionDetails":
      return handleGetTransactionDetails(args[0]);

    case "findOperationalOrder":
      return handleFindOperationalOrder(args[0]);

    case "listOpenOperationalOrders":
      return handleListOpenOrders();

    case "submitOperationalPayment":
      return handleSubmitPayment(args[0]);

    case "submitOperationalFulfillment":
      return handleSubmitFulfillment(args[0]);

    default:
      console.warn(`[RPC Shim] Unhandled method: ${methodName}`, args);
      return { success: true, data: {} };
  }
}

/**
 * Pricing request handler
 */
function handlePricingRequest(productId, type) {
  console.log(`[RPC Shim] Pricing request: productId=${productId}, type=${type}`);

  // Check if we have cached pricing for this product/type
  if (FIXTURES.pricing && FIXTURES.pricing.data) {
    return { success: true, data: FIXTURES.pricing.data };
  }

  // Return default pricing based on product
  const defaultPricing = {
    "PROD-001": { Hot: { price: 25000, hpp: 10000, unitMargin: 15000, purchaseUom: "cup", baseUom: "cup" }, Cold: { price: 28000, hpp: 11000, unitMargin: 17000, purchaseUom: "cup", baseUom: "cup" } },
    "PROD-002": { Hot: { price: 27500, hpp: 11000, unitMargin: 16500, purchaseUom: "cup", baseUom: "cup" }, Cold: { price: 30000, hpp: 12000, unitMargin: 18000, purchaseUom: "cup", baseUom: "cup" } },
    "PROD-003": { Hot: { price: 27500, hpp: 11000, unitMargin: 16500, purchaseUom: "cup", baseUom: "cup" }, Cold: { price: 30000, hpp: 12000, unitMargin: 18000, purchaseUom: "cup", baseUom: "cup" } },
    "PROD-004": { Hot: { price: 23000, hpp: 9200, unitMargin: 13800, purchaseUom: "cup", baseUom: "cup" }, Cold: { price: 25000, hpp: 10000, unitMargin: 15000, purchaseUom: "cup", baseUom: "cup" } },
    "PROD-005": { Hot: { price: 27500, hpp: 11000, unitMargin: 16500, purchaseUom: "cup", baseUom: "cup" }, Cold: { price: 27500, hpp: 11000, unitMargin: 16500, purchaseUom: "cup", baseUom: "cup" } }
  };

  const productPricing = defaultPricing[productId] || defaultPricing["PROD-001"];
  const pricing = productPricing[type] || productPricing.Hot;

  return { success: true, data: pricing };
}

/**
 * Submit canonical transaction (Expense/Purchase)
 */
function handleSubmitTransaction(payload) {
  console.log("[RPC Shim] submitCanonicalTransaction:", payload);

  const { transactionType, expenseItemId, amount, cashAccountCode, isPurchase, purchaseQty, purchaseUom, supplierSource, expenseDate, requestKey } = payload;

  // Simulate successful transaction creation
  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  return {
    success: true,
    status: "OPERATIONAL_POSTED",
    data: {
      id: transactionId,
      transactionType: isPurchase ? "PurchaseEvent" : "Expense",
      expenseItemId,
      amount,
      cashAccountCode,
      expenseDate,
      isPurchase: !!isPurchase,
      purchaseQty,
      purchaseUom,
      supplierSource,
      requestKey,
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Submit operational order (Sales V2)
 */
function handleSubmitOperationalOrder(payload) {
  console.log("[RPC Shim] submitOperationalOrder:", payload);

  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  return {
    success: true,
    data: {
      OrderID: `ORD-ID-${Date.now()}`,
      OrderNumber: orderNumber,
      OrderType: payload.orderType,
      OrderTotal: payload.lines.reduce((sum, line) => sum + (line.qty * 25000), 0),
      Lines: payload.lines.map((line, i) => ({
        LineNumber: i + 1,
        ProductID: line.productID,
        ProductVariantID: line.productVariantID,
        Qty: line.qty,
        SellingPriceSnapshot: 25000
      })),
      PaymentStatus: "UNPAID",
      FulfillmentStatus: "OPEN",
      salesCohort: "V2_COMMITTED"
    }
  };
}

/**
 * Submit operational purchase
 */
function handleSubmitOperationalPurchase(payload) {
  console.log("[RPC Shim] submitOperationalPurchase:", payload);

  return {
    success: true,
    data: {
      PurchaseID: `PUR-${Date.now()}`,
      PurchaseNumber: `PUR-${Date.now()}`,
      PurchaseDate: payload.purchaseDate,
      SupplierID: payload.supplierID,
      ExpenseItemID: payload.expenseItemID,
      Qty: payload.qty,
      PurchaseUOM: payload.purchaseUOM,
      PurchasePrice: payload.purchasePrice,
      PaidVia: payload.paidVia || "1040"
    }
  };
}

/**
 * Submit operational expense
 */
function handleSubmitOperationalExpense(payload) {
  console.log("[RPC Shim] submitOperationalExpense:", payload);

  return {
    success: true,
    data: {
      ExpenseID: `EXP-${Date.now()}`,
      Date: payload.date,
      ExpenseItemID: payload.expenseItemID,
      Description: payload.description,
      Amount: payload.amount,
      PaidVia: payload.paidVia
    }
  };
}

/**
 * Preview correction
 */
function handlePreviewCorrection(payload) {
  console.log("[RPC Shim] previewCanonicalTransactionCorrection:", payload);

  const { transactionId, expenseItemId, amount, reason } = payload;

  return {
    success: true,
    data: {
      transactionType: "EXPENSE",
      before: {
        id: transactionId,
        item: "Original Expense Item",
        amount: 100000
      },
      after: {
        id: transactionId,
        item: expenseItemId,
        amount: amount
      },
      delta: {
        amount: amount - 100000
      }
    }
  };
}

/**
 * Submit correction
 */
function handleSubmitCorrection(payload) {
  console.log("[RPC Shim] submitCanonicalTransactionCorrection:", payload);

  return {
    success: true,
    status: "CORRECTED",
    data: {
      id: payload.transactionId,
      corrected: true
    }
  };
}

/**
 * Lookup purchase event status (for receipt recovery)
 */
function handleLookupPurchaseStatus(requestKey, payload) {
  console.log("[RPC Shim] lookupPurchaseEventStatus:", requestKey, payload);

  return {
    success: true,
    data: {
      status: "NOT_FOUND",
      message: "No matching purchase event found"
    }
  };
}

/**
 * Get transaction details
 */
function handleGetTransactionDetails(ids) {
  console.log("[RPC Shim] getCanonicalTransactionDetails:", ids);

  return {
    success: true,
    data: {
      revision: "local",
      details: ids.map(id => ({
        id,
        transactionType: "Expense",
        item: "Test Expense",
        amount: 50000,
        date: new Date().toISOString().slice(0, 10)
      }))
    }
  };
}

/**
 * Find operational order
 */
function handleFindOperationalOrder(identifier) {
  console.log("[RPC Shim] findOperationalOrder:", identifier);

  return {
    success: true,
    data: null // Not found in local fixture
  };
}

/**
 * List open operational orders
 */
function handleListOpenOrders() {
  console.log("[RPC Shim] listOpenOperationalOrders");

  return {
    success: true,
    data: []
  };
}

/**
 * Submit payment
 */
function handleSubmitPayment(payload) {
  console.log("[RPC Shim] submitOperationalPayment:", payload);

  return {
    success: true,
    data: {
      order: {
        OrderID: payload.orderID,
        PaymentStatus: "PAID",
        ReceiveVia: payload.receiveVia
      }
    }
  };
}

/**
 * Submit fulfillment
 */
function handleSubmitFulfillment(payload) {
  console.log("[RPC Shim] submitOperationalFulfillment:", payload);

  return {
    success: true,
    data: {
      order: {
        OrderID: payload.orderID,
        FulfillmentStatus: payload.next
      }
    }
  };
}

/**
 * Default fixtures if not loaded
 */
function getDefaultDashboard() {
  return {
    summary: { revenue: 0, expense: 0, profit: 0, unitsSold: 0, averageMonthlyRevenue: 0 },
    insights: { profitMargin: 0 },
    dateFilter: { filter: "currentYear", label: "Current year", startDate: "2026-01-01", endDate: "2026-12-31", rowCount: 0, availablePeriods: [] },
    reportingScope: { transactionCount: 0, lastTransactionDate: null },
    dataFreshness: { status: "No Data" },
    periodComparison: { changes: { revenuePercent: null, expensePercent: null, profitPercent: null, unitsSoldPercent: null, profitMarginPoints: null }, status: { revenue: "No Comparison", expense: "No Comparison", profit: "No Comparison", unitsSold: "No Comparison", profitMargin: "No Comparison" }, previous: { startDate: "2025-01-01", endDate: "2025-12-31", rowCount: 0 } },
    dataQuality: { status: "Good", issueCount: 0, issues: [], scope: { scopedRows: 0, excludedInvalidDateRows: 0 }, lifecycle: { inactiveCanonicalRows: 0 } },
    kpiTargets: { editable: false, provenance: "LOCAL FIXTURE", targets: [] },
    revenueTrend: { labels: [], values: [] },
    topProducts: [],
    performanceAnalytics: { productProfitability: [], classifications: { category: [], kind: [] }, hotColdEconomics: [], expenseGroups: [] },
    diagnosis: [],
    recommendations: [],
    recentTransactions: [],
    dashboardPerformance: { totalMs: 0, cacheHit: true }
  };
}

function getDefaultEntryOptions() {
  return { success: true, data: { sales: [], expenses: [], purchases: [], revision: "local" } };
}

function getDefaultOperationalAuth() {
  return {
    success: true,
    data: {
      products: [
        { ProductID: "PROD-001", Name: "Espresso" },
        { ProductID: "PROD-002", Name: "Cappuccino" },
        { ProductID: "PROD-003", Name: "Latte" },
        { ProductID: "PROD-004", Name: "Americano" },
        { ProductID: "PROD-005", Name: "Cold Brew" }
      ],
      productVariants: [
        { ProductVariantID: "PROD-001-HOT", ProductID: "PROD-001", Tipe: "Hot", SellingPrice: 25000 },
        { ProductVariantID: "PROD-001-COLD", ProductID: "PROD-001", Tipe: "Cold", SellingPrice: 28000 },
        { ProductVariantID: "PROD-002-HOT", ProductID: "PROD-002", Tipe: "Hot", SellingPrice: 27500 },
        { ProductVariantID: "PROD-002-COLD", ProductID: "PROD-002", Tipe: "Cold", SellingPrice: 30000 },
        { ProductVariantID: "PROD-003-HOT", ProductID: "PROD-003", Tipe: "Hot", SellingPrice: 27500 },
        { ProductVariantID: "PROD-003-COLD", ProductID: "PROD-003", Tipe: "Cold", SellingPrice: 30000 },
        { ProductVariantID: "PROD-004-HOT", ProductID: "PROD-004", Tipe: "Hot", SellingPrice: 23000 },
        { ProductVariantID: "PROD-004-COLD", ProductID: "PROD-004", Tipe: "Cold", SellingPrice: 25000 },
        { ProductVariantID: "PROD-005-HOT", ProductID: "PROD-005", Tipe: "Hot", SellingPrice: 27500 },
        { ProductVariantID: "PROD-005-COLD", ProductID: "PROD-005", Tipe: "Cold", SellingPrice: 27500 }
      ],
      suppliers: [
        { SupplierID: "SUP-001", Name: "Bean Masters Coffee Roasters" },
        { SupplierID: "SUP-002", Name: "Dairy Fresh Indonesia" },
        { SupplierID: "SUP-003", Name: "EcoPack Solutions" },
        { SupplierID: "SUP-004", Name: "Flavor House Distributors" },
        { SupplierID: "SUP-005", Name: "CleanPro Supplies" }
      ],
      purchaseItems: [
        { ExpenseItemID: "EXP-005", label: "Coffee Beans (Arabica, 1kg)", ItemID: "ITEM-005", category: "COGS", group: "Coffee Beans", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-006", label: "Fresh Milk (Full Cream, 1L)", ItemID: "ITEM-006", category: "COGS", group: "Dairy", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-007", label: "Paper Cups 12oz (50 pcs)", ItemID: "ITEM-007", category: "COGS", group: "Packaging", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-008", label: "Vanilla Syrup (1L)", ItemID: "ITEM-008", category: "COGS", group: "Flavorings", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-010", label: "Cleaning Solution (500ml)", ItemID: "ITEM-010", category: "COGS", group: "Maintenance", kind: "VARIABLE_COST" }
      ],
      expenseItems: [
        { ExpenseItemID: "EXP-001", label: "Rent (Monthly)", category: "Fixed Overhead", group: "Rent", kind: "FIXED_COST" },
        { ExpenseItemID: "EXP-002", label: "Staff Salaries", category: "Fixed Overhead", group: "Salaries", kind: "FIXED_COST" },
        { ExpenseItemID: "EXP-003", label: "Electricity Bill", category: "Utilities", group: "Utilities", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-004", label: "Water Bill", category: "Utilities", group: "Utilities", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-005", label: "Coffee Beans (Arabica, 1kg)", category: "COGS", group: "Coffee Beans", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-006", label: "Fresh Milk (Full Cream, 1L)", category: "COGS", group: "Dairy", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-007", label: "Paper Cups 12oz (50 pcs)", category: "COGS", group: "Packaging", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-008", label: "Vanilla Syrup (1L)", category: "COGS", group: "Flavorings", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-009", label: "Marketing Campaign", category: "Variable Overhead", group: "Marketing", kind: "VARIABLE_COST" },
        { ExpenseItemID: "EXP-010", label: "Cleaning Solution (500ml)", category: "COGS", group: "Maintenance", kind: "VARIABLE_COST" }
      ],
      items: [
        { ItemID: "ITEM-005", Name: "Coffee Beans (Arabica)" },
        { ItemID: "ITEM-006", Name: "Fresh Milk (Full Cream)" },
        { ItemID: "ITEM-007", Name: "Paper Cups 12oz" },
        { ItemID: "ITEM-008", Name: "Vanilla Syrup" },
        { ItemID: "ITEM-010", Name: "Cleaning Solution" }
      ],
      conversions: [
        { ItemID: "ITEM-005", PurchaseUOM: "kg", BaseUOM: "kg", ConversionFactor: 1 },
        { ItemID: "ITEM-006", PurchaseUOM: "L", BaseUOM: "L", ConversionFactor: 1 },
        { ItemID: "ITEM-007", PurchaseUOM: "pack", BaseUOM: "pcs", ConversionFactor: 50 },
        { ItemID: "ITEM-008", PurchaseUOM: "L", BaseUOM: "L", ConversionFactor: 1 },
        { ItemID: "ITEM-010", PurchaseUOM: "bottle", BaseUOM: "pcs", ConversionFactor: 1 }
      ],
      paymentMethods: [
        { code: "1000", label: "Cash (IDR)" },
        { code: "1010", label: "Bank Transfer - BCA" },
        { code: "1020", label: "Bank Transfer - Mandiri" },
        { code: "1040", label: "Accounts Payable (Purchase)" }
      ],
      salesV2Mode: "ACTIVE",
      singleCommitMode: "ACTIVE"
    }
  };
}

function getDefaultTransactionsPage() {
  return { rows: [], totalRows: 0, page: 1, pageSize: 15, totalPages: 0, rangeStart: 0, rangeEnd: 0, searchIndex: [], prefetchedPages: {}, cacheRevision: "local", cacheHit: true, executionMs: 0, payloadBytes: 0 };
}

// Expose for testing
window.__RPC_SHIM__ = { rpcHandler, FIXTURES };

console.log("[RPC Shim] Initialized with methods:", Object.keys(window.google.script.run).filter(k => typeof window.google.script.run[k] === 'function'));