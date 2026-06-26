# CAPA 3 — Funding ZK (crowdfunding anónimo y condicional)

> Vault: módulo `10 - Funding ZK` (visión, preguntas abiertas 10/08 y 10/09).
> Rama de trabajo: `ground-funding` (exploratoria; no toca `main`).

## Qué hace

Un humano verificado (Capa 1) **dona** y **opina** sobre causas sin revelar quién es, con
reglas que nadie puede saltear:

1. **Donación anónima**: aporta XLM (testnet) desde una **wallet efímera** (no su address del
   KYC), gateado por una prueba de *personhood*. El capital entra a un **vault Blend
   (DeFindex)** y genera **yield**.
2. **Condicional (todo-o-nada)**: el `campaign_controller` (Soroban) custodia el capital.
   - **Release** solo con **2-de-3 firmas** (causa + plataforma + neutral) **y meta
     alcanzada** → la causa recibe **capital + yield**.
   - **Refund** si vence el deadline sin meta → cada donante recupera su aporte.
3. **Opinión por campaña**: opina de incógnito; un **nullifier scopeado a la campaña**
   garantiza **1 humano = 1 voz** (no se puede inflar el sentimiento).

**Cero PII on-chain.** On-chain solo: proofs, commitments, nullifiers, estados de escrow,
anclas de opinión (`platformId` + `contentHash`).

## Invariantes (no negociables) — cómo se cumplen

| Invariante | Implementación |
|---|---|
| Identidad nunca revelada | Donante = wallet efímera aleatoria; opinante = `platformId = Poseidon(secret, scope_campaña)`. El address del KYC no aparece. |
| Donación no atable al KYC | La wallet de donación es un seudónimo efímero, sin relación con la credencial. |
| Gate por *personhood* (no `is_verified(address)`) | La donación exige una prueba de pertenencia (circuito de plataforma); las opiniones, una prueba del circuito de funding con inclusión Merkle bajo `issuerRoot`. |
| 1 humano = 1 voz por campaña | `nullifier = Poseidon(secret, "funding-opinion:"+campaignId)`; el backend rechaza recontar el sentimiento de un nullifier ya visto en esa campaña. |
| Identidad incorrelacionable entre campañas | `scope = "funding:"+campaignId` → `platformId` distinto por campaña. |
| Nadie mueve fondos fuera de las reglas | `campaign_controller` no tiene retiro discrecional: solo `release` (2-de-3 + meta) y `refund` (deadline sin meta). |
| Opinión atada a campaña + contenido | El circuito ata `scope`, `nullScope` y `contentHash` (public inputs); el backend re-deriva y valida el binding — una prueba **no** se puede reusar en otra campaña ni con otro texto. |

## Arquitectura

```
[web/funding]  credencial Capa 1 (localStorage)
  · Donar:  prueba de personhood (post.circom, navegador) + wallet efímera
            -> funding/api /donate -> DeFindex (depósito en vault Blend, yield)
  · Opinar: prueba de opinión (funding_opinion.circom, navegador; scope+nullifier de campaña)
            -> funding/api /opinions  (verifica VK funding + binding; platformId/nullifier salen DE la prueba)

[funding/contracts/campaign_controller] (Soroban, no-custodial)
  init · donate · release(2-de-3 + meta) · refund(deadline sin meta) · views

[funding/api]  orquesta DeFindex (yield) + Trustless Work (workflow/disputa)
               y refleja las reglas; el dinero vive en el vault, las reglas las
               ENFORCEa el controller on-chain.
```

### Abstracción de proveedores

`FUNDING_PROVIDER` selecciona la implementación:
- `dev`: mocks deterministas (XDR/hash falsos, APY fijo) → flujo testeable sin red ni keys.
- `real`: `@behuman/sdk` hace fetch a las APIs de **DeFindex** y **Trustless Work** (con keys).

Activo configurable por `ASSET` (su **SAC**): `XLM` en testnet, `USDC` en prod.

## Componentes

| Carpeta | Qué es |
|---|---|
| `funding/circuits/` | `funding_opinion.circom` — opinión por campaña (scope + nullifier runtime). Public signals: `[issuerRoot, platformId, nullifier, scope, nullScope, contentHash]`. |
| `funding/contracts/campaign_controller/` | Soroban no-custodial: `init`, `donate`, `release` (2-de-3 + meta), `refund` (todo-o-nada), views. 10 tests. |
| `funding/api/` | Backend: campañas, donación gateada, posición (yield), hitos, release, refund, opiniones. Verifica la VK de funding + binding. |
| `packages/sdk/` | `defindex.ts`, `trustlesswork.ts` (real/dev) y `fundingOpinion.ts` (prover browser/Node + verificación + binding). |
| `packages/shared/` | Tipos: `Campaign`, `Donation`, `Milestone`, `VaultPosition`, `CampaignOpinion`, `Sentiment`. |
| `web/src/funding/` | UI: donar anónimo, panel validador (aprobar hitos + release 2-de-3), hilo de opiniones + sentimiento. |

## Cómo correrlo (dev)

```bash
# 1) Circuito de funding (genera wasm/zkey/vk en funding/circuits/build)
(cd funding/circuits && npm i && bash scripts/compile.sh && POWER=14 bash scripts/setup.sh)

# 2) Backend (provider dev por defecto)
npm i
FUNDING_PROVIDER=dev npm run -w @behuman/funding-api serve   # :8789

# 3) Frontend (copia los artefactos del circuito a web/public/circuits-funding)
npm run -w @behuman/web dev
```

Variables (`.env`, ver `.env.example`): `ASSET`, `FUNDING_PROVIDER`, `FUNDING_API_PORT`,
`DEFINDEX_API_URL/KEY`, `TRUSTLESS_WORK_API_URL/KEY`, `FUNDING_NEUTRAL_ADDRESS`,
`VITE_FUNDING_API_URL`.

## Estado

- **Contrato** `campaign_controller`: implementado + 10 tests (SAC de testutils) verdes;
  `stellar contract build` OK.
- **Circuito** `funding_opinion`: ~3.7k constraints; prueba y verifica con snarkjs (BLS12-381).
- **API + SDK + Web**: implementados; e2e en dev verde (campaña → donar → hitos → release;
  opinión con prueba real; nullifier anti-Sybil; binding rechaza reusar la prueba en otra
  campaña o con otro contenido).
- **Pendiente para testnet real**: keys de DeFindex/Trustless Work y que el **Manager del
  vault Blend** sea el `campaign_controller` (integración cross-contract). La curaduría de
  opiniones requiere `ANTHROPIC_API_KEY` (sin ella, las opiniones se escalan a revisión).

> ⚠️ El issuer de Capa 1 es un **mock** (no KYC real). Esta capa es exploratoria.

## Despliegue en testnet

Primer despliegue del contrato no-custodial en **Stellar testnet** (verificado on-chain:
`init` OK y views `state=Fundraising`, `goal=100`, `raised=0`).

| Recurso | Valor |
|---|---|
| Red | testnet |
| `campaign_controller` (instancia demo) | `CB5NYUPBHDNTSN7MVJOALELTIY4BXGPTGUR6JPA7SQSZRTA46G6GIOAM` |
| WASM hash | `fd63633855313e87a685fe80686fd9eeaf4d359f39eff84cd81ffd3fa725aa78` |
| Activo (XLM SAC testnet) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Deployer/admin | `behuman-deployer` (`GCKK56MS3CXTGQDWGD6ZEZMB4S65PBWYVVGTZ4XU5RHTYQEOHSLHA2KY`) |

> Modelo: **una instancia del contrato por campaña** (config inmutable en `init`). La
> instancia de arriba es un smoke de despliegue; cada campaña real despliega su propia
> instancia (deploy + `init`).

### Cómo desplegar otra instancia
```bash
stellar contract deploy --wasm target/wasm32v1-none/release/campaign_controller.wasm \
  --source behuman-deployer --network testnet
# luego init (admin debe ser uno de los 3 signers):
stellar contract invoke --id <NUEVO_ID> --source behuman-deployer --network testnet -- init \
  --admin <Gadmin> --asset CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --cause <Gcause> --goal <i128> --deadline <unix> \
  --signers '["<Gcause>","<Gplatform>","<Gneutral>"]'
```

### Pendiente para cerrar la integración real
1. **DeFindex** (yield/Blend): API key (`api.defindex.io/register`) + un **vault testnet** (su `contract ID`). API confirmada: base `https://api.defindex.io`, auth `Bearer`, patrón `/vault/{address}/{deposit|withdraw|balance|apy}` + `/send` (XDR firmado).
2. **Trustless Work** (escrow): API key (vía `dapp.trustlesswork.com`) + validar contra Swagger (`api.trustlesswork.com/docs`).
3. **Cross-contract**: que el `campaign_controller` deposite en el vault DeFindex y sea su Manager (necesita la interfaz del contrato del vault).
4. **Enrutar release/refund/donate on-chain** contra el contrato (ya despliega y exige `require_auth`).
