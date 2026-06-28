import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Community, FeedPost } from "../../feed/types";
import { displayName, fetchCommunities, findCommunity, formatTimeAgo, profilePath } from "../../feed/feedApi";
import { useI18n } from "../../i18n/I18nProvider";
import { CommunityChip } from "./CommunityChip";
import { IconContrato, IconResponder, IconResuena, IconVoto } from "./FeedIcons";
import { PostMenu } from "./PostMenu";
import { UserAvatar } from "./UserAvatar";
import "./PostCard.css";
import "./PostMenu.css";

interface PostCardProps {
  post: FeedPost;
  showVotes?: boolean;
}

export function PostCard({ post, showVotes = false }: PostCardProps) {
  const { locale } = useI18n();
  const [score, setScore] = useState(post.score);
  const [resonates, setResonates] = useState(0);
  const [didResonate, setDidResonate] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [community, setCommunity] = useState<Community | undefined>();

  useEffect(() => {
    void fetchCommunities().then((list) => {
      setCommunity(findCommunity(post.communityId, list));
    });
  }, [post.communityId]);

  const name = displayName(post.username, post.handle);
  const accent = community?.accent ?? "var(--color-accent)";
  const authorPath = profilePath(post.platformId);

  function handleVote(dir: "up" | "down") {
    if (vote === dir) {
      setVote(null);
      setScore((s) => s + (dir === "up" ? -1 : 1));
      return;
    }
    if (vote === "up") setScore((s) => s - 1);
    if (vote === "down") setScore((s) => s + 1);
    setVote(dir);
    setScore((s) => s + (dir === "up" ? 1 : -1));
  }

  function toggleResonate() {
    setDidResonate((was) => {
      setResonates((n) => (was ? n - 1 : n + 1));
      return !was;
    });
  }

  const avatarUser = {
    username: post.username || post.handle,
    avatarIndex: post.platformId.charCodeAt(0) % 6,
  };

  const resonateTotal = (score > 0 ? score : 0) + resonates;

  return (
    <article
      className={`voice-card ${post.isOwn ? "voice-card--own" : ""}`}
      style={{ "--voice-accent": accent } as CSSProperties}
    >
      {showVotes && (
        <div className="voice-card__votes" aria-label="Votación comunitaria">
          <button
            type="button"
            className={`voice-card__vote ${vote === "up" ? "is-on" : ""}`}
            aria-label="Subir"
            onClick={() => handleVote("up")}
          >
            <IconVoto up />
          </button>
          <span className="voice-card__score">{score}</span>
          <button
            type="button"
            className={`voice-card__vote ${vote === "down" ? "is-on" : ""}`}
            aria-label="Bajar"
            onClick={() => handleVote("down")}
          >
            <IconVoto up={false} />
          </button>
        </div>
      )}

      <div className="voice-card__panel">
        <header className="voice-card__head">
          <Link to={authorPath} className="voice-card__avatar-link" aria-label={`Ver perfil de ${name}`}>
            <UserAvatar user={avatarUser} size="sm" verified />
          </Link>
          <div className="voice-card__who">
            <Link to={authorPath} className="voice-card__name">
              {name}
            </Link>
            <span className="voice-card__handle">@{post.handle}</span>
            {community && <CommunityChip community={community} size="md" />}
          </div>
          <div className="voice-card__head-end">
            <time dateTime={new Date(post.ts).toISOString()} className="voice-card__time">
              {formatTimeAgo(post.ts, locale)}
            </time>
            <PostMenu postId={post.id} />
          </div>
        </header>

        <Link to={`/app/post/${post.id}`} className="voice-card__body-link">
          <p className="voice-card__body">{post.content}</p>
        </Link>

        {post.curationStatus === "flagged" && (
          <p className="voice-card__mod">En revisión por moderación</p>
        )}

        <footer className="voice-card__actions">
          <button
            type="button"
            className={`voice-card__action ${didResonate ? "is-on" : ""}`}
            aria-pressed={didResonate}
            onClick={toggleResonate}
          >
            <IconResuena />
            <span>Resuena{resonateTotal > 0 ? ` · ${resonateTotal}` : ""}</span>
          </button>
          <Link to={`/app/post/${post.id}`} className="voice-card__action" aria-label="Responder">
            <IconResponder />
            <span>Responder{post.replyCount > 0 ? ` · ${post.replyCount}` : ""}</span>
          </Link>
          {post.txHash && /^[0-9a-f]{64}$/i.test(post.txHash) ? (
            <a
              className="voice-card__action voice-card__action--icon"
              href={`https://stellar.expert/explorer/testnet/tx/${post.txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
              title="Verificar esta opinión on-chain (Stellar Expert)"
            >
              <IconContrato />
              <span className="sr-only">Ver on-chain</span>
            </a>
          ) : (
            <button
              type="button"
              className="voice-card__action voice-card__action--icon"
              disabled
              title="Anclándose on-chain…"
            >
              <IconContrato />
              <span className="sr-only">On-chain</span>
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}
