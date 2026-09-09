var fs = require('fs');
var vm = require('vm');

globalThis.Logger = { log: function() {} };
globalThis.Utilities = {
  getUuid: function() { return 'test-uuid-000000000000000000000000'; },
  formatDate: function(d, tz, fmt) { return d.toISOString().slice(0, 19) + '.000Z'; }
};
globalThis.LockService = {
  getScriptLock: function() {
    return { waitLock: function() {}, releaseLock: function() {}, hasLock: function() { return true; } };
  }
};
globalThis.CacheService = {
  getScriptCache: function() {
    return { get: function() { return null; }, put: function() {} };
  }
};
globalThis.SpreadsheetApp = {
  getActiveSpreadsheet: function() { throw new Error('NO_SPREADSHEET_MOCK'); }
};
globalThis.getDashboardCacheRevision = function() { return 'LOCAL_FIXTURE'; };
globalThis.dateFormat = function() { return 'yyyy-MM-dd'; };

var files = [
  '20.Data.Source.js',
  '38.CapitalEquity.Service.js',
  '39.Balance.Foundation.js',
  '42.Inventory.Receipt.Foundation.js',
  '43.Inventory.Receipt.Migration.js',
  '44.Inventory.Receipt.Operational.js',
  '45.Inventory.Receipt.Orchestration.js',
  '46.Expense.Purchase.Policy.js',
  '47.Purchase.Events.js',
  '48.Purchase.Events.Migration.js',
  '21.Transaction.Entry.js',
  '96.Tests.Inventory.Receipt.Cases.js',
  '96.Tests.Expense.Purchase.Cases.js',
  '96.Tests.Purchase.Events.Migration.Cases.js'
];

var ctx = vm.createContext(globalThis);
files.forEach(function(f) {
  try {
    var code = fs.readFileSync(f, 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  } catch(e) {
    console.error('FAIL load ' + f + ': ' + e.message);
    process.exit(1);
  }
});

// Authority fixtures: ING-018 (lemon) item + management-operational-standard conversion
// needed for DIRECT_HPP_COMPONENT receipt posting in orchestration/dispatcher/wiring tests.
// BaseUOM is 'slice' — the lemon's recipe base unit; conversion goes gr→slice.
vm.runInContext([
  'var _lemonNote = "BASIS=MANAGEMENT_OPERATIONAL_STANDARD; METHOD=1_KG_8_FRUITS_1_FRUIT_3_SLICES_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC; PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW_NOT_PHYSICAL_OBSERVATION_OPERATIONAL_VARIANCE; REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED";',
  'var _authority = {',
  '  items: [',
  '    { ItemID: "ING-018", ItemName: "Lemon", Classification: "RAW_MATERIAL", BaseUOM: "slice",',
  '      EffectiveFrom: "2026-10-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "ING-018",',
  '      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }',
  '  ],',
  '  conversions: [',
  '    { ConversionID: "CONV-018", ItemID: "ING-018", FromUOM: "gr",',
  '      PackageIdentity: "ING-018|INTERNAL-NUMLOCK|Lemon|OPERATIONAL-STANDARD|1000gr-24slice|V01",',
  '      SupplierRef: "INTERNAL-NUMLOCK", ToUOM: "slice", Numerator: "24", Denominator: "1000",',
  '      EffectiveFrom: "2026-10-01", EffectiveTo: "",',
  '      EvidenceType: "MANAGEMENT_OPERATIONAL_STANDARD",',
  '      EvidenceRef: "GDRIVE:LOCALTEST:V01:SHA256:' + 'a'.repeat(64) + '",',
  '      EvidenceDate: "2026-10-01", PreparedBy: "TEST",',
  '      PreparedAt: "2026-10-01T00:00:00Z", ReviewedBy: "", ReviewedAt: "",',
  '      ApprovalStatus: "SINGLE_OPERATOR_APPROVED", ApprovalNote: _lemonNote,',
  '      IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }',
  '  ]',
  '};'
].join('\n'), ctx);

// Expense items from frozen policy — every row gets a synthetic ExpenseItem record.
vm.runInContext(
  'var _testItems = EXPENSE_PURCHASE_POLICY.rows.map(function(r) { return { ID_Ops: r.expenseItemId, Item: "Test-" + r.expenseItemId, Kategori: "Test", Kind: "Test", Group: "Test", AccountCode: "1100", IsActive: true }; });',
  ctx
);

var pass = 0, fail = 0, expectedFail = 0;

function run(name, code) {
  try {
    vm.runInContext(code, ctx);
    pass++;
    console.log('PASS ' + name);
  } catch(e) {
    fail++;
    console.log('FAIL ' + name + ': ' + e.message);
  }
}

// 1. Policy contracts — no authority needed
run('testExpensePurchasePolicyContracts', 'testExpensePurchasePolicyContracts()');

// 2. Orchestration — needs authority with ING-018 item + conversion for receipt posting
run('testPurchaseEventOrchestrationContracts', 'testPurchaseEventOrchestrationContracts(_authority, _testItems)');

// 3. Canonical dispatcher — same authority, exercises submitCanonicalTransactionWithRuntime_
run('testCanonicalPurchaseDispatcherContracts', 'testCanonicalPurchaseDispatcherContracts(_authority, _testItems)');

// 4. Runtime wiring — production-runtime adapter over memory sheets
run('testPurchaseEventRuntimeWiringContracts', 'testPurchaseEventRuntimeWiringContracts(_authority, _testItems)');

// 5. Schema migration — pre-activation operation; guard proves post-activation safety.
run('testPurchaseEventSchemaMigrationContracts', 'testPurchaseEventSchemaMigrationContracts()');

console.log('\n===== NUMLOCK PURCHASE-EVENT HARNESS: ' + pass + ' PASS, ' + fail + ' FAIL =====');
process.exit(fail > 0 ? 1 : 0);
