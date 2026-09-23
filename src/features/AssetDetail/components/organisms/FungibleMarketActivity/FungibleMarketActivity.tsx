import type { AssetSummary } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { MarketActivityList } from 'features/Activity';

import { activityDetail, fungiblePurchaseActivityAmount } from '../../../model/fungible-operation';

const ACTIVITY_REVEAL_STEP = 8;

export default function FungibleMarketActivity(props: {
	activity: CollectionActivityEvent[];
	asset: AssetSummary;
	collectionId: string;
	error: string | null;
	hasNextPage: boolean;
	limit: number;
	loading: boolean;
	loadingMore: boolean;
	state: AssetState;
	totalCount: number | null;
	onLimitChange(limit: number): void;
	onLoadMore(): void;
	onRetry(): void;
}) {
	const visibleRows = props.activity.slice(0, props.limit);
	const loadedNote =
		props.totalCount === null
			? `${props.activity.length.toLocaleString()} indexed events loaded.`
			: `${props.activity.length.toLocaleString()} of ${props.totalCount.toLocaleString()} indexed events loaded.`;

	return (
		<section className="asset-market-activity" aria-labelledby="fungible-market-activity-title">
			<div className="asset-market-activity-heading">
				<div>
					<h2 id="fungible-market-activity-title">Activity</h2>
					{props.loading ? <span role="status">Refreshing…</span> : null}
				</div>
			</div>
			{props.error ? (
				<RetryNotice onRetry={props.onRetry} retryLabel="Retry history">
					Compute hasn’t completed yet. Please try again.{' '}
					{props.activity.length ? 'Previously loaded events remain visible.' : ''}
				</RetryNotice>
			) : null}
			{visibleRows.length ? (
				<MarketActivityList
					ariaLabel={`${props.asset.name} market activity`}
					collectionId={props.collectionId}
					compact
					describeEvent={(event) => activityDetail(event, props.state)}
					eventAmount={(event) => fungiblePurchaseActivityAmount(event, props.activity, props.state)}
					events={visibleRows}
					loading={props.loading || props.loadingMore}
					reservationState={props.state}
					resolveAsset={() => props.asset}
				/>
			) : null}
			{!props.loading && !props.error && !props.activity.length ? (
				<p className="asset-empty-copy">No indexed market events found.</p>
			) : null}
			{visibleRows.length < props.activity.length ? (
				<div className="asset-market-activity-footer">
					<p className="market-note">{loadedNote}</p>
					<Button
						type="button"
						size="custom"
						onClick={() =>
							props.onLimitChange(Math.min(props.activity.length, props.limit + ACTIVITY_REVEAL_STEP))
						}
					>
						Show{' '}
						{Math.min(ACTIVITY_REVEAL_STEP, props.activity.length - visibleRows.length).toLocaleString()}{' '}
						more
					</Button>
				</div>
			) : props.hasNextPage ? (
				<div className="asset-market-activity-footer">
					<p className="market-note">{loadedNote}</p>
					<Button disabled={props.loadingMore} onClick={props.onLoadMore} size="custom" type="button">
						{props.loadingMore ? 'Loading older activity…' : 'Load older activity'}
					</Button>
				</div>
			) : props.activity.length ? (
				<p className="market-note">{loadedNote}</p>
			) : null}
		</section>
	);
}
