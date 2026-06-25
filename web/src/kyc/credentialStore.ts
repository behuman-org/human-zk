// Persistencia LOCAL (solo en el device) de la credencial de Capa 1, para poder reanudar
// el registro on-chain sin re-enrolar (el documento queda en el árbol del issuer; el
// `secret` es del usuario y no se puede regenerar). NO sale del navegador.
import type { AttributesInput } from "./Attributes";

export interface StoredCredential {
  attributes: AttributesInput;
  secret: string;
  issuerRoot: string;
  pathElements: string[];
  pathIndices: number[];
}

const KEY = (docId: string) => `behuman.cred.${docId}`;

export function saveCredential(docId: string, cred: StoredCredential): void {
  try {
    localStorage.setItem(KEY(docId), JSON.stringify(cred));
  } catch {
    /* almacenamiento no disponible: seguimos sin persistir */
  }
}

export function loadCredential(docId: string): StoredCredential | null {
  try {
    const raw = localStorage.getItem(KEY(docId));
    return raw ? (JSON.parse(raw) as StoredCredential) : null;
  } catch {
    return null;
  }
}

/** Devuelve cualquier credencial guardada en este device (la Capa 2 no conoce el docId). */
export function loadAnyCredential(): StoredCredential | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("behuman.cred.")) {
        return JSON.parse(localStorage.getItem(k)!) as StoredCredential;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
