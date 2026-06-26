// Store local del funding (JSON, gitignored). ⚠️ Cero PII: solo campañas, donaciones por
// wallet efímera (seudónimo), y opiniones por platformId. Nada atable al KYC.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Campaign, CampaignOpinion, Donation } from "@behuman/shared";

const here = dirname(fileURLToPath(import.meta.url));
const STORE = process.env.FUNDING_STORE ?? resolve(here, "..", ".funding-store.json");

export interface FundingState {
  campaigns: Campaign[];
  donations: Donation[];
  opinions: CampaignOpinion[];
  nullifiers: Record<string, boolean>; // "campaignId:nullifier" -> usado (anti-Sybil opinión)
}

const EMPTY: FundingState = { campaigns: [], donations: [], opinions: [], nullifiers: {} };

export function load(): FundingState {
  if (!existsSync(STORE)) return structuredClone(EMPTY);
  return { ...structuredClone(EMPTY), ...(JSON.parse(readFileSync(STORE, "utf8")) as Partial<FundingState>) };
}
export function save(s: FundingState): void {
  writeFileSync(STORE, JSON.stringify(s, null, 2));
}
