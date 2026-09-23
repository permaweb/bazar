import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import TxAddress from 'components/atoms/TxAddress/TxAddress';
import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';
import { transactionAddressCopy } from 'features/AssetDetail/model/asset-detail';

const labels = transactionAddressCopy(ASSET_DETAIL_MESSAGES.en);

describe('TxAddress', () => {
	it('renders an explorer link and an aligned copy control', () => {
		const address = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
		const markup = renderToStaticMarkup(<TxAddress address={address} labels={labels} wrap={false} />);

		expect(markup).toContain('class="tx-address"');
		expect(markup).toContain('class="tx-address-link"');
		expect(markup).toContain(`aria-label="${labels.copy}"`);
		expect(markup).toContain('abcdefg…BCDEFG');
	});

	it('can display the complete transaction address', () => {
		const address = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
		const markup = renderToStaticMarkup(<TxAddress address={address} labels={labels} wrap />);

		expect(markup).toContain('tx-address is-wrapped');
		expect(markup).toContain(`>${address}</a>`);
	});
});
