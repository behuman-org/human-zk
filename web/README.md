# web · Frontend (React + Vite + TypeScript)

La app de beHuman: **landing** (onboarding del producto) + **flujos en vivo** de Capas 1–3.

> 📐 Diseño landing: inspiración [zk.me](https://www.zk.me/) — ver **`web/docs/DESIGN.md`**
> 📐 Flujo KYC en vault: `Flujo de KYC` · `Spec — Matcher DNI + Selfie (Capa 1)`

## Documentación

Toda la documentación del frontend vive en **`web/docs/`**:

- [Índice](./docs/README.md)
- [Design system](./docs/DESIGN.md)
- [Copy / contenido](./docs/COPY.md)
- [Componentes](./docs/COMPONENTS.md)
- [Implementación](./docs/IMPLEMENTATION.md)

## Desarrollo

```bash
npm install                         # desde la raíz del monorepo
npm run serve -w @behuman/issuer    # backend matcher en :8787 (necesita modelos)
npm run dev -w @behuman/web         # frontend en :5173
```

Abre http://localhost:5173. La cámara requiere contexto seguro (localhost o https).

**Env vars:** en dev, defaults localhost (`requireEnv`). En **producción** fallan si faltan:
`VITE_MATCHER_URL`, `VITE_PLATFORM_API_URL`, `VITE_FUNDING_API_URL`, más contratos/RPC.
Red de wallet: `VITE_STELLAR_NETWORK_PASSPHRASE`.

## Estructura

```text
web/
├── docs/                 # documentación (design, componentes, changelog)
├── vercel.json           # CSP, X-Frame-Options, etc.
├── index.html
├── vite.config.ts
└── src/
    ├── content/          # copy centralizado (site.ts)
    ├── components/
    ├── hooks/
    ├── kyc/              # gate Capa 1 (consent → DNI → cara → ZK → on-chain)
    ├── feed/             # app social Capa 2 (AppGuard, auth Bearer)
    ├── funding/          # UI Capa 3 (dev)
    ├── lib/secureStorage.ts  # AES-GCM para secretos en localStorage
    ├── styles/
    └── ...
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | copy circuit + typecheck + bundle |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |

## Privacidad (honesto)

La PII (DNI, selfies, datos declarados) **viaja al matcher mock** por HTTPS para el gate
biométrico; se procesa en memoria y **no se persiste** en el issuer. On-chain solo van
commitment, nullifier, proof. El `secret` ZK y la credencial se guardan en el device con
**cifrado AES-GCM** (`secureStorage.ts`). Pollar crea wallet custodial por email; el modo
Pollar ahora hace **registro on-chain real** (`verify_and_register`) antes de marcar verified.

## Acceso a la app

Rutas `/app/*` protegidas por `AppGuard`: sesión + credencial local + `is_verified` on-chain.

Ver checklist histórico en [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md).
