// Interfaz IdentityProvider — el límite swappable del gate de Capa 1.
//
// Hoy: MatcherTestnetProvider (face match local con face-api).
// Mañana: RenaperProvider (match contra foto oficial vía SID) — misma firma.
// El issuer no sabe cuál está atrás: se elige por env IDENTITY_PROVIDER.
import type { IdentityProviderKind, MatchResult } from "@behuman/shared";
import { MatcherTestnetProvider } from "./testnetProvider.js";
import { RenaperProvider } from "./renaperProvider.js";
import { DevProvider } from "./devProvider.js";

/** Entrada del gate: foto del DNI + frames de la cámara en vivo. PII efímera. */
export interface GateInput {
  document: Buffer; // imagen del frente del DNI (con la cara)
  selfieFrames: Buffer[]; // frames capturados en vivo (>=3 para liveness)
}

export interface IdentityProvider {
  readonly kind: IdentityProviderKind;
  /** Devuelve OK/score/razones. NUNCA imágenes ni embeddings. */
  verifyIdentity(input: GateInput): Promise<MatchResult>;
}

/** Devuelve el provider activo según `IDENTITY_PROVIDER` (default: testnet). */
export function getProvider(): IdentityProvider {
  const kind = (process.env.IDENTITY_PROVIDER ?? "testnet") as IdentityProviderKind;
  if (kind === "dev" && process.env.NODE_ENV === "production") {
    throw new Error(
      "IDENTITY_PROVIDER=dev está prohibido en producción — aprueba cualquier identidad sin biometría.",
    );
  }
  if (kind === "renaper") return new RenaperProvider();
  if (kind === "dev") return new DevProvider();
  return new MatcherTestnetProvider();
}
