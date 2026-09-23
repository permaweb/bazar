import { RefreshCw } from 'lucide-react';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { WalletAddress } from 'components/organisms/WalletAddress';

import type { PurchaseQuoteView } from '../../../model/operation-view';

// The seller price, reservation minimum, fees, maximum total, and remaining balance of a new purchase, with a
// cost re-check. A listing the network cannot quote explains why, and offers a retry only when one can help.
export default function PurchaseQuoteSummary(props: {
	seller: string;
	sellerPrice: string;
	/** The seller's declared reservation fee, already included in the fee total. */
	reservationMinimum: string | null;
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
				{props.reservationMinimum ? (
					<>
						<span>Reservation minimum (included)</span>
						<strong>
							<ArCurrencyText>{props.reservationMinimum}</ArCurrencyText>
						</strong>
					</>
				) : null}
				<span>{props.reservationMinimum ? 'Total fees' : 'Network fees'}</span>
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
						? quote.message
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
					{quote.status === 'unavailable' ? (
						<ArCurrencyText>{quote.message}</ArCurrencyText>
					) : quote.status === 'ready' ? (
						'Costs checked.'
					) : (
						'Checking wallet balance and network fees…'
					)}
				</span>
				{quote.status !== 'checking' && (quote.status !== 'unavailable' || quote.retryable) ? (
					<Button
						aria-describedby={props.statusId}
						className="with-icon"
						size="custom"
						type="button"
						onClick={props.onRetry}
					>
						<Icon icon={RefreshCw} size="sm" />{' '}
						{quote.status === 'ready' ? 'Refresh costs' : 'Retry cost check'}
					</Button>
				) : null}
			</div>
		</>
	);
}
