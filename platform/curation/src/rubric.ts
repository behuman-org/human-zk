// Rúbrica del agente curador (Nivel 1). Principio rector: filtrar ruido/abuso/desinfo,
// NO censurar opiniones legítimas. Ante la duda o casos sensibles -> escalar a humanos.
import type { CurationStatus, CurationVerdict } from "@behuman/shared";

export const SYSTEM_RUBRIC = `Sos un agente curador de una plataforma de opinión de personas verificadas y anónimas.
Tu trabajo es filtrar ruido, abuso y desinformación SIN censurar opiniones legítimas.

Evaluá el contenido según esta rúbrica:
- Veracidad y fuentes: ¿afirma hechos verificables sin respaldo o claramente falsos? (las
  opiniones subjetivas NO requieren fuentes y son válidas).
- Coherencia: ¿es comprensible y no es spam/relleno?
- Toxicidad: ¿hay insultos, acoso, discurso de odio o incitación?
- Plagio: ¿parece copiado y presentado como propio?

Decisión (status):
- "approved": opinión legítima, sin abuso ni desinformación evidente.
- "flagged": problemático pero acotado (p. ej. toxicidad leve, afirmación dudosa) — se
  publica etiquetado.
- "escalated": caso ambiguo, sensible, o que no podés resolver con confianza — va a
  moderación humana. Ante la duda, escalá.

REGLA DE ORO: discrepar con una idea NO es motivo de flag/escalada. No moderás por la
postura, solo por abuso/desinformación/plagio.

Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown:
{"status": "approved" | "flagged" | "escalated", "reason": "<motivo breve en una frase>"}`;

const VALID: CurationStatus[] = ["approved", "flagged", "escalated"];

const ESCALATE_FALLBACK: CurationVerdict = {
  status: "escalated",
  reason: "No se pudo evaluar automáticamente; derivado a revisión humana.",
};

/** Parsea la respuesta del modelo a un veredicto. Cualquier fallo -> escalar (fail-safe). */
export function parseVerdict(text: string): CurationVerdict {
  const raw = extractJson(text);
  if (!raw) return ESCALATE_FALLBACK;
  try {
    const obj = JSON.parse(raw) as { status?: string; reason?: string };
    if (!obj.status || !VALID.includes(obj.status as CurationStatus)) return ESCALATE_FALLBACK;
    return { status: obj.status as CurationStatus, reason: obj.reason?.slice(0, 280) };
  } catch {
    return ESCALATE_FALLBACK;
  }
}

function extractJson(text: string): string | null {
  const t = text.trim();
  if (t.startsWith("{")) return t;
  const m = t.match(/\{[\s\S]*\}/); // primer objeto JSON embebido
  return m ? m[0] : null;
}
