# circuits · ZK Circuit (Circom)

Circuit that proves *"I have a valid KYC credential issued by a trusted issuer and
I satisfy the predicate (over 18 + allowed country)"* — **without revealing PII**.

> 📐 Full design in the vault: `Diseño del Circuito ZK` and `Modelo de Datos`.
> Toolchain: **Circom + Groth16**.

## ⚠️ Engineering decisions (require human crypto review)

1. **BLS12-381 curve** (`--prime bls12381`), not Circom's default BN254. The
   on-chain verifier is the **official** `groth16_verifier` from soroban-examples, using
   BLS12-381 host functions (CAP-0059). Native BN254/Poseidon remain
   CAP-0074/0075 (proposals, not available).
2. **Issuer attestation = Merkle inclusion (Poseidon)**, not EdDSA: circomlib
   `eddsaposeidon` depends on BabyJubJub, defined over BN254 field and invalid under
   bls12381. Merkle is curve-agnostic and matches public signal `issuerRoot`. The vault
   already lists Merkle as evolution of the signature scheme.
3. **Poseidon with circomlib constants (from BN254) reused on BLS12-381**: valid field
   elements, but not "standard Poseidon for bls12381". Acceptable for MVP/demo; production
   should use field-specific parameters.
4. **`currentYear` is compile-time constant** (2026) in MVP; in production it must be a
   public input validated against the ledger.

## Public signals (order, contract ↔ proof)

```
[ commitment, nullifier, issuerRoot, addressHash ]
```

- `commitment = Poseidon(birthYear, countryCode, secret)` — output.
- `nullifier  = Poseidon(secret, addressHash)` — output (anti-replay + binding).
- `issuerRoot` — Merkle root from credential path — output.
- `addressHash` — public input; bound to Stellar address (validated on-chain).

Private: `birthYear`, `countryCode`, `secret`, `pathElements[]`, `pathIndices[]`.

## Structure

```text
circuits/
├── src/kyc.circom              # main circuit
├── scripts/
│   ├── compile.sh              # circom -> r1cs / wasm / sym (prime bls12381)
│   ├── setup.sh                # powers of tau + zkey (bls12-381) + verification_key.json
│   ├── prove.sh                # witness -> proof.json + public.json (verify with snarkjs)
│   ├── gen_input.mjs           # writes input.json (receives contract addressHash)
│   └── gen_testdata.mjs        # build/*.json -> kyc_verifier/src/testdata.rs (tests)
└── build/                      # artifacts (gitignored)
```

## Usage

```bash
npm install
bash scripts/compile.sh
POWER=13 bash scripts/setup.sh

# addressHash bound to an address (computed by contract; see kyc_verifier/README):
node scripts/gen_input.mjs <addressHashDecimal>
bash scripts/prove.sh           # generates and verifies proof with snarkjs
node scripts/gen_testdata.mjs   # dumps artifacts to contract tests
```

## Requirements

- `circom` ≥ 2.2 (built from source) and `snarkjs` ≥ 0.7 — see `Setup del Entorno`.
- `circomlib` — installed with `npm install`.

> ⚠️ Trusted setup in `setup.sh` is **demo** (local entropy). Production requires a real
> multi-party ceremony.
