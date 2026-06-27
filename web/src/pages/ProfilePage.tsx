import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EditProfileModal } from "../components/feed/EditProfileModal";
import { HumanBadge } from "../components/feed/HumanBadge";
import { PostCard } from "../components/feed/PostCard";
import { ProfileActions } from "../components/feed/ProfileActions";
import { UserAvatar } from "../components/feed/UserAvatar";
import {
  fetchFeed,
  fetchPublicProfile,
  getFollowerCount,
  getFollowingCount,
} from "../feed/feedApi";
import { useUser } from "../feed/UserContext";
import { useI18n } from "../i18n/I18nProvider";
import type { FeedPost, UserProfile } from "../feed/types";
import "./ProfilePage.css";
import "./SocialShell.css";

export function ProfilePage() {
  const { platformId: routePlatformId } = useParams<{ platformId?: string }>();
  const { user: me } = useUser();
  const { t, locale } = useI18n();
  const p = t.social.profile;
  const platformId = routePlatformId ?? me.platformId;
  const isOwn = platformId === me.platformId;

  const [profile, setProfile] = useState<UserProfile | null>(isOwn ? me : null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const load = useCallback(async () => {
    const resolved = isOwn ? me : await fetchPublicProfile(platformId);
    setProfile(resolved);
    if (resolved) {
      const [followers, following] = await Promise.all([
        getFollowerCount(resolved.platformId),
        isOwn ? getFollowingCount(resolved.platformId) : Promise.resolve(0),
      ]);
      setFollowerCount(followers);
      setFollowingCount(following);
      const data = await fetchFeed({ authorPlatformId: resolved.platformId });
      setPosts(data);
    } else {
      setPosts([]);
      setFollowerCount(0);
      setFollowingCount(0);
    }
  }, [isOwn, me, platformId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile) {
    return (
      <div className="profile-page">
        <header className="feed-column__top">
          <h1 className="feed-column__title">{p.notFound}</h1>
        </header>
        <p className="feed-empty">
          {p.notFoundBody}{" "}
          <Link to="/app">{p.backToFeed}</Link>
        </p>
      </div>
    );
  }

  const followers = followerCount;
  const following = isOwn ? followingCount : null;

  return (
    <div className="profile-page">
      <header className="profile-page__banner" />
      <div className="profile-page__head">
        <UserAvatar user={profile} size="lg" verified className="profile-page__avatar" />
        {isOwn ? (
          <div className="profile-page__actions-own">
            <Link to="/app/settings" className="profile-page__settings">
              {p.appSettings}
            </Link>
            <button type="button" className="profile-page__edit" onClick={() => setEditOpen(true)}>
              {p.editProfile}
            </button>
          </div>
        ) : (
          <ProfileActions
            platformId={profile.platformId}
            username={profile.username}
            onFollowChange={() =>
              void getFollowerCount(profile.platformId).then(setFollowerCount)
            }
          />
        )}
      </div>

      <div className="profile-page__info">
        <h1 className="profile-page__name">{profile.username || profile.handle}</h1>
        <p className="profile-page__handle">
          @{profile.handle} <HumanBadge />
        </p>
        {profile.bio && <p className="profile-page__bio">{profile.bio}</p>}
        <p className="profile-page__stats">
          <span>
            <strong>{followers.toLocaleString(locale === "es" ? "es-AR" : "en-US")}</strong> {p.followers}
          </span>
          {following !== null && (
            <span>
              <strong>{following.toLocaleString(locale === "es" ? "es-AR" : "en-US")}</strong> {p.following}
            </span>
          )}
          <span>
            <strong>{posts.length.toLocaleString(locale === "es" ? "es-AR" : "en-US")}</strong> {p.publications}
          </span>
        </p>
        <p className="profile-page__joined">
          <Link to="/app">{p.backHome}</Link>
        </p>
      </div>

      <nav className="profile-page__tabs" aria-label={p.postsTab}>
        <span className="profile-page__tab is-active">{p.postsTab}</span>
      </nav>

      <section aria-label={p.postsTab}>
        {posts.length === 0 ? (
          <p className="feed-empty">{isOwn ? p.emptyOwnPosts : p.emptyOtherPosts}</p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </section>

      {isOwn && <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />}
    </div>
  );
}
