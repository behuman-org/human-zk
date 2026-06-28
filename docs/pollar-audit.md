# Auditoría — integración de Pollar (onboarding por email/Google)

Revisión del funcionamiento correcto y del respeto a los invariantes ZK de la integración de
Pollar (rama `pollar-onboarding`). Foco: que Pollar **solo cree la wallet** y que el anonimato
**nunca** dependa de él.

## Veredicto

✅ **Aprobada.** La integración respeta los 5 invariantes. Pollar está **contenido** (3 archivos),
se usan **solo** `openLoginModal` + `isAuthenticated` (nunca `walletAddress`, `sendPayment` ni
firma), el email no toca beHuman, y las acciones anónimas siguen por credencial ZK + efímeras.
Hay 2 observaciones menores (no bloquean) y notas de config.

## Invariantes — verificación

| # | Invariante | Resultado | Evidencia |
|---|---|---|---|
| 1 | `secret`/`platformId` solo client-side | ✅ | `KycFlow.processCredentialOnly` usa `randomSecret()` + `computeCommitment` + `enroll` → `saveCredential` (credentialStore). El secret nunca se envía. |
| 2 | Pollar = wallet de entrada; las anónimas no la usan, Pollar no firma | ✅ | `usePollar()` solo lee `openLoginModal` + `isAuthenticated`. **No** se usa `walletAddress`, `sendPayment`, `signAndSubmitTx` ni `signTx` en ningún lado. |
| 3 | Efímeras fondeadas por friendbot, nunca desde Pollar | ✅ | `platform/ephemeral.ts` usa friendbot; no hay transferencia desde la wallet de Pollar. |
| 4 | El email no toca beHuman; sin mapeo email↔platformId | ✅ | El email vive solo en el modal/SDK de Pollar. `walletAddress` nunca se guarda junto al `platformId`; no se envía a `/content`, `/articles`, `/campaigns`, `/profile`. |
| 5 | Se SUMA a Freighter (no reemplaza) | ✅ | Freighter (Wallets Kit) intacto en `handleLogin`. Pollar gateado por `POLLAR_ENABLED` (si no hay key, queda oculto y la app funciona igual). |

## Superficie de la integración (contenida)

- `web/src/identity/pollar.tsx` — `PollarRoot` (provider) + `PollarEmailLogin` (modal email/Google).
- `web/src/main.tsx` — monta `PollarRoot`.
- `web/src/pages/AuthPage.tsx` — botón "Crear cuenta con Google o email" → `/onboarding?via=email`.
- `web/src/kyc/KycFlow.tsx` — `mode="credential"`: matcher → credencial ZK, **sin** wallet/on-chain.
- `web/src/pages/OnboardingPage.tsx` — `?via=email` → modo credencial + aviso de firewall.

## Funcionamiento correcto

- **Login**: funciona (verificado en testnet con la `pub_testnet_…`). El `403/CORS` previo era por
  usar una key `pat_` (Personal Access Token) en vez de la publishable — resuelto.
- **Build**: `typecheck` 0 errores · `vite build` verde.
- **Credential mode**: confirmado que no toca address ni on-chain; el flujo es 100% client-side.

## Observaciones menores (no bloquean)

- **O1 · UX post-login (media-baja):** tras el login, la navegación a `/onboarding` dispara en
  `isAuthenticated`, pero Pollar puede seguir en estado `creating` (crear la wallet custodial) →
  el usuario ve el "Loading..." del modal de Pollar encima. Es provisioning de Pollar (no un bug
  de beHuman). Si se cuelga, suele faltar la **gas wallet** de la app en el dashboard de Pollar
  (crea/patrocina la wallet). Mejora posible: navegar/avanzar al onboarding sin esperar la wallet
  (no se necesita para el flujo anónimo).
- **O2 · Override de config (baja):** `PollarRoot` pasa `appConfig` forzando `emailEnabled`+`google`
  → **omite** el `/applications/config` remoto (pierde estilos reales y puede mostrar un método no
  habilitado server-side). Recomendado: con los métodos ya activados en el dashboard, **quitar el
  override** y dejar que la config remota maneje qué proveedores se muestran.

## Notas de seguridad

- **N1 · Rotar la secret key:** durante el setup se compartió una `sec_testnet_…` por chat. No se
  usa en el cliente (nuestro flujo no la necesita) y NO está en el repo, pero **debe rotarse**.
- **N2 · Key correcta:** el navegador usa la **publishable** `pub_testnet_…` (segura, pública), en
  `.env` (gitignored). La secret nunca va al cliente.
- **N3 · Correlación por timing (informativo):** Pollar conoce `email→wallet→hora`; beHuman conoce
  `platformId→hora`. No hay identificador compartido (firewall OK), pero la correlación temporal es
  una limitación general ya documentada (mitigación futura: separar en el tiempo KYC ↔ actividad).

## Conclusión

La integración **cumple su objetivo** (onboarding fácil por email/Google) **sin sacrificar el
anonimato ZK**. Ningún hallazgo compromete los invariantes.

### Mejoras aplicadas (post-auditoría)

- **O1 (revisado) ✅:** decisión de producto: el usuario **sí quiere que Pollar genere la
  wallet** antes de arrancar el KYC. Ahora `PollarEmailLogin` espera a `walletAddress` (wallet
  realmente provisionada) y recién ahí avanza al KYC. Para no dejar a nadie atascado si el
  provisioning se cuelga, tras 25 s ofrece **"Continuar al KYC"** igual (la identidad anónima
  no depende de esa wallet). Reemplaza el O1 previo (navegar solo con `isAuthenticated`).
- **O2 ✅:** se quitó el override de `appConfig`. El modal usa la **config real** del dashboard
  (métodos habilitados + estilos/logo de la app).

### ⚠️ Requisito de dashboard de Pollar (causa del "Loading..." colgado)

El "Loading..." infinito tras iniciar sesión **no es un bug del código**: es Pollar
provisionando la wallet custodial. Según sus docs, la creación requiere que en el **dashboard de
Pollar** estén configurados/fondeados:

- **Funding wallet** con XLM (≈1–2.5 XLM por usuario para reservas).
- **Gas wallet** con XLM (cubre fees de las tx de creación).
- Al menos **un asset/trustline** en *Wallet Infrastructure → Tokens/Trustlines*.
- **Funding Mode** = *Immediate* (*Configuration → Funding Mode*) para que la wallet quede
  activa al login (~2 s).

Sin eso, `walletAddress` nunca se puebla y el modal queda en "Loading...". Diagnóstico:
*Dashboard → Observability → Logs*. (El flujo KYC anónimo de beHuman **no** necesita esa
wallet; por eso ofrecemos el botón de continuar igual.)
