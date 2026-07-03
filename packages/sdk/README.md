# @behuman/sdk · Client / Prover

Shared logic orchestrating the user-side flow:
**credential → generates ZK proof (in browser, WASM) → builds and sends Stellar tx**.
Consumed by `web/` frontend and demo scripts.

> 📐 See `Flujo de KYC` (Phases 2 and 3) in the vault. ZK `secret` never leaves the device;
> gate PII goes to mock issuer (not on-chain).

## API (Layer 1 · KYC)

| Function | What it does |
|---|---|
| `generateProof(credential, address)` | Witness + Groth16 BLS12-381 proof (`kyc.circom`). |
| `nullifierField(secret)` | `Poseidon(secret)` — global anti-Sybil nullifier. |
| `addressHashField(address)` | Address hash for binding (public input). |
| `verifyProofLocally(gen, vk)` | Off-chain sanity check with snarkjs. |
| `encodeVerificationKey(vk)` | snarkjs VK → Soroban ScVal. |
| `initVerifier(cfg, signerSecret, issuerRoot, vk)` | Contract `init` tx. |
| `buildVerifyArgs(address, gen)` | ScVal for `verify_and_register`. |
| `verifyAndRegister(cfg, signerSecret, gen)` | Signs and sends on-chain registration. |
| `isVerified(cfg, address)` | Queries `is_verified` via simulation. |
| `encodeProof(proof)` / `fieldTo32` / `g1ToBytes` / `g2ToBytes` | BLS12-381 encoding for Soroban. |

Constant: `PUBLIC_SIGNALS_ORDER = ["commitment", "nullifier", "issuerRoot", "addressHash"]`.

## API (Layer 3 · Funding)

| Module | What it does |
|---|---|
| `fundingOpinion.ts` | `generateFundingOpinionProof`, `verifyFundingOpinionProof`, scope/nullifier binding. |
| `defindex.ts` / `trustlesswork.ts` | Real/dev clients (only dev operational in API today). |
| `fundingAuth.ts` | Validator action signatures (2-of-3 release). |

## Stack

- `snarkjs` + Circom WASM (`--prime bls12381`).
- `@stellar/stellar-sdk` for Soroban transactions.

```bash
npm install
npm run build
```
