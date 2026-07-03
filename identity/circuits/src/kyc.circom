pragma circom 2.1.6;

// ============================================================================
// beHuman — Circuito KYC (CAPA 1 · proof of personhood)
//
// Prueba (sin revelar PII):
//   "Conozco una credencial KYC (birthYear, countryCode, secret) cuyo commitment
//    pertenece al árbol de credenciales de un issuer de confianza (issuerRoot),
//    soy mayor de edad y mi país está permitido; ato esta prueba a mi address
//    Stellar (addressHash, validado on-chain por el contrato) y derivo un nullifier
//    global anti-Sybil (una persona = un registro)."
//
// 📐 Diseño en la vault de Obsidian: `Diseño del Circuito ZK`, `Modelo de Datos`,
//    `Flujo de KYC`.
//
// ⚠️ DECISIONES DE INGENIERÍA (requieren revisión humana de cripto):
//
//  1) CURVA = BLS12-381 (compilar con `--prime bls12381`).
//     El verificador on-chain es el `groth16_verifier` OFICIAL de soroban-examples,
//     que usa las host functions BLS12-381 (CAP-0059, disponible). Las primitivas
//     BN254/Poseidon nativas siguen siendo CAP-0074/0075 (propuestas, no disponibles
//     en el SDK). Por eso NO usamos la curva por defecto de Circom (BN254).
//
//  2) ATESTACIÓN DEL ISSUER = inclusión Merkle (solo Poseidon), NO EdDSA.
//     circomlib `eddsaposeidon` depende de BabyJubJub, que está definida sobre el
//     campo escalar de BN254 y NO es válida bajo bls12381. La inclusión Merkle es
//     curva-agnóstica y calza con el public signal `issuerRoot`. La vault ya lista
//     Merkle como evolución del esquema de firma (ver `Diseño del Circuito ZK`).
//
//  3) POSEIDON con constantes de circomlib (nothing-up-my-sleeve de BN254) reusadas
//     sobre el campo de BLS12-381. Son elementos de campo válidos (BN254 r < BLS r),
//     pero NO es Poseidon "estándar para bls12381". Aceptable para un MVP/demostrador;
//     marcado para revisión. En producción: parámetros Poseidon específicos del campo.
//
//  4) currentYear es una CONSTANTE de compilación (MVP). En producción debe ser un
//     input público validado contra el ledger para que el usuario no mienta la edad
//     (ver "Riesgos" en `Diseño del Circuito ZK`).
//
//  5) NULLIFIER GLOBAL = Poseidon(secret) — anti-Sybil real (1 persona = 1 registro).
//     NO incluye addressHash: evita que la misma persona registre N wallets distintas.
//     El address binding es independiente: addressHash (public input) + require_auth
//     en el contrato. Orden de public signals sin cambios: [commitment, nullifier,
//     issuerRoot, addressHash].
// ============================================================================

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// ----------------------------------------------------------------------------
// Inclusión Merkle con Poseidon(2). Demuestra que `leaf` pertenece al árbol cuyo
// raíz se devuelve en `root`, dado un camino (siblings + direcciones).
// ----------------------------------------------------------------------------
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
        // pathIndices[i] debe ser booleano
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Selección sin branching:
        //   idx=0 -> (left,right) = (cur, sibling)
        //   idx=1 -> (left,right) = (sibling, cur)
        left[i]  <== cur[i]          + pathIndices[i] * (pathElements[i] - cur[i]);
        right[i] <== pathElements[i] + pathIndices[i] * (cur[i] - pathElements[i]);

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== left[i];
        hashers[i].inputs[1] <== right[i];
        cur[i + 1] <== hashers[i].out;
    }

    root <== cur[LEVELS];
}

// ----------------------------------------------------------------------------
// Pertenencia de countryCode a un conjunto permitido (igualdad exacta a uno).
// ----------------------------------------------------------------------------
template CountryInSet(N) {
    signal input countryCode;
    signal input allowed[N];
    signal output ok;

    component eq[N];
    signal partial[N + 1];
    partial[0] <== 0;

    for (var i = 0; i < N; i++) {
        eq[i] = IsEqual();
        eq[i].in[0] <== countryCode;
        eq[i].in[1] <== allowed[i];
        partial[i + 1] <== partial[i] + eq[i].out;
    }

    ok <== partial[N];
    ok === 1; // exactamente un match -> pertenece al set
}

// ----------------------------------------------------------------------------
// Circuito principal.
//   LEVELS       : profundidad del árbol Merkle del issuer.
//   MIN_AGE      : edad mínima del predicado (ej. 18).
//   CURRENT_YEAR : año actual (constante MVP — ver nota 4 arriba).
//   N_COUNTRIES  : tamaño de la lista de países permitidos.
// ----------------------------------------------------------------------------
template KycCredential(LEVELS, MIN_AGE, CURRENT_YEAR, N_COUNTRIES) {
    // --- Inputs privados (witness — nunca salen del cliente) ---
    signal input birthYear;
    signal input countryCode;
    signal input secret;
    signal input pathElements[LEVELS];
    signal input pathIndices[LEVELS];

    // --- Input público ---
    signal input addressHash; // hash del address Stellar (address binding); validado on-chain

    // --- Outputs públicos (orden = public signals: [commitment, nullifier, issuerRoot, addressHash]) ---
    signal output commitment;
    signal output nullifier;
    signal output issuerRoot;

    // 1) commitment = Poseidon(birthYear, countryCode, secret)
    component commit = Poseidon(3);
    commit.inputs[0] <== birthYear;
    commit.inputs[1] <== countryCode;
    commit.inputs[2] <== secret;
    commitment <== commit.out;

    // 2) Pertenencia al árbol del issuer: la hoja es el commitment.
    component merkle = MerkleInclusion(LEVELS);
    merkle.leaf <== commitment;
    for (var i = 0; i < LEVELS; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i]  <== pathIndices[i];
    }
    issuerRoot <== merkle.root;

    // 3) Predicado de edad: birthYear acotado y (CURRENT_YEAR - birthYear) >= MIN_AGE.
    //    Acotamos birthYear <= CURRENT_YEAR para evitar underflow en el campo.
    component byBound = LessEqThan(12); // birthYear cabe en 12 bits (< 4096)
    byBound.in[0] <== birthYear;
    byBound.in[1] <== CURRENT_YEAR;
    byBound.out === 1;

    component adult = GreaterEqThan(8); // edad en [0, 255]
    adult.in[0] <== CURRENT_YEAR - birthYear;
    adult.in[1] <== MIN_AGE;
    adult.out === 1;

    // 4) Predicado de país: countryCode ∈ lista permitida.
    //    Códigos ISO 3166-1 numéricos: AR=32, BR=76, CL=152, UY=858.
    var allowedCountries[4] = [32, 76, 152, 858];
    component country = CountryInSet(N_COUNTRIES);
    country.countryCode <== countryCode;
    for (var i = 0; i < N_COUNTRIES; i++) {
        country.allowed[i] <== allowedCountries[i];
    }

    // 5) nullifier = Poseidon(secret) — anti-Sybil global (1 persona = 1 registro).
    //    El address binding lo provee addressHash (public input) + validación on-chain
    //    (require_auth + comparación de hash en el contrato); no depende del nullifier.
    component nf = Poseidon(1);
    nf.inputs[0] <== secret;
    nullifier <== nf.out;

    // addressHash se expone como public signal para address binding on-chain (validado por el contrato).
    // Constraint trivial para que no sea eliminado por el optimizador.
    signal addressHashSq;
    addressHashSq <== addressHash * addressHash;
}

// LEVELS=4 (16 hojas), MIN_AGE=18, CURRENT_YEAR=2026, N_COUNTRIES=4.
component main {public [addressHash]} = KycCredential(4, 18, 2026, 4);
