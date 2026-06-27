import { useState } from "react";
import "./ChatComposer.css";

interface ChatComposerProps {
  onSend: (content: string) => Promise<void>;
  placeholder?: string;
  sendLabel?: string;
}

export function ChatComposer({
  onSend,
  placeholder = "Escribí un mensaje…",
  sendLabel = "Enviar",
}: ChatComposerProps) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const text = content.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSend(text);
      setContent("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <textarea
        className="chat-composer__input"
        rows={1}
        maxLength={500}
        placeholder={placeholder}
        aria-label={placeholder}
        value={content}
        disabled={busy}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <button type="submit" className="chat-composer__send" disabled={busy || !content.trim()}>
        {sendLabel}
      </button>
    </form>
  );
}
