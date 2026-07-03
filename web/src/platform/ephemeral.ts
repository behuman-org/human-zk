// Cuenta efímera para pagar el fee on-chain — NUNCA el address del KYC.
// Se genera al vuelo y se fondea con friendbot (testnet). No tiene relación con la
// identidad del KYC: rompe el link address-KYC <-> actividad de plataforma.
//
// SECURITY: la secret Stellar se cifra en reposo (lib/secureStorage.ts).
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc } from "./stellar2";
import { secureGetItem, secureGetItemSyncLegacy, secureSetItem } from "../lib/secureStorage";

const FRIENDBOT = import.meta.env.VITE_FRIENDBOT_URL ?? "https://friendbot.stellar.org";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function createFundedEphemeral(): Promise<StellarSdk.Keypair> {
  const kp = StellarSdk.Keypair.random();
  const res = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(kp.publicKey())}`);
  if (!res.ok) throw new Error(`friendbot no pudo fondear la cuenta efímera (${res.status})`);
  await res.json().catch(() => null);
  for (let i = 0; i < 20; i++) {
    try {
      await rpc.getAccount(kp.publicKey());
      return kp;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error("la cuenta efímera no apareció en el RPC tras el fondeo");
}

const STORAGE_KEY = "behuman.ephemeral.secret";

let cachedKp: StellarSdk.Keypair | null = null;

async function loadStoredEphemeral(): Promise<StellarSdk.Keypair | null> {
  if (cachedKp) return cachedKp;
  const enc = await secureGetItem<string>(STORAGE_KEY);
  const secret = enc ?? secureGetItemSyncLegacy<string>(STORAGE_KEY);
  if (!secret) return null;
  try {
    cachedKp = StellarSdk.Keypair.fromSecret(secret);
    if (enc !== secret) void secureSetItem(STORAGE_KEY, secret);
    return cachedKp;
  } catch {
    return null;
  }
}

function storeEphemeral(kp: StellarSdk.Keypair): void {
  cachedKp = kp;
  void secureSetItem(STORAGE_KEY, kp.secret());
}

export async function getOrCreateFundedEphemeral(): Promise<StellarSdk.Keypair> {
  const stored = await loadStoredEphemeral();
  if (stored) {
    try {
      await rpc.getAccount(stored.publicKey());
      return stored;
    } catch {
      cachedKp = null;
    }
  }
  const kp = await createFundedEphemeral();
  storeEphemeral(kp);
  return kp;
}
