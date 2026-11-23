import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('providers/WalletProvider', async (importOriginal) => ({
	...(await importOriginal<typeof import('providers/WalletProvider')>()),
	useWallet: () => ({ address: '' }),
}));

import { collectionBackLink, RouteState } from './App';

function render(element: React.ReactElement) {
	return renderToStaticMarkup(<MemoryRouter initialEntries={['/collection/x']}>{element}</MemoryRouter>);
}

describe('All collections back links', () => {
	it('sends the default RouteState back link to the Collections tab', () => {
		const html = render(
			<RouteState title="Collection not found">
				<p>Missing</p>
			</RouteState>
		);
		expect(html).toContain('href="/collections"');
		expect(html).toContain('All collections');
		expect(html).not.toContain('href="/"');
	});

	it('keeps an explicit backTo override unchanged', () => {
		const html = render(
			<RouteState title="Upload not found" backTo="/create" backLabel="Back to create">
				<p>Missing</p>
			</RouteState>
		);
		expect(html).toContain('href="/create"');
		expect(html).toContain('Back to create');
		expect(html).not.toContain('href="/collections"');
	});

	it('points collection pages at the Collections tab and token pages at Discover', () => {
		expect(collectionBackLink('images')).toEqual({ to: '/collections', label: 'All collections' });
		expect(collectionBackLink('names')).toEqual({ to: '/collections', label: 'All collections' });
		expect(collectionBackLink('tokens')).toEqual({ to: '/discover', label: 'Discover' });
	});
});
