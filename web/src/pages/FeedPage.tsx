import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { PostCard } from "../components/feed/PostCard";
import { PostComposer } from "../components/feed/PostComposer";
import { GENERAL_FEED_ID, communityLabel, fetchCommunities, fetchFeed, publishPost } from "../feed/feedApi";
import { useI18n } from "../i18n/I18nProvider";
import type { Community, FeedPost, FeedSort } from "../feed/types";
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
      setError("No pudimos cargar el feed. Verificá que la API esté en línea.");
    } finally {
      setLoading(false);
    }
  }, [community?.id, sort]);

  useEffect(() => {
    void fetchCommunities().then(setCommunities);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePublish(content: string, communityId: string) {
    await publishPost({
      content,
      communityId: communityId === "feed" ? GENERAL_FEED_ID : communityId,
    });
    await load();
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
      ) : (
        <header className="feed-column__top feed-column__top--feed">
          <h1 className="feed-column__title">{f.title}</h1>
        </header>
      )}

      <div className="feed-column__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`feed-column__tab ${sort === "new" ? "is-active" : ""}`}
          aria-selected={sort === "new"}
          onClick={() => setSort("new")}
        >
          {f.sortNew}
        </button>
        <button
          type="button"
          role="tab"
          className={`feed-column__tab ${sort === "hot" ? "is-active" : ""}`}
          aria-selected={sort === "hot"}
          onClick={() => setSort("hot")}
        >
          {f.sortHot}
        </button>
      </div>

      <PostComposer
        variant={isCommunity && community ? "thread" : "general"}
        thread={community}
        onPublish={handlePublish}
      />

      <section className="feed-stream" aria-label="Publicaciones del feed">
        {loading ? (
          <p className="feed-empty">{f.loading}</p>
        ) : error ? (
          <p className="feed-empty">{error}</p>
        ) : posts.length === 0 ? (
          <p className="feed-empty">{f.empty}</p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} showVotes={isCommunity} />
          ))
        )}
      </section>
    </div>
  );
}
