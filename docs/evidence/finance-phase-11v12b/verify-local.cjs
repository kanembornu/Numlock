// Focused source and VM UI contracts. No browser, network or Apps Script runtime.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const backend={console,Logger:{log(){}},HtmlService:{createHtmlOutputFromFile:n=>({getContent:()=>read(n+'.html')}),createTemplateFromFile:n=>({getRawContent:()=>read(n+'.html')})}};
vm.createContext(backend);for(const f of fs.readdirSync(root).filter(f=>/^\d.*\.js$/.test(f)))vm.runInContext(read(f),backend,{filename:f});
backend.testExpensePurchasePolicyContracts();
for(const name of ['testTransactionEntryUiContract','testTransactionLifecycleUiContract','testTransactionsVisualContract']){backend[name]();console.log('PASS: '+name);}
const snapshot=JSON.parse(read('docs/evidence/finance-phase-11v8/expense-items.snapshot.json'));
const expenses=snapshot.values.slice(1).map(r=>Object.fromEntries(snapshot.values[0].map((h,i)=>[h,r[i]])));
const options=JSON.parse(JSON.stringify(backend.buildTransactionEntryOptions([],expenses,[],new Date())));
const html=read('190.View.Index.html');
assert.ok(!html.includes('id="transactionTypeReceipt"'));assert.ok(!html.includes('id="receiptItem"'));
assert.match(html,/id="expenseCostType"/);assert.ok(!html.includes('getInventoryReceiptEntryOptions('));
function element(){const e={value:'',checked:false,disabled:false,hidden:false,innerText:'',innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k]},focus(){},reset(){},classList:{add(){},remove(){}}};e.parentElement={parentElement:{hidden:false},classList:{add(){},remove(){}}};e.querySelector=()=>element();return e;}
const make=()=>new Proxy({}, {get(t,k){return t[k]??(t[k]=element());}});
const entry=make(),receipt=make(),lifecycle=make(),storage=new Map(),calls=[],pending=[];
const ui={console,Intl,Date,Number,Uint8Array,crypto:require('node:crypto').webcrypto,window:{sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k),removeItem:k=>storage.delete(k)}},
 initializeStableDashboardElements:()=>({transactionEntry:entry,receiptEntry:receipt,lifecycle}),
 invalidateTransactionsClientCaches(){},requestTransactionsPage(){},refreshTransactionEntryAfterSuccess(){},
 escapeUiHtml:s=>String(s),transactionDiagnosticPending:{},transactionEntryOptionsDiagnosticSource:'fixture',completeTransactionEntryDiagnostic(){},completeTransactionActionDiagnostic(){},
 invalidateCorrectionReview(){},renderTransactionEntryPricing(){},google:{script:{get run(){let success,failure;const api=new Proxy({}, {get(_,k){if(k==='withSuccessHandler')return fn=>{success=fn;return api};if(k==='withFailureHandler')return fn=>{failure=fn;return api};return p=>{calls.push(JSON.parse(JSON.stringify(p)));pending.push({success,failure});};}});return api;}}}};
vm.createContext(ui);for(const f of ['194.View.Transactions.Forms.html','195.View.Transactions.Actions.html'])vm.runInContext(read(f),ui,{filename:f});
ui.invalidateCorrectionReview=()=>{};ui.renderTransactionEntryPricing=()=>{};
function reset(){ui.transactionEntryState=ui.createInitialTransactionEntryState();ui.transactionEntryState.entryOptions=options;ui.transactionEntryState.optionsLoaded=true;ui.clearReceiptEntry();receipt.expenseDate.value='2026-10-01';ui.setTransactionEntryType('EXPENSE');}
reset();assert.equal(ui.getEntryCombobox('expense').options.length,5);
assert.deepEqual(Array.from(ui.getEntryCombobox('expense').options,x=>x.expenseItemId).sort(),['OSS01','OUS01','OUS02','OUS03','OUS04'].sort());
ui.setExpenseCostType('VARIABLE_COST');assert.equal(ui.getEntryCombobox('expense').options.length,28);assert.ok(!ui.getEntryCombobox('expense').options.some(x=>x.expenseItemId==='OUU01'));
for(const option of options.expenses){ui.setExpenseCostType(option.costType);ui.selectTransactionEntryOption('expense',option);assert.equal(entry.expenseSearch.value,expenses.find(e=>e.ID_Ops===option.expenseItemId).Item);assert.equal(receipt.fields.hidden,!option.purchaseRequired);assert.equal(entry.amount.parentElement.parentElement.hidden,option.purchaseRequired);}
function purchase(id='OSR01'){reset();ui.setExpenseCostType('VARIABLE_COST');ui.selectTransactionEntryOption('expense',options.expenses.find(x=>x.expenseItemId===id));receipt.Cost.value='12345';receipt.Supplier.value='TEST';receipt.Unavailable.checked=true;receipt.Attested.checked=true;}
purchase();assert.ok(ui.validateReceiptEntry(true));assert.equal(ui.validateReceiptEntry(true).PurchaseQty,'');
receipt.Qty.value='1';assert.equal(ui.validateReceiptEntry(true),null);receipt.Uom.value='bag';assert.ok(ui.validateReceiptEntry(true));
ui.submitTransactionEntry({preventDefault(){}});ui.submitTransactionEntry({preventDefault(){}});assert.equal(calls.length,1);
const frozen=structuredClone(calls[0]);assert.equal(frozen.transactionType,'EXPENSE');assert.equal(frozen.expenseItemId,'OSR01');assert.ok(!JSON.stringify(frozen).includes('ItemID'));
pending.shift().failure();assert.equal(ui.transactionEntryState.receiptUnresolved,true);ui.setTransactionEntryType('SALES');assert.equal(ui.transactionEntryState.transactionType,'EXPENSE');
ui.transactionEntryState=ui.createInitialTransactionEntryState();ui.restoreReceiptEntryPending();assert.equal(ui.transactionEntryState.receiptKey,frozen.requestKey);
ui.recoverReceiptEntry();assert.deepEqual(calls.at(-1),frozen);
pending.shift().success({status:'PURCHASE_PENDING',writeCount:1});assert.equal(ui.transactionEntryState.receiptUnresolved,true);
ui.recoverReceiptEntry();pending.shift().success({status:'CONFLICT',writeCount:0});assert.equal(ui.transactionEntryState.receiptUnresolved,true);
ui.recoverReceiptEntry();pending.shift().success({status:'NOT_STARTED',reason:'PRODUCTION_PURCHASE_DISABLED',writeCount:0});assert.equal(ui.transactionEntryState.receiptUnresolved,true);
ui.recoverReceiptEntry();pending.shift().success({success:true,status:'PURCHASE_CAPTURED',data:{}});assert.equal(ui.transactionEntryState.submissionComplete,true);assert.equal(storage.size,0);
purchase('OSR07');ui.submitTransactionEntry({preventDefault(){}});pending.shift().success({status:'NOT_STARTED',reason:'PRODUCTION_PURCHASE_DISABLED',writeCount:0});assert.equal(ui.transactionEntryState.receiptUnresolved,false);assert.match(entry.generalError.innerText,/not active/);
for(const id of ['OSS01','OSK05','OEE01']){reset();const option=options.expenses.find(x=>x.expenseItemId===id);ui.setExpenseCostType(option.costType);ui.selectTransactionEntryOption('expense',option);ui.transactionEntryState.amount=100;ui.updateTransactionEntrySubmitState();ui.submitTransactionEntry({preventDefault(){}});assert.deepEqual(calls.at(-1),{transactionType:'EXPENSE',expenseItemId:id,amount:100,expenseDate:'2026-10-01'});pending.shift();}
reset();ui.setTransactionEntryType('SALES');Object.assign(ui.transactionEntryState,{selectedProduct:{productId:'P1'},selectedType:'Hot',qty:2,pricing:{price:10000,hpp:4000}});ui.updateTransactionEntrySubmitState();ui.submitTransactionEntry({preventDefault(){}});assert.deepEqual(calls.at(-1),{transactionType:'SALES',productId:'P1',type:'Hot',qty:2});
for(const expense of expenses){ui.renderTransactionDetail({id:'HIST',transactionType:'Expense',item:expense.Item,date:'2026-01-01',amount:123, status:'ACTIVE'});assert.ok(lifecycle.content.innerHTML.includes(expense.Item));}
const legacy={transactionType:'INVENTORY_RECEIPT',requestKey:'receipt-legacy-0001',input:{ItemID:'ING-018',ReceiptDate:'2026-10-01',PurchaseQty:'1',PurchaseUOM:'kg',AcquisitionValue:'10000',SupplierSource:'TEST',ExternalRef:'TEST',ExternalDocumentStatus:'AVAILABLE',Attested:true}};
pending.length=0;storage.set('numlock.receipt.pending',JSON.stringify({payload:legacy,item:'Lemon'}));
ui.transactionEntryState=ui.createInitialTransactionEntryState();ui.restoreReceiptEntryPending();ui.recoverReceiptEntry();assert.deepEqual(calls.at(-1),legacy);pending.shift().failure();assert.equal(ui.transactionEntryState.receiptUnresolved,true);
assert.equal(entry.amount.parentElement.parentElement.hidden,true);
reset();const savedSet=ui.window.sessionStorage.setItem;ui.window.sessionStorage.setItem=()=>{throw new Error('TEST')};purchase();const beforeCalls=calls.length;ui.submitReceiptEntry();assert.equal(calls.length,beforeCalls);assert.equal(ui.transactionEntryState.receiptPayload,null);ui.window.sessionStorage.setItem=savedSet;
ui.resetTransactionEntryForAnother(false);assert.equal(ui.transactionEntryState.transactionType,null);assert.equal(receipt.costType.disabled,false);assert.equal(entry.expenseSearch.disabled,false);
console.log('PASS: 5/28 choices, 33 canonical labels, hold exclusion, conditional fields, quantity validation, stable key, double-submit, reload/conflict/pending/disabled recovery, normal Expense payloads, Sales payload and 34 historical labels');
// Parse all frontend owners and the assembled inline script without executing the app.
for(const f of ['194.View.Transactions.Forms.html','195.View.Transactions.Actions.html'])new vm.Script(read(f),{filename:f});
const assembled=html.replace(/<\?!= include\('([^']+)'\); \?>/g,(_,n)=>read(n+'.html')).replace(/<\?[\s\S]*?\?>/g,'');
for(const m of assembled.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS: frontend syntax');
