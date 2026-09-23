import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

import { Icon } from '../../atoms/Icon';
import { TokenAvatar } from '../../atoms/TokenAvatar';

export type TokenMarketMetric = {
	label: string;
	value: React.ReactNode;
	tone?: 'default' | 'positive' | 'negative' | 'muted';
};

// Compact market row for a fungible token: logo, identity, context, and up to two market metrics.
export default function TokenMarketRow(props: {
	asset: { id: string; name: string; ticker?: string; image?: string };
	collection: { id: string };
	context?: React.ReactNode;
	metric?: TokenMarketMetric;
	secondaryMetric?: TokenMarketMetric;
	badge?: string;
	priority?: boolean;
	tickerFallback: string;
	onFollow?: () => void;
	onWarm?: () => void;
}) {
	const ticker = props.asset.ticker?.trim() || props.tickerFallback;
	return (
		<Link
			className="token-market-row"
			onClick={props.onFollow}
			onFocus={props.onWarm}
			onMouseEnter={props.onWarm}
			onTouchStart={props.onWarm}
			to={`/asset/${props.collection.id}/${props.asset.id}`}
		>
			<span className="token-market-logo">
				<TokenAvatar
					fetchPriority={props.priority ? 'high' : 'auto'}
					image={props.asset.image}
					loading={props.priority ? 'eager' : 'lazy'}
					ticker={ticker}
				/>
			</span>
			<span className="token-market-identity">
				<strong>{props.asset.name}</strong>
				<small>{ticker}</small>
			</span>
			<span className="token-market-context">{props.context ?? props.asset.id}</span>
			{props.secondaryMetric ? <TokenMetric metric={props.secondaryMetric} className="secondary" /> : null}
			{props.metric ? <TokenMetric metric={props.metric} /> : null}
			{props.badge ? <span className="token-market-badge">{props.badge}</span> : null}
			<Icon icon={ArrowUpRight} size="sm" className="token-market-arrow" />
		</Link>
	);
}

function TokenMetric(props: { metric: TokenMarketMetric; className?: string }) {
	return (
		<span className={`token-market-metric ${props.className ?? ''} ${props.metric.tone ?? 'default'}`}>
			<small>{props.metric.label}</small>
			<strong>{props.metric.value}</strong>
		</span>
	);
}
