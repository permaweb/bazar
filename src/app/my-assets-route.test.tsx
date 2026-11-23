import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MyAssetsRoute from '../routes/MyAssetsRoute';

import { MarketContext } from './App';

const profileAddress = 'A'.repeat(43);

type MarketValue = React.ContextType<typeof MarketContext>;

function WithMarket({ children, market }: { children: React.ReactNode; market: Partial<MarketValue> }) {
	const base = React.useContext(MarketContext);
	return <MarketContext.Provider value={{ ...base, ...market }}>{children}</MarketContext.Provider>;
}

// Rendered with no WalletProvider on purpose: the profile inventory belongs to the explicit
// address, so it must never read (or need) the connected wallet.
function renderInventory(market: Partial<MarketValue> = {}) {
	return renderToStaticMarkup(
		<WithMarket market={market}>
			<MyAssetsRoute address={profileAddress} />
		</WithMarket>
	);
}

describe('profile asset inventory (MyAssetsRoute)', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {
			location: { protocol: 'http:', hostname: 'localhost', port: '5173', search: '', hash: '' },
		});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('renders for an explicit address without a wallet provider', () => {
		expect(() => renderInventory()).not.toThrow();
	});

	it('shows the profile loading state, not a standalone "My assets" page, while collections load', () => {
		const markup = renderInventory();

		expect(markup).toContain('class="my-assets-page profile-assets"');
		expect(markup).toContain('Reading supported asset collections from Arweave…');
		expect(markup).not.toContain('My assets');
		expect(markup).not.toContain('Your wallet');
		expect(markup).not.toContain('Connect a wallet');
	});

	it('shows the market error inside the profile layout without a "My assets" heading', () => {
		const markup = renderInventory({ loading: false, error: 'Collections are unavailable.' });

		expect(markup).toContain('class="my-assets-page profile-assets"');
		expect(markup).toContain('Collections are unavailable.');
		expect(markup).not.toContain('My assets');
		expect(markup).not.toContain('Live wallet inventory');
	});
});
