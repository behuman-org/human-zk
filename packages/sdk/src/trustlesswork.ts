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
  /** Firma un XDR (con la secret del rol) antes de /helper/send-transaction. Inyectado por el server. */
  signXdr?: (xdr: string) => Promise<string> | string;
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

// ⚠️ ESTADO: endpoints/bodies ALINEADOS al OpenAPI real de api.trustlesswork.com
// (/api-json, escrow "single-release"). Auth real = header `x-api-key` (NO Bearer).
// PATRÓN REAL: cada acción devuelve un XDR sin firmar; el rol correspondiente lo firma y se
// envía a POST /helper/send-transaction { signedXdr }. La orquestación de firma (con las
// secrets de los firmantes) queda PENDIENTE de validación en vivo: la API key provista
// responde 401 (hay que activarla/autorizarla en dapp.trustlesswork.com). Hasta entonces el
// modo "dev" (mock) es el camino operativo. Las reglas de release 2-de-3 las enforcea
// además nuestro contrato on-chain `campaign_controller` (autoridad última).
//
// Endpoints reales (single-release):
//   POST /deployer/single-release            { signer, engagementId, title, description,
//                                              roles, amount, platformFee, milestones, trustline } -> { xdr }
//   POST /escrow/single-release/approve-milestone  { contractId, milestoneIndex, approver } -> { xdr }
//   POST /escrow/single-release/release-funds      { contractId, releaseSigner }            -> { xdr }
//   POST /escrow/single-release/dispute-escrow     { contractId, ... }                      -> { xdr }
//   POST /escrow/single-release/resolve-dispute    { contractId, ... }                      -> { xdr }
//   POST /helper/send-transaction                  { signedXdr }                            -> result
function realTW(cfg: TrustlessWorkConfig): TrustlessWork {
  const base = cfg.apiUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers["x-api-key"] = cfg.apiKey;
  async function post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`trustlesswork ${path} -> HTTP ${res.status} ${await res.text().catch(() => "")}`);
    return res.json();
  }
  /** Firma el XDR con la secret del rol y lo envía a /helper/send-transaction. */
  async function sign(xdr: string): Promise<{ hash: string }> {
    const signed = cfg.signXdr ? await cfg.signXdr(xdr) : xdr;
    const r = await post(`/helper/send-transaction`, { signedXdr: signed });
    return { hash: String(r.txHash ?? r.hash ?? "") };
  }
  return {
    provider: "real",
    async deployEscrow(input) {
      const r = await post(`/deployer/single-release`, {
        signer: input.roles.platformAddress,
        engagementId: input.milestones[0]?.id ?? "campaign",
        title: "beHuman campaign escrow",
        description: "Funding ZK campaign",
        roles: input.roles,
        amount: Number(input.amount),
        platformFee: 0,
        milestones: input.milestones.map((m) => ({ description: m.title })),
        trustline: [input.asset],
      });
      await sign(r.xdr); // deploy on-chain; el contractId se resuelve del resultado/indexer
      return { escrowId: r.contractId ?? r.escrowId ?? r.xdr };
    },
    async updateMilestone(contractId, milestoneId, _evidenceUri) {
      const r = await post(`/escrow/single-release/change-milestone-status`, {
        contractId,
        milestoneIndex: milestoneId,
        newStatus: "completed",
      });
      await sign(r.xdr);
    },
    async approveMilestone(contractId, milestoneId, approver) {
      const r = await post(`/escrow/single-release/approve-milestone`, {
        contractId,
        milestoneIndex: milestoneId,
        approver,
      });
      await sign(r.xdr);
    },
    async releaseFunds(contractId, signers) {
      if (signers.length < RELEASE_THRESHOLD) throw new Error("release: faltan firmas (2-de-3)");
      const r = await post(`/escrow/single-release/release-funds`, {
        contractId,
        releaseSigner: signers[0],
      });
      return sign(r.xdr);
    },
    async startDispute(contractId, _by, _reason) {
      const r = await post(`/escrow/single-release/dispute-escrow`, { contractId });
      await sign(r.xdr);
    },
    async resolveDispute(contractId, _resolver, outcome) {
      const r = await post(`/escrow/single-release/resolve-dispute`, { contractId, outcome });
      await sign(r.xdr);
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
