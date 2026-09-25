import React from 'react';

import { discoverCollectionActivity } from 'api/discovery';

import { HOME_TOKEN_PRICE_EVENT_LIMIT, type HomeTokenPriceChange, homeTokenPriceChanges } from '../model/home-market';

/**
 * 24-hour ask changes for the visible token rows, from one index read of their recent listings. A missing entry is
 * still loading; `'unavailable'` means the read failed. Changing the visible tokens or the network scope restarts it.
 */
export function useHomeTokenPriceChanges(options: {
	active: boolean;
	tokenKey: string;
	scope: string;
}): Record<string, HomeTokenPriceChange> {
	const [changes, setChanges] = React.useState<Record<string, HomeTokenPriceChange>>({});

	React.useEffect(() => {
		if (!options.active || !options.tokenKey) {
			setChanges({});
			return;
		}
		const controller = new AbortController();
		const tokenIds = options.tokenKey.split(',');
		setChanges({});
		void discoverCollectionActivity({
			actions: ['make-offer'],
			limit: HOME_TOKEN_PRICE_EVENT_LIMIT,
			recipients: tokenIds,
			signal: controller.signal,
		}).then(
			(events) => {
				if (controller.signal.aborted) return;
				setChanges(homeTokenPriceChanges(tokenIds, events, Date.now()));
			},
			() => {
				if (!controller.signal.aborted) {
					setChanges(Object.fromEntries(tokenIds.map((tokenId) => [tokenId, 'unavailable'])));
				}
			}
		);
		return () => controller.abort();
	}, [options.active, options.scope, options.tokenKey]);

	return changes;
}
