# Catálogo de componentes

Estructura bajo `src/components/`.

## Layout

### `SiteNav`

Barra flotante pill con glassmorphism. Links ancla: `#capas`, `#como-funciona`, `#plataforma`, `#curacion`, `#compare`. CTA wallet deshabilitado.

### `SiteFooter`

Marca, tagline (behuman-org, **Stellar Hacks: Real-World ZK**, disclaimer issuer mock), enlaces GitHub + DoraHacks.

## Hero

### `HeroBackground`

Canvas + dot-grid. No recibe props. Respeta reduced motion internamente.

### `HeroSection`

Compone `HeroBackground`, badge, título, lead, CTAs y marquee del stack. Copy desde i18n (`locales/es.ts`, `locales/en.ts`).

## Secciones

### `LayersSection`

`id="capas"`. CAPA 1 identidad + CAPA 2 plataforma + CAPA 3 funding; puente Capa 1 =
`is_verified(address)`; Capa 2 = `platformId` ZK.

### `HowItWorksSection`

`id="como-funciona"`. **4** `step-card` (emisión → prueba → verificación → consumo).

### `StatsSection`

Grid 2×2 / 4 columnas con métricas placeholder.

### `CompareSection`

`id="compare"`. Tabla 7 filas: aspecto | tradicional | beHuman.

### `PlatformSection`

`id="plataforma"`. Tres pilares + badges opinión/artículo/estudio.

### `CurationSection`

`id="curacion"`. Dos niveles + blockquote principio rector.

## Contenido

Ver `src/i18n/locales/` y [COPY.md](./COPY.md).

## UI

### `Button`

```tsx
<Button variant="primary" | "secondary" | "ghost" disabled={...}>
```

Extiende atributos nativos de `<button>`.

### `Badge`

Pill uppercase para labels del hero.

## Hooks (`src/hooks/`)

| Hook | Retorno | Notas |
|------|---------|-------|
| `usePointerSpring` | `RefObject<{ x, y }>` normalizado | `enabled`, `strength` — sin re-render por frame |
| `usePointerTrail` | `{ points, decay }` | refs mutables para canvas loop |
| `useReducedMotion` | `boolean` | SSR-safe (default false hasta mount) |

## Estilos globales

- `src/styles/tokens.css` — variables
- `src/styles/global.css` — reset, utilidades `.section-*`, `.page-section`

Componentes usan CSS co-located (`Component.css`).
