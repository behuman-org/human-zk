# Design system — beHuman web

> Visual reference: [zk.me](https://www.zk.me/) — **inspiration**, not literal copy.
> Own identity: proof of personhood + Stellar + verified opinion platform.

## Principles

1. **Monochrome + accent** — deep black, white text, orange `#f97316` for CTAs and highlights.
2. **Purposeful motion** — hero reacts to pointer; rest uses soft reveals.
3. **Accessibility** — `prefers-reduced-motion` disables trail and parallax; AA contrast on main text.
4. **No external embeds** — no Unicorn Studio; own canvas/CSS.

## Palette (CSS variables)

Defined in `src/styles/tokens.css`:

| Token | Value | Use |
|-------|-------|-----|
| `--color-bg` | `#0a0a0a` | Main background |
| `--color-bg-deep` | `#000000` | Vignette / footer |
| `--color-accent` | `#f97316` | Headline italic, labels, CTAs |
| `--color-accent-bright` | `#fb923c` | Hover, stats |
| `--color-text` | `#ffffff` | Primary text |
| `--color-text-muted` | `#a3a3a3` | Lead, table cells |
| `--color-border` | `rgba(255,255,255,0.12)` | Glass cards, nav |

## Typography

| Role | Font | Fallback |
|-----|--------|----------|
| UI / marketing | Plus Jakarta Sans | system-ui |
| ZK snippets | JetBrains Mono | monospace |

Loaded via Google Fonts in `index.html`.

## Interactive hero

Simplified equivalent to zk.me Unicorn Studio embed:

| zk.me layer | beHuman implementation |
|------------|------------------------|
| `mouseDraw` (trail) | `usePointerTrail` + fading circles on canvas |
| `glyphDither` / parallax | CSS dot-grid with pointer-based `transform` |
| Caustics / beam / gradient | 3 radial orbs on canvas with `usePointerSpring` |
| Ambient animation | `sin(time)` drift when motion enabled |

### Hooks

- `usePointerSpring` — normalized 0–1 position with inertia (`strength` default 0.08).
- `usePointerTrail` — point queue with decreasing `life`.
- `useReducedMotion` — reads `prefers-reduced-motion`.

### Reduced motion fallback

- Static centered orbs (no trail, no grid parallax).
- Stack marquee → static wrap.

## UI components

| Variant | Use |
|----------|-----|
| `Button` primary | Main CTA (orange glow outline) |
| `Button` secondary | Secondary actions (white glass) |
| `Button` ghost | Compact nav (orange fill, black text) |
| `Badge` | Uppercase pill on hero |

## Landing sections (slice 1)

1. **Hero** — what beHuman is, proof of personhood, CTAs, stack marquee.
2. **Architecture** — LAYER 1 (KYC-ZK) + LAYER 2 (platform), bridge `is_verified`.
3. **KYC flow** — 4 vault phases: issuance → proof → verification → consumption.
4. **Platform** — on-chain anchor, off-chain content, stable pseudonym.
5. **Curation** — AI agent + human moderation, anti-censorship principle.
6. **Stats** — protocol design metrics.
7. **Compare** — 7 rows traditional vs beHuman.

## Responsive (required)

**Project rule:** every component and section must work on mobile, tablet, and desktop.

### Breakpoints (`tokens.css`)

| Token | Value | Typical use |
|-------|-------|------------|
| `--bp-sm` | 480px | Stacked → row CTAs; short nav text |
| `--bp-md` | 768px | 2-col grids; desktop nav; 4-col stats |
| `--bp-lg` | 1024px | Wide layouts |
| `--bp-xl` | 1100px | 4-col KYC flow; spaced nav links |

**Mobile-first** approach: base styles for small screens; `@media (min-width: …)` to scale.

### Patterns

- **Gutter / sections:** `clamp()` in `--space-gutter` and `--space-section`.
- **Typography:** `clamp()` on titles and leads; avoid fixed sizes on long copy.
- **Nav:** hamburger menu `<1100px` (desktop links only on wide screens); dropdown panel; abbreviated wallet `<640px`.
- **Hero:** `100svh`, safe-area insets, full-width CTAs on mobile; marquee with `contain: strict`.
- **Tables (Compare):** stacked cards on mobile; grid with `minmax(0,1fr)` on desktop.
- **Grids:** 1 col → 2 → 3/4 per section; never rely only on horizontal scroll.
- **Inline code:** `overflow-wrap: anywhere` + `pre-wrap` on long snippets.
- **Anchors:** `scroll-padding-top` compensates fixed nav.
- **Global overflow:** `overflow-x: clip` on `html`, `body`, `#root`, `main` as safety net.

### Safe areas

`--safe-top` / `--safe-bottom` for notch and home indicator (iOS).

## Disabled CTAs (intentional)

- `Start verification` — pending `@behuman/sdk` flow.
- `Connect wallet` — pending Stellar Wallets Kit.

Document in IMPLEMENTATION.md when enabled.
