# Repository instructions

These instructions apply to the entire repository. Component-specific rules below apply only to the named component and must not be projected onto unrelated apps or services.

## Repository boundaries

- Treat `MC-Micro/pal-tool` as the public technical home for Pal Data Core, canonical Palworld domains, shared engines and the applications/services built on them.
- Keep the public Breeding API implementation isolated under `services/breeding-api/`.
- Keep the planned private Breeder AI runtime isolated in its own app/package area. The target root is `apps/breeder-ai/`; Phase 0 may refine its internal layout.
- Keep the frozen historical Palworld Passives PWA isolated under `apps/passives-pwa/` as an independent legacy side app.
- Do not rewrite or reactivate the Passives PWA merely to support Breeder AI or the Breeding API. Any renewed hosting requires an explicit service-worker scope, manifest, cache, hosting-path and installed-client migration review.
- Prefer shared canonical Data Core/domain artifacts over duplicated hand-maintained game truth. Product/editorial overlays remain separate from canonical game facts.
- Treat generated API indexes and consumer indexes as derived build artifacts, never as canonical Palworld identity.
- `MC-Micro/pal-vault` and `MC-Micro/pal-control` are separate repositories and must not become required build/runtime dependencies of this repository.

For Breeder AI work, read `docs/BREEDER_AI_PREBUILD_CONTRACTS.md` before implementation.

## Controlled evolution of rules and architecture

Repository rules, architecture decisions and technical handoffs describe the best validated baseline for the product and technical state in which they were written. They are binding for that baseline, but they are not immutable laws and must not be used to force future product work to remain inside a superseded architecture.

Rules exist to protect continuity, safety, consistency and validated invariants while still allowing controlled technical evolution. Therefore:

- do not ignore or bypass an existing rule merely because it is inconvenient;
- do not preserve an old rule merely because it was documented earlier if the product scope, technical capabilities, requirements or architecture have materially changed;
- scope component-specific rules as narrowly as the actual component/runtime boundary requires;
- when a materially better architecture conflicts with an existing rule, review the rule explicitly and change, replace or narrow it in the same deliberate change set before relying on the new architecture;
- document why the previous rule no longer fits, what replaces it, which safety properties must remain, and the effects on migrations, compatibility, tests, rollback and deployment;
- preserve old decisions as provenance when useful, but let newer validated architecture and implementation evidence supersede historical assumptions explicitly;
- if Phase 0 or later implementation evidence disproves a current Breeder-AI assumption, update the relevant rule/contract/blueprint/roadmap deliberately rather than either blindly obeying the stale assumption or silently violating it.

Before a major new development step, explicitly check:

1. which current rules still fit the present technical baseline;
2. which rules exist mainly because of historical constraints;
3. which rules should be narrowed to a specific module or runtime;
4. which rules must be adapted or replaced for the new target state;
5. which existing safety and correctness invariants must survive the architecture change;
6. which migrations and tests are required to avoid unnecessary regressions.

Guiding principle: **rules should protect and guide the project, not block justified evolution; architecture follows current product goals and technical reality, not the other way around.**

## Canonical breeding reference

Read the canonical breeding files in this order:

1. `data/palworld-breeding/breeding_rules.json`
2. `data/palworld-breeding/special_combinations.json`
3. `data/palworld-breeding/pal_values.json`
4. `data/palworld-breeding/manifest.json`

Apply the exact decision order documented in `breeding_rules.json`. In particular:

- Same-species identity is evaluated before every other rule.
- Special combinations, including gender constraints, are evaluated before the normal breeding formula.
- Species listed as `child_internal` in `special_combinations.json` are excluded from the normal-formula candidate pool. Derive this set dynamically; never patch individual `ignore_combi` values.
- Same-species identity remains valid for species that are otherwise direct-special children.
- Only eligible normal child candidates may participate in the formula calculation.
- For equidistant normal-formula candidates, use the current `breeding_rules.json` order: higher `CombiDuplicatePriority`, then non-variant preference, then lower `internal_index`. Parent or child rarity is not a tie-breaker unless a future canonical rule explicitly says so.
- Never use a Paldeck number as a breeding value or tie-breaker.
- Never hardcode one-off parent pairs to mimic a global rule.
- Do not invent missing values, aliases, combinations, translations, or patch status.
- Document direct in-game tests with their tested version and date. Treat Palworld.gg only as a non-authoritative manual cross-check.
- Do not silently repair or rewrite canonical data. Stop release validation and document any conflict.
- Before changing canonical breeding data, verify the current Palworld patch and the pinned direct-game-data sources.
- Recheck patch status after every newer Palworld version before continuing to label the reference current.

## Public Breeding API requirements (`services/breeding-api/`)

These rules apply to the existing public Breeding API and its public MCP. They do not prohibit the separate private Breeder AI application from having authentication or private state.

- The public Breeding API is read-only. Do not add state-changing HTTP endpoints.
- It must not call GitHub or third-party breeding calculators at request time.
- Generated numeric API indexes are transport/build artifacts and are not durable cross-build domain identities for Breeder AI persistence.
- Localized names are aliases only. Name ambiguity must return structured candidates instead of a guessed match.
- Builds and generated indexes must be deterministic for identical canonical inputs.
- Keep `source_data_hash` and `generated_artifact_hash` semantically distinct and non-self-referential.
- Forward and reverse breeding indexes must remain consistent.
- Release validation must fail when canonical data, generated data, or unresolved conflicts disagree.
- Expose only the anonymous read-only MCP endpoint at `/mcp`; historical tokenized REST paths are no longer a supported external surface and must remain neutral 404s.
- MCP tools must delegate to the existing internal `routeApiRequest(...)` handlers and must not introduce a second breeding implementation or external REST surface.
- Keep `breeding_status` as the lightweight technical status tool for maintenance, diagnostics, deployment checks, and scheduled integrity monitoring. Do not require it before every normal breeding request.

## Breeder AI requirements

- Breeder AI may have a private authenticated runtime, but it must not add private state to the public Breeding API.
- Resolve authenticated users server-side; never trust a client-supplied `user_id` as authority.
- Persist durable app/domain identities, not generated REST array indexes, e-mail addresses, display names or device/session IDs.
- Enforce owner and `play_space_id` boundaries on all private state.
- The LLM/provider layer must not write arbitrary persistence or invent canonical game facts.
- Authoritative mutations go through validated server-side action/mutation contracts with revision, idempotency and trace semantics defined in `docs/BREEDER_AI_PREBUILD_CONTRACTS.md`.
- The exact Cloudflare Auth/Access topology, final D1 schema and provider choice remain Phase-0 spike decisions.

## Secrets and deployment

Repository-wide:

- Never commit, print, log, snapshot, or embed secrets in generated artifacts.
- Do not deploy a new component without its component-specific validation and an explicit deployment gate.

For `services/breeding-api/` specifically:

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are GitHub Actions secrets used only for deployment.
- `BREEDING_READ_TOKEN` is no longer a runtime binding and has been removed from the deployed Worker. Repository code and deployment workflows must never read, recreate, replace, clear or synthesize it.
- The production deploy currently retains `--keep-vars` conservatively to avoid unreviewed changes to dashboard-managed Worker variables; it is not a `BREEDING_READ_TOKEN` dependency. Remove it only after a read-only remote binding audit proves that no preserved variables are required.
- Every external path other than exact `/mcp` must produce a neutral HTTP 404 response.
- Do not expose a public index, directory listing, login form, or interactive authentication flow from the public Breeding API service.
- The deliberate anonymous `/mcp` endpoint may expose only the documented non-secret read-only breeding tools.

The prohibition on an interactive authentication flow above is scoped to the public Breeding API service. It does not prohibit the separate private Breeder AI application from implementing the authenticated flow required by its product contract.

## Durable technical repository memory and handoff

Chat history is not a durable source of truth for this repository. A future ChatGPT, Codex, or human maintainer must be able to understand the current technical repository state from tracked files alone.

Before substantial technical work:

1. Read this file and the root `README.md`.
2. For Breeder AI work, also read `docs/BREEDER_AI_PREBUILD_CONTRACTS.md`, `docs/BREEDER_AI_CURRENT_BLUEPRINT.md` and `docs/BREEDER_AI_IMPLEMENTATION_ROADMAP.md`.
3. For breeding work, also read `data/palworld-breeding/README.md`, the four canonical files in the required order, `services/breeding-api/README.md`, and `services/breeding-api/HANDOFF_CHATGPT.md`.
4. Verify the current technical baseline, active branch, `main` commit, open pull requests, validation state, deployment state and live reachability dynamically instead of treating historical handoff values as permanent facts.
5. For work that explicitly depends on an external Actions/review artifact, run `node scripts/workspace-artifacts.mjs check <profile>` first and begin artifact-dependent work only at `ready`. Use only the named profile; never substitute `latest`, another run, or reconstructed data. Keep `LOCAL_ARTIFACTS/` local and uncommitted.

For every material architecture, data, API, MCP, deployment, validation, or workflow change:

- Update the appropriate tracked README or handoff in the same pull request or commit.
- Record what changed, why it changed, the authoritative files, validation performed, deployment consequences, unresolved risks, and the next concrete technical step.
- Preserve enough technical context that a new maintenance session can continue without relying on earlier conversation history.
- Keep implementation facts and durable technical decisions, not personal messages, conversational transcripts, brainstorming chatter, player inventories, individual target Pals, private backups, private ChatGPT project instructions, or unrelated user information.
- Keep player-specific state and personal project continuity in a separate private source or private repository only when explicitly requested.
- Never store tokens, credentials, secret values, authenticated URLs, account data, or private ChatGPT project instructions. Use placeholders and name the secure storage location instead.
- Treat code, canonical data, manifests, merged pull requests, and successful validation as authoritative. If documentation disagrees with them, correct the documentation before declaring the work complete.

Before ending a major technical work session, refresh `services/breeding-api/HANDOFF_CHATGPT.md` when breeding/API/MCP work was involved. Include the date, relevant branch or pull request, current merged state, validation evidence, deployment status, and remaining manual steps without embedding secrets.

## Required checks

For `services/breeding-api/`, run its existing pnpm checks from that module:

```text
pnpm install --frozen-lockfile
pnpm run generate
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build:worker
pnpm run validate
pnpm run validate:release
pnpm run check:deterministic
pnpm run scan:secrets
```

Breeder AI receives its own component-specific CI/check set when code is introduced. Do not assume the Breeding API checks validate the private application.

Pin direct package dependencies and third-party GitHub Actions to reviewed immutable versions. Do not deploy unless the relevant component's release gate passes, and never bypass the release gate.
