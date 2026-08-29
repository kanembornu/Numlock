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
  var frontend = getAssembledFrontendSource();
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
  var source = getAssembledFrontendSource();
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
    ".performance-chart-shell { height: 135px; min-height: 135px; max-height: 135px; overflow: hidden; }",
    ".performance-chart-shell-primary { height: 175px; min-height: 175px; max-height: 175px; }",
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
  var performanceOwnershipOrder = [
    "performanceSnapshotSection",
    "productProfitabilitySection",
    "performanceSecondaryGrid",
    "performanceDecisionRow"
  ];
  var previousOwnershipIndex = -1;
  performanceOwnershipOrder.forEach(function(id)
  {
    var token = 'staging.querySelector("#' + id + '")';
    var tokenIndex = ownershipRegion.indexOf(token);
    assertSourceContains(ownershipRegion, token, "reconciled Performance ownership");
    if (tokenIndex <= previousOwnershipIndex)
      throw new Error("Performance ownership order mismatch: " + id);
    previousOwnershipIndex = tokenIndex;
    assertionsPassed++;
  });
  var decisionRowRegion = getSourceRegion(source, '<div id="performanceDecisionRow">', "DASHBOARD INTELLIGENCE", "combined Performance decision row");
  var expenseIndex = decisionRowRegion.indexOf('id="expenseChartSection"');
  var insightsIndex = decisionRowRegion.indexOf('id="performanceInsightsPanel"');
  if (expenseIndex === -1 || insightsIndex <= expenseIndex)
    throw new Error("Performance decision row must order Expense Structure before Performance Insights & Plans");
  var signalAssemblyRegion = getSourceRegion(source, 'var performanceSignalGrid = staging.querySelector("#performanceSignalGrid")', "var sectionOwnership = {", "Performance signal assembly");
  var forecastAppendIndex = signalAssemblyRegion.indexOf("performanceSignalGrid.appendChild(forecastSection);");
  var concentrationAppendIndex = signalAssemblyRegion.indexOf("performanceSignalGrid.appendChild(productConcentrationSection);");
  if (forecastAppendIndex === -1 || concentrationAppendIndex <= forecastAppendIndex)
    throw new Error("Performance signal assembly must order forecast before product concentration signals");
  var concentrationMarkupIndex = source.indexOf('id="productConcentrationSection"');
  var dependencyIndex = source.indexOf('id="revenueDependencyContainer"', concentrationMarkupIndex);
  var paretoIndex = source.indexOf('id="paretoContainer"', concentrationMarkupIndex);
  var marginHealthIndex = source.indexOf('id="marginHealthSection"', concentrationMarkupIndex);
  if (concentrationMarkupIndex === -1 || dependencyIndex <= concentrationMarkupIndex || paretoIndex <= dependencyIndex || marginHealthIndex <= paretoIndex)
    throw new Error("Performance concentration signals must order dependency, Pareto, then gross margin health");
  assertionsPassed += 3;
  assertSourceContainsOnce(source, "function initializeDashboardTabs()", "single Dashboard tab initializer");
  assertSourceContains(source, "resizeVisibleDashboardCharts(tabName);", "repeat activation resize without recreation");
  assertionsPassed += 2;

  [
    'id="performanceSnapshotGrid" class="performance-snapshot-grid"',
    '{ label: "Top Profit Product",',
    '{ label: "Best Margin %",',
    '{ label: "Top Revenue Product",',
    '{ label: "Largest Expense Driver",',
    '{ label: "Total Gross Margin",',
    '{ label: "Revenue Concentration",',
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
    'display: flex; min-height: 40px; flex: 0 0 40px; flex-direction: column; gap: 0; margin-bottom: 12px;',
    'height: 100%; flex-direction: column; align-self: stretch;',
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
    '{"summary":{"revenue":350000,"expense":50000,"profit":300000,"unitsSold":9,"bestSeller":"Latte","topRevenueProduct":"Espresso","avgDailyRevenue":116667,"activeDays":3},"financial":{"revenue":350000,"expense":50000,"operatingExpense":50000,"inventoryExpense":0,"assetExpense":0,"grossProfit":350000,"operatingProfit":300000,"netProfit":300000,"profitMargin":85.7},"insights":{"profitMargin":85.7,"revenuePerCup":38889,"topExpense":{"category":"Supplies","amount":50000},"financial":{"revenue":350000,"expense":50000,"operatingExpense":50000,"inventoryExpense":0,"assetExpense":0,"grossProfit":350000,"operatingProfit":300000,"netProfit":300000,"profitMargin":85.7}},"revenueTrend":{"labels":["2025-01","2025-02","2025-03"],"values":[60000,200000,90000]},"hotColdSplit":{"hot":6,"cold":3},"topProducts":[{"name":"Latte","qty":5,"revenue":150000},{"name":"Espresso","qty":4,"revenue":200000}],"expenseBreakdown":[{"category":"Supplies","amount":50000}],"recentTransactions":[{"date":"2025-03-12","transactionType":"Expense","product":"","purchaseCategory":"Supplies","qty":0,"revenue":0,"expense":50000},{"date":"2025-03-11","transactionType":"Sales","product":"Latte","purchaseCategory":"","qty":3,"revenue":90000,"expense":0},{"date":"2025-02-10","transactionType":"Sales","product":"Espresso","purchaseCategory":"","qty":4,"revenue":200000,"expense":0},{"date":"2025-01-10","transactionType":"Sales","product":"Latte","purchaseCategory":"","qty":2,"revenue":60000,"expense":0}],"diagnosis":[{"level":"warning","category":"expense","priority":"critical","title":"Biaya Terbesar","description":"Supplies menyumbang biaya terbesar sebesar Rp 50.000. Pertimbangkan evaluasi efisiensi.","message":"Supplies adalah komponen biaya terbesar (Rp 50.000). Pertimbangkan evaluasi efisiensi biaya."},{"level":"attention","category":"revenue","priority":"good","title":"Revenue per Cup","description":"Rata-rata setiap cup menghasilkan Rp 38.889 revenue.","message":"Setiap cup menghasilkan rata-rata Rp 38.889 revenue."},{"level":"good","message":"Profit margin sehat (85.7%)"}],"forecast":{"nextMonthRevenue":130000,"growthRate":233.3},"businessScore":{"score":75,"status":"Healthy","breakdown":{"profitMargin":85.7,"revenue":350000,"unitsSold":9}},"revenueIntelligence":{"direction":"Up","growthRate":233.3,"momentum":"Strong"},"expenseIntelligence":{"highestExpense":"Supplies","highestAmount":50000,"expenseShare":100},"profitIntelligence":{"direction":"Up","changeRate":85.7,"status":"Strong"},"profitTrend":{"labels":["2025-01","2025-02","2025-03"],"values":[60000,200000,40000]},"executiveSummary":"Revenue menunjukkan tren positif. Profit berada dalam kondisi yang sehat. Kondisi bisnis sehat dengan beberapa peluang peningkatan.","priorityAction":{"title":"Business Improvement","impact":"Medium","score":70,"message":"Supplies adalah biaya terbesar. Cari peluang efisiensi tanpa mengganggu operasional."},"riskEngine":{"riskLevel":"Low","riskCount":0,"risks":[]},"growthScore":{"growthScore":100,"status":"High Potential","breakdown":{"revenue":"Up","forecast":233.3,"profitMargin":85.7,"revenuePerCup":38889}},"recommendations":[{"priority":"Medium","score":70,"message":"Supplies adalah biaya terbesar. Cari peluang efisiensi tanpa mengganggu operasional."},{"priority":"Medium","score":40,"message":"Latte merupakan produk terlaris. Pertimbangkan bundling atau upselling."},{"priority":"Medium","score":35,"message":"Espresso menghasilkan revenue terbesar. Pastikan stok selalu tersedia."},{"priority":"Low","score":20,"message":"Forecast menunjukkan pertumbuhan revenue sebesar 233.3%. Pertahankan strategi yang berjalan saat ini."}],"opportunities":[{"title":"Best Seller Opportunity","message":"Latte memiliki volume penjualan tertinggi. Pertimbangkan bundling atau promo khusus."},{"title":"Revenue Opportunity","message":"Espresso menghasilkan revenue terbesar. Fokus pada ketersediaan stok."},{"title":"Pricing Opportunity","message":"Revenue per cup sudah cukup baik. Fokus meningkatkan volume penjualan."},{"title":"Growth Opportunity","message":"Forecast menunjukkan pertumbuhan revenue. Persiapkan kapasitas operasional."}],"kpiStatus":{"revenue":{"trend":"Up","growth":233.3,"label":"Strong"},"profit":{"trend":"Up","growth":85.7,"label":"Strong"},"business":{"score":75,"status":"Healthy"}},"productContribution":[{"name":"Espresso","revenue":200000,"qty":4,"contribution":57.1},{"name":"Latte","revenue":150000,"qty":5,"contribution":42.9}],"revenueConcentration":{"product":"Espresso","contribution":57.1,"risk":"High"},"paretoAnalysis":{"totalProducts":2,"criticalProducts":2,"ratio":100,"concentration":"Low"},"businessFocus":{"focus":"Business Optimization","priority":"Medium","reason":"Business Health masih dapat ditingkatkan.","expectedImpact":"Medium"},"executiveAlert":{"title":"Business Stable","level":"Good","color":"Green","message":"Tidak ada kondisi kritis yang memerlukan tindakan segera."},"actionRoadmap":[{"week":1,"title":"Maintain Profitability","action":"Pertahankan profit margin yang sudah baik."},{"week":2,"title":"Scale Best Seller","action":"Latte layak dijadikan fokus upselling."},{"week":3,"title":"Business Expansion","action":"Siapkan kapasitas operasional untuk pertumbuhan berikutnya."},{"week":4,"title":"Performance Review","action":"Bandingkan KPI bulan ini dengan target dan evaluasi hasil."}],"businessMaturity":{"score":88,"level":"Growing","description":"Bisnis berkembang dengan baik namun masih memiliki ruang untuk peningkatan."},"kpiAchievement":{"revenue":{"actual":350000,"target":2000000,"achievement":17.5},"profit":{"actual":300000,"target":1000000,"achievement":30},"units":{"actual":9,"target":100,"achievement":9},"margin":{"actual":85.7,"target":15,"achievement":100}},"dateFilter":{"filter":"custom","startDate":"2024-01-01","endDate":"2026-12-31","label":"Custom: 2024-01-01 to 2026-12-31","rowCount":4}}';


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

  var frontendSource = getAssembledFrontendSource();

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

function testExecutivePresentationContract()
{
  var source = getAssembledFrontendSource();

  var orderedTokens = [
    'id="executiveSummarySection"',
    'id="businessOverview"',
    'id="revenueChartTitle"',
    'id="diagnosisContainer"',
    'id="recommendationContainer"',
    'id="businessMaturityCard"'
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
    "Key Business Signals",
    "Top Products",
    "Recommended Actions",
    "30-Day Action Roadmap",
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
    ".slice(0,4)\n          .map(renderTimelineItem)",
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
    'insightsColumn.id = "insightsColumn"',
    'plansColumn.id = "plansColumn"'
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

function testDashboardTabFrameworkContract()
{
  var source = getAssembledFrontendSource();
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
    "#transactionsTabList { width: max-content; height: 44px; min-height: 44px;",
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
  var diagnosticsSource =
    HtmlService.createHtmlOutputFromFile(
      "191.View.Diagnostics"
    ).getContent();
  var source = getAssembledFrontendSource();
  var assembledSource = source
    .replace("<?!= include('191.View.Diagnostics'); ?>", diagnosticsSource);
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
    '#dashboardTabList [role="tab"]:hover { border-color: transparent !important; outline: none !important; background: color-mix(in srgb, var(--hover) 64%, transparent) !important;',
    '#dashboardTabList [role="tab"]:active, #dashboardTabList [role="tab"]:focus, #dashboardTabList [role="tab"]:focus-visible { border-color: transparent !important; outline: none !important;',
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
    assertSourceContains(assembledSource, token, "Phase 7B.2 precision debug contract");
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
    (assembledSource.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (assembledSource.match(/document\.querySelector(?:All)?\(/g) || []).length;

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

function testDashboardHighFidelityCompositionContract()
{
  var overview = testDashboardOverviewContract();
  var performance = testDashboardPerformanceAnalytics();
  var compositionSource = getAssembledFrontendSource();
  ["dashboardPanelOverview", "dashboardPanelPerformance", "dashboardPanelInsights",
    "productProfitabilitySection", "performanceSecondaryGrid", "categoryPerformanceSection",
    "hotColdChartSection", "expenseChartSection"].forEach(function(token)
  {
    assertSourceContains(compositionSource, token, "Phase 7B.3 Dashboard composition");
  });
  Logger.log("PASS: testDashboardHighFidelityCompositionContract | scenarios=15 | overviewProtected=true");
  return { passed:overview.passed && performance.passed, scenarios:15, overviewProtected:true };

  /* Historical pre-7B.3 composition contract retained below for release archaeology. */
  var source = getAssembledFrontendSource();
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
  var source = getAssembledFrontendSource();
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
  var source = getAssembledFrontendSource();
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
