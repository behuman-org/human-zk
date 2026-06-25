#!/usr/bin/env bash
# Genera una prueba de ejemplo a partir de input.json y la verifica con snarkjs.
set -euo pipefail
cd "$(dirname "$0")/.."
INPUT="${INPUT:-input.json}"
[ -f "$INPUT" ] || { echo "ERROR: falta $INPUT (node scripts/gen_input.mjs)"; exit 1; }
node build/post_js/generate_witness.js build/post_js/post.wasm "$INPUT" build/witness.wtns
snarkjs groth16 prove build/post_final.zkey build/witness.wtns build/proof.json build/public.json
snarkjs groth16 verify build/verification_key.json build/public.json build/proof.json
echo "==> public signals [issuerRoot, platformId, contentHash]:"
cat build/public.json
