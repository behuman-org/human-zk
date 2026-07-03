# platform/curation · Agentes validadores + moderación

Curaduría en **dos niveles** que mantiene la calidad/veracidad del contenido sin censurar.

> 📐 Ver en la vault: `Curaduría y Agentes Validadores`.

## Niveles

1. **Agente validador (IA, automático):** evalúa veracidad, fuentes, coherencia, toxicidad,
   plagio. Usa la **API de Groq** (`GROQ_API_KEY`; modelo configurable con `CURATION_MODEL`,
   default `openai/gpt-oss-20b`). Posts, **artículos** y opiniones pasan por este nivel antes
   de publicarse.
2. **Moderación humana (derivación):** los casos ambiguos o sensibles se **escalan** a una cola
   (`/moderation/queue` en la API, protegida con `MODERATION_SECRET`).

> **Principio rector:** no perder el criterio de la persona — filtrar ruido y abuso, no
> acallar opiniones legítimas.

## Fail-safe

Sin `GROQ_API_KEY`, la curaduría **no aprueba silenciosamente**: escala todo a revisión
(cuarentena). La API filtra contenido escalado en GET de posts/artículos.

## Pendiente (backlog)

- Gobierno de moderadores (¿personas verificadas? ¿reputación?).
- Apelación de decisiones de moderación.
- Curaduría on-chain (hoy off-chain).

```bash
npm install
npm run dev
```
