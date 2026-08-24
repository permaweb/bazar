import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { assetDetailTabIndex, AssetDetailTabs, enabledAssetDetailTabIndex } from './AssetDetailTabs';

describe('assetDetailTabIndex', () => {
	it('moves and wraps with arrow keys', () => {
		expect(assetDetailTabIndex('ArrowRight', 2, 3)).toBe(0);
		expect(assetDetailTabIndex('ArrowLeft', 0, 3)).toBe(2);
		expect(assetDetailTabIndex('ArrowDown', 0, 3)).toBe(1);
	});

	it('supports boundary keys and ignores unrelated keys', () => {
		expect(assetDetailTabIndex('Home', 2, 4)).toBe(0);
		expect(assetDetailTabIndex('End', 0, 4)).toBe(3);
		expect(assetDetailTabIndex('Enter', 0, 4)).toBeNull();
	});
});

describe('enabledAssetDetailTabIndex', () => {
	it('skips disabled tabs for arrow and boundary navigation', () => {
		expect(enabledAssetDetailTabIndex('ArrowRight', 0, [false, true, false])).toBe(2);
		expect(enabledAssetDetailTabIndex('ArrowLeft', 2, [false, true, false])).toBe(0);
		expect(enabledAssetDetailTabIndex('Home', 2, [true, false, false])).toBe(1);
		expect(enabledAssetDetailTabIndex('End', 0, [false, false, true])).toBe(1);
	});
});

describe('AssetDetailTabs', () => {
	it('renders a disabled tab with its explanation', () => {
		const markup = renderToStaticMarkup(
			React.createElement(AssetDetailTabs, {
				active: 'market',
				ariaLabel: 'Token detail sections',
				idPrefix: 'asset',
				onChange: vi.fn(),
				tabs: [
					{ value: 'market', label: 'Market', icon: null, panelId: 'market-panel' },
					{
						value: 'holders',
						label: 'Holders',
						icon: null,
						panelId: 'holders-panel',
						disabled: true,
						disabledMessage: 'Large balance tables are not displayed.',
					},
				],
			})
		);

		expect(markup).toContain('aria-disabled="true"');
		expect(markup).toContain('aria-describedby=');
		expect(markup).toContain('role="tooltip"');
		expect(markup).toContain('Large balance tables are not displayed.');
	});
});
