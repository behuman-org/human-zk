// Gating de donación/participación por PERSONHOOD (Capa 1) — membership, NO is_verified(address).
// El donante presenta una prueba de pertenencia (circuito de plataforma, Capa 2) y se
// verifica con snarkjs contra la VK. Identidad nunca revelada; wallet de donación anónima.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyProofLocally } from "@behuman/sdk";

const here = dirname(fileURLToPath(import.meta.url));
// Reusa la VK del circuito de plataforma (membership + platformId), ya construido en Capa 2.
const PLATFORM_VK = resolve(here, "..", "..", "..", "platform", "circuits", "build", "verification_key.json");

export interface MembershipProof {
  proof: unknown;
  publicSignals: string[]; // [issuerRoot, platformId, ...]
}

/** Verifica que el solicitante es un humano verificado (sin revelar quién). */
export async function verifyMembership(mp?: MembershipProof): Promise<boolean> {
  if (!mp || !Array.isArray(mp.publicSignals) || mp.publicSignals.length === 0) return false;
  // dev: se acepta la membership declarada (mock para construir/testear el flujo).
  if ((process.env.FUNDING_PROVIDER ?? "dev") === "dev") return true;
  // real: verificación criptográfica de la prueba de pertenencia con snarkjs.
  if (!existsSync(PLATFORM_VK)) return false;
  try {
    const vk = JSON.parse(readFileSync(PLATFORM_VK, "utf8"));
    return await verifyProofLocally(mp as never, vk);
  } catch {
    return false;
  }
}
