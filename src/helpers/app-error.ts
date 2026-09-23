/**
 * Bazar's application error taxonomy.
 *
 * Adapters under `src/api` convert every provider, transport, wallet, and SDK failure into an `AppError` once, at the
 * boundary. UI layers normalize caught values with `toAppError`, branch only on `code` or `reason`, and display only
 * `appErrorMessage`. `message` is a safe diagnostic string for logs and tests; it is never shown to users.
 *
 * This module holds no copy. The reason-keyed English catalog lives in `helpers/app-error.messages`; components read it
 * through `hooks/useAppErrorMessage`, and pure model functions take the resolved dictionary as a parameter.
 *
 * Add a specific reason only when the app needs to distinguish it: dedicated copy, a branch, or a persisted recovery
 * record. Otherwise throw the generic reason named after its category and keep the precise diagnostic code in
 * `message`. Existing kebab-case spellings are stable: saved purchase recoveries and weave-wrangler lifecycle states
 * carry them across reloads.
 */

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

type ReasonDefinition = { readonly code: AppErrorCode; readonly retryable: boolean };

const APP_ERROR_REASONS = {
	// Generic categories. Each code is also a reason for failures that need no dedicated copy.
	cancelled: { code: 'cancelled', retryable: true },
	'invalid-input': { code: 'invalid-input', retryable: false },
	'invalid-response': { code: 'invalid-response', retryable: true },
	'not-found': { code: 'not-found', retryable: true },
	'not-indexed': { code: 'not-indexed', retryable: true },
	offline: { code: 'offline', retryable: true },
	'rate-limited': { code: 'rate-limited', retryable: true },
	rejected: { code: 'rejected', retryable: false },
	timeout: { code: 'timeout', retryable: true },
	unauthorized: { code: 'unauthorized', retryable: false },
	unavailable: { code: 'unavailable', retryable: true },
	'unknown-outcome': { code: 'unknown-outcome', retryable: false },
	unknown: { code: 'unknown', retryable: true },

	// Marketplace reads: AO compute (live asset state) and the Arweave transaction index.
	'compute-rate-limited': { code: 'rate-limited', retryable: true },
	'compute-unavailable': { code: 'unavailable', retryable: true },
	'index-rate-limited': { code: 'rate-limited', retryable: true },
	'index-unavailable': { code: 'unavailable', retryable: true },
	'ao-peer-missing': { code: 'unavailable', retryable: false },
	'asset-state-read-timeout': { code: 'timeout', retryable: true },
	'collection-indexes-unavailable': { code: 'unavailable', retryable: true },
	'order-match-search-limit': { code: 'invalid-input', retryable: false },

	// Browser capabilities.
	'browser-storage-full': { code: 'unavailable', retryable: false },
	'wallet-operation-lock-unavailable': { code: 'unavailable', retryable: false },

	// Wallet connection and signing.
	'wander-wallet-missing': { code: 'unavailable', retryable: false },
	'permaweb-os-wallet-missing': { code: 'unavailable', retryable: false },
	'wallet-connection-failed': { code: 'unavailable', retryable: true },
	'wallet-connection-rejected': { code: 'rejected', retryable: true },
	'wallet-address-unreadable': { code: 'unavailable', retryable: true },
	'wallet-address-invalid': { code: 'invalid-response', retryable: true },
	'wallet-disconnect-failed': { code: 'unavailable', retryable: true },
	'wallet-keyfile-invalid': { code: 'invalid-input', retryable: false },
	'wallet-keyfile-incomplete': { code: 'invalid-input', retryable: false },
	'wallet-keyfile-generation-failed': { code: 'unknown', retryable: true },
	'wallet-request-rejected': { code: 'rejected', retryable: true },
	'wallet-response-invalid': { code: 'invalid-response', retryable: false },
	'wallet-sign-unavailable': { code: 'unauthorized', retryable: false },
	'wallet-sign-failed': { code: 'unavailable', retryable: true },
	'wallet-account-changed': { code: 'unauthorized', retryable: false },
	'wallet-recovery-conflict': { code: 'rejected', retryable: false },

	// Listing, cancellation, transfer, and purchase preconditions and outcomes.
	'market-state-changed': { code: 'rejected', retryable: false },
	'asset-balance-state-unavailable': { code: 'unavailable', retryable: true },
	'asset-balance-proof-unavailable': { code: 'unknown-outcome', retryable: false },
	'asset-pending-listing-check-unavailable': { code: 'unavailable', retryable: true },
	'asset-listing-pending-self': { code: 'rejected', retryable: false },
	'asset-listing-pending-other': { code: 'rejected', retryable: false },
	'asset-action-starting-slot-unavailable': { code: 'unavailable', retryable: true },
	'asset-action-recovery-baseline-missing': { code: 'unknown-outcome', retryable: false },
	'asset-state-timeout': { code: 'unknown-outcome', retryable: false },
	'asset-purchase-insufficient-funds': { code: 'rejected', retryable: false },
	'asset-purchase-insufficient-funds-after-signing': { code: 'rejected', retryable: false },
	'asset-purchase-registration-fee-too-high': { code: 'rejected', retryable: false },
	'asset-purchase-invalid-registration-fee': { code: 'rejected', retryable: false },
	'purchase-quote-balance-unavailable': { code: 'unavailable', retryable: true },
	'purchase-quote-network-fee-unavailable': { code: 'unavailable', retryable: true },
	'purchase-quote-unavailable': { code: 'unavailable', retryable: true },
	'asset-order-reservation-expired': { code: 'rejected', retryable: false },
	'asset-order-reservation-rejected': { code: 'rejected', retryable: false },
	'asset-payment-id-missing': { code: 'unknown-outcome', retryable: false },
	'asset-purchase-rejected': { code: 'rejected', retryable: false },
	'asset-purchase-proof-mismatch': { code: 'unknown-outcome', retryable: false },
	'asset-cancel-rejected': { code: 'rejected', retryable: false },
	'asset-cancel-proof-mismatch': { code: 'unknown-outcome', retryable: false },
	'fungible-transfer-rejected': { code: 'rejected', retryable: false },
	'fungible-transfer-proof-mismatch': { code: 'unknown-outcome', retryable: false },
	'registration-not-found': { code: 'unknown-outcome', retryable: false },
	'payment-not-found': { code: 'unknown-outcome', retryable: false },
	'transaction-dispatch-not-sent': { code: 'unavailable', retryable: true },
	'transaction-dispatch-rejected': { code: 'rejected', retryable: false },
	'registration-dispatch-rejected': { code: 'rejected', retryable: false },
	'payment-dispatch-rejected': { code: 'rejected', retryable: false },
	'transaction-propagation-timeout': { code: 'unknown-outcome', retryable: false },
	'operation-amount-unavailable': { code: 'invalid-input', retryable: false },
	'operation-quantity-exceeds-balance': { code: 'invalid-input', retryable: false },
	'purchase-batch-insufficient-funds': { code: 'rejected', retryable: false },
	'purchase-reservation-incomplete': { code: 'unknown', retryable: false },
	'purchase-settlement-incomplete': { code: 'unknown', retryable: false },
	'ar-amount-invalid': { code: 'invalid-input', retryable: false },
	'listing-price-required': { code: 'invalid-input', retryable: false },
	'listing-price-too-low': { code: 'invalid-input', retryable: false },
	'listing-price-invalid': { code: 'invalid-input', retryable: false },
	'transfer-recipient-required': { code: 'invalid-input', retryable: false },
	'transfer-recipient-invalid': { code: 'invalid-input', retryable: false },
	'transfer-recipient-is-owner': { code: 'invalid-input', retryable: false },
	'fungible-recipient-invalid': { code: 'invalid-input', retryable: false },
	'fungible-recipient-is-owner': { code: 'invalid-input', retryable: false },

	// Token dispatch to holder lists.
	'dispatch-insufficient-token-balance': { code: 'rejected', retryable: false },
	'dispatch-self-recipient': { code: 'invalid-input', retryable: false },
	'dispatch-signed-transaction-recovery-required': { code: 'unknown-outcome', retryable: false },
	'dispatch-failed': { code: 'unknown', retryable: true },

	// Minting.
	'mint-name-invalid': { code: 'invalid-input', retryable: false },
	'mint-description-invalid': { code: 'invalid-input', retryable: false },
	'mint-file-required': { code: 'invalid-input', retryable: false },
	'mint-file-type-unsupported': { code: 'invalid-input', retryable: false },
	'mint-file-size-invalid': { code: 'invalid-input', retryable: false },
	'mint-artwork-type-unsupported': { code: 'invalid-input', retryable: false },
	'mint-artwork-size-invalid': { code: 'invalid-input', retryable: false },
	'mint-artwork-audio-only': { code: 'invalid-input', retryable: false },
	'mint-logo-type-unsupported': { code: 'invalid-input', retryable: false },
	'mint-logo-size-invalid': { code: 'invalid-input', retryable: false },
	'mint-ticker-invalid': { code: 'invalid-input', retryable: false },
	'mint-supply-invalid': { code: 'invalid-input', retryable: false },
	'mint-supply-too-large': { code: 'invalid-input', retryable: false },
	'mint-denomination-invalid': { code: 'invalid-input', retryable: false },
	'mint-insufficient-balance': { code: 'rejected', retryable: false },
	'mint-high-cost-confirmation-required': { code: 'invalid-input', retryable: false },
	'mint-wallet-account-changed': { code: 'unauthorized', retryable: false },
	'mint-draft-wallet-mismatch': { code: 'unauthorized', retryable: false },
	'mint-media-invalid': { code: 'invalid-response', retryable: false },
	'mint-media-unavailable': { code: 'not-indexed', retryable: true },
	'mint-udl-license-id-invalid': { code: 'invalid-input', retryable: false },
	'mint-udl-access-fee-invalid': { code: 'invalid-input', retryable: false },
	'mint-udl-fee-invalid': { code: 'invalid-input', retryable: false },
	'mint-udl-share-invalid': { code: 'invalid-input', retryable: false },
	'mint-udl-expiry-invalid': { code: 'invalid-input', retryable: false },

	// Profiles.
	'invalid-profile-avatar': { code: 'invalid-input', retryable: false },
	'invalid-profile-avatar-type': { code: 'invalid-input', retryable: false },
	'invalid-profile-avatar-size': { code: 'invalid-input', retryable: false },
	'profile-wallet-account-changed': { code: 'unauthorized', retryable: false },
	'profile-avatar-not-owned': { code: 'unauthorized', retryable: false },
	'profile-update-failed': { code: 'unknown', retryable: true },
} as const satisfies Record<string, ReasonDefinition>;

export type AppErrorReason = keyof typeof APP_ERROR_REASONS;

/** Every reason, for exhaustive tests and tooling. */
export const APP_ERROR_REASON_LIST = Object.keys(APP_ERROR_REASONS) as AppErrorReason[];

/**
 * Safe identifiers the recovery UI needs. Never place provider text, signed payloads, or wallet data here.
 */
export type AppErrorDetail = {
	/** The signed transaction or AO message that may already be on the network. */
	readonly transactionId?: string;
	/** The other wallet involved, such as the actor of a pending listing. */
	readonly actor?: string;
	/** `not-sent` proves no submission was attempted for `transactionId`. */
	readonly stage?: 'not-sent';
	/** Batched settlements: how many lots failed out of how many, and each distinct failure reason. */
	readonly failedCount?: number;
	readonly totalCount?: number;
	readonly failureReasons?: readonly AppErrorReason[];
};

export type AppErrorOptions = {
	/** Safe diagnostic text, such as the adapter's precise failure code. Defaults to the reason. */
	message?: string;
	cause?: unknown;
	detail?: AppErrorDetail;
};

export class AppError extends Error {
	readonly code: AppErrorCode;
	readonly reason: AppErrorReason;
	readonly retryable: boolean;
	readonly detail?: AppErrorDetail;

	constructor(reason: AppErrorReason, options: AppErrorOptions = {}) {
		super(options.message ?? reason, options.cause === undefined ? undefined : { cause: options.cause });
		const definition: ReasonDefinition = APP_ERROR_REASONS[reason];
		this.name = 'AppError';
		this.reason = reason;
		this.code = definition.code;
		this.retryable = definition.retryable;
		if (options.detail) this.detail = options.detail;
	}
}

export function appError(reason: AppErrorReason, options?: AppErrorOptions): AppError {
	return new AppError(reason, options);
}

export function isAppError(value: unknown): value is AppError {
	return value instanceof AppError;
}

export function isAppErrorReason(value: unknown): value is AppErrorReason {
	return typeof value === 'string' && Object.prototype.hasOwnProperty.call(APP_ERROR_REASONS, value);
}

/**
 * Spellings older Bazar builds and weave-wrangler releases displayed or stored for stable reasons. Only these exact
 * legacy strings are recognized; arbitrary provider text never becomes a reason.
 */
const LEGACY_REASON_SPELLINGS: Readonly<Record<string, AppErrorReason>> = {
	'registration not found': 'registration-not-found',
	'payment not found': 'payment-not-found',
	'asset purchase rejected': 'asset-purchase-rejected',
	'asset purchase proof mismatch': 'asset-purchase-proof-mismatch',
	registration_not_found: 'registration-not-found',
	payment_not_found: 'payment-not-found',
};

/** Resolve a stored or reported reason string, including the recognized legacy spellings. */
export function knownAppErrorReason(value: unknown): AppErrorReason | null {
	if (typeof value !== 'string') return null;
	if (isAppErrorReason(value)) return value;
	const legacy = value.trim().toLowerCase();
	return Object.prototype.hasOwnProperty.call(LEGACY_REASON_SPELLINGS, legacy)
		? LEGACY_REASON_SPELLINGS[legacy]
		: null;
}

function errorName(value: object): string {
	const name = (value as { name?: unknown }).name;
	return typeof name === 'string' ? name : '';
}

/**
 * Normalize any caught value into an `AppError`.
 *
 * `AppError`s pass through unchanged. Aborts become `cancelled` and timeout signals become `timeout`. A legacy
 * `Error` or plain object whose `reason`, `code`, or `message` is exactly a known reason, or a persisted reason
 * string, keeps that reason. Everything else becomes `fallbackReason`, with the original value kept only as `cause`.
 */
export function toAppError(cause: unknown, fallbackReason: AppErrorReason): AppError {
	if (isAppError(cause)) return cause;
	if (typeof cause === 'string') {
		const reason = knownAppErrorReason(cause);
		return appError(reason ?? fallbackReason, reason ? {} : { cause });
	}
	if (cause && typeof cause === 'object') {
		const name = errorName(cause);
		if (name === 'AbortError') return appError('cancelled', { cause });
		if (name === 'TimeoutError') return appError('timeout', { cause });
		const fields = cause as { reason?: unknown; code?: unknown; message?: unknown };
		const reason =
			knownAppErrorReason(fields.reason) ??
			knownAppErrorReason(fields.code) ??
			knownAppErrorReason(fields.message);
		if (reason) return appError(reason, { cause });
	}
	return appError(fallbackReason, { cause });
}

/**
 * The resolved user-facing copy for every reason, in the active language.
 *
 * `helpers/app-error.messages` holds the English source catalog. React code resolves it with
 * `hooks/useAppErrorMessage`; pure model functions take the resolved dictionary as a parameter so this module stays
 * framework-independent.
 */
export type AppErrorMessages = Record<AppErrorReason, string>;

/** The user-facing copy for one reason. Reasons that need no dedicated copy resolve their category's generic entry. */
export function appErrorReasonMessage(messages: AppErrorMessages, reason: AppErrorReason): string {
	return messages[reason];
}

/** The only user-facing text for an application error. Never display `error.message`. */
export function appErrorMessage(messages: AppErrorMessages, error: AppError): string {
	return appErrorReasonMessage(messages, error.reason);
}

export type RequestFailureSource = 'compute' | 'index';
export type RequestFailureKind = 'rate-limited' | 'unavailable';

/** Classify a failed marketplace read for retry guidance: rate limiting versus any other unavailability. */
export function requestFailureKind(cause: unknown): RequestFailureKind {
	return toAppError(cause, 'unavailable').code === 'rate-limited' ? 'rate-limited' : 'unavailable';
}

const REQUEST_FAILURE_REASONS: Record<RequestFailureSource, Record<RequestFailureKind, AppErrorReason>> = {
	compute: { 'rate-limited': 'compute-rate-limited', unavailable: 'compute-unavailable' },
	index: { 'rate-limited': 'index-rate-limited', unavailable: 'index-unavailable' },
};

export function requestFailureMessage(
	messages: AppErrorMessages,
	source: RequestFailureSource,
	kind: RequestFailureKind
): string {
	return appErrorReasonMessage(messages, REQUEST_FAILURE_REASONS[source][kind]);
}
