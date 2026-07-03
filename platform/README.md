# platform · LAYER 2 — Verified opinion platform

The **application** on top of the identity core: a public square where **unique humans**
opine in threads and publish articles/studies — without exposing PII, with curation that maintains
truthfulness without censorship.

> 🌉 **Bridge to Layer 1:** wallet must have `is_verified(address)` on-chain (KYC registration).
> **Platform identity:** each action uses **`platformId`** (stable pseudonym derived from
> ZK secret), verified with Groth16 proof (`post.circom`) — **not** wallet address.
>
> 📐 Design in the vault: `Plataforma de Opinión Verificada`, `Curaduría y Agentes
> Validadores`, `Identidad Pública vs Anónima`.

| Folder | What it is |
|---|---|
| [`contracts/`](./contracts/) | `opinion_board` — `register_identity` + `post` with ZK proof. |
| [`api/`](./api/) | Authenticated backend (Bearer): feed, posts, articles, curation. |
| [`curation/`](./curation/) | Claude agent + human moderation queue. |

## Platform identity model

**Stable ZK pseudonym:** `platformId = Poseidon(secret, scope)` (`post.circom` circuit).
User registers on-chain with `register_identity(proof, public_inputs)` and publishes with
`post(proof, public_inputs)`. Posts are **linkable under the same `platformId`** but real
PII and Stellar wallet remain decoupled.

## Storage (hybrid)

- **On-chain (`opinion_board`):** proof of *"published by verified `platformId`, hash = X"*.
- **Off-chain (`api`):** heavy content (text, PDFs). MVP: local/Upstash store; future: IPFS.

## API authentication

1. Client generates membership proof (`post.circom`) → `POST /auth` with `{ membershipProof }`.
2. API verifies proof and returns **Bearer HMAC** token (`SESSION_SECRET`).
3. Mutating POSTs (`/content`, `/profile`, `/articles`, replies, opinions) require
   `Authorization: Bearer`; `platformId` comes from token (body value ignored).
4. Server recomputes `contentHash` and rejects mismatch. `/moderation/*` uses `MODERATION_SECRET`.
