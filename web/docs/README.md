# Documentación del frontend (`web/`)

Índice de documentación técnica y de diseño para beHuman.

| Documento | Contenido |
|-----------|-----------|
| [DESIGN.md](./DESIGN.md) | Referencia visual, tokens, animaciones, accesibilidad |
| [COPY.md](./COPY.md) | Textos de la landing y mapeo secciones |
| [COMPONENTS.md](./COMPONENTS.md) | Catálogo de componentes y props |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Log de implementación por slice (actualizado en cada entrega) |
| [CHANGELOG.md](./CHANGELOG.md) | Cambios notables del frontend |

## Rama activa

`feat/web-onboarding` — landing + hero interactivo (slice 1).

## Comandos

```bash
npm run dev --workspace @behuman/web   # http://localhost:5173
npm run test --workspace @behuman/web
npm run lint --workspace @behuman/web
```

## Próximos slices (planificado)

1. ~~Landing + hero interactivo~~ (este slice)
2. Conexión wallet (Stellar Wallets Kit)
3. Flujo issuer mock + generación prueba ZK
4. Estado `is_verified` + transición a plataforma de opinión
