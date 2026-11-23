import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
	CollectionAppendFailureNotice,
	FUNGIBLE_MINT_ERROR_FALLBACK,
	MINT_ERROR_FALLBACK,
	mintErrorMessage,
} from './App';

const dehyphenated = (code: string) => code.replaceAll('-', ' ');

describe('mint error copy', () => {
	it.each([
		['mint-upload-503', /wallet signed this upload.*did not accept it.*Transaction activity/],
		['mint-upload-500', /wallet signed this upload.*did not accept it.*Transaction activity/],
		['mint-price-503', /network fees could not be checked.*Transaction activity/],
		['mint-price-invalid', /network fees could not be checked/],
		['wallet-balance-502', /AR balance could not be checked.*Transaction activity/],
		['wallet-balance-invalid', /AR balance could not be checked/],
		['wallet-returned-unsigned-transaction', /did not return a signed transaction.*not sent/],
		['wallet-returned-invalid-signature', /invalid signature.*not sent/],
		['mint-insufficient-balance', /does not have enough AR/],
		['collection-owner-mismatch', /Only the wallet that created this collection/],
		['mint-collection-name-invalid', /^Enter a collection name between 1 and 80 characters\.$/],
		['mint-collection-size-invalid', /between 1 and 10 images/],
		['mint-artist-invalid', /artist name under 160/],
		['mint-album-invalid', /album name under 160/],
		['mint-duration-invalid', /valid duration/],
		['mint-media-unavailable-404', /not available through this gateway yet/],
		['mint-udl-invalid', /draft or license data is invalid/],
		['mint-udl-grant-invalid', /draft or license data is invalid/],
		['mint-udl-unknown-rights-invalid', /draft or license data is invalid/],
		['mint-udl-value-unexpected', /draft or license data is invalid/],
	])('maps %s to plain guidance', (code, copy) => {
		const message = mintErrorMessage(new Error(code));
		expect(message).toMatch(copy);
		expect(message).not.toBe(dehyphenated(code));
		expect(message).not.toBe(MINT_ERROR_FALLBACK);
	});

	it.each(['mint-upload-503', 'mint-price-503', 'wallet-balance-502', 'mint-insufficient-balance'])(
		'does not promise that nothing was submitted or charged for the mid-flow failure %s',
		(code) => {
			const message = mintErrorMessage(new Error(code));
			expect(message).not.toMatch(/nothing was (?:submitted|charged)/i);
			expect(message).not.toMatch(/pending/i);
		}
	);

	it.each([
		'invalid-mint-owner',
		'upload-byte-length-invalid',
		'upload-tag-name-invalid',
		'duplicate-upload-tag-content-type',
		'atomic-asset-tags-invalid',
		'mint-draft-invalid',
		'some-future-code',
	])('falls back to a generic sentence, never the dehyphenated code, for %s', (code) => {
		const message = mintErrorMessage(new TypeError(code));
		expect(message).toBe(MINT_ERROR_FALLBACK);
		expect(message).not.toBe(dehyphenated(code));
	});

	// Token mints create no Transaction activity entry for a failed attempt, so
	// none of their copy may send the user there.
	it.each([
		[
			'mint-upload-503',
			/wallet signed this transaction.*did not accept it.*token logo that already uploaded is reused/,
		],
		['mint-upload-500', /wallet signed this transaction.*did not accept it/],
		['mint-price-503', /network fees could not be checked.*token logo/],
		['wallet-balance-502', /AR balance could not be checked.*token logo/],
		['wallet-returned-unsigned-transaction', /did not return a signed transaction/],
		['mint-insufficient-balance', /does not have enough AR/],
	])('maps the token-mint failure %s without pointing to Transaction activity', (code, copy) => {
		const message = mintErrorMessage(new Error(code), 'fungible');
		expect(message).toMatch(copy);
		expect(message).not.toMatch(/Transaction activity/i);
		expect(message).not.toMatch(/nothing was (?:submitted|charged)/i);
	});

	it.each(['User rejected the request', 'some-future-code', 'invalid-mint-owner'])(
		'gives a token-mint fallback without Transaction activity for %s',
		(code) => {
			const message = mintErrorMessage(new Error(code), 'fungible');
			expect(message).toBe(FUNGIBLE_MINT_ERROR_FALLBACK);
			expect(message).not.toMatch(/Transaction activity/i);
			expect(message).not.toBe(dehyphenated(code));
		}
	);

	it('keeps existing friendly entries', () => {
		expect(mintErrorMessage(new TypeError('mint-name-invalid'))).toBe('Enter a name between 1 and 80 characters.');
		expect(mintErrorMessage('wallet-account-changed')).toBe(
			'The connected wallet changed. Reconnect the original wallet and try again.'
		);
	});
});

describe('collection append failure notice', () => {
	it('labels a failed append as a failed write, not a failed load', () => {
		const markup = renderToStaticMarkup(
			React.createElement(CollectionAppendFailureNotice, {
				failure: { stage: 'submit', message: mintErrorMessage(new Error('mint-insufficient-balance')) },
			})
		);
		expect(markup).toContain('Could not add assets');
		expect(markup).toContain('does not have enough');
		expect(markup).not.toContain('Unable to load');
		expect(markup).not.toContain('mint insufficient balance');
	});

	it('labels a failed storage-cost check as a cost check', () => {
		const markup = renderToStaticMarkup(
			React.createElement(CollectionAppendFailureNotice, {
				failure: { stage: 'estimate', message: mintErrorMessage(new Error('mint-price-503')) },
			})
		);
		expect(markup).toContain('Could not check the storage cost');
		expect(markup).toContain('network fees could not be checked');
		expect(markup).not.toContain('Unable to load');
		expect(markup).not.toContain('mint price 503');
	});
});
