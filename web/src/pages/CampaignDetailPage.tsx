// Capa 3 — Detalle de campaña: donar anónimo, mi posición + recuperar aporte, panel validador
// (aprobar hitos + liberar 2-de-3) y opiniones por campaña (1 voz por humano).
// Cero PII: la wallet de donación es efímera; la opinión usa el platformId scopeado a la campaña.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as StellarSdk from "@stellar/stellar-sdk";
import type { Campaign, CampaignOpinion, Sentiment } from "@behuman/shared";
import { loadAnyCredential } from "../kyc/credentialStore";
import { generatePlatformProof } from "../platform/zk2";
import {
  approveMilestone,
  donate,
  getCampaign,
  getOpinions,
  getPosition,
  postOpinion,
  refund as refundCampaign,
  release as releaseCampaign,
  type Position,
} from "../funding/api";
import {
  fundingChallenge,
  generateFundingOpinionProof,
  handleOfCampaign,
  signFundingAction,
} from "../funding/zk3";
import { humanState } from "./CausesPage";
import "./Causes.css";

const isRealTx = (h: string) => /^[0-9a-f]{64}$/i.test(h);
const fmt = (n: string | number) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 4 });

export function CampaignDetailPage() {
  const { id = "" } = useParams();
  const [cred] = useState(() => loadAnyCredential());
  const [c, setC] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState("100");
  const [donorWallet, setDonorWallet] = useState<string | null>(null);
  const [donorSecret, setDonorSecret] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const [opinion, setOpinion] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment>("support");
  const [opinions, setOpinions] = useState<CampaignOpinion[]>([]);
  const [counts, setCounts] = useState({ support: 0, oppose: 0 });

  const [signers, setSigners] = useState<string[]>([]);

  useEffect(() => {
    getCampaign(id)
      .then(setC)
      .catch((e) => setError((e as Error).message));
    getOpinions(id)
      .then((o) => {
        setOpinions(o.opinions);
        setCounts(o.sentiment);
      })
      .catch(() => {});
  }, [id]);

  async function membership() {
    if (!cred) throw new Error("Necesitás verificarte para participar.");
    const p = await generatePlatformProof(cred, "0");
    return { proof: p.proof, publicSignals: p.publicSignals };
  }

  async function doDonate() {
    if (!c) return;
    setError(null);
    try {
      setBusy("Generando tu prueba de humano (ZK) en el dispositivo…");
      const mp = await membership();
      const kp = StellarSdk.Keypair.random(); // wallet efímera POR donación (anónima)
      setDonorWallet(kp.publicKey());
      setDonorSecret(kp.secret());
      setBusy("Sumando tu aporte (entra a un fondo que genera rendimiento)…");
      const r = await donate(c.id, kp.publicKey(), amount, mp);
      if (r.raisedAmount) setC({ ...c, raisedAmount: r.raisedAmount });
      const sig = signFundingAction(kp.secret(), fundingChallenge("refund", c.id, `position:${kp.publicKey()}`));
      setPosition(await getPosition(c.id, kp.publicKey(), sig.signature));
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function doRefund() {
    if (!c || !donorWallet || !donorSecret) return;
    setError(null);
    try {
      setBusy("Devolviendo tu aporte…");
      const sig = signFundingAction(donorSecret, fundingChallenge("refund", c.id, donorWallet));
      const r = await refundCampaign(c.id, donorWallet, sig);
      setPosition(null);
      setBusy(null);
      alert(`Te devolvimos ${fmt(r.amount)} ${c.asset} a tu wallet anónima.`);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function publishOpinion() {
    if (!c || !cred || !opinion.trim()) return;
    setError(null);
    try {
      setBusy("Generando tu prueba de opinión (ZK)…");
      const p = await generateFundingOpinionProof(cred, c.id, opinion.trim());
      setBusy("Publicando opinión anónima…");
      await postOpinion(c.id, opinion.trim(), sentiment, { proof: p.proof, publicSignals: p.publicSignals });
      setOpinion("");
      const o = await getOpinions(c.id);
      setOpinions(o.opinions);
      setCounts(o.sentiment);
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function approve(milestoneId: string) {
    if (!c) return;
    setError(null);
    try {
      setBusy("Aprobando hito…");
      const sec = c.signerSecretsDev?.platform;
      if (!sec) throw new Error("Sin permiso de validador en este entorno.");
      const sig = signFundingAction(sec, fundingChallenge("approve", c.id, milestoneId));
      await approveMilestone(c.id, milestoneId, sig);
      setC({
        ...c,
        milestones: c.milestones.map((m) => (m.id === milestoneId ? { ...m, status: "approved" } : m)),
      });
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  async function doRelease() {
    if (!c) return;
    setError(null);
    try {
      setBusy("Liberando los fondos a la causa…");
      const secrets = c.signerSecretsDev;
      if (!secrets) throw new Error("Sin permiso de validador en este entorno.");
      const byAddr: Record<string, string> = {
        [c.signers.cause]: secrets.cause,
        [c.signers.platform]: secrets.platform,
        [c.signers.neutral]: secrets.neutral,
      };
      const challenge = fundingChallenge("release", c.id, c.raisedAmount);
      const signatures = signers.filter((a) => byAddr[a]).map((a) => signFundingAction(byAddr[a], challenge));
      const r = await releaseCampaign(c.id, signatures);
      setLastTx(r.txHash);
      setC({ ...c, state: "released" });
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  }

  if (error && !c) return <div className="causes"><p className="note note--err">{error}</p></div>;
  if (!c) return <div className="causes"><p className="note">Cargando…</p></div>;

  const s = humanState(c);
  const pct = Math.min(100, (Number(c.raisedAmount) / Math.max(1, Number(c.goalAmount))) * 100);
  const allApproved = c.milestones.every((m) => m.status === "approved");
  const goalReached = Number(c.raisedAmount) >= Number(c.goalAmount);
  const toggleSigner = (a: string) =>
    setSigners((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]));

  return (
    <div className="causes">
      <Link to="/app/causes" className="cause-detail__back">← Causas</Link>
      <header className="cause-detail__header">
        <span className={`cause-state cause-state--${s.cls}`}>{s.label}</span>
        <h1 className="cause-detail__title">{c.title}</h1>
        <p className="cause-detail__meta">
          {fmt(c.raisedAmount)} / {fmt(c.goalAmount)} {c.asset} · cierra el{" "}
          {new Date(c.deadline).toLocaleDateString("es-AR")}
        </p>
        <div className="progress" style={{ marginTop: 10 }}>
          <div className="progress__bar" style={{ width: `${pct}%` }} />
        </div>
        <p className="note" style={{ marginTop: 10 }}>{c.summary}</p>
      </header>

      {!cred && (
        <div className="panel">
          <p>Para donar u opinar, primero <Link to="/onboarding" className="cause-detail__back">verificate como humano</Link>.</p>
        </div>
      )}

      {/* Donar */}
      {cred && c.state === "fundraising" && (
        <div className="panel">
          <p className="panel__legend">Donar (anónimo · genera rendimiento)</p>
          <div className="field-row">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 130 }} />
            <span>{c.asset}</span>
            <button type="button" className="btn" onClick={doDonate} disabled={!!busy || Number(amount) <= 0}>
              Donar
            </button>
          </div>
          {position && (
            <p className="note note--ok">
              Aportaste y hoy vale ~{fmt(position.underlying)} {c.asset} (rinde {(position.apy * 100).toFixed(1)}%/año) ·
              desde una wallet anónima.
              <br />
              <button type="button" className="btn btn--ghost" style={{ marginTop: 6 }} onClick={doRefund} disabled={!!busy}>
                Recuperar mi aporte (si la causa no llega a la meta)
              </button>
            </p>
          )}
        </div>
      )}

      {/* Panel validador */}
      <div className="panel">
        <p className="panel__legend">Panel de validador</p>
        {c.milestones.length === 0 && <p className="note">Esta causa no tiene hitos.</p>}
        {c.milestones.map((m) => (
          <div key={m.id} className="milestone">
            <span>{m.status === "approved" ? "✅" : "⏳"}</span>
            <span style={{ flex: 1 }}>{m.title}</span>
            {m.status !== "approved" && (
              <button type="button" className="btn btn--ghost" onClick={() => approve(m.id)} disabled={!!busy}>
                Aprobar
              </button>
            )}
          </div>
        ))}
        <p className="note" style={{ marginTop: 10 }}>Firmantes para liberar (2 de 3):</p>
        {(["cause", "platform", "neutral"] as const).map((role) => {
          const addr = c.signers[role];
          const label = role === "cause" ? "Causa" : role === "platform" ? "Plataforma" : "Neutral";
          return (
            <label key={role} className="signer-check">
              <input type="checkbox" checked={signers.includes(addr)} onChange={() => toggleSigner(addr)} />
              {label}
            </label>
          );
        })}
        <button
          type="button"
          className="btn"
          style={{ marginTop: 10 }}
          onClick={doRelease}
          disabled={!!busy || c.state !== "fundraising" || signers.length < 2 || !allApproved || !goalReached}
        >
          Liberar los fondos a la causa
        </button>
        {c.state === "fundraising" && (!allApproved || !goalReached) && (
          <p className="note">Requiere todos los hitos aprobados y la meta alcanzada.</p>
        )}
        {lastTx && (
          <p className="note note--ok">
            ✅ Fondos entregados a la causa (capital + rendimiento).{" "}
            {isRealTx(lastTx) ? (
              <a href={`https://stellar.expert/explorer/testnet/tx/${lastTx}`} target="_blank" rel="noreferrer" className="cause-detail__back">
                Ver la transacción
              </a>
            ) : (
              <span> (transacción simulada en este entorno)</span>
            )}
          </p>
        )}
      </div>

      {/* Opiniones */}
      <div className="panel">
        <p className="panel__legend">Opiniones (1 persona, 1 voz)</p>
        <div className="sentiment">
          <span>👍 {counts.support}</span>
          <span>👎 {counts.oppose}</span>
        </div>
        {cred && (
          <>
            <textarea rows={2} value={opinion} onChange={(e) => setOpinion(e.target.value)} placeholder="Tu opinión sobre esta causa…" />
            <div className="field-row" style={{ marginTop: 8 }}>
              <select value={sentiment} onChange={(e) => setSentiment(e.target.value as Sentiment)}>
                <option value="support">A favor</option>
                <option value="oppose">En contra</option>
                <option value="neutral">Neutral</option>
              </select>
              <button type="button" className="btn" onClick={publishOpinion} disabled={!!busy || !opinion.trim()}>
                Opinar
              </button>
            </div>
          </>
        )}
        {opinions.map((o) => (
          <div key={o.id} className="opinion">
            <span className="opinion__handle">@{handleOfCampaign(o.platformId)}</span>
            <span className="opinion__sentiment">
              {o.sentiment === "support" ? "👍" : o.sentiment === "oppose" ? "👎" : "·"}
            </span>
            <p style={{ margin: "3px 0 0" }}>{o.content}</p>
          </div>
        ))}
      </div>

      {busy && <p className="note">⏳ {busy}</p>}
      {error && <p className="note note--err">{error}</p>}
    </div>
  );
}
