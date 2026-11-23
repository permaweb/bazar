import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));

import {
	FungibleMintDialog,
	mintErrorField,
	mintFieldErrorProps,
	mintFormError,
	MintFormFeedback,
} from './CreateRoute';

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

describe('mint form error state', () => {
	it('maps each validation code to the one field it is about', () => {
		expect(mintErrorField('mint-name-invalid')).toBe('mint-name');
		expect(mintErrorField('mint-description-invalid')).toBe('mint-description');
		expect(mintErrorField('mint-ticker-invalid')).toBe('mint-ticker');
		expect(mintErrorField('mint-supply-invalid')).toBe('mint-supply');
		expect(mintErrorField('mint-supply-too-large')).toBe('mint-supply');
		expect(mintErrorField('mint-denomination-invalid')).toBe('mint-denomination');
		expect(mintErrorField('mint-logo-type-unsupported')).toBe('mint-logo-picker');
		expect(mintErrorField('mint-logo-size-invalid')).toBe('mint-logo-picker');
		expect(mintErrorField('mint-file-required')).toBe('mint-file-picker');
		expect(mintErrorField('mint-file-size-invalid')).toBe('mint-file-picker');
		expect(mintErrorField('mint-insufficient-balance')).toBeNull();
		expect(mintErrorField('wallet-account-changed')).toBeNull();
	});

	it('keeps the code next to the friendly message', () => {
		expect(mintFormError(new Error('mint-ticker-invalid'))).toEqual({
			message: 'Enter a token ticker between 1 and 32 characters.',
			field: 'mint-ticker',
		});
		expect(mintFormError('mint-file-required')).toEqual({
			message: 'Choose an image, MP3, or WAV file to continue.',
			field: 'mint-file-picker',
		});
		expect(mintFormError(new Error('mint-supply-too-large'), 'Custom copy.')).toEqual({
			message: 'Custom copy.',
			field: 'mint-supply',
		});
		expect(mintFormError(new Error('User rejected the request')).field).toBeNull();
	});

	it('marks only the field named by the error as invalid and describes it with the alert', () => {
		const error = mintFormError(new Error('mint-ticker-invalid'));
		expect(mintFieldErrorProps(error, 'mint-ticker', 'mint-error')).toEqual({
			'aria-describedby': 'mint-error',
			'aria-invalid': true,
		});
		expect(mintFieldErrorProps(error, 'mint-name', 'mint-error')).toEqual({});
		expect(mintFieldErrorProps(null, 'mint-ticker', 'mint-error')).toEqual({});
	});
});

describe('mint form feedback', () => {
	const render = (props: Partial<React.ComponentProps<typeof MintFormFeedback>>) =>
		renderToStaticMarkup(
			React.createElement(MintFormFeedback, {
				collectionResult: false,
				error: null,
				errorId: 'mint-error',
				result: false,
				resultReady: false,
				...props,
			})
		);

	it('announces a form error as an alert the fields can point at', () => {
		const markup = render({ error: mintFormError(new Error('mint-file-size-invalid')) });
		expect(markup).toContain(
			'<div class="inline-error" id="mint-error" role="alert"><span>Use an image up to 10 MB, or an MP3/WAV file up to 100 MB.</span></div>'
		);
	});

	it('keeps an empty status region mounted while nothing has been submitted', () => {
		const markup = render({});
		expect(markup).toBe('<div aria-atomic="true" class="sr-only" role="status"></div>');
	});

	it('announces the submitted transition politely', () => {
		const markup = render({ result: true });
		expect(markup).toContain('role="status"');
		expect(markup).toContain('Submitted to Arweave. Submitted and accepted by Arweave.');
	});

	it('leaves "Live on Bazar" to the global mint notice', () => {
		const markup = render({ result: true, resultReady: true });
		expect(markup).toBe('<div aria-atomic="true" class="sr-only" role="status"></div>');
	});

	it('announces the collection receipt', () => {
		expect(render({ collectionResult: true })).toContain(
			'Submitted to Arweave. The collection receipt is ready to verify.'
		);
	});
});
