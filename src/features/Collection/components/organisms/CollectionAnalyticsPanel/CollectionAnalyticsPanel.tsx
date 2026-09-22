import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, LoaderCircle } from 'lucide-react';

import type { Collection } from 'api/collections';

import { LiveRegion } from 'components/atoms/LiveRegion';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';

import { CollectionLiveListingRow } from '../../../model/collection-market';

export default function CollectionAnalyticsPanel(props: {
	collection: Collection;
	loading: boolean;
	rows: CollectionLiveListingRow[];
}) {
	return (
		<aside className="collection-analytics" aria-label="Collection analytics">
			<div className="collection-analytics-heading">
				<div>
					<span>Market</span>
					<h2>Analytics</h2>
				</div>
				<BarChart3 aria-hidden="true" />
			</div>
			<div className="collection-analytics-tabs">
				<span>Live offers</span>
			</div>
			{props.loading && !props.rows.length ? (
				<div className="collection-analytics-empty">
					<LoaderCircle className="spin" aria-hidden="true" />
					<strong>Checking live offers</strong>
					<p>Reading current asset state through the selected AO transport.</p>
				</div>
			) : props.rows.length ? (
				<div className="collection-orderbook">
					{props.loading ? (
						<LiveRegion>Refreshing live offer depth. Resolved offers remain visible.</LiveRegion>
					) : null}
					<div className="collection-orderbook-head" aria-hidden="true">
						<span>Price</span>
						<span>Quantity</span>
						<span>Total</span>
					</div>
					<ul aria-label="Live offers">
						{props.rows.slice(0, 24).map((row, index) => (
							<li key={`${row.asset.id}:${row.price}:${index}`}>
								<Link
									style={{ '--order-depth': `${row.depth}%` } as React.CSSProperties}
									to={`/asset/${props.collection.id}/${row.asset.id}`}
									title={row.asset.name}
								>
									<span>{row.price}</span>
									<span>{row.quantity}</span>
									<span>{row.total}</span>
									<VisuallyHidden>{Math.round(row.depth)}% cumulative depth</VisuallyHidden>
								</Link>
							</li>
						))}
					</ul>
				</div>
			) : (
				<div className="collection-analytics-empty">
					<strong>No live offers found</strong>
					<p>No indexed offer currently survives live process-state verification.</p>
				</div>
			)}
		</aside>
	);
}
