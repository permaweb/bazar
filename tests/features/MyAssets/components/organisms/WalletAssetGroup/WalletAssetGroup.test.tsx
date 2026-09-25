// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Collection } from 'api/collections';
import type { ResolvedAsset } from 'api/discovery';

import { WalletAssetGroup } from 'features/MyAssets/components/organisms/WalletAssetGroup';
import { theme } from 'helpers/theme';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wallet = 'W'.repeat(43);

const uniques: Collection = { id: 'artwork', name: 'Artwork', description: '', kind: 'images', assets: [] };
const tokens: Collection = { id: 'tokens', name: 'Tokens', description: '', kind: 'tokens', assets: [] };

function resolved(id: string, collection: Collection, liquid: string, listed: string): ResolvedAsset {
	const orderId = `${id}-order`;
	return {
		asset: { id, name: `Asset ${id.slice(0, 4)}` },
		collection,
		provider: 'https://arweave.net',
		activity: { processId: id, height: 1, timestamp: 1, sources: ['market-action'] },
		state: {
			device: 'token@1.0',
			name: id,
			ticker: 'TKN',
			denomination: 0,
			totalSupply: '1',
			balances: { [wallet]: liquid },
			orders:
				listed === '0'
					? {}
					: {
							[orderId]: {
								orderId,
								creator: wallet,
								recipient: id,
								asking: '2500000000000',
								deposit: '0',
								minimumFee: '0',
								deadline: 100,
								createdAt: 1,
								quantity: listed,
								status: 'open',
							},
					  },
			swapHeight: 1,
			value: null,
			raw: {},
		},
	};
}

let root: Root;
let host: HTMLElement;

function render(node: React.ReactElement) {
	React.act(() =>
		root.render(
			<MemoryRouter>
				<ThemeProvider theme={theme}>{node}</ThemeProvider>
			</MemoryRouter>
		)
	);
}

describe('WalletAssetGroup', () => {
	beforeEach(() => {
		window.matchMedia = vi.fn().mockReturnValue({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}) as unknown as typeof window.matchMedia;
		host = document.createElement('div');
		document.body.appendChild(host);
		root = createRoot(host);
	});

	afterEach(() => {
		React.act(() => root.unmount());
		host.remove();
	});

	it('labels an owned unique and the wallet’s own listing price', () => {
		render(
			<WalletAssetGroup
				title="Uniques"
				results={[resolved('U'.repeat(43), uniques, '1', '0'), resolved('L'.repeat(43), uniques, '0', '1')]}
				address={wallet}
				kind="uniques"
				onViewChange={vi.fn()}
				settled
				view="all"
			/>
		);

		const badges = [...host.querySelectorAll('.asset-card')].map((card) => card.textContent);
		expect(badges[0]).toContain('Owned');
		expect(badges[1]).toContain('For sale');
		expect(badges[1]).toContain('2.5 AR');
		expect(host.querySelector('.asset-group-heading h2')?.getAttribute('aria-label')).toBe('Uniques, 2');
	});

	it('shows token balances, and only the listed quantity in the listed view', () => {
		const token = resolved('T'.repeat(43), tokens, '3', '2');
		render(
			<WalletAssetGroup
				title="Tokens"
				results={[token]}
				address={wallet}
				kind="tokens"
				onViewChange={vi.fn()}
				settled
				view="all"
			/>
		);
		expect(host.querySelector('.asset-card')?.textContent).toContain('5 $TKN');

		render(
			<WalletAssetGroup
				title="Tokens"
				results={[token]}
				address={wallet}
				kind="tokens"
				onViewChange={vi.fn()}
				settled
				view="listed"
			/>
		);
		expect(host.querySelector('.asset-card')?.textContent).toContain('2 $TKN listed');
	});

	it('distinguishes an empty group that is still resolving from a settled one', () => {
		render(
			<WalletAssetGroup
				title="Tokens"
				results={[]}
				address={wallet}
				kind="tokens"
				onViewChange={vi.fn()}
				settled={false}
				view="all"
			/>
		);
		expect(host.querySelector('.asset-group-empty')?.textContent).toBe('Checking for tokens…');

		render(
			<WalletAssetGroup
				title="Tokens"
				results={[]}
				address={wallet}
				kind="tokens"
				onViewChange={vi.fn()}
				settled
				view="listed"
			/>
		);
		expect(host.querySelector('.asset-group-empty')?.textContent).toBe('No listed tokens.');
	});

	it('reveals another page of assets on request and announces the progress', () => {
		const results = Array.from({ length: 14 }, (_, index) =>
			resolved(`${index}`.padStart(43, 'A'), uniques, '1', '0')
		);
		render(
			<WalletAssetGroup
				title="Uniques"
				results={results}
				address={wallet}
				kind="uniques"
				onViewChange={vi.fn()}
				settled
				view="all"
			/>
		);

		expect(host.querySelectorAll('.asset-card')).toHaveLength(12);
		const loadMore = host.querySelector<HTMLButtonElement>('button.load-more');
		expect(loadMore?.textContent).toBe('Show 2 more uniques');

		React.act(() => loadMore?.click());
		expect(host.querySelectorAll('.asset-card')).toHaveLength(14);
		expect(host.querySelector('.collection-result-count')?.textContent).toBe('All 14 uniques are shown.');
		expect(host.querySelector('button.load-more')).toBeNull();
	});
});
