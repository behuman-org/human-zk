// Persistencia del estado del issuer (commitments + docHashes para de-dup).
// Sin PII: solo hashes y commitments públicos.
//
// ⚠️ RIESGO: en PaaS con disco efímero (HF Spaces, Render free) el archivo local se pierde
// al reiniciar → el de-dup y el árbol Merkle se resetean. Mitigación: Upstash Redis opcional
// (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN), mismo patrón que platform/funding API.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDedupPepper } from "./pepper.js";

const here = dirname(fileURLToPath(import.meta.url));
export const STORE_PATH = process.env.ISSUER_STATE ?? resolve(here, "..", ".issuer-state.json");

export interface IssuerState {
  commitments: string[];
  docHashes: string[];
}

const EMPTY: IssuerState = { commitments: [], docHashes: [] };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_UPSTASH = !!(UPSTASH_URL && UPSTASH_TOKEN);
const STORE_KEY = "behuman:issuer:state";

async function upstashCmd(cmd: unknown[]): Promise<unknown> {
  const res = await fetch(UPSTASH_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`upstash HTTP ${res.status}`);
  return (await res.json() as { result: unknown }).result;
}

let state: IssuerState = structuredClone(EMPTY);
let hydrated = false;

/** Hash determinístico del documento para de-dup. No se persiste el documento en claro. */
export function docHash(docId: string): string {
  return createHash("sha256")
    .update(docId.trim().toLowerCase() + getDedupPepper())
    .digest("hex");
}

function readLocalFile(): IssuerState {
  if (!existsSync(STORE_PATH)) return structuredClone(EMPTY);
  return { ...structuredClone(EMPTY), ...(JSON.parse(readFileSync(STORE_PATH, "utf8")) as Partial<IssuerState>) };
}

/** Escritura atómica: tmp + rename evita corrupción si el proceso muere a mitad de write. */
function writeLocalFile(s: IssuerState): void {
  const tmp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(s, null, 2));
  renameSync(tmp, STORE_PATH);
}

/** Hidrata desde Upstash (si hay credenciales) o archivo local. Llamar al arrancar el server. */
export async function hydrateIssuerState(): Promise<void> {
  if (hydrated) return;

  if (USE_UPSTASH) {
    try {
      const raw = await upstashCmd(["GET", STORE_KEY]);
      if (typeof raw === "string" && raw) {
        state = { ...structuredClone(EMPTY), ...(JSON.parse(raw) as Partial<IssuerState>) };
        console.log(`[issuer-store] hidratado desde Upstash (commitments=${state.commitments.length})`);
        hydrated = true;
        return;
      }
    } catch (e) {
      console.error("[issuer-store] hydrate Upstash falló, uso archivo:", (e as Error).message);
    }
  }

  state = readLocalFile();
  if (!USE_UPSTASH) {
    console.warn(
      "[issuer-store] persistencia local solamente — el de-dup se resetea si el disco es efímero " +
        "(HF Spaces / Render free). Configurá UPSTASH_REDIS_REST_URL/TOKEN para persistencia durable.",
    );
  }
  hydrated = true;
}

export function loadIssuerState(): IssuerState {
  return state;
}

function persist(s: IssuerState): void {
  state = s;
  if (USE_UPSTASH) {
    void upstashCmd(["SET", STORE_KEY, JSON.stringify(s)]).catch((e) =>
      console.error("[issuer-store] persist Upstash falló:", (e as Error).message),
    );
  }
  try {
    writeLocalFile(s);
  } catch (e) {
    console.error("[issuer-store] persist archivo falló:", (e as Error).message);
  }
}

// Cola async: mutaciones serializadas (evita lost-update bajo concurrencia en /enroll).
let chain: Promise<unknown> = Promise.resolve();

/** Ejecuta `fn` con exclusión mutua sobre el store del issuer. */
export function withIssuerStore<T>(fn: (s: IssuerState) => Promise<T> | T): Promise<T> {
  const run = chain.then(async () => {
    const s = loadIssuerState();
    const out = await fn(s);
    persist(s);
    return out;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Solo dev/local: quita un documento del de-dup para reintentar enroll tras fallo on-chain. */
export function resetDocEnrollment(docId: string): boolean {
  const dh = docHash(docId);
  const s = loadIssuerState();
  const idx = s.docHashes.indexOf(dh);
  if (idx === -1) return false;
  s.docHashes.splice(idx, 1);
  if (idx < s.commitments.length) s.commitments.splice(idx, 1);
  persist(s);
  return true;
}

/** Solo dev/local: vacía todo el árbol Merkle y de-dup. */
export function resetIssuerStateAll(): void {
  persist(structuredClone(EMPTY));
}

/** Solo para tests: resetea el store en memoria sin tocar disco remoto. */
export function resetIssuerStateForTests(s: IssuerState = structuredClone(EMPTY)): void {
  state = s;
  hydrated = true;
}
