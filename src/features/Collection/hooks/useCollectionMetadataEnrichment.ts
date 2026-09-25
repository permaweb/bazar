import React from 'react';

import { type Collection, enrichImageCollectionAssetMetadata } from 'api/collections';

import { useMarketProvider } from 'providers/MarketProvider';

/** Enrich an image collection's asset metadata once per manifest and publish the result to the market catalogue. */
export function useCollectionMetadataEnrichment(collection: Collection | undefined): void {
	const market = useMarketProvider();
	const scope =
		collection?.kind === 'images' && collection.manifestId ? `${collection.id}:${collection.manifestId}` : '';
	// The effect is keyed by manifest scope; later catalogue updates of the same manifest must not restart it.
	const target = React.useRef(collection);
	target.current = collection;
	const enrichedScopes = React.useRef(new Set<string>());

	React.useEffect(() => {
		const current = target.current;
		if (!scope || current?.kind !== 'images') return;
		if (enrichedScopes.current.has(scope)) return;
		enrichedScopes.current.add(scope);
		const controller = new AbortController();
		void enrichImageCollectionAssetMetadata(current, controller.signal).then(
			(enriched) => {
				if (!controller.signal.aborted && enriched !== current) market.addCollection(enriched);
			},
			// Enrichment is best-effort: the collection already renders from its catalogue metadata.
			() => undefined
		);
		return () => {
			controller.abort();
			enrichedScopes.current.delete(scope);
		};
	}, [scope, market.addCollection]);
}
