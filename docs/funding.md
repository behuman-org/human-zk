# LAYER 3 — ZK Funding (anonymous, conditional crowdfunding)

> Vault: `10 - Funding ZK` module (vision, open questions 10/08 and 10/09).
> Working branch: `ground-funding` (exploratory; does not touch `main`).

## What it does

A verified human (Layer 1) **donates** and **opines** on causes without revealing who they are, with
rules no one can bypass:

1. **Anonymous donation**: contributes XLM (testnet) from an **ephemeral wallet** (not their KYC
   address), gated by a *personhood* proof. Capital enters a **Blend vault (DeFindex)**
   and generates **yield**.
2. **Conditional (all-or-nothing)**: `campaign_controller` (Soroban) custodies capital.
   - **Release** only with **2-of-3 signatures** (cause + platform + neutral) **and goal
     reached** → cause receives **capital + yield**.
   - **Refund** if deadline passes without goal → each donor recovers their contribution.
3. **Opinion per campaign**: opine incognito; a **campaign-scoped nullifier**
   guarantees **1 human = 1 voice** (sentiment cannot be inflated).

**Zero PII on-chain.** On-chain only: proofs, commitments, nullifiers, escrow states,
opinion anchors (`platformId` + `contentHash`).

## Invariants (non-negotiable) — how they are enforced

| Invariant | Implementation |
|---|---|
| Identity never revealed | Donor = random ephemeral wallet; opinionator = `platformId = Poseidon(secret, scope_campaign)`. KYC address never appears. |
| Donation not linkable to KYC | Donation wallet is an ephemeral pseudonym, unrelated to the credential. |
| Gate by *personhood* (not `is_verified(address)`) | Donation requires membership proof (platform circuit); opinions require funding circuit proof with Merkle inclusion under `issuerRoot`. |
| 1 human = 1 voice per campaign | `nullifier = Poseidon(secret, "funding-opinion:"+campaignId)`; backend rejects recounting sentiment from an already seen nullifier in that campaign. |
| Identity uncorrelatable across campaigns | `scope = "funding:"+campaignId` → distinct `platformId` per campaign. |
| No one moves funds outside the rules | `campaign_controller` has no discretionary withdrawal: only `release` (2-of-3 + goal) and `refund` (deadline without goal). |
| Opinion bound to campaign + content | Circuit binds `scope`, `nullScope`, and `contentHash` (public inputs); backend re-derives and validates binding — a proof **cannot** be reused in another campaign or with different text. |

## Architecture

```
[web/funding]  Layer 1 credential (localStorage)
  · Donate:  personhood proof (post.circom, browser) + ephemeral wallet
            -> funding/api /donate -> DeFindex (Blend vault deposit, yield)
  · Opine:   opinion proof (funding_opinion.circom, browser; campaign scope+nullifier)
            -> funding/api /opinions  (verifies funding VK + binding; platformId/nullifier FROM proof)

[funding/contracts/campaign_controller] (Soroban, non-custodial)
  init · donate · release(2-of-3 + goal) · refund(deadline without goal) · views

[funding/api]  orchestrates DeFindex (yield) + Trustless Work (workflow/dispute)
               and reflects rules; money lives in vault, rules are
               ENFORCED by the on-chain controller.
```

### Provider abstraction

`FUNDING_PROVIDER` selects implementation:
- **`dev`** (only operational): deterministic in-memory mocks → testable flow without network or keys.
- **`real`**: **blocked at startup** — DeFindex + Trustless Work +
  on-chain `campaign_controller` integration **not wired**. Server fails with clear message if
  `FUNDING_PROVIDER=real` is attempted.

Configurable asset via `ASSET` (its **SAC**): `XLM` on testnet, `USDC` in prod.

## Components

| Folder | What it is |
|---|---|
| `funding/circuits/` | `funding_opinion.circom` — opinion per campaign (runtime scope + nullifier). Public signals: `[issuerRoot, platformId, nullifier, scope, nullScope, contentHash]`. |
| `funding/contracts/campaign_controller/` | Non-custodial Soroban: `init`, `donate`, `release` (2-of-3 + goal), `refund` (all-or-nothing), views. 10 tests. |
| `funding/api/` | Backend: campaigns, gated donation, position (yield), milestones, release, refund, opinions. Verifies funding VK + binding. |
| `packages/sdk/` | `defindex.ts`, `trustlesswork.ts` (real/dev) and `fundingOpinion.ts` (browser/Node prover + verification + binding). |
| `packages/shared/` | Types: `Campaign`, `Donation`, `Milestone`, `VaultPosition`, `CampaignOpinion`, `Sentiment`. |
| `web/src/funding/` | UI: anonymous donate, validator panel (approve milestones + 2-of-3 release), opinion thread + sentiment. |

## How to run (dev)

```bash
# 1) Funding circuit (generates wasm/zkey/vk in funding/circuits/build)
(cd funding/circuits && npm i && bash scripts/compile.sh && POWER=14 bash scripts/setup.sh)

# 2) Backend (dev provider by default)
npm i
FUNDING_PROVIDER=dev npm run -w @behuman/funding-api serve   # :8789

# 3) Frontend (copies circuit artifacts to web/public/circuits-funding)
npm run -w @behuman/web dev
```

Variables (`.env`, see `.env.example`): `ASSET`, `FUNDING_PROVIDER`, `FUNDING_API_PORT`,
`DEFINDEX_API_URL/KEY`, `TRUSTLESS_WORK_API_URL/KEY`, `FUNDING_NEUTRAL_ADDRESS`,
`VITE_FUNDING_API_URL`.

## Status

> ⚠️ **Real mode not implemented.** Only `FUNDING_PROVIDER=dev` starts the API. Cross-contract
> DeFindex/TW integration + role-based signature orchestration is **pending** (see below).

- **Contract** `campaign_controller`: implemented + tests; `init` requires admin auth;
  `extend_ttl` on persistent writes; `stellar contract build` OK.
- **Circuit** `funding_opinion`: ~3.7k constraints; proves and verifies with snarkjs (BLS12-381).
- **API + SDK + Web in dev**: green e2e in mock mode (campaign → donate → milestones → release;
  opinion with real proof; nullifier anti-Sybil; binding rejects reuse).
- **`real` mode**: blocked — do not use in prod until integrations are wired.
- **Opinion curation**: requires `ANTHROPIC_API_KEY` in platform API; without key → escalated.

> ⚠️ Layer 1 issuer is a **mock** (not real KYC). This layer is exploratory / demo.

## Testnet deployment

First deployment of the non-custodial contract on **Stellar testnet** (verified on-chain:
`init` OK and views `state=Fundraising`, `goal=100`, `raised=0`).

| Resource | Value |
|---|---|
| Network | testnet |
| `campaign_controller` (demo instance) | `CB5NYUPBHDNTSN7MVJOALELTIY4BXGPTGUR6JPA7SQSZRTA46G6GIOAM` |
| WASM hash | `fd63633855313e87a685fe80686fd9eeaf4d359f39eff84cd81ffd3fa725aa78` |
| Asset (XLM SAC testnet) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Deployer/admin | `behuman-deployer` (`GCKK56MS3CXTGQDWGD6ZEZMB4S65PBWYVVGTZ4XU5RHTYQEOHSLHA2KY`) |

> Model: **one contract instance per campaign** (immutable config at `init`). The
> instance above is a deployment smoke test; each real campaign deploys its own
> instance (deploy + `init`).

### How to deploy another instance
```bash
stellar contract deploy --wasm target/wasm32v1-none/release/campaign_controller.wasm \
  --source behuman-deployer --network testnet
# then init (admin must be one of the 3 signers):
stellar contract invoke --id <NEW_ID> --source behuman-deployer --network testnet -- init \
  --admin <Gadmin> --asset CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --cause <Gcause> --goal <i128> --deadline <unix> \
  --signers '["<Gcause>","<Gplatform>","<Gneutral>"]'
```

### Real integrations — VALIDATED on-chain on testnet

**DeFindex (yield/Blend)** — ✅ working. API `https://api.defindex.io`, auth `Bearer`,
network via `?network=testnet`, pattern `/vault/{address}/{deposit|withdraw|balance|apy}` + `/send`.

| Resource | Value |
|---|---|
| Official XLM vault (testnet) | `CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6` |
| Testnet factory | `CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32` |
| XLM Blend strategy | `CDVLOSPJPQOTB6ZCWO5VSGTOLGMKTXSFWYTUP572GTPNOWX4F76X3HPM` |
| Verified real deposit | tx `ee52e10c…` (5 XLM → vault) |

Notes: API returns `apy` as **percentage** (normalized to fraction); `amounts` in
**stroops** (1 XLM = 1e7). Testnet `/strategies` indexer returns 500, but
deposit/withdraw/balance/apy/discover work.

**Trustless Work (escrow/workflow)** — ✅ flow validated on-chain. **dev/testnet** host
`https://dev.api.trustlesswork.com` (prod = `api.trustlesswork.com`), auth header `x-api-key`.

| Resource | Value |
|---|---|
| Deployed single-release escrow (testnet) | `CAUIE5WKHQ2FNIIXRY2HVVEUE55SXSPNKIWAFEJPLVMS5XI35YZL2E76` |
| Trustline (USDC testnet, classic issuer) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (symbol `USDC`) |

Pattern: each action returns `{ unsignedTransaction }` → sign with role → POST
`/helper/send-transaction` → `{ contractId, escrow }`. `roles` is an **object** (with
singular `releaseSigner`); `trustline` is `{ address: issuer, symbol }`. **TW is stablecoin
escrow** (USDC): it does not custody donations (that is the DeFindex XLM vault), it is the
workflow/dispute layer. Participants must have **USDC trustline** and be funded.

### Pending to close (real mode)
1. **Unlock `FUNDING_PROVIDER=real`** in API and implement DeFindex + TW orchestration.
2. **Role-based signature orchestration on server**: TW signs each action with the role's secret.
   In dev **`signerSecretsDev` are NOT exposed** in HTTP responses.
3. **TW vs DeFindex asset reconciliation**: DeFindex XLM vault vs TW USDC — product decision.
4. **Cross-contract**: `campaign_controller` as DeFindex vault Manager.
5. **Flip to `real` in browser**: funded ephemeral wallets + real on-chain signing.
