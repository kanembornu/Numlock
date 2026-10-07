# Evidence retention and use

This directory preserves phase-specific specifications, signed/attested conversion manifests, SHA256 sidecars and Drive mappings, local verifiers, snapshots, screenshots, and validation results. Evidence is retained because later audits and tests depend on it. It is not disposable build output and is not Apps Script upload source.

Historical README statuses describe their phase and observation time. They are not a live production status: later activation may supersede a phase's disabled-state statement without rewriting its frozen record. Local mocks, browser fixtures, authenticated runtime, uploads and production results are separate evidence classes.

## Storage policy

All existing 125 evidence files were inventoried and backed up before the 2026-09-10 maintenance. Existing bytes remain unchanged. Never regenerate a manifest or rewrite a historical log just to make the tree clean.

The following private source snapshots stay at their current local paths for verifiers and are explicitly excluded from Git:

- `finance-phase-11u2e/POST-11U.snapshot.json`
- `finance-phase-11v8/expense-items.snapshot.json`

Their absence on a new checkout is MISSING_LOCAL_EVIDENCE, not an empty dataset. Obtain authorized copies and verify against the retained evidence metadata before running dependent scripts; do not fetch or reconstruct production data automatically. Other phase artifacts are reviewed separately before staging. The private audit backup and file-by-file hash inventory are outside this repository in the maintenance task workspace.

## Drive evidence (off-repo retirement)

The Lemon `MANIFEST-MOS-ING-018-V01.manifest` pins the prospective management standard 1000 gr = 24 slice from 2026-10-01. It is not measured physical yield, historical reconstruction, stock on hand or a production activation flag.

Repository bytes are authoritative. The external Drive folder `NUMLOCK Finance Phase 11N.9 Immutable Attestation Evidence`, its 21 text manifests, the frozen inventory-opening workbook copy, and the Lemon manifest copy are off-repo deletion candidates: runtime and validation code no longer fetch, publish to, or depend on them (deterministic `OFF_REPO_EVIDENCE_RETIRED` refusals). `finance-phase-11n8/drive-evidence-map.json` and the other Drive ID/URL mappings are retained as PROVENANCE_REFERENCE/HISTORICAL_REFERENCE records only. External deletion or retention of those objects is decided and executed off-repo under separate authorization — it is not repository cleanup, and the repository must not re-grow operational Drive references. Inventory, classification, parity evidence, and retention decisions live in `off-repo-retirement.md`.

Immutable here means frozen, version/hash-bound content checked against repository copies and SHA256 sidecars. Drive was never proven WORM storage, and an electronic single-operator attestation is not an independent review or cryptographic personal signature. Keep historical Codex authorship statements intact.
