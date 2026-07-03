# Implementation log — frontend

Record of delivered slices. Current state: landing + KYC + social app + funding UI (dev).

---

## Current slice · Social app + hardening

**Branch:** `feat/web-onboarding` / `fix/security-audit-hardening`

### Delivered

| Area | Status |
|------|--------|
| Stellar Wallets Kit + Pollar (email) | ✅ |
| React Router (`/app/*`, onboarding, login) | ✅ |
| Full KYC flow + ZK proof + on-chain | ✅ |
| Pollar: real on-chain registration before verified | ✅ |
| Layer 2: Bearer auth (`POST /auth`), feed, articles | ✅ |
| AppGuard: credential + on-chain `is_verified` | ✅ |
| AES-GCM encrypted storage (local secrets/PII) | ✅ |
| Security headers (`vercel.json`: CSP, X-Frame-Options) | ✅ |
| Prod env: fail-fast if API URLs missing | ✅ |
| Funding UI (dev mode) | ✅ |

### Identity model (updated)

- **Layer 1:** `is_verified(address)` — Stellar wallet (incl. Pollar custodial).
- **Layer 2:** ZK `platformId` — Groth16 proof `post.circom`, not wallet address.

### Privacy

PII goes to mock matcher (HTTPS); not persisted. ZK secret encrypted in localStorage.

---

## Slice 1b · Full product copy

**Date:** 2026-06-24

Copy centralized in `src/i18n/locales/`, landing sections (layers, platform, curation).

---

## Slice 1 · Landing + interactive hero

**Date:** 2026-06-24

zk.me-style landing, B/W + orange design system, interactive canvas hero.

### Verification

```bash
npm run test --workspace @behuman/web
npm run lint --workspace @behuman/web
npm run build --workspace @behuman/web
```
