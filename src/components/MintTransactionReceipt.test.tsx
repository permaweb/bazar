import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MintTransactionReceipt } from './MintTransactionReceipt';

describe('mint transaction receipt', () => {
	it('uses the shared transaction address control and links each receipt to Lunar', () => {
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

		expect(markup).toContain(`href="https://lunar.arweave.net/#/explorer/${mediaId}"`);
		expect(markup).toContain(`href="https://lunar.arweave.net/#/explorer/${assetId}"`);
		expect(markup).toContain('View media upload');
		expect(markup).toContain('View asset creation');
		expect(markup).toContain(`class="tx-address is-wrapped"`);
		expect(markup).toContain('Copy transaction address');
	});
});
