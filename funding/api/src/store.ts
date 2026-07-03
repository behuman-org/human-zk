// Store local del funding (JSON, gitignored). ⚠️ Cero PII: solo campañas, donaciones por
// wallet efímera (seudónimo), y opiniones por platformId. Nada atable al KYC.
//
// RT-06: las escrituras se SERIALIZAN con una cola async (mutex). Toda mutación pasa por
// `withStore(fn)`, que ejecuta `fn` con exclusión mutua sobre {load→mutar→save}. Esto evita
// el TOCTOU (load → await → save) que permitía doble conteo de nullifier o lost-update de
// donaciones bajo concurrencia. El registro del nullifier es atómico dentro de la sección
// crítica (insert-if-absent), no read-then-write.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Campaign, CampaignOpinion, Donation } from "@behuman/shared";

const here = dirname(fileURLToPath(import.meta.url));
const STORE = process.env.FUNDING_STORE ?? resolve(here, "..", ".funding-store.json");

export interface FundingState {
  campaigns: Campaign[];
  donations: Donation[];
  opinions: CampaignOpinion[];
  nullifiers: Record<string, boolean>; // "campaignId:nullifier" -> usado (anti-Sybil opinión)
}

const EMPTY: FundingState = { campaigns: [], donations: [], opinions: [], nullifiers: {} };

// --- Persistencia durable (Upstash Redis) con fallback a archivo local ---
// El disco de Render free es efímero → las campañas se perderían al reiniciar. Con credenciales
// de Upstash el store vive ahí; si no, cae al archivo (dev). Solo datos seudónimos, sin PII.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_UPSTASH = !!(UPSTASH_URL && UPSTASH_TOKEN);
const STORE_KEY = "behuman:funding:store";

async function upstashCmd(cmd: unknown[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash HTTP ${res.status}`);
  return (await res.json() as { result: unknown }).result;
}

// Store en memoria (instancia única en free). Se hidrata al arrancar; write-through en save.
let state: FundingState = structuredClone(EMPTY);

export async function hydrate(): Promise<void> {
  if (USE_UPSTASH) {
    try {
      const raw = await upstashCmd(["GET", STORE_KEY]);
      if (typeof raw === "string" && raw) state = { ...structuredClone(EMPTY), ...(JSON.parse(raw) as Partial<FundingState>) };
      console.log(`[funding-store] hidratado desde Upstash (campaigns=${state.campaigns.length})`);
      return;
    } catch (e) {
      console.error("[funding-store] hydrate Upstash falló, uso archivo:", (e as Error).message);
    }
  }
  if (existsSync(STORE)) state = { ...structuredClone(EMPTY), ...(JSON.parse(readFileSync(STORE, "utf8")) as Partial<FundingState>) };
}

export function load(): FundingState {
  return state;
}
export async function save(s: FundingState): Promise<void> {
  state = s;
  if (USE_UPSTASH) {
    try {
      await upstashCmd(["SET", STORE_KEY, JSON.stringify(s)]);
    } catch (e) {
      console.error("[funding-store] persist Upstash falló:", (e as Error).message);
      throw e;
    }
  } else {
    try {
      writeFileSync(STORE, JSON.stringify(s, null, 2));
    } catch (e) {
      console.error("[funding-store] persist archivo falló:", (e as Error).message);
      throw e;
    }
  }
}

// ─── Serialización de escrituras (RT-06) ──────────────────────────────────────
// Cola async: cada `withStore` se encadena al anterior, garantizando que el bloque
// {load → mutar → save} corra sin intercalarse con otra mutación (aunque haya `await`s).
let chain: Promise<unknown> = Promise.resolve();

/**
 * Ejecuta `fn` con exclusión mutua sobre el store. `fn` recibe el estado fresco (load),
 * lo muta, y debe devolver el resultado a responder; el guardado (save) ocurre
 * automáticamente al terminar `fn` sin error. Si `fn` lanza, NO se guarda.
 */
export function withStore<T>(fn: (s: FundingState) => Promise<T> | T): Promise<T> {
  const run = chain.then(async () => {
    const s = load();
    const out = await fn(s);
    await save(s);
    return out;
  });
  // La cola no debe romperse si un `fn` lanza: encadenamos un catch silencioso.
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Registra un nullifier de forma ATÓMICA dentro de una sección crítica ya activa.
 * Devuelve `false` si ya existía (reuso), `true` si lo insertó por primera vez.
 * DEBE llamarse dentro de un `withStore` (opera sobre el estado bajo el lock).
 */
export function claimNullifier(s: FundingState, key: string): boolean {
  if (s.nullifiers[key]) return false;
  s.nullifiers[key] = true;
  return true;
}
