// Gating de donación/participación por PERSONHOOD (Capa 1) — membership, NO is_verified(address).
// El donante presenta una prueba de pertenencia (circuito de plataforma, Capa 2) y se
// verifica con snarkjs contra la VK. Identidad nunca revelada; wallet de donación anónima.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bindFundingOpinion,
  verifyFundingOpinionProof,
  verifyProofLocally,
  type FundingOpinionClaims,
} from "@behuman/sdk";

const here = dirname(fileURLToPath(import.meta.url));
// Reusa la VK del circuito de plataforma (membership + platformId), ya construido en Capa 2.
const PLATFORM_VK = resolve(here, "..", "..", "..", "platform", "circuits", "build", "verification_key.json");
// VK del circuito de OPINIÓN POR CAMPAÑA (Capa 3) — scope/nullifier por campaña.
const FUNDING_VK = resolve(here, "..", "..", "..", "funding", "circuits", "build", "verification_key.json");

export interface MembershipProof {
  proof: unknown;
  publicSignals: string[]; // [issuerRoot, platformId, ...]
}

export interface FundingOpinionProofInput {
  proof: unknown;
  publicSignals: string[]; // [issuerRoot, platformId, nullifier, scope, nullScope, contentHash]
}

let loggedMissingPlatformVk = false;

/**
 * Verifica que el solicitante es un humano verificado (sin revelar quién).
 *
 * RT-02/RT-05: la prueba de pertenencia se verifica criptográficamente en CUALQUIER modo
 * (la web genera pruebas reales). Ya NO se acepta una membership "declarada" sin prueba.
 *
 * Limitación documentada (RT-05): el circuito de plataforma NO ata la prueba a la
 * `donorWallet` (sería un cambio del circuito trusteado, fuera de alcance). Por eso una
 * prueba de membership válida solo demuestra "existe ≥1 humano verificado", no unicidad por
 * wallet. Mitigación a nivel API/web: wallet efímera POR donación (no por sesión) y
 * /position no expone montos por wallet arbitraria (ver server.ts).
 */
export async function verifyMembership(mp?: MembershipProof): Promise<boolean> {
  if (!mp || !Array.isArray(mp.publicSignals) || mp.publicSignals.length === 0) return false;
  if (!existsSync(PLATFORM_VK)) {
    if (!loggedMissingPlatformVk) {
      loggedMissingPlatformVk = true;
      console.error(
        "[funding-gating] Falta platform/circuits/build/verification_key.json — compilar el circuito de plataforma " +
          "(cd platform/circuits && npm i && bash scripts/compile.sh && bash scripts/setup.sh). " +
          "Todas las donaciones serán rechazadas hasta que exista la VK.",
      );
    }
    return false;
  }
  try {
    const vk = JSON.parse(readFileSync(PLATFORM_VK, "utf8"));
    return await verifyProofLocally(mp as never, vk);
  } catch {
    return false;
  }
}

/**
 * Verifica la prueba de OPINIÓN POR CAMPAÑA y devuelve los claims de confianza
 * (issuerRoot/platformId/nullifier vienen DE la prueba, atados a esta campaña y contenido).
 * Devuelve `null` si la prueba es inválida o no corresponde a la campaña/contenido.
 *
 * RT-02: NO existe fallback "declared". En CUALQUIER modo (dev o real) se EXIGE una
 * `opinionProof` válida; platformId/nullifier salen SOLO de la prueba verificada. La web ya
 * genera pruebas reales con el circuito compilado, así que dev sigue funcionando.
 */
export async function verifyFundingOpinion(
  campaignId: string,
  content: string,
  op: FundingOpinionProofInput | undefined,
): Promise<FundingOpinionClaims | null> {
  if (!op?.proof || !Array.isArray(op.publicSignals)) return null;
  // Binding: scope/nullScope/contentHash de la prueba deben corresponder a campaña + contenido.
  const claims = bindFundingOpinion(op.publicSignals, campaignId, content);
  if (!claims) return null;
  // Verificación criptográfica de la prueba (obligatoria). Sin VK no se puede confiar.
  if (!existsSync(FUNDING_VK)) return null;
  try {
    const vk = JSON.parse(readFileSync(FUNDING_VK, "utf8"));
    const ok = await verifyFundingOpinionProof(op as never, vk);
    return ok ? claims : null;
  } catch {
    return null;
  }
}
