import { createHash, randomBytes } from "node:crypto";

interface EnrollSession {
  nonce: string;
  ip: string;
  birthYear: number;
  countryCode: number;
  createdAt: number;
  used: boolean;
}

const sessions = new Map<string, EnrollSession>();
const usedCommitments = new Set<string>();

function sessionKey(docId: string, birthYear: number, countryCode: number, ip: string): string {
  return createHash("sha256")
    .update(`${docId.trim().toLowerCase()}|${birthYear}|${countryCode}|${ip}`)
    .digest("hex");
}

function ttlMs(): number {
  const v = Number(process.env.ENROLL_SESSION_TTL_MS);
  return Number.isFinite(v) && v > 0 ? v : 30 * 60 * 1000;
}

function purgeExpired(now = Date.now()): void {
  for (const [key, s] of sessions) {
    if (s.used || now - s.createdAt > ttlMs()) sessions.delete(key);
  }
}

/**
 * Tras /verify-data exitoso: abre una sesión de enroll atada a docId + atributos + IP.
 * Evita replay de commitment entre flujos que no pasaron el cotejo previo.
 */
export function openEnrollSession(
  docId: string,
  birthYear: number,
  countryCode: number,
  ip: string,
): string {
  purgeExpired();
  const key = sessionKey(docId, birthYear, countryCode, ip);
  const nonce = randomBytes(16).toString("hex");
  sessions.set(key, { nonce, ip, birthYear, countryCode, createdAt: Date.now(), used: false });
  return nonce;
}

/** Consume la sesión de enroll. Devuelve false si no existe, expiró o ya se usó. */
export function consumeEnrollSession(
  docId: string,
  birthYear: number,
  countryCode: number,
  ip: string,
  enrollNonce?: string,
): boolean {
  purgeExpired();
  const key = sessionKey(docId, birthYear, countryCode, ip);
  const s = sessions.get(key);
  if (!s || s.used || Date.now() - s.createdAt > ttlMs()) return false;
  if (enrollNonce && enrollNonce !== s.nonce) return false;
  s.used = true;
  return true;
}

/** Evita re-submit del mismo commitment dentro de la ventana de sesión. */
export function claimCommitment(commitment: string): boolean {
  if (usedCommitments.has(commitment)) return false;
  usedCommitments.add(commitment);
  return true;
}
