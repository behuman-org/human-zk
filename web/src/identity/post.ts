// Ancla de opinión REAL (Capa 2): prueba ZK + registro on-chain en `opinion_board` con una
// cuenta efímera (NO la wallet del KYC). Devuelve el platformId real, el contentHash (atado a
// la prueba) y el txHash. La persistencia off-chain (POST /content) la hace el llamador.
// La identidad real nunca se muestra entera en la UI (solo el handle corto).
import { loadAnyCredential } from "../kyc/credentialStore";
import { contentHashField, generatePlatformProof, platformIdHex } from "../platform/zk2";
import { createFundedEphemeral } from "../platform/ephemeral";
import { postTweet, ContractError } from "../platform/chain2";

export interface AnchoredOpinion {
  platformId: string;
  contentHash: string;
  txHash: string;
}

/**
 * Genera la prueba y ancla la opinión on-chain. Requiere credencial Capa 1 en el device.
 * @throws "necesitas_verificarte" si no hay credencial.
 */
export async function anchorOpinion(content: string): Promise<AnchoredOpinion> {
  const cred = loadAnyCredential();
  if (!cred) throw new Error("necesitas_verificarte");

  const contentHash = await contentHashField(content);
  const proof = await generatePlatformProof(cred, contentHash);
  const platformId = platformIdHex(proof.publicSignals[1]);

  // Cuenta efímera (anónima, fondeada por friendbot) para firmar el ancla — no es la del KYC.
  const kp = await createFundedEphemeral();
  let txHash = "";
  try {
    txHash = await postTweet(kp, proof);
  } catch (e) {
    if (!(e instanceof ContractError && e.code === 3)) throw e; // 3 = ya anclado
  }
  return { platformId, contentHash, txHash };
}
