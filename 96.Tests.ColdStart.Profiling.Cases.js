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
}
