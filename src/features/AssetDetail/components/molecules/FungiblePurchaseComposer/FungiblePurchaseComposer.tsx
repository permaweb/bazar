import React from 'react';
import { ArrowDown } from 'lucide-react';

import type { AssetState, matchOrderFills } from 'api/marketplace';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { TextInput } from 'components/atoms/TextInput';
import { winstonToArDecimal } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { formatTickerLabel } from 'helpers/token-display';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';

export default function FungiblePurchaseComposer(props: {
	availableQuantity: string;
	excludedQuantity?: string;
	error: string;
	match: ReturnType<typeof matchOrderFills>;
	onChange(quantity: string): void;
	onMax(): void;
	quantity: string;
	state: AssetState;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const plural = usePlural();
	const ticker = props.state.ticker || messages.validationDefaultTicker;
	const tickerDisplay = formatTickerLabel(ticker, messages.validationDefaultTicker);
	const matchedSellerCount = props.match ? new Set(props.match.fills.map((fill) => fill.order.creator)).size : 0;
	const inputId = React.useId();
	const guidanceId = React.useId();
	const errorId = React.useId();

	return (
		<section aria-label={messages.composerPurchaseLabel} className="purchase-composer">
			<div className="purchase-composer-panel purchase-composer-buy">
				<div className="purchase-composer-heading">
					<label htmlFor={inputId}>{messages.composerYouBuy}</label>
					<Button onClick={props.onMax} type="button" size="custom">
						{messages.composerMax}
					</Button>
				</div>
				<div className="purchase-composer-value">
					<TextInput
						aria-describedby={`${guidanceId}${props.error ? ` ${errorId}` : ''}`}
						aria-invalid={Boolean(props.error)}
						id={inputId}
						inputMode="decimal"
						onChange={(event) => props.onChange(event.target.value)}
						placeholder="0"
						value={props.quantity}
					/>
					<span className="purchase-composer-token">{tickerDisplay}</span>
				</div>
				<small id={guidanceId}>
					{BigInt(props.excludedQuantity ?? '0') > 0n
						? formatMessage(messages.composerAvailableToBuyExcluded, {
								amount: tokenLabel(props.availableQuantity, props.state),
								excluded: tokenLabel(props.excludedQuantity ?? '0', props.state),
						  })
						: formatMessage(messages.composerAvailableToBuy, {
								amount: tokenLabel(props.availableQuantity, props.state),
						  })}
				</small>
			</div>
			<div className="purchase-composer-panel purchase-composer-pay" aria-live="polite">
				<span className="purchase-composer-direction" aria-hidden="true">
					<ArrowDown />
				</span>
				<div className="purchase-composer-heading">
					<span>{messages.composerYouPay}</span>
					<span>{messages.composerSellerTotal}</span>
				</div>
				<div className="purchase-composer-value">
					<strong>{props.match ? winstonToArDecimal(props.match.totalAsking) : '0'}</strong>
					<span className="purchase-composer-token">
						<ArCurrencyLabel />
					</span>
				</div>
				<small>
					{props.match
						? formatMessage(messages.composerMatchSummary, {
								orders: plural(messages.composerOrderCount, props.match.fills.length),
								sellers: plural(messages.composerSellerCount, matchedSellerCount),
						  })
						: messages.composerEnterAmount}
				</small>
			</div>
			{props.error ? (
				<p className="purchase-composer-error" id={errorId} role="alert">
					{props.error}
				</p>
			) : null}
		</section>
	);
}
