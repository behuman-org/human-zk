#!/usr/bin/env bash
# Trusted setup Groth16 (bls12-381) + verification key. ⚠️ DEMO: entropía local.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build
POWER="${POWER:-14}"
echo "==> Powers of Tau (bls12-381, power=$POWER)"
snarkjs powersoftau new bls12-381 "$POWER" build/pot_0000.ptau -v
snarkjs powersoftau contribute build/pot_0000.ptau build/pot_0001.ptau --name="behuman-c2" -v -e="behuman c2 $(date +%s)"
snarkjs powersoftau prepare phase2 build/pot_0001.ptau build/pot_final.ptau -v
echo "==> Groth16 setup"
snarkjs groth16 setup build/post.r1cs build/pot_final.ptau build/post_0000.zkey
snarkjs zkey contribute build/post_0000.zkey build/post_final.zkey --name="behuman-c2-key" -v -e="behuman c2 key $(date +%s)"
snarkjs zkey export verificationkey build/post_final.zkey build/verification_key.json
echo "OK: build/post_final.zkey + build/verification_key.json"
