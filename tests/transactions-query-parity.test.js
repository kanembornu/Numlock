const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const rows=Array.from({length:63},(_,i)=>({id:'T'+String(63-i).padStart(3,'0'),date:'2026-11-01',transactionType:i%3?'Sales':'Expense',product:i%2?'Coffee':'Tea',isActive:true}));
const backend={resolveDashboardDateRange:()=>({}),getDashboardCacheRevision:()=>'',};vm.createContext(backend);vm.runInContext(fs.readFileSync('91.Transactions.Query.js','utf8'),backend);backend.getTransactionsPeriodRows=()=>({rows});
const client={createInitialTransactionEntryState:()=>({})};vm.createContext(client);vm.runInContext(fs.readFileSync('192.View.Transactions.State.html','utf8'),client);vm.runInContext('function formatTransactionDate(d){return d;} ',client);
let cases=0;
for(const size of [15,25,50])for(const tab of ['recent','sales','expenses','purchases'])for(const lifecycleState of ['active','all','voided'])for(const search of ['','Coffee','missing'])for(const page of [1,2,3,99]){
 const request={pageSize:size,tab,lifecycleState,search,page};
 client.input={rows,size,tab,lifecycleState,search,page};
 const actual=vm.runInContext('transactionsSearchIndex=input.rows; transactionsPageSize=input.size; activeTransactionsTab=input.tab; transactionsLifecycleState=input.lifecycleState; transactionsSearchQuery=input.search; buildLocalTransactionsPage(input.page)',client);
 const expected=backend.getTransactionsPage(request);
 for(const key of ['rows','totalRows','totalPages','page','pageSize','rangeStart','rangeEnd'])assert.deepEqual(JSON.parse(JSON.stringify(actual[key])),JSON.parse(JSON.stringify(expected[key])),JSON.stringify(request)+' '+key);
 cases++;
}
const pages=[1,2,3].map(page=>backend.getTransactionsPage({page}));assert.deepEqual(pages.map(p=>p.rows.length),[25,25,13]);assert.deepEqual(pages.flatMap(p=>p.rows.map(r=>r.id)),rows.map(r=>r.id));assert.equal(new Set(pages.flatMap(p=>p.rows.map(r=>r.id))).size,63);
console.log('PASS: '+cases+' frontend/backend query combinations; 63 IDs exact order, 25/25/13, no loss/duplicates. Synthetic only; sorting UI not implemented by query.');
