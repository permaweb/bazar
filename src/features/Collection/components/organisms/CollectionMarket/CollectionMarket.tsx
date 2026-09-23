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
import { formatMessage } from 'helpers/i18n';
import { assetGroupRevealComplete, retainedAssetGroupLimit } from 'helpers/progressive-assets';
import { useProgressiveAssetPageSize } from 'hooks/useProgressiveAssetPageSize';
import { useProgressiveReveal } from 'hooks/useProgressiveReveal';
import { useMessages, usePlural } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';

import { useCollectionAppend } from '../../../hooks/useCollectionAppend';
import { useCollectionMarket } from '../../../hooks/useCollectionMarket';
import { useCollectionMetadataEnrichment } from '../../../hooks/useCollectionMetadataEnrichment';
import { useCollectionMoreRecords } from '../../../hooks/useCollectionMoreRecords';
import { COLLECTION_MESSAGES } from '../../../messages';
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
	const language = useMessages(COLLECTION_MESSAGES);
	const plural = usePlural();
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
			<RouteState
				title={language.collectionRouteTitle}
				backLabel={language.backAllCollections}
				eyebrow={language.collectionRouteEyebrow}
			>
				<Loading label={language.readingCollectionIndex} />
			</RouteState>
		);
	if (!collection && market.error)
		return (
			<RouteState
				title={language.collectionUnavailableTitle}
				backLabel={language.backAllCollections}
				eyebrow={language.collectionRouteEyebrow}
			>
				<ErrorPanel
					heading={language.collectionErrorHeading}
					message={market.error}
					retryAction={{ label: language.retry, onClick: market.retry }}
				/>
			</RouteState>
		);
	if (!collection)
		return (
			<RouteState
				title={language.collectionNotFoundTitle}
				backLabel={language.backAllCollections}
				eyebrow={language.collectionRouteEyebrow}
			>
				<ErrorPanel heading={language.collectionErrorHeading} message={language.collectionNotFoundDetail} />
			</RouteState>
		);
	const compactTokenCollection =
		collection.kind === 'tokens' && collection.assets.length === 1 && !collection.hasMore;
	const pagedTokenScope = collection.kind === 'tokens' && collection.hasMore;
	const loadedTokens = pagedTokenScope ? collection.assets.length : null;
	const visibleAssets = filtered.slice(0, limit);
	const visibleUnavailablePrices = collectionUnavailablePriceCount(visibleAssets, listings.prices);
	const listingSearchDetail = collectionListingSearchProgress(listings.progress, loadedTokens, language, plural);
	const resultSummary = collectionResultSummary(
		{
			collection,
			loading: listings.loading,
			listedOnly,
			listedCount: listings.listed.length,
			offerCount: listings.liveRows.length,
			query,
			initial,
			matchCount: filtered.length,
			failures: listings.progress.failures,
		},
		language,
		plural
	);
	const resultAnnouncement = collectionResultAnnouncement(
		{
			collection,
			loading: listings.loading,
			listedOnly,
			searchProgress: collectionListingSearchProgress(
				{
					...listings.progress,
					resolved: listings.announcedProgress.resolved,
					failures: listings.announcedProgress.failures,
				},
				loadedTokens,
				language,
				plural
			),
			pricesLoading: listings.pricesLoading,
			visiblePriceCount: visibleAssets.length,
			query,
			matchCount: filtered.length,
			summary: resultSummary,
		},
		language
	);
	const moreAdded = asyncData(more.state) ?? 0;
	const revealComplete = filtered.length > pageSize && limit >= filtered.length;
	return (
		<section className={`collection-page collection-marketplace-page view-${viewMode}`}>
			<Link className="back" to="/">
				<Icon icon={ArrowLeft} size="sm" />{' '}
				{collection.kind === 'tokens' ? language.backDiscover : language.backAllCollections}
			</Link>
			<div className="collection-market-navigation">
				<CollectionMarketSummary
					action={
						append.canAppend ? (
							<Button onClick={append.openDialog} ref={appendTrigger} type="button" variant="neutral">
								<Images aria-hidden="true" /> {language.appendOpen}
							</Button>
						) : undefined
					}
					collection={collection}
					stats={[
						{
							label: language.statFloorPrice,
							value:
								listings.loading && !listings.liveRows.length
									? language.statChecking
									: listings.liveRows[0]?.price ?? '—',
						},
						{
							label: language.statLiveOffers,
							value:
								listings.loading && !listings.liveRows.length
									? language.statChecking
									: listings.liveRows.length.toLocaleString(),
						},
						{
							label: language.statLoadedSupply,
							value: formatMessage(language.loadedSupplyValue, {
								loaded: collection.assets.length.toLocaleString(),
								total: (collection.total ?? collection.assets.length).toLocaleString(),
							}),
						},
						{ label: language.statOfferCandidates, value: listings.candidates.length.toLocaleString() },
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
						{formatMessage(language.pagedTokenScopeNotice, {
							loaded: collection.assets.length.toLocaleString(),
							total: (collection.total ?? collection.assets.length).toLocaleString(),
						})}
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
				className={revealComplete ? 'collection-result-count reveal-complete' : 'sr-only'}
				aria-live="polite"
				ref={resultSummaryRef}
				role="status"
				tabIndex={-1}
			>
				{revealComplete
					? formatMessage(
							collection.hasMore
								? collection.kind === 'names'
									? language.allLoadedNamesShown
									: language.allLoadedAssetsShown
								: collection.kind === 'names'
								? language.allNamesShown
								: language.allAssetsShown,
							{ count: filtered.length.toLocaleString() }
					  )
					: formatMessage(collection.kind === 'names' ? language.showingNames : language.showingAssets, {
							shown: Math.min(limit, filtered.length).toLocaleString(),
							total: filtered.length.toLocaleString(),
					  })}
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
					retryLabel={language.retry}
					tabIndex={-1}
					onRetry={() => {
						more.loadMore();
						focusCollectionStatus();
					}}
				>
					{language.computeIncompleteNotice}
				</RetryNotice>
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
						? plural(
								collection.kind === 'tokens' ? language.moreTokensLoaded : language.moreNamesLoaded,
								moreAdded,
								{ count: moreAdded.toLocaleString() }
						  )
						: collection.kind === 'tokens'
						? collection.hasMore
							? language.noMoreTokensRemaining
							: language.noMoreTokensComplete
						: collection.hasMore
						? language.noMoreNamesRemaining
						: language.noMoreNamesComplete}
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
					{formatMessage(collection.kind === 'names' ? language.showMoreNames : language.showMoreAssets, {
						count: Math.min(pageSize, filtered.length - limit).toLocaleString(),
					})}
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
						? collection.kind !== 'tokens'
							? language.checkingCarrierRecords
							: query
							? language.searchingTokenRecords
							: language.checkingTokenRecords
						: collection.kind !== 'tokens'
						? language.checkNextCarrierRecords
						: query
						? language.searchNextTokenRecords
						: language.checkNextTokenRecords}
				</Button>
			) : null}
			<CollectionAnalyticsPanel collection={collection} loading={listings.loading} rows={listings.liveRows} />
		</section>
	);
}
