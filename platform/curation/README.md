# platform/curation · Validator agents + moderation

**Two-level** curation that maintains content quality/truthfulness without censorship.

> 📐 See in the vault: `Curaduría y Agentes Validadores`.

## Levels

1. **Validator agent (AI, automatic):** evaluates truthfulness, sources, coherence, toxicity,
   plagiarism. Uses **Groq API** (`GROQ_API_KEY`; model configurable with `CURATION_MODEL`,
   default `openai/gpt-oss-20b`). Posts, **articles**, and opinions pass through this level before
   publishing.
2. **Human moderation (escalation):** ambiguous or sensitive cases are **escalated** to a queue
   (`/moderation/queue` in the API, protected with `MODERATION_SECRET`).

> **Guiding principle:** do not lose human judgment — filter noise and abuse, not
> legitimate opinions.

## Fail-safe

Without `GROQ_API_KEY`, curation **does not silently approve**: escalates everything for review
(quarantine). API filters escalated content in GET posts/articles.

## Backlog

- Moderator governance (verified people? reputation?).
- Appeal of moderation decisions.
- On-chain curation (today off-chain).

```bash
npm install
npm run dev
```
