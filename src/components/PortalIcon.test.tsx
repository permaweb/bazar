import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PortalIcon } from './PortalIcon';

describe('PortalIcon', () => {
	it('renders a decorative portal and both twinkles', () => {
		const markup = renderToStaticMarkup(<PortalIcon aria-hidden="true" />);

		expect(markup).toContain('portal-icon__ring');
		expect(markup).toContain('portal-icon__twinkle--near');
		expect(markup).toContain('portal-icon__twinkle--far');
		expect(markup).toContain('aria-hidden="true"');
	});
});
