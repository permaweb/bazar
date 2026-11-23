import { describe, expect, it } from 'vitest';
import { TransactionDispatchRejectedError } from 'weave-wrangler';

import { DISPLAY_STATE_TIMEOUT_ERROR } from 'api/asset-state-store';
import {
	DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED,
	DispatchSignedTransactionRejectedError,
} from 'api/fungible-dispatch';

import {
	dispatchErrorMessage,
	dispatchRowStatusLabel,
	notAppliedSignAgainConfirmation,
	rejectedSignatureConfirmation,
	rejectedSignatureOutcomeMessage,
} from './DispatchRoute';

describe('dispatch recovery errors', () => {
	it('explains why a missing signed transaction requires manual review instead of replacement', () => {
		const message = dispatchErrorMessage(new Error(DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED));

		expect(message).toContain('may already have reached Arweave');
		expect(message).toContain('will not sign a replacement');
		expect(message).toContain('manual review');
	});

	it('explains that a state-read deadline cannot create another signature', () => {
		const message = dispatchErrorMessage(new Error(DISPLAY_STATE_TIMEOUT_ERROR));

		expect(message).toContain('within 45 seconds');
		expect(message).toContain('No new transfer was signed');
		expect(message).toContain('saved dispatch progress remains available');
	});
});

describe('dispatch gateway rejection copy', () => {
	const html = '<html><body>Bad Request</body></html>';

	it('tells a fresh definitive rejection that Resume signs a replacement for that holder', () => {
		const message = dispatchErrorMessage(
			new TransactionDispatchRejectedError(400, `transaction-dispatch-400: ${html}`)
		);

		expect(message).toContain('Resume signs a replacement for this holder');
		expect(message).not.toContain('<');
	});

	it("tells a restored rejection to discard that row's rejected signature", () => {
		expect(dispatchErrorMessage(new DispatchSignedTransactionRejectedError(['A'.repeat(43)]))).toContain(
			"Discard this row's rejected signature to sign a replacement"
		);
		expect(
			dispatchErrorMessage(new DispatchSignedTransactionRejectedError(['A'.repeat(43), 'B'.repeat(43)]))
		).toContain('2 rows marked Rejected');
	});

	it('calls 5xx and throttling answers gateway unavailability, never a rejection, and never echoes the body', () => {
		for (const status of [503, 502, 408, 425, 429]) {
			const message = dispatchErrorMessage(new Error(`transaction-dispatch-${status}: ${html}`));
			expect(message).toContain(`temporarily unavailable (HTTP ${status})`);
			expect(message).toContain('Resume retries the same signed transfer');
			expect(message).not.toMatch(/rejected|</);
		}
	});

	it('keeps other gateway statuses on the same signed transfer without the raw body', () => {
		const message = dispatchErrorMessage(new Error(`transaction-dispatch-404: ${html}`));
		expect(message).toContain('HTTP 404');
		expect(message).toContain('Resume retries the same signed transfer');
		expect(message).not.toContain('<');
	});

	it('explains the per-row discard decision and both outcomes', () => {
		const confirmation = rejectedSignatureConfirmation('A'.repeat(43));
		expect(confirmation).toContain('reads fresh holder balances first');
		expect(confirmation).toContain('marked settled and nothing is re-signed');
		expect(rejectedSignatureOutcomeMessage('settled')).toContain('marked the row settled');
		expect(rejectedSignatureOutcomeMessage('discarded')).toContain(
			'Resume signs a replacement for this holder only'
		);
	});
});

describe('dispatch receipt settlement copy', () => {
	const a = 'A'.repeat(43);
	const b = 'B'.repeat(43);

	it('names a process-proven rejection Not applied and says no tokens moved', () => {
		const message = dispatchErrorMessage(new DispatchSignedTransactionRejectedError([a], [a]));
		expect(message).toContain('the row marked Not applied');
		expect(message).toContain('no tokens moved');
		expect(message).toContain('Sign again');
		expect(message).not.toContain('may have been posted');

		const mixed = dispatchErrorMessage(new DispatchSignedTransactionRejectedError([a, b], [b]));
		expect(mixed).toContain('the row marked Rejected');
		expect(mixed).toContain('the row marked Not applied');
		expect(notAppliedSignAgainConfirmation(a)).toContain('no tokens moved');
	});

	it('keeps unproven outcomes Posted and never calls them rejected', () => {
		for (const code of [
			'fungible-transfer-proof-mismatch',
			'asset-balance-proof-unavailable',
			'scheduled-action-state-missing',
		]) {
			const message = dispatchErrorMessage(new Error(code));
			expect(message).toContain('stays Posted');
			expect(message).not.toMatch(/rejected/i);
		}
	});

	it('labels rows by the evidence that settled them', () => {
		expect(dispatchRowStatusLabel({ startingSlot: 41 }, { status: 'settled' })).toBe('Settled');
		expect(dispatchRowStatusLabel({}, { status: 'settled' })).toBe('Settled (balance-checked)');
		expect(dispatchRowStatusLabel({ startingSlot: 41 }, { status: 'rejected', rejectedBy: 'process' })).toBe(
			'Not applied'
		);
		expect(dispatchRowStatusLabel({ startingSlot: 41 }, { status: 'rejected' })).toBe('Rejected');
		expect(dispatchRowStatusLabel({}, { status: 'posted' })).toBe('Posted');
	});
});
