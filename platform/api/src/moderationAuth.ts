// SECURITY: Protección de endpoints de moderación humana (cola + resolución).
import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

let warnedDevModSecret = false;

function moderationSecret(): string {
  const s = process.env.MODERATION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("[moderation] MODERATION_SECRET es obligatorio en producción");
  }
  if (!warnedDevModSecret) {
    console.warn("[moderation] MODERATION_SECRET no configurado — usando default de desarrollo (inseguro)");
    warnedDevModSecret = true;
  }
  return "dev-moderation-secret-change-me";
}

function providedSecret(req: Request): string | null {
  const header = req.headers["x-moderation-secret"];
  if (typeof header === "string" && header) return header;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim() || null;
  return null;
}

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Middleware: exige MODERATION_SECRET vía X-Moderation-Secret o Bearer. */
export function requireModerationAuth(req: Request, res: Response, next: NextFunction): void {
  const provided = providedSecret(req);
  if (!provided || !secretsMatch(provided, moderationSecret())) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

/** ¿El request tiene credenciales de moderador? (para bypass de cuarentena en GET). */
export function isModeratorRequest(req: Request): boolean {
  const provided = providedSecret(req);
  if (!provided) return false;
  return secretsMatch(provided, moderationSecret());
}
