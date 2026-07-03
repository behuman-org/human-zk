// SECURITY: Firma de transacciones Soroban vía wallet custodial de Pollar (signTx server-side).
// Pollar expone signTx → signedXdr; chain.ts envía la tx como en el flujo wallet normal.
import type { TransactionSigner } from "./chain";

type PollarSignOutcome =
  | { status: "signed"; signedXdr: string }
  | { status: "error"; details?: string };

export function createPollarSigner(
  signTx: (unsignedXdr: string) => Promise<PollarSignOutcome>,
): TransactionSigner {
  return async (unsignedXdr) => {
    const outcome = await signTx(unsignedXdr);
    if (outcome.status === "signed" && outcome.signedXdr) {
      return outcome.signedXdr;
    }
    const err =
      outcome.status === "error"
        ? outcome.details ?? "Pollar no pudo firmar la transacción"
        : "Pollar no pudo firmar la transacción";
    throw new Error(err);
  };
}
