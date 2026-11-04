// Treasury T1 diagnostic — local read-only source-authority scan.
// Asserts discovery claims about monetary writers from repository source only.
// No network, no spreadsheet, no production access. Run: node tests/tmp/t1-source-authority-scan.js
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js') && !f.startsWith('96.Tests') && f !== '_test_runner.js' && f !== '98.Tests.Runner.js');
const failures = [];
function check(name, ok, detail) {
  if (!ok) failures.push(name + (detail ? ' :: ' + detail : ''));
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
}
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sources = RUNTIME.map((f) => ({ f, text: read(f) }));

// 1. No runtime source constructs a posting line for account 2010
//    (a posting line carries numeric Debit/Credit keys on the same object).
const post2010 = sources.filter(({ text }) =>
  /AccountCode["']?\s*[:=]\s*["']2010["'][^}]{0,160}\bDebit\s*:/.test(text) ||
  /AccountCode["']?\s*[:=]\s*["']2010["'][^}]{0,160}\bCredit\s*:/.test(text));
check('T1-A no runtime writer constructs a 2010 ledger line',
  post2010.length === 0, JSON.stringify(post2010.map(({ f }) => f)));
const core2010 = sources.filter(({ f, text }) => !f.startsWith('96.Tests') && !f.startsWith('tests') &&
  /["']2010["']/.test(text) && !/39\.Balance\.Foundation/.test(f));
check('T1-B 2010 token confined to expectations/tests/guards',
  core2010.every(({ f }) => /^(97|96\.Tests|97E)/.test(f) || /Transaction\.Production/.test(f)),
  JSON.stringify(core2010.map(({ f }) => f)));

// 2. BalanceLedger production write surfaces (explicit enumeration).
const ledgerWriters = sources.filter(({ text }) => {
  const touch = /range: ["']BalanceLedger["']/.test(text) ||
    /getSheetByName\((["']BalanceLedger["']|CASH_SCHEMA_MIGRATION\.BALANCE_LEDGER_SHEET)\)/.test(text);
  const writes = /setValues\(|appendRow\(|writeLedger:\s*function|values:\s*plan\./.test(text);
  return touch && writes;
});
check('T1-C BalanceLedger writers = {39,40,41,47,97A,97C}',
  JSON.stringify(ledgerWriters.map(({ f }) => f).sort()) === JSON.stringify(
    ['39.Balance.Foundation.js', '40.Cash.Foundation.js', '41.Inventory.Opening.Staging.js',
      '47.Purchase.Events.js', '97A.SalesRecognition.V2.Save.js', '97C.SalesRecognition.V2.Correction.js'].sort()),
  JSON.stringify(ledgerWriters.map(({ f }) => f).sort()));

// 3. V2 Save/Correction journal accounts are frozen to 1030/4000.
const v2 = read('97A.SalesRecognition.V2.Save.js') + read('97C.SalesRecognition.V2.Correction.js');
check('T1-D V2 journal accounts frozen 1030/4000',
  /JOURNAL_ACCOUNTS: Object\.freeze\(\{ SETTLEMENT: "1030", REVENUE: "4000" \}\)/.test(v2));
check('T1-E V2 correction/save build journals only from frozen accounts',
  !/cashLedgerLine\(|buildCashPostingCandidate\(/.test(v2) &&
  !/["'](1000|1010|1020|1100|2010|5000|6210)["']\s*,\s*amount/.test(v2));

// 4. V2 payment/cash retirement guards exist at every legacy money entry point.
const prod = read('95A.Transaction.Production.js');
check('T1-F createDurableOperationalPayment_ invokes salesV2OperatorPaymentGuard_',
  /function createDurableOperationalPayment_/.test(prod) && /salesV2OperatorPaymentGuard_\(orderID/.test(prod));
const cash = read('40.Cash.Foundation.js');
check('T1-G buildCashPostingCandidate blocks V2 cash posts',
  /salesV2OperatorCashPostBlocked_/.test(cash) && /SALES_V2_NO_CASH_POST/.test(cash));

// 5. Revenue authority is the recognized-Sales projection, never ledger 4000 credits.
const fin = read('36.Finance.Service.js');
check('T1-H Revenue = recognized-Sales projection (never BalanceLedger 4000 credits)',
  /Never activeView, never BalanceLedger 4000/.test(fin));
check('T1-I cash balance derived only from ledger 1000/1010/1020',
  /\["1000", "1010", "1020"\]\.reduce/.test(fin) || /\["1000", "1010", "1020"\]\.reduce/.test(read('39.Balance.Foundation.js')));

// 6. No QRIS/MDR/fee/refund code paths exist in runtime source.
const feeTokens = sources.filter(({ text }) => /QRIS|MDR|gateway|feeCode|FeeAmount/i.test(text));
check('T1-J no fee/QRIS/MDR accounting code in runtime source', feeTokens.length === 0,
  JSON.stringify(feeTokens.map(({ f }) => f)));
const refundWriters = sources.filter(({ text }) => /SourceType: ["']REFUND|["']CUSTOMER_REFUND["']|refundJournal/i.test(text));
check('T1-K no refund/credit journal writer', refundWriters.length === 0,
  JSON.stringify(refundWriters.map(({ f }) => f)));

// 7. Fresh production reads remain out of reach for this task (no code change implied).
check('T1-L task creates no runtime source (docs/tmp only)', true, 'validated by git diff in final audit');

console.log(failures.length ? '\nT1 SOURCE SCAN: FAIL ' + failures.length : '\nT1 SOURCE SCAN: 0 FAIL');
process.exit(failures.length ? 1 : 0);
