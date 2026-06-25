//! Tests de opinion_board (CAPA 2). Usan artefactos ZK reales del circuito de plataforma
//! (platform/circuits, BLS12-381) en testdata.rs. Cero address: todo es por platformId.

#![cfg(test)]
extern crate std;

use super::*;
use ark_bls12_381::{Fq, Fq2};
use ark_serialize::CanonicalSerialize;
use core::str::FromStr;
use soroban_sdk::{
    crypto::bls12_381::{G1_SERIALIZED_SIZE, G2_SERIALIZED_SIZE},
    testutils::Address as _,
    Address, Env,
};

fn g1(env: &Env, x: &str, y: &str) -> G1Affine {
    let p = ark_bls12_381::G1Affine::new(Fq::from_str(x).unwrap(), Fq::from_str(y).unwrap());
    let mut buf = [0u8; G1_SERIALIZED_SIZE];
    p.serialize_uncompressed(&mut buf[..]).unwrap();
    G1Affine::from_array(env, &buf)
}
fn g2(env: &Env, x0: &str, x1: &str, y0: &str, y1: &str) -> G2Affine {
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
        ic.push_back(g1(env, p[0], p[1]));
    }
    VerificationKey {
        alpha: g1(env, testdata::VK_ALPHA[0], testdata::VK_ALPHA[1]),
        beta: g2(env, testdata::VK_BETA[0], testdata::VK_BETA[1], testdata::VK_BETA[2], testdata::VK_BETA[3]),
        gamma: g2(env, testdata::VK_GAMMA[0], testdata::VK_GAMMA[1], testdata::VK_GAMMA[2], testdata::VK_GAMMA[3]),
        delta: g2(env, testdata::VK_DELTA[0], testdata::VK_DELTA[1], testdata::VK_DELTA[2], testdata::VK_DELTA[3]),
        ic,
    }
}
fn test_proof(env: &Env) -> Proof {
    Proof {
        a: g1(env, testdata::PROOF_A[0], testdata::PROOF_A[1]),
        b: g2(env, testdata::PROOF_B[0], testdata::PROOF_B[1], testdata::PROOF_B[2], testdata::PROOF_B[3]),
        c: g1(env, testdata::PROOF_C[0], testdata::PROOF_C[1]),
    }
}
fn public_inputs(env: &Env) -> Vec<BytesN<32>> {
    let mut v = Vec::new(env);
    for s in testdata::PUBLIC_SIGNALS.iter() {
        v.push_back(BytesN::from_array(env, s));
    }
    v
}
fn issuer_root(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &testdata::PUBLIC_SIGNALS[IDX_ISSUER_ROOT as usize])
}
fn platform_id(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &testdata::PUBLIC_SIGNALS[IDX_PLATFORM_ID as usize])
}

fn init_default(env: &Env) -> OpinionBoardClient<'static> {
    let client = OpinionBoardClient::new(env, &env.register(OpinionBoard, ()));
    client.init(&Address::generate(env), &issuer_root(env), &test_vk(env));
    client
}

#[test]
fn verify_proof_accepts_valid() {
    let env = Env::default();
    let client = init_default(&env);
    assert_eq!(client.verify_proof(&test_proof(&env), &public_inputs(&env)), true);
}

#[test]
fn verify_proof_rejects_tampered() {
    let env = Env::default();
    let client = init_default(&env);
    let mut sig = testdata::PUBLIC_SIGNALS;
    sig[IDX_PLATFORM_ID as usize][31] ^= 0x01;
    let mut tampered = Vec::new(&env);
    for s in sig.iter() {
        tampered.push_back(BytesN::from_array(&env, s));
    }
    assert_eq!(client.verify_proof(&test_proof(&env), &tampered), false);
}

#[test]
fn register_identity_happy() {
    let env = Env::default();
    let client = init_default(&env);
    client.register_identity(&test_proof(&env), &public_inputs(&env));
    assert_eq!(client.is_registered(&platform_id(&env)), true);
}

#[test]
fn register_rejects_untrusted_issuer() {
    let env = Env::default();
    let client = OpinionBoardClient::new(&env, &env.register(OpinionBoard, ()));
    let mut wrong = testdata::PUBLIC_SIGNALS[IDX_ISSUER_ROOT as usize];
    wrong[31] ^= 0x01;
    client.init(&Address::generate(&env), &BytesN::from_array(&env, &wrong), &test_vk(&env));
    let res = client.try_register_identity(&test_proof(&env), &public_inputs(&env));
    assert_eq!(res, Err(Ok(Error::UntrustedIssuer)));
}

#[test]
fn register_rejects_double() {
    let env = Env::default();
    let client = init_default(&env);
    client.register_identity(&test_proof(&env), &public_inputs(&env));
    let res = client.try_register_identity(&test_proof(&env), &public_inputs(&env));
    assert_eq!(res, Err(Ok(Error::AlreadyRegistered)));
}

#[test]
fn post_requires_registration() {
    let env = Env::default();
    let client = init_default(&env);
    let res = client.try_post(&test_proof(&env), &public_inputs(&env));
    assert_eq!(res, Err(Ok(Error::NotRegistered)));
}

#[test]
fn register_then_post() {
    let env = Env::default();
    let client = init_default(&env);
    client.register_identity(&test_proof(&env), &public_inputs(&env));
    let id = client.post(&test_proof(&env), &public_inputs(&env));
    assert_eq!(id, 0);
    let record = client.get_post(&0).unwrap();
    assert_eq!(record.platform_id, platform_id(&env));
    assert_eq!(client.post_count(), 1);
}

#[test]
fn post_rejects_replay() {
    let env = Env::default();
    let client = init_default(&env);
    client.register_identity(&test_proof(&env), &public_inputs(&env));
    client.post(&test_proof(&env), &public_inputs(&env));
    let res = client.try_post(&test_proof(&env), &public_inputs(&env));
    assert_eq!(res, Err(Ok(Error::AlreadyPosted)));
}

#[test]
fn rejects_double_init() {
    let env = Env::default();
    let client = init_default(&env);
    let res = client.try_init(&Address::generate(&env), &issuer_root(&env), &test_vk(&env));
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}
