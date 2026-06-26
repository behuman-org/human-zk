// Backend del Funding ZK (CAPA 3). Orquesta DeFindex (yield/Blend) + Trustless Work
// (escrow/release) y aplica las reglas no-custodiales (release 2-de-3 + meta; refund
// todo-o-nada). Donar/opinar gateado por personhood (Capa 1) sin revelar identidad.
//
// ⚠️ Cero PII on-chain/off-chain. Wallets de donación = seudónimos efímeros (no KYC).
// Las reglas de release/refund las ENFORCEa on-chain el campaign_controller (Fase 3);
// acá se reflejan para el flujo dev/testnet-API.
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import {
  createDefindex,
  createTrustlessWork,
  RELEASE_THRESHOLD,
  type FundingProviderKind,
} from "@behuman/sdk";
import { reviewPost } from "@behuman/curation";
import type {
  Campaign,
  CampaignOpinion,
  CurationVerdict,
  Donation,
  FundingAsset,
  Milestone,
  Sentiment,
} from "@behuman/shared";
import { load, save } from "./store.js";
import { verifyMembership, type MembershipProof } from "./gating.js";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "..", "..", "..", ".env") });

const provider = (process.env.FUNDING_PROVIDER ?? "dev") as FundingProviderKind;
const ASSET = (process.env.ASSET ?? "XLM") as FundingAsset;
const defindex = createDefindex({
  provider,
  apiUrl: process.env.DEFINDEX_API_URL ?? "https://api.defindex.io",
  apiKey: process.env.DEFINDEX_API_KEY,
});
const tw = createTrustlessWork({
  provider,
  apiUrl: process.env.TRUSTLESS_WORK_API_URL ?? "https://api.trustlesswork.com",
  apiKey: process.env.TRUSTLESS_WORK_API_KEY,
});

const num = (s: string) => Number(s);
const handleOf = (platformId: string) => platformId.slice(-5);

/** Posición simulada (dev): underlying = principal * (1 + apy * añosTranscurridos). */
function position(campaign: Campaign, donations: Donation[], wallet: string, apy: number) {
  const mine = donations.filter((d) => d.campaignId === campaign.id && d.donorWallet === wallet);
  const principal = mine.reduce((a, d) => a + num(d.amount), 0);
  const years = Math.max(0, (Date.now() - campaign.createdAt) / (365 * 24 * 3600 * 1000));
  const underlying = principal * (1 + apy * years);
  return { shares: principal.toString(), underlying: underlying.toFixed(7), apy };
}

const app = express();
app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, provider, asset: ASSET }));

// ─── Campañas (setup por la plataforma) ───────────────────────────────────────
app.post("/campaigns", async (req, res) => {
  const b = req.body ?? {};
  if (!b.title || !b.goalAmount || !b.causeWallet || !b.signers?.platform) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const id = randomUUID();
  const milestones: Milestone[] = (b.milestones ?? []).map((m: { title: string; description?: string }) => ({
    id: randomUUID(),
    title: m.title,
    description: m.description,
    status: "pending" as const,
  }));
  const signers = {
    cause: String(b.signers.cause ?? b.causeWallet),
    platform: String(b.signers.platform),
    neutral: String(b.signers.neutral ?? process.env.FUNDING_NEUTRAL_ADDRESS ?? ""),
  };

  // Deploy del escrow (Trustless Work) — workflow/disputa; el dinero vive en el vault.
  const escrow = await tw.deployEscrow({
    asset: ASSET,
    amount: String(b.goalAmount),
    roles: {
      serviceProvider: signers.cause,
      approver: signers.platform,
      receiver: String(b.causeWallet),
      disputeResolver: signers.neutral,
      platformAddress: signers.platform,
      releaseSigners: [signers.cause, signers.platform, signers.neutral],
    },
    milestones: milestones.map((m) => ({ id: m.id, title: m.title })),
  });

  const campaign: Campaign = {
    id,
    title: String(b.title),
    summary: String(b.summary ?? ""),
    asset: ASSET,
    goalAmount: String(b.goalAmount),
    raisedAmount: "0",
    deadline: Number(b.deadline ?? Date.now() + 30 * 24 * 3600 * 1000),
    causeWallet: String(b.causeWallet),
    vaultAddress: provider === "dev" ? "vault_dev_" + id.slice(0, 8) : String(b.vaultAddress ?? ""),
    controllerAddress: b.controllerAddress ? String(b.controllerAddress) : undefined,
    escrowId: escrow.escrowId,
    signers,
    milestones,
    state: "fundraising",
    createdAt: Date.now(),
  };
  const s = load();
  s.campaigns.push(campaign);
  save(s);
  res.json(campaign);
});

app.get("/campaigns", (_req, res) => res.json(load().campaigns));
app.get("/campaigns/:id", (req, res) => {
  const c = load().campaigns.find((x) => x.id === req.params.id);
  return c ? res.json(c) : res.status(404).json({ error: "not_found" });
});

// ─── Donación anónima (gateada por personhood) ────────────────────────────────
app.post("/campaigns/:id/donate", async (req, res) => {
  const s = load();
  const c = s.campaigns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  if (c.state !== "fundraising") return res.status(409).json({ error: "not_fundraising" });

  const membership = req.body?.membershipProof as MembershipProof | undefined;
  const donorWallet = String(req.body?.donorWallet ?? "");
  const amount = String(req.body?.amount ?? "");
  if (!donorWallet || !amount || num(amount) <= 0) return res.status(400).json({ error: "bad_amount" });

  if (!(await verifyMembership(membership))) {
    return res.status(403).json({ error: "not_verified_human" });
  }

  // Arma la tx de depósito (real: XDR a firmar por la wallet anónima; dev: marcador).
  const { xdr } = await defindex.buildDeposit(c.vaultAddress!, donorWallet, amount);

  // En dev finalizamos directo (sin firma real). En real, el cliente firma y confirma.
  const donation: Donation = {
    campaignId: c.id,
    donorWallet,
    amount,
    txHash: provider === "dev" ? (await defindex.send(xdr)).hash : "",
    ts: Date.now(),
  };
  if (provider === "dev") {
    s.donations.push(donation);
    c.raisedAmount = (num(c.raisedAmount) + num(amount)).toString();
    save(s);
    return res.json({ ok: true, donation, raisedAmount: c.raisedAmount });
  }
  // real: devolver XDR para firmar; el cliente llama /donate/confirm
  res.json({ ok: true, xdr });
});

app.get("/campaigns/:id/position", async (req, res) => {
  const s = load();
  const c = s.campaigns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const apy = await defindex.apy(c.vaultAddress!);
  res.json(position(c, s.donations, String(req.query.wallet ?? ""), apy));
});

// ─── Hitos (causa reporta; plataforma aprueba) ────────────────────────────────
app.post("/campaigns/:id/milestones/:mid/approve", async (req, res) => {
  const s = load();
  const c = s.campaigns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const m = c.milestones.find((x) => x.id === req.params.mid);
  if (!m) return res.status(404).json({ error: "milestone_not_found" });
  const approver = String(req.body?.approver ?? "");
  if (approver !== c.signers.platform) return res.status(403).json({ error: "approver_must_be_platform" });
  await tw.approveMilestone(c.escrowId!, m.id, approver);
  m.status = "approved";
  save(s);
  res.json(m);
});

// ─── Release (2-de-3 + meta + hitos) → causa recibe capital + yield ────────────
app.post("/campaigns/:id/release", async (req, res) => {
  const s = load();
  const c = s.campaigns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  if (c.state !== "fundraising") return res.status(409).json({ error: "not_fundraising" });

  const valid = new Set([c.signers.cause, c.signers.platform, c.signers.neutral]);
  const signers = [...new Set((req.body?.signers ?? []).map(String))].filter((x) => valid.has(x as string));
  if (signers.length < RELEASE_THRESHOLD) return res.status(403).json({ error: "need_2_of_3_signers" });
  if (!c.milestones.every((m) => m.status === "approved")) {
    return res.status(409).json({ error: "milestones_not_approved" });
  }
  if (num(c.raisedAmount) < num(c.goalAmount)) return res.status(409).json({ error: "goal_not_reached" });

  // release on-chain (workflow) + withdraw de Blend hacia la causa (capital + yield).
  const { hash } = await tw.releaseFunds(c.escrowId!, signers as string[]);
  await defindex.buildWithdraw(c.vaultAddress!, c.controllerAddress ?? c.signers.platform, c.raisedAmount);
  const apy = await defindex.apy(c.vaultAddress!);
  const total = position(c, s.donations, "__all__", apy); // underlying total ~ aproximado
  c.state = "released";
  save(s);
  res.json({ ok: true, state: c.state, txHash: hash, releasedTo: c.causeWallet, capitalPlusYield: c.raisedAmount, apy });
  void total;
});

// ─── Refund todo-o-nada (deadline sin meta, o disputa a favor de donantes) ─────
app.post("/campaigns/:id/refund", async (req, res) => {
  const s = load();
  const c = s.campaigns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const donorWallet = String(req.body?.donorWallet ?? "");
  if (!donorWallet) return res.status(400).json({ error: "missing_donorWallet" });

  const failed = (Date.now() > c.deadline && num(c.raisedAmount) < num(c.goalAmount)) || c.state === "disputed";
  if (c.state === "released") return res.status(409).json({ error: "already_released" });
  if (!failed && c.state !== "refunding") return res.status(409).json({ error: "campaign_not_failed" });
  c.state = "refunding";

  const apy = await defindex.apy(c.vaultAddress!);
  const pos = position(c, s.donations, donorWallet, apy); // principal + yield del donante
  if (num(pos.shares) <= 0) return res.status(404).json({ error: "no_position" });
  await defindex.buildWithdraw(c.vaultAddress!, donorWallet, pos.shares);
  // marca las donaciones de esa wallet como reembolsadas (saca del cómputo)
  s.donations = s.donations.filter((d) => !(d.campaignId === c.id && d.donorWallet === donorWallet));
  save(s);
  res.json({ ok: true, refundedTo: donorWallet, amount: pos.underlying });
});

// ─── Opiniones anónimas por campaña (Capa 2 scopeada; nullifier por campaña) ───
// publicSignals esperadas (circuito de funding): [issuerRoot, platformId, nullifier, contentHash]
app.post("/campaigns/:id/opinions", async (req, res) => {
  const s = load();
  const c = s.campaigns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: "not_found" });

  const membership = req.body?.membershipProof as MembershipProof | undefined;
  const platformId = String(req.body?.platformId ?? "");
  const nullifier = String(req.body?.nullifier ?? "");
  const content = String(req.body?.content ?? "").trim().slice(0, 560);
  const contentHash = String(req.body?.contentHash ?? "");
  const sentiment = (["support", "oppose", "neutral"].includes(req.body?.sentiment) ? req.body.sentiment : "neutral") as Sentiment;
  const txHash = String(req.body?.txHash ?? "");
  if (!platformId || !nullifier || !content || !contentHash) return res.status(400).json({ error: "missing_fields" });

  if (!(await verifyMembership(membership))) return res.status(403).json({ error: "not_verified_human" });

  // Anti-Sybil por campaña: 1 humano = 1 voz (nullifier scopeado a la campaña).
  const nkey = `${c.id}:${nullifier}`;
  const reused = s.nullifiers[nkey];

  // Curaduría (Nivel 1) — solo contenido + seudónimo; fail-safe -> escalar.
  let curation: CurationVerdict;
  try {
    curation = await reviewPost({ platformId, handle: handleOf(platformId), content });
  } catch {
    curation = { status: "escalated", reason: "Curador no disponible; revisión humana." };
  }

  const opinion: CampaignOpinion = {
    id: randomUUID(),
    campaignId: c.id,
    platformId,
    handle: handleOf(platformId),
    content,
    contentHash,
    sentiment,
    txHash,
    curation,
    ts: Date.now(),
  };

  if (reused) {
    // Ya tiene voz en esta campaña: puede publicar texto adicional, pero su SENTIMIENTO no
    // se vuelve a contar (no infla el sentimiento). Se marca como tal.
    opinion.sentiment = "neutral";
    s.opinions.push(opinion);
    save(s);
    return res.json({ ...opinion, note: "sentiment_already_counted_for_campaign" });
  }

  s.nullifiers[nkey] = true;
  s.opinions.push(opinion);
  save(s);
  res.json(opinion);
});

app.get("/campaigns/:id/opinions", (req, res) => {
  const s = load();
  const list = s.opinions.filter((o) => o.campaignId === req.params.id && o.curation?.status !== "escalated");
  const counted = list.filter((o) => o.sentiment !== "neutral");
  const sentiment = {
    support: counted.filter((o) => o.sentiment === "support").length,
    oppose: counted.filter((o) => o.sentiment === "oppose").length,
  };
  res.json({ opinions: [...list].reverse(), sentiment });
});

const port = Number(process.env.FUNDING_API_PORT ?? 8789);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(port, () => console.log(`beHuman funding API en :${port} (provider=${provider}, asset=${ASSET})`));
}

export { app };
