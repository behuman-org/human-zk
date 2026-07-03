# platform · CAPA 2 — Plataforma de opinión verificada

La **aplicación** sobre el núcleo de identidad: una plaza pública donde **humanos únicos**
opinan en hilos y publican artículos/estudios — sin exponer su PII, con curaduría que mantiene
la veracidad sin censurar.

> 🌉 **Puente con Capa 1:** la wallet debe tener `is_verified(address)` on-chain (registro KYC).
> **Identidad de plataforma:** cada acción usa **`platformId`** (seudónimo estable derivado del
> secret ZK), verificado con prueba Groth16 (`post.circom`) — **no** la address de wallet.
>
> 📐 Diseño en la vault: `Plataforma de Opinión Verificada`, `Curaduría y Agentes
> Validadores`, `Identidad Pública vs Anónima`.

| Carpeta | Qué es |
|---|---|
| [`contracts/`](./contracts/) | `opinion_board` — `register_identity` + `post` con proof ZK. |
| [`api/`](./api/) | Backend autenticado (Bearer): feed, posts, artículos, curaduría. |
| [`curation/`](./curation/) | Agente Claude + cola de moderación humana. |

## Modelo de identidad en la plataforma

**Seudónimo estable ZK:** `platformId = Poseidon(secret, scope)` (circuito `post.circom`).
El usuario se registra on-chain con `register_identity(proof, public_inputs)` y publica con
`post(proof, public_inputs)`. Los posts son **linkeables bajo el mismo `platformId`** pero la
PII real y la wallet Stellar quedan desacopladas.

## Almacenamiento (híbrido)

- **On-chain (`opinion_board`):** prueba de *"publicado por `platformId` verificado, hash = X"*.
- **Off-chain (`api`):** contenido pesado (texto, PDFs). MVP: store local/Upstash; futuro: IPFS.

## Autenticación API

1. Cliente genera prueba de membresía (`post.circom`) → `POST /auth` con `{ membershipProof }`.
2. API verifica la prueba y devuelve token **Bearer HMAC** (`SESSION_SECRET`).
3. POST mutantes (`/content`, `/profile`, `/articles`, replies, opinions) exigen
   `Authorization: Bearer`; el `platformId` sale del token (se ignora el del body).
4. El server recomputa `contentHash` y rechaza mismatch. `/moderation/*` usa `MODERATION_SECRET`.
