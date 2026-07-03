# Copy de la landing — beHuman

Texto centralizado en `src/i18n/locales/{es,en}.ts`. Alineado a `README.md`, `CLAUDE.md` y la vault Obsidian (`obsidian-vault-zk`).

## Secciones

| Sección | ID | Contenido |
|---------|-----|-----------|
| Hero | — | Qué es beHuman, proof of personhood, stack |
| Arquitectura | `#capas` | CAPA 1 identidad + CAPA 2 plataforma, puente `is_verified` |
| Flujo KYC | `#como-funciona` | 4 fases: emisión → prueba → verificación → consumo |
| Plataforma | `#plataforma` | opinion_board, api, seudónimo, tipos de post |
| Curaduría | `#curacion` | Agente IA + moderación humana, principio anti-censura |
| Protocolo | — | Stats de diseño (2 capas, 1 puente, 0 PII on-chain, 4 fases) |
| Comparativa | `#compare` | 7 filas tradicional vs beHuman |

## Disclaimers obligatorios

- **Issuer mock** — declarado en hero flow paso 01 y footer
- **Stellar Hacks: Real-World ZK** — enlace en footer y disclaimer de auth (`siteMeta.hackathon`)

## Editar copy

1. Modificar `src/i18n/locales/es.ts` y `en.ts`
2. Actualizar este archivo si cambia estructura de secciones
3. Correr `npm run test --workspace @behuman/web` si cambian textos usados en tests
