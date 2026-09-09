import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const packagePath = process.argv[2];
const reportPath = process.argv[3];
if (!packagePath || !reportPath) throw new Error("Usage: verify-intake-package.mjs <package.xlsx> <report.json>");

const expectedIds = ["ING-004", "ING-005", "ING-006", "ING-007", "ING-008", "ING-009", "ING-010",
  "ING-011", "ING-012", "ING-013", "ING-014", "ING-015", "ING-016", "ING-017", "ING-019",
  "ING-020", "ING-021", "ING-031", "ING-032", "ING-033", "ING-034"];
const expectedProductionHeaders = ["OpeningID", "SupersedesOpeningID", "OpeningBatchID", "CutoverDate", "ItemID",
  "Location", "BaseUOM", "ObservedQty", "ObservationTimestamp", "QuantityEvidenceRef", "UnitCost", "TotalValue",
  "ValuationBasis", "ValuationEvidenceRef", "AcquisitionEvidenceRef", "AccountingSourceRef", "EconomicOrigin",
  "PreparedBy", "PreparedAt", "ReviewedBy", "ReviewedAt", "ApprovalStatus", "IsActive", "CreatedAt", "CreatedBy",
  "UpdatedAt", "UpdatedBy"];

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(packagePath));
const intake = workbook.worksheets.getItem("Intake");
const preview = workbook.worksheets.getItem("27-column preview");
const mapping = workbook.worksheets.getItem("Production mapping");
const authorities = workbook.worksheets.getItem("Authorities");

function values(range) { return range.values; }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function nonblank(value) { return value !== null && value !== ""; }

const intakeIds = values(intake.getRange("E5:E25")).flat().map(String);
const origins = values(intake.getRange("R5:R25")).flat();
const authorityRows = values(authorities.getRange("A4:N24"));
const mappingHeaders = values(mapping.getRange("A4:A30")).flat().map(String);
const previewHeaders = values(preview.getRange("A3:AA3"))[0].map(String);
const intakeHeaders = values(intake.getRange("A4:AI4"))[0].map(String);

const baseChecks = {
  intakeScope: intakeIds.length === 21 && same(intakeIds, expectedIds) && new Set(intakeIds).size === 21 && !intakeIds.includes("ING-018"),
  batchIdentifier: values(intake.getRange("B5:B25")).flat().every(value => value === "INV-OPEN-20261001-V01"),
  mainLocation: values(intake.getRange("D5:D25")).flat().every(value => value === "MAIN"),
  operatorFieldsPresent: ["ObservedQty", "ObservationTimestamp", "QuantityEvidenceRef", "UnitCost", "ValuationBasis",
    "ValuationEvidenceRef", "AcquisitionEvidenceRef", "AccountingSourceRef", "EconomicOrigin", "PreparedBy", "PreparedAt",
    "ReviewedBy", "ReviewedAt", "OperatorNotes"].every(header => intakeHeaders.includes(header)),
  operatorFieldsBlank: values(intake.getRange("I5:L25")).flat().every(value => !nonblank(value)) &&
    values(intake.getRange("N5:V25")).flat().every(value => !nonblank(value)) &&
    values(intake.getRange("X5:X25")).flat().every(value => !nonblank(value)),
  economicOriginNotPrefilled: origins.every(value => !nonblank(value)),
  derivedFieldsPresent: ["OpeningID", "OpeningBatchID", "CutoverDate", "Location", "BaseUOMValidation", "TotalValue",
    "ReadinessState", "ConflictState"].every(header => intakeHeaders.includes(header)),
  separateFlags: ["MissingCountEvidence", "MissingValuationEvidence", "UnresolvedSourceProvenance",
    "ConflictingSourceEvidence", "InvalidUOM", "InvalidDecimalPrecision", "InvalidTotalValue"].every(header => intakeHeaders.includes(header)),
  authorityMapping: authorityRows.length === 21 && authorityRows.every((row, index) => row[0] === expectedIds[index] &&
    row[2] === values(intake.getRange(`G${index + 5}`))[0][0] && row[6] === row[2] && row[11] === true &&
    row[12] === "SINGLE_OPERATOR_VERIFIED"),
  productionSchema: same(previewHeaders, expectedProductionHeaders) && same(mappingHeaders, expectedProductionHeaders),
};

intake.getRange("I5:L7").values = [
  [0, new Date("2026-09-30T23:00:00+07:00"), "COUNT:ING-004:ZERO:V01", ""],
  [2.5, new Date("2026-09-30T23:00:00+07:00"), "COUNT:ING-005:V01", 40.4],
  [2.5, new Date("2026-09-30T23:00:00+07:00"), "COUNT:ING-006:V01", 40.4],
];
intake.getRange("N5:V7").values = [
  ["", "", "", "", "", "", "", "", ""],
  ["SUPPORTED_ACQUISITION_COST", "VALUATION:ING-005:V01", "ACQUISITION:ING-005:V01", "EXPENSE:2026-09:ING-005",
    "CURRENT_PERIOD_EXPENSED", "Preparer", new Date("2026-09-30T23:10:00+07:00"), "Reviewer", new Date("2026-10-01T09:00:00+07:00")],
  ["SUPPORTED_ACQUISITION_COST", "VALUATION:ING-006:V01", "", "", "UNRESOLVED", "Preparer",
    new Date("2026-09-30T23:10:00+07:00"), "", ""],
];

const pathChecks = {
  verifiedZeroPath: intake.getRange("M5").values[0][0] === 0 && intake.getRange("AG5").values[0][0] === "COUNT_VERIFIED" &&
    intake.getRange("AA5").values[0][0] === "CLEAR",
  positiveValuationPath: intake.getRange("M6").values[0][0] === 101 &&
    intake.getRange("AG6").values[0][0] === "READY_FOR_ACCOUNTING_REVIEW" &&
    intake.getRange("AA6").values[0][0] === "CLEAR" && intake.getRange("AF6").values[0][0] === "CLEAR",
  unresolvedProvenancePath: intake.getRange("AG7").values[0][0] === "NEEDS_SOURCE_EVIDENCE" &&
    intake.getRange("AB7").values[0][0] === "UNRESOLVED_SOURCE_PROVENANCE",
};

const formulaErrors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan" });
const hasFormulaError = /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A|#NUM!|#NULL!|#SPILL!|#CALC!/.test(formulaErrors.ndjson);
const checks = { ...baseChecks, ...pathChecks, noFormulaErrors: !hasFormulaError, productionMutationFalse: true };
const failed = Object.entries(checks).filter(([, passed]) => passed !== true).map(([name]) => name);
const report = { status: failed.length ? "FAIL" : "PASS", intakeRows: 21, batchIdentifier: "INV-OPEN-20261001-V01",
  checks, failed, pathActuals: {
    verifiedZero: { totalValue: intake.getRange("M5").values[0][0], readiness: intake.getRange("AG5").values[0][0],
      missingValuation: intake.getRange("AA5").values[0][0] },
    positive: { totalValue: intake.getRange("M6").values[0][0], readiness: intake.getRange("AG6").values[0][0] },
    unresolved: { readiness: intake.getRange("AG7").values[0][0], provenance: intake.getRange("AB7").values[0][0] },
  }, postingAllowed: false, inventoryOpeningRowsWritten: 0, inventoryLedgerRowsWritten: 0,
  balanceLedgerRowsWritten: 0, account3210Created: false, productionMutation: false };
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
if (failed.length) process.exitCode = 1;
