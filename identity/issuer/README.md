# issuer · KYC Issuer (MOCK)

**Test** credential issuer. Simulates the provider that performs real KYC off-chain and
registers the `commitment` (`Poseidon(attributes, secret)`) in a **Merkle tree** (**Merkle-only**
attestation, no EdDSA signature). PII arrives from client to matcher over HTTPS, processed
in memory and **not persisted or sent on-chain**.

> ⚠️ **This is a mock** — stated as such. Not real KYC. Hardened for testnet, not prod.

## Security (audit)

| Control | Status |
|---|---|
| `DEDUP_PEPPER` required in prod | Fail-fast if missing; dev uses ephemeral pepper + WARNING |
| De-dup + tree persistence | Optional Upstash Redis; file fallback with atomic write |
| Commitment verification | **Not verifiable** server-side (client-private secret) — see `SECURITY:` in `src/index.ts` |
| Enroll session | `/verify-data` opens session; `/enroll` consumes it (anti-replay) |
| Rate limiting | `/enroll` and `/verify` per IP |
| CORS | Configurable (`CORS_ORIGIN`), default `http://localhost:5173` |
| Data↔OCR cross-check | `STRICT_DATA_CHECK=true` by default |
| `IDENTITY_PROVIDER=dev` in prod | Blocked at startup |

See `identity/issuer/.env.example` for all variables.

## Usage

```bash
npm install
cp .env.example ../../.env   # or configure DEDUP_PEPPER in environment
npm run download-models -w @behuman/issuer
npm run serve -w @behuman/issuer
```

## Known risks (mock)

- Issuer **cannot** recompute `Poseidon(birthYear, countryCode, secret)` — trusts the client.
- Heuristic OCR: false positives/negatives possible; real gate is biometrics + liveness.
- In-memory rate limit: does not protect across replicas without sticky sessions / Redis.
