pragma circom 2.1.6;

// ============================================================================
// beHuman — CAPA 2 · Circuito de plataforma (post / identidad anónima)
//
// Prueba (sin revelar PII ni el address de Capa 1):
//   "Mi credencial (commitment = Poseidon(birthYear, countryCode, secret)) pertenece al
//    árbol Merkle del issuer (issuerRoot); mi identidad de plataforma es
//    platformId = Poseidon(secret, SCOPE); y esta prueba está atada a contentHash."
//
// Reutiliza los templates de identity/circuits (misma curva BLS12-381, mismo Poseidon de
// circomlib) para que el commitment y el issuerRoot coincidan con los de la Capa 1.
//
// Public signals (orden): [ issuerRoot, platformId, contentHash ].
//   - issuerRoot   : raíz Merkle del issuer (el contrato la exige de confianza).
//   - platformId   : seudónimo persistente, único por humano, incorrelacionable con el
//                    address/PII (Poseidon es unidireccional).
//   - contentHash  : hash del contenido del post; va DENTRO de la prueba (anti-replay /
//                    integridad). Para "registrar identidad" se usa contentHash = 0.
//
// ⚠️ NO usa ni revela el address del KYC. La identidad es platformId.
// ============================================================================

include "../node_modules/circomlib/circuits/poseidon.circom";

// Inclusión Merkle con Poseidon(2) — misma lógica que identity/circuits/src/kyc.circom.
template MerkleInclusion(LEVELS) {
    signal input leaf;
    signal input pathElements[LEVELS];
    signal input pathIndices[LEVELS]; // 0 = nodo actual a la izquierda, 1 = a la derecha
    signal output root;

    component hashers[LEVELS];
    signal cur[LEVELS + 1];
    signal left[LEVELS];
    signal right[LEVELS];

    cur[0] <== leaf;
    for (var i = 0; i < LEVELS; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        left[i]  <== cur[i]          + pathIndices[i] * (pathElements[i] - cur[i]);
        right[i] <== pathElements[i] + pathIndices[i] * (cur[i] - pathElements[i]);
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        cur[i + 1] <== hashers[i].out;
    }
    root <== cur[LEVELS];
}

template PlatformPost(LEVELS, SCOPE) {
    // --- privados (nunca salen del device) ---
    signal input birthYear;
    signal input countryCode;
    signal input secret;
    signal input pathElements[LEVELS];
    signal input pathIndices[LEVELS];

    // --- público ---
    signal input contentHash;

    // --- outputs públicos ---
    signal output issuerRoot;
    signal output platformId;

    // 1) commitment idéntico al de Capa 1.
    component commit = Poseidon(3);
    commit.inputs[0] <== birthYear;
    commit.inputs[1] <== countryCode;
    commit.inputs[2] <== secret;

    // 2) pertenencia al árbol del issuer.
    component merkle = MerkleInclusion(LEVELS);
    merkle.leaf <== commit.out;
    for (var i = 0; i < LEVELS; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
    issuerRoot <== merkle.root;

    // 3) identidad de plataforma derivada del secret (incorrelacionable con address/PII).
    component pid = Poseidon(2);
    pid.inputs[0] <== secret;
    pid.inputs[1] <== SCOPE;
    platformId <== pid.out;

    // 4) binding de contentHash: lo forzamos al sistema de constraints para que la prueba
    //    quede atada a este contenido (cambiarlo invalida la prueba).
    signal contentHashSq;
    contentHashSq <== contentHash * contentHash;
}

// LEVELS=4 (igual que el árbol del issuer). SCOPE = dominio de la plataforma beHuman.
component main {public [contentHash]} = PlatformPost(4, 700200300400500700800);
