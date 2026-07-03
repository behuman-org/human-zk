// Hash canónico de contenido (Capa 2): idéntico a web/src/platform/zk2.ts contentHashField.
// SHA-256 del texto con los 2 bits altos en 0 (< r_bls12381). Decimal string, NO hex completo.
import { createHash } from "node:crypto";

/** contentHash = sha256(content) con los 2 bits altos en 0 (< r_bls12381). */
export function contentHashField(content: string): string {
  const digest = createHash("sha256").update(content).digest();
  digest[0] &= 0x3f;
  return BigInt("0x" + digest.toString("hex")).toString();
}

/** Cadena canónica de respuesta (web/src/identity/reply.ts). */
export function replyCanonical(parentId: string, content: string): string {
  return JSON.stringify({ p: parentId, c: content });
}

/** Cadena canónica de artículo (web/src/identity/article.ts). */
export function articleCanonical(title: string, banner: string, content: string): string {
  return JSON.stringify({ t: title, b: banner, c: content });
}

/** Rechaza si el hash recibido no coincide con el recomputado server-side. */
export function assertContentHash(canonical: string, received: string): boolean {
  if (!received) return false;
  return contentHashField(canonical) === received;
}
