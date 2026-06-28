// Respuesta a un tweet (Capa 2): mismo circuito, contrato y cuenta efímera que un post normal.
// La diferencia es el contentHash: ata `parentId + texto`, así la prueba ZK vincula la respuesta
// a su hilo (integridad + anti-replay). Sin nullifier: se puede responder varias veces con
// contenido distinto (responder no es un voto). Cero PII on-chain: solo platformId + contentHash.
import { anchorText, type Anchored } from "./anchor";

/** Cadena canónica que se hashea on-chain: atar la respuesta a su tweet padre. */
export function replyCanonical(parentId: string, content: string): string {
  return JSON.stringify({ p: parentId, c: content });
}

export function anchorReply(parentId: string, content: string): Promise<Anchored> {
  return anchorText(replyCanonical(parentId, content));
}
