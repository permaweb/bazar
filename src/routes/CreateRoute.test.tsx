import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));

import type { CollectionMintResult, MintedAsset } from 'api/asset-mint';

import { Button } from 'components/Button';
import { SegmentedTabs } from 'components/SegmentedTabs';

import {
	createMintErrorMessage,
	fileDropzoneProps,
	FungibleMintDialog,
	fungibleMintStage,
	isMintLiveFor,
	messageAfterEstimateStart,
	MINT_LIVE_EVENT,
	mintEstimateFailure,
	MintEstimateFailureNotice,
	mintEstimateStatus,
	MintOutcomeCard,
	mintOutcomeReceipt,
	MintRecoveryActions,
	MintRecoveryCost,
	MintSubmitButton,
	nonFungibleMintInputError,
	quoteClearsError,
	type QuoteErrorReset,
	resumeMintDraft,
	runSingleFlight,
	scheduleEstimate,
	subscribeMintLive,
	visibleMintOutcome,
	withMintEstimateFailure,
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
			onCreateAnother: () => undefined,
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
				onCreateAnother: () => undefined,
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
		// A finished token is not a dead end: the done state offers the next mint.
		expect(markup).toContain('Create another token');
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

describe('create result per tab', () => {
	const asset = { id: 'A'.repeat(43), artworkId: 'R'.repeat(43) } as unknown as MintedAsset;
	const collection = {
		collection: { id: 'C'.repeat(43) },
		manifestId: 'M'.repeat(43),
		processId: 'P'.repeat(43),
	} as unknown as CollectionMintResult;

	it('shows a result only on the tab that produced it', () => {
		expect(visibleMintOutcome('fungible', { result: asset, collectionResult: null })).toBeNull();
		expect(visibleMintOutcome('collection', { result: asset, collectionResult: null })).toBeNull();
		expect(visibleMintOutcome('asset', { result: null, collectionResult: collection })).toBeNull();
		expect(visibleMintOutcome('fungible', { result: null, collectionResult: collection })).toBeNull();
		expect(visibleMintOutcome('asset', { result: null, collectionResult: null })).toBeNull();
	});

	it('keeps each tab result for its own tab', () => {
		const both = { result: asset, collectionResult: collection };
		expect(visibleMintOutcome('asset', both)).toEqual({ kind: 'asset', asset });
		expect(visibleMintOutcome('collection', both)).toEqual({ kind: 'collection', collection });
	});

	it('builds the receipt from the selected tab even when another tab also has a result', () => {
		const assetOutcome = visibleMintOutcome('asset', { result: asset, collectionResult: collection })!;
		expect(mintOutcomeReceipt(assetOutcome)).toEqual([
			{ label: 'Artwork transaction', transactionId: asset.artworkId },
			{ label: 'Asset transaction', transactionId: asset.id },
		]);
		const collectionOutcome = visibleMintOutcome('collection', { result: asset, collectionResult: collection })!;
		expect(mintOutcomeReceipt(collectionOutcome).map(({ transactionId }) => transactionId)).toEqual([
			collection.manifestId,
			collection.processId,
		]);
	});

	const card = (outcome: NonNullable<ReturnType<typeof visibleMintOutcome>>, ready: boolean) =>
		renderToStaticMarkup(
			React.createElement(MintOutcomeCard, {
				onCreateAnother: () => undefined,
				onNavigate: () => undefined,
				outcome,
				ready,
			})
		);

	it('offers Create another on a submitted, live and collection result', () => {
		const submitted = card({ kind: 'asset', asset }, false);
		expect(submitted).toContain('Submitted to Arweave');
		expect(submitted).toContain('Continue browsing');
		expect(submitted).toContain('View when available');
		expect(submitted).toContain('Create another');

		const live = card({ kind: 'asset', asset }, true);
		expect(live).toContain('Live on Bazar');
		expect(live).toContain('View asset');
		expect(live).not.toContain('disabled');
		expect(live).toContain('Create another');

		const minted = card({ kind: 'collection', collection }, false);
		expect(minted).toContain('The collection receipt is ready to verify.');
		expect(minted).toContain('View collection');
		expect(minted).not.toContain('disabled');
		expect(minted).not.toContain('Asset transaction');
		expect(minted).toContain('Create another');
	});
});

describe('create type tabs', () => {
	const tabs = (disabled?: boolean) =>
		renderToStaticMarkup(
			React.createElement(SegmentedTabs, {
				active: 'asset',
				ariaLabel: 'Create type',
				disabled,
				idPrefix: 'create-mode',
				onChange: () => undefined,
				tabs: [
					{ value: 'asset', label: 'Unique 1/1' },
					{ value: 'fungible', label: 'Token' },
				],
			})
		);

	it('locks every tab while a mint is running', () => {
		expect(tabs(true).match(/disabled=""/g)).toHaveLength(2);
		expect(tabs()).not.toContain('disabled');
	});
});

describe('create file dropzones', () => {
	const dropped = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })];
	const dropEvent = () => ({ preventDefault: vi.fn(), dataTransfer: { files: dropped } });

	it('stays an enabled element with aria-disabled while a mint is working', () => {
		const markup = (working: boolean) =>
			renderToStaticMarkup(
				React.createElement(
					Button,
					{ className: 'mint-dropzone', ...fileDropzoneProps(working, vi.fn(), vi.fn()) },
					'Choose media'
				)
			);
		// A disabled control may never receive drag events, leaving the browser default (open
		// the dropped file, unloading the page) in charge mid-upload.
		expect(markup(true)).not.toContain('disabled=""');
		expect(markup(true)).toContain('aria-disabled="true"');
		expect(markup(false)).not.toContain('disabled');
	});

	it('swallows a drop during a mint without navigating or changing the selection', () => {
		const openPicker = vi.fn();
		const acceptFiles = vi.fn();
		const props = fileDropzoneProps(true, openPicker, acceptFiles);

		const over = { preventDefault: vi.fn() };
		props.onDragOver(over);
		expect(over.preventDefault).toHaveBeenCalledTimes(1);

		const drop = dropEvent();
		props.onDrop(drop);
		expect(drop.preventDefault).toHaveBeenCalledTimes(1);
		expect(acceptFiles).not.toHaveBeenCalled();

		props.onClick();
		expect(openPicker).not.toHaveBeenCalled();
	});

	it('accepts the dropped files and opens the picker while idle', () => {
		const openPicker = vi.fn();
		const acceptFiles = vi.fn();
		const props = fileDropzoneProps(false, openPicker, acceptFiles);

		const drop = dropEvent();
		props.onDrop(drop);
		expect(drop.preventDefault).toHaveBeenCalledTimes(1);
		expect(acceptFiles).toHaveBeenCalledWith(dropped);

		props.onClick();
		expect(openPicker).toHaveBeenCalledTimes(1);
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

	it('points a submit blocked by a failed estimate at that failure', () => {
		expect(submitButton({ blocked: true, describedBy: 'mint-estimate-failure' })).toContain(
			'aria-describedby="mint-estimate-failure"'
		);
		expect(submitButton({})).not.toContain('aria-describedby');
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

describe('mint cost estimate lifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	const deferred = () => {
		let resolve!: () => void;
		const promise = new Promise<void>((done) => {
			resolve = done;
		});
		return { promise, resolve };
	};

	it('waits for the debounce, then reports checking until the request settles', async () => {
		const request = deferred();
		const flags: boolean[] = [];
		const run = vi.fn(() => request.promise);
		scheduleEstimate(run, (next) => flags.push(next));

		await vi.advanceTimersByTimeAsync(249);
		expect(run).not.toHaveBeenCalled();
		expect(flags).toEqual([]);

		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledTimes(1);
		expect(flags).toEqual([true]);

		request.resolve();
		await vi.runAllTimersAsync();
		expect(flags).toEqual([true, false]);
	});

	it('clears checking when an in-flight estimate is cancelled (tab switch or cleared name)', async () => {
		const request = deferred();
		const flags: boolean[] = [];
		let signal: AbortSignal | undefined;
		const cleanup = scheduleEstimate(
			(next) => {
				signal = next;
				return request.promise;
			},
			(next) => flags.push(next)
		);
		await vi.advanceTimersByTimeAsync(250);
		expect(flags.at(-1)).toBe(true);

		cleanup();
		expect(signal?.aborted).toBe(true);
		expect(flags.at(-1)).toBe(false);

		// The cancelled request settling later does not touch the flag again.
		request.resolve();
		await vi.runAllTimersAsync();
		expect(flags).toEqual([true, false]);
	});

	it('never starts a request cancelled during the debounce', async () => {
		const flags: boolean[] = [];
		const run = vi.fn(() => Promise.resolve());
		const cleanup = scheduleEstimate(run, (next) => flags.push(next));
		await vi.advanceTimersByTimeAsync(100);
		cleanup();
		await vi.runAllTimersAsync();
		expect(run).not.toHaveBeenCalled();
		expect(flags).not.toContain(true);
	});

	it('does not let a cancelled request clear the flag of the newer request', async () => {
		const first = deferred();
		const second = deferred();
		let estimating = false;
		const set = (next: boolean) => {
			estimating = next;
		};
		const cancelFirst = scheduleEstimate(() => first.promise, set);
		await vi.advanceTimersByTimeAsync(250);
		cancelFirst();
		scheduleEstimate(() => second.promise, set);
		await vi.advanceTimersByTimeAsync(250);
		expect(estimating).toBe(true);

		first.resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(estimating).toBe(true);

		second.resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(estimating).toBe(false);
	});
});

describe('mint cost estimate failure', () => {
	it('offers Retry for a transient price failure but not for an input validation code', () => {
		// The message is the mapped mint copy (mint-error-copy-mapping), never the dehyphenated code.
		expect(mintEstimateFailure(new Error('mint-price-503'))).toEqual({
			message: expect.stringMatching(/^Arweave network fees could not be checked\./),
			retryable: true,
		});
		expect(mintEstimateFailure(new Error('mint-price-503'), 'fungible').message).not.toMatch(
			/Transaction activity/
		);
		expect(mintEstimateFailure(new TypeError('Failed to fetch')).retryable).toBe(true);
		expect(mintEstimateFailure(new TypeError('mint-name-invalid'))).toEqual({
			message: 'Enter a name between 1 and 80 characters.',
			retryable: false,
		});
		expect(mintEstimateFailure(new TypeError('mint-file-type-unsupported')).retryable).toBe(false);
	});

	it('walks idle -> checking -> ready or failed, and back to checking on retry', () => {
		const failure = { message: 'mint price 503', retryable: true };
		expect(mintEstimateStatus({ estimating: false, hasEstimate: false, failure: null })).toBe('idle');
		expect(mintEstimateStatus({ estimating: true, hasEstimate: false, failure: null })).toBe('checking');
		expect(mintEstimateStatus({ estimating: false, hasEstimate: true, failure: null })).toBe('ready');
		expect(mintEstimateStatus({ estimating: false, hasEstimate: false, failure })).toBe('failed');
		expect(mintEstimateStatus({ estimating: true, hasEstimate: false, failure })).toBe('checking');
	});

	it("keeps each mode's failure in its own slot", () => {
		const failure = { message: 'mint price 503', retryable: true };
		const failed = withMintEstimateFailure({}, 'asset', failure);
		expect(failed).toEqual({ asset: failure });
		expect(withMintEstimateFailure(failed, 'collection', null)).toBe(failed);
		expect(withMintEstimateFailure(failed, 'asset', failure)).toBe(failed);
		expect(withMintEstimateFailure(failed, 'asset', null)).toEqual({});
	});

	it('keeps a selection message through a new estimate and drops a stale submit message', () => {
		const truncated = { text: 'Collections support up to 10 images at a time.', origin: 'selection' as const };
		expect(messageAfterEstimateStart(truncated)).toBe(truncated);
		expect(
			messageAfterEstimateStart({
				text: 'Complete the token name, ticker, total supply, and decimal places to continue.',
				origin: 'submit',
			})
		).toBeNull();
		expect(messageAfterEstimateStart(null)).toBeNull();
	});

	it('renders a Retry cost check button described by the failure for a network failure', () => {
		const markup = renderToStaticMarkup(
			React.createElement(MintEstimateFailureNotice, {
				failure: { message: 'mint price 503', retryable: true },
				id: 'estimate-failure',
				onRetry: () => undefined,
			})
		);
		expect(markup).toContain('Could not check the network cost (mint price 503).');
		expect(markup).toContain('Retry cost check');
		expect(markup).toContain('aria-describedby="estimate-failure"');
		expect(markup).toContain('id="estimate-failure"');
	});

	it('shows a validation message without Retry', () => {
		const markup = renderToStaticMarkup(
			React.createElement(MintEstimateFailureNotice, {
				failure: { message: 'Enter a name between 1 and 80 characters.', retryable: false },
				id: 'estimate-failure',
				onRetry: () => undefined,
			})
		);
		expect(markup).toContain('Enter a name between 1 and 80 characters.');
		expect(markup).not.toContain('Retry');
		expect(markup).not.toContain('<button');
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
