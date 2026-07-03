//! Tests del contrato kyc_verifier.
//!
//! Usan los artefactos reales generados por el pipeline ZK (Circom + snarkjs sobre
//! BLS12-381), en `testdata.rs`, para comprobar que la prueba **encaja con la lógica
//! del `groth16_verifier` oficial** (pairing BLS12-381), además de la lógica de
//! registro: issuer root, address binding y nullifier anti-replay.
//!
//! NOTA (nullifier global): el circuito usa `nullifier = Poseidon(secret)` (anti-Sybil).
//! Los artefactos en `testdata.rs` (proof + PUBLIC_SIGNALS) deben regenerarse con
//! `identity/circuits/scripts/gen_testdata.mjs` tras recompilar kyc.circom — no editar a mano.
//!
//! Los puntos BLS se parsean desde las coordenadas decimales de snarkjs con
//! ark-bls12-381 (igual que el test del verificador oficial de soroban-examples).

#![cfg(test)]
extern crate std;

use super::*;
use ark_bls12_381::{Fq, Fq2};
use ark_serialize::CanonicalSerialize;
use core::str::FromStr;
use soroban_sdk::{
    crypto::bls12_381::{G1_SERIALIZED_SIZE, G2_SERIALIZED_SIZE},
    testutils::Address as _,
    Address, Env, String,
};

// Address fijo al que está atada la prueba de ejemplo (ver testdata::PUBLIC_SIGNALS[3]).
// La prueba se regenera para este address; ver el README del circuito.
const FIXED_ADDR: &str = "GDYQS2PJTNNCJDYXHU4XQ57VQU6FHPTKCJMM7WG5NUHRZIT6SXAYKIJI";

// --- parseo de puntos (coordenadas decimales snarkjs -> puntos del SDK vía ark) ---

fn g1_from_coords(env: &Env, x: &str, y: &str) -> G1Affine {
    let p = ark_bls12_381::G1Affine::new(Fq::from_str(x).unwrap(), Fq::from_str(y).unwrap());
    let mut buf = [0u8; G1_SERIALIZED_SIZE];
    p.serialize_uncompressed(&mut buf[..]).unwrap();
    G1Affine::from_array(env, &buf)
}

fn g2_from_coords(env: &Env, x0: &str, x1: &str, y0: &str, y1: &str) -> G2Affine {
    let x = Fq2::new(Fq::from_str(x0).unwrap(), Fq::from_str(x1).unwrap());
    let y = Fq2::new(Fq::from_str(y0).unwrap(), Fq::from_str(y1).unwrap());
    let p = ark_bls12_381::G2Affine::new(x, y);
    let mut buf = [0u8; G2_SERIALIZED_SIZE];
    p.serialize_uncompressed(&mut buf[..]).unwrap();
    G2Affine::from_array(env, &buf)
}

fn test_vk(env: &Env) -> VerificationKey {
    let mut ic = Vec::new(env);
    for p in testdata::VK_IC.iter() {
        ic.push_back(g1_from_coords(env, p[0], p[1]));
    }
    VerificationKey {
        alpha: g1_from_coords(env, testdata::VK_ALPHA[0], testdata::VK_ALPHA[1]),
        beta: g2_from_coords(
            env, testdata::VK_BETA[0], testdata::VK_BETA[1], testdata::VK_BETA[2], testdata::VK_BETA[3],
        ),
        gamma: g2_from_coords(
            env, testdata::VK_GAMMA[0], testdata::VK_GAMMA[1], testdata::VK_GAMMA[2], testdata::VK_GAMMA[3],
        ),
        delta: g2_from_coords(
            env, testdata::VK_DELTA[0], testdata::VK_DELTA[1], testdata::VK_DELTA[2], testdata::VK_DELTA[3],
        ),
        ic,
    }
}

fn test_proof(env: &Env) -> Proof {
    Proof {
        a: g1_from_coords(env, testdata::PROOF_A[0], testdata::PROOF_A[1]),
        b: g2_from_coords(
            env, testdata::PROOF_B[0], testdata::PROOF_B[1], testdata::PROOF_B[2], testdata::PROOF_B[3],
        ),
        c: g1_from_coords(env, testdata::PROOF_C[0], testdata::PROOF_C[1]),
    }
}

fn public_inputs(env: &Env) -> Vec<BytesN<32>> {
    let mut v = Vec::new(env);
    for sig in testdata::PUBLIC_SIGNALS.iter() {
        v.push_back(BytesN::from_array(env, sig));
    }
    v
}

fn trusted_root(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &testdata::PUBLIC_SIGNALS[IDX_ISSUER_ROOT as usize])
}

fn deploy(env: &Env) -> KycVerifierClient<'static> {
    KycVerifierClient::new(env, &env.register(KycVerifier, ()))
}

fn init_default(env: &Env) -> KycVerifierClient<'static> {
    env.mock_all_auths();
    let client = deploy(env);
    let admin = Address::generate(env);
    client.init(&admin, &trusted_root(env), &test_vk(env));
    client
}

// ---------------------------------------------------------------------------
// is_verified por defecto
// ---------------------------------------------------------------------------
#[test]
fn is_verified_defaults_to_false() {
    let env = Env::default();
    let client = init_default(&env);
    assert_eq!(client.is_verified(&Address::generate(&env)), false);
}

// ---------------------------------------------------------------------------
// La prueba real verifica con la lógica del groth16_verifier (BLS12-381).
// ---------------------------------------------------------------------------
#[test]
fn verify_proof_accepts_valid_proof() {
    let env = Env::default();
    let client = init_default(&env);
    assert_eq!(client.verify_proof(&test_proof(&env), &public_inputs(&env)), true);
}

// Tampering de un public input -> el pairing falla.
#[test]
fn verify_proof_rejects_tampered_public_input() {
    let env = Env::default();
    let client = init_default(&env);

    let mut sig = testdata::PUBLIC_SIGNALS;
    sig[0][31] ^= 0x01; // altera el commitment
    let mut tampered = Vec::new(&env);
    for s in sig.iter() {
        tampered.push_back(BytesN::from_array(&env, s));
    }
    assert_eq!(client.verify_proof(&test_proof(&env), &tampered), false);
}

// ---------------------------------------------------------------------------
// verify_and_register — happy path
// ---------------------------------------------------------------------------
#[test]
fn verify_and_register_happy_path() {
    let env = Env::default();
    env.mock_all_auths();
    let client = init_default(&env);

    let addr = Address::from_string(&String::from_str(&env, FIXED_ADDR));
    client.verify_and_register(&addr, &test_proof(&env), &public_inputs(&env));

    assert_eq!(client.is_verified(&addr), true);
}

// ---------------------------------------------------------------------------
// Issuer no confiable -> UntrustedIssuer (antes del pairing)
// ---------------------------------------------------------------------------
#[test]
fn rejects_untrusted_issuer() {
    let env = Env::default();
    env.mock_all_auths();

    let client = deploy(&env);
    let admin = Address::generate(&env);
    // trusted_root distinto del issuerRoot de la prueba.
    let mut wrong = testdata::PUBLIC_SIGNALS[IDX_ISSUER_ROOT as usize];
    wrong[31] ^= 0x01;
    client.init(&admin, &BytesN::from_array(&env, &wrong), &test_vk(&env));

    let addr = Address::from_string(&String::from_str(&env, FIXED_ADDR));
    let res = client.try_verify_and_register(&addr, &test_proof(&env), &public_inputs(&env));
    assert_eq!(res, Err(Ok(Error::UntrustedIssuer)));
}

// ---------------------------------------------------------------------------
// Address binding: invocador distinto del atado en la prueba -> AddressMismatch
// ---------------------------------------------------------------------------
#[test]
fn rejects_address_mismatch() {
    let env = Env::default();
    env.mock_all_auths();
    let client = init_default(&env);

    let other = Address::generate(&env); // distinto de FIXED_ADDR
    let res = client.try_verify_and_register(&other, &test_proof(&env), &public_inputs(&env));
    assert_eq!(res, Err(Ok(Error::AddressMismatch)));
}

// ---------------------------------------------------------------------------
// Anti-replay: segundo registro con el mismo nullifier -> NullifierAlreadyUsed
// ---------------------------------------------------------------------------
#[test]
fn rejects_nullifier_replay() {
    let env = Env::default();
    env.mock_all_auths();
    let client = init_default(&env);

    let addr = Address::from_string(&String::from_str(&env, FIXED_ADDR));
    client.verify_and_register(&addr, &test_proof(&env), &public_inputs(&env));

    let res = client.try_verify_and_register(&addr, &test_proof(&env), &public_inputs(&env));
    assert_eq!(res, Err(Ok(Error::NullifierAlreadyUsed)));
}

// ---------------------------------------------------------------------------
// init no se puede repetir
// ---------------------------------------------------------------------------
#[test]
fn rejects_double_init() {
    let env = Env::default();
    env.mock_all_auths();
    let client = init_default(&env);
    let admin = Address::generate(&env);
    let res = client.try_init(&admin, &trusted_root(&env), &test_vk(&env));
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

// init exige require_auth del admin.
#[test]
fn init_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let client = deploy(&env);
    let admin = Address::generate(&env);
    client.init(&admin, &trusted_root(&env), &test_vk(&env));
    let auths = env.auths();
    assert!(auths.iter().any(|(addr, _)| *addr == admin));
}

// update_root permite rotar la raíz Merkle del issuer (multi-usuario).
#[test]
fn update_root_changes_trusted_root() {
    let env = Env::default();
    env.mock_all_auths();
    let client = init_default(&env);

    let mut new_root = testdata::PUBLIC_SIGNALS[IDX_ISSUER_ROOT as usize];
    new_root[31] ^= 0x01;
    let new_root = BytesN::from_array(&env, &new_root);
    client.update_root(&new_root);

    env.mock_all_auths();
    let addr = Address::from_string(&String::from_str(&env, FIXED_ADDR));
    let res = client.try_verify_and_register(&addr, &test_proof(&env), &public_inputs(&env));
    assert_eq!(res, Err(Ok(Error::UntrustedIssuer)));
}

// ---------------------------------------------------------------------------
// Helper (ignorado): imprime el addressHash del FIXED_ADDR para regenerar la prueba.
// Correr con: cargo test -p kyc_verifier print_address_hash -- --ignored --nocapture
// ---------------------------------------------------------------------------
#[test]
#[ignore]
fn print_address_hash() {
    let env = Env::default();
    let client = deploy(&env);
    let addr = Address::from_string(&String::from_str(&env, FIXED_ADDR));
    let arr = client.address_field_hash(&addr).to_array();
    let mut s = std::string::String::new();
    for b in arr.iter() {
        s.push_str(&std::format!("{:02x}", b));
    }
    std::println!("ADDRESS_HASH_HEX={}", s);
}
