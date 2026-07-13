# Repository instructions

These instructions apply to the entire repository.

## Repository boundaries

- Keep the existing Palworld Passives PWA framework-free and independent from the Breeding API.
- Keep the Cloudflare Worker implementation isolated under `services/breeding-api/`.
- Do not change the PWA, its service worker, or its passive data merely to support the Breeding API.
- Treat generated API indexes as derived build artifacts, never as canonical Palworld data.

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
- A fully equal cross-rank tie after the rarity rules selects the higher `CombiRank`.
- Same-rank duplicates are a separate case: use `CombiDuplicatePriority`, then non-variant preference, then internal order.
- Never use a Paldeck number as a breeding value or tie-breaker.
- Never hardcode one-off parent pairs to mimic a global rule.
- Do not invent missing values, aliases, combinations, translations, or patch status.
- Document direct in-game tests with their tested version and date. Treat Palworld.gg only as a non-authoritative manual cross-check.
- Do not silently repair or rewrite canonical data. Stop release validation and document any conflict.
- Before changing canonical breeding data, verify the current Palworld patch and the pinned direct-game-data sources.
- Recheck patch status after every newer Palworld version before continuing to label the reference current.

## Breeding API requirements

- The API is read-only. Do not add state-changing HTTP endpoints.
- It must not call GitHub or third-party breeding calculators at request time.
- Use stable internal Pal IDs as primary keys. Localized names are aliases only.
- Name ambiguity must return structured candidates instead of a guessed match.
- Builds and generated indexes must be deterministic for identical canonical inputs.
- Keep `source_data_hash` and `generated_artifact_hash` semantically distinct and non-self-referential.
- Forward and reverse breeding indexes must remain consistent.
- Release validation must fail when canonical data, generated data, or unresolved conflicts disagree.
- Preserve both supported access modes: the anonymous read-only MCP endpoint at `/mcp` and the token-protected REST API at `/<BREEDING_READ_TOKEN>/v1/...`.
- MCP tools must delegate to the existing REST route handlers and must not introduce a second breeding implementation.

## Secrets and deployment

- Never commit, print, log, snapshot, or embed secrets in generated artifacts.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are GitHub Actions secrets used only for deployment.
- `BREEDING_READ_TOKEN` is a Cloudflare Worker secret. Do not place it in GitHub workflow environment variables or Wrangler configuration.
- Deployments must preserve the existing `BREEDING_READ_TOKEN` and must never replace, clear, or synthesize it.
- Missing or invalid read tokens must produce a neutral HTTP 404 response.
- Do not expose a public index, directory listing, login form, or interactive authentication flow.
- The deliberate anonymous `/mcp` endpoint may expose only the documented non-secret read-only breeding tools.

## Durable project memory and handoff

Chat history is not a durable source of truth for this repository. A future ChatGPT, Codex, or human maintainer must be able to understand the current project state from tracked repository files alone.

Before substantial work:

1. Read this file and the root `README.md`.
2. For breeding work, also read `data/palworld-breeding/README.md`, the four canonical files in the required order, `services/breeding-api/README.md`, and `services/breeding-api/HANDOFF_CHATGPT.md`.
3. Verify that the handoff describes the current branch, merged pull requests, access modes, validation state, deployment state, and known open work. If it is stale, update it as part of the same change.

For every material architecture, data, API, MCP, deployment, validation, or workflow change:

- Update the appropriate tracked README or handoff in the same pull request or commit.
- Record what changed, why it changed, the authoritative files, validation performed, deployment consequences, unresolved risks, and the next concrete step.
- Preserve enough context that a new chat can continue without relying on earlier conversation history.
- Keep implementation facts and durable decisions, not personal messages, conversational transcripts, brainstorming chatter, or unrelated user information.
- Never store tokens, credentials, secret values, authenticated URLs, account data, or private ChatGPT project instructions. Use placeholders and name the secure storage location instead.
- Treat code, canonical data, manifests, merged pull requests, and successful validation as authoritative. If documentation disagrees with them, correct the documentation before declaring the work complete.

Before ending a major work session, refresh `services/breeding-api/HANDOFF_CHATGPT.md` when breeding/API/MCP work was involved. Include the date, relevant branch or pull request, current merged state, validation evidence, deployment status, and remaining manual steps without embedding secrets.

## Required checks

The Breeding API uses its own pnpm module. Run commands from `services/breeding-api/`:

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

Pin direct package dependencies and third-party GitHub Actions to reviewed immutable versions. Do not deploy unless every release check passes, and never bypass the release gate. Preserve the existing workflows under `.github/workflows/`; add Breeding API automation separately.
