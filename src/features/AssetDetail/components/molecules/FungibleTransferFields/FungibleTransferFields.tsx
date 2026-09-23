import React from 'react';

import type { AssetState } from 'api/marketplace';

import { TextInput } from 'components/atoms/TextInput';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorReasonMessage } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleOperationDraftView } from '../../../model/fungible-operation-view';

export default function FungibleTransferFields(props: {
	draft: FungibleOperationDraftView;
	quantity: string;
	recipient: string;
	state: AssetState;
	onQuantityChange(quantity: string): void;
	onRecipientChange(recipient: string): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const reasonMessage = useAppErrorReasonMessage();
	const quantityGuidanceId = React.useId();
	const recipientGuidanceId = React.useId();

	return (
		<>
			<div className="trade-balance">
				<span>{messages.transferAvailableToSend}</span>
				<strong>{tokenLabel(props.draft.available, props.state)}</strong>
			</div>
			<label>
				{messages.transferRecipientLabel}
				<TextInput
					aria-describedby={props.recipient && props.draft.recipientError ? recipientGuidanceId : undefined}
					aria-invalid={Boolean(props.recipient) && Boolean(props.draft.recipientError)}
					autoCapitalize="none"
					autoComplete="off"
					autoCorrect="off"
					autoFocus
					data-dialog-initial
					spellCheck={false}
					value={props.recipient}
					onChange={(event) => props.onRecipientChange(event.target.value)}
					placeholder={messages.transferRecipientPlaceholder}
				/>
			</label>
			{props.recipient && props.draft.recipientError ? (
				<p id={recipientGuidanceId} className="trade-guidance" role="alert">
					{reasonMessage(props.draft.recipientError)}
				</p>
			) : null}
			{props.recipient && !props.draft.recipientError ? (
				<div className="trade-quote">
					<span>{messages.transferRecipient}</span>
					<strong>{props.draft.transferRecipient}</strong>
				</div>
			) : null}
			{props.recipient && !props.draft.recipientError ? (
				<p className="settlement-disclosure">{messages.transferDisclosure}</p>
			) : null}
			<label>
				{messages.transferTokenQuantity}
				<TextInput
					aria-describedby={props.draft.quantityInvalid ? quantityGuidanceId : undefined}
					aria-invalid={props.draft.quantityInvalid}
					inputMode="decimal"
					value={props.quantity}
					onChange={(event) => props.onQuantityChange(event.target.value)}
					placeholder={messages.transferQuantityPlaceholder}
				/>
			</label>
			{props.draft.quantityInvalid ? (
				<p id={quantityGuidanceId} className="trade-guidance" role="alert">
					{formatMessage(messages.transferQuantityGuidance, {
						amount: tokenLabel(props.draft.currentLiquid.toString(), props.state),
					})}
				</p>
			) : null}
		</>
	);
}
