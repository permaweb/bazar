import React from 'react';

import type { SwapOrder } from 'api/marketplace';
import type { Operation } from 'api/operations';
import { loadAtomicTransactionRuntime } from 'api/transactions';

import { toAppError } from 'helpers/app-error';
import { type AsyncState, IDLE, LOADING } from 'helpers/async-state';

import type { PurchaseQuote } from '../model/operation-view';

/**
 * Checks the exact cost of a new atomic purchase and the buyer's wallet balance before anything is signed. Each check
 * starts from a clean slate, is cancelled when the order, recovery, or wallet changes, and ignores superseded results.
 * Purchases resuming saved signed work skip the check.
 */
export function usePurchaseQuote(input: { operation: Operation; assetId: string; owner: string }): {
	state: AsyncState<PurchaseQuote>;
	retry(): void;
} {
	const order = input.operation.kind === 'buy' ? input.operation.order : null;
	const resume = input.operation.kind === 'buy' ? input.operation.resume : undefined;
	const orderRef = React.useRef<SwapOrder | null>(order);
	orderRef.current = order;
	const [state, setState] = React.useState<AsyncState<PurchaseQuote>>(IDLE);
	const [attempt, setAttempt] = React.useState(0);
	const orderId = order?.orderId ?? '';

	React.useEffect(() => {
		const quotedOrder = orderRef.current;
		if (!quotedOrder || resume) return;
		const controller = new AbortController();
		setState(LOADING);
		void loadAtomicTransactionRuntime()
			.then(async ({ AssetTransactionClient }) => {
				const client = new AssetTransactionClient();
				return Promise.all([
					client.estimatePurchaseCosts(quotedOrder, input.assetId, controller.signal),
					client.walletBalance(input.owner, controller.signal),
				]);
			})
			.then(
				([estimate, balance]) => {
					if (!controller.signal.aborted) setState({ status: 'success', data: { estimate, balance } });
				},
				(cause) => {
					if (!controller.signal.aborted) setState({ status: 'error', error: toAppError(cause, 'unknown') });
				}
			);
		return () => controller.abort();
	}, [attempt, input.assetId, input.owner, orderId, resume]);

	function retry() {
		if (state.status === 'success' || state.status === 'error') setAttempt((current) => current + 1);
	}

	return { state, retry };
}
