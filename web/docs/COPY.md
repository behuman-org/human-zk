# Landing copy — beHuman

Text centralized in `src/i18n/locales/{es,en}.ts`. Aligned with `README.md`, `CLAUDE.md`, and Obsidian vault (`obsidian-vault-zk`).

## Sections

| Section | ID | Content |
|---------|-----|-----------|
| Hero | — | What beHuman is, proof of personhood, stack |
| Architecture | `#capas` | LAYER 1 identity + LAYER 2 platform, `is_verified` bridge |
| KYC flow | `#como-funciona` | 4 phases: issuance → proof → verification → consumption |
| Platform | `#plataforma` | opinion_board, api, pseudonym, post types |
| Curation | `#curacion` | AI agent + human moderation, anti-censorship principle |
| Protocol | — | Design stats (2 layers, 1 bridge, 0 PII on-chain, 4 phases) |
| Compare | `#compare` | 7 rows traditional vs beHuman |

## Required disclaimers

- **Mock issuer** — stated in hero flow step 01 and footer
- **Stellar Hacks: Real-World ZK** — link in footer and auth disclaimer (`siteMeta.hackathon`)

## Edit copy

1. Modify `src/i18n/locales/es.ts` and `en.ts`
2. Update this file if section structure changes
3. Run `npm run test --workspace @behuman/web` if texts used in tests change
