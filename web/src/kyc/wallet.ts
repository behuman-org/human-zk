// Conexión de wallet vía Stellar Wallets Kit (Freighter, xBull, LOBSTR…).
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc } from "./stellar";

const NETWORK_PASSPHRASE =
  import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE ?? StellarSdk.Networks.TESTNET;

const WALLET_NETWORK =
  NETWORK_PASSPHRASE === StellarSdk.Networks.PUBLIC
    ? WalletNetwork.PUBLIC
    : WalletNetwork.TESTNET;

const kit = new StellarWalletsKit({
  network: WALLET_NETWORK,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

const FRIENDBOT = import.meta.env.VITE_FRIENDBOT_URL ?? "https://friendbot.stellar.org";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Abre el modal de selección de wallet y devuelve el address conectado. */
export async function connectWallet(): Promise<string> {
  return new Promise((resolve, reject) => {
    kit
      .openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            resolve(address);
          } catch (e) {
            reject(e as Error);
          }
        },
        onClosed: (err) => reject(err ?? new Error("modal cerrado")),
      })
      .catch(reject);
  });
}

/**
 * Testnet: si la wallet recién conectada no existe todavía en la red (cuenta no fondeada,
 * típico en una wallet nueva), la fondea con friendbot. Sin esto, `init`/`verify_and_register`
 * fallan en simulación porque el RPC no encuentra la cuenta del firmante ("la wallet no es
 * fondeada"). No mueve fondos reales: es testnet.
 */
export async function ensureFunded(address: string): Promise<void> {
  if (WALLET_NETWORK === WalletNetwork.PUBLIC) return;
  try {
    await rpc.getAccount(address);
    return;
  } catch {
    /* no encontrada todavía: la fondeamos abajo */
  }
  await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(address)}`).catch(() => null);
  for (let i = 0; i < 20; i++) {
    try {
      await rpc.getAccount(address);
      return;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error("No pudimos fondear tu wallet en testnet automáticamente. Probá de nuevo en unos segundos.");
}

/** Firma un XDR con la wallet conectada; devuelve el XDR firmado. */
export async function signXdr(xdr: string, networkPassphrase: string): Promise<string> {
  const { signedTxXdr } = await kit.signTransaction(xdr, { networkPassphrase });
  return signedTxXdr;
}
