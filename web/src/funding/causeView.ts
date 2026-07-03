// Helpers de presentación para las páginas de Causas (Capa 3). Sin lógica de negocio:
// solo derivan estado humano, progreso, días restantes y formato para la UX.
import type { Campaign } from "@behuman/shared";

export function humanState(
  c: Campaign,
  labels: {
    released: string;
    refunding: string;
    disputed: string;
    failed: string;
    reached: string;
    fundraising: string;
  },
): { cls: string; label: string } {
  const raised = Number(c.raisedAmount);
  const goal = Number(c.goalAmount);
  if (c.state === "released") return { cls: "released", label: labels.released };
  if (c.state === "refunding") return { cls: "refunding", label: labels.refunding };
  if (c.state === "disputed") return { cls: "disputed", label: labels.disputed };
  if (Date.now() > c.deadline && raised < goal) return { cls: "failed", label: labels.failed };
  if (raised >= goal) return { cls: "reached", label: labels.reached };
  return { cls: "fundraising", label: labels.fundraising };
}

/** % financiado (0–100, tope 100). */
export function fundedPct(c: Campaign): number {
  return Math.min(100, (Number(c.raisedAmount) / Math.max(1, Number(c.goalAmount))) * 100);
}

/** Días restantes hasta el cierre (0 si ya pasó). */
export function daysLeft(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / (24 * 3600 * 1000)));
}

export const fmtAmount = (n: string | number, locale = "en-US") =>
  Number(n).toLocaleString(locale === "es" ? "es-AR" : "en-US", { maximumFractionDigits: 2 });

export const fmtApy = (apy?: number) => (typeof apy === "number" ? `${(apy * 100).toFixed(1)}%` : "—");

export const isRealTx = (h?: string | null) => !!h && /^[0-9a-f]{64}$/i.test(h);
export const txUrl = (h: string) => `https://stellar.expert/explorer/testnet/tx/${h}`;
