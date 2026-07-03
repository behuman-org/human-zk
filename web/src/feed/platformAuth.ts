// Autenticación Bearer para platform/api (POST /auth con prueba Groth16 de membership).
import { generatePlatformProof } from "../platform/zk2";
import type { StoredCredential } from "../kyc/credentialStore";
import { requireEnv } from "../lib/envGuard";

const BASE = requireEnv("VITE_PLATFORM_API_URL", "http://localhost:8788");
const TOKEN_KEY = "behuman.platform.authToken";
const EXP_KEY = "behuman.platform.authExp";

interface AuthResponse {
  token: string;
  expiresAt: number;
}

function loadCachedToken(): { token: string; expiresAt: number } | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expRaw = sessionStorage.getItem(EXP_KEY);
    if (!token || !expRaw) return null;
    const expiresAt = Number(expRaw);
    if (!Number.isFinite(expiresAt)) return null;
    return { token, expiresAt };
  } catch {
    return null;
  }
}

function saveCachedToken(token: string, expiresAt: number): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EXP_KEY, String(expiresAt));
  } catch {
    /* ignore */
  }
}

export function clearPlatformAuth(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXP_KEY);
  } catch {
    /* ignore */
  }
}

/** Obtiene token válido; renueva con prueba de membership (contentHash=0) si expiró. */
export async function ensurePlatformAuth(cred: StoredCredential): Promise<string> {
  const cached = loadCachedToken();
  const skewMs = 60_000;
  if (cached && Date.now() < cached.expiresAt - skewMs) {
    return cached.token;
  }

  const membershipProof = await generatePlatformProof(cred, "0");
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ membershipProof }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `auth HTTP ${res.status}`);
  }
  const data = (await res.json()) as AuthResponse;
  saveCachedToken(data.token, data.expiresAt);
  return data.token;
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
