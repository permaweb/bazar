// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import EmptyState from 'components/molecules/EmptyState/EmptyState';

import { axeViolations } from '../../../test-utils/accessibility';

describe('EmptyState', () => {
	it('renders a title, explanation, and optional action', () => {
		expect(
			renderToStaticMarkup(
				<EmptyState action={<a href="#/create">Create</a>} title="Nothing here yet">
					Mint the first asset.
				</EmptyState>
			)
		).toMatch(
			/^<div class="[^"]*\bempty-state\b[^"]*"><h3>Nothing here yet<\/h3><p>Mint the first asset\.<\/p><a href="#\/create">Create<\/a><\/div>$/
		);
		expect(renderToStaticMarkup(<EmptyState title="No activity" />)).toMatch(
			/^<div class="[^"]*\bempty-state\b[^"]*"><h3>No activity<\/h3><\/div>$/
		);
	});

	it('has no automated accessibility violations', async () => {
		expect(await axeViolations(<EmptyState title="No activity">Nothing indexed yet.</EmptyState>)).toEqual([]);
	});
});
