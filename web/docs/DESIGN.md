# Design system — beHuman web

> Referencia visual: [zk.me](https://www.zk.me/) — **inspiración**, no copia literal.
> Identidad propia: proof of personhood + Stellar + plataforma de opinión verificada.

## Principios

1. **Monocromo + acento** — negro profundo, texto blanco, naranja `#f97316` para CTAs y highlights.
2. **Motion con propósito** — el hero reacciona al pointer; el resto usa reveals suaves.
3. **Accesibilidad** — `prefers-reduced-motion` desactiva trail y parallax; contraste AA en texto principal.
4. **Sin embeds externos** — no Unicorn Studio; canvas/CSS propio.

## Paleta (CSS variables)

Definidas en `src/styles/tokens.css`:

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-bg` | `#0a0a0a` | Fondo principal |
| `--color-bg-deep` | `#000000` | Vignette / footer |
| `--color-accent` | `#f97316` | Headline italic, labels, CTAs |
| `--color-accent-bright` | `#fb923c` | Hover, stats |
| `--color-text` | `#ffffff` | Texto primario |
| `--color-text-muted` | `#a3a3a3` | Lead, celdas tabla |
| `--color-border` | `rgba(255,255,255,0.12)` | Glass cards, nav |

## Tipografía

| Rol | Fuente | Fallback |
|-----|--------|----------|
| UI / marketing | Plus Jakarta Sans | system-ui |
| Snippets ZK | JetBrains Mono | monospace |

Cargadas vía Google Fonts en `index.html`.

## Hero interactivo

Equivalente simplificado al embed Unicorn Studio de zk.me:

| Capa zk.me | Implementación beHuman |
|------------|------------------------|
| `mouseDraw` (trail) | `usePointerTrail` + círculos fading en canvas |
| `glyphDither` / parallax | Dot-grid CSS con `transform` según pointer |
| Caustics / beam / gradient | 3 orbes radiales en canvas con `usePointerSpring` |
| Animación ambiental | `sin(time)` drift cuando hay motion |

### Hooks

- `usePointerSpring` — posición normalizada 0–1 con inercia (`strength` default 0.08).
- `usePointerTrail` — cola de puntos con `life` decreciente.
- `useReducedMotion` — lee `prefers-reduced-motion`.

### Fallback reduced motion

- Orbes centrados estáticos (sin trail, sin parallax en grid).
- Marquee de stack → wrap estático.

## Componentes UI

| Variante | Uso |
|----------|-----|
| `Button` primary | CTA principal (outline naranja glow) |
| `Button` secondary | Acciones secundarias (glass blanco) |
| `Button` ghost | Nav compacto (fill naranja, texto negro) |
| `Badge` | Pill uppercase sobre hero |

## Secciones landing (slice 1)

1. **Hero** — qué es beHuman, proof of personhood, CTAs, marquee stack.
2. **Arquitectura** — CAPA 1 (KYC-ZK) + CAPA 2 (plataforma), puente `is_verified`.
3. **Flujo KYC** — 4 fases vault: emisión → prueba → verificación → consumo.
4. **Plataforma** — ancla on-chain, contenido off-chain, seudónimo estable.
5. **Curaduría** — agente IA + moderación humana, principio anti-censura.
6. **Stats** — métricas de diseño del protocolo.
7. **Compare** — 7 filas tradicional vs beHuman.

## Responsive (obligatorio)

**Regla de proyecto:** todo componente y sección debe funcionar en móvil, tablet y desktop.

### Breakpoints (`tokens.css`)

| Token | Valor | Uso típico |
|-------|-------|------------|
| `--bp-sm` | 480px | CTAs apilados → fila; texto corto en nav |
| `--bp-md` | 768px | Grids 2 cols; nav desktop; stats 4 cols |
| `--bp-lg` | 1024px | Layouts amplios |
| `--bp-xl` | 1100px | Flujo KYC 4 cols; nav links espaciados |

Enfoque **mobile-first**: estilos base para pantallas pequeñas; `@media (min-width: …)` para escalar.

### Patrones

- **Gutter / secciones:** `clamp()` en `--space-gutter` y `--space-section`.
- **Tipografía:** `clamp()` en títulos y leads; evitar tamaños fijos en copy largo.
- **Nav:** menú hamburguesa `<1100px` (links desktop solo en pantallas anchas); panel desplegable; wallet abreviado en `<640px`.
- **Hero:** `100svh`, safe-area insets, CTAs full-width en móvil; marquee con `contain: strict`.
- **Tablas (Compare):** cards apiladas en móvil; grid con `minmax(0,1fr)` en desktop.
- **Grids:** 1 col → 2 → 3/4 según sección; nunca depender solo de scroll horizontal.
- **Código inline:** `overflow-wrap: anywhere` + `pre-wrap` en snippets largos.
- **Anclas:** `scroll-padding-top` compensa nav fija.
- **Overflow global:** `overflow-x: clip` en `html`, `body`, `#root`, `main` como red de seguridad.

### Safe areas

`--safe-top` / `--safe-bottom` para notch y home indicator (iOS).

## CTAs deshabilitados (intencional)

- `Comenzar verificación` — pendiente flujo `@behuman/sdk`.
- `Conectar wallet` — pendiente Stellar Wallets Kit.

Documentar en IMPLEMENTATION.md cuando se habiliten.


Documentar en IMPLEMENTATION.md cuando se habiliten.
