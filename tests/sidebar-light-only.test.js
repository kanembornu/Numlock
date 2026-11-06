const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const query=fs.readFileSync('91.Transactions.Query.js','utf8');
const rows=Array.from({length:63},(_,i)=>({id:'T'+i,transactionType:'Sales',isActive:true}));
const sandbox={getTransactionsPeriodRows:()=>({rows}),resolveDashboardDateRange:()=>({}),getDashboardCacheRevision:()=>'',normalizeTransactionsLifecycleState:()=> 'active'};
vm.createContext(sandbox);vm.runInContext(query,sandbox);
assert.equal(sandbox.TRANSACTIONS_DEFAULT_PAGE_SIZE,25);
sandbox.getTransactionsPeriodRows=()=>({rows});sandbox.resolveDashboardDateRange=()=>({});sandbox.normalizeTransactionsLifecycleState=()=> 'active';
sandbox.filterTransactionsPeriodRows=()=>rows;sandbox.buildTransactionsSearchIndex=()=>rows;
assert.equal(sandbox.getTransactionsPage({}).pageSize,25);
assert.equal(sandbox.getTransactionsPage({pageSize:50}).pageSize,50);
assert.equal(sandbox.getTransactionsPage({pageSize:999}).pageSize,25);
const pages=[1,2,3].map(p=>sandbox.buildTransactionsPageResult(rows,p,25));
assert.deepEqual(pages.map(p=>p.rows.length),[25,25,13]);assert.equal(new Set(pages.flatMap(p=>p.rows.map(r=>r.id))).size,63);
for(const path of ['190.View.Index.html','192.View.Transactions.State.html','assets/tailwind.input.css','189.View.Tailwind.html']){
 const source=fs.readFileSync(path,'utf8');
 assert.ok(!/data-theme|prefers-color-scheme|numlock\.ui\.theme|numlock\.transactions\.pageSize/.test(source),path+' obsolete switching/persistence');
 assert.ok(!/sidebarDataStatus|sidebar-status-region|id="settings"|id="logs"|sessionLogs|themePreference/.test(source),path+' deleted UI references');
}
assert.ok(fs.readFileSync('190.View.Index.html','utf8').includes('function logClientEvent('));
assert.ok(fs.readFileSync('196.View.Dashboard.Render.html','utf8').includes('var badge = elements.freshnessStatusBadge;'));
console.log('PASS: backend default/fallback/selector, pagination uniqueness, source cleanup, shared logging/freshness');
