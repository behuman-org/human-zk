# issuer · Issuer KYC (MOCK)

Emisor de credenciales **de prueba**. Simula el proveedor que hace el KYC real off-chain y
registra el `commitment` (`Poseidon(atributos, secret)`) en un **árbol Merkle** (atestación
**Merkle-only**, sin firma EdDSA). La PII llega del cliente al matcher por HTTPS, se procesa
en memoria y **no se persiste ni va on-chain**.

> ⚠️ **Es un mock** — declarado como tal. No es un KYC real. Endurecido para testnet, no prod.

## Seguridad (auditoría)

| Control | Estado |
|---|---|
| `DEDUP_PEPPER` obligatorio en prod | Fail-fast si falta; dev usa pepper efímero + WARNING |
| Persistencia de-dup + árbol | Upstash Redis opcional; fallback archivo con write atómico |
| Verificación de commitment | **No verificable** server-side (secret privado del cliente) — ver `SECURITY:` en `src/index.ts` |
| Sesión de enroll | `/verify-data` abre sesión; `/enroll` la consume (anti-replay) |
| Rate limiting | `/enroll` y `/verify` por IP |
| CORS | Configurable (`CORS_ORIGIN`), default `http://localhost:5173` |
| Cotejo datos↔OCR | `STRICT_DATA_CHECK=true` por defecto |
| `IDENTITY_PROVIDER=dev` en prod | Bloqueado al iniciar |

Ver `identity/issuer/.env.example` para todas las variables.

## Uso

```bash
npm install
cp .env.example ../../.env   # o configurar DEDUP_PEPPER en el entorno
npm run download-models -w @behuman/issuer
npm run serve -w @behuman/issuer
```

## Riesgos conocidos (mock)

- El issuer **no puede** recomputar `Poseidon(birthYear, countryCode, secret)` — confía en el cliente.
- OCR heurístico: falsos positivos/negativos posibles; el gate real es biometría + liveness.
- Rate limit en memoria: no protege entre réplicas sin sticky sessions / Redis.
