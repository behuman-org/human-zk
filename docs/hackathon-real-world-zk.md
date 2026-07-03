# Stellar Hacks: Real-World ZK — guía de presentación

> Hackathon: [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) (DoraHacks)  
> Repo: **[github.com/behuman-org/human-zk](https://github.com/behuman-org/human-zk)**  
> Enfoque: **identity proofs** — proof of personhood con ZK verificado on-chain en Soroban.

Anteriormente el proyecto se presentó en **Stellar PULSO Hackathon**. Esta guía es para la
entrega **ZK Real-World** (repo nuevo o rama limpia + README honesto).

---

## Qué presentamos (pitch en una frase)

**human** demuestra que una persona es real y única sin revelar PII: prueba Groth16 (Circom,
curva **BLS12-381**) verificada en el contrato `kyc_verifier`, puente `is_verified(address)`,
y plataforma de opinión con identidad anónima `platformId` (circuito `post.circom`).

El ZK es **load-bearing**: sin la prueba no hay registro on-chain ni publicación anónima.

---

## Requisitos de la hackathon vs. nuestro repo

| Requisito | Estado | Notas |
|-----------|--------|-------|
| Repo open-source + README claro | ✅ | `README.md`, `CLAUDE.md`, `docs/` |
| Demo video 2–3 min | ⬜ | Grabar flujo: KYC → `is_verified` → post con `platformId` |
| ZK integrado en Stellar | ✅ | `verify_and_register` + `opinion_board` en testnet |
| ZK load-bearing | ✅ | Groth16 on-chain; no es decorativo |
| Honestidad sobre mocks | ✅ | Issuer biométrico mock; funding dev-only; declarar en README |

---

## Stack ZK (para jurados)

- **Toolchain:** Circom 2 + Groth16, curva **BLS12-381** (`--prime bls12381`)
- **Verificador on-chain:** `groth16_verifier` oficial (host functions CAP-0059)
- **Primitivas:** Poseidon (Merkle, commitment, nullifier global `Poseidon(secret)`)
- **Capa 1:** `identity/circuits/kyc.circom` → `kyc_verifier`
- **Capa 2:** `platform/circuits/post.circom` → `opinion_board`

> No usamos BN254 nativo de Protocol 25/26; elegimos BLS12-381 por compatibilidad con el
> verificador Soroban de referencia. Documentado en `identity/circuits/README.md`.

---

## Contratos testnet (referencia demo)

Actualizar tras cada redeploy. Ver `identity/AGENTS.md` y `docs/capa-2-plataforma.md`.

| Contrato | Uso |
|----------|-----|
| `kyc_verifier` | `verify_and_register`, `is_verified` |
| `opinion_board` | `register_identity`, `post` con proof |

---

## Checklist pre-submit (DoraHacks)

- [ ] Repo público con README actualizado (hackathon ZK, no Pulso)
- [ ] Video demo subido (YouTube/Loom) — link en README
- [ ] `.env.example` completo; sin secretos en el repo
- [ ] `web/public/circuits/*` commiteados o script de build documentado
- [ ] Declarar: issuer mock, matcher remoto vs local, funding `dev` only
- [ ] Link a frontend demo (Vercel) si aplica
- [ ] BUIDL en DoraHacks con repo + video

---

## Demo recomendada (guión ~2 min)

1. Landing → “Verificá que sos humano” (Capa 1).
2. Wallet testnet → DNI + cara → prueba en navegador → tx `verify_and_register`.
3. Stellar Expert: `is_verified == true`.
4. Entrar a `/app` → registrar `platformId` → publicar opinión (ancla on-chain + feed).
5. Mencionar nullifier global anti-Sybil y que la wallet KYC no aparece en el post.

---

## Enlaces útiles

- [Hackathon detail](https://dorahacks.io/hackathon/stellar-hacks-zk/detail)
- [Stellar ZK skills](https://skills.stellar.org) — zk-proofs
- [LLMs Stellar](https://developers.stellar.org/llms.txt)
