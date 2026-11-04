const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const ROOT = __dirname;
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, "candidate-rows.json"), "utf8"));
const indexLines = fs.readFileSync(path.join(ROOT, "manifest-index.csv"), "utf8").trim().split("\n");
const indexHeaders = indexLines.shift().split(",");
const index = indexLines.map(line => Object.fromEntries(line.split(",").map((value, i) => [indexHeaders[i], value])));
const context = { console, Logger: { log() {} }, NUMLOCK_PRODUCTION_STORAGE_POLICY: { SPREADSHEET_ID: "VALIDATION_ONLY" } };
vm.createContext(context);
for (const file of ["20.Data.Source.js", "36.Finance.Service.js", "38.CapitalEquity.Service.js", "39.Balance.Foundation.js"])
  vm.runInContext(fs.readFileSync(path.resolve(ROOT, "../../..", file), "utf8"), context, { filename: file });

const expectedHeaders = context.BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS;
const items = rows.map(row => ({ ItemID: row.ItemID, ItemName: row.PackageIdentity.split("|")[2],
  Classification: "RAW_MATERIAL", BaseUOM: row.ToUOM, EffectiveFrom: "2026-01-01", EffectiveTo: "",
  IsActive: true, SourceIngredientID: row.ItemID, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }));
const report = context.validateInventoryUomConversions(rows, items);
const risk = rows.map(row => context.inventoryOperatorAttestationRiskTier(row,
  context.inventoryOperatorAttestationDetails(row)));
const readiness = rows.map(row => context.classifyInventoryConversionReadiness(
  row.ItemID, "2026-10-01", items, rows).status);
const hashes = index.map(entry => {
  const bytes = fs.readFileSync(path.join(ROOT, entry.ManifestFile));
  return crypto.createHash("sha256").update(bytes).digest("hex") === entry.SHA256 &&
    /^[a-f0-9]{64}$/.test(entry.SHA256);
});
const manifests = index.map(entry => fs.readFileSync(path.join(ROOT, entry.ManifestFile), "utf8"));
const checks = {
  manifestCount: index.length === 21 && manifests.length === 21,
  uniqueConversions: new Set(rows.map(row => row.ConversionID)).size === 21,
  exact24Columns: rows.every(row => JSON.stringify(Object.keys(row)) === JSON.stringify(expectedHeaders)),
  noLemon: rows.every(row => row.ItemID !== "ING-018") && manifests.every(text => !text.includes("ING-018")),
  hashes: hashes.every(Boolean),
  canonicalUtf8Lf: manifests.every(text => !text.includes("\r") && text.endsWith("\n") &&
    text.startsWith('CanonicalizationVersion="NUMLOCK-ATTESTATION-CANONICAL-V01"\n')),
  fixedDates: rows.every(row => row.EvidenceDate === "2026-09-04" &&
    row.PreparedAt === "2026-09-04T16:00:00+07:00" && row.EffectiveFrom === "2026-10-01"),
  inactiveApprovedCandidates: rows.every(row => row.ApprovalStatus === "SINGLE_OPERATOR_APPROVED" &&
    row.IsActive === false && /^GDRIVE:[A-Za-z0-9_-]+:V01:SHA256:[a-f0-9]{64}$/.test(row.EvidenceRef) &&
    row.ReviewedBy === "" && row.ReviewedAt === ""),
  validatorPass: report.status === "PASS" && report.errors.length === 0,
  riskTiers: risk.filter(value => value === "LOW").length === 19 &&
    risk.filter(value => value === "MODERATE").length === 2 && !risk.includes("HIGH"),
  readiness: readiness.every(status => status === "NEEDS_EVIDENCE"),
  noConflicts: report.errors.every(entry => !entry.errors.includes("OVERLAPPING_APPROVED_CONVERSION")),
  immutableEvidence: index.every(entry => entry.ImmutableStorage === "VERIFIED" &&
    entry.EvidenceRef === entry.RequiredEvidenceRef &&
    /^GDRIVE:[A-Za-z0-9_-]+:V01:SHA256:[a-f0-9]{64}$/.test(entry.EvidenceRef)),
  startDateUnknown: manifests.filter(text => text.includes('ItemID="ING-016"')).every(text =>
    text.includes('OperationalHistory="START_DATE_UNKNOWN"'))
};
if (!Object.values(checks).every(Boolean)) throw new Error(`Bundle validation failed: ${JSON.stringify(checks)}`);
const result = { status: "PASS", checks, manifests: 21, sha256: 21, risk: { LOW: 19, MODERATE: 2, HIGH: 0 },
  validator: { status: report.status, errors: report.errors.length },
  readiness: { NEEDS_EVIDENCE: 21, SINGLE_OPERATOR_VERIFIED: 0, VERIFIED: 0 } };
fs.writeFileSync(path.join(ROOT, "validation-report.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
