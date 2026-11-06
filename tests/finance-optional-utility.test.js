const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('201.View.Finance.Controller.html','utf8');
const fn=source.slice(source.indexOf('    function setFinanceDestination('),source.indexOf('    var setFinanceViewStateBase'));
const elements=Object.fromEntries(['financeHeading','financeRecognitionDisclosure','financeDepreciationDisclosure'].map(id=>[id,{}]));
const context={financeState:{},document:{getElementById:()=>null},getFinanceElement:id=>{if(!elements[id])throw Error('Required Finance element missing: #'+id);return elements[id];},setAssetsTab:()=>{}};
vm.createContext(context);vm.runInContext(fn,context);
for(const destination of ['profit-loss','capital-equity','product-profitability','balance-sheet','depreciation','assets','cash-flow']){context.setFinanceDestination(destination);assert.equal(context.financeState.destination,destination);assert.ok(elements.financeHeading.textContent);assert.ok(elements.financeRecognitionDisclosure.textContent);}
const title={},subtitle={};context.document.getElementById=id=>id==='utilityPageTitle'?title:subtitle;context.setFinanceDestination('cash-flow');assert.equal(title.textContent,'Cash Flow');assert.ok(subtitle.textContent.includes('Cash movements'));
delete elements.financeHeading;assert.throws(()=>context.setFinanceDestination('profit-loss'),/Required Finance element missing: #financeHeading/);
console.log('PASS: seven destinations, optional utility absent/present, required Finance heading fails closed');
