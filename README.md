# human

> **Zero-Knowledge KYC on Stellar** — *proof of personhood*: prove you are a real, **unique**
> person without revealing who you are. Product monorepo.
>
> Presented at **[Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail)** — identity proofs verified on-chain in Soroban.

human has **three layers**: **identity** (KYC-ZK), a verified **opinion platform**, and
**ZK funding** (anonymous crowdfunding). A person verifies their identity once
(off-chain with the mock issuer; PII never goes on-chain), obtains on-chain registration via
`is_verified(address)` and an anonymous **`platformId`** (ZK secret) to publish on Layer 2.

📚 **Documentation, design, and decisions live in the Obsidian vault** (sibling repo
`obsidian-vault-zk`). This repo is **code only**. See [`docs/`](./docs/README.md).

---

## 🗂️ Monorepo structure (by layer)

```text
human/
├── identity/                 # ── LAYER 1 · ZK KYC ──
│   ├── circuits/             #   Circom — kyc circuit (BLS12-381)
│   ├── contracts/            #   Soroban — kyc_verifier  ← is_verified(address)
│   └── issuer/               #   mock issuer (Merkle-only, no EdDSA)
│
├── platform/                 # ── LAYER 2 · Opinion platform ──
│   ├── contracts/            #   Soroban — opinion_board (platformId + proof)
│   ├── api/                  #   authenticated backend (Bearer) + curation
│   └── curation/             #   moderator agent (Groq) + human moderation
│
├── funding/                  # ── LAYER 3 · ZK Funding (dev-only today) ──
│   ├── circuits/             #   funding_opinion.circom
│   ├── contracts/            #   campaign_controller (Soroban)
│   └── api/                  #   demo backend (FUNDING_PROVIDER=dev)
│
├── packages/
│   ├── sdk/                  # client: ZK proof + Stellar tx (shared)
│   └── shared/               # shared TS types (3 layers)
│
├── web/                      # React + Vite + TypeScript (single frontend)
├── scripts/                  # deploy_testnet.sh, e2e_demo.sh
└── docs/                     # links to the Obsidian vault
```

| Layer | Folder | Stack |
|---|---|---|
| 1 · Identity | `identity/circuits` · `identity/contracts/kyc_verifier` · `identity/issuer` | Circom+Groth16 (BLS12-381) · Rust/Soroban · TS |
| 2 · Platform | `platform/contracts/opinion_board` · `platform/api` · `platform/curation` | Rust/Soroban · TS · TS + Groq API |
| 3 · Funding | `funding/contracts/campaign_controller` · `funding/api` · `funding/circuits` | Rust/Soroban · TS · Circom |
| Shared | `packages/sdk` · `packages/shared` · `web` | TypeScript · React+Vite |

> 🌉 **Layer 1 → wallet:** `is_verified(address)` after `verify_and_register` (global nullifier
> `Poseidon(secret)`). **Layer 2 → platform:** ZK `platformId` via `register_identity(proof,
> public_inputs)` and `post(proof, public_inputs)` — not gated by wallet address.

---

## 🚀 Quickstart

```bash
# Requirements: Node 20+, Rust + wasm32-unknown-unknown, Stellar CLI, circom + snarkjs
npm install                 # installs JS workspaces (web, issuer, packages/*)

npm run dev                 # starts the React frontend (web/)
make contracts-build        # compiles Soroban contracts (3 layers)
make circuit-compile        # compiles the Circom circuit
```

See available targets in the [`Makefile`](./Makefile).

---

## 🧱 Status

- [x] Monorepo structure (3 layers)
- [x] **LAYER 1** — `kyc.circom` circuit, `kyc_verifier` contract (`update_root`, global nullifier)
- [x] **LAYER 1** — Hardened mock issuer (rate limit, CORS, optional Upstash)
- [x] **LAYER 2** — `opinion_board` contract (ZK `platformId`) + authenticated API + curation
- [x] **LAYER 3** — Contract + circuit + API/web in **dev** mode (real integration blocked)
- [x] SDK + shared types (`packages/`)
- [x] React frontend with `/app/*` guard, encrypted storage, Pollar on-chain registration
- [x] Testnet deploy + E2E demo (`scripts/`)

> MVP/demo — mock issuer, demo trusted setup, real funding pending. See `CLAUDE.md`.

---

*Repo: [behuman-org/human-zk](https://github.com/behuman-org/human-zk) · Hackathon: [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) (identity proofs)*
