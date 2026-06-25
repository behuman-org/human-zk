// @behuman/shared — Tipos compartidos entre web, api, sdk y curation (STUB).
// Fuente de verdad del diseño: la vault de Obsidian.

// ─── CAPA 1 · Identidad ───────────────────────────────────────────────────

/** Dirección Stellar de un usuario verificado (seudónimo estable, sin PII). */
export type VerifiedAddress = string;

export interface VerificationStatus {
  address: VerifiedAddress;
  isVerified: boolean;
}

// --- Gate de verificación (matcher DNI + selfie) ---

/**
 * Resultado del gate biométrico. NUNCA incluye imágenes ni embeddings:
 * solo OK/score/razones (ver Spec — Matcher DNI + Selfie, §4).
 */
export interface MatchResult {
  ok: boolean; // match ∧ liveness
  matchScore: number; // confianza 0..1 derivada de la distancia (1 = idéntico). PII-free
  matchDistance: number; // distancia euclidiana de face-api (menor = más parecido)
  livenessOk: boolean;
  reasons: string[]; // motivos de rechazo si ok=false
}

/** Provider de identidad intercambiable (testnet hoy; RENAPER/SID en prod; dev = solo test). */
export type IdentityProviderKind = "testnet" | "renaper" | "dev";

/**
 * Atributos atestados a partir del documento. Off-chain y efímeros: se usan para
 * el commitment y los predicados, y se descartan tras verificar. En testnet el
 * usuario los declara (documentado); en producción los atesta RENAPER/OCR.
 */
export interface IdentityAttributes {
  birthYear: number;
  countryCode: number; // ISO 3166-1 numérico (coincide con el circuito: AR=32…)
}

/**
 * Consentimiento informado (Ley 25.326): debe constar antes de capturar PII.
 */
export interface Consent {
  accepted: boolean;
  acceptedAt: number; // epoch ms
  policyVersion: string;
}

/**
 * Identidad de Capa 1 que queda en el device del usuario (modelo no-custodial:
 * el `secret` lo genera y guarda el usuario; el issuer nunca lo ve).
 * Alimenta el circuito ZK (`identity/circuits/src/kyc.circom`).
 */
export interface Capa1Credential {
  attributes: IdentityAttributes;
  secret: string; // elemento de campo (decimal), generado en el device
  commitment: string; // Poseidon(birthYear, countryCode, secret)
  issuerRoot: string; // raíz Merkle del árbol de humanos verificados
  pathElements: string[]; // hermanos del camino Merkle
  pathIndices: number[]; // 0/1 por nivel
}

/** Lo que el issuer devuelve al enrolar (no devuelve el secret: es del usuario). */
export interface EnrollmentResult {
  ok: boolean;
  reasons: string[];
  issuerRoot?: string;
  pathElements?: string[];
  pathIndices?: number[];
}

// ─── CAPA 2 · Plataforma de opinión ───────────────────────────────────────

export type PostKind = "opinion" | "article" | "study";

/** Input para crear un post (lo que manda el cliente). */
export interface NewPost {
  author: VerifiedAddress;
  kind: PostKind;
  title?: string;
  body: string; // contenido off-chain
}

/** Post ya publicado (contenido off-chain + ancla on-chain). */
export interface Post extends NewPost {
  id: string;
  contentHash: string; // anclado en el contrato opinion_board
  createdAt: number;
  curation: CurationVerdict;
}

// ─── Curaduría ────────────────────────────────────────────────────────────

export type CurationStatus =
  | "approved" // el agente lo aprobó
  | "flagged" // etiquetado (con motivo)
  | "escalated"; // derivado a moderación humana

export interface CurationVerdict {
  status: CurationStatus;
  reason?: string;
}

/**
 * Entrada del curador. SOLO contenido + seudónimo (platformId / handle anónimo).
 * NUNCA address del KYC ni PII — la moderación no puede deanonimizar.
 */
export interface CurationInput {
  platformId: string; // seudónimo anónimo (no es PII ni address)
  handle: string; // últimos 5 del platformId
  content: string; // texto del post a revisar
}
