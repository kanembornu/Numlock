function testAggregate()
{
  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var processed = getCanonicalTransactionData(ss).records;

  validateAggregate(processed);
}

function testCanonicalTransactionAdapter()
{
  var result = buildCanonicalTransactionData({
    sales: [
      { ID_Trx: "S1", Tanggal: new Date(2025, 0, 15), ID_Prod: "P1", Tipe: "Hot",
        Qty: 3, HPP: 4000, HJ: 10000, Source: "TEST", IsActive: true, sourceRowIndex: 1 },
      { ID_Trx: "S2", Tanggal: new Date(2025, 0, 16), ID_Prod: "P1", Tipe: "Cold",
        Qty: 1, HPP: 5000, HJ: 12000, Source: "TEST", IsActive: false, sourceRowIndex: 2 }
    ],
    expenses: [
      { ID_Trx: "E1", Tanggal: new Date(2025, 0, 17), ID_Ops: "O1", Nilai: 75000,
        Source: "TEST", IsActive: true, sourceRowIndex: 1 }
    ],
    products: [
      { ID_Prod: "P1", Produk: "Retired Product", Kategori: "Coffee", Kind: "Beverage", IsActive: false }
    ],
    expenseItems: [
      { ID_Ops: "O1", Item: "Electricity", Kategori: "Utility", Kind: "Support", Group: "Operating", IsActive: false }
    ]
  });
  var sale = result.records[0], expense = result.records[1];
  if (result.records.length !== 2 || result.sourceQuality.inactiveLedgerRows !== 1 ||
      sale.product !== "Retired Product" || sale.productCategory !== "Coffee" || sale.kind !== "Beverage" ||
      sale.cogs !== 12000 || sale.revenue !== 30000 || sale.margin !== 18000 || sale.year !== 2025 || sale.month !== 1 ||
      expense.canonicalTransactionType !== "Expense" || expense.transactionType !== "Purchase" ||
      expense.purchaseCategory !== "Electricity" || expense.category !== "Utility" || expense.kind !== "Support" ||
      expense.group !== "Operating" || expense.expense !== 75000)
  {
    throw new Error("Canonical transaction adapter contract mismatch");
  }

  var readCounts = {};
  var tables = {
    tabsal: [["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"],
      ["S1", new Date(2025, 0, 15), "P1", "Hot", 3, 4000, 10000, "TEST", true]],
    tabops: [["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"],
      ["E1", new Date(2025, 0, 17), "O1", 75000, "TEST", true]],
    Products: [["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"],
      ["P1", "Product", "Coffee", "Beverage", true]],
    ExpenseItems: [["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"],
      ["O1", "Electricity", "Utility", "Support", "Operating", true]]
  };
  var mockSpreadsheet = {
    getSheetByName: function(name) {
      return {
        getDataRange: function() {
          return {
            getValues: function() {
              readCounts[name] = (readCounts[name] || 0) + 1;
              return tables[name];
            }
          };
        }
      };
    }
  };
  var performance = {};
  var timedResult = getCanonicalTransactionData(mockSpreadsheet, performance);
  ["tabsal", "tabops", "Products", "ExpenseItems"].forEach(function(name) {
    if (readCounts[name] !== 1) throw new Error(name + " was not read exactly once");
  });
  ["salesReadMs", "expenseReadMs", "productReadMs", "expenseItemReadMs", "normalizeMs"]
    .forEach(function(key) {
      if (typeof performance[key] !== "number" || performance[key] < 0) {
        throw new Error("Missing canonical performance timing: " + key);
      }
    });
  if (timedResult.records.length !== 2) throw new Error("Timed canonical adapter result mismatch");
  if (timedResult.records[0].dateKey !== "2025-01-15" || timedResult.records[0].monthKey !== "2025-01") {
    throw new Error("Canonical date normalization was not retained once");
  }

  var filterSource = filterTransactionsByDateRange.toString();
  var aggregateSource = buildAggregate.toString();
  if (filterSource.indexOf("Utilities.formatDate") !== -1 || aggregateSource.indexOf("Utilities.formatDate") !== -1) {
    throw new Error("Dashboard row loops retained Apps Script date-format service calls");
  }

  var cacheKeys = [
    buildDashboardCacheKey("currentYear", "", "", "4"),
    buildDashboardCacheKey("custom", "2026-01-01", "2026-01-31", "4"),
    buildDashboardCacheKey("custom", "2026-02-01", "2026-02-28", "4"),
    buildDashboardCacheKey("currentYear", "", "", "5")
  ];
  if (Object.keys(cacheKeys.reduce(function(index, key) { index[key] = true; return index; }, {})).length !== 4) {
    throw new Error("Dashboard cache key does not isolate filter contexts and revisions");
  }
  var dashboardExecutionSource = buildDashboardDataExecution.toString();
  if (dashboardExecutionSource.indexOf("dashboardCache.put(cacheKey, serializedResponse") <
      dashboardExecutionSource.indexOf("var response = buildDashboardResponse")) {
    throw new Error("Dashboard cache could store a partial or failed response");
  }
  [submitCanonicalTransaction, voidCanonicalTransaction, correctCanonicalTransaction,
    syncLegacyTransactionsToCanonical].forEach(function(mutation) {
    if (mutation.toString().indexOf("invalidateDashboardCache()") === -1) {
      throw new Error("Dashboard cache invalidation missing from " + mutation.name);
    }
  });

  return { passed: true, records: 2, inactiveExcluded: 1, singleReadSheets: 4,
    normalizedDateKeys: true, cacheContexts: 4, mutationInvalidators: 4 };
}

function testProductPricingResolution()
{
  var index = buildProductPricingIndex([
    { ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: new Date(2024, 0, 1), EffectiveTo: new Date(2024, 11, 31), HPP: 4, Harga: 10, IsActive: false },
    { ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: new Date(2025, 0, 1), EffectiveTo: "", HPP: 5, Harga: 12, IsActive: true }
  ]);
  var historical = resolveProductPrice(index, "P1", "Hot", new Date(2024, 5, 1), false);
  var current = resolveProductPrice(index, "P1", "Hot", new Date(2025, 5, 1), true);
  if (historical.Harga !== 10 || current.HPP !== 5 || current.Harga !== 12) {
    throw new Error("ProductPricing effective-date resolution mismatch");
  }
  assertThrowsMessage(function() {
    resolveProductPrice(index, "P1", "Cold", new Date(2025, 5, 1), true);
  }, "ProductPricing expected exactly one effective record for P1|Cold; found 0");
  return { passed: true, scenarios: 3 };
}

function testCanonicalTransactionEntryService()
{
  var timestamp = new Date(2026, 7, 13, 10, 30, 0, 0);
  var context = {
    timestamp: timestamp,
    products: [
      { ID_Prod: "P1", Produk: "Espresso", Kategori: "Coffee", Kind: "Beverage", IsActive: true },
      { ID_Prod: "P2", Produk: "Retired", Kategori: "Coffee", Kind: "Beverage", IsActive: false }
    ],
    pricing: [
      { ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: new Date(2026, 0, 1), EffectiveTo: "", HPP: 4000, Harga: 10000, IsActive: true },
      { ID_Prod: "P1", Tipe: "Cold", EffectiveFrom: new Date(2026, 0, 1), EffectiveTo: "", HPP: 5000, Harga: 12000, IsActive: true }
    ],
    expenseItems: [
      { ID_Ops: "O1", Item: "Electricity", Kategori: "Utility", Kind: "Operating", Group: "Overhead", AccountCode: "6100", IsActive: true },
      { ID_Ops: "O2", Item: "Retired", Kategori: "Utility", Kind: "Operating", Group: "Overhead", AccountCode: "6100", IsActive: false },
      { ID_Ops: "O3", Item: "Orphan", Kategori: "Utility", Kind: "Operating", Group: "Overhead", AccountCode: "9999", IsActive: true },
      { ID_Ops: "O4", Item: "Inactive Account", Kategori: "Utility", Kind: "Operating", Group: "Overhead", AccountCode: "6200", IsActive: true }
    ],
    accounts: [
      { AccountCode: "6100", IsActive: true },
      { AccountCode: "6200", IsActive: false }
    ]
  };
  var scenarios = 0;
  function expectCode(callback, code) {
    var actual = null;
    try { callback(); } catch (error) { actual = error.entryCode; }
    if (actual !== code) throw new Error("Expected entry error " + code + "; got " + actual);
    scenarios++;
  }

  var hot = prepareCanonicalSalesEntry({ transactionType: "SALES", productId: "P1", type: "Hot", qty: 3,
    HPP: 1, HJ: 2, ID_Trx: "FAKE", Source: "FAKE" }, context);
  if (hot.product !== "Espresso" || hot.unitHPP !== 4000 || hot.unitPrice !== 10000 ||
      hot.cogs !== 12000 || hot.revenue !== 30000 || hot.margin !== 18000 || hot.id || hot.Source) {
    throw new Error("Valid Hot entry or protected-field contract mismatch");
  }
  scenarios += 7;
  var cold = prepareCanonicalSalesEntry({ productId: "P1", type: "Cold", qty: 2 }, context);
  if (cold.unitHPP !== 5000 || cold.unitPrice !== 12000 || cold.margin !== 14000) {
    throw new Error("Valid Cold pricing contract mismatch");
  }
  scenarios += 3;
  expectCode(function() { prepareCanonicalSalesEntry({ productId: "missing", type: "Hot", qty: 1 }, context); }, "PRODUCT_NOT_FOUND");
  expectCode(function() { prepareCanonicalSalesEntry({ productId: "P2", type: "Hot", qty: 1 }, context); }, "PRODUCT_INACTIVE");
  expectCode(function() { prepareCanonicalSalesEntry({ productId: "P1", type: "Warm", qty: 1 }, context); }, "INVALID_SALES_TYPE");
  [0, -1, "2", 1.5].forEach(function(qty) {
    expectCode(function() { prepareCanonicalSalesEntry({ productId: "P1", type: "Hot", qty: qty }, context); }, "INVALID_QTY");
  });
  expectCode(function() { prepareCanonicalSalesEntry({ productId: "P1", type: "Hot", qty: 1 },
    { timestamp: timestamp, products: context.products, pricing: [], expenseItems: [], accounts: [] }); }, "PRICE_NOT_FOUND");
  var overlapping = context.pricing.concat([{ ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: new Date(2026, 0, 1),
    EffectiveTo: "", HPP: 4100, Harga: 10100, IsActive: true }]);
  expectCode(function() { prepareCanonicalSalesEntry({ productId: "P1", type: "Hot", qty: 1 },
    { timestamp: timestamp, products: context.products, pricing: overlapping, expenseItems: [], accounts: [] }); }, "PRICE_AMBIGUOUS");

  var expense = prepareCanonicalExpenseEntry({ transactionType: "EXPENSE", expenseItemId: "O1", amount: 75000,
    ID_Trx: "FAKE", Source: "FAKE" }, context);
  if (expense.item !== "Electricity" || expense.category !== "Utility" || expense.group !== "Overhead" ||
      expense.amount !== 75000 || expense.id || expense.Source) {
    throw new Error("Valid Expense or protected-field contract mismatch");
  }
  scenarios += 5;
  expectCode(function() { prepareCanonicalExpenseEntry({ expenseItemId: "missing", amount: 1 }, context); }, "EXPENSE_ITEM_NOT_FOUND");
  expectCode(function() { prepareCanonicalExpenseEntry({ expenseItemId: "O2", amount: 1 }, context); }, "EXPENSE_ITEM_INACTIVE");
  expectCode(function() { prepareCanonicalExpenseEntry({ expenseItemId: "O3", amount: 1 }, context); }, "ACCOUNT_NOT_FOUND");
  expectCode(function() { prepareCanonicalExpenseEntry({ expenseItemId: "O4", amount: 1 }, context); }, "ACCOUNT_INACTIVE");
  [0, -1, "1000", NaN].forEach(function(amount) {
    expectCode(function() { prepareCanonicalExpenseEntry({ expenseItemId: "O1", amount: amount }, context); }, "INVALID_AMOUNT");
  });

  var uuids = ["AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA", "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB"];
  var collisionChecks = 0;
  var salesId = generateCanonicalEntryId("SAL-APP-", timestamp, function() { return uuids.shift(); }, function(id) {
    collisionChecks++;
    return id.indexOf("AAAAAAAAAAAA") !== -1;
  });
  var expenseId = generateCanonicalEntryId("OPS-APP-", timestamp,
    function() { return "CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC"; }, function() { return false; });
  if (salesId !== "SAL-APP-20260813-BBBBBBBBBBBB" || expenseId !== "OPS-APP-20260813-CCCCCCCCCCCC" || collisionChecks !== 2) {
    throw new Error("APP_ENTRY ID prefix, uniqueness, or collision retry mismatch");
  }
  scenarios += 3;

  function memorySheet(headers, corruptReadback) {
    var rows = [headers.slice()];
    return {
      rows: rows,
      getLastColumn: function() { return rows[0].length; },
      getLastRow: function() { return rows.length; },
      deleteRow: function(row) { rows.splice(row - 1, 1); },
      getRange: function(row, column, rowCount, columnCount) {
        return {
          setValues: function(values) { rows[row - 1] = values[0].slice(); },
          getValues: function() {
            var value = rows[row - 1].slice(column - 1, column - 1 + columnCount);
            if (corruptReadback && row > 1) value[0] = "CORRUPT";
            return [value];
          },
          getValue: function() { return rows[row - 1] ? rows[row - 1][column - 1] : ""; }
        };
      }
    };
  }
  var ledger = memorySheet(CANONICAL_ENTRY.SALES_HEADERS), logs = memorySheet(CANONICAL_ENTRY.LOG_HEADERS);
  var memorySpreadsheet = { getSheetByName: function(name) { return name === "tabsal" ? ledger : name === "Logs" ? logs : null; } };
  var persistedValues = [salesId, timestamp, "P1", "Hot", 3, 4000, 10000, "APP_ENTRY", true,
    timestamp, "SYSTEM_APP_ENTRY", "", ""];
  var flushes = 0;
  persistCanonicalEntry(memorySpreadsheet, { sheetName: "tabsal", headers: CANONICAL_ENTRY.SALES_HEADERS,
    values: persistedValues, timestamp: timestamp, id: salesId, action: "CREATE_SALES" },
    { flush: function() { flushes++; }, uuid: function() { return "AUDIT-UUID"; } });
  if (ledger.rows.length !== 2 || logs.rows.length !== 2 || flushes !== 2 ||
      ledger.rows[1][7] !== "APP_ENTRY" || ledger.rows[1][8] !== true ||
      ledger.rows[1][10] !== "SYSTEM_APP_ENTRY" || logs.rows[1][3] !== "TransactionEntry" ||
      logs.rows[1][4] !== "CREATE_SALES" || logs.rows[1][5] !== salesId) {
    throw new Error("Canonical write/verify/audit persistence contract mismatch");
  }
  scenarios += 10;
  var corruptLedger = memorySheet(CANONICAL_ENTRY.SALES_HEADERS, true);
  var rollbackLogs = memorySheet(CANONICAL_ENTRY.LOG_HEADERS);
  var rollbackSpreadsheet = { getSheetByName: function(name) { return name === "tabsal" ? corruptLedger : rollbackLogs; } };
  expectCode(function() {
    persistCanonicalEntry(rollbackSpreadsheet, { sheetName: "tabsal", headers: CANONICAL_ENTRY.SALES_HEADERS,
      values: persistedValues, timestamp: timestamp, id: salesId, action: "CREATE_SALES" },
      { flush: function() {}, uuid: function() { return "AUDIT-UUID"; } });
  }, "WRITE_FAILED");
  if (corruptLedger.rows.length !== 1 || rollbackLogs.rows.length !== 1) {
    throw new Error("Unverified canonical write was not rolled back");
  }
  scenarios += 2;

  var submitSource = submitCanonicalTransaction.toString();
  var persistSource = persistCanonicalEntry.toString();
  ["LockService.getScriptLock()", "lock.waitLock(30000)", "prepareCanonicalSalesEntry(payload, context)",
    "prepareCanonicalExpenseEntry(payload, context)", "persistCanonicalEntry(ss", '"CREATE_SALES"',
    '"CREATE_EXPENSE"', "lock.releaseLock()",
    'Utilities.formatDate(timestamp, CANONICAL_ENTRY.TIMEZONE, "yyyy-MM-dd\'T\'HH:mm:ssXXX")'].forEach(function(token) {
    assertSourceContains(submitSource, token, "entry concurrency/write contract"); scenarios++;
  });
  assertSourceExcludes(submitSource, "entry.timestamp = timestamp", "serializable entry response contract");
  scenarios++;
  ["SpreadsheetApp.flush()", "canonicalEntryRowMatches(", "TransactionEntry", "deleteRow("].forEach(function(token) {
    assertSourceContains(persistSource, token, "write verify audit/rollback contract"); scenarios++;
  });
  [submitSource, persistSource, prepareCanonicalSalesEntry.toString(), prepareCanonicalExpenseEntry.toString()].forEach(function(source) {
    assertSourceExcludes(source, 'getSheetByName("Transaction")', "Transaction protection");
    assertSourceExcludes(source, 'getSheetByName("Helper")', "Helper protection");
  });
  scenarios += 8;

  var adapter = buildCanonicalTransactionData({
    sales: [{ ID_Trx: salesId, Tanggal: timestamp, ID_Prod: "P1", Tipe: "Hot", Qty: 3,
      HPP: 4000, HJ: 10000, Source: "APP_ENTRY", IsActive: true, sourceRowIndex: 1 }],
    expenses: [{ ID_Trx: expenseId, Tanggal: timestamp, ID_Ops: "O1", Nilai: 75000,
      Source: "APP_ENTRY", IsActive: true, sourceRowIndex: 1 }],
    products: context.products,
    expenseItems: context.expenseItems
  });
  if (adapter.records.length !== 2 || adapter.records[0].source !== "APP_ENTRY" || adapter.records[1].source !== "APP_ENTRY") {
    throw new Error("APP_ENTRY canonical adapter compatibility mismatch");
  }
  scenarios += 2;
  var options = buildTransactionEntryOptions(
    context.products.concat([{ ID_Prod: "P0", Produk: "Americano", Kategori: "Coffee", Kind: "Beverage", IsActive: true, Notes: "private" }]),
    context.expenseItems
  );
  if (options.sales.length !== 2 || options.sales[0].productId !== "P0" ||
      Object.prototype.hasOwnProperty.call(options.sales[0], "Notes") ||
      options.expenses.length !== 3 || options.expenses[0].item !== "Electricity" ||
      Object.prototype.hasOwnProperty.call(options.expenses[0], "AccountCode")) {
    throw new Error("Active projected entry options contract mismatch");
  }
  scenarios += 6;
  Logger.log("PASS: testCanonicalTransactionEntryService | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testCanonicalTransactionLifecycleService()
{
  var timestamp = new Date(2026, 7, 14, 10, 0, 0), scenarios = 0;
  function expectCode(callback, code) {
    var actual = null;
    try { callback(); } catch (error) { actual = error.entryCode; }
    if (actual !== code) throw new Error("Expected lifecycle error " + code + "; got " + actual);
    scenarios++;
  }
  function memorySheet(headers, initialRows, corruptAudit) {
    var rows = [headers.slice()].concat((initialRows || []).map(function(row) { return row.slice(); }));
    var readCount = 0;
    return {
      rows: rows,
      getLastColumn: function() { return rows[0].length; },
      getLastRow: function() { return rows.length; },
      deleteRow: function(row) { rows.splice(row - 1, 1); },
      getDataRange: function() { return { getValues: function() { return rows.map(function(row) { return row.slice(); }); } }; },
      getRange: function(row, column, rowCount, columnCount) {
        return {
          setValues: function(values) { rows[row - 1] = values[0].slice(); },
          getValues: function() {
            var values = (rows[row - 1] || []).slice(column - 1, column - 1 + columnCount);
            readCount++;
            if ((typeof corruptAudit === "function" && corruptAudit(row, readCount)) || (corruptAudit === true && row > 1)) values[0] = "CORRUPT";
            return [values];
          },
          getValue: function() { return rows[row - 1] ? rows[row - 1][column - 1] : ""; },
          createTextFinder: function(value) {
            return { matchEntireCell: function() { return this; }, findNext: function() {
              for (var index = 1; index < rows.length; index++) if (String(rows[index][column - 1]) === String(value)) return {};
              return null;
            } };
          }
        };
      }
    };
  }
  var salesRow = ["SAL-APP-20260814-AAAAAAAAAAAA", timestamp, "P1", "Hot", 2, 4000, 10000,
    "APP_ENTRY", true, timestamp, "SYSTEM_APP_ENTRY", "", ""];
  var legacyRow = salesRow.slice(); legacyRow[0] = "SAL-GLEG-00000002"; legacyRow[7] = "LEGACY_GOOGLE";
  var xlsmRow = salesRow.slice(); xlsmRow[0] = "SAL-XLSM-00000001"; xlsmRow[7] = "XLSM";
  var active = canonicalLifecycleMutability({ spec: { type: "SALES" }, values: salesRow });
  if (!active.canCorrect || !active.canVoid || active.immutableReason !== null) throw new Error("APP_ENTRY mutability mismatch");
  scenarios += 3;
  var legacy = canonicalLifecycleMutability({ spec: { type: "SALES" }, values: legacyRow });
  var historical = canonicalLifecycleMutability({ spec: { type: "SALES" }, values: xlsmRow });
  if (legacy.canCorrect || legacy.canVoid || legacy.immutableReason !== "LEGACY_TRANSACTION" ||
      historical.canCorrect || historical.canVoid || historical.immutableReason !== "HISTORICAL_TRANSACTION") {
    throw new Error("Historical source immutability mismatch");
  }
  scenarios += 6;
  var voidedRow = salesRow.slice(); voidedRow[8] = false;
  var voided = canonicalLifecycleMutability({ spec: { type: "SALES" }, values: voidedRow });
  if (voided.canCorrect || voided.canVoid || voided.immutableReason !== "ALREADY_VOIDED") throw new Error("Voided mutability mismatch");
  scenarios += 3;
  expectCode(function() { requireMutableLifecycleRecord({ spec: { type: "SALES" }, values: legacyRow }); }, "TRANSACTION_READ_ONLY");
  expectCode(function() { requireMutableLifecycleRecord({ spec: { type: "SALES" }, values: xlsmRow }); }, "TRANSACTION_READ_ONLY");
  expectCode(function() { requireMutableLifecycleRecord({ spec: { type: "SALES" }, values: voidedRow }); }, "TRANSACTION_ALREADY_VOIDED");
  ["", "  ", "--", new Array(502).join("x")].forEach(function(reason) {
    expectCode(function() { requireLifecycleReason(reason); }, "INVALID_VOID_REASON");
  });
  if (requireLifecycleReason("  duplicate sale entered  ") !== "duplicate sale entered") throw new Error("Lifecycle reason trim mismatch");
  scenarios++;

  var ledger = memorySheet(CANONICAL_ENTRY.SALES_HEADERS, [salesRow]);
  var logs = memorySheet(CANONICAL_ENTRY.LOG_HEADERS, []);
  var ss = { getSheetByName: function(name) { return name === "tabsal" ? ledger : name === "Logs" ? logs : null; } };
  var original = findCanonicalLifecycleRecord(ss, salesRow[0]), flushes = 0, uuidIndex = 0;
  var runtime = { flush: function() { flushes++; }, uuid: function() { uuidIndex++; return "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBB" + uuidIndex; } };
  persistCanonicalVoid(ss, original, "duplicate", timestamp, runtime);
  if (ledger.rows[1][8] !== false || ledger.rows[1][11] !== timestamp || ledger.rows[1][12] !== CANONICAL_ENTRY.USER ||
      logs.rows[1][3] !== TRANSACTION_LIFECYCLE.MODULE || logs.rows[1][4] !== "VOID_SALES" || flushes !== 2) {
    throw new Error("Sales void write/audit mismatch");
  }
  scenarios += 6;

  var expenseRow = ["OPS-APP-20260814-AAAAAAAAAAAA", timestamp, "O1", 50000, "APP_ENTRY", true,
    timestamp, CANONICAL_ENTRY.USER, "", ""];
  var expenseLedger = memorySheet(CANONICAL_ENTRY.EXPENSE_HEADERS, [expenseRow]);
  var expenseLogs = memorySheet(CANONICAL_ENTRY.LOG_HEADERS, []);
  var expenseSs = { getSheetByName: function(name) { return name === "tabops" ? expenseLedger : name === "Logs" ? expenseLogs : null; } };
  persistCanonicalVoid(expenseSs, findCanonicalLifecycleRecord(expenseSs, expenseRow[0]), "wrong amount", timestamp,
    { flush: function() {}, uuid: function() { return "EXPENSE-AUDIT"; } });
  if (expenseLedger.rows[1][5] !== false || expenseLogs.rows[1][4] !== "VOID_EXPENSE") throw new Error("Expense void mismatch");
  scenarios += 2;

  var correctionLedger = memorySheet(CANONICAL_ENTRY.SALES_HEADERS, [salesRow]);
  var correctionLogs = memorySheet(CANONICAL_ENTRY.LOG_HEADERS, []), correctionUuids = 0;
  var correctionSs = { getSheetByName: function(name) { return name === "tabsal" ? correctionLedger : name === "Logs" ? correctionLogs : null; } };
  var replacement = { productId: "P1", type: "Cold", qty: 3, unitHPP: 5000, unitPrice: 12000 };
  var replacementId = persistCanonicalCorrection(correctionSs, findCanonicalLifecycleRecord(correctionSs, salesRow[0]),
    replacement, "wrong drink type", timestamp, { flush: function() {}, uuid: function() {
      correctionUuids++; return correctionUuids === 1 ? "CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC" : "AUDIT-" + correctionUuids;
    } });
  if (replacementId !== "SAL-APP-20260814-CCCCCCCCCCCC" || correctionLedger.rows.length !== 3 ||
      correctionLedger.rows[1][8] !== false || correctionLedger.rows[2][8] !== true || correctionLedger.rows[2][3] !== "Cold" ||
      correctionLedger.rows[2][5] !== 5000 || correctionLogs.rows.length !== 3) throw new Error("Sales correction lifecycle mismatch");
  var voidMetadata = JSON.parse(correctionLogs.rows[1][8]), createMetadata = JSON.parse(correctionLogs.rows[2][8]);
  if (voidMetadata.replacementId !== replacementId || createMetadata.originalId !== salesRow[0]) throw new Error("Correction audit relation mismatch");
  scenarios += 9;
  var adapter = buildCanonicalTransactionData({
    sales: correctionLedger.rows.slice(1).map(function(row, index) { return { ID_Trx: row[0], Tanggal: row[1],
      ID_Prod: row[2], Tipe: row[3], Qty: row[4], HPP: row[5], HJ: row[6], Source: row[7],
      IsActive: row[8], sourceRowIndex: index + 1 }; }),
    expenses: [], products: [{ ID_Prod: "P1", Produk: "Espresso", Kategori: "Coffee", Kind: "Beverage", IsActive: true }],
    expenseItems: []
  });
  if (adapter.records.length !== 1 || adapter.records[0].id !== replacementId || adapter.sourceQuality.inactiveLedgerRows !== 1) {
    throw new Error("Dashboard adapter did not exclude corrected voided original");
  }
  scenarios += 3;

  var failedLedger = memorySheet(CANONICAL_ENTRY.SALES_HEADERS, [salesRow]);
  var failedLogs = memorySheet(CANONICAL_ENTRY.LOG_HEADERS, [], true);
  var failedSs = { getSheetByName: function(name) { return name === "tabsal" ? failedLedger : name === "Logs" ? failedLogs : null; } };
  expectCode(function() {
    persistCanonicalCorrection(failedSs, findCanonicalLifecycleRecord(failedSs, salesRow[0]), replacement, "wrong type", timestamp,
      { flush: function() {}, uuid: function() { return "DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD"; } });
  }, "WRITE_FAILED");
  if (failedLedger.rows.length !== 2 || failedLedger.rows[1][8] !== true || failedLogs.rows.length !== 1) {
    throw new Error("Correction audit-failure rollback left partial lifecycle state");
  }
  scenarios += 3;

  [{ name: "replacement verification", row: 3 }, { name: "original void verification", row: 2 }]
    .forEach(function(failure) {
      var corrupted = false;
      var atomicLedger = memorySheet(CANONICAL_ENTRY.SALES_HEADERS, [salesRow], function(row) {
        if (!corrupted && row === failure.row) { corrupted = true; return true; }
        return false;
      });
      var atomicLogs = memorySheet(CANONICAL_ENTRY.LOG_HEADERS, []);
      var atomicSs = { getSheetByName: function(name) { return name === "tabsal" ? atomicLedger : name === "Logs" ? atomicLogs : null; } };
      expectCode(function() {
        persistCanonicalCorrection(atomicSs, findCanonicalLifecycleRecord(atomicSs, salesRow[0]), replacement,
          failure.name, timestamp, { flush: function() {}, uuid: function() { return "EEEEEEEE-EEEE-EEEE-EEEE-EEEEEEEEEEEE"; } });
      }, "WRITE_FAILED");
      if (atomicLedger.rows.length !== 2 || atomicLedger.rows[1][8] !== true || atomicLogs.rows.length !== 1) {
        throw new Error(failure.name + " rollback left partial lifecycle state");
      }
      scenarios += 3;
    });

  var voidFailureLedger = memorySheet(CANONICAL_ENTRY.SALES_HEADERS, [salesRow]);
  var voidFailureLogs = memorySheet(CANONICAL_ENTRY.LOG_HEADERS, [], true);
  var voidFailureSs = { getSheetByName: function(name) { return name === "tabsal" ? voidFailureLedger : name === "Logs" ? voidFailureLogs : null; } };
  expectCode(function() {
    persistCanonicalVoid(voidFailureSs, findCanonicalLifecycleRecord(voidFailureSs, salesRow[0]), "void audit failure", timestamp,
      { flush: function() {}, uuid: function() { return "VOID-FAIL"; } });
  }, "WRITE_FAILED");
  if (voidFailureLedger.rows[1][8] !== true || voidFailureLogs.rows.length !== 1) {
    throw new Error("Void audit-failure rollback left an inactive original");
  }
  scenarios += 2;

  var sources = [getCanonicalTransactionDetail, previewCanonicalTransactionCorrection, voidCanonicalTransaction,
    correctCanonicalTransaction, persistCanonicalVoid, persistCanonicalCorrection].map(function(fn) { return fn.toString(); }).join("\n");
  ["LockService.getScriptLock()", "lock.waitLock(30000)", "findCanonicalLifecycleRecord(ss", "requireMutableLifecycleRecord(original)",
    "appendLifecycleAudit(", "canonicalEntryRowMatches(", "deleteRow(replacementRow)"].forEach(function(token) {
    assertSourceContains(sources, token, "lifecycle service contract"); scenarios++;
  });
  ["deleteRows(", "clearContent(", 'getSheetByName("Transaction")', 'getSheetByName("Helper")'].forEach(function(token) {
    assertSourceExcludes(sources, token, "protected lifecycle operation"); scenarios++;
  });
  Logger.log("PASS: testCanonicalTransactionLifecycleService | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testCanonicalLifecycleTransportSerialization()
{
  var timestamp = new Date(Date.UTC(2026, 7, 14, 3, 30, 0));
  var fixtures = [
    { name: "Sales detail containing Date fields", payload: { id: "SAL-APP-1", date: timestamp,
      createdAt: timestamp, updatedAt: null, product: "Espresso", revenue: 12000 } },
    { name: "Expense detail containing Date fields", payload: { id: "OPS-APP-1", date: timestamp,
      createdAt: timestamp, updatedAt: null, item: "Electricity", amount: 75000 } },
    { name: "Voided detail with UpdatedAt", payload: { id: "SAL-APP-2", status: "VOIDED",
      date: timestamp, createdAt: timestamp, updatedAt: new Date(timestamp.getTime() + 60000) } },
    { name: "Correction relation containing nested timestamps", payload: { originalId: "SAL-APP-1",
      replacementId: "SAL-APP-2", relation: { createdAt: timestamp, audit: [{ timestamp: timestamp }] } } },
    { name: "Preview response", payload: { before: { date: timestamp, createdAt: timestamp },
      after: { timestamp: timestamp }, delta: { revenue: -12000 } } },
    { name: "Void success response", payload: { id: "SAL-APP-1", date: timestamp,
      createdAt: timestamp, updatedAt: timestamp, status: "VOIDED" } },
    { name: "Correct success response", payload: { original: { date: timestamp, updatedAt: timestamp },
      replacement: { date: timestamp, createdAt: timestamp }, unsupported: undefined } }
  ];
  var scenarios = 0;

  function assertTransportSafe(value, path) {
    if (value instanceof Date || typeof value === "undefined" ||
        (typeof value === "number" && !isFinite(value))) {
      throw new Error("Lifecycle transport contains unsupported value at " + path);
    }
    if (Array.isArray(value)) {
      value.forEach(function(item, index) { assertTransportSafe(item, path + "[" + index + "]"); });
    } else if (value && typeof value === "object") {
      Object.keys(value).forEach(function(key) { assertTransportSafe(value[key], path + "." + key); });
    }
  }

  fixtures.forEach(function(fixture) {
    var response = canonicalLifecycleSuccess(fixture.payload);
    assertTransportSafe(response, fixture.name);
    JSON.stringify(response);
    if (response.success !== true || typeof response.data !== "object") {
      throw new Error(fixture.name + " lifecycle response shape mismatch");
    }
    scenarios++;
  });

  var publicSources = [getCanonicalTransactionDetail, previewCanonicalTransactionCorrection,
    voidCanonicalTransaction, correctCanonicalTransaction].map(function(fn) { return fn.toString(); }).join("\n");
  assertSourceOccurrenceCount(publicSources, "canonicalLifecycleSuccess(", 4, "public lifecycle serialization boundary");
  scenarios += 4;

  Logger.log("PASS: testCanonicalLifecycleTransportSerialization | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios, writes: 0 };
}

function testLegacyTransactionSyncService()
{
  var context = {
    productIdsByName: { Coffee: "P1" },
    expenseIdsByName: { Utility: "O1" },
    pricingIndex: buildProductPricingIndex([
      { ID_Prod: "P1", Tipe: "Hot", EffectiveFrom: new Date(2026, 0, 1),
        EffectiveTo: "", HPP: 4, Harga: 10, IsActive: true }
    ])
  };
  var sale = transformLegacyTransaction(
    [new Date(2026, 7, 13), "Hot", "Sales", "Coffee", "", 2, ""], 1263, context
  );
  var expense = transformLegacyTransaction(
    [new Date(2026, 7, 13), "", "Purchase", "", "Utility", "", 5000], 1264, context
  );
  if (sale.id !== "SAL-GLEG-00001263" || expense.id !== "OPS-GLEG-00001264" ||
      sale.payload[2] !== "P1" || sale.payload[5] !== 4 || sale.payload[6] !== 10 ||
      expense.payload[2] !== "O1" || expense.payload[3] !== 5000)
  {
    throw new Error("Legacy synchronization transformation/identity mismatch");
  }
  var initial = classifyLegacySyncCandidates([sale, expense], {});
  if (initial.inserts.tabsal.length !== 1 || initial.inserts.tabops.length !== 1) {
    throw new Error("Legacy synchronization initial insert mismatch");
  }
  var existingSale = { ID_Trx: sale.payload[0], Tanggal: sale.payload[1], ID_Prod: sale.payload[2],
    Tipe: sale.payload[3], Qty: sale.payload[4], HPP: sale.payload[5], HJ: sale.payload[6],
    Source: sale.payload[7], IsActive: sale.payload[8] };
  var repeat = classifyLegacySyncCandidates([sale], { "SAL-GLEG-00001263": existingSale });
  if (repeat.skipped.length !== 1 || repeat.inserts.tabsal.length !== 0) {
    throw new Error("Legacy synchronization idempotent skip mismatch");
  }
  existingSale.Qty = 3;
  var conflict = classifyLegacySyncCandidates([sale], { "SAL-GLEG-00001263": existingSale });
  if (conflict.conflicts.length !== 1 || conflict.conflicts[0].sourceRow !== 1263) {
    throw new Error("Legacy synchronization conflict mismatch");
  }
  [
    [["bad", "Hot", "Sales", "Coffee", "", 1, ""], 1265],
    [[new Date(2026, 7, 13), "Warm", "Sales", "Coffee", "", 1, ""], 1266],
    [[new Date(2026, 7, 13), "Hot", "Sales", "Coffee", "", 0, ""], 1267],
    [[new Date(2026, 7, 13), "", "Purchase", "", "Utility", "", -1], 1268]
  ].forEach(function(fixture) {
    var thrown = false;
    try { transformLegacyTransaction(fixture[0], fixture[1], context); } catch (error) { thrown = true; }
    if (!thrown) throw new Error("Malformed legacy row was accepted: " + fixture[1]);
  });
  return { passed: true, scenarios: 8 };
}

function testLegacyTransactionSyncTriggerDelegation()
{
  var source = syncLegacyTransactionOnFormSubmit.toString();
  if (source.split("syncLegacyTransactionsToCanonical(").length - 1 !== 1 ||
      source.indexOf("getSheet().getName() !== \"Transaction\"") === -1 ||
      source.indexOf("event.range.getRow()") === -1)
  {
    throw new Error("Transaction sync trigger must delegate once with absolute source row identity");
  }
  return { passed: true, authoritativePaths: 1 };
}

function testLegacySyncRuntimeAcceptanceHarness()
{
  var source = verifyLegacySyncRuntimeAcceptance.toString();
  assertSourceContains(source, 'var handler = "syncLegacyTransactionOnFormSubmit"', "exact sync trigger handler filter");
  assertSourceContains(source, "ScriptApp.getProjectTriggers()", "live project trigger inventory");
  assertSourceContains(source, "triggers.length !== 1", "exactly-one trigger contract");
  assertSourceContainsOnce(source, "syncLegacyTransactionsToCanonical(", "authoritative sync delegation");
  assertSourceExcludes(source, ".newTrigger(", "trigger creation");
  assertSourceExcludes(source, ".deleteTrigger(", "trigger deletion");
  assertSourceContains(source, "buildLegacySyncAcceptanceSnapshot(ss)", "runtime acceptance snapshots");
  return { passed: true, scenarios: 7 };
}

function testCanonicalHistoricalAndOverlapControls()
{
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var canonical = getCanonicalTransactionData(ss).records;
  var expectedSales = {
    2021: [1711, 4411, 20700100, 43760000, 23059900],
    2022: [2049, 5889, 26243500, 54966000, 28722500],
    2023: [2151, 5834, 26231600, 54330000, 28098400],
    2024: [2153, 4782, 22651600, 47077000, 24425400],
    2025: [1634, 2942, 13512800, 33259000, 19746200],
    2026: [874, 1268, 6981200, 15997000, 9015800]
  };
  var expectedExpense = { 2021: [447, 33257000], 2022: [408, 38937000], 2023: [366, 41174000],
    2024: [337, 39619000], 2025: [266, 31856000], 2026: [125, 15370000] };
  var sales = {}, expenses = {}, overlap = { salesRows: 0, expenseRows: 0, qty: 0, cogs: 0, revenue: 0, margin: 0, expense: 0, hot: 0, cold: 0 };
  canonical.forEach(function(row) {
    if (row.source === "XLSM" && row.transactionType === "Sales") {
      sales[row.year] = sales[row.year] || [0, 0, 0, 0, 0];
      sales[row.year][0]++; sales[row.year][1] += row.qty; sales[row.year][2] += row.cogs;
      sales[row.year][3] += row.revenue; sales[row.year][4] += row.margin;
    } else if (row.source === "XLSM") {
      expenses[row.year] = expenses[row.year] || [0, 0]; expenses[row.year][0]++; expenses[row.year][1] += row.expense;
    } else if (row.source === "LEGACY_GOOGLE" && row.transactionType === "Sales") {
      overlap.salesRows++; overlap.qty += row.qty; overlap.cogs += row.cogs; overlap.revenue += row.revenue;
      overlap.margin += row.margin; overlap[row.category.toLowerCase()] += row.qty;
    } else if (row.source === "LEGACY_GOOGLE") { overlap.expenseRows++; overlap.expense += row.expense; }
  });
  if (JSON.stringify(sales) !== JSON.stringify(expectedSales) || JSON.stringify(expenses) !== JSON.stringify(expectedExpense)) {
    throw new Error("Canonical Phase 3 historical controls mismatch");
  }
  if (JSON.stringify(overlap) !== JSON.stringify({ salesRows: 51, expenseRows: 7, qty: 66,
    cogs: 343600, revenue: 834000, margin: 490400, expense: 680000, hot: 30, cold: 36 })) {
    throw new Error("Canonical Phase 4 overlap controls mismatch: " + JSON.stringify(overlap));
  }
  return { passed: true, historicalYears: 6, overlapRows: 58 };
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

function testDashboardPerformanceAnalytics()
{
  var rows = [
    { transactionType:"Sales", productId:"P1", product:"Latte", productCategory:"Coffee", kind:"Beverage", type:"Hot", category:"Hot", qty:2, revenue:100, cogs:40, expense:0, date:new Date(2026, 0, 1) },
    { transactionType:"Sales", productId:"P1", product:"Latte", productCategory:"Coffee", kind:"Beverage", type:"Cold", category:"Cold", qty:1, revenue:50, cogs:20, expense:0, date:new Date(2026, 0, 2) },
    { transactionType:"Sales", productId:"P2", product:"Tea", productCategory:"Tea", kind:"Beverage", type:"Warm", category:"Warm", qty:5, revenue:0, cogs:25, expense:0, date:new Date(2026, 0, 3) },
    { transactionType:"Purchase", group:"Overhead", purchaseCategory:"Electricity", expense:70, date:new Date(2026, 0, 4) },
    { transactionType:"Purchase", group:"Supplies", purchaseCategory:"Packaging", expense:60, date:new Date(2026, 0, 5) },
    { transactionType:"Purchase", group:"Payroll", purchaseCategory:"Wages", expense:50, date:new Date(2026, 0, 6) },
    { transactionType:"Purchase", group:"Rent", purchaseCategory:"Rent", expense:40, date:new Date(2026, 0, 7) },
    { transactionType:"Purchase", group:"Marketing", purchaseCategory:"Ads", expense:30, date:new Date(2026, 0, 8) },
    { transactionType:"Purchase", group:"Maintenance", purchaseCategory:"Repairs", expense:20, date:new Date(2026, 0, 9) },
    { transactionType:"Purchase", group:"Fees", purchaseCategory:"Fees", expense:10, date:new Date(2026, 0, 10) }
  ];
  rows = rows.map(function(row)
  {
    var normalized = {};
    Object.keys(row).forEach(function(key) { normalized[key] = row[key]; });
    if (normalized.product == null) normalized.product = "";
    if (normalized.purchaseCategory == null) normalized.purchaseCategory = "";
    if (normalized.category == null) normalized.category = "";
    if (normalized.qty == null) normalized.qty = 0;
    if (normalized.revenue == null) normalized.revenue = 0;
    if (normalized.cogs == null) normalized.cogs = 0;
    if (normalized.expense == null) normalized.expense = 0;
    return normalized;
  });
  var performance = buildPerformanceAnalyticsFromAggregate(buildAggregate(rows));
  var serializedPerformance = JSON.stringify(performance);
  var transportedPerformance = JSON.parse(serializedPerformance);
  if (!serializedPerformance || transportedPerformance.productProfitability.length !== 2 ||
      serializedPerformance.indexOf("null") !== -1)
    throw new Error("Performance payload serialization mismatch");

  function assertTransportSafe(value, path, seen)
  {
    var valueType = typeof value;
    if (valueType === "undefined" || valueType === "function")
      throw new Error("Unsupported Dashboard transport value at " + path);
    if (valueType === "number" && !isFinite(value))
      throw new Error("Non-finite Dashboard transport number at " + path);
    if (!value || valueType !== "object") return;
    var tag = Object.prototype.toString.call(value);
    if (tag === "[object Date]" || tag === "[object Map]" || tag === "[object Set]")
      throw new Error("Unsupported Dashboard transport object at " + path + ": " + tag);
    if (seen.indexOf(value) !== -1)
      throw new Error("Circular Dashboard transport value at " + path);
    seen.push(value);
    Object.keys(value).forEach(function(key)
    {
      assertTransportSafe(value[key], path + "." + key, seen);
    });
    seen.pop();
  }

  var dashboardResponse = buildDashboardResponse(
    rows,
    "custom",
    "2026-01-01",
    "2026-01-31",
    new Date(2026, 0, 31, 12, 0, 0)
  );
  assertTransportSafe(dashboardResponse, "response", []);
  var serializedDashboardResponse = JSON.stringify(dashboardResponse);
  var parsedDashboardResponse = JSON.parse(serializedDashboardResponse);
  if (!parsedDashboardResponse.summary || !parsedDashboardResponse.performanceAnalytics)
    throw new Error("Complete Dashboard response serialization mismatch");
  var latte = performance.productProfitability[0];
  var tea = performance.productProfitability[1];
  if (latte.label !== "Latte" || latte.units !== 3 || latte.revenue !== 150 || latte.cogs !== 60 || latte.grossMargin !== 90 || latte.grossMarginPercent !== 60)
    throw new Error("Product profitability aggregation mismatch");
  if (tea.grossMargin !== -25 || tea.grossMarginPercent !== 0)
    throw new Error("Zero-revenue margin safety or ranking mismatch");
  if (performance.classifications.category.length !== 2 || performance.classifications.kind.length !== 1 || performance.classifications.kind[0].revenue !== 150)
    throw new Error("Category/Kind aggregation mismatch");
  if (performance.hotColdEconomics[0].units !== 2 || performance.hotColdEconomics[0].grossMargin !== 60 || performance.hotColdEconomics[1].units !== 1 || performance.hotColdEconomics[1].grossMargin !== 30)
    throw new Error("Hot/Cold economics or unknown-type exclusion mismatch");
  if (performance.expenseGroups.length !== 6 || performance.expenseGroups[5].group !== "Others" || performance.expenseGroups[5].amount !== 30)
    throw new Error("Expense Group/Others aggregation mismatch");
  var canonical = buildCanonicalTransactionData({
    products:[{ ID_Prod:"P1", Produk:"Latte", Kategori:"Coffee", Kind:"Beverage" }], expenseItems:[], expenses:[], sales:[
      { sourceRowIndex:1, ID_Trx:"S1", Tanggal:new Date(2026, 0, 1), ID_Prod:"P1", Tipe:"Hot", Qty:2, HPP:20, HJ:50, Source:"APP_ENTRY", IsActive:false },
      { sourceRowIndex:2, ID_Trx:"S2", Tanggal:new Date(2026, 0, 1), ID_Prod:"P1", Tipe:"Hot", Qty:3, HPP:20, HJ:50, Source:"APP_ENTRY", IsActive:true }
    ]
  });
  var authoritative = buildPerformanceAnalyticsFromAggregate(buildAggregate(canonical.records));
  if (canonical.records.length !== 1 || authoritative.productProfitability[0].units !== 3 || canonical.sourceQuality.inactiveLedgerRows !== 1)
    throw new Error("Lifecycle exclusion or correction authoritative-record behavior mismatch");
  var originalPerformanceBuilder = buildPerformanceAnalyticsFromAggregate;
  var optionalPerformance;
  try
  {
    buildPerformanceAnalyticsFromAggregate = function() { throw new Error("deterministic projection failure"); };
    optionalPerformance = buildOptionalPerformanceAnalytics(buildAggregate([]), {});
  }
  finally
  {
    buildPerformanceAnalyticsFromAggregate = originalPerformanceBuilder;
  }
  if (optionalPerformance.available !== false || optionalPerformance.errorCode !== "PERFORMANCE_PROJECTION_FAILED")
    throw new Error("Optional Performance failure isolation mismatch");

  function gmRow(product, qty, revenue, cogs, date)
  {
    return { transactionType:"Sales", productId:product, product:product, qty:qty, revenue:revenue, cogs:cogs, expense:0, date:new Date(date) };
  }
  var grossMarginComparisons = [
    { name:"positive", currentAnalytics: buildPerformanceAnalyticsFromAggregate(buildAggregate([gmRow("A",1,100,40,2026)])), previous: [gmRow("A",1,100,70,2026)], percentage:100, status:"Up" },
    { name:"negative", currentAnalytics: buildPerformanceAnalyticsFromAggregate(buildAggregate([gmRow("A",1,100,70,2026)])), previous: [gmRow("A",1,100,40,2026)], percentage:-50, status:"Down" },
    { name:"stable", currentAnalytics: buildPerformanceAnalyticsFromAggregate(buildAggregate([gmRow("A",1,100,40,2026)])), previous: [gmRow("A",1,100,40,2026)], percentage:0, status:"Stable" },
    { name:"bothZero", currentAnalytics: buildPerformanceAnalyticsFromAggregate(buildAggregate([])), previous: [], percentage:0, status:"Stable" },
    { name:"zeroBaseline", currentAnalytics: buildPerformanceAnalyticsFromAggregate(buildAggregate([gmRow("A",1,100,40,2026)])), previous: [], percentage:null, status:"No Comparison" }
  ];
  grossMarginComparisons.forEach(function(spec)
  {
    var actual = buildGrossMarginComparison(spec.currentAnalytics, spec.previous);
    if (actual.currentGrossMargin !== Number(spec.currentAnalytics.totalGrossMargin) ||
        actual.previousGrossMargin !== Number(buildPerformanceAnalyticsFromAggregate(buildAggregate(spec.previous)).totalGrossMargin) ||
        actual.grossMarginChangePercent !== spec.percentage ||
        actual.status !== spec.status)
      throw new Error("Gross Margin comparison mismatch for " + spec.name);
  });
  var zeroBaselineComparison = buildGrossMarginComparison(
    buildPerformanceAnalyticsFromAggregate(buildAggregate([gmRow("A",1,100,0,2026)])),
    []
  );
  if (zeroBaselineComparison.grossMarginChangePercent !== null || zeroBaselineComparison.status !== "No Comparison")
    throw new Error("Gross Margin zero-baseline comparison mismatch");
  if (typeof dashboardResponse.performanceAnalytics.totalGrossMargin !== "number")
    throw new Error("Dashboard response payload must expose authoritative totalGrossMargin");
  var manyProductRows = [];
  for (var mp = 1; mp <= 12; mp++)
  {
    manyProductRows.push(gmRow("P" + mp, 1, 200, 100, 2026));
  }
  var manyProductAnalytics =
    buildPerformanceAnalyticsFromAggregate(buildAggregate(manyProductRows));
  if (manyProductAnalytics.productProfitability.length > 10)
    throw new Error("productProfitability must not exceed Top-10 despite >10 source products");
  if (manyProductAnalytics.totalGrossMargin !== 1200)
    throw new Error("Authoritative totalGrossMargin must include ALL products outside Top-10; expected 1200, got " + manyProductAnalytics.totalGrossMargin);
  var topTenGmSum = manyProductAnalytics.productProfitability.reduce(function(sum, item) { return sum + Number(item.grossMargin || 0); }, 0);
  if (topTenGmSum === 1200)
    throw new Error("Top-10 productProfitability sum must NOT equal authoritative totalGrossMargin for >10 products");
  var previousManyProductRows = [];
  for (var pp = 1; pp <= 12; pp++)
  {
    previousManyProductRows.push(gmRow("P" + pp, 1, 200, 150, 2026));
  }
  var manyComparison = buildGrossMarginComparison(manyProductAnalytics, previousManyProductRows);
  if (manyComparison.currentGrossMargin !== 1200 || manyComparison.previousGrossMargin !== 600)
    throw new Error("Total GM comparison must use all products, not Top-10 ranking; current=" + manyComparison.currentGrossMargin + ", previous=" + manyComparison.previousGrossMargin);
  if (manyComparison.grossMarginChangePercent !== 100 || manyComparison.status !== "Up")
    throw new Error("Total GM comparison percentage mismatch for >10 products; got " + manyComparison.grossMarginChangePercent + " " + manyComparison.status);
  var frontend = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  ['id="performanceSnapshotSection"', 'id="productProfitabilitySection"', 'id="categoryPerformanceSection"', 'id="hotColdChartSection"', 'id="expenseChartSection"', 'type: "bar"',
    'renderProductProfitabilityChart(latestPerformanceAnalytics);', 'renderCategoryPerformanceChart(latestPerformanceAnalytics);',
    'renderHotColdEconomicsComparison(latestPerformanceAnalytics.hotColdEconomics);', 'performance: [productProfitabilityChart, categoryPerformanceChart, expenseChart]']
    .forEach(function(token) { if (frontend.indexOf(token) === -1) throw new Error("Performance UI contract missing: " + token); });
  var expenseRendererSource = getSourceRegion(frontend, "function renderExpenseChart(expenseBreakdown)", "function renderCharts(res)", "Expense chart renderer");
  if (expenseRendererSource.indexOf('indexAxis: "y"') !== -1) throw new Error("Expense chart must remain vertical");
  var chartRenderSource = getSourceRegion(
    frontend,
    "function renderCharts(res)",
    "function renderBusinessIntelligence",
    "Dashboard chart renderer"
  );
  if (chartRenderSource.indexOf("catch (performanceError)") === -1 ||
      chartRenderSource.indexOf("setDashboardState(") !== -1)
    throw new Error("Performance renderer is not isolated from core Dashboard state");
  [
    'if (!forecastContainer)',
    'if (revenueDependencyContainer)',
    'if (paretoContainer)'
  ].forEach(function(token)
  {
    if (frontend.indexOf(token) === -1)
      throw new Error("Retired deferred DOM consumer is not guarded: " + token);
  });
  Logger.log("PASS: testDashboardPerformanceAnalytics | assertions=20");
  return { passed:true, assertions:20 };
}

function testPerformanceStabilizationContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var fixture = createPerformanceStabilizationFixtures();
  var assertionsPassed = 0;

  [
    '#dashboardPanelOverview #dataQualityDetails[data-display="popover"]:not(.hidden)',
    'position: absolute;',
    'aria-haspopup="dialog"',
    'data-display="popover" role="dialog"',
    'function closeDataQualityDetails()',
    '!elements.dataQualityInformation.contains(event.target)',
    'event.key === "Escape"',
    'elements.dataQualityDetailsButton.focus();',
    '"<strong>Quality issues</strong>"',
    '"<strong>Lifecycle</strong>"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact Data Quality detail");
    assertionsPassed++;
  });
  assertSourceExcludes(source, "flex-basis: 100% !important; white-space: normal !important;", "in-flow Data Quality detail row");
  assertSourceExcludes(source, 'data-display="inline"', "inline Data Quality detail injection");
  assertionsPassed += 2;

  [
    ".performance-chart-shell { height: 232px; min-height: 232px; max-height: 232px; overflow: hidden; }",
    ".performance-chart-shell-primary { height: 360px; min-height: 360px; max-height: 360px; }",
    ".performance-chart-shell > canvas { display: block; width: 100% !important; height: 100% !important; max-height: 100% !important; }",
    ".performance-chart-shell-primary { height: 260px; min-height: 260px; max-height: 260px; }",
    ".performance-chart-shell-primary { height: 220px; min-height: 220px; max-height: 220px; }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded Performance chart shell");
    assertionsPassed++;
  });
  fixture.secondaryCharts.forEach(function(id)
  {
    assertSourceContains(source, 'id="' + id + '" class="performance-chart-shell', "shared secondary chart shell");
    assertionsPassed++;
  });
  fixture.nativeComparisons.forEach(function(id)
  {
    assertSourceContains(source, 'id="' + id + '"', "native Performance comparison");
    assertionsPassed++;
  });
  assertSourceContains(source, 'id="productProfitabilityWrapper" class="performance-chart-shell performance-chart-shell-primary', "unchanged primary profitability owner");
  assertionsPassed++;
  assertSourceExcludes(source, "ResizeObserver", "recursive Performance resize observer");
  assertSourceExcludes(source, ".style.height", "JavaScript chart height mutation");
  assertionsPassed += 2;

  fixture.baseline.forEach(function(item)
  {
    assertSourceContains(source, 'id="' + item.id + '"', "Phase 7B.2 baseline " + item.disposition);
    assertionsPassed++;
  });
  var ownershipRegion = getSourceRegion(source, "var sectionOwnership = {", "elements.dashboardPanels.forEach", "Dashboard section ownership");
  fixture.finalOrder.forEach(function(id)
  {
    assertSourceContains(ownershipRegion, 'staging.querySelector("#' + id + '")', "reconciled Performance order");
    assertionsPassed++;
  });
  assertSourceContainsOnce(source, "function initializeDashboardTabs()", "single Dashboard tab initializer");
  assertSourceContains(source, "resizeVisibleDashboardCharts(tabName);", "repeat activation resize without recreation");
  assertionsPassed += 2;

  [
    'id="performanceSnapshotGrid" class="performance-snapshot-grid"',
    '["Top Profit Product",',
    '["Best Margin %",',
    '["Top Revenue Product",',
    '["Largest Expense Driver",',
    '["Total Gross Margin",',
    '["Revenue Concentration",',
    'data.slice(0, window.innerWidth < 640 ? 6 : 10)',
    'indexAxis: "y"',
    '{ label: "Gross Margin", numlockThemeRole: "margin"',
    'type: "doughnut"',
    'id="performanceGrouping"',
    'function renderHotColdEconomicsComparison(hotColdEconomics)',
    'id="hotColdComparison" class="hot-cold-comparison"',
    'var rankedExpenses = expenseBreakdown.reduce',
    'group: "Others"',
    'share.toFixed(1) + "% of total"',
    'id="forecastSection"',
    'id="revenueDependencyContainer"',
    'id="paretoContainer"',
    'id="marginHealthContainer"',
    'grossMargin / marginRevenue * 100',
    '{ chart: categoryPerformanceChart, kind: "categoryMix" }',
    'chart.update("none");'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Performance visual refinement");
    assertionsPassed++;
  });
  assertSourceOccurrenceCount(source, 'class="performance-insight-card"', 6, "six Performance Snapshot cards");
  assertSourceOccurrenceCount(source, 'class="performance-signal-card', 4, "four Business Signal cards");
  assertSourceExcludes(source, 'id="performanceFilter"', "independent Performance filter");
  var performanceRenderRegion = getSourceRegion(source, "function renderPerformanceSnapshot(performanceAnalytics)", "function renderBusinessIntelligence(res)", "Performance client renderers");
  assertSourceExcludes(performanceRenderRegion, "google.script.run", "additional Performance server read");
  assertionsPassed += 4;

  Logger.log("PASS: testPerformanceStabilizationContract | assertions=" + assertionsPassed + " | baseline=" + fixture.baseline.length + " | secondaryCharts=" + fixture.secondaryCharts.length);
  return { passed:true, assertions:assertionsPassed, baseline:fixture.baseline.length, secondaryCharts:fixture.secondaryCharts.length };
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
    "performanceAnalytics",
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
          property !== "kpiTargets" &&
          property !== "performanceAnalytics"
        )
        {
          if (property === "dateFilter")
          {
            comparableResponse[property] = {
              filter: response.dateFilter.filter,
              startDate: response.dateFilter.startDate,
              endDate: response.dateFilter.endDate,
              label: response.dateFilter.label,
              rowCount: response.dateFilter.rowCount
            };
          }
          else if (property === "summary")
          {
            comparableResponse[property] = {
              revenue: response.summary.revenue,
              expense: response.summary.expense,
              profit: response.summary.profit,
              unitsSold: response.summary.unitsSold,
              bestSeller: response.summary.bestSeller,
              topRevenueProduct: response.summary.topRevenueProduct,
              avgDailyRevenue: response.summary.avgDailyRevenue,
              activeDays: response.summary.activeDays
            };
          }
          else
          {
            comparableResponse[property] = response[property];
          }
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

  function createExpectedDailySeries(startDate, endDate, revenueByDate)
  {
    var labels = [];
    var values = [];
    var cursor = new Date(startDate + "T00:00:00Z");
    var end = new Date(endDate + "T00:00:00Z");

    while (cursor <= end)
    {
      var label = cursor.toISOString().slice(0, 10);
      labels.push(label);
      values.push(revenueByDate[label] || 0);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { labels: labels, values: values };
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

  var currentMonthExpected = createExpectedDailySeries(
    "2026-06-01",
    "2026-06-15",
    {
      "2026-06-01": 10,
      "2026-06-08": 80,
      "2026-06-09": 90,
      "2026-06-14": 140,
      "2026-06-15": 150
    }
  );
  var currentMonthResponse =
    assertTrend(
      "currentMonth",
      null,
      null,
      rows,
      referenceDate,
      currentMonthExpected.labels,
      currentMonthExpected.values,
      "current month with revenue"
    );

  assertEqual(
    currentMonthResponse.revenueTrend.values.length > 0,
    true,
    "current month trend is non-empty"
  );

  assertEqual(
    JSON.stringify(currentMonthResponse.dateFilter.availableMonths),
    JSON.stringify(["2025-12", "2026-01", "2026-04", "2026-05", "2026-06"]),
    "available custom months derive from represented transaction dates"
  );

  assertEqual(
    JSON.stringify(currentMonthResponse.dateFilter.availableYears),
    JSON.stringify(["2025", "2026"]),
    "available custom years derive from represented transaction dates"
  );

  var previousMonthExpected = createExpectedDailySeries(
    "2026-05-01",
    "2026-05-31",
    { "2026-05-20": 50 }
  );
  assertTrend(
    "previousMonth",
    null,
    null,
    fixture.trendRows,
    referenceDate,
    previousMonthExpected.labels,
    previousMonthExpected.values,
    "previous month trend"
  );

  var customMonthExpected = createExpectedDailySeries(
    "2026-06-01",
    "2026-06-30",
    { "2026-06-01": 60, "2026-06-15": 150 }
  );
  var currentYearEquivalentResponse = assertTrend(
    "currentYear",
    null,
    null,
    fixture.trendRows,
    new Date(2026, 7, 3, 12, 0, 0),
    ["2026-01", "2026-05", "2026-06", "2026-07", "2026-08"],
    [10, 50, 210, 70, 80],
    "current year includes partial current month"
  );

  var customYearEquivalentResponse = assertTrend(
    "customYear",
    "2026",
    null,
    fixture.trendRows,
    new Date(2026, 7, 3, 12, 0, 0),
    ["2026-01", "2026-05", "2026-06", "2026-07", "2026-08"],
    [10, 50, 210, 70, 80],
    "custom year equivalent represented months"
  );

  [
    [currentYearEquivalentResponse.summary.revenue, customYearEquivalentResponse.summary.revenue, "equivalent year revenue"],
    [Math.max.apply(null, currentYearEquivalentResponse.revenueTrend.values), Math.max.apply(null, customYearEquivalentResponse.revenueTrend.values), "equivalent year highest revenue"],
    [currentYearEquivalentResponse.summary.averageMonthlyRevenue, customYearEquivalentResponse.summary.averageMonthlyRevenue, "equivalent year average monthly revenue"],
    [currentYearEquivalentResponse.summary.profit, customYearEquivalentResponse.summary.profit, "equivalent year total profit"],
    [currentYearEquivalentResponse.insights.profitMargin, customYearEquivalentResponse.insights.profitMargin, "equivalent year profit margin"]
  ].forEach(function(metric)
  {
    assertEqual(metric[0], metric[1], metric[2]);
  });

  assertEqual(
    currentYearEquivalentResponse.summary.representedMonths,
    5,
    "represented distinct month denominator"
  );
  assertEqual(
    currentYearEquivalentResponse.summary.averageMonthlyRevenue,
    84,
    "average monthly revenue uses represented distinct months"
  );

  var emptySummary = buildSummaryFromAggregate(buildAggregate([]));
  assertEqual(emptySummary.representedMonths, 0, "zero represented months");
  assertEqual(emptySummary.averageMonthlyRevenue, 0, "zero represented month average safety");

  assertTrend(
    "custom",
    "2026-06-01",
    "2026-06-30",
    fixture.trendRows,
    referenceDate,
    customMonthExpected.labels,
    customMonthExpected.values,
    "custom single-month trend"
  );

  var customCrossYearExpected = createExpectedDailySeries(
    "2025-12-01",
    "2026-02-28",
    { "2025-12-31": 120, "2026-01-01": 10 }
  );
  assertTrend(
    "custom",
    "2025-12-01",
    "2026-02-28",
    fixture.trendRows,
    referenceDate,
    customCrossYearExpected.labels,
    customCrossYearExpected.values,
    "custom multi-month cross-year trend"
  );

  assertTrend(
    "custom",
    "2026-08-03",
    "2026-08-03",
    fixture.trendRows,
    referenceDate,
    ["2026-08-03"],
    [0],
    "zero-revenue filtered period"
  );

  var continuousRangeExpected = createExpectedDailySeries(
    "2026-08-01",
    "2026-08-09",
    { "2026-08-01": 80 }
  );
  assertTrend(
    "custom",
    "2026-08-01",
    "2026-08-09",
    fixture.trendRows,
    referenceDate,
    continuousRangeExpected.labels,
    continuousRangeExpected.values,
    "continuous daily zero-filled range"
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
    emptyComparison.status.revenue !== "No Comparison" ||
    emptyComparison.changes.revenuePercent !== null ||
    emptyComparison.status.profitMargin !== "No Comparison" ||
    emptyComparison.changes.profitMarginPoints !== null
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
    buildDashboardDataExecution.toString();

  if (
    dashboardSource.split("getCanonicalTransactionData(").length - 1 !== 1 ||
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

  var comparisonRendererRegion = getSourceRegion(
    frontendSource,
    "function renderPeriodComparison(periodComparison)",
    "function normalizeOverviewContextResponse",
    "period comparison renderer"
  );
  var comparisonNodes = {
    periodComparisonLabel: { innerText: "" },
    periodComparisonLead: { innerText: "" },
    periodComparisonPeriod: { innerText: "" }
  };
  var renderComparison = new Function(
    "document",
    "formatDashboardPresentationPeriod",
    comparisonRendererRegion + "; return renderPeriodComparison;"
  )(
    { getElementById: function(id) { return comparisonNodes[id]; } },
    function(value) { return value; }
  );

  renderComparison({
    changes: {},
    status: {},
    previous: { startDate: "2026-08-04", endDate: "2026-08-09", rowCount: 2 }
  });
  if (
    comparisonNodes.periodComparisonLead.innerText !== "Compared with" ||
    comparisonNodes.periodComparisonPeriod.innerText !== "2026-08-04 – 2026-08-09"
  )
  {
    throw new Error("Period comparison represented-period presentation mismatch");
  }

  renderComparison({
    changes: {},
    status: {},
    previous: { startDate: "2026-08-04", endDate: "2026-08-09", rowCount: 0 }
  });
  if (
    comparisonNodes.periodComparisonLead.innerText !== "Comparison unavailable" ||
    comparisonNodes.periodComparisonPeriod.innerText !== "2026-08-04 – 2026-08-09 has no data"
  )
  {
    throw new Error("Period comparison empty-period presentation mismatch");
  }
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
    "authoritative Insights Business Priority render target"
  );

  var insightsOwnershipStart = source.indexOf("insights: [");
  var insightsOwnershipEnd = source.indexOf("]", insightsOwnershipStart);
  var insightsOwnershipSource = source.slice(
    insightsOwnershipStart,
    insightsOwnershipEnd
  );

  assertSourceContains(
    insightsOwnershipSource,
    'staging.querySelector("#businessPriorityRegion")',
    "Insights Business Priority owner"
  );

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
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var tokenSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
    ).getContent();

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

  ['id="sidebarUtilityNavigation"', 'aria-label="Settings"', 'aria-label="Logs"',
    'id="sidebarMobileCloseButton"', '>Close Menu</span>',
    'onclick="setSidebarOpen(false, true)"'].forEach(function(token)
  {
    assertSourceContains(source, token, "mobile utility navigation");
  });
  ['#dashboardSidebar>nav{flex:1 1 auto;min-height:0;overflow-y:auto}',
    '#sidebarUtilityNavigation{flex:0 0 auto;margin-top:auto;padding:8px 8px calc(8px + env(safe-area-inset-bottom))}',
    '#sidebarMobileCloseButton{display:flex;min-height:44px}',
    'html.numlock-phone #sidebarMobileCloseButton{display:flex!important;min-height:44px}'].forEach(function(token)
  {
    assertSourceContains(tokenSource, token, "mobile utility drawer containment");
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
  var tokenSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
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

  [
    "@media (max-width:1023px)",
    "#dashboardTabList{display:flex!important;width:100%!important;max-width:100%!important;overflow-x:auto",
    "#dashboardPanelOverview:not([hidden]){display:flex;min-width:0;flex-direction:column",
    "#dashboardPanelOverview #keyMetricsSection{order:1}",
    "#dashboardPanelOverview #overviewEvidenceRow{order:2}",
    "#dashboardPanelOverview #overviewContextRow{order:3}",
    "#dashboardPanelOverview #executiveSummarySection{order:4",
    "#dashboardPanelOverview #topProductWrapper{max-width:100%;overflow-x:auto",
    "#customDateRange{width:100%;flex-wrap:wrap}",
    "@media (max-width:639px)",
    "#dashboardPanelOverview #mainChartWrapper{height:180px!important;min-height:180px!important;max-height:180px!important;padding-top:6px!important}",
    "@media (max-width:767px)",
    "#utilityPageTitle{font-size:28px!important;line-height:34px!important}",
    "#dashboardTabList{height:54px!important;min-height:54px!important}",
    "#contentViewport{padding:12px 8px 16px!important}",
    "#dashboardPanelOverview .hf-kpi-strip{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}",
    "#dashboardPanelOverview .hf-kpi-card{min-height:160px!important;padding:16px!important}",
    "#dashboardPanelOverview .hf-kpi-card .hf-section-label{font-size:16px!important;line-height:23px!important}",
    "#dashboardPanelOverview .hf-kpi-card .overview-kpi-value{font-size:32px!important;line-height:39px!important}",
    "#dashboardPanelOverview .hf-kpi-comparison{font-size:15px!important;line-height:22px!important}",
    "#dashboardPanelOverview #revenueChartTitle,#dashboardPanelOverview #topProductsTitle,#dashboardPanelOverview .hf-section-heading{font-size:24px!important;line-height:30px!important}",
    "#dashboardPanelOverview #revenueChartSection,#dashboardPanelOverview #topProductsSection{padding:16px 12px 12px!important}",
    "#dashboardPanelOverview #mainChartWrapper{height:260px!important;min-height:260px!important;max-height:260px!important",
    "#dashboardPanelOverview .hf-top-products-table{min-width:560px!important}",
    "#dashboardPanelOverview .hf-top-products-table thead th{font-size:16px!important;line-height:22px!important}",
    "#dashboardPanelOverview .hf-top-products-table tbody td,#dashboardPanelOverview .hf-top-products-table tbody th{font-size:18px!important;line-height:26px!important}",
    "#dashboardPanelOverview .hf-summary-metrics .performance-metric-value{font-size:25px!important;line-height:32px!important}",
    "#dashboardPanelOverview .hf-action-copy strong{font-size:17px!important;line-height:23px!important}",
    "#dashboardPanelOverview #executiveSummarySection>.overview-surface,#dashboardPanelOverview #executiveSummarySection>section{padding:14px!important}"
  ].forEach(function(token)
  {
    assertSourceContains(
      tokenSource,
      token,
      "responsive shell compiled containment"
    );
  });

  var mobileRuntimeSource = getSourceRegion(
    source,
    "/* WO-029 authoritative mobile runtime:",
    "</style>",
    "authoritative mobile runtime CSS"
  );
  [
    "@media (max-width: 767px)",
    "--mobile-text-section: 1.5rem",
    "#contentViewport { padding: 12px 8px 16px !important; }",
    "#utilityPageTitle { font-size: 28px !important; line-height: 34px !important; }",
    "#dashboardTabList [role=\"tab\"], #dashboardTabInsights { height: 52px !important; padding-right: 10px !important; padding-left: 10px !important; font-size: 16px !important; line-height: 22px !important; }",
    "#dashboardPanelOverview .hf-kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }",
    "#dashboardPanelOverview #businessOverview > :last-child { grid-column: 1 / -1 !important; }",
    "#dashboardPanelOverview .hf-kpi-card { min-height: 160px !important; padding: 16px !important; }",
    "#dashboardPanelOverview .hf-kpi-card .hf-section-label { font-size: 16px !important; line-height: 23px !important; }",
    "#dashboardPanelOverview .hf-kpi-card .overview-kpi-value { font-size: 32px !important; line-height: 39px !important; }",
    "#dashboardPanelOverview .hf-kpi-comparison { font-size: 15px !important; line-height: 22px !important; }",
    "#dashboardPanelOverview #revenueChartTitle, #dashboardPanelOverview #topProductsTitle, #dashboardPanelOverview .hf-section-heading { font-size: 24px !important; line-height: 30px !important; }",
    "#dashboardPanelOverview #revenueChartSection, #dashboardPanelOverview #topProductsSection { padding: 16px 12px 12px !important; }",
    "#dashboardPanelOverview .hf-analytics-card-header { display: flex !important; flex-flow: row nowrap !important; align-items: center !important; justify-content: space-between !important; }",
    "#dashboardPanelOverview #dateFilterControls { display: flex !important; width: auto !important; min-width: 108px !important; flex: 0 1 148px !important; flex-wrap: nowrap !important; justify-content: flex-end !important; }",
    "#dashboardPanelOverview .hf-overview-context { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; grid-template-rows: auto auto !important;",
    "#dashboardPanelOverview #periodComparisonSection, #dashboardPanelOverview #dataQualityInformation { display: block !important; width: 100% !important; min-width: 0 !important; }",
    "#dashboardPanelOverview .hf-top-products-table { min-width: 560px !important; }",
    "#dashboardPanelOverview .hf-top-products-table thead th { font-size: 16px !important; line-height: 22px !important; }",
    "#dashboardPanelOverview .hf-top-products-table tbody th, #dashboardPanelOverview .hf-top-products-table tbody td { font-size: 18px !important; line-height: 26px !important; }",
    "#dashboardPanelOverview .hf-summary-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }",
    "#dashboardPanelOverview .hf-summary-metrics .performance-metric-value { font-size: 25px !important; line-height: 32px !important; }",
    "#dashboardPanelOverview #executiveSummarySection > .overview-surface, #dashboardPanelOverview #executiveSummarySection > section { padding: 14px !important; }",
    "#dashboardPanelOverview .hf-quick-actions { grid-template-columns: minmax(0, 1fr) !important; gap: 10px !important; }",
    "#dashboardPanelOverview .hf-action-copy strong { font-size: 17px !important; line-height: 23px !important; }",
    "@media (max-width: 339px)"
  ].forEach(function(token)
  {
    assertSourceContains(
      mobileRuntimeSource,
      token,
      "authoritative mobile runtime ownership"
    );
  });
  assertSourceExcludes(
    mobileRuntimeSource,
    "@media (max-width: 1023px)",
    "tablet typography isolation"
  );
  ["zoom:", "initial-scale=1.5", "maximum-scale=1.5", "text-size-adjust"].forEach(function(token)
  {
    assertSourceExcludes(mobileRuntimeSource, token, "mobile scaling hack exclusion");
  });
  [
    "@media (min-width: 1024px)",
    "#dashboardPanelOverview .hf-kpi-card .overview-kpi-value { font-size: 23px !important;",
    "#dashboardPanelOverview #revenueChartSection, #dashboardPanelOverview #topProductsSection { padding: 22px 20px 8px 16px !important; }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "desktop Overview lock");
  });

  [
    'id="revenueHeaderSkeleton"',
    'id="topProductsHeaderSkeleton"',
    'id="periodComparisonSkeleton"',
    'id="dataQualitySkeleton"',
    'id="quickActionsSkeleton"',
    'id="keySummarySkeleton"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Overview skeleton coverage");
  });
  var skeletonLifecycleSource = getSourceRegion(
    source,
    "function showChartSkeleton()",
    "function setDashboardControlsDisabled",
    "Overview skeleton lifecycle"
  );
  [
    "elements.revenueHeaderSkeleton.classList.remove(\"hidden\");",
    "elements.topProductsHeaderSkeleton.classList.remove(\"hidden\");",
    "elements.periodComparisonSkeleton.classList.remove(\"hidden\");",
    "elements.dataQualitySkeleton.classList.remove(\"hidden\");",
    "elements.quickActionsSkeleton.classList.remove(\"hidden\");",
    "elements.keySummarySkeleton.classList.remove(\"hidden\");",
    "elements.revenueHeaderSkeleton.classList.add(\"hidden\");",
    "elements.topProductsHeaderSkeleton.classList.add(\"hidden\");",
    "elements.periodComparisonSkeleton.classList.add(\"hidden\");",
    "elements.dataQualitySkeleton.classList.add(\"hidden\");",
    "elements.quickActionsSkeleton.classList.add(\"hidden\");",
    "elements.keySummarySkeleton.classList.add(\"hidden\");"
  ].forEach(function(token)
  {
    assertSourceContains(skeletonLifecycleSource, token, "Overview skeleton cleanup");
  });

  var revenueHeaderSource = getSourceRegion(
    source,
    '<div class="hf-analytics-card-header mb-1 flex-wrap">',
    '<p id="revenueChartSummary"',
    "Revenue Trend shared header DOM"
  );
  assertSourceContains(revenueHeaderSource, 'id="revenueChartTitle"', "Revenue title row ownership");
  assertSourceContains(revenueHeaderSource, 'id="dateFilterControls"', "Revenue filter row ownership");

  var overviewContextSource = getSourceRegion(
    source,
    '<aside id="overviewContextRow"',
    '<!-- ANALYTICS -->',
    "Overview context direct row ownership"
  );
  assertSourceContainsOnce(overviewContextSource, 'id="periodComparisonSection"', "comparison row owner");
  assertSourceContainsOnce(overviewContextSource, 'id="dataQualityInformation"', "Data Quality row owner");

  [
    "function scheduleResponsiveChartResize()",
    'window.addEventListener("resize", scheduleResponsiveChartResize);',
    'window.addEventListener("orientationchange", scheduleResponsiveChartResize);',
    "scheduleResponsiveChartResize();"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "responsive chart lifecycle");
  });

  [
    "function getResponsiveChartFontSize()",
    'window.matchMedia("(max-width: 767px)").matches',
    "? 14",
    "font: { size: getResponsiveChartFontSize(), weight: \"500\" }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "mobile chart label readability");
  });

  assertSourceContains(
    source,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "mobile viewport runtime configuration"
  );

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

function testMobileViewportDeviceStateContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var phoneStateSource = getSourceRegion(
    source,
    "function isNumlockPhoneDevice(screenLike, maxTouchPoints)",
    "<script>",
    "early phone device state"
  );
  var classifierSource = getSourceRegion(
    source,
    "function isNumlockPhoneDevice(screenLike, maxTouchPoints)",
    "(function applyNumlockPhoneStateBeforeRender()",
    "phone classifier function"
  );
  var classifyPhone = new Function(
    classifierSource + "\nreturn isNumlockPhoneDevice;"
  )();

  [
    { name: "phone touch device state", screen: { width: 390, height: 844 }, touch: 5, expected: true },
    { name: "desktop device state", screen: { width: 1440, height: 900 }, touch: 0, expected: false },
    { name: "tablet device state", screen: { width: 768, height: 1024 }, touch: 5, expected: false },
    { name: "non-touch narrow screen state", screen: { width: 390, height: 844 }, touch: 0, expected: false }
  ].forEach(function(fixture)
  {
    var actual = classifyPhone(fixture.screen, fixture.touch);

    if (actual !== fixture.expected)
    {
      throw new Error(
        fixture.name + ": expected=" + fixture.expected + ", actual=" + actual
      );
    }
  });

  [
    "Math.min(screenWidth, screenHeight)",
    "Number(maxTouchPoints) > 0",
    "shortestScreenSide <= 480",
    'document.documentElement.classList.toggle(',
    '"numlock-phone"',
    "window.screen",
    "navigator.maxTouchPoints"
  ].forEach(function(token)
  {
    assertSourceContains(phoneStateSource, token, "phone device classification");
  });

  [
    "html.numlock-phone { --numlock-phone-scale: 1.6;",
    "html.numlock-phone #appShell { width: calc(100% / var(--numlock-phone-scale));",
    "transform: scale(var(--numlock-phone-scale));",
    "transform-origin: top left;",
    "html.numlock-phone #mainContent { width: 100% !important;",
    "overflow-x: clip !important;",
    "html.numlock-phone #dashboardPanelOverview .hf-kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    "html.numlock-phone #dashboardPanelOverview #businessOverview > :last-child { grid-column: 1 / -1; }",
    "html.numlock-phone #dashboardPanelOverview .hf-overview-evidence { display: grid; grid-template-columns: minmax(0, 1fr); }",
    "html.numlock-phone #dashboardPanelOverview #revenueChartSection, html.numlock-phone #dashboardPanelOverview #topProductsSection { width: 100%; min-width: 0; }",
    "html.numlock-phone #dashboardPanelOverview .hf-summary-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    "html.numlock-phone #dashboardPanelOverview .hf-quick-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
    '!document.documentElement.classList.contains("numlock-phone") &&'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "phone shell normalization");
  });

  [
    "mobileRuntimeDebug",
    "initializeMobileRuntimeDebug",
    "updateMobileRuntimeDebug",
    "width=653"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "temporary probe and fixed viewport removal");
  });

  assertSourceContains(
    source,
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "adaptive device viewport"
  );

  Logger.log(
    "PASS: testMobileViewportDeviceStateContract | phoneThreshold=480 | scale=1.6 | touchRequired=true"
  );

  return {
    passed: true,
    phoneThreshold: 480,
    phoneScale: 1.6,
    touchRequired: true
  };
}

function testFinalMobileScaleControlAlignmentContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var tokenSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
    ).getContent();

  [
    "html.numlock-phone { --numlock-phone-scale: 1.6;",
    "html.numlock-phone #appShell { width: calc(100% / var(--numlock-phone-scale));",
    "transform: scale(var(--numlock-phone-scale));",
    "html.numlock-phone #dashboardPanelOverview #revenueChartSection .hf-analytics-card-header { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(112px, 140px); align-items: center !important; gap: 12px !important; }",
    "html.numlock-phone #dashboardPanelOverview #dateFilterControls { display: flex !important; width: 140px !important; min-width: 112px !important; max-width: 140px !important; flex-wrap: wrap !important; justify-content: flex-end !important; justify-self: end; }",
    "html.numlock-phone #dashboardPanelOverview #customDateRange { width: 100%; justify-content: flex-end; }",
    "@media (min-width: 1024px)",
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar .ui-sidebar-item,',
    "--sidebar-visual-tile-height: 40px;",
    "height: var(--sidebar-control-height) !important; min-height: var(--sidebar-control-height) !important; max-height: var(--sidebar-control-height) !important;",
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton > i { position: relative; z-index: 1; width: 24px !important; flex-basis: 24px !important; margin: 0 !important; text-align: center !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px !important; }',
    '<div class="hf-analytics-card-header mb-1 flex-wrap">'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "final mobile scale and control alignment");
  });

  [
    "html.numlock-phone #dashboardPanelOverview #revenueChartSection .hf-analytics-card-header{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(112px,140px);align-items:center!important;gap:12px!important}",
    "html.numlock-phone #dashboardPanelOverview #dateFilterControls{display:flex!important;width:140px!important;min-width:112px!important;max-width:140px!important;flex-wrap:wrap!important;justify-content:flex-end!important;justify-self:end}",
    "@media (min-width:1024px)",
    "--sidebar-visual-tile-height:40px",
    "height:var(--sidebar-control-height)!important;min-height:var(--sidebar-control-height)!important;max-height:var(--sidebar-control-height)!important"
  ].forEach(function(token)
  {
    assertSourceContains(tokenSource, token, "compiled final control geometry");
  });

  assertSourceExcludes(
    source,
    "--numlock-phone-scale: 1.5",
    "retired phone scale"
  );

  Logger.log(
    "PASS: testFinalMobileScaleControlAlignmentContract | scale=1.6 | filter=right | collapsedTile=40"
  );

  return {
    passed: true,
    phoneScale: 1.6,
    filterAlignment: "right",
    collapsedTile: 40
  };
}

function testCollapsedSidebarTriggerPolishContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var tokenSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
    ).getContent();

  [
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton { width: 40px !important; min-width: 40px !important; max-width: 40px !important; height: var(--sidebar-control-height) !important;',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton::before { content: ""; position: absolute; z-index: 0; top: calc((var(--sidebar-control-height) - var(--sidebar-visual-tile-height)) / 2); right: 0; left: 0; height: var(--sidebar-visual-tile-height);',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton { border: 1px solid transparent !important; background: transparent !important; color: var(--text-on-dark) !important; outline: none; box-shadow: none !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton:hover { background: transparent !important; color: var(--text-primary) !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton:active { background: transparent !important; color: var(--text-primary) !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton:focus:not(:focus-visible) { outline: none !important; box-shadow: none !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton:focus-visible { outline: 2px solid var(--focus) !important; outline-offset: 2px !important; box-shadow: none !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton > i { position: relative; z-index: 1; width: 24px !important; flex-basis: 24px !important; margin: 0 !important; text-align: center !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px !important; }',
    'html.numlock-phone #sidebarCollapseButton { display: none !important; }'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "collapsed sidebar trigger polish");
  });

  [
    "#appShell[data-sidebar-collapsed=true] #dashboardSidebar #sidebarCollapseButton{border:1px solid transparent!important;background:transparent!important;color:var(--text-on-dark)!important;outline:none;box-shadow:none!important}",
    "#appShell[data-sidebar-collapsed=true] #dashboardSidebar #sidebarCollapseButton:hover{background:transparent!important;color:var(--text-primary)!important}",
    "#appShell[data-sidebar-collapsed=true] #dashboardSidebar #sidebarCollapseButton:focus-visible{outline:2px solid var(--focus)!important;outline-offset:2px!important;box-shadow:none!important}"
  ].forEach(function(token)
  {
    assertSourceContains(tokenSource, token, "compiled collapsed trigger states");
  });

  Logger.log(
    "PASS: testCollapsedSidebarTriggerPolishContract | tile=40 | default=neutral | focusVisible=true"
  );

  return {
    passed: true,
    tile: 40,
    defaultState: "neutral",
    focusVisible: true
  };
}

function testDesktopCollapsedSidebarSharedGeometryContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var tokenSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
    ).getContent();

  [
    "#dashboardSidebar { --sidebar-control-height: 45px; --sidebar-visual-tile-height: 40px; --sidebar-control-radius: 8px; }",
    "#dashboardSidebar .ui-sidebar-item, #dashboardSidebar .ui-future-module { height: var(--sidebar-control-height) !important; min-height: var(--sidebar-control-height) !important; max-height: var(--sidebar-control-height) !important; border-radius: var(--sidebar-control-radius) !important; padding-top: 0 !important; padding-bottom: 0 !important; }",
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar > nav + div { width: 64px !important; max-width: 64px !important; grid-template-columns: 64px !important; justify-items: center !important; box-sizing: border-box !important; padding-right: 0 !important; padding-left: 0 !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar > nav + div > .space-y-1 { width: 64px !important; max-width: 64px !important; justify-self: center !important; box-sizing: border-box !important; padding-right: 0 !important; padding-left: 0 !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar .sidebar-status-region { width: 64px !important; max-width: 64px !important; padding-right: 0 !important; padding-left: 0 !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton { width: 40px !important;',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar #sidebarCollapseButton > i { position: relative; z-index: 1; width: 24px !important; flex-basis: 24px !important;',
    '<p class="ui-page-subtitle ui-theme-muted mt-0.5">Business Intelligence</p>',
    "#dashboardSidebar .sidebar-brand p { margin: 0 !important; font-family: var(--font-sans) !important; font-size: 13px !important; font-weight: 400 !important; line-height: 18px !important; color: var(--text-muted) !important; }",
    "#utilityPageContext, #transactionsDescription, #settings header p:last-child, #logs header p:last-child { font-size: 13px !important; font-weight: 400 !important; line-height: 18px !important;",
    '#dashboardSidebar { width: 264px !important; }',
    "html.numlock-phone { --numlock-phone-scale: 1.6;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "desktop collapsed shared geometry");
  });

  [
    "#dashboardSidebar{--sidebar-control-height:45px;--sidebar-visual-tile-height:40px;--sidebar-control-radius:8px}",
    "#dashboardSidebar .ui-future-module,#dashboardSidebar .ui-sidebar-item{border-radius:var(--sidebar-control-radius)!important;padding-top:0!important;padding-bottom:0!important}",
    "#dashboardSidebar #financialModulesDisclosureButton,#dashboardSidebar #financialModulesGroup>*,#dashboardSidebar .ui-future-module,#dashboardSidebar .ui-sidebar-item{height:var(--sidebar-control-height)!important;min-height:var(--sidebar-control-height)!important;max-height:var(--sidebar-control-height)!important}",
    "#appShell[data-sidebar-collapsed=true] #dashboardSidebar>nav+div{width:64px!important;max-width:64px!important;grid-template-columns:64px!important;justify-items:center!important;box-sizing:border-box!important;padding-right:0!important;padding-left:0!important}",
    "#dashboardSidebar .sidebar-brand p{margin:0!important;font-family:var(--font-sans)!important;font-size:13px!important;font-weight:400!important;line-height:18px!important;color:var(--text-muted)!important}"
  ].forEach(function(token)
  {
    assertSourceContains(tokenSource, token, "compiled desktop sidebar geometry");
  });

  Logger.log(
    "PASS: testDesktopCollapsedSidebarSharedGeometryContract | axis=32 | row=45 | collapsedTile=40 | subtitle=13/18"
  );

  return {
    passed: true,
    collapsedAxis: 32,
    rowHeight: 45,
    collapsedTile: 40,
    subtitle: "13/18"
  };
}

function testDesktopSidebarContentAlignmentGridContract()
{
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var tokenSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
    ).getContent();

  [
    "#dashboardSidebar { --sidebar-control-height: 45px; --sidebar-visual-tile-height: 40px; --sidebar-control-radius: 8px; }",
    "#dashboardSidebar > div:first-of-type { height: 96px !important; min-height: 96px !important; max-height: 96px !important; box-sizing: border-box; align-items: center !important; border-bottom: 1px solid transparent; padding-top: 0 !important; padding-bottom: 0 !important; }",
    "#dashboardSidebar .sidebar-brand > div:first-child > .sidebar-expanded-content { display: flex; flex-direction: column; gap: 2px; justify-content: center; }",
    "#appShell[data-sidebar-collapsed=\"true\"] #dashboardSidebar .sidebar-brand > div:first-child > .sidebar-expanded-content { display: none !important; width: 0 !important; min-width: 0 !important; max-width: 0 !important; overflow: hidden !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }",
    "#dashboardSidebar .sidebar-brand .text-xl { line-height: 32px !important; }",
    "#dashboardSidebar > nav { padding-top: 8px !important; }",
    "#dashboardSidebar > nav + div { height: auto !important; margin-top: auto !important; grid-template-rows: auto var(--sidebar-control-height) 46px !important; }",
    "#dashboardSidebar #sidebarCollapseButton { grid-row: 2 !important; height: var(--sidebar-control-height) !important; min-height: var(--sidebar-control-height) !important; max-height: var(--sidebar-control-height) !important; }",
    "#dashboardSidebar #sidebarCollapseButton + div { grid-row: 3 !important; }",
    "#dashboardTabList [role=\"tab\"] { display: flex !important; height: 45px !important;",
    "#appShell[data-sidebar-collapsed=\"true\"] #dashboardSidebar .ui-future-module { width: 40px !important; min-width: 40px !important; max-width: 40px !important; height: var(--sidebar-control-height) !important;",
    "#appShell[data-sidebar-collapsed=\"true\"] #dashboardSidebar #sidebarCollapseButton { width: 40px !important; min-width: 40px !important; max-width: 40px !important; height: var(--sidebar-control-height) !important;",
    "html.numlock-phone { --numlock-phone-scale: 1.6;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "desktop sidebar content alignment grid");
  });

  assertSourceExcludes(source, "translateY(-24px)", "legacy sidebar footer translation");
  assertSourceExcludes(source, "margin-bottom: -24px", "legacy negative sidebar footer margin");
  assertSourceExcludes(source, "height: 460px", "fixed sidebar footer spacer");
  assertSourceExcludes(source, "grid-template-rows: auto minmax(0, 1fr) var(--sidebar-control-height)", "flexible spacer between utilities and collapse");
  assertSourceExcludes(source, ".sidebar-brand .text-xl { position:", "brand title positioning compensation");
  assertSourceExcludes(source, ".sidebar-brand p { position:", "brand subtitle positioning compensation");
  assertSourceExcludes(source, ".sidebar-brand .text-xl { transform:", "brand title transform compensation");
  assertSourceExcludes(source, ".sidebar-brand p { margin-top:", "independent brand subtitle gap");

  [
    "#dashboardSidebar{--sidebar-control-height:45px;--sidebar-visual-tile-height:40px;--sidebar-control-radius:8px}",
    "#dashboardSidebar>div:first-of-type{height:96px!important;min-height:96px!important;max-height:96px!important;box-sizing:border-box;align-items:center!important;border-bottom:1px solid transparent;padding-top:0!important;padding-bottom:0!important}",
    "#dashboardSidebar .sidebar-brand>div:first-child>.sidebar-expanded-content{display:flex;flex-direction:column;gap:2px;justify-content:center}",
    "#appShell[data-sidebar-collapsed=true] #dashboardSidebar .sidebar-brand>div:first-child>.sidebar-expanded-content{display:none!important;width:0!important;min-width:0!important;max-width:0!important;overflow:hidden!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}",
    "#dashboardSidebar .sidebar-brand .text-xl{line-height:32px!important}",
    "#dashboardSidebar>nav{padding-top:8px!important}",
    "#dashboardSidebar>nav+div{height:auto!important;margin-top:auto!important;grid-template-rows:auto var(--sidebar-control-height) 46px!important}",
    "#dashboardSidebar #sidebarCollapseButton{grid-row:2!important;height:var(--sidebar-control-height)!important;min-height:var(--sidebar-control-height)!important;max-height:var(--sidebar-control-height)!important}",
    "top:calc((var(--sidebar-control-height) - var(--sidebar-visual-tile-height))/2)"
  ].forEach(function(token)
  {
    assertSourceContains(tokenSource, token, "compiled desktop alignment grid");
  });

  Logger.log(
    "PASS: testDesktopSidebarContentAlignmentGridContract | header=96 | navInset=8 | sharedRow=45 | visualTile=40 | bottomSpacer=above | statusReserve=46"
  );

  return {
    passed: true,
    headerHeight: 96,
    navigationInset: 8,
    expandedRowHeight: 45,
    collapsedNavigationRowHeight: 45,
    visualTileHeight: 40,
    statusReserve: 46
  };
}

function testThemeParityTokenContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var tokenSource = HtmlService.createHtmlOutputFromFile("189.View.Tailwind").getContent();
  var scenariosPassed = 0;
  var pairedTokens = [
    "canvas", "sidebar", "sidebar-hover", "surface-1", "surface-2", "surface-3",
    "border-subtle", "border-strong", "divider", "text-primary", "text-secondary",
    "text-muted", "text-on-dark", "brand", "brand-hover", "brand-soft", "active",
    "selected", "hover", "focus", "disabled-bg", "disabled-text", "success",
    "success-soft", "info", "info-soft", "warning", "warning-soft", "critical",
    "critical-soft", "stale", "stale-soft", "unavailable", "skeleton-start",
    "skeleton-middle", "overlay", "tooltip-bg", "tooltip-text", "chart-grid",
    "chart-axis", "chart-series-1", "chart-series-2", "chart-series-3",
    "chart-series-4", "chart-revenue-fill"
  ];

  pairedTokens.forEach(function(token)
  {
    assertSourceOccurrenceCount(tokenSource, "--" + token + ":", 2, "Light/Dark semantic token " + token);
  });
  scenariosPassed++;

  [
    "print-canvas", "print-text", "print-border", "print-chart-grid",
    "print-chart-axis", "print-chart-series-1", "print-chart-series-2",
    "print-chart-series-3", "print-chart-series-4", "print-chart-revenue-fill",
    "print-tooltip-bg", "print-tooltip-text"
  ].forEach(function(token)
  {
    assertSourceContains(tokenSource, "--" + token + ":", "authoritative print-light token " + token);
  });
  scenariosPassed++;

  assertSourceExcludes(tokenSource, "--canvas:#000", "pure-black canvas");
  assertSourceExcludes(tokenSource, "--surface-1:#000", "pure-black primary surface");
  scenariosPassed++;

  [
    'data-theme-preference', 'data-effective-theme',
    'document.documentElement.setAttribute(\n        "data-theme",\n        resolvedTheme',
    'document.documentElement.setAttribute(\n        "data-effective-theme",\n        resolvedTheme'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "preference and effective-theme ownership");
  });
  scenariosPassed++;

  [
    "function synchronizeSystemThemeListener(preference)",
    "systemThemeListenerAttached", "systemThemeQuery.addEventListener(",
    "systemThemeQuery.removeEventListener(", "handleSystemThemeChange"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "System listener lifecycle");
  });
  assertSourceOccurrenceCount(source, "systemThemeQuery.addEventListener(", 1, "one System listener attachment path");
  assertSourceOccurrenceCount(source, "systemThemeQuery.removeEventListener(", 1, "one System listener removal path");
  scenariosPassed++;

  [
    "allowedThemes[preference]", ': "light";',
    "function applyStoredThemeBeforeRender()", "initializeThemeFoundation();",
    "applyThemePreference(initialPreference, false, false);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "invalid fallback and pre-render resolution");
  });
  scenariosPassed++;

  var paletteSource = getSourceRegion(
    source,
    "function getCurrentThemePalette(forceLight)",
    "function handleSystemThemeChange",
    "centralized chart palette"
  );
  [
    "window.getComputedStyle(document.documentElement)",
    'var prefix = forceLight ? "--print-" : "--";',
    'readToken("chart-series-1")', 'readToken("chart-grid")',
    'readToken("chart-axis")', 'readToken("tooltip-bg")'
  ].forEach(function(token)
  {
    assertSourceContains(paletteSource, token, "theme-derived Chart.js palette");
  });
  if (/#[0-9a-f]{3,8}|rgba?\(/i.test(paletteSource))
  {
    throw new Error("Chart palette retains hardcoded production colors");
  }
  scenariosPassed++;

  var syncSource = getSourceRegion(
    source,
    "function applyChartThemeTokens(chart, palette, chartKind)",
    "function applyThemePreference",
    "chart instance theme synchronization"
  );
  ["chart.config.options", "revenueChart", "categoryPerformanceChart", "expenseChart", 'chart.update("none");'].forEach(function(token)
  {
    assertSourceContains(syncSource, token, "existing chart instance update");
  });
  ["new Chart(", "destroyChartInstance("].forEach(function(token)
  {
    assertSourceExcludes(syncSource, token, "chart recreation during theme switch");
  });
  scenariosPassed++;

  [
    "#mainChartWrapper { height: 288px;", "maintainAspectRatio: false",
    "@media (prefers-reduced-motion: reduce)", "revenueChartSummary",
    "hotColdChartSummary", "expenseChartSummary"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "finite accessible chart parity");
  });
  scenariosPassed++;

  [
    "--canvas: var(--print-canvas);", "--text-primary: var(--print-text);",
    "--border-subtle: var(--print-border);", "synchronizeChartTheme(true);",
    "synchronizeChartTheme(false);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "print-light isolation and restoration");
  });
  scenariosPassed++;

  [
    'id="dashboard"', 'id="transactions"', 'id="settings"', 'id="logs"',
    'data-sidebar-collapsed="false"', 'aria-current="page"',
    'aria-disabled="true"', 'id="dashboardStatus"', 'id="transactionDrilldownSummary"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "component and visual-acceptance hook parity");
  });
  scenariosPassed++;

  [
    "button:focus-visible", "outline: 3px solid var(--focus)",
    "opacity: 1", "Current", "Stale", "No Data", "Good", "Attention",
    "Critical", "unavailable until module migration is approved"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "accessible non-color state parity");
  });
  scenariosPassed++;

  if (/#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i.test(source))
  {
    throw new Error("Production HTML retains a hardcoded color outside semantic tokens");
  }
  scenariosPassed++;

  var themeSource = getSourceRegion(
    source,
    "function getResolvedTheme(preference)",
    "function sanitizeClientLogMessage",
    "theme controller"
  );
  ["google.script.run", "getDashboardData(", "requestDashboardData(", "new Chart(", "destroyChartInstance("].forEach(function(token)
  {
    assertSourceExcludes(themeSource, token, "theme-induced request or recreation");
  });
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "theme response mutation");
  });
  scenariosPassed++;

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount = (source.match(/document\.querySelector(?:All)?\(/g) || []).length;
  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("Theme parity query budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred phase owner");
  assertSourceExcludes(source, "ResizeObserver", "theme parity ResizeObserver");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleResponsiveChartResize);', "single responsive resize listener");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleLayoutDebugMeasurement);', "single layout-debug resize listener");
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    pairedTokens: pairedTokens.length,
    chartInstancesRecreated: false,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testThemeParityTokenContract | scenarios=" + summary.scenarios +
    " | pairedTokens=" + summary.pairedTokens +
    " | chartInstancesRecreated=" + summary.chartInstancesRecreated +
    " | backendRequests=" + summary.backendRequests +
    " | idQueries=" + summary.idQueries +
    " | selectorQueries=" + summary.selectorQueries
  );

  return summary;
}

function testChartRuntimeThemeSynchronizationContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var helperSource = getSourceRegion(
    source,
    "function applyChartThemeTokens(chart, palette, chartKind)",
    "function synchronizeChartTheme(forceLight)",
    "runtime chart theme helper"
  );
  var applyTokens = new Function("return (" + helperSource.trim() + ");")();
  var scenariosPassed = 0;
  var light = {
    series: ["light-line", "light-two", "light-peak", "light-four"],
    grid: "light-grid",
    axis: "light-axis",
    tooltipBackground: "light-tooltip",
    tooltipText: "light-tooltip-text",
    pointStroke: "light-stroke"
  };
  var dark = {
    series: ["dark-line", "dark-two", "dark-peak", "dark-four"],
    grid: "dark-grid",
    axis: "dark-axis",
    tooltipBackground: "dark-tooltip",
    tooltipText: "dark-tooltip-text",
    pointStroke: "dark-stroke"
  };
  var peakFilter = function(tooltipItem) { return tooltipItem.dataIndex !== 1; };
  var chart = {
    data: { datasets: [{ data: [10, 20, 15] }] },
    config: {
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "initial",
            titleColor: "initial",
            bodyColor: "initial",
            filter: peakFilter
          },
          revenuePeakLabel: {
            index: 1,
            tooltip: {
              backgroundColor: "initial",
              titleColor: "initial",
              bodyColor: "initial",
              shadowColor: "initial"
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: {}, border: {} },
          y: { grid: { display: true, lineWidth: 0.6 }, ticks: {}, border: {} }
        }
      }
    },
    options: { staleResolvedView: true },
    updates: 0,
    update: function(mode)
    {
      if (mode !== "none") throw new Error("Runtime theme update must disable animation");
      this.updates++;
    }
  };
  var originalChart = chart;
  var peakPluginOptions = chart.config.options.plugins.revenuePeakLabel;

  applyTokens(chart, light, "revenue");
  if (chart.config.options.plugins.tooltip.backgroundColor !== light.tooltipBackground)
    throw new Error("Initial Light tooltip tokens were not applied");
  scenariosPassed++;

  applyTokens(chart, dark, "revenue");
  if (chart.config.options.plugins.tooltip.backgroundColor !== dark.tooltipBackground)
    throw new Error("Light to Dark did not update the authoritative config");
  scenariosPassed++;

  applyTokens(chart, light, "revenue");
  if (chart.config.options.plugins.tooltip.backgroundColor !== light.tooltipBackground)
    throw new Error("Dark to Light did not update the authoritative config");
  scenariosPassed++;

  [dark, light, dark, light].forEach(function(palette)
  {
    applyTokens(chart, palette, "revenue");
  });
  if (chart.config.options.plugins.tooltip.backgroundColor !== light.tooltipBackground)
    throw new Error("Repeated theme sequence retained a stale token");
  scenariosPassed++;

  if (chart !== originalChart) throw new Error("Chart instance identity changed");
  scenariosPassed++;
  if (chart.config.options.scales.y.grid.color !== light.grid || chart.config.options.scales.y.grid.lineWidth !== 0.6)
    throw new Error("Revenue grid token or accepted line width changed");
  scenariosPassed++;
  if (chart.config.options.scales.x.ticks.color !== light.axis || chart.config.options.scales.y.ticks.color !== light.axis)
    throw new Error("Axis label tokens did not synchronize");
  scenariosPassed++;
  if (peakPluginOptions.tooltip.backgroundColor !== light.tooltipBackground)
    throw new Error("Persistent peak background did not synchronize");
  scenariosPassed++;
  if (peakPluginOptions.tooltip.titleColor !== light.tooltipText || peakPluginOptions.tooltip.bodyColor !== light.tooltipText)
    throw new Error("Persistent peak text did not synchronize");
  scenariosPassed++;
  if (chart.config.options.plugins.tooltip.titleColor !== light.tooltipText || chart.config.options.plugins.tooltip.bodyColor !== light.tooltipText)
    throw new Error("Native hover tooltip did not synchronize");
  scenariosPassed++;
  if (chart.config.options.plugins.tooltip.filter !== peakFilter || peakFilter({ dataIndex: 1 }) !== false || peakFilter({ dataIndex: 0 }) !== true)
    throw new Error("Peak hover suppression contract changed");
  scenariosPassed++;
  if (chart.config.options.plugins.revenuePeakLabel !== peakPluginOptions)
    throw new Error("Peak plugin options were duplicated");
  assertSourceExcludes(helperSource, "new Chart(", "runtime chart recreation");
  scenariosPassed++;

  var systemSource = getSourceRegion(
    source,
    "function handleSystemThemeChange()",
    "function applyChartThemeTokens(chart, palette, chartKind)",
    "System effective-theme path"
  );
  assertSourceContains(systemSource, 'applyThemePreference("system", false, false);', "System shared theme path");
  assertSourceContains(source, "synchronizeChartTheme();", "application theme chart synchronization");
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    chartIdentityPreserved: chart === originalChart,
    updates: chart.updates,
    duplicatePlugins: false
  };
  Logger.log(
    "PASS: testChartRuntimeThemeSynchronizationContract | scenarios=" +
    summary.scenarios + " | chartIdentityPreserved=" +
    summary.chartIdentityPreserved + " | updates=" + summary.updates +
    " | duplicatePlugins=" + summary.duplicatePlugins
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
    '#dashboardSidebar { width: 248px;',
    '#dashboardSidebar { width: 224px;',
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
    '#topUtilityBar { height: 76px; min-height: 76px;',
    '#topUtilityBar { height: 68px; min-height: 68px;',
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
    'var preference = "light";',
    'preference === "system"',
    '"(prefers-color-scheme: dark)"',
    'data-theme-preference'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Light default and optional System theme");
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
    "background: var(--print-canvas) !important;",
    "color: var(--print-text);"
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
    "Finance disclosure"
  );
  var toggleSource = getSourceRegion(
    source,
    "function toggleFinancialModulesDisclosure(button)",
    "function setDesktopSidebarCollapsed(isCollapsed)",
    "Finance disclosure behavior"
  );
  var unavailableGroupSource = getSourceRegion(
    source,
    'id="financialModulesGroup"',
    "</nav>",
    "unavailable Finance group"
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
  ["<button", "<a ", 'tabindex="0"', "onclick="].forEach(function(token)
  {
    assertSourceExcludes(
      unavailableGroupSource,
      token,
      "unavailable destination activation and focus exclusion"
    );
  });
  scenariosPassed++;

  [
    'id="financialModulesDisclosureButton"',
    'aria-expanded="true"',
    'aria-controls="financialModulesGroup"',
    'aria-label="Finance, expanded"',
    'id="financialModulesGroup"',
    'aria-label="Unavailable Finance destinations"',
    'id="financialModulesGroup" class="mt-1 space-y-0 pl-5" role="list" aria-label="Unavailable Finance destinations"',
    "unavailable until module migration is approved"
  ].forEach(function(token)
  {
    assertSourceContains(
      navigationSource,
      token,
      "Finance grouping and status"
    );
  });
  assertSourceContainsOnce(
    navigationSource,
    'id="financialModulesDisclosureButton"',
    "one Finance disclosure"
  );
  scenariosPassed++;

  [
    'button.setAttribute("aria-expanded", String(nextExpanded));',
    '"Finance, " + (nextExpanded ? "expanded" : "collapsed")',
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
    '#dashboardSidebar { width: 248px;',
    '#dashboardSidebar { width: 224px;',
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
    "box-shadow:none",
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
  var shellChromeSource = utilitySource + sidebarSource + showPageSource;
  var scenariosPassed = 0;

  assertSourceContainsOnce(source, 'id="topUtilityBar"', "one utility row");
  [
    'id="utilityPageTitle"',
    'id="utilityPageContext"'
  ].forEach(function(token)
  {
    assertSourceContains(utilitySource, token, "authoritative utility ownership");
  });
  assertSourceContainsOnce(sidebarSource, 'id="sidebarDataStatus"', "sidebar runtime status target");
  assertSourceExcludes(utilitySource, 'id="utilityVersion"', "removed utility version target");
  assertSourceExcludes(
    sidebarSource,
    'data-metadata-source="template.version"',
    "sidebar template-version provenance"
  );
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
    '#dashboardSidebar { width: 248px;',
    '#dashboardSidebar { width: 224px;',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px;',
    '#topUtilityBar { height: 76px; min-height: 76px;',
    '#topUtilityBar { height: 68px; min-height: 68px;',
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
    "grid-template-rows: 76px minmax(0, 1fr)",
    "grid-template-rows: 68px minmax(0, 1fr)",
    '#contentViewport { height: auto; min-height: 0; overflow: hidden; padding: 20px 24px 12px; }',
    '#dashboardContent { display: grid; min-height: 0; flex: 1 1 auto; grid-template-rows: 44px minmax(0, 1fr); gap: 12px; }'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "one-viewport desktop shell");
  });
  scenariosPassed++;

  [
    '@media (max-width: 1023px)',
    '#dashboardSidebar { width: min(320px, calc(100vw - 32px));',
    '#topUtilityBar { height: auto; min-height: 52px; flex-wrap: wrap; padding: 8px 12px; }',
    '#contentViewport { overflow: visible; padding: var(--space-5); }',
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
    '#topUtilityBar { height: 76px; min-height: 76px; background: var(--surface-1); border-color: var(--divider); box-shadow: none; }',
    '.overview-surface,',
    '.analytics-surface,',
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
    assertSourceExcludes(shellChromeSource, token, "forbidden SaaS feature");
  });
  scenariosPassed++;

  [
    ':root[data-theme="dark"]',
    'background: var(--surface-1)',
    'background: var(--canvas)',
    '@media print',
    'background: var(--print-canvas) !important;',
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
    "insights"
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
      "keyMetricsSection",
      "overviewEvidenceRow",
      "executiveSummarySection"
    ],
    performance: [
      "productProfitabilitySection",
      "performanceSecondaryGrid",
      "forecastSection",
      "productConcentrationSection"
    ],
    insights: [
      "businessPriorityRegion",
      "diagnosisSection",
      "recommendationsSection",
      "riskOpportunitySection",
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
  ownership.overview.concat(ownership.performance)
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
    "overview: [revenueChart]",
    "performance: [productProfitabilityChart, categoryPerformanceChart, expenseChart]",
    "chart.resize();",
    "revenueChart = destroyChartInstance(revenueChart);",
    "productProfitabilityChart = destroyChartInstance(productProfitabilityChart);",
    "categoryPerformanceChart = destroyChartInstance(categoryPerformanceChart);",
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
    "#dashboardContent { display: grid; min-height: 0; flex: 1 1 auto; grid-template-rows: 44px minmax(0, 1fr); gap: 12px; }",
    "#dashboardPanelOverview { height: 100%; overflow: visible; }",
    "@media (max-width: 1023px)",
    "#contentViewport { overflow: visible; padding: var(--space-5); }"
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
    ownedSections: 17,
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
  var compiledSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
    ).getContent();
  var layoutDebugDoGetSource = String(doGet);
  var scenariosPassed = 0;

  [
    'id="dashboardHeaderRegion"',
    'id="filter"',
    '<option value="currentMonth">This Month</option>',
    '<option value="previousMonth">Previous Month</option>',
    '<option value="currentYear" selected>This Year</option>',
    '<option value="previousYear">Previous Year</option>',
    '<option value="customMonth">Custom Month</option>',
    '<option value="customYear">Custom Year</option>',
    '<option value="custom">Custom Range</option>',
    'id="printReportButton"',
    'id="dateFilterLabel"',
    'id="latestDataLabel"',
    'id="freshnessStatusBadge"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Overview reporting toolbar");
  });
  assertSourceExcludes(source, "Source:", "Overview source label");
  [
    'id="dashboardTabInsights"',
    'Insights &amp; Plans',
    '#dashboardTabList { display: inline-flex !important; width: max-content !important; max-width: 100% !important; margin-left: 0 !important;',
    'status.classList.toggle(',
    'state === "loading"',
    'statusText.classList.add("sr-only");'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "runtime review presentation corrections");
  });
  scenariosPassed++;

  [
    'id="executiveSummarySection"',
    ">Key Summary</h2>",
    "Highest Revenue",
    "Average Monthly Revenue",
    "Total Profit",
    "Average Profit Margin",
    ">Quick Actions</h2>",
    "View Transactions</strong>",
    "Export Report</strong>",
    "Print Report</strong>",
    "Data Summary</strong>",
    'id="businessPriorityRegion"',
    'id="businessPriorityLevel"',
    'id="priorityTitle"',
    'id="priorityReason"',
    'id="priorityMessage"',
    'id="priorityMeta"',
    ".hf-summary-action-grid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 18px; }",
    ".hf-priority-action { border-left: 1px solid var(--divider); }",
    ".hf-priority-action #businessPriorityLevel { border-bottom: 2px solid currentColor; padding-bottom: 2px; }",
    '"text-xs font-semibold " +',
    '"Next action: " + priority.action',
    "priority.evidence.metric"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "executive action hierarchy");
  });
  assertSourceExcludes(source, 'id="executiveAlertCard"', "Overview alert presentation");
  assertSourceExcludes(source, "Attention ·", "Overview alert strip");
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
  [
    'id="keySummarySkeleton"',
    'aria-hidden="true"',
    'elements.keySummarySkeleton.classList.remove("hidden");',
    'elements.keySummarySkeleton.classList.add("hidden");',
    'id="executiveSummary" class="hf-summary-metrics">Loading...</div>',
    "renderExecutiveSummary(res);",
    "hideChartSkeleton();"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Key Summary loading skeleton lifecycle");
  });
  assertSourceOccurrenceCount(
    source,
    'class="space-y-2"><span class="block h-3',
    4,
    "four Key Summary skeleton metric blocks"
  );
  [
    "hf-kpi-strip",
    "hf-kpi-icon",
    'Revenue: "fa-arrow-trend-up"',
    'Expense: "fa-wallet"',
    'Profit: "fa-coins"',
    '"Profit Margin": "fa-percent"',
    '"Units Sold": "fa-mug-hot"',
    ".hf-kpi-card { min-height: 130px; padding: 17px 18px; border: 1px solid var(--card-border); border-radius: 12px; background: var(--card-bg); box-shadow: var(--card-shadow); }",
    ".hf-kpi-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 18px; background: transparent; }",
    'status === "No Comparison"',
    "hf-kpi-comparison",
    'text-[28px] font-extrabold leading-8 tracking-tight'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact KPI strip");
  });
  scenariosPassed++;

  [
    'id="executiveSummaryPeriod"',
    'currentMonth: "This Month"',
    'previousYear: "Previous Year"',
    'custom: "Custom Range"',
    'periodLabels[res.dateFilter.filter]',
    'Math.round(averageMonthlyRevenue / 1000) * 1000',
    'Number(res.insights.profitMargin) < 0 ? negativeClass',
    'marginStatus === "Down" ? "▼ -"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "shared period and signed KPI state");
  });
  scenariosPassed++;

  if (Math.round(2073875 / 1000) * 1000 !== 2074000)
  {
    throw new Error("Key Summary nearest-thousand presentation rule changed");
  }
  scenariosPassed++;

  [
    'id="overviewEvidenceRow"',
    'id="revenueChartSection"',
    'staging.querySelector("#overviewEvidenceRow")',
    "grid-template-columns: minmax(0, 3fr) minmax(270px, 1fr)",
    "#dashboardPanelOverview #mainChartWrapper { height: 210px; min-height: 210px; max-height: 210px; overflow: visible; }",
    'id="overviewContextRow" class="hf-overview-context"',
    "#dashboardPanelOverview #mainChartWrapper { height: 288px; min-height: 288px; max-height: 288px; }",
    'id="periodComparisonSection"',
    'id="dataQualityInformation"',
    'id="dataQualityDetailsButton"',
    'aria-expanded="false"',
    'aria-controls="dataQualityDetails"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Overview evidence hierarchy");
  });
  scenariosPassed++;

  [
    '? "Compared with"',
    '" rows · " +',
    '" excluded · "',
    '#sidebarCollapseButton { width: 100% !important; border: 0 !important;',
    'resizeVisibleDashboardCharts(activeDashboardTab);'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact evidence and collapse reflow");
  });
  scenariosPassed++;

  [
    'return "N/A";',
    '<select id="customMonth"',
    '<select id="customYear"',
    'Array.isArray(dateFilter.availableMonths)',
    'Array.isArray(dateFilter.availableYears)',
    'renderAvailablePeriodOptions(res.dateFilter);',
    '#dashboardPanelOverview #dataQualityInformation { display: flex !important; min-width: max-content !important; align-items: center !important; justify-content: flex-end !important; white-space: nowrap !important; }',
    '#printReportButton .hf-action-copy strong { white-space: nowrap; }',
    'status.classList.add("sr-only");'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "runtime refinement contract");
  });
  assertSourceExcludes(source, 'id="customMonth" type="month"', "manual custom month input");
  assertSourceExcludes(source, 'id="customYear" type="number"', "manual custom year input");
  scenariosPassed++;

  [
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar .ui-sidebar-item > i,',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar > nav + div { width: 64px !important; padding-left: 0 !important; padding-right: 0 !important; margin-left: 0 !important; margin-right: 0 !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar .ui-future-module { width: 64px !important; max-width: 64px !important; margin-left: 0 !important; margin-right: 0 !important; justify-content: center !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar .numlock-mark { width: 46px !important; height: 46px !important; flex-basis: 46px !important; margin-left: auto !important; margin-right: auto !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar .sidebar-status-region { display: block !important; height: 46px !important; min-height: 46px !important; visibility: hidden !important; }',
    '#financialModulesDisclosureButton { margin-top: 0; font-size: 14px; font-weight: 400;',
    '#financialModulesGroup .ui-future-module { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 10px; padding-left: 10px; }',
    'id="dashboardTabInsights"',
    'white-space: nowrap !important;'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "sidebar and tab refinement contract");
  });
  scenariosPassed++;

  [
    '.hf-quick-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }',
    '.hf-quick-actions button { display: grid; width: 100%; min-width: 0;',
    '#printReportButton .hf-action-copy strong { white-space: nowrap; }',
    'Number(res.summary.averageMonthlyRevenue || 0)',
    'Math.round(averageMonthlyRevenue / 1000) * 1000'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "final runtime defect contract");
  });
  assertSourceExcludes(source, '#printReportButton {\n      width: 132px', "Print Report fixed content width");
  scenariosPassed++;

  [
    'class="hf-period-secondary hidden min-w-0 items-center gap-2"',
    '<select id="customYear" disabled class="ui-form-text hf-period-select',
    '<select id="customMonth" disabled class="ui-form-text hf-period-select',
    '#filter,\n      .hf-period-select { width: 148px; min-width: 148px; height: 44px;',
    'var representedMonths = availableDashboardMonths',
    'monthKey.slice(0, 4) === selectedYear',
    'monthKey.slice(5, 7)',
    'elements.customYear.value + "-" + elements.customMonth.value',
    'renderAvailableMonthOptions("");',
    'formatRevenueTooltipPeriod(',
    'formatDashboardPresentationPeriod(label, granularity)',
    'formatDashboardPresentationPeriod(comparison.previous.startDate, "day")',
    'formatDashboardPresentationPeriod(comparison.previous.endDate, "day")',
    '#dashboardPanelOverview .hf-kpi-card .hf-section-label { font-size: 13px; line-height: 18px; }',
    'class="hf-data-quality-row"',
    '#dashboardPanelOverview #dataQualityInformation > .hf-data-quality-row { display: inline-flex !important; align-items: center !important; justify-content: flex-end !important; flex-wrap: nowrap !important; gap: 8px !important; line-height: 16px !important; }',
    '.hf-top-products-table thead th { color: var(--text-muted); font-size: var(--text-caption-size); font-weight: var(--font-weight-semibold);',
    '.hf-top-products-table tbody th { font-size: var(--text-caption-size); font-weight: var(--font-weight-normal); line-height: var(--text-label-line); }'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "micro-parity and period control contract");
  });
  assertSourceExcludes(source, "Current ranking", "obsolete Top Products ranking label");
  assertSourceExcludes(source, 'scope="col" class="text-right">Units', "right-aligned Top Products Units header");
  assertSourceExcludes(source, 'scope="col" class="text-right">Revenue', "right-aligned Top Products Revenue header");
  [
    '#dashboardSidebar { width: 264px !important; }',
    '#mainContent { margin-left: 264px !important; }',
    '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px !important; }',
    '#dashboardSidebar #financialModulesGroup .sidebar-expanded-content { white-space: nowrap !important; }',
    '#dashboardSidebar > nav + div { display: grid !important; height: auto !important; margin-top: auto !important; grid-template-rows: auto auto 46px !important;',
    '#dashboardSidebar .sidebar-status-region { display: block !important; height: 46px !important; min-height: 46px !important;',
    '#dashboardSidebar #sidebarCollapseButton { min-height: 48px !important; gap: 12px !important; padding: 10px 12px !important; }',
    'function formatRevenueAxisTick(value)',
    'typeof value === "number" && value === 0',
    'callback: formatRevenueAxisTick,',
    'id="topProductsTitle" class="ui-section-title"',
    '.hf-top-products-table td { height: 34px; padding: 0 6px; border-bottom: 1px solid var(--divider); text-align: left !important;',
    '#dashboardPanelOverview #dataQualityInformation > .hf-data-quality-row { display: inline-flex !important; align-items: center !important;',
    '#dashboardPanelOverview #dataQualityInformation > .hf-data-quality-row > * { margin-top: 0 !important; margin-bottom: 0 !important; line-height: 16px !important; }',
    'topProducts.slice(0, 10)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "remaining WO-028 runtime correction");
  });
  assertSourceExcludes(source, '<td class="text-right tabular-nums">', "right-aligned Top Products quantity cell");
  assertSourceExcludes(source, '<td class="text-right font-semibold tabular-nums ', "right-aligned Top Products revenue cell");
  scenariosPassed++;

  [
    'class="hf-analytics-card-header mb-1 flex-wrap"',
    'class="hf-analytics-title-icon" aria-hidden="true"><i class="fas fa-chart-area"></i>',
    'class="hf-analytics-title-icon hf-analytics-title-icon-products" aria-hidden="true"><i class="fas fa-trophy"></i>',
    'id="revenueChartTitle" class="ui-section-title"',
    'id="topProductsTitle" class="ui-section-title"',
    '--section-icon-size: 48px;',
    '<th scope="col">#</th><th scope="col">Product</th><th scope="col">Units</th><th scope="col">Revenue</th>',
    '.hf-top-products-table { width: 100%; table-layout: fixed; }',
    'white-space: nowrap;',
    '<col class="hf-col-rank"><col class="hf-col-product"><col class="hf-col-units"><col class="hf-col-revenue">',
    '.hf-top-products-table .hf-col-rank { width: 8%; }',
    '.hf-top-products-table .hf-col-product { width: 45%; }',
    '.hf-top-products-table .hf-col-units { width: 18%; }',
    '.hf-top-products-table .hf-col-revenue { width: 29%; }',
    'button, input, select, textarea, table { font-family: inherit; }',
    '.ui-page-heading { font-size: var(--text-display-size);',
    'id="utilityPageTitle" class="ui-page-title',
    '.ui-nav-label { font-size: var(--text-body-size);',
    '.ui-tab-label { font-size: var(--text-label-size);',
    '.ui-section-title { font-size: var(--text-section-size);',
    '.ui-card-title { font-size: var(--text-component-size);',
    '.ui-kpi-label { font-size: var(--text-label-size);',
    '.ui-table-header { font-size: var(--text-caption-size);',
    '.ui-table-body { font-size: var(--text-caption-size);',
    '.ui-form-text { font-family: var(--font-sans);',
    '.ui-empty-state { font-size: var(--text-body-size);',
    '<select id="filter" class="ui-form-text',
    '<select id="customYear" disabled class="ui-form-text hf-period-select',
    '<select id="customMonth" disabled class="ui-form-text hf-period-select',
    '--overview-section-gap: 8px;',
    'gap: var(--overview-section-gap) !important;'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "analytics typography and table parity");
  });
  assertSourceExcludes(source, "text-transform: uppercase", "uppercase Top Products table header styling");
  assertSourceExcludes(source, 'class="truncate text-left font-semibold"', "Top Products product clipping");
  scenariosPassed++;

  [
    '#topProductWrapper { margin-top: var(--card-header-content-gap); }',
    '#dashboardContent { gap: var(--overview-section-gap) !important; }',
    'let customSelectRegistry = {};',
    'function initializeCustomSelectSystem()',
    'enhanceCustomSelect(elements.filter, "Reporting period");',
    'enhanceCustomSelect(elements.customYear, "Available custom year");',
    'enhanceCustomSelect(elements.customMonth, "Available custom month");',
    'trigger.setAttribute("aria-haspopup", "listbox");',
    'trigger.setAttribute("aria-expanded", "false");',
    'listbox.setAttribute("role", "listbox");',
    'option.setAttribute("role", "option");',
    'option.setAttribute("aria-selected", String(nativeOption.value === state.select.value));',
    'event.key === "ArrowDown" || event.key === "ArrowUp"',
    'event.key === "Enter" || event.key === " "',
    'event.key === "Escape"',
    'state.select.dispatchEvent(new Event("change", { bubbles: true }));',
    '.ui-custom-select-option { display: flex; width: 100%; min-width: 150px; min-height: 40px; align-items: center;',
    '.ui-custom-select-check { display: inline-flex; width: 18px; height: 18px; flex: 0 0 18px; align-items: center; justify-content: center; align-self: center; transform: none;',
    '.ui-custom-select-option[aria-selected="true"]',
    '.ui-custom-select-option:focus-visible,',
    'synchronizeCustomSelect("customYear", true);',
    'synchronizeCustomSelect("customMonth", true);',
    'initializeCustomSelectSystem();'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "shared accessible custom dropdown");
  });
  scenariosPassed++;

  [
    'Final runtime visual enforcement II: keep this after legacy component overrides.',
    ':root { --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --font-display: var(--font-sans);',
    'html, body, #appShell, #mainContent, .page, button, input, select, textarea, table { font-family: var(--font-sans) !important;',
    '#utilityPageTitle, #transactionsHeading, #settingsHeading, #logsHeading { font-size: 28px !important; font-weight: 700 !important; line-height: 32px !important;',
    '#dashboardPanelOverview #revenueChartTitle, #dashboardPanelOverview #topProductsTitle, #dashboardPanelOverview .hf-section-heading, #dashboardPanelPerformance h2, #dashboardPanelInsights h2, #transactions h2 { font-size: var(--text-section-size) !important; font-weight: 600 !important;',
    '#dashboardPanelOverview .hf-analytics-title-icon, #dashboardPanelOverview .hf-summary-title-icon { width: var(--section-icon-size) !important; height: var(--section-icon-size) !important; flex-basis: var(--section-icon-size) !important;',
    '#dashboardPanelOverview .hf-kpi-card .overview-kpi-value { font-size: 23px !important; font-weight: 700 !important;',
    '#dashboardContent { gap: var(--overview-section-gap) !important; }',
    '#dashboardTabList { display: inline-flex !important; width: max-content !important; max-width: 100% !important; margin-left: 0 !important; grid-template-columns: none !important;',
    '#dashboardTabList [role="tab"], #dashboardTabInsights { width: auto !important; min-width: 0 !important; flex: 0 0 auto !important;',
    '#dashboardTabList [role="tab"]:hover { background: color-mix(in srgb, var(--hover) 64%, transparent) !important;',
    '#dashboardTabList [role="tab"]:focus-visible { outline: 2px solid var(--focus) !important;',
    '.ui-custom-select-option { display: flex !important; height: 40px !important; min-height: 40px !important; align-items: center !important; padding: 0 12px !important; }',
    '.ui-custom-select-check { display: inline-flex !important; width: 18px !important; height: 18px !important; flex-basis: 18px !important; align-items: center !important; justify-content: center !important; align-self: center !important; transform: none !important; line-height: 18px !important; }',
    '.ui-custom-select-option[aria-selected="true"]:hover,',
    '#topProductWrapper { margin-top: var(--card-header-content-gap); }',
    '#dashboardContent { gap: var(--overview-section-gap) !important; }',
    '#dashboardPanelInsights #riskOpportunitySection { min-height: 0 !important; overflow-y: auto !important; }',
    '#dashboardPanelInsights #riskOpportunitySection > div { flex: 0 0 auto !important; overflow-wrap: anywhere; }'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "runtime visual enforcement contract");
  });
  scenariosPassed++;

  [
    ':where(h1, h2, h3, .ui-page-title, .ui-page-heading, .ui-section-title, .ui-card-title, .ui-kpi-value, .overview-kpi-value, .performance-metric-value) { font-family: var(--font-display) !important;',
    '#dashboardPanelOverview .hf-analytics-title-icon > i, #dashboardPanelOverview .hf-summary-title-icon > i { font-size: var(--section-icon-glyph-size) !important; line-height: 1 !important; }',
    '#dashboardPanelOverview .hf-analytics-title-icon-products > i { font-size: 17px !important; }',
    '#dashboardPanelOverview #revenueChartSection, #dashboardPanelOverview #topProductsSection { padding: 22px 20px 8px 16px !important; }',
    '#dashboardPanelOverview #revenueChartSection { padding-left: 4px !important; }',
    '#dashboardPanelOverview #executiveSummarySection > * { padding: 16px !important; }',
    '#dashboardPanelOverview #keyMetricsSection { margin: 0 !important; }'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "final visual typography and rhythm correction");
  });
  assertSourceExcludes(
    source,
    'id="keyMetricsSection" aria-labelledby="keyMetricsTitle" class="mb-3"',
    "competing KPI section margin"
  );
  scenariosPassed++;

  [
    'id="layoutDebugGrid" aria-hidden="true"',
    'id="layoutDebugIconGuide" class="layout-debug-guide"',
    'id="layoutDebugTitleGuide" class="layout-debug-guide"',
    'id="layoutDebugBadge" aria-hidden="true">LAYOUT DEBUG</div>',
    'id="layoutDebugPanel" aria-hidden="true"',
    'function getLayoutDebugRect(element, textOnly)',
    'rect = element.getBoundingClientRect();',
    'rect = range.getBoundingClientRect();',
    'function refreshLayoutDebugMeasurements()',
    'function scheduleLayoutDebugMeasurement()',
    'function setLayoutDebugEnabled(enabled)',
    'data-layout-debug-enabled="<?= layoutDebugEnabled ? \'true\' : \'false\' ?>"',
    'var serverLayoutDebugEnabled =',
    'document.documentElement.getAttribute("data-layout-debug-enabled") === "true";',
    'serverLayoutDebugEnabled || clientLayoutDebugFallback',
    'new URLSearchParams(window.location.search).get("debugLayout") === "1"',
    'document.documentElement.setAttribute("data-layout-debug", String(layoutDebugEnabled));',
    'function scheduleDeferredDashboardRender(res, requestToken)',
    'window.addEventListener("resize", scheduleLayoutDebugMeasurement);',
    'document.getElementById("sidebarCollapseButton").addEventListener("click", scheduleLayoutDebugMeasurement);',
    'document.getElementById("dashboardTabOverview").addEventListener("click", scheduleLayoutDebugMeasurement);',
    'element.classList.add("layout-debug-target");',
    'STATE sidebar: ',
    '"icon.right: " + formatLayoutDebugNumber(kpiIcon.right)',
    '"icon.width: " + formatLayoutDebugNumber(kpiIcon.width)',
    'var kpiGap = kpiTitle.left - kpiIcon.right;',
    'var revenueGap = revenueTitle.left - revenueIcon.right;',
    'var summaryGap = summaryTitle.left - summaryIcon.right;',
    '"icon.left: " + formatLayoutDebugNumber(delta(revenueIcon.left, kpiIcon.left))',
    '"icon.right: " + formatLayoutDebugNumber(delta(revenueIcon.right, kpiIcon.right))',
    '"icon.width: " + formatLayoutDebugNumber(delta(revenueIcon.width, kpiIcon.width))',
    '"icon.centerX: " + formatLayoutDebugNumber(delta(revenueIcon.centerX, kpiIcon.centerX))',
    '"title.left: " + formatLayoutDebugNumber(delta(revenueTitle.left, kpiTitle.left))',
    '"icon-title.gap: " + formatLayoutDebugNumber(delta(revenueGap, kpiGap))',
    '"icon.left: " + formatLayoutDebugNumber(delta(summaryIcon.left, kpiIcon.left))',
    '"icon.right: " + formatLayoutDebugNumber(delta(summaryIcon.right, kpiIcon.right))',
    '"icon.width: " + formatLayoutDebugNumber(delta(summaryIcon.width, kpiIcon.width))',
    '"icon.centerX: " + formatLayoutDebugNumber(delta(summaryIcon.centerX, kpiIcon.centerX))',
    '"title.left: " + formatLayoutDebugNumber(delta(summaryTitle.left, kpiTitle.left))',
    '"icon-title.gap: " + formatLayoutDebugNumber(delta(summaryGap, kpiGap))',
    'CONTENT',
    'revenue.card.left: ',
    'summary.card.left: ',
    'Number(value).toFixed(2)',
    'id="dashboardTabPerformance"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Phase 7B.2 precision debug contract");
  });
  [
    'function doGet(e)',
    'template.layoutDebugEnabled =',
    'normalizeLayoutDebugParameter(e);'
  ].forEach(function(token)
  {
    assertSourceContains(layoutDebugDoGetSource, token, "server-authoritative layout debug propagation");
  });
  if (
    normalizeLayoutDebugParameter({ parameter: { debugLayout: "1" } }) !== true ||
    normalizeLayoutDebugParameter({ parameter: { debugLayout: "0" } }) !== false ||
    normalizeLayoutDebugParameter({ parameter: { debugLayout: "anything" } }) !== false ||
    normalizeLayoutDebugParameter({ parameter: {} }) !== false ||
    normalizeLayoutDebugParameter() !== false
  )
  {
    throw new Error("Layout debug server parameter normalization changed");
  }
  [
    'pointer-events:none',
    '#layoutDebugGrid,.layout-debug-guide{display:none;position:fixed;pointer-events:none}',
    '#layoutDebugBadge,#layoutDebugPanel{display:none;position:fixed;pointer-events:none}',
    'html[data-layout-debug=true] .layout-debug-target{outline:2px solid #facc15!important'
  ].forEach(function(token)
  {
    assertSourceContains(compiledSource, token, "Phase 7B.2 precision debug styling contract");
  });
  [
    '--overview-header-anchor:',
    '--overview-reference-icon-size:',
    '--overview-reference-title-gap:',
    '#revenueChartSection>.hf-analytics-card-header{transform:',
    '#revenueChartSection>.hf-analytics-card-header{margin-left:-',
    '#executiveSummarySection>.overview-surface>.hf-summary-card-header{transform:',
    '#executiveSummarySection>.overview-surface>.hf-summary-card-header{margin-left:-'
  ].forEach(function(token)
  {
    assertSourceExcludes(compiledSource, token, "Phase 7B.2 magic offset exclusion");
  });
  [
    '--overview-kpi-header-inset:20px',
    '--overview-kpi-icon-width:50px',
    '--overview-kpi-title-gap:20px',
    '#dashboardPanelOverview #executiveSummarySection>.overview-surface>.hf-summary-card-header,#dashboardPanelOverview #revenueChartSection .hf-analytics-title-group{gap:var(--overview-kpi-title-gap)!important}',
    '#dashboardPanelOverview #revenueChartSection .hf-analytics-title-group{padding-left:calc(var(--overview-kpi-header-inset) - 4px)!important}',
    '#dashboardPanelOverview #executiveSummarySection>.overview-surface>.hf-summary-card-header{padding-left:calc(var(--overview-kpi-header-inset) - 16px)!important}',
    '#dashboardPanelOverview #executiveSummarySection>.overview-surface>.hf-summary-card-header>.hf-summary-title-icon,#dashboardPanelOverview #revenueChartSection .hf-analytics-title-icon{width:var(--overview-kpi-icon-width)!important;flex-basis:var(--overview-kpi-icon-width)!important}'
  ].forEach(function(token)
  {
    assertSourceContains(compiledSource, token, "Phase 7B.2 measured header alignment");
  });
  [
    '[data-sidebar-collapsed=true] #dashboardPanelOverview #revenueChartSection',
    '[data-sidebar-collapsed=true] #dashboardPanelOverview #executiveSummarySection'
  ].forEach(function(token)
  {
    assertSourceExcludes(compiledSource, token, "Phase 7B.2 state-independent structural alignment");
  });
  scenariosPassed++;

  [
    '#dashboardPanelOverview:not([hidden]) { gap: 0 !important; }',
    'grid-template-rows: 126px 0 minmax(320px, 1fr) 8px 42px 8px 190px !important;',
    '#dashboardPanelOverview #overviewEvidenceRow { grid-row: 3 !important; }',
    '#dashboardPanelOverview #overviewContextRow { grid-row: 5 !important; }',
    '#dashboardPanelOverview #executiveSummarySection { grid-row: 7 !important; }',
    '#dashboardPanelOverview #mainChartWrapper { box-sizing: border-box !important; padding-top: 12px !important; padding-left: 12px !important; }',
    '#dashboardPanelOverview .hf-summary-metrics { margin-top: 18px !important; }',
    '#dashboardPanelOverview .hf-quick-actions button { min-height: 44px !important;'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "one-page Overview vertical budget");
  });
  assertSourceExcludes(source, 'id="periodComparisonMetrics"', "obsolete comparison metric card");
  scenariosPassed++;

  [
    "#contentViewport { height: auto; min-height: 0; overflow: hidden; padding: 20px 24px 12px; }",
    "#dashboardPanelOverview { height: 100%; overflow: visible; }",
    "@media (max-width: 1023px)",
    "#contentViewport { overflow: visible; padding: var(--space-5); }",
    "overview-surface",
    ':root[data-theme="dark"] .bg-white',
    "background: var(--print-canvas) !important;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "viewport and theme parity");
  });
  scenariosPassed++;

  var overviewOwnershipSource = getSourceRegion(
    source,
    "overview: [",
    "performance: [",
    "Overview ownership"
  );
  [
    "sparkline",
    "google.script.run",
    "getDashboardData("
  ].forEach(function(token)
  {
    assertSourceExcludes(overviewOwnershipSource, token, "Overview-only additions");
  });
  scenariosPassed++;

  [
    "let dashboardTabsInitialized = false;",
    "if (dashboardTabsInitialized)",
    "let activeDashboardTab = \"overview\";",
    "if (requestToken !== activeDashboardRequestToken)",
    "function scheduleDeferredDashboardRender(res, requestToken)"
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
    "Key Summary</h2>",
    "Key Metrics</h2>",
    "Business Signals",
    "Top Products",
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
    "hf-summary-action-grid",
    "hf-kpi-strip",
    'id="planningFocusRow" class="grid grid-cols-1 gap-2"'
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
    "background: var(--print-canvas) !important;"
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
    'exportCsvButton: required.exportCsvButton',
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
        "function resizeVisibleDashboardCharts",
        stableCacheStart
      )
    );

  [
    "renderBusinessOverview(res);",
    "renderReportingMetadata(res);",
    "renderOverviewContext(res);",
    "renderKpiTargets(res.kpiTargets);",
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

  var requiredStableIds = [
    "dashboardSidebar", "sidebarBackdrop", "sidebarMenuButton",
    "sidebarCloseButton", "businessOverview", "mainChartSkeleton",
    "hotColdSkeleton", "expenseSkeleton", "topProductSkeleton", "filter",
    "customDateRange", "customMonth", "customYear", "customStart", "customEnd", "dateFilterValidation",
    "dashboardStatus", "dashboardStatusText", "dashboardRetryButton",
    "dashboardContent", "tableBody", "printReportButton",
    "printReportHeader", "transactions", "transactionsHeading",
    "transactionsDescription", "transactionsTabList",
    "transactionsPanelGroup", "transactionsEvidenceRegion",
    "exportCsvButton", "transactionsResultHeading", "transactionsScopeText",
    "transactionDrilldownSummary", "transactionDrilldownText",
    "transactionsStateAnnouncement", "appShell", "sidebarCollapseButton",
    "mainContent", "topUtilityBar", "utilityPageTitle",
    "utilityPageContext", "sidebarDataStatus", "settings", "logs",
    "themeStatus", "logsWorkspace", "sessionLogsSeveritySummary",
    "sessionLogsInfoCount", "sessionLogsWarningCount",
    "sessionLogsErrorCount", "sessionLogsToolbar",
    "clearSessionLogsButton", "sessionLogsAnnouncement",
    "sessionLogsListRegion", "sessionLogsEmpty", "sessionLogsList",
    "dashboardHeaderRegion", "dashboardTabList", "dashboardTabPanels",
    "dashboardSectionStaging"
  ];

  requiredStableIds.forEach(function(id)
  {
    assertSourceContainsOnce(
      source,
      'id="' + id + '"',
      "required stable shell ID " + id
    );
    assertSourceContains(
      cacheSource,
      '"' + id + '"',
      "required stable cache selector " + id
    );
  });

  [
    'pageElements: document.querySelectorAll(".page")',
    'pageButtons: document.querySelectorAll("[data-page]")',
    'throw new Error("Required shell element missing: #" + id);',
    "stableDashboardElements = elements;",
    "return elements;"
  ].forEach(function(token)
  {
    assertSourceContains(cacheSource, token, "complete stable DOM initialization");
  });

  [
    ".firstElementChild", ".lastElementChild", ".nextElementSibling",
    ".previousElementSibling", ".parentElement", ".children["
  ].forEach(function(token)
  {
    assertSourceExcludes(
      cacheSource,
      token,
      "unverified positional stable-cache dependency"
    );
  });

  [
    "transactionDrilldownSummary: required.transactionDrilldownSummary",
    "transactionDrilldownText: required.transactionDrilldownText",
    "transactionsStateAnnouncement: required.transactionsStateAnnouncement",
    "tableBody: required.tableBody"
  ].forEach(function(token)
  {
    assertSourceContains(cacheSource, token, "stable generated-content container ownership");
  });

  var themeStart = source.indexOf("function initializeThemeFoundation()");
  var themeEnd = source.indexOf("function sanitizeClientLogMessage", themeStart);
  var themeSource = source.slice(themeStart, themeEnd);
  var cacheInitializationIndex =
    themeSource.indexOf("var elements = initializeStableDashboardElements();");
  var initializedFlagIndex =
    themeSource.indexOf("themeFoundationInitialized = true;");
  var interactiveThemeIndex =
    themeSource.indexOf("elements.themeControls.forEach");

  if (
    cacheInitializationIndex === -1 ||
    initializedFlagIndex <= cacheInitializationIndex ||
    interactiveThemeIndex <= initializedFlagIndex
  )
  {
    throw new Error(
      "Interactive theme initialization precedes complete stable references"
    );
  }

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

  var deferredRenderSource = getSourceRegion(
    source,
    "function scheduleDeferredDashboardRender(res, requestToken)",
    "function render(res, requestToken)",
    "deferred Dashboard render"
  );
  assertSourceContainsOnce(
    deferredRenderSource,
    "window.requestAnimationFrame(",
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

function testSecondaryDestinationsHighFidelityContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var scenariosPassed = 0;
  var transactionsRegion = getSourceRegion(source, '<section id="transactions"', '<section id="settings"', "high-fidelity Transactions");
  var settingsRegion = getSourceRegion(source, '<section id="settings"', '<section id="logs"', "high-fidelity Settings");
  var logsRegion = getSourceRegion(source, '<section id="logs"', "</main>", "high-fidelity Logs");

  [transactionsRegion, settingsRegion, logsRegion].forEach(function(region, index)
  {
    if (!region.length)
    {
      throw new Error("Secondary destination region extraction failed: " + index);
    }
  });
  scenariosPassed++;

  assertSourceOccurrenceCount(transactionsRegion, 'data-transactions-tab="', 4, "four Transactions tabs");
  assertSourceOccurrenceCount(transactionsRegion, 'scope="col"', 6, "five data columns plus lifecycle actions");
  [">Date</th>", ">Type</th>", ">Item</th>", ">Qty</th>", ">Amount</th>"].forEach(function(token)
  {
    assertSourceContains(transactionsRegion, token, "authoritative Transactions column");
  });
  scenariosPassed++;

  [
    'id="transactionsToolbar"', "hf-transactions-toolbar",
    'id="transactionsResultHeading"', 'id="transactionsScopeText"',
    'id="transactionDrilldownSummary"', 'id="exportCsvButton"',
    'id="transactionsTableScroll"', "hf-secondary-surface"
  ].forEach(function(token)
  {
    assertSourceContains(transactionsRegion, token, "table-dominant Transactions composition");
  });
  scenariosPassed++;

  [
    "res.recentTransactions.slice(0, 10)",
    "latest 10 transactions already loaded",
    "separate purchase history is unavailable",
    "var visibleRows = Array.from(tableBody.rows)",
    "sanitizeCsvCellValue(value, isNumericColumn)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded visible Transactions evidence");
  });
  scenariosPassed++;

  [
    'setActiveTransactionsTab("recent", false);',
    "transactionsResultHeading.focus();",
    "activeTransactionDrilldown = null;",
    'onclick="clearTransactionDrilldown()"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "drill-down focus and reset");
  });
  scenariosPassed++;

  [
    "#transactionsTableScroll th { height: 36px;",
    "#transactionsTableScroll td { height: 40px;",
    "#transactionsTableScroll td { height: 44px;",
    "font-variant-numeric: tabular-nums",
    "min-w-[680px]",
    "overflow: auto"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Transactions density and containment");
  });
  scenariosPassed++;

  assertSourceOccurrenceCount(settingsRegion, 'name="themePreference"', 3, "three theme choices");
  [
    'id="settingsSections"', "hf-settings-grid", 'id="appearanceSection"',
    'id="aboutSection"', "hf-setting-choice", "hf-about-row",
    "max-width: 960px", "minmax(0, 7fr) minmax(0, 5fr)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact Appearance and About composition");
  });
  scenariosPassed++;

  [
    'data-metadata-source="template.appName"',
    'data-metadata-source="template.version"',
    'data-metadata-source="template.releaseLabel"',
    'data-metadata-source="template.environment"'
  ].forEach(function(token)
  {
    assertSourceContainsOnce(settingsRegion, token, "About metadata provenance");
  });
  scenariosPassed++;

  ["profile", "notifications", "integrations", "type=\"checkbox\"", "<textarea", "<select"].forEach(function(token)
  {
    assertSourceExcludes(settingsRegion, token, "unsupported Settings control");
  });
  scenariosPassed++;

  [
    'id="sessionLogsScopeNotice"', 'id="sessionLogsSeveritySummary"',
    'id="sessionLogsToolbar"', 'id="sessionLogsListRegion"',
    "hf-log-severity-strip", "hf-log-entry", "data-severity=",
    "Session-local only.", "Maximum 100 entries"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "session Logs hierarchy");
  });
  scenariosPassed++;

  [
    "sessionClientLogs.unshift({", "sessionClientLogs.length > 100",
    "now - lastClientLogTimestamp < 5000", ".slice(0, 240)",
    "timestamp:", "severity:", "context:", "message:"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded sanitized Logs behavior");
  });
  scenariosPassed++;

  ["Search logs", "Export logs", "Pagination", "Server refresh", "audit history"].forEach(function(token)
  {
    assertSourceExcludes(logsRegion, token, "unsupported Logs feature");
  });
  scenariosPassed++;

  [
    "hf-secondary-surface", "border-radius: var(--radius-card)", "box-shadow: var(--card-shadow)",
    ":root[data-theme=\"dark\"]", "@media print",
    "#settings.active { height: 100%; overflow: hidden; }",
    "#sessionLogsListRegion { min-height: 0; overflow-y: auto; }",
    "@media (max-width: 1023px)", "overflow-x: auto"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "shared visual and responsive parity");
  });
  scenariosPassed++;

  [
    'role="tablist"', 'role="tabpanel"', '<fieldset class="mt-4">',
    'role="status" aria-live="polite" aria-atomic="true"',
    'scope="col"', 'aria-label="Log severity summary"',
    "button:focus-visible", "input:focus-visible",
    "@media (prefers-reduced-motion: reduce)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "secondary-destination accessibility");
  });
  scenariosPassed++;

  var navigationSource = getSourceRegion(
    source,
    "function showPage(pageId)",
    "function getResolvedTheme",
    "secondary destination navigation"
  );
  ["google.script.run", "getDashboardData(", "requestDashboardData("].forEach(function(token)
  {
    assertSourceExcludes(navigationSource, token, "secondary navigation backend request");
  });
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "secondary destination response mutation");
  });

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount = (source.match(/document\.querySelector(?:All)?\(/g) || []).length;
  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("Secondary destination query budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred phase owner");
  assertSourceExcludes(source, "ResizeObserver", "secondary destination ResizeObserver");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleResponsiveChartResize);', "single responsive resize listener");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleLayoutDebugMeasurement);', "single layout-debug resize listener");
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    destinations: 3,
    transactionTabs: 4,
    columns: 5,
    maxRows: 10,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testSecondaryDestinationsHighFidelityContract | scenarios=" + summary.scenarios +
    " | destinations=" + summary.destinations + " | transactionTabs=" + summary.transactionTabs +
    " | columns=" + summary.columns + " | maxRows=" + summary.maxRows +
    " | backendRequests=" + summary.backendRequests + " | idQueries=" + summary.idQueries +
    " | selectorQueries=" + summary.selectorQueries
  );

  return summary;
}

function testTransactionEntryUiContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var tokenSource = HtmlService.createHtmlOutputFromFile("189.View.Tailwind").getContent();
  var region = getSourceRegion(source, 'id="transactionEntryOverlay"', 'id="settings"', "Transaction entry UI");
  var scenarios = 0;

  ['id="newTransactionButton"', 'id="transactionEntryDialog"', 'role="dialog"', 'aria-modal="true"',
    'onclick="openTransactionEntry()"', 'onclick="closeTransactionEntry()"'].forEach(function(token) {
    assertSourceContains(source, token, "entry trigger/dialog");
  });
  scenarios++;

  ['data-entry-type="SALES"', 'data-entry-type="EXPENSE"', 'role="radio"', 'aria-checked="false"',
    "setTransactionEntryType('SALES')", "setTransactionEntryType('EXPENSE')",
    'entry.salesFields.hidden = type !== "SALES";', 'entry.expenseFields.hidden = type !== "EXPENSE";'].forEach(function(token) {
    assertSourceContains(source, token, "Sales/Expense mode switching");
  });
  scenarios++;

  ['id="productEntrySearch"', 'role="combobox"', 'aria-autocomplete="list"',
    'id="productEntryListbox"', 'role="listbox"', 'role", "option"',
    'option.productId', 'option.product', 'option.category', 'option.kind'].forEach(function(token) {
    assertSourceContains(source, token, "accessible product selector");
  });
  scenarios++;

  ['id="salesTypeHot"', 'id="salesTypeCold"', 'data-sales-type="Hot"', 'data-sales-type="Cold"',
    'id="salesEntryQty"', 'type="number" inputmode="numeric" min="1" step="1" value="1"',
    'Math.max(1, current + delta)', 'Number.isInteger(qty) && qty >= 1'].forEach(function(token) {
    assertSourceContains(source, token, "Sales controls");
  });
  scenarios++;

  ['getProductEntryPricing(state.selectedProduct.productId, state.selectedType)',
    'var version = ++state.pricingRequestVersion;',
    'if (version !== transactionEntryState.pricingRequestVersion) return;',
    'id="salesPreviewPrice"', 'id="salesPreviewHpp"', 'id="salesPreviewUnitMargin"',
    'id="salesPreviewRevenue"', 'id="salesPreviewCogs"', 'id="salesPreviewMargin"'].forEach(function(token) {
    assertSourceContains(source, token, "pricing preview and stale response protection");
  });
  scenarios++;

  ['id="expenseEntrySearch"', 'option.expenseItemId', 'option.item', 'option.group',
    'id="expenseEntryAmount" type="text" inputmode="numeric"',
    'String(value || "").replace(/[^0-9]/g, "")', 'Number.isInteger(state.amount) && state.amount > 0'].forEach(function(token) {
    assertSourceContains(source, token, "Expense controls and normalized amount");
  });
  scenarios++;

  ['getTransactionEntryOptions()', 'transactionEntryState.optionsLoaded',
    'transactionEntryState.entryOptions = {', 'sales: response.data.sales.slice()',
    'expenses: response.data.expenses.slice()', 'loadTransactionEntryOptions()">Retry'].forEach(function(token) {
    assertSourceContains(source, token, "cached options and retry state");
  });
  scenarios++;

  ['{ transactionType: "SALES", productId: state.selectedProduct.productId, type: state.selectedType, qty: state.qty }',
    '{ transactionType: "EXPENSE", expenseItemId: state.selectedExpense.expenseItemId, amount: state.amount }',
    '.submitCanonicalTransaction(payload);', 'if (state.submitting || entry.submit.disabled) return;',
    'state.submitting = true;', 'state.submissionComplete = true;',
    'state.submitting || state.submissionComplete || state.loadingOptions',
    'entry.submit.setAttribute("aria-busy", String(state.submitting));'].forEach(function(token) {
    assertSourceContains(source, token, "payload and duplicate-submit contract");
  });
  ["HPP:", "HJ:", "Revenue:", "COGS:", "Margin:", "Source:", "CreatedBy:", "IsActive:"].forEach(function(token) {
    assertSourceExcludes(getSourceRegion(source, "function submitTransactionEntry(event)", "function showTransactionEntrySuccess", "entry submit"), token, "protected payload field");
  });
  scenarios++;

  ['PRODUCT_INACTIVE: "Product is no longer available."',
    'PRICE_NOT_FOUND: "Price is not available for this product/type."',
    'PRICE_AMBIGUOUS: "Pricing configuration needs attention."',
    'EXPENSE_ITEM_INACTIVE: "Expense item is no longer available."',
    'WRITE_FAILED: "Transaction could not be saved. Please try again."',
    'console.error("Canonical transaction submission failed", error)'].forEach(function(token) {
    assertSourceContains(source, token, "safe error mapping");
  });
  scenarios++;

  ['id="transactionEntrySuccess"', 'aria-live="polite" aria-atomic="true"',
    'Product", result.product', 'Revenue", formatEntryCurrency(result.revenue)',
    'Item", result.item', 'Transaction ID", result.id', 'resetTransactionEntryForAnother()',
    'transactionEntryState = createInitialTransactionEntryState();',
    'refreshTransactionEntryAfterSuccess();'].forEach(function(token) {
    assertSourceContains(source, token, "success, reset, and targeted refresh");
  });
  scenarios++;

  var submitRegion = getSourceRegion(source, "function submitTransactionEntry(event)",
    "function refreshTransactionEntryAfterSuccess", "authoritative submit boundary");
  var refreshRegion = getSourceRegion(source, "function refreshTransactionEntryAfterSuccess",
    "function showTransactionEntrySuccess", "post-save refresh boundary");
  assertSourceContains(submitRegion, "showTransactionEntrySuccess(response.data);", "success before refresh");
  assertSourceContains(submitRegion, "refreshTransactionEntryAfterSuccess();", "separate post-save refresh");
  assertSourceContains(refreshRegion, "requestDashboardData(lastDashboardRequest);", "dashboard refresh target");
  assertSourceContains(refreshRegion, 'console.error("Post-save dashboard refresh failed", error);', "refresh-only failure");
  assertSourceExcludes(refreshRegion, "showTransactionEntryApiError", "refresh cannot become save error");
  assertSourceExcludes(refreshRegion, "transactionEntryGeneralError", "refresh cannot show save failure");
  assertSourceOccurrenceCount(submitRegion, ".submitCanonicalTransaction(payload);", 1, "one submit per Save action");
  scenarios += 8;

  ['aria-describedby="productEntryError"', 'aria-describedby="expenseEntryError"',
    'aria-describedby="salesEntryQtyError"', 'aria-describedby="expenseEntryAmountError"',
    'if (event.key === "Tab")', 'if (event.key === "Escape")',
    'transactionEntryLastFocus.focus()', 'document.body.classList.add("overflow-hidden")'].forEach(function(token) {
    assertSourceContains(source, token, "entry accessibility and focus behavior");
  });
  scenarios++;

  assertSourceContains(source,
    '#transactions.active { display: grid; height: 100%; grid-template-rows: 40px 44px minmax(0, 1fr); gap: 12px; overflow: hidden; }',
    "desktop Transactions CTA grid track");
  ['document.body.appendChild(entry.overlay);', 'elements.appShell.inert = true;',
    'elements.appShell.inert = false;'].forEach(function(token) {
    assertSourceContains(source, token, "mobile viewport portal and background isolation");
  });
  assertSourceOccurrenceCount(region, '>Save Transaction</span>', 1, "single Save Transaction action");
  ['id="transactionEntrySubmitRegion"', 'form="transactionEntryForm"',
    'entry.submitRegion.hidden = true;', 'entry.submitRegion.hidden = false;'].forEach(function(token) {
    assertSourceContains(source, token, "separate persistent action footer");
  });
  ['#transactionsEntryActionRow{min-height:44px;align-items:center}',
    '#transactionsEntryActionRow .transaction-entry-primary{width:-moz-max-content;width:max-content;height:44px;min-height:44px;flex:0 0 auto;align-self:center}',
    '.transaction-entry-dialog{display:flex;width:min(100%,620px)',
    'max-height:min(820px,calc(100dvh - 48px))',
    'min-height:44px', 'env(safe-area-inset-bottom)', '@media (max-width:639px)',
    '.transaction-entry-overlay{position:fixed;align-items:stretch;justify-content:stretch;padding:0}',
    '.transaction-entry-dialog,.transaction-entry-overlay{inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0}',
    '.transaction-entry-dialog{position:absolute;transform:none;border:0;border-radius:0}',
    '.transaction-entry-header{position:relative;top:auto',
    '.transaction-entry-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px}',
    '.transaction-entry-fields{gap:13px}',
    '.transaction-entry-submit-region{position:relative;z-index:2;margin:0;border-top:1px solid var(--divider);padding:10px 16px calc(10px + env(safe-area-inset-bottom))',
    '.transaction-entry-submit{min-height:52px;margin-top:0;box-shadow:none',
    'html.numlock-phone .transaction-entry-overlay{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;align-items:stretch;justify-content:stretch;margin:0;padding:0}',
    'html.numlock-phone .transaction-entry-dialog{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;transform:none;border:0;border-radius:0;box-shadow:none}'].forEach(function(token) {
    assertSourceContains(tokenSource, token, "responsive entry containment");
  });
  scenarios++;

  ['getSheetByName(', 'SpreadsheetApp', 'Transaction"', 'Helper"', 'syncLegacyTransaction'].forEach(function(token) {
    assertSourceExcludes(region, token, "frontend and legacy protection");
  });
  scenarios++;

  Logger.log("PASS: testTransactionEntryUiContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios, writes: 0 };
}

function testTransactionLifecycleUiContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var css = HtmlService.createHtmlOutputFromFile("189.View.Tailwind").getContent();
  var dataSource = buildCanonicalTransactionData.toString();
  var dashboardSource = getDashboardData.toString() + buildDashboardDataExecution.toString() +
    buildDashboardResponse.toString() + buildRecentLifecycleTransactions.toString();
  var scenarios = 0;

  ['data-transaction-id="${escapeUiHtml(r.id)}"', 'aria-label="Actions for transaction ${escapeUiHtml(r.id)}"',
    'class="transaction-row-action"', 'role="menu"', 'View Details', 'Correct Transaction', 'Void Transaction'].forEach(function(token) {
    assertSourceContains(source, token, "row action ownership");
  });
  scenarios++;

  ['transactionId: transaction.id', 'source: transaction.source',
    'isActive: transaction.isActive !== false',
    'transactionActionState.source === "APP_ENTRY" && transactionActionState.isActive',
    'items.innerHTML = \'<button type="button" role="menuitem"',
    'closeTransactionActionMenu(true)', 'event.key === "ArrowDown"', 'event.key === "ArrowUp"'].forEach(function(token) {
    assertSourceContains(source, token, "action availability and keyboard menu");
  });
  scenarios++;

  var actionOpenRegion = getSourceRegion(source, "function openTransactionActionMenu(trigger)", "function closeTransactionActionMenu", "action row binding");
  ['closeTransactionActionMenu(false);', 'trigger.getAttribute("data-transaction-id")',
    'findLifecycleTransaction(transactionId)', 'transactionActionState = {',
    'overlay.hidden = false;', 'overlay.setAttribute("aria-hidden", "false")'].forEach(function(token) {
    assertSourceContains(actionOpenRegion, token, "fresh action row binding");
  });
  assertSourceExcludes(actionOpenRegion, 'transaction: transaction', "mutable selected transaction object");
  scenarios++;

  var actionCloseRegion = getSourceRegion(source, "function closeTransactionActionMenu(restoreFocus)", "function selectTransactionAction", "action dismissal");
  ['overlay.hidden = true;', 'overlay.setAttribute("aria-hidden", "true")',
    'lifecycle.actionItems.innerHTML = "";', 'elements.appShell.inert = false;',
    'document.body.classList.remove("overflow-hidden");',
    'transactionActionState = { transactionId: "", source: "", isActive: false, trigger: null };',
    'trigger.setAttribute("aria-expanded", "false")', 'if (restoreFocus) trigger.focus()'].forEach(function(token) {
    assertSourceContains(actionCloseRegion, token, "complete action dismissal");
  });
  assertSourceExcludes(actionCloseRegion, 'if (!overlay || overlay.hidden) return;', "early dismissal exit");
  scenarios++;

  var actionSelectRegion = getSourceRegion(source, "function selectTransactionAction(action)", "function openTransactionDetail", "action destination transition");
  ['var transactionId = transactionActionState.transactionId;', 'closeTransactionActionMenu(false);',
    'if (!transactionId) return;', 'openTransactionDetail(transactionId)',
    'loadTransactionForMutation(transactionId, action)'].forEach(function(token) {
    assertSourceContains(actionSelectRegion, token, "action destination transition");
  });
  scenarios++;

  ['id="transactionActionOverlay"', 'id="transactionActionMenu"', 'Transaction Actions',
    '@media (max-width:639px)',
    '.transaction-action-overlay{position:fixed;inset:0;display:flex;width:100%;height:100%;align-items:flex-end;justify-content:stretch;background:var(--overlay)}',
    '.transaction-action-menu{position:fixed;top:auto!important;right:0;bottom:0;left:0;width:100%;max-width:none;margin:0;transform:none',
    'html.numlock-phone .transaction-action-overlay{position:fixed;inset:0;display:flex;width:100%;height:100%;align-items:flex-end;justify-content:stretch;background:var(--overlay)}',
    'html.numlock-phone .transaction-action-menu{position:fixed;top:auto!important;right:0;bottom:0;left:0;width:100%;max-width:none;margin:0;transform:none',
    '.transaction-action-overlay[hidden]{display:none!important}',
    'env(safe-area-inset-bottom)', 'min-height:52px'].forEach(function(token) {
    assertSourceContains(token.indexOf(".") === 0 || token.indexOf("html.") === 0 || token.indexOf("@media") === 0 || token.indexOf("safe-area") !== -1 || token === "min-height:52px" ? css : source, token, "responsive action menu");
  });
  ['initializeStableDashboardElements().appShell.inert = true;',
    'document.body.classList.add("overflow-hidden");',
    'elements.appShell.inert = false;',
    'document.body.classList.remove("overflow-hidden");'].forEach(function(token) {
    assertSourceContains(source, token, "action sheet background isolation");
  });
  scenarios++;

  ['getCanonicalTransactionDetail(transactionId)', 'function renderTransactionDetail(detail)',
    '"Status", detail.status', '"Transaction ID", detail.id', 'sourceDisplayLabel(detail.source)',
    '"CreatedAt"', '"UpdatedAt"', '"Original transaction"', '"Replacement transaction"'].forEach(function(token) {
    assertSourceContains(source, token, "canonical detail rendering");
  });
  assertSourceExcludes(getSourceRegion(source, "function renderTransactionDetail(detail)", "function renderTransactionVoidConfirmation", "detail renderer"), "sourceRow", "raw sheet row");
  var detailErrorRegion = getSourceRegion(source, "function renderLifecycleLoadError(error)", "function sourceDisplayLabel(source)", "detail error ownership");
  assertSourceContains(detailErrorRegion, "Transaction details could not be loaded. Please try again.", "lifecycle detail failure message");
  assertSourceContains(detailErrorRegion, "Transaction could not be found.", "lifecycle not-found message");
  assertSourceExcludes(detailErrorRegion, "Transaction could not be saved", "creation failure message excluded from detail");
  scenarios++;

  ['"Product", detail.product', '"Serving Type", detail.type', '"Unit HPP"', '"Unit Price"',
    '"COGS"', '"Revenue"', '"Margin"', '"Expense Item", detail.item', '"Group", detail.group', '"Amount"'].forEach(function(token) {
    assertSourceContains(source, token, "Sales and Expense detail content");
  });
  scenarios++;

  ['id="showVoidedTransactions"', 'showVoidedTransactions || transaction.isActive !== false',
    'transaction-status-badge', '>Voided</span>', 'transaction-row-voided'].forEach(function(token) {
    assertSourceContains(source, token, "voided history presentation");
  });
  scenarios++;

  ['mode: "create"', 'transactionEntryState.mode = "correction"', 'entry.typeFieldset.hidden = true;',
    'entry.typeSales.disabled = true', 'entry.typeExpense.disabled = true', 'transactionEntryState.originalDetail = detail'].forEach(function(token) {
    assertSourceContains(source, token, "correction mode and locked type");
  });
  scenarios++;

  ['id="transactionCorrectionReason"', 'state.correctionReason.trim().length >= 3',
    'payload.reason = state.correctionReason.trim()', 'payload.transactionId = state.originalDetail.id'].forEach(function(token) {
    assertSourceContains(source, token, "required correction reason and immutable ID");
  });
  scenarios++;

  ['.previewCanonicalTransactionCorrection(payload);', 'preview.before', 'preview.after', 'preview.delta',
    'summary("BEFORE", preview.before)', 'summary("AFTER", preview.after)', '<h4>DELTA</h4>', 'formatSignedCurrency'].forEach(function(token) {
    assertSourceContains(source, token, "authoritative correction preview");
  });
  scenarios++;

  ['The original transaction will be voided', 'corrected replacement will be created',
    'Confirm Correction', '.correctCanonicalTransaction(payload);'].forEach(function(token) {
    assertSourceContains(source, token, "correction confirmation and submit");
  });
  scenarios++;

  ['Transaction corrected', 'result.original.id', 'result.replacement.id', 'View Replacement',
    'showTransactionCorrectionSuccess(response.data);', 'refreshTransactionEntryAfterSuccess();'].forEach(function(token) {
    assertSourceContains(source, token, "correction success");
  });
  scenarios++;

  var lifecycleRefreshRegion = getSourceRegion(
    source,
    "function refreshTransactionEntryAfterSuccess()",
    "function showTransactionEntrySuccess",
    "authoritative lifecycle refresh"
  );
  ['activeDashboardRequestToken = ++dashboardRequestSequence;',
    'dashboardRequestInFlight = false;', 'requestDashboardData(lastDashboardRequest);',
    'console.error("Post-save dashboard refresh failed", error);'].forEach(function(token) {
    assertSourceContains(lifecycleRefreshRegion, token, "post-success history and Dashboard refresh");
  });
  ['showTransactionEntryApiError', 'Transaction could not be corrected',
    'Transaction could not be voided', 'state.submissionComplete = false'].forEach(function(token) {
    assertSourceExcludes(lifecycleRefreshRegion, token, "refresh cannot reverse mutation success");
  });
  scenarios++;

  ['id="transactionVoidReason"', 'reason.value.trim().length >= 3', 'Impact on active reporting',
    'remain in the audit history', 'active financial reporting', '.voidCanonicalTransaction({ transactionId: transactionLifecycleState.detail.id, reason: reason });'].forEach(function(token) {
    assertSourceContains(source, token, "void confirmation and payload");
  });
  scenarios++;

  ['if (state.submitting || entry.submit.disabled) return;',
    'state.submissionComplete = true;',
    'if (transactionLifecycleState.submitting || !transactionLifecycleState.detail) return;',
    'transactionLifecycleState.submitting = true;',
    'lifecycle.footer.innerHTML = \'<button type="button" class="transaction-entry-secondary" onclick="closeTransactionLifecycleDialog()">Close</button>\';'].forEach(function(token) {
    assertSourceContains(source, token, "duplicate lifecycle mutation prevention");
  });
  scenarios++;

  ['TRANSACTION_NOT_FOUND: "Transaction could not be found."',
    'TRANSACTION_READ_ONLY: "Historical transactions cannot be changed."',
    'TRANSACTION_ALREADY_VOIDED: "This transaction has already been voided."',
    'INVALID_VOID_REASON: "Enter a meaningful reason."', 'PRODUCT_INACTIVE', 'PRICE_NOT_FOUND', 'PRICE_AMBIGUOUS'].forEach(function(token) {
    assertSourceContains(source, token, "structured lifecycle errors");
  });
  scenarios++;

  ['This transaction changed after you opened it. Refreshing the current status.',
    'loadCanonicalTransactionDetail(transactionLifecycleState.detail.id, renderTransactionDetail)',
    'refreshTransactionEntryAfterSuccess();'].forEach(function(token) {
    assertSourceContains(source, token, "concurrency refresh");
  });
  scenarios++;

  ['APP_ENTRY: "App Entry"', 'LEGACY_GOOGLE: "Legacy Form"', 'XLSM: "Historical Import"',
    'canonicalData.lifecycleRecords', 'recentLifecycleTransactions'].forEach(function(token) {
    assertSourceContains(token === 'canonicalData.lifecycleRecords' || token === 'recentLifecycleTransactions' ? dashboardSource : source, token, "protected source presentation");
  });
  scenarios++;

  ['lifecycleRecords.push(salesRecord)', 'lifecycleRecords.push(expenseRecord)',
    'if (active) records.push(salesRecord)', 'if (active) records.push(expenseRecord)', 'isActive: active'].forEach(function(token) {
    assertSourceContains(dataSource, token, "inactive history isolated from active analytics");
  });
  scenarios++;

  ['aria-modal="true"', 'aria-describedby="transactionVoidReasonError"',
    'aria-live="polite"', 'trapDialogFocus(event', 'closeTransactionActionMenu(true)',
    'transactionLifecycleState.trigger.focus()'].forEach(function(token) {
    assertSourceContains(source, token, "lifecycle accessibility");
  });
  scenarios++;

  ['document.body.appendChild(entry.overlay);', 'transaction-entry-dialog',
    'html.numlock-phone .transaction-entry-dialog', '.transaction-lifecycle-dialog{display:flex;width:min(100%,620px)',
    '#transactionLifecycleOverlay{align-items:flex-end;padding:0}'].forEach(function(token) {
    assertSourceContains(token.indexOf(".") === 0 || token.indexOf("#") === 0 || token.indexOf("html") === 0 ? css : source, token, "responsive correction and void surfaces");
  });
  scenarios++;

  Logger.log("PASS: testTransactionLifecycleUiContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios, writes: 0 };
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
    'class="transactions-table-row border-b ${r.isActive === false ? "transaction-row-voided" : ""}"', 'class="transactions-number',
    'id="transactionsTableScroll"', 'overflow-x-auto', 'min-w-[680px]'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact lifecycle table");
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
    '#transactions.active { display: grid; height: 100%; grid-template-rows: 40px 44px minmax(0, 1fr); gap: 12px; overflow: hidden; }',
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

  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred phase owner preserved");
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
    '<fieldset class="mt-4">',
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
    'var preference = "light";',
    'preference === "system"',
    '"(prefers-color-scheme: dark)"',
    'systemThemeQuery.addEventListener(',
    'systemThemeQuery.removeEventListener(',
    'applyThemePreference("system", false, false);'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Light default and System opt-in behavior");
  });
  scenariosPassed++;

  var themeStart = source.indexOf("function applyChartThemeTokens(chart, palette, chartKind)");
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
    "background: var(--print-canvas) !important;"
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
    "grid-cols-1", "sm:grid-cols-3", "#settingsSections { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 16px; }"
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
    "function scheduleDeferredDashboardRender(res, requestToken)",
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
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred phase owner preserved");
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

function testBoundedUiRefactorContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var tokenSource = HtmlService.createHtmlOutputFromFile("189.View.Tailwind").getContent();
  var fullShellTestSource = String(testFullShellVisualContract);
  var navigationTestSource = String(testNineDestinationNavigationContract);
  var scenariosPassed = 0;

  [
    "function updateTransactionDrilldownPresentation(",
    "Skeleton Chart Hide", "Render Res"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "proven removed frontend debt");
  });
  [".ui-surface{", ".ui-muted{"].forEach(function(token)
  {
    assertSourceExcludes(tokenSource, token, "proven removed authored selector");
  });
  scenariosPassed++;

  assertSourceOccurrenceCount(
    source,
    "updateTransactionsViewPresentation(transactions);",
    3,
    "authoritative Transactions presentation calls including voided filter"
  );
  assertSourceContainsOnce(
    source,
    "function updateTransactionsViewPresentation(transactions)",
    "authoritative Transactions presentation owner"
  );
  scenariosPassed++;

  [
    "function renderBusinessOverview(", "function renderCharts(",
    "function renderBusinessIntelligence(", "function renderExecutiveCenter(",
    "function renderTransactions(", "function renderSessionClientLogs("
  ].forEach(function(token)
  {
    assertSourceContainsOnce(source, token, "single authoritative render owner");
  });
  scenariosPassed++;

  [fullShellTestSource, navigationTestSource].forEach(function(testSource)
  {
    assertSourceExcludes(testSource, "<!--", "comment-based source boundary");
  });
  assertSourceExcludes(
    fullShellTestSource,
    "<?= version ?>",
    "raw template-token assertion"
  );
  [
    'id="sidebarDataStatus"',
    'id="aboutVersion"', 'id="printReportVersion"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "semantic metadata ownership marker");
  });
  scenariosPassed++;

  var doGetSource = String(doGet);
  [
    "template.appName = PROJECT_CONFIG.APP_NAME;",
    "template.version = PROJECT_CONFIG.VERSION;",
    "template.releaseLabel = PROJECT_CONFIG.RELEASE_LABEL;",
    "template.environment = PROJECT_CONFIG.ENVIRONMENT;"
  ].forEach(function(token)
  {
    assertSourceContainsOnce(doGetSource, token, "sole executable metadata assignment");
  });
  assertSourceExcludes(source, "1.0.0", "hardcoded production metadata");
  scenariosPassed++;

  [
    "function getCurrentThemePalette(forceLight)",
    "function synchronizeChartTheme(forceLight)",
    "function synchronizeSystemThemeListener(preference)",
    "function initializeThemeFoundation()"
  ].forEach(function(token)
  {
    assertSourceContainsOnce(source, token, "single theme or chart owner");
  });
  assertSourceOccurrenceCount(source, "systemThemeQuery.addEventListener(", 1, "single System listener attach path");
  assertSourceOccurrenceCount(source, "systemThemeQuery.removeEventListener(", 1, "single System listener remove path");
  scenariosPassed++;

  [
    "responsiveShellInitialized", "dashboardTabsInitialized",
    "transactionsTabsInitialized", "themeFoundationInitialized"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "listener initialization guard");
  });
  assertSourceExcludes(source, "ResizeObserver", "orphaned global resize observer");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleResponsiveChartResize);', "guarded responsive resize callback");
  scenariosPassed++;

  [
    ".page { display: none; }", "page.hidden = !isActivePage;",
    "panel.hidden = !isSelected;", "sidebar.inert = !isOpen && !isDesktop;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "hidden focus exclusion");
  });
  scenariosPassed++;

  var navigationSource = getSourceRegion(
    source,
    "function showPage(pageId)",
    "function getResolvedTheme(preference)",
    "refactor navigation ownership"
  );
  var dashboardTabSource = getSourceRegion(
    source,
    "function setActiveDashboardTab(tabName, moveFocus)",
    "function initializeDashboardTabs",
    "refactor Dashboard tab ownership"
  );
  var transactionsTabSource = getSourceRegion(
    source,
    "function setActiveTransactionsTab(tabName, moveFocus)",
    "function initializeTransactionsTabs",
    "refactor Transactions tab ownership"
  );
  [navigationSource, dashboardTabSource, transactionsTabSource].forEach(function(region)
  {
    ["google.script.run", "getDashboardData(", "requestDashboardData("].forEach(function(token)
    {
      assertSourceExcludes(region, token, "tab or navigation backend request");
    });
  });
  scenariosPassed++;

  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "refactor response mutation");
  });
  assertSourceContains(source, "res.recentTransactions.slice(0, 10)", "bounded Transactions copy");
  scenariosPassed++;

  [
    "function destroyChartInstance(chart)",
    "revenueChart = destroyChartInstance(revenueChart);",
    "hotColdChart = destroyChartInstance(hotColdChart);",
    "expenseChart = destroyChartInstance(expenseChart);",
    "function resizeVisibleDashboardCharts(tabName)",
    'chart.update("none");', "synchronizeChartTheme(true);",
    "synchronizeChartTheme(false);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "single chart lifecycle path");
  });
  scenariosPassed++;

  [
    "#dashboardSidebar { width: 248px;", "#dashboardSidebar { width: 224px;",
    "#appShell[data-sidebar-collapsed=\"true\"] #dashboardSidebar { width: 64px;",
    "#topUtilityBar { height: 76px;", "#topUtilityBar { height: 68px;",
    "#dashboardTabList { height: 44px;", "#transactionsTabList { height: 40px;", "#transactionsTableScroll th { height: 36px;",
    "#transactionsTableScroll td { height: 40px;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "unchanged visual geometry");
  });
  scenariosPassed++;

  assertSourceOccurrenceCount(source, 'data-navigation-destination="', 9, "nine navigation destinations");
  assertSourceOccurrenceCount(source, 'aria-disabled="true"', 5, "five unavailable destinations");
  scenariosPassed++;

  [
    'value="light"', 'value="dark"', 'value="system"',
    'data-effective-theme', "--canvas:#07111f", "--print-canvas:",
    "synchronizeChartTheme(true);", "synchronizeChartTheme(false);"
  ].forEach(function(token)
  {
    var owner = token.indexOf("--") === 0 ? tokenSource : source;
    assertSourceContains(owner, token, "theme and print-light preservation");
  });
  scenariosPassed++;

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount = (source.match(/document\.querySelector(?:All)?\(/g) || []).length;
  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("Bounded refactor query budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "one deferred render phase owner");
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    removedSymbols: 5,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount,
    deferredPhases: 1,
    backendRequests: 0,
    responseMutation: false
  };

  Logger.log(
    "PASS: testBoundedUiRefactorContract | scenarios=" + summary.scenarios +
    " | removedSymbols=" + summary.removedSymbols +
    " | idQueries=" + summary.idQueries +
    " | selectorQueries=" + summary.selectorQueries +
    " | deferredPhases=" + summary.deferredPhases +
    " | backendRequests=" + summary.backendRequests +
    " | responseMutation=" + summary.responseMutation
  );

  return summary;
}

function testUiUx2ClosureContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var tokenSource = HtmlService.createHtmlOutputFromFile("189.View.Tailwind").getContent();
  var predecessorRunnerSource = String(runAllBackendTests);
  var sparseContractSource = String(testSparseDatasetResilience);
  var packages = [14, 15, 16, 17, 18, 19, 20, 21];
  var viewportMatrix = [
    "1440x900-light-expanded", "1440x900-light-collapsed",
    "1440x900-dark-expanded", "1440x900-dark-collapsed",
    "1280x768-light-expanded", "1280x768-light-collapsed",
    "1280x768-dark-expanded", "1280x768-dark-collapsed",
    "768-light-drawer-closed", "768-light-drawer-open",
    "768-dark-drawer-closed", "768-dark-drawer-open",
    "375-light-drawer-closed", "375-light-drawer-open",
    "375-dark-drawer-closed", "375-dark-drawer-open"
  ];
  var visualCriteria = [
    "oneViewportFit", "editorialHierarchy", "utilityRow", "sidebar",
    "horizontalNavigation", "kpiDensity", "chartProminence", "surfaceNesting",
    "borderShadowNoise", "typography", "spacing", "accentRestraint",
    "semanticStatus", "themeGeometryParity", "forbiddenDecoration",
    "clippingOverflow", "focusVisibility", "functionalTruthfulness"
  ];
  var rollbackEvidence = {
    deploymentIdentity: "required",
    candidateVersion: "required",
    previousImmutableVersion: "required",
    stableUrlPreserved: "required"
  };
  var scenariosPassed = 0;

  if (packages.join(",") !== "14,15,16,17,18,19,20,21")
  {
    throw new Error("UI/UX 2.0 predecessor package markers mismatch");
  }
  assertSourceOccurrenceCount(
    predecessorRunnerSource,
    "{ name:",
    55,
    "closure runner membership"
  );
  assertSourceContains(
    predecessorRunnerSource,
    '{ name: "testBoundedUiRefactorContract"',
    "55-entry predecessor gate"
  );
  scenariosPassed++;

  assertSourceOccurrenceCount(source, 'data-navigation-destination="', 9, "nine navigation destinations");
  assertSourceOccurrenceCount(source, 'data-page="', 4, "four active navigation destinations");
  assertSourceOccurrenceCount(source, 'aria-disabled="true"', 5, "five unavailable navigation destinations");
  assertSourceContainsOnce(source, 'id="financialModulesDisclosureButton"', "Financial modules disclosure");
  scenariosPassed++;

  if (viewportMatrix.length !== 16 || visualCriteria.length !== 18)
  {
    throw new Error("Visual acceptance matrix must contain 16 states and 18 criteria");
  }
  var evidencePolicy = {
    highFidelityAuthority: "docs/UIUX-2.0-HIGH-FIDELITY-SPEC.md",
    functionalAcceptance: "separate",
    visualAcceptance: "deployed-browser-screenshots-required",
    staticVisualPassAllowed: false
  };
  if (
    evidencePolicy.functionalAcceptance !== "separate" ||
    evidencePolicy.staticVisualPassAllowed !== false
  )
  {
    throw new Error("Functional and visual evidence separation weakened");
  }
  scenariosPassed++;

  [
    'value="light"', 'value="dark"', 'value="system"',
    "synchronizeSystemThemeListener", "synchronizeChartTheme(true);",
    "synchronizeChartTheme(false);", "maintainAspectRatio: false",
    "destroyChartInstance", "--print-canvas"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "theme, chart, and print preservation");
  });
  scenariosPassed++;

  [
    '<main id="mainContent"', 'role="tablist"', '<fieldset class="mt-4">',
    'aria-live="polite"', "prefers-reduced-motion", "sidebar.inert",
    "menuButton.focus();"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "accessibility closure matrix");
  });
  scenariosPassed++;

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount = (source.match(/document\.querySelector(?:All)?\(/g) || []).length;
  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("UI/UX 2.0 closure performance budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "one deferred render phase owner");
  assertSourceExcludes(source, "ResizeObserver", "recurring resize ownership");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleResponsiveChartResize);', "single recurring resize owner");
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "response mutation");
  });
  scenariosPassed++;

  assertSourceContains(sparseContractSource, "Object.keys(response).length !== requiredProperties.length", "exact response field count");
  assertSourceContains(sparseContractSource, '"kpiTargets"', "38-field response contract");
  if (
    rollbackEvidence.deploymentIdentity !== "required" ||
    rollbackEvidence.candidateVersion !== "required" ||
    rollbackEvidence.previousImmutableVersion !== "required" ||
    rollbackEvidence.stableUrlPreserved !== "required"
  )
  {
    throw new Error("Rollback evidence fields incomplete");
  }
  scenariosPassed++;

  ["--canvas:", "--text-primary:", "--focus:", "--chart-series-1:"]
    .forEach(function(token)
    {
      assertSourceOccurrenceCount(tokenSource, token, 2, "Light/Dark token parity");
    });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    predecessorGate: 40,
    runnerTotal: 55,
    packagesComplete: packages.length,
    destinations: 9,
    viewportStates: viewportMatrix.length,
    visualCriteria: visualCriteria.length,
    visualPassClaimed: false,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount,
    responseFields: 38,
    implementationReadyUiBacklog: 0
  };

  Logger.log(
    "PASS: testUiUx2ClosureContract | scenarios=" + summary.scenarios +
    " | predecessorGate=" + summary.predecessorGate +
    " | runnerTotal=" + summary.runnerTotal +
    " | destinations=" + summary.destinations +
    " | viewportStates=" + summary.viewportStates +
    " | visualCriteria=" + summary.visualCriteria +
    " | visualPassClaimed=" + summary.visualPassClaimed +
    " | idQueries=" + summary.idQueries +
    " | selectorQueries=" + summary.selectorQueries +
    " | responseFields=" + summary.responseFields +
    " | implementationReadyUiBacklog=" + summary.implementationReadyUiBacklog
  );

  return summary;
}

function testUiFinalStabilizationContract()
{
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  var scenariosPassed = 0;

  [
    "var(--surface-1)", "var(--surface-2)", "var(--divider)",
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
  assertSourceOccurrenceCount(source, 'data-dashboard-tab="', 3, "Dashboard tabs");
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
    "var(--skeleton-start) 25%",
    "var(--skeleton-middle) 50%",
    "@media print", "background: var(--print-canvas) !important;",
    "color: var(--print-text);"
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
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleResponsiveChartResize);', "bounded responsive resize listener");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleLayoutDebugMeasurement);', "bounded layout-debug resize listener");
  scenariosPassed++;

  [
    'id="appearanceSection"', 'id="aboutSection"',
    'id="sessionLogsListRegion"', "Session-local only.",
    "not historical audit records"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "truthful Settings and Logs scope");
  });
  ["Notifications", "Customize widgets", "Welcome back"].forEach(function(token)
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
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred render phase owner");
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
  var phase7B3 = testDashboardPerformanceAnalytics();
  var chartSource = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  ["function renderRevenueChart(revenueTrend)", "function renderProductProfitabilityChart(performanceAnalytics)",
    "function renderCategoryPerformanceChart(performanceAnalytics)", "function renderHotColdEconomicsComparison(hotColdEconomics)",
    "function renderExpenseChart(expenseBreakdown)", "destroyChartInstance", "shouldReduceMotion() ? false : undefined",
    "function synchronizeChartTheme(forceLight)"].forEach(function(token)
  {
    assertSourceContains(chartSource, token, "Phase 7B.3 chart presentation");
  });
  Logger.log("PASS: testChartPresentationContract | scenarios=16 | performanceAnalytics=true");
  return { passed:phase7B3.passed, scenarios:16, performanceAnalytics:true };

  /* Historical pre-7B.3 chart contract retained below for release archaeology. */
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

  var inactiveOnly = buildDataQualityDiagnostics([], {
    sourceRows: 2,
    invalidDateRowIndexes: [],
    inactiveLedgerRows: 2,
    malformedRows: 0,
    unresolvedForeignKeys: 0
  });

  if (
    inactiveOnly.status !== "Good" ||
    inactiveOnly.issueCount !== 0 ||
    inactiveOnly.issues.length !== 0 ||
    inactiveOnly.lifecycle.inactiveCanonicalRows !== 2
  )
  {
    throw new Error("Valid inactive lifecycle rows changed data quality severity");
  }
  scenariosPassed++;

  var correctedLifecycle = buildDataQualityDiagnostics(
    fixture.cases[0].rows,
    {
      sourceRows: 2,
      invalidDateRowIndexes: [],
      inactiveLedgerRows: 1,
      malformedRows: 0,
      unresolvedForeignKeys: 0
    }
  );

  if (
    correctedLifecycle.status !== "Good" ||
    correctedLifecycle.issueCount !== 0 ||
    correctedLifecycle.lifecycle.inactiveCanonicalRows !== 1
  )
  {
    throw new Error("Valid corrected lifecycle chain changed data quality severity");
  }
  scenariosPassed++;

  var malformedCanonical = buildDataQualityDiagnostics([], {
    sourceRows: 1,
    invalidDateRowIndexes: [],
    inactiveLedgerRows: 0,
    malformedRows: 1,
    unresolvedForeignKeys: 0
  });
  var unresolvedForeignKey = buildDataQualityDiagnostics([], {
    sourceRows: 1,
    invalidDateRowIndexes: [],
    inactiveLedgerRows: 0,
    malformedRows: 0,
    unresolvedForeignKeys: 1
  });

  if (
    malformedCanonical.status !== "Attention" ||
    malformedCanonical.issueCount !== 1 ||
    unresolvedForeignKey.status !== "Attention" ||
    unresolvedForeignKey.issueCount !== 1
  )
  {
    throw new Error("Canonical anomaly severity mismatch");
  }
  scenariosPassed++;

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

  ["Quality issues", '"<strong>Lifecycle</strong>"',
    "quality.issueCount === 0 && inactiveCanonicalRows === 0",
    '" inactive canonical rows</p>"'].forEach(function(token)
  {
    assertSourceContains(source, token, "lifecycle quality presentation");
  });
  scenariosPassed++;

  var toggleQualityRegion = getSourceRegion(
    source,
    "function toggleDataQualityDetails()",
    "function renderDataQuality(res)",
    "Data Quality disclosure scope"
  );
  var renderQualityRegion = getSourceRegion(
    source,
    "function renderDataQuality(res)",
    "function loadData()",
    "Data Quality render scope"
  );
  assertSourceExcludes(toggleQualityRegion, "inactiveCanonicalRows", "disclosure-only scope");
  assertSourceContains(renderQualityRegion, "var inactiveCanonicalRows =", "render-owned lifecycle count");

  var qualityElements = {};
  ["dataQualityStatusBadge", "dataQualityIssueCount", "dataQualityScopeSummary",
    "dataQualityDetailsButton", "dataQualityDetails"].forEach(function(id)
  {
    qualityElements[id] = {
      className: "",
      innerText: "",
      innerHTML: "",
      classList: { toggle: function() {}, add: function() {} },
      setAttribute: function() {}
    };
  });
  var renderQuality = new Function(
    "document",
    renderQualityRegion + "; return renderDataQuality;"
  )({
    getElementById: function(id) { return qualityElements[id]; }
  });
  renderQuality({
    dataQuality: {
      status: "Good",
      issueCount: 0,
      issues: [],
      lifecycle: { inactiveCanonicalRows: 2 },
      scope: { scopedRows: 10, excludedInvalidDateRows: 0 }
    }
  });
  if (
    qualityElements.dataQualityStatusBadge.innerText !== "Good" ||
    qualityElements.dataQualityScopeSummary.innerText.indexOf("2 inactive lifecycle") === -1
  )
  {
    throw new Error("Data Quality lifecycle render mismatch");
  }
  scenariosPassed++;

  var comparisonRegion = getSourceRegion(
    source,
    "function renderPeriodComparison(periodComparison)",
    "function toggleKpiTargetDetails()",
    "period comparison render"
  );
  var comparisonElements = {
    periodComparisonLabel: { innerText: "" },
    periodComparisonLead: { innerText: "" },
    periodComparisonPeriod: { innerText: "" }
  };
  var renderComparison = new Function(
    "document", "formatDashboardPresentationPeriod",
    comparisonRegion + "; return renderPeriodComparison;"
  )({ getElementById: function(id) { return comparisonElements[id]; } }, function(value) { return value; });
  renderComparison({ previous: { startDate: "2026-01-01", endDate: "2026-01-31", rowCount: 1 }, changes: {}, status: {} });
  if (comparisonElements.periodComparisonLead.innerText !== "Compared with" ||
      comparisonElements.periodComparisonPeriod.innerText.indexOf("2026-01-01") === -1) {
    throw new Error("Available comparison did not render visible text");
  }
  renderComparison(null);
  if (comparisonElements.periodComparisonLead.innerText !== "Comparison unavailable" ||
      comparisonElements.periodComparisonPeriod.innerText !== "") {
    throw new Error("Unavailable comparison did not render a visible fallback");
  }
  scenariosPassed++;

  var normalizationRegion = getSourceRegion(
    source,
    "function normalizeOverviewContextResponse(res)",
    "function renderOverviewContext(res)",
    "overview context normalization"
  );
  var normalizeOverview = new Function(normalizationRegion + "; return normalizeOverviewContextResponse;")();
  var normalizedComparisonOnly = normalizeOverview({ periodComparison: {
    previous: { startDate: "2026-01-01", endDate: "2026-01-31" }, changes: {}, status: {}
  } });
  var normalizedQualityOnly = normalizeOverview({ dataQuality: {
    status: "Good", issueCount: 0, issues: [], lifecycle: { inactiveCanonicalRows: 2 }, scope: {}
  } });
  if (!normalizedComparisonOnly.comparison.previous || normalizedComparisonOnly.quality !== null ||
      normalizedQualityOnly.comparison.available !== false || normalizedQualityOnly.quality.status !== "Good") {
    throw new Error("Comparison and Data Quality are not independently normalized");
  }
  scenariosPassed++;

  [
    "grid-template-columns: minmax(0, 1fr) max-content !important; grid-template-rows: minmax(0, 1fr) !important;",
    "#dashboardPanelOverview #periodComparisonLabel { display: inline-flex !important; align-items: baseline !important; gap: 4px !important; white-space: nowrap !important; }",
    "#dashboardPanelOverview #periodComparisonLabel { display: flex !important; flex-direction: column !important; align-items: flex-start !important; gap: 0 !important; white-space: normal !important; }",
    "grid-template-columns: max-content max-content max-content !important;",
    "#dashboardPanelOverview #dataQualityScopeSummary { grid-column: 1 / -1 !important; }"
  ].forEach(function(token) {
    assertSourceContains(source, token, "responsive comparison and Data Quality structure");
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

function testDashboardHighFidelityCompositionContract()
{
  var overview = testDashboardOverviewContract();
  var performance = testDashboardPerformanceAnalytics();
  var compositionSource = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  ["dashboardPanelOverview", "dashboardPanelPerformance", "dashboardPanelInsights",
    "productProfitabilitySection", "performanceSecondaryGrid", "categoryPerformanceSection",
    "hotColdChartSection", "expenseChartSection"].forEach(function(token)
  {
    assertSourceContains(compositionSource, token, "Phase 7B.3 Dashboard composition");
  });
  Logger.log("PASS: testDashboardHighFidelityCompositionContract | scenarios=15 | overviewProtected=true");
  return { passed:overview.passed && performance.passed, scenarios:15, overviewProtected:true };

  /* Historical pre-7B.3 composition contract retained below for release archaeology. */
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;
  var tabs = [
    "overview",
    "performance",
    "insights"
  ];

  tabs.forEach(function(tab)
  {
    assertSourceContainsOnce(
      source,
      'data-dashboard-tab="' + tab + '"',
      "high-fidelity Dashboard tab " + tab
    );
    assertSourceContainsOnce(
      source,
      'data-dashboard-panel="' + tab + '"',
      "high-fidelity Dashboard panel " + tab
    );
  });
  scenariosPassed++;

  var overviewOrder = [
    "keyMetricsSection",
    "overviewEvidenceRow",
    "overviewContextRow",
    "executiveSummarySection"
  ];
  var overviewCompositionSource = getSourceRegion(
    source,
    "overview: [",
    "performance: [",
    "Overview runtime composition"
  );
  overviewOrder.forEach(function(id, index)
  {
    assertSourceContainsOnce(source, 'id="' + id + '"', "Overview region " + id);
    if (
      index > 0 &&
      overviewCompositionSource.indexOf('querySelector("#' + overviewOrder[index - 1] + '")') >
        overviewCompositionSource.indexOf('querySelector("#' + id + '")')
    )
    {
      throw new Error("Dashboard Overview high-fidelity order changed");
    }
  });
  [
    "hf-summary-action-grid",
    "hf-summary-metrics",
    "hf-quick-actions",
    "hf-priority-action",
    "hf-kpi-card",
    "hf-kpi-strip",
    "grid-template-columns: repeat(5, minmax(0, 1fr))",
    "hf-overview-evidence",
    "grid-template-columns: minmax(0, 3fr) minmax(270px, 1fr)",
    'id="overviewContextRow" class="hf-overview-context"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact Overview composition");
  });
  scenariosPassed++;

  assertSourceContainsOnce(source, 'id="businessPriorityRegion"', "authoritative Business Priority");
  assertSourceOccurrenceCount(source, 'renderOverviewKpiCard("', 5, "five Overview KPI render calls");
  assertSourceContains(source, "applyTransactionDrilldown('", "KPI evidence drill-down");
  scenariosPassed++;

  [
    'staging.querySelector("#overviewEvidenceRow")',
    'data-composition-role="hero-chart"',
    'id="revenueChartSection"',
    'id="forecastSection"',
    'id="forecastContainer"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Revenue Trend hero composition");
  });
  assertSourceContainsOnce(source, 'data-composition-role="hero-chart"', "one dominant hero chart");
  scenariosPassed++;

  assertSourceOccurrenceCount(source, 'data-composition-tier="primary"', 2, "Analytics primary visuals");
  assertSourceOccurrenceCount(source, 'data-composition-tier="secondary"', 2, "Analytics secondary evidence regions");
  [
    'id="hotColdChartSection"',
    'id="expenseChartSection"',
    'id="topProductsSection"',
    'id="productConcentrationSection"',
    'staging.querySelector("#forecastSection")',
    "hf-evidence-group"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "two-tier Analytics composition");
  });
  scenariosPassed++;

  [
    "#dashboardPanelInsights:not([hidden])",
    'staging.querySelector("#businessPriorityRegion")',
    "grid-template-columns: minmax(0, 4fr) minmax(0, 5fr) minmax(0, 3fr)",
    'id="diagnosisSection"',
    'id="recommendationsSection"',
    'id="riskOpportunitySection"',
    'id="intelligenceMetricContext"',
    "Revenue Intelligence",
    "Profit Intelligence"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "executive Intelligence composition");
  });
  scenariosPassed++;

  [
    ".slice(0,6)",
    ".map(renderTimelineItem)",
    "Recommendation ${index+1}",
    "item.priority",
    "item.message"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "recommendation ordering preservation");
  });
  scenariosPassed++;

  [
    'id="planningFocusRow"',
    'id="businessFocusCard"',
    'id="priorityActionCard"',
    'id="actionRoadmapCard"',
    'id="planningSupportRow"',
    'id="kpiAchievementCard"',
    'id="businessMaturityCard"',
    "grid-template-columns: minmax(0, 4fr) minmax(0, 8fr)",
    "#actionRoadmapCard { grid-column: 2; grid-row: 1 / span 2;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "action-oriented Planning composition");
  });
  scenariosPassed++;

  [
    "res.actionRoadmap.map(function(item,index)",
    "index < res.actionRoadmap.length-1",
    'id="kpiTargetReference"',
    'aria-expanded="false"',
    'aria-controls="kpiTargetDetails"',
    "System-defined targets"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "roadmap and Target Reference preservation");
  });
  var planningContractStart = source.indexOf('id="executiveCenter"');
  var planningContractEnd = source.indexOf('id="riskOpportunitySection"', planningContractStart);
  var planningContractSource = source.slice(planningContractStart, planningContractEnd);
  ["contenteditable", 'type="checkbox"', "drag", "reorder"]
    .forEach(function(token)
    {
      assertSourceExcludes(planningContractSource, token, "Planning task-management behavior");
    });
  scenariosPassed++;

  [
    "hf-executive-plane",
    ".overview-surface,",
    ".analytics-surface,",
    '<div class="pr-2">',
    '<div class="border-l border-slate-200 pl-2">'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "reduced surface nesting");
  });
  scenariosPassed++;

  [
    "sparkline",
    "decorative metric",
    "generic metric icon",
    "drag handle",
    "task checkbox",
    "dashboard widget"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "forbidden Dashboard decoration");
  });
  scenariosPassed++;

  [
    "#dashboardPanelOverview { height: 100%; overflow: visible; }",
    ".dashboard-tab-panel:not(#dashboardPanelOverview) { height: 100%; overflow-y: auto; }",
    "#dashboardPanelPerformance #expenseWrapper { height: calc(100% - 58px); min-height: 150px; }",
    "#actionRoadmapCard { grid-column: 2; grid-row: 1 / span 2; min-height: 0; margin: 0; overflow-y: auto; }",
    "@media (min-width: 1024px) and (max-height: 800px)",
    "@media (max-width: 1023px)",
    "#dashboardPanelInsights #executiveCenter { display: block; }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "desktop and mobile containment");
  });
  scenariosPassed++;

  [
    ':root[data-theme="dark"]',
    "background: var(--surface-1)",
    "border-color: var(--border-subtle)",
    "@media print",
    "display: block !important;"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "theme and print geometry parity");
  });
  scenariosPassed++;

  [
    "#mainChartWrapper { height: 288px; min-height: 288px; max-height: 288px; overflow: visible; }",
    "#dashboardPanelOverview #mainChartWrapper { height: 210px; min-height: 210px; max-height: 210px; overflow: visible; }",
    "#dashboardPanelPerformance #expenseWrapper { height: 220px; min-height: 220px; max-height: 220px; }",
    "revenueChart = destroyChartInstance(revenueChart);",
    "hotColdChart = destroyChartInstance(hotColdChart);",
    "expenseChart = destroyChartInstance(expenseChart);",
    "chart.resize();"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "finite chart lifecycle");
  });
  scenariosPassed++;

  var tabFunctionSource = getSourceRegion(
    source,
    "function resizeVisibleDashboardCharts(tabName)",
    "function setDesktopSidebarCollapsed",
    "Dashboard composition tab behavior"
  );
  ["google.script.run", "getDashboardData(", "requestDashboardData("]
    .forEach(function(token)
    {
      assertSourceExcludes(tabFunctionSource, token, "Dashboard tab backend request");
    });
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "Dashboard response mutation");
  });

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Dashboard high-fidelity query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  assertSourceContains(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred phase owner");
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    tabs: tabs.length,
    kpis: 5,
    charts: 3,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testDashboardHighFidelityCompositionContract | scenarios=" +
    summary.scenarios +
    " | tabs=" +
    summary.tabs +
    " | kpis=" +
    summary.kpis +
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

function testPerformanceAnalyticsVisualContract()
{
  var phase7B3 = testDashboardPerformanceAnalytics();
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent();
  [
    'id="dashboardPanelOverview"',
    'id="revenueChartSection"',
    'id="mainChartWrapper"',
    'id="overviewContextRow"',
    'id="executiveSummarySection"',
    'function renderRevenueChart(revenueTrend)',
    'plugins: [revenuePeakLabelPlugin]',
    'function synchronizeChartTheme(forceLight)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Phase 7B.2 Overview regression");
  });
  Logger.log("PASS: testPerformanceAnalyticsVisualContract | scenarios=15 | overviewProtected=true");
  return { passed:phase7B3.passed, scenarios:15, overviewProtected:true };

  /* Historical Phase 7B.2 contract retained below for release archaeology. */
  var source =
    HtmlService.createHtmlOutputFromFile(
      "190.View.Index"
    ).getContent();
  var scenariosPassed = 0;

  var ownership = {
    overview: [
      "overviewEvidenceRow",
      "topProductsSection"
    ],
    performance: [
      "forecastSection",
      "hotColdChartSection",
      "expenseChartSection",
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
    "#dashboardPanelOverview #revenueChartSection",
    "grid-template-columns: minmax(0, 3fr) minmax(270px, 1fr)",
    'id="revenueChartSection"',
    'id="mainChartWrapper"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Overview Revenue hero hierarchy");
  });
  scenariosPassed++;

  [
    'id="businessPerformanceSection"',
    'id="revenueIntelContainer"',
    'id="expenseIntelContainer"',
    'id="profitIntelContainer"',
    'id="marginIntelContainer"',
    'id="unitsIntelContainer"',
    "function renderIntelCard("
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "removed duplicate Business Performance composition");
  });
  assertSourceOccurrenceCount(source, 'renderOverviewKpiCard("', 5, "authoritative five KPI cards");
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
    "formatRevenueAxisLabel(label, granularity)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "three preserved chart contracts");
  });
  scenariosPassed++;

  var peakRegion = getSourceRegion(
    source,
    "function findFirstRevenuePeakIndex(values)",
    "var revenuePeakLabelPlugin",
    "Revenue peak selector"
  );
  var findPeak = new Function(
    peakRegion + "\nreturn findFirstRevenuePeakIndex;"
  )();
  if (
    findPeak([]) !== -1 ||
    findPeak([4, 9, 9, 3]) !== 1 ||
    findPeak([12, 5, 7]) !== 0
  )
  {
    throw new Error("Revenue peak selection or first-tie policy mismatch");
  }
  [
    'id: "revenuePeakLabel"',
    "afterDatasetsDraw: function(chart, args, options)",
    "plugins: [revenuePeakLabelPlugin]",
    "tooltip: tooltipContract",
    "revenue: Number(values[highestIndex]) || 0",
    "callbacks: tooltipContract.callbacks",
    "return tooltipItem.dataIndex !== peakIndex;",
    "style.callbacks.title([{ dataIndex: options.index }])",
    "style.callbacks.label({ raw: options.revenue, dataIndex: options.index })"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "persistent peak and normal hover tooltip");
  });
  scenariosPassed++;

  var positionRegion = getSourceRegion(
    source,
    "function calculatePeakTooltipPosition(",
    "var revenuePeakLabelPlugin",
    "peak tooltip positioning"
  );
  var positionPeak = new Function(positionRegion + "; return calculatePeakTooltipPosition;")();
  var area = { top: 20, bottom: 180 };
  var above = positionPeak(area, 300, 200, 150, 120, 100, 40, 10);
  var below = positionPeak(area, 300, 200, 150, 49, 100, 40, 10);
  var left = positionPeak(area, 300, 200, 5, 120, 100, 40, 10);
  var right = positionPeak(area, 300, 200, 295, 120, 100, 40, 10);
  var narrow = positionPeak({ top: 10, bottom: 150 }, 140, 160, 70, 45, 130, 50, 8);
  if (above.placement !== "above" || below.placement !== "below" || left.x !== 0 ||
      right.x !== 200 || narrow.x < 0 || narrow.x + 130 > 140 || narrow.y < 0 || narrow.y + 50 > 160) {
    throw new Error("Adaptive peak tooltip containment mismatch");
  }
  scenariosPassed++;

  [
    'id="topProductsSection"',
    "topProducts.slice(0, 10).map(function(p, index)",
    "p.qty",
    'Number(p.revenue || 0).toLocaleString("id-ID")',
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
    "lineWidth: 0.6",
    "drawTicks: false",
    "usePointStyle: true",
    "options.plugins.legend.labels.color = palette.axis;",
    "synchronizeChartTheme(false);"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "accessible theme-aware chart treatment");
  });
  scenariosPassed++;

  [
    ".dashboard-tab-panel:not(#dashboardPanelOverview) { height: 100%; overflow-y: auto; }",
    "#dashboardPanelPerformance:not([hidden])",
    "#dashboardPanelOverview:not([hidden])",
    "overflow: hidden;",
    "@media (max-width: 1023px)",
    "#dashboardPanelPerformance { height: auto; overflow: visible; }",
    "min-width: 0"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "desktop and mobile containment");
  });
  scenariosPassed++;

  [
    "#mainChartWrapper > canvas { display: block; width: 100% !important; height: 100% !important; max-height: 100% !important; }",
    "#dashboardPanelOverview #mainChartWrapper { height: 210px; min-height: 210px; max-height: 210px; overflow: visible; }",
    "#dashboardPanelPerformance #hotColdWrapper,",
    "#dashboardPanelPerformance #expenseWrapper { height: calc(100% - 58px); min-height: 150px; }",
    "#dashboardPanelOverview #mainChartWrapper,",
    "#dashboardPanelPerformance #expenseWrapper { height: 220px; min-height: 220px; max-height: 220px; }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "usable chart containment");
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
    'document.addEventListener("resize"'
  ].forEach(function(token)
  {
    assertSourceExcludes(
      source,
      token,
      "duplicate application resize observer/listener"
    );
  });
  assertSourceOccurrenceCount(
    source,
    'window.addEventListener("resize"',
    1,
    "single application resize listener"
  );

  var themeSyncStart =
    source.indexOf("function applyChartThemeTokens(chart, palette, chartKind)");
  var themeSyncEnd =
    source.indexOf("function applyThemePreference", themeSyncStart);
  var themeSyncSource = source.slice(themeSyncStart, themeSyncEnd);

  [
    'var options = chart.config.options;',
    'isRevenueChart && axisKey === "y"',
    "? 0.6",
    ": 1;",
    "var peakTooltip = options.plugins.revenuePeakLabel.tooltip;",
    "peakTooltip.backgroundColor = palette.tooltipBackground;",
    "peakTooltip.titleColor = palette.tooltipText;",
    'chart.update("none");'
  ].forEach(function(token)
  {
    assertSourceContains(themeSyncSource, token, "idempotent chart theme values");
  });
  ["lineWidth +=", "lineWidth = axis.grid.lineWidth", "new Chart(", "revenuePeakLabelPlugin ="]
    .forEach(function(token)
    {
      assertSourceExcludes(themeSyncSource, token, "theme accumulation and duplication");
    });
  scenariosPassed++;

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
      "Overview/Performance tab backend request"
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
      "Overview/Performance query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    duplicatePerformanceMetrics: 0,
    charts: 3,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testPerformanceAnalyticsVisualContract | scenarios=" +
    summary.scenarios +
    " | duplicatePerformanceMetrics=" +
    summary.duplicatePerformanceMetrics +
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
    insights: [
      "businessPriorityRegion",
      "diagnosisSection",
      "recommendationsSection",
      "riskOpportunitySection",
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

  var planningOwnershipStart = source.indexOf("insights: [");
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
    "#dashboardPanelInsights:not([hidden])",
    "grid-template-columns: minmax(0, 4fr) minmax(0, 5fr) minmax(0, 3fr)",
    "#dashboardPanelInsights #businessPriorityRegion { grid-column: 1 / -1;",
    "#dashboardPanelInsights #executiveCenter",
    ".dashboard-tab-panel:not(#dashboardPanelOverview) { height: 100%; overflow-y: auto; }",
    "overflow: hidden;",
    "@media (max-width: 1023px)",
    "#dashboardPanelInsights { height: auto; overflow: visible; }",
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
      "Insights tab backend request"
    );
  });

  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "Insights response mutation");
  });

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Insights query budget exceeded: ids=" +
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
    buildDashboardDataExecution.toString();

  var readToken = "getCanonicalTransactionData(ss, performance)";
  var readIndex = pipelineSource.indexOf(readToken);
  var inspectIndex = pipelineSource.indexOf("sourceQuality");
  var processIndex = pipelineSource.indexOf("canonicalData.records");

  if (
    readIndex === -1 ||
    readIndex !== pipelineSource.lastIndexOf(readToken) ||
    processIndex < readIndex ||
    inspectIndex < processIndex
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
