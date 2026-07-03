# LAYER 1 · KYC-ZK — Handoff for devs and agents

> Living doc to **continue the KYC part** (proof of personhood) without losing context.
> If you touch KYC, read this first. Complements root `CLAUDE.md` and `identity/README.md`.
> ⚠️ **The repo is public**: do NOT commit tokens, keys, or PII. Credentials are with the
> owner (see "Credentials and deploy").

---

## 1. What LAYER 1 does (at a glance)

A person proves they are **real and unique** without revealing PII, and gets registered on-chain
**anonymously**. The bridge to the rest of the product is `is_verified(address)`.

**End-to-end flow (orchestrated by the frontend, `web/src/kyc/KycFlow.tsx`):**

1. **Connect wallet** (`wallet.ts`, Stellar Wallets Kit) — Freighter/xBull/LOBSTR. The wallet
   is NOT platform identity (that is derived separately, for anonymity).
2. **ID photo** (`DocumentUpload.tsx` → `POST /document`) — matcher validates it is a
   document (OCR keywords) and has a **face**.
3. **Manual data** (`Attributes.tsx` → `POST /verify-data`) — year, doc number, country. Matcher
   **cross-checks** data against OCR. ⚠️ This check is **SOFT SIGNAL, does NOT block** (see §4).
4. **Face scan** (`FaceScan.tsx`, 12 frames → `POST /enroll`) — matcher runs the
   **real gate**: ID↔selfie facial match + liveness. If it passes, issuer adds the
   `commitment` (Poseidon, generated on device) to the **Merkle tree** and returns `issuerRoot`
   + path. PII (images, declared data) **travels to mock matcher** over HTTPS; processed
   in memory and **not persisted or sent on-chain**. ZK `secret` stays on device.
5. **Browser ZK proof** (`zk.ts`, snarkjs + `web/public/circuits/kyc.{wasm,zkey}`):
   proves tree membership + **global nullifier** `Poseidon(secret)` + address binding
   (`addressHash`) + attributes (adult, country).
6. **On-chain** (`chain.ts`): `initIfNeeded` (initializes contract with `issuerRoot` if needed)
   → `verify_and_register(address, proof, public_inputs)`. After confirm,
   `is_verified(address) == true`.

**Platform identity (Layer 2)** is derived from the **credential stored on device**
(`credentialStore.ts`, localStorage `behuman.cred.*`), NOT from the wallet. Without that credential =
guest. (So if you change browser/device, onboarding must be redone.)

---

## 2. File map

**Frontend (`web/src/`):**
- `kyc/KycFlow.tsx` — orchestrator of 4 steps + states.
- `kyc/DocumentUpload.tsx`, `Attributes.tsx`, `FaceScan.tsx`, `Consent.tsx`, `Status.tsx` — UI.
- `kyc/api.ts` — matcher client (`VITE_MATCHER_URL`): `/document`, `/verify-data`, `/verify`, `/enroll`.
- `kyc/chain.ts` — `kyc_verifier` contract invocation (wallet signing). `invoke()` retries on `txBadSeq`.
- `kyc/wallet.ts` — connect/sign (Stellar Wallets Kit).
- `kyc/zk.ts`, `bls.ts` — Groth16 proof generation (snarkjs) + BLS12-381 encoding.
- `kyc/credentialStore.ts` — local Layer 1 credential persistence (never leaves browser).
- `identity/identity.ts` — `connectAndCheck`, `derivePlatformIdentity` (Layer1→Layer2 bridge).
- `pages/OnboardingPage.tsx`, `pages/AuthPage.tsx` — flow entry points.

**Matcher / issuer (`identity/issuer/`):** gate backend. Stack: Express + `@tensorflow/tfjs-node`
(face-api) + `tesseract.js` (OCR) + `sharp` (resize).
- `matcher/server.ts` — endpoints + payload validation (`parseDeclared`) + PII-free logs.
- `matcher/documentCheck.ts` — OCR + data cross-check (`crossCheckData`/`validateDocumentData`). **See §4.**
- `matcher/faceEngine.ts` — `loadModels`, `detectFace`, `fitImage` (downscale), `faceDistance`.
- `matcher/testnetProvider.ts` — gate: 1:1 match + liveness. `liveness.ts` — liveness heuristic.
- `src/index.ts` — `enrollVerifiedHuman`: gate + anti-Sybil de-dup (docId hash+pepper) + Merkle tree.

**Contract (`identity/contracts/kyc_verifier/src/lib.rs`):** Soroban/Rust.
- `init(admin, trusted_issuer_root, vk)` — requires `admin.require_auth()`.
- `update_root(new_root)` — authenticated admin; enables multi-user without re-deploy.
- `verify_and_register(...)`, `is_verified(address)`.
- **Global** nullifier: `Poseidon(secret)` — one person = one on-chain registration (not N wallets).
- `extend_ttl` on persistent writes (`Verified`, `Nullifier`).
- Errors: 1=UntrustedIssuer, 2=AddressMismatch, 3=NullifierAlreadyUsed, 4=InvalidProof,
  5=AlreadyInitialized, 6=NotInitialized.

**Circuit (`identity/circuits/`):** Circom (`kyc.circom`) + Poseidon helpers. Artifacts
served to frontend are **committed** in `web/public/circuits/`. Poseidon
(`identity/circuits/build/poseidon{2,3}_js/`) are gitignored (see §3, HF gotcha).

---

## 3. Credentials and deploy (real infra)

See owner memory for detail; summary of **where each piece runs**:

| Piece | Where | How to redeploy |
|---|---|---|
| **Matcher** (KYC gate) | **Hugging Face Space** `MauricioHUMAN/human-matcher` (Docker, 16GB free) → `https://mauriciohuman-human-matcher.hf.space` | See gotcha below |
| `kyc_verifier` contract | Stellar **testnet**: `CB4Y7MEXFZYJY3YPSDJMPCSOAY7ADI2LK66EHG4FJ5FBXJDXYWF3UEUM` | `stellar contract build` + `stellar contract deploy` with `behuman-deployer` identity |
| Frontend | **Vercel** project `human-web` → `https://human-web-psi.vercel.app` | auto-deploy on push to `main`, or `vercel deploy --prod` from `web/` |

**Credentials (NOT in repo):** HF write token, Render API key, Upstash REST URL/token,
Pollar publishable key, and Stellar deployer key **are held by the owner (Mauricio)**. They are
in their local `.env` (gitignored, see `.env.example`) and respective dashboards. Request from
owner to deploy; never paste in code or commits.

**Frontend env vars (Vercel) relevant to KYC:** `VITE_MATCHER_URL`,
`VITE_KYC_VERIFIER_CONTRACT_ID`, `VITE_STELLAR_RPC_URL`, `VITE_STELLAR_NETWORK_PASSPHRASE`,
`VITE_FRIENDBOT_URL`, `VITE_POLLAR_PUBLISHABLE_KEY`. (Full list in `.env.example`.)

**Matcher env vars (HF Space):** `IDENTITY_PROVIDER=testnet` (`dev` **forbidden** in prod),
`MATCH_THRESHOLD=0.6`, `OCR_MAX_DIM` (def 2000), `STRICT_DATA_CHECK=true` (default),
`DEDUP_PEPPER` (**required** in prod), `CORS_ORIGIN` (restrictive; not `*` in prod),
`RATE_LIMIT_*`, `ENROLL_SESSION_TTL_MS`, `UPSTASH_REDIS_REST_URL/TOKEN` (optional persistence),
`FACE_MODELS_PATH`.

### ⚠️ Critical gotcha: matcher deploys from `hf-space` branch, NOT from `main`
HF rejects binaries in git, so the Space is built from a **trimmed branch** (`hf-space`,
orphan: only `identity/issuer` + `packages/*`, with Poseidon `.wasm` in **base64** that the
Dockerfile decodes). To deploy a matcher change:
1. Make the change on `main` (and push to `main`).
2. `git checkout hf-space` → `git checkout main -- identity/issuer/matcher/<files>` → commit.
3. `git push <hf-space-remote-with-token> hf-space:main` (HF push run by owner with token).
4. HF rebuilds automatically. `git checkout main` to return.
> Dockerfile and Space README live on `hf-space` branch.

Other gotchas:
- **Render auto-deploy does NOT trigger alone** (GitHub webhook not connected) — other backends
  (platform/funding API) deploy manually via Render API.
- **tfjs tests (`match.test.ts`, `enroll.test.ts`) fail locally on Node 25** (tfjs-node binaries
  don't support Node 25). On Space (Node 20) they work. Pure tests run locally.

---

## 4. Decisions and invariants (do NOT break without notice)

- **The REAL personhood gate is ID↔selfie facial match + liveness** (`/enroll`).
  OCR (Tesseract) is a noisy testnet heuristic.
- **Data↔OCR cross-check (`/verify-data`)**: with `STRICT_DATA_CHECK=true` (default) any
  strong mismatch blocks; soft mode: `STRICT_DATA_CHECK=false`. **Fuzzy** matching
  (digit confusions, Levenshtein ≤1). Empty/illegible OCR is **never** mismatch alone.
- **Privacy**: PII goes to matcher over HTTPS, processed in memory (no disk or value logs);
  document number only for de-dup (`sha256(docId+DEDUP_PEPPER)`), never in clear.
  On-chain: commitment, nullifier, proof — never PII.
- **Global nullifier** `Poseidon(secret)`: real anti-Sybil (one person cannot register N wallets).
  **Address binding** via `addressHash` (public input) + `require_auth` on contract.
- **Issuer attestation = Merkle-only** (Poseidon). No EdDSA signature.
- **Anonymous identity decoupled from wallet** (`platformId` derived from device ZK credential).
  Do not link wallet ↔ on-chain identity.
- **Do not change circuit or contract** without coordinating (breaks proof/VK compatibility).
  If you change the circuit, regenerate and re-commit `web/public/circuits/*` and deploy a new
  contract (`trusted_root` and VK are fixed at `init`).
- Mandatory human review of crypto (nullifier, address binding, issuer root).

---

## 5. Run locally

```bash
npm install
cp .env.example .env            # fill VITE_MATCHER_URL=http://localhost:8787, etc.
npm run -w @behuman/issuer download-models   # download face-api models (once)
npm run -w @behuman/issuer serve             # matcher on :8787
npm run dev                                  # Vite frontend on :5173
# Contract: stellar contract build && scripts/deploy_testnet.sh
```
Pure matcher tests: `npx vitest run --root identity/issuer identity/issuer/matcher/__tests__/documentCheck.test.ts`

---

## 6. How to push to main (team workflow)

- Canonical repo is **[behuman-org/human-zk](https://github.com/behuman-org/human-zk)** — delivery for
  **Stellar Hacks: Real-World ZK**. Work **directly on
  `main`** with owner authorization (their GitHub credentials). Use conventional commits
  (`feat:`, `fix:`, `chore:`…). Agents close messages with
  `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Before push: `npm run -w web build` (typecheck) and pure matcher tests.
- After pushing matcher logic, **remember the `hf-space` branch gotcha** (§3) so the change
  reaches production Space — pushing to `main` alone does NOT redeploy the matcher.

## 7. Suggested next steps (KYC backlog)
- Real `renaper` provider (today `testnetProvider` is heuristic). Certified liveness.
- Real regulated KYC (replace mock issuer). Production trusted setup.
- Sync matcher HF Space after each change on `main` (gotcha §3).
