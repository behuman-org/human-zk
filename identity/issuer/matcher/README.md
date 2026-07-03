# matcher · Identity gate (ID + selfie) — Layer 1, **testnet**

Backend that validates identity **before** creating Layer 1 identity: receives **ID photo**
+ **live camera frames**, runs **1:1 face match** (ID ↔ camera) + **liveness**,
and returns `{ ok, matchScore, matchDistance, livenessOk, reasons }`.

> 📐 Spec: `06 - Implementacion/Spec — Matcher DNI + Selfie (Capa 1)` ·
> Architecture: `05 - Arquitectura/Matcher de Identidad (Gate de Capa 1)`.

## ⚠️ Scope: TESTNET / prototype

- Face match with **face-api** (open-source). Suitable for testnet, **not** production KYC.
- Liveness = **active challenge** (blink/turn) + anti-static-photo. **Not** certified PAD
  (iBeta ISO 30107-3).
- **Does not** validate document authenticity or run AML. That is **RENAPER** in production
  (`IDENTITY_PROVIDER=renaper`, slot already in `renaperProvider.ts`).

## Privacy (Law 25.326)

- Images **in memory**, never to disk, **never** logged.
- Response is **PII-free**: only `ok/score/distance/reasons`. No images or embeddings.
- Issuer discards PII after verification (see `identity/issuer` + `Cumplimiento-Argentina`).

## Design

| File | What it does |
|---|---|
| `provider.ts` | Swappable `IdentityProvider` interface + selector by `IDENTITY_PROVIDER` |
| `testnetProvider.ts` | 1:1 match (Euclidean distance ≤ `MATCH_THRESHOLD`) + liveness |
| `renaperProvider.ts` | Production stub (not implemented on testnet) |
| `faceEngine.ts` | face-api + tfjs-node: detection, embeddings, distance |
| `liveness.ts` | EAR (blink) + head movement, anti-static |
| `server.ts` | HTTP: `GET /health`, `POST /verify` (and `POST /enroll` in Phase 3) |

**Metric decision:** face-api descriptors compared with **Euclidean distance**
(standard 0.6; lower = more similar). **Cosine does not discriminate** (different faces give ~0.85+).

## Usage

```bash
npm install                       # from monorepo root
npm run download-models -w @behuman/issuer   # download weights to matcher/models/ (gitignored)
npm run serve -w @behuman/issuer             # starts gate on :8787

# test the gate
curl -s http://localhost:8787/health
curl -s -X POST http://localhost:8787/verify \
  -F "document=@dni.jpg" \
  -F "selfie=@f1.jpg" -F "selfie=@f2.jpg" -F "selfie=@f3.jpg"
```

## Tests

```bash
npm test -w @behuman/issuer
```

- `liveness.test.ts` — liveness logic (blink/turn/static) with synthetic landmarks.
- `match.test.ts` — integration with real faces (`__tests__/fixtures/`): same face → match,
  different faces → rejection, document without face → `no_face_in_document`.

Config in `.env` (root): `IDENTITY_PROVIDER`, `MATCH_THRESHOLD`, `MATCHER_PORT`, `FACE_MODELS_PATH`.
