import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { InteractiveHtmlArtwork } from './InteractiveHtmlArtwork';

describe('InteractiveHtmlArtwork', () => {
	it('loads permanent HTML with scripts and pointer interaction in an opaque sandbox', () => {
		const markup = renderToStaticMarkup(
			<InteractiveHtmlArtwork name="OBELISK" src="https://arweave.net/interactive-asset" />
		);

		expect(markup).toContain('<iframe');
		expect(markup).toContain('sandbox="allow-scripts allow-pointer-lock"');
		expect(markup).toContain('src="https://arweave.net/interactive-asset"');
		expect(markup).toContain('title="OBELISK interactive artwork"');
		expect(markup).not.toContain('allow-same-origin');
		expect(markup).not.toContain('allow-popups');
		expect(markup).not.toContain('allow-top-navigation');
	});
});
