import { useState, type CSSProperties } from "react";
import type { Community } from "../../feed/types";
import { communityLabel } from "../../feed/feedApi";
import { useUser } from "../../feed/UserContext";
import { UserAvatar } from "./UserAvatar";
import "./PostComposer.css";

const MAX = 560;

interface PostComposerProps {
  /** general = feed sin hilo; thread = publicar dentro de un hilo fijo */
  variant: "general" | "thread";
  thread?: Community;
  onPublish: (content: string, communityId: string) => Promise<void>;
  autoFocus?: boolean;
}

export function PostComposer({
  variant,
  thread,
  onPublish,
  autoFocus = false,
}: PostComposerProps) {
  const { user } = useUser();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const left = MAX - content.length;
  const canPost = content.trim().length > 0 && left >= 0 && !busy;

  async function submit() {
    if (!canPost || (variant === "thread" && !thread)) return;
    setBusy(true);
    try {
      const communityId = variant === "thread" ? thread!.id : "feed";
      await onPublish(content.trim(), communityId);
      setContent("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="voice-composer"
      aria-label={variant === "thread" ? "Publicar en el hilo" : "Publicar opinión"}
    >
      <div className="voice-composer__head">
        <UserAvatar user={user} size="md" verified />
        <p className="voice-composer__greet">
          Hola, <strong>{user.username}</strong>
        </p>
      </div>

      {variant === "thread" && thread && (
        <p className="voice-composer__context">
          Publicando en{" "}
          <span className="voice-composer__context-chip" style={{ "--chip-accent": thread.accent } as CSSProperties}>
            {communityLabel(thread)}
          </span>
        </p>
      )}

      <textarea
        className="voice-composer__input"
        aria-label="Escribí tu opinión"
        placeholder={
          variant === "thread"
            ? "¿Qué aportás a esta conversación?"
            : "¿Qué opinás? Compartí tu opinión…"
        }
        rows={3}
        autoFocus={autoFocus}
        value={content}
        maxLength={MAX + 20}
        disabled={busy}
        onChange={(e) => setContent(e.target.value)}
      />

      <div className="voice-composer__bar">
        <span className={`voice-composer__count ${left < 40 ? "is-warn" : ""}`}>{left}</span>
        <button
          type="button"
          className="voice-composer__submit"
          disabled={!canPost}
          style={
            thread
              ? ({ "--btn-accent": thread.accent } as CSSProperties)
              : undefined
          }
          onClick={() => void submit()}
        >
          {busy ? "Enviando…" : "Publicar opinión"}
        </button>
      </div>
    </section>
  );
}
