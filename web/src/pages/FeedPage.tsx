import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { PostCard } from "../components/feed/PostCard";
import { PostComposer } from "../components/feed/PostComposer";
import { GENERAL_FEED_ID, communityLabel, fetchCommunities, fetchFeed, publishPost } from "../feed/feedApi";
import { useI18n } from "../i18n/useI18n";
import type { Community, FeedPost, FeedSort } from "../feed/types";
import "./FeedPage.css";
import "./SocialShell.css";

export function FeedPage() {
  const { t, locale } = useI18n();
  const f = t.social.feed;
  const { communityId: routeSlug } = useParams<{ communityId?: string }>();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [sort, setSort] = useState<FeedSort>("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const community = communities.find((c) => c.slug === routeSlug || c.id === routeSlug);
  const isCommunity = Boolean(community);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFeed({
        communityId: community?.id,
        generalOnly: !community,
        sort,
      });
      setPosts(data);
    } catch {
      setPosts([]);
      setError(t.social.feed.errorLoad);
    } finally {
      setLoading(false);
    }
  }, [community?.id, sort, t.social.feed.errorLoad]);

  useEffect(() => {
    void fetchCommunities().then(setCommunities);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePublish(content: string, communityId: string) {
    setPublishError(null);
    try {
      await publishPost({
        content,
        communityId: communityId === "feed" ? GENERAL_FEED_ID : communityId,
      });
      await load();
    } catch (e) {
      setPublishError((e as Error).message);
      throw e;
    }
  }

  return (
    <div className="feed-column">
      {isCommunity && community ? (
        <header
          className="community-banner"
          style={{ "--banner-accent": community.accent } as CSSProperties}
        >
          <p className="community-banner__eyebrow">{f.threadEyebrow}</p>
          <h1 className="community-banner__name">{communityLabel(community)}</h1>
          <p className="community-banner__desc">{community.description}</p>
          <p className="community-banner__meta">
            {community.memberCount.toLocaleString(locale === "es" ? "es-AR" : "en-US")} {f.members}
          </p>
        </header>
      ) : null}

      <div className="feed-toolbar">
        {!isCommunity && (
          <header className="shell-page-header feed-page__intro">
            <div className="shell-page-header__intro">
              <p className="shell-page-header__eyebrow">{f.eyebrow}</p>
              <h1 className="shell-page-header__title">{f.title}</h1>
              <p className="shell-page-header__lead">{f.subtitle}</p>
            </div>
          </header>
        )}

        <div className="feed-column__tabs" role="tablist" aria-label={f.sortAria}>
          <button
            type="button"
            role="tab"
            id="feed-tab-new"
            aria-controls="feed-stream-panel"
            className={`feed-column__tab ${sort === "new" ? "is-active" : ""}`}
            aria-selected={sort === "new"}
            onClick={() => setSort("new")}
          >
            {f.sortNew}
          </button>
          <button
            type="button"
            role="tab"
            id="feed-tab-hot"
            aria-controls="feed-stream-panel"
            className={`feed-column__tab ${sort === "hot" ? "is-active" : ""}`}
            aria-selected={sort === "hot"}
            onClick={() => setSort("hot")}
          >
            {f.sortHot}
          </button>
        </div>
      </div>

      <PostComposer
        variant={isCommunity && community ? "thread" : "general"}
        thread={community}
        onPublish={handlePublish}
        publishError={publishError}
        onClearError={() => setPublishError(null)}
      />

      <section
        id="feed-stream-panel"
        className="feed-stream"
        aria-label={f.postsAria}
        role="tabpanel"
        aria-labelledby={sort === "new" ? "feed-tab-new" : "feed-tab-hot"}
      >
        {loading ? (
          <div className="feed-state feed-state--loading">
            <p className="feed-state__message">{f.loading}</p>
          </div>
        ) : error ? (
          <div className="feed-state feed-state--error">
            <p className="feed-state__message feed-state__message--err">{error}</p>
            <button type="button" className="feed-state__action" onClick={() => void load()}>
              {f.retry}
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="feed-state">
            <p className="feed-state__message">{f.empty}</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} showVotes={isCommunity} />
          ))
        )}
      </section>
    </div>
  );
}
