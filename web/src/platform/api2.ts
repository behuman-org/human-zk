// Cliente del backend de plataforma (perfil + contenido + feed). Keyed por platformId.
const BASE = import.meta.env.VITE_PLATFORM_API_URL ?? "http://localhost:8788";

export type CurationStatus = "approved" | "flagged" | "escalated";

export interface FeedItem {
  id: string;
  platformId: string;
  handle: string;
  username: string;
  content: string;
  contentHash: string;
  txHash: string;
  curation: { status: CurationStatus; reason?: string };
  ts: number;
}

export interface ModerationItem {
  id: string;
  handle: string;
  content: string;
  reason: string;
  ts: number;
}

export async function getModerationQueue(): Promise<ModerationItem[]> {
  const res = await fetch(`${BASE}/moderation/queue`);
  if (!res.ok) throw new Error(`queue HTTP ${res.status}`);
  return (await res.json()) as ModerationItem[];
}

export async function resolveModeration(id: string, status: "approved" | "flagged"): Promise<void> {
  await fetch(`${BASE}/moderation/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
}

export async function setProfile(platformId: string, username: string): Promise<void> {
  await fetch(`${BASE}/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platformId, username }),
  });
}

export async function postContent(
  platformId: string,
  content: string,
  contentHash: string,
  txHash: string,
): Promise<void> {
  await fetch(`${BASE}/content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platformId, content, contentHash, txHash }),
  });
}

export async function getFeed(): Promise<FeedItem[]> {
  const res = await fetch(`${BASE}/feed`);
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  return (await res.json()) as FeedItem[];
}
