import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
	APP_ERROR_REASON_LIST,
	AppError,
	appError,
	type AppErrorCode,
	appErrorMessage,
	appErrorReasonMessage,
	isAppError,
	isAppErrorReason,
	knownAppErrorReason,
	requestFailureKind,
	requestFailureMessage,
	toAppError,
} from 'helpers/app-error';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';

const CODES: AppErrorCode[] = [
	'cancelled',
	'invalid-input',
	'invalid-response',
	'not-found',
	'not-indexed',
	'offline',
	'rate-limited',
	'rejected',
	'timeout',
	'unauthorized',
	'unavailable',
	'unknown-outcome',
	'unknown',
];
const MESSAGES = APP_ERROR_MESSAGES.en;
const COPY = new Set(APP_ERROR_REASON_LIST.map((reason) => appErrorReasonMessage(MESSAGES, reason)));

describe('application error reasons', () => {
	it('defines a category, retry policy, and copy for every reason', () => {
		for (const reason of APP_ERROR_REASON_LIST) {
			const error = appError(reason);
			expect(CODES).toContain(error.code);
			expect(typeof error.retryable).toBe('boolean');
			expect(appErrorMessage(MESSAGES, error).trim().length).toBeGreaterThan(0);
			expect(appErrorMessage(MESSAGES, error)).not.toMatch(/^[a-z]+(?:-[a-z0-9]+)+$/);
			expect(error.message).toBe(reason);
		}
	});

	it('names every category as a generic reason with its own fallback copy', () => {
		for (const code of CODES) {
			expect(isAppErrorReason(code)).toBe(true);
			expect(appError(code).code).toBe(code);
		}
		expect(appErrorMessage(MESSAGES, appError('invalid-input', { message: 'mint-artist-invalid' }))).toBe(
			appErrorReasonMessage(MESSAGES, 'invalid-input')
		);
	});

	it('never lets an unknown outcome be retried automatically', () => {
		for (const reason of APP_ERROR_REASON_LIST) {
			const error = appError(reason);
			if (error.code === 'unknown-outcome') expect(error.retryable).toBe(false);
		}
		expect(appError('transaction-propagation-timeout')).toMatchObject({
			code: 'unknown-outcome',
			retryable: false,
		});
	});

	it('keeps a safe diagnostic message, cause, and recovery identifiers separate from user copy', () => {
		const cause = new Error('socket hang up');
		const error = appError('unknown-outcome', {
			message: 'transaction-dispatch-unconfirmed',
			cause,
			detail: { transactionId: 'T'.repeat(43) },
		});
		expect(error).toBeInstanceOf(AppError);
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('AppError');
		expect(error.message).toBe('transaction-dispatch-unconfirmed');
		expect(error.cause).toBe(cause);
		expect(error.detail).toEqual({ transactionId: 'T'.repeat(43) });
		expect(appErrorMessage(MESSAGES, error)).not.toContain('socket');
	});

	it.each([
		['browser-storage-full', 'cleared its rebuildable caches'],
		['asset-purchase-insufficient-funds-after-signing', 'saved in this browser with the same wallet'],
		['transaction-propagation-timeout', 'return with the same wallet and retained browser data'],
		['asset-state-timeout', 'sampled observers report the transaction as confirmed'],
		['asset-state-read-timeout', 'No transaction was prepared or sent'],
		['asset-order-reservation-expired', 'start a new purchase'],
		['asset-order-reservation-rejected', 'may have lost a race'],
		['wallet-account-changed', 'Reconnect the original signer to continue'],
		['wallet-recovery-conflict', 'Resume that action before starting a new one.'],
		['asset-balance-state-unavailable', 'did not ask the wallet to approve'],
		['asset-balance-proof-unavailable', 'signed transaction remains saved'],
		['registration-not-found', 'without signing again.'],
		['payment-not-found', 'without paying again.'],
		['fungible-transfer-rejected', 'No tokens moved.'],
		['fungible-transfer-proof-mismatch', 'signed transaction is saved in this browser'],
		['asset-cancel-rejected', 'listing changed first'],
		['asset-cancel-proof-mismatch', 'signed transaction is saved in this browser'],
		['asset-purchase-rejected', 'permanent payment evidence'],
		['asset-purchase-proof-mismatch', 'Both transaction IDs remain saved in this browser'],
		['asset-payment-id-missing', 'cannot prove settlement safely'],
		['asset-action-starting-slot-unavailable', 'did not ask the wallet'],
		['asset-action-recovery-baseline-missing', 'cannot reliably infer its outcome'],
		['asset-pending-listing-check-unavailable', 'did not ask your wallet to sign'],
		['payment-dispatch-rejected', 'reservation may still be active'],
		['mint-media-unavailable', 'not available through this gateway yet'],
		['mint-wallet-account-changed', 'Reconnect the original wallet and try again.'],
		['wallet-sign-unavailable', 'Connect an Arweave wallet that can sign transactions.'],
		['ar-amount-invalid', 'Enter a positive AR amount.'],
	] as const)('explains recovery for %s', (reason, guidance) => {
		expect(appErrorReasonMessage(MESSAGES, reason)).toContain(guidance);
	});

	it('explains that observation-window failures continue automatically', () => {
		for (const reason of ['registration-not-found', 'payment-not-found'] as const) {
			const message = appErrorReasonMessage(MESSAGES, reason);
			expect(message).toContain('keep checking');
			expect(message).toContain('automatically');
			expect(message).not.toContain('visible Resume action');
			expect(message).not.toContain('Reload');
		}
	});
});

describe('toAppError', () => {
	it('returns an AppError unchanged', () => {
		const error = appError('market-state-changed');
		expect(toAppError(error, 'unknown')).toBe(error);
		expect(isAppError(error)).toBe(true);
		expect(isAppError(new Error('market-state-changed'))).toBe(false);
	});

	it('recognizes a legacy Error whose message is a known reason', () => {
		const legacy = new Error('asset-order-reservation-expired');
		expect(toAppError(legacy, 'unknown')).toMatchObject({
			reason: 'asset-order-reservation-expired',
			code: 'rejected',
			cause: legacy,
		});
	});

	it('prefers a known reason in a `code` property, as weave-wrangler lifecycle errors carry', () => {
		const lifecycle = Object.assign(new Error('invalid payment'), { code: 'payment-dispatch-rejected' });
		expect(toAppError(lifecycle, 'unknown').reason).toBe('payment-dispatch-rejected');
		expect(toAppError({ code: 'registration-not-found', message: 'x' }, 'unknown').reason).toBe(
			'registration-not-found'
		);
	});

	it('restores persisted reason strings and their legacy spellings', () => {
		expect(toAppError('wallet-recovery-conflict', 'unknown').reason).toBe('wallet-recovery-conflict');
		expect(toAppError('registration not found', 'unknown').reason).toBe('registration-not-found');
		expect(toAppError('Payment not found ', 'unknown').reason).toBe('payment-not-found');
		expect(toAppError('asset purchase rejected', 'unknown').reason).toBe('asset-purchase-rejected');
		expect(knownAppErrorReason('asset purchase proof mismatch')).toBe('asset-purchase-proof-mismatch');
		expect(knownAppErrorReason('market state changed')).toBeNull();
	});

	it('maps aborts to cancelled and timeout signals to timeout', () => {
		expect(toAppError(new DOMException('Aborted', 'AbortError'), 'unknown')).toMatchObject({
			code: 'cancelled',
			reason: 'cancelled',
		});
		expect(toAppError(new DOMException('Timed out', 'TimeoutError'), 'unknown').code).toBe('timeout');
	});

	it('never turns unrecognized provider text into a reason', () => {
		for (const cause of [
			new Error('HTTP 429'),
			new Error('asset-index-graphql-429'),
			new Error('User cancelled the AuthRequest'),
			new TypeError('Failed to fetch'),
			'ao.js-response-quorum-not-met',
			{ message: 'quota exceeded' },
		]) {
			const error = toAppError(cause, 'index-unavailable');
			expect(error.reason).toBe('index-unavailable');
			expect(error.cause).toBe(cause);
		}
	});

	it('normalizes non-Error values with the fallback reason', () => {
		for (const cause of [undefined, null, 0, 42, true, Symbol('x'), [], {}, () => undefined]) {
			expect(toAppError(cause, 'wallet-connection-failed')).toMatchObject({
				reason: 'wallet-connection-failed',
				code: 'unavailable',
			});
		}
	});

	it('never displays an arbitrary provider string verbatim', () => {
		fc.assert(
			fc.property(
				fc.oneof(fc.string(), fc.string({ unit: 'binary' }), fc.lorem({ maxCount: 12 })),
				fc.constantFrom(...APP_ERROR_REASON_LIST),
				(text, fallback) => {
					for (const cause of [text, new Error(text), { message: text, code: text }]) {
						const message = appErrorMessage(MESSAGES, toAppError(cause, fallback));
						expect(COPY.has(message)).toBe(true);
						if (!COPY.has(text)) expect(message).not.toBe(text);
					}
				}
			)
		);
	});
});

describe('marketplace request failures', () => {
	it('classifies only rate-limited errors as rate limiting', () => {
		expect(requestFailureKind(appError('rate-limited', { message: 'asset-support-graphql-429' }))).toBe(
			'rate-limited'
		);
		expect(requestFailureKind(appError('compute-rate-limited'))).toBe('rate-limited');
		expect(requestFailureKind(appError('unavailable', { message: 'asset-discovery-graphql-503' }))).toBe(
			'unavailable'
		);
		expect(requestFailureKind(new Error('HTTP 429'))).toBe('unavailable');
	});

	it('distinguishes compute and transaction-index recovery', () => {
		expect(requestFailureMessage(MESSAGES, 'compute', 'rate-limited')).toContain(
			'review the AO Core settings in the header'
		);
		expect(requestFailureMessage(MESSAGES, 'index', 'rate-limited')).toBe(
			'Arweave’s transaction index is temporarily rate-limiting requests. Wait briefly and retry.'
		);
		expect(requestFailureMessage(MESSAGES, 'compute', 'unavailable')).toContain('Live state could not be read');
		expect(requestFailureMessage(MESSAGES, 'index', 'unavailable')).toBe(
			'Arweave’s transaction index could not be read. Retry shortly.'
		);
	});
});
