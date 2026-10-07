// OFF-REPO RETIREMENT — operational use neutralized.
//
// This script used to regenerate manifest-index.csv, candidate-rows.json/csv, and
// drive-evidence-map.json with fresh external claims ("StoredByteVerification": "PASS",
// Drive URLs). The referenced external Drive folder and files are off-repo deletion
// candidates and repository bytes are authoritative
// (docs/evidence/finance-phase-11n8/manifests/). Regenerating those records after
// retirement would fabricate liveness claims, so this script now fails closed and
// writes nothing. The historical records below are retained as PROVENANCE_REFERENCE
// only; see docs/evidence/off-repo-retirement.md for the inventory, parity evidence,
// and retention decisions.

"use strict";

const OFF_REPO_EVIDENCE_RETIRED = {
  status: "REFUSED",
  reason: "OFF_REPO_EVIDENCE_RETIRED",
  detail: "REPOSITORY_AUTHORITATIVE_EVIDENCE_REQUIRED",
  writesPerformed: 0
};

// Retained provenance pins (identity only; never contacted by this script).
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

if (require.main === module) {
  console.log(JSON.stringify(OFF_REPO_EVIDENCE_RETIRED));
  process.exit(1);
}

module.exports = { OFF_REPO_EVIDENCE_RETIRED: OFF_REPO_EVIDENCE_RETIRED, driveFolder: driveFolder, fileIds: fileIds };
