import { randomBytes } from "node:crypto";

let cachedPepper: string | null = null;

/**
 * Pepper obligatorio para de-dup anti-Sybil (`sha256(docId + pepper)`).
 * En producción falla al iniciar si falta; en dev/test usa uno efímero con WARNING.
 */
export function getDedupPepper(): string {
  if (cachedPepper) return cachedPepper;

  const fromEnv = process.env.DEDUP_PEPPER?.trim();
  if (fromEnv) {
    cachedPepper = fromEnv;
    return cachedPepper;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DEDUP_PEPPER no está configurado. Sin pepper, sha256(docId) es precomputable — " +
        "definí un secreto fuerte en el entorno del matcher.",
    );
  }

  cachedPepper = randomBytes(32).toString("hex");
  console.warn(
    "⚠️  SECURITY: DEDUP_PEPPER no configurado — usando pepper efímero en memoria. " +
      "El de-dup se resetea al reiniciar y NO es seguro fuera de dev/test.",
  );
  return cachedPepper;
}
