# Layer 1 — KYC-ZK Identity (ID + selfie matcher)

> Vault bridge: `06 - Implementacion/Spec — Matcher DNI + Selfie (Capa 1)`,
> `05 - Arquitectura/Matcher de Identidad (Gate de Capa 1)`, `Flujo de KYC`,
> `KYC-Identidad/` folder.

## What it does

A person proves they are **real and unique** without revealing who they are:

1. **Gate (testnet):** upload ID photo + scan face with the camera. The backend runs
   **1:1 face match** (ID ↔ camera) + **liveness** (challenge). Only if it passes, continue.
2. **Issuer:** creates Layer 1 identity (commitment in a Merkle tree of verified humans),
   with **anti-Sybil de-dup** by document hash. Discards PII.
3. **ZK proof:** the device generates the Groth16 proof (BLS12-381) — PII/secret never leaves.
4. **On-chain:** `verify_and_register` on `kyc_verifier` (Soroban) → `Verified(address)` +
   nullifier (anti double registration). dApps query `is_verified(address)`.

```
[web] consent + ID + face  →  [issuer/matcher] gate  →  [issuer] identity + tree
                                                       →  [sdk] ZK proof
                                                       →  [kyc_verifier] Verified(address)
```

## Privacy guarantees (Law 25.326)

- **Zero PII on-chain**: only commitment / proof / nullifier / issuerRoot / predicates.
- Images are **ephemeral** (in memory, never to disk), **never** in logs.
- De-dup stores **only** `sha256(docId + pepper)`, never the document.
- Explicit consent before capture.

## Scope and mocks (testnet)

- **Demo matcher** (face-api), **not** RENAPER. Does not validate document authenticity
  or run AML. Liveness = active challenge, **not** iBeta-certified PAD.
- Provider is **swappable by config** (`IDENTITY_PROVIDER`): `testnet` (today),
  `dev` (tests/e2e only, approves without biometrics), `renaper` (production stub). Switching
  providers **does not touch** issuer or the ZK layer.
- **BLS12-381 curve** (not BN254): the official Groth16 verifier uses
  BLS12-381 host functions (CAP-0059). Details in `identity/circuits/README.md` and the contract README.
- `trusted_root` is fixed at `init`: e2e deploys one contract per demo. Multi-user
  incremental root is future work.

## Decisions (documented defaults)

| Decision | Default |
|---|---|
| Match threshold | `MATCH_THRESHOLD=0.6` (face-api Euclidean distance; calibrate) |
| Secret | **user-side / non-custodial** (issuer never sees it) |
| Liveness | active challenge (blink/turn) + anti-static-photo |
| Backend | Node/TypeScript (face-api + tfjs-node) |

## Run everything

```bash
npm install
npm run download-models -w @behuman/issuer

# circuit (once)
cd identity/circuits && npm install && bash scripts/compile.sh && POWER=13 bash scripts/setup.sh && cd ../..

# gate + UI
npm run serve -w @behuman/issuer      # backend on :8787
npm run dev   -w @behuman/web         # frontend (camera) on :5173

# on-chain e2e (deploy + register + verify on testnet, via SDK in Node)
bash scripts/e2e_demo.sh
```

## On-chain registration from the FRONTEND (wallet + ZK proof in the browser)

The frontend generates the proof in the browser, connects a wallet (Stellar Wallets Kit), calls
`verify_and_register` and shows `is_verified == true`.

Requirements: a wallet (Freighter/xBull/LOBSTR) on **testnet** and **funded** (friendbot).

```bash
# 1) compiled circuit + trusted setup (once)
(cd identity/circuits && npm install && bash scripts/compile.sh && POWER=13 bash scripts/setup.sh)

# 2) matcher models (once)
npm run download-models -w @behuman/issuer

# 3) deploy a FRESH contract (no init: frontend initializes) and reset issuer
rm -f identity/issuer/.issuer-state.json
bash scripts/deploy_testnet.sh          # prints KYC_VERIFIER_CONTRACT_ID

# 4) put that id in .env (frontend reads it via envDir=root)
#    VITE_KYC_VERIFIER_CONTRACT_ID=<id>

# 5) start backend + frontend
npm run serve -w @behuman/issuer        # :8787
npm run dev   -w @behuman/web           # :5173  (copies artifacts to web/public/circuits)
```

In the browser: connect wallet → consent → ID photo → data → face scan.
The frontend: computes commitment, enrolls (gate + de-dup), generates ZK proof, initializes the
contract with `issuerRoot` and signs `verify_and_register`; finally shows
`is_verified(address) == true` + link to the tx.

> ⚠️ **Fixed root at `init`** (contract is immutable): each demo uses its own contract.
> The first user initializes the contract with their root; for another person, deploy another.
> Evolution (not in this batch): incremental root / admin update function.

### Anti-Sybil — two locks (both visible from the frontend)
1. **Document de-dup** (off-chain, issuer): `sha256(docId + DEDUP_PEPPER)` — document number
   is not stored. Retry with the same document → "this document was already validated".
2. **On-chain nullifier** (`verify_and_register`): resubmitting the same proof → rejection
   `NullifierAlreadyUsed` ("test nullifier lock" button on the final screen).

### Deployed contracts (testnet)
- e2e (SDK, init included): `CBRBOJRALKORUSHKCHPUBA3DBTYKGLYONHNJVC4MUXHZ46EOWMZQOY34`
- frontend demo (fresh deploy, init from frontend): `CAMOAESW7NUT5EZAFNX7UF74H5HHLLWLY5TCQJF3CPWR6YZLIL7T6IBI`

> Note: the on-chain flow (init + verify_and_register + is_verified) is end-to-end tested on
> testnet via `scripts/e2e_demo.sh`. BLS encoding and browser addressHash mirror the validated SDK;
> wallet signing and browser proof are verified manually from the frontend.

## Tests

```bash
npm test -w @behuman/issuer   # gate (match/liveness) + enroll/de-dup
npm test -w @behuman/sdk      # poseidon/merkle/encoding/off-chain proof
cargo test -p kyc_verifier    # contract (pairing + registration)
```

## Acceptance criteria

- Matching ID + face → identity created and `Verified(address)` on testnet.
- Different face → rejection (no identity created).
- Static photo → rejected by liveness.
- Second attempt by the same person → rejected (de-dup + nullifier).
- Zero PII in logs and on-chain.
- Provider swappable by config.
