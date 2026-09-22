import React from 'react';
import { ArrowDown } from 'lucide-react';

import { type AssetState, matchOrderFills } from 'api/marketplace';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { TextInput } from 'components/atoms/TextInput';
import { winstonToArDecimal } from 'helpers/ar-units';
import { formatTickerLabel } from 'helpers/token-display';

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
	const ticker = props.state.ticker || 'Token';
	const tickerDisplay = formatTickerLabel(ticker);
	const matchedSellerCount = props.match ? new Set(props.match.fills.map((fill) => fill.order.creator)).size : 0;
	const inputId = React.useId();
	const guidanceId = React.useId();
	const errorId = React.useId();

	return (
		<section aria-label="Choose purchase amount" className="purchase-composer">
			<div className="purchase-composer-panel purchase-composer-buy">
				<div className="purchase-composer-heading">
					<label htmlFor={inputId}>You buy</label>
					<Button onClick={props.onMax} type="button" size="custom">
						Max
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
					{tokenLabel(props.availableQuantity, props.state)} available to buy
					{BigInt(props.excludedQuantity ?? '0') > 0n
						? ` · ${tokenLabel(props.excludedQuantity ?? '0', props.state)} from your listing excluded`
						: ''}
				</small>
			</div>
			<div className="purchase-composer-panel purchase-composer-pay" aria-live="polite">
				<span className="purchase-composer-direction" aria-hidden="true">
					<ArrowDown />
				</span>
				<div className="purchase-composer-heading">
					<span>You pay</span>
					<span>Seller total</span>
				</div>
				<div className="purchase-composer-value">
					<strong>{props.match ? winstonToArDecimal(props.match.totalAsking) : '0'}</strong>
					<span className="purchase-composer-token">
						<ArCurrencyLabel />
					</span>
				</div>
				<small>
					{props.match
						? `${props.match.fills.length} ${
								props.match.fills.length === 1 ? 'order' : 'orders'
						  } · ${matchedSellerCount} ${
								matchedSellerCount === 1 ? 'seller' : 'sellers'
						  } · network fees shown in review`
						: 'Enter an amount to see the seller payment.'}
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
