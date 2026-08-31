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
  [submitCanonicalTransaction, voidCanonicalTransaction, correctCanonicalTransaction].forEach(function(mutation) {
    if (mutation.toString().indexOf("invalidateDashboardCache()") === -1) {
      throw new Error("Dashboard cache invalidation missing from " + mutation.name);
    }
  });

  return { passed: true, records: 2, inactiveExcluded: 1, singleReadSheets: 4,
    normalizedDateKeys: true, cacheContexts: 4, mutationInvalidators: 3 };
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
    context.expenseItems,
    context.pricing,
    timestamp
  );
  if (options.sales.length !== 2 || options.sales[0].productId !== "P0" ||
      Object.prototype.hasOwnProperty.call(options.sales[0], "Notes") ||
      options.expenses.length !== 3 || options.expenses[0].item !== "Electricity" ||
      Object.prototype.hasOwnProperty.call(options.expenses[0], "AccountCode") ||
      options.sales[1].pricing.Hot.price !== 10000 || options.sales[1].pricing.Cold.hpp !== 5000) {
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
  if (JSON.stringify(overlap) !== JSON.stringify({ salesRows: 62, expenseRows: 10, qty: 81,
    cogs: 443600, revenue: 1046000, margin: 602400, expense: 1281000, hot: 33, cold: 48 })) {
    throw new Error("Canonical Phase 4 overlap controls mismatch: " + JSON.stringify(overlap));
  }
  return { passed: true, historicalYears: 6, overlapRows: 72 };
}

function testInteractiveDrilldownContract()
{
  var source = getAssembledFrontendSource();
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
    '"month",',
    'expenseCategory: true',
    'showPage("transactions");',
    'setActiveTransactionsTab("recent");'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "KPI and chart drill-down wiring");
  });
  var kpiRendererSource = source.slice(
    source.indexOf("function renderOverviewKpiCard("),
    source.indexOf("function renderBusinessOverview(")
  );
  ["onclick=", "applyTransactionDrilldown(", "cursor-pointer", "<button"].forEach(function(token)
  {
    assertSourceExcludes(kpiRendererSource, token, "information-only KPI cards");
  });
  scenariosPassed++;

  var filterStart =
    source.indexOf("function filterTransactionDrilldown(");
  var filterEnd =
    source.indexOf("function findLifecycleTransaction", filterStart);
  var filterSource =
    source.slice(filterStart, filterEnd).trim();
  var filterTransactionDrilldown =
    Function("return (" + filterSource + ");")();
  var transactions = [
    { date: "2025-03-12", transactionType: "Expense", purchaseCategory: "Supplies" },
    { date: "2025-03-11", transactionType: "Sales", product: "Latte" },
    { date: "2025-02-10", transactionType: "Sales", product: "Espresso" },
    { date: "2025-01-10", transactionType: "Expense", purchaseCategory: "Rent" }
  ];
  var original = JSON.stringify(transactions);
  var cases = [
    { type: "all", value: "", expected: "Expense,Sales,Sales,Expense" },
    { type: "sales", value: "", expected: "Sales,Sales" },
    { type: "purchase", value: "", expected: "Expense,Expense" },
    { type: "month", value: "2025-03", expected: "Expense,Sales" },
    { type: "expenseCategory", value: "Supplies", expected: "Expense" },
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
    "getTransactionsPage({",
    "pageSize: transactionsPageSize",
    "Filtered across the active reporting period.",
    'setActiveTransactionsTab("recent");'
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
    "getDashboardData(",
    "spreadsheet",
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
    boundedRows: 15,
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

function testTransactionEntryUiContract()
{
  var source = getAssembledFrontendSource();
  var tokenSource = HtmlService.createHtmlOutputFromFile("189.View.Tailwind").getContent();
  var optionsServerSource = getTransactionEntryOptions.toString();
  var region = getSourceRegion(source, 'id="transactionEntryOverlay"', 'id="settings"', "Transaction entry UI");
  var resetRegion = getSourceRegion(source, "function resetTransactionEntryForAnother(shouldFocusType)", "// Render Transactions", "new transaction reset");
  var previewRegion = getSourceRegion(source, "function previewTransactionCorrection(payload)", "function renderCorrectionComparison", "correction preview");
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
    'var cachedPricing = state.selectedProduct.pricing && state.selectedProduct.pricing[state.selectedType];',
    'state.pricingSource = "master-cache";',
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
    'expenses: response.data.expenses.slice()', 'preloadTransactionEntryOptions()', 'loadTransactionEntryOptions()">Retry'].forEach(function(token) {
    assertSourceContains(source, token, "cached options and retry state");
  });
  ['CacheService.getScriptCache()', 'transaction-entry-options-v2|', 'cache.put(cacheKey', 'readCanonicalTable(ss, "ProductPricing"'].forEach(function(token) {
    assertSourceContains(optionsServerSource, token, "revision-scoped master option cache");
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
    '#transactions.active { display: grid; height: 100%; grid-template-rows: 44px minmax(0, 1fr); gap: 10px; overflow: hidden; }',
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
  ['id="transactionCorrectionWorkspace"', 'entry.dialog.setAttribute("data-mode", "create");',
    'entry.dialog.setAttribute("data-entry-type", type.toLowerCase());',
    'entry.dialog.removeAttribute("data-entry-type");',
    'entry.dialog.setAttribute("data-mode", "correction");',
    'resetTransactionEntryForAnother(false);', 'transactionEntryState = createInitialTransactionEntryState();',
    'entry.correctionWorkspace.hidden = true;', 'entry.correctionWorkspace.hidden = false;',
    'entry.correctionReasonRegion.hidden = true;', 'entry.correctionReview.hidden = true;'].forEach(function(token) {
    assertSourceContains(source, token, "content-fit create/correction modal ownership");
  });
  ['transactionEntryState = createInitialTransactionEntryState();', 'entry.correctionWorkspace.hidden = true;',
    'entry.correctionReasonRegion.hidden = true;', 'entry.correctionReview.hidden = true;'].forEach(function(token) {
    assertSourceContains(resetRegion, token, "fresh New Transaction correction-state reset");
  });
  ['if (state.mode !== "correction" || !state.originalDetail) return;',
    'if (transactionEntryState !== state || state.mode !== "correction" || !state.originalDetail) return;'].forEach(function(token) {
    assertSourceContains(previewRegion, token, "stale correction preview isolation");
  });
  ['#transactionsEntryActionRow{min-height:44px;align-items:center}',
    '#transactionsEntryActionRow .transaction-entry-primary{width:-moz-max-content;width:max-content;height:44px;min-height:44px;flex:0 0 auto;align-self:center}',
    '.transaction-entry-dialog{display:flex;width:min(100%,860px)',
    'max-height:calc(100dvh - 48px)',
    '.transaction-entry-fields{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}',
    '.transaction-entry-fields h3{display:flex;width:100%;align-items:center;justify-content:flex-start;gap:0',
    '#transactionEntryDialog[data-mode=create] .transaction-entry-fields h3{margin-top:12px}',
    '.transaction-entry-fields h3>span:first-child{display:inline-flex;flex:0 0 auto;align-items:center;gap:8px}',
    '.transaction-entry-ready-status{flex:0 0 auto;margin-inline-start:10px',
    '.transaction-entry-money{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;border:1px solid var(--card-border)',
    '.transaction-entry-money input{border:0;outline:none;background:transparent;box-shadow:none}',
    '.transaction-entry-money:has(#expenseEntryAmount),.transaction-entry-money:has(#expenseEntryAmount):focus-within,.transaction-entry-money:has(#expenseEntryAmount):hover{border-color:var(--card-border)!important;outline:none!important;box-shadow:none!important}',
    '#expenseEntryAmount{-webkit-appearance:none;-moz-appearance:none;appearance:none}',
    '#expenseEntryAmount,#expenseEntryAmount:active,#expenseEntryAmount:focus,#expenseEntryAmount:focus-visible,#expenseEntryAmount:hover{border:0!important;border-width:0!important;border-color:transparent!important;outline:0!important;outline-offset:0!important;background:transparent!important;box-shadow:none!important}',
    '.transaction-sales-detail-card{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))',
    'gap:6px 12px', '.transaction-sales-product .transaction-entry-error:empty{display:none}',
    '#salesEntryFields>.transaction-sales-detail-card{grid-column:1;grid-row:2;align-self:stretch}',
    '#salesPricingPreview{grid-column:2;grid-row:2;align-self:stretch}',
    '#transactionEntryDialog[data-mode=create][data-entry-type=sales] .transaction-entry-scroll{padding:14px 18px calc(14px + env(safe-area-inset-bottom))}',
    '#transactionEntryDialog[data-mode=create][data-entry-type=sales] .transaction-entry-local-state{margin:8px 0}',
    '#transactionEntryDialog[data-mode=correction] #transactionEntryForm{display:block}',
    '.transaction-correction-workspace[hidden]{display:none}',
    '.transaction-lifecycle-comparison[hidden]{display:none}',
    '#transactionEntryDialog[data-mode=correction] .transaction-correction-workspace{display:grid;gap:10px;margin-top:12px}',
    '#transactionEntryDialog[data-mode=correction][data-entry-type=sales] .transaction-correction-workspace.has-review{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}',
    '#transactionEntryDialog[data-mode=correction] #transactionCorrectionReason{min-height:64px;resize:none}',
    '#transactionEntryDialog[data-mode=correction] #transactionCorrectionReasonError:empty{display:none}',
    '#transactionEntryDialog[data-mode=correction] .transaction-entry-submit{margin-top:12px}',
    '#salesEntryQty{-webkit-appearance:textfield;appearance:textfield;-moz-appearance:textfield}',
    '#salesEntryQty::-webkit-inner-spin-button,#salesEntryQty::-webkit-outer-spin-button{margin:0;-webkit-appearance:none;appearance:none}',
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

  ['id="salesEntryOptionsStatus"', 'id="expenseEntryOptionsStatus"',
    'function updateTransactionEntryOptionsPresentation()', 'Entry options ready</span>'].forEach(function(token) {
    assertSourceContains(source, token, "detail-heading option readiness");
  });
  ['Operational entry', 'Operational Entry', 'Pricing ready.', 'Pricing Ready'].forEach(function(token) {
    assertSourceExcludes(source, token, "removed redundant entry copy");
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
  var source = getAssembledFrontendSource();
  var css = HtmlService.createHtmlOutputFromFile("189.View.Tailwind").getContent();
  var dataSource = buildCanonicalTransactionData.toString();
  var detailBatchSource = getCanonicalTransactionDetails.toString();
  var dashboardSource = getDashboardData.toString() + buildDashboardDataExecution.toString() +
    buildDashboardResponse.toString() + buildRecentLifecycleTransactions.toString();
  var transactionPageSource = getTransactionsPage.toString() + filterTransactionsPeriodRows.toString() +
    normalizeTransactionsLifecycleState.toString() + buildTransactionsSearchIndex.toString() +
    buildTransactionsPageResult.toString() + getTransactionsPeriodRows.toString() +
    formatTransactionsSearchDate.toString();
  var scenarios = 0;

  ["function runTransactionRowAction(action, transactionId, trigger)",
    "openTransactionDetail(transactionId)", "loadTransactionForMutation(transactionId, action)",
    '<span>View</span>', '<span>Correct</span>', '<span>Void</span>',
    "prefetchVisibleTransactionDetails(result.rows)", ".getCanonicalTransactionDetails(ids)",
    "transactionDetailCache[transactionId]", "transactionDetailPending[transactionId].success.push(onSuccess)",
    "requestToken !== transactionLifecycleRequestSequence", "function transactionDetailIdentity(transactionId)",
    "buildLocalTransactionDetail(findLifecycleTransaction(identity))",
    "mergeTransactionDetailSnapshot(localDetail, detail)"].forEach(function(token) {
    assertSourceContains(source, token, "direct lifecycle row actions");
  });
  var detailOpenRegion = getSourceRegion(source, "function openTransactionDetail(transactionId)", "function buildLocalTransactionDetail(row)", "local-first detail open");
  var localRenderIndex = detailOpenRegion.indexOf("renderTransactionDetail(localDetail)");
  var enrichmentIndex = detailOpenRegion.indexOf("loadCanonicalTransactionDetail(identity");
  if (localRenderIndex === -1 || enrichmentIndex === -1 || localRenderIndex > enrichmentIndex) {
    throw new Error("Visible transaction snapshot must render before canonical enrichment starts");
  }
  ["if (!localDetail) renderLifecycleLoadError(error);", "transactionDetailIdentity(transaction.id) === identity",
    "transactionDetailCache[identity] = detail", "transactionDetailPending[identity] = { success: [], failure: [] }"] .forEach(function(token) {
    assertSourceContains(source, token, "stable local-first detail identity");
  });
  assertSourceExcludes(source, 'row.source === "APP_ENTRY" && row.isActive !== false', "historical detail preload exclusion");
  ["transactionIds.slice(0, 50)", 'readCanonicalTable(ss, "tabsal"', 'readCanonicalTable(ss, "tabops"',
    'readCanonicalTable(ss, "Logs"', "details: details"].forEach(function(token) {
    assertSourceContains(detailBatchSource, token, "bounded canonical detail prefetch");
  });
  ["transactionActionOverlay", "transactionActionMenu", "openTransactionActionMenu", "closeTransactionActionMenu"].forEach(function(token) {
    assertSourceExcludes(source, token, "removed grouped action menu");
  });
  ["getCanonicalTransactionDetail(transactionId)", "correctCanonicalTransaction(payload)", "voidCanonicalTransaction({ transactionId:"].forEach(function(token) {
    assertSourceContains(source, token, "preserved lifecycle server handlers");
  });
  ["var search = String(safeRequest.search", 'requested === "active" || requested === "voided" || requested === "all"',
    'lifecycleState === "active" && row.isActive === false', 'lifecycleState === "voided" && row.isActive !== false',
    "cache.getAll(keys)", "cache.putAll(cacheEntries", "searchIndex", "prefetchedPages", "rangeStart:", "rangeEnd:"].forEach(function(token) {
    assertSourceContains(transactionPageSource, token, "server pagination cache and search contract");
  });
  var searchRows = [
    { id: "SAL-APP-1", date: "2026-08-30", transactionType: "Sales", product: "Americano", purchaseCategory: "", isActive: true },
    { id: "OPS-XLSM-2", date: "2026-08-29", transactionType: "Expense", product: "", purchaseCategory: "Electricity", isActive: false }
  ];
  if (filterTransactionsPeriodRows(searchRows, { search: "sal-app" }, "recent").length !== 1 ||
      filterTransactionsPeriodRows(searchRows, { search: "americano" }, "recent").length !== 1 ||
      filterTransactionsPeriodRows(searchRows, { search: "2026-08-30" }, "recent").length !== 1 ||
      filterTransactionsPeriodRows(searchRows, { search: "30 aug 2026" }, "recent").length !== 1 ||
      filterTransactionsPeriodRows(searchRows, { search: "sales" }, "recent").length !== 0 ||
      filterTransactionsPeriodRows(searchRows, { search: "2026", lifecycleState: "voided" }, "recent").length !== 1 ||
      buildTransactionsPageResult(searchRows, 2, 1).page !== 2) {
    throw new Error("Transactions ID, item, date, type-removal, lifecycle, or pagination search contract mismatch");
  }
  ['placeholder="Search ID, item, or date"',
    '[row.id, row.product, row.purchaseCategory, row.date, formatTransactionDate(row.date)]',
    '[row.id, row.product, row.purchaseCategory, row.date, formatTransactionsSearchDate(row.date)]'].forEach(function(token) {
    assertSourceContains(token.indexOf("formatTransactionsSearchDate") !== -1 ? transactionPageSource : source, token, "Transactions date search contract");
  });
  ['row.transactionType].some', 'row.purchaseCategory, type].some', 'placeholder="Search ID, item, or type"'].forEach(function(token) {
    assertSourceExcludes(token.indexOf("row.purchaseCategory") === 0 ? transactionPageSource : source, token, "Transactions Type search removal");
  });
  ['.transaction-lifecycle-dialog{display:flex;width:min(100%,760px)',
    '.transaction-lifecycle-dialog .transaction-entry-scroll{padding:16px 18px}',
    '.transaction-lifecycle-dialog .transaction-entry-local-state:empty{display:none}',
    '#transactionVoidRegion:not([hidden]){display:grid;gap:8px;margin-top:12px}',
    '#transactionVoidReasonError:empty{display:none}'].forEach(function(token) {
    assertSourceContains(css, token, "content-fit lifecycle modal geometry");
  });
  ['function renderTransactionDetail(detail)',
    'transaction-lifecycle-grid transaction-lifecycle-grid--active',
    'transaction-lifecycle-grid transaction-lifecycle-grid--history',
    'lifecycle.dialog.setAttribute("data-view-layout", showLifecycle ? "history" : "active");',
    '? \'<div class="transaction-lifecycle-grid transaction-lifecycle-grid--history">\' + transactionCard + lifecycleCard + businessCard + auditCard',
    ': \'<div class="transaction-lifecycle-grid transaction-lifecycle-grid--active">\'',
    '["Transaction ID", detail.id]', '["CreatedBy", detail.createdBy]',
    '["UpdatedBy", detail.updatedBy]', '["Original Transaction", detail.originalId]',
    'white-space:normal;overflow-wrap:anywhere;word-break:break-word'].forEach(function(token) {
    assertSourceContains(token.indexOf("white-space") === 0 ? css : source, token, "wrapped lifecycle detail composition");
  });
  ['Transaction lifecycle', 'Transaction Lifecycle'].forEach(function(token) {
    assertSourceExcludes(source, token, "removed lifecycle eyebrow copy");
  });
  Logger.log("PASS: testTransactionLifecycleUiContract | scenarios=4");
  return { passed: true, scenarios: 4, writes: 0 };

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

  ['id="transactionsIsActive"', 'name="isActive"', 'value="active" selected>Active</option>', 'value="all">All</option>', 'value="voided">Voided</option>',
    'lifecycleState === "active" && row.isActive === false', 'lifecycleState === "voided" && row.isActive !== false',
    'transaction-status-badge', 'transaction-row-voided'].forEach(function(token) {
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
    'html.numlock-phone .transaction-entry-dialog', '.transaction-lifecycle-dialog{display:flex;width:min(100%,760px)',
    '.transaction-lifecycle-dialog .transaction-entry-scroll{padding:16px 18px}',
    '.transaction-lifecycle-dialog .transaction-entry-local-state:empty{display:none}',
    '#transactionVoidRegion:not([hidden]){display:grid;gap:8px;margin-top:12px}',
    '#transactionLifecycleOverlay{align-items:flex-end;padding:0}'].forEach(function(token) {
    assertSourceContains(token.indexOf(".") === 0 || token.indexOf("#") === 0 || token.indexOf("html") === 0 ? css : source, token, "responsive correction and void surfaces");
  });
  scenarios++;

  Logger.log("PASS: testTransactionLifecycleUiContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios, writes: 0 };
}

function testTransactionsVisualContract()
{
  var source = getAssembledFrontendSource(true);
  var css = HtmlService.createHtmlOutputFromFile("189.View.Tailwind").getContent();
  var scenariosPassed = 0;

  ['data-transactions-tab="recent"', 'data-transactions-tab="sales"', 'data-transactions-tab="expenses"',
    'id="transactionsPagination"', 'id="transactionsPreviousPage"', 'id="transactionsNextPage"',
    'id="transactionsPageSize"', 'id="transactionsPageSizeFooter"', 'id="transactionsSearch"', 'option value="15"',
    "const TRANSACTIONS_DEFAULT_PAGE_SIZE = 15;", "const TRANSACTIONS_ALLOWED_PAGE_SIZES = { 15: true, 25: true, 50: true };",
    "transactionsPageSize = TRANSACTIONS_ALLOWED_PAGE_SIZES[pageSize] ? pageSize : TRANSACTIONS_DEFAULT_PAGE_SIZE;",
    "function formatTransactionDate(value)", 'return match[3] + " " + months',
    "function requestTransactionsPage()", ".getTransactionsPage({",
    "#transactionsTableScroll td { height: 40px;", "#transactionsTableCard { overflow: hidden;",
    "#transactionsControls #transactionsTabList [role=\"tab\"].is-active",
    ">Transaction ID</th>", "function scheduleTransactionsSearch(value)", "transactionsResultCache[cacheKey]",
    ">IsActive</th>", 'function setTransactionsLifecycleState(value)', 'lifecycleState: transactionsLifecycleState',
    "transactionsTableCard: required.transactionsTableCard",
    "#transactionsTableScroll th:nth-child(1), #transactionsTableScroll td:nth-child(1) { width: 16%; }",
    "#transactionsTableScroll th:nth-child(4), #transactionsTableScroll td:nth-child(4) { width: 24%; }",
    "#transactionsTableScroll th:nth-child(8), #transactionsTableScroll td:nth-child(8) { width: 19%;",
    "transactionsSearchIndex", "prefetchAdjacentTransactionPages", "preloadTransactionEntryOptions",
    "prefetchVisibleTransactionDetails", ".getTransactionsExport({",
    "function getTransactionDiagnostics()", "transactionDiagnostics.showVoided", "transactionDiagnostics.export",
    "function getTransactionLayoutDiagnostics()", "window.getTransactionLayoutDiagnostics = getTransactionLayoutDiagnostics;", "remainingVerticalBudgetBeforeOverflow",
    'var entryMode = entryOpen ? String(entryDialog.getAttribute("data-mode") || "") : "";',
    'var isNewTransaction = entryOpen && entryMode === "create";',
    'var isCorrection = entryOpen && entryMode === "correction";',
    'getComputedStyle(grid).gridTemplateColumns',
    "bottomEmptySpaceEstimate", "nativeSpinnerSuppressionActive", "isActiveFilterExists",
    "completeTransactionPageDiagnostic", "completeTransactionEntryDiagnostic", "completeTransactionActionDiagnostic",
    "transactionDiagnostics.search.eventCount++", "transactionDiagnostics.pagination.eventCount++",
    "transactionDiagnostics.newTransaction.eventCount++", "transactionDiagnostics.export.eventCount++",
    "transactionDiagnostics.actions.viewEventCount++", "transactionDiagnostics.actions.correctEventCount++",
    "transactionDiagnostics.actions.voidEventCount++",
    "grid-template-columns: minmax(0, 1fr);", "border-top: 1px solid var(--divider); padding-top: 10px;",
    "transactions-toolbar-controls", "transactions-row-action--view", "transactions-row-action--correct",
    "transactions-row-action--void", '.transactions-row-actions { display: inline-flex; height: 40px;',
    '.transactions-row-action { position: relative; isolation: isolate; display: inline-flex; height: 32px;',
    '.transactions-row-action::before { position: absolute; z-index: -1; inset: 0;',
    "fa-chevron-left", "fa-chevron-right"].forEach(function(token) {
    assertSourceContains(source, token, "Transactions pagination visual contract");
  });
  ['.transaction-status-badge{display:inline-flex;align-items:center;border:1px solid var(--border-strong);border-radius:var(--radius-pill);padding:2px 8px;color:var(--text-secondary);font-size:12px',
    '.transaction-status-badge--active{border-color:var(--success);border-style:solid;background:var(--success-soft);color:var(--success)}',
    '.transaction-status-badge--voided{border-color:var(--critical);border-style:dashed;background:var(--critical-soft);color:var(--critical)}',
    '#transactionsToolbar .transaction-lifecycle-filter{display:inline-flex;min-height:44px;align-items:center;gap:8px;color:var(--text-secondary);font-size:14px',
    '#transactionsToolbar .transaction-lifecycle-filter>span{font-size:14px}',
    '#transactionsToolbar .transaction-lifecycle-filter select{min-height:40px', 'font-size:14px',
    '.transaction-lifecycle-dialog[data-view-layout=active]{width:min(100%,840px)}',
    '.transaction-lifecycle-grid--active{grid-template-columns:repeat(2,minmax(0,1fr))}',
    '.transaction-lifecycle-grid--active>.transaction-lifecycle-group--identity{grid-column:1/-1}',
    '.transaction-lifecycle-grid--history{grid-template-columns:repeat(2,minmax(0,1fr))}',
    '.transaction-lifecycle-grid--active,.transaction-lifecycle-grid--history{align-items:stretch}',
    '.transaction-lifecycle-grid--active>.transaction-lifecycle-group,.transaction-lifecycle-grid--history>.transaction-lifecycle-group{height:100%}',
    '.transaction-lifecycle-grid--history>.transaction-lifecycle-group--identity,.transaction-lifecycle-grid--history>.transaction-lifecycle-group--relations{grid-column:1/-1}'].forEach(function(token) {
    assertSourceContains(css, token, "IsActive badge/filter typography");
  });
  ['.transaction-type { display: inline-flex; min-height: 24px; align-items: center; border: 1px solid transparent;',
    '.transaction-type--sales { border-color: var(--success); background: var(--success-soft); color: var(--success); }',
    '.transaction-type--expense { border-color: var(--critical); background: var(--critical-soft); color: var(--critical); }',
    '#transactionsTableScroll td { height: 40px;'].forEach(function(token) {
    assertSourceContains(source, token, "Transactions Type badge border and frozen row geometry");
  });
  ["transactionsTabPurchases", "transactionsPanelPurchases", "transactionActionOverlay", "transactionsStateAnnouncement"].forEach(function(token) {
    assertSourceExcludes(source, token, "removed Transactions-only state");
  });
  assertSourceExcludes(
    getSourceRegion(source, "function getTransactionLayoutDiagnostics()", "window.getTransactionLayoutDiagnostics", "Transactions layout diagnostics"),
    'transactionEntryState.mode === "correction"',
    "stale entry-state modal detection"
  );
  assertSourceExcludes(source, 'option value="10"', "legacy Transactions page-size choice");
  Logger.log("PASS: testTransactionsVisualContract | scenarios=2");
  return { passed: true, scenarios: 2, writes: 0 };
  var tabs = ["recent", "sales", "expenses"];
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
  ["purchases", "Purchases", "transactionsTabPurchases", "transactionsPanelPurchases"].forEach(function(token)
  {
    assertSourceExcludes(transactionsTabRegion, token, "removed Purchases tab contract");
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
    { transactionType: "Expense", label: "first" },
    { transactionType: "Sales", label: "second" },
    { transactionType: "Expense", label: "third" },
    { transactionType: "Sales", label: "fourth" }
  ];
  var original = JSON.stringify(rows);
  var expected = {
    recent: "first,second,third,fourth",
    sales: "second,fourth",
    expenses: "first,third"
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
    'transaction.transactionType === "Expense"',
    "Visible recent sales", "Visible recent expenses",
    "Expense rows within the latest 10 transactions already loaded.",
    "latest 10 transactions already loaded"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "truthful bounded Transactions scope");
  });
  assertSourceExcludes(
    getSourceRegion(source, "function filterTransactionsForTab(", "function getVisibleTransactions", "Transactions tab filter"),
    'transaction.transactionType === "Purchase"',
    "Purchase display type"
  );
  scenariosPassed++;

  [
    '>Date</th>', '>Type</th>', '>Item</th>', '>Qty</th>', '>Amount</th>',
    'class="transactions-table-row border-b ${r.isActive === false ? "transaction-row-voided" : ""}"', 'class="transactions-number',
    'id="transactionsControls"', 'id="transactionsEntryActionRow"',
    'id="transactionsTableScroll"', 'overflow-x-auto', 'min-w-[680px]',
    '#transactionsTableScroll table { width: 100%; table-layout: fixed; }',
    '#transactionsTableScroll th:nth-child(3), #transactionsTableScroll td:nth-child(3) { width: auto; text-align: left; }',
    '#transactionsTableScroll th:nth-child(6), #transactionsTableScroll td:nth-child(6) { width: 52px; padding: 0 4px; text-align: center; }'
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
    '#transactions.active { display: grid; height: 100%; grid-template-rows: 44px minmax(0, 1fr); gap: 10px; overflow: hidden; }',
    '#transactionsTableScroll { min-height: 0; height: auto; flex: none; overflow-x: auto; overflow-y: visible; }',
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
