import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ObserverView } from 'weave-wrangler';

import { FUNGIBLE_TOKEN_COLLECTION_ID } from 'api/collections';
import { MINT_ACTIVITY_ATTENTION_AFTER_MS, MINT_ACTIVITY_STALLED_STATUS, type MintActivity } from 'api/mint-activity';

vi.mock('./useDialogFocus', async (importOriginal) => ({
	...(await importOriginal<typeof import('./useDialogFocus')>()),
	useDialogFocus: () => ({ current: null }),
}));

import {
	mintActivityMenuCopy,
	mintActivityUploadActivity,
	observeUploadActivityTransactions,
	type UploadActivity,
	uploadActivityEyebrow,
	UploadActivityPanel,
	type UploadObserverAvailability,
	uploadActivityObserverKey,
	uploadActivitySyncSteps,
} from './App';

const processId = 'P'.repeat(43);
const owner = 'O'.repeat(43);

const upload: UploadActivity = {
	id: 'upload-1',
	owner,
	kind: 'asset',
	name: 'Atomic image',
	phase: 'tracking',
	status: 'Waiting for live process state',
	createdAt: 1,
	transactionIds: [processId],
	transactions: [{ id: processId, label: 'Asset transaction' }],
	assetId: processId,
};

const mint: MintActivity = {
	id: `mint:${owner}:${processId}`,
	owner,
	asset: {
		id: processId,
		name: 'Atomic image',
		description: '',
		contentType: 'image/png',
		image: `https://arweave.net/raw/${processId}`,
		mediaId: processId,
		owner,
		createdAt: 1,
	},
	collectionId: 'created-assets',
	transactionIds: [processId],
	arweaveGateway: 'https://arweave.net',
	computeGateway: 'https://alpha.example',
	phase: 'mined',
	status: 'Mined on Arweave. Waiting for live process state.',
	createdAt: 1,
};

function observer(host: string): ObserverView {
	return {
		observer: { url: `https://${host}`, label: host, source: 'peer', failures: 0 },
		state: 'confirmed',
		confirmations: 8,
		blockId: 'block',
		blockHeight: 10,
		updatedAt: 2,
		changedAt: 2,
	};
}

describe('upload observer lanes', () => {
	it('does not invent a local observer lane before the network answers', () => {
		expect(uploadActivitySyncSteps(upload, [mint])[0]).toMatchObject({
			confirmations: 1,
			terminal: true,
			transaction: { id: processId, views: [] },
		});
	});

	it('renders every live observer view attached to the uploaded transaction', () => {
		const views = [observer('alpha.example'), observer('bravo.example'), observer('charlie.example')];
		const step = uploadActivitySyncSteps(upload, [mint], { [processId]: { views } })[0];

		expect(step.transaction?.views).toEqual(views);
		expect(step.transaction?.views.map((view) => view.observer.label)).toEqual([
			'alpha.example',
			'bravo.example',
			'charlie.example',
		]);
	});
});

describe('upload observer watch lifecycle', () => {
	const artworkId = 'W'.repeat(43);
	const transactions = () => [
		{ id: artworkId, label: 'Artwork transaction' },
		{ id: processId, label: 'Asset transaction' },
	];

	function stubRuntime(ready: Promise<unknown> = Promise.resolve()) {
		const watchers: Array<{ id: string; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
		const release = vi.fn();
		const acquireAssetObserverNetwork = vi.fn(() => ({
			ready,
			release,
			network: {
				watch: (id: string) => {
					const watcher = {
						id,
						start: vi.fn(),
						stop: vi.fn(),
						views: () => [],
						consensus: () => undefined,
						on: () => () => undefined,
					};
					watchers.push(watcher);
					return watcher;
				},
			},
		}));
		const loadRuntime = vi.fn(async () => ({ acquireAssetObserverNetwork } as any));
		return { acquireAssetObserverNetwork, loadRuntime, release, watchers };
	}

	function handlers() {
		const availability: UploadObserverAvailability[] = [];
		return {
			availability,
			onObservation: vi.fn(),
			onAvailability: (next: UploadObserverAvailability) => availability.push(next),
		};
	}

	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	it('keys the watch on transaction ids, so equal rebuilt arrays do not restart discovery', () => {
		expect(uploadActivityObserverKey(transactions())).toBe(uploadActivityObserverKey(transactions()));
		expect(
			uploadActivityObserverKey(transactions().map((transaction) => ({ ...transaction, label: 'Renamed' })))
		).toBe(uploadActivityObserverKey(transactions()));
		expect(uploadActivityObserverKey([{ id: processId, label: 'Asset transaction' }])).not.toBe(
			uploadActivityObserverKey(transactions())
		);
		expect(uploadActivityObserverKey([])).toBe('');
	});

	it('moves loading -> watching and starts one watcher per transaction', async () => {
		const runtime = stubRuntime();
		const events = handlers();
		const stop = observeUploadActivityTransactions([artworkId, processId], runtime.loadRuntime, events);
		await settle();

		expect(events.availability).toEqual(['loading', 'watching']);
		expect(runtime.acquireAssetObserverNetwork).toHaveBeenCalledTimes(1);
		expect(runtime.watchers.map((watcher) => watcher.id)).toEqual([artworkId, processId]);
		expect(runtime.watchers.every((watcher) => watcher.start.mock.calls.length === 1)).toBe(true);
		expect(runtime.release).not.toHaveBeenCalled();

		stop();
		expect(runtime.watchers.every((watcher) => watcher.stop.mock.calls.length === 1)).toBe(true);
		expect(runtime.release).toHaveBeenCalledTimes(1);
	});

	it('reports unavailable and releases the lease when observer discovery fails', async () => {
		const runtime = stubRuntime(Promise.reject(new Error('No AO peer is configured.')));
		const events = handlers();
		observeUploadActivityTransactions([processId], runtime.loadRuntime, events);
		await settle();

		expect(events.availability).toEqual(['loading', 'unavailable']);
		expect(runtime.release).toHaveBeenCalledTimes(1);
		expect(runtime.watchers).toHaveLength(0);
	});

	it('reports unavailable when the observer runtime itself cannot load', async () => {
		const events = handlers();
		observeUploadActivityTransactions([processId], () => Promise.reject(new Error('chunk failed')), events);
		await settle();

		expect(events.availability).toEqual(['loading', 'unavailable']);
	});

	it('stays silent after cleanup, so a closed panel never flips to unavailable', async () => {
		let rejectReady: (cause: Error) => void = () => undefined;
		const runtime = stubRuntime(new Promise((_, reject) => (rejectReady = reject)));
		const events = handlers();
		const stop = observeUploadActivityTransactions([processId], runtime.loadRuntime, events);
		await settle();
		stop();
		rejectReady(new Error('discovery failed'));
		await settle();

		expect(events.availability).toEqual(['loading']);
		expect(runtime.release).toHaveBeenCalledTimes(1);
	});
});

describe('background mint activity panel', () => {
	const stalledAt = mint.createdAt + MINT_ACTIVITY_ATTENTION_AFTER_MS;

	function renderPanel(activity: UploadActivity) {
		return renderToStaticMarkup(
			React.createElement(
				MemoryRouter,
				null,
				React.createElement(UploadActivityPanel, {
					activity,
					relatedMintActivities: [mint],
					visible: true,
					onHide: vi.fn(),
					onClose: vi.fn(),
					onCheckAgain: vi.fn(),
					onStopTracking: vi.fn(),
				})
			)
		);
	}

	it('shows live tracking progress before the attention threshold', () => {
		const activity = mintActivityUploadActivity(mint, stalledAt - 1);
		expect(activity).toMatchObject({ phase: 'tracking', status: mint.status, assetId: processId });

		const markup = renderPanel(activity);
		expect(markup).toContain('Hide transaction details');
		expect(markup).not.toContain('Check again');
		expect(markup).not.toContain('Stop tracking');
	});

	it('matches the Activity menu once stalled and offers Check again and Stop tracking', () => {
		const activity = mintActivityUploadActivity(mint, stalledAt);
		expect(activity).toMatchObject({ phase: 'error', status: MINT_ACTIVITY_STALLED_STATUS });

		const markup = renderPanel(activity);
		expect(markup).toContain('Upload needs attention');
		expect(markup).toContain('Bazar is still checking');
		expect(markup).toContain('>Check again</button>');
		expect(markup).toContain('>Stop tracking</button>');
		expect(markup).toContain('aria-label="Close dialog"');
		expect(markup).not.toContain('Hide transaction details');
		expect(markup).not.toContain('operation-working');
	});
});

describe('upload result announcements', () => {
	const render = (activity: UploadActivity) =>
		renderToStaticMarkup(
			React.createElement(
				MemoryRouter,
				null,
				React.createElement(UploadActivityPanel, {
					activity,
					relatedMintActivities: [],
					visible: true,
					onHide: () => undefined,
					onClose: () => undefined,
				})
			)
		);
	// Text of the always-mounted outcome region (hidden-operation-outcome-notice), or null when absent.
	const outcomeRegion = (markup: string) =>
		markup
			.match(/<div aria-atomic="true" class="sr-only" role="status">([\s\S]*?)<\/div>/)?.[1]
			.replace(/<[^>]+>/g, '') ?? null;

	it('reads a failed upload as an alert, not a polite status', () => {
		const markup = render({
			...upload,
			phase: 'error',
			status: 'The wallet rejected the signature request.',
			transactionIds: [],
			transactions: [],
		});

		expect(markup).toContain('Upload needs attention');
		expect(markup).toContain('<p role="alert">The wallet rejected the signature request.</p>');
		expect(markup).not.toContain('aria-live="polite"');
		// The failure is read once, as the alert: the outcome region stays mounted but empty.
		expect(outcomeRegion(markup)).toBe('');
	});

	it('keeps a finished upload as a polite status', () => {
		const markup = render({ ...upload, phase: 'done', status: 'Submitted to Arweave.', collectionId: 'c' });

		// The always-mounted outcome region carries the polite status.
		expect(outcomeRegion(markup)).toContain('Submitted to Arweave.');
		expect(markup).not.toContain('role="alert"');
	});
});

describe('mint activity labels', () => {
	const logoId = 'L'.repeat(43);
	const tokenMint: MintActivity = {
		...mint,
		asset: {
			...mint.asset,
			name: 'Test Token',
			contentType: 'application/x.arweave-token',
			ticker: 'TEST',
		},
		collectionId: FUNGIBLE_TOKEN_COLLECTION_ID,
		transactionIds: [logoId, processId],
	};

	it('labels a token mint restored from Activity as a token, not an artwork upload', () => {
		const activity = mintActivityUploadActivity(tokenMint, tokenMint.createdAt);

		expect(activity.transactions).toEqual([
			{ id: logoId, label: 'Token logo transaction' },
			{ id: processId, label: 'Token process transaction' },
		]);
		expect(uploadActivityEyebrow(activity)).toBe('Token mint');
		expect(mintActivityMenuCopy(tokenMint)).toEqual({ kind: 'Token mint' });
		// The needs-attention line is the shared stalled copy, which never calls a token mint an upload.
		expect(MINT_ACTIVITY_STALLED_STATUS).not.toMatch(/upload/i);
	});

	it('keeps the artwork and asset labels for an atomic asset mint', () => {
		const artworkId = 'A'.repeat(43);
		const assetMint: MintActivity = { ...mint, transactionIds: [artworkId, processId] };
		const activity = mintActivityUploadActivity(assetMint, assetMint.createdAt);

		expect(activity).toMatchObject({ kind: 'asset', phase: 'tracking', assetId: processId });
		expect(activity.transactions.map((transaction) => transaction.label)).toEqual([
			'Artwork transaction',
			'Asset transaction',
		]);
		expect(uploadActivityEyebrow(activity)).toBe('Asset upload');
		expect(uploadActivityEyebrow({ kind: 'collection' })).toBe('Collection upload');
		expect(mintActivityMenuCopy(assetMint).kind).toBe('Upload');
	});
});
