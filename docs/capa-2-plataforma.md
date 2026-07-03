# LAYER 2 — Opinion platform (anonymous via ZK)

> Vault: `Plataforma de Opinión Verificada`, `Identidad Pública vs Anónima`,
> `Diseño del Circuito ZK`, `Decisiones técnicas y trade-offs`, `Stack de Privacidad en Stellar`.

## What it does

A verified human (Layer 1) participates on the platform **without revealing anything** about their
real identity or KYC address:

1. **Anonymous identity**: registers `platformId = Poseidon(secret, scope)` by proving with ZK
   that their commitment belongs to the issuer tree (`issuerRoot`). It is their persistent
   pseudonym, unique per human, **uncorrelatable** with address/PII.
2. **Profile + username**: free username (mutable), off-chain in `platform/api`, keyed by
   `platformId`. Public **handle** = last 5 characters of `platformId`.
3. **Post**: publishes an opinion gated by a ZK proof binding `(issuerRoot, platformId,
   contentHash)`; content off-chain + on-chain anchor under `platformId`.
4. **Feed**: list of posts by pseudonym.

## ZK invariants (non-negotiable) — how they are enforced

| Invariant | Implementation |
|---|---|
| KYC address is never used/revealed | Identity is `platformId` (from secret). Contract has no `Address`. Fee is paid by an **ephemeral account** (friendbot), not the KYC wallet. |
| Identity = `Poseidon(secret, scope)` | `platformId` is circuit output; deterministic, unique per human, one-way. |
| Gate by membership (not `is_verified`) | Circuit proves Merkle inclusion of commitment under `issuerRoot`; contract requires trusted `issuerRoot`. Reuses device `Capa1Credential`. |
| Post binds `contentHash` (anti-replay) | `contentHash` is public input bound in the circuit; contract rejects repeated `(platformId, contentHash)`. |
| Fee payer ≠ KYC address | Random ephemeral account funded by friendbot signs txs. |

**Anti-Sybil**: `register_identity` rejects an already registered `platformId` (same human →
same `platformId`).

## Architecture

```
[web/platform] Layer 1 credential (localStorage)
   -> platformId + ZK proof (post.circom, in browser)
   -> ephemeral account (friendbot)  -> opinion_board.register_identity / post
   -> platform/api (username + off-chain content, keyed by platformId)
```

- `platform/circuits/src/post.circom` (BLS12-381): Merkle inclusion + `platformId` + binding
  of `contentHash`. Reuses templates from `identity/circuits` (same curve).
- `platform/contracts/opinion_board`: verifies Groth16 (same pattern as `kyc_verifier`),
  stores trusted `issuerRoot`, and anchors `PostRecord { platform_id, content_hash, timestamp }`.
- `platform/api`: profile + content + feed (JSON store, zero PII/address).
- `web/src/platform`: browser proofs (snarkjs) + ephemeral account + local signing.

## Linking impossibility

`post ↔ KYC address ↔ PII` is cryptographically impossible:
- `platformId = Poseidon(secret, scope)` is one-way (cannot invert to `secret`).
- `secret` never leaves the device; on-chain only `platformId / contentHash / proof`.
- Fee payer is a random ephemeral account, unrelated to the KYC address.

## Deployed contracts (testnet)
- opinion_board (e2e, init included): `CD2XVZTQTQZL3LU4E6PH7EXDGV2VX6KNAN2L3TROKJAR6U45SC2K2T6M`
- opinion_board (frontend demo, init from frontend): `CAZOMMMZSKI2EHH6PHP53NJ3K4DGAJ4JBRAR4HPVNN2QJ4VIF7WJKOQK`

> ⚠️ `trusted_issuer_root` is fixed at `init` (one contract per demo; same limit as Layer 1).

## Reproduce

```bash
# platform circuit (once)
(cd platform/circuits && npm install && bash scripts/compile.sh && POWER=13 bash scripts/setup.sh)

# on-chain via SDK (deploy + init + register + post) — tested: post under platformId
bash scripts/deploy_platform.sh
CONTRACT_ID=<id> SIGNER_SECRET=<ephemeral secret> RPC_URL=https://soroban-testnet.stellar.org \
  NETWORK_PASSPHRASE="Test SDF Network ; September 2015" npx tsx scripts/e2e-platform.ts

# demo from FRONTEND:
bash scripts/deploy_platform.sh            # -> VITE_OPINION_BOARD_CONTRACT_ID=<id> in .env
npm run serve -w @behuman/api              # :8788
npm run dev   -w @behuman/web              # :5173 -> "Anonymous opinion platform"
```

Frontend requirement: have a `Capa1Credential` on the device (complete Layer 1 validation first).

## Tests
```bash
cargo test -p opinion_board   # 9/9 (verify, register, anti-Sybil, post, anti-replay, init)
```
`platform/circuits` proves with snarkjs; `vite build` bundles the frontend.

## Next step (not in this iteration)
- **Curation** (`platform/curation`): validator agents + moderation.
- Username uniqueness, public mode (opt-in), verified-only reading.
