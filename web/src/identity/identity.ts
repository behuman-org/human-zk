// Puente de identidad: conecta la lógica real de Capa 1 (KYC-ZK) con la UI social.
// - Capa 1: wallet + `is_verified(address)` on-chain (sin exponer la address en la UI).
// - Capa 2: deriva el `platformId` anónimo desde la credencial del device (prueba ZK local).
// La PII/secret nunca salen del dispositivo; la UI nunca muestra address/platformId completos.
import { connectWallet } from "../kyc/wallet";
import { isVerified } from "../kyc/chain";
import { loadAnyCredential, type StoredCredential } from "../kyc/credentialStore";
import { generatePlatformProof, handleOf, platformIdHex } from "../platform/zk2";

export interface ConnectResult {
  address: string;
  verified: boolean; // is_verified on-chain (Capa 1)
}

/** Conecta la wallet y consulta si ya es un humano verificado on-chain. */
export async function connectAndCheck(): Promise<ConnectResult> {
  const address = await connectWallet();
  let verified = false;
  try {
    verified = await isVerified(address);
  } catch {
    verified = false; // sin red/contrato no bloqueamos; el onboarding decide
  }
  return { address, verified };
}

/** ¿Hay una credencial de Capa 1 en este dispositivo? */
export function hasCredential(): boolean {
  return !!loadAnyCredential();
}

export function getCredential(): StoredCredential | null {
  return loadAnyCredential();
}

export interface PlatformIdentity {
  platformId: string; // hex (no se muestra completo)
  handle: string; // seudónimo corto (últimos 5)
}

/**
 * Deriva la identidad anónima de plataforma desde la credencial Capa 1 (prueba ZK local).
 * Devuelve `null` si no hay credencial (la persona aún no se verificó en este device).
 */
export async function derivePlatformIdentity(): Promise<PlatformIdentity | null> {
  const cred = loadAnyCredential();
  if (!cred) return null;
  const p = await generatePlatformProof(cred, "0");
  const platformId = platformIdHex(p.publicSignals[1]);
  return { platformId, handle: handleOf(platformId) };
}
