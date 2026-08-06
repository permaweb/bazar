import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
	AssetOperationStatus,
	assetOperationPendingActionLabel,
	assetOperationProgressTitle,
} from './AssetOperationStatus';

describe('asset operation page status', () => {
	it('names each blocked action using its actual lifecycle', () => {
		expect(assetOperationProgressTitle('sell', 'working')).toBe('Listing in progress');
		expect(assetOperationProgressTitle('buy', 'approval')).toBe('Purchase in progress');
		expect(assetOperationProgressTitle('cancel', 'working')).toBe('Listing cancellation in progress');
		expect(assetOperationProgressTitle('transfer', 'error')).toBe('Transfer needs attention');
		expect(assetOperationPendingActionLabel('cancel')).toBe('Canceling listing…');
	});

	it('keeps the current status and details action visible together', () => {
		const markup = renderToStaticMarkup(
			React.createElement(AssetOperationStatus, {
				kind: 'sell',
				phase: 'working',
				status: 'Checking confirmations',
				onView: () => undefined,
			}),
		);

		expect(markup).toContain('Listing in progress');
		expect(markup).toContain('Checking confirmations');
		expect(markup).toContain('View details');
		expect(markup).toContain('role="status"');
	});
});
