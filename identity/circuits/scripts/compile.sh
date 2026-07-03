#!/usr/bin/env bash
# Compila el circuito Circom -> r1cs / wasm / sym.
#
# ⚠️ Curva BLS12-381 (--prime bls12381): el verificador on-chain es el
# `groth16_verifier` oficial de soroban-examples, que usa las host functions
# BLS12-381 del host de Soroban (CAP-0059). NO usamos la curva por defecto (BN254).
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p build

echo "==> Compilando src/kyc.circom (prime bls12381)"
circom src/kyc.circom \
  --r1cs --wasm --sym \
  --prime bls12381 \
  -o build \
  -l node_modules

echo "==> Info del circuito"
snarkjs r1cs info build/kyc.r1cs

# Helpers OFF-CHAIN (Poseidon) que usa el SDK para calcular hashes idénticos al circuito
# (mismo --prime). No se usan on-chain.
for h in poseidon1 poseidon2 poseidon3; do
  echo "==> Compilando helper $h.circom (off-chain)"
  circom "src/$h.circom" --wasm --prime bls12381 -o build -l node_modules
done

echo "OK: artefactos en build/ (kyc + poseidon2/3 helpers)"
