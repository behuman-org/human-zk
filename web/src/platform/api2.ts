// Cliente del backend de plataforma (perfil + contenido + feed). Keyed por platformId.
const BASE = import.meta.env.VITE_PLATFORM_API_URL ?? "http://localhost:8788";

export interface FeedItem {
  platformId: string;
  handle: string;
  username: string;
  content: string;
  contentHash: string;
  txHash: string;
  ts: number;
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
