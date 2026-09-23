import React from 'react';

import type { AssetState } from 'api/marketplace';

import { TextInput } from 'components/atoms/TextInput';
import { appErrorReasonMessage } from 'helpers/app-error';

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
	const quantityGuidanceId = React.useId();
	const recipientGuidanceId = React.useId();

	return (
		<>
			<div className="trade-balance">
				<span>Available to send</span>
				<strong>{tokenLabel(props.draft.available, props.state)}</strong>
			</div>
			<label>
				Recipient wallet address
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
					placeholder="43-character Arweave address"
				/>
			</label>
			{props.recipient && props.draft.recipientError ? (
				<p id={recipientGuidanceId} className="trade-guidance" role="alert">
					{appErrorReasonMessage(props.draft.recipientError)}
				</p>
			) : null}
			{props.recipient && !props.draft.recipientError ? (
				<div className="trade-quote">
					<span>Recipient</span>
					<strong>{props.draft.transferRecipient}</strong>
				</div>
			) : null}
			{props.recipient && !props.draft.recipientError ? (
				<p className="settlement-disclosure">
					Review the complete destination before asking your wallet to approve this irreversible transfer.
				</p>
			) : null}
			<label>
				Token quantity
				<TextInput
					aria-describedby={props.draft.quantityInvalid ? quantityGuidanceId : undefined}
					aria-invalid={props.draft.quantityInvalid}
					inputMode="decimal"
					value={props.quantity}
					onChange={(event) => props.onQuantityChange(event.target.value)}
					placeholder="100"
				/>
			</label>
			{props.draft.quantityInvalid ? (
				<p id={quantityGuidanceId} className="trade-guidance" role="alert">
					Enter a quantity up to {tokenLabel(props.draft.currentLiquid.toString(), props.state)}.
				</p>
			) : null}
		</>
	);
}
