# @behuman/sdk · Cliente / Prover

Lógica compartida que orquesta el flujo del lado del usuario:
**credencial → genera la prueba ZK (en el navegador, WASM) → arma y envía la tx Stellar**.
La consume el frontend `web/` y los scripts de demo.

> 📐 Ver `Flujo de KYC` (Fases 2 y 3) en la vault. El `secret` ZK nunca sale del dispositivo;
> la PII del gate va al issuer mock (no on-chain).

## API (Capa 1 · KYC)

| Función | Qué hace |
|---|---|
| `generateProof(credential, address)` | Witness + prueba Groth16 BLS12-381 (`kyc.circom`). |
| `nullifierField(secret)` | `Poseidon(secret)` — nullifier global anti-Sybil. |
| `addressHashField(address)` | Hash de address para binding (public input). |
| `verifyProofLocally(gen, vk)` | Sanity check off-chain con snarkjs. |
| `encodeVerificationKey(vk)` | VK snarkjs → ScVal Soroban. |
| `initVerifier(cfg, signerSecret, issuerRoot, vk)` | Tx `init` del contrato. |
| `buildVerifyArgs(address, gen)` | ScVal para `verify_and_register`. |
| `verifyAndRegister(cfg, signerSecret, gen)` | Firma y envía registro on-chain. |
| `isVerified(cfg, address)` | Consulta `is_verified` por simulación. |
| `encodeProof(proof)` / `fieldTo32` / `g1ToBytes` / `g2ToBytes` | Encoding BLS12-381 para Soroban. |

Constante: `PUBLIC_SIGNALS_ORDER = ["commitment", "nullifier", "issuerRoot", "addressHash"]`.

## API (Capa 3 · Funding)

| Módulo | Qué hace |
|---|---|
| `fundingOpinion.ts` | `generateFundingOpinionProof`, `verifyFundingOpinionProof`, binding scope/nullifier. |
| `defindex.ts` / `trustlesswork.ts` | Clientes real/dev (solo dev operativo en la API hoy). |
| `fundingAuth.ts` | Firmas de acciones de validadores (release 2-de-3). |

## Stack

- `snarkjs` + Circom WASM (`--prime bls12381`).
- `@stellar/stellar-sdk` para transacciones Soroban.

```bash
npm install
npm run build
```
