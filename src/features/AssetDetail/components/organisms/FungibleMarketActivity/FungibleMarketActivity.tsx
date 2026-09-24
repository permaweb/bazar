import type { AssetSummary } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { MarketActivityList } from 'features/Activity';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { activityDetail, fungiblePurchaseActivityAmount } from '../../../model/fungible-operation';

import * as S from './styles';

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
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const visibleRows = props.activity.slice(0, props.limit);
	const loadedNote =
		props.totalCount === null
			? formatMessage(messages.fungibleActivityLoaded, {
					loaded: props.activity.length.toLocaleString(),
			  })
			: formatMessage(messages.fungibleActivityLoadedOfTotal, {
					loaded: props.activity.length.toLocaleString(),
					total: props.totalCount.toLocaleString(),
			  });

	return (
		<S.Activity className="asset-market-activity" aria-labelledby="fungible-market-activity-title">
			<S.Heading className="asset-market-activity-heading">
				<div>
					<h2 id="fungible-market-activity-title">{messages.fungibleActivityTitle}</h2>
					{props.loading ? <span role="status">{messages.fungibleActivityRefreshing}</span> : null}
				</div>
			</S.Heading>
			{props.error ? (
				<RetryNotice onRetry={props.onRetry} retryLabel={messages.fungibleActivityRetryLabel}>
					{messages.fungibleActivityRetry}{' '}
					{props.activity.length ? messages.fungibleActivityRetryPrevious : ''}
				</RetryNotice>
			) : null}
			{visibleRows.length ? (
				<MarketActivityList
					ariaLabel={formatMessage(messages.fungibleActivityListLabel, { name: props.asset.name })}
					collectionId={props.collectionId}
					compact
					describeEvent={(event) => activityDetail(event, messages)}
					eventAmount={(event) =>
						fungiblePurchaseActivityAmount(event, props.activity, props.state, messages)
					}
					events={visibleRows}
					loading={props.loading || props.loadingMore}
					reservationState={props.state}
					resolveAsset={() => props.asset}
				/>
			) : null}
			{!props.loading && !props.error && !props.activity.length ? (
				<S.EmptyCopy className="asset-empty-copy">{messages.fungibleActivityEmpty}</S.EmptyCopy>
			) : null}
			{visibleRows.length < props.activity.length ? (
				<S.MarketActivityFooter className="asset-market-activity-footer">
					<S.MarketNote className="market-note">{loadedNote}</S.MarketNote>
					<Button
						type="button"
						size="custom"
						onClick={() =>
							props.onLimitChange(Math.min(props.activity.length, props.limit + ACTIVITY_REVEAL_STEP))
						}
					>
						{formatMessage(messages.fungibleActivityShowMore, {
							count: Math.min(
								ACTIVITY_REVEAL_STEP,
								props.activity.length - visibleRows.length
							).toLocaleString(),
						})}
					</Button>
				</S.MarketActivityFooter>
			) : props.hasNextPage ? (
				<S.MarketActivityFooter className="asset-market-activity-footer">
					<S.MarketNote className="market-note">{loadedNote}</S.MarketNote>
					<Button disabled={props.loadingMore} onClick={props.onLoadMore} size="custom" type="button">
						{props.loadingMore ? messages.fungibleActivityLoadingOlder : messages.fungibleActivityLoadOlder}
					</Button>
				</S.MarketActivityFooter>
			) : props.activity.length ? (
				<S.MarketNote className="market-note">{loadedNote}</S.MarketNote>
			) : null}
		</S.Activity>
	);
}
