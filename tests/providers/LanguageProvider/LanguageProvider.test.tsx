import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { defineMessages } from 'helpers/i18n';
import { LanguageProvider, useMessages, usePlural } from 'providers/LanguageProvider';

const MESSAGES = defineMessages({
	en: {
		heading: 'Your assets',
		count: { one: '{count} asset', other: '{count} assets' },
	},
});

function Probe(props: { count: number }) {
	const messages = useMessages(MESSAGES);
	const plural = usePlural();
	return (
		<p>
			{messages.heading}: {plural(messages.count, props.count)}
		</p>
	);
}

describe('LanguageProvider', () => {
	it('resolves feature catalogs for the active language', () => {
		expect(
			renderToStaticMarkup(
				<LanguageProvider>
					<Probe count={2} />
				</LanguageProvider>
			)
		).toBe('<p>Your assets: 2 assets</p>');
	});

	it('falls back to the default language outside the provider', () => {
		expect(renderToStaticMarkup(<Probe count={1} />)).toBe('<p>Your assets: 1 asset</p>');
	});
});
