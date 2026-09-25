import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import LiveRegion from 'components/atoms/LiveRegion/LiveRegion';
import VisuallyHidden from 'components/atoms/VisuallyHidden/VisuallyHidden';

describe('LiveRegion', () => {
	it('announces politely without rendering visibly', () => {
		expect(renderToStaticMarkup(<LiveRegion>Saved</LiveRegion>)).toBe(
			'<span aria-live="polite" class="sr-only" role="status">Saved</span>'
		);
		expect(
			renderToStaticMarkup(
				<LiveRegion as="p" atomic id="status">
					Done
				</LiveRegion>
			)
		).toBe('<p aria-atomic="true" aria-live="polite" class="sr-only" id="status" role="status">Done</p>');
	});
});

describe('VisuallyHidden', () => {
	it('keeps text available to assistive technology only', () => {
		expect(renderToStaticMarkup(<VisuallyHidden as="h1">Marketplace</VisuallyHidden>)).toBe(
			'<h1 class="sr-only">Marketplace</h1>'
		);
	});
});
