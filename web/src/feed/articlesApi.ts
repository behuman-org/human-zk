// Cliente de Artículos (Capa 2 · platform/api). Long-form anclado on-chain como un tweet.
import { requireEnv } from "../lib/envGuard";
import { authHeaders, ensurePlatformAuth } from "./platformAuth";
import { loadAnyCredentialAsync } from "../kyc/credentialStore";

const BASE = requireEnv("VITE_PLATFORM_API_URL", "http://localhost:8788");

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    let code = `HTTP ${res.status}`;
    try {
      code = (JSON.parse(t) as { error?: string }).error ?? code;
    } catch {
      /* HTML/empty */
    }
    throw new Error(code);
  }
  return (await res.json()) as T;
}

async function post(path: string, body: unknown) {
  const cred = await loadAnyCredentialAsync();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cred) {
    const token = await ensurePlatformAuth(cred);
    Object.assign(headers, authHeaders(token));
  }
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export interface ArticleListItem {
  id: string;
  platformId: string;
  handle: string;
  username: string;
  title: string;
  banner: string;
  excerpt: string;
  txHash: string;
  ts: number;
}

export interface Article extends ArticleListItem {
  content: string;
  contentHash: string;
}

export interface ArticleOpinion {
  id: string;
  articleId: string;
  platformId: string;
  handle: string;
  content: string;
  txHash: string;
  ts: number;
}

export async function listArticles(): Promise<ArticleListItem[]> {
  return json(await fetch(`${BASE}/articles`));
}

export async function getArticle(id: string): Promise<Article> {
  return json(await fetch(`${BASE}/articles/${id}`));
}

export async function createArticle(body: {
  platformId: string;
  title: string;
  banner: string;
  content: string;
  contentHash: string;
  txHash: string;
}): Promise<Article> {
  return json(await post(`/articles`, body));
}

export async function listArticleOpinions(id: string): Promise<ArticleOpinion[]> {
  return json(await fetch(`${BASE}/articles/${id}/opinions`));
}

export async function postArticleOpinion(
  id: string,
  body: { platformId: string; content: string; contentHash: string; txHash: string },
): Promise<ArticleOpinion> {
  return json(await post(`/articles/${id}/opinions`, body));
}
