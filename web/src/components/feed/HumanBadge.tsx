import "./HumanBadge.css";

/** Marca de persona verificada — propia de beHuman, no check estilo X. */
export function HumanBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`human-badge ${compact ? "human-badge--compact" : ""}`.trim()} title="Persona verificada">
      <span className="human-badge__pulse" aria-hidden="true" />
      {!compact && <span className="human-badge__text">Humano</span>}
    </span>
  );
}
