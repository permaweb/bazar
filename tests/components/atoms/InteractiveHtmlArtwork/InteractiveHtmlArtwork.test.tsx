import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InteractiveHtmlArtwork from 'components/atoms/InteractiveHtmlArtwork/InteractiveHtmlArtwork';
import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';
import { formatMessage } from 'helpers/i18n';

const language = ASSET_DETAIL_MESSAGES.en;

describe('InteractiveHtmlArtwork', () => {
	it('loads permanent HTML with scripts and pointer interaction in an opaque sandbox', () => {
		const title = formatMessage(language.uniqueMediaInteractiveArtwork, { name: 'OBELISK' });
		const markup = renderToStaticMarkup(
			<InteractiveHtmlArtwork src="https://arweave.net/interactive-asset" title={title} />
		);

		expect(markup).toContain('<iframe');
		expect(markup).toContain('sandbox="allow-scripts allow-pointer-lock"');
		expect(markup).toContain('src="https://arweave.net/interactive-asset"');
		expect(markup).toContain(`title="${title}"`);
		expect(markup).not.toContain('allow-same-origin');
		expect(markup).not.toContain('allow-popups');
		expect(markup).not.toContain('allow-top-navigation');
	});
});
