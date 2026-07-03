# platform/api · Backend de la plataforma

Servicio off-chain de la **plataforma de opinión** (CAPA 2). Guarda el contenido pesado,
expone el feed y coordina curaduría antes de publicar.

> 📐 Ver en la vault: `Plataforma de Opinión Verificada`, `Identidad Pública vs Anónima`.

## Qué hace

1. **Autenticación ZK:** `POST /auth` recibe `{ membershipProof }` (prueba Groth16 de
   `post.circom`), la verifica y emite token Bearer HMAC (`SESSION_SECRET`).
2. **Gating por token:** POST mutantes exigen `Authorization: Bearer`; el `platformId` se
   deriva del token (no del body).
3. **Integridad de contenido:** recomputa `contentHash` server-side y rechaza si no coincide
   con el del cliente.
4. **Almacenamiento off-chain** del contenido (texto, PDFs). Store local o Upstash Redis.
5. **Curaduría:** envía posts, artículos y opiniones a `platform/curation` (Claude). Sin
   `ANTHROPIC_API_KEY` → fail-safe **escalado** (cuarentena, no publicación silenciosa).
6. **Moderación humana:** `/moderation/queue` y `/moderation/resolve` protegidos con
   `MODERATION_SECRET`.
7. **Cuarentena real:** GET `/posts/:id` y `/articles/:id` filtran contenido escalado.

## Endpoints principales

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/auth` | — | Emite Bearer tras verificar `membershipProof` |
| POST | `/content`, `/profile`, `/articles`, replies, opinions | Bearer | `platformId` del token |
| GET | `/feed`, `/posts/:id`, `/articles/:id` | — | Filtra escalados |
| GET/POST | `/moderation/*` | `MODERATION_SECRET` | Cola humana |

## Variables de entorno

Ver [`platform/api/.env.example`](./.env.example): `SESSION_SECRET`, `MODERATION_SECRET`,
`ANTHROPIC_API_KEY`, `CORS_ORIGIN`, `UPSTASH_REDIS_REST_URL/TOKEN` (opcional).

```bash
npm install
npm run dev
```
