// Wrapper de DeFindex (yield en Blend) — https://docs.defindex.io
//
// Provider configurable:
//  - "real": pega a la API de DeFindex (api.defindex.io) con API key. Patrón: la API arma
//    la tx (XDR), el donante firma con su wallet anónima, se envía a /send.
//  - "dev": mock determinístico para construir/testear el flujo sin depender de testnet.
//
// El wrapper es un ADAPTADOR sin estado de campaña; el bookkeeping de donaciones/shares lo
// lleva funding/api. ⚠️ Las shapes "real" siguen el patrón de la doc y deben verificarse
// contra docs.defindex.io al conectar las keys.
import type { VaultPosition } from "@behuman/shared";

export type FundingProviderKind = "real" | "dev";

export interface DefindexConfig {
  provider: FundingProviderKind;
  apiUrl: string;
  apiKey?: string;
}

export interface Defindex {
  readonly provider: FundingProviderKind;
  /** Arma la tx de depósito (XDR a firmar por la wallet anónima). */
  buildDeposit(vault: string, from: string, amount: string): Promise<{ xdr: string }>;
  /** Arma la tx de retiro de `shares` (refund / release). */
  buildWithdraw(vault: string, who: string, shares: string): Promise<{ xdr: string }>;
  /** Envía un XDR ya firmado. Devuelve el hash. */
  send(signedXdr: string): Promise<{ hash: string }>;
  /** Posición del titular en el vault (shares + valor subyacente + apy). */
  balance(vault: string, who: string): Promise<VaultPosition>;
  apy(vault: string): Promise<number>;
}

export function createDefindex(cfg: DefindexConfig): Defindex {
  return cfg.provider === "real" ? realDefindex(cfg) : devDefindex(cfg);
}

// ─── real ────────────────────────────────────────────────────────────────────
function realDefindex(cfg: DefindexConfig): Defindex {
  const base = cfg.apiUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

  async function post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`defindex ${path} -> HTTP ${res.status}`);
    return res.json();
  }
  async function get(path: string): Promise<any> {
    const res = await fetch(`${base}${path}`, { headers });
    if (!res.ok) throw new Error(`defindex ${path} -> HTTP ${res.status}`);
    return res.json();
  }

  return {
    provider: "real",
    async buildDeposit(vault, from, amount) {
      const r = await post(`/vault/${vault}/deposit`, { from, amount });
      return { xdr: r.xdr };
    },
    async buildWithdraw(vault, who, shares) {
      const r = await post(`/vault/${vault}/withdraw`, { from: who, shares });
      return { xdr: r.xdr };
    },
    async send(signedXdr) {
      const r = await post(`/send`, { xdr: signedXdr });
      return { hash: r.hash };
    },
    async balance(vault, who) {
      const r = await get(`/vault/${vault}/balance?from=${encodeURIComponent(who)}`);
      return { shares: String(r.shares ?? "0"), underlying: String(r.underlying ?? "0"), apy: Number(r.apy ?? 0) };
    },
    async apy(vault) {
      const r = await get(`/vault/${vault}/apy`);
      return Number(r.apy ?? 0);
    },
  };
}

// ─── dev (mock determinístico) ────────────────────────────────────────────────
// No pega a la red. Devuelve XDR/hashes simulados; el yield se modela con un APY fijo.
// El estado real de las posiciones lo lleva funding/api (este mock es sin estado).
const DEV_APY = 0.08; // 8% anual simulado

function devDefindex(_cfg: DefindexConfig): Defindex {
  const fakeXdr = (tag: string) => `DEV_XDR:${tag}:${Date.now().toString(36)}`;
  const fakeHash = () => "dev" + Math.random().toString(16).slice(2, 12);
  return {
    provider: "dev",
    async buildDeposit(vault, from, amount) {
      return { xdr: fakeXdr(`deposit:${vault}:${from}:${amount}`) };
    },
    async buildWithdraw(vault, who, shares) {
      return { xdr: fakeXdr(`withdraw:${vault}:${who}:${shares}`) };
    },
    async send() {
      return { hash: fakeHash() };
    },
    async balance(_vault, _who) {
      // sin estado: funding/api computa la posición real en dev. Devuelve apy de referencia.
      return { shares: "0", underlying: "0", apy: DEV_APY };
    },
    async apy() {
      return DEV_APY;
    },
  };
}

export { DEV_APY };
