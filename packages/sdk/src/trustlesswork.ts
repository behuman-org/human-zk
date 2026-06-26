// Wrapper de Trustless Work (escrow / release) — https://docs.trustlesswork.com
//
// Capa de workflow/condiciones/disputas (NO custodia los fondos: el dinero vive en el
// vault DeFindex/Blend). Provider configurable "real" (API) / "dev" (mock).
//
// Roles (ver 05 - Roles y Modelo de Confianza): causa = Service Provider + Receiver,
// plataforma = Approver, release multi-firma 2-de-3, neutral = Dispute Resolver.
// ⚠️ Shapes "real" siguen el patrón de la doc; verificar contra docs.trustlesswork.com.
import type { FundingProviderKind } from "./defindex.js";

export interface TrustlessWorkConfig {
  provider: FundingProviderKind;
  apiUrl: string;
  apiKey?: string;
}

export interface EscrowRoles {
  serviceProvider: string; // causa
  approver: string; // plataforma
  receiver: string; // causa (wallet de la causa)
  disputeResolver: string; // neutral
  platformAddress: string; // plataforma (fee)
  releaseSigners: string[]; // 2-de-3: [causa, plataforma, neutral]
}

export interface EscrowMilestone {
  id: string;
  title: string;
}

export interface DeployEscrowInput {
  asset: string;
  amount: string;
  roles: EscrowRoles;
  milestones: EscrowMilestone[];
}

export interface TrustlessWork {
  readonly provider: FundingProviderKind;
  deployEscrow(input: DeployEscrowInput): Promise<{ escrowId: string }>;
  updateMilestone(escrowId: string, milestoneId: string, evidenceUri?: string): Promise<void>;
  approveMilestone(escrowId: string, milestoneId: string, approver: string): Promise<void>;
  /** Release multi-firma. `signers` debe alcanzar el umbral (2-de-3). */
  releaseFunds(escrowId: string, signers: string[]): Promise<{ hash: string }>;
  startDispute(escrowId: string, by: string, reason: string): Promise<void>;
  resolveDispute(escrowId: string, resolver: string, outcome: "release" | "refund"): Promise<void>;
}

export function createTrustlessWork(cfg: TrustlessWorkConfig): TrustlessWork {
  return cfg.provider === "real" ? realTW(cfg) : devTW();
}

const RELEASE_THRESHOLD = 2; // 2-de-3

function realTW(cfg: TrustlessWorkConfig): TrustlessWork {
  const base = cfg.apiUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  async function post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`trustlesswork ${path} -> HTTP ${res.status}`);
    return res.json();
  }
  return {
    provider: "real",
    async deployEscrow(input) {
      const r = await post(`/escrow/deploy`, input);
      return { escrowId: r.escrowId ?? r.id };
    },
    async updateMilestone(escrowId, milestoneId, evidenceUri) {
      await post(`/escrow/${escrowId}/milestone/${milestoneId}/update`, { evidenceUri });
    },
    async approveMilestone(escrowId, milestoneId, approver) {
      await post(`/escrow/${escrowId}/milestone/${milestoneId}/approve`, { approver });
    },
    async releaseFunds(escrowId, signers) {
      if (signers.length < RELEASE_THRESHOLD) throw new Error("release: faltan firmas (2-de-3)");
      const r = await post(`/escrow/${escrowId}/release`, { signers });
      return { hash: r.hash };
    },
    async startDispute(escrowId, by, reason) {
      await post(`/escrow/${escrowId}/dispute`, { by, reason });
    },
    async resolveDispute(escrowId, resolver, outcome) {
      await post(`/escrow/${escrowId}/dispute/resolve`, { resolver, outcome });
    },
  };
}

// dev: simulador sin red (el funding/api lleva el estado real de la campaña).
function devTW(): TrustlessWork {
  const fakeHash = () => "twdev" + Math.random().toString(16).slice(2, 12);
  return {
    provider: "dev",
    async deployEscrow() {
      return { escrowId: "escrow_dev_" + Math.random().toString(16).slice(2, 10) };
    },
    async updateMilestone() {},
    async approveMilestone() {},
    async releaseFunds(_escrowId, signers) {
      if (signers.length < RELEASE_THRESHOLD) throw new Error("release: faltan firmas (2-de-3)");
      return { hash: fakeHash() };
    },
    async startDispute() {},
    async resolveDispute() {},
  };
}

export { RELEASE_THRESHOLD };
