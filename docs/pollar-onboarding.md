# Pollar — easy onboarding (create wallet with email) without breaking anonymity

> Branch: `pollar-onboarding`. Pollar (`@pollar/react`) integrates **only** as a friendly way
> for a user without a wallet to create a Stellar account with email. It **does not sign anything**
> for beHuman and **does not participate in ZK anonymity**, which is the absolute priority.

## Why Pollar is custodial (and why it cannot sustain anonymity)

Pollar email login generates and stores the key on their server and signs server-side. It is
**custodial**: Pollar knows `email → wallet`. That is why beHuman anonymity **does not depend on**
the Pollar wallet. The root of anonymity (the `secret`) is created and lives only on the device.

## The model: public identity (Pollar) ⟂ anonymous identity (ZK), with firewall

```
[Email] --Pollar(custodial)--> [Public wallet G...]      ← ENTRY identity (optional)
                                     ⟂  (firewall: no link)
[client-side secret] --Poseidon(secret, scope)--> [platformId]   ← ANONYMOUS identity
        └ ZK credential (matcher) ─ posts/opinions/donations with EPHEMERAL wallets
```

- **Pollar = wallet creation only.** After email login we obtain `walletAddress` and nothing
  else. beHuman **does not use it to sign** nor store it with `platformId`.
- **ZK credential** (from matcher: ID + face → `secret` + Merkle path) is generated
  **client-side** (`web/src/kyc/credentialStore.ts`) and enables participation.
- **Anonymous actions** (posts, opinions, donations) use **ephemeral wallets**
  (`web/src/platform/ephemeral.ts`, funded by friendbot), **never** the Pollar wallet.

## Invariants (enforced)

| # | Invariant | How |
|---|---|---|
| 1 | `secret` generated/stored client-side only; `platformId` derived in browser | Pollar flow uses `KycFlow mode="credential"` → `randomSecret()` + `computeCommitment` + enroll, same as today. Secret never sent. |
| 2 | Pollar wallet is public entry only; anonymous actions don't use it | Pollar only creates wallet; posts/opinions/donations still use ephemerals + ZK proof. |
| 3 | Ephemerals funded independently (friendbot), never from Pollar | `ephemeral.ts` unchanged; no Pollar → ephemeral transfer. |
| 4 | Email never touches beHuman backend nor maps to `platformId` | Email lives only in Pollar (their flow). beHuman does not store email or Pollar wallet with platformId. |
| 5 | ADDS, does not replace | Stellar Wallets Kit (Freighter…) intact for crypto users; Pollar is the email route. |

## What Pollar signs in beHuman

**Nothing.** Product decision: Pollar is friendly wallet creation only. Layer 1 on-chain registration
(`verify_and_register`, a Soroban invoke requiring owner signature)
**is not done via Pollar** — anonymous participation does not need it (gated by ZK credential
+ membership proof, not `is_verified(address)`). If on-chain registration under the Pollar wallet
were desired in the future, validate that their SDK signs Soroban XDR
(today exposes `signAndSubmitTx`/`signTx` but Soroban support is not documented).

## Implementation

- `web/src/identity/pollar.tsx`: `PollarRoot` (mounts `<PollarProvider client={{apiKey, stellarNetwork:'testnet'}}>` **only if** `VITE_POLLAR_PUBLISHABLE_KEY` exists) + `PollarEmailLogin` (button opening Pollar email/OTP modal and notifying when wallet is created).
- `web/src/main.tsx`: wraps app in `PollarRoot`.
- `web/src/pages/AuthPage.tsx`: on "sign up" adds **"Create account with email"** (in addition to "Connect wallet"). After wallet creation → `/onboarding?via=email`.
- `web/src/kyc/KycFlow.tsx`: new `mode="credential"` → runs matcher and creates ZK credential **without** connecting wallet or on-chain registration.
- `web/src/pages/OnboardingPage.tsx`: `?via=email` → `mode="credential"` + honest notice.

## Configuration

`.env` → `VITE_POLLAR_PUBLISHABLE_KEY=` (**testnet** key, prefix `pub_testnet_`). Empty =
email option **hidden** (app works the same with Freighter). Network defined by key prefix.

## Verification (testnet)

1. Without wallet: "Create account with email" → Pollar modal (email + code) → wallet created.
2. Onboarding (`?via=email`): ID + face → **client-side ZK credential** (no signing, no on-chain).
3. Anonymous participation: opinions/posts/donations with `platformId` + ephemerals.
4. Verify **no** transfer from Pollar wallet to any ephemeral
  (ephemerals funded by friendbot) → no Pollar → ephemeral → opinion trail.
5. Freighter flow still works. beHuman does not store email or `secret`.

## Honest UX

We do not claim "nothing is stored anywhere" (Pollar stores their part). Copy is:
*"Your email creates your wallet, but it is never linked to your anonymous identity."*
