pragma circom 2.1.6;

// Helper OFF-CHAIN: expone Poseidon(1) para que el SDK calcule el nullifier global
// idéntico al circuito principal (nullifier = Poseidon(secret)). Mismo circomlib,
// mismo --prime bls12381. No se usa on-chain.
// Witness layout: [1, out, a] -> el SDK lee w[1].
include "../node_modules/circomlib/circuits/poseidon.circom";

template H1() {
    signal input a;
    signal output out;
    component p = Poseidon(1);
    p.inputs[0] <== a;
    out <== p.out;
}

component main = H1();
