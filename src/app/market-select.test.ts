import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MarketSelect, marketSelectEscapeOwnerAttr } from './App';
import { targetOwnsDialogEscape } from './useDialogFocus';

/** A child of a MarketSelect root whose closest() walks up to that root's attributes. */
function optionInsideRoot(rootAttributes: Record<string, string | undefined>) {
	return {
		closest: (selector: string) => {
			const match = /^\[([^\]=]+)\]$/.exec(selector);
			return match && rootAttributes[match[1]] !== undefined ? rootAttributes : null;
		},
	} as unknown as EventTarget;
}

describe('MarketSelect Escape ownership inside dialogs', () => {
	it('owns Escape only while its listbox is open', () => {
		expect(marketSelectEscapeOwnerAttr(true)).toBe('');
		expect(marketSelectEscapeOwnerAttr(false)).toBeUndefined();
	});

	it('makes the enclosing dialog skip the first Escape while open and take it once closed', () => {
		const open = optionInsideRoot({ 'data-dialog-escape-owner': marketSelectEscapeOwnerAttr(true) });
		const closed = optionInsideRoot({ 'data-dialog-escape-owner': marketSelectEscapeOwnerAttr(false) });
		expect(targetOwnsDialogEscape(open)).toBe(true);
		expect(targetOwnsDialogEscape(closed)).toBe(false);
	});

	it('does not claim Escape while closed', () => {
		const markup = renderToStaticMarkup(
			React.createElement(MarketSelect<'a' | 'b'>, {
				label: 'Choose settlement receipt',
				onChange: () => undefined,
				options: [
					{ value: 'a', label: 'Listing 1' },
					{ value: 'b', label: 'Listing 2' },
				],
				value: 'a',
			})
		);
		expect(markup).toContain('class="market-select"');
		expect(markup).not.toContain('data-dialog-escape-owner');
	});
});
