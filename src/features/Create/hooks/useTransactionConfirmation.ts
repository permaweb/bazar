import React from 'react';

import { confirmTransactionId, type Consensus, type ObserverView } from 'api/transactions';

export type TransactionConfirmation = {
	views: ObserverView[];
	consensus: Consensus | null;
	confirmations: number;
};

/** Watches a submitted transaction across independent Arweave observers until it reaches `target` confirmations. */
export function useTransactionConfirmation(transactionId: string | null, target: number): TransactionConfirmation {
	const [views, setViews] = React.useState<ObserverView[]>([]);
	const [consensus, setConsensus] = React.useState<Consensus | null>(null);
	const [confirmations, setConfirmations] = React.useState(0);

	React.useEffect(() => {
		setViews([]);
		setConsensus(null);
		setConfirmations(0);
		if (!transactionId) return;
		const controller = new AbortController();
		void confirmTransactionId(transactionId, {
			signal: controller.signal,
			target,
			onViews: setViews,
			onConsensus: setConsensus,
			onProgress: (progress) => setConfirmations(progress.confirmations),
		})
			.then(() => {
				if (!controller.signal.aborted) setConfirmations(target);
			})
			// Observation is best effort: the progress already shown stays, and the mint result is unaffected.
			.catch(() => undefined);
		return () => controller.abort();
	}, [transactionId, target]);

	return { views, consensus, confirmations };
}
