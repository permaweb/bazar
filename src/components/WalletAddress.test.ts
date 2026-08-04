import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WalletAddress, WalletIdentity } from './WalletAddress';

const address = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';

describe('wallet address rendering', () => {
	it('shows the complete identity when irreversible review requests it', () => {
		const markup = renderToStaticMarkup(React.createElement(WalletAddress, {
			address,
			full: true,
			label: 'recipient',
		}));
		expect(markup).toContain('wallet-address is-full');
		expect(markup).toContain(`<span>${address}</span>`);
		expect(markup).toContain(`Copy recipient address ${address}`);
	});

	it('can show a selectable exact identity without adding an interactive control', () => {
		const markup = renderToStaticMarkup(React.createElement(WalletIdentity, { address }));
		expect(markup).toContain('class="wallet-identity"');
		expect(markup).toContain(`>${address}</span>`);
		expect(markup).not.toContain('<button');
	});
});
