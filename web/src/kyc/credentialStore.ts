// Persistencia LOCAL (solo en el device) de la credencial de Capa 1, para poder reanudar
// el registro on-chain sin re-enrolar (el documento queda en el árbol del issuer; el
// `secret` es del usuario y no se puede regenerar). NO sale del navegador.
//
// SECURITY: secret + atributos cifrados con AES-GCM (ver lib/secureStorage.ts).
import type { AttributesInput } from "./Attributes";
import { secureFindByPrefix, secureGetItem, secureGetItemSyncLegacy, secureSetItem } from "../lib/secureStorage";

export interface StoredCredential {
  attributes: AttributesInput;
  secret: string;
  issuerRoot: string;
  pathElements: string[];
  pathIndices: number[];
}

/** Normaliza docId igual que el issuer (de-dup). */
export function normalizeDocId(docId: string): string {
  return docId.trim().toLowerCase();
}

const KEY = (docId: string) => `behuman.cred.${normalizeDocId(docId)}`;
const KEY_PREFIX = "behuman.cred.";

const cache = new Map<string, StoredCredential>();
let warmPromise: Promise<void> | null = null;

/** Precarga credenciales cifradas en memoria (llamar al boot de sesión). */
export function warmCredentialCache(): Promise<void> {
  if (!warmPromise) {
    warmPromise = (async () => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(KEY_PREFIX)) {
            const docId = k.slice(KEY_PREFIX.length);
            const cred = await secureGetItem<StoredCredential>(k);
            if (cred) cache.set(docId, cred);
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }
  return warmPromise;
}

export function saveCredential(docId: string, cred: StoredCredential): void {
  const norm = normalizeDocId(docId);
  cache.set(norm, cred);
  void secureSetItem(KEY(docId), cred);
}

export function loadCredential(docId: string): StoredCredential | null {
  const norm = normalizeDocId(docId);
  const hit = cache.get(norm);
  if (hit) return hit;
  const legacy = secureGetItemSyncLegacy<StoredCredential>(KEY(docId));
  if (legacy) {
    cache.set(norm, legacy);
    void secureSetItem(KEY(docId), legacy);
    return legacy;
  }
  return null;
}

/** Lee credencial cifrada (AES-GCM) — usar en flujos async tras enroll previo. */
export async function loadCredentialAsync(docId: string): Promise<StoredCredential | null> {
  const norm = normalizeDocId(docId);
  const hit = cache.get(norm);
  if (hit) return hit;
  const sync = loadCredential(docId);
  if (sync) return sync;
  const encrypted = await secureGetItem<StoredCredential>(KEY(docId));
  if (encrypted) {
    cache.set(norm, encrypted);
    return encrypted;
  }
  return null;
}

/** Devuelve cualquier credencial guardada en este device (la Capa 2 no conoce el docId). */
export function loadAnyCredential(): StoredCredential | null {
  if (cache.size > 0) return cache.values().next().value ?? null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) {
        const docId = k.slice(KEY_PREFIX.length);
        const cred = loadCredential(docId);
        if (cred) return cred;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Async: garantiza lectura tras warm (incluye datos solo cifrados). */
export async function loadAnyCredentialAsync(): Promise<StoredCredential | null> {
  await warmCredentialCache();
  return loadAnyCredential() ?? (await secureFindByPrefix<StoredCredential>(KEY_PREFIX))?.value ?? null;
}
