import React from 'react';
import { ShoppingCart, Tag } from 'lucide-react';

import type { Operation } from 'api/operations';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { TextInput } from 'components/atoms/TextInput';
import { WalletIdentity } from 'components/organisms/WalletAddress';
import { type AppErrorReason, appErrorReasonMessage } from 'helpers/app-error';

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
							Sale price in <ArCurrencyLabel />
						</span>
						<TextInput
							autoFocus
							data-dialog-initial
							aria-describedby={props.fieldHelpId}
							aria-invalid={invalid}
							value={props.value}
							onChange={handleValueChange}
							placeholder="0.25"
						/>
					</label>
				) : null}
				{props.kind === 'transfer' ? (
					<label>
						Recipient wallet address
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
							placeholder="43-character Arweave address"
						/>
					</label>
				) : null}
				{props.kind === 'transfer' && props.operationValue && !props.formError ? (
					<div className="operation-summary transfer-review">
						<span>Recipient</span>
						<WalletIdentity address={props.operationValue} />
						<small>
							Review the complete destination before asking your wallet to approve this irreversible
							transfer.
						</small>
					</div>
				) : null}
				{props.kind === 'cancel' ? (
					<div className="operation-summary">
						<span>Open listing</span>
						<strong>
							<ArCurrencyText>{props.sellerPrice}</ArCurrencyText>
						</strong>
						<small>Cancelling returns the asset from order escrow to your liquid balance.</small>
					</div>
				) : null}
				{props.kind === 'sell' || props.kind === 'transfer' ? (
					<p
						id={props.fieldHelpId}
						className={invalid ? 'field-help field-help-error' : 'field-help'}
						role={invalid ? 'alert' : undefined}
					>
						{props.formError ? (
							<ArCurrencyText>{appErrorReasonMessage(props.formError)}</ArCurrencyText>
						) : null}
					</p>
				) : null}
				<p className="operation-disclosure">
					{props.kind === 'buy'
						? 'You’ll approve twice in your wallet: reserve the asset, then pay the seller. Payment is sent only after the network accepts your reservation.'
						: 'After signing, Bazar observes this action through independently addressed Arweave nodes. Signed transaction details are saved in this browser so you can return with the same wallet while browser data remains available.'}
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
						'Cost check unavailable'
					) : (
						'Listing needs an update'
					)
				) : props.kind === 'buy' && props.quote.status === 'checking' ? (
					'Checking purchase costs…'
				) : props.kind === 'buy' && props.quote.affordable === false ? (
					<ArCurrencyText>Insufficient AR</ArCurrencyText>
				) : props.kind === 'buy' && props.quote.status === 'ready' ? (
					<ArCurrencyText>{`Buy · up to ${props.quote.maximumTotal}`}</ArCurrencyText>
				) : (
					<ArCurrencyText>{props.actionLabel}</ArCurrencyText>
				)}
			</Button>
		</form>
	);
}
