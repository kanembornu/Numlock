// 11Y.2 — cold-start profiling instrumentation tests
// 11Y.2A — navigation timeline clock origin
function testColdStartProfilingInstrumentationContract()
{
  var source = getAssembledFrontendSource();

  // 1. Navigation timeline origin — T0 = 0 (not performance.now())
  assertSourceContains(
    source,
    "t0: 0",
    "profiling / T0 navigation timeline origin"
  );

  // 2. T1 independently captured at window.onload
  assertSourceContains(
    source,
    "__profile.t1 = performance.now()",
    "profiling / T1 independent at onload"
  );

  // 3. T1 not aliased from T0
  assertSourceExcludes(
    source,
    "t1: __profile.t0",
    "profiling / T1 not aliased from T0"
  );

  // 4. Timing instrumentation object exists
  assertSourceContains(
    source,
    "window.__numlockStartupProfile",
    "profiling / in-memory profile object"
  );

  // 5. performance.now() used for runtime timing
  assertSourceContains(
    source,
    "performance.now()",
    "profiling / performance.now usage"
  );

  // 6. No Date.now mixed clock
  assertSourceExcludes(
    source,
    "Date.now",
    "profiling / no Date.now mixed clock"
  );

  // 7. Dashboard request boundary (T2)
  assertSourceContains(
    source,
    "p.t2 = requestStartedAt",
    "profiling / T2 dashboard request sent"
  );

  // 8. Response boundary (T3)
  assertSourceContains(
    source,
    "p.t3 = responseReceivedAt",
    "profiling / T3 dashboard response received"
  );

  // 9. Primary render boundaries (T4, T5)
  assertSourceContains(
    source,
    "p.t4 = performance.now()",
    "profiling / T4 primary render start"
  );
  assertSourceContains(
    source,
    "p.t5 = performance.now()",
    "profiling / T5 primary render end"
  );

  // 10. Chart timing (T6, T7)
  assertSourceContains(
    source,
    "p.t6 = performance.now()",
    "profiling / T6 chart render start"
  );
  assertSourceContains(
    source,
    "p.t7 = performance.now()",
    "profiling / T7 chart render end"
  );

  // 11. Finance warm-up boundary (T9)
  assertSourceContains(
    source,
    "p.t9 = performance.now()",
    "profiling / T9 finance warm-up start"
  );

  // 12. No persistent storage introduced
  assertSourceExcludes(
    source,
    "SpreadsheetApp",
    "profiling / no spreadsheet writes"
  );
  assertSourceExcludes(
    source,
    "PropertiesService",
    "profiling / no properties writes"
  );
  assertSourceExcludes(
    source,
    "CacheService",
    "profiling / no cache writes"
  );

  // 13. Console summary emitted once
  assertSourceContains(
    source,
    '"NUMLOCK Startup Profile"',
    "profiling / console summary label"
  );

  // 14. emitStartupProfile function exists
  assertSourceContains(
    source,
    "function emitStartupProfile()",
    "profiling / emit function defined"
  );

  // 15. No behavioral change — existing DashboardTiming log preserved
  assertSourceContains(
    source,
    '"DashboardTiming"',
    "profiling / existing DashboardTiming preserved"
  );

  // 16. Backend cache status reported
  assertSourceContains(
    source,
    "cacheStatus",
    "profiling / cache status classification"
  );

  // 17. firstUsableMs uses navigation origin (T5 - T0)
  assertSourceContains(
    source,
    "firstUsableMs",
    "profiling / firstUsableMs metric"
  );

  // 18. Navigation-relative metrics
  assertSourceContains(
    source,
    "preWindowLoadMs",
    "profiling / preWindowLoadMs metric"
  );
  assertSourceContains(
    source,
    "windowLoadToRequestMs",
    "profiling / windowLoadToRequestMs metric"
  );
  assertSourceContains(
    source,
    "navigationToRequestMs",
    "profiling / navigationToRequestMs metric"
  );

  // 19. Existing metrics preserved
  assertSourceContains(
    source,
    "serverRoundtripMs",
    "profiling / serverRoundtripMs metric"
  );
  assertSourceContains(
    source,
    "primaryRenderMs",
    "profiling / primaryRenderMs metric"
  );
  assertSourceContains(
    source,
    "chartRenderMs",
    "profiling / chartRenderMs metric"
  );

  // 20. Resource timing — Chart.js (navigation-relative PerformanceResourceTiming)
  assertSourceContains(
    source,
    "chart.umd",
    "profiling / Chart.js resource timing match"
  );

  // 21. Resource timing — Font Awesome
  assertSourceContains(
    source,
    "font-awesome",
    "profiling / Font Awesome resource timing match"
  );

  // 22. Resource timing classification (not "blocking")
  assertSourceContains(
    source,
    "RESOURCE_FINISHED_BEFORE_LOAD",
    "profiling / resource timing classification"
  );
  assertSourceExcludes(
    source,
    "BLOCKING_EARLY",
    "profiling / no blocking claim"
  );

  // 23. backendColdSegments projected from bp.coldSegments
  assertSourceContains(
    source,
    "p.backendColdSegments",
    "profiling / backendColdSegments assignment"
  );

  // 24. Source reads bp.coldSegments (not a copy or rename)
  assertSourceContains(
    source,
    "bp.coldSegments",
    "profiling / source reads bp.coldSegments"
  );

  // 25. Warm/missing coldSegments maps to null
  assertSourceContains(
    source,
    "bp && bp.coldSegments ? bp.coldSegments : null",
    "profiling / warm missing maps to null"
  );

  // 26. Console includes coldSegments in backend section
  assertSourceContains(
    source,
    "coldSegments: p.backendColdSegments",
    "profiling / console coldSegments passthrough"
  );

  // 27. Existing backendTotalMs retained
  assertSourceContains(
    source,
    "p.backendTotalMs = bp ? bp.totalMs || 0 : 0",
    "profiling / backendTotalMs retained"
  );

  // 28. Existing backendCacheHit retained
  assertSourceContains(
    source,
    "p.backendCacheHit = bp ? Boolean(bp.cacheHit) : null",
    "profiling / backendCacheHit retained"
  );

  // 29. Existing cacheStatus retained
  assertSourceContains(
    source,
    "p.cacheStatus",
    "profiling / cacheStatus retained"
  );

  // 30. No backend change — source reads from response, not from backend directly
  assertSourceExcludes(
    source,
    "coldSegments = {",
    "profiling / no backend coldSegments construction in frontend"
  );

  // 31. DashboardTiming unchanged
  assertSourceContains(
    source,
    '"DashboardTiming"',
    "profiling / DashboardTiming unchanged"
  );

  // 32. No rendering change
  assertSourceExcludes(
    source,
    "renderDashboard" + "FromProfile",
    "profiling / no render mutation"
  );

  // 33. No CDN source-order change — Chart.js script tag before FA link
  assertSourceContains(
    source,
    'script src="https://cdn.jsdelivr.net/npm/chart.js',
    "profiling / Chart.js CDN source order"
  );
  assertSourceContains(
    source,
    'link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome',
    "profiling / Font Awesome CDN source order"
  );

  // 34. PerformanceNavigationTiming lookup exists
  assertSourceContains(
    source,
    'performance.getEntriesByType("navigation")',
    "profiling / PerformanceNavigationTiming lookup"
  );

  // 35. Navigation timing segments — five segment formulas
  assertSourceContains(
    source,
    "nav.responseStart - nav.startTime",
    "profiling / navigationToResponseStart formula"
  );
  assertSourceContains(
    source,
    "nav.responseEnd - nav.responseStart",
    "profiling / documentTransfer formula"
  );
  assertSourceContains(
    source,
    "nav.domInteractive - nav.responseEnd",
    "profiling / domParseToInteractive formula"
  );
  assertSourceContains(
    source,
    "nav.domContentLoadedEventEnd - nav.domInteractive",
    "profiling / interactiveToDOMContentLoaded formula"
  );
  assertSourceContains(
    source,
    "nav.loadEventStart - nav.domContentLoadedEventEnd",
    "profiling / domContentLoadedToLoad formula"
  );

  // 36. Reconciliation formula exists
  assertSourceContains(
    source,
    "reconciliationResidualMs",
    "profiling / reconciliation residual"
  );
  assertSourceContains(
    source,
    "navigationMeasuredToLoadMs",
    "profiling / navigationMeasuredToLoad"
  );

  // 37. navSegments added to profile object
  assertSourceContains(
    source,
    "p.navSegments = navSegments",
    "profiling / navSegments assigned to profile"
  );
  assertSourceContains(
    source,
    "navSegments: p.navSegments",
    "profiling / navSegments in console output"
  );

  // 38. try/catch safety — navigation timing
  assertSourceContains(
    source,
    "} catch(e) {}",
    "profiling / try/catch safety for navigation timing"
  );

  // 39. Chart.js resource capture enhanced with raw fields
  assertSourceContains(
    source,
    "chartJsEntry.name",
    "profiling / Chart.js name field"
  );
  assertSourceContains(
    source,
    "chartJsEntry.initiatorType",
    "profiling / Chart.js initiatorType field"
  );
  assertSourceContains(
    source,
    "chartJsEntry.responseStart",
    "profiling / Chart.js responseStart field"
  );

  // 40. Font Awesome resource capture enhanced with raw fields
  assertSourceContains(
    source,
    "fontAwesomeEntry.name",
    "profiling / Font Awesome name field"
  );
  assertSourceContains(
    source,
    "fontAwesomeEntry.initiatorType",
    "profiling / Font Awesome initiatorType field"
  );
  assertSourceContains(
    source,
    "fontAwesomeEntry.responseStart",
    "profiling / Font Awesome responseStart field"
  );

  // 41. try/catch safety — resource timing
  assertSourceContains(
    source,
    'performance.getEntriesByType("resource")',
    "profiling / resource timing getEntriesByType"
  );

  // 42. Existing startup metrics preserved (T0-T9, firstUsable, etc.)
  assertSourceContains(
    source,
    "firstUsableMs",
    "profiling / firstUsableMs preserved"
  );
  assertSourceContains(
    source,
    "preWindowLoadMs",
    "profiling / preWindowLoadMs preserved"
  );
  assertSourceContains(
    source,
    "serverRoundtripMs",
    "profiling / serverRoundtripMs preserved"
  );

  // 43. No Chart.js async/defer change
  assertSourceExcludes(
    source,
    'chart.js@4.5.1/dist/chart.umd.min.js" async',
    "profiling / no Chart.js async attribute"
  );
  assertSourceExcludes(
    source,
    'chart.js@4.5.1/dist/chart.umd.min.js" defer',
    "profiling / no Chart.js defer attribute"
  );

  // 44. Warmup scheduling remains post-T5 — warmupStartOffsetMs uses T9 - T5
  assertSourceContains(
    source,
    "warmupStartOffsetMs",
    "profiling / warmup scheduling metric preserved"
  );

  // 45. domContentLoadedEventStartMs captured in navSegments raw fields
  assertSourceContains(
    source,
    "domContentLoadedEventStartMs",
    "profiling / domContentLoadedEventStartMs raw field"
  );
  assertSourceContains(
    source,
    "Math.round(nav.domContentLoadedEventStart)",
    "profiling / domContentLoadedEventStartMs formula"
  );

  // 46. loadEventEndMs captured in navSegments raw fields
  assertSourceContains(
    source,
    "loadEventEndMs",
    "profiling / loadEventEndMs raw field"
  );
  assertSourceContains(
    source,
    "Math.round(nav.loadEventEnd)",
    "profiling / loadEventEndMs formula"
  );

  // 47. startupResources array exists and assigned
  assertSourceContains(
    source,
    "startupResources",
    "profiling / startupResources exists"
  );
  assertSourceContains(
    source,
    "p.startupResources = startupResources",
    "profiling / startupResources assigned to profile"
  );

  // 48. startupResources is built as an array
  assertSourceContains(
    source,
    "var startupResources = []",
    "profiling / startupResources initialized as array"
  );

  // 49. startupResources captures all resources, not just Chart.js/FA
  assertSourceExcludes(
    source,
    "r.responseEnd > 0",
    "profiling / startupResources no responseEnd filter"
  );
  assertSourceContains(
    source,
    "r.startTime < (p.firstUsableMs || 15000)",
    "profiling / startupResources startTime filter"
  );

  // 50. startupResources includes per-resource fields
  assertSourceContains(
    source,
    "initiatorType: r.initiatorType",
    "profiling / startupResources initiatorType field"
  );
  assertSourceContains(
    source,
    "fullName: r.name",
    "profiling / startupResources fullName field"
  );

  // 51. startupResources emitted in console output
  assertSourceContains(
    source,
    "startupResources: p.startupResources",
    "profiling / startupResources in console output"
  );

  // 52. responseEnd == 0 resources are NOT excluded — filter is startTime-only
  assertSourceExcludes(
    source,
    "responseEnd > 0",
    "profiling / startupResources retains responseEnd == 0 resources"
  );

  // 53. startupResources push is inside startTime guard only, no secondary filter
  assertSourceContains(
    source,
    "startupResources.push",
    "profiling / startupResources push unconditional within startTime"
  );
}

// 11Y.2B — sales read sub-component profiling
function testSalesReadSubComponentProfiling()
{
  var dataSourceSource = include("20.Data.Source");
  var dashboardSource = include("90.Dashboard.Service");

  // 1. existing salesReadMs still present in Data.Source
  assertSourceContains(
    dataSourceSource,
    'performance["salesReadMs"]',
    "salesReadDetail / salesReadMs preserved"
  );

  // 2. salesReadDetail exists in Data.Source
  assertSourceContains(
    dataSourceSource,
    'performance["salesReadDetail"]',
    "salesReadDetail / salesReadDetail assigned in Data.Source"
  );

  // 3. salesReadDetail exposed in coldSegments
  assertSourceContains(
    dashboardSource,
    "salesReadDetail: performance.salesReadDetail",
    "salesReadDetail / salesReadDetail in coldSegments"
  );

  // 4. detail sub-fields present in readBoundedCanonicalTable
  assertSourceContains(
    dataSourceSource,
    "perf.sheetLookupMs",
    "salesReadDetail / sheetLookupMs in reader"
  );
  assertSourceContains(
    dataSourceSource,
    "perf.lastRowMs",
    "salesReadDetail / lastRowMs in reader"
  );
  assertSourceContains(
    dataSourceSource,
    "perf.getValuesMs",
    "salesReadDetail / getValuesMs in reader"
  );
  assertSourceContains(
    dataSourceSource,
    "perf.normalizeMs",
    "salesReadDetail / normalizeMs in reader"
  );

  // 5. residual formula — sum of detail parts decomposes salesReadMs
  assertSourceContains(
    dataSourceSource,
    "var salesDetail = {}",
    "salesReadDetail / salesDetail object created"
  );

  // 6. tabsal call passes perf object
  assertSourceContains(
    dataSourceSource,
    "readBoundedCanonicalTable(ss, \"tabsal\"",
    "salesReadDetail / tabsal readBoundedCanonicalTable call exists"
  );
  assertSourceContains(
    dataSourceSource,
    "readBoundedCanonicalTable(ss, \"tabops\"",
    "salesReadDetail / tabops readBoundedCanonicalTable call exists"
  );
  assertSourceContains(
    dataSourceSource,
    "readBoundedCanonicalTable(ss, \"Products\"",
    "salesReadDetail / Products readBoundedCanonicalTable call exists"
  );
  assertSourceContains(
    dataSourceSource,
    "readBoundedCanonicalTable(ss, \"ExpenseItems\"",
    "salesReadDetail / ExpenseItems readBoundedCanonicalTable call exists"
  );

  // 7. tabops, Products, ExpenseItems do NOT pass perf — extract call lines
  // Each non-tabsal call should end with columnCount + ')' not ', salesDetail)'
  // Verify no salesDetail appears in those calls by checking the function body
  // Only the tabsal IIFE contains salesDetail
  var salesIIFE = dataSourceSource.slice(
    dataSourceSource.indexOf("sales: (function()")
  );
  var firstOtherCall = salesIIFE.indexOf("readBoundedCanonicalTable(ss, \"tabops\"");
  if (firstOtherCall !== -1) {
    var tabopsSegment = salesIIFE.slice(firstOtherCall, firstOtherCall + 200);
    assertSourceExcludes(
      tabopsSegment,
      ", salesDetail)",
      "salesReadDetail / tabops does NOT pass perf"
    );
  }

  // 8. no row-loop timers in readBoundedCanonicalTable
  var readerStart = dataSourceSource.indexOf("function readBoundedCanonicalTable(");
  var readerEnd = dataSourceSource.indexOf("\n}", readerStart) + 2;
  var readerBody = dataSourceSource.slice(readerStart, readerEnd);
  assertSourceExcludes(
    readerBody,
    "forEach(function(row",
    "salesReadDetail / no per-row timer inside reader"
  );

  // 9. bounded width remains 9 for tabsal
  assertSourceContains(
    dataSourceSource,
    '], 9, salesDetail)',
    "salesReadDetail / tabsal bounded width 9 preserved"
  );

  // 10. existing response compatibility — coldSegments preserves all existing keys
  assertSourceContains(
    dashboardSource,
    "salesReadMs: performance.salesReadMs",
    "salesReadDetail / coldSegments salesReadMs preserved"
  );
  assertSourceContains(
    dashboardSource,
    "opsReadMs: performance.expenseReadMs",
    "salesReadDetail / coldSegments opsReadMs preserved"
  );
  assertSourceContains(
    dashboardSource,
    "productsReadMs: performance.productReadMs",
    "salesReadDetail / coldSegments productsReadMs preserved"
  );
  assertSourceContains(
    dashboardSource,
    "expenseItemsReadMs: performance.expenseItemReadMs",
    "salesReadDetail / coldSegments expenseItemsReadMs preserved"
  );
  assertSourceContains(
    dashboardSource,
    "canonicalNormalizeMs: performance.normalizeMs",
    "salesReadDetail / coldSegments canonicalNormalizeMs preserved"
  );
  assertSourceContains(
    dashboardSource,
    "totalMs: performance.totalMs",
    "salesReadDetail / coldSegments totalMs preserved"
  );
}
