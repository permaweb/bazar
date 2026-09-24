import { RefreshCw } from 'lucide-react';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';
import type { PurchaseQuoteView } from '../../../model/operation-view';

import * as S from './styles';

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
	const messages = useMessages(OPERATIONS_MESSAGES);
	const quote = props.quote;
	return (
		<>
			<S.Summary className="operation-summary">
				<span>{messages.labelSeller}</span>
				<S.SummaryLink
					address={props.seller}
					className="operation-summary-link"
					full
					label={messages.walletLabelSeller}
				/>
				<span>{messages.quoteSellerPrice}</span>
				<strong>
					<ArCurrencyText>{props.sellerPrice}</ArCurrencyText>
				</strong>
				{props.reservationMinimum ? (
					<>
						<span>{messages.quoteReservationMinimum}</span>
						<strong>
							<ArCurrencyText>{props.reservationMinimum}</ArCurrencyText>
						</strong>
					</>
				) : null}
				<span>{props.reservationMinimum ? messages.quoteTotalFees : messages.quoteNetworkFees}</span>
				<strong>
					{quote.status === 'unavailable' ? (
						messages.quoteUnavailable
					) : quote.status === 'ready' ? (
						<ArCurrencyText>{quote.networkFees}</ArCurrencyText>
					) : (
						messages.quoteChecking
					)}
				</strong>
				<span>{messages.quoteMaximumTotal}</span>
				<strong>
					{quote.status === 'unavailable' ? (
						messages.quoteUnavailable
					) : quote.status === 'ready' ? (
						<ArCurrencyText>{quote.maximumTotal}</ArCurrencyText>
					) : (
						messages.quoteChecking
					)}
				</strong>
				<span>{messages.quoteWalletAfterPurchase}</span>
				<strong>
					{quote.status === 'unavailable' ? (
						messages.quoteUnavailable
					) : quote.status === 'ready' ? (
						quote.walletAfterPurchase ? (
							<ArCurrencyText>{quote.walletAfterPurchase}</ArCurrencyText>
						) : (
							<ArCurrencyText>{messages.quoteInsufficientBalance}</ArCurrencyText>
						)
					) : (
						messages.quoteChecking
					)}
				</strong>
				<small>
					<ArCurrencyText>{messages.quoteSettlementNote}</ArCurrencyText>
				</small>
			</S.Summary>
			<LiveRegion as="p" id={props.statusId}>
				<ArCurrencyText>
					{quote.status === 'unavailable'
						? quote.message
						: quote.status === 'ready'
						? formatMessage(
								quote.affordable
									? messages.quoteAnnouncementReady
									: messages.quoteAnnouncementReadyInsufficient,
								{ total: quote.maximumTotal }
						  )
						: messages.quoteAnnouncementChecking}
				</ArCurrencyText>
			</LiveRegion>
			<S.CheckAction
				className={quote.status === 'unavailable' ? 'inline-error retry-notice' : 'quote-check-action'}
				role={quote.status === 'unavailable' ? 'status' : undefined}
			>
				<span>
					{quote.status === 'unavailable' ? (
						<ArCurrencyText>{quote.message}</ArCurrencyText>
					) : quote.status === 'ready' ? (
						messages.quoteCostsChecked
					) : (
						messages.quoteCheckingBalance
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
						{quote.status === 'ready' ? messages.quoteRefreshCosts : messages.quoteRetryCostCheck}
					</Button>
				) : null}
			</S.CheckAction>
		</>
	);
}
