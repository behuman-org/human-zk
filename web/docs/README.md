# Documentación del frontend (`web/`)

Índice de documentación técnica y de diseño para beHuman.

| Documento | Contenido |
|-----------|-----------|
| [DESIGN.md](./DESIGN.md) | Referencia visual, tokens, animaciones, accesibilidad |
| [COPY.md](./COPY.md) | Textos de la landing y mapeo secciones |
| [COMPONENTS.md](./COMPONENTS.md) | Catálogo de componentes y props |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Log de implementación por slice |
| [CHANGELOG.md](./CHANGELOG.md) | Cambios notables del frontend |

## Estado actual

Landing + flujo KYC on-chain + app social (`/app/*`) con guard de rutas, auth Bearer a la
platform API, storage cifrado y UI de funding (dev). Ver [IMPLEMENTATION.md](./IMPLEMENTATION.md).

## Comandos

```bash
npm run dev --workspace @behuman/web   # http://localhost:5173
npm run test --workspace @behuman/web
npm run lint --workspace @behuman/web
npm run build --workspace @behuman/web  # en prod exige VITE_* URLs
```

## Env obligatorias en producción

`VITE_MATCHER_URL`, `VITE_PLATFORM_API_URL`, `VITE_FUNDING_API_URL`,
`VITE_KYC_VERIFIER_CONTRACT_ID`, `VITE_STELLAR_RPC_URL`, `VITE_STELLAR_NETWORK_PASSPHRASE`.
