// @behuman/shared — Tipos compartidos entre web, api, sdk y curation (3 capas).
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

// ─── CAPA 3 · Funding ZK (DeFindex + Trustless Work) ──────────────────────────
//
// Crowdfunding anónimo y condicional. Donar/opinar se gatea por personhood (Capa 1) sin
// revelar identidad. On-chain solo: proofs, commitments, nullifiers, estados de escrow,
// anclas de opinión (platformId + contentHash). Activo configurable (XLM en testnet).

/** Activo de la campaña. XLM (nativo) en testnet; stablecoin/USDC en prod (por config). */
export type FundingAsset = "XLM" | "USDC";

export type MilestoneStatus = "pending" | "submitted" | "approved" | "rejected";

/** Hito/tarea de la causa (se refleja en el escrow de Trustless Work). */
export interface Milestone {
  id: string;
  title: string;
  description?: string;
  status: MilestoneStatus;
  evidenceUri?: string; // evidencia off-chain (sin PII)
}

/** Estado del escrow / liberación de una campaña. */
export type EscrowState =
  | "fundraising" // recaudando (dinero en el vault Blend)
  | "released" // liberado a la causa (capital + yield)
  | "refunding" // falló: donantes recuperan sus shares (todo-o-nada)
  | "disputed"; // en disputa (resuelve el neutral)

/** Campaña de funding. NUNCA contiene PII; las wallets son seudónimos no atables al KYC. */
export interface Campaign {
  id: string;
  title: string;
  summary: string; // descripción pública de la causa (sin PII)
  asset: FundingAsset;
  goalAmount: string; // meta (stroops/unidades del activo, decimal string)
  raisedAmount: string; // recaudado hasta ahora
  deadline: number; // epoch ms; éxito = meta antes del deadline
  causeWallet: string; // Receiver (wallet de la causa)
  vaultAddress?: string; // vault DeFindex (Blend) de la campaña
  controllerAddress?: string; // campaign_controller (Manager del vault)
  escrowId?: string; // escrow de Trustless Work
  // Validadores del release 2-de-3 (causa + plataforma + neutral). Direcciones, no PII.
  signers: { cause: string; platform: string; neutral: string };
  // ⚠️ SOLO DEV/DEMO: secrets de los firmantes para que el panel validador de la web pueda
  // FIRMAR el challenge de approve/release (RT-01). En prod los secrets NUNCA tocan la API:
  // los firmantes firman en sus propias wallets y el contrato on-chain exige require_auth.
  signerSecretsDev?: { cause: string; platform: string; neutral: string };
  milestones: Milestone[];
  state: EscrowState;
  createdAt: number;
  // Stats derivados (read-only, los agrega la API en GET): para la UX, no se persisten.
  donorCount?: number; // donantes únicos (wallets efímeras distintas)
  estApy?: number; // rendimiento estimado del vault (fracción, p.ej. 0.08 = 8%)
}

/** Aporte anónimo (desde wallet efímera). El monto es visible en el MVP. */
export interface Donation {
  campaignId: string;
  donorWallet: string; // wallet efímera/anónima (NO el address del KYC)
  amount: string;
  txHash: string;
  ts: number;
  // RT-09: marca idempotente de reembolso (no se borra la donación → auditabilidad).
  refunded?: boolean;
}

/** Posición del donante en el vault (shares = base del refund todo-o-nada). */
export interface VaultPosition {
  shares: string;
  underlying: string; // valor actual (capital + yield acumulado)
  apy: number;
}

export type Sentiment = "support" | "oppose" | "neutral";

/**
 * Opinión anónima sobre una campaña (Capa 2 scopeada por campaña).
 * platformId = Poseidon(secret, "funding:"+campaignId); 1 humano = 1 voz por campaña
 * (nullifier por campaña). Ancla on-chain (platformId + contentHash) + texto off-chain.
 */
export interface CampaignOpinion {
  id: string;
  campaignId: string;
  platformId: string; // seudónimo scopeado a la campaña (no atable al KYC)
  handle: string; // últimos 5 del platformId
  content: string; // texto off-chain
  contentHash: string;
  sentiment: Sentiment;
  txHash: string;
  curation: CurationVerdict;
  ts: number;
}
