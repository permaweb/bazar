import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DISPLAY_STATE_TIMEOUT_ERROR } from 'api/asset-state-store';
import { DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED } from 'api/fungible-dispatch';

import { DispatchRecipientCell, dispatchErrorMessage } from './DispatchRoute';

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

describe('dispatch recipient review', () => {
	const address = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';

	it('shows the full recipient address as text, not only in a hover tooltip', () => {
		const markup = renderToStaticMarkup(React.createElement(DispatchRecipientCell, { address }));

		expect(markup).toContain(`<span>${address}</span>`);
		expect(markup).not.toContain(`${address.slice(0, 6)}…${address.slice(-6)}`);
	});

	it('gives keyboard and screen-reader users a focusable control named with the full address', () => {
		const markup = renderToStaticMarkup(React.createElement(DispatchRecipientCell, { address }));
		const button = markup.match(/<button[^>]*>/)?.[0] ?? '';

		expect(button).toContain(`aria-label="Copy recipient address ${address}"`);
		expect(button).not.toContain('tabindex="-1"');
	});
});
