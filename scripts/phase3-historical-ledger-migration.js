#!/usr/bin/env node
"use strict";

/**
 * NUMLOCK database reconstruction Phase 3.
 *
 * Default mode is read-only. Pass --execute only after the complete source and
 * target preflight report passes. The XLSM is opened as a ZIP archive and is
 * never written or saved.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const { google } = require(
  "/usr/local/lib/node_modules/@google/clasp/node_modules/googleapis"
);

const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(
  ROOT,
  ".local/migration/Theme 5 - Numlock Mac Final1 - Dash.xlsm"
);
const SOURCE_SHA256 =
  "53541a13587d8b46642fb530657ebc95c3b549e4d44367e13211f0410dd741c0";
const TARGET_TITLE = "Numlock Transaction";
const CUTOFF_ISO = "2026-07-31";
const SOURCE_WORKBOOK = path.basename(SOURCE_PATH);
const EXECUTE = process.argv.includes("--execute");
const SOURCE_ONLY = process.argv.includes("--source-only");
const EXPORT_VALUES = process.argv.includes("--export-values");
const EXPORT_BASE64 = process.argv.includes("--export-base64");
const EXPORT_FK = process.argv.includes("--export-fk");
const SALES_CHUNK = process.argv.find(function (arg) { return arg.indexOf("--sales-chunk=") === 0; });
const EXPENSE_CHUNK = process.argv.find(function (arg) { return arg.indexOf("--expense-chunk=") === 0; });

const SALES_HEADERS = [
  "ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ",
  "Source", "IsActive", "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"
];
const EXPENSE_HEADERS = [
  "ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive",
  "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"
];
const SALES_SOURCE_HEADERS = [
  "Tahun", "Bulan", "Tanggal", "Kategori", "Kind", "Tipe", "ID_Prod",
  "Produk", "Qty", "HPP", "HPP Sum", "HJ", "HJSum", "Margin"
];
const EXPENSE_SOURCE_HEADERS = [
  "Tahun", "Bulan", "Tanggal", "Kategori", "Kind", "Group", "ID_Ops",
  "Item", "Nilai"
];
const SALES_CONTROLS = {
  2021: [1711, 4411, 20700100, 43760000, 23059900],
  2022: [2049, 5889, 26243500, 54966000, 28722500],
  2023: [2151, 5834, 26231600, 54330000, 28098400],
  2024: [2153, 4782, 22651600, 47077000, 24425400],
  2025: [1634, 2942, 13512800, 33259000, 19746200],
  2026: [874, 1268, 6981200, 15997000, 9015800]
};
const EXPENSE_CONTROLS = {
  2021: [447, 33257000],
  2022: [408, 38937000],
  2023: [366, 41174000],
  2024: [337, 39619000],
  2025: [266, 31856000],
  2026: [125, 15370000]
};
const OTHER_CANONICAL = [
  "Accounts", "Products", "ProductPricing", "ExpenseItems",
  "COGSIngredients", "COGSRecipes", "Assets", "Calendar", "Settings",
  "CapitalEquity", "DepreciationLedger", "CashPlanConfig",
  "CashPlanScenario"
];

function fail(message, details) {
  const error = new Error(message);
  if (details) error.details = details;
  throw error;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function unzipEntry(entry) {
  return childProcess.execFileSync("unzip", ["-p", SOURCE_PATH, entry], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&#38;")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, function (_, code) {
      return String.fromCodePoint(
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : parseInt(code, 10)
      );
    });
}

function parseSharedStrings() {
  const xml = unzipEntry("xl/sharedStrings.xml");
  return Array.from(xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g), function (match) {
    return Array.from(match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
      .map(function (textMatch) { return decodeXml(textMatch[1]); })
      .join("");
  });
}

function columnNumber(cellRef) {
  const letters = cellRef.match(/^[A-Z]+/)[0];
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return value;
}

function parseSheetRows() {
  const sharedStrings = parseSharedStrings();
  const xml = unzipEntry("xl/worksheets/sheet5.xml");
  const rows = new Map();
  for (const rowMatch of xml.matchAll(/<row\b(?![^>]*\/>)[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const cells = new Map();
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1];
      const refMatch = attributes.match(/\br="([A-Z]+\d+)"/);
      if (!refMatch) continue;
      const typeMatch = attributes.match(/\bt="([^"]+)"/);
      const valueMatch = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/);
      let value = valueMatch ? decodeXml(valueMatch[1]) : "";
      if (typeMatch && typeMatch[1] === "s" && value !== "") {
        value = sharedStrings[Number(value)];
      } else if (typeMatch && typeMatch[1] === "inlineStr") {
        value = Array.from(cellMatch[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
          .map(function (m) { return decodeXml(m[1]); }).join("");
      } else if (typeMatch && typeMatch[1] === "b") {
        value = value === "1";
      }
      cells.set(columnNumber(refMatch[1]), value);
    }
    rows.set(rowNumber, cells);
  }
  return rows;
}

function rowsInRange(rows, startRow, endRow, startColumn, endColumn) {
  const output = [];
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const cells = rows.get(rowNumber) || new Map();
    const row = [];
    for (let column = startColumn; column <= endColumn; column += 1) {
      row.push(cells.has(column) ? cells.get(column) : "");
    }
    output.push(row);
  }
  return output;
}

function parseNumber(value, label, sourceRow, minimum, strictlyPositive) {
  if (value === "" || value === null || typeof value === "boolean") {
    fail("Blank/non-numeric " + label + " at XLSM row " + sourceRow);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) fail("Non-numeric " + label + " at XLSM row " + sourceRow);
  if (strictlyPositive ? number <= minimum : number < minimum) {
    fail("Invalid " + label + " at XLSM row " + sourceRow + ": " + number);
  }
  return number;
}

function excelSerialToIso(serial) {
  const wholeDays = Math.floor(serial);
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + wholeDays * 86400000);
  return date.toISOString().slice(0, 10);
}

function parseDate(value, sourceRow) {
  if (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    const serial = Number(value);
    if (serial > 20000 && serial < 100000) return excelSerialToIso(serial);
  }
  const text = String(value).trim();
  let match = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)(?:[ T].*)?$/);
  if (match) return validateIso(match[1], match[2], match[3], sourceRow);
  match = text.match(/^([0-3]?\d)[-\/]([01]?\d)[-\/](\d{4})(?:[ T].*)?$/);
  if (match) return validateIso(match[3], match[2], match[1], sourceRow);
  match = text.match(/^([0-3]?\d)[- ]([A-Za-z]{3,9})[- ](\d{2,4})(?:[ T].*)?$/);
  if (match) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    const year = match[3].length === 2 ? Number(match[3]) + 2000 : Number(match[3]);
    if (month) return validateIso(year, month, match[1], sourceRow);
  }
  fail("Unparseable date at XLSM row " + sourceRow + ": " + text);
}

function validateIso(yearValue, monthValue, dayValue, sourceRow) {
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail("Invalid date at XLSM row " + sourceRow);
  }
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function exactHeaders(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(label + " headers differ", { expected: expected, actual: actual });
  }
}

function summarizeSales(rows) {
  const summary = {};
  for (const row of rows) {
    const year = Number(row.date.slice(0, 4));
    if (!summary[year]) summary[year] = [0, 0, 0, 0, 0];
    summary[year][0] += 1;
    summary[year][1] += row.qty;
    summary[year][2] += row.qty * row.hpp;
    summary[year][3] += row.qty * row.hj;
    summary[year][4] += row.qty * row.hj - row.qty * row.hpp;
  }
  return summary;
}

function summarizeExpense(rows) {
  const summary = {};
  for (const row of rows) {
    const year = Number(row.date.slice(0, 4));
    if (!summary[year]) summary[year] = [0, 0];
    summary[year][0] += 1;
    summary[year][1] += row.nilai;
  }
  return summary;
}

function compareControls(actual, expected, label) {
  for (const year of Object.keys(expected)) {
    if (JSON.stringify(actual[year]) !== JSON.stringify(expected[year])) {
      fail(label + " annual control mismatch for " + year, {
        expected: expected[year], actual: actual[year]
      });
    }
  }
  if (Object.keys(actual).sort().join(",") !== Object.keys(expected).sort().join(",")) {
    fail(label + " contains an unexpected year", { actual: actual });
  }
}

function auditSource() {
  if (!fs.existsSync(SOURCE_PATH)) fail("Required XLSM does not exist: " + SOURCE_PATH);
  const bytes = fs.readFileSync(SOURCE_PATH);
  const actualSha = sha256(bytes);
  if (actualSha !== SOURCE_SHA256) fail("XLSM SHA-256 mismatch", { actualSha: actualSha });
  const sheetRows = parseSheetRows();
  const salesRaw = rowsInRange(sheetRows, 2, 10574, 2, 15);
  const expenseRaw = rowsInRange(sheetRows, 2, 1951, 24, 32);
  exactHeaders(salesRaw.shift(), SALES_SOURCE_HEADERS, "XLSM tabsal");
  exactHeaders(expenseRaw.shift(), EXPENSE_SOURCE_HEADERS, "XLSM tabops");
  if (salesRaw.length !== 10572) fail("Unexpected XLSM tabsal row count: " + salesRaw.length);
  if (expenseRaw.length !== 1949) fail("Unexpected XLSM tabops row count: " + expenseRaw.length);

  const derivedExceptions = [];
  const sales = salesRaw.map(function (row, index) {
    const sourceRow = index + 3;
    const date = parseDate(row[2], sourceRow);
    const idProd = String(row[6]).trim();
    const tipe = String(row[5]).trim();
    if (!idProd) fail("Blank ID_Prod at XLSM row " + sourceRow);
    if (tipe !== "Hot" && tipe !== "Cold") fail("Invalid Tipe at XLSM row " + sourceRow + ": " + tipe);
    const qty = parseNumber(row[8], "Qty", sourceRow, 0, true);
    const hpp = parseNumber(row[9], "HPP", sourceRow, 0, false);
    const hj = parseNumber(row[11], "HJ", sourceRow, 0, false);
    const sourceHppSum = parseNumber(row[10], "HPP Sum", sourceRow, 0, false);
    const sourceRevenue = parseNumber(row[12], "HJSum", sourceRow, 0, false);
    const sourceMargin = Number(row[13]);
    const calculatedHpp = qty * hpp;
    const calculatedRevenue = qty * hj;
    const calculatedMargin = calculatedRevenue - calculatedHpp;
    if (
      sourceHppSum !== calculatedHpp ||
      sourceRevenue !== calculatedRevenue ||
      sourceMargin !== calculatedMargin
    ) {
      derivedExceptions.push({
        sourceRow: sourceRow, idProd: idProd, qty: qty, hpp: hpp, hj: hj,
        sourceHppSum: sourceHppSum, sourceRevenue: sourceRevenue,
        sourceMargin: sourceMargin, calculatedHpp: calculatedHpp,
        calculatedRevenue: calculatedRevenue, calculatedMargin: calculatedMargin
      });
    }
    if (date > CUTOFF_ISO) fail("Sales date exceeds cutoff at XLSM row " + sourceRow);
    return { sourceRow: sourceRow, date: date, idProd: idProd, tipe: tipe, qty: qty, hpp: hpp, hj: hj };
  });
  if (derivedExceptions.length) fail("Sales row-derived validation failed", derivedExceptions);

  const expense = expenseRaw.map(function (row, index) {
    const sourceRow = index + 3;
    const date = parseDate(row[2], sourceRow);
    const idOps = String(row[6]).trim();
    if (!idOps) fail("Blank ID_Ops at XLSM row " + sourceRow);
    const nilai = parseNumber(row[8], "Nilai", sourceRow, 0, false);
    if (date > CUTOFF_ISO) fail("Expense date exceeds cutoff at XLSM row " + sourceRow);
    return { sourceRow: sourceRow, date: date, idOps: idOps, nilai: nilai };
  });
  const salesSummary = summarizeSales(sales);
  const expenseSummary = summarizeExpense(expense);
  compareControls(salesSummary, SALES_CONTROLS, "Sales");
  compareControls(expenseSummary, EXPENSE_CONTROLS, "Expense");
  return {
    sha256: actualSha,
    size: fs.statSync(SOURCE_PATH).size,
    sales: sales,
    expense: expense,
    salesSummary: salesSummary,
    expenseSummary: expenseSummary,
    maxSalesDate: sales.reduce(function (a, x) { return x.date > a ? x.date : a; }, ""),
    maxExpenseDate: expense.reduce(function (a, x) { return x.date > a ? x.date : a; }, "")
  };
}

function loadAuth() {
  const credentialsPath = path.join(process.env.HOME, ".clasprc.json");
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8")).tokens.default;
  const auth = new google.auth.OAuth2(credentials.client_id, credentials.client_secret);
  auth.setCredentials(credentials);
  return auth;
}

function quoteSheet(title) {
  return "'" + title.replace(/'/g, "''") + "'";
}

function normalizedMatrix(values) {
  const rows = (values || []).map(function (row) { return row.slice(); });
  let width = rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0);
  while (rows.length && rows[rows.length - 1].every(function (v) { return v === ""; })) rows.pop();
  width = rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0);
  return rows.map(function (row) {
    const copy = row.slice();
    while (copy.length < width) copy.push("");
    return copy;
  });
}

function fingerprint(values) {
  const matrix = normalizedMatrix(values);
  return {
    rows: matrix.length,
    columns: matrix.reduce(function (max, row) { return Math.max(max, row.length); }, 0),
    sha256: sha256(JSON.stringify(matrix))
  };
}

async function locateTarget(drive) {
  const response = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and name = '" + TARGET_TITLE + "'",
    fields: "files(id,name)", pageSize: 10
  });
  const files = response.data.files || [];
  if (files.length !== 1) fail("Expected exactly one spreadsheet named " + TARGET_TITLE + "; found " + files.length);
  return files[0].id;
}

async function readRanges(sheets, spreadsheetId, ranges, renderOption) {
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: spreadsheetId,
    ranges: ranges,
    valueRenderOption: renderOption || "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING"
  });
  return response.data.valueRanges.map(function (range) { return range.values || []; });
}

function header(values) {
  return (values[0] || []).map(function (value) { return String(value); });
}

function dataRows(values) {
  return (values || []).slice(1).filter(function (row) {
    return row.some(function (value) { return value !== "" && value !== null; });
  });
}

function requireHeaderOnly(values, expected, label) {
  exactHeaders(header(values), expected, label);
  const rows = dataRows(values);
  if (rows.length) fail(label + " is not header-only; factual rows found: " + rows.length);
}

function requireHeaders(values, required, label) {
  const actual = header(values);
  const missing = required.filter(function (name) { return !actual.includes(name); });
  if (missing.length) fail(label + " is missing required columns", { missing: missing, actual: actual });
  return actual;
}

function objectRows(values) {
  const headers = header(values);
  return dataRows(values).map(function (row) {
    const object = {};
    headers.forEach(function (name, index) { object[name] = row[index] === undefined ? "" : row[index]; });
    return object;
  });
}

function uniqueSet(values, label) {
  const set = new Set();
  for (const value of values) {
    const key = String(value).trim();
    if (!key) fail("Blank " + label + " in target master");
    if (set.has(key)) fail("Duplicate " + label + " in target master: " + key);
    set.add(key);
  }
  return set;
}

async function auditTarget(sheets, drive, source) {
  const spreadsheetId = await locateTarget(drive);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
    fields: "properties(title,timeZone),sheets(properties(title))"
  });
  const titles = metadata.data.sheets.map(function (sheet) { return sheet.properties.title; });
  const requiredSheets = [
    "tabsal", "tabops", "MigrationLog", "MigrationExceptions",
    "Products", "ExpenseItems", "Transaction", "Helper"
  ].concat(OTHER_CANONICAL.filter(function (name) { return name !== "Products" && name !== "ExpenseItems"; }));
  const missingSheets = requiredSheets.filter(function (name) { return !titles.includes(name); });
  if (missingSheets.length) fail("Target spreadsheet is missing required sheets", { missing: missingSheets });
  if (metadata.data.properties.timeZone !== "Asia/Jakarta") {
    fail("Target spreadsheet timezone is not Asia/Jakarta: " + metadata.data.properties.timeZone);
  }
  const auditNames = ["tabsal", "tabops", "Products", "ExpenseItems", "Transaction", "Helper"]
    .concat(OTHER_CANONICAL.filter(function (name) { return name !== "Products" && name !== "ExpenseItems"; }));
  const ranges = auditNames.map(function (name) { return quoteSheet(name); });
  const raw = await readRanges(sheets, spreadsheetId, ranges, "UNFORMATTED_VALUE");
  const formulas = await readRanges(sheets, spreadsheetId, ranges, "FORMULA");
  const byName = Object.fromEntries(auditNames.map(function (name, index) { return [name, raw[index]]; }));
  const formulaByName = Object.fromEntries(auditNames.map(function (name, index) { return [name, formulas[index]]; }));
  requireHeaderOnly(byName.tabsal, SALES_HEADERS, "tabsal");
  requireHeaderOnly(byName.tabops, EXPENSE_HEADERS, "tabops");
  const productHeaders = requireHeaders(byName.Products, ["ID_Prod"], "Products");
  const expenseHeaders = requireHeaders(byName.ExpenseItems, ["ID_Ops"], "ExpenseItems");
  const productIndex = productHeaders.indexOf("ID_Prod");
  const expenseIndex = expenseHeaders.indexOf("ID_Ops");
  const productIds = uniqueSet(dataRows(byName.Products).map(function (row) { return row[productIndex]; }), "Products.ID_Prod");
  const expenseIds = uniqueSet(dataRows(byName.ExpenseItems).map(function (row) { return row[expenseIndex]; }), "ExpenseItems.ID_Ops");
  const salesOrphans = source.sales.filter(function (row) { return !productIds.has(row.idProd); });
  const expenseOrphans = source.expense.filter(function (row) { return !expenseIds.has(row.idOps); });
  if (salesOrphans.length) fail("Sales Product FK orphans found", salesOrphans.slice(0, 100));
  if (expenseOrphans.length) fail("ExpenseItems FK orphans found", expenseOrphans.slice(0, 100));
  const protectedFingerprints = {};
  ["Transaction", "Helper"].concat(OTHER_CANONICAL).forEach(function (name) {
    protectedFingerprints[name] = fingerprint(formulaByName[name]);
  });
  return {
    spreadsheetId: spreadsheetId,
    productIds: productIds,
    expenseIds: expenseIds,
    protectedFingerprints: protectedFingerprints,
    transaction: protectedFingerprints.Transaction,
    helper: protectedFingerprints.Helper
  };
}

function dateAtNoon(iso) {
  return iso + "T12:00:00+07:00";
}

function migrationTimestamp() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(now).replace(" ", "T");
  return parts + "+07:00";
}

function buildSalesValues(source, timestamp) {
  return source.sales.map(function (row, index) {
    return [
      "SAL-XLSM-" + String(index + 1).padStart(8, "0"), dateAtNoon(row.date),
      row.idProd, row.tipe, row.qty, row.hpp, row.hj, "XLSM", true,
      timestamp, "SYSTEM_MIGRATION", "", ""
    ];
  });
}

function buildExpenseValues(source, timestamp) {
  return source.expense.map(function (row, index) {
    return [
      "OPS-XLSM-" + String(index + 1).padStart(8, "0"), dateAtNoon(row.date),
      row.idOps, row.nilai, "XLSM", true, timestamp, "SYSTEM_MIGRATION", "", ""
    ];
  });
}

async function appendBatchLog(sheets, spreadsheetId, batchId, sourceRows, targetRows, timestamp) {
  const logValues = await readRanges(sheets, spreadsheetId, [quoteSheet("MigrationLog")], "UNFORMATTED_VALUE");
  const headers = header(logValues[0]);
  const aliases = {
    batch: ["BatchID", "BatchId", "MigrationID", "MigrationId", "Batch"],
    workbook: ["SourceWorkbook", "SourceFile", "Source"],
    sourceSheet: ["SourceSheet", "SourceTable"],
    targetSheet: ["TargetSheet", "TargetTable"],
    sourceRows: ["SourceRowCount", "SourceRows"],
    targetRows: ["TargetRowCount", "TargetRows"],
    status: ["Status"],
    timestamp: ["MigrationTimestamp", "MigratedAt", "CreatedAt", "Timestamp"]
  };
  const selected = {};
  for (const key of Object.keys(aliases)) {
    selected[key] = aliases[key].find(function (name) { return headers.includes(name); });
    if (!selected[key]) fail("MigrationLog schema has no supported " + key + " column", { headers: headers });
  }
  const row = headers.map(function (name) {
    if (name === selected.batch) return batchId;
    if (name === selected.workbook) return SOURCE_WORKBOOK;
    if (name === selected.sourceSheet) return batchId.indexOf("SALES") >= 0 ? "Datasets/tabsal" : "Datasets/tabops";
    if (name === selected.targetSheet) return batchId.indexOf("SALES") >= 0 ? "tabsal" : "tabops";
    if (name === selected.sourceRows) return sourceRows;
    if (name === selected.targetRows) return targetRows;
    if (name === selected.status) return "PASS";
    if (name === selected.timestamp) return timestamp;
    return "";
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId,
    range: quoteSheet("MigrationLog") + "!A1",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] }
  });
}

function validateTargetSales(values, source, productIds) {
  exactHeaders(header(values), SALES_HEADERS, "post-write tabsal");
  const rows = objectRows(values);
  if (rows.length !== source.sales.length) fail("Post-write tabsal row count mismatch");
  const ids = new Set();
  const reconstructed = rows.map(function (row, index) {
    const expectedId = "SAL-XLSM-" + String(index + 1).padStart(8, "0");
    if (row.ID_Trx !== expectedId || ids.has(row.ID_Trx)) fail("Post-write tabsal ID mismatch/duplicate at row " + (index + 2));
    ids.add(row.ID_Trx);
    if (!productIds.has(String(row.ID_Prod))) fail("Post-write tabsal Product orphan: " + row.ID_Prod);
    if (row.Source !== "XLSM" || row.IsActive !== true) fail("Post-write tabsal provenance/state mismatch at row " + (index + 2));
    const iso = String(row.Tanggal).slice(0, 10);
    if (iso > CUTOFF_ISO) fail("Post-write tabsal cutoff violation at row " + (index + 2));
    return { date: iso, qty: Number(row.Qty), hpp: Number(row.HPP), hj: Number(row.HJ) };
  });
  compareControls(summarizeSales(reconstructed), SALES_CONTROLS, "Post-write Sales");
  return { rows: rows.length, uniqueIds: ids.size, maxDate: reconstructed.reduce(function (a, x) { return x.date > a ? x.date : a; }, "") };
}

function byIdOps(rows) {
  const result = {};
  for (const row of rows) {
    if (!result[row.idOps]) result[row.idOps] = [0, 0];
    result[row.idOps][0] += 1;
    result[row.idOps][1] += row.nilai;
  }
  return result;
}

function validateTargetExpense(values, source, expenseIds) {
  exactHeaders(header(values), EXPENSE_HEADERS, "post-write tabops");
  const rows = objectRows(values);
  if (rows.length !== source.expense.length) fail("Post-write tabops row count mismatch");
  const ids = new Set();
  const reconstructed = rows.map(function (row, index) {
    const expectedId = "OPS-XLSM-" + String(index + 1).padStart(8, "0");
    if (row.ID_Trx !== expectedId || ids.has(row.ID_Trx)) fail("Post-write tabops ID mismatch/duplicate at row " + (index + 2));
    ids.add(row.ID_Trx);
    if (!expenseIds.has(String(row.ID_Ops))) fail("Post-write tabops ExpenseItems orphan: " + row.ID_Ops);
    if (row.Source !== "XLSM" || row.IsActive !== true) fail("Post-write tabops provenance/state mismatch at row " + (index + 2));
    const iso = String(row.Tanggal).slice(0, 10);
    if (iso > CUTOFF_ISO) fail("Post-write tabops cutoff violation at row " + (index + 2));
    return { date: iso, idOps: String(row.ID_Ops), nilai: Number(row.Nilai) };
  });
  compareControls(summarizeExpense(reconstructed), EXPENSE_CONTROLS, "Post-write Expense");
  if (JSON.stringify(byIdOps(reconstructed)) !== JSON.stringify(byIdOps(source.expense))) {
    fail("Post-write ID_Ops count/value reconciliation mismatch");
  }
  return { rows: rows.length, uniqueIds: ids.size, maxDate: reconstructed.reduce(function (a, x) { return x.date > a ? x.date : a; }, "") };
}

async function verifyProtected(sheets, spreadsheetId, before) {
  const names = ["Transaction", "Helper"].concat(OTHER_CANONICAL);
  const formulas = await readRanges(sheets, spreadsheetId, names.map(quoteSheet), "FORMULA");
  const after = Object.fromEntries(names.map(function (name, index) { return [name, fingerprint(formulas[index])]; }));
  for (const name of names) {
    if (JSON.stringify(after[name]) !== JSON.stringify(before[name])) fail(name + " fingerprint changed during migration");
  }
  return after;
}

async function writeLedger(sheets, spreadsheetId, sheetName, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId,
    range: quoteSheet(sheetName) + "!A2",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: values }
  });
  const reread = await readRanges(sheets, spreadsheetId, [quoteSheet(sheetName)], "UNFORMATTED_VALUE");
  return reread[0];
}

function formatControls(summary, expected) {
  return Object.keys(expected).map(function (year) {
    return { year: Number(year), actual: summary[year], expected: expected[year], difference: summary[year].map(function (value, index) { return value - expected[year][index]; }) };
  });
}

async function main() {
  const source = auditSource();
  if (SOURCE_ONLY) {
    const sourceReport = {
      path: SOURCE_PATH,
      sha256: source.sha256,
      size: source.size,
      cutoff: CUTOFF_ISO,
      salesRows: source.sales.length,
      expenseRows: source.expense.length,
      maxSalesDate: source.maxSalesDate,
      maxExpenseDate: source.maxExpenseDate,
      salesSummary: source.salesSummary,
      expenseSummary: source.expenseSummary,
      derivedExceptions: 0,
      dateExceptions: 0
    };
    if (EXPORT_FK) {
      sourceReport.salesIds = Array.from(new Set(source.sales.map(function (row) { return row.idProd; }))).sort();
      sourceReport.expenseIds = Array.from(new Set(source.expense.map(function (row) { return row.idOps; }))).sort();
    } else if (EXPORT_VALUES) {
      sourceReport.sales = source.sales;
      sourceReport.expense = source.expense;
    }
    if (SALES_CHUNK || EXPENSE_CHUNK) {
      const specification = (SALES_CHUNK || EXPENSE_CHUNK).split("=")[1].split(":").map(Number);
      const start = specification[0];
      const count = specification[1];
      if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 1) {
        fail("Invalid chunk specification");
      }
      sourceReport.chunkType = SALES_CHUNK ? "sales" : "expense";
      sourceReport.chunkStart = start;
      sourceReport.rows = (SALES_CHUNK ? source.sales : source.expense).slice(start, start + count);
    }
    const serialized = JSON.stringify(sourceReport, null, EXPORT_VALUES ? 0 : 2);
    if (EXPORT_BASE64) {
      const zlib = require("zlib");
      console.log(zlib.gzipSync(serialized).toString("base64"));
    } else {
      console.log(serialized);
    }
    return;
  }
  const auth = loadAuth();
  const drive = google.drive({ version: "v3", auth: auth });
  const sheets = google.sheets({ version: "v4", auth: auth });
  const target = await auditTarget(sheets, drive, source);
  const report = {
    mode: EXECUTE ? "execute" : "audit",
    source: {
      path: SOURCE_PATH, sha256: source.sha256, size: source.size,
      cutoff: CUTOFF_ISO, salesRows: source.sales.length,
      expenseRows: source.expense.length, maxSalesDate: source.maxSalesDate,
      maxExpenseDate: source.maxExpenseDate
    },
    preMigration: {
      tabsal: "header-only", tabops: "header-only",
      transaction: target.transaction, helper: target.helper
    },
    sales: {
      derivedExceptions: 0, fkOrphans: 0, dateExceptions: 0,
      annual: formatControls(source.salesSummary, SALES_CONTROLS)
    },
    expense: {
      fkOrphans: 0, dateExceptions: 0,
      annual: formatControls(source.expenseSummary, EXPENSE_CONTROLS)
    },
    migrationExceptions: []
  };
  if (!EXECUTE) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const timestamp = migrationTimestamp();
  const salesValues = buildSalesValues(source, timestamp);
  const salesReadback = await writeLedger(sheets, target.spreadsheetId, "tabsal", salesValues);
  report.salesMigration = validateTargetSales(salesReadback, source, target.productIds);
  await appendBatchLog(sheets, target.spreadsheetId, "HISTORICAL_SALES_2021_2026JUL", source.sales.length, report.salesMigration.rows, timestamp);
  const expenseValues = buildExpenseValues(source, timestamp);
  const expenseReadback = await writeLedger(sheets, target.spreadsheetId, "tabops", expenseValues);
  report.expenseMigration = validateTargetExpense(expenseReadback, source, target.expenseIds);
  await appendBatchLog(sheets, target.spreadsheetId, "HISTORICAL_EXPENSE_2021_2026JUL", source.expense.length, report.expenseMigration.rows, timestamp);
  report.postMigrationProtected = await verifyProtected(sheets, target.spreadsheetId, target.protectedFingerprints);
  report.migrationLogBatches = ["HISTORICAL_SALES_2021_2026JUL", "HISTORICAL_EXPENSE_2021_2026JUL"];
  console.log(JSON.stringify(report, null, 2));
}

main().catch(function (error) {
  console.error(JSON.stringify({
    status: "STOPPED", message: error.message,
    details: error.details || null, writeMode: EXECUTE
  }, null, 2));
  process.exitCode = 1;
});
