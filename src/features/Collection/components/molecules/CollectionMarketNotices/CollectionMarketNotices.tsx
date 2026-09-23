import { RetryNotice } from 'components/molecules/RetryNotice';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';

// Progress of the live-listing pass and the retry controls for a failed pass, unavailable prices, and listing
// candidates whose live state could not be read.
export default function CollectionMarketNotices(props: {
	listedOnly: boolean;
	listingsLoading: boolean;
	listingsFailed: boolean;
	searchProgress: string;
	pricesLoading: boolean;
	pricesFailed: boolean;
	unavailablePrices: number;
	unavailableListings: number;
	rechecking: boolean;
	onRetryListings(): void;
	onRetryPrices(): void;
	onRecheckListings(): void;
}) {
	const language = useMessages(COLLECTION_MESSAGES);
	const plural = usePlural();
	return (
		<>
			{props.listedOnly && props.listingsLoading ? (
				<div className="collection-resolution-status">
					<div>
						<strong>{language.checkingLiveListings}</strong>
						<span>{props.searchProgress}</span>
					</div>
					<div
						aria-label={language.searchingArweaveForLiveListings}
						aria-valuetext={props.searchProgress}
						className="resolution-track indeterminate"
						role="progressbar"
					>
						<span />
					</div>
				</div>
			) : null}
			{props.listingsFailed ? (
				<RetryNotice onRetry={props.onRetryListings} retryLabel={language.retry}>
					{language.computeIncompleteNotice}
				</RetryNotice>
			) : null}
			{!props.listedOnly && !props.pricesLoading && (props.pricesFailed || props.unavailablePrices > 0) ? (
				<RetryNotice onRetry={props.onRetryPrices} retryLabel={language.retry}>
					{!props.pricesFailed && props.unavailablePrices
						? plural(language.pricesUnavailableNotice, props.unavailablePrices, {
								count: props.unavailablePrices.toLocaleString(),
						  })
						: language.computeIncompleteNotice}
				</RetryNotice>
			) : null}
			{props.listedOnly && !props.listingsLoading && !props.listingsFailed && props.unavailableListings ? (
				<RetryNotice onRetry={props.onRecheckListings} retryLabel={language.retry} retrying={props.rechecking}>
					{plural(
						props.rechecking ? language.listingsRecheckingNotice : language.listingsUnavailableNotice,
						props.unavailableListings,
						{ count: props.unavailableListings.toLocaleString() }
					)}
				</RetryNotice>
			) : null}
		</>
	);
}
