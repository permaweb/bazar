import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { AssetSummary, Collection } from 'api/collections';
import { CREATED_COLLECTION_ID } from 'api/minted-assets';

vi.mock('providers/WalletProvider', async (importOriginal) => ({
	...(await importOriginal<typeof import('providers/WalletProvider')>()),
	useWallet: () => ({ address: '' }),
}));

import { AssetDetailLoadingShell } from './App';

const assetId = 'A'.repeat(43);
const asset: AssetSummary = {
	id: assetId,
	name: 'AntiqueWhite',
	contentType: 'image/png',
	image: `https://arweave.net/raw/${assetId}`,
};
const collection: Collection = {
	id: 'C'.repeat(43),
	name: 'Colours',
	description: '',
	kind: 'images',
	assets: [asset],
};

function render(props: React.ComponentProps<typeof AssetDetailLoadingShell>) {
	return renderToStaticMarkup(
		<MemoryRouter>
			<AssetDetailLoadingShell {...props} />
		</MemoryRouter>
	);
}

describe('asset detail loading shell', () => {
	it('renders a neutral skeleton before the collection is known', () => {
		const markup = render({ collectionId: collection.id });

		expect(markup).not.toContain('Arweave names');
		expect(markup).not.toContain('carrier@1.0');
		expect(markup).not.toContain('token@1.0');
		expect(markup).not.toContain('Supply 1');
		expect(markup).toContain('asset-loading-kicker');
		expect(markup.match(/asset-loading-tag/g)).toHaveLength(3);
		expect(markup).toContain('Computing current state…');
	});

	it('keeps resolved title, image and tags with an inline live-state retry when state fails', () => {
		const error = 'The configured AO peers do not serve live state for this asset (HTTP 404).';
		const markup = render({ asset, collection, collectionId: collection.id, error, onRetry: vi.fn() });

		expect(markup).toContain('<h1>AntiqueWhite</h1>');
		expect(markup).toContain(asset.image);
		expect(markup).toContain('Colours');
		expect(markup).toContain('<span>token@1.0</span>');
		expect(markup).toContain('Ownership and market state unavailable');
		expect(markup).toContain('Live state unavailable');
		expect(markup).toContain(error);
		expect(markup).toContain('Retry');
		expect(markup).not.toContain('Asset unavailable');
		expect(markup).not.toContain('Unable to load');
		expect(markup).not.toContain('Computing current state…');
	});

	it('keeps the created-asset identity for a direct route whose state failed', () => {
		const markup = render({ asset, collectionId: CREATED_COLLECTION_ID, error: 'HTTP 404', onRetry: vi.fn() });

		expect(markup).toContain('<h1>AntiqueWhite</h1>');
		expect(markup).toContain('<span>token@1.0</span>');
		expect(markup).not.toContain('carrier@1.0');
		expect(markup).toContain('Live state unavailable');
	});

	it('labels collection membership failures separately from live state', () => {
		const markup = render({
			asset,
			collection,
			collectionId: collection.id,
			error: 'Current collection membership could not be verified.',
			errorHeading: 'Collection membership unavailable',
			onRetry: vi.fn(),
		});

		expect(markup).toContain('Collection membership unavailable');
		expect(markup).not.toContain('Live state unavailable');
	});
});
