/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MATCHER_URL?: string;
  readonly VITE_STELLAR_RPC_URL?: string;
  readonly VITE_STELLAR_NETWORK_PASSPHRASE?: string;
  readonly VITE_KYC_VERIFIER_CONTRACT_ID?: string;
  readonly VITE_OPINION_BOARD_CONTRACT_ID?: string;
  readonly VITE_PLATFORM_API_URL?: string;
  readonly VITE_FRIENDBOT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
