# Log de implementación — frontend

Registro de slices entregados. Estado actual: landing + KYC + app social + funding UI (dev).

---

## Slice actual · App social + hardening

**Rama:** `feat/web-onboarding` / `fix/security-audit-hardening`

### Entregado

| Área | Estado |
|------|--------|
| Stellar Wallets Kit + Pollar (email) | ✅ |
| React Router (`/app/*`, onboarding, login) | ✅ |
| Flujo KYC completo + prueba ZK + on-chain | ✅ |
| Pollar: registro on-chain real antes de verified | ✅ |
| Capa 2: auth Bearer (`POST /auth`), feed, artículos | ✅ |
| AppGuard: credencial + `is_verified` on-chain | ✅ |
| Storage cifrado AES-GCM (secretos/PII local) | ✅ |
| Headers seguridad (`vercel.json`: CSP, X-Frame-Options) | ✅ |
| Env prod: fail-fast si faltan URLs API | ✅ |
| Funding UI (modo dev) | ✅ |

### Modelo de identidad (actualizado)

- **Capa 1:** `is_verified(address)` — wallet Stellar (incl. Pollar custodial).
- **Capa 2:** `platformId` ZK — prueba Groth16 `post.circom`, no address de wallet.

### Privacidad

PII va al matcher mock (HTTPS); no se persiste. Secret ZK cifrado en localStorage.

---

## Slice 1b · Copy completo del producto

**Fecha:** 2026-06-24

Copy centralizado en `src/content/site.ts`, secciones landing (capas, plataforma, curaduría).

---

## Slice 1 · Landing + hero interactivo

**Fecha:** 2026-06-24

Landing zk.me-style, design system B/N + naranja, hero canvas interactivo.

### Verificación

```bash
npm run test --workspace @behuman/web
npm run lint --workspace @behuman/web
npm run build --workspace @behuman/web
```
