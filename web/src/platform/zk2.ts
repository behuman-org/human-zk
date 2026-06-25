// Prueba ZK de plataforma en el NAVEGADOR (post.circom). La PII/secret nunca sale.
import * as snarkjs from "snarkjs";
import type { SnarkProof } from "../kyc/bls";
import type { StoredCredential } from "../kyc/credentialStore";

const WASM = "/circuits-platform/post.wasm";
const ZKEY = "/circuits-platform/post_final.zkey";

/** contentHash = sha256(content) con los 2 bits altos en 0 (< r_bls12381). */
export async function contentHashField(content: string): Promise<string> {
  const enc = new TextEncoder().encode(content);
  const ab = new ArrayBuffer(enc.length);
  new Uint8Array(ab).set(enc);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", ab));
  digest[0] &= 0x3f;
  let hex = "";
  for (const b of digest) hex += b.toString(16).padStart(2, "0");
  return BigInt("0x" + hex).toString();
}

export interface PlatformProof {
  proof: SnarkProof;
  publicSignals: string[]; // [issuerRoot, platformId, contentHash]
}

/** Genera la prueba (pertenencia + platformId + binding de contentHash). */
export async function generatePlatformProof(
  cred: StoredCredential,
  contentHash: string,
): Promise<PlatformProof> {
  const input = {
    birthYear: String(cred.attributes.birthYear),
    countryCode: String(cred.attributes.countryCode),
    secret: cred.secret,
    pathElements: cred.pathElements,
    pathIndices: cred.pathIndices.map(String),
    contentHash,
  };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  return { proof: proof as SnarkProof, publicSignals: publicSignals as string[] };
}

/** platformId (decimal) -> hex 0x... (32 bytes). */
export function platformIdHex(decimal: string): string {
  return "0x" + BigInt(decimal).toString(16).padStart(64, "0");
}

/** Handle público: últimos 5 caracteres del platformId. */
export const handleOf = (pidHex: string) => pidHex.slice(-5);
