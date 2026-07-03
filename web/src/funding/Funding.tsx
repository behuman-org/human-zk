// CAPA 3 — Funding ZK: donar anónimo (gateado por personhood), panel validador
// (aprobar hitos + release 2-de-3), y opiniones por campaña (anti-Sybil por nullifier).
// Cero PII: la wallet de donación es un seudónimo efímero; las opiniones usan platformId
// scopeado a la campaña. NUNCA se usa el address del KYC.
import { useEffect, useState } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import type { Campaign, CampaignOpinion, Sentiment } from "@behuman/shared";
import { loadAnyCredential, type StoredCredential } from "../kyc/credentialStore";
import { generatePlatformProof } from "../platform/zk2";
import {
  donate,
  getOpinions,
  getPosition,
  listCampaigns,
  postOpinion,
  release as releaseCampaign,
  approveMilestone,
  refund as refundCampaign,
  type Position,
} from "./api";
import {
  generateFundingOpinionProof,
  handleOfCampaign,
  fundingChallenge,
  signFundingAction,
} from "./zk3";

const txUrl = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
// Una tx real de Stellar es un hash de 64 hex; los mocks de dev son cortos/prefijados.
const isRealTx = (hash: string) => /^[0-9a-f]{64}$/i.test(hash);
const fmt = (n: string | number) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 4 });

export function Funding({ onBack }: { onBack: () => void }) {
  const [cred] = useState<StoredCredential | null>(() => loadAnyCredential());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sel, setSel] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // donación — la wallet es EFÍMERA POR DONACIÓN (RT-05): se regenera en cada doDonate.
  const [amount, setAmount] = useState("100");
  const [donorWallet, setDonorWallet] = useState<string | null>(null);
  const [donorSecret, setDonorSecret] = useState<string | null>(null); // para firmar position/refund
  const [position, setPosition] = useState<Position | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  // opiniones
  const [opinion, setOpinion] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment>("support");
  const [opinions, setOpinions] = useState<CampaignOpinion[]>([]);
  const [counts, setCounts] = useState({ support: 0, oppose: 0 });

  // validador
  const [signers, setSigners] = useState<string[]>([]);

  useEffect(() => {
    listCampaigns().then(setCampaigns).catch((e) => setError((e as Error).message));
  }, []);

  async function open(c: Campaign) {
    setSel(c);
    setError(null);
    setLastTx(null);
    setPosition(null);
    setDonorWallet(null);
    setDonorSecret(null);
    setSigners([]);
    const o = await getOpinions(c.id).catch(() => ({ opinions: [], sentiment: { support: 0, oppose: 0 } }));
    setOpinions(o.opinions);
    setCounts(o.sentiment);
  }

  async function membership() {
    if (!cred) throw new Error("No Layer 1 credential on this device");
    const p = await generatePlatformProof(cred, "0");
    return { proof: p.proof, publicSignals: p.publicSignals };
  }

  async function doDonate() {
    if (!sel) return;
    setError(null);
    try {
      setBusy("Generating personhood proof (ZK) on your device…");
      const mp = await membership();
      // RT-05: wallet de donación = seudónimo efímero NUEVO en cada donación (no por sesión).
      const kp = StellarSdk.Keypair.random();
      const wallet = kp.publicKey();
      setDonorWallet(wallet);
      setDonorSecret(kp.secret());
      setBusy("Donating (funds enter Blend vault for yield)…");
      const r = await donate(sel.id, wallet, amount, mp);
      if (r.raisedAmount) setSel({ ...sel, raisedAmount: r.raisedAmount });
      setCampaigns((cs) => cs.map((c) => (c.id === sel.id ? { ...c, raisedAmount: r.raisedAmount ?? c.raisedAmount } : c)));
      // RT-05: /position requiere prueba de titularidad (firma con la secret de la wallet).
      const posChallenge = fundingChallenge("refund", sel.id, `position:${wallet}`);
      const posSig = signFundingAction(kp.secret(), posChallenge);
      setPosition(await getPosition(sel.id, wallet, posSig.signature));
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function publishOpinion() {
    if (!sel || !cred || !opinion.trim()) return;
    setError(null);
    try {
      setBusy("Generating per-campaign opinion proof (ZK)…");
      const p = await generateFundingOpinionProof(cred, sel.id, opinion.trim());
      setBusy("Publishing anonymous opinion…");
      await postOpinion(sel.id, opinion.trim(), sentiment, { proof: p.proof, publicSignals: p.publicSignals });
      setOpinion("");
      const o = await getOpinions(sel.id);
      setOpinions(o.opinions);
      setCounts(o.sentiment);
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function approve(milestoneId: string) {
    if (!sel) return;
    setError(null);
    try {
      setBusy("Approving milestone (platform signature)…");
      // RT-01: la plataforma FIRMA el challenge con su secret (demo: signerSecretsDev).
      const sec = sel.signerSecretsDev?.platform;
      if (!sec) throw new Error("No platform secret to sign (dev demo).");
      const challenge = fundingChallenge("approve", sel.id, milestoneId);
      const signature = signFundingAction(sec, challenge);
      await approveMilestone(sel.id, milestoneId, signature);
      setSel({
        ...sel,
        milestones: sel.milestones.map((m) => (m.id === milestoneId ? { ...m, status: "approved" } : m)),
      });
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function doRelease() {
    if (!sel) return;
    setError(null);
    try {
      setBusy("Releasing funds to the cause (2-of-3 release + goal)…");
      // RT-01: cada firmante seleccionado FIRMA el challenge "release:<id>:<raised>".
      const secrets = sel.signerSecretsDev;
      if (!secrets) throw new Error("No signer secrets for signing (dev demo).");
      const byAddr: Record<string, string> = {
        [sel.signers.cause]: secrets.cause,
        [sel.signers.platform]: secrets.platform,
        [sel.signers.neutral]: secrets.neutral,
      };
      const challenge = fundingChallenge("release", sel.id, sel.raisedAmount);
      const signatures = signers
        .filter((addr) => byAddr[addr])
        .map((addr) => signFundingAction(byAddr[addr], challenge));
      const r = await releaseCampaign(sel.id, signatures);
      setLastTx(r.txHash);
      setSel({ ...sel, state: "released" });
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function doRefund() {
    if (!sel || !donorWallet || !donorSecret) return;
    setError(null);
    try {
      setBusy("Refunding your contribution (all-or-nothing)…");
      // RT-01: el donante prueba titularidad de su wallet firmando el challenge.
      const challenge = fundingChallenge("refund", sel.id, donorWallet);
      const signature = signFundingAction(donorSecret, challenge);
      const r = await refundCampaign(sel.id, donorWallet, signature);
      setPosition(null);
      setBusy(null);
      setError(null);
      alert(`Refunded ${fmt(r.amount)} ${sel.asset} to your anonymous wallet.`);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  if (!cred) {
    return (
      <section className="app__card">
        <h2>Funding ZK</h2>
        <p>You need a verified identity (Layer 1) on this device to participate.</p>
        <button type="button" onClick={onBack}>Back</button>
      </section>
    );
  }

  const toggleSigner = (addr: string) =>
    setSigners((s) => (s.includes(addr) ? s.filter((x) => x !== addr) : [...s, addr]));

  const allApproved = sel?.milestones.every((m) => m.status === "approved") ?? false;
  const goalReached = sel ? Number(sel.raisedAmount) >= Number(sel.goalAmount) : false;

  return (
    <section className="app__card">
      <h2>ZK funding (anonymous donation + per-campaign opinion)</h2>

      {!sel ? (
        <>
          <p>Choose a campaign. Donate as a verified human without revealing who you are.</p>
          {campaigns.length === 0 && <p>No campaigns yet.</p>}
          {campaigns.map((c) => (
            <div key={c.id} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
              <strong>{c.title}</strong> <span style={{ opacity: 0.6 }}>· {c.state}</span>
              <p style={{ margin: "4px 0" }}>{c.summary}</p>
              <p style={{ fontSize: "0.85em" }}>
                {fmt(c.raisedAmount)} / {fmt(c.goalAmount)} {c.asset}
              </p>
              <button type="button" onClick={() => open(c)}>Open</button>
            </div>
          ))}
        </>
      ) : (
        <>
          <button type="button" onClick={() => setSel(null)} style={{ marginBottom: 8 }}>← Campaigns</button>
          <h3>{sel.title}</h3>
          <p>{sel.summary}</p>
          <p>
            <strong>{fmt(sel.raisedAmount)} / {fmt(sel.goalAmount)} {sel.asset}</strong>
            {" · "}state: <strong>{sel.state}</strong>
            {" · "}closes: {new Date(sel.deadline).toLocaleDateString("en-US")}
          </p>

          {/* Donación */}
          {sel.state === "fundraising" && (
            <fieldset style={{ margin: "10px 0" }}>
              <legend>Donate (anonymous, yield in Blend)</legend>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric"
                style={{ width: 120 }} /> {sel.asset}
              <button type="button" onClick={doDonate} disabled={!!busy || Number(amount) <= 0} style={{ marginLeft: 8 }}>
                Donate (ZK-gated)
              </button>
              {position && (
                <p style={{ fontSize: "0.85em", color: "#137333" }}>
                  Your position: {fmt(position.underlying)} {sel.asset} (APY {(position.apy * 100).toFixed(1)}%) ·
                  anonymous wallet <code>{donorWallet?.slice(0, 6)}…</code>
                  <br />
                  <button type="button" onClick={doRefund} disabled={!!busy} style={{ marginTop: 4 }}>
                    Recover my contribution (if campaign fails)
                  </button>
                </p>
              )}
            </fieldset>
          )}

          {/* Panel validador */}
          <fieldset style={{ margin: "10px 0" }}>
            <legend>Validator panel (milestones + 2-of-3 release)</legend>
            {sel.milestones.length === 0 && <p style={{ fontSize: "0.85em" }}>No milestones.</p>}
            {sel.milestones.map((m) => (
              <div key={m.id} style={{ fontSize: "0.9em" }}>
                {m.status === "approved" ? "✅" : "⏳"} {m.title}
                {m.status !== "approved" && (
                  <button type="button" onClick={() => approve(m.id)} disabled={!!busy} style={{ marginLeft: 8 }}>
                    Approve
                  </button>
                )}
              </div>
            ))}
            <p style={{ fontSize: "0.85em", marginTop: 8 }}>Signers (2-of-3 to release):</p>
            {(["cause", "platform", "neutral"] as const).map((role) => {
              const addr = sel.signers[role];
              return (
                <label key={role} style={{ display: "block", fontSize: "0.8em" }}>
                  <input type="checkbox" checked={signers.includes(addr)} onChange={() => toggleSigner(addr)} />{" "}
                  {role}: <code>{addr.slice(0, 8)}…</code>
                </label>
              );
            })}
            <button
              type="button"
              onClick={doRelease}
              disabled={!!busy || sel.state !== "fundraising" || signers.length < 2 || !allApproved || !goalReached}
              style={{ marginTop: 8 }}
            >
              Release to cause (capital + yield)
            </button>
            {(!allApproved || !goalReached) && sel.state === "fundraising" && (
              <p style={{ fontSize: "0.75em", opacity: 0.7 }}>
                Requires all milestones approved and goal reached.
              </p>
            )}
          </fieldset>

          {/* Opiniones */}
          <fieldset style={{ margin: "10px 0" }}>
            <legend>Opinions (1 human = 1 voice per campaign)</legend>
            <p style={{ fontSize: "0.85em" }}>
              Sentiment: 👍 {counts.support} · 👎 {counts.oppose}
            </p>
            <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} rows={2}
              style={{ width: "100%" }} placeholder="Your opinion on this campaign…" />
            <div>
              <select value={sentiment} onChange={(e) => setSentiment(e.target.value as Sentiment)}>
                <option value="support">Support</option>
                <option value="oppose">Oppose</option>
                <option value="neutral">Neutral</option>
              </select>
              <button type="button" onClick={publishOpinion} disabled={!!busy || !opinion.trim()} style={{ marginLeft: 8 }}>
                Post opinion (ZK-gated)
              </button>
            </div>
            {opinions.map((o) => (
              <div key={o.id} style={{ borderTop: "1px solid #eee", padding: "6px 0", fontSize: "0.9em" }}>
                <strong>@{handleOfCampaign(o.platformId)}</strong>{" "}
                <span style={{ opacity: 0.6 }}>
                  {o.sentiment === "support" ? "👍" : o.sentiment === "oppose" ? "👎" : "·"}
                </span>
                <p style={{ margin: "2px 0" }}>{o.content}</p>
              </div>
            ))}
          </fieldset>
        </>
      )}

      {busy && <p>⏳ {busy}</p>}
      {error && <p style={{ color: "#c5221f" }}>Error: {error}</p>}
      {lastTx && (
        <p style={{ color: "#137333" }}>
          ✅ Funds released to the cause (capital + yield).{" "}
          {isRealTx(lastTx) ? (
            <a href={txUrl(lastTx)} target="_blank" rel="noreferrer">View transaction</a>
          ) : (
            <span style={{ fontSize: "0.85em", opacity: 0.8 }}>
              simulated tx (dev mode): <code>{lastTx}</code> — not on-chain.
            </span>
          )}
        </p>
      )}

      <button type="button" onClick={onBack} style={{ marginTop: 12 }}>Back</button>
    </section>
  );
}
