// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { X } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import IconButton from 'components/atoms/IconButton/IconButton';

import { axeViolations } from '../../../test-utils/accessibility';

describe('IconButton', () => {
	it('renders an accessible ghost icon button that never submits forms', () => {
		const markup = renderToStaticMarkup(<IconButton icon={X} label="Close dialog" onClick={() => undefined} />);
		expect(markup).toContain('aria-label="Close dialog"');
		expect(markup).toContain('type="button"');
		expect(markup).toContain('ui-button--icon ui-button--ghost');
	});

	it('has no automated accessibility violations', async () => {
		expect(await axeViolations(<IconButton icon={X} label="Close dialog" />)).toEqual([]);
	});
});
