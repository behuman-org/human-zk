// beHuman — Issuer KYC (Capa 1).
//
// Crea la identidad de Capa 1 SOLO si el gate (matcher DNI+selfie) da ok. Modelo
// no-custodial: el `secret` lo genera el device del usuario; el issuer solo recibe el
// `commitment`, lo agrega al árbol Merkle de humanos verificados y devuelve el camino.
//
// Anti-Sybil (en origen): de-dup por sha256(docId + pepper). Se guarda SOLO ese hash,
// NUNCA el número de documento ni PII. Las imágenes se procesan en memoria y se descartan.
// 📐 Ver `Flujo de KYC` (Fase 1), `Modelo de Datos`, `Puente-KYC-a-ZK`, `Cumplimiento-Argentina`.
import { buildTree, merkleProof, MERKLE_DEPTH } from "@behuman/sdk";
import type { EnrollmentResult } from "@behuman/shared";
import { getProvider, type GateInput } from "../matcher/provider.js";
import { docHash, loadIssuerState, withIssuerStore } from "./store.js";

export interface EnrollInput extends GateInput {
  commitment: string; // Poseidon(birthYear, countryCode, secret), generado en el device
  docId: string; // identificador del documento (para de-dup; nunca se persiste en claro)
}

/**
 * Gate + emisión de identidad de Capa 1.
 * 1. Corre el gate (match 1:1 + liveness). Si falla -> rechazo (no se crea identidad).
 * 2. De-dup anti-Sybil por hash del documento.
 * 3. Agrega el commitment al árbol y devuelve issuerRoot + camino Merkle.
 * 4. Descarta la PII (las imágenes nunca se persisten).
 *
 * SECURITY: el issuer NO puede verificar server-side que `commitment` =
 * Poseidon(birthYear, countryCode, secret) porque `secret` es privado del cliente
 * (modelo no-custodial). Confiamos en (a) el gate biométrico, (b) la sesión de enroll
 * atada a /verify-data previo, y (c) que el cliente computó el commitment correctamente.
 * Un atacante que eluda el gate podría registrar un commitment arbitrario — limitación
 * inherente del mock; en prod el issuer custodial firmaría atributos verificados.
 */
export async function enrollVerifiedHuman(input: EnrollInput): Promise<EnrollmentResult> {
  const gate = await getProvider().verifyIdentity({
    document: input.document,
    selfieFrames: input.selfieFrames,
  });
  if (!gate.ok) return { ok: false, reasons: gate.reasons };

  return withIssuerStore(async (state) => {
    const dh = docHash(input.docId);
    if (state.docHashes.includes(dh)) {
      return { ok: false, reasons: ["already_enrolled"] };
    }

    const maxLeaves = 1 << MERKLE_DEPTH;
    if (state.commitments.length >= maxLeaves) {
      return { ok: false, reasons: ["registry_full"] };
    }

    const index = state.commitments.length;
    state.commitments.push(input.commitment);
    state.docHashes.push(dh);

    const tree = await buildTree(state.commitments.map((c) => BigInt(c)));
    const path = merkleProof(tree, index);

    return {
      ok: true,
      reasons: [],
      issuerRoot: tree.root.toString(),
      pathElements: path.pathElements.map((e) => e.toString()),
      pathIndices: path.pathIndices,
    };
  });
}

/** Root actual del árbol del issuer (para inicializar el contrato). */
export async function currentIssuerRoot(): Promise<string> {
  const state = loadIssuerState();
  const leaves = state.commitments.length ? state.commitments.map((c) => BigInt(c)) : [0n];
  const tree = await buildTree(leaves);
  return tree.root.toString();
}

export { hydrateIssuerState, docHash, resetDocEnrollment, resetIssuerStateAll } from "./store.js";
export { getDedupPepper } from "./pepper.js";
