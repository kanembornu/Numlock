function testFinanceProfitAndLossUiContract()
{
  var shell = HtmlService.createTemplateFromFile("190.View.Index").getRawContent();
  var state = include("199.View.Finance.State");
  var render = include("200.View.Finance.Render");
  var controller = include("201.View.Finance.Controller");
  var financeSource = state + render + controller;
  var scenarios = 0;

  function requireToken(source, token, name) {
    scenarios++;
    if (source.indexOf(token) === -1) throw new Error("Finance UI missing " + name + ": " + token);
  }
  function forbidToken(source, token, name) {
    scenarios++;
    if (source.indexOf(token) !== -1) throw new Error("Finance UI forbidden " + name + ": " + token);
  }

  requireToken(shell, 'data-page="finance"', "active Profit & Loss route");
  requireToken(shell, 'data-page="finance" data-navigation-destination="capital-equity"', "active Capital & Equity route");
  requireToken(shell, 'data-navigation-destination="balance-sheet" class="ui-sidebar-item', "active Balance Position route");
  requireToken(shell, 'data-navigation-destination="cash-flow" class="ui-future-module', "gated Cash Flow");
  requireToken(controller, ".getFinanceData(", "Finance backend request");
  forbidToken(financeSource, "getDashboardData(", "Dashboard request coupling");
  requireToken(shell, 'aria-label="Profit and Loss summary"', "six-metric summary");
  scenarios++;
  if ((shell.match(/class="finance-kpi finance-surface"/g) || []).length !== 26) throw new Error("Finance UI must render six P&L, five Capital & Equity, six Product Profitability, four Balance Position, and five Depreciation KPI cards");
  requireToken(shell, 'class="finance-kpis finance-equity-kpis"', "five-card Capital & Equity summary");
  requireToken(shell, 'id="financeOwnerReconciliationBody"', "owner reconciliation");
  requireToken(shell, 'id="financeRetainedBridgeHeading"', "retained earnings bridge");
  requireToken(render, 'Not established for this date', "pre-cutoff unavailable state");
  requireToken(render, 'finance-negative', "negative retained earnings presentation");
  requireToken(shell, '>Return of Capital<', "Return of Capital label");
  requireToken(shell, '>(−) Owner Draw<', "distinct Owner Draw label");
  requireToken(shell, 'aria-label="Capital and Equity accounting status"', "accounting status strip");
  requireToken(shell, 'grid-template-columns: repeat(5, minmax(0, 1fr))', "bounded five-column desktop layout");
  requireToken(shell, 'overflow-x: auto', "bounded owner table overflow");
  requireToken(shell, '.finance-layout[hidden] { display: none; }', "exclusive Finance panel visibility");
  requireToken(controller, '"Owner capital and retained earnings as of the selected date"', "Capital & Equity utility identity");
  forbidToken(financeSource, 'runCapitalEquityMigration(', "migration execution");
  requireToken(shell, "finance-statement-row finance-total", "statement hierarchy");
  if (shell.indexOf('<p class="hf-section-label">Finance</p>') !== -1 ||
      shell.indexOf('id="financeHeading" class="ui-page-heading') !== -1 ||
      shell.indexOf("finance-subtotal") === -1 || shell.indexOf("finance-final-total") === -1) {
    throw new Error("Finance desktop hierarchy retains a duplicate title or lacks subtotal/final-total distinction");
  }
  requireToken(render, "financeExpenseBreakdownBody", "expense breakdown renderer");
  requireToken(shell, "authoritative DepreciationLedger", "depreciation source disclosure");
  requireToken(shell, 'id="financeStatementDepreciation"', "statement depreciation row");
  requireToken(render, "summary.depreciationExpense", "depreciation renderer");
  forbidToken(shell + render, "Depreciation excluded", "obsolete depreciation exclusion");
  requireToken(shell, "Transaction-date operating basis", "recognition-basis disclosure");
  requireToken(render, 'state === "empty"', "empty state");
  requireToken(render, 'state === "loading"', "loading state");
  requireToken(controller, 'setFinanceViewState("error"', "error state");
  requireToken(render, "finance-negative", "negative presentation");
  requireToken(render, 'style: "percent"', "percentage presentation");
  requireToken(shell, 'aria-label="Finance report status"', "data-quality status");
  requireToken(render, "excluded as expected", "informational inactive exclusion");
  requireToken(state, "let financeState", "Finance-owned state");
  forbidToken(state, "dashboard", "Dashboard state reuse");
  requireToken(shell, "var(--surface-1)", "semantic theme tokens");
  requireToken(shell, "@media (max-width: 767px)", "responsive structure");
  forbidToken(financeSource, 'getSheetByName("Transaction")', "Transaction sheet dependency");
  forbidToken(financeSource, 'getSheetByName("Helper")', "Helper sheet dependency");
  forbidToken(shell, 'id="balance-sheet" class="page', "fabricated Balance Sheet page");
  forbidToken(shell, 'id="cash-flow" class="page', "fabricated Cash Flow page");

  Logger.log("PASS: testFinanceProfitAndLossUiContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceDestinationSwitchContract()
{
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }
  function forbidToken(source, token, name) {
    scenarios++;
    if (source.indexOf(token) !== -1) throw new Error("Finance UI forbidden " + name + ": " + token);
  }

  var stateSource = include("199.View.Finance.State");
  var renderSource = include("200.View.Finance.Render");
  var controllerSource = include("201.View.Finance.Controller");
  var combined = stateSource + renderSource + controllerSource;

  // Defect 1 — shared data contamination: compatibility function exists
  check(controllerSource.indexOf("function isFinanceDataCompatible") !== -1,
    "compatibility check function declared");
  check(controllerSource.indexOf("isFinanceDataCompatible(financeState.data") !== -1,
    "setFinanceDestination checks data compatibility before render");

  // Defect 1 — incompatible data triggers fresh request on switch
  check(controllerSource.indexOf('setFinanceViewState("loading")') !== -1 &&
    controllerSource.indexOf("requestFinanceData(getFinanceRequestFromControls())") !== -1,
    "incompatible destination switch issues fresh request");

  // Defect 1 — P&L→PP: P&L data has no products → incompatible
  // Defect 1 — PP→C&E: PP data has no capitalEquity → incompatible
  // Defect 1 — C&E→P&L: both from getFinanceData → compatible
  // Defect 1 — PP→P&L: PP data has no expenseBreakdown → incompatible
  check(controllerSource.indexOf("data.capitalEquity") !== -1,
    "compatibility checks capitalEquity for C&E");
  check(controllerSource.indexOf("data.products") !== -1 || controllerSource.indexOf("data.products") !== -1,
    "compatibility checks products for PP");
  check(controllerSource.indexOf("data.expenseBreakdown") !== -1,
    "compatibility checks expenseBreakdown for P&L");

  // Defect 2 — PP field name mismatch: productVariantCount
  check(renderSource.indexOf("summary.productVariantCount") !== -1,
    "PP reads productVariantCount");
  check(renderSource.indexOf("summary.uniqueProductVariants") === -1,
    "PP no longer reads uniqueProductVariants");

  // Defect 2 — distinctProductCount for Products
  check(renderSource.indexOf("summary.distinctProductCount") !== -1,
    "PP reads distinctProductCount for Products KPI");

  // Defect 2 — quality.status === "GOOD" (not "OK")
  check(renderSource.indexOf('quality.status === "GOOD"') !== -1,
    "PP quality checks GOOD from backend");
  check(renderSource.indexOf('quality.status === "OK"') === -1,
    "PP quality no longer checks obsolete OK status");

  // Defect 3 — requestId destination binding
  check(controllerSource.indexOf("dest !== financeState.destination") !== -1,
    "callbacks validate destination alignment (not just requestId)");
  check(controllerSource.indexOf("var dest = financeState.destination") !== -1,
    "destination captured at request time before async call");

  // Defect 3 — both success and failure guard on destination
  var onSuccessBlock = controllerSource.substring(
    controllerSource.indexOf("function onSuccess"),
    controllerSource.indexOf("function onFailure")
  );
  var onFailureBlock = controllerSource.substring(
    controllerSource.indexOf("function onFailure"),
    controllerSource.indexOf("if (dest ===")
  );
  check(onSuccessBlock.indexOf("dest !== financeState.destination") !== -1,
    "onSuccess validates destination alignment");
  check(onFailureBlock.indexOf("dest !== financeState.destination") !== -1,
    "onFailure validates destination alignment");

  // Defect 4 — ensureFinanceData checks compatibility
  check(controllerSource.indexOf("isFinanceDataCompatible(financeState.data") !== -1,
    "ensureFinanceData checks data compatibility");

  // Defect 4 — no stale data reuse without compatibility
  check(controllerSource.indexOf("financeState.hasLoaded && financeState.data") !== -1,
    "destination switch requires both hasLoaded and data");

  // Error isolation — no hardcoded P&L in PP/CE paths
  forbidToken(combined, '"Unable to display Profit & Loss."', "no hardcoded P&L in catch without dynamic label");

  Logger.log("PASS: testFinanceDestinationSwitchContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinancePeriodLabelSync()
{
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }
  function forbidToken(source, token, name) {
    scenarios++;
    if (source.indexOf(token) !== -1) throw new Error("Finance UI forbidden " + name + ": " + token);
  }

  var renderSource = include("200.View.Finance.Render");

  var pnlStart = renderSource.indexOf("function renderFinanceProfitAndLoss");
  var ceStart = renderSource.indexOf("function renderFinanceCapitalEquity");
  var ppStart = renderSource.indexOf("function renderFinanceProductProfitability");
  var postPpStart = renderSource.indexOf("function setFinanceViewState");

  var pnlBody = renderSource.substring(pnlStart, ceStart);
  var ceBody = renderSource.substring(ceStart, ppStart);
  var ppBody = renderSource.substring(ppStart, postPpStart);

  // P&L updates shared period label
  check(pnlBody.indexOf("financePeriodLabel") !== -1,
    "P&L render updates shared period label");
  check(pnlBody.indexOf("period.label") !== -1,
    "P&L render uses period.label");

  // PP updates shared period label
  check(ppBody.indexOf("financePeriodLabel") !== -1,
    "PP render updates shared period label");
  check(ppBody.indexOf("period.label") !== -1,
    "PP render uses period.label");

  // C&E updates shared period label
  check(ceBody.indexOf("financePeriodLabel") !== -1,
    "C&E render updates shared period label");
  check(ceBody.indexOf("period.label") !== -1,
    "C&E render uses period.label");

  // Fallback: "Selected period" used in all three
  check(pnlBody.indexOf("Selected period") !== -1,
    "P&L falls back to Selected period");
  check(ppBody.indexOf("Selected period") !== -1,
    "PP falls back to Selected period");
  check(ceBody.indexOf("Selected period") !== -1,
    "C&E falls back to Selected period");

  // No hardcoded period labels
  forbidToken(pnlBody, '"Current Year"', "no hardcoded Current Year in P&L");
  forbidToken(pnlBody, '"Previous Year"', "no hardcoded Previous Year in P&L");
  forbidToken(ppBody, '"Current Year"', "no hardcoded Current Year in PP");
  forbidToken(ppBody, '"Previous Year"', "no hardcoded Previous Year in PP");
  forbidToken(ceBody, '"Current Year"', "no hardcoded Current Year in C&E");
  forbidToken(ceBody, '"Previous Year"', "no hardcoded Previous Year in C&E");

  Logger.log("PASS: testFinancePeriodLabelSync | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinancePpFieldSemantics()
{
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var renderSource = include("200.View.Finance.Render");
  var shell = HtmlService.createTemplateFromFile("190.View.Index").getRawContent();

  // Products label maps to distinctProductCount
  check(shell.indexOf('id="financePPVariantCount"') !== -1,
    "Products KPI element exists");
  check(renderSource.indexOf("summary.distinctProductCount") !== -1,
    "Products KPI renders distinctProductCount");

  // Product Rows label maps to productVariantCount
  check(shell.indexOf('id="financePPRowCount"') !== -1,
    "Product Rows KPI element exists");
  check(renderSource.indexOf("summary.productVariantCount") !== -1,
    "Product Rows KPI renders productVariantCount");

  // Quality GOOD renders clean state
  check(renderSource.indexOf('quality.status === "GOOD"') !== -1,
    "GOOD quality detected from backend");
  check(renderSource.indexOf('? "OK"') !== -1 || renderSource.indexOf('? "OK"\n') !== -1,
    "GOOD displays as OK (clean/healthy)");

  // Quality ATTENTION renders warning
  check(renderSource.indexOf('quality.status === "ATTENTION"') !== -1,
    "ATTENTION quality detected");
  check(renderSource.indexOf('warningEl.hidden = false') !== -1,
    "ATTENTION triggers warning visibility");

  // No reference to obsolete uniqueProductVariants
  check(renderSource.indexOf("uniqueProductVariants") === -1,
    "no reference to obsolete uniqueProductVariants");

  // No reference to obsolete quality OK check
  check(renderSource.indexOf('quality.status === "OK"') === -1,
    "no reference to obsolete quality OK check");

  Logger.log("PASS: testFinancePpFieldSemantics | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceBalancePositionUiContract()
{
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }
  function forbidToken(source, token, name) {
    scenarios++;
    if (source.indexOf(token) !== -1) throw new Error("Finance UI forbidden " + name + ": " + token);
  }

  var shell = HtmlService.createTemplateFromFile("190.View.Index").getRawContent();
  var stateSource = include("199.View.Finance.State");
  var renderSource = include("200.View.Finance.Render");
  var controllerSource = include("201.View.Finance.Controller");
  var combined = stateSource + renderSource + controllerSource;

  // Navigation activated
  check(shell.indexOf('data-navigation-destination="balance-sheet"') !== -1,
    "balance-sheet destination exists");
  check(shell.indexOf('data-page="finance" data-navigation-destination="balance-sheet"') !== -1,
    "balance-sheet route is active finance page");
  check(shell.indexOf('class="ui-future-module') === -1 ||
    shell.indexOf('balance-sheet" class="ui-future-module') === -1,
    "balance-sheet no longer gated");
  check(shell.indexOf('Balance Position') !== -1,
    "label shows Balance Position");

  // RPC uses getPartialBalanceData
  check(controllerSource.indexOf(".getPartialBalanceData(") !== -1,
    "controller calls getPartialBalanceData");

  // Independent cache key
  check(combined.indexOf("balanceSheet") !== -1,
    "balanceSheet has independent cache type");

  // Stale callback rejection
  check(controllerSource.indexOf("dest !== financeState.destination") !== -1,
    "callbacks validate destination alignment");

  // Period label "As of [date]"
  check(renderSource.indexOf("As of") !== -1,
    "renderer uses 'As of' period label");
  check(renderSource.indexOf("balancePosition.asOfDate") !== -1 || renderSource.indexOf("balance.asOfDate") !== -1,
    "renderer reads asOfDate for balance position");

  // KPI card rendering
  check(shell.indexOf('id="financeBalanceSheetContent"') !== -1,
    "balance-sheet content container exists");
  check(shell.indexOf('id="financeBSKnownAssets"') !== -1,
    "Known Assets KPI exists");
  check(shell.indexOf('id="financeBSLiabilities"') !== -1,
    "Liabilities KPI exists");
  check(shell.indexOf('id="financeBSEquity"') !== -1,
    "Equity KPI exists");
  check(shell.indexOf('id="financeBSPositionStatus"') !== -1,
    "Position Status KPI exists");

  // null vs zero rendering
  check(renderSource.indexOf("Unavailable") !== -1,
    "null values render as Unavailable");

  // Fixed asset display
  check(shell.indexOf('id="financeBSFixedAssets"') !== -1,
    "Fixed Assets element exists");
  check(renderSource.indexOf("financeBSFixedAssets") !== -1,
    "renderer writes Fixed Assets");

  // Equity display
  check(shell.indexOf('id="financeBSEquityCapital"') !== -1,
    "Contributed Capital element exists");
  check(shell.indexOf('id="financeBSEquityRetained"') !== -1,
    "Retained Earnings element exists");
  check(shell.indexOf('id="financeBSEquityTotal"') !== -1,
    "Total Equity element exists");

  // Reconciliation display
  check(shell.indexOf('id="financeBSReconAssets"') !== -1,
    "Reconciliation Assets element exists");
  check(shell.indexOf('id="financeBSReconLiabilities"') !== -1,
    "Reconciliation Liabilities element exists");
  check(shell.indexOf('id="financeBSReconKnownPosition"') !== -1,
    "Reconciliation Known Position element exists");
  check(renderSource.indexOf("financeBSReconAssets") !== -1,
    "renderer writes Reconciliation Assets");

  // Heading and context text
  check(controllerSource.indexOf('"Balance Position"') !== -1,
    "controller sets Balance Position heading");
  check(controllerSource.indexOf('"Assets, liabilities, and equity as of the selected date"') !== -1,
    "controller sets Balance Position context text");

  // isFinanceDataCompatible check
  check(controllerSource.indexOf("data.asOfDate") !== -1,
    "compatibility checks asOfDate for balance-sheet");

  // Compatible data check in renderActiveFinanceDestination
  check(controllerSource.indexOf("renderFinanceBalanceSheet") !== -1,
    "renderActiveFinanceDestination dispatches to renderFinanceBalanceSheet");

  // Field name correctness — balance position uses backend-correct names
  check(renderSource.indexOf("assets.fixedAssets.netBookValue") !== -1,
    "balance renderer reads fixedAssets.netBookValue (not bare object)");
  check(renderSource.indexOf("equity.netContributedCapital") !== -1,
    "balance renderer reads equity.netContributedCapital");
  check(renderSource.indexOf("equity.retainedEarnings") !== -1,
    "balance renderer reads equity.retainedEarnings");
  check(renderSource.indexOf("balance.totalKnownAssets") !== -1,
    "balance renderer reads balance.totalKnownAssets");

  // warmBalanceSheetData exists and follows same pattern
  check(controllerSource.indexOf("function warmBalanceSheetData") !== -1,
    "warmBalanceSheetData function declared");
  check(controllerSource.indexOf("financeCache.balanceSheet[cacheKey]") !== -1,
    "warmBalanceSheetData writes to financeCache.balanceSheet");
  check(controllerSource.indexOf("financeInflight[\"balanceSheet|\" + cacheKey]") !== -1,
    "warmBalanceSheetData uses balanceSheet inflight key");
  check(controllerSource.indexOf(".getPartialBalanceData(") !== -1,
    "warmBalanceSheetData calls getPartialBalanceData");

  // No second cache architecture
  check(controllerSource.indexOf("balanceSheetCache") === -1,
    "no separate balanceSheetCache object");

  // Reconciliation uses backend knownPositionDifference — no manual Assets - Liabilities arithmetic
  check(renderSource.indexOf("reconciliation.knownPosition") !== -1,
    "renderer reads backend reconciliation.knownPosition");
  check(renderSource.indexOf("reconKnownAssets") === -1,
    "no manual Assets variable for reconciliation arithmetic");
  check(renderSource.indexOf("reconKnownLiab") === -1,
    "no manual Liabilities variable for reconciliation arithmetic");

  // Position Status uses backend knownPositionStatus — not sign-based Positive/Negative
  check(renderSource.indexOf("knownPosition.status") !== -1 || renderSource.indexOf("knownPosStatus") !== -1,
    "renderer reads backend knownPosition status");
  forbidToken(renderSource, '"Positive"', "no manual Positive position label");
  forbidToken(renderSource, '"Negative"', "no manual Negative position label");

  // Backend status values rendered
  check(renderSource.indexOf("Known Position Reconciled") !== -1,
    "COMPUTABLE + zero difference renders Known Position Reconciled");
  check(renderSource.indexOf("Known Position Difference") !== -1,
    "COMPUTABLE + nonzero difference renders Known Position Difference");

  // Equity row present in reconciliation
  check(shell.indexOf('id="financeBSReconEquity"') !== -1,
    "Equity reconciliation element exists in shell");
  check(renderSource.indexOf("financeBSReconEquity") !== -1,
    "renderer writes Equity row in reconciliation");

  Logger.log("PASS: testFinanceBalancePositionUiContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceBalanceSheetPrewarmContract()
{
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var stateSource = include("199.View.Finance.State");
  var renderSource = include("200.View.Finance.Render");
  var controllerSource = include("201.View.Finance.Controller");
  var dashboardSource = include("198.View.Dashboard.Controller");
  var combined = stateSource + renderSource + controllerSource;

  // warmBalanceSheetData follows same cache pattern as warmFinanceData
  check(controllerSource.indexOf("function warmBalanceSheetData") !== -1,
    "warmBalanceSheetData declared");
  check(controllerSource.indexOf("financeCache.balanceSheet[cacheKey]") !== -1,
    "warmBalanceSheetData reads/writes financeCache.balanceSheet");

  // warmBalanceSheetData uses inflight dedup
  check(controllerSource.indexOf("financeInflight[\"balanceSheet|\" + cacheKey]") !== -1,
    "warmBalanceSheetData uses balanceSheet inflight key");

  // warmBalanceSheetData calls correct backend
  check(controllerSource.indexOf("getPartialBalanceData") !== -1,
    "balance-sheet path calls getPartialBalanceData");

  // warmBalanceSheetData does NOT render
  check(controllerSource.indexOf("function warmBalanceSheetData") !== -1,
    "warmBalanceSheetData declared");
  var warmBSBody = controllerSource.substring(
    controllerSource.indexOf("function warmBalanceSheetData"),
    controllerSource.indexOf("// 11X.3K — invalidate all finance")
  );
  check(warmBSBody.indexOf("renderFinance") === -1,
    "warmBalanceSheetData does not call any renderer");
  check(warmBSBody.indexOf("setFinanceViewState") === -1,
    "warmBalanceSheetData does not set view state");

  // Sibling warming includes balanceSheet
  check(controllerSource.indexOf("warmBalanceSheetData(capturedFilter") !== -1,
    "sibling warming calls warmBalanceSheetData");

  // Dashboard prewarms balanceSheet
  check(dashboardSource.indexOf("warmBalanceSheetData") !== -1,
    "Dashboard prewarms warmBalanceSheetData");
  check(dashboardSource.indexOf("warmBalanceSheetData(\"currentYear\"") !== -1,
    "Dashboard prewarm uses currentYear filter");

  // Cache key isolation — all three use shared buildFinanceCacheKey
  check(controllerSource.indexOf("function buildFinanceCacheKey") !== -1,
    "shared buildFinanceCacheKey exists");
  check(combined.indexOf("balanceSheet") !== -1,
    "balanceSheet appears in cache architecture");

  // No second cache architecture
  check(controllerSource.indexOf("balanceSheetCache") === -1,
    "no separate balanceSheetCache object");

  Logger.log("PASS: testFinanceBalanceSheetPrewarmContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceDepreciationUiContract()
{
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }
  function forbidToken(source, token, name) {
    scenarios++;
    if (source.indexOf(token) !== -1) throw new Error("Finance UI forbidden " + name + ": " + token);
  }

  var shell = HtmlService.createTemplateFromFile("190.View.Index").getRawContent();
  var stateSource = include("199.View.Finance.State");
  var renderSource = include("200.View.Finance.Render");
  var controllerSource = include("201.View.Finance.Controller");
  var combined = stateSource + renderSource + controllerSource;

  // Navigation activated
  check(shell.indexOf('data-navigation-destination="depreciation"') !== -1,
    "depreciation destination exists");
  check(shell.indexOf('data-page="finance" data-navigation-destination="depreciation"') !== -1,
    "depreciation route is active finance page");
  check(shell.indexOf('depreciation" class="ui-future-module') === -1,
    "depreciation no longer gated");

  // Correct RPC method
  check(controllerSource.indexOf(".getDepreciationData(") !== -1,
    "controller calls getDepreciationData");

  // Cache key isolation
  check(combined.indexOf("depreciation") !== -1,
    "depreciation has independent cache type");
  check(controllerSource.indexOf("financeCache.depreciation[cacheKey]") !== -1,
    "depreciation uses financeCache.depreciation");

  // Heading and context text
  check(controllerSource.indexOf('"Depreciation"') !== -1,
    "controller sets Depreciation heading");
  check(controllerSource.indexOf('"Fixed asset depreciation schedule and reconciliation"') !== -1,
    "controller sets Depreciation context text");

  // Content container
  check(shell.indexOf('id="financeDepreciationContent"') !== -1,
    "depreciation content container exists");
  check(shell.indexOf('data-finance-panel="depreciation"') !== -1,
    "depreciation content panel attribute set");

  // KPI rendering (5 cards)
  check(shell.indexOf('id="financeDepExpense"') !== -1,
    "Depreciation Expense KPI exists");
  check(shell.indexOf('id="financeDepAccumulated"') !== -1,
    "Accumulated Depreciation KPI exists");
  check(shell.indexOf('id="financeDepNBV"') !== -1,
    "Net Book Value KPI exists");
  check(shell.indexOf('id="financeDepActiveAssets"') !== -1,
    "Active Assets KPI exists");
  check(shell.indexOf('id="financeDepFullyDepreciated"') !== -1,
    "Fully Depreciated KPI exists");

  // Asset table rendering
  check(shell.indexOf('id="financeDepAssetBody"') !== -1,
    "asset table body exists");
  check(renderSource.indexOf("financeDepAssetBody") !== -1,
    "renderer writes asset table");

  // Reconciliation rendering
  check(shell.indexOf('id="financeDepReconPeriod"') !== -1,
    "Period Depreciation reconciliation exists");
  check(shell.indexOf('id="financeDepReconAccum"') !== -1,
    "Accumulated Depreciation reconciliation exists");
  check(shell.indexOf('id="financeDepReconNBV"') !== -1,
    "Net Book Value reconciliation exists");
  check(renderSource.indexOf("financeDepReconPeriod") !== -1,
    "renderer writes Period Depreciation reconciliation");
  check(renderSource.indexOf("reconStatus") !== -1 || renderSource.indexOf("RECONCILED") !== -1,
    "renderer maps reconciliation status");

  // Policy rendering
  check(shell.indexOf('id="financeDepPolicyMethod"') !== -1,
    "Policy Method exists");
  check(shell.indexOf('id="financeDepPolicyGranularity"') !== -1,
    "Policy Granularity exists");
  check(shell.indexOf('id="financeDepPolicyRounding"') !== -1,
    "Policy Rounding exists");
  check(shell.indexOf('id="financeDepPolicyStartRule"') !== -1,
    "Policy Start Rule exists");
  check(shell.indexOf('id="financeDepPolicyResidualTreatment"') !== -1,
    "Policy Residual Treatment exists");
  check(shell.indexOf('id="financeDepPolicySource"') !== -1,
    "Policy Source exists");
  check(renderSource.indexOf("financeDepPolicyMethod") !== -1,
    "renderer writes policy method");

  // EMPTY/ERROR states
  check(renderSource.indexOf('"EMPTY"') !== -1,
    "renderer handles EMPTY status");
  check(renderSource.indexOf('response.status === "EMPTY"') !== -1,
    "renderer checks for EMPTY status");

  // Quality ATTENTION
  check(renderSource.indexOf("ATTENTION") !== -1,
    "renderer handles ATTENTION quality");

  // isFinanceDataCompatible check
  check(controllerSource.indexOf('destination === "depreciation"') !== -1,
    "compatibility checks depreciation destination");
  check(controllerSource.indexOf("data.summary") !== -1,
    "compatibility checks data.summary for depreciation");
  check(controllerSource.indexOf("data.asOfDate") !== -1,
    "compatibility checks data.asOfDate for depreciation");

  // renderActiveFinanceDestination dispatches
  check(controllerSource.indexOf("renderFinanceDepreciation") !== -1,
    "renderActiveFinanceDestination dispatches to renderFinanceDepreciation");

  // warmDepreciationData exists
  check(controllerSource.indexOf("function warmDepreciationData") !== -1,
    "warmDepreciationData function declared");
  check(controllerSource.indexOf("financeCache.depreciation[cacheKey]") !== -1,
    "warmDepreciationData writes to financeCache.depreciation");
  check(controllerSource.indexOf('financeInflight["depreciation|" + cacheKey]') !== -1,
    "warmDepreciationData uses depreciation inflight key");
  check(controllerSource.indexOf(".getDepreciationData(") !== -1,
    "warmDepreciationData calls getDepreciationData");

  // Sibling warming includes depreciation
  check(controllerSource.indexOf("warmDepreciationData(capturedFilter") !== -1,
    "sibling warming calls warmDepreciationData");

  // Stale callback rejection
  check(controllerSource.indexOf("dest !== financeState.destination") !== -1,
    "callbacks validate destination alignment");

  // No second cache architecture
  check(controllerSource.indexOf("depreciationCache") === -1,
    "no separate depreciationCache object");

  // No migration execution
  forbidToken(combined, 'runDepreciationMigration(', "migration execution");

  Logger.log("PASS: testFinanceDepreciationUiContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}

function testFinanceElementCacheRegistration()
{
  var scenarios = 0;
  function check(cond, msg) { scenarios++; if (!cond) throw new Error(msg); }

  var shell = HtmlService.createTemplateFromFile("190.View.Index").getRawContent();
  var renderSource = include("200.View.Finance.Render");
  var controllerSource = include("201.View.Finance.Controller");
  var financeSource = renderSource + controllerSource;

  // Extract requiredIds array from shell source
  var requiredIdsStart = shell.indexOf("var requiredIds = [");
  check(requiredIdsStart !== -1, "requiredIds array declared in shell");
  var requiredIdsEnd = shell.indexOf("];", requiredIdsStart);
  var requiredIdsBlock = shell.substring(requiredIdsStart, requiredIdsEnd + 2);

  // Parse quoted IDs from the array
  var registeredIds = {};
  var idMatch = requiredIdsBlock.match(/"([a-zA-Z][a-zA-Z0-9]*)"/g);
  check(idMatch !== null, "requiredIds contains element IDs");
  for (var i = 0; i < idMatch.length; i++) {
    var raw = idMatch[i];
    registeredIds[raw.substring(1, raw.length - 1)] = true;
  }

  // Also parse dynamic receipt IDs added via push
  // receiptIds keys → "receipt" + key pattern
  var receiptKeys = ["Date", "Qty", "Uom", "Cost", "Supplier", "Reference", "Unavailable", "Attested"];
  for (var r = 0; r < receiptKeys.length; r++) {
    registeredIds["receipt" + receiptKeys[r]] = true;
    registeredIds["receipt" + receiptKeys[r] + "Error"] = true;
  }
  registeredIds["receiptEntryFields"] = true;
  registeredIds["receiptEntryControls"] = true;
  registeredIds["expenseCostType"] = true;
  registeredIds["expenseDate"] = true;
  registeredIds["expenseDateError"] = true;
  registeredIds["expensePolicyFields"] = true;
  registeredIds["receiptChoicesState"] = true;
  registeredIds["receiptRecovery"] = true;

  check(Object.keys(registeredIds).length > 100, "registeredIds parsed from shell (expected 100+)");

  // Extract all getFinanceElement("...") calls from finance frontend source
  var calledIds = {};
  var callRegex = /getFinanceElement\("([a-zA-Z][a-zA-Z0-9]*)"\)/g;
  var callMatch;
  while ((callMatch = callRegex.exec(financeSource)) !== null) {
    calledIds[callMatch[1]] = true;
  }
  check(Object.keys(calledIds).length > 30, "getFinanceElement calls extracted from finance source");

  // Extract dynamic IDs from currencyMetrics object (P&L KPIs)
  var pnlMetricKeys = ["financeRevenue", "financeCogs", "financeGrossProfit",
    "financeOperatingExpenses", "financeOperatingNetProfit"];
  for (var m = 0; m < pnlMetricKeys.length; m++) {
    calledIds[pnlMetricKeys[m]] = true;
  }

  // Extract dynamic IDs from statement metrics array (P&L statement rows)
  var statementKeys = ["financeStatementRevenue", "financeStatementCogs",
    "financeStatementGrossProfit", "financeStatementOperatingExpenses",
    "financeStatementDepreciation", "financeStatementOperatingNetProfit"];
  for (var s = 0; s < statementKeys.length; s++) {
    calledIds[statementKeys[s]] = true;
  }

  // Extract dynamic IDs from C&E metrics arrays
  var ceKeys = ["financeEquityContributions", "financeEquityReturns",
    "financeEquityClosingCapital", "financeCompositionCapital", "financeCompositionDraw",
    "financeEquityRetainedEarnings", "financeEquityTotal",
    "financeCompositionRetained", "financeCompositionTotal",
    "financeRetainedOpening", "financeRetainedPostCutoff", "financeRetainedCurrent"];
  for (var c = 0; c < ceKeys.length; c++) {
    calledIds[ceKeys[c]] = true;
  }

  // Extract dynamic IDs from Depreciation policy labels
  var policyKeys = ["method", "granularity", "rounding", "startRule", "residualTreatment", "source"];
  for (var p = 0; p < policyKeys.length; p++) {
    var capitalKey = policyKeys[p].charAt(0).toUpperCase() + policyKeys[p].slice(1);
    calledIds["financeDepPolicy" + capitalKey] = true;
  }

  // Cross-reference: every called ID must be registered in requiredIds
  var missing = [];
  var calledList = Object.keys(calledIds);
  for (var x = 0; x < calledList.length; x++) {
    if (!registeredIds[calledList[x]]) {
      missing.push(calledList[x]);
    }
  }
  check(missing.length === 0,
    "every getFinanceElement ID registered in requiredIds — missing: " + missing.join(", "));

  // Specific regression: financeDepreciationContent and all Depreciation IDs
  var depreciationIds = [
    "financeDepreciationContent", "financeDepExpense", "financeDepAccumulated",
    "financeDepNBV", "financeDepActiveAssets", "financeDepFullyDepreciated",
    "financeDepAssetsHeading", "financeDepAssetBody", "financeDepReconHeading",
    "financeDepReconPeriod", "financeDepReconAccum", "financeDepReconNBV",
    "financeDepPolicyHeading", "financeDepPolicyMethod", "financeDepPolicyGranularity",
    "financeDepPolicyRounding", "financeDepPolicyStartRule",
    "financeDepPolicyResidualTreatment", "financeDepPolicySource"
  ];
  for (var d = 0; d < depreciationIds.length; d++) {
    check(registeredIds[depreciationIds[d]] === true,
      "Depreciation ID registered: " + depreciationIds[d]);
  }

  // Prove financeElementCache is populated from requiredIds (not hardcoded subset)
  check(shell.indexOf("financeElementCache = required") !== -1,
    "shell assigns all requiredIds to financeElementCache");

  // Prove getFinanceElement throws for unregistered IDs
  check(shell.indexOf('throw new Error("Required shell element missing: #" + id)') !== -1,
    "shell element lookup throws on missing ID");

  Logger.log("PASS: testFinanceElementCacheRegistration | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}
