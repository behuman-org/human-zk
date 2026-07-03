# beHuman — Guía para agentes de IA

> Leé esto antes de tocar el código. Este archivo encapsula el contexto que vive en la
> **vault de Obsidian** (repo hermano `obsidian-vault-zk`, en `../obsidian-vault-zk/`).

## Qué es beHuman

Proyecto de **tres capas**:
- **CAPA 1 · Identidad (KYC-ZK):** *proof of personhood*. Una persona prueba que es **real y
  única** sin revelar su PII on-chain; un contrato Soroban la verifica y registra. Expone el
  puente **`is_verified(address)`** (wallet Stellar, no identidad de plataforma).
- **CAPA 2 · Plataforma de opinión:** humanos verificados publican con **`platformId`**
  (seudónimo estable derivado del secret ZK, prueba Groth16 `post.circom`), sin exponer PII,
  con curaduría (agente Claude + moderación humana) y API autenticada (Bearer HMAC).
- **CAPA 3 · Funding ZK:** crowdfunding anónimo y condicional (contrato `campaign_controller`,
  circuito `funding_opinion`). **Hoy solo modo `dev`** (demo in-memory); integración real
  DeFindex/Trustless Work bloqueada al iniciar la API.

## ⚠️ Antes de escribir código (regla de Stellar)

1. **Leé `skills.stellar.org`** — en especial la skill **zk-proofs** (verificación Groth16
   con **BLS12-381** / Poseidon). Mejora drásticamente el código.
2. Usá las skills instaladas (`stellar-dev-skill`, `openzeppelin-skills`) y `llms.txt`
   (https://developers.stellar.org/llms.txt) como contexto.
3. Seguí los patrones de seguridad de stellar-dev-skill y los detectores de OpenZeppelin
   para todo lo que toque el contrato.

## Decisiones ya tomadas (no reabrir sin avisar)

- **Toolchain ZK: Circom + Groth16 sobre BLS12-381** (`--prime bls12381`; verificador oficial
  de `soroban-examples`). Plan B: Noir/UltraHonk.
- **Monorepo único** (este repo). Docs separadas en la vault de Obsidian.
- Nombre de trabajo: **human**. Organización GitHub: **behuman-org**.

## Estructura (por capas)

| Carpeta | Capa | Qué es |
|---|---|---|
| `identity/circuits/` | 1 | Circuito Circom (`kyc.circom`) |
| `identity/contracts/kyc_verifier/` | 1 | Soroban (`verify_and_register`, `update_root`, `is_verified`) ← **puente Capa 1** |
| `identity/issuer/` | 1 | Issuer KYC **mock** (TS) — atestación Merkle-only (sin EdDSA) |
| `platform/contracts/opinion_board/` | 2 | Soroban: `register_identity` + `post` con prueba ZK (`platformId`) |
| `platform/api/` | 2 | Backend autenticado: feed, posts, artículos, curaduría |
| `platform/curation/` | 2 | Agente Claude + cola de moderación humana |
| `funding/contracts/campaign_controller/` | 3 | Soroban: escrow condicional (init con auth admin) |
| `funding/api/` | 3 | Backend funding — **solo `FUNDING_PROVIDER=dev`** operativo |
| `packages/sdk/` | — | Prover + orquestación de tx Stellar (TS, compartido) |
| `packages/shared/` | — | Tipos TS compartidos (3 capas) |
| `web/` | — | Frontend **React + Vite + TS** (único) |
| `scripts/` · `docs/` | — | Deploy/e2e · puente a la vault |

> Los contratos Rust (3 capas) son miembros del **workspace Cargo raíz** (`/Cargo.toml`):
> `stellar contract build` los compila todos.
> **Capa 1:** `is_verified(address)` + nullifier global `Poseidon(secret)` (anti-Sybil real).
> **Capa 2:** identidad = `platformId` ZK (`register_identity` / `post` con proof); la wallet
> solo firma txs de Capa 1. Contenido híbrido (ancla on-chain + off-chain en `api`).

## Dónde está cada cosa en la vault (la fuente de verdad del diseño)

- `IDEA`, `Prueba de Persona Única` — la visión.
- `Flujo de KYC` — las 4 fases (emisión → prueba → verificación → consumo).
- `Diseño del Circuito ZK` — inputs/outputs, commitment, nullifier, riesgos.
- `Contrato Verificador (Soroban)` — la interfaz on-chain.
- `Modelo de Datos` — credencial y storage.
- `09 - Tools/*` — recursos, skills de IA, verificadores de referencia, **Plan de armado con IA**.

## Estado

**MVP funcional en testnet/demo** — no es un KYC regulado real: el issuer es un **mock**
(declararlo). Capas 1 y 2 operativas con hardening de seguridad reciente. Capa 3 funding:
contrato + circuito + UI en modo **dev-only**; integración DeFindex/TW real **no cableada**.

## Convenciones

- Commits: convencionales (`feat:`, `fix:`, `chore:`…).
- Revisión humana obligatoria de la cripto (nullifier, address binding, issuer root).
- Secretos en `.env` (ver `.env.example`); nunca commitear PII ni claves.
