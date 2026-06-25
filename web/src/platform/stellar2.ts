// Config de la plataforma (CAPA 2). Reusa el rpc/red de Capa 1.
export { rpc, NETWORK_PASSPHRASE } from "../kyc/stellar";

export const OPINION_BOARD_CONTRACT_ID =
  import.meta.env.VITE_OPINION_BOARD_CONTRACT_ID ?? "";
