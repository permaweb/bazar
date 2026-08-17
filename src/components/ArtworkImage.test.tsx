import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ArtworkImage } from './ArtworkImage';

describe('ArtworkImage', () => {
	it('passes image fetch priority through React 18 as a native DOM attribute', () => {
		const markup = renderToStaticMarkup(
			<ArtworkImage alt="Priority artwork" fetchPriority="high" loading="eager" src="/artwork.png" />
		);

		expect(markup).toContain('fetchpriority="high"');
		expect(markup).not.toContain('fetchPriority');
	});
});
