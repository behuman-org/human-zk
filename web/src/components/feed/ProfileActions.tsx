import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  followUser,
  isFollowingUser,
  messagesPath,
  reportUser,
  unfollowUser,
  wasReported,
} from "../../feed/feedApi";
import { PlatformApiError } from "../../feed/platformApi";
import { ActionMenu } from "./ActionMenu";
import "./ProfileActions.css";

interface ProfileActionsProps {
  platformId: string;
  username: string;
  onFollowChange?: () => void;
}

export function ProfileActions({ platformId, onFollowChange }: ProfileActionsProps) {
  const [following, setFollowing] = useState(false);
  const [reported, setReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    void isFollowingUser(platformId).then(setFollowing);
    void wasReported("user", platformId).then(setReported);
  }, [platformId]);

  async function toggleFollow() {
    setBusy(true);
    try {
      if (following) {
        await unfollowUser(platformId);
        setFollowing(false);
        setToast("Dejaste de seguir a esta persona.");
      } else {
        await followUser(platformId);
        setFollowing(true);
        setToast("Ahora seguís a esta persona.");
      }
      onFollowChange?.();
    } catch (err) {
      const msg =
        err instanceof PlatformApiError && err.status === 404
          ? "Seguir personas estará disponible cuando el backend exponga el endpoint."
          : "No se pudo completar la acción. Revisá que la API esté en línea.";
      setToast(msg);
    } finally {
      setBusy(false);
      window.setTimeout(() => setToast(""), 3200);
    }
  }

  async function denunciar() {
    if (reported) return;
    try {
      await reportUser(platformId, "Contenido o conducta inapropiada");
      setReported(true);
      setToast("Denuncia enviada. La revisará el equipo de moderación.");
    } catch (err) {
      const msg =
        err instanceof PlatformApiError && err.status === 404
          ? "Las denuncias estarán disponibles cuando el backend exponga el endpoint."
          : "No se pudo enviar la denuncia.";
      setToast(msg);
    }
    window.setTimeout(() => setToast(""), 3200);
  }

  return (
    <div className="profile-actions">
      <button
        type="button"
        className={`profile-actions__follow ${following ? "is-following" : ""}`.trim()}
        disabled={busy}
        onClick={() => void toggleFollow()}
      >
        {following ? "Siguiendo" : "Seguir"}
      </button>
      <Link to={messagesPath(platformId)} className="profile-actions__message">
        Mensaje
      </Link>
      <ActionMenu
        label="Opciones de perfil"
        items={[
          {
            id: "report",
            label: reported ? "Denunciado" : "Denunciar",
            destructive: true,
            disabled: reported,
            onSelect: () => void denunciar(),
          },
        ]}
      />
      {toast && (
        <p className="profile-actions__toast" role="status">
          {toast}
        </p>
      )}
    </div>
  );
}
