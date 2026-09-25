import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AssetOperationStatus, {
	assetOperationPendingActionLabel,
	assetOperationProgressTitle,
} from 'features/Operations/components/molecules/AssetOperationStatus/AssetOperationStatus';
import { OPERATIONS_MESSAGES } from 'features/Operations/messages';

const messages = OPERATIONS_MESSAGES.en;

describe('asset operation page status', () => {
	it('names each blocked action using its actual lifecycle', () => {
		expect(assetOperationProgressTitle('sell', 'working', messages)).toBe('Listing in progress');
		expect(assetOperationProgressTitle('buy', 'approval', messages)).toBe('Purchase in progress');
		expect(assetOperationProgressTitle('cancel', 'working', messages)).toBe('Listing cancellation in progress');
		expect(assetOperationProgressTitle('transfer', 'error', messages)).toBe('Transfer needs attention');
		expect(assetOperationPendingActionLabel('cancel', messages)).toBe('Canceling listing…');
	});

	it('keeps the current status and details action visible together', () => {
		const markup = renderToStaticMarkup(
			React.createElement(AssetOperationStatus, {
				kind: 'sell',
				phase: 'working',
				status: { text: 'Checking confirmations' },
				onView: () => undefined,
			})
		);

		expect(markup).toContain(assetOperationProgressTitle('sell', 'working', messages));
		expect(markup).toContain('Checking confirmations');
		expect(markup).toContain(messages.assetOperationViewDetails);
		expect(markup).toContain('role="status"');
	});
});
