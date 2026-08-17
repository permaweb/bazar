import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TxAddress } from './index';

describe('TxAddress', () => {
	it('renders an explorer link and an aligned copy control', () => {
		const address = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
		const markup = renderToStaticMarkup(<TxAddress address={address} wrap={false} />);

		expect(markup).toContain('class="tx-address"');
		expect(markup).toContain('class="tx-address-link"');
		expect(markup).toContain('aria-label="Copy transaction address"');
		expect(markup).toContain('abcdefg…BCDEFG');
	});

	it('can display the complete transaction address', () => {
		const address = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
		const markup = renderToStaticMarkup(<TxAddress address={address} wrap />);

		expect(markup).toContain('tx-address is-wrapped');
		expect(markup).toContain(`>${address}</a>`);
	});
});
