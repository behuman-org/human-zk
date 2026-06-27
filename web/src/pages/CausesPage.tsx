// Capa 3 — Listado de causas/campañas. Doná como humano verificado, sin revelar quién sos.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Campaign } from "@behuman/shared";
import { listCampaigns } from "../funding/api";
import "./Causes.css";

const fmt = (n: string | number) =>
  Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function humanState(c: Campaign): { cls: string; label: string } {
  const raised = Number(c.raisedAmount);
  const goal = Number(c.goalAmount);
  if (c.state === "released") return { cls: "released", label: "Fondos entregados" };
  if (c.state === "refunding") return { cls: "refunding", label: "Devolviendo aportes" };
  if (c.state === "disputed") return { cls: "disputed", label: "En disputa" };
  if (Date.now() > c.deadline && raised < goal) return { cls: "failed", label: "No alcanzó la meta" };
  if (raised >= goal) return { cls: "reached", label: "Meta alcanzada" };
  return { cls: "fundraising", label: "Activa" };
}

function CauseCard({ c }: { c: Campaign }) {
  const pct = Math.min(100, (Number(c.raisedAmount) / Math.max(1, Number(c.goalAmount))) * 100);
  const s = humanState(c);
  return (
    <Link to={`/app/causes/${c.id}`} className="cause-card">
      <span className={`cause-state cause-state--${s.cls}`}>{s.label}</span>
      <span className="cause-card__title">{c.title}</span>
      <span className="cause-card__summary">{c.summary}</span>
      <div className="progress">
        <div className="progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress__label">
        <span>{fmt(c.raisedAmount)} {c.asset}</span>
        <span>meta {fmt(c.goalAmount)}</span>
      </div>
    </Link>
  );
}

export function CausesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampaigns()
      .then(setCampaigns)
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="causes">
      <div className="causes__top">
        <div>
          <h1 className="causes__title">Causas</h1>
          <p className="causes__subtitle">Doná como humano verificado, sin revelar quién sos.</p>
        </div>
      </div>
      {error && <p className="note note--err">No se pudieron cargar las causas: {error}</p>}
      <div className="causes__grid">
        {campaigns.map((c) => (
          <CauseCard key={c.id} c={c} />
        ))}
      </div>
      {campaigns.length === 0 && !error && <p className="note">Todavía no hay causas.</p>}
    </div>
  );
}
