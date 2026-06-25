#![no_std]
//! beHuman — CAPA 2 · opinion_board (plataforma de opinión, ZK como núcleo).
//!
//! Ancla on-chain de la plataforma: NO usa el address del KYC ni `is_verified(address)`.
//! La participación se gatea con una **prueba ZK Groth16 (BLS12-381)** de pertenencia al
//! árbol Merkle del issuer (`issuerRoot`), que además expone:
//!   - `platformId` = Poseidon(secret, scope): identidad anónima persistente del humano.
//!   - `contentHash`: hash del post, atado dentro de la prueba (anti-replay / integridad).
//!
//! Public signals (orden, debe coincidir con platform/circuits/src/post.circom):
//!   [ issuerRoot, platformId, contentHash ]  — cada uno BytesN<32> big-endian.
//!
//! ⚠️ Cero PII y cero address on-chain: sólo platformId / contentHash / proofs.
//! La verificación de pairing replica la del `kyc_verifier` (Capa 1) sobre BLS12-381.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    crypto::bls12_381::{Fr, G1Affine, G2Affine},
    vec, Bytes, BytesN, Env, U256, Vec,
};

const IDX_ISSUER_ROOT: u32 = 0;
const IDX_PLATFORM_ID: u32 = 1;
const IDX_CONTENT_HASH: u32 = 2;
const N_PUBLIC_INPUTS: u32 = 3;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    UntrustedIssuer = 1,
    InvalidProof = 2,
    AlreadyRegistered = 3,
    NotRegistered = 4,
    AlreadyPosted = 5,
    AlreadyInitialized = 6,
    NotInitialized = 7,
    MalformedPublicInputs = 8,
    MalformedVerifyingKey = 9,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

#[contracttype]
pub struct Config {
    pub admin: soroban_sdk::Address,
    pub trusted_issuer_root: BytesN<32>, // raíz del árbol del issuer (de Capa 1)
}

#[contracttype]
#[derive(Clone)]
pub struct PostRecord {
    pub platform_id: BytesN<32>, // seudónimo anónimo (NO address)
    pub content_hash: BytesN<32>, // hash del contenido off-chain
    pub timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Config,
    Vk,
    Identity(BytesN<32>),              // platformId registrado
    Post(u64),                        // id -> PostRecord
    PostCount,                        // u64
    Posted(BytesN<32>, BytesN<32>),   // (platformId, contentHash) -> ya anclado (anti-replay)
}

#[contract]
pub struct OpinionBoard;

#[contractimpl]
impl OpinionBoard {
    /// Inicializa con la raíz del issuer de confianza (la misma de Capa 1) y la VK del
    /// circuito de plataforma.
    pub fn init(
        env: Env,
        admin: soroban_sdk::Address,
        trusted_issuer_root: BytesN<32>,
        vk: VerificationKey,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        if vk.ic.len() != N_PUBLIC_INPUTS + 1 {
            return Err(Error::MalformedVerifyingKey);
        }
        env.storage()
            .instance()
            .set(&DataKey::Config, &Config { admin, trusted_issuer_root });
        env.storage().instance().set(&DataKey::Vk, &vk);
        env.storage().instance().set(&DataKey::PostCount, &0u64);
        Ok(())
    }

    /// Registra la identidad anónima de plataforma (platformId) probando pertenencia al
    /// árbol del issuer. Anti-Sybil: el mismo humano produce el mismo platformId.
    pub fn register_identity(
        env: Env,
        proof: Proof,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        Self::check_issuer(&env, &public_inputs)?;
        let platform_id = public_inputs.get(IDX_PLATFORM_ID).unwrap();
        if env.storage().persistent().has(&DataKey::Identity(platform_id.clone())) {
            return Err(Error::AlreadyRegistered);
        }
        Self::verify_or_err(&env, &proof, &public_inputs)?;
        env.storage()
            .persistent()
            .set(&DataKey::Identity(platform_id), &true);
        Ok(())
    }

    /// Publica un post: prueba de pertenencia + binding de contentHash. Ancla bajo platformId.
    pub fn post(
        env: Env,
        proof: Proof,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<u64, Error> {
        Self::check_issuer(&env, &public_inputs)?;
        let platform_id = public_inputs.get(IDX_PLATFORM_ID).unwrap();
        let content_hash = public_inputs.get(IDX_CONTENT_HASH).unwrap();

        if !env.storage().persistent().has(&DataKey::Identity(platform_id.clone())) {
            return Err(Error::NotRegistered);
        }
        let posted_key = DataKey::Posted(platform_id.clone(), content_hash.clone());
        if env.storage().persistent().has(&posted_key) {
            return Err(Error::AlreadyPosted);
        }
        Self::verify_or_err(&env, &proof, &public_inputs)?;

        let id: u64 = env.storage().instance().get(&DataKey::PostCount).unwrap_or(0);
        let record = PostRecord {
            platform_id,
            content_hash,
            timestamp: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&DataKey::Post(id), &record);
        env.storage().persistent().set(&posted_key, &true);
        env.storage().instance().set(&DataKey::PostCount, &(id + 1));
        Ok(id)
    }

    /// ¿Está registrada esta identidad de plataforma?
    pub fn is_registered(env: Env, platform_id: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Identity(platform_id))
    }

    pub fn post_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::PostCount).unwrap_or(0)
    }

    pub fn get_post(env: Env, id: u64) -> Option<PostRecord> {
        env.storage().persistent().get(&DataKey::Post(id))
    }

    /// Verificación pura del pairing (sin anclar), útil para tests/integración.
    pub fn verify_proof(
        env: Env,
        proof: Proof,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<bool, Error> {
        if public_inputs.len() != N_PUBLIC_INPUTS {
            return Err(Error::MalformedPublicInputs);
        }
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .ok_or(Error::NotInitialized)?;
        Self::pairing_verify(&env, &vk, &proof, &public_inputs)
    }
}

impl OpinionBoard {
    fn check_issuer(env: &Env, public_inputs: &Vec<BytesN<32>>) -> Result<(), Error> {
        if public_inputs.len() != N_PUBLIC_INPUTS {
            return Err(Error::MalformedPublicInputs);
        }
        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;
        let issuer_root = public_inputs.get(IDX_ISSUER_ROOT).unwrap();
        if issuer_root != config.trusted_issuer_root {
            return Err(Error::UntrustedIssuer);
        }
        Ok(())
    }

    fn verify_or_err(env: &Env, proof: &Proof, public_inputs: &Vec<BytesN<32>>) -> Result<(), Error> {
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .ok_or(Error::NotInitialized)?;
        if !Self::pairing_verify(env, &vk, proof, public_inputs)? {
            return Err(Error::InvalidProof);
        }
        Ok(())
    }

    /// Pairing Groth16 sobre BLS12-381 (idéntico al `groth16_verifier` oficial / kyc_verifier).
    fn pairing_verify(
        env: &Env,
        vk: &VerificationKey,
        proof: &Proof,
        public_inputs: &Vec<BytesN<32>>,
    ) -> Result<bool, Error> {
        if public_inputs.len() + 1 != vk.ic.len() {
            return Err(Error::MalformedVerifyingKey);
        }
        let bls = env.crypto().bls12_381();
        let mut vk_x = vk.ic.get(0).unwrap();
        for (b, ic) in public_inputs.iter().zip(vk.ic.iter().skip(1)) {
            let s = fr_from_bytes(env, &b);
            let prod = bls.g1_mul(&ic, &s);
            vk_x = bls.g1_add(&vk_x, &prod);
        }
        let neg_a = -proof.a.clone();
        let vp1 = vec![env, neg_a, vk.alpha.clone(), vk_x, proof.c.clone()];
        let vp2 = vec![env, proof.b.clone(), vk.beta.clone(), vk.gamma.clone(), vk.delta.clone()];
        Ok(bls.pairing_check(vp1, vp2))
    }
}

fn fr_from_bytes(env: &Env, b: &BytesN<32>) -> Fr {
    let bytes = Bytes::from_array(env, &b.to_array());
    Fr::from_u256(U256::from_be_bytes(env, &bytes))
}

#[cfg(test)]
mod test;
#[cfg(test)]
mod testdata;
