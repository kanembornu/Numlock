function testProductProfitabilityBasicAggregation() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 10, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-2", Tanggal: new Date(2026, 0, 12), ID_Prod: "P2", Tipe: "Cold", Qty: 8, HPP: 4000, HJ: 12000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [
      { ID_Prod: "P1", Produk: "Espresso", Kategori: "Beverage", Kind: "Normal", IsActive: true },
      { ID_Prod: "P2", Produk: "Iced Tea", Kategori: "Beverage", Kind: "Normal", IsActive: true }
    ],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  check(result.revenue === 246000, "total revenue: 150000 + 96000 = 246000, got " + result.revenue);
  check(result.cogs === 82000, "total cogs: 50000 + 32000 = 82000, got " + result.cogs);
  check(result.grossProfit === 164000, "total GP: 246000 - 82000 = 164000, got " + result.grossProfit);
  check(result.units === 18, "total units: 18, got " + result.units);
  check(result.transactionCount === 2, "transaction count: 2, got " + result.transactionCount);
  check(result.productVariantCount === 2, "product variant count: 2, got " + result.productVariantCount);
  check(result.distinctProductCount === 2, "distinct product count: 2, got " + result.distinctProductCount);

  Logger.log("PASS: testProductProfitabilityBasicAggregation | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityProductTypeGrain() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-H1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-C1", Tanggal: new Date(2026, 0, 11), ID_Prod: "P1", Tipe: "Cold", Qty: 3, HPP: 4000, HJ: 12000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Latte", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  check(result.productVariantCount === 2, "same product, different Tipe = 2 variants, got " + result.productVariantCount);
  check(result.distinctProductCount === 1, "same ID_Prod = 1 distinct product, got " + result.distinctProductCount);

  var hotRow = result.productMap["P1|Hot"];
  var coldRow = result.productMap["P1|Cold"];
  check(hotRow !== undefined, "Hot variant exists");
  check(coldRow !== undefined, "Cold variant exists");
  check(hotRow.units === 5, "Hot units: 5, got " + hotRow.units);
  check(coldRow.units === 3, "Cold units: 3, got " + coldRow.units);
  check(hotRow.revenue === 75000, "Hot revenue: 75000, got " + hotRow.revenue);
  check(coldRow.revenue === 36000, "Cold revenue: 36000, got " + coldRow.revenue);

  Logger.log("PASS: testProductProfitabilityProductTypeGrain | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityHotColdSplit() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-H1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-H2", Tanggal: new Date(2026, 0, 11), ID_Prod: "P2", Tipe: "Hot", Qty: 3, HPP: 6000, HJ: 18000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-C1", Tanggal: new Date(2026, 0, 12), ID_Prod: "P3", Tipe: "Cold", Qty: 4, HPP: 4000, HJ: 12000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [
      { ID_Prod: "P1", Produk: "Espresso", Kategori: "Beverage", Kind: "Normal", IsActive: true },
      { ID_Prod: "P2", Produk: "Latte", Kategori: "Beverage", Kind: "Normal", IsActive: true },
      { ID_Prod: "P3", Produk: "Iced Tea", Kategori: "Beverage", Kind: "Normal", IsActive: true }
    ],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  var hotUnits = 5 + 3;
  var hotRevenue = 75000 + 54000;
  var hotCogs = 25000 + 18000;
  var coldUnits = 4;
  var coldRevenue = 48000;
  var coldCogs = 16000;

  var derivedHot = { units: 0, revenue: 0 };
  var derivedCold = { units: 0, revenue: 0 };
  Object.keys(result.productMap).forEach(function(key) {
    var row = result.productMap[key];
    if (row.type === "Hot") { derivedHot.units += row.units; derivedHot.revenue += row.revenue; }
    else if (row.type === "Cold") { derivedCold.units += row.units; derivedCold.revenue += row.revenue; }
  });
  check(derivedHot.units === hotUnits, "hot units: " + hotUnits + ", got " + derivedHot.units);
  check(derivedCold.units === coldUnits, "cold units: " + coldUnits + ", got " + derivedCold.units);
  check(derivedHot.revenue === hotRevenue, "hot revenue: " + hotRevenue + ", got " + derivedHot.revenue);
  check(derivedCold.revenue === coldRevenue, "cold revenue: " + coldRevenue + ", got " + derivedCold.revenue);
  var totalFromSplit = derivedHot.units + derivedCold.units;
  check(totalFromSplit === result.units, "hot+cold units reconcile to summary: " + result.units);
  var totalRevenueFromSplit = derivedHot.revenue + derivedCold.revenue;
  check(Math.abs(totalRevenueFromSplit - result.revenue) < 0.001, "hot+cold revenue reconcile to summary");

  Logger.log("PASS: testProductProfitabilityHotColdSplit | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityGrossMargin() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 10, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  check(result.grossMargin === 66.7, "summary GP%: 66.7, got " + result.grossMargin);
  var row = result.productMap["P1|Hot"];
  check(row.grossMargin === 66.7, "row GP%: 66.7, got " + row.grossMargin);

  Logger.log("PASS: testProductProfitabilityGrossMargin | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityPerUnitMetrics() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 10, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);
  var row = result.productMap["P1|Hot"];

  check(row.averageSellingPrice === 15000, "ASP: 15000, got " + row.averageSellingPrice);
  check(row.averageCogsPerUnit === 5000, "avg COGS/unit: 5000, got " + row.averageCogsPerUnit);
  check(row.grossProfitPerUnit === 10000, "GP/unit: 10000, got " + row.grossProfitPerUnit);

  Logger.log("PASS: testProductProfitabilityPerUnitMetrics | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityMixMetrics() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 10, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-2", Tanggal: new Date(2026, 0, 11), ID_Prod: "P2", Tipe: "Cold", Qty: 5, HPP: 4000, HJ: 12000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [
      { ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true },
      { ID_Prod: "P2", Produk: "Tea", Kategori: "Beverage", Kind: "Normal", IsActive: true }
    ],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  var totalRevenue = 150000 + 60000;
  var totalGp = (150000 - 50000) + (60000 - 20000);
  var p1rev = result.productMap["P1|Hot"].revenue;
  var p2rev = result.productMap["P2|Cold"].revenue;
  var p1gp = result.productMap["P1|Hot"].grossProfit;
  var p2gp = result.productMap["P2|Cold"].grossProfit;

  check(Math.abs(result.productMap["P1|Hot"].revenueMix - p1rev / totalRevenue) < 0.000001,
    "P1 revenue mix correct");
  check(Math.abs(result.productMap["P2|Cold"].revenueMix - p2rev / totalRevenue) < 0.000001,
    "P2 revenue mix correct");
  check(Math.abs(result.productMap["P1|Hot"].grossProfitMix - p1gp / totalGp) < 0.000001,
    "P1 GP mix correct");
  check(Math.abs(result.productMap["P2|Cold"].grossProfitMix - p2gp / totalGp) < 0.000001,
    "P2 GP mix correct");

  var mixSum = result.productMap["P1|Hot"].revenueMix + result.productMap["P2|Cold"].revenueMix;
  check(Math.abs(mixSum - 1) < 0.000001, "revenue mix sums to 1.0");

  Logger.log("PASS: testProductProfitabilityMixMetrics | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityRanking() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 10, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-2", Tanggal: new Date(2026, 0, 11), ID_Prod: "P2", Tipe: "Cold", Qty: 20, HPP: 4000, HJ: 12000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-3", Tanggal: new Date(2026, 0, 12), ID_Prod: "P3", Tipe: "Hot", Qty: 5, HPP: 6000, HJ: 20000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [
      { ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true },
      { ID_Prod: "P2", Produk: "Tea", Kategori: "Beverage", Kind: "Normal", IsActive: true },
      { ID_Prod: "P3", Produk: "Juice", Kategori: "Beverage", Kind: "Normal", IsActive: true }
    ],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  check(result.productMap["P3|Hot"].revenueRank === 3, "P3 revenue rank 3 (20000*5=100k), got " + result.productMap["P3|Hot"].revenueRank);
  check(result.productMap["P1|Hot"].revenueRank === 2, "P1 revenue rank 2 (15000*10=150k), got " + result.productMap["P1|Hot"].revenueRank);
  check(result.productMap["P2|Cold"].revenueRank === 1, "P2 revenue rank 1 (12000*20=240k), got " + result.productMap["P2|Cold"].revenueRank);

  var gp1 = 150000 - 50000;
  var gp2 = 240000 - 80000;
  var gp3 = 100000 - 30000;

  check(result.productMap["P2|Cold"].grossProfitRank === 1, "P2 GP rank 1 (160k), got " + result.productMap["P2|Cold"].grossProfitRank);
  check(result.productMap["P1|Hot"].grossProfitRank === 2, "P1 GP rank 2 (100k), got " + result.productMap["P1|Hot"].grossProfitRank);
  check(result.productMap["P3|Hot"].grossProfitRank === 3, "P3 GP rank 3 (70k), got " + result.productMap["P3|Hot"].grossProfitRank);

  check(result.productMap["P2|Cold"].unitsRank === 1, "P2 units rank 1 (20), got " + result.productMap["P2|Cold"].unitsRank);
  check(result.productMap["P1|Hot"].unitsRank === 2, "P1 units rank 2 (10), got " + result.productMap["P1|Hot"].unitsRank);
  check(result.productMap["P3|Hot"].unitsRank === 3, "P3 units rank 3 (5), got " + result.productMap["P3|Hot"].unitsRank);

  Logger.log("PASS: testProductProfitabilityRanking | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityPeriodFiltering() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-IN", Tanggal: new Date(2026, 0, 15), ID_Prod: "P1", Tipe: "Hot", Qty: 10, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-OUT", Tanggal: new Date(2026, 1, 15), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var janPeriod = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var febPeriod = { filter: "custom", startDate: "2026-02-01", endDate: "2026-02-28", label: "Feb 2026" };

  var jan = buildProductProfitability(filterTransactionsByDateRange(canonical.records, janPeriod), products, null, janPeriod, null);
  var feb = buildProductProfitability(filterTransactionsByDateRange(canonical.records, febPeriod), products, null, febPeriod, null);

  check(jan.revenue === 150000, "Jan revenue: 150000, got " + jan.revenue);
  check(jan.units === 10, "Jan units: 10, got " + jan.units);
  check(feb.revenue === 75000, "Feb revenue: 75000, got " + feb.revenue);
  check(feb.units === 5, "Feb units: 5, got " + feb.units);

  Logger.log("PASS: testProductProfitabilityPeriodFiltering | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityComparison() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var currentRecords = [
    { id: "SAL-1", date: new Date(2026, 0, 10), dateKey: "2026-01-10", transactionType: "Sales", productId: "P1", product: "Coffee", type: "Hot", productCategory: "Beverage", productIsActive: true, qty: 10, hpp: 5000, price: 15000, revenue: 150000, cogs: 50000, isActive: true },
    { id: "SAL-2", date: new Date(2026, 0, 11), dateKey: "2026-01-11", transactionType: "Sales", productId: "P2", product: "Tea", type: "Cold", productCategory: "Beverage", productIsActive: true, qty: 5, hpp: 4000, price: 12000, revenue: 60000, cogs: 20000, isActive: true }
  ];

  var comparisonRecords = [
    { id: "SAL-C1", date: new Date(2025, 0, 10), dateKey: "2025-01-10", transactionType: "Sales", productId: "P1", product: "Coffee", type: "Hot", productCategory: "Beverage", productIsActive: true, qty: 8, hpp: 5000, price: 15000, revenue: 120000, cogs: 40000, isActive: true },
    { id: "SAL-C2", date: new Date(2025, 0, 11), dateKey: "2025-01-11", transactionType: "Sales", productId: "P2", product: "Tea", type: "Cold", productCategory: "Beverage", productIsActive: true, qty: 6, hpp: 4000, price: 12000, revenue: 72000, cogs: 24000, isActive: true }
  ];

  var products = buildCanonicalMasterMap([
    { ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true },
    { ID_Prod: "P2", Produk: "Tea", Kategori: "Beverage", Kind: "Normal", IsActive: true }
  ], "ID_Prod", "Products");

  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var compPeriod = { startDate: "2025-01-01", endDate: "2025-01-31", label: "Compared with 2025-01-01 to 2025-01-31" };
  var result = buildProductProfitability(currentRecords, products, comparisonRecords, period, compPeriod);

  check(result.comparisonData !== undefined, "comparison data present");
  check(result.comparisonData.summary.revenue === 192000, "comp revenue: 120000+72000=192000, got " + result.comparisonData.summary.revenue);

  var compP1 = result.comparisonData.productMap["P1|Hot"];
  check(compP1 !== undefined, "comp P1 exists");
  check(compP1.revenue === 120000, "comp P1 revenue: 120000, got " + compP1.revenue);

  check(Math.abs((150000 - 120000) / 120000 - 0.25) < 0.001, "P1 revenue change: 25%");

  var compP2 = result.comparisonData.productMap["P2|Cold"];
  check(Math.abs((60000 - 72000) / 72000 - (-1 / 6)) < 0.001, "P2 revenue change: -16.67%");

  Logger.log("PASS: testProductProfitabilityComparison | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityInactiveExcluded() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-ACTIVE", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-INACTIVE", Tanggal: new Date(2026, 0, 11), ID_Prod: "P1", Tipe: "Hot", Qty: 100, HPP: 5000, HJ: 15000, IsActive: false, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  check(result.revenue === 75000, "inactive excluded: revenue = 75000, got " + result.revenue);
  check(result.units === 5, "inactive excluded: units = 5, got " + result.units);

  Logger.log("PASS: testProductProfitabilityInactiveExcluded | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityZeroRevenueDenominator() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-ZERO", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 0, HJ: 0, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Free Sample", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  var row = result.productMap["P1|Hot"];
  check(row.grossMargin === null, "zero revenue GP% is null, got " + row.grossMargin);
  check(row.revenueMix === null, "zero revenue mix is null, got " + row.revenueMix);

  Logger.log("PASS: testProductProfitabilityZeroRevenueDenominator | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityZeroUnitsDenominator() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-ZERO-QTY", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 0, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  var row = result.productMap["P1|Hot"];
  check(row.averageSellingPrice === null, "zero units ASP is null, got " + row.averageSellingPrice);
  check(row.averageCogsPerUnit === null, "zero units avg COGS is null, got " + row.averageCogsPerUnit);
  check(row.grossProfitPerUnit === null, "zero units GP/unit is null, got " + row.grossProfitPerUnit);

  Logger.log("PASS: testProductProfitabilityZeroUnitsDenominator | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityMissingIdentityHandling() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-OK", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-UNKNOWN", Tanggal: new Date(2026, 0, 11), ID_Prod: "P404", Tipe: "Hot", Qty: 2, HPP: 1000, HJ: 3000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  check(canonical.sourceQuality.unresolvedProducts.length > 0, "P404 unresolved at canonical layer");
  check(canonical.sourceQuality.unresolvedProducts.some(function(p) { return p.productId === "P404"; }), "P404 specifically unresolved");
  check(result.revenue === 75000, "only valid rows included in revenue");
  check(result.productVariantCount === 1, "only P1 in product count");

  Logger.log("PASS: testProductProfitabilityMissingIdentityHandling | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityReconcilesToFinance() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 10, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-2", Tanggal: new Date(2026, 0, 15), ID_Prod: "P1", Tipe: "Cold", Qty: 5, HPP: 4000, HJ: 12000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-INACTIVE", Tanggal: new Date(2026, 0, 20), ID_Prod: "P2", Tipe: "Hot", Qty: 99, HPP: 1000, HJ: 3000, IsActive: false, Source: "tabsal" }
    ],
    expenses: [],
    products: [
      { ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true, RevenueAccountCode: "4100", COGSAccountCode: "5100" },
      { ID_Prod: "P2", Produk: "Inactive", Kategori: "Beverage", Kind: "Normal", IsActive: true, RevenueAccountCode: "4100", COGSAccountCode: "5100" }
    ],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var productsMap = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var accounts = [
    { AccountCode: "4100", AccountName: "Sales", AccountType: "Revenue", StatementGroup: "Revenue", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "5100", AccountName: "COGS", AccountType: "COGS", StatementGroup: "COGS", CashFlowGroup: "Operating", IsActive: true }
  ];
  var assets = [{ ID_Asset: "AST-1", BiayaPerolehan: 999999999, UmurEkonomisBulan: 1 }];
  var ledger = [{ ID_Dep: "DEP-0", Period: new Date(2026, 0, 1), ID_Asset: "AST-1", Depreciation: 0 }];
  var depreciationSource = buildFinanceDepreciationSource(ledger, assets);

  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var financePnl = buildFinanceProfitAndLoss(canonical, accounts, period, depreciationSource);
  var pp = buildProductProfitability(filterTransactionsByDateRange(canonical.records, period), productsMap, null, period, null);

  check(Math.abs(pp.revenue - financePnl.summary.revenue) < 0.000001,
    "Product Revenue == P&L Revenue: " + pp.revenue + " vs " + financePnl.summary.revenue);
  check(Math.abs(pp.cogs - financePnl.summary.cogs) < 0.000001,
    "Product COGS == P&L COGS: " + pp.cogs + " vs " + financePnl.summary.cogs);
  check(Math.abs(pp.grossProfit - financePnl.summary.grossProfit) < 0.000001,
    "Product GP == P&L GP: " + pp.grossProfit + " vs " + financePnl.summary.grossProfit);

  Logger.log("PASS: testProductProfitabilityReconcilesToFinance | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityFailureIsolation() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var ppSource = buildProductProfitability.toString() + buildProductProfitabilityComparison.toString() + getProductProfitabilityDataWithRuntime.toString() + getProductProfitabilityData.toString();

  ["getFinanceData(", "buildFinanceProfitAndLoss("].forEach(function(token) {
    check(ppSource.indexOf(token) === -1, "Product Profitability must not call " + token);
  });

  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true, RevenueAccountCode: "4100", COGSAccountCode: "5100" }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var productsMap = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var accounts = [
    { AccountCode: "4100", AccountName: "Sales", AccountType: "Revenue", StatementGroup: "Revenue", CashFlowGroup: "Operating", IsActive: true },
    { AccountCode: "5100", AccountName: "COGS", AccountType: "COGS", StatementGroup: "COGS", CashFlowGroup: "Operating", IsActive: true }
  ];
  var assets = [{ ID_Asset: "AST-1", BiayaPerolehan: 999999999, UmurEkonomisBulan: 1 }];
  var ledger = [{ ID_Dep: "DEP-0", Period: new Date(2026, 0, 1), ID_Asset: "AST-1", Depreciation: 0 }];
  var depreciationSource = buildFinanceDepreciationSource(ledger, assets);

  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var financePnl = buildFinanceProfitAndLoss(canonical, accounts, period, depreciationSource);
  var pp = buildProductProfitability(filterTransactionsByDateRange(canonical.records, period), productsMap, null, period, null);

  check(financePnl.summary.revenue === 75000, "Finance P&L revenue still correct after Product Profitability run");
  check(pp.revenue === 75000, "Product Profitability revenue correct, independent of Finance");

  Logger.log("PASS: testProductProfitabilityFailureIsolation | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityResponseContract() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [{ ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true }],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var productsMap = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var pp = buildProductProfitability(filterTransactionsByDateRange(canonical.records, period), productsMap, null, period, null);

  check(pp.productVariantCount !== undefined, "summary has productVariantCount");
  check(pp.distinctProductCount !== undefined, "summary has distinctProductCount");
  check(typeof pp.units === "number", "summary has units as number");
  check(typeof pp.revenue === "number", "summary has revenue as number");
  check(typeof pp.cogs === "number", "summary has cogs as number");
  check(typeof pp.grossProfit === "number", "summary has grossProfit as number");
  check(pp.grossMargin === null || typeof pp.grossMargin === "number", "summary has grossMargin");
  check(typeof pp.transactionCount === "number", "summary has transactionCount as number");
  check(pp.topRevenueProduct !== undefined, "summary has topRevenueProduct");
  check(pp.topGrossProfitProduct !== undefined, "summary has topGrossProfitProduct");
  check(pp.topUnitsProduct !== undefined, "summary has topUnitsProduct");

  check(pp.quality !== undefined, "has quality");
  check(Array.isArray(pp.quality.missingIdentity), "quality has missingIdentity array");
  check(Array.isArray(pp.quality.missingHpp), "quality has missingHpp array");
  check(Array.isArray(pp.quality.ungovernedType), "quality has ungovernedType array");

  Logger.log("PASS: testProductProfitabilityResponseContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityUngovernedType() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var source = {
    sales: [
      { ID_Trx: "SAL-H1", Tanggal: new Date(2026, 0, 10), ID_Prod: "P1", Tipe: "Hot", Qty: 5, HPP: 5000, HJ: 15000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-C1", Tanggal: new Date(2026, 0, 11), ID_Prod: "P2", Tipe: "Cold", Qty: 4, HPP: 4000, HJ: 12000, IsActive: true, Source: "tabsal" },
      { ID_Trx: "SAL-U1", Tanggal: new Date(2026, 0, 12), ID_Prod: "P3", Tipe: "Food", Qty: 3, HPP: 3000, HJ: 10000, IsActive: true, Source: "tabsal" }
    ],
    expenses: [],
    products: [
      { ID_Prod: "P1", Produk: "Espresso", Kategori: "Beverage", Kind: "Normal", IsActive: true },
      { ID_Prod: "P2", Produk: "Iced Tea", Kategori: "Beverage", Kind: "Normal", IsActive: true },
      { ID_Prod: "P3", Produk: "Sandwich", Kategori: "Food", Kind: "Normal", IsActive: true }
    ],
    expenseItems: []
  };

  var canonical = buildCanonicalTransactionData(source);
  var products = buildCanonicalMasterMap(source.products, "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability(canonical.records, products, null, period, null);

  // unexpected type NOT classified as Hot
  check(result.productMap["P3|Hot"] === undefined, "ungoverned type not classified as Hot");
  // unexpected type NOT classified as Cold
  check(result.productMap["P3|Cold"] === undefined, "ungoverned type not classified as Cold");

  // row in overall population keyed as P3|Food
  var ungovernedRow = result.productMap["P3|Food"];
  check(ungovernedRow !== undefined, "ungoverned row exists in productMap as P3|Food");
  check(ungovernedRow.units === 3, "ungoverned units: 3, got " + ungovernedRow.units);
  check(ungovernedRow.revenue === 30000, "ungoverned revenue: 30000, got " + ungovernedRow.revenue);
  check(ungovernedRow.cogs === 9000, "ungoverned cogs: 9000, got " + ungovernedRow.cogs);

  // quality reports ungoverned type condition
  check(result.quality.ungovernedType.length === 1, "quality has 1 ungoverned type, got " + result.quality.ungovernedType.length);
  check(result.quality.ungovernedType[0].productId === "P3", "ungoverned type is P3");
  check(result.quality.ungovernedType[0].type === "Food", "ungoverned type value is Food");
  check(result.quality.missingIdentity.length === 0, "no missing identity for valid rows");
  check(result.quality.missingHpp.length === 0, "no missing HPP for valid rows");

  // Hot + Cold reconciliation reflects exception transparently
  var hotRevenue = result.productMap["P1|Hot"].revenue;
  var coldRevenue = result.productMap["P2|Cold"].revenue;
  var ungovernedRevenue = ungovernedRow.revenue;
  check(hotRevenue + coldRevenue + ungovernedRevenue === result.revenue,
    "hot + cold + ungoverned = total revenue: " + result.revenue);

  var hotCogs = result.productMap["P1|Hot"].cogs;
  var coldCogs = result.productMap["P2|Cold"].cogs;
  var ungovernedCogs = ungovernedRow.cogs;
  check(hotCogs + coldCogs + ungovernedCogs === result.cogs,
    "hot + cold + ungoverned = total cogs: " + result.cogs);

  // overall Revenue/COGS/GP authoritative
  check(result.grossProfit === result.revenue - result.cogs,
    "overall GP = revenue - cogs: " + result.grossProfit);
  check(result.transactionCount === 3, "total transactions: 3, got " + result.transactionCount);
  check(result.productVariantCount === 3, "3 variants, got " + result.productVariantCount);

  Logger.log("PASS: testProductProfitabilityUngovernedType | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityZeroComparisonDenominator() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var currentRecords = [
    { id: "SAL-1", date: new Date(2026, 0, 10), dateKey: "2026-01-10", transactionType: "Sales",
      productId: "P1", product: "Coffee", type: "Hot", productCategory: "Beverage", productIsActive: true,
      qty: 10, hpp: 5000, price: 15000, revenue: 150000, cogs: 50000, isActive: true }
  ];

  // Comparison: P1|Hot with revenue=0, GP=0 (zero denominator)
  var comparisonRecords = [
    { id: "SAL-C1", date: new Date(2025, 11, 10), dateKey: "2025-12-10", transactionType: "Sales",
      productId: "P1", product: "Coffee", type: "Hot", productCategory: "Beverage", productIsActive: true,
      qty: 0, hpp: 0, price: 0, revenue: 0, cogs: 0, isActive: true }
  ];

  var productsList = [
    { ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true }
  ];

  var origGetCanonical = getCanonicalTransactionData;
  var origReadTable = readCanonicalTable;

  getCanonicalTransactionData = function() {
    return { records: currentRecords.concat(comparisonRecords) };
  };
  readCanonicalTable = function() {
    return productsList;
  };

  try {
    var mockRuntime = { spreadsheet: {} };
    var result = getProductProfitabilityDataWithRuntime(mockRuntime, "custom", "2026-01-01", "2026-01-31");

    var p1Entry = null;
    for (var i = 0; i < result.products.length; i++) {
      if (result.products[i].productId === "P1") { p1Entry = result.products[i]; break; }
    }
    check(p1Entry !== null, "P1 entry found in products");

    // revenueChange === null when comp Revenue=0
    check(p1Entry.comparisonRevenue === 0, "comp revenue is 0, got " + p1Entry.comparisonRevenue);
    check(p1Entry.revenueChange === null, "revenueChange is null when comp revenue=0, got " + p1Entry.revenueChange);

    // grossProfitChange === null when comp GP=0
    check(p1Entry.comparisonGrossProfit === 0, "comp GP is 0, got " + p1Entry.comparisonGrossProfit);
    check(p1Entry.grossProfitChange === null, "grossProfitChange is null when comp GP=0, got " + p1Entry.grossProfitChange);

    // Never 0, Infinity, -Infinity, NaN
    var rc = p1Entry.revenueChange;
    check(rc === null || (typeof rc === "number" && isFinite(rc) && !isNaN(rc)),
      "revenueChange is null or finite number, got " + rc);
    var gc = p1Entry.grossProfitChange;
    check(gc === null || (typeof gc === "number" && isFinite(gc) && !isNaN(gc)),
      "grossProfitChange is null or finite number, got " + gc);

  } finally {
    getCanonicalTransactionData = origGetCanonical;
    readCanonicalTable = origReadTable;
  }

  Logger.log("PASS: testProductProfitabilityZeroComparisonDenominator | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityAbsentVariantComparison() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  // Current: P1|Hot and P2|Hot
  var currentRecords = [
    { id: "SAL-1", date: new Date(2026, 0, 10), dateKey: "2026-01-10", transactionType: "Sales",
      productId: "P1", product: "Coffee", type: "Hot", productCategory: "Beverage", productIsActive: true,
      qty: 10, hpp: 5000, price: 15000, revenue: 150000, cogs: 50000, isActive: true },
    { id: "SAL-2", date: new Date(2026, 0, 11), dateKey: "2026-01-11", transactionType: "Sales",
      productId: "P2", product: "Tea", type: "Hot", productCategory: "Beverage", productIsActive: true,
      qty: 5, hpp: 4000, price: 12000, revenue: 60000, cogs: 20000, isActive: true }
  ];

  // Comparison: P1|Hot and P3|Hot (no P2; extra P3)
  var comparisonRecords = [
    { id: "SAL-C1", date: new Date(2025, 11, 10), dateKey: "2025-12-10", transactionType: "Sales",
      productId: "P1", product: "Coffee", type: "Hot", productCategory: "Beverage", productIsActive: true,
      qty: 8, hpp: 5000, price: 15000, revenue: 120000, cogs: 40000, isActive: true },
    { id: "SAL-C3", date: new Date(2025, 11, 12), dateKey: "2025-12-12", transactionType: "Sales",
      productId: "P3", product: "Juice", type: "Hot", productCategory: "Beverage", productIsActive: true,
      qty: 3, hpp: 6000, price: 18000, revenue: 54000, cogs: 18000, isActive: true }
  ];

  var productsList = [
    { ID_Prod: "P1", Produk: "Coffee", Kategori: "Beverage", Kind: "Normal", IsActive: true },
    { ID_Prod: "P2", Produk: "Tea", Kategori: "Beverage", Kind: "Normal", IsActive: true },
    { ID_Prod: "P3", Produk: "Juice", Kategori: "Beverage", Kind: "Normal", IsActive: true }
  ];

  var origGetCanonical = getCanonicalTransactionData;
  var origReadTable = readCanonicalTable;

  getCanonicalTransactionData = function() {
    return { records: currentRecords.concat(comparisonRecords) };
  };
  readCanonicalTable = function() {
    return productsList;
  };

  try {
    var mockRuntime = { spreadsheet: {} };
    var result = getProductProfitabilityDataWithRuntime(mockRuntime, "custom", "2026-01-01", "2026-01-31");

    var p1Entry = null, p2Entry = null;
    for (var i = 0; i < result.products.length; i++) {
      if (result.products[i].productId === "P1") p1Entry = result.products[i];
      if (result.products[i].productId === "P2") p2Entry = result.products[i];
    }

    check(p1Entry !== null, "P1 found in current products");
    check(p2Entry !== null, "P2 found in current products");

    // P1 exists in both periods → has comparison data
    check(p1Entry.comparisonRevenue === 120000, "P1 comp revenue: 120000, got " + p1Entry.comparisonRevenue);
    check(p1Entry.revenueChange !== null, "P1 has revenue change");

    // CASE 1: P2 in current but not comparison → null changes
    check(p2Entry.comparisonRevenue === null, "P2 absent from comparison → comp revenue null");
    check(p2Entry.comparisonGrossProfit === null, "P2 absent from comparison → comp GP null");
    check(p2Entry.revenueChange === null, "P2 absent from comparison → revenueChange null");
    check(p2Entry.grossProfitChange === null, "P2 absent from comparison → grossProfitChange null");

    // identity remains ID_Prod + Tipe
    check(p2Entry.productId === "P2" && p2Entry.type === "Hot", "P2 identity: P2|Hot");

    // CASE 2: P3 in comparison but not current → does NOT appear in current products
    var p3Found = false;
    for (var j = 0; j < result.products.length; j++) {
      if (result.products[j].productId === "P3") { p3Found = true; break; }
    }
    check(!p3Found, "P3 (comparison-only) does not appear in current products");

    // no unrelated variant matched by name alone
    check(p2Entry.productName !== "Juice", "P2 not matched to P3 by name");

  } finally {
    getCanonicalTransactionData = origGetCanonical;
    readCanonicalTable = origReadTable;
  }

  Logger.log("PASS: testProductProfitabilityAbsentVariantComparison | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testProductProfitabilityEmptyDataset() {
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  // --- path 1: buildProductProfitability directly ---
  var productsMap = buildCanonicalMasterMap([], "ID_Prod", "Products");
  var period = { filter: "custom", startDate: "2026-01-01", endDate: "2026-01-31", label: "Jan 2026" };
  var result = buildProductProfitability([], productsMap, null, period, null);

  check(result.productVariantCount === 0, "zero variants, got " + result.productVariantCount);
  check(result.distinctProductCount === 0, "zero distinct products, got " + result.distinctProductCount);
  check(result.units === 0, "zero units, got " + result.units);
  check(result.revenue === 0, "zero revenue, got " + result.revenue);
  check(result.cogs === 0, "zero cogs, got " + result.cogs);
  check(result.grossProfit === 0, "zero GP, got " + result.grossProfit);
  check(result.transactionCount === 0, "zero transactions, got " + result.transactionCount);
  check(result.grossMargin === null, "GP% null when zero revenue, got " + result.grossMargin);
  check(result.topRevenueProduct === null, "no top revenue product");
  check(result.topGrossProfitProduct === null, "no top GP product");
  check(result.topUnitsProduct === null, "no top units product");
  check(result.quality !== undefined, "quality exists");
  check(Array.isArray(result.quality.missingIdentity), "missingIdentity is array");
  check(Array.isArray(result.quality.missingHpp), "missingHpp is array");
  check(Array.isArray(result.quality.ungovernedType), "ungovernedType is array");
  check(result.quality.missingIdentity.length === 0, "no missing identity issues");
  check(result.quality.missingHpp.length === 0, "no missing HPP issues");
  check(result.quality.ungovernedType.length === 0, "no ungoverned type issues");

  // --- path 2: getProductProfitabilityDataWithRuntime for status/products ---
  var origGetCanonical = getCanonicalTransactionData;
  var origReadTable = readCanonicalTable;

  getCanonicalTransactionData = function() { return { records: [] }; };
  readCanonicalTable = function() { return []; };

  try {
    var mockRuntime = { spreadsheet: {} };
    var rt = getProductProfitabilityDataWithRuntime(mockRuntime, "custom", "2026-01-01", "2026-01-31");

    check(rt.status === "SUCCESS", "status is SUCCESS, got " + rt.status);
    check(Array.isArray(rt.products), "products is array");
    check(rt.products.length === 0, "products is empty array");
    check(rt.summary.units === 0, "summary units: 0");
    check(rt.summary.revenue === 0, "summary revenue: 0");
    check(rt.summary.cogs === 0, "summary cogs: 0");
    check(rt.summary.grossProfit === 0, "summary GP: 0");
    check(rt.summary.grossMargin === null, "summary GP% null, got " + rt.summary.grossMargin);
    check(rt.summary.topRevenueProduct === null, "no top revenue product in summary");
    check(rt.summary.topGrossProfitProduct === null, "no top GP product in summary");
    check(rt.summary.topUnitsProduct === null, "no top units product in summary");
    check(rt.quality !== undefined, "quality exists in full output");
    check(rt.quality.status === "GOOD", "quality status GOOD, got " + rt.quality.status);
    check(typeof rt.quality.issueCount === "number", "issueCount is number");
    check(rt.quality.issueCount === 0, "zero quality issues");
    check(rt.hotCold !== undefined, "hotCold present");
    check(rt.hotCold.hot.units === 0, "hot units: 0");
    check(rt.hotCold.cold.units === 0, "cold units: 0");
  } finally {
    getCanonicalTransactionData = origGetCanonical;
    readCanonicalTable = origReadTable;
  }

  Logger.log("PASS: testProductProfitabilityEmptyDataset | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}
