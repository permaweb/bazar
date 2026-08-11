import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MintTransactionReceipt } from './MintTransactionReceipt';

describe('mint transaction receipt', () => {
	it('links each exact submitted transaction to ViewBlock with an explanatory label', () => {
		const mediaId = `media-${'m'.repeat(37)}`;
		const assetId = `asset-${'a'.repeat(37)}`;
		const markup = renderToStaticMarkup(
			<MintTransactionReceipt
				entries={[
					{ label: 'View media upload', transactionId: mediaId },
					{ label: 'View asset creation', transactionId: assetId },
				]}
			/>
		);

		expect(markup).toContain(`href="https://viewblock.io/arweave/tx/${mediaId}"`);
		expect(markup).toContain(`href="https://viewblock.io/arweave/tx/${assetId}"`);
		expect(markup).toContain('View media upload');
		expect(markup).toContain('View asset creation');
		expect(markup).toContain(`<code>${mediaId}</code>`);
		expect(markup).toContain('Copy view media upload transaction ID');
	});
});
