# beHuman — Guide for AI agents

> Read this before touching the code. This file encapsulates context that lives in the
> **Obsidian vault** (sibling repo `obsidian-vault-zk`, at `../obsidian-vault-zk/`).
>
> Repo: **[behuman-org/human-zk](https://github.com/behuman-org/human-zk)** · Hackathon:
> **[Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail)**.

## What beHuman is

A **three-layer** project:
- **LAYER 1 · Identity (KYC-ZK):** *proof of personhood*. A person proves they are **real and
  unique** without revealing PII on-chain; a Soroban contract verifies and registers them. Exposes the
  bridge **`is_verified(address)`** (Stellar wallet, not platform identity).
- **LAYER 2 · Opinion platform:** verified humans publish with **`platformId`**
  (stable pseudonym derived from the ZK secret, Groth16 proof `post.circom`), without exposing PII,
  with curation (Claude agent + human moderation) and authenticated API (Bearer HMAC).
- **LAYER 3 · ZK Funding:** anonymous, conditional crowdfunding (`campaign_controller` contract,
  `funding_opinion` circuit). **Today dev mode only** (in-memory demo); real
  DeFindex/Trustless Work integration blocked at API startup.

## ⚠️ Before writing code (Stellar rule)

1. **Read `skills.stellar.org`** — especially the **zk-proofs** skill (Groth16 verification
   with **BLS12-381** / Poseidon). Dramatically improves the code.
2. Use installed skills (`stellar-dev-skill`, `openzeppelin-skills`) and `llms.txt`
   (https://developers.stellar.org/llms.txt) as context.
3. Follow stellar-dev-skill security patterns and OpenZeppelin detectors
   for anything touching the contract.

## Decisions already made (do not reopen without notice)

- **ZK toolchain: Circom + Groth16 on BLS12-381** (`--prime bls12381`; official verifier
  from `soroban-examples`). Plan B: Noir/UltraHonk.
- **Single monorepo** (this repo). Docs separate in the Obsidian vault.
- Working name: **human**. GitHub org: **behuman-org**.

## Structure (by layer)

| Folder | Layer | What it is |
|---|---|---|
| `identity/circuits/` | 1 | Circom circuit (`kyc.circom`) |
| `identity/contracts/kyc_verifier/` | 1 | Soroban (`verify_and_register`, `update_root`, `is_verified`) ← **Layer 1 bridge** |
| `identity/issuer/` | 1 | **Mock** KYC issuer (TS) — Merkle-only attestation (no EdDSA) |
| `platform/contracts/opinion_board/` | 2 | Soroban: `register_identity` + `post` with ZK proof (`platformId`) |
| `platform/api/` | 2 | Authenticated backend: feed, posts, articles, curation |
| `platform/curation/` | 2 | Claude agent + human moderation queue |
| `funding/contracts/campaign_controller/` | 3 | Soroban: conditional escrow (init with admin auth) |
| `funding/api/` | 3 | Funding backend — **only `FUNDING_PROVIDER=dev`** operational |
| `packages/sdk/` | — | Prover + Stellar tx orchestration (TS, shared) |
| `packages/shared/` | — | Shared TS types (3 layers) |
| `web/` | — | **React + Vite + TS** frontend (single) |
| `scripts/` · `docs/` | — | Deploy/e2e · bridge to the vault |

> Rust contracts (3 layers) are members of the **root Cargo workspace** (`/Cargo.toml`):
> `stellar contract build` compiles them all.
> **Layer 1:** `is_verified(address)` + global nullifier `Poseidon(secret)` (real anti-Sybil).
> **Layer 2:** identity = ZK `platformId` (`register_identity` / `post` with proof); the wallet
> only signs Layer 1 txs. Hybrid content (on-chain anchor + off-chain in `api`).

## Where things live in the vault (design source of truth)

- `IDEA`, `Prueba de Persona Única` — the vision.
- `Flujo de KYC` — the 4 phases (issuance → proof → verification → consumption).
- `Diseño del Circuito ZK` — inputs/outputs, commitment, nullifier, risks.
- `Contrato Verificador (Soroban)` — the on-chain interface.
- `Modelo de Datos` — credential and storage.
- `09 - Tools/*` — resources, AI skills, reference verifiers, **AI build plan**.

## Status

**Functional MVP on testnet/demo** — not real regulated KYC: the issuer is a **mock**
(state this). Layers 1 and 2 operational with recent security hardening. Layer 3 funding:
contract + circuit + UI in **dev-only** mode; real DeFindex/TW integration **not wired**.

## Conventions

- Commits: conventional (`feat:`, `fix:`, `chore:`…).
- Mandatory human review of crypto (nullifier, address binding, issuer root).
- Secrets in `.env` (see `.env.example`); never commit PII or keys.
