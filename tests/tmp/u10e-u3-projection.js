// U10E DIAGNOSTIC — local VM execution of the U3 Recognized Sales Projection
// (97B) over MEASURED live production rows (Sheets REST GET only).
// Read-only, no runtime source change, no production write.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SPREADSHEET_ID = "1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M";
const SHEETS = ["tabsal", "Products", "Logs", "Orders", "OrderLines", "Payments",
  "Settlements", "TransactionOperations", "BalanceLedger",
  "SalesRecognitionEvents", "SalesRecognitionAudits"];
const TARGET_ORDER = "ORD-677BE5CE-SALESRECOGNI";

async function loadToken() {
  const rc = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".clasprc.json"), "utf8"));
  const t = (rc.tokens || {})["numlock-run"];
  if (!t) throw new Error("numlock-run identity missing");
  if (t.access_token && t.expiry_date && Date.now() < t.expiry_date - 60000) return t.access_token;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token,
    client_id: t.client_id, client_secret: t.client_secret });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error("TOKEN_REFRESH_FAILED:" + res.status);
  return (await res.json()).access_token;
}

async function main() {
  const token = await loadToken();
  const raw = {};
  // Production reads via Apps Script getValues(): raw numbers + Date objects.
  // Emulate: UNFORMATTED raw values, then convert date-formatted numeric
  // serials back to Date using the FORMATTED display as the date-pattern hint.
  function isDateText(text) {
    return /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(String(text || "")) ||
      /^\d{2}\/\d{2}\/\d{4}/.test(String(text || ""));
  }
  for (const name of SHEETS) {
    const values = {};
    for (const opt of ["UNFORMATTED_VALUE", "FORMATTED_VALUE"]) {
      const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + SPREADSHEET_ID +
        "/values/" + encodeURIComponent(name) + "?valueRenderOption=" + opt,
        { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) { console.log(JSON.stringify({ error: "SHEET_FETCH_FAILED", name, opt, status: res.status })); process.exit(2); }
      values[opt] = (await res.json()).values || [];
    }
    const u = values.UNFORMATTED_VALUE, f = values.FORMATTED_VALUE;
    raw[name] = u.map((row, r) => row.map((cell, c) => {
      if (typeof cell === "number" && isDateText((f[r] || [])[c])) {
        const ms = Date.UTC(1899, 11, 30) + Math.round(cell * 86400000);
        return new Date(ms);
      }
      return cell;
    }));
  }

  const noop = function() { return noop; };
  const proxy = new Proxy(function() {}, { get: () => proxy, apply: () => proxy });
  const sandbox = {
    console, Logger: { log: function() {} },
    Session: { getScriptTimeZone: function() { return "Asia/Jakarta"; },
      getActiveUser: function() { return { getEmail: function() { return "diagnostic@local"; } }; } },
    Utilities: { formatDate: function(d) { return d.toISOString(); }, sleep: function() {} },
    SpreadsheetApp: proxy, CacheService: proxy, PropertiesService: proxy,
    UrlFetchApp: proxy, LockService: proxy, DriveApp: proxy, HtmlService: proxy,
    ScriptApp: proxy, SessionOnly: proxy, Json: proxy, MimeType: {},
    Date, JSON, Math, Number, String, Boolean, Array, Object, RegExp, Error,
    isFinite, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent
  };
  vm.createContext(sandbox);
  const files = ["20.Data.Source.js", "97.SalesRecognition.V2.Foundation.js",
    "97A.SalesRecognition.V2.Save.js", "97B.SalesRecognition.V2.Projection.js",
    "38.CapitalEquity.Service.js", "39.Balance.Foundation.js"];
  const loadReport = [];
  for (const file of files) {
    try {
      vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8"),
        sandbox, { filename: file });
      loadReport.push({ file, loaded: true });
    } catch (error) {
      loadReport.push({ file, loaded: false, error: String(error && error.message || error) });
    }
  }
  // Fallbacks: extract only the needed helpers if their file failed top-level.
  function extract_(file, pattern, label) {
    if (typeof sandbox[label] === "function") return;
    const src = fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8");
    const match = pattern.exec(src);
    if (match) vm.runInContext(match[0], sandbox, { filename: file + "#extracted" });
    loadReport.push({ file: file + "#" + label, loaded: typeof sandbox[label] === "function" });
  }
  extract_("39.Balance.Foundation.js", /function policyCJournalSignature_\(rows\)\s*\{[\s\S]*?\n\}/, "policyCJournalSignature_");
  extract_("38.CapitalEquity.Service.js", /function capitalEquityDateKey\(value\)\s*\{[\s\S]*?\n\}/, "capitalEquityDateKey");

  const fakeSS = { getSheetByName: function(name) {
    if (!raw[name]) return null;
    return { getDataRange: function() { return { getValues: function() { return raw[name]; } }; } };
  } };

  const projection = vm.runInContext("buildRecognizedSalesProjectionFromSpreadsheet_(ss)", Object.assign(sandbox, { ss: fakeSS }));

  const targetChain = "ORDER:" + TARGET_ORDER;
  const summary = {
    diagnostic: "U10E_U3_PROJECTION_LOCAL_VM",
    executedAt: new Date().toISOString(),
    loadReport,
    contract: projection.contract, reader: projection.reader,
    sources: projection.sources,
    events: projection.events.map(e => ({ identity: e.namespace, chain: e.chainKey,
      cohort: e.cohort, type: e.eventType, status: e.status, amount: e.amount,
      signed: e.signedAmount, dateKey: e.dateKey, recognitionId: e.recognitionId })),
    transactions: projection.transactions.map(t => ({ sourceIdentity: t.sourceIdentity,
      kind: t.kind, headerId: t.headerId, cohort: t.cohort, status: t.status,
      economicDateKey: t.economicDateKey, amount: t.amount, orderType: t.orderType })),
    activeView: { totals: projection.activeView.totals,
      events: projection.activeView.events.map(e => ({ identity: e.namespace,
        chain: e.chainKey, status: e.status, amount: e.signedAmount, dateKey: e.dateKey })) },
    quality: { issues: projection.quality.issues, recoveryIssues: projection.quality.recoveryIssues,
      excluded: projection.quality.excluded },
    totals: projection.totals,
    lineCount: projection.lines.length,
    target: {
      chain: targetChain,
      inEvents: projection.events.filter(e => e.chainKey === targetChain).length,
      inTransactions: projection.transactions.filter(t => t.sourceIdentity === targetChain).length,
      inActiveView: projection.activeView.events.filter(e => e.chainKey === targetChain).length,
      lines: projection.lines.filter(l => String(l.sourceIdentity).indexOf(targetChain) === 0).length
    }
  };
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(e => { console.error("DIAGNOSTIC_ERROR", e && e.stack || e); process.exit(1); });
