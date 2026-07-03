// Dirección Stellar usada en verify_and_register (pública, no PII). Necesaria para
// re-consultar is_verified(address) al establecer la sesión de Capa 2.
const KEY = "behuman.kyc.registrationAddress";

export function saveRegistrationAddress(address: string): void {
  try {
    sessionStorage.setItem(KEY, address);
  } catch {
    /* ignore */
  }
}

export function loadRegistrationAddress(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearRegistrationAddress(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
