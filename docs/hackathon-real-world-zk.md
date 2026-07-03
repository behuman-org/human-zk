# Stellar Hacks: Real-World ZK — presentation guide

> Hackathon: [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) (DoraHacks)  
> Repo: **[github.com/behuman-org/human-zk](https://github.com/behuman-org/human-zk)**  
> Focus: **identity proofs** — proof of personhood with ZK verified on-chain in Soroban.

Presentation guide for the **ZK Real-World** hackathon (`human-zk` + honest README).

---

## What we present (one-line pitch)

**human** demonstrates that a person is real and unique without revealing PII: Groth16 proof (Circom,
**BLS12-381** curve) verified in the `kyc_verifier` contract, bridge `is_verified(address)`,
and opinion platform with anonymous `platformId` identity (`post.circom` circuit).

ZK is **load-bearing**: without the proof there is no on-chain registration or anonymous publishing.

---

## Hackathon requirements vs. our repo

| Requirement | Status | Notes |
|-----------|--------|-------|
| Open-source repo + clear README | ✅ | `README.md`, `CLAUDE.md`, `docs/` |
| 2–3 min demo video | ⬜ | Record flow: KYC → `is_verified` → post with `platformId` |
| ZK integrated in Stellar | ✅ | `verify_and_register` + `opinion_board` on testnet |
| ZK load-bearing | ✅ | Groth16 on-chain; not decorative |
| Honesty about mocks | ✅ | Mock biometric issuer; funding dev-only; state in README |

---

## ZK stack (for judges)

- **Toolchain:** Circom 2 + Groth16, **BLS12-381** curve (`--prime bls12381`)
- **On-chain verifier:** official `groth16_verifier` (CAP-0059 host functions)
- **Primitives:** Poseidon (Merkle, commitment, global nullifier `Poseidon(secret)`)
- **Layer 1:** `identity/circuits/kyc.circom` → `kyc_verifier`
- **Layer 2:** `platform/circuits/post.circom` → `opinion_board`

> We do not use native BN254 from Protocol 25/26; we chose BLS12-381 for compatibility with the
> reference Soroban verifier. Documented in `identity/circuits/README.md`.

---

## Testnet contracts (demo reference)

Update after each redeploy. See `identity/AGENTS.md` and `docs/capa-2-plataforma.md`.

| Contract | Use |
|----------|-----|
| `kyc_verifier` | `verify_and_register`, `is_verified` |
| `opinion_board` | `register_identity`, `post` with proof |

---

## Pre-submit checklist (DoraHacks)

- [ ] Public repo with README updated for **Stellar Hacks: Real-World ZK**
- [ ] Demo video uploaded (YouTube/Loom) — link in README
- [ ] Complete `.env.example`; no secrets in repo
- [ ] `web/public/circuits/*` committed or build script documented
- [ ] Declare: mock issuer, remote vs local matcher, funding `dev` only
- [ ] Link to demo frontend (Vercel) if applicable
- [ ] BUIDL on DoraHacks with repo + video

---

## Recommended demo (~2 min script)

1. Landing → "Verify you're human" (Layer 1).
2. Testnet wallet → ID + face → browser proof → tx `verify_and_register`.
3. Stellar Expert: `is_verified == true`.
4. Enter `/app` → register `platformId` → publish opinion (on-chain anchor + feed).
5. Mention global nullifier anti-Sybil and that KYC wallet does not appear in the post.

---

## Useful links

- [Hackathon detail](https://dorahacks.io/hackathon/stellar-hacks-zk/detail)
- [Stellar ZK skills](https://skills.stellar.org) — zk-proofs
- [Stellar LLMs](https://developers.stellar.org/llms.txt)
