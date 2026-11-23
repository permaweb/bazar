import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';

import { NotFoundRoute } from './App';

function renderAt(location: string) {
	return renderToStaticMarkup(
		<StaticRouter location={location}>
			<NotFoundRoute />
		</StaticRouter>
	);
}

describe('not-found route', () => {
	it('shows a stable not-found heading with a way back to Discover', () => {
		const markup = renderAt('/assets/typo');

		expect(markup).toContain('<h1>Page not found</h1>');
		expect(markup).toContain('href="/discover"');
		expect(markup).toContain('Discover');
	});

	it('names the unmatched path so the user can see what was wrong', () => {
		expect(renderAt('/profile')).toContain('<code>/profile</code>');
	});

	it('renders the attempted path as text, never as markup', () => {
		const markup = renderAt('/asset/<img src=x onerror=alert(1)>');

		expect(markup).not.toContain('<img');
	});
});
