// Invocación del contrato kyc_verifier desde el navegador (firma con la wallet).
import * as StellarSdk from "@stellar/stellar-sdk";
import { CONTRACT_ID, NETWORK_PASSPHRASE, rpc } from "./stellar";
import { signXdr } from "./wallet";

/** Firma XDR (wallet externa o Pollar custodial vía setTransactionSigner). */
export type TransactionSigner = (xdr: string, networkPassphrase: string) => Promise<string>;

let activeSigner: TransactionSigner | null = null;

export function setTransactionSigner(signer: TransactionSigner | null): void {
  activeSigner = signer;
}

async function signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
  const signer = activeSigner ?? ((x, np) => signXdr(x, np));
  return signer(xdr, networkPassphrase);
}
import { encodeProof, fieldTo32, g1ToBytes, g2ToBytes } from "./bls";
import type { GeneratedProof } from "./zk";

const { xdr, Address, Contract, TransactionBuilder, BASE_FEE, Account, scValToNative } = StellarSdk;

const scvBytes = (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));
const sym = (k: string) => xdr.ScVal.scvSymbol(k);
const entry = (k: string, v: StellarSdk.xdr.ScVal) => new xdr.ScMapEntry({ key: sym(k), val: v });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Códigos de error del contrato (deben coincidir con el enum Error). */
const CONTRACT_ERRORS: Record<number, string> = {
  1: "El issuer no es de confianza para este contrato (raíz distinta).",
  2: "La prueba está atada a otra dirección (address binding).",
  3: "Este humano ya tiene una identidad registrada (nullifier ya usado).",
  4: "La prueba ZK no es válida.",
  5: "El contrato ya fue inicializado.",
  6: "El contrato no fue inicializado.",
};

export class ContractError extends Error {
  constructor(public code: number, msg: string) {
    super(msg);
  }
}

function parseContractError(simError: string): ContractError | null {
  // Mensajes del tipo: "... Error(Contract, #3) ..."
  const m = simError.match(/Error\(Contract,\s*#(\d+)\)/);
  if (!m) return null;
  const code = Number(m[1]);
  return new ContractError(code, CONTRACT_ERRORS[code] ?? `Error de contrato #${code}`);
}

function contract() {
  if (!CONTRACT_ID) throw new Error("Falta VITE_KYC_VERIFIER_CONTRACT_ID");
  return new Contract(CONTRACT_ID);
}

async function invoke(address: string, op: StellarSdk.xdr.Operation): Promise<string> {
  // init + verify_and_register se firman seguidas desde la misma wallet. El RPC de Soroban
  // tiene consistencia eventual: tras confirmar la primera, getAccount puede devolver la
  // secuencia vieja → `txBadSeq`. Reintentamos refrescando la cuenta con una espera breve.
  for (let attempt = 0; ; attempt++) {
    const account = await rpc.getAccount(address);
    let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(op)
      .setTimeout(120)
      .build();

    const sim = await rpc.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw parseContractError(sim.error) ?? new Error(sim.error);
    }
    tx = StellarSdk.rpc.assembleTransaction(tx, sim).build();

    const signed = await signTransaction(tx.toXDR(), NETWORK_PASSPHRASE);
    const stx = TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE) as StellarSdk.Transaction;
    const sent = await rpc.sendTransaction(stx);
    if (sent.status === "ERROR") {
      const isBadSeq = JSON.stringify(sent.errorResult ?? "").includes("txBadSeq");
      if (isBadSeq && attempt < 6) {
        await sleep(1500);
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
  // Claves ordenadas: alpha < beta < delta < gamma < ic.
  return xdr.ScVal.scvMap([
    entry("alpha", g1(vk.vk_alpha_1)),
    entry("beta", g2(vk.vk_beta_2)),
    entry("delta", g2(vk.vk_delta_2)),
    entry("gamma", g2(vk.vk_gamma_2)),
    entry("ic", xdr.ScVal.scvVec(vk.IC.map((p) => g1(p)))),
  ]);
}

/**
 * Inicializa el contrato con el issuerRoot de confianza + VK, si hace falta.
 * Si ya estaba inicializado (AlreadyInitialized), lo ignora.
 * Devuelve true si lo inicializó esta llamada.
 */
export async function initIfNeeded(address: string, issuerRoot: string): Promise<boolean> {
  const vk: SnarkVK = await (await fetch("/circuits/verification_key.json")).json();
  const op = contract().call(
    "init",
    Address.fromString(address).toScVal(),
    scvBytes(fieldTo32(issuerRoot)),
    encodeVk(vk),
  );
  try {
    await invoke(address, op);
    return true;
  } catch (e) {
    if (e instanceof ContractError && e.code === 5) return false; // AlreadyInitialized
    throw e;
  }
}

/** verify_and_register(address, proof, public_inputs). Devuelve el hash de la tx. */
export async function verifyAndRegister(address: string, gen: GeneratedProof): Promise<string> {
  const enc = encodeProof(gen.proof);
  const proofVal = xdr.ScVal.scvMap([
    entry("a", scvBytes(enc.a)),
    entry("b", scvBytes(enc.b)),
    entry("c", scvBytes(enc.c)),
  ]);
  const pub = xdr.ScVal.scvVec(gen.publicSignals.map((s) => scvBytes(fieldTo32(s))));
  const op = contract().call(
    "verify_and_register",
    Address.fromString(address).toScVal(),
    proofVal,
    pub,
  );
  return invoke(address, op);
}

/** is_verified(address) por simulación (sin fees). */
export async function isVerified(address: string): Promise<boolean> {
  const account = new Account(address, "0");
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract().call("is_verified", Address.fromString(address).toScVal()))
    .setTimeout(120)
    .build();
  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return scValToNative(sim.result!.retval) as boolean;
}
