# Bazar Agent Guide

Bazar is a browser-only Vite + React marketplace for Arweave-native assets: wallet-owned unique assets, fungible tokens, collections, and native AR settlement. There is no backend; every read and write goes through Arweave gateways, AO compute, and the connected wallet.

## Required frontend architecture skill

-   Before acting on every prompt in this repository, load and follow `$permaweb-frontend-code-style` from `.agents/skills/permaweb-frontend-code-style/SKILL.md`.
-   Apply it to inspection, planning, review, implementation, debugging, refactoring, testing, and migration work.
-   Read the complete `references/frontend-conventions.md` on every task. Also read `references/permaweb-conventions.md` whenever wallet, Arweave, AO, gateway, cache, service-worker, or deployment behavior is in scope.
-   Keep `.permaweb-frontend.json` accurate and run `npm run check:architecture` before planning and after frontend changes. Fix drift you touch and do not introduce architecture exceptions.
-   The canonical skill lives in `.agents/skills/permaweb-frontend-code-style/`. Edit it there. Codex metadata is in `agents/openai.yaml`; Claude discovers the same skill through `.claude/skills/permaweb-frontend-code-style`, a relative symlink. Keep both vendors' metadata in sync.
-   Enforcement: Claude Code hooks in `.claude/settings.json` inject the skill reminder on every session start and prompt, the Husky pre-commit hook runs the architecture validator, and `.github/workflows/frontend.yml` runs the full gate on every pull request.

## Adoption status

`.permaweb-frontend.json` is `adopting`. The structural contract passes; the remaining slices (component styles, copy localization, orchestration hooks, dialog shell, error taxonomy) are mapped in `docs/architecture-migration.md`. Keep each requested change scoped: migrate a listed slice when the task touches that code or the user asks for it, never by expanding an unrelated change. Update the map as slices land, and set `status` to `compliant` (then delete the map) only when all of them are done and every gate passes.

## Verification

-   Run `npm run check:frontend` (architecture, lint, typecheck, and tests) after frontend changes.
-   After a required production build, run `npm run check:performance`. CI enforces both gates.
-   Only run production or development builds when verifying bundling, routes, lazy imports, dependencies, assets, or deployment paths.
-   Only start a local server when browser verification is necessary, and stop it afterwards. Port 3000 is often used by other local projects; `.claude/launch.json` runs Bazar on 3001.

## Project shape

| Layer                                         | Purpose                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/apps/bazar/`                             | Entrypoint (`main.tsx`), provider and route composition (`App.tsx`), global stylesheet   |
| `src/views/`                                  | Thin route components; lazy routes own their `Suspense` fallback                         |
| `src/navigation/`                             | Header, footer, wallet menu, gateway control, wallet connection dialog                   |
| `src/features/<Feature>/`                     | Domain UI, hooks, and pure `model/` logic, exposed only through `index.ts`               |
| `src/components/{atoms,molecules,organisms}/` | Shared, domain-neutral UI. Native `<button>`/`<input>`/`<textarea>` appear only in atoms |
| `src/providers/`                              | Market catalogue, wallet session, theme, language, and operation activity state          |
| `src/hooks/`                                  | Reusable React behavior                                                                  |
| `src/api/<capability>/`                       | Every gateway, AO, GraphQL, wallet, and SDK integration, exposed through `index.ts`      |
| `src/helpers/`                                | Pure utilities, configuration, theme tokens (`helpers/theme.ts`), ID and unit helpers    |
| `src/types/`                                  | Application-owned types shared by components and hooks                                   |
| `tests/`                                      | All tests, mirroring `src/`; `tests/architecture/` holds the contract checks             |

Features: `Activity`, `AssetDetail` (unique and fungible asset pages), `Catalogue` (asset cards and pricing labels), `Collection`, `Create`, `Dispatch`, `Home`, `MyAssets`, `Operations` (atomic operation dialogs and recovery), `Profile`, `TransactionSync`.

## Conventions specific to Bazar

-   Reuse the shared primitives before writing markup: `Button`, `IconButton`, `Pressable`, `TextInput` (with `IDENTIFIER_INPUT_PROPS` for addresses and IDs), `TextArea`, `FileInput`, `RangeInput`, `Select`, `Icon`, `Eyebrow`, `LiveRegion`, `VisuallyHidden`, `Tooltip`, and the molecules `DialogHeading`, `RetryNotice`, `EmptyState`, `StatusNotice`, `ErrorPanel`, `RouteState`, `TokenMarketRow`.
-   Validate Arweave identifiers with `isArweaveId` from `helpers/arweave-id`; never add another 43-character regex.
-   Convert AR amounts with `helpers/ar-units` and token amounts with `parseTokenAmount`/`formatTokenAmount`; never use floating point for atomic units.
-   Keep large surfaces lazy: `features/TransactionSync` exports only lazy components and light model helpers; the fungible asset page loads through `loadFungibleAssetView`; mint code loads through `loadMintRuntime`. Check `npm run build` output when touching these boundaries.
-   Most presentation still lives in `src/apps/bazar/styles.css`, driven by theme CSS variables. New or restyled components should own their rules in `styles.ts` with theme tokens; do not add raw colors outside `helpers/theme.ts`.
-   Components read props through `props.name` (no destructuring); `tests/architecture/component-conventions.test.ts` enforces this. Use `omitProps` from `helpers/props` when forwarding remaining DOM attributes.

## Development

```bash
npm install
npm run start
npm run check:frontend
npm run build
npm run check:performance
```
