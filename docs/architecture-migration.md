# Permaweb frontend architecture migration

Temporary migration map for adopting `.agents/skills/permaweb-frontend-code-style`. `.permaweb-frontend.json` stays
`adopting` until every slice below is complete; then set `status` to `compliant` and delete this file.

## Current state

The structural contract is complete: `npm run check:frontend` (validator, lint, typecheck, tests) and
`npm run check:performance` pass with no exceptions.

| Measure              | Before (main @ 4a877a9)                                                                                          | After       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------- |
| Validator violations | 397                                                                                                              | 0           |
| Largest source file  | `App.tsx`, 12,202 lines                                                                                          | 2,128 lines |
| Test files / tests   | 90 / 942                                                                                                         | 106 / 978   |
| `dist` total         | 2,220 KiB                                                                                                        | 2,224 KiB   |
| Main JS chunk        | 504,247 B                                                                                                        | 501,895 B   |
| Main CSS             | 214,672 B                                                                                                        | 213,096 B   |
| Lazy chunks          | create, dispatch, profile, fungible asset view, price chart, mint, transactions, transaction sync, 3D visualizer | unchanged   |

Completed slices:

1. Agent contract: skill copied from AO Site for Codex (`.agents/skills`) and Claude (`.claude/skills` symlink),
   `AGENTS.md`, `CLAUDE.md`, Claude session/prompt hooks, Husky pre-commit validator, CI workflow.
2. Tests moved to `tests/` mirroring `src/`; shared Vite/Vitest aliases in `scripts/source-aliases.ts`.
3. API capabilities under `src/api/<capability>/` with deliberate `index.ts` barrels; weave-wrangler, arweave, and
   wallet access confined to `src/api`; `window.arweaveWallet` handled only by `api/wallet/session.ts`.
4. `App.tsx` and `FungibleAssetView.tsx` split into `apps/`, `views/`, `navigation/`, `providers/`, and eleven
   feature folders; providers no longer render UI (`OperationActivityHost`, `WalletConnectionDialog`).
5. Component directory contract everywhere; native controls only in atoms (`Pressable`, `TextInput`, `TextArea`,
   `FileInput`, `RangeInput`).
6. Shared primitives adopted across features: `Icon` (155 uses), `Eyebrow`, `LiveRegion`, `VisuallyHidden`,
   `IconButton`, `DialogHeading`, `RetryNotice`, `EmptyState`, `StatusNotice`, `TokenMarketRow`,
   `PausedRecoveryNotice`; duplicated helpers consolidated (`isArweaveId`, AR unit conversion, gateway context).
7. Components read `props.name` (no destructuring); raw colors moved into `helpers/theme.ts`.
8. Axe-checked component tests, property-based tests for identifiers and unit conversion, validator fixtures, and
   agent-contract tests.
9. Dialog shell: the `components/organisms/Dialog` organism owns the backdrop, dialog semantics, focus containment,
   Escape, and focus restoration for the operation, fungible operation, upload, mint, profile, append-collection,
   search, and wallet dialogs; `tests/architecture/dialog-shell.test.ts` rejects dialog semantics anywhere else.
10. Error taxonomy: `helpers/app-error.ts` defines `AppError` (stable `code`, `reason`, `retryable`, safe `detail`) and
    the single reason-keyed copy table. Adapters under `src/api` map HTTP status, transport, ao.js, wallet, and
    weave-wrangler failures once (`api/network/errors`, `api/ao`, `api/wallet/errors`, `api/transactions/failure`);
    UI layers normalize with `toAppError` and branch only on `code`/`reason`. `helpers/marketplace-error.ts` and
    `helpers/mint-error.ts` are gone; `tests/architecture/error-taxonomy.test.ts` rejects raw error classification
    outside `src/api`.

## Remaining slices

Work these as separate, behavior-preserving changes. Verify each in a real browser: they can change cascade order.

1. **Component styles.** Most presentation is still class rules in `src/apps/bazar/styles.css` (≈11,700 lines) and
   `features/Profile/components/organisms/ProfilePage/ProfileRoute.css`. Move each component's rules into its
   `styles.ts` (see `components/molecules/ProfileIdentity/styles.ts` for the pattern: styled elements, transient
   `$props`, theme CSS variables, class names kept as stable hooks). Start with atoms whose classes have no contextual
   overrides, then molecules, then feature organisms. Check `grep -n '<class>' src/apps/bazar/styles.css` for
   contextual selectors before moving a block.
2. **User-facing copy.** Copy is hardcoded English. Extend `providers/LanguageProvider` (already used by
   `TransactionSync`) into the translation layer and move strings feature by feature, including validation, empty,
   loading, and error messages.
3. **Orchestration hooks.** Large feature organisms still combine protocol calls and rendering: `HomeMarket`,
   `CollectionMarket`, `AssetDetail`, `OperationDialog`, `FungibleOperationDialog`, `AssetCreator`, `MyAssets`. Extract
   data loading and state machines into feature `hooks/` and `model/` (discriminated async state) so organisms only
   compose UI.
