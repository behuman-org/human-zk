/** Capa 2 — platform/api (vault §5: GET/POST /feed, /profile, /content). */

export type CurationStatus = "approved" | "flagged" | "escalated";

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  /** Acento visual propio de la comunidad */
  accent: string;
}

export interface FeedPost {
  id: string;
  platformId: string;
  handle: string;
  username: string;
  content: string;
  communityId: string;
  curationStatus: CurationStatus;
  score: number;
  replyCount: number;
  ts: number;
  isOwn?: boolean;
}

export interface UserProfile {
  platformId: string;
  handle: string;
  username: string;
  bio: string;
  /** 0–5 preset de color de avatar */
  avatarIndex: number;
  verified: boolean;
}

export interface NewPostInput {
  content: string;
  communityId: string;
}

export type FeedSort = "new" | "hot";

export interface NewCommunityInput {
  name: string;
  description: string;
  accent?: string;
}

export interface ReportRecord {
  kind: "post" | "user";
  targetId: string;
  reason: string;
  ts: number;
}

export interface AppNotification {
  id: string;
  kind: "follow" | "reply" | "mention" | "message" | "system";
  text: string;
  ts: number;
  read: boolean;
  href?: string;
}

export interface DirectMessage {
  id: string;
  fromPlatformId: string;
  toPlatformId: string;
  content: string;
  ts: number;
}

export interface Conversation {
  peerPlatformId: string;
  peerUsername: string;
  peerHandle: string;
  peerAvatarIndex: number;
  lastMessage: string;
  lastTs: number;
  unreadCount: number;
}
