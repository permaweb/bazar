import React from 'react';

import type { Collection } from 'api/collections';

import { type AsyncState, IDLE, LOADING } from 'helpers/async-state';
import { useMarketProvider } from 'providers/MarketProvider';

import { collectionIndexFailure } from '../model/collection-market';

export type CollectionMoreRecords = {
	/** The latest request for the next page of carrier or token records; its data is how many records it added. */
	state: AsyncState<number>;
	/** Request the next page unless one is already loading. Returns whether a request started. */
	loadMore(): boolean;
};

/** Page further carrier-name or token records into the market catalogue, one request at a time. */
export function useCollectionMoreRecords(
	collectionId: string,
	collection: Collection | undefined,
	gateway: string
): CollectionMoreRecords {
	const market = useMarketProvider();
	const [state, setState] = React.useState<AsyncState<number>>(IDLE);
	const controllerRef = React.useRef<AbortController>();
	const loadingRef = React.useRef(false);

	React.useEffect(() => {
		controllerRef.current?.abort();
		loadingRef.current = false;
		setState(IDLE);
		return () => controllerRef.current?.abort();
	}, [collectionId, gateway]);

	const loadMore = (): boolean => {
		if (!collection || loadingRef.current) return false;
		loadingRef.current = true;
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;
		setState(LOADING);
		void (async () => {
			try {
				const added = await market.loadMore(collection.id, controller.signal);
				if (!controller.signal.aborted) setState({ status: 'success', data: added });
			} catch (cause) {
				if (!controller.signal.aborted) setState({ status: 'error', error: collectionIndexFailure(cause) });
			} finally {
				if (controllerRef.current === controller) loadingRef.current = false;
			}
		})();
		return true;
	};

	return { state, loadMore };
}
