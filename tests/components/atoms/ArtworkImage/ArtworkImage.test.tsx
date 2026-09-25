import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ArtworkImage from 'components/atoms/ArtworkImage/ArtworkImage';
import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';

const language = ASSET_DETAIL_MESSAGES.en;

describe('ArtworkImage', () => {
	it('passes image fetch priority through React 18 as a native DOM attribute', () => {
		const markup = renderToStaticMarkup(
			<ArtworkImage
				alt="Priority artwork"
				fetchPriority="high"
				loading="eager"
				src="/artwork.png"
				unavailableLabel={language.assetDetailArtworkUnavailable}
			/>
		);

		expect(markup).toContain('fetchpriority="high"');
		expect(markup).not.toContain('fetchPriority');
		expect(markup).not.toContain('unavailableLabel');
	});
});
