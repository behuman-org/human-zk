#![no_std]
//! beHuman — CAPA 3 · campaign_controller (Soroban).
//!
//! Custodia **no-custodial** de las donaciones de una campaña y enforcement de las reglas:
//!   - `release`: solo con **2-de-3** firmas (causa + plataforma + neutral) **y meta alcanzada**
//!     → transfiere a la wallet de la causa.
//!   - `refund`: si venció el deadline **sin** alcanzar la meta → cada donante recupera su
//!     aporte (**todo-o-nada**).
//!
//! Nadie (ni la plataforma) puede mover los fondos fuera de estas reglas: no hay función de
//! retiro discrecional. Las tareas/hitos y disputas viven en Trustless Work (off-chain del
//! contrato); los 2-de-3 firmantes ejecutan `release` tras confirmarlas.
//!
//! ⚠️ Cero PII / cero identidad on-chain: el `donor` es una **wallet efímera** (no el KYC);
//! el gating de personhood se hace off-chain por membership (funding/api).
//!
//! Activo configurable por su **SAC** (`asset`): XLM nativo en testnet, USDC en prod.
//!
//! 🔌 Punto de integración (siguiente): que el `Manager` de un vault DeFindex(Blend) sea
//! este contrato y que las donaciones se depositen en Blend para generar yield; hoy el
//! controlador custodia el capital y enforcea las reglas (el yield se modela en funding/api).

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotFundraising = 3,
    GoalNotReached = 4,
    NeedTwoOfThree = 5,
    NotASigner = 6,
    DuplicateSigner = 7,
    CampaignNotFailed = 8,
    NothingToRefund = 9,
    BadAmount = 10,
    InvalidConfig = 11,
    DeadlinePassed = 12,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum State {
    Fundraising,
    Released,
    Refunding,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub asset: Address, // SAC del activo (XLM/USDC)
    pub cause: Address, // Receiver: wallet de la causa
    pub goal: i128,
    pub deadline: u64, // timestamp (segundos)
    pub signers: Vec<Address>, // [causa, plataforma, neutral] — release 2-de-3
}

#[contracttype]
pub enum DataKey {
    Config,
    State,
    Raised,
    Contribution(Address), // wallet efímera -> aporte
}

const RELEASE_THRESHOLD: u32 = 2; // 2-de-3

/// ~1 día en testnet/mainnet (5s/ledger).
const DAY_IN_LEDGERS: u32 = 17280;
const PERSISTENT_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_TTL_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;

#[contract]
pub struct CampaignController;

#[contractimpl]
impl CampaignController {
    /// Inicializa la campaña. `signers` debe tener exactamente 3 (causa, plataforma, neutral).
    ///
    /// RT-03: exige `admin.require_auth()` para evitar front-running de la configuración
    /// (deploy + init no son atómicos). El `admin` debe ser uno de los `signers` (la
    /// plataforma típicamente), garantizando que solo una parte legítima puede configurar.
    pub fn init(
        env: Env,
        admin: Address,
        asset: Address,
        cause: Address,
        goal: i128,
        deadline: u64,
        signers: Vec<Address>,
    ) -> Result<(), Error> {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        if signers.len() != 3 || goal <= 0 {
            return Err(Error::InvalidConfig);
        }
        // El admin debe ser uno de los firmantes legítimos de la campaña.
        if !signers.contains(&admin) {
            return Err(Error::InvalidConfig);
        }
        env.storage().instance().set(
            &DataKey::Config,
            &Config { asset, cause, goal, deadline, signers },
        );
        env.storage().instance().set(&DataKey::State, &State::Fundraising);
        env.storage().instance().set(&DataKey::Raised, &0i128);
        Ok(())
    }

    /// Donación anónima: el donante (wallet efímera) aporta `amount` del activo.
    pub fn donate(env: Env, donor: Address, amount: i128) -> Result<(), Error> {
        donor.require_auth();
        if amount <= 0 {
            return Err(Error::BadAmount);
        }
        let cfg = Self::config(&env)?;
        if Self::state(env.clone()) != State::Fundraising {
            return Err(Error::NotFundraising);
        }
        // RT-04: no aceptar donaciones después del deadline. Si ya venció, la campaña
        // solo puede ir a refund (todo-o-nada); aceptar aportes tardíos podría "rescatar"
        // una campaña fallida y atrapar a los donantes previos.
        if env.ledger().timestamp() > cfg.deadline {
            return Err(Error::DeadlinePassed);
        }
        token::Client::new(&env, &cfg.asset).transfer(
            &donor,
            &env.current_contract_address(),
            &amount,
        );
        let key = DataKey::Contribution(donor.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(prev + amount));
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        let raised = Self::raised(env.clone()) + amount;
        env.storage().instance().set(&DataKey::Raised, &raised);
        Ok(())
    }

    /// Libera el capital a la causa. Requiere meta alcanzada + 2-de-3 firmas válidas.
    pub fn release(env: Env, signers: Vec<Address>) -> Result<(), Error> {
        let cfg = Self::config(&env)?;
        if Self::state(env.clone()) != State::Fundraising {
            return Err(Error::NotFundraising);
        }
        // RT-04: política de éxito = meta alcanzada ANTES (o en) del deadline. No se puede
        // liberar a la causa fondos recaudados tarde.
        if env.ledger().timestamp() > cfg.deadline {
            return Err(Error::DeadlinePassed);
        }
        let raised = Self::raised(env.clone());
        if raised < cfg.goal {
            return Err(Error::GoalNotReached);
        }
        Self::verify_signers(&env, &cfg, &signers)?;

        token::Client::new(&env, &cfg.asset).transfer(
            &env.current_contract_address(),
            &cfg.cause,
            &raised,
        );
        env.storage().instance().set(&DataKey::State, &State::Released);
        Ok(())
    }

    /// Reembolsa el aporte de `donor` (todo-o-nada) si venció el deadline sin alcanzar la meta.
    /// Permisionless: los fondos vuelven a la wallet del donante registrada.
    pub fn refund(env: Env, donor: Address) -> Result<(), Error> {
        let cfg = Self::config(&env)?;
        let state = Self::state(env.clone());
        let raised = Self::raised(env.clone());
        let failed = env.ledger().timestamp() > cfg.deadline && raised < cfg.goal;
        if state == State::Released || (state == State::Fundraising && !failed) {
            return Err(Error::CampaignNotFailed);
        }
        if state == State::Fundraising {
            env.storage().instance().set(&DataKey::State, &State::Refunding);
        }
        let key = DataKey::Contribution(donor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToRefund);
        }
        env.storage().persistent().set(&key, &0i128);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
        env.storage().instance().set(&DataKey::Raised, &(raised - amount));
        token::Client::new(&env, &cfg.asset).transfer(
            &env.current_contract_address(),
            &donor,
            &amount,
        );
        Ok(())
    }

    pub fn state(env: Env) -> State {
        env.storage().instance().get(&DataKey::State).unwrap_or(State::Fundraising)
    }
    pub fn raised(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Raised).unwrap_or(0)
    }
    pub fn contribution(env: Env, donor: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Contribution(donor)).unwrap_or(0)
    }
    pub fn goal(env: Env) -> i128 {
        Self::config(&env).map(|c| c.goal).unwrap_or(0)
    }
}

impl CampaignController {
    fn config(env: &Env) -> Result<Config, Error> {
        env.storage().instance().get(&DataKey::Config).ok_or(Error::NotInitialized)
    }

    /// Valida que `provided` sean firmantes de config, distintos, ≥ umbral, y exige su auth.
    fn verify_signers(env: &Env, cfg: &Config, provided: &Vec<Address>) -> Result<(), Error> {
        if provided.len() < RELEASE_THRESHOLD {
            return Err(Error::NeedTwoOfThree);
        }
        let mut seen: Vec<Address> = Vec::new(env);
        for s in provided.iter() {
            if !cfg.signers.contains(&s) {
                return Err(Error::NotASigner);
            }
            if seen.contains(&s) {
                return Err(Error::DuplicateSigner);
            }
            seen.push_back(s.clone());
            s.require_auth();
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
