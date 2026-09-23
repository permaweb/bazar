// @vitest-environment jsdom
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MintActivity } from 'api/mint';

import { useOperationActivityHost } from 'features/Operations/hooks/useOperationActivityHost';

import { renderHook } from './renderHook';

const mocks = vi.hoisted(() => ({ context: null as any }));

vi.mock('providers/OperationActivityProvider', async (importOriginal) => ({
	...(await importOriginal<typeof import('providers/OperationActivityProvider')>()),
	useOperationActivity: () => mocks.context,
}));

const OWNER = 'O'.repeat(43);
const ASSET_ID = 'A'.repeat(43);
const OTHER_ASSET_ID = 'B'.repeat(43);
const TRANSACTION = 'X'.repeat(43);

function mint(overrides: Partial<MintActivity> = {}): MintActivity {
	return {
		id: `mint:${OWNER}:${ASSET_ID}`,
		owner: OWNER,
		asset: {
			id: ASSET_ID,
			name: 'Minted art',
			description: '',
			contentType: 'image/png',
			image: '',
			mediaId: ASSET_ID,
			owner: OWNER,
			createdAt: 1,
		},
		collectionId: 'created-assets',
		transactionIds: [TRANSACTION, ASSET_ID],
		arweaveGateway: 'https://arweave.net',
		computeGateway: 'https://compute.example',
		phase: 'mined',
		status: 'Mined on Arweave.',
		createdAt: 1,
		...overrides,
	} as MintActivity;
}

function upload(overrides: Record<string, unknown> = {}) {
	return {
		id: 'upload-1',
		owner: OWNER,
		kind: 'asset' as const,
		name: 'Uploaded art',
		phase: 'tracking' as const,
		status: 'Submitted',
		createdAt: 1,
		transactionIds: [TRANSACTION],
		transactions: [{ id: TRANSACTION, label: 'Asset transaction' }],
		assetId: ASSET_ID,
		...overrides,
	};
}

function operationActivity(overrides: Record<string, unknown> = {}) {
	return {
		id: 'activity-1',
		asset: { id: ASSET_ID, name: 'Atomic art' },
		collectionId: 'collection-1',
		owner: OWNER,
		operation: { kind: 'sell' as const },
		phase: 'form' as const,
		status: 'Waiting for details',
		confirmations: 0,
		confirmationTarget: 5,
		createdAt: 1,
		origin: 'runtime' as const,
		restoreFallback: () => null,
		...overrides,
	};
}

const remove = vi.fn();
const hideOperation = vi.fn();
const dismissMintNotice = vi.fn();

function hostHook() {
	return renderHook(
		() => useOperationActivityHost(),
		undefined,
		(children) => <MemoryRouter>{children}</MemoryRouter>
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.context = {
		activities: [operationActivity()],
		mintActivities: [
			mint(),
			mint({
				id: 'mint-2',
				asset: { ...mint().asset, id: OTHER_ASSET_ID },
				transactionIds: [OTHER_ASSET_ID],
			}),
		],
		uploadActivities: [upload()],
		activeId: 'activity-1',
		activeUploadId: null,
		activeMintId: null,
		mintNotice: mint(),
		update: vi.fn(),
		updateOperation: vi.fn(),
		hideOperation,
		hideUpload: vi.fn(),
		hideMint: vi.fn(),
		remove,
		removeUpload: vi.fn(),
		dismissMintNotice,
	};
});

describe('operation activity host', () => {
	it('pairs uploads with their mint activities and keeps restored mints separate', () => {
		const hook = hostHook();

		expect(hook.result.current.uploads).toHaveLength(1);
		expect(hook.result.current.uploads[0].relatedMintActivities.map((activity) => activity.id)).toEqual([
			`mint:${OWNER}:${ASSET_ID}`,
		]);
		expect(hook.result.current.mintUploads).toHaveLength(1);
		expect(hook.result.current.mintUploads[0].activity).toMatchObject({
			id: 'mint-2',
			kind: 'asset',
			phase: 'tracking',
			assetId: OTHER_ASSET_ID,
		});
		hook.unmount();
	});

	it('keeps the restored mint panel stable across unrelated renders', () => {
		const hook = hostHook();
		const first = hook.result.current.mintUploads[0].activity;
		hook.rerender(undefined);

		expect(hook.result.current.mintUploads[0].activity).toBe(first);
		expect(hook.result.current.mintUploads[0].activity.transactions).toBe(first.transactions);
		hook.unmount();
	});

	it('refreshes the asset when an operation closes, and keeps it open to resume later', () => {
		const hook = hostHook();
		const activity = mocks.context.activities[0];
		const refreshed: unknown[] = [];
		const listener = (event: Event) => refreshed.push((event as CustomEvent<string>).detail);
		window.addEventListener('bazar:asset-operation-finished', listener);

		hook.act(() => hook.result.current.closeOperation(activity, false, true));
		expect(refreshed).toEqual([ASSET_ID]);
		expect(remove).toHaveBeenCalledWith('activity-1');

		hook.act(() => hook.result.current.closeOperation(activity, true, false));
		expect(refreshed).toEqual([ASSET_ID]);
		expect(hideOperation).toHaveBeenCalledTimes(1);

		window.removeEventListener('bazar:asset-operation-finished', listener);
		hook.unmount();
	});

	it('dismisses the mint notice when its asset is opened', () => {
		const hook = hostHook();
		hook.act(() => hook.result.current.viewMintNoticeAsset());

		expect(dismissMintNotice).toHaveBeenCalledTimes(1);
		hook.unmount();
	});

	it('removes an operation activity when its asset is opened', () => {
		const hook = hostHook();
		hook.act(() => hook.result.current.viewOperationAsset(mocks.context.activities[0]));

		expect(remove).toHaveBeenCalledWith('activity-1');
		hook.unmount();
	});
});
