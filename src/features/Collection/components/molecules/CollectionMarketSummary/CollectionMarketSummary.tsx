import React from 'react';

import type { Collection } from 'api/collections';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { Eyebrow } from 'components/atoms/Eyebrow';
import { useMessages } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';
import { collectionDescriptionText, collectionIdentity } from '../../../model/collection-market';
import { CollectionDescription } from '../CollectionDescription';

type CollectionMarketStat = {
	label: string;
	value: React.ReactNode;
};

export default function CollectionMarketSummary(props: {
	action?: React.ReactNode;
	collection: Collection;
	stats: CollectionMarketStat[];
}) {
	const language = useMessages(COLLECTION_MESSAGES);
	const identity = collectionIdentity(props.collection, language);
	return (
		<div className="collection-title collection-market-header">
			<div className="collection-identity">
				<div className="collection-avatar" aria-hidden="true">
					{props.collection.assets[0]?.image ? (
						<ArtworkImage
							alt=""
							src={props.collection.assets[0].image}
							loading="eager"
							fetchPriority="high"
							unavailableLabel={language.collectionArtworkUnavailable}
						/>
					) : (
						<span>{identity.monogram}</span>
					)}
				</div>
				<div className="collection-heading-copy">
					<Eyebrow>{identity.eyebrow}</Eyebrow>
					<h1>{identity.name}</h1>
					<CollectionDescription description={collectionDescriptionText(props.collection, language)} />
				</div>
			</div>
			{props.action ? <div className="collection-title-copy">{props.action}</div> : null}
			<div className="collection-market-stats" aria-label={language.collectionSummaryLabel}>
				{props.stats.map((stat) => (
					<div key={stat.label}>
						<span>{stat.label}</span>
						<strong>{stat.value}</strong>
					</div>
				))}
			</div>
		</div>
	);
}
