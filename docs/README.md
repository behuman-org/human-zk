# docs · human

This repo (`human`) is **code only**. All product **design, theory, and decisions**
live in the **Obsidian vault**, in the sibling repo `obsidian-vault-zk`.

## Map: documentation ↔ code

| Documentation (vault) | Component in this repo |
|---|---|
| `IDEA`, `Prueba de Persona Única` | the two-layer vision |
| `Flujo de KYC` | `packages/sdk/` + `scripts/e2e_demo.sh` |
| `Diseño del Circuito ZK` | `identity/circuits/src/kyc.circom` |
| `Contrato Verificador (Soroban)` | `identity/contracts/kyc_verifier/src/lib.rs` |
| `Modelo de Datos` | credential in `identity/issuer/`, storage in `identity/contracts/` |
| `Plataforma de Opinión Verificada` | `platform/contracts/opinion_board` + `platform/api` |
| `Curaduría y Agentes Validadores` | `platform/curation` |
| `Identidad Pública vs Anónima` | `platform/` identity model (stable pseudonym) |
| `09 - Tools/Plan de armado con IA` | step-by-step development guide |
| `Estructura del Codigo` | this same monorepo structure |

## How to open the documentation

1. Install [Obsidian](https://obsidian.md).
2. *Open folder as vault* → select the `obsidian-vault-zk` folder.
3. Start at `00 - Inicio/🏠 Home`.

> 🔗 When the docs repo is public, link its URL here.

## Hackathon and migration (repo)

| Doc | Purpose |
|-----|---------|
| [`hackathon-real-world-zk.md`](./hackathon-real-world-zk.md) | Checklist and pitch for **Stellar Hacks: Real-World ZK** |
| [`migracion-repo-zk.md`](./migracion-repo-zk.md) | Migration to `behuman-org/human-zk` (Real-World ZK) |
