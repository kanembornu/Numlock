// Local synthetic checks: original source functions only; no Apps Script/network exposed.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8'),base='7bb9ec1f88c8f279baadb5ef62d4c027ed7c0555';
function region(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const index=read('190.View.Index.html');
const logging=region(index,'    function sanitizeClientLogMessage(','    function toggleDataQualityDetails(');
// Keep only logging definitions; next function boundary ends after logClientEvent.
const logEnd=logging.indexOf('\n    function ',logging.indexOf('    function logClientEvent(')+8);
const logs={sessionClientLogs:[],lastClientLogSignature:'',lastClientLogTimestamp:0};vm.createContext(logs);vm.runInContext(logEnd<0?logging:logging.slice(0,logEnd),logs);
logs.logClientEvent('Error','CSV export','https://secret.example a@example.com /Users/name/private');
assert.equal(logs.sessionClientLogs.length,1);assert.ok(!/secret.example|a@example.com|\/Users\//.test(logs.sessionClientLogs[0].message));logs.logClientEvent('Error','CSV export','https://secret.example a@example.com /Users/name/private');assert.equal(logs.sessionClientLogs.length,1);
for(let i=0;i<105;i++)logs.logClientEvent('Info','Dashboard load','Event '+i);assert.equal(logs.sessionClientLogs.length,100);
assert.ok(index.includes('window.addEventListener("beforeprint", function() { synchronizeChartTheme(true); });'));assert.ok(index.includes('window.addEventListener("afterprint", function() { synchronizeChartTheme(false); });'));
const el=Object.fromEntries(['dateFilterLabel','transactionCountLabel','latestDataLabel','freshnessStatusBadge'].map(id=>[id,{}]));
const fresh={initializeStableDashboardElements:()=>el,renderAvailablePeriodOptions(){},formatDashboardMonthRange:()=> 'period',formatDashboardDay:x=>x||''};vm.createContext(fresh);vm.runInContext(region(read('196.View.Dashboard.Render.html'),'    function renderReportingMetadata(','    function formatPeriodComparisonValue('),fresh);
assert.throws(()=>fresh.renderReportingMetadata({}),/metadata is missing/);
for(const status of ['Current','Stale','No Data']){fresh.renderReportingMetadata({dateFilter:{},reportingScope:{transactionCount:3,lastTransactionDate:'2026-11-01'},dataFreshness:{status}});assert.equal(el.freshnessStatusBadge.innerText,status);assert.ok(!el.freshnessStatusBadge.className.includes('undefined'));}
// Both versions: post-mutation callback refreshes Dashboard; cache invalidation alone
// does not reset readiness. Returning to a tab explicitly requests the new page.
const refreshResults=[];
for(const baseline of [true,false]){const source=p=>baseline?cp.execFileSync('git',['show',base+':'+p],{encoding:'utf8'}):read(p),state=source('192.View.Transactions.State.html'),actions=source('195.View.Transactions.Actions.html');
 const events=[],context={transactionsResultCache:{old:{}},transactionsResultCacheOrder:['old'],transactionsSearchIndex:[{}],transactionsCacheRevision:'old',transactionDetailCache:{},transactionDetailPending:{},transactionDetailSources:{},transactionDiagnosticPrefetchKeys:{},transactionsPendingKey:'old',transactionsReadinessState:'LOADED_NONEMPTY',transactionsDateFilter:{filter:'currentYear',customStart:'',customEnd:''},transactionsPages:{recent:1},lastDashboardRequest:{filter:'currentYear',customStart:'',customEnd:''},activeDashboardRequestToken:0,dashboardRequestSequence:0,dashboardRequestInFlight:false,invalidateFinanceCache(){events.push('finance-invalidated');},requestDashboardData(){events.push('dashboard-read');},requestTransactionsPage(){events.push('transactions-read');},console};
 vm.createContext(context);vm.runInContext(region(state,'    function getTransactionsInitialContext(','    function requestTransactionsPage(')+region(state,'    function invalidateTransactionsClientCaches(','    function setActiveTransactionsTab(')+region(actions,'    function refreshTransactionEntryAfterSuccess(','    function showTransactionEntrySuccess('),context);
 context.invalidateTransactionsClientCaches();context.refreshTransactionEntryAfterSuccess();assert.equal(context.transactionsSearchIndex,null);assert.ok(events.includes('dashboard-read'));context.renderTransactions({});assert.ok(!events.includes('transactions-read'));context.transactionsReadinessState='UNINITIALIZED';context.renderTransactions({});assert.ok(events.includes('transactions-read'));refreshResults.push({baseline,postMutationDashboardRefresh:true,immediateTransactionReloadWithLoadedSamePeriod:false,uninitializedReload:true});
}
fs.writeFileSync('test-results/sidebar-light-only/impact-focused-results.json',JSON.stringify({logging:'PASS sanitization/dedup/bound without removed DOM',freshness:'PASS three statuses and missing metadata guard',print:'PASS static event binding only; browser print rendering not measured',refreshResults},null,2));console.log('PASS: logging, freshness, print binding, baseline/candidate synthetic refresh readiness');
