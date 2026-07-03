// ID photo upload (front, face visible).
// Backend validates it IS an identity document before enabling the face scan.
import { useState } from "react";
import { Button } from "../components/ui/Button";
import { checkDocument } from "./api";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "invalid"; reasons: string[] }
  | { kind: "error"; message: string };

const REASON_TEXT: Record<string, string> = {
  not_an_id_document: "The image does not look like an identity document.",
  no_face_in_document: "No face detected on the document.",
};

export function DocumentUpload({
  onNext,
  notice,
}: {
  onNext: (doc: Blob) => void;
  notice?: string | null;
}) {
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
    <section className="bh-card">
      <p className="bh-eyebrow">Step 1 of 3</p>
      <h2 className="bh-h2">ID photo</h2>
      <p className="bh-sub">
        Upload a photo of the <strong>front of your document</strong> with your face visible.
      </p>

      <div className="bh-banner bh-banner--info">
        <strong>For a readable capture:</strong>
        <ul className="bh-list">
          <li>📐 Place the ID <strong>horizontally</strong>, straight and level.</li>
          <li>🎯 Fit the document <strong>fully and centered</strong>, close to the camera.</li>
          <li>🔆 Good light, <strong>no glare or shadows</strong> — text must be <strong>sharp and legible</strong>.</li>
        </ul>
      </div>

      {notice && <div className="bh-banner bh-banner--warn">⚠️ {notice}</div>}

      <input className="bh-input" type="file" accept="image/*" onChange={onPick} />
      {preview && <img src={preview} alt="ID document" className="bh-preview" />}

      {status.kind === "checking" && <p className="bh-note">Checking document…</p>}
      {status.kind === "ok" && <p className="bh-note bh-note--ok">✅ Valid document.</p>}
      {status.kind === "invalid" && (
        <div className="bh-note bh-note--err">
          <p>❌ Not a valid identity document. Upload an ID photo.</p>
          <ul className="bh-list">
            {status.reasons.map((r) => (
              <li key={r}>{REASON_TEXT[r] ?? r}</li>
            ))}
          </ul>
        </div>
      )}
      {status.kind === "error" && <p className="bh-note bh-note--err">Error: {status.message}</p>}

      <div className="bh-actions">
        <Button disabled={!doc || status.kind !== "ok"} onClick={() => doc && onNext(doc)}>
          Continue to your details
        </Button>
      </div>
    </section>
  );
}
