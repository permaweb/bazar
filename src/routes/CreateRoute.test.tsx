import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));

import type { CollectionMintResult, MintedAsset } from 'api/asset-mint';

import { Button } from 'components/Button';
import { SegmentedTabs } from 'components/SegmentedTabs';

import {
	fileDropzoneProps,
	FungibleMintDialog,
	MintOutcomeCard,
	mintOutcomeReceipt,
	MintRecoveryActions,
	MintSubmitButton,
	runSingleFlight,
	visibleMintOutcome,
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
