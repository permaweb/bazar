// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetSummary, Collection } from 'api/collections';

import AssetCard from 'features/Catalogue/components/molecules/AssetCard/AssetCard';
import { useAssetPageWarmup } from 'features/Catalogue/hooks/useAssetPageWarmup';

const prefetchAssetPage = vi.hoisted(() => vi.fn());

vi.mock('api/marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/marketplace')>()),
	prefetchAssetPage,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSET_ID = 'A'.repeat(43);

let host: HTMLElement;
let root: Root;
let handlers: Array<() => void>;

function Warmup(props: { assetId: string; fungible: boolean }) {
	handlers.push(useAssetPageWarmup(props.assetId, props.fungible));
	return null;
}

beforeEach(() => {
	prefetchAssetPage.mockReset();
	handlers = [];
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	React.act(() => root.unmount());
	host.remove();
});

describe('useAssetPageWarmup', () => {
	it('keeps one stable handler per asset and warms only when called', () => {
		React.act(() => root.render(<Warmup assetId={ASSET_ID} fungible={false} />));
		React.act(() => root.render(<Warmup assetId={ASSET_ID} fungible={false} />));

		expect(handlers[1]).toBe(handlers[0]);
		expect(prefetchAssetPage).not.toHaveBeenCalled();
		handlers[1]();
		expect(prefetchAssetPage).toHaveBeenCalledWith(ASSET_ID, false);
	});

	it('rebinds when the asset or its fungibility changes', () => {
		React.act(() => root.render(<Warmup assetId={ASSET_ID} fungible={false} />));
		React.act(() => root.render(<Warmup assetId={ASSET_ID} fungible />));

		expect(handlers[1]).not.toBe(handlers[0]);
		handlers[1]();
		expect(prefetchAssetPage).toHaveBeenCalledWith(ASSET_ID, true);
	});

	it('warms a token asset page from card focus, hover, and touch', () => {
		const asset: AssetSummary = { id: ASSET_ID, name: 'Token' };
		const collection: Collection = {
			id: 'tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [asset],
		};
		React.act(() =>
			root.render(
				<MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
					<AssetCard asset={asset} collection={collection} />
				</MemoryRouter>
			)
		);
		const link = host.querySelector('a');
		React.act(() => {
			link?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
			link?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		});

		expect(link?.getAttribute('href')).toBe(`/asset/tokens/${ASSET_ID}`);
		expect(prefetchAssetPage).toHaveBeenCalledTimes(2);
		expect(prefetchAssetPage).toHaveBeenLastCalledWith(ASSET_ID, true);
	});
});
