import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DISPLAY_STATE_TIMEOUT_ERROR } from 'api/asset-state-store';
import { DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED } from 'api/fungible-dispatch';

import { assetStateErrorMessage } from '../app/App';

import {
	dispatchErrorMessage,
	dispatchFeeLabel,
	DispatchFeeNotice,
	dispatchFeeStatus,
	dispatchStateReadMessage,
	transferRewardErrorMessage,
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

describe('dispatch token-state read errors', () => {
	it('describes a state-read timeout as a 45 second deadline, not a freshly minted token', () => {
		const message = dispatchStateReadMessage(new Error(DISPLAY_STATE_TIMEOUT_ERROR));

		expect(message).toContain('45 seconds');
		expect(message).not.toContain('20 minutes');
	});

	it('uses the asset page rate-limit copy for HTTP 429', () => {
		const message = dispatchStateReadMessage(new Error('HTTP 429'));

		expect(message).toBe(assetStateErrorMessage(new Error('HTTP 429')));
		expect(message).toContain('rate-limiting');
		expect(message).not.toContain('20 minutes');
	});

	it('does not blame token age for peer outages or unreachable peers', () => {
		for (const cause of ['HTTP 502', 'AO response quorum not met', 'Failed to fetch']) {
			expect(dispatchStateReadMessage(new Error(cause))).not.toContain('20 minutes');
		}
	});

	it('keeps the freshly minted hint for not-found and unrecognised causes', () => {
		const notFound = dispatchStateReadMessage(new Error('HTTP 404'));
		expect(notFound).toContain('(HTTP 404)');
		expect(notFound).toContain('20 minutes');

		expect(dispatchStateReadMessage(new Error('historical-state-slot-mismatch'))).toContain('20 minutes');
	});
});

describe('dispatch network fee', () => {
	it('maps a failed fee quote to fixed copy without the raw code', () => {
		const message = transferRewardErrorMessage(new Error('transfer-price-500'));

		expect(message).toBe('Network fee could not be checked. Retry.');
		expect(transferRewardErrorMessage(new Error('transfer-price-invalid'))).toBe(message);
		expect(transferRewardErrorMessage(new TypeError('Failed to fetch'))).toBe(message);
		expect(transferRewardErrorMessage(new Error('transfer-price-429'))).toContain('rate-limiting');
		expect(transferRewardErrorMessage(new Error('transfer-price-429'))).not.toContain('transfer-price');
	});

	it('makes the fee quote states explicit', () => {
		const base = { walletConnected: true, rowsParsed: true, reward: null, rewardError: null };

		expect(dispatchFeeStatus({ ...base, rowsParsed: false })).toBe('idle');
		expect(dispatchFeeStatus(base)).toBe('checking');
		// Without a wallet the fee does not gate sending, so it is not presented as pending.
		expect(dispatchFeeStatus({ ...base, walletConnected: false })).toBe('idle');
		expect(dispatchFeeStatus({ ...base, rewardError: 'Network fee could not be checked. Retry.' })).toBe('error');
		expect(dispatchFeeStatus({ ...base, reward: 1000n })).toBe('ready');
	});

	it('labels the total AR cost for every fee state', () => {
		expect(dispatchFeeLabel('checking', null)).toBe('Checking…');
		expect(dispatchFeeLabel('error', null)).toBe('Unavailable');
		expect(dispatchFeeLabel('idle', null)).toBe('—');
		expect(dispatchFeeLabel('ready', 1_000_000_000_000n)).toBe('1 AR');
	});

	it('renders a status notice with a Retry when the fee quote fails', () => {
		const markup = renderToStaticMarkup(
			React.createElement(DispatchFeeNotice, {
				message: transferRewardErrorMessage(new Error('transfer-price-500')),
				blocksDispatch: true,
				onRetry: () => undefined,
			})
		);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('Network fee unavailable');
		expect(markup).toContain('Network fee could not be checked.');
		expect(markup).toContain('Sign and dispatch stays disabled until the fee is known.');
		expect(markup).toContain('Retry</button>');
		expect(markup).not.toContain('transfer-price');
	});

	it('does not claim the fee blocks sending when no wallet is connected', () => {
		const markup = renderToStaticMarkup(
			React.createElement(DispatchFeeNotice, {
				message: 'Network fee could not be checked. Retry.',
				blocksDispatch: false,
				onRetry: () => undefined,
			})
		);

		expect(markup).not.toContain('stays disabled');
	});
});
