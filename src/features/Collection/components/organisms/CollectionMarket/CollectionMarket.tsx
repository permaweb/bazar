import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Images } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { RouteState } from 'components/molecules/RouteState';
import { asyncData, asyncError } from 'helpers/async-state';
import { assetGroupRevealComplete, retainedAssetGroupLimit } from 'helpers/progressive-assets';
import { useProgressiveAssetPageSize } from 'hooks/useProgressiveAssetPageSize';
import { useProgressiveReveal } from 'hooks/useProgressiveReveal';
import { useMarketProvider } from 'providers/MarketProvider';

import { useCollectionAppend } from '../../../hooks/useCollectionAppend';
import { useCollectionMarket } from '../../../hooks/useCollectionMarket';
import { useCollectionMetadataEnrichment } from '../../../hooks/useCollectionMetadataEnrichment';
import { useCollectionMoreRecords } from '../../../hooks/useCollectionMoreRecords';
import {
	collectionDefaultsToListed,
	type CollectionSort,
	collectionUnavailablePriceCount,
	type CollectionViewMode,
} from '../../../model/collection-market';
import {
	collectionListingSearchProgress,
	collectionResultAnnouncement,
	collectionResultSummary,
} from '../../../model/collection-market-summary';
import { CollectionAlphabetFilter } from '../../molecules/CollectionAlphabetFilter';
import { CollectionAssetResults } from '../../molecules/CollectionAssetResults';
import { CollectionIndexNotice } from '../../molecules/CollectionIndexNotice';
import { CollectionMarketEmptyState } from '../../molecules/CollectionMarketEmptyState';
import { CollectionMarketNotices } from '../../molecules/CollectionMarketNotices';
import { CollectionMarketSummary } from '../../molecules/CollectionMarketSummary';
import { CollectionMarketTools } from '../../molecules/CollectionMarketTools';
import { CollectionTabs } from '../../molecules/CollectionTabs';
import { CollectionAnalyticsPanel } from '../CollectionAnalyticsPanel';
import { CollectionAppendDialog } from '../CollectionAppendDialog';

export default function CollectionMarket() {
	const { collectionId = '' } = useParams();
	const { search } = useLocation();
	const market = useMarketProvider();
	const collection = market.collections.find((item) => item.id === collectionId);
	useCollectionMetadataEnrichment(collection);
	const append = useCollectionAppend(collectionId, collection);
	const appendTrigger = React.useRef<HTMLButtonElement>(null);
	const moreContinuationRef = React.useRef<HTMLButtonElement>(null);
	const moreOutcomeRef = React.useRef<HTMLElement | null>(null);
	const restoreMoreFocus = React.useRef(false);
	const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
	const collectionStatusRef = React.useRef<HTMLSpanElement>(null);
	const routedQuery = new URLSearchParams(search).get('q') ?? '';
	const routedOffers = new URLSearchParams(search).get('view') === 'offers';
	const [query, setQuery] = React.useState(routedQuery);
	const deferredQuery = React.useDeferredValue(query);
	const pageSize = useProgressiveAssetPageSize();
	const pageSizeRef = React.useRef(pageSize);
	pageSizeRef.current = pageSize;
	const [limit, setLimit] = React.useState(pageSize);
	const [listedOnly, setListedOnly] = React.useState(() => routedOffers || collectionDefaultsToListed(collectionId));
	const [sort, setSort] = React.useState<CollectionSort>('recent');
	const [viewMode, setViewMode] = React.useState<CollectionViewMode>('compact');
	const [initial, setInitial] = React.useState<string>('all');
	const [alphabetFocus, setAlphabetFocus] = React.useState<string>('all');
	const listings = useCollectionMarket({ collection, listedOnly, query: deferredQuery, initial, sort, limit });
	const more = useCollectionMoreRecords(collectionId, collection, listings.gateway);
	const moreStatus = more.state.status;
	const assetGridId = React.useId();
	const resultSummaryId = React.useId();
	const filtered = listings.assets;
	const filteredCountRef = React.useRef(filtered.length);
	filteredCountRef.current = filtered.length;
	const revealNextAssetPage = React.useCallback(
		() => setLimit((current) => Math.min(filteredCountRef.current, current + pageSize)),
		[pageSize]
	);
	const progressiveRevealRef = useProgressiveReveal(limit < filtered.length, revealNextAssetPage);

	React.useEffect(() => setQuery(routedQuery), [routedQuery]);
	React.useEffect(() => {
		restoreMoreFocus.current = false;
	}, [collectionId, listings.gateway]);
	React.useEffect(() => {
		if (moreStatus === 'loading' || !restoreMoreFocus.current) return;
		restoreMoreFocus.current = false;
		window.requestAnimationFrame(() => {
			const target = moreContinuationRef.current ?? moreOutcomeRef.current;
			if (target?.isConnected && document.activeElement !== target) {
				target.focus({ preventScroll: true });
			}
		});
	}, [filtered.length, limit, moreStatus]);
	// A new filter starts from the first page at the current page size.
	React.useEffect(() => setLimit(pageSizeRef.current), [initial, listedOnly, query]);
	React.useEffect(() => setLimit((current) => retainedAssetGroupLimit(current, pageSize)), [pageSize]);

	const focusCollectionStatus = () => window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
	const handleClearFilters = () => {
		setQuery('');
		setInitial('all');
		setAlphabetFocus('all');
		focusCollectionStatus();
	};

	if (!collection && market.loading)
		return (
			<RouteState title="Collection">
				<Loading label="Reading collection index…" />
			</RouteState>
		);
	if (!collection && market.error)
		return (
			<RouteState title="Collection unavailable">
				<ErrorPanel message={market.error} onRetry={market.retry} />
			</RouteState>
		);
	if (!collection)
		return (
			<RouteState title="Collection not found">
				<ErrorPanel message="This collection could not be found on Arweave." />
			</RouteState>
		);
	const compactTokenCollection =
		collection.kind === 'tokens' && collection.assets.length === 1 && !collection.hasMore;
	const pagedTokenScope = collection.kind === 'tokens' && collection.hasMore;
	const loadedTokens = pagedTokenScope ? collection.assets.length : null;
	const visibleAssets = filtered.slice(0, limit);
	const visibleUnavailablePrices = collectionUnavailablePriceCount(visibleAssets, listings.prices);
	const listingSearchDetail = collectionListingSearchProgress(listings.progress, loadedTokens);
	const resultSummary = collectionResultSummary({
		collection,
		loading: listings.loading,
		listedOnly,
		listedCount: listings.listed.length,
		offerCount: listings.liveRows.length,
		query,
		initial,
		matchCount: filtered.length,
		failures: listings.progress.failures,
	});
	const resultAnnouncement = collectionResultAnnouncement({
		collection,
		loading: listings.loading,
		listedOnly,
		searchProgress: collectionListingSearchProgress(
			{
				...listings.progress,
				resolved: listings.announcedProgress.resolved,
				failures: listings.announcedProgress.failures,
			},
			loadedTokens
		),
		pricesLoading: listings.pricesLoading,
		visiblePriceCount: visibleAssets.length,
		query,
		matchCount: filtered.length,
		summary: resultSummary,
	});
	const moreAdded = asyncData(more.state) ?? 0;
	return (
		<section className={`collection-page collection-marketplace-page view-${viewMode}`}>
			<Link className="back" to="/">
				<Icon icon={ArrowLeft} size="sm" /> {collection.kind === 'tokens' ? 'Discover' : 'All collections'}
			</Link>
			<div className="collection-market-navigation">
				<CollectionMarketSummary
					action={
						append.canAppend ? (
							<Button onClick={append.openDialog} ref={appendTrigger} type="button" variant="neutral">
								<Images aria-hidden="true" /> Add assets
							</Button>
						) : undefined
					}
					collection={collection}
					stats={[
						{
							label: 'Floor price',
							value:
								listings.loading && !listings.liveRows.length
									? 'Checking…'
									: listings.liveRows[0]?.price ?? '—',
						},
						{
							label: 'Live offers',
							value:
								listings.loading && !listings.liveRows.length
									? 'Checking…'
									: listings.liveRows.length.toLocaleString(),
						},
						{
							label: 'Loaded / supply',
							value: `${collection.assets.length.toLocaleString()} / ${(
								collection.total ?? collection.assets.length
							).toLocaleString()}`,
						},
						{ label: 'Offer candidates', value: listings.candidates.length.toLocaleString() },
					]}
				/>
				<CollectionTabs
					collection={collection}
					active={listedOnly ? 'offers' : 'assets'}
					onSelectAssets={() => setListedOnly(false)}
					onSelectOffers={() => setListedOnly(true)}
				/>
			</div>
			<CollectionAppendDialog
				collectionName={collection.name}
				error={append.error}
				estimate={append.estimate}
				estimating={append.estimating}
				fileCount={append.fileCount}
				onClose={append.close}
				onSelectFiles={append.selectFiles}
				onSubmit={append.submit}
				open={append.open}
				previews={append.previews}
				progress={append.progress}
				restoreTarget={() => appendTrigger.current}
				submitting={append.submitting}
			/>
			<CollectionIndexNotice collection={collection} checking={market.loading} onRetry={market.retry} />
			{pagedTokenScope ? (
				<div className="collection-source-notice" role="status">
					<span>
						Browsing {collection.assets.length.toLocaleString()} of{' '}
						{(collection.total ?? collection.assets.length).toLocaleString()} discovered tokens. Prices,
						listings, and recent activity cover the loaded records.
					</span>
				</div>
			) : null}
			{collection.kind === 'names' ? (
				<CollectionAlphabetFilter
					focus={alphabetFocus}
					initial={initial}
					onFocusChange={setAlphabetFocus}
					onSelect={setInitial}
				/>
			) : null}
			<CollectionMarketTools
				announcement={resultAnnouncement}
				collectionName={collection.name}
				compact={compactTokenCollection}
				gridId={assetGridId}
				listedOnly={listedOnly}
				onListedOnlyChange={setListedOnly}
				onQueryChange={setQuery}
				onSortChange={setSort}
				onViewModeChange={setViewMode}
				query={query}
				sort={sort}
				statusRef={collectionStatusRef}
				summary={resultSummary}
				summaryId={resultSummaryId}
				viewMode={viewMode}
			/>
			<CollectionMarketNotices
				listedOnly={listedOnly}
				listingsFailed={listings.failed}
				listingsLoading={listings.loading}
				onRecheckListings={() => {
					listings.recheckUnavailableListings();
					focusCollectionStatus();
				}}
				onRetryListings={() => {
					listings.retryListings();
					focusCollectionStatus();
				}}
				onRetryPrices={() => {
					listings.retryPrices();
					focusCollectionStatus();
				}}
				pricesFailed={listings.pricesFailed}
				pricesLoading={listings.pricesLoading}
				rechecking={listings.rechecking}
				searchProgress={listingSearchDetail}
				unavailableListings={listings.progress.failures}
				unavailablePrices={visibleUnavailablePrices}
			/>
			<CollectionAssetResults
				assets={visibleAssets}
				collection={collection}
				gridId={assetGridId}
				listedOnly={listedOnly}
				onWarmToken={listings.warmToken}
				prices={listings.prices}
				pricesFailed={listings.pricesFailed}
				summaryId={resultSummaryId}
			/>
			<p
				className={
					filtered.length > pageSize && limit >= filtered.length
						? 'collection-result-count reveal-complete'
						: 'sr-only'
				}
				aria-live="polite"
				ref={resultSummaryRef}
				role="status"
				tabIndex={-1}
			>
				{filtered.length > pageSize && limit >= filtered.length
					? `All ${filtered.length.toLocaleString()} ${
							collection.hasMore
								? `currently loaded ${collection.kind === 'names' ? 'names' : 'assets'}`
								: collection.kind === 'names'
								? 'names'
								: 'assets'
					  } are shown.`
					: `Showing ${Math.min(
							limit,
							filtered.length
					  ).toLocaleString()} of ${filtered.length.toLocaleString()} ${
							collection.kind === 'names' ? 'names' : 'assets'
					  }.`}
			</p>
			<CollectionMarketEmptyState
				candidates={listings.progress.total}
				collection={collection}
				failures={listings.progress.failures}
				gateway={listings.gateway}
				initial={initial}
				listedOnly={listedOnly}
				listingsSettled={!listings.loading && !listings.failed}
				matchCount={filtered.length}
				onClearFilters={handleClearFilters}
				query={query}
			/>
			{asyncError(more.state) ? (
				<RetryNotice
					ref={(node) => {
						moreOutcomeRef.current = node;
					}}
					tabIndex={-1}
					onRetry={() => {
						more.loadMore();
						focusCollectionStatus();
					}}
				/>
			) : null}
			{moreStatus === 'success' ? (
				<p
					className={moreAdded && collection.hasMore ? 'sr-only' : 'collection-result-count'}
					aria-live="polite"
					ref={(node) => {
						moreOutcomeRef.current = node;
					}}
					role="status"
					tabIndex={-1}
				>
					{moreAdded
						? `${moreAdded.toLocaleString()} more ${
								collection.kind === 'tokens'
									? moreAdded === 1
										? 'token'
										: 'tokens'
									: `current ${moreAdded === 1 ? 'name' : 'names'}`
						  } loaded.`
						: collection.kind === 'tokens'
						? `No additional tokens were found in that page. ${
								collection.hasMore
									? 'More token records remain.'
									: 'The token index is now fully checked.'
						  }`
						: `No additional current names were found in that page. ${
								collection.hasMore
									? 'More carrier records remain.'
									: 'The carrier index is now fully checked.'
						  }`}
				</p>
			) : null}
			{limit < filtered.length ? (
				<span aria-hidden="true" className="progressive-reveal-sentinel" ref={progressiveRevealRef} />
			) : null}
			{limit < filtered.length ? (
				<Button
					aria-controls={assetGridId}
					className="load-more"
					ref={moreContinuationRef}
					size="custom"
					type="button"
					onClick={() => {
						const nextLimit = Math.min(filtered.length, limit + pageSize);
						setLimit(nextLimit);
						window.requestAnimationFrame(() => {
							if (assetGroupRevealComplete(nextLimit, filteredCountRef.current)) {
								resultSummaryRef.current?.focus();
							}
						});
					}}
				>
					Show {Math.min(pageSize, filtered.length - limit).toLocaleString()} more{' '}
					{collection.kind === 'names' ? 'names' : 'assets'}
				</Button>
			) : collection.hasMore &&
			  (collection.kind === 'tokens' || (!listedOnly && !query)) &&
			  !asyncError(more.state) ? (
				<Button
					aria-busy={moreStatus === 'loading'}
					aria-disabled={moreStatus === 'loading'}
					className="load-more"
					size="custom"
					onBlur={(event) => {
						if (moreStatus === 'loading' && event.relatedTarget) restoreMoreFocus.current = false;
					}}
					onClick={() => {
						if (more.loadMore()) restoreMoreFocus.current = true;
					}}
					ref={moreContinuationRef}
					type="button"
				>
					{moreStatus === 'loading'
						? `${collection.kind === 'tokens' && query ? 'Searching' : 'Checking'} ${
								collection.kind === 'tokens' ? 'token' : 'carrier'
						  } records…`
						: `${collection.kind === 'tokens' && query ? 'Search' : 'Check'} next 100 ${
								collection.kind === 'tokens' ? 'token' : 'carrier'
						  } records`}
				</Button>
			) : null}
			<CollectionAnalyticsPanel collection={collection} loading={listings.loading} rows={listings.liveRows} />
		</section>
	);
}
