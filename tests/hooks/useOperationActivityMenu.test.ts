import { describe, expect, it } from 'vitest';

import type { MintActivity } from 'api/mint';
import type { FungibleOperationActivitySummary, OperationActivityPhase } from 'api/operations';

import { operationActivityMenuItems } from 'hooks/useOperationActivityMenu';
import type { OperationActivity, UploadActivity } from 'providers/OperationActivityProvider';

const owner = 'O'.repeat(43);
const other = 'X'.repeat(43);
const now = 100_000_000;
/** Older than the 30-minute mint attention threshold. */
const stalledAt = now - 60 * 60 * 1_000;

const isPhaseVisible = (phase: OperationActivityPhase) => phase !== 'approval' && phase !== 'done';

function operation(id: string, phase: OperationActivityPhase, activityOwner = owner): OperationActivity {
	return {
		id,
		owner: activityOwner,
		asset: { id: `${id}-asset`, name: id },
		collectionId: 'collection',
		operation: { kind: 'sell' },
		phase,
		status: { text: 'Working' },
		confirmations: 0,
		confirmationTarget: 5,
		createdAt: 1,
		origin: 'runtime',
		restoreFallback: () => null,
	} as OperationActivity;
}

function fungible(id: string, phase: OperationActivityPhase): FungibleOperationActivitySummary {
	return {
		id,
		asset: { id: `${id}-asset`, name: id },
		collectionId: 'collection',
		owner,
		operationKind: 'buy',
		phase,
		status: { text: 'Working' },
		createdAt: 1,
	} as FungibleOperationActivitySummary;
}

function upload(id: string, phase: UploadActivity['phase'], assetId?: string): UploadActivity {
	return {
		id,
		owner,
		kind: 'asset',
		name: id,
		phase,
		status: 'Uploading',
		createdAt: 1,
		transactionIds: [],
		transactions: [],
		...(assetId ? { assetId } : {}),
	};
}

function mint(id: string, createdAt: number, gateways: { arweave?: string; compute?: string } = {}): MintActivity {
	return {
		id,
		owner,
		asset: {
			id: `${id}-asset`,
			name: id,
			description: '',
			mediaId: 'M'.repeat(43),
			owner,
			createdAt: 1,
		},
		collectionId: 'collection',
		transactionIds: [],
		arweaveGateway: gateways.arweave ?? 'https://arweave.example',
		computeGateway: gateways.compute ?? 'https://compute.example',
		phase: 'accepted',
		status: 'Submitted',
		createdAt,
	} as MintActivity;
}

const context = {
	owner,
	isPhaseVisible,
	now,
	arweaveGateway: 'https://arweave.example',
	computeGateway: 'https://compute.example',
};

describe('operation activity menu items', () => {
	it('shows only the connected wallet’s activity that is not already in a dialog', () => {
		const items = operationActivityMenuItems(
			{
				activities: [
					operation('mine', 'working'),
					operation('approving', 'approval'),
					operation('theirs', 'working', other),
				],
				fungibleActivities: [fungible('fungible', 'working'), fungible('done', 'done')],
				uploadActivities: [upload('upload', 'working'), { ...upload('foreign', 'working'), owner: other }],
				mintActivities: [mint('mint', now)],
			},
			context
		);

		expect(items.operations.map((item) => item.activity.id)).toEqual(['mine']);
		expect(items.fungibleOperations.map((item) => item.activity.id)).toEqual(['fungible']);
		expect(items.uploads.map((activity) => activity.id)).toEqual(['upload']);
		expect(items.mints.map((item) => item.activity.id)).toEqual(['mint']);
		expect(items.activityCount).toBe(4);
	});

	it('labels each operation by kind for the menu row', () => {
		const items = operationActivityMenuItems(
			{
				activities: [operation('mine', 'working')],
				fungibleActivities: [fungible('fungible', 'working')],
				uploadActivities: [],
				mintActivities: [],
			},
			context
		);

		expect(items.operations[0].operationKind).toBe('sell');
		expect(items.fungibleOperations[0].operationKind).toBe('buy');
	});

	it('hides a mint that its own upload row already tracks', () => {
		const items = operationActivityMenuItems(
			{
				activities: [],
				fungibleActivities: [],
				uploadActivities: [upload('upload', 'tracking', 'mint-asset')],
				mintActivities: [mint('mint', now)],
			},
			context
		);

		expect(items.mints).toEqual([]);
		expect(items.activityCount).toBe(1);
		expect(items.workingCount).toBe(1);
	});

	it('counts running work and flags stalled uploads and pinned gateways', () => {
		const items = operationActivityMenuItems(
			{
				activities: [operation('mine', 'working'), operation('waiting', 'form')],
				fungibleActivities: [fungible('fungible', 'working')],
				uploadActivities: [upload('upload', 'tracking'), upload('failed', 'error')],
				mintActivities: [
					mint('fresh', now),
					mint('stalled', stalledAt),
					mint('pinned', now, { compute: 'https://other.example' }),
				],
			},
			context
		);

		expect(items.workingCount).toBe(5);
		expect(items.attentionMintIds).toEqual(['stalled']);
		expect(items.mints.map((item) => item.pinnedGateway)).toEqual([false, false, true]);
	});

	it('shows nothing before a wallet is connected', () => {
		const items = operationActivityMenuItems(
			{
				activities: [operation('mine', 'working')],
				fungibleActivities: [],
				uploadActivities: [upload('upload', 'working')],
				mintActivities: [mint('mint', now)],
			},
			{ ...context, owner: null }
		);

		expect(items).toMatchObject({ activityCount: 0, workingCount: 0, attentionMintIds: [] });
	});
});
