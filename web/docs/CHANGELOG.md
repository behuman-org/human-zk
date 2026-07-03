# Changelog — web

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — feat/web-onboarding

### Changed

- **Full product copy** — `src/i18n/locales/` + Architecture, Platform, Curation sections
- KYC flow expanded to **4 phases** (vault)
- Comparison table: **7 rows**
- Footer: behuman-org, Stellar Hacks: Real-World ZK, mock issuer disclaimer

### Changed (previous)
- Hero canvas reads CSS tokens via `getComputedStyle` (glow + orange trail)

### Added

- Design tokens (`tokens.css`) inspired by zk.me
- Interactive hero: canvas orbs + trail + dot-grid parallax
- Landing sections: How it works, Stats, Compare
- Glass pill nav + footer
- UI components `Button`, `Badge`
- Documentation in `web/docs/`
- Plus Jakarta Sans + JetBrains Mono fonts

### Changed

- `App.tsx` — from scaffolding to full landing
- Tests — 3 asserts (nav, hero `#hero-title`, `#como-funciona` section)
- `usePointerSpring` — mutable ref (no re-render per frame in canvas loop)

### Fixed

- `matchMedia` polyfill + canvas mock in Vitest setup
- HeroBackground — unified canvas loop (grid parallax in same rAF)

### Removed

- Legacy `App.css`, `index.css`
