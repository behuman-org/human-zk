# Component catalog

Structure under `src/components/`.

## Layout

### `SiteNav`

Floating pill bar with glassmorphism. Anchor links: `#capas`, `#como-funciona`, `#plataforma`, `#curacion`, `#compare`. Wallet CTA disabled.

### `SiteFooter`

Brand, tagline (behuman-org, **Stellar Hacks: Real-World ZK**, mock issuer disclaimer), GitHub + DoraHacks links.

## Hero

### `HeroBackground`

Canvas + dot-grid. No props. Respects reduced motion internally.

### `HeroSection`

Composes `HeroBackground`, badge, title, lead, CTAs, and stack marquee. Copy from i18n (`locales/es.ts`, `locales/en.ts`).

## Sections

### `LayersSection`

`id="capas"`. LAYER 1 identity + LAYER 2 platform + LAYER 3 funding; Layer 1 bridge =
`is_verified(address)`; Layer 2 = ZK `platformId`.

### `HowItWorksSection`

`id="como-funciona"`. **4** `step-card` (issuance → proof → verification → consumption).

### `StatsSection`

2×2 / 4-column grid with placeholder metrics.

### `CompareSection`

`id="compare"`. 7-row table: aspect | traditional | beHuman.

### `PlatformSection`

`id="plataforma"`. Three pillars + opinion/article/study badges.

### `CurationSection`

`id="curacion"`. Two levels + guiding principle blockquote.

## Content

See `src/i18n/locales/` and [COPY.md](./COPY.md).

## UI

### `Button`

```tsx
<Button variant="primary" | "secondary" | "ghost" disabled={...}>
```

Extends native `<button>` attributes.

### `Badge`

Uppercase pill for hero labels.

## Hooks (`src/hooks/`)

| Hook | Return | Notes |
|------|---------|-------|
| `usePointerSpring` | `RefObject<{ x, y }>` normalized | `enabled`, `strength` — no re-render per frame |
| `usePointerTrail` | `{ points, decay }` | mutable refs for canvas loop |
| `useReducedMotion` | `boolean` | SSR-safe (default false until mount) |

## Global styles

- `src/styles/tokens.css` — variables
- `src/styles/global.css` — reset, `.section-*`, `.page-section` utilities

Components use co-located CSS (`Component.css`).
