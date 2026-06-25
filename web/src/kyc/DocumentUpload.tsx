// Subida de la foto del DNI (frente, con la cara visible).
// Valida en el backend que SEA un documento de identidad antes de habilitar el escaneo.
import { useState } from "react";
import { checkDocument } from "./api";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "invalid"; reasons: string[] }
  | { kind: "error"; message: string };

const REASON_TEXT: Record<string, string> = {
  not_an_id_document: "La imagen no parece un documento de identidad (DNI).",
  no_face_in_document: "No se detecta una cara en el documento.",
};

export function DocumentUpload({ onNext }: { onNext: (doc: Blob) => void }) {
  const [doc, setDoc] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setDoc(file);
    setPreview(file ? URL.createObjectURL(file) : null);
    if (!file) return setStatus({ kind: "idle" });

    setStatus({ kind: "checking" });
    try {
      const res = await checkDocument(file);
      setStatus(res.ok ? { kind: "ok" } : { kind: "invalid", reasons: res.reasons });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }

  return (
    <section className="app__card">
      <h2>1 · Foto del DNI</h2>
      <p>Subí una foto del <strong>frente de tu documento de identidad</strong> (que se vea tu cara).</p>
      <input type="file" accept="image/*" onChange={onPick} />
      {preview && (
        <div style={{ marginTop: 12 }}>
          <img src={preview} alt="DNI" style={{ maxWidth: "100%", borderRadius: 8 }} />
        </div>
      )}

      {status.kind === "checking" && <p>Verificando que sea un documento…</p>}
      {status.kind === "ok" && <p style={{ color: "#137333" }}>✅ Documento válido.</p>}
      {status.kind === "invalid" && (
        <div style={{ color: "#c5221f" }}>
          <p>❌ No es un documento de identidad válido. Subí una foto del DNI.</p>
          <ul>
            {status.reasons.map((r) => (
              <li key={r}>{REASON_TEXT[r] ?? r}</li>
            ))}
          </ul>
        </div>
      )}
      {status.kind === "error" && <p style={{ color: "#c5221f" }}>Error: {status.message}</p>}

      <button
        type="button"
        disabled={!doc || status.kind !== "ok"}
        onClick={() => doc && onNext(doc)}
      >
        Continuar al escaneo de cara
      </button>
    </section>
  );
}
