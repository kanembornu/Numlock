import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
if (!sourcePath || !outputPath) throw new Error("Usage: build-intake-package.mjs <production-snapshot.xlsx> <output.xlsx>");

const eligibleIds = ["ING-004", "ING-005", "ING-006", "ING-007", "ING-008", "ING-009", "ING-010",
  "ING-011", "ING-012", "ING-013", "ING-014", "ING-015", "ING-016", "ING-017", "ING-019",
  "ING-020", "ING-021", "ING-031", "ING-032", "ING-033", "ING-034"];
const productionHeaders = ["OpeningID", "SupersedesOpeningID", "OpeningBatchID", "CutoverDate", "ItemID",
  "Location", "BaseUOM", "ObservedQty", "ObservationTimestamp", "QuantityEvidenceRef", "UnitCost", "TotalValue",
  "ValuationBasis", "ValuationEvidenceRef", "AcquisitionEvidenceRef", "AccountingSourceRef", "EconomicOrigin",
  "PreparedBy", "PreparedAt", "ReviewedBy", "ReviewedAt", "ApprovalStatus", "IsActive", "CreatedAt", "CreatedBy",
  "UpdatedAt", "UpdatedBy"];
const batchId = "INV-OPEN-20261001-V01";

function rowsToObjects(values) {
  const headers = values[0].map(value => String(value ?? ""));
  return values.slice(1).filter(row => row.some(value => value !== null && value !== "")).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

function dateKey(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000)
    .toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

const source = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const openingHeader = source.worksheets.getItem("InventoryOpenings").getRange("A1:AA1").values[0];
const itemRows = rowsToObjects(source.worksheets.getItem("InventoryItems").getRange("A1:L30").values);
const conversionRows = rowsToObjects(source.worksheets.getItem("InventoryUOMConversions").getRange("A1:X30").values);
const inventoryLedgerRows = rowsToObjects(source.worksheets.getItem("InventoryLedger").getRange("A1:W30").values);
const balanceLedgerRows = rowsToObjects(source.worksheets.getItem("BalanceLedger").getRange("A1:P30").values);
const accountRows = rowsToObjects(source.worksheets.getItem("Accounts").getRange("A1:I100").values);

if (JSON.stringify(openingHeader) !== JSON.stringify(productionHeaders)) throw new Error("InventoryOpenings schema mismatch");
if (eligibleIds.includes("ING-018") || new Set(eligibleIds).size !== 21) throw new Error("Eligible scope mismatch");
if (inventoryLedgerRows.length || balanceLedgerRows.length) throw new Error("Ledger baseline is not header-only");
if (accountRows.some(row => String(row.AccountCode) === "3210")) throw new Error("Account 3210 exists");

const itemMap = new Map(itemRows.map(row => [String(row.ItemID), row]));
const applicable = conversionRows.filter(row => eligibleIds.includes(String(row.ItemID)) &&
  (row.IsActive === true || Number(row.IsActive) === 1 || String(row.IsActive).toLowerCase() === "true") &&
  dateKey(row.EffectiveFrom) <= "2026-10-01" && !row.EffectiveTo);
if (applicable.length !== 21 || new Set(applicable.map(row => String(row.ItemID))).size !== 21) {
  throw new Error("Active conversion scope mismatch");
}

const authorityRows = eligibleIds.map(id => {
  const item = itemMap.get(id);
  const conversion = applicable.find(row => String(row.ItemID) === id);
  if (!item || !conversion || id === "ING-018" || String(item.BaseUOM) !== String(conversion.ToUOM) ||
      String(conversion.ApprovalStatus) !== "SINGLE_OPERATOR_APPROVED") throw new Error(`Authority mismatch: ${id}`);
  return [id, item.ItemName, item.BaseUOM, conversion.ConversionID, conversion.FromUOM, conversion.PackageIdentity,
    conversion.ToUOM, Number(conversion.Numerator), Number(conversion.Denominator), "2026-10-01",
    conversion.ApprovalStatus, true, "SINGLE_OPERATOR_VERIFIED", conversion.EvidenceRef];
});

const workbook = Workbook.create();
const guide = workbook.worksheets.add("Guide");
const intake = workbook.worksheets.add("Intake");
const preview = workbook.worksheets.add("27-column preview");
const mapping = workbook.worksheets.add("Production mapping");
const authorities = workbook.worksheets.add("Authorities");

const font = "Arial";
const navy = "#17365D";
const blue = "#D9EAF7";
const amber = "#FFF2CC";
const gray = "#E7E6E6";
const green = "#E2F0D9";
const red = "#F4CCCC";

guide.getRange("A1:H1").merge();
guide.getRange("A1").values = [["Inventory opening evidence intake"]];
guide.getRange("A2:H2").merge();
guide.getRange("A2").values = [["Cutover: 2026-09-30 EOD Asia/Jakarta | Location: MAIN | Batch candidate: " + batchId]];
guide.getRange("A4:B14").values = [
  ["Topic", "Operator guidance"],
  ["Purpose", "Collect evidence only. This workbook does not create accounting or posting authority."],
  ["Quantity", "Enter a physical count or measurement observed on 2026-09-30. A missing count is not zero."],
  ["Verified zero", "Enter ObservedQty=0 and a QuantityEvidenceRef. Leave UnitCost blank; TotalValue derives to 0."],
  ["Positive quantity", "Enter ObservedQty greater than 0, supported UnitCost, ValuationBasis, and ValuationEvidenceRef."],
  ["Valuation evidence", "Use invoice, receipt, supplier specification, or controlled cost evidence. Do not use tabsal.HPP, recipes, UsableQty, or guessed cost."],
  ["Source provenance", "Record acquisition evidence and historical recognition or payment, unpaid, or contribution linkage when known."],
  ["EconomicOrigin", "Leave blank unless independently evidenced. UNRESOLVED is allowed during intake and blocks accounting readiness."],
  ["Review", "PreparedBy and ReviewedBy must be different people; ReviewedAt must be later than PreparedAt."],
  ["Decimals", "ObservedQty supports at most 6 decimal places. UnitCost supports at most 10 decimal places."],
  ["TotalValue", "System-derived integer Rupiah using half-up rounding: ROUND(ObservedQty × UnitCost, 0)."],
];
guide.getRange("D4:E11").values = [
  ["Allowed EconomicOrigin", "Meaning"],
  ["PRIOR_PERIOD_EXPENSED", "Acquisition was recognized as expense before the current period."],
  ["CURRENT_PERIOD_EXPENSED", "Acquisition was recognized as expense in the current period."],
  ["OWNER_CONTRIBUTED", "Inventory was contributed by the owner and has supporting evidence."],
  ["UNPAID_SUPPLIER", "Inventory remains payable to a supplier and has supporting evidence."],
  ["OTHER_SUPPORTED", "Another origin is supported and explained in OperatorNotes."],
  ["UNRESOLVED", "Source provenance is not yet resolved; intake may continue but readiness is blocked."],
  ["Blank", "Required default when no independent origin evidence exists."],
];
guide.getRange("A16:E19").values = [
  ["Lemon memo — non-authoritative whole-fruit observation only", "WholeFruitObservedQty", "ObservationTimestamp", "QuantityEvidenceRef", "Notes"],
  ["ING-018 Lemon", "", "", "", "No slice conversion or authoritative opening row. This memo never maps to InventoryOpenings."],
  ["Authority", "NONE", "", "", ""],
  ["Production mapping", "EXCLUDED", "", "", ""],
];

const intakeHeaders = ["OpeningID", "OpeningBatchID", "CutoverDate", "Location", "ItemID", "ItemName", "BaseUOM",
  "ConversionPackageContext", "ObservedQty", "ObservationTimestamp", "QuantityEvidenceRef", "UnitCost", "TotalValue",
  "ValuationBasis", "ValuationEvidenceRef", "AcquisitionEvidenceRef", "AccountingSourceRef", "EconomicOrigin",
  "PreparedBy", "PreparedAt", "ReviewedBy", "ReviewedAt", "ApprovalStatus", "OperatorNotes", "BaseUOMValidation",
  "MissingCountEvidence", "MissingValuationEvidence", "UnresolvedSourceProvenance", "ConflictingSourceEvidence",
  "InvalidUOM", "InvalidDecimalPrecision", "InvalidTotalValue", "ReadinessState", "ConflictState", "ConversionStatus"];
intake.getRange("A1:AI1").merge();
intake.getRange("A1").values = [["21-item intake — operator inputs and deterministic checks"]];
intake.getRange("A2:AI2").merge();
intake.getRange("A2").values = [["Blue = authority/reference | Yellow = operator input | Gray = system-derived. Blank EconomicOrigin is intentional until evidenced."]];
intake.getRange("A4:AI4").values = [intakeHeaders];

authorityRows.forEach((row, index) => {
  const r = index + 5;
  const context = `${row[3]} | ${row[4]} → ${row[6]} | ${row[7]}:${row[8]} | ${row[5]} | Effective ${dateKey(row[9])}`;
  intake.getRange(`A${r}:H${r}`).values = [[`OPEN-${row[0]}-MAIN-20260930-V01`, batchId, new Date("2026-09-30T00:00:00+07:00"),
    "MAIN", row[0], row[1], row[2], context]];
  intake.getRange(`M${r}`).formulas = [[`=IF(COUNT(I${r})=0,"",IF(I${r}=0,0,IF(COUNT(L${r})=0,"",ROUND(I${r}*L${r},0))))`]];
  intake.getRange(`W${r}`).formulas = [[`=AG${r}`]];
  intake.getRange(`Y${r}`).formulas = [[`=IF(G${r}=Authorities!C${index + 4},"PASS","INVALID_UOM")`]];
  intake.getRange(`Z${r}`).formulas = [[`=IF(OR(COUNT(I${r})=0,J${r}="",K${r}=""),"MISSING_COUNT_EVIDENCE","CLEAR")`]];
  intake.getRange(`AA${r}`).formulas = [[`=IF(AND(COUNT(I${r})>0,I${r}>0,OR(COUNT(L${r})=0,N${r}="",O${r}="")),"MISSING_VALUATION_EVIDENCE","CLEAR")`]];
  intake.getRange(`AB${r}`).formulas = [[`=IF(AND(COUNT(I${r})>0,I${r}>0,OR(R${r}="",R${r}="UNRESOLVED",P${r}="",Q${r}="")),"UNRESOLVED_SOURCE_PROVENANCE","CLEAR")`]];
  intake.getRange(`AC${r}`).formulas = [[`=IF(OR(AND(R${r}<>"",COUNTIF(Guide!$D$5:$D$11,R${r})=0),AND(R${r}="UNPAID_SUPPLIER",LEFT(Q${r},3)<>"AP:"),AND(R${r}="OWNER_CONTRIBUTED",LEFT(Q${r},6)<>"OWNER:")),"CONFLICTING_SOURCE_EVIDENCE","CLEAR")`]];
  intake.getRange(`AD${r}`).formulas = [[`=IF(Y${r}="PASS","CLEAR","INVALID_UOM")`]];
  intake.getRange(`AE${r}`).formulas = [[`=IF(COUNT(I${r})=0,"CLEAR",IF(ROUND(I${r},6)<>I${r},"INVALID_DECIMAL_PRECISION",IF(COUNT(L${r})=0,"CLEAR",IF(ROUND(L${r},10)<>L${r},"INVALID_DECIMAL_PRECISION","CLEAR"))))`]];
  intake.getRange(`AF${r}`).formulas = [[`=IF(COUNT(I${r})=0,"CLEAR",IF(I${r}=0,IF(AND(COUNT(L${r})=0,M${r}=0),"CLEAR","INVALID_TOTAL_VALUE"),IF(OR(COUNT(L${r})=0,M${r}="",M${r}<>ROUND(I${r}*L${r},0),M${r}<>ROUND(M${r},0)),"INVALID_TOTAL_VALUE","CLEAR")))`]];
  intake.getRange(`AG${r}`).formulas = [[`=IF(Z${r}<>"CLEAR","DRAFT",IF(OR(AD${r}<>"CLEAR",AE${r}<>"CLEAR",J${r}<DATE(2026,9,30),J${r}>=DATE(2026,10,1)),"DRAFT",IF(I${r}=0,"COUNT_VERIFIED",IF(AA${r}<>"CLEAR","COUNT_VERIFIED",IF(AB${r}<>"CLEAR","NEEDS_SOURCE_EVIDENCE",IF(AC${r}<>"CLEAR","CLASSIFICATION_CONFLICT",IF(OR(S${r}="",T${r}="",U${r}="",V${r}="",S${r}=U${r},V${r}<=T${r}),"VALUATION_VERIFIED","READY_FOR_ACCOUNTING_REVIEW")))))))`]];
  intake.getRange(`AH${r}`).formulas = [[`=IF(COUNTIF(Z${r}:AF${r},"<>CLEAR")=0,"CLEAR","REVIEW_REQUIRED")`]];
  intake.getRange(`AI${r}`).values = [["SINGLE_OPERATOR_VERIFIED"]];
});

preview.getRange("A1:AA1").merge();
preview.getRange("A1").values = [["Exact 27-column staging preview — non-authoritative, production write prohibited"]];
preview.getRange("A3:AA3").values = [productionHeaders];
const intakeColumn = Object.fromEntries(intakeHeaders.map((header, index) => [header, String.fromCharCode(65 + index)]));
function excelColumn(index) { let n = index + 1, s = ""; while (n) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; }
const direct = { OpeningID: "A", OpeningBatchID: "B", CutoverDate: "C", ItemID: "E", Location: "D", BaseUOM: "G",
  ObservedQty: "I", ObservationTimestamp: "J", QuantityEvidenceRef: "K", UnitCost: "L", TotalValue: "M",
  ValuationBasis: "N", ValuationEvidenceRef: "O", AcquisitionEvidenceRef: "P", AccountingSourceRef: "Q",
  EconomicOrigin: "R", PreparedBy: "S", PreparedAt: "T", ReviewedBy: "U", ReviewedAt: "V", ApprovalStatus: "W" };
eligibleIds.forEach((id, index) => {
  const outRow = index + 4, intakeRow = index + 5;
  productionHeaders.forEach((header, colIndex) => {
    const cell = preview.getRange(`${excelColumn(colIndex)}${outRow}`);
    if (direct[header]) {
      const sourceCell = `Intake!${direct[header]}${intakeRow}`;
      cell.formulas = [[(["ObservedQty", "ObservationTimestamp", "QuantityEvidenceRef", "UnitCost", "TotalValue", "ValuationBasis",
        "ValuationEvidenceRef", "AcquisitionEvidenceRef", "AccountingSourceRef", "EconomicOrigin", "PreparedBy",
        "PreparedAt", "ReviewedBy", "ReviewedAt"].includes(header)) ?
        `=IF(COUNTA(${sourceCell})=0,"",${sourceCell})` : `=${sourceCell}`]];
    }
    else if (header === "IsActive") cell.values = [[false]];
    else cell.values = [[""]];
  });
});

const mappingRows = productionHeaders.map(header => {
  if (direct[header]) return [header, ["OpeningID", "OpeningBatchID", "CutoverDate", "Location", "ItemID", "BaseUOM", "TotalValue", "ApprovalStatus"].includes(header) ? "SYSTEM_DERIVED" : "OPERATOR_INPUT", `Intake.${header}`, "Direct, no manual remapping"];
  if (header === "SupersedesOpeningID") return [header, "SYSTEM_DEFAULT", "blank", "Initial opening version"];
  if (header === "IsActive") return [header, "SYSTEM_DEFAULT", "FALSE", "Staging/reference only; does not authorize posting"];
  return [header, "LATER_SYSTEM_METADATA", "blank", "Assigned only by a separately authorized production process"];
});
mapping.getRange("A1:D1").merge();
mapping.getRange("A1").values = [["Production mapping contract"]];
mapping.getRange("A3:D3").values = [["InventoryOpenings column", "Field class", "Intake source/default", "Rule"]];
mapping.getRange("A4:D30").values = mappingRows;

authorities.getRange("A1:N1").merge();
authorities.getRange("A1").values = [["Read-only production authority snapshot — 2026-09-05"]];
authorities.getRange("A3:N3").values = [["ItemID", "ItemName", "BaseUOM", "ConversionID", "FromUOM", "PackageIdentity",
  "ToUOM", "Numerator", "Denominator", "EffectiveFrom", "ApprovalStatus", "IsActive", "Readiness", "EvidenceRef"]];
authorities.getRange("A4:N24").values = authorityRows;

for (const sheet of [guide, intake, preview, mapping, authorities]) {
  sheet.showGridLines = false;
  const used = sheet.getUsedRange();
  used.format.font = { name: font, size: 10, color: "#1F1F1F" };
  used.format.verticalAlignment = "top";
}
guide.getRange("A1:H1").format.font = { name: font, size: 15, bold: true, color: navy };
guide.getRange("A2:H2").format.font = { name: font, size: 10, italic: true, color: "#595959" };
guide.getRange("A4:B4").format = { fill: navy, font: { name: font, bold: true, color: "#FFFFFF" } };
guide.getRange("D4:E4").format = { fill: navy, font: { name: font, bold: true, color: "#FFFFFF" } };
guide.getRange("A16:E16").format = { fill: gray, font: { name: font, bold: true, color: "#1F1F1F" } };
guide.getRange("A4:E19").format.wrapText = true;
guide.getRange("A:E").format.columnWidthPx = 190;
guide.getRange("B:B").format.columnWidthPx = 520;
guide.getRange("E:E").format.columnWidthPx = 420;

intake.getRange("A1:AI1").format.font = { name: font, size: 15, bold: true, color: navy };
intake.getRange("A2:AI2").format.font = { name: font, italic: true, color: "#595959" };
intake.getRange("A4:AI4").format = { fill: navy, font: { name: font, bold: true, color: "#FFFFFF" }, wrapText: true };
intake.getRange("A4:AI4").format.rowHeightPx = 48;
intake.getRange("A5:H25").format.fill = blue;
intake.getRange("AI5:AI25").format.fill = blue;
intake.getRange("I5:L25").format.fill = amber;
intake.getRange("N5:V25").format.fill = amber;
intake.getRange("X5:X25").format.fill = amber;
intake.getRange("M5:M25").format.fill = gray;
intake.getRange("W5:W25").format.fill = gray;
intake.getRange("Y5:AH25").format.fill = gray;
intake.getRange("C5:C25").format.numberFormat = "yyyy-mm-dd";
intake.getRange("J5:J25").format.numberFormat = "yyyy-mm-dd hh:mm";
intake.getRange("T5:T25").format.numberFormat = "yyyy-mm-dd hh:mm";
intake.getRange("V5:V25").format.numberFormat = "yyyy-mm-dd hh:mm";
intake.getRange("I5:I25").format.numberFormat = "0.######";
intake.getRange("L5:L25").format.numberFormat = "0.##########";
intake.getRange("M5:M25").format.numberFormat = "#,##0";
intake.getRange("A5:AI25").format.wrapText = true;
intake.getRange("A5:AI25").format.rowHeightPx = 72;
intake.getRange("A:AI").format.columnWidthPx = 130;
intake.getRange("F:F").format.columnWidthPx = 150;
intake.getRange("H:H").format.columnWidthPx = 420;
intake.getRange("K:K").format.columnWidthPx = 220;
intake.getRange("O:Q").format.columnWidthPx = 220;
intake.getRange("X:X").format.columnWidthPx = 260;
intake.freezePanes.freezeRows(4);
intake.freezePanes.freezeColumns(8);

for (const sheet of [preview, mapping, authorities]) {
  const titleEnd = sheet === mapping ? "D1" : sheet === authorities ? "N1" : "AA1";
  const headerRange = sheet === mapping ? "A3:D3" : sheet === authorities ? "A3:N3" : "A3:AA3";
  sheet.getRange(`A1:${titleEnd}`).format.font = { name: font, size: 14, bold: true, color: navy };
  sheet.getRange(headerRange).format = { fill: navy, font: { name: font, bold: true, color: "#FFFFFF" }, wrapText: true };
  sheet.getUsedRange().format.wrapText = true;
  sheet.freezePanes.freezeRows(3);
}
preview.getRange("A:AA").format.columnWidthPx = 145;
preview.getRange("A3:AA3").format.rowHeightPx = 48;
preview.getRange("D4:D24").format.numberFormat = "yyyy-mm-dd";
preview.getRange("H4:H24").format.numberFormat = "0.######";
preview.getRange("K4:K24").format.numberFormat = "0.##########";
preview.getRange("L4:L24").format.numberFormat = "#,##0";
mapping.getRange("A:D").format.columnWidthPx = 220;
mapping.getRange("D:D").format.columnWidthPx = 420;
authorities.getRange("A:N").format.columnWidthPx = 145;
authorities.getRange("A3:N3").format.rowHeightPx = 48;
authorities.getRange("A4:N24").format.rowHeightPx = 66;
authorities.getRange("F:F").format.columnWidthPx = 440;
authorities.getRange("N:N").format.columnWidthPx = 420;
authorities.getRange("J4:J24").format.numberFormat = "yyyy-mm-dd";

intake.getRange("R5:R25").dataValidation = { rule: { type: "list", values: ["PRIOR_PERIOD_EXPENSED",
  "CURRENT_PERIOD_EXPENSED", "OWNER_CONTRIBUTED", "UNPAID_SUPPLIER", "OTHER_SUPPORTED", "UNRESOLVED"] } };
intake.getRange("AG5:AG25").conditionalFormats.add("containsText", { text: "READY_FOR_ACCOUNTING_REVIEW", format: { fill: green } });
intake.getRange("AH5:AH25").conditionalFormats.add("containsText", { text: "REVIEW_REQUIRED", format: { fill: red } });

await fs.mkdir(outputPath.slice(0, outputPath.lastIndexOf("/")), { recursive: true });
await (await SpreadsheetFile.exportXlsx(workbook)).save(outputPath);
console.log(JSON.stringify({ status: "PASS", rows: authorityRows.length, batchId, productionMutation: false }));
