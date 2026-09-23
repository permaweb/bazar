import { describe, expect, it } from 'vitest';

import type { MintActivity } from 'api/mint';
import type { ObserverView } from 'api/transactions';

import { OPERATIONS_MESSAGES } from 'features/Operations/messages';
import { mintActivityStatusText } from 'features/Operations/model/activity-status';
import {
	isUploadActivityWorking,
	mintUploadActivity,
	standaloneMintActivities,
	uploadActivityDestination,
	uploadActivitySyncSteps,
	uploadActivityView,
	uploadRelatedMintActivities,
} from 'features/Operations/model/upload-activity';
import { formatMessage } from 'helpers/i18n';
import { type UploadActivity } from 'providers/OperationActivityProvider/OperationActivityProvider';

const messages = OPERATIONS_MESSAGES.en;

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

describe('upload activity view', () => {
	it('prefers the tracking mint status and names what is still pending', () => {
		expect(uploadActivityView(upload, [mint], {}, messages)).toMatchObject({
			working: true,
			phase: 'working',
			status: messages.mintStatusMined,
			activeStep: processId,
			pendingAfterConfirmation: 'Waiting for live process state',
		});
		expect(uploadActivityView(upload, [{ ...mint, phase: 'applied' }], {}, messages).pendingAfterConfirmation).toBe(
			'Finishing Bazar indexing'
		);
		expect(uploadActivityView(upload, [], {}, messages).status).toBe(upload.status);
	});

	it('maps each upload stage to its dialog stage', () => {
		expect(uploadActivityView({ ...upload, phase: 'done' }, [], {}, messages)).toMatchObject({
			working: false,
			phase: 'done',
		});
		expect(uploadActivityView({ ...upload, phase: 'error' }, [], {}, messages)).toMatchObject({
			working: false,
			phase: 'error',
		});
		expect(isUploadActivityWorking({ phase: 'working' })).toBe(true);
		expect(isUploadActivityWorking({ phase: 'done' })).toBe(false);
	});

	it('labels receipts from recorded transactions, then from submitted ids', () => {
		expect(uploadActivityView(upload, [], {}, messages).receiptEntries).toEqual([
			{
				label: messages.uploadReceiptAssetTransaction,
				linkLabel: formatMessage(messages.operationReceiptEntryLabel, {
					label: messages.uploadReceiptAssetTransaction,
					transaction: processId,
				}),
				transactionId: processId,
			},
		]);
		const collection: UploadActivity = {
			...upload,
			kind: 'collection',
			transactions: [],
			transactionIds: ['M'.repeat(43), 'C'.repeat(43)],
		};
		expect(uploadActivityView(collection, [], {}, messages).receiptEntries.map((entry) => entry.label)).toEqual([
			'Collection manifest',
			'Collection process',
		]);
		expect(
			uploadActivityView({ ...collection, extended: true }, [], {}, messages).receiptEntries.map(
				(entry) => entry.label
			)
		).toEqual(['Collection manifest', 'Collection update']);
		expect(
			uploadActivityView(
				{ ...upload, transactions: [], transactionIds: ['I'.repeat(43), processId] },
				[],
				{},
				messages
			).receiptEntries.map((entry) => entry.label)
		).toEqual(['Artwork transaction', 'Asset transaction']);
	});

	it('routes to what the upload created', () => {
		expect(uploadActivityDestination(upload)).toBe(`/asset/created-assets/${processId}`);
		expect(uploadActivityDestination({ ...upload, kind: 'collection', collectionId: 'collection-1' })).toBe(
			'/collection/collection-1'
		);
	});
});

describe('upload and mint activity pairing', () => {
	const otherAsset = 'B'.repeat(43);
	const otherMint: MintActivity = {
		...mint,
		id: 'mint-2',
		asset: { ...mint.asset, id: otherAsset },
		transactionIds: [otherAsset],
	};

	it('pairs mint activities with the upload that produced them', () => {
		expect(uploadRelatedMintActivities(upload, [mint, otherMint])).toEqual([mint]);
		expect(
			uploadRelatedMintActivities({ ...upload, assetId: undefined, assetIds: [otherAsset] }, [otherMint])
		).toEqual([otherMint]);
		expect(
			uploadRelatedMintActivities(
				{ ...upload, assetId: undefined, transactions: [{ id: otherAsset, label: 'Asset transaction' }] },
				[otherMint]
			)
		).toEqual([otherMint]);
		expect(uploadRelatedMintActivities({ ...upload, assetId: 'Z'.repeat(43), transactions: [] }, [mint])).toEqual(
			[]
		);
	});

	it('shows restored mint activities that have no upload panel', () => {
		expect(standaloneMintActivities([mint, otherMint], [upload])).toEqual([otherMint]);
		expect(standaloneMintActivities([otherMint], [{ ...upload, assetIds: [otherAsset] }])).toEqual([]);
		expect(mintUploadActivity(otherMint, messages)).toEqual({
			id: 'mint-2',
			owner,
			kind: 'asset',
			name: otherMint.asset.name,
			phase: 'tracking',
			status: mintActivityStatusText(otherMint.phase, messages),
			createdAt: otherMint.createdAt,
			transactionIds: [otherAsset],
			transactions: [{ id: otherAsset, label: 'Asset transaction' }],
			assetId: otherAsset,
			collectionId: otherMint.collectionId,
		});
		expect(
			mintUploadActivity({ ...otherMint, transactionIds: ['A'.repeat(43), otherAsset] }, messages).transactions
		).toEqual([
			{ id: 'A'.repeat(43), label: 'Artwork transaction' },
			{ id: otherAsset, label: 'Asset transaction' },
		]);
	});
});
