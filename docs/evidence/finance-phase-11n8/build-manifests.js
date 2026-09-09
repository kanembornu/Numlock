const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const MANIFEST_DIR = path.join(ROOT, "manifests");
const FIELDS = [
  "CanonicalizationVersion", "Encoding", "LineEndings", "Serialization", "ManifestID", "ManifestVersion",
  "ConversionID", "ItemID", "ItemName", "BaseUOM", "FromUOM", "PackageIdentity", "SupplierRef",
  "KnowledgeBasis", "EvidenceType", "Numerator", "Denominator", "ToUOM", "RatioStatement",
  "OperatorSignedStatement", "OperationalHistory", "EvidenceDate", "PreparedBy", "PreparedAt", "ReviewedBy",
  "ReviewedAt", "EffectiveFrom", "EffectiveTo", "RiskTier", "GovernancePath", "NoIndependentReview",
  "SelfApprovalDisclosed", "ApprovalNote"
];
const HEADERS = ["ConversionID", "ItemID", "FromUOM", "PackageIdentity", "SupplierRef", "ToUOM", "Numerator",
  "Denominator", "EffectiveFrom", "EffectiveTo", "EvidenceType", "EvidenceRef", "EvidenceDate", "PreparedBy",
  "PreparedAt", "ReviewedBy", "ReviewedAt", "ApprovalStatus", "ApprovalNote", "IsActive", "CreatedAt",
  "CreatedBy", "UpdatedAt", "UpdatedBy"];

const candidates = [
  ["004", "Bean Ar 100%", "gr", "bag", "INTERNAL-SHOPEE-CHANNEL", "plastic bag 1 kg", 1000, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since May 2026", "I, Dekker, attest that the purchasing package is one plastic bag containing exactly 1000 gr of Bean Ar 100%."],
  ["005", "Bean Ar Lintong", "gr", "bag", "INTERNAL-SHOPEE-CHANNEL", "plastic bag 500 gr", 500, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since Jun 2026", "I, Dekker, attest that the purchasing package is one plastic bag containing exactly 500 gr of Bean Ar Lintong."],
  ["006", "Bean Robusta", "gr", "bag", "INTERNAL-SHOPEE-CHANNEL", "plastic bag 1000 gr", 1000, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used before 2026", "I, Dekker, attest that the purchasing package is one plastic bag containing exactly 1000 gr of Bean Robusta."],
  ["007", "Kopi Badau", "gr", "bag", "INTERNAL-KELONTONG", "plastic bag 420 gr", 420, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one plastic bag containing exactly 420 gr of Kopi Badau."],
  ["008", "Kopi Kingkong", "gr", "bag", "INTERNAL-KELONTONG", "plastic bag 400 gr", 400, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one plastic bag containing exactly 400 gr of Kopi Kingkong."],
  ["009", "UHT", "ml", "carton", "INTERNAL-KELONTONG", "carton 12 x 1 L boxes", 12000, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one carton containing 12 UHT boxes of 1000 ml each, totaling exactly 12000 ml."],
  ["010", "SKM", "gr", "carton", "INTERNAL-KELONTONG", "carton 24 x 490 gr cans", 11760, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one carton containing 24 SKM cans of 490 gr each, totaling exactly 11760 gr."],
  ["011", "Air", "ml", "gallon", "INTERNAL-DEPOT", "19 L gallon", 19000, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one 19 L gallon containing exactly 19000 ml of Air."],
  ["012", "Teh Bendera", "gr", "pack", "INTERNAL-KELONTONG", "pack 10 x 50 gr boxes", 500, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one pack containing 10 Teh Bendera boxes of 50 gr each, totaling exactly 500 gr."],
  ["013", "Teh Poci", "gr", "pack", "INTERNAL-KELONTONG", "pack 10 x 50 gr boxes", 500, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one pack containing 10 Teh Poci boxes of 50 gr each, totaling exactly 500 gr."],
  ["014", "Teh Zeppelin", "gr", "pack", "INTERNAL-KELONTONG", "400 gr pack", 400, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one pack containing exactly 400 gr of Teh Zeppelin."],
  ["015", "Powder Choco", "gr", "bag", "INTERNAL-SHOPEE-CHANNEL", "zipper bag 500 gr", 500, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since early 2026", "I, Dekker, attest that the purchasing package is one zipper bag containing exactly 500 gr of Powder Choco."],
  ["016", "Powder Matcha", "gr", "bag", "INTERNAL-SHOPEE-CHANNEL", "zipper bag 100 gr", 100, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "START_DATE_UNKNOWN", "I, Dekker, attest that the purchasing package is one zipper bag containing exactly 100 gr of Powder Matcha."],
  ["017", "Sirup", "ml", "bottle", "INTERNAL-SHOPEE-CHANNEL", "750 ml syrup bottle", 750, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one bottle containing exactly 750 ml of Sirup."],
  ["019", "Soda", "ml", "carton", "INTERNAL-KELONTONG", "carton 24 x 250 ml bottles", 6000, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one carton containing 24 Soda bottles of 250 ml each, totaling exactly 6000 ml."],
  ["020", "Gula", "gr", "bag", "INTERNAL-KELONTONG", "plastic bag 1 kg", 1000, "FIXED_PACKAGE_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one plastic bag containing exactly 1000 gr of Gula."],
  ["021", "Es", "gr", "pack", "SUP-HAKAES", "standardized plastic pack 10 kg", 10000, "FIXED_STANDARDIZED_PACKAGE_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package supplied under SUP-HAKAES is one fixed standardized plastic pack containing exactly 10000 gr of Es."],
  ["031", "Spt Filter", "pcs", "box", "INTERNAL-SHOPEE-CHANNEL", "box 40 filter sheets", 40, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one box containing exactly 40 filter sheets, with each sheet equal to one pcs."],
  ["032", "Spt Cup", "pcs", "pack", "INTERNAL-SHOPEE-CHANNEL", "pack 25 cups", 25, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one pack containing exactly 25 cups, with each cup equal to one pcs."],
  ["033", "Spt Sedotan", "pcs", "pack", "INTERNAL-KELONTONG", "pack 500 straws", 500, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one pack containing exactly 500 straws, with each straw equal to one pcs."],
  ["034", "Spt Plastik", "pcs", "bag", "INTERNAL-KELONTONG", "bag 50 sheets", 50, "FIXED_CONTENT_COUNT_AND_QUANTITY_OPERATOR_ATTESTATION", "used since early 2021", "I, Dekker, attest that the purchasing package is one bag containing exactly 50 plastic sheets, with each sheet equal to one pcs."]
];

function csvCell(value) {
  const text = value === false ? "FALSE" : String(value == null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function canonicalize(record) {
  return FIELDS.map(field => `${field}=${JSON.stringify(record[field])}`).join("\n") + "\n";
}

fs.mkdirSync(MANIFEST_DIR, { recursive: true });
const index = [];
const rows = [];
for (const [suffix, itemName, baseUom, fromUom, supplierRef, packageDescription, numerator, methodBase, history, statement] of candidates) {
  const itemId = `ING-${suffix}`;
  const conversionId = `CONV-ATT-${itemId}-V01`;
  const packageIdentity = `${itemId}|${supplierRef}|${itemName}|NO-SKU|${packageDescription}|V01`;
  const risk = itemId === "ING-011" || itemId === "ING-021" ? "MODERATE" : "LOW";
  const method = `${methodBase}_SINGLE_OPERATOR_ATTESTATION_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC_RISK_${risk}`;
  const approvalNote = `BASIS=OPERATOR_KNOWN; METHOD=${method}; PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW; REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED`;
  const record = {
    CanonicalizationVersion: "NUMLOCK-ATTESTATION-CANONICAL-V01", Encoding: "UTF-8", LineEndings: "LF",
    Serialization: "FIXED_ORDER_KEY_EQUALS_JSON_VALUE", ManifestID: `MANIFEST-ATT-${itemId}-V01`, ManifestVersion: "V01",
    ConversionID: conversionId, ItemID: itemId, ItemName: itemName, BaseUOM: baseUom, FromUOM: fromUom,
    PackageIdentity: packageIdentity, SupplierRef: supplierRef, KnowledgeBasis: "OPERATOR_KNOWN",
    EvidenceType: "OPERATOR_ATTESTATION", Numerator: numerator, Denominator: 1, ToUOM: baseUom,
    RatioStatement: `1 ${fromUom} = ${numerator} ${baseUom}`, OperatorSignedStatement: statement,
    OperationalHistory: history, EvidenceDate: "2026-09-04", PreparedBy: "Dekker",
    PreparedAt: "2026-09-04T16:00:00+07:00", ReviewedBy: "", ReviewedAt: "",
    EffectiveFrom: "2026-10-01", EffectiveTo: "", RiskTier: risk, GovernancePath: "SINGLE_OPERATOR",
    NoIndependentReview: true, SelfApprovalDisclosed: true, ApprovalNote: approvalNote
  };
  const payload = canonicalize(record);
  const hash = crypto.createHash("sha256").update(Buffer.from(payload, "utf8")).digest("hex");
  const file = `${record.ManifestID}.manifest`;
  fs.writeFileSync(path.join(MANIFEST_DIR, file), payload, { encoding: "utf8" });
  fs.writeFileSync(path.join(MANIFEST_DIR, `${file}.sha256`), `${hash}  ${file}\n`, { encoding: "utf8" });
  index.push({ ManifestID: record.ManifestID, ManifestVersion: "V01", ConversionID: conversionId, ItemID: itemId,
    RiskTier: risk, SHA256: hash, ManifestFile: `manifests/${file}`, ImmutableStorage: "PENDING",
    EvidenceRef: "", RequiredEvidenceRef: `GDRIVE:<REAL_DRIVE_FILE_ID>:V01:SHA256:${hash}` });
  rows.push({ ConversionID: conversionId, ItemID: itemId, FromUOM: fromUom, PackageIdentity: packageIdentity,
    SupplierRef: supplierRef, ToUOM: baseUom, Numerator: numerator, Denominator: 1,
    EffectiveFrom: "2026-10-01", EffectiveTo: "", EvidenceType: "OPERATOR_ATTESTATION", EvidenceRef: "",
    EvidenceDate: "2026-09-04", PreparedBy: "Dekker", PreparedAt: "2026-09-04T16:00:00+07:00",
    ReviewedBy: "", ReviewedAt: "", ApprovalStatus: "DRAFT", ApprovalNote: approvalNote, IsActive: false,
    CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" });
}

const indexHeaders = ["ManifestID", "ManifestVersion", "ConversionID", "ItemID", "RiskTier", "SHA256",
  "ManifestFile", "ImmutableStorage", "EvidenceRef", "RequiredEvidenceRef"];
fs.writeFileSync(path.join(ROOT, "manifest-index.csv"), [indexHeaders.join(",")].concat(index.map(row =>
  indexHeaders.map(header => csvCell(row[header])).join(","))).join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "candidate-rows.json"), JSON.stringify(rows, null, 2) + "\n");
fs.writeFileSync(path.join(ROOT, "candidate-rows.csv"), [HEADERS.join(",")].concat(rows.map(row =>
  HEADERS.map(header => csvCell(row[header])).join(","))).join("\n") + "\n");
fs.writeFileSync(path.join(ROOT, "README.md"), `# Finance Phase 11N.8 evidence bundle\n\n` +
  `Canonical payloads are UTF-8, LF-terminated, and serialized in the fixed field order defined by ` +
  `\`build-manifests.js\`. Each SHA256 sidecar and \`manifest-index.csv\` hashes only its corresponding canonical ` +
  `\`.manifest\` bytes.\n\nNo file in this directory is a production conversion row or immutable Drive artifact. ` +
  `\`EvidenceRef\` remains blank and every candidate remains \`DRAFT\` / inactive. After each canonical manifest is ` +
  `stored as a real immutable Drive file, replace \`<REAL_DRIVE_FILE_ID>\` in the indexed required form with that ` +
  `actual file ID, confirm the stored bytes reproduce the indexed SHA256, then revalidate before any activation.\n`);

console.log(JSON.stringify({ manifests: index.length, hashes: index.length, candidates: rows.length,
  low: index.filter(row => row.RiskTier === "LOW").length,
  moderate: index.filter(row => row.RiskTier === "MODERATE").length }));
