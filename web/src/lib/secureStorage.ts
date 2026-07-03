// SECURITY: Cifrado AES-GCM en reposo para secretos en localStorage.
// Trade-off: la clave maestra vive en sessionStorage (por sesión de pestaña). Protege
// frente a lectura offline del disco y dumps casuales de localStorage; un XSS activo en
// la misma sesión aún podría descifrar. Migración automática desde texto plano legacy.

const SESSION_KEY = "behuman.storage.master";
const ENC_PREFIX = "enc:v1:";

async function getOrCreateMasterKey(): Promise<CryptoKey | null> {
  if (typeof crypto?.subtle === "undefined") return null;
  try {
    let rawB64 = sessionStorage.getItem(SESSION_KEY);
    if (!rawB64) {
      const raw = crypto.getRandomValues(new Uint8Array(32));
      rawB64 = btoa(String.fromCharCode(...raw));
      sessionStorage.setItem(SESSION_KEY, rawB64);
    }
    const raw = Uint8Array.from(atob(rawB64), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw.buffer, "AES-GCM", false, ["encrypt", "decrypt"]);
  } catch {
    return null;
  }
}

let masterKeyPromise: Promise<CryptoKey | null> | null = null;
function masterKey(): Promise<CryptoKey | null> {
  masterKeyPromise ??= getOrCreateMasterKey();
  return masterKeyPromise;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await masterKey();
  if (!key) return plaintext;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    toArrayBuffer(encoded),
  );
  const ctBytes = new Uint8Array(ct);
  const packed = new Uint8Array(iv.length + ctBytes.length);
  packed.set(iv, 0);
  packed.set(ctBytes, iv.length);
  return ENC_PREFIX + btoa(String.fromCharCode(...packed));
}

async function decrypt(stored: string): Promise<string | null> {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const key = await masterKey();
  if (!key) return null;
  try {
    const packed = Uint8Array.from(atob(stored.slice(ENC_PREFIX.length)), (c) => c.charCodeAt(0));
    const iv = packed.slice(0, 12);
    const ct = packed.slice(12);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      toArrayBuffer(ct),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

function looksLikeLegacyJson(raw: string): boolean {
  const t = raw.trim();
  return t.startsWith("{") || t.startsWith("[");
}

export async function secureSetItem(key: string, value: unknown): Promise<void> {
  try {
    const plain = JSON.stringify(value);
    const stored = await encrypt(plain);
    localStorage.setItem(key, stored);
  } catch {
    /* storage no disponible */
  }
}

export async function secureGetItem<T>(key: string): Promise<T | null> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    let plain: string | null;
    if (raw.startsWith(ENC_PREFIX)) {
      plain = await decrypt(raw);
    } else if (looksLikeLegacyJson(raw)) {
      plain = raw;
      void secureSetItem(key, JSON.parse(raw) as unknown);
    } else {
      plain = raw;
    }
    if (!plain) return null;
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}

export function secureGetItemSyncLegacy<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.startsWith(ENC_PREFIX)) return null;
    if (!looksLikeLegacyJson(raw)) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function secureFindByPrefix<T>(prefix: string): Promise<{ key: string; value: T } | null> {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const v = await secureGetItem<T>(k);
        if (v) return { key: k, value: v };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
