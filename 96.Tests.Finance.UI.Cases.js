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
  requireToken(shell, 'data-navigation-destination="balance-sheet" class="ui-future-module', "gated Balance Sheet");
  requireToken(shell, 'data-navigation-destination="cash-flow" class="ui-future-module', "gated Cash Flow");
  requireToken(controller, ".getFinanceData(", "Finance backend request");
  forbidToken(financeSource, "getDashboardData(", "Dashboard request coupling");
  requireToken(shell, 'aria-label="Profit and Loss summary"', "six-metric summary");
  scenarios++;
  if ((shell.match(/class="finance-kpi finance-surface"/g) || []).length !== 11) throw new Error("Finance UI must render six P&L and five Capital & Equity KPI cards");
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
