import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));

import { createMintErrorMessage, FungibleMintDialog, nonFungibleMintInputError } from './CreateRoute';

describe('fungible mint presentation', () => {
	it('uses the marketplace operation side drawer for a completed token mint', () => {
		const markup = renderToStaticMarkup(
			React.createElement(FungibleMintDialog, {
				confirmations: 5,
				consensus: null,
				error: null,
				logoPreview: 'blob:token-logo',
				name: 'Signal',
				onClearError: () => undefined,
				onNavigate: () => undefined,
				onVisibleChange: () => undefined,
				phase: null,
				phaseLabel: '',
				progressButton: React.createRef<HTMLButtonElement>(),
				ready: true,
				result: {
					processId: 'P'.repeat(43),
					logo: 'L'.repeat(43),
					owner: 'W'.repeat(43),
					name: 'Signal',
					ticker: 'SIG',
					wholeSupply: '1000000',
					atomicSupply: '1000000000000000000',
					denomination: 12,
					createdAt: 1,
				},
				ticker: 'SIG',
				views: [],
				visible: true,
			})
		);

		expect(markup).toContain('operation-panel-backdrop');
		expect(markup).toContain('operation-side-panel');
		expect(markup).toContain('Token live on Bazar');
		expect(markup).toContain('Token logo transaction');
		expect(markup).not.toContain('mint-success');
	});
});

describe('non-fungible mint pre-validation', () => {
	const png = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });

	it('rejects a collection with a blank name with field guidance before any upload starts', () => {
		expect(
			nonFungibleMintInputError({
				mode: 'collection',
				input: { files: [png('a.png'), png('b.png')], name: '   ', description: '', udl: {} },
			})
		).toBe('Enter a collection name between 1 and 80 characters.');
	});

	it('rejects an asset with a blank name with field guidance before any upload starts', () => {
		expect(
			nonFungibleMintInputError({
				mode: 'asset',
				input: { file: png('a.png'), name: '', description: '', udl: {} },
			})
		).toBe('Enter a name between 1 and 80 characters.');
	});

	it('accepts valid asset and collection input', () => {
		expect(
			nonFungibleMintInputError({
				mode: 'collection',
				input: { files: [png('a.png')], name: 'Signals', description: '', udl: {} },
			})
		).toBeNull();
		expect(
			nonFungibleMintInputError({ mode: 'asset', input: { file: png('a.png'), name: 'Signal', description: '' } })
		).toBeNull();
	});
});

describe('mint failure copy by mode', () => {
	it.each(['mint-upload-503', 'mint-price-503', 'wallet-balance-502', 'User rejected the request'])(
		'never sends a failed token mint (%s) to Transaction activity, which has no entry for it',
		(code) => {
			expect(createMintErrorMessage('fungible', new Error(code))).not.toMatch(/Transaction activity/i);
		}
	);

	it.each(['asset', 'collection'] as const)(
		'keeps the Transaction activity pointer for a failed %s upload',
		(mode) => {
			expect(createMintErrorMessage(mode, new Error('mint-upload-503'))).toMatch(/Transaction activity/);
		}
	);
});
