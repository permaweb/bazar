import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ArCurrencyText } from './ArCurrencyLabel';

describe('ArCurrencyText', () => {
	it('adds the AR logo to every standalone visible currency mention', () => {
		const markup = renderToStaticMarkup(<ArCurrencyText>1 AR total for 2 AR</ArCurrencyText>);

		expect(markup.match(/class="ar-currency-label"/g)).toHaveLength(2);
		expect(markup).toContain('1 ');
		expect(markup).toContain(' total for 2 ');
	});

	it('does not alter AR inside another word', () => {
		const markup = renderToStaticMarkup(<ArCurrencyText>Arweave and CARD</ArCurrencyText>);

		expect(markup).not.toContain('ar-currency-label');
	});
});
