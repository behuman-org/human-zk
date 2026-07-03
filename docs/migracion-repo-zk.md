# Migración a `behuman-org/human-zk`

## Estado (jul 2026)

| Item | Valor |
|------|-------|
| Carpeta local | `beHuman/` |
| Remote git | **`git@github.com:behuman-org/human-zk.git`** |
| Repo anterior | `behuman-org/human` — archivado; superseded por `human-zk` |
| Rama de trabajo | `fix/security-audit-hardening` |
| Hackathon | **Stellar Hacks: Real-World ZK** |

---

## Remote local

```bash
cd ~/Escritorio/projects/beHuman
git remote set-url origin git@github.com:behuman-org/human-zk.git
git remote -v
```

---

## Primer push (repo vacío en GitHub)

Con commits listos en la rama actual:

```bash
git push -u origin fix/security-audit-hardening:main
# o, si mergeaste a main:
git push -u origin main
```

---

## Qué NO subir

- `.env` (secretos: `GROQ_API_KEY`, `DEDUP_PEPPER`, claves Stellar)
- `.deploy/*.secret`
- `identity/issuer/.issuer-state.json`
- `platform/api/.platform-store.json`
- `node_modules/`, artefactos locales de `.deploy`

Verificar `.gitignore` antes del push.

---

## Referencias actualizadas en código

- `web/src/i18n/locales/es.ts` y `en.ts` → footer GitHub
- `README.md` → enlace al repo
- `identity/AGENTS.md` → repo canónico

---

## Después del push

1. `docs/hackathon-real-world-zk.md` — checklist DoraHacks.
2. Video demo 2–3 min.
3. BUIDL en [DoraHacks](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) con  
   `https://github.com/behuman-org/human-zk`.
4. Vercel: reconectar deploy al nuevo repo (si aplica).
5. Opcional: README en `behuman-org/human` apuntando a `human-zk`.
