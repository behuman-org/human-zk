# Changelog — web

Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — feat/web-onboarding

### Changed

- **Copy completo del producto** — `src/content/site.ts` + secciones Arquitectura, Plataforma, Curaduría
- Flujo KYC ampliado a **4 fases** (vault)
- Tabla comparativa: **7 filas**
- Footer: ACRC-Zk, hackathon, disclaimer issuer mock

### Changed (previo)
- Hero canvas lee tokens CSS vía `getComputedStyle` (glow + trail naranja)

### Added

- Design tokens (`tokens.css`) inspirados en zk.me
- Hero interactivo: canvas orbes + trail + dot-grid parallax
- Landing sections: Cómo funciona, Stats, Compare
- Nav glass pill + footer
- Componentes UI `Button`, `Badge`
- Documentación en `web/docs/`
- Fuentes Plus Jakarta Sans + JetBrains Mono

### Changed

- `App.tsx` — de scaffolding a landing completa
- Tests — 3 asserts (nav, hero `#hero-title`, sección `#como-funciona`)
- `usePointerSpring` — ref mutable (sin re-render por frame en canvas loop)

### Fixed

- Polyfill `matchMedia` + mock canvas en Vitest setup
- HeroBackground — loop canvas unificado (grid parallax en mismo rAF)

### Removed

- `App.css`, `index.css` legacy
