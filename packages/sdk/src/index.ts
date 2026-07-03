/// <reference path="./snarkjs.d.ts" />
// @behuman/sdk — Puente de la Capa 1: credencial -> prueba ZK -> tx Stellar.
// 📐 Ver `Flujo de KYC` (Fases 2–4) y `Puente-KYC-a-ZK` en la vault.
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import * as snarkjs from "snarkjs";
import * as StellarSdk from "@stellar/stellar-sdk";
import type { Capa1Credential } from "@behuman/shared";
import { circuitsBuildDir, poseidon1 } from "./poseidonBls.js";
import { encodeProof, fieldTo32, g1ToBytes, g2ToBytes, type SnarkProof } from "./blsEncode.js";

export * from "./poseidonBls.js";
export * from "./merkle.js";
export * from "./blsEncode.js";
export * from "./defindex.js";
export * from "./trustlesswork.js";
export * from "./fundingOpinion.js";
export * from "./fundingAuth.js";

const { Address, Contract, TransactionBuilder, Keypair, BASE_FEE, xdr, rpc, scValToNative } =
  StellarSdk;

// Índices de los public inputs (orden acordado con el circuito y el contrato).
export const PUBLIC_SIGNALS_ORDER = ["commitment", "nullifier", "issuerRoot", "addressHash"] as const;

// ─── Fase 2 · addressHash + prueba ZK ───────────────────────────────────────

/**
 * `addressHash` que espera el circuito/contrato para el address binding.
 * Réplica exacta de `KycVerifier::address_field_hash`: sha256(ScVal(address)) con los
 * 2 bits altos en 0 (validado byte a byte contra el contrato). Devuelve decimal.
 */
export function addressHashField(address: string): string {
  const scval = Address.fromString(address).toScVal().toXDR();
  const digest = createHash("sha256").update(scval).digest();
  digest[0] &= 0x3f; // < 2^254 < r_bls12381
  return BigInt("0x" + digest.toString("hex")).toString();
}

/**
 * Nullifier global anti-Sybil: `Poseidon(secret)`.
 * Una persona (mismo secret) → un solo nullifier on-chain, independiente del address.
 * El address binding lo valida el contrato vía `addressHash` (public input separado).
 */
export async function nullifierField(secret: string): Promise<string> {
  return (await poseidon1(secret)).toString();
}

export interface GeneratedProof {
  proof: SnarkProof; // formato snarkjs
  publicSignals: string[]; // [commitment, nullifier, issuerRoot, addressHash] (decimales)
}

/**
 * Genera la prueba Groth16 a partir de la credencial de Capa 1 y el address del usuario.
 * El witness se calcula localmente (la PII/secret nunca sale del device).
 */
export async function generateProof(
  credential: Capa1Credential,
  address: string,
): Promise<GeneratedProof> {
  const addressHash = addressHashField(address);
  const input = {
    birthYear: String(credential.attributes.birthYear),
    countryCode: String(credential.attributes.countryCode),
    secret: credential.secret,
    pathElements: credential.pathElements.map(String),
    pathIndices: credential.pathIndices.map(String),
    addressHash,
  };
  const buildDir = circuitsBuildDir();
  const wasm = resolve(buildDir, "kyc_js", "kyc.wasm");
  const zkey = resolve(buildDir, "kyc_final.zkey");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  return { proof: proof as SnarkProof, publicSignals: publicSignals as string[] };
}

/** Verifica la prueba off-chain con snarkjs (sanity previo a mandarla on-chain). */
export async function verifyProofLocally(
  gen: GeneratedProof,
  verificationKey: unknown,
): Promise<boolean> {
  return snarkjs.groth16.verify(verificationKey as object, gen.publicSignals, gen.proof as object);
}

// ─── Fase 3–4 · tx Stellar (verify_and_register / is_verified) ──────────────

export interface StellarConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
}

function server(cfg: StellarConfig) {
  return new rpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith("http://") });
}

const scvBytes = (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));
const entry = (key: string, val: StellarSdk.xdr.ScVal) =>
  new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val });

export interface SnarkVK {
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  IC: string[][];
}

/** Codifica la verification key de snarkjs al tipo VerificationKey del contrato. */
export function encodeVerificationKey(vk: SnarkVK): StellarSdk.xdr.ScVal {
  const g1 = (p: string[]) => scvBytes(g1ToBytes(p as [string, string]));
  const g2 = (p: string[][]) => scvBytes(g2ToBytes(p as [string[], string[]]));
  // Claves Symbol ordenadas alfabéticamente: alpha < beta < delta < gamma < ic.
  return xdr.ScVal.scvMap([
    entry("alpha", g1(vk.vk_alpha_1)),
    entry("beta", g2(vk.vk_beta_2)),
    entry("delta", g2(vk.vk_delta_2)),
    entry("gamma", g2(vk.vk_gamma_2)),
    entry("ic", xdr.ScVal.scvVec(vk.IC.map((p) => g1(p)))),
  ]);
}

/** Inicializa el contrato con el issuer root de confianza y la VK. */
export async function initVerifier(
  cfg: StellarConfig,
  signerSecret: string,
  issuerRoot: string,
  vk: SnarkVK,
): Promise<string> {
  const srv = server(cfg);
  const kp = Keypair.fromSecret(signerSecret);
  const account = await srv.getAccount(kp.publicKey());
  const contract = new Contract(cfg.contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "init",
        Address.fromString(kp.publicKey()).toScVal(),
        scvBytes(fieldTo32(issuerRoot)),
        encodeVerificationKey(vk),
      ),
    )
    .setTimeout(60)
    .build();
  const prepared = await srv.prepareTransaction(tx);
  prepared.sign(kp);
  const sent = await srv.sendTransaction(prepared);
  if (sent.status === "ERROR") throw new Error(`init error: ${JSON.stringify(sent.errorResult)}`);
  let res = await srv.getTransaction(sent.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await srv.getTransaction(sent.hash);
  }
  if (res.status !== "SUCCESS") throw new Error(`init tx ${sent.hash} status=${res.status}`);
  return sent.hash;
}

/** Arma los ScVal de `verify_and_register(address, proof, public_inputs)`. */
export function buildVerifyArgs(address: string, gen: GeneratedProof): StellarSdk.xdr.ScVal[] {
  const enc = encodeProof(gen.proof);
  // Proof { a, b, c } -> ScMap (claves Symbol ordenadas: a < b < c).
  const proofVal = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("a"), val: scvBytes(enc.a) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("b"), val: scvBytes(enc.b) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("c"), val: scvBytes(enc.c) }),
  ]);
  const publicInputsVal = xdr.ScVal.scvVec(
    gen.publicSignals.map((s) => scvBytes(fieldTo32(s))),
  );
  return [Address.fromString(address).toScVal(), proofVal, publicInputsVal];
}

/**
 * Invoca `verify_and_register` firmando con `signerSecret` (debe ser el `address`).
 * Devuelve el hash de la transacción. Requiere red (testnet).
 */
export async function verifyAndRegister(
  cfg: StellarConfig,
  signerSecret: string,
  gen: GeneratedProof,
): Promise<string> {
  const srv = server(cfg);
  const kp = Keypair.fromSecret(signerSecret);
  const address = kp.publicKey();
  const account = await srv.getAccount(address);
  const contract = new Contract(cfg.contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(contract.call("verify_and_register", ...buildVerifyArgs(address, gen)))
    .setTimeout(60)
    .build();

  const prepared = await srv.prepareTransaction(tx);
  prepared.sign(kp);
  const sent = await srv.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`sendTransaction error: ${JSON.stringify(sent.errorResult)}`);
  }
  // poll
  let res = await srv.getTransaction(sent.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await srv.getTransaction(sent.hash);
  }
  if (res.status !== "SUCCESS") {
    throw new Error(`tx ${sent.hash} status=${res.status}`);
  }
  return sent.hash;
}

/** Consulta `is_verified(address)` por simulación (sin gastar fees). */
export async function isVerified(cfg: StellarConfig, address: string): Promise<boolean> {
  const srv = server(cfg);
  const contract = new Contract(cfg.contractId);
  // Cuenta dummy para construir la tx de simulación.
  const account = new StellarSdk.Account(address, "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: cfg.networkPassphrase,
  })
    .addOperation(contract.call("is_verified", Address.fromString(address).toScVal()))
    .setTimeout(60)
    .build();
  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`simulación falló: ${sim.error}`);
  return scValToNative(sim.result!.retval) as boolean;
}

// ─── CAPA 2 (fuera de alcance de esta tarea) ────────────────────────────────
export async function anchorPost(_author: string, _contentHash: string): Promise<bigint> {
  throw new Error("anchorPost no implementado — Capa 2");
}
