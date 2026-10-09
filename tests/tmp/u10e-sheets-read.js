// U10E DIAGNOSTIC — read-only Sheets REST inventory of the canonical production
// workbook (TASK_ID U10E-FIRST-EVENT-DIAGNOSIS-01). GET endpoints only.
// No writes, no token/credential output, refreshed token kept in memory only.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SPREADSHEET_ID = "1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M";
const SMALL_SHEETS = [
  "TransactionOperations", "SalesRecognitionEvents", "SalesRecognitionAudits",
  "Orders", "OrderLines", "BalanceLedger", "Payments", "Settlements",
  "InventoryLedger", "Accounts"
];
const COUNT_ONLY_SHEETS = ["tabsal", "tabops", "Logs", "Settings", "Products", "ProductPricing"];

function sha16(buf) { return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16); }

async function loadToken() {
  const rc = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".clasprc.json"), "utf8"));
  const t = (rc.tokens || {})["numlock-run"];
  if (!t) throw new Error("numlock-run identity missing");
  const now = Date.now();
  if (t.access_token && t.expiry_date && now < t.expiry_date - 60000) {
    return { access_token: t.access_token, refreshed: false };
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token", refresh_token: t.refresh_token,
    client_id: t.client_id, client_secret: t.client_secret
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body
  });
  if (!res.ok) throw new Error("TOKEN_REFRESH_FAILED:" + res.status);
  const json = await res.json();
  return { access_token: json.access_token, refreshed: true };
}

async function sheetsGet(token, suffix) {
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" + SPREADSHEET_ID + suffix;
  const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
  return res;
}

async function main() {
  const startedAt = new Date().toISOString();
  const { access_token: token, refreshed } = await loadToken();
  const report = { diagnostic: "U10E_SHEETS_READ_ONLY", startedAt, refreshed, spreadsheets: [] };

  const metaRes = await sheetsGet(token, "?fields=sheets.properties");
  report.metaStatus = metaRes.status;
  if (!metaRes.ok) { console.log(JSON.stringify(report, null, 2)); process.exit(2); }
  const meta = await metaRes.json();
  const sheetNames = (meta.sheets || []).map(s => s.properties.title);
  report.sheetCount = sheetNames.length;
  report.sheetNames = sheetNames;

  const targets = SMALL_SHEETS.concat(COUNT_ONLY_SHEETS);
  for (const name of targets) {
    const entry = { name };
    if (sheetNames.indexOf(name) === -1) { entry.missing = true; report.spreadsheets.push(entry); continue; }
    const res = await sheetsGet(token, "/values/" + encodeURIComponent(name));
    entry.status = res.status;
    if (!res.ok) { report.spreadsheets.push(entry); continue; }
    const json = await res.json();
    const values = json.values || [];
    const headers = (values[0] || []).map(String);
    const rows = values.slice(1).filter(r => r.some(v => v !== "" && v != null));
    entry.header = headers;
    entry.headerSha16 = sha16(JSON.stringify(headers));
    entry.dataRowCount = rows.length;
    entry.dataSha16 = sha16(JSON.stringify(values));
    if (SMALL_SHEETS.indexOf(name) !== -1) {
      entry.rows = rows.map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = r[i] === undefined ? "" : r[i]; });
        return obj;
      });
    }
    report.spreadsheets.push(entry);
  }
  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
}
main().catch(e => { console.error("DIAGNOSTIC_ERROR", e && e.message); process.exit(1); });
