import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { defineMessages, formatMessage, formatPlural, isLanguage, resolveMessages } from 'helpers/i18n';

describe('i18n helpers', () => {
	it('replaces named placeholders and keeps unknown placeholders visible', () => {
		expect(formatMessage('Block {height} · {proofs} proofs', { height: '1,024', proofs: 3 })).toBe(
			'Block 1,024 · 3 proofs'
		);
		expect(formatMessage('Hello {name}', {})).toBe('Hello {name}');
		expect(formatMessage('{a}{a}', { a: 'x' })).toBe('xx');
	});

	it('leaves templates without placeholders unchanged', () => {
		fc.assert(
			fc.property(
				fc.string().filter((value) => !/\{\w+\}/.test(value)),
				fc.dictionary(fc.string({ minLength: 1 }), fc.string()),
				(template, values) => {
					expect(formatMessage(template, values)).toBe(template);
				}
			)
		);
	});

	it('does not interpret replacement patterns inside values', () => {
		expect(formatMessage('Paid {amount}', { amount: '$& $1' })).toBe('Paid $& $1');
	});

	it('selects plural forms with the language rules', () => {
		const assets = { one: '{count} asset', other: '{count} assets', zero: 'No assets' };
		expect(formatPlural('en', assets, 0)).toBe('No assets');
		expect(formatPlural('en', assets, 1)).toBe('1 asset');
		expect(formatPlural('en', assets, 2)).toBe('2 assets');
		expect(formatPlural('en', { one: '{count} item', other: '{count} items' }, 0)).toBe('0 items');
		expect(formatPlural('en', assets, 1200, { count: '1,200' })).toBe('1,200 assets');
	});

	it('resolves the source catalog for the default language', () => {
		const catalog = defineMessages({ en: { title: 'Discover' } });
		expect(resolveMessages(catalog, 'en')).toBe(catalog.en);
	});

	it('recognizes only supported languages', () => {
		expect(isLanguage('en')).toBe(true);
		expect(isLanguage('xx')).toBe(false);
		expect(isLanguage(undefined)).toBe(false);
	});
});
