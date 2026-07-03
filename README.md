# human

> **KYC con Zero-Knowledge sobre Stellar** — *proof of personhood*: probás que sos una
> persona real y **única** sin revelar quién sos. Monorepo del producto.
>
> Presentado en **[Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail)** — identity proofs verificados on-chain en Soroban.

human tiene **tres capas**: **identidad** (KYC-ZK), **plataforma de opinión** verificada y
**funding** ZK (crowdfunding anónimo). Una persona verifica su identidad una vez
(off-chain con el issuer mock; la PII no va on-chain), obtiene registro on-chain vía
`is_verified(address)` y un **`platformId`** anónimo (secret ZK) para publicar en la Capa 2.

📚 **La documentación, diseño y decisiones viven en la vault de Obsidian** (repo hermano
`obsidian-vault-zk`). Este repo es **solo el código**. Ver [`docs/`](./docs/README.md).

---

## 🗂️ Estructura del monorepo (por capas)

```text
human/
├── identity/                 # ── CAPA 1 · KYC con ZK ──
│   ├── circuits/             #   Circom — circuito kyc (BLS12-381)
│   ├── contracts/            #   Soroban — kyc_verifier  ← is_verified(address)
│   └── issuer/               #   mock issuer (Merkle-only, sin EdDSA)
│
├── platform/                 # ── CAPA 2 · Plataforma de opinión ──
│   ├── contracts/            #   Soroban — opinion_board (platformId + proof)
│   ├── api/                  #   backend autenticado (Bearer) + curaduría
│   └── curation/             #   agente moderador (Groq) + moderación humana
│
├── funding/                  # ── CAPA 3 · Funding ZK (dev-only hoy) ──
│   ├── circuits/             #   funding_opinion.circom
│   ├── contracts/            #   campaign_controller (Soroban)
│   └── api/                  #   backend demo (FUNDING_PROVIDER=dev)
│
├── packages/
│   ├── sdk/                  # cliente: prueba ZK + tx Stellar (compartido)
│   └── shared/               # tipos TS compartidos (3 capas)
│
├── web/                      # React + Vite + TypeScript (frontend único)
├── scripts/                  # deploy_testnet.sh, e2e_demo.sh
└── docs/                     # enlaza a la vault de Obsidian
```

| Capa | Carpeta | Stack |
|---|---|---|
| 1 · Identidad | `identity/circuits` · `identity/contracts/kyc_verifier` · `identity/issuer` | Circom+Groth16 (BLS12-381) · Rust/Soroban · TS |
| 2 · Plataforma | `platform/contracts/opinion_board` · `platform/api` · `platform/curation` | Rust/Soroban · TS · TS + Groq API |
| 3 · Funding | `funding/contracts/campaign_controller` · `funding/api` · `funding/circuits` | Rust/Soroban · TS · Circom |
| Compartido | `packages/sdk` · `packages/shared` · `web` | TypeScript · React+Vite |

> 🌉 **Capa 1 → wallet:** `is_verified(address)` tras `verify_and_register` (nullifier global
> `Poseidon(secret)`). **Capa 2 → plataforma:** `platformId` ZK vía `register_identity(proof,
> public_inputs)` y `post(proof, public_inputs)` — no gatea por address de wallet.

---

## 🚀 Quickstart

```bash
# Requisitos: Node 20+, Rust + wasm32-unknown-unknown, Stellar CLI, circom + snarkjs
npm install                 # instala los workspaces JS (web, issuer, packages/*)

npm run dev                 # levanta el frontend React (web/)
make contracts-build        # compila los contratos Soroban (3 capas)
make circuit-compile        # compila el circuito Circom
```

Ver targets disponibles en el [`Makefile`](./Makefile).

---

## 🧱 Estado

- [x] Estructura del monorepo (3 capas)
- [x] **CAPA 1** — Circuito `kyc.circom`, contrato `kyc_verifier` (`update_root`, nullifier global)
- [x] **CAPA 1** — Issuer mock endurecido (rate limit, CORS, Upstash opcional)
- [x] **CAPA 2** — Contrato `opinion_board` (ZK `platformId`) + API autenticada + curaduría
- [x] **CAPA 3** — Contrato + circuito + API/web en modo **dev** (integración real bloqueada)
- [x] SDK + tipos compartidos (`packages/`)
- [x] Frontend React con guard `/app/*`, storage cifrado, registro on-chain Pollar
- [x] Deploy testnet + demo E2E (`scripts/`)

> MVP/demo — issuer mock, trusted setup de demo, funding real pendiente. Ver `CLAUDE.md`.

---

*Repo: [behuman-org/human-zk](https://github.com/behuman-org/human-zk) · Hackathon: [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) (identity proofs)*
