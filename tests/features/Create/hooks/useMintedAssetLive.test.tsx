// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useMintedAssetLive } from 'features/Create/hooks/useMintedAssetLive';

import { renderHook } from '../../../test-utils/render-hook';

const ASSET = 'A'.repeat(43);
const OTHER = 'B'.repeat(43);

function announceLive(assetId: string) {
	React.act(() => {
		window.dispatchEvent(new CustomEvent('bazar:mint-live', { detail: { asset: { id: assetId } } }));
	});
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('useMintedAssetLive', () => {
	it('stays false until the watcher announces this asset', () => {
		const hook = renderHook<string | null, boolean>((assetId) => useMintedAssetLive(assetId), ASSET);
		expect(hook.current()).toBe(false);

		announceLive(OTHER);
		expect(hook.current()).toBe(false);

		announceLive(ASSET);
		expect(hook.current()).toBe(true);
		hook.unmount();
	});

	it('resets for a new mint and ignores announcements without an asset', () => {
		const hook = renderHook<string | null, boolean>((assetId) => useMintedAssetLive(assetId), ASSET);
		announceLive(ASSET);
		expect(hook.current()).toBe(true);

		hook.rerender(OTHER);
		expect(hook.current()).toBe(false);
		React.act(() => {
			window.dispatchEvent(new CustomEvent('bazar:mint-live', { detail: {} }));
		});
		expect(hook.current()).toBe(false);

		hook.rerender(null);
		expect(hook.current()).toBe(false);
		announceLive(OTHER);
		expect(hook.current()).toBe(false);
		hook.unmount();
	});

	it('removes its listener on unmount', () => {
		const hook = renderHook<string | null, boolean>((assetId) => useMintedAssetLive(assetId), ASSET);
		hook.unmount();
		// Dispatching after unmount must not warn or update anything.
		window.dispatchEvent(new CustomEvent('bazar:mint-live', { detail: { asset: { id: ASSET } } }));
		expect(hook.current()).toBe(false);
	});
});
