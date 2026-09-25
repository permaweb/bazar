import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import MintTransactionReceipt from 'components/molecules/MintTransactionReceipt/MintTransactionReceipt';
import { CREATE_MESSAGES } from 'features/Create/messages';
import { mintReceiptEntry, mintTransactionAddressCopy } from 'features/Create/model/mint-flow';

const language = CREATE_MESSAGES.en;

describe('mint transaction receipt', () => {
	it('uses the shared transaction address control and links each receipt to Lunar', () => {
		const mediaId = `media-${'m'.repeat(37)}`;
		const assetId = `asset-${'a'.repeat(37)}`;
		const markup = renderToStaticMarkup(
			<MintTransactionReceipt
				addressLabels={mintTransactionAddressCopy(language)}
				ariaLabel={language.mintReceiptsLabel}
				entries={[
					mintReceiptEntry(language.mintReceiptArtwork, mediaId, language),
					mintReceiptEntry(language.mintReceiptAsset, assetId, language),
				]}
			/>
		);

		expect(markup).toContain(`aria-label="${language.mintReceiptsLabel}"`);
		expect(markup).toContain(`href="https://lunar.arweave.net/#/explorer/${mediaId}"`);
		expect(markup).toContain(`href="https://lunar.arweave.net/#/explorer/${assetId}"`);
		expect(markup).toContain(`aria-label="${language.mintReceiptArtwork} transaction ${mediaId} on Lunar"`);
		expect(markup).toContain(language.mintReceiptAsset);
		expect(markup).toMatch(/class="[^"]*\btx-address is-wrapped\b[^"]*"/);
		expect(markup).toContain(language.mintCopyTransactionAddress);
	});
});
