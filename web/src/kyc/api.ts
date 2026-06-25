// Cliente del gate (matcher). La PII (DNI + frames) va al backend por multipart;
// el backend nunca devuelve imágenes, solo el resultado.
import type { MatchResult } from "@behuman/shared";

const BASE = import.meta.env.VITE_MATCHER_URL ?? "http://localhost:8787";

export interface DocumentCheckResult {
  ok: boolean;
  reasons: string[];
}

/** Valida que la imagen sea un documento de identidad (DNI), no una foto cualquiera. */
export async function checkDocument(document: Blob): Promise<DocumentCheckResult> {
  const fd = new FormData();
  fd.append("document", document, "dni.jpg");
  const res = await fetch(`${BASE}/document`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`document HTTP ${res.status}`);
  return (await res.json()) as DocumentCheckResult;
}

export async function verifyGate(document: Blob, frames: Blob[]): Promise<MatchResult> {
  const fd = new FormData();
  fd.append("document", document, "dni.jpg");
  frames.forEach((f, i) => fd.append("selfie", f, `frame${i}.jpg`));
  const res = await fetch(`${BASE}/verify`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`gate HTTP ${res.status}`);
  return (await res.json()) as MatchResult;
}
