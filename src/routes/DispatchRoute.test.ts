import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DISPLAY_STATE_TIMEOUT_ERROR } from 'api/asset-state-store';
import { DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED } from 'api/fungible-dispatch';

vi.mock('providers/WalletProvider', async (importOriginal) => ({
	...(await importOriginal<typeof import('providers/WalletProvider')>()),
	useWallet: () => ({ address: '' }),
}));

import DispatchRoute, { dispatchErrorMessage } from './DispatchRoute';

function renderAt(path: string) {
	return renderToStaticMarkup(
		React.createElement(
			StaticRouter,
			{ location: path },
			React.createElement(
				Routes,
				null,
				React.createElement(Route, {
					path: '/dispatch/:processId',
					element: React.createElement(DispatchRoute),
				})
			)
		)
	);
}

describe('invalid dispatch id', () => {
	it('explains the bad process ID and links back to Discover instead of dead-ending', () => {
		const markup = renderAt('/dispatch/abc');

		expect(markup).toContain('<h1>Unknown token</h1>');
		expect(markup).toContain('not a 43-character Arweave process ID');
		expect(markup).toContain('href="/discover"');
		expect(markup).toContain('Discover');
	});
});

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
