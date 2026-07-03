# Audit — Pollar integration (email/Google onboarding)

Review of correct operation and respect for ZK invariants in the Pollar integration
(`pollar-onboarding` branch). Focus: Pollar **only creates the wallet** and anonymity
**never** depends on it.

## Verdict

✅ **Approved.** The integration respects all 5 invariants. Pollar is **contained** (3 files),
uses **only** `openLoginModal` + `isAuthenticated` (never `walletAddress`, `sendPayment`, or
signing), email never touches beHuman, and anonymous actions still go through ZK credential + ephemerals.
Two minor observations (non-blocking) and config notes.

## Invariants — verification

| # | Invariant | Result | Evidence |
|---|---|---|---|
| 1 | `secret`/`platformId` client-side only | ✅ | `KycFlow.processCredentialOnly` uses `randomSecret()` + `computeCommitment` + `enroll` → `saveCredential` (credentialStore). Secret never sent. |
| 2 | Pollar = entry wallet; anonymous actions don't use it, Pollar doesn't sign | ✅ | `usePollar()` only reads `openLoginModal` + `isAuthenticated`. **No** use of `walletAddress`, `sendPayment`, `signAndSubmitTx`, or `signTx` anywhere. |
| 3 | Ephemerals funded by friendbot, never from Pollar | ✅ | `platform/ephemeral.ts` uses friendbot; no transfer from Pollar wallet. |
| 4 | Email never touches beHuman; no email↔platformId mapping | ✅ | Email lives only in Pollar modal/SDK. `walletAddress` never stored with `platformId`; not sent to `/content`, `/articles`, `/campaigns`, `/profile`. |
| 5 | ADDS to Freighter (does not replace) | ✅ | Freighter (Wallets Kit) intact in `handleLogin`. Pollar gated by `POLLAR_ENABLED` (without key, hidden and app works the same). |

## Integration surface (contained)

- `web/src/identity/pollar.tsx` — `PollarRoot` (provider) + `PollarEmailLogin` (email/Google modal).
- `web/src/main.tsx` — mounts `PollarRoot`.
- `web/src/pages/AuthPage.tsx` — "Create account with Google or email" button → `/onboarding?via=email`.
- `web/src/kyc/KycFlow.tsx` — `mode="credential"`: matcher → ZK credential, **no** wallet/on-chain.
- `web/src/pages/OnboardingPage.tsx` — `?via=email` → credential mode + firewall notice.

## Correct operation

- **Login**: works (verified on testnet with `pub_testnet_…`). Previous `403/CORS` was from
  using a `pat_` key (Personal Access Token) instead of publishable — resolved.
- **Build**: `typecheck` 0 errors · `vite build` green.
- **Credential mode**: confirmed it does not touch address or on-chain; flow is 100% client-side.

## Minor observations (non-blocking)

- **O1 · Post-login UX (medium-low):** after login, navigation to `/onboarding` triggers on
  `isAuthenticated`, but Pollar may still be in `creating` state (creating custodial wallet) →
  user sees Pollar modal "Loading..." overlay. This is Pollar provisioning (not a beHuman bug).
  If it hangs, usually missing **gas wallet** for the app in Pollar dashboard
  (create/sponsor wallet). Possible improvement: navigate/advance to onboarding without waiting for wallet
  (not needed for anonymous flow).
- **O2 · Config override (low):** `PollarRoot` passed forced `appConfig` with `emailEnabled`+`google`
  → **skips** remote `/applications/config` (loses real styles and may show a server-disabled method).
  Recommended: with methods already enabled in dashboard, **remove override**
  and let remote config handle which providers show.

## Security notes

- **N1 · Rotate secret key:** during setup a `sec_testnet_…` was shared via chat. Not used in
  client (our flow doesn't need it) and NOT in repo, but **must be rotated**.
- **N2 · Correct key:** browser uses **publishable** `pub_testnet_…` (safe, public), in
  `.env` (gitignored). Secret never goes to client.
- **N3 · Timing correlation (informational):** Pollar knows `email→wallet→time`; beHuman knows
  `platformId→time`. No shared identifier (firewall OK), but temporal correlation is a
  general limitation already documented (future mitigation: separate KYC ↔ activity in time).

## Conclusion

The integration **meets its goal** (easy email/Google onboarding) **without sacrificing ZK
anonymity**. No finding compromises the invariants.

### Improvements applied (post-audit)

- **O1 (revised) ✅:** product decision: user **does want Pollar to generate the
  wallet** before starting KYC. Now `PollarEmailLogin` waits for `walletAddress` (wallet
  actually provisioned) before advancing to KYC. To avoid users stuck if provisioning hangs, after
  25 s offers **"Continue to KYC"** anyway (anonymous identity does not depend on that wallet).
  Replaces previous O1 (navigate on `isAuthenticated` only).
- **O2 ✅:** removed `appConfig` override. Modal uses **real** dashboard config
  (enabled methods + app styles/logo).

### ⚠️ Pollar dashboard requirement (cause of hung "Loading...")

Infinite "Loading..." after login **is not a code bug**: Pollar is provisioning the custodial wallet.
Per their docs, creation requires in the **Pollar dashboard**:

- **Funding wallet** with XLM (~1–2.5 XLM per user for reserves).
- **Gas wallet** with XLM (covers creation tx fees).
- At least **one asset/trustline** in *Wallet Infrastructure → Tokens/Trustlines*.
- **Funding Mode** = *Immediate* (*Configuration → Funding Mode*) so wallet is
  active on login (~2 s).

Without that, `walletAddress` never populates and modal stays on "Loading...". Diagnosis:
*Dashboard → Observability → Logs*. (beHuman anonymous KYC flow **does not** need that
wallet; hence the continue button anyway.)
