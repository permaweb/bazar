import type { AssetState, SwapOrder } from 'api/marketplace';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { winstonToArDecimal } from 'helpers/ar-units';
import { asyncData, type AsyncState } from 'helpers/async-state';
import { formatMessage } from 'helpers/i18n';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import type { FungiblePurchaseQuote } from '../../../hooks/useFungiblePurchaseQuote';
import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';
import { fungiblePurchaseTotals } from '../../../model/fungible-operation-view';

export default function FungiblePurchaseReview(props: {
	orders: SwapOrder[];
	quote: AsyncState<FungiblePurchaseQuote>;
	quoteStatusId: string;
	state: AssetState;
	onRetryQuote(): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const plural = usePlural();
	const totals = fungiblePurchaseTotals(props.orders);
	const quote = asyncData(props.quote);
	const quoteFailed = props.quote.status === 'error';

	return (
		<>
			{props.orders.length ? (
				<section
					aria-busy={props.quote.status === 'loading'}
					className="purchase-confirmation"
					aria-label={messages.purchaseSummaryLabel}
				>
					<div className="purchase-confirmation-amount">
						<span>{messages.purchaseYouReceive}</span>
						<strong>{tokenLabel(totals.quantity.toString(), props.state)}</strong>
					</div>
					<dl className="purchase-confirmation-facts">
						<div>
							<dt>{messages.purchaseSellerTotal}</dt>
							<dd>
								{winstonToArDecimal(totals.asking.toString())} <ArCurrencyLabel />
							</dd>
						</div>
						<div>
							<dt>{messages.purchaseNetworkFees}</dt>
							<dd>
								{quoteFailed ? (
									messages.purchaseUnavailable
								) : quote ? (
									<ArCurrencyText>
										{formatMessage(messages.orderbookValueAr, {
											amount: winstonToArDecimal(
												(BigInt(quote.total) - totals.asking).toString()
											),
										})}
									</ArCurrencyText>
								) : (
									messages.purchaseChecking
								)}
							</dd>
						</div>
						<div className="purchase-confirmation-total">
							<dt>{messages.purchaseMaximumTotal}</dt>
							<dd>
								{quoteFailed ? (
									messages.purchaseQuoteUnavailable
								) : quote ? (
									<ArCurrencyText>
										{formatMessage(messages.orderbookValueAr, {
											amount: winstonToArDecimal(quote.total),
										})}
									</ArCurrencyText>
								) : (
									messages.purchaseChecking
								)}
							</dd>
						</div>
						<div>
							<dt>{messages.purchaseWalletAfter}</dt>
							<dd>
								{quoteFailed ? (
									messages.purchaseWalletAfterEmpty
								) : quote?.canAfford === false ? (
									<ArCurrencyText>{messages.purchaseInsufficientAr}</ArCurrencyText>
								) : quote ? (
									<ArCurrencyText>
										{formatMessage(messages.orderbookValueAr, {
											amount: winstonToArDecimal(
												(BigInt(quote.walletBalance) - BigInt(quote.total)).toString()
											),
										})}
									</ArCurrencyText>
								) : (
									messages.purchaseChecking
								)}
							</dd>
						</div>
					</dl>
					<p className="purchase-confirmation-meta">
						{formatMessage(messages.purchaseMeta, {
							orders: plural(messages.purchaseMetaOrders, props.orders.length),
							sellers: plural(messages.purchaseMetaSellers, totals.sellers),
							approvals: props.orders.length * 2,
						})}
					</p>
				</section>
			) : null}
			{props.orders.length ? (
				<LiveRegion as="p" id={props.quoteStatusId}>
					<ArCurrencyText>
						{props.quote.status === 'success' && quote
							? formatMessage(
									quote.canAfford
										? messages.purchaseQuoteReady
										: messages.purchaseQuoteReadyInsufficient,
									{ total: winstonToArDecimal(quote.total) }
							  )
							: quoteFailed
							? messages.purchaseQuoteFailed
							: messages.purchaseQuoteChecking}
					</ArCurrencyText>
				</LiveRegion>
			) : null}
			{props.orders.length && quoteFailed ? (
				<RetryNotice
					onRetry={() => props.onRetryQuote()}
					retryDescribedBy={props.quoteStatusId}
					retryLabel={messages.purchaseQuoteRetryLabel}
				>
					{messages.purchaseQuoteRetry}
				</RetryNotice>
			) : null}
			{quote?.canAfford === false ? (
				<p className="purchase-form-error" role="alert">
					<ArCurrencyText>{messages.purchaseInsufficientDetail}</ArCurrencyText>
				</p>
			) : null}
		</>
	);
}
