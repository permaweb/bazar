import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PortalIcon } from './PortalIcon';

describe('PortalIcon', () => {
	it('renders an archway portal and three RGB twinkles', () => {
		const markup = renderToStaticMarkup(<PortalIcon aria-hidden="true" />);

		expect(markup).toContain('portal-icon__arch');
		expect(markup).toContain('portal-icon__door');
		expect(markup).toContain('portal-icon__threshold');
		expect(markup).toContain('portal-icon__twinkle--red');
		expect(markup).toContain('portal-icon__twinkle--green');
		expect(markup).toContain('portal-icon__twinkle--blue');
		expect(markup).toContain('aria-hidden="true"');
	});
});
