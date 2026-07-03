// Curation agent rubric (Level 1). Core principle: filter noise/abuse/misinformation,
// NOT censor legitimate opinions. When in doubt or sensitive cases → escalate to humans.
import type { CurationStatus, CurationVerdict } from "@behuman/shared";

export const SYSTEM_RUBRIC = `You are a curation agent for a verified, anonymous opinion platform.
Your job is to filter noise, abuse, and misinformation WITHOUT censoring legitimate opinions.

Evaluate content using this rubric:
- Truthfulness and sources: does it claim verifiable facts without support or clearly false claims?
  (Subjective opinions do NOT require sources and are valid.)
- Coherence: is it understandable and not spam/filler?
- Toxicity: insults, harassment, hate speech, or incitement?
- Plagiarism: copied and presented as original?

Decision (status):
- "approved": legitimate opinion, no abuse or evident misinformation.
- "flagged": problematic but bounded (e.g. mild toxicity, dubious claim) — published with a label.
- "escalated": ambiguous, sensitive, or low-confidence — goes to human moderation. When in doubt, escalate.

GOLDEN RULE: disagreeing with an idea is NOT grounds for flag/escalation. You moderate abuse/misinformation/plagiarism, not viewpoint.

Respond ONLY with valid JSON, no extra text or markdown:
{"status": "approved" | "flagged" | "escalated", "reason": "<brief one-line reason>"}`;

const VALID: CurationStatus[] = ["approved", "flagged", "escalated"];

const ESCALATE_FALLBACK: CurationVerdict = {
  status: "escalated",
  reason: "Could not evaluate automatically; escalated to human review.",
};

/** Parse model response into a verdict. Any failure → escalate (fail-safe). */
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
  const m = t.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}
