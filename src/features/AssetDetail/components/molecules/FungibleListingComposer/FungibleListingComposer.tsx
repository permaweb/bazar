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

import * as S from './styles';

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
		<S.Composer aria-label={messages.composerListingLabel} className="purchase-composer">
			<S.BuyPanel className="purchase-composer-panel purchase-composer-buy">
				<S.Heading className="purchase-composer-heading">
					<label htmlFor={quantityId}>{messages.composerYouList}</label>
					<Button onClick={props.onMax} type="button" size="custom">
						{messages.composerMax}
					</Button>
				</S.Heading>
				<S.Value className="purchase-composer-value">
					<TextInput
						aria-describedby={`${quantityGuidanceId}${props.quantityError ? ` ${quantityErrorId}` : ''}`}
						aria-invalid={Boolean(props.quantityError)}
						id={quantityId}
						inputMode="decimal"
						onChange={(event) => props.onQuantityChange(event.target.value)}
						placeholder="0"
						value={props.quantity}
					/>
					<S.Token className="purchase-composer-token">{tickerDisplay}</S.Token>
				</S.Value>
				<small id={quantityGuidanceId}>
					{formatMessage(messages.composerAvailable, {
						amount: tokenLabel(props.availableQuantity, props.state),
					})}
				</small>
			</S.BuyPanel>
			<S.PayPanel className="purchase-composer-panel purchase-composer-pay">
				<S.Direction className="purchase-composer-direction" aria-hidden="true">
					<ArrowDown />
				</S.Direction>
				<S.Heading className="purchase-composer-heading">
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
				</S.Heading>
				<S.Value className="purchase-composer-value">
					<TextInput
						aria-describedby={`${priceGuidanceId}${props.unitPriceError ? ` ${priceErrorId}` : ''}`}
						aria-invalid={Boolean(props.unitPriceError)}
						id={unitPriceId}
						inputMode="decimal"
						onChange={(event) => props.onUnitPriceChange(event.target.value)}
						placeholder="0"
						value={props.unitPrice}
					/>
					<S.Token className="purchase-composer-token">
						<ArCurrencyLabel />
					</S.Token>
				</S.Value>
				<small id={priceGuidanceId}>
					{formatMessage(messages.composerPricePerToken, { ticker: tickerDisplay })}
				</small>
			</S.PayPanel>
			{props.quantityError ? (
				<S.ComposerError className="purchase-composer-error" id={quantityErrorId} role="alert">
					{props.quantityError}
				</S.ComposerError>
			) : null}
			{props.unitPriceError ? (
				<S.ComposerError className="purchase-composer-error" id={priceErrorId} role="alert">
					<ArCurrencyText>{props.unitPriceError}</ArCurrencyText>
				</S.ComposerError>
			) : null}
		</S.Composer>
	);
}
