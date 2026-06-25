#!/usr/bin/env bash
# Compila el circuito de plataforma (post.circom) -> r1cs / wasm / sym.
# ⚠️ Curva BLS12-381 (igual que Capa 1): el verificador on-chain usa host functions BLS12-381.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
echo "==> Compilando src/post.circom (prime bls12381)"
circom src/post.circom --r1cs --wasm --sym --prime bls12381 -o build -l node_modules
snarkjs r1cs info build/post.r1cs
echo "OK: artefactos en build/ (post.r1cs, post_js/post.wasm, post.sym)"
