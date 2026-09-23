import { RetryNotice } from 'components/molecules/RetryNotice';

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
	return (
		<>
			{props.listedOnly && props.listingsLoading ? (
				<div className="collection-resolution-status">
					<div>
						<strong>Checking live listings</strong>
						<span>{props.searchProgress}</span>
					</div>
					<div
						aria-label="Searching Arweave for live listings"
						aria-valuetext={props.searchProgress}
						className="resolution-track indeterminate"
						role="progressbar"
					>
						<span />
					</div>
				</div>
			) : null}
			{props.listingsFailed ? <RetryNotice onRetry={props.onRetryListings} /> : null}
			{!props.listedOnly && !props.pricesLoading && (props.pricesFailed || props.unavailablePrices > 0) ? (
				<RetryNotice onRetry={props.onRetryPrices}>
					Compute hasn’t completed yet. Please try again.
					{!props.pricesFailed && props.unavailablePrices
						? ` ${props.unavailablePrices.toLocaleString()} visible ${
								props.unavailablePrices === 1 ? 'price remains' : 'prices remain'
						  } unavailable.`
						: ''}
				</RetryNotice>
			) : null}
			{props.listedOnly && !props.listingsLoading && !props.listingsFailed && props.unavailableListings ? (
				<RetryNotice onRetry={props.onRecheckListings} retrying={props.rechecking}>
					{props.rechecking
						? 'Rechecking only the listing candidates that were unavailable.'
						: 'Compute hasn’t completed yet. Please try again.'}{' '}
					{props.unavailableListings.toLocaleString()} listing{' '}
					{props.unavailableListings === 1 ? 'candidate remains' : 'candidates remain'} unavailable. Resolved
					listings remain visible.
				</RetryNotice>
			) : null}
		</>
	);
}
