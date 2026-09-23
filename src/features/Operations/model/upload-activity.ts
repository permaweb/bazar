import { CREATED_COLLECTION_ID, type MintActivity } from 'api/mint';

import type { ArweaveSyncStep } from 'features/TransactionSync';
import type { UploadActivity, UploadObserverState } from 'providers/OperationActivityProvider';

export function uploadActivitySyncSteps(
	activity: UploadActivity,
	relatedMintActivities: MintActivity[],
	observerState: UploadObserverState = {}
): ArweaveSyncStep[] {
	return activity.transactions.map((transaction, index) => {
		const mintActivity = relatedMintActivities.find((candidate) =>
			candidate.transactionIds.includes(transaction.id)
		);
		const phase = mintActivity?.phase;
		const confirmed = phase === 'mined' || phase === 'applied' || phase === 'complete';
		const observed = observerState[transaction.id];
		const confirmations = observed?.consensus?.confirmations ?? (confirmed ? 1 : 0);
		return {
			key: transaction.id,
			label: transaction.label,
			target: 1,
			terminal: index === activity.transactions.length - 1,
			confirmations,
			transaction: {
				id: transaction.id,
				views: observed?.views ?? [],
				...(observed?.consensus ? { consensus: observed.consensus } : {}),
			},
			hasError: activity.phase === 'error',
		};
	});
}

export type UploadActivityView = {
	/** Whether the upload is still signing, submitting, or waiting for live process state. */
	working: boolean;
	status: string;
	/** The transaction dialog stage the upload maps to. */
	phase: 'working' | 'done' | 'error';
	syncSteps: ArweaveSyncStep[];
	activeStep: string | undefined;
	pendingAfterConfirmation: string | undefined;
	receiptEntries: Array<{ label: string; transactionId: string }>;
};

/** Whether the upload is still signing, submitting, or waiting for live process state. */
export function isUploadActivityWorking(activity: Pick<UploadActivity, 'phase'>) {
	return activity.phase === 'working' || activity.phase === 'tracking';
}

function uploadReceiptLabel(activity: UploadActivity, index: number) {
	const last = index === activity.transactionIds.length - 1;
	if (activity.kind === 'collection') {
		if (!last) return 'Collection manifest';
		return activity.extended ? 'Collection update' : 'Collection process';
	}
	return last ? 'Asset transaction' : 'Artwork transaction';
}

/** What an upload panel renders, from the upload, the mint activities tracking it, and live observer views. */
export function uploadActivityView(
	activity: UploadActivity,
	relatedMintActivities: MintActivity[],
	observerState: UploadObserverState
): UploadActivityView {
	const primaryMintActivity =
		relatedMintActivities.find((candidate) => candidate.asset.id === activity.assetId) ??
		relatedMintActivities[relatedMintActivities.length - 1];
	const syncSteps = uploadActivitySyncSteps(activity, relatedMintActivities, observerState);
	const activeSyncStep =
		[...syncSteps].reverse().find((step) => (step.confirmations ?? 0) < step.target) ??
		syncSteps[syncSteps.length - 1];
	return {
		working: isUploadActivityWorking(activity),
		status: activity.phase === 'tracking' ? primaryMintActivity?.status ?? activity.status : activity.status,
		phase: activity.phase === 'error' ? 'error' : activity.phase === 'done' ? 'done' : 'working',
		syncSteps,
		activeStep: activeSyncStep?.key,
		pendingAfterConfirmation:
			primaryMintActivity?.phase === 'mined'
				? 'Waiting for live process state'
				: primaryMintActivity?.phase === 'applied'
				? 'Finishing Bazar indexing'
				: undefined,
		receiptEntries: activity.transactions.length
			? activity.transactions.map((transaction) => ({
					label: transaction.label,
					transactionId: transaction.id,
			  }))
			: activity.transactionIds.map((transactionId, index) => ({
					label: uploadReceiptLabel(activity, index),
					transactionId,
			  })),
	};
}

/** The route that shows what an upload created. */
export function uploadActivityDestination(activity: UploadActivity) {
	return activity.kind === 'collection'
		? `/collection/${activity.collectionId}`
		: `/asset/${CREATED_COLLECTION_ID}/${activity.assetId}`;
}

/** The mint activities that track an upload's asset or any of its transactions. */
export function uploadRelatedMintActivities(upload: UploadActivity, mintActivities: MintActivity[]): MintActivity[] {
	return mintActivities.filter(
		(candidate) =>
			candidate.asset.id === upload.assetId ||
			upload.assetIds?.includes(candidate.asset.id) ||
			candidate.transactionIds.some((id) => upload.transactions.some((transaction) => transaction.id === id))
	);
}

/** Mint activities restored without the upload that started them, such as after a reload. */
export function standaloneMintActivities(mintActivities: MintActivity[], uploads: UploadActivity[]): MintActivity[] {
	return mintActivities.filter(
		(activity) =>
			!uploads.some(
				(upload) => upload.assetId === activity.asset.id || upload.assetIds?.includes(activity.asset.id)
			)
	);
}

/** A restored mint activity presented as the asset upload it tracks. */
export function mintUploadActivity(activity: MintActivity): UploadActivity {
	return {
		id: activity.id,
		owner: activity.owner,
		kind: 'asset',
		name: activity.asset.name,
		phase: 'tracking',
		status: activity.status,
		createdAt: activity.createdAt,
		transactionIds: activity.transactionIds,
		transactions: activity.transactionIds.map((id, index) => ({
			id,
			label: index === activity.transactionIds.length - 1 ? 'Asset transaction' : 'Artwork transaction',
		})),
		assetId: activity.asset.id,
		collectionId: activity.collectionId,
	};
}
