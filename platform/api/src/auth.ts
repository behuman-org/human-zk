// SECURITY: Autenticación ligera por sesión HMAC atada a platformId.
//
// Modelo de garantía:
// 1. POST /auth exige una prueba Groth16 de membership (circuito post.circom) verificada
//    off-chain contra la VK de plataforma. El platformId sale SOLO de publicSignals[1]
//    (no del body del cliente).
// 2. Tras verificación, el server emite un token HMAC (SESSION_SECRET) con platformId + exp.
// 3. Los POST mutantes exigen Bearer token; el platformId del token prevalece sobre el body.
//
// Limitación documentada: el token demuestra que el cliente obtuvo una prueba válida en
// /auth; no re-atamos cada POST a una prueba ZK fresca (trade-off pragmático vs. costo).
// La integridad del contenido se valida aparte recomputando contentHash server-side.
import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextFunction, Request, Response } from "express";
import { verifyProofLocally } from "@behuman/sdk";

const here = dirname(fileURLToPath(import.meta.url));
const PLATFORM_VK = resolve(here, "..", "..", "..", "platform", "circuits", "build", "verification_key.json");

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

export interface MembershipProof {
  proof: unknown;
  publicSignals: string[]; // [issuerRoot, platformId, contentHash]
}

let warnedDevSecret = false;

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("[auth] SESSION_SECRET es obligatorio en producción");
  }
  if (!warnedDevSecret) {
    console.warn("[auth] SESSION_SECRET no configurado — usando default de desarrollo (inseguro)");
    warnedDevSecret = true;
  }
  return "dev-session-secret-change-me";
}

/** platformId hex (0x...) derivado de publicSignals[1] del circuito. */
export function platformIdFromSignals(publicSignals: string[]): string {
  return "0x" + BigInt(publicSignals[1]).toString(16).padStart(64, "0");
}

let platformVk: unknown | null = null;
function loadPlatformVk(): unknown | null {
  if (platformVk) return platformVk;
  if (!existsSync(PLATFORM_VK)) return null;
  platformVk = JSON.parse(readFileSync(PLATFORM_VK, "utf8"));
  return platformVk;
}

/** Verifica prueba de membership; devuelve platformId de confianza o null. */
export async function verifyMembershipProof(mp?: MembershipProof): Promise<string | null> {
  if (!mp?.proof || !Array.isArray(mp.publicSignals) || mp.publicSignals.length < 2) return null;
  const vk = loadPlatformVk();
  if (!vk) {
    console.warn("[auth] VK de plataforma no encontrada — /auth rechazará pruebas");
    return null;
  }
  try {
    const ok = await verifyProofLocally(mp as never, vk);
    return ok ? platformIdFromSignals(mp.publicSignals) : null;
  } catch {
    return null;
  }
}

export function issueSessionToken(platformId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = JSON.stringify({ platformId, exp: expiresAt });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
  return { token: `${payloadB64}.${sig}`, expiresAt };
}

export function verifySessionToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", sessionSecret()).update(payloadB64).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { platformId, exp } = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as {
      platformId: string;
      exp: number;
    };
    if (!platformId || Date.now() > exp) return null;
    return platformId;
  } catch {
    return null;
  }
}

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/** Middleware: exige sesión válida; adjunta req.platformId (ignorar platformId del body). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const platformId = verifySessionToken(token);
  if (!platformId) {
    res.status(401).json({ error: "invalid_or_expired_token" });
    return;
  }
  (req as Request & { platformId: string }).platformId = platformId;
  next();
}

export function authPlatformId(req: Request): string {
  return (req as Request & { platformId: string }).platformId;
}
