import type { MintActivity } from 'api/mint';

import type { ArweaveSyncStep } from 'features/TransactionSync';
import { UploadActivity, UploadObserverState } from 'providers/OperationActivityProvider';

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
