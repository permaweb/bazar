import React from 'react';

import type { AssetState } from 'api/marketplace';

import { TextInput } from 'components/atoms/TextInput';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorReasonMessage } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleOperationDraftView } from '../../../model/fungible-operation-view';

import * as S from './styles';

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
			<S.Balance className="trade-balance">
				<span>{messages.transferAvailableToSend}</span>
				<strong>{tokenLabel(props.draft.available, props.state)}</strong>
			</S.Balance>
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
				<S.Guidance id={recipientGuidanceId} className="trade-guidance" role="alert">
					{reasonMessage(props.draft.recipientError)}
				</S.Guidance>
			) : null}
			{props.recipient && !props.draft.recipientError ? (
				<S.Quote className="trade-quote">
					<span>{messages.transferRecipient}</span>
					<strong>{props.draft.transferRecipient}</strong>
				</S.Quote>
			) : null}
			{props.recipient && !props.draft.recipientError ? (
				<S.Disclosure className="settlement-disclosure">{messages.transferDisclosure}</S.Disclosure>
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
				<S.Guidance id={quantityGuidanceId} className="trade-guidance" role="alert">
					{formatMessage(messages.transferQuantityGuidance, {
						amount: tokenLabel(props.draft.currentLiquid.toString(), props.state),
					})}
				</S.Guidance>
			) : null}
		</>
	);
}
