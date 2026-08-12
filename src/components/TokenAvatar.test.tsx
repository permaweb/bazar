import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TokenAvatar } from './TokenAvatar';

describe('TokenAvatar', () => {
	it('uses one circular avatar contract and length-specific ticker class', () => {
		const markup = renderToStaticMarkup(<TokenAvatar className="compact" ticker="  SCRAPMETAL  " />);

		expect(markup).toContain('token-avatar ticker-8 ticker-long compact');
		expect(markup).toContain('<strong>SCRAPMET</strong>');
	});

	it('keeps optional artwork inside the same avatar container', () => {
		const markup = renderToStaticMarkup(
			<TokenAvatar fetchPriority="high" image="/token.png" loading="eager" ticker="MIST" />
		);

		expect(markup).toContain('token-avatar ticker-4');
		expect(markup).toContain('token-avatar-image');
		expect(markup).toContain('fetchpriority="high"');
	});
});
