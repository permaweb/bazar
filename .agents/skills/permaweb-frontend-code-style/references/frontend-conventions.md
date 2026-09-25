# Frontend Conventions

Apply the structural rules in this reference across the complete frontend unless an explicit user or repository instruction requires a different architecture. Use the remaining conventions as defaults when repository tooling does not express a stricter compatible rule.

## Contents

-   Formatting and imports
-   Architecture and files
-   Feature ownership and reuse
-   Dependency direction and public APIs
-   Mandatory navigation ownership
-   Required repository migration
-   Mandatory API adapter boundary
-   Mandatory atoms and primitive reuse
-   Naming and types
-   Component order and props
-   Dedicated test structure
-   State, effects, and data loading
-   Providers and shared state
-   Forms
-   Errors and user feedback
-   Styling and responsive design
-   Accessibility and content safety
-   Internationalization
-   Performance
-   Testing and review
-   Automated enforcement

## Formatting and imports

-   Let the repository formatter own whitespace and wrapping.
-   Default to tabs, single quotes, semicolons, trailing commas where the formatter emits them, and a 120-character line limit when creating a new compatible project.
-   Keep one logical statement per line and avoid formatting-only churn outside the task.
-   Sort and deduplicate imports with the repository linter. Use this conceptual grouping when no rule exists:
    1. React and runtime libraries
    2. Third-party packages
    3. Arweave, AO, and permaweb packages
    4. Application aliases, API contracts, providers, navigation, components, hooks, and helpers
    5. Side-effect imports
    6. Parent and sibling modules
    7. Local styles
-   Use configured aliases across application boundaries and relative imports within a colocated component folder.
-   Import colocated styled-components as `import * as S from './styles';` when that pattern exists.
-   Avoid deep imports that bypass a package's or feature's public entrypoint.
-   Import React only as `import React from 'react';`. Never use named, destructured, or type-only imports from `react`; access hooks and runtime functions through `React`, such as `React.useState` and `React.createContext`, and reference types through the namespace, such as `React.ReactNode` and `React.FormEvent`.

Required:

```tsx
import React from 'react';

const [value, setValue] = React.useState('');
const handleSubmit = (event: React.FormEvent) => event.preventDefault();
```

Forbidden:

```tsx
import { useState, type FormEvent } from 'react';
```

## Architecture and files

Organize reusable UI by responsibility, not merely size. Require this baseline structure:

```text
project/
├── src/
│   ├── apps/                     # Optional application entrypoints in a multi-app repository
│   ├── components/
│   │   ├── atoms/                # All basic UI primitives
│   │   ├── molecules/            # Reusable compositions of atoms
│   │   └── organisms/            # Complex feature sections
│   ├── features/                 # Domain-owned UI, behavior, models, and types
│   ├── navigation/               # All headers, footers, and sidebars
│   ├── views/                    # Route/page orchestration
│   ├── hooks/                    # Reusable React behavior
│   ├── providers/                # Shared context and external capabilities
│   ├── api/                      # All backend, network, wallet, and SDK adapters
│   ├── helpers/                  # Pure utilities, config, themes, types, validation
│   └── store/                    # Shared state store when the application uses one
├── tests/                        # All automated tests and test-only artifacts
└── .permaweb-frontend.json       # Adoption state and performance budgets
```

In a multi-app repository, allow `src/apps/<app>/components/{atoms,molecules,organisms}` for components owned only by that app. Keep cross-app primitives and compositions in the root shared component tree, and keep all headers, footers, and sidebars in the root `src/navigation/` layer. Do not leave components loose directly under `components/` or scattered among route files.

-   **Atoms:** indivisible controls and display primitives such as buttons, inputs, icons, and loaders.
-   **Molecules:** small compositions with one reusable purpose such as a payment summary or language selector.
-   **Organisms:** stateful feature sections such as editors, lists, and wallet panels.
-   **Features:** domain-owned components, hooks, models, and types that should not pollute global shared layers.
-   **Navigation:** application-shell and navigation components, including every header, footer, and sidebar.
-   **Views/pages:** route orchestration and page layout. Keep protocol and reusable business logic elsewhere.

Put every component in its own PascalCase directory and require all three standard files:

```text
ComponentName/
├── ComponentName.tsx
├── styles.ts
└── index.ts
```

-   Put the component implementation in `ComponentName.tsx`, all styled-components in `styles.ts`, and only the public barrel export in `index.ts`.
-   Export the default component through a named barrel export: `export { default as Button } from './Button';`.
-   Never implement a component in `index.tsx`, omit one of the three required files, or leave a component as a loose `.tsx` file outside its component directory.
-   Keep tests out of component directories. Mirror the component path beneath the dedicated top-level `tests/` directory.
-   Allow extra component-specific helper files only when they are not reusable elsewhere; the three standard files remain mandatory.
-   Keep feature-specific types and helpers near the feature. Move a type to the shared type module only when multiple features own that contract.
-   Put pure, framework-independent transformations in helpers.
-   Put reusable React behavior in `use...` hooks.
-   Put every external integration behind a typed adapter in `src/api/`. Let providers coordinate application state by consuming those adapters rather than SDKs directly.
-   Keep files cohesive. Split a component when it mixes protocol calls, form orchestration, and substantial rendering, not merely because it crossed an arbitrary line count.

## Feature ownership and reuse

Use a feature boundary once code is owned by a product domain rather than the application shell or design system:

```text
src/features/<Feature>/
├── components/
│   ├── molecules/
│   └── organisms/
├── hooks/
├── model/                        # Reducers, state machines, selectors, and pure domain logic
├── types.ts
└── index.ts                      # The feature's intentional public API
```

-   Keep feature-owned code inside its feature even when only one view currently consumes it.
-   Do not create feature-owned atoms. A primitive is either reusable and belongs in root `components/atoms`, or it composes shared atoms and belongs in a feature molecule/organism.
-   Promote code to root `components`, `hooks`, or `helpers` only after at least two unrelated features need the same behavior and the API can be domain-neutral.
-   Keep feature internals private. Consumers outside the feature import only its root `index.ts` public API.
-   Allow relative imports inside one feature. Never deep-import another feature or reach into its component, hook, or model folders.
-   Avoid a root `src/features/index.ts` mega barrel. Import each feature from its own public boundary.
-   Keep domain models independent of React when possible so they remain testable and reusable.

## Dependency direction and public APIs

Keep imports acyclic and flowing toward lower-level capabilities. Treat the following as the default allowed internal dependencies:

| Source layer            | May depend on                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `apps`                  | `views`, `navigation`, `features`, `providers`, `api`, `helpers`                          |
| `views`                 | `navigation`, `features`, `components`, `hooks`, `providers`, API contracts, `helpers`    |
| `navigation`            | `components`, `hooks`, `providers`, API contracts, `helpers`, `assets`                    |
| `features`              | its own internals, `components`, `hooks`, `providers`, API contracts, `helpers`, `assets` |
| shared `organisms`      | shared molecules/atoms, `hooks`, `providers`, `helpers`                                   |
| shared `molecules`      | shared atoms and `helpers`                                                                |
| shared `atoms`          | `helpers`, types, and assets                                                              |
| `hooks` and `providers` | API contracts, `helpers`, and other lower-level hooks/providers without cycles            |
| `api`                   | other API modules, pure `helpers`, and application-owned types                            |
| `helpers`               | pure helpers and framework-independent types only                                         |

-   Never import `apps` or `views` from a lower layer.
-   Never import navigation from a component, feature, hook, provider, API module, or helper.
-   Keep `api` independent of React and presentation modules.
-   Import a component through its directory barrel. Import a feature through its feature root barrel.
-   Keep barrels local and deliberate. Do not add root mega barrels such as `src/components/index.ts` or `src/features/index.ts`; they obscure ownership, enable cycles, and can harm tree-shaking.
-   Use `import type` for non-React type-only dependencies. Keep the required default `React` import for React types.
-   Reject circular runtime imports. Ignore genuine `import type` edges when evaluating runtime cycles.

## Mandatory navigation ownership

Treat `src/navigation/` as the only source location for standalone header, footer, and sidebar components.

-   Put every component whose responsibility is an application or view header, footer, sidebar, navigation rail, or navigation drawer under `src/navigation/<ComponentName>/`.
-   Never put `Header`, `Footer`, `Sidebar`, or a component name ending in `Header`, `Footer`, or `Sidebar` under `src/components/atoms`, `src/components/molecules`, or `src/components/organisms`.
-   Keep each navigation component in the standard `ComponentName.tsx`, `styles.ts`, and `index.ts` directory contract.
-   Compose navigation from shared atoms, molecules, and organisms where appropriate. Do not duplicate primitive controls or declare raw controls inside navigation components.
-   Let views and app composition points import navigation components through their public barrels. Do not make atoms, molecules, or organisms depend on the navigation layer.
-   Keep feature-internal semantic regions inside their owning feature when they are not standalone navigation components; a styled wrapper named `Header` or `Footer` does not by itself create a navigation component.
-   Treat names ending in `NavigationRail`, `NavigationDrawer`, `NavRail`, `NavDrawer`, `TopBar`, or `AppNav` as navigation ownership signals in addition to header/footer/sidebar names. Semantic review is still required for unusually named shell navigation.

## Required repository migration

Do not grandfather an inconsistent repository layout. Use `.permaweb-frontend.json` to distinguish initial adoption from steady-state enforcement.

-   **Adoption:** When configuration is absent or declares `status: "adopting"`, audit and migrate the complete frontend. Record the temporary migration map outside production source, execute it in vertical slices, establish current performance baselines, and keep the status as `adopting` until every gate passes.
-   **Steady state:** When configuration declares `status: "compliant"`, run the bundled validator before planning. Fix drift relevant to the task, but do not recreate a full migration project when the repository remains compliant.

Create the configuration during the first adoption slice; absence identifies adoption but is itself an incomplete gate. Use only `adopting` or `compliant`, increment a positive `contractVersion` when the contract shape changes, and configure positive output budgets plus build-input paths. Exceptions are adoption-only: each needs a known rule, narrow path (`*` does not cross directories; `**` does), reason, and expiration. Remove every exception before marking the repository compliant.

1. Inventory every frontend source file, public entrypoint, path alias, barrel, test, test-only artifact, external SDK import, direct network call, navigation component, and import relationship.
2. Map each module to feature, atom, molecule, organism, navigation, view, hook, provider, API, helper, or composition ownership.
3. Identify loose controls, duplicated primitives, circular or inverted dependencies, cross-feature deep imports, direct SDK/backend access outside `src/api/`, headers/footers/sidebars outside `src/navigation/`, feature code in shared layers, shared code trapped in routes, invalid public barrels, component directories missing standard files, and tests outside `tests/`.
4. Establish typed API contracts, feature boundaries, `src/navigation/`, standard component folders, shared atoms, the top-level `tests/` tree, architecture validation, and performance budgets before moving dependent code.
5. Move modules, integrations, and tests into their target locations, preserve public exports where temporarily necessary, and update aliases, imports, TypeScript includes, and test-runner configuration in the same migration slice.
6. Replace duplicate or loose primitives with the canonical atom, then remove obsolete implementations after confirming that no imports remain.
7. Run the narrowest formatter, lint, typecheck, and relevant tests after each slice. Run build or browser verification only when the move affects bundling, lazy imports, routes, or static asset paths.
8. Remove temporary compatibility exports and migration documents when all consumers have migrated. Mark the configuration `compliant` only after the validator, tests, builds, and performance budgets pass.

Keep the application functional throughout the migration. Preserve unrelated user changes and avoid combining architecture moves with unrequested product redesign. Delete the temporary migration map when adoption is complete; durable rules belong in the skill, repository configuration, validator, and tests.

Adding this skill to a repository does not make that repository compliant by itself. A project such as `~/arc/repos/bazar` must be audited and restructured to this baseline after the skill is added.

## Mandatory API adapter boundary

Connect the application to every backend service, gateway, browser wallet, RPC endpoint, and backend/service SDK only through typed adapters under `src/api/`. Make the UI depend on application-owned contracts so a backend or SDK can be replaced without changing components, views, hooks, providers, or stores.

-   Keep all backend/service SDK imports, client initialization, direct remote `fetch`, GraphQL, WebSocket, RPC, signing, request construction, response parsing, retries, timeouts, and transport-specific error handling inside `src/api/`.
-   Let UI, navigation, features, hooks, and providers import only capability public indexes such as `@/api/wallet`; reserve concrete adapter imports for API internals and app composition points.
-   Forbid navigation, components, views, hooks, providers, and stores from importing a backend/service SDK, constructing a remote URL, calling a backend directly, or receiving a raw SDK client.
-   Define stable application contracts and domain result types independently of the current provider. Do not expose SDK request/response types, transport envelopes, field-name quirks, or provider error objects beyond the adapter.
-   Normalize and validate external data at the adapter boundary. Return domain models or an application-owned result/error type.
-   Keep `src/api/` independent of React and presentation code. An adapter must not import navigation, components, styles, views, hooks, or UI providers.
-   Let providers manage shared UI/application state by consuming an API contract. Do not let a provider double as an SDK wrapper.
-   Select the concrete adapter in one composition point, factory, or dependency container. Pass the contract to consumers so tests and alternate implementations can substitute it.
-   Keep provider-specific compatibility logic, authentication headers, wallet signer construction, gateway failover, and version shims inside the concrete adapter.
-   Accept cancellation such as `AbortSignal` where operations can be superseded. Normalize timeout, rejection, unavailable, invalid-response, unauthorized, and unknown-outcome states.
-   Test the contract with mocked adapters and test each concrete adapter's serialization, validation, and error mapping under `tests/api/`.

Organize adapters by application capability rather than scattering generic client calls:

```text
src/api/
├── assets/
│   ├── types.ts                  # Application-owned contract and domain types
│   ├── arweaveAdapter.ts         # Current concrete implementation
│   └── index.ts                  # Public contract/factory exports
├── profiles/
│   ├── types.ts
│   ├── permawebAdapter.ts
│   └── index.ts
├── wallet/
│   ├── types.ts
│   ├── browserWalletAdapter.ts
│   └── index.ts
└── index.ts                      # Application composition point
```

When switching providers, implement the same application contract in a new adapter and change the composition point. Do not branch on provider choice throughout the UI.

## Mandatory atoms and primitive reuse

Treat the shared atoms directory as the only source of basic UI controls. Reuse its primitives everywhere they are needed so behavior, styling, accessibility, loading states, and types remain consistent.

-   Build all buttons, icon buttons, links styled as controls, inputs, textareas, selects, checkboxes, radios, toggles, sliders, form fields, labels, validation messages, loaders, tabs, accordions, modals, drawers, tooltips, and similar primitives in the atoms layer.
-   Never declare a loose raw control such as `<button>`, `<input>`, `<select>`, or `<textarea>` in a molecule, organism, view, navigation component, or feature folder. Never create a local `styled.button`, `styled.input`, or equivalent to bypass an existing atom.
-   Use native control elements only inside the implementation of the corresponding atom. Keep feature code responsible for composition and data, not reimplementing primitive interaction.
-   Search the atoms directory before writing UI. Reuse the closest atom and its supported variants rather than copying markup, CSS, keyboard behavior, or loading logic.
-   Add or extend a general-purpose atom when the required primitive or variant does not exist. Include inline props, theme-driven states, accessibility, the required `styles.ts`, the `index.ts` barrel export, and focused tests under `tests/` where the project supports them.
-   Implement a domain-neutral searchable select/combobox as a root atom with complete ARIA combobox, keyboard, focus, empty, and loading behavior. Put domain mapping or wallet-specific option content in a feature molecule that composes that atom.
-   Keep atom variants semantic and reusable, such as `primary`, `warning`, `compact`, or `loading`. Do not add a page-named variant or feature-specific business logic to an atom.
-   Compose feature-specific form layouts from atom-level fields and controls. Promote repeated groups of atoms to a molecule; do not duplicate the controls inside each form.
-   Prefer atom props and variants over one-off style overrides. If a design need is reusable, add the capability to the atom rather than patching a single caller.
-   Treat a loose or duplicated primitive found in touched code as an architectural violation. Replace it with the shared atom or promote it into one as part of the scoped change.

## Naming and types

-   Name components and exported types with `PascalCase`.
-   Name hooks with `use...`.
-   Name callback props with `on...`: `onSubmit`, `onToggle`, `onWalletSwitch`.
-   Name local event handlers with `handle...`: `handleSubmit`, `handleToggle`, `handleWalletSwitch`. Do not expose a `handle...` prop.
-   Name booleans as questions: `isLoading`, `hasChanges`, `canEdit`, `shouldRefresh`.
-   Name module constants with `UPPER_SNAKE_CASE`.
-   Prefer domain names over vague words such as `data`, `item`, `value`, or `obj` when the meaning is known.
-   Type context values, API adapters, hook returns, and exported helpers explicitly. Declare component props inline as specified below.
-   Prefer `unknown` plus narrowing over `any`. Confine an unavoidable SDK cast to one adapter and explain why.
-   Use unions for finite states instead of multiple booleans that can contradict one another.
-   Type `import.meta.env`, asset modules, styled-component themes, and required `window` extensions in a declaration file.
-   Avoid non-null assertions unless an invariant was established immediately before the access.
-   Preserve `null` and `undefined` semantics deliberately; do not mix them casually in one state contract.

## Component order and props

Use this order inside a component:

1. Navigation and routing hooks
2. Feature-specific providers
3. Global providers such as wallet, language, and notifications
4. Derived provider values and authorization booleans
5. Refs and reducers
6. Local state
7. Memoized derived values
8. Effects and callbacks
9. Event handlers and small render helpers
10. JSX return

-   Declare a component's props object directly inline by default.
-   Allow a named exported props type only when it is a genuinely reused public contract, a generic component contract, a wrapper/HOC boundary, or a discriminated props union. Do not create a named props type merely to move an otherwise local inline object elsewhere.
-   Never destructure props in the signature or body. Do not write `function Button({ label })`, `const { label } = props`, or `const label = props.label` as an alias for later use.
-   Access every prop directly through `props.propName` everywhere in the component, including effects, dependency arrays, callbacks, conditionals, and JSX. Access nested values through their full path such as `props.item.id`.
-   Reuse domain types for individual prop fields when helpful.
-   Keep required props required. Do not mark a prop optional only to silence a caller.
-   Prefer `children: React.ReactNode` for containers.
-   Do not copy props into state unless the component intentionally owns an editable snapshot.
-   Keep authorization checks near the top, but enforce authorization again at the capability or backend boundary. A disabled button is not security.
-   Render page modals and overlays at a stable level outside scroll-clipped content wrappers when appropriate.

Required pattern:

```tsx
export default function Button(props: {
	type: ButtonType;
	label: string | number | React.ReactNode;
	onPress?: (event: React.MouseEvent) => void;
	disabled?: boolean;
	active?: boolean;
	loading?: boolean;
	icon?: string;
	iconLeftAlign?: boolean;
	formSubmit?: boolean;
	noFocus?: boolean;
	useMaxWidth?: boolean;
	noMinWidth?: boolean;
	width?: number;
	height?: number;
	fullWidth?: boolean;
	tooltip?: string;
	warning?: boolean;
	className?: string;
	link?: string;
	target?: '_blank';
}) {
	function handlePress(event: React.MouseEvent) {
		event.preventDefault();
		props.onPress?.(event);
	}

	return (
		<S.Primary disabled={props.disabled} active={props.active} onClick={handlePress}>
			{props.icon && <S.Icon src={props.icon} />}
			<span>{props.label}</span>
		</S.Primary>
	);
}
```

## Dedicated test structure

Put every automated test and test-only artifact beneath one dedicated top-level `tests/` directory. Never colocate tests with production source and never place them anywhere under `src/`.

Mirror the source tree so ownership remains obvious:

```text
tests/
├── components/
│   ├── atoms/
│   │   └── Button/
│   │       └── Button.test.tsx
│   ├── molecules/
│   └── organisms/
├── features/
├── navigation/
├── architecture/
├── hooks/
├── providers/
├── helpers/
├── api/
├── fixtures/
├── mocks/
└── test-utils/
```

-   Move every `*.test.*`, `*.spec.*`, `__tests__/`, snapshot, fixture, mock, and test-only utility out of `src/` and into `tests/`.
-   Keep production source from importing anything under `tests/`.
-   Update test imports, aliases, TypeScript includes, coverage paths, and test-runner configuration when moving tests.
-   Keep test filenames aligned with the production module and mirror its source path.
-   Put shared setup in `tests/setup.*`, fixtures in `tests/fixtures/`, mocks in `tests/mocks/`, and reusable render/test helpers in `tests/test-utils/`.
-   Treat any test or test-only artifact outside the dedicated directory as a structural violation during migration and review.

## State, effects, and data loading

-   Keep state minimal; derive values during render or with `useMemo` when computation or reference stability warrants it.
-   Use functional state updates when next state depends on previous state.
-   Never mutate state, props, cached arrays, or provider objects in place. Copy before sorting.
-   Guard an effect early and keep one concern per effect.
-   Use an async IIFE inside an effect rather than making the effect callback async.
-   Include every reactive dependency. If the project disables `react-hooks/exhaustive-deps`, treat that as an obligation to review dependencies manually, not permission to omit them.
-   Cancel fetches with `AbortController` and guard other asynchronous completions so unmounted or superseded work cannot update state.
-   Remove listeners, observers, subscriptions, timers, and animation frames in cleanup.
-   Use refs for imperative coordination such as in-flight deduplication or previous-value tracking, not as hidden render state.
-   Avoid `forEach(async ...)`. Use `Promise.all`, `Promise.allSettled`, or deliberate bounded concurrency and define partial-failure behavior.

Use cache-first progressive loading when stale data is acceptable:

1. Validate and render scoped cached data immediately.
2. Fetch fresh data in the background.
3. Replace state and cache only with a valid successful response.
4. Retain useful stale data on refresh failure and tell the user when the failure matters.
5. Fetch expensive related records on demand to avoid N+1 traffic.

Represent asynchronous UI with discriminated unions when loading, data, staleness, and failure can otherwise contradict one another:

```ts
export type AsyncState<T, E = AppError> =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'refreshing'; data: T }
	| { status: 'success'; data: T }
	| { status: 'stale'; data: T; error: E }
	| { status: 'error'; error: E };
```

-   Distinguish initial loading, background refresh, empty success, stale success, and failure when they produce different UI.
-   Use a reducer or explicit state machine when a flow has several dependent stages, retries, or transitions. Do not coordinate a state machine through unrelated booleans.
-   Define concurrency semantics: cancellation, deduplication, latest-request-wins, bounded parallelism, or deliberate coexistence. Prevent an older response from overwriting newer state.
-   Keep remote/server state separate from ephemeral UI state. Do not place high-frequency local state into a broad context provider.

## Providers and shared state

-   Define a context state interface before the context.
-   Name hooks `use[Name]Provider` and provider components `[Name]Provider` when following the established style.
-   Use a typed `DEFAULT_CONTEXT` with no-op functions only when access outside the provider is intentionally supported. Otherwise create the context with `undefined` and make the hook throw a clear configuration error.
-   Memoize a context value when object identity would otherwise trigger unrelated consumer renders.
-   Keep the provider value direct; avoid wrappers such as `(value) => handleValue(value)` when `handleValue` can be passed directly.
-   Reset account-scoped state when identity or network changes.
-   Make providers consume typed application contracts from `src/api/`; never import or initialize backend/SDK clients in a provider.
-   Keep adapter instances and raw transport details out of context values. Expose application actions and typed domain state instead.

## Forms

-   Track a baseline snapshot alongside editable state when change detection is required.
-   Compute `hasChanges` from semantically relevant fields.
-   Use `JSON.stringify` comparison only for small, JSON-safe data with stable key and array ordering. Use a domain comparator for sets, maps, dates, reordered records, or large structures.
-   Validate before requesting a signature or network write.
-   Send only changed fields when the API supports patches.
-   Disable duplicate submission while saving, but keep validation and failure messages perceivable.
-   Update the baseline only after confirmed success.
-   Preserve user input on failure.

## Errors and user feedback

Normalize expected failures into an application-owned taxonomy. Preserve a safe user message and stable code without leaking provider error objects:

```ts
export type AppErrorCode =
	| 'cancelled'
	| 'invalid-input'
	| 'invalid-response'
	| 'not-found'
	| 'not-indexed'
	| 'offline'
	| 'rate-limited'
	| 'rejected'
	| 'timeout'
	| 'unauthorized'
	| 'unavailable'
	| 'unknown-outcome'
	| 'unknown';

export type AppError = {
	code: AppErrorCode;
	message: string;
	retryable: boolean;
};
```

-   Branch on stable error codes, never provider message text or string fragments.
-   Use a `Result`-style return for expected domain failures when throwing would obscure normal control flow. Continue using exceptions for unexpected failures and rejected asynchronous operations where project conventions expect them.
-   Convert external errors once at the adapter boundary. UI layers may add contextual fallback copy but must not reverse-engineer provider errors.
-   Model a submitted transaction timeout as `unknown-outcome`, not an ordinary retryable timeout. Preserve its submission/transaction/message identifier when available and require reconciliation before allowing an automatic retry.

-   Transition every asynchronous operation out of loading on both success and failure. Use `finally` for independent cleanup; use explicit success/error transitions for discriminated state so a failure is not accidentally overwritten.
-   Narrow caught values before accessing `.message`:

```ts
const message = error instanceof Error ? error.message : 'Unable to save changes';
```

-   Send diagnostic detail through the project logger and a concise actionable message through the notification system.
-   Always provide a fallback user message.
-   Do not log secrets, signed payloads, authentication tokens, full sensitive profiles, or unnecessary wallet data.
-   Do not use an empty `catch`. If a best-effort secondary action may fail, record that decision with an appropriately scoped log or result state.
-   Separate a primary operation from best-effort follow-up work so a receipt or analytics failure does not falsely report that the primary write failed.

## Styling and responsive design

-   Use theme values or central styling tokens for colors and typography, and named semantic configuration for shared dimensions, radii, z-index, animation, and breakpoints.
-   Write component-local pixel measurements such as spacing, sizing, borders, and offsets directly in `styles.ts`. Do not create or extend catalogs of one-off measurements such as `CSS_DIMENSIONS`; reserve shared pixel-size configuration for typography and genuinely semantic dimensions such as control heights, navigation dimensions, radii, and breakpoints.
-   Do not add inline `style` props when styled-components are the project standard, and do not duplicate raw palette colors outside the theme.
-   Prefer semantic tokens such as `button.primary.background` over palette positions.
-   Put styled-components in `styles.ts` and export names that describe semantic roles such as `Wrapper`, `Header`, and `Actions`.
-   Move complex conditional CSS into typed helper functions.
-   Use transient props such as `$active` when the installed styled-components version supports them so styling-only props do not reach the DOM.
-   Implement `:hover`, `:focus-visible`, `:disabled`, active, error, and loading states together.
-   Preserve readable contrast and do not convey state by color alone.
-   Start with flexible layout. Add breakpoints from shared tokens only where content requires them.
-   Debounce costly resize work, prefer `ResizeObserver` when observing an element, and clean up every observer/listener.
-   Use passive scroll listeners and `requestAnimationFrame` for unavoidable scroll-driven DOM updates.
-   Respect `prefers-reduced-motion` for nonessential motion.

## Accessibility and content safety

-   Use a semantic native element before adding an ARIA role.
-   Give every control an accessible name and every input a programmatic label.
-   Support keyboard activation and visible focus for all interactive behavior.
-   Preserve logical heading order and DOM reading order.
-   Return focus after closing dialogs and contain focus while a modal is active.
-   Announce meaningful async status changes with an existing live-region/notification pattern.
-   Add `alt` text that communicates the image's purpose; use empty alt text for decorative images.
-   Sanitize untrusted HTML before rendering. Avoid `dangerouslySetInnerHTML`; never treat transaction or AO data as trusted markup.
-   Add `rel="noopener noreferrer"` to untrusted links opened in a new tab.

## Internationalization

-   Source every user-facing string from the language provider or translation layer, including validation, empty, loading, and error messages.
-   Use optional access while translations initialize and provide a purposeful fallback where blank UI would be harmful.
-   Memoize language-dependent arrays or objects with the active language/locale as a dependency.
-   Format dates, numbers, and currency with locale-aware APIs; keep atomic units out of display formatting logic.

## Performance

-   Memoize strategically, not reflexively.
-   Use `useMemo` for expensive derivation or a stable object passed across a memoized boundary.
-   Use `useCallback` when function identity matters to an effect, subscription, or memoized child.
-   Use `React.memo` for pure components with a meaningful rerender cost.
-   Lazy-load large editors, renderers, and route-only dependencies when the build supports reliable chunk loading. Verify chunk behavior for the target permaweb deployment format.
-   Prefer pagination, virtualization, and progressive fetching over rendering or fetching an unbounded collection.
-   Measure before adding complex memoization or manual chunking.
-   Store project-specific budgets in `.permaweb-frontend.json`; do not hardcode universal size limits in this reusable guide.
-   Budget total production output plus the largest JavaScript, CSS, font, and image artifacts relevant to the deployment. Keep enough explicit headroom for normal changes without allowing silent unbounded growth.
-   Run a current production build before checking budgets. Do not validate stale output.
-   Compare bundle output when adding dependencies, changing imports, adding assets/fonts, or altering lazy-loading boundaries.
-   Profile before and after render-performance work. Record the interaction, component, and measured bottleneck; do not justify `React.memo`, `React.useMemo`, or `React.useCallback` with speculation.
-   Split contexts by update frequency or use selectors when broad context updates rerender unrelated consumers.
-   Make list pagination or virtualization thresholds project-configurable and test empty, partial, and maximum practical data sets.

## Testing and review

Test behavior at the lowest useful level:

-   pure helpers: valid, invalid, empty, boundary, and precision cases
-   hooks/providers: identity changes, cache hit/miss, stale response, cleanup, and errors
-   components: keyboard behavior, labels, loading, empty, unauthorized, and retry states
-   accessibility: automated axe checks plus keyboard, focus, announcement, and reduced-motion behavior that static analysis cannot prove
-   requests: endpoint, tags, payload serialization, signer requirement, and response validation
-   adapter boundaries: contract substitution, provider-specific mapping, normalized errors, and no leaked SDK types
-   property-based cases: identifiers, decimal/base-unit conversion, serialization, parsers, and other pure boundary logic with large input spaces
-   architecture: bundled validator success plus focused fixtures proving important violations fail
-   performance: current production artifacts remain within configured budgets

Mock wallet and network boundaries. Never require a real seed phrase, mainnet spend, or production process for routine tests. Prefer injected application contracts to module-level implementation mocks. Keep snapshots focused; assert user-observable behavior and protocol payloads directly.

During adoption, establish at least one automated axe-capable component test and property-based tests for existing high-risk parsers, identifiers, serialization, or unit conversions. In steady state, extend and run those suites whenever the affected behavior changes. Real-browser checks remain required for contrast, focus movement, keyboard sequences, and announcements that a DOM emulator cannot prove.

As part of repository-wide review, scan every React source file and fail the audit if any import from `react` is not exactly the default `React` import or if imported React hooks, runtime functions, or types are used without the `React.*` namespace. Also fail when a header, footer, or sidebar component lives outside `src/navigation/`, when one remains under `src/components/`, or when a navigation component is missing its standard directory files.

## Automated enforcement

Run the bundled validator from the skill directory:

```sh
node path/to/permaweb-frontend-code-style/scripts/validate_frontend_architecture.mjs --root /path/to/project
```

After producing a current build, include `--performance` to enforce configured output budgets.

The validator must report all discovered violations in one run and return a nonzero exit code. It validates configuration and exception shape; scans TypeScript and legacy JavaScript; enforces React imports, dependency directions and runtime cycles, feature/API public indexes, navigation ownership, loose and malformed component directories, shared-only atom ownership, native-control ownership, project-wide test placement, external-capability boundaries, callback prop naming, configured design-token paths, repository metadata cleanup, build freshness, and performance budgets. Keep typecheck, tests, and builds as mandatory companion gates because static architecture checks do not replace the compiler or behavioral verification.
