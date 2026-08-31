function createResponsiveShellContractFixtures()
{
  return [
    { name: "menu button", tokens: ['id="sidebarMenuButton"', 'aria-controls="dashboardSidebar"'] },
    { name: "drawer and backdrop", tokens: ['id="dashboardSidebar"', 'id="sidebarBackdrop"'] },
    { name: "menu accessibility", tokens: ['aria-label="Open navigation menu"', 'aria-expanded="false"'] },
    { name: "Escape closes drawer", tokens: ['event.key === "Escape"', 'setSidebarOpen(false, true);'] },
    { name: "navigation closes drawer", tokens: ['document.querySelectorAll("[data-page]")', 'showPage(button.getAttribute("data-page"));'] },
    { name: "body scroll lock", tokens: ['document.body.classList.toggle("overflow-hidden", isOpen);'] },
    { name: "focus restoration", tokens: ['menuButton.focus();'] },
    { name: "active navigation", tokens: ['button.setAttribute("aria-current", "page");'] },
    { name: "table scroll wrapper", tokens: ['id="transactionsTableScroll"', 'overflow-x-auto'] },
    { name: "narrow content width", tokens: ['<main id="mainContent" class="ml-0 min-w-0 w-full flex-1'] },
    { name: "desktop sidebar", tokens: ['#dashboardSidebar { width: 248px;', '#dashboardSidebar { width: 224px;', '#appShell[data-sidebar-collapsed="true"] #dashboardSidebar { width: 64px;', 'lg:translate-x-0', 'grid-template-rows: 76px minmax(0, 1fr); margin-left: 248px;'] },
    { name: "single initialization guard", tokens: ['let responsiveShellInitialized = false;', 'if (responsiveShellInitialized)', 'responsiveShellInitialized = true;'], uniqueToken: 'function initializeResponsiveShell()' }
  ];
}

function createAccessibilityContractFixtures()
{
  return [
    { name: "document language", tokens: ['<html lang="en"'] },
    { name: "viewport metadata", tokens: ['<meta name="viewport" content="width=device-width, initial-scale=1.0">'] },
    { name: "document title", tokens: ['<title>NUMLOCK Coffee Shop Analytics</title>'] },
    { name: "primary main landmark", tokens: ['<main id="mainContent"'], uniqueToken: '<main id="mainContent"' },
    { name: "labelled navigation", tokens: ['<nav class="flex-1 overflow-y-auto p-3" aria-label="Primary navigation">'] },
    { name: "logical chart headings", tokens: ['<h2 id="revenueChartTitle"', '<h2 id="hotColdChartTitle"', '<h2 id="expenseChartTitle"'] },
    { name: "filter selector label", tokens: ['<label for="filter" class="sr-only">Reporting period</label>'] },
    { name: "custom date labels", tokens: ['<label for="customStart" class="sr-only">Custom start date</label>', '<label for="customEnd" class="sr-only">Custom end date</label>'] },
    { name: "invalid control state", tokens: ['function setDateFilterValidation(message)', '"aria-invalid",', 'String(hasError)'] },
    { name: "accessible validation message", tokens: ['id="dateFilterValidation"', 'aria-describedby="dateFilterValidation"', 'setDateFilterValidation("Select both custom dates");'] },
    { name: "active navigation semantics", tokens: ['aria-current="page"', 'button.setAttribute("aria-current", "page");', 'button.removeAttribute("aria-current");'] },
    { name: "table accessible name and empty state", tokens: ['<caption class="sr-only">Visible bounded transactions for the selected Transactions tab</caption>', 'colspan="8" class="p-8 text-center text-sm ui-theme-muted">No transactions match this view for the selected period.</td>'] },
    { name: "scoped table headers", tokens: ['<th scope="col" class="px-4">Transaction ID</th>', '<th scope="col" class="px-2 text-center">Actions</th>'] },
    { name: "dynamic status regions", tokens: ['id="dashboardStatus"', 'id="reportingInformation"', 'role="status"', 'aria-live="polite"'] },
    { name: "visible keyboard focus", tokens: ['button:focus-visible,', 'select:focus-visible,', 'input:focus-visible,', 'outline: 3px solid var(--focus);'] },
    { name: "hidden drawer focus exclusion", tokens: ['sidebar.inert = !isOpen && !isDesktop;', 'sidebar.setAttribute(', '"aria-hidden",'] },
    { name: "Escape drawer close", tokens: ['event.key === "Escape"', 'setSidebarOpen(false, true);'] },
    { name: "Retry keyboard operation", tokens: ['id="dashboardRetryButton"', 'type="button"', 'onclick="retryDashboardData()"'] },
    { name: "Data Quality keyboard operation", tokens: ['id="dataQualityDetailsButton"', 'type="button"', 'onclick="toggleDataQualityDetails()"'] },
    { name: "reduced motion CSS", tokens: ['@media (prefers-reduced-motion: reduce)', '.skeleton { animation: none; }', '#dashboardSidebar { transition: none; }', '#actionRoadmapCard .text-xl { transition: none; }'] },
    { name: "Chart animation reduction", tokens: ['function shouldReduceMotion()', 'animation: shouldReduceMotion() ? false : undefined,'] },
    { name: "hidden page focus exclusion", tokens: ['id="transactions" class="page" hidden', 'page.hidden = !isActivePage;'] }
  ];
}

function createChartPresentationContractFixtures()
{
  return [
    { name: "Revenue Trend populated values", tokens: ["function renderRevenueChart(revenueTrend)", "data: values"] },
    { name: "Revenue Trend empty state", tokens: ['"No revenue data for the selected period."', "if (!chartAvailable || isEmpty)"] },
    { name: "daily and monthly two-line labels", tokens: ['return [parts[2] + " " + monthNames[Number(parts[1]) - 1], parts[0]];', 'return parts.length >= 2', '? [monthNames[Number(parts[1]) - 1], parts[0]]'] },
    { name: "daily and monthly Y-axis steps", tokens: ['stepSize: granularity === "day" ? 100000 : 1000000', 'callback: formatRevenueAxisTick', 'typeof value === "number" && value === 0'] },
    { name: "Rupiah tooltip formatting", tokens: ['Number(value || 0).toLocaleString("id-ID")', '"Revenue: " + formatChartCurrency(context.raw)'] },
    { name: "Revenue Trend zero baseline", tokens: ["y: { beginAtZero: true, min: 0", "spanGaps: false"] },
    { name: "stale chart cleared on empty transition", tokens: ["revenueChart = destroyChartInstance(revenueChart);", "context.clearRect(0, 0, canvas.width, canvas.height);"] },
    { name: "Hot Cold populated totals", tokens: ["data: [hot, cold]", "formatChartQuantity(hot)", "formatChartQuantity(cold)"] },
    { name: "Hot Cold zero-total behavior", tokens: ["var isEmpty = total === 0;", '"No Hot/Cold sales data for the selected period."'] },
    { name: "Hot Cold safe percentage", tokens: ["total > 0 ? (context.raw / total) * 100 : 0", 'percentage.toFixed(1) + "%)"'] },
    { name: "Expense populated values and ordering", tokens: ["var expenseData = expenseBreakdown.slice();", "item.category;", "item.amount;"] },
    { name: "Expense empty state", tokens: ['"No expense data for the selected period."', '"Expense breakdown has no represented categories."'] },
    { name: "long category labels", tokens: ['indexAxis: "y"', "ticks: { autoSkip: false, color: chartPalette.axis }"] },
    { name: "accessible titles and summaries", tokens: ['aria-labelledby="revenueChartTitle"', 'aria-labelledby="hotColdChartTitle"', 'aria-labelledby="expenseChartTitle"', 'id="revenueChartSummary"', 'id="hotColdChartSummary"', 'id="expenseChartSummary"'] },
    { name: "summary update behavior", tokens: ["summaryElement.innerText = summary;", "renderRevenueChart(revenueTrend);", "renderHotColdChart(hotColdSplit);", "renderExpenseChart(expenseBreakdown);"] },
    { name: "single chart lifecycle helper", tokens: ["function destroyChartInstance(chart)", "chart.destroy();"], uniqueToken: "function destroyChartInstance(chart)" },
    { name: "responsive chart containment", tokens: ['id="mainChartWrapper" class="relative h-72 min-w-0 sm:h-96"', 'id="hotColdWrapper" class="relative h-72 min-w-0 sm:h-96"', 'id="expenseWrapper" class="relative h-72 min-w-0 sm:h-96"'] }
  ];
}

function createFrontendDependencyContractFixtures()
{
  return {
    chartUrl: "https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js",
    fontAwesomeUrl: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
    cases: [
      { name: "Tailwind remains local", tokens: ["HtmlService.createHtmlOutputFromFile('189.View.Tailwind')"] },
      { name: "Chart exact version", tokens: ["chart.js@4.5.1/dist/chart.umd.min.js"] },
      { name: "Font Awesome exact version", tokens: ["font-awesome/6.0.0/css/all.min.css"] },
      { name: "Chart availability detection", tokens: ['typeof Chart === "function"'] },
      { name: "Chart unavailable message", tokens: ['"Chart unavailable."'] },
      { name: "single actionable diagnostic", tokens: ['"Chart.js unavailable; chart rendering was skipped."', "chartUnavailableDiagnosticLogged = true;"] },
      { name: "safe existing instance destruction", tokens: ["revenueChart = destroyChartInstance(revenueChart);", "hotColdChart = destroyChartInstance(hotColdChart);", "expenseChart = destroyChartInstance(expenseChart);"] },
      { name: "accessible summaries retained", tokens: ['id="revenueChartSummary"', 'id="hotColdChartSummary"', 'id="expenseChartSummary"'] },
      { name: "non-chart continuation", tokens: ['container.innerHTML = sorted.length'] },
      { name: "Chart available constructors", tokens: ["revenueChart = new Chart(", "productProfitabilityChart = new Chart(", "categoryPerformanceChart = new Chart(", "expenseChart = new Chart("] },
      { name: "responsive contract retained", tokens: ['id="mainChartWrapper" class="relative h-72 min-w-0 sm:h-96"'] },
      { name: "chart contract retained", tokens: ["renderRevenueChart(revenueTrend);", "renderHotColdEconomicsComparison(latestPerformanceAnalytics.hotColdEconomics);", "renderExpenseChart(Array.isArray(latestPerformanceAnalytics.expenseGroups) ? latestPerformanceAnalytics.expenseGroups : []);"] },
      { name: "Font Awesome active usage", tokens: ['class="fas fa-times"', 'class="fas fa-chart-line w-6 text-center"', 'class="fas fa-arrow-right-arrow-left w-6 text-center"'] },
      { name: "no browser alert fallback", excludedTokens: ["alert(\"Chart unavailable.\")", "alert('Chart unavailable.')"] }
    ]
  };
}

function createPerformanceStabilizationFixtures()
{
  return {
    baseline: [
      { id: "forecastSection", disposition: "KEEP", reason: "Distinct forward-looking revenue context" },
      { id: "hotColdChartSection", disposition: "REPLACED", reason: "Richer revenue, COGS, and gross-margin economics" },
      { id: "expenseChartSection", disposition: "REPLACED", reason: "Stable business-group expense view" },
      { id: "productConcentrationSection", disposition: "KEEP", reason: "Distinct dependency and Pareto evidence" }
    ],
    finalOrder: [
      "performanceSnapshotSection",
      "productProfitabilitySection",
      "performanceSecondaryGrid",
      "forecastSection",
      "productConcentrationSection"
    ],
    secondaryCharts: [
      "categoryPerformanceWrapper",
      "expenseWrapper"
    ],
    nativeComparisons: ["hotColdComparison"]
  };
}
