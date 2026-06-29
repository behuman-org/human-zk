// opinion_board (CAPA 2) desde el navegador, firmando con la cuenta EFÍMERA (no la wallet
// del KYC). El contrato no usa require_auth: la autorización es la prueba ZK.
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, NETWORK_PASSPHRASE, OPINION_BOARD_CONTRACT_ID } from "./stellar2";
import { encodeProof, fieldTo32, g1ToBytes, g2ToBytes } from "../kyc/bls";
import type { PlatformProof } from "./zk2";

const { xdr, Address, Contract, TransactionBuilder, BASE_FEE } = StellarSdk;
const scvBytes = (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));
const sym = (k: string) => xdr.ScVal.scvSymbol(k);
const entry = (k: string, v: StellarSdk.xdr.ScVal) => new xdr.ScMapEntry({ key: sym(k), val: v });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ERRORS: Record<number, string> = {
  1: "El issuer no es de confianza para este contrato.",
  2: "La prueba ZK no es válida.",
  3: "Ya registraste tu identidad de plataforma.",
  4: "Primero registrá tu identidad de plataforma.",
  5: "Ya publicaste este contenido (anti-replay).",
  6: "El contrato ya fue inicializado.",
  7: "El contrato no fue inicializado.",
};

export class ContractError extends Error {
  constructor(public code: number, msg: string) {
    super(msg);
  }
}
function parseErr(s: string): ContractError | null {
  const m = s.match(/Error\(Contract,\s*#(\d+)\)/);
  if (!m) return null;
  const c = Number(m[1]);
  return new ContractError(c, ERRORS[c] ?? `Error de contrato #${c}`);
}

function contract() {
  if (!OPINION_BOARD_CONTRACT_ID) throw new Error("Falta VITE_OPINION_BOARD_CONTRACT_ID");
  return new Contract(OPINION_BOARD_CONTRACT_ID);
}

async function invoke(kp: StellarSdk.Keypair, op: StellarSdk.xdr.Operation): Promise<string> {
  // Las publicaciones encadenan varias tx desde la MISMA cuenta efímera (init → register →
  // post). El RPC de Soroban tiene consistencia eventual: tras confirmar una tx, el siguiente
  // getAccount puede devolver la secuencia vieja → `txBadSeq`. Reintentamos refrescando la
  // cuenta (con una espera breve) hasta que la secuencia se actualice.
  for (let attempt = 0; ; attempt++) {
    const account = await rpc.getAccount(kp.publicKey());
    let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(op)
      .setTimeout(120)
      .build();
    const sim = await rpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) throw parseErr(sim.error) ?? new Error(sim.error);
    tx = StellarSdk.rpc.assembleTransaction(tx, sim).build();
    tx.sign(kp); // firma local con la cuenta efímera (sin wallet)
    const sent = await rpc.sendTransaction(tx);
    if (sent.status === "ERROR") {
      const isBadSeq = JSON.stringify(sent.errorResult ?? "").includes("txBadSeq");
      if (isBadSeq && attempt < 6) {
        await sleep(1500); // dar tiempo a que el RPC actualice la secuencia y reintentar
        continue;
      }
      throw new Error(`sendTransaction: ${JSON.stringify(sent.errorResult)}`);
    }
    let res = await rpc.getTransaction(sent.hash);
    for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) {
      await sleep(1000);
      res = await rpc.getTransaction(sent.hash);
    }
    if (res.status !== "SUCCESS") throw new Error(`tx ${sent.hash}: ${res.status}`);
    return sent.hash;
  }
}

const proofVal = (p: PlatformProof) => {
  const enc = encodeProof(p.proof);
  return xdr.ScVal.scvMap([
    entry("a", scvBytes(enc.a)),
    entry("b", scvBytes(enc.b)),
    entry("c", scvBytes(enc.c)),
  ]);
};
const pubVal = (p: PlatformProof) =>
  xdr.ScVal.scvVec(p.publicSignals.map((s) => scvBytes(fieldTo32(s))));

interface SnarkVK {
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  IC: string[][];
}
function encodeVk(vk: SnarkVK): StellarSdk.xdr.ScVal {
  const g1 = (p: string[]) => scvBytes(g1ToBytes(p));
  const g2 = (p: string[][]) => scvBytes(g2ToBytes(p));
  return xdr.ScVal.scvMap([
    entry("alpha", g1(vk.vk_alpha_1)),
    entry("beta", g2(vk.vk_beta_2)),
    entry("delta", g2(vk.vk_delta_2)),
    entry("gamma", g2(vk.vk_gamma_2)),
    entry("ic", xdr.ScVal.scvVec(vk.IC.map((p) => g1(p)))),
  ]);
}

/** Inicializa el opinion_board con la raíz del issuer (si hace falta). */
export async function initIfNeeded(kp: StellarSdk.Keypair, issuerRootDecimal: string): Promise<boolean> {
  const vk: SnarkVK = await (await fetch("/circuits-platform/verification_key.json")).json();
  const op = contract().call(
    "init",
    Address.fromString(kp.publicKey()).toScVal(),
    scvBytes(fieldTo32(issuerRootDecimal)),
    encodeVk(vk),
  );
  try {
    await invoke(kp, op);
    return true;
  } catch (e) {
    if (e instanceof ContractError && e.code === 6) return false; // AlreadyInitialized
    throw e;
  }
}

export async function registerIdentity(kp: StellarSdk.Keypair, p: PlatformProof): Promise<string> {
  return invoke(kp, contract().call("register_identity", proofVal(p), pubVal(p)));
}

export async function postTweet(kp: StellarSdk.Keypair, p: PlatformProof): Promise<string> {
  return invoke(kp, contract().call("post", proofVal(p), pubVal(p)));
}

/** Simula (sin enviar) una operación y devuelve la tarifa total estimada en stroops. */
async function simulateFee(kp: StellarSdk.Keypair, op: StellarSdk.xdr.Operation): Promise<bigint> {
  const account = await rpc.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) throw parseErr(sim.error) ?? new Error(sim.error);
  return BigInt(StellarSdk.rpc.assembleTransaction(tx, sim).build().fee); // 1 XLM = 1e7 stroops
}

export interface PublishQuote {
  registerStroops: bigint; // costo una-sola-vez de registrar la identidad (0 si ya registrada)
  postStroops: bigint; // costo de anclar el contenido
  alreadyRegistered: boolean;
  alreadyPosted: boolean; // este contenido ya estaba anclado (re-anclar no cuesta: inmutable)
}

/**
 * Cotiza el costo on-chain de publicar SIN ENVIAR NADA (solo simula): registro de identidad
 * (una sola vez) + anclaje del contenido. `idProof` ata contentHash="0" (registro); `postProof`
 * ata el contentHash real. Read-only: a diferencia del anclaje, no manda transacciones.
 */
export async function quotePublish(
  kp: StellarSdk.Keypair,
  idProof: PlatformProof,
  postProof: PlatformProof,
): Promise<PublishQuote> {
  // 1) Registro (one-time). Si ya está registrada, simular devuelve AlreadyRegistered (#3) → 0.
  let registerStroops = 0n;
  let alreadyRegistered = false;
  try {
    registerStroops = await simulateFee(kp, contract().call("register_identity", proofVal(idProof), pubVal(idProof)));
  } catch (e) {
    if (e instanceof ContractError && e.code === 3) alreadyRegistered = true;
    else throw e;
  }

  // 2) Publicación.
  let postStroops = 0n;
  let alreadyPosted = false;
  try {
    postStroops = await simulateFee(kp, contract().call("post", proofVal(postProof), pubVal(postProof)));
  } catch (e) {
    if (e instanceof ContractError && e.code === 4) {
      // Identidad aún no registrada → el contrato rechaza el `post` (estado dice no-registrada),
      // así que no se puede simular. El costo del post está dominado por la verificación Groth16
      // (igual que el registro) → lo estimamos con el costo del registro.
      postStroops = registerStroops;
    } else if (e instanceof ContractError && e.code === 5) {
      alreadyPosted = true; // ya anclado: re-anclar no cuesta (inmutable)
    } else {
      throw e;
    }
  }

  return { registerStroops, postStroops, alreadyRegistered, alreadyPosted };
}
