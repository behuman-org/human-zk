# Log de implementación — frontend

Registro de slices entregados en `feat/web-onboarding`.

---

## Slice 1b · Copy completo del producto

**Fecha:** 2026-06-24
**Rama:** `feat/web-onboarding`

### Objetivo

Completar la landing con la descripción real de beHuman: dos capas, flujo KYC (vault), plataforma, curaduría y comparativa extendida.

### Entregables

| Área | Paths |
|------|-------|
| Copy centralizado | `src/content/site.ts` |
| Nuevas secciones | `LayersSection`, `PlatformSection`, `CurationSection` |
| Secciones actualizadas | Hero, HowItWorks (4 fases), Stats, Compare (7 filas), Nav, Footer |
| Docs | `web/docs/COPY.md`, actualizados DESIGN, COMPONENTS, CHANGELOG |
| Tests | `App.test.tsx` — 4 casos por sección |

### Contenido clave documentado

- **CAPA 1:** Circom + Groth16 + `kyc_verifier` + issuer mock
- **CAPA 2:** `opinion_board` + `api` + curation (IA + humanos)
- **Puente:** `is_verified(address)` único entre capas
- **Modelo:** seudónimo estable, storage híbrido
- **Disclaimer:** issuer mock, no KYC regulado real

---

## Slice 1 · Landing + hero interactivo

**Fecha:** 2026-06-24
**Rama:** `feat/web-onboarding`

### Objetivo

Landing con referencia zk.me (animación hero al pointer), design system B/N + naranja.

### Verificación

```bash
npm run test:tdd
npm run lint --workspace @behuman/web
npm run build --workspace @behuman/web
npm run dev --workspace @behuman/web   # http://localhost:5173
```

### Pendiente (slice 2+)

- [ ] Stellar Wallets Kit en nav
- [ ] Rutas React Router (`/verify`, `/feed`)
- [ ] Integración `@behuman/sdk` en flujo onboarding
- [ ] Animaciones scroll-reveal (Intersection Observer)
