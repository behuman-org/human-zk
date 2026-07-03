import type { Campaign } from "@behuman/shared";

/** Omite campos sensibles antes de serializar una Campaign por HTTP. */
export function sanitizeCampaign(c: Campaign): Campaign {
  const { signerSecretsDev: _secrets, ...safe } = c;
  return safe;
}
