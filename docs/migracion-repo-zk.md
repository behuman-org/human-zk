# Migration to `behuman-org/human-zk`

## Status (Jul 2026)

| Item | Value |
|------|-------|
| Local folder | `beHuman/` |
| Git remote | **`git@github.com:behuman-org/human-zk.git`** |
| Previous repo | `behuman-org/human` — archived; superseded by `human-zk` |
| Working branch | `fix/security-audit-hardening` |
| Hackathon | **Stellar Hacks: Real-World ZK** |

---

## Local remote

```bash
cd ~/Escritorio/projects/beHuman
git remote set-url origin git@github.com:behuman-org/human-zk.git
git remote -v
```

---

## First push (empty repo on GitHub)

With commits ready on the current branch:

```bash
git push -u origin fix/security-audit-hardening:main
# or, if merged to main:
git push -u origin main
```

---

## What NOT to upload

- `.env` (secrets: `GROQ_API_KEY`, `DEDUP_PEPPER`, Stellar keys)
- `.deploy/*.secret`
- `identity/issuer/.issuer-state.json`
- `platform/api/.platform-store.json`
- `node_modules/`, local `.deploy` artifacts

Verify `.gitignore` before push.

---

## Updated references in code

- `web/src/i18n/locales/es.ts` and `en.ts` → GitHub footer
- `README.md` → repo link
- `identity/AGENTS.md` → canonical repo

---

## After push

1. `docs/hackathon-real-world-zk.md` — DoraHacks checklist.
2. 2–3 min demo video.
3. BUIDL on [DoraHacks](https://dorahacks.io/hackathon/stellar-hacks-zk/detail) with  
   `https://github.com/behuman-org/human-zk`.
4. Vercel: reconnect deploy to the new repo (if applicable).
5. Optional: README in `behuman-org/human` pointing to `human-zk`.
