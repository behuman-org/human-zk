// Nivel 2 — cola de moderación humana. Store local (JSON, gitignored).
// ⚠️ Guarda SOLO contenido + seudónimo (platformId/handle) + motivo. NUNCA address ni PII.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const STORE = process.env.MODERATION_QUEUE ?? resolve(here, "..", ".moderation-queue.json");

export interface ModerationItem {
  id: string;
  platformId: string;
  handle: string;
  content: string;
  reason: string;
  ts: number;
}

function load(): ModerationItem[] {
  if (!existsSync(STORE)) return [];
  return JSON.parse(readFileSync(STORE, "utf8")) as ModerationItem[];
}
function save(items: ModerationItem[]): void {
  writeFileSync(STORE, JSON.stringify(items, null, 2));
}

/** Encola un caso para moderadores humanos (idempotente por id). */
export function escalateToModeration(item: Omit<ModerationItem, "ts">): void {
  const q = load();
  if (q.some((i) => i.id === item.id)) return;
  q.push({ ...item, ts: Date.now() });
  save(q);
}

export function getModerationQueue(): ModerationItem[] {
  return load();
}

/** Resuelve (saca de la cola) un caso por id. Devuelve true si existía. */
export function resolveModeration(id: string): boolean {
  const q = load();
  const next = q.filter((i) => i.id !== id);
  if (next.length === q.length) return false;
  save(next);
  return true;
}
