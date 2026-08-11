import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ArtworkImage } from './ArtworkImage';

describe('ArtworkImage', () => {
	it('passes image fetch priority through React 18 as a native DOM attribute without a warning', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const markup = renderToStaticMarkup(
				<ArtworkImage alt="Priority artwork" fetchPriority="high" loading="eager" src="/artwork.png" />
			);

			expect(markup).toContain('fetchpriority="high"');
			expect(markup).not.toContain('fetchPriority');
			expect(consoleError).not.toHaveBeenCalled();
		} finally {
			consoleError.mockRestore();
		}
	});
});
