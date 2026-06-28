/**
 * Cliente REST Capa 2 — `platform/api` (:8788).
 * Contratos alineados con server.ts; rutas sociales listas para cuando el backend las exponga.
 */
const BASE = import.meta.env.VITE_PLATFORM_API_URL ?? "http://localhost:8788";

export type CurationStatus = "approved" | "flagged" | "escalated";

export interface ApiFeedItem {
  id: string;
  platformId: string;
  handle: string;
  username: string;
  content: string;
  contentHash: string;
  txHash: string;
  curation: { status: CurationStatus; reason?: string };
  ts: number;
  communityId?: string;
  replyCount?: number;
}

export interface ApiReply {
  id: string;
  parentId: string;
  platformId: string;
  handle: string;
  username: string;
  content: string;
  contentHash: string;
  txHash: string;
  curation: { status: CurationStatus; reason?: string };
  ts: number;
}

export interface ApiProfile {
  username: string;
  handle: string;
}

export interface ApiCommunity {
  id: string;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  accent: string;
}

export interface ApiNotification {
  id: string;
  kind: "follow" | "reply" | "mention" | "message" | "system";
  text: string;
  ts: number;
  read: boolean;
  href?: string;
}

export interface ApiDirectMessage {
  id: string;
  fromPlatformId: string;
  toPlatformId: string;
  content: string;
  ts: number;
}

export interface ApiSocialStats {
  followers: number;
  following: number;
}

export class PlatformApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PlatformApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Respuesta no-JSON (p.ej. el 404 de Express devuelve HTML). No es fatal.
    return {} as T;
  }
}

// Endpoints que ya devolvieron 404/501 (features sociales sin backend): se memorizan para
// NO volver a pedirlos en cada render (evita spam de 404 en consola). Se descubren una vez.
const knownMissing = new Set<string>();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const key = `${method} ${path.split("?")[0]}`;
  if (knownMissing.has(key)) {
    throw new PlatformApiError("endpoint_unavailable", 501, "endpoint_unavailable");
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // Endpoint inexistente (404/501): lo memorizamos para no reintentar (degrada a default).
    if (res.status === 404 || res.status === 501) knownMissing.add(key);
    // No parseamos el body como JSON (puede ser HTML); extraemos `error` solo si vino JSON.
    const body = await parseJson<{ error?: string }>(res);
    throw new PlatformApiError(
      typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
      res.status,
      body.error,
    );
  }
  return parseJson<T>(res);
}

/** SHA-256 hex del contenido (contentHash para POST /content). */
export async function computeContentHash(content: string): Promise<string> {
  const enc = new TextEncoder().encode(content);
  const ab = new ArrayBuffer(enc.length);
  new Uint8Array(ab).set(enc);
  const buf = await crypto.subtle.digest("SHA-256", ab);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getFeed(): Promise<ApiFeedItem[]> {
  return request<ApiFeedItem[]>("/feed");
}

export async function getProfile(platformId: string): Promise<ApiProfile> {
  return request<ApiProfile>(`/profile/${encodeURIComponent(platformId)}`);
}

export async function setProfile(platformId: string, username: string): Promise<ApiProfile> {
  return request<ApiProfile>("/profile", {
    method: "POST",
    body: JSON.stringify({ platformId, username }),
  });
}

export async function postContent(body: {
  platformId: string;
  content: string;
  contentHash: string;
  txHash: string;
  communityId?: string;
}): Promise<ApiFeedItem> {
  return request<ApiFeedItem>("/content", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Un post (o respuesta) por id — para la vista de hilo. */
export async function getPost(id: string): Promise<ApiFeedItem> {
  return request<ApiFeedItem>(`/posts/${encodeURIComponent(id)}`);
}

/** Respuestas directas de un tweet (orden cronológico ascendente). */
export async function getReplies(parentId: string): Promise<ApiReply[]> {
  return request<ApiReply[]>(`/posts/${encodeURIComponent(parentId)}/replies`);
}

/** Ancla off-chain una respuesta a un tweet (el ancla on-chain la hizo el cliente). */
export async function postReply(
  parentId: string,
  body: { platformId: string; content: string; contentHash: string; txHash: string },
): Promise<ApiReply> {
  return request<ApiReply>(`/posts/${encodeURIComponent(parentId)}/replies`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- Rutas sociales (pendientes en platform/api) ---

export async function getCommunities(): Promise<ApiCommunity[]> {
  return request<ApiCommunity[]>("/communities");
}

export async function createCommunity(body: {
  name: string;
  description: string;
  accent?: string;
  createdByPlatformId: string;
}): Promise<ApiCommunity> {
  return request<ApiCommunity>("/communities", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getSocialStats(platformId: string): Promise<ApiSocialStats> {
  return request<ApiSocialStats>(`/social/stats/${encodeURIComponent(platformId)}`);
}

export async function followUser(platformId: string, targetPlatformId: string): Promise<void> {
  await request<{ ok: boolean }>("/social/follow", {
    method: "POST",
    body: JSON.stringify({ platformId, targetPlatformId }),
  });
}

export async function unfollowUser(platformId: string, targetPlatformId: string): Promise<void> {
  await request<{ ok: boolean }>("/social/follow", {
    method: "DELETE",
    body: JSON.stringify({ platformId, targetPlatformId }),
  });
}

export async function isFollowingUser(
  platformId: string,
  targetPlatformId: string,
): Promise<boolean> {
  const data = await request<{ following: boolean }>(
    `/social/follow/${encodeURIComponent(targetPlatformId)}?platformId=${encodeURIComponent(platformId)}`,
  );
  return data.following;
}

export async function getNotifications(platformId: string): Promise<ApiNotification[]> {
  return request<ApiNotification[]>(
    `/notifications?platformId=${encodeURIComponent(platformId)}`,
  );
}

export async function readNotification(platformId: string, id: string): Promise<void> {
  await request<{ ok: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    body: JSON.stringify({ platformId }),
  });
}

export async function readAllNotifications(platformId: string): Promise<void> {
  await request<{ ok: boolean }>("/notifications/read-all", {
    method: "POST",
    body: JSON.stringify({ platformId }),
  });
}

export async function getMessages(platformId: string): Promise<ApiDirectMessage[]> {
  return request<ApiDirectMessage[]>(
    `/messages?platformId=${encodeURIComponent(platformId)}`,
  );
}

export async function getMessageThread(
  platformId: string,
  peerPlatformId: string,
): Promise<ApiDirectMessage[]> {
  return request<ApiDirectMessage[]>(
    `/messages/${encodeURIComponent(peerPlatformId)}?platformId=${encodeURIComponent(platformId)}`,
  );
}

export async function sendDirectMessage(body: {
  fromPlatformId: string;
  toPlatformId: string;
  content: string;
}): Promise<ApiDirectMessage> {
  return request<ApiDirectMessage>("/messages", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function markMessagesRead(
  platformId: string,
  peerPlatformId: string,
): Promise<void> {
  await request<{ ok: boolean }>(
    `/messages/${encodeURIComponent(peerPlatformId)}/read`,
    {
      method: "POST",
      body: JSON.stringify({ platformId }),
    },
  );
}

export async function reportContent(body: {
  platformId: string;
  kind: "post" | "user";
  targetId: string;
  reason: string;
}): Promise<void> {
  await request<{ ok: boolean }>("/reports", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function hasReported(
  platformId: string,
  kind: "post" | "user",
  targetId: string,
): Promise<boolean> {
  const data = await request<{ reported: boolean }>(
    `/reports/check?platformId=${encodeURIComponent(platformId)}&kind=${kind}&targetId=${encodeURIComponent(targetId)}`,
  );
  return data.reported;
}

export { BASE as PLATFORM_API_BASE };
