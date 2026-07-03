import { useState, type CSSProperties } from "react";
import type { Community } from "../../feed/types";
import { communityLabel } from "../../feed/feedApi";
import { useUser } from "../../feed/UserContext";
import { useI18n } from "../../i18n/useI18n";
import { UserAvatar } from "./UserAvatar";
import "./PostComposer.css";

const MAX = 560;

interface PostComposerProps {
  variant: "general" | "thread";
  thread?: Community;
  onPublish: (content: string, communityId: string) => Promise<void>;
  autoFocus?: boolean;
  /** Mensaje de error externo (p. ej. fallo al publicar). */
  publishError?: string | null;
  onClearError?: () => void;
}

export function PostComposer({
  variant,
  thread,
  onPublish,
  autoFocus = false,
  publishError = null,
  onClearError,
}: PostComposerProps) {
  const { user } = useUser();
  const { t } = useI18n();
  const c = t.social.postComposer;
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = publishError ?? localError;

  const left = MAX - content.length;
  const canPost = content.trim().length > 0 && left >= 0 && !busy;

  async function submit() {
    if (!canPost || (variant === "thread" && !thread)) return;
    setBusy(true);
    setLocalError(null);
    onClearError?.();
    try {
      const communityId = variant === "thread" ? thread!.id : "feed";
      await onPublish(content.trim(), communityId);
      setContent("");
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="voice-composer"
      aria-label={variant === "thread" ? c.ariaThread : c.ariaGeneral}
    >
      <div className="voice-composer__head">
        <UserAvatar user={user} size="md" verified />
        <div className="voice-composer__who">
          <p className="voice-composer__greet">
            {c.hello} <strong>{user.username || user.handle}</strong>
          </p>
          <p className="voice-composer__handle">@{user.handle}</p>
        </div>
      </div>

      {variant === "thread" && thread && (
        <p className="voice-composer__context">
          {c.postingIn}{" "}
          <span className="voice-composer__context-chip" style={{ "--chip-accent": thread.accent } as CSSProperties}>
            {communityLabel(thread)}
          </span>
        </p>
      )}

      <textarea
        className="voice-composer__input"
        aria-label={c.inputAria}
        placeholder={variant === "thread" ? c.placeholderThread : c.placeholderGeneral}
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
          style={thread ? ({ "--btn-accent": thread.accent } as CSSProperties) : undefined}
          onClick={() => void submit()}
        >
          {busy ? c.sending : c.publish}
        </button>
      </div>
      {displayError && (
        <p className="voice-composer__error" role="alert">
          {displayError}
        </p>
      )}
    </section>
  );
}
