# Legacy retirement preservation

Frozen byte-for-byte copies of the two owner-exported legacy workbooks, preserved during off-repo
retirement before external Drive copies are trashed (separate, separately authorized off-repo step):

| File | Bytes | SHA256 | Worksheets | Source Drive file |
|---|---:|---|---:|---|
| `NUMLOCK — Pre Legacy Decommission Archive — 2026-08-31.xlsx` | 1,374,327 | `970b6380c7abb69e1230f6214ad1a081f47ed8fcc0d7652dcfd7ada5f47d28e8` | 20 | `1bmhRP04oxoRQPM7yXOpm6L7e2ULLAZn6kOrgc0lNtt4` |
| `Numlock DB Backup - Pre Schema V1 - 2026-08-13 0954.xlsx` | 986,479 | `23daa2623c0e86d68d9b29f656e202dfc31054efc4043fe0a2583e0493915a36` | 8 | `1EKR8EU4nw_kpqb-bvp9jV0AAEasWsssMwuJ7e3fBCWg` |

`manifest.json` is the authoritative record: per-file provenance (Drive folder/file IDs, snapshot
dates, roles, pre-schema vs post-migration classification, known transformation deltas), the
FROZEN_EVIDENCE / NOT_RUNTIME_AUTHORITY statements, the local MOE snapshot audit (93-file hash
inventory + classifications, `LOCAL_MOE_PARITY=COMPLETE`), and public form-definition captures.

These workbooks are frozen evidence, not runtime authority: no code may read them as authority.
Verification: re-hash the files and compare against `manifest.json` (`sha256`, `bytes`,
`worksheetCount`); see `docs/evidence/off-repo-retirement.md` for the retirement context.
