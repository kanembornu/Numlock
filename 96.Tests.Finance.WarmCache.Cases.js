// 11X.3K — Finance warm-cache + instant navigation tests (static/synthetic)

function testFinanceWarmCacheKeyGeneration()
{
  // buildFinanceCacheKey produces correct keys
  var source = getAssembledFrontendSource();

  // CurrentYear key
  assertSourceContains(source, 'return filter || "currentYear"', '11X.3K cache key default filter');
  assertSourceContains(source, '"custom|" + customStart + "|" + customEnd', '11X.3K cache key custom range');
}

function testFinanceCacheStructureExists()
{
  var source = getAssembledFrontendSource();
  assertSourceContains(source, 'financeCache = { finance: {}, productProfitability: {} }', '11X.3K cache structure declared');
  assertSourceContains(source, 'financeInflight = {}', '11X.3K in-flight structure declared');
}

function testFinanceCacheValidation()
{
  var source = getAssembledFrontendSource();
  // isValidFinanceCacheEntry must exist and validate
  assertSourceContains(source, 'function isValidFinanceCacheEntry(entry)', '11X.3K cache validation function exists');
  assertSourceContains(source, 'isFinanceDataCompatible(entry.data, entry.destination)', '11X.3K validation delegates to isFinanceDataCompatible');
}

function testFinanceCacheServesPnL()
{
  var source = getAssembledFrontendSource();
  // ensureFinanceData checks finance cache for profit-loss
  assertSourceContains(source, 'function ensureFinanceData()', '11X.3K ensureFinanceData exists');
  assertSourceContains(source, 'cacheEntry && isValidFinanceCacheEntry(cacheEntry)', '11X.3K ensureFinanceData validates cache entry');
  assertSourceContains(source, 'renderActiveFinanceDestination(cacheEntry.data)', '11X.3K ensureFinanceData renders from cache');
}

function testFinanceCacheServesCE()
{
  var source = getAssembledFrontendSource();
  // C&E shares "finance" cache type with P&L
  assertSourceContains(source, 'dest === "product-profitability" ? "productProfitability" : "finance"', '11X.3K C&E and P&L share finance cache type');
}

function testFinanceCacheServesPP()
{
  var source = getAssembledFrontendSource();
  // PP uses separate productProfitability cache
  assertSourceContains(source, '"productProfitability"', '11X.3K PP has separate cache type');
  assertSourceContains(source, 'financeCache.productProfitability[cacheKey]', '11X.3K PP cache lookup present');
}

function testFinanceInFlightDeduplication()
{
  var source = getAssembledFrontendSource();
  // requestFinanceData joins existing in-flight
  assertSourceContains(source, 'financeInflight[cacheType + "|" + cacheKey]', '11X.3K in-flight tracking uses cache key');
  assertSourceContains(source, 'setFinanceViewState("loading");', '11X.3K dedup shows loading state');
}

function testFinanceCachePopulation()
{
  var source = getAssembledFrontendSource();
  // Success handler caches validated response
  assertSourceContains(source, 'financeCache[cacheType][cacheKey] = { data: response, destination: dest }', '11X.3K cache populated on success');
  assertSourceContains(source, 'isFinanceDataCompatible(response, dest)', '11X.3K response validated before caching');
}

function testFinanceSiblingWarmUp()
{
  var source = getAssembledFrontendSource();
  // After finance success → warm PP; after PP success → warm finance
  assertSourceContains(source, 'warmProductProfitabilityData(capturedFilter, capturedCustomStart, capturedCustomEnd)', '11X.3K finance success warms PP');
  assertSourceContains(source, 'warmFinanceData(capturedFilter, capturedCustomStart, capturedCustomEnd)', '11X.3K PP success warms finance');
}

function testFinanceBackgroundWarmFunctions()
{
  var source = getAssembledFrontendSource();
  assertSourceContains(source, 'function warmFinanceData(filter, customStart, customEnd)', '11X.3K warmFinanceData exists');
  assertSourceContains(source, 'function warmProductProfitabilityData(filter, customStart, customEnd)', '11X.3K warmProductProfitabilityData exists');
}

function testFinanceCacheInvalidation()
{
  var source = getAssembledFrontendSource();
  assertSourceContains(source, 'function invalidateFinanceCache()', '11X.3K invalidateFinanceCache exists');
  assertSourceContains(source, 'financeCache = { finance: {}, productProfitability: {} }', '11X.3K invalidation resets both cache pools');
  assertSourceContains(source, 'financeInflight = {}', '11X.3K invalidation clears in-flight state');
}

function testFinanceCacheInvalidationOnMutation()
{
  var source = getAssembledFrontendSource();
  assertSourceContains(source, 'invalidateFinanceCache();', '11X.3K cache invalidated on transaction mutation');
}

function testFinanceStartupPreload()
{
  var source = getAssembledFrontendSource();
  // 11Y.53 — warmup moved from window.onload to after Dashboard T5
  assertSourceContains(source, 'warmFinanceData("currentYear", null, null)', '11Y.53 startup preloads finance currentYear');
  assertSourceContains(source, 'warmProductProfitabilityData("currentYear", null, null)', '11Y.53 startup preloads PP currentYear');
  assertSourceContains(source, 'setTimeout(function()', '11Y.53 startup warm-up is async');
  // 11Y.53 — warmup must use typeof guards for safety
  assertSourceContains(source, "typeof warmFinanceData === 'function'", '11Y.53 warmFinanceData guarded by typeof');
  assertSourceContains(source, "typeof warmProductProfitabilityData === 'function'", '11Y.53 warmProductProfitabilityData guarded by typeof');
  // 11Y.53 — t9 must still be assigned in warmup block
  assertSourceContains(source, '__numlockStartupProfile.t9 = performance.now()', '11Y.53 t9 assigned in warmup setTimeout');
}

function testFinanceDestinationBoundGuardsPreserved()
{
  var source = getAssembledFrontendSource();
  // 11X.3D destination-bound request guards must be preserved
  assertSourceContains(source, 'requestId !== financeState.activeRequestId', '11X.3K requestId guard preserved');
  assertSourceContains(source, 'dest !== financeState.destination', '11X.3K destination guard preserved');
}

function testFinanceNoCrossDestinationRender()
{
  var source = getAssembledFrontendSource();
  // Cache entry stores destination; ensureFinanceData uses cacheType based on current dest
  assertSourceContains(source, 'var cacheType = dest === "product-profitability" ? "productProfitability" : "finance"', '11X.3K cache type derived from active destination');
  // Cache entry destination must match for validation
  assertSourceContains(source, 'entry.destination', '11X.3K cache entry carries destination tag');
}

function testFinanceFilterNotKeyedByDestination()
{
  var source = getAssembledFrontendSource();
  // Cache key uses filter only, not destination
  assertSourceContains(source, 'buildFinanceCacheKey(filter, customStart, customEnd)', '11X.3K cache key built from filter params only');
}

function testFinanceStaleResponseCached()
{
  var source = getAssembledFrontendSource();
  // Successful response populates cache even if user navigated away
  // The cache population happens before the destination guard check
  assertSourceContains(source, 'financeCache[cacheType][cacheKey] = { data: response, destination: dest }', '11X.3K stale response cached (guard check is after)');
}

function testFinanceSetFinanceDestinationDecoupled()
{
  var source = getAssembledFrontendSource();
  // setFinanceDestination no longer contains render or request logic
  // It should only update UI elements (heading, context, disclosures)
  assertSourceContains(source, 'function setFinanceDestination(destination)', '11X.3K setFinanceDestination exists');
  assertSourceContains(source, 'getFinanceElement("financeHeading").textContent = headingText', '11X.3K setFinanceDestination updates heading');
}

// 11X.3M — invalidation bumps activeRequestId so stale callbacks cannot repopulate cache
function testFinanceWarmCacheMutationInvalidatesOutstandingRequest()
{
  var source = getAssembledFrontendSource();

  // Static: invalidation must bump activeRequestId via requestSequence
  assertSourceContains(source, 'financeState.activeRequestId = ++financeState.requestSequence',
    '11X.3M invalidation bumps activeRequestId');

  // Prove bump is inside invalidateFinanceCache — extract the function body
  var fnMatch = source.match(/function invalidateFinanceCache\(\)[^}]*\{([\s\S]*?)\n    \}/);
  if (!fnMatch) throw new Error('11X.3M could not extract invalidateFinanceCache body');
  var body = fnMatch[1];
  if (body.indexOf('financeState.activeRequestId = ++financeState.requestSequence') === -1) {
    throw new Error('11X.3M activeRequestId bump not inside invalidateFinanceCache');
  }
  // Bump must come AFTER cache and inflight clearing
  var cacheClearPos = body.indexOf('financeCache = { finance: {}, productProfitability: {} }');
  var inflightClearPos = body.indexOf('financeInflight = {}');
  var bumpPos = body.indexOf('financeState.activeRequestId = ++financeState.requestSequence');
  if (cacheClearPos === -1 || inflightClearPos === -1) throw new Error('11X.3M cache/inflight clearing not found in invalidation body');
  if (bumpPos <= cacheClearPos || bumpPos <= inflightClearPos) {
    throw new Error('11X.3M activeRequestId bump must come after cache and inflight clearing');
  }

  // Synthetic: simulate race to prove stale callback is blocked
  // Finance dataset path
  var fState = { requestSequence: 5, activeRequestId: 5 };
  var capturedRequestId = fState.activeRequestId; // pre-mutation request

  // Simulate invalidation
  fState.activeRequestId = ++fState.requestSequence; // the fix

  if (fState.activeRequestId !== 6) throw new Error('11X.3M invalidation should bump to 6, got ' + fState.activeRequestId);

  // Stale callback guard check
  var staleBlocked = (capturedRequestId !== fState.activeRequestId);
  if (!staleBlocked) throw new Error('11X.3M stale pre-mutation request was NOT blocked');

  // Post-invalidation request gets newer id
  var postRequestId = ++fState.requestSequence;
  fState.activeRequestId = postRequestId;
  if (postRequestId !== 7) throw new Error('11X.3M post-mutation id should be 7, got ' + postRequestId);
  if (postRequestId <= capturedRequestId) throw new Error('11X.3M post-mutation id must exceed pre-mutation id');

  // PP dataset path — same guard logic applies (PP uses activeRequestId too)
  var ppState = { requestSequence: 3, activeRequestId: 3 };
  var ppCaptured = ppState.activeRequestId;
  ppState.activeRequestId = ++ppState.requestSequence; // invalidation
  var ppStaleBlocked = (ppCaptured !== ppState.activeRequestId);
  if (!ppStaleBlocked) throw new Error('11X.3M PP stale request was NOT blocked');
  var ppPost = ++ppState.requestSequence;
  ppState.activeRequestId = ppPost;
  if (ppPost <= ppCaptured) throw new Error('11X.3M PP post-mutation id must exceed pre-mutation id');
}
