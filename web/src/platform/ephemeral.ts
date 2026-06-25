// Cuenta efímera para pagar el fee on-chain — NUNCA el address del KYC.
// Se genera al vuelo y se fondea con friendbot (testnet). No tiene relación con la
// identidad del KYC: rompe el link address-KYC <-> actividad de plataforma.
import * as StellarSdk from "@stellar/stellar-sdk";

const FRIENDBOT = import.meta.env.VITE_FRIENDBOT_URL ?? "https://friendbot.stellar.org";

export async function createFundedEphemeral(): Promise<StellarSdk.Keypair> {
  const kp = StellarSdk.Keypair.random();
  const res = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(kp.publicKey())}`);
  if (!res.ok) throw new Error(`friendbot no pudo fondear la cuenta efímera (${res.status})`);
  await res.json().catch(() => null);
  return kp;
}
