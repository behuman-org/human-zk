// Capa 2 — Vista de hilo (estilo X): un tweet + sus respuestas anónimas.
// Responder reusa el mismo flujo ZK que postear: prueba (contentHash atado al parentId) →
// ancla on-chain con cuenta efímera → guarda off-chain. La identidad real nunca se expone.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PostCard } from "../components/feed/PostCard";
import { Button } from "../components/ui/Button";
import { fetchPost, fetchReplies, publishReply } from "../feed/feedApi";
import { loadAnyCredential } from "../kyc/credentialStore";
import type { FeedPost } from "../feed/types";
import "./SocialShell.css";

export function PostThreadPage() {
  const { id = "" } = useParams();
  const [cred] = useState(() => loadAnyCredential());
  const [post, setPost] = useState<FeedPost | null>(null);
  const [replies, setReplies] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [p, r] = await Promise.all([fetchPost(id), fetchReplies(id)]);
      setPost(p);
      setReplies(r);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onReply() {
    if (!text.trim()) return;
    setError(null);
    try {
      setBusy("Generando prueba ZK y anclando tu respuesta on-chain…");
      await publishReply({ parentId: id, content: text.trim() });
      setText("");
      setBusy(null);
      await load();
    } catch (e) {
      setBusy(null);
      setError(errMsg(e));
    }
  }

  return (
    <div className="feed-column">
      <header className="feed-column__top feed-column__top--feed">
        <Link to="/app" className="bh-back">← Volver al feed</Link>
        <h1 className="feed-column__title">Hilo</h1>
      </header>

      {loading ? (
        <p className="feed-empty">Cargando…</p>
      ) : notFound || !post ? (
        <p className="feed-empty">No encontramos este tweet.</p>
      ) : (
        <>
          <PostCard post={post} />

          <div className="bh-card thread-composer">
            <h2 className="bh-h2">Responder</h2>
            {cred ? (
              <>
                <textarea
                  className="bh-textarea"
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Tu respuesta (anónima, anclada on-chain por ZK)…"
                  maxLength={560}
                />
                <div className="bh-actions">
                  <Button onClick={onReply} disabled={!!busy || !text.trim()}>
                    Responder
                  </Button>
                </div>
              </>
            ) : (
              <p className="bh-p">
                Para responder, <Link to="/onboarding" className="bh-back">verificate como humano</Link>.
              </p>
            )}
            {busy && <p className="bh-note">⏳ {busy}</p>}
            {error && <p className="bh-note bh-note--err">{error}</p>}
          </div>

          <section className="feed-stream" aria-label="Respuestas">
            <h2 className="bh-h2" style={{ padding: "0 0.35rem" }}>
              Respuestas{replies.length > 0 ? ` · ${replies.length}` : ""}
            </h2>
            {replies.length === 0 ? (
              <p className="feed-empty">Todavía no hay respuestas. Sé el primero.</p>
            ) : (
              replies.map((r) => <PostCard key={r.id} post={r} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

function errMsg(e: unknown): string {
  const m = (e as Error).message;
  if (m === "necesitas_verificarte") return "Necesitás verificarte como humano para responder.";
  return m;
}
