import type { AssetState, SwapOrder } from 'api/marketplace';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { WalletIdentity } from 'components/organisms/WalletAddress';
import { winstonToArDecimal } from 'helpers/ar-units';

import { orderPriceLabel, tokenLabel } from '../../../model/fungible-market';
import { fungibleListingAccessibleLabel } from '../../../model/fungible-operation';

export default function MatchedListingsReview(props: {
	onRemove?(order: SwapOrder): void;
	orders: SwapOrder[];
	state: AssetState;
}) {
	return (
		<section aria-label="Purchase overview" className="matched-listings">
			<div className="matched-listings-heading">
				<strong>Purchase overview</strong>
				<span>
					{props.orders.length} {props.orders.length === 1 ? 'listing' : 'listings'}
				</span>
			</div>
			{props.orders.length ? (
				<ul aria-label="Matched seller addresses" tabIndex={props.orders.length > 4 ? 0 : undefined}>
					{props.orders.map((order) => (
						<li key={order.orderId}>
							<span>
								<strong>{tokenLabel(order.quantity, props.state)}</strong>
								<small>
									<ArCurrencyText>
										{`${orderPriceLabel(order, props.state)} · ${winstonToArDecimal(
											order.asking
										)} AR total`}
									</ArCurrencyText>
								</small>
							</span>
							<WalletIdentity address={order.creator} />
							{props.onRemove ? (
								<Button
									aria-label={`Remove ${fungibleListingAccessibleLabel(
										order,
										props.state
									)} from purchase`}
									onClick={() => props.onRemove?.(order)}
									size="custom"
									type="button"
									variant="danger"
								>
									Remove
								</Button>
							) : null}
						</li>
					))}
				</ul>
			) : (
				<p className="matched-listings-empty">Your purchase overview is empty.</p>
			)}
		</section>
	);
}
