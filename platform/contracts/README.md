# platform/contracts · opinion_board (Soroban)

Ancla on-chain de la **plataforma de opinión** (CAPA 2). No guarda el contenido — guarda la
prueba de que *"este post lo escribió un `platformId` registrado; su contenido es el del
hash X"*. El contenido pesado vive off-chain en [`../api`](../api).

> 🌉 **Puente con Capa 1:** el frontend exige `is_verified(address)` antes de operar en la app.
> **Este contrato no llama a `is_verified`** — gatea por prueba ZK de membresía al issuer root
> y registro de `platformId`.
>
> 📐 Diseño en la vault: `Plataforma de Opinión Verificada`, `Identidad Pública vs Anónima`.

## Interfaz

| Función | Qué hace |
|---|---|
| `init(admin, trusted_issuer_root, vk)` | Admin autenticado; guarda raíz del issuer + VK de `post.circom`. |
| `register_identity(proof, public_inputs)` | Registra `platformId`; exige `contentHash == 0` (`InvalidRegistration` si no). |
| `post(proof, public_inputs)` | Ancla post bajo `platformId` + `contentHash`; requiere identidad registrada. |
| `is_registered(platform_id)` | Consulta si el `platformId` está registrado. |
| `get_post(id) -> PostRecord` | Lee un post anclado (`platform_id`, `content_hash`, timestamp). |
| `post_count()` | Contador de posts. |

Public inputs del circuito de plataforma: `[issuerRoot, platformId, contentHash]`.

Writes persistentes usan `extend_ttl`. Build: `stellar contract build` (workspace Cargo raíz).
