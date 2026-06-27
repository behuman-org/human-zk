import { GENERAL_FEED_ID } from "./constants";
import * as platformApi from "./platformApi";
import { PlatformApiError } from "./platformApi";
import { avatarColor, handleOf, loadSession } from "./session";
import type {
  AppNotification,
  Community,
  Conversation,
  DirectMessage,
  FeedPost,
  FeedSort,
  NewCommunityInput,
  NewPostInput,
  UserProfile,
} from "./types";

const THREAD_ACCENTS = ["#0ea5e9", "#16a34a", "#7c3aed", "#ea580c", "#0284c7", "#ec4899"];

function isMissingEndpoint(err: unknown): boolean {
  return err instanceof PlatformApiError && (err.status === 404 || err.status === 501);
}

function mapApiItem(item: platformApi.ApiFeedItem, ownId: string): FeedPost {
  return {
    id: item.id,
    platformId: item.platformId,
    handle: item.handle || handleOf(item.platformId),
    username: item.username || item.handle,
    content: item.content,
    communityId: item.communityId ?? GENERAL_FEED_ID,
    curationStatus: item.curation?.status ?? "approved",
    score: 0,
    replyCount: 0,
    ts: item.ts,
    isOwn: item.platformId === ownId,
  };
}

function mapProfile(platformId: string, api: platformApi.ApiProfile): UserProfile {
  return {
    platformId,
    handle: api.handle || handleOf(platformId),
    username: api.username || api.handle || handleOf(platformId),
    bio: "",
    avatarIndex: platformId.charCodeAt(0) % 6,
    verified: true,
  };
}

function sortPosts(posts: FeedPost[], sort: FeedSort): FeedPost[] {
  const copy = [...posts];
  if (sort === "hot") {
    return copy.sort((a, b) => b.score - a.score || b.ts - a.ts);
  }
  return copy.sort((a, b) => b.ts - a.ts);
}

function normalizeThreadName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^r\//, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 21);
}

export function findCommunity(id: string, communities: Community[]): Community | undefined {
  return communities.find((c) => c.id === id || c.slug === id);
}

export function profilePath(platformId: string): string {
  return `/app/u/${encodeURIComponent(platformId)}`;
}

export async function fetchCommunities(): Promise<Community[]> {
  try {
    return await platformApi.getCommunities();
  } catch (err) {
    if (isMissingEndpoint(err)) return [];
    throw err;
  }
}

export async function createCommunity(input: NewCommunityInput): Promise<Community> {
  const session = loadSession();
  const name = normalizeThreadName(input.name);
  if (name.length < 3) {
    throw new Error("El nombre del hilo debe tener al menos 3 caracteres (letras, números o _).");
  }
  const description = input.description.trim().slice(0, 200);
  if (!description) {
    throw new Error("Agregá una descripción para el hilo.");
  }

  const existing = await fetchCommunities();
  if (existing.some((c) => c.name === name || c.slug === name)) {
    throw new Error("Ya existe un hilo con ese nombre.");
  }

  return platformApi.createCommunity({
    name,
    description,
    accent: input.accent ?? THREAD_ACCENTS[existing.length % THREAD_ACCENTS.length],
    createdByPlatformId: session.platformId,
  });
}

export async function fetchFeed(opts?: {
  communityId?: string;
  generalOnly?: boolean;
  sort?: FeedSort;
  authorPlatformId?: string;
  followingOnly?: boolean;
}): Promise<FeedPost[]> {
  const session = loadSession();
  const items = await platformApi.getFeed();
  let posts = items.map((i) => mapApiItem(i, session.platformId));

  if (opts?.generalOnly) {
    posts = posts.filter((p) => p.communityId === GENERAL_FEED_ID);
  } else if (opts?.communityId) {
    posts = posts.filter((p) => p.communityId === opts.communityId);
  }
  if (opts?.authorPlatformId) {
    posts = posts.filter((p) => p.platformId === opts.authorPlatformId);
  }
  if (opts?.followingOnly) {
    posts = [];
  }

  return sortPosts(posts, opts?.sort ?? "new");
}

export async function publishPost(input: NewPostInput): Promise<FeedPost> {
  const session = loadSession();
  const content = input.content.trim();
  const contentHash = await platformApi.computeContentHash(content);
  const txHash = import.meta.env.VITE_OPINION_BOARD_CONTRACT_ID ? "" : "pending_onchain";

  const item = await platformApi.postContent({
    platformId: session.platformId,
    content,
    contentHash,
    txHash,
    communityId: input.communityId === GENERAL_FEED_ID ? undefined : input.communityId,
  });

  return {
    ...mapApiItem(item, session.platformId),
    communityId: input.communityId,
    isOwn: true,
  };
}

export async function fetchPublicProfile(platformId: string): Promise<UserProfile | null> {
  const session = loadSession();
  if (platformId === session.platformId) return session;

  try {
    const api = await platformApi.getProfile(platformId);
    if (!api.username && !api.handle) return null;
    return mapProfile(platformId, api);
  } catch (err) {
    if (err instanceof PlatformApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getFollowerCount(platformId: string): Promise<number> {
  try {
    const stats = await platformApi.getSocialStats(platformId);
    return stats.followers;
  } catch (err) {
    if (isMissingEndpoint(err)) return 0;
    throw err;
  }
}

export async function getFollowingCount(platformId: string): Promise<number> {
  try {
    const stats = await platformApi.getSocialStats(platformId);
    return stats.following;
  } catch (err) {
    if (isMissingEndpoint(err)) return 0;
    throw err;
  }
}

export async function followUser(targetPlatformId: string): Promise<void> {
  const session = loadSession();
  await platformApi.followUser(session.platformId, targetPlatformId);
}

export async function unfollowUser(targetPlatformId: string): Promise<void> {
  const session = loadSession();
  await platformApi.unfollowUser(session.platformId, targetPlatformId);
}

export async function isFollowingUser(targetPlatformId: string): Promise<boolean> {
  const session = loadSession();
  try {
    return await platformApi.isFollowingUser(session.platformId, targetPlatformId);
  } catch (err) {
    if (isMissingEndpoint(err)) return false;
    throw err;
  }
}

export async function reportPost(postId: string, reason: string): Promise<void> {
  const session = loadSession();
  await platformApi.reportContent({
    platformId: session.platformId,
    kind: "post",
    targetId: postId,
    reason,
  });
}

export async function reportUser(targetPlatformId: string, reason: string): Promise<void> {
  const session = loadSession();
  await platformApi.reportContent({
    platformId: session.platformId,
    kind: "user",
    targetId: targetPlatformId,
    reason,
  });
}

export async function wasReported(kind: "post" | "user", targetId: string): Promise<boolean> {
  const session = loadSession();
  try {
    return await platformApi.hasReported(session.platformId, kind, targetId);
  } catch (err) {
    if (isMissingEndpoint(err)) return false;
    throw err;
  }
}

export { GENERAL_FEED_ID };

export async function fetchNotifications(): Promise<AppNotification[]> {
  const session = loadSession();
  try {
    return await platformApi.getNotifications(session.platformId);
  } catch (err) {
    if (isMissingEndpoint(err)) return [];
    throw err;
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  const items = await fetchNotifications();
  return items.filter((n) => !n.read).length;
}

export async function readNotification(id: string): Promise<void> {
  const session = loadSession();
  await platformApi.readNotification(session.platformId, id);
}

export async function readAllNotifications(): Promise<void> {
  const session = loadSession();
  await platformApi.readAllNotifications(session.platformId);
}

export async function sendMessage(
  fromPlatformId: string,
  toPlatformId: string,
  content: string,
): Promise<DirectMessage> {
  return platformApi.sendDirectMessage({ fromPlatformId, toPlatformId, content });
}

export async function getUnreadMessagesCount(myPlatformId: string): Promise<number> {
  try {
    const messages = await platformApi.getMessages(myPlatformId);
    return messages.length;
  } catch (err) {
    if (isMissingEndpoint(err)) return 0;
    throw err;
  }
}

export async function fetchThread(
  myPlatformId: string,
  peerPlatformId: string,
): Promise<DirectMessage[]> {
  try {
    return await platformApi.getMessageThread(myPlatformId, peerPlatformId);
  } catch (err) {
    if (isMissingEndpoint(err)) return [];
    throw err;
  }
}

export async function markConversationRead(
  myPlatformId: string,
  peerPlatformId: string,
): Promise<void> {
  try {
    await platformApi.markMessagesRead(myPlatformId, peerPlatformId);
  } catch (err) {
    if (isMissingEndpoint(err)) return;
    throw err;
  }
}

export async function fetchConversations(myPlatformId: string): Promise<Conversation[]> {
  let messages: DirectMessage[];
  try {
    messages = await platformApi.getMessages(myPlatformId);
  } catch (err) {
    if (isMissingEndpoint(err)) return [];
    throw err;
  }

  const byPeer = new Map<string, DirectMessage>();

  for (const message of messages) {
    if (message.fromPlatformId !== myPlatformId && message.toPlatformId !== myPlatformId) {
      continue;
    }
    const peer =
      message.fromPlatformId === myPlatformId ? message.toPlatformId : message.fromPlatformId;
    const current = byPeer.get(peer);
    if (!current || message.ts > current.ts) {
      byPeer.set(peer, message);
    }
  }

  const conversations: Conversation[] = [];
  for (const [peerPlatformId, last] of byPeer.entries()) {
    let profile: UserProfile | null = null;
    try {
      profile = await fetchPublicProfile(peerPlatformId);
    } catch {
      /* peer sin perfil aún */
    }
    conversations.push({
      peerPlatformId,
      peerUsername: profile?.username ?? handleOf(peerPlatformId),
      peerHandle: profile?.handle ?? handleOf(peerPlatformId),
      peerAvatarIndex: profile?.avatarIndex ?? peerPlatformId.charCodeAt(0) % 6,
      lastMessage: last.content,
      lastTs: last.ts,
      unreadCount: 0,
    });
  }

  return conversations.sort((a, b) => b.lastTs - a.lastTs);
}

export function messagesPath(peerPlatformId: string): string {
  return `/app/messages/${encodeURIComponent(peerPlatformId)}`;
}

export async function syncProfileToApi(profile: UserProfile): Promise<void> {
  await platformApi.setProfile(profile.platformId, profile.username);
}

export async function bootstrapProfileFromApi(platformId: string): Promise<UserProfile> {
  const local = loadSession();
  try {
    const api = await platformApi.getProfile(platformId);
    const merged: UserProfile = {
      ...local,
      username: api.username || local.username,
      handle: api.handle || local.handle,
    };
    return merged;
  } catch {
    return local;
  }
}

export function formatTimeAgo(ts: number, locale = "es"): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return locale === "es" ? "ahora" : "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(locale === "es" ? "es-AR" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

export function displayName(username: string, handle: string): string {
  return username.trim() || handle;
}

export function communityLabel(c: Community): string {
  return `r/${c.name}`;
}

export { avatarColor };
