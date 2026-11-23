import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));

import {
	FungibleMintDialog,
	fungibleMintStage,
	isMintLiveFor,
	MINT_LIVE_EVENT,
	subscribeMintLive,
} from './CreateRoute';

const tokenResult = {
	processId: 'P'.repeat(43),
	logo: 'L'.repeat(43),
	owner: 'W'.repeat(43),
	name: 'Signal',
	ticker: 'SIG',
	wholeSupply: '1000000',
	atomicSupply: '1000000000000000000',
	denomination: 12,
	createdAt: 1,
};

function dialogMarkup(overrides: Partial<React.ComponentProps<typeof FungibleMintDialog>> = {}) {
	return renderToStaticMarkup(
		React.createElement(FungibleMintDialog, {
			confirmations: 2,
			consensus: null,
			error: null,
			logoPreview: '',
			name: 'Signal',
			onClearError: () => undefined,
			onNavigate: () => undefined,
			onVisibleChange: () => undefined,
			phase: null,
			phaseLabel: '',
			progressButton: React.createRef<HTMLButtonElement>(),
			ready: false,
			result: tokenResult,
			ticker: 'SIG',
			views: [],
			visible: true,
			...overrides,
		})
	);
}

function mintLiveEvent(assetId: string) {
	return new CustomEvent(MINT_LIVE_EVENT, { detail: { asset: { id: assetId } } });
}

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

	it('says a submitted token is waiting for the scheduler, not already minted', () => {
		const markup = dialogMarkup();

		expect(markup).toContain('Token process submitted.');
		expect(markup).toContain('the mint stays in Activity');
		expect(markup).not.toContain('minted to your wallet');
		expect(markup).not.toContain('Token live on Bazar');
		expect(markup).not.toContain('Bazar could not confirm');
	});

	it('shows a confirm-failed notice while the Activity watch continues', () => {
		const markup = dialogMarkup({ confirmFailed: true });

		expect(markup).toContain('Bazar could not confirm the token process transaction');
		expect(markup).toContain('the watch continues in Activity');
		expect(markup).toContain('Token process transaction');
		expect(markup).not.toContain('Token live on Bazar');
	});

	it('reaches the done state with Dispatch once ready, even after a confirm failure', () => {
		const markup = dialogMarkup({ confirmFailed: true, ready: true });

		expect(markup).toContain('Token live on Bazar');
		expect(markup).toContain('Dispatch to holders');
		expect(markup).not.toContain('Bazar could not confirm');
	});
});

describe('fungible mint stage', () => {
	const base = { confirmFailed: false, error: null, ready: false, result: null };

	it('walks preparing -> submitted -> confirm-failed -> live, with error taking precedence', () => {
		expect(fungibleMintStage(base)).toBe('preparing');
		expect(fungibleMintStage({ ...base, result: tokenResult })).toBe('submitted');
		expect(fungibleMintStage({ ...base, result: tokenResult, confirmFailed: true })).toBe('confirm-failed');
		expect(fungibleMintStage({ ...base, result: tokenResult, confirmFailed: true, ready: true })).toBe('live');
		expect(fungibleMintStage({ ...base, result: tokenResult, ready: true, error: 'rejected' })).toBe('error');
		expect(fungibleMintStage({ ...base, error: 'rejected' })).toBe('error');
	});
});

describe('mint-live readiness', () => {
	it('matches only the mint-live event for the same process id', () => {
		expect(isMintLiveFor(mintLiveEvent(tokenResult.processId), tokenResult.processId)).toBe(true);
		expect(isMintLiveFor(mintLiveEvent('O'.repeat(43)), tokenResult.processId)).toBe(false);
		expect(isMintLiveFor(new CustomEvent(MINT_LIVE_EVENT), tokenResult.processId)).toBe(false);
		expect(isMintLiveFor(mintLiveEvent(''), '')).toBe(false);
		expect(isMintLiveFor(mintLiveEvent(tokenResult.processId), undefined)).toBe(false);
	});

	it('flips ready for a fungible process when the App mint watcher reports it live', () => {
		const target = new EventTarget();
		const onLive = vi.fn();
		const unsubscribe = subscribeMintLive(target, tokenResult.processId, onLive);

		target.dispatchEvent(mintLiveEvent('O'.repeat(43)));
		expect(onLive).not.toHaveBeenCalled();
		target.dispatchEvent(mintLiveEvent(tokenResult.processId));
		expect(onLive).toHaveBeenCalledTimes(1);

		unsubscribe();
		target.dispatchEvent(mintLiveEvent(tokenResult.processId));
		expect(onLive).toHaveBeenCalledTimes(1);
	});
});
