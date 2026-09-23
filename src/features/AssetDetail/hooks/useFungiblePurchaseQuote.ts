import React from 'react';

import type { SwapOrder } from 'api/marketplace';
import { AssetTransactionClient } from 'api/transactions';

import { toAppError } from 'helpers/app-error';
import { type AsyncState, IDLE, LOADING } from 'helpers/async-state';

import { purchaseQuoteIdentity } from '../model/fungible-batch';

export type FungiblePurchaseQuote = {
	/** Maximum AR cost of every matched lot, in winston, including network fees. */
	total: string;
	walletBalance: string;
	canAfford: boolean;
};

const QUOTE_DEBOUNCE_MS = 250;

/**
 * Quote the maximum cost of a purchase against the buyer's wallet balance. The quote is debounced, restarts when the
 * matched lots change (by value, not identity), and the latest request wins.
 */
export function useFungiblePurchaseQuote(params: {
	assetId: string;
	owner: string;
	orders: SwapOrder[];
	enabled: boolean;
}): { state: AsyncState<FungiblePurchaseQuote>; retry(): void } {
	const [state, setState] = React.useState<AsyncState<FungiblePurchaseQuote>>(IDLE);
	const [attempt, setAttempt] = React.useState(0);
	const ordersRef = React.useRef(params.orders);
	ordersRef.current = params.orders;
	const quoteIdentity = purchaseQuoteIdentity(params.orders);
	const active = params.enabled && params.orders.length > 0;

	React.useEffect(() => {
		if (!active) {
			setState(IDLE);
			return;
		}
		const orders = ordersRef.current;
		const controller = new AbortController();
		const client = new AssetTransactionClient();
		setState(LOADING);
		const quoteTimer = window.setTimeout(() => {
			void Promise.all([
				client.estimatePurchaseBatchCosts(orders, params.assetId, controller.signal),
				client.walletBalance(params.owner, controller.signal),
			])
				.then(([costs, walletBalance]) => {
					if (controller.signal.aborted) return;
					const total = costs.reduce((sum, item) => sum + BigInt(item.total), 0n);
					setState({
						status: 'success',
						data: {
							total: total.toString(),
							walletBalance: walletBalance.toString(),
							canAfford: walletBalance >= total,
						},
					});
				})
				.catch((cause: unknown) => {
					if (!controller.signal.aborted)
						setState({ status: 'error', error: toAppError(cause, 'unavailable') });
				});
		}, QUOTE_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(quoteTimer);
			controller.abort();
		};
	}, [active, attempt, params.assetId, params.owner, quoteIdentity]);

	const retry = React.useCallback(() => setAttempt((value) => value + 1), []);
	return { state, retry };
}
