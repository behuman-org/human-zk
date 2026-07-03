import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Community, FeedPost } from "../../feed/types";
import {
  displayName,
  fetchCommunities,
  findCommunity,
  formatTimeAgo,
  profilePath,
  resonatePost,
  unresonatePost,
} from "../../feed/feedApi";
import { isResonatedLocally } from "../../identity/resonate";
import { useI18n } from "../../i18n/useI18n";
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

function PostBodyContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  if (blocks.length <= 1) {
    return <p className="voice-card__body">{content}</p>;
  }
  return (
    <div className="voice-card__body-stack">
      {blocks.map((block, index) => (
        <p key={index} className="voice-card__body-para">
          {block.trimEnd()}
        </p>
      ))}
    </div>
  );
}

export function PostCard({ post, showVotes = false }: PostCardProps) {
  const { locale, t } = useI18n();
  const p = t.social.postCard;
  const navigate = useNavigate();
  const [score, setScore] = useState(post.score);
  const [resonateCount, setResonateCount] = useState(post.resonateCount);
  const [didResonate, setDidResonate] = useState(() => isResonatedLocally(post.id));
  const [resonating, setResonating] = useState(false);
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

  async function toggleResonate() {
    if (resonating) return;
    setResonating(true);
    try {
      const count = didResonate ? await unresonatePost(post.id) : await resonatePost(post.id);
      setDidResonate((was) => !was);
      setResonateCount(count);
    } catch (e) {
      if ((e as Error).message === "verification_required") navigate("/onboarding");
    } finally {
      setResonating(false);
    }
  }

  const avatarUser = {
    username: post.username || post.handle,
    avatarIndex: post.platformId.charCodeAt(0) % 6,
  };

  return (
    <article
      className={`voice-card ${post.isOwn ? "voice-card--own" : ""}`}
      style={{ "--voice-accent": accent } as CSSProperties}
    >
      {showVotes && (
        <div className="voice-card__votes" aria-label={p.communityVote}>
          <button
            type="button"
            className={`voice-card__vote ${vote === "up" ? "is-on" : ""}`}
            aria-label={p.voteUp}
            onClick={() => handleVote("up")}
          >
            <IconVoto up />
          </button>
          <span className="voice-card__score">{score}</span>
          <button
            type="button"
            className={`voice-card__vote ${vote === "down" ? "is-on" : ""}`}
            aria-label={p.voteDown}
            onClick={() => handleVote("down")}
          >
            <IconVoto up={false} />
          </button>
        </div>
      )}

      <div className="voice-card__panel">
        <header className="voice-card__head">
          <Link
            to={authorPath}
            className="voice-card__avatar-link"
            aria-label={p.viewProfile.replace("{name}", name)}
          >
            <UserAvatar user={avatarUser} size="sm" verified />
          </Link>
          <div className="voice-card__meta">
            <div className="voice-card__title-row">
              <Link to={authorPath} className="voice-card__name">
                {name}
              </Link>
              <time dateTime={new Date(post.ts).toISOString()} className="voice-card__time">
                {formatTimeAgo(post.ts, locale)}
              </time>
            </div>
            <div className="voice-card__submeta">
              <span className="voice-card__handle">@{post.handle}</span>
              {community && (
                <>
                  <span className="voice-card__sep" aria-hidden="true">
                    ·
                  </span>
                  <CommunityChip community={community} size="sm" />
                </>
              )}
            </div>
          </div>
          <PostMenu postId={post.id} />
        </header>

        <Link to={`/app/post/${post.id}`} className="voice-card__body-link">
          <PostBodyContent content={post.content} />
        </Link>

        {post.curationStatus === "flagged" && <p className="voice-card__mod">{p.moderationReview}</p>}

        <footer className="voice-card__actions">
          <button
            type="button"
            className={`voice-card__action ${didResonate ? "is-on" : ""}`}
            aria-pressed={didResonate}
            onClick={toggleResonate}
            disabled={resonating}
            title={didResonate ? p.resonateRemove : p.resonateAnon}
          >
            <IconResuena />
            <span className="voice-card__action-text">
              {resonating ? "…" : p.resonate}
            </span>
            {!resonating && resonateCount > 0 && (
              <span className="voice-card__action-count">{resonateCount}</span>
            )}
          </button>
          <Link to={`/app/post/${post.id}`} className="voice-card__action" aria-label={p.reply}>
            <IconResponder />
            <span className="voice-card__action-text">{p.reply}</span>
            {post.replyCount > 0 && (
              <span className="voice-card__action-count">{post.replyCount}</span>
            )}
          </Link>
          {post.txHash && /^[0-9a-f]{64}$/i.test(post.txHash) ? (
            <a
              className="voice-card__action voice-card__action--icon"
              href={`https://stellar.expert/explorer/testnet/tx/${post.txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none" }}
              title={p.verifyOnChain}
            >
              <IconContrato />
              <span className="sr-only">{p.viewOnChain}</span>
            </a>
          ) : (
            <button
              type="button"
              className="voice-card__action voice-card__action--icon"
              disabled
              title={p.anchoring}
            >
              <IconContrato />
              <span className="sr-only">{t.social.common.onChainPending}</span>
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}
