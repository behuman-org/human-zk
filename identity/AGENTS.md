# CAPA 1 · KYC-ZK — Handoff para devs y agentes

> Doc vivo para **continuar la parte de KYC** (proof of personhood) sin perder contexto.
> Si tocás KYC, leé esto primero. Complementa el `CLAUDE.md` raíz y el `identity/README.md`.
> ⚠️ **El repo es público**: NO commitees tokens, keys ni PII. Las credenciales están con el
> owner (ver "Credenciales y deploy").

---

## 1. Qué hace la CAPA 1 (en una imagen)

Una persona prueba que es **real y única** sin revelar su PII, y queda registrada on-chain de
forma **anónima**. El puente con el resto del producto es `is_verified(address)`.

**Flujo end-to-end (orquestado por el frontend, `web/src/kyc/KycFlow.tsx`):**

1. **Conectar wallet** (`wallet.ts`, Stellar Wallets Kit) — Freighter/xBull/LOBSTR. La wallet
   NO es la identidad de plataforma (eso se deriva aparte, por anonimato).
2. **Foto del DNI** (`DocumentUpload.tsx` → `POST /document`) — el matcher valida que sea un
   documento (OCR keywords) y que tenga **cara**.
3. **Datos a mano** (`Attributes.tsx` → `POST /verify-data`) — año, nº doc, país. El matcher
   **cotea** los datos contra el OCR. ⚠️ Este cotejo es **SEÑAL BLANDA, NO bloquea** (ver §4).
4. **Escaneo de cara** (`FaceScan.tsx`, 12 frames → `POST /enroll`) — el matcher corre el
   **gate real**: match facial DNI↔selfie + liveness. Si pasa, el issuer agrega el
   `commitment` (Poseidon, generado en el device) al **árbol Merkle** y devuelve `issuerRoot`
   + camino. **Cero PII sale del device**; las imágenes se procesan en memoria y se descartan.
5. **Prueba ZK en el navegador** (`zk.ts`, snarkjs + `web/public/circuits/kyc.{wasm,zkey}`):
   prueba membresía en el árbol + nullifier + address binding + atributos (mayor de edad, país).
6. **On-chain** (`chain.ts`): `initIfNeeded` (inicializa el contrato con `issuerRoot` si hace
   falta) → `verify_and_register(address, proof, public_inputs)`. Tras confirmar,
   `is_verified(address) == true`.

**La identidad de plataforma (Capa 2)** se deriva de la **credencial guardada en el device**
(`credentialStore.ts`, localStorage `behuman.cred.*`), NO de la wallet. Sin esa credencial =
invitado. (Por eso si cambiás de browser/dispositivo, hay que rehacer el onboarding.)

---

## 2. Mapa de archivos

**Frontend (`web/src/`):**
- `kyc/KycFlow.tsx` — orquestador de los 4 pasos + estados.
- `kyc/DocumentUpload.tsx`, `Attributes.tsx`, `FaceScan.tsx`, `Consent.tsx`, `Status.tsx` — UI.
- `kyc/api.ts` — cliente del matcher (`VITE_MATCHER_URL`): `/document`, `/verify-data`, `/verify`, `/enroll`.
- `kyc/chain.ts` — invocación del contrato `kyc_verifier` (firma con wallet). `invoke()` reintenta en `txBadSeq`.
- `kyc/wallet.ts` — conexión/firma (Stellar Wallets Kit).
- `kyc/zk.ts`, `bls.ts` — generación de la prueba Groth16 (snarkjs) + encoding BLS12-381.
- `kyc/credentialStore.ts` — persistencia local de la credencial Capa 1 (no sale del browser).
- `identity/identity.ts` — `connectAndCheck`, `derivePlatformIdentity` (puente Capa1→Capa2).
- `pages/OnboardingPage.tsx`, `pages/AuthPage.tsx` — entradas al flujo.

**Matcher / issuer (`identity/issuer/`):** backend del gate. Stack: Express + `@tensorflow/tfjs-node`
(face-api) + `tesseract.js` (OCR) + `sharp` (resize).
- `matcher/server.ts` — endpoints + validación de payload (`parseDeclared`) + logs PII-free.
- `matcher/documentCheck.ts` — OCR + cotejo de datos (`crossCheckData`/`validateDocumentData`). **Ver §4.**
- `matcher/faceEngine.ts` — `loadModels`, `detectFace`, `fitImage` (downscale), `faceDistance`.
- `matcher/testnetProvider.ts` — gate: match 1:1 + liveness. `liveness.ts` — heurística de vivacidad.
- `src/index.ts` — `enrollVerifiedHuman`: gate + de-dup anti-Sybil (hash docId+pepper) + árbol Merkle.

**Contrato (`identity/contracts/kyc_verifier/src/lib.rs`):** Soroban/Rust.
- `init(admin, trusted_issuer_root, vk)`, `verify_and_register(...)`, `is_verified(address)`.
- ⚠️ `trusted_root` se fija UNA vez en `init` y **no hay `update_root`**. Errores:
  1=UntrustedIssuer, 2=AddressMismatch, 3=NullifierAlreadyUsed, 4=InvalidProof, 5=AlreadyInitialized, 6=NotInitialized.

**Circuito (`identity/circuits/`):** Circom (`kyc.circom`) + helpers Poseidon. Artefactos
servidos al frontend están **commiteados** en `web/public/circuits/`. Los Poseidon
(`identity/circuits/build/poseidon{2,3}_js/`) están gitignored (ver §3, gotcha HF).

---

## 3. Credenciales y deploy (infra real)

Ver el detalle en la memoria del owner; resumen del **dónde corre cada cosa**:

| Pieza | Dónde | Cómo redeployar |
|---|---|---|
| **Matcher** (el gate KYC) | **Hugging Face Space** `MauricioHUMAN/human-matcher` (Docker, 16GB free) → `https://mauriciohuman-human-matcher.hf.space` | Ver gotcha abajo |
| Contrato `kyc_verifier` | Stellar **testnet**: `CB4Y7MEXFZYJY3YPSDJMPCSOAY7ADI2LK66EHG4FJ5FBXJDXYWF3UEUM` | `stellar contract build` + `stellar contract deploy` con la identidad `behuman-deployer` |
| Frontend | **Vercel** proyecto `human-web` → `https://human-web-psi.vercel.app` | auto-deploy en push a `main`, o `vercel deploy --prod` desde `web/` |

**Credenciales (NO en el repo):** HF write token, Render API key, Upstash REST URL/token,
Pollar publishable key, y la deployer key de Stellar **las tiene el owner (Mauricio)**. Están
en su `.env` local (gitignored, ver `.env.example`) y en los dashboards respectivos. Pedíselas
al owner para deployar; nunca las pegues en código ni en commits.

**Env vars del frontend (Vercel) relevantes a KYC:** `VITE_MATCHER_URL`,
`VITE_KYC_VERIFIER_CONTRACT_ID`, `VITE_STELLAR_RPC_URL`, `VITE_STELLAR_NETWORK_PASSPHRASE`,
`VITE_FRIENDBOT_URL`, `VITE_POLLAR_PUBLISHABLE_KEY`. (Lista completa en `.env.example`.)

**Env vars del matcher (HF Space):** `IDENTITY_PROVIDER=testnet`, `MATCH_THRESHOLD=0.6`,
`OCR_MAX_DIM` (def 2000), `STRICT_DATA_CHECK` (def false), `DEDUP_PEPPER` (secret del Space),
`CORS_ORIGIN=*`, `FACE_MODELS_PATH`.

### ⚠️ Gotcha crítico: el matcher se deploya desde la rama `hf-space`, NO desde `main`
HF rechaza binarios en git, así que el Space se construye de una **rama recortada** (`hf-space`,
orphan: solo `identity/issuer` + `packages/*`, con los `.wasm` de Poseidon en **base64** que el
Dockerfile decodifica). Para deployar un cambio del matcher:
1. Hacé el cambio en `main` (y pusheá a `main`).
2. `git checkout hf-space` → `git checkout main -- identity/issuer/matcher/<archivos>` → commit.
3. `git push <hf-space-remote-con-token> hf-space:main` (el push a HF lo corre el owner por el token).
4. HF rebuildea solo. `git checkout main` para volver.
> El Dockerfile y el README del Space viven en la rama `hf-space`.

Otros gotchas:
- **Render auto-deploy NO dispara solo** (webhook GitHub no conectado) — los otros backends
  (platform/funding API) se deployan a mano vía la Render API.
- **Tests de tfjs (`match.test.ts`, `enroll.test.ts`) fallan en local con Node 25** (binarios
  de tfjs-node no soportan Node 25). En el Space (Node 20) andan. Los tests puros sí corren local.

---

## 4. Decisiones e invariantes (NO romper sin avisar)

- **El gate REAL de prueba de persona es el match facial DNI↔selfie + liveness** (`/enroll`).
  El OCR (Tesseract) es un heurístico ruidoso de testnet.
- **El cotejo datos↔OCR (`/verify-data`) es una señal BLANDA, NO bloquea** por defecto
  (`validateDocumentData.ok = docValid`). Solo `STRICT_DATA_CHECK=true` + contradicción fuerte
  (OCR lee claramente otro país) puede rebotar. Esto evita falsos rechazos de usuarios legítimos
  cuando el OCR no lee bien el nº (caso real en prod). Usa matching **fuzzy** (confusiones de
  dígitos, Levenshtein ≤1, nº por espacios). OCR vacío/ilegible **nunca** es mismatch.
- **Privacidad PII-free**: imágenes en memoria, nunca a disco ni a logs; los logs solo llevan
  nombres de campos y **contadores** (`ocrNums/ocrYears/contradiction`), nunca valores. El nº de
  documento se usa solo para de-dup (hash con `DEDUP_PEPPER`), nunca se persiste en claro.
- **Identidad anónima desacoplada de la wallet** (el `platformId` se deriva de la credencial ZK
  del device). No vincular wallet ↔ identidad on-chain.
- **No cambies el circuito ni el contrato** sin coordinar (rompe compatibilidad de pruebas/VK).
  Si cambiás el circuito, regenerá y re-commiteá `web/public/circuits/*` y re-deployá un contrato
  nuevo (el `trusted_root` y la VK se fijan en `init`).
- Revisión humana obligatoria de la cripto (nullifier, address binding, issuer root).

---

## 5. Correr local

```bash
npm install
cp .env.example .env            # completá VITE_MATCHER_URL=http://localhost:8787, etc.
npm run -w @behuman/issuer download-models   # baja los modelos face-api (una vez)
npm run -w @behuman/issuer serve             # matcher en :8787
npm run dev                                  # frontend Vite en :5173
# Contrato: stellar contract build && scripts/deploy_testnet.sh
```
Tests puros del matcher: `npx vitest run --root identity/issuer identity/issuer/matcher/__tests__/documentCheck.test.ts`

---

## 6. Cómo pushear a main (workflow del equipo)

- El repo es `ACRC-Zk/beHuman` (espejado en `behuman-org/human`). Se trabaja **directo sobre
  `main`** con autorización del owner (sus credenciales de GitHub). Hacé commits convencionales
  (`feat:`, `fix:`, `chore:`…). Los agentes cierran el mensaje con
  `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Antes de pushear: `npm run -w web build` (typecheck) y los tests puros del matcher.
- Tras pushear lógica del matcher, **acordate del gotcha de la rama `hf-space`** (§3) para que el
  cambio llegue al Space en producción — pushear a `main` solo NO redeploya el matcher.

## 7. Próximos pasos sugeridos (backlog KYC)
- `update_root` admin en el contrato (hoy un contrato confía 1 sola raíz → multi-usuario real
  necesita re-deploy o esa función).
- Persistir el estado del issuer (de-dup + árbol) fuera del filesystem efímero del Space
  (hoy se resetea en restart). Reusar Upstash como en los otros backends.
- Provider `renaper` real (hoy `testnetProvider` es heurístico). Liveness certificado.
