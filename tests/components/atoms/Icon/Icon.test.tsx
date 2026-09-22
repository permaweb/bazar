import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RefreshCw } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import Icon from 'components/atoms/Icon/Icon';

describe('Icon', () => {
	it('renders a decorative glyph with the shared size classes', () => {
		const markup = renderToStaticMarkup(<Icon className="extra" icon={RefreshCw} size="sm" />);
		expect(markup).toContain('aria-hidden="true"');
		expect(markup).toMatch(/class="[^"]*ui-icon ui-icon--sm extra/);
	});

	it('exposes a labelled image when the glyph carries meaning', () => {
		const markup = renderToStaticMarkup(<Icon icon={RefreshCw} label="Refreshing" />);
		expect(markup).toContain('role="img"');
		expect(markup).toContain('aria-label="Refreshing"');
		expect(markup).not.toContain('aria-hidden');
		expect(markup).not.toContain('ui-icon--md');
	});
});
