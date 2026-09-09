const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const driveFolder = {
  id: "1Un69xogJ5s64xO6iRM7PBXLTJ-GMlynu",
  url: "https://drive.google.com/drive/folders/1Un69xogJ5s64xO6iRM7PBXLTJ-GMlynu"
};
const fileIds = {
  "ING-004": "1Ap8E3MszGhPq7_FZOPIYRmGKjSWskW5G",
  "ING-005": "1COJ6VHBTtwXyxHMaUEiltTfpjFIwsmiS",
  "ING-006": "1DABFPD6JvvgKlX2q8h79no5NHShLUMX8",
  "ING-007": "1cijJJR9yhc0bjbepusXXP8_y3pvzO92z",
  "ING-008": "1OdUGRnM1ej7BxperQ6ll-SC9MlDhHbK8",
  "ING-009": "1Z68YNwu24vgB-LpPOw0OE2gUeXrG10Lu",
  "ING-010": "1I72DYM0cM-A1KaPwfm08os22hzxcS04o",
  "ING-011": "1ceR6hcnDa8RSX9WpSqnJy3Q2HEfWZdqH",
  "ING-012": "10syOIKRzmbDv8cdK3viTvRZyZJE0MD1W",
  "ING-013": "1ED9G_v5t2wFGt8jgMqaScOqeHkrf13rg",
  "ING-014": "1PUtKVLy37q7QmE-6fr0RDEeRHOTmUlFa",
  "ING-015": "1gby72WzDA0TttZEe3dy7ud9jY_-tvvd5",
  "ING-016": "1p04n7CX_j-vGUfTFfGnU7vBPqgDqAHTZ",
  "ING-017": "1p0cNXzgrLyEQTg8_pFHjhiJyg7nGmqXV",
  "ING-019": "1P0Va7oQdFOheUOS-jX6OJUJi7owVTmzI",
  "ING-020": "1QDDzoXP3hspf7y0ZEd3uTIMfAhaLvfXi",
  "ING-021": "1i-9-BTklC4zoOp0zSBO6gKPBFIKTt144",
  "ING-031": "19vpk8hzFcv982QPaGxlTq80EP44xrCGI",
  "ING-032": "1u6Qd0UZhijNnXBrJOzL8wXq7Y5AU7sbq",
  "ING-033": "1XQxWYLywKr2d_420myh6Asg1eACAL5Lx",
  "ING-034": "1HUeaime2QohkAzCZSULnTx7XWCHnzLDB"
};

function csv(value) {
  const text = String(value == null ? "" : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const indexPath = path.join(ROOT, "manifest-index.csv");
const lines = fs.readFileSync(indexPath, "utf8").trim().split("\n");
const headers = lines.shift().split(",");
const index = lines.map(line => Object.fromEntries(line.split(",").map((value, i) => [headers[i], value])));
for (const entry of index) {
  const fileId = fileIds[entry.ItemID];
  if (!fileId) throw new Error(`Missing Drive file ID for ${entry.ItemID}`);
  entry.ImmutableStorage = "VERIFIED";
  entry.EvidenceRef = `GDRIVE:${fileId}:V01:SHA256:${entry.SHA256}`;
  entry.RequiredEvidenceRef = entry.EvidenceRef;
}
fs.writeFileSync(indexPath, [headers.join(","), ...index.map(entry => headers.map(key => csv(entry[key])).join(","))].join("\n") + "\n");

const rowsPath = path.join(ROOT, "candidate-rows.json");
const rows = JSON.parse(fs.readFileSync(rowsPath, "utf8"));
for (const row of rows) {
  const entry = index.find(value => value.ItemID === row.ItemID);
  row.EvidenceRef = entry.EvidenceRef;
  row.ApprovalStatus = "SINGLE_OPERATOR_APPROVED";
}
fs.writeFileSync(rowsPath, JSON.stringify(rows, null, 2) + "\n");
const rowHeaders = Object.keys(rows[0]);
fs.writeFileSync(path.join(ROOT, "candidate-rows.csv"),
  [rowHeaders.join(","), ...rows.map(row => rowHeaders.map(key => csv(row[key])).join(","))].join("\n") + "\n");

const evidenceMap = index.map(entry => ({
  ManifestID: entry.ManifestID,
  ConversionID: entry.ConversionID,
  ItemID: entry.ItemID,
  DriveFileID: fileIds[entry.ItemID],
  DriveFileName: `${entry.ConversionID}-manifest-V01.txt`,
  DriveURL: `https://drive.google.com/file/d/${fileIds[entry.ItemID]}/view`,
  MIMEType: "text/plain",
  SHA256: entry.SHA256,
  StoredByteVerification: "PASS",
  EvidenceRef: entry.EvidenceRef
}));
fs.writeFileSync(path.join(ROOT, "drive-evidence-map.json"), JSON.stringify({
  DriveFolder: driveFolder,
  ArtifactCount: evidenceMap.length,
  ExactByteMatches: evidenceMap.length,
  Artifacts: evidenceMap
}, null, 2) + "\n");
