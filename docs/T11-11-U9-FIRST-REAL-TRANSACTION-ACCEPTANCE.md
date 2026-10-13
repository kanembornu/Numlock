# T11-11 — U9 First Genuine Transaction Acceptance

TASK_ID: U9-EVIDENCE-RECON-2026-10-14 · Complexity L3 · Operational risk R2 ·
Reasoning high

**STATUS: U9 FIRST GENUINE TRANSACTION ACCEPTANCE is COMPLETE and CLOSED. This
document is an evidence-reconciliation artifact only: it records already-accepted
measured evidence plus this session's local Git forensics. Zero production
mutations this session. Zero writer invocations. No U10_TRANSITIONAL_24K_CLOSE.
No push, no deploy, no Git history mutation.**

Evidence provenance rule used throughout:

- **[PRIOR-MEASURED]** — measured in the U9 acceptance session (and reverified
  after the post-v717 redeploy); accepted as KNOWN_PRIOR_EVIDENCE; not re-proved
  and not contradicted here.
- **[THIS-SESSION]** — measured locally in this reconciliation session
  (read-only Git/repository forensics).

## (A) Operator-observed

- [PRIOR-MEASURED] Exactly one operator **Save Transaction** action produced the
  first genuine V2 transaction: **SO-0003 / SRV2M-ORD-0003**, product
  **Hazelnut Latte**, variant **Cold**, service type **TAKE_AWAY**,
  amount **Rp120,000**.
- [PRIOR-MEASURED] Exactly one Save Transaction — no second save, no Correct,
  no Void.
- [PRIOR-MEASURED] RequestKey durable/committed for that save (idempotent
  request identity persisted before result return).
- [THIS-SESSION] No re-observation of the operator surface was performed here
  (no production read capability in this session's toolset — see §B).

## (B) Production measured

- [PRIOR-MEASURED] Exactly one Order for the sale; OrderLines correct for
  Hazelnut Latte / Cold / Rp120,000.
- [PRIOR-MEASURED] Exactly one `SALES_RECOGNITION_V2` journal leg set:
  **Dr1030 / Cr4000 = Rp120,000**.
- [PRIOR-MEASURED] Exactly one `SALES_MONEY_V2` journal leg set:
  **Dr1040 / Cr1030 = Rp120,000**.
- [PRIOR-MEASURED] Net effect of the sale: **Dr1040 / Cr4000 = Rp120,000**.
- [PRIOR-MEASURED] Sale-specific 1030 net = **0** (recognition and money legs
  cancel exactly on 1030).
- [PRIOR-MEASURED] 1040 effect: **+Rp120,000 exactly once**.
- [PRIOR-MEASURED] Revenue (4000) effect: **+Rp120,000 exactly once**.
- [PRIOR-MEASURED] All of the above **reverified after the post-v717 redeploy**
  (fresh reads, same conclusions); protected financial fingerprint unchanged.
- [THIS-SESSION] Phase 2 live reconfirmation: **BLOCKED / unverified** — no
  production read command for sales evidence exists in this session's
  permission allowlist (only the six fixed read diagnostics; Sheets REST
  requires a denied shell path). Per task contract, prior post-v717 measured
  evidence is relied upon; no live measurements were fabricated.

## (C) Accounting invariants

- [PRIOR-MEASURED] Recognition leg: **Dr1030 Sales Settlement Clearing
  Rp120,000 / Cr4000 Sales Revenue Rp120,000** (exactly one occurrence).
- [PRIOR-MEASURED] Money leg: **Dr1040 Cash on Hand Rp120,000 / Cr1030
  Rp120,000** (exactly one occurrence).
- [PRIOR-MEASURED] Sale-specific 1030 balance effect = **0**;
  1040 = **+Rp120,000 once**; 4000 = **+Rp120,000 once**; net
  **Dr1040 / Cr4000 Rp120,000**.
- [PRIOR-MEASURED] Policy C: `cogs` / `grossProfit` **unavailable** for this
  sale (no COGS posting path in U9 acceptance) — recorded as expected, not a
  defect.
- [PRIOR-MEASURED] No Dr5000, no Cr1100, no AP (2000) movement from this sale.

## (D) Reporting / read-model

- [PRIOR-MEASURED] Exactly **one Operating inflow** recorded.
- [PRIOR-MEASURED] Exactly **one business Sale** visible in the reader.
- [PRIOR-MEASURED] Dashboard **Revenue shows the sale exactly once**.
- [PRIOR-MEASURED] T5 classification: the new genuine Sale = **CLEARED**.

## (E) Negative evidence / forbidden side effects

- [PRIOR-MEASURED] Zero TreasuryReceipt, zero Payment, zero Settlement, zero
  Fulfillment, zero Inventory movement, zero Dr5000, zero Cr1100, zero AP
  side effects from the U9 acceptance transaction.
- [PRIOR-MEASURED] Protected financial fingerprint unchanged across the
  post-v717 redeploy reverification.
- [THIS-SESSION] This reconciliation session performed **zero** production
  operations: no writer invocation, no `clasp push`/`deploy`, no U10
  execution, no config/property writes, no Git mutation beyond reading.

## (F) Transitional Rp24,000 isolation

- [PRIOR-MEASURED] Global 1030 **Dr Rp24,000** arises **solely** from the
  transitional Sale (not from the genuine U9 sale).
- [PRIOR-MEASURED] Transitional Sale = **UNCLEARED**; genuine U9 Sale (SO-0003)
  = **CLEARED** — the two populations are disjoint and separately classified.
- [PRIOR-MEASURED] The genuine sale's 1030 net is 0; the Rp24,000 debit is
  therefore fully attributable to the transitional Sale.
- Disposition: `U10_TRANSITIONAL_24K_CLOSE` remains
  **READY_FOR_SEPARATE_AUTHORIZATION** (not executed here).

## (G) Production version context

- [PRIOR-MEASURED] Acceptance measured against production version **v717**;
  the post-v717 redeploy reverification reconfirmed every §B/§C/§D/§E/§F fact.
- [THIS-SESSION] Local repository HEAD recorded: `860f136`
  (`860f1365427b91582735da3a6481277284e3a617`) = "Sales UI U8B visual remedy:
  widen sales-entry dialog for 3-column contract"; parent `5a4a923` =
  "Sales UI U8B refinement: 3-column contract, previews, probes".
  Neither commit contains U9 acceptance evidence (see §I).

## (H) Specialist mutation count

- **Specialist mutation count for U9 acceptance = 0.** The acceptance itself
  required exactly one operator Save Transaction (recorded in §A) and no
  specialist-side production mutation.
- [THIS-SESSION] Reconciliation-session mutation count: production = **0**,
  deployments = **0**, Git commits = **0** (commit deferred to a separate
  numlock-commit delegation), files written = **1** (this document only).

## (I) Local Git evidence reconciliation [THIS-SESSION, MEASURED]

1. Object `3a17324` **does not exist** in the local object database:
   `git rev-parse --verify 3a17324` and `git rev-parse --verify 3a17324^{commit}`
   both fail `fatal: Needed a single revision`. The string `3a17324` appears
   nowhere in `.git/` (logs, refs, packed refs) nor anywhere in the working
   tree.
2. No ref or reflog entry contains the intended U9 acceptance commit under any
   hash: `git log --all --grep` finds no "first genuine" / "T11-11" message;
   U9-matching history is limited to `56ab5e9` (sales-v2-u9 manifest/preflight),
   `d8e2568` (U9R preflight reconciliation), `dc7db0e` (U9B production
   preparation). Reflog (`git log -g`) shows no U9 acceptance commit; reflog
   matches for "U9" are exactly the U9R and U9B entries.
3. `docs/T11-11-U9-FIRST-REAL-TRANSACTION-ACCEPTANCE.md` did **not** exist
   before this session: not on disk, not tracked (`git ls-files` empty), and
   never present in any commit (`git log --all -- <path>` empty).
4. No equivalent acceptance document exists under another path: the two U9
   siblings (`docs/SALES-RECOGNITION-V2-U9-PREFLIGHT-RECONCILIATION.md`,
   `docs/SALES-RECOGNITION-V2-U9-PRODUCTION-PREPARATION.md`) cover
   preflight/preparation only; `docs/SALES-RECOGNITION-V2-U10-ACTIVATION-FIRST-EVENT.md`
   covers the U10 operator-surface thread, not this acceptance.
5. History around the origin references: `5a4a923` (13 files, +663/−90,
   2026-10-14 01:37 +0700) and `860f136` (4 files, +18/−6, 2026-10-14 03:46
   +0700) are Sales UI U8B commits; neither adds U9 evidence files.
6. **Factual explanation for invalid `3a17324`:** the object is absent from the
   local object database entirely — not merely unreferenced — so it was never
   created in this repository, and no reflog/amend trace exists. Whether the
   reported hash originated from an aborted/never-executed commit, a different
   repository state, or an external session cannot be determined from local
   forensics: **not determinable beyond "object never existed locally"**.
   Consequence: the U9 acceptance evidence was completed in production but
   never committed locally; this document is its first local record.

## (J) Telemetry [THIS-SESSION]

agent numlock-heavy (executed in-session as primary), backend/model
`9router/numlock-explore-free`, reasoning high, fallback not used, delegation
none, toolcalls measured: ~24 (bash/glob/grep/read/write combined), elapsed
UNKNOWN (not instrumented), files read: 2 sibling U9 docs + `.git/logs` refs
(forensics), files modified: this document only, test runs: 0 (Markdown-only
change; no app regression required).

U9 FIRST GENUINE TRANSACTION ACCEPTANCE: PASS / CLOSED
