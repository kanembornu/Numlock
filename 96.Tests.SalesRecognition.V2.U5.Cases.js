// SALES_RECOGNITION_V2 U5 Finance P&L Revenue tests: Revenue / P&L consumes
// the SAME recognized-Sales authority as U3 — signed projection `events`
// attributed by EconomicDate only. In-memory fixtures only; reuses the U3/U4
// mixed-cohort fixture helpers; read-only; no production access, no network,
// no clasp, no writes outside fixture memory.

var U5_READ_NAMES = U4_READ_NAMES.concat(["Accounts", "DepreciationLedger", "Assets"]);
var U5_DEP_HEADERS = ["ID_Dep", "Period", "ID_Asset", "OpeningBookValue", "Depreciation",
  "AccumulatedDepreciation", "ClosingBookValue", "GeneratedAt"];
var U5_EXPENSE_ITEM_HEADERS = ["ID_Ops", "Item", "Kategori", "Kind", "Group", "AccountCode", "IsActive"];

// Finance runtime sheets (DepreciationLedger + Assets) on top of the U4 base.
function u5WithFinanceSheets_(base) {
  base.DepreciationLedger = [U5_DEP_HEADERS.slice()];
  base.Assets = [["ID_Asset"], ["AST-1"]];
  return base;
}

function u5FinanceSheets_() {
  return u5WithFinanceSheets_(u4BaseSheets_());
}

// Same U4 mixed-cohort content, plus the Finance runtime sheets. The U4
// builder is reused unchanged; its base-sheet factory is extended for the
// duration of the build only (the original factory is captured, never
// re-entered).
function u5MixedFixture_() {
  var baseU4 = u4BaseSheets_;
  u4BaseSheets_ = function() { return u5WithFinanceSheets_(baseU4()); };
  try { return u4MixedFixture_().fixture; }
  finally { u4BaseSheets_ = baseU4; }
}

// COGS account for the legacy record path (Products.COGSAccountCode = 5000).
function u5FinishAccounts_(fixture) {
  u3AppendRow_(fixture, "Accounts", CASH_SCHEMA_MIGRATION.ACCOUNTS_HEADERS, {
    AccountCode: "5000", AccountName: "Cost of Goods Sold", AccountType: "COGS",
    StatementGroup: "COGS", CashFlowGroup: "Operating", IsActive: true,
    CreatedAt: "", UpdatedAt: "", NormalBalance: "DEBIT" });
}

// Central additions: material purchase (6210), operating expense (6100),
// depreciation — Policy C prospective expense authorities.
function u5FinishFinanceFixture_(fixture) {
  u5FinishAccounts_(fixture);
  u3AppendRow_(fixture, "ExpenseItems", U5_EXPENSE_ITEM_HEADERS, { ID_Ops: "O1",
    Item: "Rent", Kategori: "Operations", Kind: "Fixed", Group: "Operating",
    AccountCode: "6100", IsActive: true });
  u3AppendRow_(fixture, "tabops", CANONICAL_ENTRY.EXPENSE_HEADERS, { ID_Trx: "OPS-U5-1",
    Tanggal: "2026-10-12T12:00:00Z", ID_Ops: "O1", Nilai: 7000, Source: "tabops",
    IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" });
  u3AppendLedger_(fixture, [{ JournalID: "J-U5-6210", LineID: "J-U5-6210-1",
    Tanggal: "2026-10-14", AccountCode: "6210", Debit: 120000, Credit: 0,
    MovementType: "PURCHASE_EXPENSE", SourceType: "PURCHASE_EVENT",
    SourceID: "PE-U5-1" }]);
  u3AppendRow_(fixture, "DepreciationLedger", U5_DEP_HEADERS, { ID_Dep: "DEP-U5-1",
    Period: "2026-10-01", ID_Asset: "AST-1", OpeningBookValue: 100000,
    Depreciation: 5000, AccumulatedDepreciation: 5000, ClosingBookValue: 95000,
    GeneratedAt: "2026-10-01T00:00:00.000Z" });
  return fixture;
}

function u5MixedPnlFixture_() {
  return u5FinishFinanceFixture_(u5MixedFixture_());
}

// V2 committed 36,000 recognized 2026-10-03, reversed 2026-11-03 (U6-shaped
// artifacts appended read-side): the void-later-period signed pair.
function u5VoidFixture_() {
  var fixture = u5MixedPnlFixture_();
  u3CommittedAppend_(fixture, { orderID: "ORD-U5-VOID", amount: 36000, date: "2026-10-03",
    recognizedAt: "2026-10-03T01:00:00.000Z" });
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  u3ReversalAppend_(fixture, events[events.length - 1], { date: "2026-11-03",
    recognizedAt: "2026-11-03T01:00:00.000Z" });
  return fixture;
}

// Legacy sale on 2026-09-30 + V2 committed recognition on 2026-10-01: the
// Policy C transition boundary by economic date.
function u5BoundaryFixture_() {
  var fixture = salesV2SaveFixture_(u5FinanceSheets_());
  u5FinishAccounts_(fixture);
  u3AppendSale_(fixture, { ID_Trx: "SAL-U5-0930", Tanggal: "2026-09-30T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 1000, HJ: 9000 });
  u3CommittedAppend_(fixture, { orderID: "ORD-U5-1001", amount: 50000, date: "2026-10-01",
    recognizedAt: "2026-10-01T01:00:00.000Z" });
  return fixture;
}

// Historical pre-Policy-C sale (COGS fixture).
function u5HistoricalFixture_() {
  var fixture = salesV2SaveFixture_(u5FinanceSheets_());
  u5FinishAccounts_(fixture);
  u3AppendSale_(fixture, { ID_Trx: "SAL-U5-HIST", Tanggal: "2026-09-20T12:00:00Z",
    ID_Prod: "P1", Qty: 4, HPP: 2500, HJ: 10000 });
  return fixture;
}

// Single active legacy sale; no voided lifecycle rows (clean quality state).
function u5CleanFinanceFixture_() {
  var fixture = salesV2SaveFixture_(u5FinanceSheets_());
  u5FinishAccounts_(fixture);
  u3AppendSale_(fixture, { ID_Trx: "SAL-U5-CLEAN", Tanggal: "2026-10-10T12:00:00Z",
    ID_Prod: "P1", Qty: 2, HPP: 3000, HJ: 5000 });
  return fixture;
}

function u5Pnl_(fixture, startDate, endDate) {
  return getFinanceDataWithRuntime({ spreadsheet: fixture }, "custom", startDate, endDate);
}

function u5EventsRevenue_(fixture, startDate, endDate) {
  var projection = buildRecognizedSalesProjectionFromSpreadsheet_(fixture);
  var total = 0;
  projection.events.forEach(function(event) {
    if (event.status !== "RECOGNIZED") return;
    if (event.dateKey >= startDate && event.dateKey <= endDate) {
      total += Number(event.signedAmount) || 0;
    }
  });
  return total;
}

function u5ActiveSalesTotal_(fixture, startDate, endDate) {
  var page = u4ActivePage_(fixture, { customStart: startDate, customEnd: endDate });
  var total = 0;
  page.rows.forEach(function(row) {
    if (row.transactionType === "Sales") total += Number(row.revenue) || 0;
  });
  return total;
}

// Central acceptance: exact signed Revenue, material/operating/depreciation,
// COGS/GP availability, net result, quality metadata — plus cohort cases
// (legacy once / paid once / unpaid excluded / multiline once) and read-only.
function testSalesRecognitionV2U5RevenueAuthority() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U5_AUTH:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var fixture = u5MixedPnlFixture_();
  var before = u3SheetSnapshot_(fixture, U5_READ_NAMES);

  // A1: unpaid old Order excluded — never Revenue, never a legacy fallback.
  var oct19 = u5Pnl_(fixture, "2026-10-19", "2026-10-19");
  check("A1", oct19.summary.revenue === 0 &&
    oct19.salesRecognition.recognizedRevenue === 0 &&
    oct19.salesRecognition.revenueAuthorityComplete === true &&
    oct19.salesRecognition.unresolvedCount >= 1 &&
    oct19.salesRecognition.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:ORD-U4-UNPAID:R0" &&
        entry.reason === "OLD_ORDER_UNPAID_EXCLUDED";
    }) && u5EventsRevenue_(fixture, "2026-10-19", "2026-10-19") === 0,
    JSON.stringify({ revenue: oct19.summary.revenue,
      salesRecognition: oct19.salesRecognition }));

  // A2: CENTRAL U5 fixture — exact everything.
  var oct = u5Pnl_(fixture, "2026-10-01", "2026-10-31");
  var s = oct.summary;
  check("A2", s.revenue === 265000 && oct.salesRecognition.recognizedRevenue === 265000 &&
    s.materialPurchasesExpensed === 120000 && s.operatingExpenses === 7000 &&
    s.depreciationExpense === 5000 && s.cogs === null && s.grossProfit === null &&
    oct.grossProfit === null && oct.grossProfitAvailable === false &&
    oct.accountingRegime === "PROSPECTIVE_PURCHASE_EXPENSE" &&
    s.operatingNetProfit === 133000 &&
    Math.abs(s.operatingProfitMargin - 133000 / 265000) < 1e-9 &&
    oct.salesRecognition.authority === "SALES_RECOGNITION_V2_PROJECTION" &&
    oct.salesRecognition.revenueAuthorityComplete === true &&
    oct.salesRecognition.unresolvedCount === 2 &&
    oct.salesRecognition.recoveryRequiredCount === 0 &&
    oct.salesRecognition.integrityConflictCount === 0 &&
    oct.dataQuality.excludedInactiveTransactions === 2 &&
    oct.dataQuality.status === "ATTENTION",
    JSON.stringify({ revenue: s.revenue, material: s.materialPurchasesExpensed,
      opex: s.operatingExpenses, dep: s.depreciationExpense, cogs: s.cogs,
      net: s.operatingNetProfit, sr: oct.salesRecognition,
      dq: oct.dataQuality.status }));

  // A3: legacy recognized once, correct period, ledger 4000 credits never
  // additive (credits > 0 in the fixture while Revenue stays exact).
  var oct5 = u5Pnl_(fixture, "2026-10-05", "2026-10-05");
  check("A3", oct5.summary.revenue === 30000 &&
    oct5.salesRecognition.recognizedRevenue === 30000 &&
    u5EventsRevenue_(fixture, "2026-10-05", "2026-10-05") === 30000 &&
    buildRecognizedSalesProjectionFromSpreadsheet_(fixture).totals.ledgerRevenueCredits > 0,
    JSON.stringify({ revenue: oct5.summary.revenue }));

  // A4: paid Order Revenue 36,000 once inside the day total; no Payment /
  // ledger / lines / HPP added (HPP 15,130.58 would change 96,000).
  var oct20 = u5Pnl_(fixture, "2026-10-20", "2026-10-20");
  check("A4", oct20.summary.revenue === 96000 &&
    u5EventsRevenue_(fixture, "2026-10-20", "2026-10-20") === 96000,
    JSON.stringify({ revenue: oct20.summary.revenue }));

  // A5: multiline V2 counted as OrderTotal once — Oct 15 holds the 60,000
  // two-line committed order plus the 40,000 lineage recognition.
  var oct15 = u5Pnl_(fixture, "2026-10-15", "2026-10-15");
  check("A5", oct15.summary.revenue === 100000 &&
    u5EventsRevenue_(fixture, "2026-10-15", "2026-10-15") === 100000,
    JSON.stringify({ revenue: oct15.summary.revenue }));

  // A6: Finance reads never mutate a source sheet.
  check("A6", before === u3SheetSnapshot_(fixture, U5_READ_NAMES),
    "Finance P&L read mutated a source sheet");
  return { total: pass, pass: pass, fail: 0 };
}

// Signed lifecycle periods: void next period, correct next period, Policy C
// transition boundary, month/year boundaries — EconomicDate only, reversal
// never rewrites the original period.
function testSalesRecognitionV2U5LifecyclePeriods() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U5_LIFE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }

  // C1/C2: void next period — Oct +36,000 stays, Nov -36,000, Oct not
  // rewritten.
  var voidFixture = u5VoidFixture_();
  var octEarly = u5Pnl_(voidFixture, "2026-10-01", "2026-10-04");
  check("C1", octEarly.summary.revenue === 36000 &&
    u5EventsRevenue_(voidFixture, "2026-10-01", "2026-10-04") === 36000,
    JSON.stringify({ revenue: octEarly.summary.revenue }));
  var novEarly = u5Pnl_(voidFixture, "2026-11-01", "2026-11-04");
  var octEarlyAgain = u5Pnl_(voidFixture, "2026-10-01", "2026-10-04");
  check("C2", novEarly.summary.revenue === -36000 &&
    u5EventsRevenue_(voidFixture, "2026-11-01", "2026-11-04") === -36000 &&
    octEarlyAgain.summary.revenue === 36000,
    JSON.stringify({ nov: novEarly.summary.revenue,
      octAgain: octEarlyAgain.summary.revenue }));

  // C3: correct next period — original period positive remains; correction
  // period = -original + replacement exact (mixed lineage: -40,000 + 81,000).
  var mixed = u5MixedPnlFixture_();
  var octFull = u5Pnl_(mixed, "2026-10-01", "2026-10-31");
  var novFull = u5Pnl_(mixed, "2026-11-01", "2026-11-30");
  var projection = buildRecognizedSalesProjectionFromSpreadsheet_(mixed);
  check("C3", octFull.summary.revenue === 265000 &&
    novFull.summary.revenue === 41000 &&
    projection.events.some(function(event) {
      return event.status === "RECOGNIZED" && event.eventType === "RECOGNITION" &&
        event.signedAmount === 40000 && event.dateKey === "2026-10-15";
    }) &&
    projection.events.some(function(event) {
      return event.status === "RECOGNIZED" && event.eventType === "REVERSAL" &&
        event.signedAmount === -40000 && event.dateKey === "2026-11-10";
    }) &&
    projection.events.some(function(event) {
      return event.status === "RECOGNIZED" && event.eventType === "RECOGNITION" &&
        event.signedAmount === 81000 && event.dateKey === "2026-11-15";
    }),
    JSON.stringify({ oct: octFull.summary.revenue, nov: novFull.summary.revenue }));

  // C4: transition boundary 2026-09-30 / 2026-10-01 by economic date.
  var boundary = u5BoundaryFixture_();
  var sep30 = u5Pnl_(boundary, "2026-09-30", "2026-09-30");
  var oct01 = u5Pnl_(boundary, "2026-10-01", "2026-10-01");
  var cross = u5Pnl_(boundary, "2026-09-30", "2026-10-01");
  check("C4", sep30.accountingRegime === "LEGACY_PRE_TRANSITION" &&
    sep30.summary.revenue === 9000 && sep30.summary.cogs === 1000 &&
    sep30.grossProfitAvailable === true &&
    oct01.accountingRegime === "PROSPECTIVE_PURCHASE_EXPENSE" &&
    oct01.summary.revenue === 50000 && oct01.summary.cogs === null &&
    oct01.grossProfitAvailable === false &&
    cross.accountingRegime === "SPLIT_PRESENTATION_BY_ACCOUNTING_REGIME" &&
    cross.summary.revenue === 59000 &&
    cross.regimeSections.legacy.summary.revenue === 9000 &&
    cross.regimeSections.prospective.summary.revenue === 50000 &&
    cross.salesRecognition.recognizedRevenue === 59000,
    JSON.stringify({ sep: sep30.summary, oct: oct01.summary,
      crossRevenue: cross.summary.revenue }));

  // C5: period boundaries — empty year-end day stays a true zero.
  var dec31 = u5Pnl_(mixed, "2026-12-31", "2026-12-31");
  check("C5", dec31.summary.revenue === 0 &&
    dec31.salesRecognition.revenueAuthorityComplete === true,
    JSON.stringify({ revenue: dec31.summary.revenue }));
  return { total: pass, pass: pass, fail: 0 };
}

// Policy C semantics + fail-closed quality metadata + YTD comparability.
function testSalesRecognitionV2U5PolicyCQuality() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U5_QUAL:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }

  // B1: prospective — 6210 expense authority; HPP is never COGS; no double
  // expense; unavailable COGS/GP stay null, never 0.
  var mixed = u5MixedPnlFixture_();
  var oct = u5Pnl_(mixed, "2026-10-01", "2026-10-31");
  check("B1", oct.summary.cogs === null && oct.summary.grossProfit === null &&
    oct.grossProfit === null && oct.grossProfitAvailable === false &&
    oct.summary.materialPurchasesExpensed === 120000 &&
    oct.summary.operatingExpenses === 7000 &&
    oct.summary.operatingNetProfit === 133000 &&
    oct.expenseBreakdown.length === 1 &&
    oct.expenseBreakdown[0].AccountCode === "6100" &&
    oct.expenseBreakdown[0].amount === 7000,
    JSON.stringify({ cogs: oct.summary.cogs, gp: oct.summary.grossProfit,
      material: oct.summary.materialPurchasesExpensed,
      breakdown: oct.expenseBreakdown, net: oct.summary.operatingNetProfit }));

  // B2: historical pre-Policy-C COGS fixture preserved (5000/1100 record
  // path), transition by economic date, no retroactive Policy C.
  var historical = u5Pnl_(u5HistoricalFixture_(), "2026-09-01", "2026-09-30");
  check("B2", historical.accountingRegime === "LEGACY_PRE_TRANSITION" &&
    historical.summary.revenue === 40000 && historical.summary.cogs === 10000 &&
    historical.summary.grossProfit === 30000 &&
    historical.grossProfitAvailable === true &&
    historical.summary.operatingNetProfit === 30000,
    JSON.stringify(historical.summary));

  // B3: pending V2 excluded + surfaced (count, issue, excluded entry), never
  // a legacy fallback; recovery/integrity counts explicit.
  var pendingProjection = buildRecognizedSalesProjectionFromSpreadsheet_(mixed);
  var octAgain = u5Pnl_(mixed, "2026-10-01", "2026-10-31");
  check("B3", octAgain.salesRecognition.unresolvedCount === 2 &&
    octAgain.salesRecognition.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:ORD-U4-PENDING:" &&
        entry.cohort === "V2_PENDING";
    }) &&
    octAgain.salesRecognition.issues.some(function(issue) {
      return issue.code === "INCOMPLETE_V2_RECOGNITION" &&
        issue.sourceIdentity === "ORDER:ORD-U4-PENDING:";
    }) &&
    octAgain.salesRecognition.recoveryRequiredCount === 0 &&
    octAgain.salesRecognition.integrityConflictCount === 0 &&
    pendingProjection.activeView.events.every(function(event) {
      return event.namespace.indexOf("ORD-U4-PENDING") === -1;
    }) && octAgain.summary.revenue === 265000,
    JSON.stringify(octAgain.salesRecognition));

  // B4: localized source-read failure — valid Sales still reportable, quality
  // state exposed, never claimed authority-complete.
  var localized = u5CleanFinanceFixture_();
  var clean = u5Pnl_(localized, "2026-10-01", "2026-10-31");
  check("B4a", clean.summary.revenue === 10000 &&
    clean.salesRecognition.revenueAuthorityComplete === true &&
    clean.dataQuality.status === "GOOD",
    JSON.stringify({ revenue: clean.summary.revenue, sr: clean.salesRecognition,
      dq: clean.dataQuality.status }));
  localized.getSheetByName("SalesRecognitionEvents").getDataRange = function() {
    throw new Error("EVENTS_READ_FAILED");
  };
  var broken = u5Pnl_(localized, "2026-10-01", "2026-10-31");
  check("B4b", broken.summary.revenue === 10000 &&
    broken.salesRecognition.revenueAuthorityComplete === false &&
    broken.dataQuality.status === "ATTENTION" &&
    broken.salesRecognition.issues.some(function(issue) {
      return issue.code === "SOURCE_READ_FAILED" &&
        issue.sourceIdentity === "SalesRecognitionEvents";
    }),
    JSON.stringify({ revenue: broken.summary.revenue, sr: broken.salesRecognition,
      dq: broken.dataQuality.status }));

  // B5: whole-source read failure — explicit report-quality failure (throw),
  // never a silent authoritative Revenue = 0.
  var whole = u5CleanFinanceFixture_();
  whole.getSheetByName("tabsal").getRange = function() {
    throw new Error("TABSAL_READ_FAILED");
  };
  var thrown = null;
  try { u5Pnl_(whole, "2026-10-01", "2026-10-31"); }
  catch (error) { thrown = String(error && error.message || error); }
  check("B5", Boolean(thrown) && thrown.indexOf("TABSAL_READ_FAILED") !== -1,
    String(thrown));

  // B6: YTD / full-year Revenue also comes from projection events.
  var ytd = u5Pnl_(mixed, "2026-01-01", "2026-12-31");
  check("B6", ytd.summary.revenue === 306000 &&
    ytd.salesRecognition.recognizedRevenue === 306000 &&
    u5EventsRevenue_(mixed, "2026-01-01", "2026-12-31") === 306000,
    JSON.stringify({ revenue: ytd.summary.revenue }));
  return { total: pass, pass: pass, fail: 0 };
}

// PARITY: sum(signed events) == P&L Revenue; simple periods reconcile with
// U4 recognized Transaction Sales; periods with later reversal intentionally
// differ between U4 active totals and P&L period Revenue.
function testSalesRecognitionV2U5Parity() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U5_PAR:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var fixture = u5MixedPnlFixture_();

  // P1: event-sum parity across month, reversal month, and simple period.
  var oct = u5Pnl_(fixture, "2026-10-01", "2026-10-31");
  var nov = u5Pnl_(fixture, "2026-11-01", "2026-11-30");
  var simple = u5Pnl_(fixture, "2026-10-05", "2026-10-09");
  check("P1", oct.summary.revenue === u5EventsRevenue_(fixture, "2026-10-01", "2026-10-31") &&
    nov.summary.revenue === u5EventsRevenue_(fixture, "2026-11-01", "2026-11-30") &&
    simple.summary.revenue === u5EventsRevenue_(fixture, "2026-10-05", "2026-10-09") &&
    oct.summary.revenue === 265000 && nov.summary.revenue === 41000 &&
    simple.summary.revenue === 69000,
    JSON.stringify({ oct: oct.summary.revenue, nov: nov.summary.revenue,
      simple: simple.summary.revenue }));

  // P2: simple period reconciles exactly with U4 recognized Transaction
  // Sales totals (identities + amounts).
  var u4Simple = u5ActiveSalesTotal_(fixture, "2026-10-05", "2026-10-09");
  var simpleRows = u4ActivePage_(fixture, { customStart: "2026-10-05",
    customEnd: "2026-10-09" }).rows;
  check("P2", u4Simple === 69000 && simple.summary.revenue === u4Simple &&
    simpleRows.length === 3 &&
    simpleRows.every(function(row) { return row.transactionType === "Sales"; }) &&
    simpleRows.map(function(row) { return row.id; }).sort().join(",") ===
      "SAL-U4-L1,SAL-U4-L4,SAL-U4-L5",
    JSON.stringify({ u4: u4Simple, pnl: simple.summary.revenue,
      ids: simpleRows.map(function(row) { return row.id; }) }));

  // P3: active view vs events intentionally differ for voided/replaced
  // chains — prove the distinction, never force false equality.
  var u4Oct = u5ActiveSalesTotal_(fixture, "2026-10-01", "2026-10-31");
  var u4Nov = u5ActiveSalesTotal_(fixture, "2026-11-01", "2026-11-30");
  check("P3", u4Oct === 225000 && oct.summary.revenue === 265000 &&
    u4Oct !== oct.summary.revenue && oct.summary.revenue - u4Oct === 40000 &&
    u4Nov === 81000 && nov.summary.revenue === 41000 && u4Nov !== nov.summary.revenue &&
    u4Nov - nov.summary.revenue === 40000,
    JSON.stringify({ u4Oct: u4Oct, pnlOct: oct.summary.revenue,
      u4Nov: u4Nov, pnlNov: nov.summary.revenue }));

  // P4: full range — identities and amounts consistent end to end.
  var u4Full = u5ActiveSalesTotal_(fixture, "2026-10-01", "2026-12-31");
  var full = u5Pnl_(fixture, "2026-10-01", "2026-12-31");
  check("P4", u4Full === 306000 && full.summary.revenue === 306000 &&
    u4Full === full.summary.revenue &&
    full.salesRecognition.recognizedRevenue === 306000,
    JSON.stringify({ u4: u4Full, pnl: full.summary.revenue }));
  return { total: pass, pass: pass, fail: 0 };
}
