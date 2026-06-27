import { useState } from "react";
import { avatarColor } from "../../feed/session";
import { useUser } from "../../feed/UserContext";
import "./EditProfileModal.css";

const AVATAR_COUNT = 6;

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function EditProfileModal({ open, onClose }: EditProfileModalProps) {
  const { user, updateProfile } = useUser();
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [avatarIndex, setAvatarIndex] = useState(user.avatarIndex);

  if (!open) return null;

  function save() {
    updateProfile({
      username: username.trim().slice(0, 40) || user.handle,
      bio: bio.trim().slice(0, 160),
      avatarIndex,
    });
    onClose();
  }

  return (
    <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <button type="button" className="profile-modal__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="profile-modal__panel">
        <header className="profile-modal__head">
          <button type="button" className="profile-modal__close" onClick={onClose}>
            ✕
          </button>
          <h2 id="edit-profile-title">Editar perfil</h2>
          <button type="button" className="profile-modal__save" onClick={save}>
            Guardar
          </button>
        </header>

        <div className="profile-modal__body">
          <fieldset className="profile-modal__avatars">
            <legend>Color de avatar</legend>
            <div className="profile-modal__avatar-row">
              {Array.from({ length: AVATAR_COUNT }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`profile-modal__avatar-opt ${avatarIndex === i ? "is-picked" : ""}`}
                  style={{ backgroundColor: avatarColor(i) }}
                  aria-label={`Avatar color ${i + 1}`}
                  aria-pressed={avatarIndex === i}
                  onClick={() => setAvatarIndex(i)}
                />
              ))}
            </div>
          </fieldset>

          <label className="profile-modal__field">
            <span>Nombre de usuario</span>
            <input
              type="text"
              value={username}
              maxLength={40}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className="profile-modal__field">
            <span>Bio</span>
            <textarea
              value={bio}
              rows={3}
              maxLength={160}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>

          <p className="profile-modal__note">
            Tu handle @{user.handle} no cambia. Solo podés editar cómo te ven los demás.
          </p>
        </div>
      </div>
    </div>
  );
}
