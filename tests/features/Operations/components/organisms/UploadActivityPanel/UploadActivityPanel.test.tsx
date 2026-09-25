// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MintActivity } from 'api/mint';

import UploadActivityPanel from 'features/Operations/components/organisms/UploadActivityPanel/UploadActivityPanel';
import type { UploadActivity } from 'providers/OperationActivityProvider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ watchers: [] as Array<{ id: string; started: boolean; stopped: boolean }> }));

vi.mock('api/transactions', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/transactions')>()),
	loadAssetObserverRuntime: async () => ({
		acquireAssetObserverNetwork: () => ({
			ready: Promise.resolve(),
			release: () => undefined,
			network: {
				watch: (id: string) => {
					const watcher = {
						id,
						started: false,
						stopped: false,
						views: () => [],
						consensus: () => undefined,
						on: () => () => undefined,
						start() {
							watcher.started = true;
						},
						stop() {
							watcher.stopped = true;
						},
					};
					mocks.watchers.push(watcher);
					return watcher;
				},
			},
		}),
	}),
}));
vi.mock('features/TransactionSync', async (importOriginal) => ({
	...(await importOriginal<typeof import('features/TransactionSync')>()),
	LazyArweaveTransactionSync: (props: { activeStep?: string; pendingAfterConfirmation?: string }) => (
		<div
			className="transaction-sync"
			data-active-step={props.activeStep}
			data-pending={props.pendingAfterConfirmation}
		/>
	),
}));

const OWNER = 'O'.repeat(43);
const ARTWORK = 'X'.repeat(43);
const ASSET_ID = 'A'.repeat(43);

function upload(overrides: Partial<UploadActivity> = {}): UploadActivity {
	return {
		id: 'upload-1',
		owner: OWNER,
		kind: 'asset',
		name: 'Uploaded art',
		phase: 'working',
		status: 'Uploading artwork…',
		createdAt: 1,
		transactionIds: [],
		transactions: [],
		...overrides,
	};
}

function mint(overrides: Partial<MintActivity> = {}): MintActivity {
	return {
		id: `mint:${OWNER}:${ASSET_ID}`,
		owner: OWNER,
		asset: {
			id: ASSET_ID,
			name: 'Uploaded art',
			description: '',
			contentType: 'image/png',
			image: '',
			mediaId: ASSET_ID,
			owner: OWNER,
			createdAt: 1,
		},
		collectionId: 'created-assets',
		transactionIds: [ARTWORK, ASSET_ID],
		arweaveGateway: 'https://arweave.net',
		computeGateway: 'https://compute.example',
		phase: 'mined',
		status: 'Mined on Arweave. Waiting for live process state.',
		createdAt: 1,
		...overrides,
	} as MintActivity;
}

let root: Root;
let host: HTMLElement;
const onClose = vi.fn();
const onHide = vi.fn();

async function flush(times = 4) {
	for (let index = 0; index < times; index += 1) {
		await React.act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
}

async function render(activity: UploadActivity, relatedMintActivities: MintActivity[] = []) {
	await React.act(async () =>
		root.render(
			<MemoryRouter>
				<UploadActivityPanel
					activity={activity}
					relatedMintActivities={relatedMintActivities}
					visible
					onClose={onClose}
					onHide={onHide}
				/>
			</MemoryRouter>
		)
	);
	await flush();
}

function text() {
	return host.textContent ?? '';
}

async function click(label: string) {
	const target = [...host.querySelectorAll('button')].find((element) => element.textContent?.includes(label));
	if (!target) throw new Error(`missing button ${label}`);
	await React.act(async () => {
		target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
	});
	await flush(1);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.watchers = [];
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
	window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(async () => {
	await React.act(async () => root.unmount());
	host.remove();
});

describe('upload activity panel', () => {
	it('waits for the first signed transaction before showing the network view', async () => {
		await render(upload());

		expect(host.querySelector('.operation-preparing')).not.toBeNull();
		expect(text()).toContain('Uploading artwork…');
		expect(mocks.watchers).toHaveLength(0);
	});

	it('observes every uploaded transaction and reports what is still pending', async () => {
		await render(
			upload({
				phase: 'tracking',
				status: 'Submitted',
				assetId: ASSET_ID,
				transactionIds: [ARTWORK, ASSET_ID],
				transactions: [
					{ id: ARTWORK, label: 'Artwork transaction' },
					{ id: ASSET_ID, label: 'Asset transaction' },
				],
			}),
			[mint()]
		);

		expect(mocks.watchers.map((watcher) => watcher.id)).toEqual([ARTWORK, ASSET_ID]);
		expect(text()).toContain('Mined on Arweave. Waiting for live process state.');
		expect(host.querySelector('.transaction-sync')?.getAttribute('data-pending')).toBe(
			'Waiting for live process state'
		);
		expect(host.querySelector('.mint-transaction-receipts')?.textContent).toContain('Artwork transaction');
	});

	it('shows a finished collection upload and routes to it', async () => {
		await render(
			upload({
				kind: 'collection',
				phase: 'done',
				status: 'Collection process submitted to Arweave.',
				collectionId: 'collection-9',
				transactionIds: [ARTWORK, ASSET_ID],
			})
		);

		expect(host.querySelector('.upload-activity-state.done')).not.toBeNull();
		expect(text()).toContain('Collection submitted');
		expect(host.querySelector('.mint-transaction-receipts')?.textContent).toContain('Collection manifest');
		await click('View collection');
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('keeps a failed upload readable and closable', async () => {
		await render(upload({ phase: 'error', status: 'Upload failed.' }));

		expect(host.querySelector('.upload-activity-state.error')).not.toBeNull();
		expect(text()).toContain('Upload needs attention');
		expect(mocks.watchers).toHaveLength(0);
	});
});
