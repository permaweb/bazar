import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ArtworkImage } from './ArtworkImage';

describe('ArtworkImage', () => {
	it('renders fetch priority as a React 18-compatible DOM attribute', () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const markup = renderToStaticMarkup(<ArtworkImage alt="Artwork" fetchPriority="high" src="art.png" />);

			expect(markup).toContain('fetchpriority="high"');
			expect(markup).not.toContain('fetchPriority');
			expect(consoleError).not.toHaveBeenCalled();
		} finally {
			consoleError.mockRestore();
		}
	});
});
