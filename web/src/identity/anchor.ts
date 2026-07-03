// Núcleo de anclaje on-chain (Capa 2) compartido por tweets y artículos.
// Genera la prueba ZK, asegura la identidad de plataforma registrada, y ancla el contenido
// en `opinion_board` con una cuenta EFÍMERA (no la wallet del KYC). Cero PII: solo va el
// contentHash + la prueba; la identidad real (platformId) no se expone en la UI.
import * as StellarSdk from "@stellar/stellar-sdk";
import { loadAnyCredential } from "../kyc/credentialStore";
import { contentHashField, generatePlatformProof, platformIdHex } from "../platform/zk2";
import { getOrCreateFundedEphemeral } from "../platform/ephemeral";
import { postTweet, quotePublish, registerIdentity, initIfNeeded, ContractError } from "../platform/chain2";

export interface Anchored {
  platformId: string;
  contentHash: string;
  txHash: string;
}

/** Registra la identidad de plataforma si todavía no lo está (idempotente). */
async function ensureRegistered(kp: StellarSdk.Keypair, idProof: Awaited<ReturnType<typeof generatePlatformProof>>) {
  try {
    await registerIdentity(kp, idProof);
  } catch (e) {
    if (!(e instanceof ContractError && e.code === 3)) throw e; // 3 = ya registrada
  }
}

/** Ancla `text` on-chain (prueba ZK + opinion_board.post). Requiere credencial Capa 1. */
export async function anchorText(text: string): Promise<Anchored> {
  const cred = loadAnyCredential();
  if (!cred) throw new Error("verification_required");

  const contentHash = await contentHashField(text);
  const proof = await generatePlatformProof(cred, contentHash);
  const platformId = platformIdHex(proof.publicSignals[1]);
  const kp = await getOrCreateFundedEphemeral();

  // Asegura que el opinion_board esté inicializado con la raíz del issuer de ESTA credencial
  // (idempotente: si ya estaba init, no hace nada). Sin esto, un contrato nuevo daría
  // NotInitialized y uno con otra raíz daría UntrustedIssuer. publicSignals[0] = issuerRoot.
  await initIfNeeded(kp, proof.publicSignals[0]);

  let txHash = "";
  try {
    txHash = await postTweet(kp, proof);
  } catch (e) {
    if (e instanceof ContractError && e.code === 4) {
      // Identidad aún no registrada en el board → registrar y reintentar.
      await ensureRegistered(kp, await generatePlatformProof(cred, "0"));
      txHash = await postTweet(kp, proof);
    } else if (e instanceof ContractError && e.code === 5) {
      txHash = ""; // anti-replay: este contenido ya estaba anclado (sigue siendo inmutable)
    } else {
      throw e;
    }
  }
  return { platformId, contentHash, txHash };
}

export interface Quote {
  feeXlm: string; // total estimado (registro one-time + publicación)
  feeStroops: string;
  registerXlm: string; // costo una-sola-vez de registrar la identidad ("0.0000000" si ya está)
  postXlm: string; // costo de anclar este contenido
  alreadyRegistered: boolean;
  alreadyPosted: boolean; // este contenido ya estaba anclado (re-anclar no cuesta)
  contentHash: string;
}

/**
 * Cotiza el costo on-chain de anclar `text` SIN ENVIAR NADA (solo simula): registro de identidad
 * (una vez) + publicación. Read-only: no toca el contrato. Devuelve total + desglose en XLM.
 */
export async function quoteText(text: string): Promise<Quote> {
  const cred = loadAnyCredential();
  if (!cred) throw new Error("verification_required");

  const contentHash = await contentHashField(text);
  const postProof = await generatePlatformProof(cred, contentHash);
  const idProof = await generatePlatformProof(cred, "0");
  const kp = await getOrCreateFundedEphemeral();

  const q = await quotePublish(kp, idProof, postProof);
  const total = q.registerStroops + q.postStroops;
  const xlm = (s: bigint) => (Number(s) / 1e7).toFixed(7);
  return {
    feeStroops: total.toString(),
    feeXlm: xlm(total),
    registerXlm: xlm(q.registerStroops),
    postXlm: xlm(q.postStroops),
    alreadyRegistered: q.alreadyRegistered,
    alreadyPosted: q.alreadyPosted,
    contentHash,
  };
}
