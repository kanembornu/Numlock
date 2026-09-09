# Finance Phase 11R inventory opening evidence intake

`inventory-opening-evidence-intake.xlsx` is a non-production operator package for the 21 eligible `MAIN` inventory scopes at the 2026-09-30 EOD Asia/Jakarta cutover. It uses the staging/reference batch candidate `INV-OPEN-20261001-V01`.

The `Intake` sheet separates production-derived reference fields, blank operator inputs, and formula-derived checks. `27-column preview` and `Production mapping` preserve the exact `InventoryOpenings` column order without authorizing a write. `Authorities` records the read-only Item, BaseUOM, and active conversion mapping used to generate the package. The Lemon section in `Guide` is a non-authoritative whole-fruit memo and never maps to `InventoryOpenings`.

Run the verifier against the final workbook:

```sh
node docs/evidence/finance-phase-11r/verify-intake-package.mjs \
  docs/evidence/finance-phase-11r/inventory-opening-evidence-intake.xlsx \
  docs/evidence/finance-phase-11r/validation-report.json
```

The workbook and verifier do not access or mutate the production spreadsheet. Rebuilding requires an explicit, separately acquired read-only production workbook snapshot as the first argument to `build-intake-package.mjs`.
