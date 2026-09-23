import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WALLET_ADDRESS_MESSAGES } from 'components/organisms/WalletAddress/messages';
import WalletAddress, { WalletIdentity } from 'components/organisms/WalletAddress/WalletAddress';
import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';
import { formatMessage } from 'helpers/i18n';

const address = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';
const label = ASSET_DETAIL_MESSAGES.en.assetDetailWalletLabelRecipient;

describe('wallet address rendering', () => {
	it('shows the complete identity when irreversible review requests it', () => {
		const markup = renderToStaticMarkup(
			React.createElement(WalletAddress, {
				address,
				full: true,
				label,
			})
		);
		expect(markup).toContain('wallet-address is-full');
		expect(markup).toContain(`<span>${address}</span>`);
		expect(markup).toContain(formatMessage(WALLET_ADDRESS_MESSAGES.en.walletAddressCopy, { address, label }));
	});

	it('can show a selectable exact identity without adding an interactive control', () => {
		const markup = renderToStaticMarkup(React.createElement(WalletIdentity, { address }));
		expect(markup).toContain('class="wallet-identity"');
		expect(markup).toContain(`>${address}</span>`);
		expect(markup).not.toContain('<button');
	});
});
