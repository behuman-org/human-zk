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
import { strToField, verifyFundingOpinionProof } from "@behuman/sdk";
import {
  authPlatformId,
  issueSessionToken,
  requireAuth,
  verifyMembershipProof,
  type MembershipProof,
} from "./auth.js";
import {
  articleCanonical,
  assertContentHash,
  replyCanonical,
} from "./contentHash.js";
import { isModeratorRequest, requireModerationAuth } from "./moderationAuth.js";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(here, "..", "..", "..", ".env") });
const STORE = process.env.PLATFORM_STORE ?? resolve(here, "..", ".platform-store.json");

// VK del circuito que reusa el "Resuena" (funding_opinion: scope + nullifier por post).
const RESONATE_VK = resolve(here, "..", "..", "..", "funding", "circuits", "build", "verification_key.json");
// Prefijos de dominio del Resuena. DEBEN coincidir con web/src/identity/resonate.ts.
const RES_SCOPE_PREFIX = "resonate-id:";
const RES_NULLSCOPE_PREFIX = "resonate-null:";
const RES_CONTENT_PREFIX = "resonate-content:";
// Índices de public signals del circuito: [issuerRoot, platformId, nullifier, scope, nullScope, contentHash].
const RES_NULLIFIER = 2;
const RES_SCOPE = 3;
const RES_NULLSCOPE = 4;
const RES_CONTENT = 5;

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
  curation: CurationVerdict;
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
  curation: CurationVerdict;
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
  // "Resuena": por cada postId, el SET de nullifiers (1 humano = 1 resuena por post). Guardamos
  // SOLO el nullifier (no platformId ni identidad): cuenta pública, autor anónimo.
  resonates: Record<string, string[]>;
}

function emptyStore(): Store {
  return { profiles: {}, posts: [], articles: [], articleOpinions: [], replies: [], resonates: {} };
}

// --- Persistencia durable (Upstash Redis) con fallback a archivo local ---
// El disco de Render free es efímero → los posts se perdían al reiniciar. Si hay credenciales
// de Upstash, el store vive ahí (sobrevive reinicios); si no, cae al archivo (dev local).
// Solo guarda datos seudónimos (platformId + contenido + hashes), nunca PII ni el ZK secret.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_UPSTASH = !!(UPSTASH_URL && UPSTASH_TOKEN);
const STORE_KEY = "behuman:platform:store";

async function upstashCmd(cmd: unknown[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash HTTP ${res.status}`);
  return (await res.json() as { result: unknown }).result;
}

// Store en memoria (instancia única en free). Se hidrata al arrancar y se escribe write-through.
let store: Store = emptyStore();

async function hydrate(): Promise<void> {
  if (USE_UPSTASH) {
    try {
      const raw = await upstashCmd(["GET", STORE_KEY]);
      if (typeof raw === "string" && raw) store = { ...emptyStore(), ...(JSON.parse(raw) as Partial<Store>) };
      console.log(`[store] hidratado desde Upstash (posts=${store.posts.length}, replies=${store.replies.length})`);
      return;
    } catch (e) {
      console.error("[store] hydrate Upstash falló, uso archivo:", (e as Error).message);
    }
  }
  if (existsSync(STORE)) store = { ...emptyStore(), ...(JSON.parse(readFileSync(STORE, "utf8")) as Partial<Store>) };
}

function load(): Store {
  return store;
}
function save(s: Store): void {
  store = s;
  if (USE_UPSTASH) {
    // write-through (no bloqueamos la respuesta; logueamos si falla).
    void upstashCmd(["SET", STORE_KEY, JSON.stringify(s)]).catch((e) =>
      console.error("[store] persist Upstash falló:", (e as Error).message),
    );
  } else {
    try {
      writeFileSync(STORE, JSON.stringify(s, null, 2));
    } catch {
      /* dev sin permisos de escritura: ignorar */
    }
  }
}

/** Handle público: últimos 5 caracteres del platformId. */
const handleOf = (platformId: string) => platformId.slice(-5);

/** Curaduría Nivel 1 (solo contenido + seudónimo; nunca address). Compartida por posts, replies y artículos.
 * Fail-safe: sin GROQ_API_KEY o si el curador falla → escalated (no publicar sin filtro). */
async function curate(platformId: string, handle: string, content: string): Promise<CurationVerdict> {
  if (!process.env.GROQ_API_KEY) {
    return { status: "escalated", reason: "Curaduría no configurada; revisión humana." };
  }
  try {
    return await reviewPost({ platformId, handle, content });
  } catch (err) {
    console.error("[curation] no disponible:", (err as Error).message);
    return { status: "escalated", reason: "Curador no disponible; revisión humana." };
  }
}

/** Texto curado para artículos: título + cuerpo (banner es metadata visual, no evaluable como texto). */
function articleCurationText(title: string, content: string): string {
  return `${title}\n\n${content}`.slice(0, 8000);
}

const app = express();
// Límite alto: los artículos pueden traer banner + imágenes embebidas (data URLs).
app.use(express.json({ limit: "12mb" }));
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN ?? "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Moderation-Secret");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// SECURITY: Emite sesión HMAC tras verificar prueba Groth16 de membership (platformId de la prueba).
app.post("/auth", async (req, res) => {
  const platformId = await verifyMembershipProof(req.body?.membershipProof as MembershipProof | undefined);
  if (!platformId) return res.status(403).json({ error: "invalid_membership_proof" });
  const { token, expiresAt } = issueSessionToken(platformId);
  res.json({ token, platformId, expiresAt });
});

// Perfil / username (libre, mutable, sin unicidad por ahora).
app.post("/profile", requireAuth, (req, res) => {
  const platformId = authPlatformId(req);
  const username = String(req.body?.username ?? "").trim().slice(0, 40);
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
app.post("/content", requireAuth, async (req, res) => {
  const platformId = authPlatformId(req);
  const content = String(req.body?.content ?? "").trim().slice(0, 560);
  const contentHash = String(req.body?.contentHash ?? "");
  const txHash = String(req.body?.txHash ?? "");
  if (!content || !contentHash) {
    return res.status(400).json({ error: "missing_fields" });
  }
  // SECURITY: recomputar hash canónico server-side; rechazar si no coincide con el recibido.
  if (!assertContentHash(content, contentHash)) {
    return res.status(400).json({ error: "content_hash_mismatch" });
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

// Cuenta pública de Resuena (nullifiers únicos) de un post.
const resonateCountOf = (s: Store, postId: string) => (s.resonates[postId] ?? []).length;

// Feed público: muestra approved + flagged. Los escalated quedan pendientes (no se publican)
// hasta que un moderador los resuelva. Incluye replyCount y la cuenta de Resuena por post.
app.get("/feed", (_req, res) => {
  const s = load();
  res.json(
    [...s.posts]
      .reverse()
      .filter((p) => p.curation?.status !== "escalated")
      .map((p) => ({ ...p, replyCount: replyCountOf(s, p.id), resonateCount: resonateCountOf(s, p.id) })),
  );
});

// Un post (o respuesta) por id — para la vista de hilo. Busca primero en posts y luego en
// replies (así una respuesta también tiene su propio hilo: anidado a futuro).
app.get("/posts/:id", (req, res) => {
  const s = load();
  const moderator = isModeratorRequest(req);
  const post = s.posts.find((p) => p.id === req.params.id);
  if (post) {
    if (post.curation?.status === "escalated" && !moderator) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ...post, replyCount: replyCountOf(s, post.id), resonateCount: resonateCountOf(s, post.id) });
  }
  const reply = s.replies.find((r) => r.id === req.params.id);
  if (reply) {
    if (reply.curation?.status === "escalated" && !moderator) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({
      ...reply,
      communityId: undefined,
      curation: reply.curation,
      replyCount: replyCountOf(s, reply.id),
      resonateCount: resonateCountOf(s, reply.id),
    });
  }
  return res.status(404).json({ error: "not_found" });
});

// Responder un tweet: mismo flujo que un post (curaduría Nivel 1 + ancla on-chain en el cliente),
// pero con parentId. El contentHash on-chain incluye el parentId (la prueba ata la respuesta a
// su hilo). Sin nullifier: se puede responder varias veces con contenido distinto.
app.post("/posts/:id/replies", requireAuth, async (req, res) => {
  const s = load();
  const parent = s.posts.find((p) => p.id === req.params.id) ?? s.replies.find((r) => r.id === req.params.id);
  if (!parent) return res.status(404).json({ error: "parent_not_found" });
  const platformId = authPlatformId(req);
  const content = String(req.body?.content ?? "").trim().slice(0, 560);
  const contentHash = String(req.body?.contentHash ?? "");
  const txHash = String(req.body?.txHash ?? "");
  if (!content || !contentHash) return res.status(400).json({ error: "missing_fields" });
  const canonical = replyCanonical(req.params.id, content);
  if (!assertContentHash(canonical, contentHash)) {
    return res.status(400).json({ error: "content_hash_mismatch" });
  }

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

// ─── "Resuena" (reacción anónima por nullifier) ───────────────────────────────
// Verifica la prueba ZK (personhood + nullifier scopeado al post), la ata a ESTE post, y
// guarda SOLO el nullifier. 1 humano = 1 resuena por post (anti-Sybil). Cero identidad.
interface ResonateBody {
  proof?: unknown;
  publicSignals?: string[];
}

let resonateVk: unknown | null = null;
function loadResonateVk(): unknown | null {
  if (resonateVk) return resonateVk;
  if (!existsSync(RESONATE_VK)) return null;
  resonateVk = JSON.parse(readFileSync(RESONATE_VK, "utf8"));
  return resonateVk;
}

/** Verifica la prueba + binding al post; devuelve el nullifier de confianza, o null si inválida. */
async function verifyResonate(postId: string, body: ResonateBody): Promise<string | null> {
  const ps = body.publicSignals;
  if (!body.proof || !Array.isArray(ps) || ps.length !== 6) return null;
  // Binding: scope/nullScope/contentHash de la prueba deben derivar de ESTE post.
  if (ps[RES_SCOPE] !== strToField(RES_SCOPE_PREFIX + postId)) return null;
  if (ps[RES_NULLSCOPE] !== strToField(RES_NULLSCOPE_PREFIX + postId)) return null;
  if (ps[RES_CONTENT] !== strToField(RES_CONTENT_PREFIX + postId)) return null;
  const vk = loadResonateVk();
  if (!vk) return null;
  const ok = await verifyFundingOpinionProof({ proof: body.proof, publicSignals: ps } as never, vk);
  return ok ? ps[RES_NULLIFIER] : null;
}

app.post("/posts/:id/resonate", async (req, res) => {
  const postId = req.params.id;
  const nullifier = await verifyResonate(postId, req.body ?? {});
  if (!nullifier) return res.status(403).json({ error: "invalid_proof" });
  const s = load();
  const set = new Set(s.resonates[postId] ?? []);
  set.add(nullifier); // idempotente: el mismo humano no suma dos veces
  s.resonates[postId] = [...set];
  save(s);
  res.json({ count: set.size });
});

app.post("/posts/:id/unresonate", async (req, res) => {
  const postId = req.params.id;
  const nullifier = await verifyResonate(postId, req.body ?? {});
  if (!nullifier) return res.status(403).json({ error: "invalid_proof" });
  const s = load();
  const set = new Set(s.resonates[postId] ?? []);
  set.delete(nullifier);
  s.resonates[postId] = [...set];
  save(s);
  res.json({ count: set.size });
});

// ─── Artículos (long-form) ─────────────────────────────────────────────────────
// Misma transacción on-chain que un tweet (opinion_board), pero el contentHash cubre todo
// el artículo (título+banner+cuerpo). Off-chain guardamos el contenido; on-chain solo el ancla.
app.post("/articles", requireAuth, async (req, res) => {
  const platformId = authPlatformId(req);
  const title = String(req.body?.title ?? "").trim().slice(0, 200);
  const banner = String(req.body?.banner ?? "");
  const content = String(req.body?.content ?? "");
  const contentHash = String(req.body?.contentHash ?? "");
  const txHash = String(req.body?.txHash ?? "");
  if (!title || !content || !contentHash) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const canonical = articleCanonical(title, banner, content);
  if (!assertContentHash(canonical, contentHash)) {
    return res.status(400).json({ error: "content_hash_mismatch" });
  }
  const s = load();
  const profile = s.profiles[platformId] ?? { username: "", handle: handleOf(platformId) };
  const curation = await curate(platformId, profile.handle, articleCurationText(title, content));
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
    curation,
    ts: Date.now(),
  };
  if (curation.status === "escalated") {
    escalateToModeration({
      id: item.id,
      platformId,
      handle: item.handle,
      content: articleCurationText(title, content),
      reason: curation.reason ?? "",
    });
  }
  s.articles.push(item);
  save(s);
  console.log(`[article] id=${item.id} curation=${curation.status} title="${title.slice(0, 40)}"`);
  res.json(item);
});

// Lista liviana (sin el cuerpo markdown completo).
app.get("/articles", (_req, res) => {
  const s = load();
  res.json(
    [...s.articles]
      .reverse()
      .filter((a) => a.curation?.status !== "escalated")
      .map((a) => ({
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
  if (!a) return res.status(404).json({ error: "not_found" });
  if (a.curation?.status === "escalated" && !isModeratorRequest(req)) {
    return res.status(404).json({ error: "not_found" });
  }
  return res.json(a);
});

app.post("/articles/:id/opinions", requireAuth, async (req, res) => {
  const s = load();
  const article = s.articles.find((x) => x.id === req.params.id);
  if (!article) return res.status(404).json({ error: "not_found" });
  const platformId = authPlatformId(req);
  const content = String(req.body?.content ?? "").trim().slice(0, 560);
  const contentHash = String(req.body?.contentHash ?? "");
  const txHash = String(req.body?.txHash ?? "");
  if (!content || !contentHash) return res.status(400).json({ error: "missing_fields" });
  if (!assertContentHash(content, contentHash)) {
    return res.status(400).json({ error: "content_hash_mismatch" });
  }
  const profile = s.profiles[platformId] ?? { username: "", handle: handleOf(platformId) };
  const curation = await curate(platformId, profile.handle, content);
  const op: ArticleOpinion = {
    id: randomUUID(),
    articleId: article.id,
    platformId,
    handle: profile.handle,
    content,
    contentHash,
    txHash,
    curation,
    ts: Date.now(),
  };
  if (curation.status === "escalated") {
    escalateToModeration({
      id: op.id,
      platformId,
      handle: op.handle,
      content,
      reason: curation.reason ?? "",
    });
  }
  s.articleOpinions.push(op);
  save(s);
  console.log(`[article-opinion] id=${op.id} curation=${curation.status}`);
  res.json(op);
});

app.get("/articles/:id/opinions", (req, res) => {
  const s = load();
  res.json(
    [...s.articleOpinions]
      .filter((o) => o.articleId === req.params.id && o.curation?.status !== "escalated")
      .reverse(),
  );
});

// Vista mínima de moderación: cola de casos escalados (contenido + seudónimo, nada más).
app.get("/moderation/queue", requireModerationAuth, (_req, res) => {
  res.json(getModerationQueue());
});

// Resolución de un caso: el moderador lo aprueba o etiqueta; sale de la cola.
app.post("/moderation/resolve", requireModerationAuth, (req, res) => {
  const id = String(req.body?.id ?? "");
  const status = String(req.body?.status ?? "approved");
  if (!id || (status !== "approved" && status !== "flagged")) {
    return res.status(400).json({ error: "invalid_request" });
  }
  const removed = resolveModeration(id);
  const s = load();
  const verdict: CurationVerdict = { status: status as CurationVerdict["status"], reason: "Resuelto por moderación humana." };
  const post = s.posts.find((p) => p.id === id);
  const reply = s.replies.find((r) => r.id === id);
  const article = s.articles.find((a) => a.id === id);
  const opinion = s.articleOpinions.find((o) => o.id === id);
  if (post) post.curation = verdict;
  else if (reply) reply.curation = verdict;
  else if (article) article.curation = verdict;
  else if (opinion) opinion.curation = verdict;
  if (post || reply || article || opinion) save(s);
  res.json({ ok: removed });
});

// Render (y otros PaaS) asignan el puerto vía $PORT; en local usamos PLATFORM_API_PORT.
const port = Number(process.env.PORT ?? process.env.PLATFORM_API_PORT ?? 8788);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Hidratar el store (Upstash o archivo) ANTES de escuchar, así el feed arranca completo.
  void hydrate().then(() => {
    app.listen(port, () =>
      console.log(`beHuman platform API en :${port} (store: ${USE_UPSTASH ? "Upstash" : "archivo"})`),
    );
  });
}

export { app };
