import React from 'react';

import type { AssetState } from 'api/marketplace';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { TextInput } from 'components/atoms/TextInput';
import { formatMessage } from 'helpers/i18n';
import { formatTickerLabel } from 'helpers/token-display';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
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
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const quantityGuidanceId = React.useId();
	const priceGuidanceId = React.useId();
	const tickerDisplay = formatTickerLabel(props.state.ticker, messages.validationDefaultTicker);

	return (
		<>
			<div className="trade-balance">
				<span>{messages.sellAvailableToList}</span>
				<strong>{tokenLabel(props.draft.available, props.state)}</strong>
			</div>
			<div className="trade-fields">
				<label>
					{messages.sellTokenQuantity}
					<TextInput
						aria-describedby={props.draft.quantityInvalid ? quantityGuidanceId : undefined}
						aria-invalid={props.draft.quantityInvalid}
						autoFocus
						data-dialog-initial
						inputMode="decimal"
						value={props.quantity}
						onChange={(event) => props.onQuantityChange(event.target.value)}
						placeholder={messages.sellQuantityPlaceholder}
					/>
				</label>
				<label>
					<span>
						{formatMessage(messages.sellPricePerToken, { ticker: tickerDisplay })} <ArCurrencyLabel />
					</span>
					<TextInput
						aria-describedby={props.unitPrice && !props.draft.unitPriceValid ? priceGuidanceId : undefined}
						aria-invalid={Boolean(props.unitPrice) && !props.draft.unitPriceValid}
						inputMode="decimal"
						value={props.unitPrice}
						onChange={(event) => props.onUnitPriceChange(event.target.value)}
						placeholder={messages.sellPricePlaceholder}
					/>
				</label>
			</div>
			{props.draft.listingQuote ? (
				<div className="trade-quote">
					<span>{messages.sellListingTotal}</span>
					<strong>
						{props.draft.listingQuote} <ArCurrencyLabel />
					</strong>
				</div>
			) : null}
			{props.draft.enteredQuantity && props.draft.enteredQuantity <= props.draft.currentLiquid ? (
				<div className="trade-quote">
					<span>{messages.sellAfterConfirmation}</span>
					<strong>
						{formatMessage(messages.sellBalanceSplit, {
							liquid: tokenLabel(
								(props.draft.currentLiquid - props.draft.enteredQuantity).toString(),
								props.state
							),
							listed: tokenLabel(
								(props.draft.currentListed + props.draft.enteredQuantity).toString(),
								props.state
							),
						})}
					</strong>
				</div>
			) : null}
			{props.draft.quantityInvalid ? (
				<p id={quantityGuidanceId} className="trade-guidance" role="alert">
					{formatMessage(messages.sellQuantityGuidance, {
						amount: tokenLabel(props.draft.currentLiquid.toString(), props.state),
					})}
				</p>
			) : null}
			{props.unitPrice && !props.draft.unitPriceValid ? (
				<p id={priceGuidanceId} className="trade-guidance" role="alert">
					<ArCurrencyText>{messages.sellPriceGuidance}</ArCurrencyText>
				</p>
			) : null}
			<p className="settlement-disclosure">{messages.sellDisclosure}</p>
		</>
	);
}
