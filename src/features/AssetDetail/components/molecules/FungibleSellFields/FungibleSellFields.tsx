import React from 'react';

import type { AssetState } from 'api/marketplace';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { TextInput } from 'components/atoms/TextInput';
import { formatTickerLabel } from 'helpers/token-display';

import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleOperationDraftView } from '../../../model/fungible-operation-view';

export default function FungibleSellFields(props: {
	draft: FungibleOperationDraftView;
	quantity: string;
	unitPrice: string;
	state: AssetState;
	onQuantityChange(quantity: string): void;
	onUnitPriceChange(unitPrice: string): void;
}) {
	const quantityGuidanceId = React.useId();
	const priceGuidanceId = React.useId();
	const tickerDisplay = formatTickerLabel(props.state.ticker || 'Token');

	return (
		<>
			<div className="trade-balance">
				<span>Available to list</span>
				<strong>{tokenLabel(props.draft.available, props.state)}</strong>
			</div>
			<div className="trade-fields">
				<label>
					Token quantity
					<TextInput
						aria-describedby={props.draft.quantityInvalid ? quantityGuidanceId : undefined}
						aria-invalid={props.draft.quantityInvalid}
						autoFocus
						data-dialog-initial
						inputMode="decimal"
						value={props.quantity}
						onChange={(event) => props.onQuantityChange(event.target.value)}
						placeholder="100"
					/>
				</label>
				<label>
					<span>
						Price per {tickerDisplay} in <ArCurrencyLabel />
					</span>
					<TextInput
						aria-describedby={props.unitPrice && !props.draft.unitPriceValid ? priceGuidanceId : undefined}
						aria-invalid={Boolean(props.unitPrice) && !props.draft.unitPriceValid}
						inputMode="decimal"
						value={props.unitPrice}
						onChange={(event) => props.onUnitPriceChange(event.target.value)}
						placeholder="0.01"
					/>
				</label>
			</div>
			{props.draft.listingQuote ? (
				<div className="trade-quote">
					<span>Listing total</span>
					<strong>
						{props.draft.listingQuote} <ArCurrencyLabel />
					</strong>
				</div>
			) : null}
			{props.draft.enteredQuantity && props.draft.enteredQuantity <= props.draft.currentLiquid ? (
				<div className="trade-quote">
					<span>After network confirmation</span>
					<strong>
						{tokenLabel((props.draft.currentLiquid - props.draft.enteredQuantity).toString(), props.state)}{' '}
						liquid ·{' '}
						{tokenLabel((props.draft.currentListed + props.draft.enteredQuantity).toString(), props.state)}{' '}
						listed
					</strong>
				</div>
			) : null}
			{props.draft.quantityInvalid ? (
				<p id={quantityGuidanceId} className="trade-guidance" role="alert">
					Enter a quantity up to {tokenLabel(props.draft.currentLiquid.toString(), props.state)}.
				</p>
			) : null}
			{props.unitPrice && !props.draft.unitPriceValid ? (
				<p id={priceGuidanceId} className="trade-guidance" role="alert">
					<ArCurrencyText>Enter a positive AR price with no more than 12 decimal places.</ArCurrencyText>
				</p>
			) : null}
			<p className="settlement-disclosure">
				Listed tokens move into order escrow after network confirmation. Network fees are shown by your wallet
				before signing.
			</p>
		</>
	);
}
