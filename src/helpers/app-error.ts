/**
 * Bazar's application error taxonomy.
 *
 * Adapters under `src/api` convert every provider, transport, wallet, and SDK failure into an `AppError` once, at the
 * boundary. UI layers normalize caught values with `toAppError`, branch only on `code` or `reason`, and display only
 * `appErrorMessage`. `message` is a safe diagnostic string for logs and tests; it is never shown to users.
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

const APP_ERROR_MESSAGES: Record<AppErrorCode, string> & Partial<Record<AppErrorReason, string>> = {
	// Per-code fallback copy.
	cancelled: 'The request was cancelled before it finished.',
	'invalid-input': 'Check the entered details and try again.',
	'invalid-response': 'The network returned data Bazar could not verify. Retry shortly.',
	'not-found': 'The requested record could not be found. Check the link or retry shortly.',
	'not-indexed': 'Arweave has not indexed this record yet. Retry shortly.',
	offline: 'Bazar could not reach the network. Check your connection and retry.',
	'rate-limited': 'The network is temporarily rate-limiting requests. Wait briefly and retry.',
	rejected: 'The request was rejected. Review the details before trying again.',
	timeout: 'The request timed out. Retry shortly.',
	unauthorized: 'The connected wallet cannot perform this action. Reconnect the correct wallet and try again.',
	unavailable: 'The service is temporarily unavailable. Retry shortly.',
	'unknown-outcome':
		'Bazar could not confirm whether this action completed. Anything already signed remains saved in this browser; check its status before trying again.',
	unknown: 'Something went wrong. Retry, and reload the page if the problem continues.',

	'compute-rate-limited':
		'The configured AO peers are temporarily rate-limiting live-state requests. Wait briefly and retry, or review the AO Core settings in the header.',
	'compute-unavailable':
		'Live state could not be read through the configured AO peers. Retry, or review the AO Core settings in the header.',
	'index-rate-limited': 'Arweave’s transaction index is temporarily rate-limiting requests. Wait briefly and retry.',
	'index-unavailable': 'Arweave’s transaction index could not be read. Retry shortly.',
	'ao-peer-missing': 'No AO peer is configured.',
	'asset-state-read-timeout':
		'The configured AO peers did not return live state within 45 seconds. No transaction was prepared or sent. Retry, or review the AO Core settings in the header.',
	'collection-indexes-unavailable':
		'No collection index could be read from Arweave. Check your connection and retry.',
	'order-match-search-limit': 'This order book is too large to quote safely. Refresh and try again.',

	'browser-storage-full':
		'Bazar could not safely save this operation because this browser’s site storage is full. Bazar already cleared its rebuildable caches, but more space is required. Free storage for this site, then continue from the status shown here.',
	'wallet-operation-lock-unavailable':
		'This browser cannot safely coordinate wallet approvals across tabs. Use a current browser with Web Locks support to trade.',

	'wander-wallet-missing': 'Install the Wander wallet extension to continue.',
	'permaweb-os-wallet-missing': 'Install the PermawebOS wallet extension to continue.',
	'wallet-connection-failed': 'The wallet connection failed. Try again.',
	'wallet-connection-rejected': 'The wallet connection was declined. Connect again when you are ready.',
	'wallet-address-unreadable':
		'The wallet connected, but its active address could not be read. Unlock or reconnect the wallet and try again.',
	'wallet-address-invalid':
		'The wallet connected, but no valid active address was returned. Unlock or reconnect the wallet and try again.',
	'wallet-disconnect-failed': 'Wallet could not be disconnected.',
	'wallet-keyfile-invalid': 'Choose a valid Arweave JSON keyfile.',
	'wallet-keyfile-incomplete': 'Could not complete the private RSA keyfile.',
	'wallet-keyfile-generation-failed': 'The generated Arweave keyfile was invalid.',
	'wallet-request-rejected': 'The wallet request was declined. Nothing was signed or sent.',
	'wallet-response-invalid': 'The wallet returned a transaction Bazar could not verify. Nothing was sent.',
	'wallet-sign-unavailable': 'Connect an Arweave wallet that can sign transactions.',
	'wallet-sign-failed': 'The wallet could not sign this transaction. Nothing was sent. Try again.',
	'wallet-account-changed':
		'The connected wallet changed after signing. Reconnect the original signer to continue the transaction saved in this browser.',
	'wallet-recovery-conflict':
		'Another signed action is already pending for this asset. Resume that action before starting a new one.',

	'market-state-changed':
		'The owner or listing changed since it was last checked. Close this dialog and review the updated market state before approving anything.',
	'asset-balance-state-unavailable':
		'The configured AO routes returned token and order state without a complete holder balance table. Bazar did not ask the wallet to approve a new purchase, listing, cancellation, or transfer. Retry after complete state is available; existing signed actions remain resumable.',
	'asset-balance-proof-unavailable':
		'The exact scheduled action was found, but the configured AO routes did not return complete holder balances for its before-and-after state. Bazar cannot safely decide whether it applied. The signed transaction remains saved in this browser; retry after complete balance state is available.',
	'asset-pending-listing-check-unavailable':
		'Bazar could not check Arweave for another recent listing transaction, so it did not ask your wallet to sign. Retry shortly.',
	'asset-listing-pending-self':
		'You already submitted a listing transaction; waiting for live asset state. No new wallet approval was requested.',
	'asset-listing-pending-other':
		'Another wallet submitted a pending listing transaction, but it has not been accepted by live asset state. No new wallet approval was requested.',
	'asset-action-starting-slot-unavailable':
		'The configured AO peers did not expose an exact process slot, so Bazar did not ask the wallet to approve this action. Retry, or review the AO Core settings in the header.',
	'asset-action-recovery-baseline-missing':
		'This older signed action has no exact process-slot baseline, so Bazar cannot reliably infer its outcome from aggregate state. The signed transaction remains saved in this browser for review.',
	'asset-state-timeout':
		'The sampled observers report the transaction as confirmed, but the configured AO peers have not applied it yet. Continue to keep checking live state.',
	'asset-purchase-insufficient-funds':
		'This wallet does not have enough AR for the network reward. No transaction was submitted.',
	'asset-purchase-insufficient-funds-after-signing':
		'This wallet does not have enough AR for the transaction and network fee. Add AR, then continue the transaction saved in this browser with the same wallet.',
	'asset-purchase-registration-fee-too-high':
		'This listing requires a reservation fee above Bazar’s purchase limit. The seller needs to relist the asset with a lower fee.',
	'asset-purchase-invalid-registration-fee':
		'This listing has an invalid reservation fee. The seller needs to correct the listing before it can be purchased.',
	'purchase-quote-balance-unavailable': 'Your AR balance could not be checked. Retry the cost check before buying.',
	'purchase-quote-network-fee-unavailable':
		'Arweave network fees are unavailable. Retry the cost check before buying.',
	'purchase-quote-unavailable':
		'Purchase costs could not be checked. Check your connection and try again. No payment has been sent.',
	'asset-order-reservation-expired':
		'The reservation window passed before the seller payment was dispatched. No seller payment was sent. The stale recovery has been cleared; start a new purchase if the listing is still available.',
	'asset-order-reservation-rejected':
		'The reservation was not active when the token process reached its transaction. It may have lost a race or been rejected by the token process. No seller payment was sent. The stale recovery has been cleared; review the current listing before trying again.',
	'asset-payment-id-missing':
		'This purchase recovery does not contain its exact seller-payment ID, so Bazar cannot prove settlement safely.',
	'asset-purchase-rejected':
		'The exact seller payment reached this asset’s schedule, but the token transfer was not applied. The permanent payment evidence remains saved for review.',
	'asset-purchase-proof-mismatch':
		'The configured AO peers returned incomplete scheduler proof for this purchase. Both transaction IDs remain saved in this browser; continue here, or review the AO Core settings in the header.',
	'asset-cancel-rejected':
		'This cancellation reached its exact schedule slot, but live state proves it was not applied. The listing changed first. Review the current order book before trying again.',
	'asset-cancel-proof-mismatch':
		'The configured AO peers returned incomplete scheduler proof for this cancellation. The signed transaction is saved in this browser; continue it here, or review the AO Core settings in the header.',
	'fungible-transfer-rejected':
		'This transfer reached its exact token schedule slot, but live state proves it was not applied. No tokens moved. Review the current balance before trying again.',
	'fungible-transfer-proof-mismatch':
		'The configured AO peers returned incomplete scheduler proof for this transfer. The signed transaction is saved in this browser; continue it here, or review the AO Core settings in the header.',
	'registration-not-found':
		'The exact reservation is already signed and submitted, but Bazar could not verify it across the required Arweave observers and live asset state during this check. Bazar will keep checking it automatically without signing again.',
	'payment-not-found':
		'The exact seller payment was submitted, but Bazar could not verify it across the required Arweave observers and live asset state during this check. Bazar will keep checking it automatically without paying again.',
	'transaction-dispatch-not-sent':
		'Bazar did not submit this signed transaction, so nothing reached Arweave. Review the details before trying again.',
	'transaction-dispatch-rejected':
		'The submission gateway rejected this exact signed transaction, so Bazar has no evidence that Arweave accepted it. Discard it before asking your wallet to sign a corrected replacement.',
	'registration-dispatch-rejected':
		'The submission gateway rejected the signed reservation. No seller payment was sent. Review the current listing before signing a replacement.',
	'payment-dispatch-rejected':
		'The submission gateway rejected the signed seller payment. The reservation may still be active; continue to recheck it and sign only a replacement payment if needed.',
	'transaction-propagation-timeout':
		'The sampled observers did not reach the required propagation quorum in time. The signed transaction remains saved in this browser; return with the same wallet and retained browser data to continue checking it.',
	'operation-amount-unavailable': 'Enter an amount available from the order book.',
	'operation-quantity-exceeds-balance': 'Enter a quantity within your liquid balance.',
	'purchase-batch-insufficient-funds':
		'The wallet no longer has enough AR to pay every reserved listing. No seller payment was sent.',
	'purchase-reservation-incomplete': 'A reservation could not complete. No remaining seller payment was sent.',
	'purchase-settlement-incomplete': 'Some settlements need attention.',
	'ar-amount-invalid': 'Enter a positive AR amount.',
	'listing-price-required': 'Enter the AR price for this asset.',
	'listing-price-too-low': 'Enter a price of at least 0.000000000001 AR.',
	'listing-price-invalid': 'Enter a valid AR amount with no more than 12 decimal places.',
	'transfer-recipient-required': 'Enter the recipient’s 43-character Arweave address.',
	'transfer-recipient-invalid': 'Enter a valid 43-character Arweave address.',
	'transfer-recipient-is-owner': 'Choose a different wallet. An asset cannot be transferred to its current owner.',
	'fungible-recipient-invalid': 'Enter a 43-character Arweave wallet address.',
	'fungible-recipient-is-owner':
		'Choose a different wallet. Sending tokens to this wallet would not change its balance.',

	'dispatch-insufficient-token-balance': 'Your token balance is smaller than the total quantity in the holder list.',
	'dispatch-self-recipient':
		'Remove your own address from the list. A transfer to yourself is a no-op that balance-based settlement cannot verify.',
	'dispatch-signed-transaction-recovery-required':
		'Bazar found a transaction ID for this dispatch row, but its saved signed transaction could not be restored. It may already have reached Arweave, so Bazar will not sign a replacement. Keep this dispatch plan for manual review, or restore the original browser data before resuming.',
	'dispatch-failed': 'Dispatch failed.',

	'mint-name-invalid': 'Enter a name between 1 and 80 characters.',
	'mint-description-invalid': 'Keep the description under 600 characters.',
	'mint-file-required': 'Choose an image, MP3, or WAV file to continue.',
	'mint-file-type-unsupported': 'Use a PNG, JPG, WebP, GIF, MP3, or WAV file.',
	'mint-file-size-invalid': 'Use an image up to 10 MB, or an MP3/WAV file up to 100 MB.',
	'mint-artwork-type-unsupported': 'Use a PNG, JPG, WebP, or GIF image for album artwork.',
	'mint-artwork-size-invalid': 'Choose album artwork no larger than 10 MB.',
	'mint-artwork-audio-only': 'Album artwork can only be attached to an MP3 or WAV asset.',
	'mint-logo-type-unsupported': 'Use a PNG, JPG, WebP, or GIF image for the token logo.',
	'mint-logo-size-invalid': 'Choose a token logo no larger than 10 MB.',
	'mint-ticker-invalid': 'Enter a token ticker between 1 and 32 characters.',
	'mint-supply-invalid': 'Enter a positive whole-number token supply.',
	'mint-supply-too-large': 'Token supply exceeds the maximum allowed.',
	'mint-denomination-invalid': 'Enter decimal places from 0 to 255.',
	'mint-insufficient-balance': 'This wallet does not have enough AR for the required Arweave transaction(s).',
	'mint-high-cost-confirmation-required': 'Review and approve the unusually high network cost before minting.',
	'mint-wallet-account-changed': 'The connected wallet changed. Reconnect the original wallet and try again.',
	'mint-draft-wallet-mismatch': 'Reconnect the wallet that uploaded this media to finish minting it.',
	'mint-media-invalid': 'The earlier media upload is empty, too large, or unavailable in its original form.',
	'mint-media-unavailable':
		'The earlier media upload is not available through this gateway yet. Try finishing the mint later.',
	'mint-udl-license-id-invalid': 'Enter a valid 43-character UDL transaction ID.',
	'mint-udl-access-fee-invalid': 'Enter a UDL access fee greater than zero.',
	'mint-udl-fee-invalid': 'Enter a UDL license fee greater than zero.',
	'mint-udl-share-invalid': 'Enter a UDL revenue share between 0 and 100 percent.',
	'mint-udl-expiry-invalid': 'Enter a whole number of years for the UDL license term.',

	'invalid-profile-avatar':
		'The existing profile picture is not a valid image reference. Choose a new picture and try again.',
	'invalid-profile-avatar-type': 'Choose a PNG, JPEG, WebP, or GIF image.',
	'invalid-profile-avatar-size': 'Choose an image smaller than 10 MB.',
	'profile-wallet-account-changed':
		'The connected wallet changed. Return to your current wallet profile and try again.',
	'profile-avatar-not-owned': 'This wallet no longer owns this unique asset.',
	'profile-update-failed': 'Your profile could not be updated. Please try again.',
};

/** The user-facing copy for one reason, falling back to its category's generic copy. */
export function appErrorReasonMessage(reason: AppErrorReason): string {
	return APP_ERROR_MESSAGES[reason] ?? APP_ERROR_MESSAGES[APP_ERROR_REASONS[reason].code];
}

/** The only user-facing text for an application error. Never display `error.message`. */
export function appErrorMessage(error: AppError): string {
	return appErrorReasonMessage(error.reason);
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

export function requestFailureMessage(source: RequestFailureSource, kind: RequestFailureKind): string {
	return appErrorReasonMessage(REQUEST_FAILURE_REASONS[source][kind]);
}
