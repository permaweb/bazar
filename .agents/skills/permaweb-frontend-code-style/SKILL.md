---
name: permaweb-frontend-code-style
description: Enforce clean, maintainable, reusable, performant React and TypeScript frontend architecture for Arweave and permaweb applications. Use when creating, refactoring, reviewing, debugging, auditing, testing, or migrating components, features, hooks, providers, styles, forms, state, backend or SDK integrations, wallet connections, AO interactions, ArNS-aware caching, static deployments, performance budgets, or project-wide frontend conventions in an Arweave-built web app.
---

# Permaweb Frontend Code Style

Honor explicit repository instructions and tooling while enforcing a typed, measurable frontend architecture. Treat browser, network, wallet, and blockchain boundaries as untrusted asynchronous APIs.

## Load the contract

-   Read [references/frontend-conventions.md](references/frontend-conventions.md) completely for every implementation, refactor, review, or audit.
-   Also read [references/permaweb-conventions.md](references/permaweb-conventions.md) completely when work touches wallets, signing, Arweave identifiers or transactions, AO processes/messages, gateways, token amounts, persistent caches, service workers, ArNS, or deployment.
-   Inspect installed SDK types and version-matched primary documentation before using an unfamiliar API.
-   Use [scripts/validate_frontend_architecture.mjs](scripts/validate_frontend_architecture.mjs) to enforce the structural contract when the repository can run Node.js.
-   In TypeScript repositories, install project dependencies first: the validator uses the installed compiler and `tsconfig.json` to resolve path aliases and runtime dependency edges.

## Resolve precedence

Apply instructions in this order:

1. User requirements and repository instructions such as `AGENTS.md`
2. Existing formatter, linter, compiler, test, and build configuration
3. This skill's required architecture, validation, safety, and performance rules
4. Deliberate adjacent conventions that do not conflict with those rules

Do not preserve a known architectural violation merely because it already exists. Keep behavior-preserving migrations separate from product redesign.

## Determine adoption state

Look for `.permaweb-frontend.json` at the repository root.

-   **Adoption mode:** The file is absent or its `status` is `adopting`. Audit the complete frontend, create a temporary migration map, define performance baselines, and migrate every mapped violation in safe vertical slices. Do not mark adoption complete while violations remain.
-   **Steady-state mode:** The file declares `status: "compliant"`. Run the bundled validator before planning, fix relevant violations, and keep the requested change scoped unless the validator reveals repository-wide drift.

Delete temporary migration maps and compatibility exports after adoption. Retain only durable configuration, tests, and architecture enforcement.

## Follow the workflow

### 1. Discover

-   Read repository instructions and inspect package, TypeScript, formatter, lint, test, build, deployment, and architecture configuration.
-   Run the architecture validator and inspect the target plus adjacent examples.
-   Inventory feature ownership, shared primitives, navigation, public barrels, dependency directions, API adapters, state models, runtime validation, design tokens, performance budgets, and tests.
-   Preserve unrelated user changes.

### 2. Plan

-   Put domain-owned UI, hooks, models, and types under `src/features/<Feature>/`; promote code to shared layers only after unrelated features reuse it. Keep all primitive atoms shared at root and let feature UI compose them.
-   Keep primitive UI in shared atoms, reusable compositions in shared molecules/organisms, all standalone headers/footers/sidebars in `src/navigation`, route orchestration in views, reusable behavior in hooks, shared state in providers, pure logic in helpers, and every external integration in typed `src/api` adapters.
-   Define dependency direction, public API, loading, stale, empty, rejection, error, cancellation, cleanup, and performance effects before implementing.
-   Add or extend a shared atom before using a raw or locally styled primitive control outside the atom layer.

### 3. Implement

-   Follow the detailed frontend and permaweb references as the authoritative rule source.
-   Import React only with `import React from 'react';` and access hooks, runtime functions, and types through `React.*`.
-   Name callback props `on...` and local event handlers `handle...`.
-   Keep component props inline by default. Allow a named exported props type only for a genuinely reused public contract, generic component, wrapper/HOC boundary, or discriminated props union.
-   Normalize expected failures into application-owned error codes and model multi-state asynchronous work with discriminated unions rather than contradictory booleans.
-   Validate external data at the API boundary, preserve on-chain integer precision, and request signatures only from explicit user actions.

### 4. Review

Review the diff for dependency inversions, cycles, deep imports, duplicated primitives, feature leakage, unsafe casts, swallowed errors, string-matched errors, stale closures, missing cleanup, unstable keys, N+1 requests, hardcoded copy, palette colors, or infrastructure values, inaccessible controls, sensitive logs, unsafe token math, ambiguous transaction states, and unmeasured performance changes.

### 5. Verify

-   Run the bundled architecture validator, formatter, typecheck, and focused/full tests.
-   Run accessibility and property-based tests when the affected surface has them.
-   Run production builds and performance-budget validation when imports, entrypoints, chunks, dependencies, assets, or deployment paths change.
-   Run a development server only when visual/browser behavior requires it; stop it afterward.
-   Validate this skill with the skill-creator `quick_validate.py` after editing it.

## Definition of done

Finish only when:

-   the bundled validator passes and the dependency graph is acyclic
-   domain code is feature-owned and shared code is genuinely reusable
-   public imports use deliberate barrels without cross-feature deep imports or mega barrels
-   every component and navigation module follows its standard directory contract
-   native primitive controls occur only inside atoms
-   every test artifact remains under the top-level `tests/` tree
-   external data, SDKs, backends, wallets, and networks remain behind typed adapters
-   async states, application errors, cleanup, cancellation, stale data, precision, and signing are intentional
-   accessibility checks and relevant behavioral, contract, boundary, and property tests pass
-   configured performance budgets pass after a current production build
-   temporary migration artifacts are removed and `.permaweb-frontend.json` accurately reports adoption status
