import React from 'react';
import { ArrowDown } from 'lucide-react';

import type { AssetState } from 'api/marketplace';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { TextInput } from 'components/atoms/TextInput';
import { formatMessage } from 'helpers/i18n';
import { formatTickerLabel } from 'helpers/token-display';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';

export default function FungibleListingComposer(props: {
	availableQuantity: string;
	onMax(): void;
	onQuantityChange(quantity: string): void;
	onUnitPriceChange(unitPrice: string): void;
	quantity: string;
	quantityError: string;
	state: AssetState;
	total: string | null;
	unitPrice: string;
	unitPriceError: string;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const ticker = props.state.ticker || messages.validationDefaultTicker;
	const tickerDisplay = formatTickerLabel(ticker, messages.validationDefaultTicker);
	const quantityId = React.useId();
	const quantityGuidanceId = React.useId();
	const quantityErrorId = React.useId();
	const unitPriceId = React.useId();
	const priceGuidanceId = React.useId();
	const priceErrorId = React.useId();

	return (
		<section aria-label={messages.composerListingLabel} className="purchase-composer">
			<div className="purchase-composer-panel purchase-composer-buy">
				<div className="purchase-composer-heading">
					<label htmlFor={quantityId}>{messages.composerYouList}</label>
					<Button onClick={props.onMax} type="button" size="custom">
						{messages.composerMax}
					</Button>
				</div>
				<div className="purchase-composer-value">
					<TextInput
						aria-describedby={`${quantityGuidanceId}${props.quantityError ? ` ${quantityErrorId}` : ''}`}
						aria-invalid={Boolean(props.quantityError)}
						id={quantityId}
						inputMode="decimal"
						onChange={(event) => props.onQuantityChange(event.target.value)}
						placeholder="0"
						value={props.quantity}
					/>
					<span className="purchase-composer-token">{tickerDisplay}</span>
				</div>
				<small id={quantityGuidanceId}>
					{formatMessage(messages.composerAvailable, {
						amount: tokenLabel(props.availableQuantity, props.state),
					})}
				</small>
			</div>
			<div className="purchase-composer-panel purchase-composer-pay">
				<span className="purchase-composer-direction" aria-hidden="true">
					<ArrowDown />
				</span>
				<div className="purchase-composer-heading">
					<label htmlFor={unitPriceId}>{messages.composerUnitPrice}</label>
					<span>
						{props.total ? (
							<ArCurrencyText>
								{formatMessage(messages.composerListingTotalValue, { total: props.total })}
							</ArCurrencyText>
						) : (
							messages.composerListingTotal
						)}
					</span>
				</div>
				<div className="purchase-composer-value">
					<TextInput
						aria-describedby={`${priceGuidanceId}${props.unitPriceError ? ` ${priceErrorId}` : ''}`}
						aria-invalid={Boolean(props.unitPriceError)}
						id={unitPriceId}
						inputMode="decimal"
						onChange={(event) => props.onUnitPriceChange(event.target.value)}
						placeholder="0"
						value={props.unitPrice}
					/>
					<span className="purchase-composer-token">
						<ArCurrencyLabel />
					</span>
				</div>
				<small id={priceGuidanceId}>
					{formatMessage(messages.composerPricePerToken, { ticker: tickerDisplay })}
				</small>
			</div>
			{props.quantityError ? (
				<p className="purchase-composer-error" id={quantityErrorId} role="alert">
					{props.quantityError}
				</p>
			) : null}
			{props.unitPriceError ? (
				<p className="purchase-composer-error" id={priceErrorId} role="alert">
					<ArCurrencyText>{props.unitPriceError}</ArCurrencyText>
				</p>
			) : null}
		</section>
	);
}
