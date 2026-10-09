// U10E DIAGNOSTIC — local VM execution of the U5 Revenue scope function
// (buildFinanceSalesRecognitionScope_ in 36.Finance.Service.js) over the
// production U3 projection built from MEASURED live rows. Read-only.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SPREADSHEET_ID = "1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M";
const SHEETS = ["tabsal", "Products", "Logs", "Orders", "OrderLines", "Payments",
  "Settlements", "TransactionOperations", "BalanceLedger",
  "SalesRecognitionEvents", "SalesRecognitionAudits"];
const TARGET_RECOGNITION = "SCR-CE122B27-ORD677BE5CES";

async function loadToken() {
  const rc = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".clasprc.json"), "utf8"));
  const t = (rc.tokens || {})["numlock-run"];
  if (t.access_token && t.expiry_date && Date.now() < t.expiry_date - 60000) return t.access_token;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token,
    client_id: t.client_id, client_secret: t.client_secret });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) throw new Error("TOKEN_REFRESH_FAILED:" + res.status);
  return (await res.json()).access_token;
}

function isDateText(text) {
  return /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(String(text || "")) ||
    /^\d{2}\/\d{2}\/\d{4}/.test(String(text || ""));
}

async function main() {
  const token = await loadToken();
  const raw = {};
  for (const name of SHEETS) {
    const values = {};
    for (const opt of ["UNFORMATTED_VALUE", "FORMATTED_VALUE"]) {
      const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + SPREADSHEET_ID +
        "/values/" + encodeURIComponent(name) + "?valueRenderOption=" + opt,
        { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) { console.log(JSON.stringify({ error: "FETCH_FAILED", name, opt, status: res.status })); process.exit(2); }
      values[opt] = (await res.json()).values || [];
    }
    const u = values.UNFORMATTED_VALUE, f = values.FORMATTED_VALUE;
    raw[name] = u.map((row, r) => row.map((cell, c) => {
      if (typeof cell === "number" && isDateText((f[r] || [])[c])) {
        return new Date(Date.UTC(1899, 11, 30) + Math.round(cell * 86400000));
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
    UrlFetchApp: proxy, LockService: proxy, DriveApp: proxy, HtmlService: proxy, ScriptApp: proxy,
    Date, JSON, Math, Number, String, Boolean, Array, Object, RegExp, Error, isFinite, isNaN,
    parseInt, parseFloat, encodeURIComponent
  };
  vm.createContext(sandbox);
  const files = ["20.Data.Source.js", "97.SalesRecognition.V2.Foundation.js",
    "97A.SalesRecognition.V2.Save.js", "97B.SalesRecognition.V2.Projection.js",
    "38.CapitalEquity.Service.js", "39.Balance.Foundation.js", "36.Finance.Service.js"];
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
  const fakeSS = { getSheetByName: function(name) {
    if (!raw[name]) return null;
    return { getDataRange: function() { return { getValues: function() { return raw[name]; } }; } };
  } };
  sandbox.ss = fakeSS;
  const projection = vm.runInContext("buildRecognizedSalesProjectionFromSpreadsheet_(ss)", sandbox);
  sandbox.projection = projection;
  const period = { startDate: "2026-10-01", endDate: "2026-10-31" };
  const scope = vm.runInContext(
    "buildFinanceSalesRecognitionScope_(projection, " + JSON.stringify(period) + ")", sandbox);

  // Attribution proof: the target RecognitionID appears exactly once in scope.
  let targetEvents = 0, targetAmount = 0;
  (projection.events || []).forEach((event) => {
    if (event.recognitionId === TARGET_RECOGNITION) { targetEvents += 1; targetAmount += Number(event.signedAmount) || 0; }
  });
  console.log(JSON.stringify({
    diagnostic: "U10E_U5_REVENUE_SCOPE_LOCAL_VM",
    executedAt: new Date().toISOString(),
    loadReport: loadReport.filter((entry) => !entry.loaded || entry.file === "36.Finance.Service.js"),
    period,
    scope,
    expectedOctTotalFromEvents: (projection.events || []).filter((e) =>
      e.status === "RECOGNIZED" && e.dateKey >= period.startDate && e.dateKey <= period.endDate)
      .reduce((sum, e) => sum + (Number(e.signedAmount) || 0), 0),
    targetRecognition: { id: TARGET_RECOGNITION, occurrencesInEvents: targetEvents, signedAmount: targetAmount }
  }, null, 2));
}
main().catch((error) => { console.error("DIAGNOSTIC_ERROR", error && error.stack || error); process.exit(1); });
