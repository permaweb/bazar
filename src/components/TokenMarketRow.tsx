import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

import type { AssetSummary, Collection } from 'api/collections';

import { TokenAvatar } from './TokenAvatar';

export type TokenMarketMetric = {
	label: string;
	value: React.ReactNode;
	tone?: 'default' | 'positive' | 'muted';
};

export function TokenMarketRow({
	asset,
	collection,
	context,
	metric,
	secondaryMetric,
	badge,
	priority = false,
	onFollow,
	onWarm,
}: {
	asset: AssetSummary;
	collection: Collection;
	context?: React.ReactNode;
	metric?: TokenMarketMetric;
	secondaryMetric?: TokenMarketMetric;
	badge?: string;
	priority?: boolean;
	onFollow?: () => void;
	onWarm?: () => void;
}) {
	const ticker = asset.ticker?.trim() || 'TOKEN';
	return (
		<Link
			className="token-market-row"
			onClick={onFollow}
			onFocus={onWarm}
			onMouseEnter={onWarm}
			onTouchStart={onWarm}
			to={`/asset/${collection.id}/${asset.id}`}
		>
			<span className="token-market-logo">
				<TokenAvatar
					fetchPriority={priority ? 'high' : 'auto'}
					image={asset.image}
					loading={priority ? 'eager' : 'lazy'}
					ticker={ticker}
				/>
			</span>
			<span className="token-market-identity">
				<strong>{asset.name}</strong>
				<small>{ticker}</small>
			</span>
			<span className="token-market-context">{context ?? asset.id}</span>
			{secondaryMetric ? <TokenMetric metric={secondaryMetric} className="secondary" /> : null}
			{metric ? <TokenMetric metric={metric} /> : null}
			{badge ? <span className="token-market-badge">{badge}</span> : null}
			<ArrowUpRight className="ui-icon ui-icon--sm token-market-arrow" aria-hidden="true" />
		</Link>
	);
}

function TokenMetric({ metric, className = '' }: { metric: TokenMarketMetric; className?: string }) {
	return (
		<span className={`token-market-metric ${className} ${metric.tone ?? 'default'}`}>
			<small>{metric.label}</small>
			<strong>{metric.value}</strong>
		</span>
	);
}
