#!/usr/bin/env bash
# Despliega el contrato opinion_board (CAPA 2) a testnet. Imprime el contract id.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -f "$ROOT/.env" ] && set -a && . "$ROOT/.env" && set +a || true
ACCOUNT="${STELLAR_DEPLOY_IDENTITY:-behuman-deployer}"
NETWORK="${STELLAR_NETWORK:-testnet}"

if ! stellar keys address "$ACCOUNT" >/dev/null 2>&1; then
  stellar keys generate "$ACCOUNT" --network "$NETWORK" --fund
else
  stellar keys fund "$ACCOUNT" --network "$NETWORK" >/dev/null 2>&1 || true
fi

echo "==> Compilando contratos"
stellar contract build >/dev/null
CID="$(stellar contract deploy --wasm target/wasm32v1-none/release/opinion_board.wasm --source "$ACCOUNT" --network "$NETWORK")"
mkdir -p "$ROOT/.deploy"
echo "$CID" > "$ROOT/.deploy/opinion_board.id"
stellar keys show "$ACCOUNT" > "$ROOT/.deploy/deployer.secret" 2>/dev/null || true
echo ""
echo "OPINION_BOARD_CONTRACT_ID=$CID"
