# LAYER 3 — Security audit (Red Team / Blue Team)

Adversarial exercise on the **ZK Funding** integration (`ground-funding` branch). Red
Team attempted to violate invariants; Blue Team fixed each finding. Independent verification:
`cargo test` (14), 3 clean TS builds, and e2e exploit tests (now fail as expected).

Invariants: **I1** Anonymity/zero PII · **I2** Anti-Sybil · **I3** Non-custody ·
**I4** Opinion binding · **I5** Membership gate.

| ID | Sev | Invariant | Finding | Fix |
|----|-----|-----------|----------|-----|
| RT-01 | Critical | I3 | API validated "2-of-3" by comparing **public addresses** (in `GET /campaigns`) as if they were credentials → anyone could trigger `release`/`approve`/`refund`. | Cryptographic auth: each signer signs a **deterministic challenge** (Ed25519 Stellar); API verifies signature (`packages/sdk/fundingAuth.ts`). Signers = real keypairs. Ultimate authority = on-chain contract. |
| RT-02 | Critical | I2,I4 | Dev fallback took `platformId`/`nullifier` from **body without proof** → unlimited sentiment Sybil. | Fallback removed. All modes require valid `opinionProof`; identity/nullifier come only from `bindFundingOpinion` + verification. |
| RT-03 | High | I3 | Contract `init` without `require_auth` → config front-run. | `init(admin, …)` with `admin.require_auth()` and admin ∈ signers. |
| RT-04 | High | I3 | `donate`/`release` without deadline check → trapped refunds / late release. | Contract and API: `donate` rejects after deadline; success = goal **before** deadline; `release` requires `timestamp <= deadline`. |
| RT-05 | High | I1,I5 | Membership not bound to wallet; `/position` filtered amounts by wallet without auth. | `verifyMembership` crypto in all modes; ephemeral wallet **per donation**; `/position` requires ownership signature. Membership↔wallet binding at circuit level: documented as limitation (trusted platform circuit not modified). |
| RT-06 | Medium | I2,I3 | TOCTOU in JSON store → double nullifier / lost update. | `withStore()` serializes mutations; `claimNullifier()` atomic insert-if-absent. |
| RT-07 | Medium | — | Async handlers without try/catch → crash/DoS in real mode. | `wrap()` + error middleware; provider failures → controlled **502**. |
| RT-08 | Medium | I2 | Curation fail-open hid and discounted votes (censorship/integrity). | Anti-Sybil count persists **independently** of curator; moderation only affects visibility. |
| RT-09 | Medium | I3 | Refund returned principal+yield and **deleted** donations (double refund / inauditable). | Returns **exactly principal**; idempotent `refunded` mark; no `disputed` shortcut. |
| RT-10 | Low | I4 | `contentHashSq` was dead constraint (real binding from public input). | Removed from circuit (recompiled); documented that binding comes from public input status. |
| RT-11 | Low | I1 | `strToField` without domain separation in `contentHash`. | `"funding-content:"` prefix (SDK + web, mirror); 2-bit masking documented as intentional. |

## Positive note
The `campaign_controller` contract was already solid: `verify_signers` requires `require_auth` per
signer, rejects non-signers/duplicates, and `refund` is reentrancy-safe (zeros contribution before
transfer). The serious problem (RT-01) was that **the API did not use the contract** and
reimplemented rules with strings.

## Known limitation (mitigated)
The donation **personhood proof** is not bound to `donorWallet` at circuit level
(would require modifying the trusted platform circuit, out of scope). Mitigated with:
cryptographic membership verification, ephemeral wallet per donation, and authenticated `/position`.
Pending for on-chain integration (vault Manager).

## Remediation verification
- `cargo test -p campaign_controller`: **14 passed**. `stellar contract build`: OK.
- Builds `@behuman/sdk`, `@behuman/funding-api`, `@behuman/web`: clean.
- Exploit e2e (separate instance): approve/release without signature → **403**; opinion without
  proof → **403**; proof reused with different content → **403**; donate without membership →
  **403**; valid paths → **200**.
