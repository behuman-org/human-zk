// Backend del Funding ZK (CAPA 3). Orquesta DeFindex (yield/Blend) + Trustless Work
// (escrow/release) y aplica las reglas no-custodiales (release 2-de-3 + meta; refund
// todo-o-nada). Donar/opinar gateado por personhood (Capa 1) sin revelar identidad.
//
// ⚠️ Cero PII on-chain/off-chain. Wallets de donación = seudónimos efímeros (no KYC).
//
// AUTORIDAD ÚLTIMA = el contrato on-chain `campaign_controller` (ya implementado): exige
// `require_auth` por firmante en release/donate y reglas de deadline/meta. Mientras no esté
// desplegado, esta API REFLEJA esas reglas y ORQUESTA los providers. Por eso:
//   - RT-01: approve/release/refund exigen FIRMA Stellar real sobre un challenge
//     determinístico (no se aceptan direcciones públicas como credencial).
//   - RT-04: deadline aplicado (donar/release solo antes del deadline; éxito = meta a tiempo).
//   - RT-06: toda mutación del store es serializada (withStore) y el nullifier es atómico.
//   - RT-07: handlers async envueltos; errores de providers → 502 controlado, sin crashear.
//   - RT-08: el conteo anti-Sybil persiste aunque el curador no esté; moderación = solo visibilidad.
//   - RT-09: refund devuelve EXACTAMENTE el principal y marca reembolsado (idempotente, no borra).
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  contentHashField,
  createDefindex,
  createTrustlessWork,
  fundingChallenge,
  generateFundingKeypair,
  RELEASE_THRESHOLD,
  signFundingAction,
  validReleaseSigners,
  verifyFundingSignature,
  type FundingProviderKind,
  type SignedAction,
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
import { claimNullifier, hydrate, load, withStore } from "./store.js";
import { sanitizeCampaign } from "./sanitize.js";
import {
  verifyFundingOpinion,
  verifyMembership,
  type FundingOpinionProofInput,
  type MembershipProof,
} from "./gating.js";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "..", "..", "..", ".env") });

const RAW_PROVIDER = process.env.FUNDING_PROVIDER ?? "dev";
if (RAW_PROVIDER !== "dev") {
  const msg =
    "El modo funding 'real' (DeFindex/TrustlessWork/campaign_controller) no está implementado; " +
    "usar FUNDING_PROVIDER=dev. Ver docs/funding.md";
  console.error(`[funding-api] ${msg}`);
  throw new Error(msg);
}
const provider = "dev" as const satisfies FundingProviderKind;
const ASSET = (process.env.ASSET ?? "XLM") as FundingAsset;
const NETWORK = (process.env.DEFINDEX_NETWORK ?? "testnet") as "testnet" | "mainnet" | "public";
const defindex = createDefindex({
  provider,
  apiUrl: process.env.DEFINDEX_API_URL ?? "https://api.defindex.io",
  apiKey: process.env.DEFINDEX_API_KEY,
  network: NETWORK,
});
const tw = createTrustlessWork({
  provider,
  apiUrl: process.env.TRUSTLESS_WORK_API_URL ?? "https://api.trustlesswork.com",
  apiKey: process.env.TRUSTLESS_WORK_API_KEY,
});

const num = (s: string) => Number(s);
const handleOf = (platformId: string) => platformId.slice(-5);

/** Error con status HTTP para respuestas controladas. */
class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}
const bad = (status: number, code: string): never => {
  throw new HttpError(status, code);
};

/** Wrapper de handlers async: cualquier rechazo va al middleware de error (RT-07). */
type AsyncHandler = (req: Request, res: Response) => Promise<unknown>;
const wrap = (h: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(h(req, res)).catch(next);

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
app.post(
  "/campaigns",
  wrap(async (req, res) => {
    const b = req.body ?? {};
    // En dev la API genera/deriva los keypairs (signerSecretsDev opcional en el body).
    const hasSigner = true;
    if (!b.title || !b.goalAmount || !b.causeWallet || !hasSigner) {
      return bad(400, "missing_fields");
    }
    const id = randomUUID();
    const milestones: Milestone[] = (b.milestones ?? []).map(
      (m: { title: string; description?: string }) => ({
        id: randomUUID(),
        title: m.title,
        description: m.description,
        status: "pending" as const,
      }),
    );
    // RT-01: en dev/demo generamos KEYPAIRS REALES para los firmantes (a menos que el caller
    // los provea), para que el panel validador pueda FIRMAR el challenge y la API verifique la
    // firma. Los secrets se persisten en el store pero NUNCA se devuelven por HTTP.
    let signerSecretsDev: { cause: string; platform: string; neutral: string } | undefined;
    let signers: { cause: string; platform: string; neutral: string };
    const provided = b.signerSecretsDev as
      | { cause?: string; platform?: string; neutral?: string }
      | undefined;
    const cause = provided?.cause ?? generateFundingKeypair().secret;
    const platform = provided?.platform ?? generateFundingKeypair().secret;
    const neutral = provided?.neutral ?? generateFundingKeypair().secret;
    signerSecretsDev = { cause, platform, neutral };
    const addrOf = (sec: string) => signFundingAction(sec, "x").signer;
    signers = { cause: addrOf(cause), platform: addrOf(platform), neutral: addrOf(neutral) };

    // Deploy del escrow (Trustless Work). Si el provider externo falla → 502 controlado.
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
      vaultAddress: "vault_dev_" + id.slice(0, 8),
      controllerAddress: b.controllerAddress ? String(b.controllerAddress) : undefined,
      escrowId: escrow.escrowId,
      signers,
      signerSecretsDev, // ⚠️ solo presente en dev/demo (undefined en prod)
      milestones,
      state: "fundraising",
      createdAt: Date.now(),
    };
    await withStore((s) => {
      s.campaigns.push(campaign);
    });
    res.json(sanitizeCampaign(campaign));
  }),
);

// Aumenta una campaña con stats derivados (read-only) para la UX: donantes únicos + APY estim.
async function withStats(c: Campaign, donations: Donation[]): Promise<Campaign> {
  const wallets = new Set(donations.filter((d) => d.campaignId === c.id).map((d) => d.donorWallet));
  let estApy: number | undefined;
  try {
    estApy = await defindex.apy(c.vaultAddress!);
  } catch {
    estApy = undefined; // si el provider de yield no responde, omitimos el dato (no rompe la lista)
  }
  return sanitizeCampaign({ ...c, donorCount: wallets.size, estApy });
}

app.get(
  "/campaigns",
  wrap(async (_req, res) => {
    const s = load();
    res.json(await Promise.all(s.campaigns.map((c) => withStats(c, s.donations))));
  }),
);
app.get(
  "/campaigns/:id",
  wrap(async (req, res) => {
    const s = load();
    const c = s.campaigns.find((x) => x.id === req.params.id);
    return c ? res.json(await withStats(c, s.donations)) : bad(404, "not_found");
  }),
);

// ─── Donación anónima (gateada por personhood) ────────────────────────────────
app.post(
  "/campaigns/:id/donate",
  wrap(async (req, res) => {
    const snapshot = load().campaigns.find((x) => x.id === req.params.id);
    if (!snapshot) return bad(404, "not_found");
    if (snapshot.state !== "fundraising") return bad(409, "not_fundraising");
    // RT-04: no aceptar donaciones después del deadline (paridad con el contrato).
    if (Date.now() > snapshot.deadline) return bad(409, "deadline_passed");

    const membership = req.body?.membershipProof as MembershipProof | undefined;
    const donorWallet = String(req.body?.donorWallet ?? "");
    const amount = String(req.body?.amount ?? "");
    if (!donorWallet || !amount || num(amount) <= 0) return bad(400, "bad_amount");

    if (!(await verifyMembership(membership))) return bad(403, "not_verified_human");

    // Arma la tx de depósito (dev: marcador determinista) y finaliza directo.
    const { xdr } = await defindex.buildDeposit(snapshot.vaultAddress!, donorWallet, amount);
    const txHash = (await defindex.send(xdr)).hash;
    const out = await withStore((s) => {
      const c = s.campaigns.find((x) => x.id === snapshot.id);
      if (!c) return bad(404, "not_found");
      if (c.state !== "fundraising") return bad(409, "not_fundraising");
      if (Date.now() > c.deadline) return bad(409, "deadline_passed");
      const donation: Donation = { campaignId: c.id, donorWallet, amount, txHash, ts: Date.now() };
      s.donations.push(donation);
      c.raisedAmount = (num(c.raisedAmount) + num(amount)).toString();
      return { donation, raisedAmount: c.raisedAmount };
    });
    res.json({ ok: true, ...out });
  }),
);

// RT-05: el monto donado es público por diseño (MVP), pero NO se expone por wallet arbitraria
// sin demostrar titularidad. El titular firma un challenge con la secret de su wallet efímera.
app.get(
  "/campaigns/:id/position",
  wrap(async (req, res) => {
    const s = load();
    const c = s.campaigns.find((x) => x.id === req.params.id);
    if (!c) return bad(404, "not_found");
    const wallet = String(req.query.wallet ?? "");
    if (!wallet) return bad(400, "missing_wallet");
    // Prueba de titularidad: firma del challenge "position:<id>:<wallet>" con la secret.
    const challenge = fundingChallenge("refund", c.id, `position:${wallet}`);
    const sig = String(req.query.sig ?? "");
    if (!verifyFundingSignature({ signer: wallet, signature: sig }, challenge)) {
      return bad(403, "ownership_proof_required");
    }
    const apy = await defindex.apy(c.vaultAddress!);
    res.json(position(c, s.donations, wallet, apy));
  }),
);

// ─── Hitos (causa reporta; plataforma aprueba) ────────────────────────────────
// RT-01: la aprobación exige FIRMA de la plataforma sobre el challenge de la acción.
app.post(
  "/campaigns/:id/milestones/:mid/approve",
  wrap(async (req, res) => {
    const snapshot = load().campaigns.find((x) => x.id === req.params.id);
    if (!snapshot) return bad(404, "not_found");
    const m0 = snapshot.milestones.find((x) => x.id === req.params.mid);
    if (!m0) return bad(404, "milestone_not_found");

    const challenge = fundingChallenge("approve", snapshot.id, req.params.mid);
    const signature = req.body?.signature as SignedAction | undefined;
    // Solo la plataforma puede aprobar, y debe FIRMARLO (no basta enviar su address).
    if (signature?.signer !== snapshot.signers.platform) return bad(403, "approver_must_be_platform");
    if (!verifyFundingSignature(signature, challenge)) return bad(403, "invalid_signature");

    await tw.approveMilestone(snapshot.escrowId!, m0.id, signature.signer);
    const m = await withStore((s) => {
      const c = s.campaigns.find((x) => x.id === snapshot.id);
      const mm = c?.milestones.find((x) => x.id === req.params.mid);
      if (!mm) return bad(404, "milestone_not_found");
      mm.status = "approved";
      return mm;
    });
    res.json(m);
  }),
);

// ─── Release (2-de-3 + meta + hitos) → causa recibe capital + yield ────────────
// RT-01: cada firmante envía una FIRMA del challenge "release:<id>:<raised>"; se verifica
// criptográficamente. No se aceptan direcciones públicas como credencial.
app.post(
  "/campaigns/:id/release",
  wrap(async (req, res) => {
    const snapshot = load().campaigns.find((x) => x.id === req.params.id);
    if (!snapshot) return bad(404, "not_found");
    if (snapshot.state !== "fundraising") return bad(409, "not_fundraising");
    // RT-04: éxito = meta alcanzada ANTES del deadline.
    if (Date.now() > snapshot.deadline) return bad(409, "deadline_passed");
    if (!snapshot.milestones.every((m) => m.status === "approved")) {
      return bad(409, "milestones_not_approved");
    }
    if (num(snapshot.raisedAmount) < num(snapshot.goalAmount)) return bad(409, "goal_not_reached");

    const authorized = [snapshot.signers.cause, snapshot.signers.platform, snapshot.signers.neutral];
    const challenge = fundingChallenge("release", snapshot.id, snapshot.raisedAmount);
    const signatures = req.body?.signatures as SignedAction[] | undefined;
    const valid = validReleaseSigners(signatures, authorized, challenge);
    if (valid.length < RELEASE_THRESHOLD) return bad(403, "need_2_of_3_valid_signatures");

    // release on-chain (workflow) + withdraw de Blend hacia la causa (capital + yield).
    const { hash } = await tw.releaseFunds(snapshot.escrowId!, valid);
    await defindex.buildWithdraw(
      snapshot.vaultAddress!,
      snapshot.controllerAddress ?? snapshot.signers.platform,
      snapshot.raisedAmount,
    );
    const apy = await defindex.apy(snapshot.vaultAddress!);
    const out = await withStore((s) => {
      const c = s.campaigns.find((x) => x.id === snapshot.id);
      if (!c) return bad(404, "not_found");
      if (c.state !== "fundraising") return bad(409, "not_fundraising");
      c.state = "released";
      return { state: c.state, releasedTo: c.causeWallet, capitalPlusYield: c.raisedAmount };
    });
    res.json({ ok: true, txHash: hash, apy, ...out });
  }),
);

// ─── Refund todo-o-nada (deadline sin meta) ───────────────────────────────────
// RT-01: el donante prueba titularidad de su wallet firmando el challenge.
// RT-09: devuelve EXACTAMENTE el principal; marca reembolsado (idempotente), no borra.
app.post(
  "/campaigns/:id/refund",
  wrap(async (req, res) => {
    const snapshot = load().campaigns.find((x) => x.id === req.params.id);
    if (!snapshot) return bad(404, "not_found");
    const donorWallet = String(req.body?.donorWallet ?? "");
    if (!donorWallet) return bad(400, "missing_donorWallet");

    // Prueba de titularidad de la wallet (firma del challenge de refund).
    const challenge = fundingChallenge("refund", snapshot.id, donorWallet);
    const signature = req.body?.signature as SignedAction | undefined;
    if (signature?.signer !== donorWallet) return bad(403, "ownership_proof_required");
    if (!verifyFundingSignature(signature, challenge)) return bad(403, "invalid_signature");

    // RT-09: falló = deadline vencido sin meta. NO se usa `disputed` como atajo sin verificación.
    const failed = Date.now() > snapshot.deadline && num(snapshot.raisedAmount) < num(snapshot.goalAmount);
    if (snapshot.state === "released") return bad(409, "already_released");
    if (!failed && snapshot.state !== "refunding") return bad(409, "campaign_not_failed");

    // RT-09: el refund devuelve el PRINCIPAL (paridad con el contrato), no principal+yield.
    const principal = load()
      .donations.filter(
        (d) => d.campaignId === snapshot.id && d.donorWallet === donorWallet && !d.refunded,
      )
      .reduce((a, d) => a + num(d.amount), 0);
    if (principal <= 0) return bad(404, "no_position");
    await defindex.buildWithdraw(snapshot.vaultAddress!, donorWallet, principal.toString());

    const out = await withStore((s) => {
      const c = s.campaigns.find((x) => x.id === snapshot.id);
      if (!c) return bad(404, "not_found");
      if (c.state === "released") return bad(409, "already_released");
      if (c.state === "fundraising") c.state = "refunding";
      // RT-09: marcar reembolsado de forma idempotente (no borrar) y descontar de raised.
      let refundedNow = 0;
      for (const d of s.donations) {
        if (d.campaignId === c.id && d.donorWallet === donorWallet && !d.refunded) {
          d.refunded = true;
          refundedNow += num(d.amount);
        }
      }
      if (refundedNow > 0) c.raisedAmount = Math.max(0, num(c.raisedAmount) - refundedNow).toString();
      return { refundedTo: donorWallet, amount: refundedNow.toString() };
    });
    res.json({ ok: true, ...out });
  }),
);

// ─── Opiniones anónimas por campaña (Capa 2 scopeada; nullifier por campaña) ───
// Prueba ZK de funding (publicSignals): [issuerRoot, platformId, nullifier, scope, nullScope, contentHash].
// RT-02: platformId/nullifier salen SOLO de la prueba verificada (no del body).
app.post(
  "/campaigns/:id/opinions",
  wrap(async (req, res) => {
    const c = load().campaigns.find((x) => x.id === req.params.id);
    if (!c) return bad(404, "not_found");

    const content = String(req.body?.content ?? "").trim().slice(0, 560);
    if (!content) return bad(400, "missing_fields");
    const sentiment = (["support", "oppose", "neutral"].includes(req.body?.sentiment)
      ? req.body.sentiment
      : "neutral") as Sentiment;
    const txHash = String(req.body?.txHash ?? "");

    // RT-02: exige prueba válida; claims derivados SOLO de la prueba verificada.
    const opinionProof = req.body?.opinionProof as FundingOpinionProofInput | undefined;
    const claims = await verifyFundingOpinion(c.id, content, opinionProof);
    if (!claims) return bad(403, "invalid_opinion_proof");
    const { platformId, nullifier } = claims;
    const contentHash = contentHashField(content); // derivado server-side (atado a la prueba)

    // RT-08: la curaduría solo determina VISIBILIDAD. El conteo/registro (nullifier +
    // sentimiento) persiste INDEPENDIENTEMENTE de la disponibilidad del curador. Si el curador
    // no está, la opinión queda pendiente de revisión (oculta del feed) pero su sentimiento YA
    // fue contado de forma anti-Sybil — no hay descarte silencioso ni censura por DoS.
    let curation: CurationVerdict;
    try {
      curation = await reviewPost({ platformId, handle: handleOf(platformId), content });
    } catch {
      curation = { status: "escalated", reason: "Curador no disponible; pendiente de revisión humana." };
    }

    // RT-06: claim del nullifier + push de la opinión, todo bajo el mismo lock y atómico.
    const out = await withStore((s) => {
      const nkey = `${c.id}:${nullifier}`;
      const firstVoice = claimNullifier(s, nkey); // atómico: true si es la 1ª vez
      const opinion: CampaignOpinion = {
        id: randomUUID(),
        campaignId: c.id,
        platformId,
        handle: handleOf(platformId),
        content,
        contentHash,
        // 1 humano = 1 voz por campaña: solo la 1ª opinión cuenta su sentimiento.
        sentiment: firstVoice ? sentiment : "neutral",
        txHash,
        curation,
        ts: Date.now(),
      };
      s.opinions.push(opinion);
      return { opinion, firstVoice };
    });
    if (!out.firstVoice) {
      return res.json({ ...out.opinion, note: "sentiment_already_counted_for_campaign" });
    }
    res.json(out.opinion);
  }),
);

// RT-08: el conteo de sentimiento NO depende de la visibilidad. `counted` incluye toda opinión
// con voz (1ª por nullifier), esté o no aprobada por el curador. `visible` (feed) sí filtra las
// que están pendientes de revisión, pero eso no altera el conteo anti-Sybil ni lo censura.
app.get("/campaigns/:id/opinions", (req, res) => {
  const s = load();
  const all = s.opinions.filter((o) => o.campaignId === req.params.id);
  const visible = all.filter((o) => o.curation?.status !== "escalated");
  const counted = all.filter((o) => o.sentiment !== "neutral");
  const sentiment = {
    support: counted.filter((o) => o.sentiment === "support").length,
    oppose: counted.filter((o) => o.sentiment === "oppose").length,
  };
  res.json({ opinions: [...visible].reverse(), sentiment });
});

// ─── Middleware de error (RT-07): nada queda sin respuesta; providers → 502 ─────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
  const msg = err instanceof Error ? err.message : String(err);
  // Fallos de providers externos (DeFindex/Trustless Work) → 502 controlado.
  if (/trustlesswork|defindex|HTTP \d+/i.test(msg)) {
    return res.status(502).json({ error: "provider_unavailable", detail: msg });
  }
  console.error("unhandled error:", msg);
  res.status(500).json({ error: "internal_error" });
});

// Render (y otros PaaS) asignan el puerto vía $PORT; en local usamos FUNDING_API_PORT.
const port = Number(process.env.PORT ?? process.env.FUNDING_API_PORT ?? 8789);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Hidratar el store (Upstash o archivo) ANTES de escuchar, así las campañas arrancan completas.
  void hydrate().then(() => {
    app.listen(port, () => console.log(`beHuman funding API en :${port} (provider=${provider}, asset=${ASSET})`));
  });
}

export { app };
