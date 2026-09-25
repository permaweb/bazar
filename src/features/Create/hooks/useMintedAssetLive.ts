import React from 'react';

/** Fired by the operation activity watcher once a minted asset or token process is readable in live state. */
const MINT_LIVE_EVENT = 'bazar:mint-live';

/**
 * Whether a freshly minted asset or token is live on Bazar. The app-level mint activity watcher polls live process
 * state for every accepted mint and announces completion; this only listens, so it adds no network reads.
 */
export function useMintedAssetLive(assetId: string | null): boolean {
	const [live, setLive] = React.useState(false);
	React.useEffect(() => {
		setLive(false);
		if (!assetId) return;
		const markLive = (event: Event) => {
			if ((event as CustomEvent<{ asset?: { id?: string } }>).detail?.asset?.id === assetId) setLive(true);
		};
		window.addEventListener(MINT_LIVE_EVENT, markLive);
		return () => window.removeEventListener(MINT_LIVE_EVENT, markLive);
	}, [assetId]);
	return live;
}
