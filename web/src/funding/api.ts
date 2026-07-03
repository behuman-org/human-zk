// Cliente del backend de Funding ZK (CAPA 3). Campañas, donación anónima, posición
// (yield), hitos, release 2-de-3, refund todo-o-nada y opiniones por campaña.
import type { Campaign, CampaignOpinion, Sentiment } from "@behuman/shared";
import { requireEnv } from "../lib/envGuard";

const BASE = requireEnv("VITE_FUNDING_API_URL", "http://localhost:8789");

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
const post = (path: string, body: unknown) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export async function listCampaigns(): Promise<Campaign[]> {
  return json(await fetch(`${BASE}/campaigns`));
}

export async function getCampaign(id: string): Promise<Campaign> {
  return json(await fetch(`${BASE}/campaigns/${id}`));
}

export interface MembershipProof {
  proof: unknown;
  publicSignals: string[];
}

export async function donate(
  campaignId: string,
  donorWallet: string,
  amount: string,
  membershipProof: MembershipProof,
): Promise<{ ok: boolean; raisedAmount?: string; xdr?: string; donation?: { txHash: string } }> {
  return json(await post(`/campaigns/${campaignId}/donate`, { donorWallet, amount, membershipProof }));
}

export interface Position {
  shares: string;
  underlying: string;
  apy: number;
}
// RT-05: /position exige prueba de titularidad (firma del challenge con la secret de la wallet).
export async function getPosition(campaignId: string, wallet: string, sig: string): Promise<Position> {
  const q = `wallet=${encodeURIComponent(wallet)}&sig=${encodeURIComponent(sig)}`;
  return json(await fetch(`${BASE}/campaigns/${campaignId}/position?${q}`));
}

// RT-01: las acciones approve/release/refund se autentican con FIRMAS Stellar reales.
export interface SignedAction {
  signer: string;
  signature: string;
}

export async function approveMilestone(campaignId: string, milestoneId: string, signature: SignedAction) {
  return json(await post(`/campaigns/${campaignId}/milestones/${milestoneId}/approve`, { signature }));
}

export async function release(campaignId: string, signatures: SignedAction[]) {
  return json<{ ok: boolean; state: string; txHash: string; capitalPlusYield: string }>(
    await post(`/campaigns/${campaignId}/release`, { signatures }),
  );
}

export async function refund(campaignId: string, donorWallet: string, signature: SignedAction) {
  return json<{ ok: boolean; refundedTo: string; amount: string }>(
    await post(`/campaigns/${campaignId}/refund`, { donorWallet, signature }),
  );
}

export interface OpinionProof {
  proof: unknown;
  publicSignals: string[]; // [issuerRoot, platformId, nullifier, scope, nullScope, contentHash]
}

export async function postOpinion(
  campaignId: string,
  content: string,
  sentiment: Sentiment,
  opinionProof: OpinionProof,
  txHash?: string,
): Promise<CampaignOpinion> {
  return json(await post(`/campaigns/${campaignId}/opinions`, { content, sentiment, opinionProof, txHash }));
}

export async function getOpinions(
  campaignId: string,
): Promise<{ opinions: CampaignOpinion[]; sentiment: { support: number; oppose: number } }> {
  return json(await fetch(`${BASE}/campaigns/${campaignId}/opinions`));
}
