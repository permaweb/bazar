import React from 'react';

import { type Collection, collectionDisplayName, collectionEyebrow } from 'api/collections';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { Eyebrow } from 'components/atoms/Eyebrow';

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
						/>
					) : (
						<span>{collectionDisplayName(props.collection).slice(0, 1)}</span>
					)}
				</div>
				<div className="collection-heading-copy">
					<Eyebrow>{collectionEyebrow(props.collection)}</Eyebrow>
					<h1>{collectionDisplayName(props.collection)}</h1>
					<CollectionDescription description={props.collection.description} />
				</div>
			</div>
			{props.action ? <div className="collection-title-copy">{props.action}</div> : null}
			<div className="collection-market-stats" aria-label="Collection summary">
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
