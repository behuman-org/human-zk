// Vista mínima de moderación (Nivel 2). Lista la cola de casos escalados por el agente
// curador y permite resolverlos. ⚠️ Muestra solo contenido + seudónimo (@últimos 5),
// nunca la identidad: la moderación no puede deanonimizar.
import { useEffect, useState } from "react";
import { getModerationQueue, resolveModeration, type ModerationItem } from "./api2";

export function Moderation({ onBack }: { onBack: () => void }) {
  const [queue, setQueue] = useState<ModerationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setQueue(await getModerationQueue());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function resolve(id: string, status: "approved" | "flagged") {
    await resolveModeration(id, status);
    await refresh();
  }

  return (
    <section className="app__card">
      <h2>Moderación · cola humana</h2>
      <p style={{ fontSize: "0.85em", opacity: 0.8 }}>
        Casos escalados por el agente curador. Solo se ve <strong>contenido + seudónimo</strong>
        (@últimos 5 del platformId), nunca la identidad.
      </p>
      {error && <p style={{ color: "#c5221f" }}>Error: {error}</p>}
      {queue.length === 0 && <p>No hay casos pendientes.</p>}
      {queue.map((item) => (
        <div key={item.id} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
          <span style={{ opacity: 0.6 }}>@{item.handle}</span>
          <p style={{ margin: "4px 0" }}>{item.content}</p>
          <p style={{ fontSize: "0.8em", opacity: 0.7 }}>motivo: {item.reason}</p>
          <button type="button" onClick={() => resolve(item.id, "approved")}>Aprobar</button>{" "}
          <button type="button" onClick={() => resolve(item.id, "flagged")}>Etiquetar</button>
        </div>
      ))}
      <button type="button" onClick={onBack} style={{ marginTop: 12 }}>Volver</button>
    </section>
  );
}
