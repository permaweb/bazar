import React from 'react';
import { ShoppingCart, Tag } from 'lucide-react';

import type { Operation } from 'api/operations';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { TextInput } from 'components/atoms/TextInput';
import { WalletIdentity } from 'components/organisms/WalletAddress';
import type { AppErrorReason } from 'helpers/app-error';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorReasonMessage } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';
import type { PurchaseQuoteView } from '../../../model/operation-view';
import { PurchaseQuoteSummary } from '../../molecules/PurchaseQuoteSummary';

// The details form of an atomic buy, listing, cancellation, or transfer, submitted before any wallet approval.
export default function AtomicOperationForm(props: {
	kind: Operation['kind'];
	/** The entered listing price or transfer recipient. */
	value: string;
	/** The value the operation acts on: the listing price, or the trimmed transfer recipient. */
	operationValue: string;
	formError: AppErrorReason | null;
	seller: string;
	sellerPrice: string;
	/** The seller's declared reservation fee, already included in the fee total. */
	reservationMinimum: string | null;
	actionLabel: string;
	quote: PurchaseQuoteView;
	fieldHelpId: string;
	quoteStatusId: string;
	onValueChange(value: string): void;
	onRetryQuote(): void;
	onSubmit(): void;
}) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	const reasonMessage = useAppErrorReasonMessage();
	const invalid = Boolean(props.value && props.formError);

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		props.onSubmit();
	}

	function handleValueChange(event: React.ChangeEvent<HTMLInputElement>) {
		props.onValueChange(event.target.value);
	}

	return (
		<form className="operation-form" onSubmit={handleSubmit}>
			<div className="dialog-form-scroll">
				{props.kind === 'buy' ? (
					<PurchaseQuoteSummary
						quote={props.quote}
						reservationMinimum={props.reservationMinimum}
						seller={props.seller}
						sellerPrice={props.sellerPrice}
						statusId={props.quoteStatusId}
						onRetry={props.onRetryQuote}
					/>
				) : null}
				{props.kind === 'sell' ? (
					<label>
						<span>
							<ArCurrencyText>{messages.formSalePrice}</ArCurrencyText>
						</span>
						<TextInput
							autoFocus
							data-dialog-initial
							aria-describedby={props.fieldHelpId}
							aria-invalid={invalid}
							value={props.value}
							onChange={handleValueChange}
							placeholder={messages.formSalePricePlaceholder}
						/>
					</label>
				) : null}
				{props.kind === 'transfer' ? (
					<label>
						{messages.formRecipient}
						<TextInput
							autoFocus
							data-dialog-initial
							aria-describedby={props.fieldHelpId}
							aria-invalid={invalid}
							autoCapitalize="none"
							autoComplete="off"
							autoCorrect="off"
							spellCheck={false}
							value={props.value}
							onChange={handleValueChange}
							placeholder={messages.formRecipientPlaceholder}
						/>
					</label>
				) : null}
				{props.kind === 'transfer' && props.operationValue && !props.formError ? (
					<div className="operation-summary transfer-review">
						<span>{messages.formRecipientLabel}</span>
						<WalletIdentity address={props.operationValue} />
						<small>{messages.formTransferReview}</small>
					</div>
				) : null}
				{props.kind === 'cancel' ? (
					<div className="operation-summary">
						<span>{messages.formOpenListing}</span>
						<strong>
							<ArCurrencyText>{props.sellerPrice}</ArCurrencyText>
						</strong>
						<small>{messages.formCancelNote}</small>
					</div>
				) : null}
				{props.kind === 'sell' || props.kind === 'transfer' ? (
					<p
						id={props.fieldHelpId}
						className={invalid ? 'field-help field-help-error' : 'field-help'}
						role={invalid ? 'alert' : undefined}
					>
						{props.formError ? <ArCurrencyText>{reasonMessage(props.formError)}</ArCurrencyText> : null}
					</p>
				) : null}
				<p className="operation-disclosure">
					{props.kind === 'buy' ? messages.formPurchaseDisclosure : messages.formActionDisclosure}
				</p>
			</div>
			<Button
				aria-describedby={props.kind === 'buy' ? props.quoteStatusId : undefined}
				className={`wide${
					props.kind === 'buy' || props.kind === 'sell' ? ' with-icon market-primary-action' : ''
				}`}
				data-dialog-initial
				size="custom"
				disabled={
					Boolean(props.formError) ||
					(props.kind === 'buy' && (props.quote.status !== 'ready' || !props.quote.affordable))
				}
				type="submit"
				variant={props.kind === 'cancel' ? 'danger' : 'primary'}
			>
				{props.kind === 'buy' ? (
					<Icon icon={ShoppingCart} size="sm" />
				) : props.kind === 'sell' ? (
					<Icon icon={Tag} size="sm" />
				) : null}
				{props.kind === 'buy' && props.quote.status === 'unavailable' ? (
					props.quote.retryable ? (
						messages.formSubmitCostCheckUnavailable
					) : (
						messages.formSubmitListingNeedsUpdate
					)
				) : props.kind === 'buy' && props.quote.status === 'checking' ? (
					messages.formSubmitCheckingCosts
				) : props.kind === 'buy' && props.quote.affordable === false ? (
					<ArCurrencyText>{messages.formSubmitInsufficientBalance}</ArCurrencyText>
				) : props.kind === 'buy' && props.quote.status === 'ready' ? (
					<ArCurrencyText>
						{formatMessage(messages.formSubmitBuyMaximum, { total: props.quote.maximumTotal })}
					</ArCurrencyText>
				) : (
					<ArCurrencyText>{props.actionLabel}</ArCurrencyText>
				)}
			</Button>
		</form>
	);
}
