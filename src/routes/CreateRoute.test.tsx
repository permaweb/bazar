import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));

import {
	FungibleMintDialog,
	fungibleMintStage,
	isMintLiveFor,
	MINT_LIVE_EVENT,
	MintRecoveryActions,
	MintRecoveryCost,
	MintSubmitButton,
	quoteClearsError,
	type QuoteErrorReset,
	resumeMintDraft,
	runSingleFlight,
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

describe('mint submit single flight', () => {
	it('runs a second submit only after the first settles', async () => {
		const guard = { current: false };
		let settle: () => void = () => undefined;
		const run = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				})
		);

		const first = runSingleFlight(guard, run);
		expect(guard.current).toBe(true);
		await expect(runSingleFlight(guard, run)).resolves.toBe(false);
		expect(run).toHaveBeenCalledTimes(1);

		settle();
		await expect(first).resolves.toBe(true);
		expect(guard.current).toBe(false);
		const next = runSingleFlight(guard, run);
		expect(run).toHaveBeenCalledTimes(2);
		settle();
		await expect(next).resolves.toBe(true);
	});

	it('releases the guard when the run fails', async () => {
		const guard = { current: false };
		await expect(
			runSingleFlight(guard, () => Promise.reject(new Error('mint-insufficient-balance')))
		).rejects.toThrow('mint-insufficient-balance');
		expect(guard.current).toBe(false);
		const run = vi.fn(() => Promise.resolve());
		await expect(runSingleFlight(guard, run)).resolves.toBe(true);
		expect(run).toHaveBeenCalledTimes(1);
	});
});

describe('quote refresh keeps a failed run visible', () => {
	it('clears the error for changed inputs but not for a refresh caused by kept paid progress', () => {
		const file = new File([new Uint8Array(1)], 'one.png', { type: 'image/png' });
		const reset: QuoteErrorReset = { inputs: null, clearError: false };

		quoteClearsError(reset, ['Set', file]);
		expect(reset.clearError).toBe(true);
		reset.clearError = false;

		// The run paid for an asset, so the quote refreshes with the same inputs.
		quoteClearsError(reset, ['Set', file]);
		expect(reset.clearError).toBe(false);

		quoteClearsError(reset, ['Renamed', file]);
		expect(reset.clearError).toBe(true);
		// A quote superseded before its timer fired still owes the clear.
		quoteClearsError(reset, ['Renamed', file]);
		expect(reset.clearError).toBe(true);
	});
});

describe('mint submit controls', () => {
	const submitButton = (props: Partial<React.ComponentProps<typeof MintSubmitButton>>) =>
		renderToStaticMarkup(
			React.createElement(MintSubmitButton, {
				blocked: false,
				connected: true,
				mode: 'asset',
				phaseLabel: '',
				submission: null,
				working: false,
				...props,
			})
		);
	const recoveryActions = (props: Partial<React.ComponentProps<typeof MintRecoveryActions>>) =>
		renderToStaticMarkup(
			React.createElement(MintRecoveryActions, {
				onDismiss: () => undefined,
				onResume: () => undefined,
				phaseLabel: '',
				submission: null,
				working: false,
				...props,
			})
		);

	it('offers the mint while idle', () => {
		const markup = submitButton({});
		expect(markup).toContain('Upload and mint');
		expect(markup).not.toContain('disabled');
	});

	it('stays disabled with a preflight label before the first wallet phase', () => {
		const markup = submitButton({ submission: 'mint', working: true });
		expect(markup).toContain('disabled');
		expect(markup).toContain('Checking wallet and balance…');
		expect(markup).not.toContain('Upload and mint');
		expect(submitButton({ mode: 'collection', submission: 'mint', working: true })).toContain(
			'Checking wallet and balance…'
		);
	});

	it('shows the wallet phase once the uploader reports one', () => {
		const markup = submitButton({
			phaseLabel: 'Approve the atomic asset in your wallet…',
			submission: 'mint',
			working: true,
		});
		expect(markup).toContain('disabled');
		expect(markup).toContain('Approve the atomic asset in your wallet…');
	});

	it('disables Finish mint and Dismiss while a recovery is preparing', () => {
		const markup = recoveryActions({ submission: 'resume', working: true });
		expect(markup.match(/disabled=""/g)).toHaveLength(2);
		expect(markup).toContain('Recovering the saved upload…');
		expect(markup).not.toContain('Finish mint');
	});

	it('disables the recovery actions while a new mint is running', () => {
		const markup = recoveryActions({ submission: 'mint', working: true });
		expect(markup.match(/disabled=""/g)).toHaveLength(2);
		expect(markup).toContain('Finish mint');
		expect(recoveryActions({})).not.toContain('disabled');
	});
});

describe('legacy draft recovery cost', () => {
	const draft = {
		owner: 'W'.repeat(43),
		name: 'Long recording',
		description: '',
		contentType: 'audio/mpeg',
		mediaId: 'M'.repeat(43),
		createdAt: 123,
	};
	const estimate = { assetReward: 100_000_000_001n, assetBytes: 50 * 1024 * 1024 };
	const callbacks = { onPhase: () => undefined, onTransaction: () => undefined };

	it('shows the re-upload price in the recovery panel', () => {
		const markup = renderToStaticMarkup(React.createElement(MintRecoveryCost, { estimate, pricing: false }));
		expect(markup).toContain('Network cost to finish');
		expect(markup).toContain('0.100000000001');
		expect(markup).toContain('50.0 MB');
		expect(
			renderToStaticMarkup(React.createElement(MintRecoveryCost, { estimate: null, pricing: true }))
		).toContain('Checking the network cost to finish…');
		expect(
			renderToStaticMarkup(React.createElement(MintRecoveryCost, { estimate: null, pricing: false }))
		).toContain('your wallet shows it before you approve');
	});

	it('approves a high re-upload cost once the panel has shown it', async () => {
		const client = { resume: vi.fn(async () => ({} as any)) };
		await resumeMintDraft(client, draft, draft.owner, estimate, callbacks);
		expect(client.resume).toHaveBeenCalledWith(
			draft,
			draft.owner,
			expect.objectContaining({ allowHighCost: true })
		);
	});

	it('keeps the high-cost gate when the price could not be shown', async () => {
		const client = { resume: vi.fn(async () => ({} as any)) };
		await resumeMintDraft(client, draft, draft.owner, null, callbacks);
		expect(client.resume).toHaveBeenCalledWith(
			draft,
			draft.owner,
			expect.objectContaining({ allowHighCost: false })
		);
	});

	it('holds Finish mint, but not Dismiss, while the price is being checked', () => {
		const markup = renderToStaticMarkup(
			React.createElement(MintRecoveryActions, {
				onDismiss: () => undefined,
				onResume: () => undefined,
				phaseLabel: '',
				pricing: true,
				submission: null,
				working: false,
			})
		);
		expect(markup.match(/disabled=""/g)).toHaveLength(1);
		expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Finish mint/);
	});
});
