// Backend de la plataforma (CAPA 2). Guarda perfil (username) + contenido de los posts,
// SIEMPRE keyed por `platformId`. ⚠️ Cero PII, cero address del KYC: solo platformId
// (seudónimo anónimo), username libre, contenido y contentHash.
//
// El anclaje on-chain (opinion_board) lo hace el cliente; acá vive el contenido off-chain
// y el feed. Store en archivo JSON (demo, gitignored).
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import type { CurationVerdict } from "@behuman/shared";
import {
  escalateToModeration,
  getModerationQueue,
  resolveModeration,
  reviewPost,
} from "@behuman/curation";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "..", "..", "..", ".env") });
const STORE = process.env.PLATFORM_STORE ?? resolve(here, "..", ".platform-store.json");

interface Profile {
  username: string;
  handle: string;
}
interface PostItem {
  id: string;
  platformId: string;
  handle: string;
  username: string;
  content: string;
  contentHash: string;
  txHash: string; // tx on-chain del ancla (firmada por cuenta efímera, sin address KYC)
  curation: CurationVerdict; // veredicto de la curaduría (approved / flagged / escalated)
  ts: number;
}
// Artículo (long-form). El contentHash on-chain cubre título+banner+cuerpo (inmutable).
interface ArticleItem {
  id: string;
  platformId: string;
  handle: string;
  username: string;
  title: string;
  banner: string; // data URL (o "")
  content: string; // markdown
  contentHash: string;
  txHash: string; // ancla on-chain (opinion_board)
  ts: number;
}
interface ArticleOpinion {
  id: string;
  articleId: string;
  platformId: string;
  handle: string;
  content: string;
  contentHash: string;
  txHash: string;
  ts: number;
}
// Respuesta a un tweet (espejo de ArticleOpinion). `parentId` ata la respuesta a su hilo;
// es genérico (puede apuntar a un post o a otra respuesta → anidado a futuro). El contentHash
// on-chain incluye el parentId (la prueba ZK ata la respuesta a su padre).
interface Reply {
  id: string;
  parentId: string;
  platformId: string;
  handle: string;
  username: string;
  content: string;
  contentHash: string;
  txHash: string;
  curation: CurationVerdict;
  ts: number;
}
interface Store {
  profiles: Record<string, Profile>;
  posts: PostItem[];
  articles: ArticleItem[];
  articleOpinions: ArticleOpinion[];
  replies: Reply[];
}

function load(): Store {
  const base: Store = { profiles: {}, posts: [], articles: [], articleOpinions: [], replies: [] };
  if (!existsSync(STORE)) return base;
  return { ...base, ...(JSON.parse(readFileSync(STORE, "utf8")) as Partial<Store>) };
}
function save(s: Store): void {
  writeFileSync(STORE, JSON.stringify(s, null, 2));
}

/** Handle público: últimos 5 caracteres del platformId. */
const handleOf = (platformId: string) => platformId.slice(-5);

/** Curaduría Nivel 1 (solo contenido + seudónimo; nunca address). Compartida por posts y replies.
 * Sin ANTHROPIC_API_KEY (dev/demo) se aprueba (visible); con clave, si el curador falla se escala. */
async function curate(platformId: string, handle: string, content: string): Promise<CurationVerdict> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "approved", reason: "curaduría deshabilitada (dev)" };
  }
  try {
    return await reviewPost({ platformId, handle, content });
  } catch (err) {
    console.error("[curation] no disponible:", (err as Error).message);
    return { status: "escalated", reason: "Curador no disponible; revisión humana." };
  }
}

const app = express();
// Límite alto: los artículos pueden traer banner + imágenes embebidas (data URLs).
app.use(express.json({ limit: "12mb" }));
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Perfil / username (libre, mutable, sin unicidad por ahora).
app.post("/profile", (req, res) => {
  const platformId = String(req.body?.platformId ?? "");
  const username = String(req.body?.username ?? "").trim().slice(0, 40);
  if (!platformId) return res.status(400).json({ error: "missing_platformId" });
  const s = load();
  s.profiles[platformId] = { username, handle: handleOf(platformId) };
  save(s);
  res.json(s.profiles[platformId]);
});

app.get("/profile/:platformId", (req, res) => {
  const platformId = req.params.platformId;
  const s = load();
  res.json(s.profiles[platformId] ?? { username: "", handle: handleOf(platformId) });
});

// Contenido del post (off-chain). El ancla on-chain la hace el cliente vía opinion_board.
// Antes de publicarlo, pasa por la curaduría (Nivel 1); los casos dudosos se escalan.
app.post("/content", async (req, res) => {
  const platformId = String(req.body?.platformId ?? "");
  const content = String(req.body?.content ?? "").trim().slice(0, 560);
  const contentHash = String(req.body?.contentHash ?? "");
  const txHash = String(req.body?.txHash ?? "");
  if (!platformId || !content || !contentHash) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const s = load();
  const profile = s.profiles[platformId] ?? { username: "", handle: handleOf(platformId) };

  // Nivel 1 — curaduría (solo contenido + seudónimo; nunca address).
  const curation = await curate(platformId, profile.handle, content);

  const item: PostItem = {
    id: randomUUID(),
    platformId,
    handle: profile.handle,
    username: profile.username,
    content,
    contentHash,
    txHash,
    curation,
    ts: Date.now(),
  };

  // Nivel 2 — escalado a moderación humana (solo contenido + seudónimo + motivo).
  if (curation.status === "escalated") {
    escalateToModeration({
      id: item.id,
      platformId,
      handle: item.handle,
      content,
      reason: curation.reason ?? "",
    });
  }

  s.posts.push(item);
  save(s);
  console.log(`[content] id=${item.id} curation=${curation.status}`);
  res.json(item);
});

// Cuenta respuestas visibles (no escaladas) de un parentId.
const replyCountOf = (s: Store, parentId: string) =>
  s.replies.filter((r) => r.parentId === parentId && r.curation?.status !== "escalated").length;

// Feed público: muestra approved + flagged. Los escalated quedan pendientes (no se publican)
// hasta que un moderador los resuelva. Incluye replyCount por post.
app.get("/feed", (_req, res) => {
  const s = load();
  res.json(
    [...s.posts]
      .reverse()
      .filter((p) => p.curation?.status !== "escalated")
      .map((p) => ({ ...p, replyCount: replyCountOf(s, p.id) })),
  );
});

// Un post (o respuesta) por id — para la vista de hilo. Busca primero en posts y luego en
// replies (así una respuesta también tiene su propio hilo: anidado a futuro).
app.get("/posts/:id", (req, res) => {
  const s = load();
  const post = s.posts.find((p) => p.id === req.params.id);
  if (post) return res.json({ ...post, replyCount: replyCountOf(s, post.id) });
  const reply = s.replies.find((r) => r.id === req.params.id);
  if (reply) {
    return res.json({
      ...reply,
      communityId: undefined,
      curation: reply.curation,
      replyCount: replyCountOf(s, reply.id),
    });
  }
  return res.status(404).json({ error: "not_found" });
});

// Responder un tweet: mismo flujo que un post (curaduría Nivel 1 + ancla on-chain en el cliente),
// pero con parentId. El contentHash on-chain incluye el parentId (la prueba ata la respuesta a
// su hilo). Sin nullifier: se puede responder varias veces con contenido distinto.
app.post("/posts/:id/replies", async (req, res) => {
  const s = load();
  const parent = s.posts.find((p) => p.id === req.params.id) ?? s.replies.find((r) => r.id === req.params.id);
  if (!parent) return res.status(404).json({ error: "parent_not_found" });
  const platformId = String(req.body?.platformId ?? "");
  const content = String(req.body?.content ?? "").trim().slice(0, 560);
  const contentHash = String(req.body?.contentHash ?? "");
  const txHash = String(req.body?.txHash ?? "");
  if (!platformId || !content || !contentHash) return res.status(400).json({ error: "missing_fields" });

  const profile = s.profiles[platformId] ?? { username: "", handle: handleOf(platformId) };
  const curation = await curate(platformId, profile.handle, content);
  const reply: Reply = {
    id: randomUUID(),
    parentId: req.params.id,
    platformId,
    handle: profile.handle,
    username: profile.username,
    content,
    contentHash,
    txHash,
    curation,
    ts: Date.now(),
  };
  if (curation.status === "escalated") {
    escalateToModeration({ id: reply.id, platformId, handle: reply.handle, content, reason: curation.reason ?? "" });
  }
  s.replies.push(reply);
  save(s);
  console.log(`[reply] id=${reply.id} parent=${reply.parentId} curation=${curation.status}`);
  res.json(reply);
});

// Respuestas de un hilo (orden cronológico ascendente, como X). Oculta las escaladas.
app.get("/posts/:id/replies", (req, res) => {
  const s = load();
  res.json(
    s.replies
      .filter((r) => r.parentId === req.params.id && r.curation?.status !== "escalated")
      .sort((a, b) => a.ts - b.ts),
  );
});

// ─── Artículos (long-form) ─────────────────────────────────────────────────────
// Misma transacción on-chain que un tweet (opinion_board), pero el contentHash cubre todo
// el artículo (título+banner+cuerpo). Off-chain guardamos el contenido; on-chain solo el ancla.
app.post("/articles", (req, res) => {
  const platformId = String(req.body?.platformId ?? "");
  const title = String(req.body?.title ?? "").trim().slice(0, 200);
  const banner = String(req.body?.banner ?? "");
  const content = String(req.body?.content ?? "");
  const contentHash = String(req.body?.contentHash ?? "");
  const txHash = String(req.body?.txHash ?? "");
  if (!platformId || !title || !content || !contentHash) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const s = load();
  const profile = s.profiles[platformId] ?? { username: "", handle: handleOf(platformId) };
  const item: ArticleItem = {
    id: randomUUID(),
    platformId,
    handle: profile.handle,
    username: profile.username,
    title,
    banner,
    content,
    contentHash,
    txHash,
    ts: Date.now(),
  };
  s.articles.push(item);
  save(s);
  console.log(`[article] id=${item.id} title="${title.slice(0, 40)}"`);
  res.json(item);
});

// Lista liviana (sin el cuerpo markdown completo).
app.get("/articles", (_req, res) => {
  const s = load();
  res.json(
    [...s.articles].reverse().map((a) => ({
      id: a.id,
      platformId: a.platformId,
      handle: a.handle,
      username: a.username,
      title: a.title,
      banner: a.banner,
      excerpt: a.content.replace(/[#>*_`!\[\]()-]/g, "").trim().slice(0, 160),
      txHash: a.txHash,
      ts: a.ts,
    })),
  );
});

app.get("/articles/:id", (req, res) => {
  const a = load().articles.find((x) => x.id === req.params.id);
  return a ? res.json(a) : res.status(404).json({ error: "not_found" });
});

app.post("/articles/:id/opinions", (req, res) => {
  const s = load();
  const article = s.articles.find((x) => x.id === req.params.id);
  if (!article) return res.status(404).json({ error: "not_found" });
  const platformId = String(req.body?.platformId ?? "");
  const content = String(req.body?.content ?? "").trim().slice(0, 560);
  const contentHash = String(req.body?.contentHash ?? "");
  const txHash = String(req.body?.txHash ?? "");
  if (!platformId || !content || !contentHash) return res.status(400).json({ error: "missing_fields" });
  const profile = s.profiles[platformId] ?? { username: "", handle: handleOf(platformId) };
  const op: ArticleOpinion = {
    id: randomUUID(),
    articleId: article.id,
    platformId,
    handle: profile.handle,
    content,
    contentHash,
    txHash,
    ts: Date.now(),
  };
  s.articleOpinions.push(op);
  save(s);
  res.json(op);
});

app.get("/articles/:id/opinions", (req, res) => {
  const s = load();
  res.json([...s.articleOpinions].filter((o) => o.articleId === req.params.id).reverse());
});

// Vista mínima de moderación: cola de casos escalados (contenido + seudónimo, nada más).
app.get("/moderation/queue", (_req, res) => {
  res.json(getModerationQueue());
});

// Resolución de un caso: el moderador lo aprueba o etiqueta; sale de la cola.
app.post("/moderation/resolve", (req, res) => {
  const id = String(req.body?.id ?? "");
  const status = String(req.body?.status ?? "approved");
  if (!id || (status !== "approved" && status !== "flagged")) {
    return res.status(400).json({ error: "invalid_request" });
  }
  const removed = resolveModeration(id);
  const s = load();
  const post = s.posts.find((p) => p.id === id);
  if (post) {
    post.curation = { status: status as CurationVerdict["status"], reason: "Resuelto por moderación humana." };
    save(s);
  }
  res.json({ ok: removed });
});

const port = Number(process.env.PLATFORM_API_PORT ?? 8788);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(port, () => console.log(`beHuman platform API en :${port}`));
}

export { app };
