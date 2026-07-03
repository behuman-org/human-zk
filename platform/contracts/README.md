# platform/contracts · opinion_board (Soroban)

On-chain anchor for the **opinion platform** (LAYER 2). Does not store content — stores
proof that *"this post was written by a registered `platformId`; its content is hash
X"*. Heavy content lives off-chain in [`../api`](../api).

> 🌉 **Bridge to Layer 1:** frontend requires `is_verified(address)` before operating in the app.
> **This contract does not call `is_verified`** — gates by ZK membership proof to issuer root
> and `platformId` registration.
>
> 📐 Design in the vault: `Plataforma de Opinión Verificada`, `Identidad Pública vs Anónima`.

## Interface

| Function | What it does |
|---|---|
| `init(admin, trusted_issuer_root, vk)` | Authenticated admin; stores issuer root + `post.circom` VK. |
| `register_identity(proof, public_inputs)` | Registers `platformId`; requires `contentHash == 0` (`InvalidRegistration` if not). |
| `post(proof, public_inputs)` | Anchors post under `platformId` + `contentHash`; requires registered identity. |
| `is_registered(platform_id)` | Query if `platformId` is registered. |
| `get_post(id) -> PostRecord` | Reads anchored post (`platform_id`, `content_hash`, timestamp). |
| `post_count()` | Post counter. |

Platform circuit public inputs: `[issuerRoot, platformId, contentHash]`.

Persistent writes use `extend_ttl`. Build: `stellar contract build` (root Cargo workspace).
