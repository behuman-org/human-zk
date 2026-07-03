# web · Frontend (React + Vite + TypeScript)

The beHuman app: **landing** (product onboarding) + **live flows** for Layers 1–3.

Hackathon delivery: **[Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail)**.

> 📐 Landing design: inspired by [zk.me](https://www.zk.me/) — see **`web/docs/DESIGN.md`**
> 📐 KYC flow in vault: `Flujo de KYC` · `Spec — Matcher DNI + Selfie (Capa 1)`

## Documentation

All frontend documentation lives in **`web/docs/`**:

- [Index](./docs/README.md)
- [Design system](./docs/DESIGN.md)
- [Copy / content](./docs/COPY.md)
- [Components](./docs/COMPONENTS.md)
- [Implementation](./docs/IMPLEMENTATION.md)

## Development

```bash
npm install                         # from monorepo root
npm run serve -w @behuman/issuer    # matcher backend on :8787 (needs models)
npm run dev -w @behuman/web         # frontend on :5173
```

Open http://localhost:5173. Camera requires secure context (localhost or https).

**Env vars:** in dev, localhost defaults (`requireEnv`). In **production** fail if missing:
`VITE_MATCHER_URL`, `VITE_PLATFORM_API_URL`, `VITE_FUNDING_API_URL`, plus contracts/RPC.
Wallet network: `VITE_STELLAR_NETWORK_PASSPHRASE`.

## Structure

```text
web/
├── docs/                 # documentation (design, components, changelog)
├── vercel.json           # CSP, X-Frame-Options, etc.
├── index.html
├── vite.config.ts
└── src/
    ├── i18n/               # centralized copy (es/en locales)
    ├── components/
    ├── hooks/
    ├── kyc/              # Layer 1 gate (consent → ID → face → ZK → on-chain)
    ├── feed/             # Layer 2 social app (AppGuard, Bearer auth)
    ├── funding/          # Layer 3 UI (dev)
    ├── lib/secureStorage.ts  # AES-GCM for secrets in localStorage
    ├── styles/
    └── ...
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | copy circuit + typecheck + bundle |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |

## Privacy (honest)

PII (ID, selfies, declared data) **travels to mock matcher** over HTTPS for the biometric
gate; processed in memory and **not persisted** in the issuer. On-chain only
commitment, nullifier, proof. ZK `secret` and credential stored on device with
**AES-GCM encryption** (`secureStorage.ts`). Pollar creates custodial wallet via email; Pollar mode
now performs **real on-chain registration** (`verify_and_register`) before marking verified.

## App access

`/app/*` routes protected by `AppGuard`: session + local credential + on-chain `is_verified`.

See historical checklist in [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md).
