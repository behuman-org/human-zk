# CAPA 2 — Plataforma de opinión (anónima por ZK)

> Vault: `Plataforma de Opinión Verificada`, `Identidad Pública vs Anónima`,
> `Diseño del Circuito ZK`, `Decisiones técnicas y trade-offs`, `Stack de Privacidad en Stellar`.

## Qué hace

Un humano verificado (Capa 1) participa en la plataforma **sin revelar nada** de su
identidad real ni su address de KYC:

1. **Identidad anónima**: registra su `platformId = Poseidon(secret, scope)` probando con ZK
   que su commitment pertenece al árbol del issuer (`issuerRoot`). Es su seudónimo
   persistente, único por humano, **incorrelacionable** con el address/PII.
2. **Perfil + username**: username libre (mutable), off-chain en `platform/api`, keyed por
   `platformId`. **Handle** público = últimos 5 caracteres del `platformId`.
3. **Post**: publica una opinión gateada por una prueba ZK que ata `(issuerRoot, platformId,
   contentHash)`; contenido off-chain + ancla on-chain bajo `platformId`.
4. **Feed**: lista de posts por seudónimo.

## Invariantes ZK (no negociables) — cómo se cumplen

| Invariante | Implementación |
|---|---|
| El address del KYC nunca se usa/revela | La identidad es `platformId` (del secret). El contrato no tiene `Address`. El fee lo paga una **cuenta efímera** (friendbot), no la wallet del KYC. |
| Identidad = `Poseidon(secret, scope)` | `platformId` es output del circuito; determinístico, único por humano, unidireccional. |
| Gate por pertenencia (no `is_verified`) | El circuito prueba inclusión Merkle del commitment bajo `issuerRoot`; el contrato exige `issuerRoot` de confianza. Reutiliza la `Capa1Credential` del device. |
| Post ata `contentHash` (anti-replay) | `contentHash` es public input bound en el circuito; el contrato rechaza `(platformId, contentHash)` repetido. |
| Fee payer ≠ address del KYC | Cuenta efímera aleatoria fondeada por friendbot firma las tx. |

**Anti-Sybil**: `register_identity` rechaza un `platformId` ya registrado (mismo humano →
mismo `platformId`).

## Arquitectura

```
[web/platform] credencial Capa 1 (localStorage)
   -> platformId + prueba ZK (post.circom, en el navegador)
   -> cuenta efímera (friendbot)  -> opinion_board.register_identity / post
   -> platform/api (username + contenido off-chain, keyed por platformId)
```

- `platform/circuits/src/post.circom` (BLS12-381): inclusión Merkle + `platformId` + binding
  de `contentHash`. Reutiliza los templates de `identity/circuits` (misma curva).
- `platform/contracts/opinion_board`: verifica Groth16 (mismo patrón que `kyc_verifier`),
  guarda el `issuerRoot` de confianza, y ancla `PostRecord { platform_id, content_hash, timestamp }`.
- `platform/api`: perfil + contenido + feed (JSON store, cero PII/address).
- `web/src/platform`: pruebas en el navegador (snarkjs) + cuenta efímera + firma local.

## Imposibilidad de linkear

`post ↔ address KYC ↔ PII` es criptográficamente imposible:
- `platformId = Poseidon(secret, scope)` es unidireccional (no se puede invertir a `secret`).
- El `secret` nunca sale del device; on-chain sólo van `platformId / contentHash / proof`.
- El fee payer es una cuenta efímera aleatoria, sin relación con el address del KYC.

## Contratos desplegados (testnet)
- opinion_board (e2e, init incluido): `CD2XVZTQTQZL3LU4E6PH7EXDGV2VX6KNAN2L3TROKJAR6U45SC2K2T6M`
- opinion_board (demo front, init desde el front): `CAZOMMMZSKI2EHH6PHP53NJ3K4DGAJ4JBRAR4HPVNN2QJ4VIF7WJKOQK`

> ⚠️ `trusted_issuer_root` se fija en `init` (un contrato por demo; mismo límite que Capa 1).

## Reproducir

```bash
# circuito de plataforma (una vez)
(cd platform/circuits && npm install && bash scripts/compile.sh && POWER=13 bash scripts/setup.sh)

# on-chain por SDK (deploy + init + register + post) — probado: post bajo platformId
bash scripts/deploy_platform.sh
CONTRACT_ID=<id> SIGNER_SECRET=<secret efímero> RPC_URL=https://soroban-testnet.stellar.org \
  NETWORK_PASSPHRASE="Test SDF Network ; September 2015" npx tsx scripts/e2e-platform.ts

# demo desde el FRONT:
bash scripts/deploy_platform.sh            # -> VITE_OPINION_BOARD_CONTRACT_ID=<id> en .env
npm run serve -w @behuman/api              # :8788
npm run dev   -w @behuman/web              # :5173 -> "Plataforma de opinión (anónima)"
```

Requisito del front: tener una `Capa1Credential` en el device (validarse en Capa 1 primero).

## Tests
```bash
cargo test -p opinion_board   # 9/9 (verify, register, anti-Sybil, post, anti-replay, init)
```
`platform/circuits` prueba con snarkjs; `vite build` bundlea el front.

## Próximo paso (no en esta iteración)
- **Curaduría** (`platform/curation`): agentes validadores + moderación.
- Unicidad de username, modo público (opt-in), lectura sólo-verificados.
