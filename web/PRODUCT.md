# Product

## Register

product

## Users

Real people who want to participate in verified public conversation: publish opinions, articles, and causes without exposing PII, with the guarantee of being unique humans (proof of personhood via KYC-ZK). Usage context: they alternate between discovering the project (landing) and operating on the social platform (`/app/*`) — feed, profiles, messages, articles, causes, settings. Primary work happens in the app; the landing converts and explains the protocol.

## Product Purpose

beHuman demonstrates that a person is real and unique without revealing identity (LAYER 1 · KYC-ZK on Stellar) and enables an opinion platform where only verified humans publish with a stable pseudonym (LAYER 2). Success = clear flows from verification → participation → trust in the human badge, without crypto-bro vibes or a toxic social-network clone.

## Brand Personality

Human · Warm · Transparent. Direct, empathetic voice without hype. Proof of personhood and privacy are explained clearly, not with inflated jargon. Design conveys warmth and technical credibility at once.

## Anti-references

- **Crypto-bro:** excessive neon, FOMO, inflated metrics, dark + gold, “moon” energy.
- **Twitter/X clone:** chaotic infinite feed, engagement bait, algorithmic noise, aggressive UI.
- **Inventing visual identity from scratch** when tokens, components, and patterns already exist in the repo — always extend what exists.

## Design Principles

1. **Extend, don't reinvent** — anchor in `tokens.css`, `behuman-ui.css`, `social-ui.css`, and existing components; variants should feel native to the current system (light theme, sky accent, Plus Jakarta Sans).
2. **Human before protocol** — copy and UI prioritize the verified person and their voice; crypto/ZK appears when it adds trust, not as decoration.
3. **Landing and app with equal rigor** — same tokens, purposeful motion, and accessibility on `/` and `/app/*`; don't treat the landing as generic marketing or the app as an afterthought.
4. **Honest transparency** — declare mock issuer, matcher receiving PII over HTTPS (without
   persisting), dev-only funding, and current limits; never simulate metrics or regulated
   verification that does not exist.
5. **Calm social** — readable feed, clear hierarchy, deliberate actions; avoid density that competes for user attention.

## Accessibility & Inclusion

Aim for WCAG 2.1 AAA where reasonable; minimum AA on all text and interactive controls. `prefers-reduced-motion` already disables trail/parallax — maintain and extend to new animations. Strict visible focus (`:focus-visible`), generous contrast on muted text, touch targets ≥44px on mobile, consistent i18n (es/en) on labels and error states.
