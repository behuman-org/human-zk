#![no_std]
//! beHuman — Contrato verificador KYC (CAPA 1 · proof of personhood).
//!
//! Verifica una prueba ZK Groth16 (curva **BLS12-381**) y registra la dirección como
//! KYC-verificada, garantizando "una persona = un registro" mediante un `nullifier`.
//!
//! 📐 Diseño en la vault: `Contrato Verificador (Soroban)`, `Flujo de KYC` (Fase 3),
//!    `Modelo de Datos`.
//!
//! ## Por qué BLS12-381 (y no BN254)
//! El verificador Groth16 oficial de soroban-examples usa las host functions
//! **BLS12-381** (`crypto::bls12_381`, CAP-0059, disponible). Las primitivas BN254 /
//! Poseidon nativas siguen siendo CAP-0074/0075 (propuestas, NO disponibles en el SDK).
//! Por eso el circuito (`identity/circuits/src/kyc.circom`) se compila con
//! `--prime bls12381` y este contrato verifica sobre BLS12-381. La lógica de pairing
//! es la misma del `groth16_verifier` oficial; aquí se le agrega registro + nullifier +
//! address binding + issuer root.
//!
//! ## Public inputs (orden acordado con el circuito)
//! `[commitment, nullifier, issuerRoot, addressHash]` — cada uno como `BytesN<32>`
//! (elemento de campo, big-endian, < r_bls12381).
//!
//! ⚠️ MVP: el issuer es un **mock**; revisión humana de la cripto obligatoria
//!    (nullifier, address binding, issuer root). Ver README del contrato.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype,
    crypto::bls12_381::{Fr, G1Affine, G2Affine},
    vec, xdr::ToXdr, Address, Bytes, BytesN, Env, U256, Vec,
};

// Índices de los public inputs (deben coincidir con el orden del circuito).
const IDX_NULLIFIER: u32 = 1;
const IDX_ISSUER_ROOT: u32 = 2;
const IDX_ADDRESS_HASH: u32 = 3;
const N_PUBLIC_INPUTS: u32 = 4;

/// ~1 día en testnet/mainnet (5s/ledger).
const DAY_IN_LEDGERS: u32 = 17280;
const PERSISTENT_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    UntrustedIssuer = 1,
    AddressMismatch = 2,
    NullifierAlreadyUsed = 3,
    InvalidProof = 4,
    AlreadyInitialized = 5,
    NotInitialized = 6,
    MalformedPublicInputs = 7,
    MalformedVerifyingKey = 8,
}

/// Verifying key del circuito (formato del `groth16_verifier` oficial).
#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

/// Prueba Groth16.
#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

#[contracttype]
pub struct Config {
    pub admin: Address,
    pub trusted_root: BytesN<32>, // issuerRoot de confianza (Merkle root del issuer mock)
}

#[contracttype]
pub enum DataKey {
    Config,
    Vk,
    Verified(Address),
    Nullifier(BytesN<32>),
}

#[contract]
pub struct KycVerifier;

#[contractimpl]
impl KycVerifier {
    /// Inicializa el contrato con el issuer de confianza y la verifying key del circuito.
    /// Solo se puede llamar una vez.
    pub fn init(
        env: Env,
        admin: Address,
        trusted_root: BytesN<32>,
        vk: VerificationKey,
    ) -> Result<(), Error> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        // La VK debe tener un IC por cada public input + 1.
        if vk.ic.len() != N_PUBLIC_INPUTS + 1 {
            return Err(Error::MalformedVerifyingKey);
        }
        env.storage()
            .instance()
            .set(&DataKey::Config, &Config { admin, trusted_root });
        env.storage().instance().set(&DataKey::Vk, &vk);
        Ok(())
    }

    /// Actualiza la raíz Merkle del issuer de confianza (p. ej. tras cada enrollment).
    /// Solo el `admin` configurado en `init` puede invocarla.
    pub fn update_root(env: Env, new_root: BytesN<32>) -> Result<(), Error> {
        let mut config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;
        config.admin.require_auth();
        config.trusted_root = new_root;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    /// Verifica la prueba ZK y registra al invocador como KYC-verificado.
    ///
    /// Orden de checks (ver `Flujo de KYC` Fase 3):
    /// 1. `address.require_auth()` — address binding (el invocador firma).
    /// 2. `issuerRoot ∈ confiables`.
    /// 3. `addressHash == hash(address)` — la prueba está atada a este address.
    /// 4. `nullifier` no usado antes (anti-replay / anti doble registro).
    /// 5. `verify_groth16(vk, proof, public_inputs)`.
    /// 6. persistir `Verified(address)` + `Nullifier`.
    pub fn verify_and_register(
        env: Env,
        address: Address,
        proof: Proof,
        public_inputs: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        address.require_auth();

        if public_inputs.len() != N_PUBLIC_INPUTS {
            return Err(Error::MalformedPublicInputs);
        }

        let config: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(Error::NotInitialized)?;

        // 2. issuer root de confianza
        let issuer_root = public_inputs.get(IDX_ISSUER_ROOT).unwrap();
        if issuer_root != config.trusted_root {
            return Err(Error::UntrustedIssuer);
        }

        // 3. address binding
        let address_hash = public_inputs.get(IDX_ADDRESS_HASH).unwrap();
        let expected = Self::address_field_hash(env.clone(), address.clone());
        if address_hash != expected {
            return Err(Error::AddressMismatch);
        }

        // 4. anti-replay
        let nullifier = public_inputs.get(IDX_NULLIFIER).unwrap();
        let nf_key = DataKey::Nullifier(nullifier.clone());
        if env.storage().persistent().has(&nf_key) {
            return Err(Error::NullifierAlreadyUsed);
        }

        // 5. verificación criptográfica de la prueba
        let vk: VerificationKey = env
            .storage()
            .instance()
            .get(&DataKey::Vk)
            .ok_or(Error::NotInitialized)?;
        if !Self::pairing_verify(&env, &vk, &proof, &public_inputs)? {
            return Err(Error::InvalidProof);
        }

        // 6. persistir registro + nullifier
        let verified_key = DataKey::Verified(address);
        env.storage().persistent().set(&verified_key, &true);
        env.storage().persistent().extend_ttl(
            &verified_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        env.storage().persistent().set(&nf_key, &true);
        env.storage().persistent().extend_ttl(
            &nf_key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        Ok(())
    }

    /// Consulta pública para otras dApps (CAPA 2): ¿está verificada esta dirección?
    pub fn is_verified(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Verified(address))
            .unwrap_or(false)
    }

    /// Verificación pura de una prueba Groth16 contra la VK almacenada (sin registrar).
    /// Útil para tests / integración. Equivale al `verify_proof` del verificador oficial.
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

    /// Hash del address usado como `addressHash` en el circuito (address binding).
    ///
    /// `addressHash = sha256(address.to_xdr())` con los 2 bits más altos en 0 para
    /// garantizar que el valor es < r_bls12381 (así no hay reducción modular: las
    /// representaciones on-chain y en el circuito son idénticas byte a byte).
    /// El cliente off-chain (prover) debe usar exactamente este valor.
    pub fn address_field_hash(env: Env, address: Address) -> BytesN<32> {
        let xdr = address.to_xdr(&env);
        let mut digest = env.crypto().sha256(&xdr).to_array();
        digest[0] &= 0x3f; // < 2^254 < r_bls12381
        BytesN::from_array(&env, &digest)
    }
}

impl KycVerifier {
    /// Pairing check de Groth16 sobre BLS12-381 (idéntico al `groth16_verifier` oficial):
    /// `e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1`,
    /// con `vk_x = ic[0] + Σ pub_signals[i] · ic[i+1]`.
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
        let vp2 = vec![
            env,
            proof.b.clone(),
            vk.beta.clone(),
            vk.gamma.clone(),
            vk.delta.clone(),
        ];
        Ok(bls.pairing_check(vp1, vp2))
    }
}

/// Convierte un elemento de campo en bytes big-endian (32) a `Fr` de BLS12-381.
fn fr_from_bytes(env: &Env, b: &BytesN<32>) -> Fr {
    let bytes = Bytes::from_array(env, &b.to_array());
    Fr::from_u256(U256::from_be_bytes(env, &bytes))
}

#[cfg(test)]
mod test;
#[cfg(test)]
mod testdata;
