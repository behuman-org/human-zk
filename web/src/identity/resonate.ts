// "Resuena" — reacción anónima a un post (Capa 2). Reusa el circuito funding_opinion (mismo
// que las opiniones por campaña): produce un NULLIFIER scopeado al post → 1 humano = 1 resuena
// por post (anti-Sybil), y un platformId scopeado (no linkable entre posts). El backend guarda
// SOLO el nullifier (nunca la identidad ni el platformId): cuenta pública, autor anónimo.
// La PII/secret nunca sale del device. No toca contrato ni circuito.
import * as snarkjs from "snarkjs";
import type { SnarkProof } from "../kyc/bls";
import type { StoredCredential } from "../kyc/credentialStore";

const WASM = "/circuits-funding/funding_opinion.wasm";
const ZKEY = "/circuits-funding/fo_final.zkey";

// Prefijos de dominio del Resuena. DEBEN coincidir EXACTAMENTE con platform/api (server.ts).
const SCOPE_PREFIX = "resonate-id:";
const NULLSCOPE_PREFIX = "resonate-null:";
const CONTENT_PREFIX = "resonate-content:";

/** string → field element (< r_bls12381), idéntico a strToField del SDK/zk3. */
async function strToField(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s);
  const ab = new ArrayBuffer(enc.length);
  new Uint8Array(ab).set(enc);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", ab));
  digest[0] &= 0x3f;
  let hex = "";
  for (const b of digest) hex += b.toString(16).padStart(2, "0");
  return BigInt("0x" + hex).toString();
}

export interface ResonateProof {
  proof: SnarkProof;
  publicSignals: string[]; // [issuerRoot, platformId, nullifier, scope, nullScope, contentHash]
}

/** Genera la prueba de Resuena atada a ESTE post (scope/nullScope/contentHash derivados del id). */
export async function generateResonateProof(cred: StoredCredential, postId: string): Promise<ResonateProof> {
  const input = {
    birthYear: String(cred.attributes.birthYear),
    countryCode: String(cred.attributes.countryCode),
    secret: cred.secret,
    pathElements: cred.pathElements,
    pathIndices: cred.pathIndices.map(String),
    scope: await strToField(SCOPE_PREFIX + postId),
    nullScope: await strToField(NULLSCOPE_PREFIX + postId),
    contentHash: await strToField(CONTENT_PREFIX + postId),
  };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  return { proof: proof as SnarkProof, publicSignals: publicSignals as string[] };
}

// Estado local de "yo resoné este post": guardamos solo un flag por postId (NO el nullifier ni
// nada sensible) para pintar el botón sin regenerar una prueba en cada render. La cuenta pública
// siempre viene del servidor.
const LS_KEY = "behuman.resonated.v1";

function loadSet(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

export function isResonatedLocally(postId: string): boolean {
  return loadSet()[postId] === true;
}

export function setResonatedLocally(postId: string, on: boolean): void {
  const set = loadSet();
  if (on) set[postId] = true;
  else delete set[postId];
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(set));
  } catch {
    /* almacenamiento no disponible: el estado se pierde al recargar (no es crítico) */
  }
}
