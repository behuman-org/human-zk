import { useState } from "react";
import { createCommunity } from "../../feed/feedApi";
import "./EditProfileModal.css";
import "./CreateThreadModal.css";

interface CreateThreadModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
}

export function CreateThreadModal({ open, onClose, onCreated }: CreateThreadModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const community = await createCommunity({ name, description });
      setName("");
      setDescription("");
      onCreated(community.slug);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el hilo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="create-thread-title">
      <button type="button" className="profile-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="profile-modal__panel">
        <header className="profile-modal__head">
          <button type="button" className="profile-modal__close" onClick={onClose}>
            ✕
          </button>
          <h2 id="create-thread-title">Crear hilo</h2>
          <button
            type="button"
            className="profile-modal__save"
            disabled={busy}
            onClick={() => void submit()}
          >
            Crear
          </button>
        </header>

        <div className="profile-modal__body create-thread-modal__body">
          <label className="profile-modal__field">
            <span>Nombre</span>
            <div className="create-thread-modal__name-row">
              <span className="create-thread-modal__prefix">r/</span>
              <input
                type="text"
                value={name}
                maxLength={21}
                placeholder="nombre_del_hilo"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </label>

          <label className="profile-modal__field">
            <span>Descripción</span>
            <textarea
              value={description}
              rows={3}
              maxLength={200}
              placeholder="De qué se habla en este espacio"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {error && <p className="create-thread-modal__error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
