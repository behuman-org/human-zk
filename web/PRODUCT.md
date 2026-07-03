# Product

## Register

product

## Users

Personas reales que quieren participar en conversación pública verificada: publicar opiniones, artículos y causas sin exponer PII, con la garantía de ser humanos únicos (proof of personhood vía KYC-ZK). Contexto de uso: alternan entre descubrir el proyecto (landing) y operar en la plataforma social (`/app/*`) — feed, perfiles, mensajes, artículos, causas, settings. El trabajo principal ocurre en la app; la landing convierte y explica el protocolo.

## Product Purpose

beHuman demuestra que una persona es real y única sin revelar identidad (CAPA 1 · KYC-ZK on Stellar) y habilita una plataforma de opinión donde solo humanos verificados publican con seudónimo estable (CAPA 2). Éxito = flujos claros de verificación → participación → confianza en el badge humano, sin sensación de crypto-bro ni clon de red social tóxica.

## Brand Personality

Humano · Cálido · Transparente. Voz directa, empática, sin hype. La prueba de persona y la privacidad se explican con claridad, no con jerga inflada. El diseño transmite cercanía y credibilidad técnica a la vez.

## Anti-references

- **Crypto-bro:** neón excesivo, FOMO, métricas infladas, dark + gold, “moon” energy.
- **Clon de Twitter/X:** feed infinito caótico, engagement bait, ruido algorítmico, UI agresiva.
- **Inventar identidad visual desde cero** cuando ya hay tokens, componentes y patrones en el repo — siempre extender lo existente.

## Design Principles

1. **Extender, no reinventar** — anclar en `tokens.css`, `behuman-ui.css`, `social-ui.css` y componentes ya construidos; las variantes deben sentirse nativas del sistema actual (tema claro, acento celeste, Plus Jakarta Sans).
2. **Humano antes que protocolo** — copy y UI priorizan la persona verificada y su voz; la cripto/ZK aparece cuando aporta confianza, no como decoración.
3. **Landing y app con el mismo rigor** — mismos tokens, motion con propósito y accesibilidad en `/` y en `/app/*`; no tratar la landing como “marketing genérico” ni la app como “afterthought”.
4. **Transparencia honesta** — declarar issuer mock, matcher que recibe PII por HTTPS (sin
   persistir), funding dev-only y límites actuales; nunca simular métricas o verificación
   regulada que no existe.
5. **Social calmado** — feed legible, jerarquía clara, acciones deliberadas; evitar densidad que compita con la atención del usuario.

## Accessibility & Inclusion

Aspirar a WCAG 2.1 AAA donde sea razonable; mínimo AA en todo texto y control interactivo. `prefers-reduced-motion` ya desactiva trail/parallax — mantener y extender a nuevas animaciones. Foco visible estricto (`:focus-visible`), contraste generoso en texto muted, touch targets ≥44px en móvil, soporte i18n (es/en) coherente en labels y estados de error.
