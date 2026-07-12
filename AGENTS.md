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
- Only eligible normal child candidates may participate in the formula calculation.
- Never use a Paldeck number as a breeding value or tie-breaker.
- Do not invent missing values, aliases, combinations, translations, or patch status.
- Do not silently repair or rewrite canonical data. Stop release validation and document any conflict.
- Before changing canonical breeding data, verify the current Palworld patch and the pinned direct-game-data sources.

## Breeding API requirements

- The API is read-only. Do not add state-changing HTTP endpoints.
- It must not call GitHub or third-party breeding calculators at request time.
- Use stable internal Pal IDs as primary keys. Localized names are aliases only.
- Name ambiguity must return structured candidates instead of a guessed match.
- Builds and generated indexes must be deterministic for identical canonical inputs.
- Forward and reverse breeding indexes must remain consistent.
- Release validation must fail when canonical data, generated data, or unresolved conflicts disagree.

## Secrets and deployment

- Never commit, print, log, snapshot, or embed secrets in generated artifacts.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are GitHub Actions secrets used only for deployment.
- `BREEDING_READ_TOKEN` is a Cloudflare Worker secret. Do not place it in GitHub workflow environment variables or Wrangler configuration.
- Deployments must preserve the existing `BREEDING_READ_TOKEN` and must never replace, clear, or synthesize it.
- Missing or invalid read tokens must produce a neutral HTTP 404 response.
- Do not expose a public index, directory listing, login form, or interactive authentication flow.

## Required checks

The Breeding API uses its own pnpm module. Run commands from `services/breeding-api/`:

```text
pnpm install --frozen-lockfile
pnpm run generate
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run validate
pnpm run validate:release
pnpm run check:deterministic
pnpm run scan:secrets
```

Do not deploy unless every release check passes. Preserve the existing workflows under `.github/workflows/`; add Breeding API automation separately.
