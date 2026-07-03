// Prueba ZK en el NAVEGADOR (la PII/secret nunca sale del device).
//
// Usa snarkjs con los artefactos servidos en /circuits (kyc.wasm, kyc_final.zkey).
// El commitment se obtiene de publicSignals[0] de una primera ejecución (no depende del
// camino Merkle); luego, con el camino real del issuer, se genera la prueba definitiva.
import * as snarkjs from "snarkjs";
import * as StellarSdk from "@stellar/stellar-sdk";
import type { SnarkProof } from "./bls";

const WASM = "/circuits/kyc.wasm";
const ZKEY = "/circuits/kyc_final.zkey";

export interface Attributes {
  birthYear: number;
  countryCode: number;
}

/** Secret aleatorio (< r_bls12381): 31 bytes. Queda en el device. */
export function randomSecret(): string {
  const b = new Uint8Array(31);
  crypto.getRandomValues(b);
  let hex = "";
  for (const x of b) hex += x.toString(16).padStart(2, "0");
  return BigInt("0x" + hex).toString();
}

/**
 * addressHash que espera el circuito/contrato: sha256(ScVal(address)) con los 2 bits
 * altos en 0. Réplica exacta de KycVerifier::address_field_hash (validada en el SDK).
 */
export async function addressHashField(address: string): Promise<string> {
  const xdrBytes = StellarSdk.Address.fromString(address).toScVal().toXDR(); // Buffer (raw)
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(xdrBytes)));
  digest[0] &= 0x3f;
  let hex = "";
  for (const x of digest) hex += x.toString(16).padStart(2, "0");
  return BigInt("0x" + hex).toString();
}

export interface GeneratedProof {
  proof: SnarkProof;
  publicSignals: string[]; // [commitment, nullifier=Poseidon(secret), issuerRoot, addressHash]
}

/** Calcula el commitment = Poseidon(birthYear, countryCode, secret) (sin path real). */
export async function computeCommitment(attrs: Attributes, secret: string): Promise<string> {
  const input = {
    birthYear: String(attrs.birthYear),
    countryCode: String(attrs.countryCode),
    secret,
    pathElements: ["0", "0", "0", "0"],
    pathIndices: ["0", "0", "0", "0"],
    addressHash: "0",
  };
  const { publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  return publicSignals[0];
}

/** Genera la prueba final con el camino Merkle real del issuer. */
export async function generateProof(
  attrs: Attributes,
  secret: string,
  pathElements: string[],
  pathIndices: number[],
  address: string,
): Promise<GeneratedProof> {
  const addressHash = await addressHashField(address);
  const input = {
    birthYear: String(attrs.birthYear),
    countryCode: String(attrs.countryCode),
    secret,
    pathElements,
    pathIndices: pathIndices.map(String),
    addressHash,
  };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  return { proof: proof as SnarkProof, publicSignals: publicSignals as string[] };
}
