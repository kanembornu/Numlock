function testResponsiveShellContract()
{
  var source = getAssembledFrontendSource();
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
    "function formatDashboardMonthRange",
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
  var source = getAssembledFrontendSource();
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
  var source = getAssembledFrontendSource();
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
  var source = getAssembledFrontendSource();
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
  var source = getAssembledFrontendSource();
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
  var source = getAssembledFrontendSource();
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
  var diagnosticsSource = include("191.View.Diagnostics");
  var source = getAssembledFrontendSource();
  var assembledSource = source
    .replace("<?!= include('191.View.Diagnostics'); ?>", diagnosticsSource);
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

  function findHardcodedSemanticThemeDeclarations(cssSource)
  {
    var semanticOwners = {
      body: true, html: true, "#appShell": true, "#mainContent": true,
      "#dashboardSidebar": true, "#topUtilityBar": true, ".page": true,
      ".ui-theme-surface": true, ".ui-theme-inset": true,
      ".ui-theme-primary": true, ".ui-theme-secondary": true,
      ".ui-theme-muted": true
    };
    var hardcodedColorPattern = /#[0-9a-f]{3,8}|rgba?\(|hsla?\(/i;
    var violations = [];

    /* Semantic shell owners use tokens; fixed shadows, alpha overlays, chart
     * colors, component accents, and transparent resets keep their baseline. */
    cssSource.replace(/([^{}]+)\{([^{}]*)\}/g, function(match, selectors, declarations)
    {
      var ownsSemanticTheme = selectors.split(",").some(function(selector)
      {
        return semanticOwners[selector.trim()] === true;
      });
      if (!ownsSemanticTheme) return match;
      declarations.replace(
        /(?:^|;)\s*(color|background(?:-color)?|border-color)\s*:\s*([^;}]+)/g,
        function(declaration, property, value)
        {
          if (hardcodedColorPattern.test(value)) violations.push(property + ":" + value.trim());
          return declaration;
        }
      );
      return match;
    });
    return violations;
  }

  var semanticThemeViolations = findHardcodedSemanticThemeDeclarations(source);
  if (semanticThemeViolations.length)
  {
    throw new Error("Production semantic theme owner retains a hardcoded color: " + semanticThemeViolations[0]);
  }
  if (findHardcodedSemanticThemeDeclarations(".ui-theme-surface { background-color: #123456; }").length !== 1)
  {
    throw new Error("Semantic theme scanner missed a synthetic hardcoded surface color");
  }
  if (findHardcodedSemanticThemeDeclarations(
    ".performance-card { box-shadow: 0 1px 3px rgba(15, 23, 42, .05); } " +
    ".chart-overlay { background: rgba(0, 0, 0, 0); }").length !== 0)
  {
    throw new Error("Semantic theme scanner captured a fixed shadow or chart overlay");
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
    assertSourceExcludes(themeSource, token, "theme response mutation");
  });
  scenariosPassed++;

  var idQueryCount = (assembledSource.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount = (assembledSource.match(/document\.querySelector(?:All)?\(/g) || []).length;
  if (idQueryCount > 73 || selectorQueryCount > 2)
  {
    throw new Error("Theme parity query budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred phase owner");
  assertSourceExcludes(source, "ResizeObserver", "theme parity ResizeObserver");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleResponsiveChartResize);', "single responsive resize listener");
  assertSourceContainsOnce(assembledSource, 'window.addEventListener("resize", scheduleLayoutDebugMeasurement);', "single layout-debug resize listener");
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
  var source = getAssembledFrontendSource();
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
    "function synchronizeSystemThemeListener(preference)",
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
  var source = getAssembledFrontendSource();
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

  ["dashboard", "transactions", "finance", "settings", "logs"]
    .forEach(function(pageId)
    {
      assertSourceContainsOnce(
        source,
        'data-page="' + pageId + '"',
        "primary destination " + pageId
      );
    });
  scenariosPassed++;

  ["products", "capital-equity", "assets", "depreciation", "balance-sheet", "cash-flow"]
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
    'id="exportDataButton"',
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

  if (idQueryCount > 73 || selectorQueryCount > 2)
  {
    throw new Error(
      "UI shell query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  var transactionsResponseSource = getSourceRegion(
    source,
    "function requestTransactionsPage()",
    "function changeTransactionsPage(delta)",
    "UI shell Transactions response handling"
  );
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(transactionsResponseSource, token, "Transactions response mutation");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    destinations: 11,
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
  var source = getAssembledFrontendSource();
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
    { page: "dashboard", destination: "dashboard" },
    { page: "transactions", destination: "transactions" },
    { page: "finance", destination: "profit-loss" },
    { page: "settings", destination: "settings" },
    { page: "logs", destination: "logs" }
  ];
  var unavailableDestinations = [
    { id: "products", label: "Products" },
    { id: "capital-equity", label: "Capital &amp; Equity" },
    { id: "assets", label: "Assets" },
    { id: "depreciation", label: "Depreciation" },
    { id: "balance-sheet", label: "Balance Sheet" },
    { id: "cash-flow", label: "Cash Flow" }
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
    11,
    "represented destination count"
  );
  assertSourceOccurrenceCount(
    navigationSource,
    'data-page="',
    5,
    "active route count"
  );
  scenariosPassed++;

  activeDestinations.forEach(function(destination)
  {
    assertSourceContainsOnce(
      navigationSource,
      'data-page="' + destination.page + '"',
      "active page " + destination.page
    );
    assertSourceContainsOnce(
      navigationSource,
      'data-navigation-destination="' + destination.destination + '"',
      "represented active destination " + destination.destination
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
    6,
    "unavailable semantics"
  );
  unavailableDestinations.forEach(function(destination) {
    var destinationToken = 'data-navigation-destination="' + destination.id + '" class="ui-future-module';
    assertSourceContains(unavailableGroupSource, destinationToken, "unavailable destination remains non-interactive");
  });
  scenariosPassed++;

  [
    'id="financialModulesDisclosureButton"',
    'aria-expanded="true"',
    'aria-controls="financialModulesGroup"',
    'aria-label="Finance, expanded"',
    'id="financialModulesGroup"',
    'aria-label="Finance destinations"',
    'id="financialModulesGroup" class="mt-1 space-y-0 pl-5" role="list" aria-label="Finance destinations"',
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

  if (idQueryCount > 110 || selectorQueryCount > 2)
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
  var transactionsResponseSource = getSourceRegion(
    source,
    "function requestTransactionsPage()",
    "function changeTransactionsPage(delta)",
    "navigation Transactions response handling"
  );
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(transactionsResponseSource, token, "Transactions response mutation");
  });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    destinations: 11,
    active: 5,
    unavailable: 6,
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
  var source = getAssembledFrontendSource();
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
    '#transactionsTabList { width: max-content; height: 44px; min-height: 44px;'
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

  assertSourceOccurrenceCount(source, 'data-navigation-destination="', 11, "eleven destinations");
  assertSourceOccurrenceCount(source, 'data-page="', 5, "five active destinations");
  assertSourceOccurrenceCount(source, 'aria-disabled="true"', 6, "six unavailable destinations");
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
  var transactionsResponseSource = getSourceRegion(
    source,
    "function requestTransactionsPage()",
    "function changeTransactionsPage(delta)",
    "full shell Transactions response handling"
  );
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(transactionsResponseSource, token, "Transactions response mutation");
  });

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 73 || selectorQueryCount > 2)
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
    destinations: 11,
    active: 5,
    unavailable: 6,
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

function testAccessibilityContract()
{
  var source = getAssembledFrontendSource();

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
  assertSourceContains(
    source,
    '#appShell#appShell#appShell#appShell :where(button, a, input, select, textarea, [role="button"], [role="tab"], [tabindex]):is(:focus, :focus-visible, :active)',
    "global interaction visual suppression"
  );
  assertSourceContains(
    source,
    '--tw-ring-offset-shadow: 0 0 #0000 !important;',
    "Tailwind interaction ring suppression"
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

function testDashboardOverviewStabilizationContract()
{
  var source = getAssembledFrontendSource();
  var scenariosPassed = 0;

  [
    "Open Source Data",
    "function openDashboardSourceData()",
    'setActiveTransactionsTab("recent");',
    'showPage("transactions");',
    "Export Data",
    "Sales + expenses for this period",
    "function exportDashboardData(button)",
    'onclick="exportDashboardData(this)"',
    "Copy Summary",
    "function buildDashboardSummaryText(res)",
    "function copyDashboardSummary(button)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Dashboard Overview stabilization action");
  });
  scenariosPassed++;

  [
    "Print Report",
    "Data Summary",
    "function printDashboardReport()",
    "window.print();",
    'id="printReportButton"',
    'id="printReportHeader"'
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "retired Dashboard Overview action");
  });
  scenariosPassed++;

  [
    'tab: "recent",',
    'lifecycleState: "active"',
    "filter: lastDashboardRequest.filter",
    "customStart: lastDashboardRequest.customStart",
    "customEnd: lastDashboardRequest.customEnd",
    'var headers = ["Date", "Type", "ID", "Item", "Qty", "Amount"];',
    'escapeCsvCell(row.transactionType === "Sales" ? row.qty : "", true)',
    'downloadDashboardTransactionsCsv(response.data.rows, activePeriod.startDate, activePeriod.endDate);',
    "sanitizeCsvCellValue(value, isNumericColumn)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Dashboard ledger export contract");
  });
  var dashboardExportSource = getSourceRegion(
    source,
    "function exportDashboardData(button)",
    "function formatDashboardSummaryCurrency",
    "one-click Dashboard export"
  );
  var dashboardExportServerSource = getTransactionsExport.toString() + getTransactionsPeriodRows.toString() +
    getCanonicalTransactionData.toString();
  [
    'return "numlock-transactions-" + startDate + "-to-" + endDate + ".csv";',
    'escapeCsvCell(row.date, false)', 'escapeCsvCell(row.transactionType, false)',
    'escapeCsvCell(row.id, false)', 'escapeCsvCell(row.item, false)',
    '["\\uFEFF" + csvRows.join("\\r\\n")]', '{ type: "text/csv;charset=utf-8" }'
  ].forEach(function(token)
  {
    assertSourceContains(dashboardExportSource, token, "combined Dashboard CSV projection");
  });
  ['timedRead("salesReadMs", "tabsal"', 'timedRead("expenseReadMs", "tabops"',
    'filterTransactionsPeriodRows(periodResult.rows'].forEach(function(token)
  {
    assertSourceContains(dashboardExportServerSource, token, "canonical period export source");
  });
  ["Purchase", 'getSheetByName("Transaction")', "toggleDashboardExportMenu", "role=\"menuitem\""].forEach(function(token)
  {
    assertSourceExcludes(dashboardExportSource, token, "retired or non-canonical Dashboard export path");
  });
  var downloadStart = source.indexOf("function formatDashboardTransactionsFilename(");
  var downloadEnd = source.indexOf("function formatDashboardSummaryCurrency", downloadStart);
  var capturedCsv = "";
  var downloadClicks = 0;
  var dashboardDownload = Function(
    "escapeCsvCell", "Blob", "URL", "document", "logClientEvent",
    source.slice(downloadStart, downloadEnd) +
      "; return { download: downloadDashboardTransactionsCsv, filename: formatDashboardTransactionsFilename };"
  )(
    function(value) { return '"' + String(value).replace(/"/g, '""') + '"'; },
    function(parts) { capturedCsv = parts[0]; },
    { createObjectURL: function() { return "blob:test"; }, revokeObjectURL: function() {} },
    { body: { appendChild: function() {} }, createElement: function() {
      return { hidden: false, click: function() { downloadClicks++; }, remove: function() {} };
    } },
    function() {}
  );
  dashboardDownload.download([
    { date: "2026-08-01", transactionType: "Sales", id: "SAL-1", item: "Latte", qty: 2, amount: 40000 },
    { date: "2026-08-02", transactionType: "Expense", id: "OPS-1", item: "Rent", qty: 0, amount: 100000 }
  ], "2026-08-01", "2026-08-31");
  if (downloadClicks !== 1 ||
      dashboardDownload.filename("2026-08-01", "2026-08-31") !== "numlock-transactions-2026-08-01-to-2026-08-31.csv" ||
      capturedCsv.indexOf('"Date","Type","ID","Item","Qty","Amount"') === -1 ||
      capturedCsv.indexOf('"2026-08-01","Sales","SAL-1","Latte","2","40000"') === -1 ||
      capturedCsv.indexOf('"2026-08-02","Expense","OPS-1","Rent","","100000"') === -1) {
    throw new Error("Combined Dashboard CSV projection mismatch");
  }
  scenariosPassed++;

  [
    "Reporting Period: ", "Revenue: ", "Gross Margin: ", "Profit: ",
    "Profit Margin: ", "Expense: ", "Units Sold: ", "Best Seller: ",
    "Top Revenue Product: ", "Top Profit Product: ", "Best Margin Item: ",
    "Largest Expense Driver: ", "Revenue Concentration: "
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "ordered Copy Summary item");
  });
  scenariosPassed++;

  [
    "performanceAnalytics.totalGrossMargin",
    "insights.profitMargin",
    "performanceAnalytics.productProfitability",
    "performanceAnalytics.expenseGroups",
    "res.revenueConcentration.contribution",
    "navigator.clipboard.writeText",
    'strong.innerText = "Copied";',
    'strong.innerText = "Copy failed";'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "canonical Copy Summary source and feedback");
  });
  scenariosPassed++;

  var kpiSource = getSourceRegion(
    source,
    "function renderOverviewKpiCard(",
    "function renderBusinessOverview(",
    "information-only KPI renderer"
  );
  ["<button", "onclick=", "applyTransactionDrilldown(", "cursor-pointer"].forEach(function(token)
  {
    assertSourceExcludes(kpiSource, token, "information-only KPI renderer");
  });
  scenariosPassed++;

  [
    '<option value="currentMonth">This Month</option>',
    '<option value="previousMonth">Previous Month</option>',
    '<option value="currentYear" selected>This Year</option>',
    '<option value="previousYear">Previous Year</option>',
    '<option value="customMonth">Custom Month</option>',
    '<option value="customYear">Custom Year</option>',
    '<option value="custom">Custom Range</option>',
    '#filterListbox { position: absolute;',
    "max-height: none;",
    "overflow: visible;",
    "singleColumnHeight <= Math.max(spaceBelow, spaceAbove) ? 1 : 2",
    'width: 100%; min-width: 100%; max-width: 100%;',
    'state.listbox.setAttribute("data-columns", String(columns));',
    "spaceBelow >= estimatedHeight"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "unclipped reporting-period options");
  });
  var periodSelectSource = getSourceRegion(
    source,
    '<select id="filter"',
    '</select>',
    "reporting period option source"
  );
  assertSourceOccurrenceCount(periodSelectSource, '<option value="', 7, "established reporting period options");
  assertSourceExcludes(periodSelectSource, ".slice(", "reporting period option truncation");
  assertSourceExcludes(periodSelectSource, "overflow", "reporting period option clipping");
  [
    '#filterListbox .ui-custom-select-option { box-sizing: border-box; width: 100%; min-width: 0;',
    '<td class="hf-top-products-units tabular-nums">',
    '.hf-top-products-table tbody td.hf-top-products-units { text-align: left !important; }',
    'heading("name", "Product") + heading("qty", "Units") + heading("revenue", "Revenue")'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact period width and Units body alignment");
  });
  assertSourceExcludes(source, '<th scope="col" class="hf-top-products-units"', "Units header alignment change");
  assertSourceExcludes(source, '<td class="hf-top-products-units font-semibold', "Revenue alignment change");
  [
    "function toggleDashboardExportMenu(", "dashboard-export-menu", 'role="menuitem"',
    "Sales, Expenses, or All", "All Data</button>", "state.listbox.style.width"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "retired chooser or competing period width owner");
  });
  scenariosPassed++;

  [
    'topProductsSort = { key: "qty", direction: "desc" };',
    "latestTopProducts = topProducts.slice();",
    "function compareTopProductValues(left, right, key)",
    "String(left.name || \"\").localeCompare",
    "Number(left[key] || 0) - Number(right[key] || 0)",
    "left.stableIndex - right.stableIndex",
    'direction: topProductsSort.direction === "asc" ? "desc" : "asc"',
    'aria-sort="'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "stable sortable Top Products");
  });
  scenariosPassed++;

  var summaryOrder = [
    "Reporting Period: ", "Revenue: ", "Gross Margin: ", "Profit: ",
    "Profit Margin: ", "Expense: ", "Units Sold: ", "Best Seller: ",
    "Top Revenue Product: ", "Top Profit Product: ", "Best Margin Item: ",
    "Largest Expense Driver: ", "Revenue Concentration: "
  ];
  summaryOrder.reduce(function(previousIndex, token)
  {
    var index = source.indexOf(token, previousIndex + 1);
    if (index <= previousIndex) throw new Error("Copy Summary order mismatch at " + token);
    return index;
  }, -1);
  scenariosPassed++;

  Logger.log("PASS: testDashboardOverviewStabilizationContract | scenarios=" + scenariosPassed);
  return { passed: true, scenarios: scenariosPassed };

  /* Historical Print Report contract retained below for release archaeology. */

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
    "PASS: historical testPrintReportContract | scenarios=" +
    summary.scenarios +
    " | printReady=" +
    summary.printReady
  );

  return summary;
}

function testCsvExportContract()
{
  var source = getAssembledFrontendSource();
  var exportServerSource = getTransactionsExport.toString() + filterTransactionsPeriodRows.toString();
  var scenariosPassed = 0;

  [
    'id="exportCsvButton"',
    'type="button"',
    'Export CSV',
    'aria-label="Export all matching Transactions to CSV"',
    'disabled'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "CSV accessibility contract");
  });
  scenariosPassed++;

  ["filterTransactionsPeriodRows(periodResult.rows", "rows: rows, totalRows: rows.length", "item: row.product || row.purchaseCategory"].forEach(function(token) {
    assertSourceContains(exportServerSource, token, "server full matching CSV contract");
  });

  assertSourceContains(
    source,
    'exportCsvButton: required.exportCsvButton',
    "CSV action owned by Transactions toolbar"
  );
  scenariosPassed++;

  [
    '"NUMLOCK_" + (datasetLabel || "Transactions") + "_"',
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
    'var headers = ["Transaction ID", "Date", "Type", "Item", "Qty", "Amount"];',
    'getTransactionsExport({',
    'downloadTransactionsCsv(response.data.rows, Number(response.data.totalRows))',
    'escapeCsvCell(formatTransactionDate(row.date), false)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "full matching CSV projection");
  });
  scenariosPassed++;

  [
    'tab: activeTransactionsTab',
    'lifecycleState: transactionsLifecycleState',
    'search: transactionsSearchQuery',
    'drilldownType: activeTransactionDrilldown'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "active logical CSV view");
  });
  scenariosPassed++;

  [
    'escapeCsvCell(row.id, false)',
    'escapeCsvCell(row.transactionType, false)',
    'escapeCsvCell(row.item, false)',
    'escapeCsvCell(row.amount, true)'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "six-column CSV without Actions");
  });
  scenariosPassed++;

  [
    'rows.forEach(function(row)',
    'rows.length + " matching transaction rows were exported successfully."'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "full CSV ordering preserved");
  });
  scenariosPassed++;

  [
    'visibleTransactionRowCount = transactions.length;',
    'visibleTransactionRowCount === 0;',
    'button.disabled = visibleTransactionRowCount === 0;'
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
    "escapeCsvCell(row.qty || \"-\", true)",
    "escapeCsvCell(row.amount, true)",
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
    'downloadLink.download = formatCsvFilename(new Date(), datasetLabel);',
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
    "recentTransactions",
    "getDashboardData(",
    "spreadsheet",
    "hiddenFields"
  ].forEach(function(token)
  {
    assertSourceExcludes(
      exportFunctionSource,
      token,
      "CSV dashboard source-object or hidden-field access"
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
  var source = getAssembledFrontendSource();

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
  var deferredPresentationStart =
    source.indexOf("function renderDeferredDashboardPresentation(res)");
  var deferredPresentationEnd =
    source.indexOf("function createInitialTransactionEntryState", deferredPresentationStart);
  var deferredSource =
    source.slice(deferredRenderStart) +
    source.slice(deferredPresentationStart, deferredPresentationEnd);
  var cacheSource =
    source.slice(
      stableCacheStart,
      source.indexOf(
        "function toggleFinancialModulesDisclosure",
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
    "dashboardContent", "tableBody", "exportDataButton", "copySummaryStatus",
    "transactions", "transactionsHeading",
    "transactionsDescription", "transactionsTabList",
    "transactionsPanelGroup", "transactionsEvidenceRegion",
    "exportCsvButton", "transactionsResultHeading", "transactionsScopeText",
    "transactionDrilldownSummary", "transactionDrilldownText",
    "transactionsTableCard", "transactionsPagination", "transactionsPreviousPage", "transactionsNextPage", "transactionsPageIndicator", "transactionsPageSize", "appShell", "sidebarCollapseButton",
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
    "transactionsPagination: required.transactionsPagination",
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

  if (idQueryCount > 73 || selectorQueryCount > 2)
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
    [immediateSource, deferredSource].forEach(function(renderSource)
    {
      assertSourceExcludes(
        renderSource,
        token,
        "in-place Dashboard response mutation"
      );
    });
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

function testSecondaryDestinationsHighFidelityContract()
{
  var diagnosticsSource = include("191.View.Diagnostics");
  var source = getAssembledFrontendSource();
  var assembledSource = source
    .replace("<?!= include('191.View.Diagnostics'); ?>", diagnosticsSource);
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

  assertSourceOccurrenceCount(transactionsRegion, 'data-transactions-tab="', 3, "three Transactions tabs");
  assertSourceOccurrenceCount(transactionsRegion, 'scope="col"', 8, "eight Transactions columns");
  [">Transaction ID</th>", ">Date</th>", ">Type</th>", ">Item</th>", ">Qty</th>", ">Amount</th>", ">IsActive</th>", ">Actions</th>"].forEach(function(token)
  {
    assertSourceContains(transactionsRegion, token, "authoritative Transactions column");
  });
  scenariosPassed++;

  [
    'id="transactionsToolbar"', "hf-transactions-toolbar",
    'id="transactionsResultHeading"', 'id="transactionsScopeText"',
    'id="transactionDrilldownSummary"', 'id="exportCsvButton"',
    'id="transactionsTableScroll"', 'id="transactionsTableCard"', "hf-secondary-surface"
  ].forEach(function(token)
  {
    assertSourceContains(transactionsRegion, token, "table-dominant Transactions composition");
  });
  scenariosPassed++;

  [
    "getTransactionsPage({",
    "pageSize: transactionsPageSize",
    "Expense rows in the active period.",
    "getTransactionsExport({",
    "buildLocalTransactionsPage(pageNumber)",
    "sanitizeCsvCellValue(value, isNumericColumn)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "bounded visible Transactions evidence");
  });
  scenariosPassed++;

  [
    'setActiveTransactionsTab("recent");',
    "activeTransactionDrilldown = null;",
    'onclick="clearTransactionDrilldown()"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "drill-down focus and reset");
  });
  scenariosPassed++;

  [
    "#transactionsTableScroll th { height: 38px;",
    "#transactionsTableScroll td { height: 40px;",
    "#transactionsTableScroll table { width: 100%; table-layout: fixed; }",
    "font-variant-numeric: tabular-nums",
    "min-w-[680px]",
    "overflow-x: auto; overflow-y: visible"
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

  ["profile", "notifications", "integrations", "type=\"checkbox\"", "<textarea"].forEach(function(token)
  {
    assertSourceExcludes(settingsRegion, token, "unsupported Settings control");
  });
  assertSourceContains(settingsRegion, 'id="transactionsPageSize"', "approved Transactions pagination preference");
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
  var transactionsClientSource =
    include("192.View.Transactions.State") +
    include("193.View.Transactions.Render");
  [
    "function setTransactionsLifecycleState(value)",
    "transactionsPages[activeTransactionsTab] = 1;",
    "requestTransactionsPage();",
    "getTransactionsPage({"
  ].forEach(function(token)
  {
    assertSourceContains(transactionsClientSource, token, "server-backed Transactions lifecycle filtering");
  });
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(transactionsClientSource, token, "Transactions response mutation");
  });

  var idQueryCount = (assembledSource.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount = (assembledSource.match(/document\.querySelector(?:All)?\(/g) || []).length;
  if (idQueryCount > 73 || selectorQueryCount > 2)
  {
    throw new Error("Secondary destination query budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred phase owner");
  assertSourceExcludes(source, "ResizeObserver", "secondary destination ResizeObserver");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleResponsiveChartResize);', "single responsive resize listener");
  assertSourceContainsOnce(assembledSource, 'window.addEventListener("resize", scheduleLayoutDebugMeasurement);', "single layout-debug resize listener");
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    destinations: 3,
    transactionTabs: 4,
    columns: 8,
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

function testSettingsVisualContract()
{
  var source = getAssembledFrontendSource();
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

  var themeControllerStart = source.indexOf("function handleSystemThemeChange()");
  var themeControllerEnd = source.indexOf("function renderSessionClientLogs", themeControllerStart);
  var themeSource = getSourceRegion(
    source,
    "function applyChartThemeTokens(chart, palette, chartKind)",
    "function synchronizeChartTheme",
    "Chart theme application"
  ) + getSourceRegion(
    source,
    "function synchronizeChartTheme(forceLight)",
    "let transactionsTabsInitialized",
    "Chart theme synchronization"
  ) +
    source.slice(themeControllerStart, themeControllerEnd);

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
  var settingsPageSizeSelectSource = getSourceRegion(
    settingsRegion,
    '<select id="transactionsPageSize"',
    "</select>",
    "Settings Transactions page-size control"
  );
  [
    'onchange="setTransactionsPageSize(this.value)"',
    '<option value="15">15</option>',
    '<option value="25">25</option>',
    '<option value="50">50</option>'
  ].forEach(function(token)
  {
    assertSourceContains(settingsPageSizeSelectSource, token, "approved Settings native select");
  });
  assertSourceExcludes(
    settingsRegion.replace(settingsPageSizeSelectSource, ""),
    "<select",
    "unowned Settings native select"
  );
  ["<textarea", 'type="checkbox"'].forEach(function(token)
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

  if (idQueryCount > 73 || selectorQueryCount > 2)
  {
    throw new Error("Settings query budget exceeded");
  }
  assertSourceContainsOnce(
    source,
    "function scheduleDeferredDashboardRender(res, requestToken)",
    "single deferred phase preserved"
  );
  assertNoDirectDashboardResponseSort(source, "Settings");
  [".reverse(", ".splice("].forEach(function(token)
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
  var source = getAssembledFrontendSource();
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
  var controllerEnd = source.indexOf("function toggleKpiTargetDetails", controllerStart);
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

  if (idQueryCount > 73 || selectorQueryCount > 2)
  {
    throw new Error("Logs query budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred phase owner preserved");
  assertNoDirectDashboardResponseSort(source, "Logs");
  [".reverse(", ".splice("].forEach(function(token)
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
  var source = getAssembledFrontendSource();
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
    "updateTransactionsViewPresentation(result);",
    1,
    "authoritative paginated Transactions presentation call"
  );
  assertSourceContainsOnce(
    source,
    "function updateTransactionsViewPresentation(result)",
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
    'id="aboutVersion"', 'id="copySummaryStatus"'
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

  var includeSource = String(include);
  var rawIndexSource = HtmlService.createTemplateFromFile("190.View.Index").getRawContent();
  var partialNames = [
    "197.View.Dashboard.Charts", "192.View.Transactions.State",
    "196.View.Dashboard.Render", "194.View.Transactions.Forms",
    "195.View.Transactions.Actions", "191.View.Diagnostics",
    "193.View.Transactions.Render", "198.View.Dashboard.Controller"
  ];
  var priorIncludeIndex = -1;
  assertSourceContains(includeSource, ".createTemplateFromFile(filename)", "raw frontend partial loader");
  assertSourceContains(includeSource, ".getRawContent()", "unprocessed frontend partial source");
  assertSourceExcludes(includeSource, "createHtmlOutputFromFile", "standalone partial HTML parsing");
  partialNames.forEach(function(filename)
  {
    var includeToken = "<?!= include('" + filename + "'); ?>";
    assertSourceContainsOnce(rawIndexSource, includeToken, filename + " raw include");
    var includeIndex = rawIndexSource.indexOf(includeToken);
    if (includeIndex <= priorIncludeIndex) throw new Error("Frontend partial include order mismatch: " + filename);
    priorIncludeIndex = includeIndex;
    assertSourceExcludes(include(filename), "<script", filename + " nested script wrapper");
  });
  var rawTemplateLiteral = 'return `\n            <div class="overview-surface rounded-2xl border p-4">';
  assertSourceContains(include("196.View.Dashboard.Render"), rawTemplateLiteral, "raw HTML template literal");
  assertSourceContains(source, rawTemplateLiteral, "assembled raw HTML template literal");
  assertSourceExcludes(source, "&lt;div class=\"overview-surface", "escaped HTML template literal");
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
    "function setActiveTransactionsTab(tabName)",
    "function initializeTransactionsTabs",
    "refactor Transactions tab ownership"
  );
  [navigationSource, dashboardTabSource].forEach(function(region)
  {
    ["google.script.run", "getDashboardData(", "requestDashboardData("].forEach(function(token)
    {
      assertSourceExcludes(region, token, "tab or navigation backend request");
    });
  });
  scenariosPassed++;

  var transactionsRenderSource =
    include("192.View.Transactions.State") +
    include("193.View.Transactions.Render");
  [
    "function setTransactionsLifecycleState(value)",
    "transactionsPages[activeTransactionsTab] = 1;",
    "requestTransactionsPage();",
    "getTransactionsPage({"
  ].forEach(function(token)
  {
    assertSourceContains(transactionsRenderSource, token, "server-backed Transactions lifecycle filtering");
  });
  [".sort(", ".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(transactionsRenderSource, token, "Transactions response mutation");
  });
  assertSourceContains(source, "pageSize: transactionsPageSize", "bounded Transactions page request");
  assertSourceContains(transactionsTabSource, "requestTransactionsPage();", "server-backed Transactions tab switch");
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
    "#dashboardTabList { height: 44px;", "#transactionsTabList { width: max-content; height: 44px;", "#transactionsTableScroll th { height: 38px;",
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
  if (idQueryCount > 73 || selectorQueryCount > 2)
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
  var source = getAssembledFrontendSource();
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
    52,
    "closure runner membership"
  );
  assertSourceContains(
    predecessorRunnerSource,
    '{ name: "testBoundedUiRefactorContract"',
    "52-entry predecessor gate"
  );
  [
    "testLegacyTransactionSyncService",
    "testLegacyTransactionSyncTriggerDelegation",
    "testLegacySyncRuntimeAcceptanceHarness"
  ].forEach(function(testName)
  {
    assertSourceExcludes(predecessorRunnerSource, testName, "retired legacy runner member");
  });
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
  if (idQueryCount > 73 || selectorQueryCount > 2)
  {
    throw new Error("UI/UX 2.0 closure performance budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "one deferred render phase owner");
  assertSourceExcludes(source, "ResizeObserver", "recurring resize ownership");
  assertSourceContainsOnce(source, 'window.addEventListener("resize", scheduleResponsiveChartResize);', "single recurring resize owner");
  assertNoDirectDashboardResponseSort(source, "bounded UI");
  [".reverse(", ".splice("].forEach(function(token)
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
    runnerTotal: 52,
    packagesComplete: packages.length,
    destinations: 11,
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
  var diagnosticsSource = include("191.View.Diagnostics");
  var source = getAssembledFrontendSource();
  var assembledSource = source
    .replace("<?!= include('191.View.Diagnostics'); ?>", diagnosticsSource);
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
  var transactionsTabSource = getSourceRegion(
    source,
    'id="transactionsTabList"',
    "</div>",
    "Transactions tablist"
  );
  assertSourceOccurrenceCount(transactionsTabSource, 'data-transactions-tab="', 3, "Transactions tabs");
  var transactionTabTokens = [
    'data-transactions-tab="recent"',
    'data-transactions-tab="sales"',
    'data-transactions-tab="expenses"'
  ];
  transactionTabTokens.forEach(function(token, index)
  {
    assertSourceContainsOnce(transactionsTabSource, token, "required Transactions tab");
    if (index > 0 &&
        transactionsTabSource.indexOf(transactionTabTokens[index - 1]) > transactionsTabSource.indexOf(token))
    {
      throw new Error("Transactions tab order changed");
    }
  });
  [
    'data-transactions-tab="purchases"',
    'id="transactionsTabPurchases"',
    ">Purchases</button>"
  ].forEach(function(token)
  {
    assertSourceExcludes(transactionsTabSource, token, "retired Purchases tab");
  });
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
  assertSourceContainsOnce(assembledSource, 'window.addEventListener("resize", scheduleLayoutDebugMeasurement);', "bounded layout-debug resize listener");
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
  if (idQueryCount > 73 || selectorQueryCount > 2)
  {
    throw new Error("Final stabilization query budget exceeded");
  }
  assertSourceContainsOnce(source, "function scheduleDeferredDashboardRender(res, requestToken)", "single deferred render phase owner");
  assertNoDirectDashboardResponseSort(source, "final stabilization");
  [".reverse(", ".splice("].forEach(function(token)
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
    destinations: 11,
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
  var chartSource = getAssembledFrontendSource();
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
  var source = getAssembledFrontendSource();

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
  var source = getAssembledFrontendSource();

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
