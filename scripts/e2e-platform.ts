// E2E CAPA 2 (testnet): identidad anónima -> register_identity -> post -> get_post.
// La identidad es platformId (derivada del secret), NO el address. El fee lo paga la
// cuenta efímera (SIGNER_SECRET), que no es el address del KYC.
//
// Env: CONTRACT_ID, SIGNER_SECRET, RPC_URL, NETWORK_PASSPHRASE.
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  poseidon3,
  buildTree,
  merkleProof,
  encodeProof,
  fieldTo32,
  g1ToBytes,
  g2ToBytes,
} from "@behuman/sdk";

const { xdr, Address, Contract, TransactionBuilder, Keypair, BASE_FEE, rpc, scValToNative } =
  StellarSdk;
const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`falta env ${k}`);
  return v;
};
const cfg = { contractId: env("CONTRACT_ID"), rpcUrl: env("RPC_URL"), pass: env("NETWORK_PASSPHRASE") };
const kp = Keypair.fromSecret(env("SIGNER_SECRET"));
const server = new rpc.Server(cfg.rpcUrl, { allowHttp: cfg.rpcUrl.startsWith("http://") });
const here = dirname(fileURLToPath(import.meta.url));
const BUILD = resolve(here, "..", "platform", "circuits", "build");

const scvBytes = (b: Uint8Array) => xdr.ScVal.scvBytes(Buffer.from(b));
const entry = (k: string, v: StellarSdk.xdr.ScVal) =>
  new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: v });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function contentHash(content: string): string {
  const d = createHash("sha256").update(content).digest();
  d[0] &= 0x3f;
  return BigInt("0x" + d.toString("hex")).toString();
}

async function platformProof(cred: any, ch: string) {
  const input = {
    birthYear: String(cred.attributes.birthYear),
    countryCode: String(cred.attributes.countryCode),
    secret: cred.secret,
    pathElements: cred.pathElements,
    pathIndices: cred.pathIndices.map(String),
    contentHash: ch,
  };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    resolve(BUILD, "post_js", "post.wasm"),
    resolve(BUILD, "post_final.zkey"),
  );
  return { proof, publicSignals: publicSignals as string[] };
}

const proofVal = (p: any) => {
  const enc = encodeProof(p.proof);
  return xdr.ScVal.scvMap([
    entry("a", scvBytes(enc.a)),
    entry("b", scvBytes(enc.b)),
    entry("c", scvBytes(enc.c)),
  ]);
};
const pubVal = (p: any) => xdr.ScVal.scvVec(p.publicSignals.map((s: string) => scvBytes(fieldTo32(s))));

function encodeVk(vk: any) {
  const g1 = (p: string[]) => scvBytes(g1ToBytes(p));
  const g2 = (p: string[][]) => scvBytes(g2ToBytes(p));
  return xdr.ScVal.scvMap([
    entry("alpha", g1(vk.vk_alpha_1)),
    entry("beta", g2(vk.vk_beta_2)),
    entry("delta", g2(vk.vk_delta_2)),
    entry("gamma", g2(vk.vk_gamma_2)),
    entry("ic", xdr.ScVal.scvVec(vk.IC.map((p: string[]) => g1(p)))),
  ]);
}

async function invoke(op: StellarSdk.xdr.Operation): Promise<string> {
  const account = await server.getAccount(kp.publicKey());
  let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: cfg.pass })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(kp);
  const sent = await server.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error(JSON.stringify(sent.errorResult));
  let res = await server.getTransaction(sent.hash);
  for (let i = 0; i < 30 && res.status === "NOT_FOUND"; i++) {
    await sleep(1000);
    res = await server.getTransaction(sent.hash);
  }
  if (res.status !== "SUCCESS") throw new Error(`tx ${sent.hash}: ${res.status}`);
  return sent.hash;
}

async function main() {
  console.log("== beHuman · E2E CAPA 2 (testnet) ==");
  console.log("fee payer (efímero, NO es el address del KYC):", kp.publicKey());

  // Credencial de Capa 1 (simulada para el e2e).
  const secret = BigInt("0x" + randomBytes(31).toString("hex")).toString();
  const attributes = { birthYear: 1990, countryCode: 32 };
  const commitment = await poseidon3(attributes.birthYear, attributes.countryCode, secret);
  const tree = await buildTree([commitment]);
  const path = merkleProof(tree, 0);
  const cred = {
    attributes,
    secret,
    pathElements: path.pathElements.map(String),
    pathIndices: path.pathIndices,
  };

  const contract = new Contract(cfg.contractId);
  const vk = JSON.parse(readFileSync(resolve(BUILD, "verification_key.json"), "utf8"));

  // 1) identidad (contentHash = 0)
  const reg = await platformProof(cred, "0");
  const platformId = reg.publicSignals[1];
  console.log("[1] platformId:", "0x" + BigInt(platformId).toString(16).padStart(64, "0"));
  console.log("    handle (últimos 5):", ("0x" + BigInt(platformId).toString(16).padStart(64, "0")).slice(-5));

  // 2) init (issuerRoot = reg.publicSignals[0])
  try {
    await invoke(contract.call("init", Address.fromString(kp.publicKey()).toScVal(), scvBytes(fieldTo32(reg.publicSignals[0])), encodeVk(vk)));
    console.log("[2] init OK");
  } catch (e) {
    console.log("[2] init omitido:", (e as Error).message.slice(0, 60));
  }

  // 3) register_identity
  console.log("[3] register_identity:", await invoke(contract.call("register_identity", proofVal(reg), pubVal(reg))));

  // 4) post (tweet sobre la comida argentina)
  const tweet = "El asado argentino es patrimonio cultural. 🇦🇷🥩";
  const ch = contentHash(tweet);
  const postP = await platformProof(cred, ch);
  console.log("[4] post:", await invoke(contract.call("post", proofVal(postP), pubVal(postP))));

  // 5) get_post(0)
  const account = new StellarSdk.Account(kp.publicKey(), "0");
  const q = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: cfg.pass })
    .addOperation(contract.call("get_post", xdr.ScVal.scvU64(new xdr.Uint64(0n))))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(q);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const record = scValToNative(sim.result!.retval);
  console.log("[5] get_post(0):", JSON.stringify(record, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  console.log("\n✅ E2E CAPA 2 OK — post anclado bajo platformId, sin address del KYC");
}
main().catch((e) => {
  console.error("❌ E2E CAPA 2 falló:", e.message);
  process.exit(1);
});
