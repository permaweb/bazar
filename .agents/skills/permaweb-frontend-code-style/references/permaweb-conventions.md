# Permaweb Conventions

Apply these rules at every wallet, Arweave, AO, gateway, cache, and deployment boundary.

## Contents

-   API adapters and SDK boundaries
-   Identifiers and external data
-   Wallet lifecycle and signing
-   AO reads and writes
-   Amounts and precision
-   Transactions, uploads, and tags
-   Networking and eventual consistency
-   Cache and persisted state
-   Environment and browser boundaries
-   Static deployment, ArNS, and service workers
-   Security and observability
-   Test matrix

## API adapters and SDK boundaries

-   Put every Arweave, AO, ArNS, Turbo, permaweb, wallet, gateway, GraphQL, and other external SDK import or network call inside a concrete adapter under `src/api/`.
-   Define application-owned contracts that hide the selected SDK and expose typed domain operations such as `getProfile`, `readProcess`, `transferToken`, or `resolveName`.
-   Forbid navigation, features, components, views, hooks, providers, and stores from importing these SDKs, calling their methods, issuing remote requests directly, or receiving raw clients through context.
-   Initialize and reuse clients inside the concrete adapter. Never construct them during render.
-   Use browser-specific SDK entrypoints when the installed package exposes them and the bundler requires them.
-   Keep read-only dependencies usable without a wallet. Add a signer only after a wallet is available.
-   Type the application contract even if an upstream SDK exposes `any`; confine any unavoidable cast to the concrete adapter.
-   Map SDK-specific responses, tags, errors, and legacy field names into application-owned domain types before returning.
-   Normalize expected provider failures into the application's stable error taxonomy. Never require UI code to match provider error messages.
-   Pin behavior to the installed SDK version and inspect its types. Treat examples from other versions as unverified.
-   Centralize gateway URLs, AO mode, scheduler, authority, network, and testnet flags. Do not scatter infrastructure IDs through components.
-   Keep protocol compatibility shims inside the adapter that owns them and explain the removal condition.
-   Select the active adapter in one composition point so changing a gateway, SDK, or backend does not require UI edits.

## Identifiers and external data

Treat wallet addresses, transaction IDs, data-item IDs, and AO process IDs as untrusted strings. Validate syntax at every external boundary and validate resource meaning through the appropriate network lookup when authorization or value is at stake.

Use one shared validator for the 43-character base64url form:

```ts
const ARWEAVE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ArweaveId = string & { readonly __brand: 'ArweaveId' };

export function isArweaveId(value: unknown): value is ArweaveId {
	return typeof value === 'string' && ARWEAVE_ID_PATTERN.test(value);
}
```

-   Do not accept `value.length === 43` as complete syntax validation.
-   Do not assume that a syntactically valid ID exists or is the expected resource type.
-   Encode path and query values with URL APIs or `encodeURIComponent`.
-   Validate `response.ok`, content type where relevant, and the parsed payload shape before use.
-   Normalize inconsistent upstream field names once at the boundary.
-   Treat transaction tags, AO message data, profile metadata, and cached JSON as untrusted input.

## Wallet lifecycle and signing

-   Never place a seed phrase, JWK, private key, auth secret, or server credential in frontend code, fixtures, logs, local storage, or environment variables exposed to the bundle.
-   Wrap the injected wallet or approved connector in `src/api/wallet/`. Keep wallet objects and signers private to the adapter and in memory.
-   Request the smallest permission set required for the immediate flow. Do not request signing, dispatch, public-key, or address access preemptively.
-   Start connection and signing from an explicit user action unless the wallet API safely restores an existing session without prompting.
-   Re-read and validate the active address after connection and before a sensitive write.
-   Handle wallet-loaded, account-switch, network-switch, and disconnect events. Register listeners once and remove them in cleanup.
-   Reset signer, balances, profile, permissions, in-flight operations, and account-scoped state when identity changes.
-   Namespace persisted preferences by wallet and network. A stored wallet type is a convenience, not proof of authentication.
-   Disable duplicate signing actions while one request is pending.
-   Distinguish `awaiting-wallet`, `submitted`, `confirming`, `confirmed`, `rejected`, and `failed` when the flow exposes those stages.
-   Treat user rejection as an expected outcome with neutral, actionable copy.
-   Recheck capability-side authorization. Hiding or disabling UI is not enforcement.

## AO reads and writes

-   Perform every AO read, dry run, message, signer call, and response parse inside the AO adapter under `src/api/`.
-   Use read-only APIs or dry runs without a signer when possible.
-   Require a signer for writes and create it from the current approved wallet.
-   Centralize construction of process IDs, actions, tags, data, timeouts, and response parsing.
-   Use protocol-defined tag names exactly. Serialize every tag value as a string.
-   Validate both the transport envelope and the application-level result; an AO message ID means submission, not successful execution.
-   Expose submitted message IDs for support and status tracking without presenting them as confirmation.
-   Add a timeout or cancellation boundary to UI-initiated operations, then model the result as unknown/pending when the network may still complete the write.
-   Do not automatically retry a signed or non-idempotent message unless the protocol supplies an idempotency mechanism. A timeout is not proof of failure.
-   Poll or subscribe for final state only when the product needs confirmation. Bound the attempt count, use backoff, and allow the user to leave safely.
-   Avoid N+1 process reads. Use supported state paths, batch/concurrent reads with a limit, or progressive loading.
-   Keep legacy and current process behavior behind a typed compatibility adapter rather than branching throughout UI components.

Example transfer intent shape:

```ts
type TransferIntent = {
	process: ArweaveId;
	recipient: ArweaveId;
	quantity: string;
};

function toTransferTags(intent: TransferIntent) {
	return [
		{ name: 'Action', value: 'Transfer' },
		{ name: 'Recipient', value: intent.recipient },
		{ name: 'Quantity', value: intent.quantity },
	];
}
```

## Amounts and precision

-   Represent atomic units such as winston, winc, mARIO, and AO token quantities as decimal strings or `bigint` in application logic.
-   Never use JavaScript `Number` for an on-chain integer that may exceed `Number.MAX_SAFE_INTEGER`.
-   Never convert a human decimal amount with floating-point multiplication.
-   Validate the input as a decimal string, enforce the token's decimal precision, and convert to base units with string/`bigint` logic.
-   Keep token symbol, process ID, decimals, quantity, and recipient together in a typed model.
-   Convert only at boundaries: human decimal to integer string before signing; integer string to localized display text after reading.
-   Keep fiat estimates explicitly approximate and separate from the signed atomic quantity.
-   Reject negative, zero where disallowed, exponential notation, excess fractional digits, `NaN`, and infinity.

```ts
export function toBaseUnits(input: string, decimals: number): string {
	if (!Number.isInteger(decimals) || decimals < 0) throw new Error('Invalid token decimals');
	if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(input)) throw new Error('Invalid token amount');

	const [whole, fraction = ''] = input.split('.');
	if (fraction.length > decimals) throw new Error('Token amount has too many decimal places');

	const atomic = `${whole}${fraction.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '');
	return BigInt(atomic || '0').toString();
}
```

## Transactions, uploads, and tags

-   Estimate byte size and user-visible cost before upload when cost matters.
-   Set the correct content type and protocol/application tags through a centralized builder.
-   Validate and normalize every tag name/value; tags are public and permanent.
-   Avoid putting secrets, unnecessary personal data, or mutable private state on-chain.
-   Sign only the exact prepared payload the UI described to the user.
-   Validate the gateway/SDK submission response and accept only documented successful states.
-   Separate upload/submission from indexing or application-level confirmation.
-   Treat receipts, analytics, and metadata mirrors as secondary operations unless the protocol makes them atomic with the primary action.
-   Preserve IDs and failure stage in a safe diagnostic result so a user can recover from partial success.

## Networking and eventual consistency

-   Centralize endpoints in `src/api/` configuration and construct them with `URL` where practical.
-   Use `AbortController` or a timeout for user-facing fetches.
-   Retry only idempotent reads by default, with capped exponential backoff and jitter.
-   Expect gateways, GraphQL indexes, AO state, ArNS resolution, and caches to disagree temporarily.
-   Do not erase known-good UI state because a refresh failed or an index has not caught up.
-   Distinguish not found, not indexed yet, unauthorized, rate limited, rejected, timeout/unknown, and offline where the user can act differently.
-   Provide a bounded refresh path after writes instead of assuming read-after-write consistency.
-   Encode network/testnet in cache keys and diagnostics.

## Cache and persisted state

-   Use cache-first rendering only for data that may safely be stale.
-   Namespace keys by application, schema version, network, resource, and wallet when identity matters.
-   Store an envelope with data, timestamp, and schema version. Add a TTL when staleness changes correctness.
-   Parse stored JSON in `try/catch`, validate its shape, and discard only the invalid entry.
-   Update the cache after a valid successful response, not before a signed write is confirmed.
-   Do not cache a signer, wallet object, secret, raw authorization claim, or permission decision beyond its valid scope.
-   Do not call `localStorage.clear()` from a shared frontend. Remove only keys owned by the application and preserve unrelated origin data.
-   Invalidate account-scoped data on wallet switch and network-scoped data on network switch.
-   Keep portal/profile roles scoped to the portal instead of contaminating a global cached profile.

## Environment and browser boundaries

-   Treat every frontend environment variable as public. Never use a client-prefixed variable for a secret.
-   Declare the environment interface and parse strings into booleans, numbers, URLs, and enums in one config module.
-   Fail early with a useful message when a required network setting is absent or invalid.
-   Guard `window`, `document`, `navigator`, `localStorage`, and injected wallets when SSR, tests, workers, or pre-rendering may execute the module.
-   Put injected wallet and connector types in a global declaration file rather than scattering `(window as any)`.
-   Feature-detect browser APIs such as service workers and clipboard access.
-   Keep Node polyfills deliberate. Prefer browser SDK entrypoints and Web APIs instead of enlarging the bundle with broad polyfills.

## Static deployment, ArNS, and service workers

-   Assume the application must run from immutable static assets without a custom server.
-   Use relative asset paths or the deployment's verified base path. For Vite deployments under varying gateways or paths, verify whether `base: './'` is required.
-   Do not assume server-side SPA rewrites. Choose hash routing, a generated fallback, or a hosting-supported rewrite and test deep links through the actual gateway shape.
-   Avoid hardcoded `window.location.origin` assumptions when an app may be served through ArNS, a gateway, an undername, or a path.
-   Verify dynamic chunks, workers, manifests, icons, and lazy imports after bundling. A single-file/IIFE target may require different code-splitting choices than a normal site.
-   Use content-addressed/versioned caches and define an update strategy for immutable deployments.
-   When checking the resolved ArNS ID, treat a change as a deployment update. Invalidate only application-owned caches, activate the new service worker safely, and avoid reload loops.
-   Skip or adapt service-worker behavior on localhost and unsupported browsers.
-   Register service-worker listeners once, handle update states, and remove application listeners when appropriate.
-   Make offline behavior explicit. Never cache a failed API response or a signed-write request.
-   Verify the final output directory, relative URLs, direct navigation, refresh, wallet injection, and cache update behavior before deployment.

## Security and observability

-   Treat all permanent data as public and all remote content as hostile until validated/sanitized.
-   Enforce HTTPS for gateways and external APIs.
-   Do not embed privileged server API keys in the bundle.
-   Apply a restrictive Content Security Policy where hosting allows it and minimize third-party script origins.
-   Escape or sanitize transaction/markdown/HTML content before rendering.
-   Log operation name, safe resource/message ID, network, stage, elapsed time, and normalized error category when useful.
-   Do not log full signed transactions, signatures, auth payloads, private content, or unnecessary wallet/profile data.
-   Make fallback gateways and compatibility paths observable so failures can be diagnosed.

## Test matrix

Cover the relevant cases under `tests/api/` with mocked application contracts and focused concrete-adapter tests:

-   no wallet, successful connect, user rejection, account switch, and disconnect
-   malformed and well-formed 43-character identifiers
-   atomic-unit boundary values above `Number.MAX_SAFE_INTEGER`
-   excess decimal places and zero/negative amounts
-   cache hit, expired cache, corrupt cache, wrong network, and stale refresh failure
-   AO submission success, application error, timeout with unknown outcome, and eventual confirmation
-   gateway non-2xx, invalid JSON, schema mismatch, abort, and indexed-late behavior
-   deep link, relative asset loading, lazy chunk loading, service-worker update, and ArNS resolved-ID change

Use property-based tests for identifier validators, atomic-unit conversion, serialization, tag builders, and parsers when their input space is broader than a small example table can cover.

Never make routine tests spend funds, require a real private key, or depend on mainnet state.
