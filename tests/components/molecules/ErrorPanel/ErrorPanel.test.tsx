import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ErrorPanel from 'components/molecules/ErrorPanel/ErrorPanel';
import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';

const language = ASSET_DETAIL_MESSAGES.en;

describe('ErrorPanel', () => {
	it('keeps the supplied diagnostic visible beside retry controls', () => {
		const markup = renderToStaticMarkup(
			<ErrorPanel
				heading={language.assetDetailErrorHeading}
				message={language.assetStateTimeout}
				retryAction={{ label: language.assetDetailRetry, onClick: vi.fn() }}
				secondaryAction={{ label: language.assetDetailUseBazarPeers, onClick: vi.fn() }}
			/>
		);

		expect(markup).toContain(language.assetStateTimeout);
		expect(markup).toContain(language.assetDetailRetry);
		expect(markup).toContain(language.assetDetailUseBazarPeers);
		expect(markup).toContain(language.assetDetailErrorHeading);
		expect(markup).not.toContain('Compute hasn’t completed yet');
		expect(markup).not.toContain('Please try again.');
	});
});
