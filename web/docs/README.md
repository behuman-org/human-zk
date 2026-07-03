# Frontend documentation (`web/`)

Index of technical and design documentation for beHuman.

| Document | Content |
|-----------|-----------|
| [DESIGN.md](./DESIGN.md) | Visual reference, tokens, animations, accessibility |
| [COPY.md](./COPY.md) | Landing copy and section mapping |
| [COMPONENTS.md](./COMPONENTS.md) | Component catalog and props |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Implementation log by slice |
| [CHANGELOG.md](./CHANGELOG.md) | Notable frontend changes |

## Current status

Landing + on-chain KYC flow + social app (`/app/*`) with route guard, Bearer auth to
platform API, encrypted storage, and funding UI (dev). See [IMPLEMENTATION.md](./IMPLEMENTATION.md).

## Commands

```bash
npm run dev --workspace @behuman/web   # http://localhost:5173
npm run test --workspace @behuman/web
npm run lint --workspace @behuman/web
npm run build --workspace @behuman/web  # in prod requires VITE_* URLs
```

## Required env in production

`VITE_MATCHER_URL`, `VITE_PLATFORM_API_URL`, `VITE_FUNDING_API_URL`,
`VITE_KYC_VERIFIER_CONTRACT_ID`, `VITE_STELLAR_RPC_URL`, `VITE_STELLAR_NETWORK_PASSPHRASE`.
