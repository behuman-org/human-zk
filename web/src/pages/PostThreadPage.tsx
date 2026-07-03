// Capa 2 — Vista de hilo (estilo X): un tweet + sus respuestas anónimas.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PostCard } from "../components/feed/PostCard";
import { Button } from "../components/ui/Button";
import { fetchPost, fetchReplies, publishReply } from "../feed/feedApi";
import { loadAnyCredential } from "../kyc/credentialStore";
import { useI18n } from "../i18n/useI18n";
import type { FeedPost } from "../feed/types";
import "./SocialShell.css";

export function PostThreadPage() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const th = t.social.postThread;
  const common = t.social.common;
  const profile = t.social.profile;
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
      setBusy(th.busyReply);
      await publishReply({ parentId: id, content: text.trim() });
      setText("");
      setBusy(null);
      await load();
    } catch (e) {
      setBusy(null);
      setError(errMsg(e, th.needVerify));
    }
  }

  return (
    <div className="feed-column">
      <header className="feed-column__top feed-column__top--feed">
        <Link to="/app" className="bh-back">
          ← {profile.backToFeed}
        </Link>
        <h1 className="feed-column__title">{th.title}</h1>
      </header>

      {loading ? (
        <p className="feed-empty">{th.loading}</p>
      ) : notFound || !post ? (
        <p className="feed-empty">{th.notFound}</p>
      ) : (
        <>
          <PostCard post={post} />

          <div className="bh-card thread-composer">
            <h2 className="bh-h2">{th.replyTitle}</h2>
            {cred ? (
              <>
                <textarea
                  className="bh-textarea"
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={th.replyPlaceholder}
                  maxLength={560}
                />
                <div className="bh-actions">
                  <Button onClick={onReply} disabled={!!busy || !text.trim()}>
                    {th.replyButton}
                  </Button>
                </div>
              </>
            ) : (
              <p className="bh-p">
                {th.verifyToReply}{" "}
                <Link to="/onboarding" className="bh-back">
                  {common.verifyLink}
                </Link>
                .
              </p>
            )}
            {busy && <p className="bh-note">⏳ {busy}</p>}
            {error && <p className="bh-note bh-note--err">{error}</p>}
          </div>

          <section className="feed-stream" aria-label={th.replies}>
            <h2 className="bh-h2" style={{ padding: "0 0.35rem" }}>
              {th.replies}
              {replies.length > 0 ? ` · ${replies.length}` : ""}
            </h2>
            {replies.length === 0 ? (
              <p className="feed-empty">{th.repliesEmpty}</p>
            ) : (
              replies.map((r) => <PostCard key={r.id} post={r} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}

function errMsg(e: unknown, needVerify: string): string {
  const m = (e as Error).message;
  if (m === "verification_required") return needVerify;
  return m;
}
