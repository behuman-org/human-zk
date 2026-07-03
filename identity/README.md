# identity · LAYER 1 — Zero-Knowledge KYC

The **core** of beHuman: *proof of personhood*. A person verifies their identity once
(off-chain) and obtains a **unique, anonymous** on-chain identity. This layer exposes the bridge
everything else uses: **`is_verified(address)`**.

> 📐 Design in the vault: `IDEA`, `Prueba de Persona Única`, `Flujo de KYC`,
> `Diseño del Circuito ZK`, `Contrato Verificador (Soroban)`, `Modelo de Datos`.

| Folder | What it is |
|---|---|
| [`circuits/`](./circuits/) | Circom circuit (`kyc.circom`) that proves the KYC credential. |
| [`contracts/kyc_verifier/`](./contracts/kyc_verifier/) | Soroban contract: `verify_and_register` + `is_verified`. **Bridge to LAYER 2.** |
| [`issuer/`](./issuer/) | **Mock** KYC issuer that signs test credentials. |

> Rust contracts are members of the root Cargo workspace (`/Cargo.toml`).
