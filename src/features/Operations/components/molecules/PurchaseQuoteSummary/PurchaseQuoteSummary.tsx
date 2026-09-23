import { RefreshCw } from 'lucide-react';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { WalletAddress } from 'components/organisms/WalletAddress';

import type { PurchaseQuoteView } from '../../../model/operation-view';

// The seller price, network fees, maximum total, and remaining balance of a new purchase, with a cost re-check.
export default function PurchaseQuoteSummary(props: {
	seller: string;
	sellerPrice: string;
	quote: PurchaseQuoteView;
	statusId: string;
	onRetry(): void;
}) {
	const quote = props.quote;
	return (
		<>
			<div className="operation-summary">
				<span>Seller</span>
				<WalletAddress address={props.seller} className="operation-summary-link" full label="seller" />
				<span>Seller price</span>
				<strong>
					<ArCurrencyText>{props.sellerPrice}</ArCurrencyText>
				</strong>
				<span>Network fees</span>
				<strong>
					{quote.status === 'unavailable' ? (
						'Unavailable'
					) : quote.status === 'ready' ? (
						<ArCurrencyText>{quote.networkFees}</ArCurrencyText>
					) : (
						'Checking…'
					)}
				</strong>
				<span>Maximum total</span>
				<strong>
					{quote.status === 'unavailable' ? (
						'Unavailable'
					) : quote.status === 'ready' ? (
						<ArCurrencyText>{quote.maximumTotal}</ArCurrencyText>
					) : (
						'Checking…'
					)}
				</strong>
				<span>Wallet after purchase</span>
				<strong>
					{quote.status === 'unavailable' ? (
						'Unavailable'
					) : quote.status === 'ready' ? (
						quote.walletAfterPurchase ? (
							<ArCurrencyText>{quote.walletAfterPurchase}</ArCurrencyText>
						) : (
							<ArCurrencyText>Insufficient AR</ArCurrencyText>
						)
					) : (
						'Checking…'
					)}
				</strong>
				<small>
					One asset · native <ArCurrencyLabel /> settlement
				</small>
			</div>
			<LiveRegion as="p" id={props.statusId}>
				<ArCurrencyText>
					{quote.status === 'unavailable'
						? 'Purchase quote unavailable. Retry the cost check before buying.'
						: quote.status === 'ready'
						? `Purchase quote ready. Maximum total ${quote.maximumTotal}.${
								quote.affordable ? '' : ' This wallet has insufficient AR.'
						  }`
						: 'Checking the exact purchase cost.'}
				</ArCurrencyText>
			</LiveRegion>
			<div
				className={quote.status === 'unavailable' ? 'inline-error retry-notice' : 'quote-check-action'}
				role={quote.status === 'unavailable' ? 'status' : undefined}
			>
				<span>
					{quote.status === 'unavailable'
						? 'Compute hasn’t completed yet. Please try again.'
						: quote.status === 'ready'
						? 'Costs checked.'
						: 'Checking wallet balance and network fees…'}
				</span>
				<Button
					aria-describedby={props.statusId}
					aria-disabled={quote.status === 'checking'}
					className="with-icon"
					size="custom"
					type="button"
					onClick={props.onRetry}
				>
					<Icon icon={RefreshCw} size="sm" /> Retry
				</Button>
			</div>
		</>
	);
}
