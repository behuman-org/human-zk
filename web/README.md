# web · Frontend (React + Vite + TypeScript)

La app de beHuman: **landing** (onboarding del producto) + **flujos en vivo** de Capa 1 y Capa 2.

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
Config: `VITE_MATCHER_URL` (default `http://localhost:8787`).

## Rama de trabajo

Frontend: `feat/web-onboarding` (una feature = una rama).

## Estructura

```text
web/
├── docs/                 # documentación (design, componentes, changelog)
├── index.html
├── vite.config.ts
└── src/
    ├── content/          # copy centralizado (site.ts)
    ├── components/
    │   ├── hero/         # HeroSection, HeroBackground (canvas)
    │   ├── layout/       # SiteNav, SiteFooter
    │   ├── sections/     # HowItWorks, Stats, Compare
    │   └── ui/           # Button, Badge
    ├── hooks/            # pointer spring/trail, reduced motion
    ├── kyc/              # gate Capa 1 (consent → DNI → cara → ZK)
    ├── platform/         # opinión + moderación (Capa 2)
    ├── styles/           # tokens.css, global.css
    ├── test/             # setup vitest
    ├── App.tsx
    └── main.tsx
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | copy circuit + typecheck + bundle |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |

## Privacidad

Las imágenes van al backend por multipart y **no se persisten**; el backend devuelve solo
`ok/score/liveness/reasons`. Nada de PII toca la cadena.

## Próximos pasos

Ver checklist en [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md).
