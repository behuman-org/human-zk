// Cliente del gate (matcher). La PII (DNI + frames) va al backend por multipart;
// el backend nunca devuelve imágenes, solo el resultado.
import type { EnrollmentResult, MatchResult } from "@behuman/shared";
import { requireEnv } from "../lib/envGuard";

const BASE = requireEnv("VITE_MATCHER_URL", "http://localhost:8787");

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

export interface DataCheckResult {
  ok: boolean;
  reasons: string[];
  mismatches: string[]; // "doc_number" | "birth_year" | "country"
}

/**
 * Anti-fraude: coteja los datos declarados contra el OCR del DNI. Si `ok` es false, el DNI
 * debe rebotarse (subir uno válido que coincida). La respuesta no contiene PII (solo campos).
 */
export async function verifyDocumentData(
  document: Blob,
  declared: { birthYear: number; docId: string; countryCode: number },
): Promise<DataCheckResult> {
  const fd = new FormData();
  fd.append("document", document, "dni.jpg");
  fd.append("birthYear", String(declared.birthYear));
  fd.append("docId", declared.docId);
  fd.append("countryCode", String(declared.countryCode));
  const res = await fetch(`${BASE}/verify-data`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`verify-data HTTP ${res.status}`);
  return (await res.json()) as DataCheckResult;
}

export async function verifyGate(document: Blob, frames: Blob[]): Promise<MatchResult> {
  const fd = new FormData();
  fd.append("document", document, "dni.jpg");
  frames.forEach((f, i) => fd.append("selfie", f, `frame${i}.jpg`));
  const res = await fetch(`${BASE}/verify`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`gate HTTP ${res.status}`);
  return (await res.json()) as MatchResult;
}

/**
 * Gate (match+liveness+documento) + de-dup anti-Sybil + emisión: agrega el commitment
 * al árbol del issuer y devuelve issuerRoot + camino Merkle. El `secret` NO se envía.
 */
export async function enroll(
  document: Blob,
  frames: Blob[],
  commitment: string,
  declared: { docId: string; birthYear: number; countryCode: number },
): Promise<EnrollmentResult> {
  const fd = new FormData();
  fd.append("document", document, "dni.jpg");
  frames.forEach((f, i) => fd.append("selfie", f, `frame${i}.jpg`));
  fd.append("commitment", commitment);
  fd.append("docId", declared.docId);
  // Datos declarados para el cotejo anti-fraude en el issuer (efímeros; no se persisten).
  fd.append("birthYear", String(declared.birthYear));
  fd.append("countryCode", String(declared.countryCode));
  const res = await fetch(`${BASE}/enroll`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`enroll HTTP ${res.status}`);
  return (await res.json()) as EnrollmentResult;
}
