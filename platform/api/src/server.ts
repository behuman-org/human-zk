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
interface Store {
  profiles: Record<string, Profile>;
  posts: PostItem[];
}

function load(): Store {
  if (!existsSync(STORE)) return { profiles: {}, posts: [] };
  return JSON.parse(readFileSync(STORE, "utf8")) as Store;
}
function save(s: Store): void {
  writeFileSync(STORE, JSON.stringify(s, null, 2));
}

/** Handle público: últimos 5 caracteres del platformId. */
const handleOf = (platformId: string) => platformId.slice(-5);

const app = express();
app.use(express.json({ limit: "256kb" }));
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

  // Nivel 1 — curaduría (solo contenido + seudónimo; nunca address). Fail-safe: si el
  // curador no está disponible, se escala a revisión humana (no se auto-aprueba).
  let curation: CurationVerdict;
  try {
    curation = await reviewPost({ platformId, handle: profile.handle, content });
  } catch (err) {
    console.error("[curation] no disponible:", (err as Error).message);
    curation = { status: "escalated", reason: "Curador no disponible; revisión humana." };
  }

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

// Feed público: muestra approved + flagged. Los escalated quedan pendientes (no se publican)
// hasta que un moderador los resuelva.
app.get("/feed", (_req, res) => {
  const s = load();
  res.json([...s.posts].reverse().filter((p) => p.curation?.status !== "escalated"));
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
