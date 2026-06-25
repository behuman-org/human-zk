#!/usr/bin/env bash
# Copia los artefactos del circuito (wasm + zkey + vk) a web/public/circuits para que
# el navegador genere la prueba. Requiere haber corrido antes:
#   (cd identity/circuits && bash scripts/compile.sh && POWER=13 bash scripts/setup.sh)
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$WEB/../identity/circuits/build"
DST="$WEB/public/circuits"
mkdir -p "$DST"

if [ ! -f "$SRC/kyc_final.zkey" ]; then
  echo "⚠️  Faltan artefactos del circuito en $SRC."
  echo "    Corré: (cd identity/circuits && bash scripts/compile.sh && POWER=13 bash scripts/setup.sh)"
  exit 0
fi

cp "$SRC/kyc_js/kyc.wasm" "$DST/kyc.wasm"
cp "$SRC/kyc_final.zkey" "$DST/kyc_final.zkey"
cp "$SRC/verification_key.json" "$DST/verification_key.json"
echo "OK: artefactos Capa 1 en $DST"

# CAPA 2: circuito de plataforma.
PSRC="$WEB/../platform/circuits/build"
PDST="$WEB/public/circuits-platform"
mkdir -p "$PDST"
if [ -f "$PSRC/post_final.zkey" ]; then
  cp "$PSRC/post_js/post.wasm" "$PDST/post.wasm"
  cp "$PSRC/post_final.zkey" "$PDST/post_final.zkey"
  cp "$PSRC/verification_key.json" "$PDST/verification_key.json"
  echo "OK: artefactos Capa 2 en $PDST"
else
  echo "⚠️  Faltan artefactos de plataforma en $PSRC (corré platform/circuits compile+setup)."
fi
