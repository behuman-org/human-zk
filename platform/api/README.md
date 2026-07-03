# platform/api · Platform backend

Off-chain service for the **opinion platform** (LAYER 2). Stores heavy content,
exposes the feed, and coordinates curation before publishing.

> 📐 See in the vault: `Plataforma de Opinión Verificada`, `Identidad Pública vs Anónima`.

## What it does

1. **ZK authentication:** `POST /auth` receives `{ membershipProof }` (Groth16 proof from
   `post.circom`), verifies it, and issues Bearer HMAC token (`SESSION_SECRET`).
2. **Token gating:** mutating POSTs require `Authorization: Bearer`; `platformId` is
   derived from token (not body).
3. **Content integrity:** recomputes `contentHash` server-side and rejects client mismatch.
4. **Off-chain storage** of content (text, PDFs). Local store or Upstash Redis.
5. **Curation:** sends posts, articles, and opinions to `platform/curation` (Claude). Without
   `ANTHROPIC_API_KEY` → fail-safe **escalated** (quarantine, not silent publish).
6. **Human moderation:** `/moderation/queue` and `/moderation/resolve` protected with
   `MODERATION_SECRET`.
7. **Real quarantine:** GET `/posts/:id` and `/articles/:id` filter escalated content.

## Main endpoints

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/auth` | — | Issues Bearer after verifying `membershipProof` |
| POST | `/content`, `/profile`, `/articles`, replies, opinions | Bearer | `platformId` from token |
| GET | `/feed`, `/posts/:id`, `/articles/:id` | — | Filters escalated |
| GET/POST | `/moderation/*` | `MODERATION_SECRET` | Human queue |

## Environment variables

See [`platform/api/.env.example`](./.env.example): `SESSION_SECRET`, `MODERATION_SECRET`,
`ANTHROPIC_API_KEY`, `CORS_ORIGIN`, `UPSTASH_REDIS_REST_URL/TOKEN` (optional).

```bash
npm install
npm run dev
```
