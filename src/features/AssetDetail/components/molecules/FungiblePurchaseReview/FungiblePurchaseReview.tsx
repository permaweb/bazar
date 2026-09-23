import type { AssetState, SwapOrder } from 'api/marketplace';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { winstonToArDecimal } from 'helpers/ar-units';
import { asyncData, type AsyncState } from 'helpers/async-state';

import type { FungiblePurchaseQuote } from '../../../hooks/useFungiblePurchaseQuote';
import { tokenLabel } from '../../../model/fungible-market';
import { fungiblePurchaseTotals } from '../../../model/fungible-operation-view';

export default function FungiblePurchaseReview(props: {
	orders: SwapOrder[];
	quote: AsyncState<FungiblePurchaseQuote>;
	quoteStatusId: string;
	state: AssetState;
	onRetryQuote(): void;
}) {
	const totals = fungiblePurchaseTotals(props.orders);
	const quote = asyncData(props.quote);
	const quoteFailed = props.quote.status === 'error';

	return (
		<>
			{props.orders.length ? (
				<section
					aria-busy={props.quote.status === 'loading'}
					className="purchase-confirmation"
					aria-label="Purchase summary"
				>
					<div className="purchase-confirmation-amount">
						<span>You receive</span>
						<strong>{tokenLabel(totals.quantity.toString(), props.state)}</strong>
					</div>
					<dl className="purchase-confirmation-facts">
						<div>
							<dt>Seller total</dt>
							<dd>
								{winstonToArDecimal(totals.asking.toString())} <ArCurrencyLabel />
							</dd>
						</div>
						<div>
							<dt>Network fees</dt>
							<dd>
								{quoteFailed ? (
									'Unavailable'
								) : quote ? (
									<ArCurrencyText>{`${winstonToArDecimal(
										(BigInt(quote.total) - totals.asking).toString()
									)} AR`}</ArCurrencyText>
								) : (
									'Checking…'
								)}
							</dd>
						</div>
						<div className="purchase-confirmation-total">
							<dt>Maximum total</dt>
							<dd>
								{quoteFailed ? (
									'Quote unavailable'
								) : quote ? (
									<ArCurrencyText>{`${winstonToArDecimal(quote.total)} AR`}</ArCurrencyText>
								) : (
									'Checking…'
								)}
							</dd>
						</div>
						<div>
							<dt>Wallet after</dt>
							<dd>
								{quoteFailed ? (
									'—'
								) : quote?.canAfford === false ? (
									<ArCurrencyText>Insufficient AR</ArCurrencyText>
								) : quote ? (
									<ArCurrencyText>{`${winstonToArDecimal(
										(BigInt(quote.walletBalance) - BigInt(quote.total)).toString()
									)} AR`}</ArCurrencyText>
								) : (
									'Checking…'
								)}
							</dd>
						</div>
					</dl>
					<p className="purchase-confirmation-meta">
						{props.orders.length} {props.orders.length === 1 ? 'order' : 'orders'} · {totals.sellers}{' '}
						{totals.sellers === 1 ? 'seller' : 'sellers'} · {props.orders.length * 2} wallet approvals
					</p>
				</section>
			) : null}
			{props.orders.length ? (
				<LiveRegion as="p" id={props.quoteStatusId}>
					<ArCurrencyText>
						{props.quote.status === 'success' && quote
							? `Purchase quote ready. Maximum total ${winstonToArDecimal(quote.total)} AR.${
									quote.canAfford ? '' : ' This wallet has insufficient AR.'
							  }`
							: quoteFailed
							? 'Purchase quote unavailable. Retry the cost check before buying.'
							: 'Checking the wallet balance and network fees.'}
					</ArCurrencyText>
				</LiveRegion>
			) : null}
			{props.orders.length && quoteFailed ? (
				<RetryNotice onRetry={() => props.onRetryQuote()} retryDescribedBy={props.quoteStatusId} />
			) : null}
			{quote?.canAfford === false ? (
				<p className="purchase-form-error" role="alert">
					<ArCurrencyText>
						This wallet does not have enough AR for the purchase and network fees.
					</ArCurrencyText>
				</p>
			) : null}
		</>
	);
}
