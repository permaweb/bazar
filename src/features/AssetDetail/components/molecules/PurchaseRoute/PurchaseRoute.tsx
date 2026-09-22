import type { AssetState, OrderFill } from 'api/marketplace';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { winstonToArDecimal } from 'helpers/ar-units';

import { orderPriceLabel, tokenLabel } from '../../../model/fungible-market';

export default function PurchaseRoute(props: { fills: OrderFill[]; state: AssetState }) {
	return (
		<details className="purchase-route" open={props.fills.length === 1}>
			<summary>
				<span>Purchase route</span>
				<strong>{props.fills.length === 1 ? '1 order' : `View ${props.fills.length} orders`}</strong>
			</summary>
			<ul aria-label="Purchase execution route" tabIndex={0}>
				{props.fills.map(({ order, sourceOrder, partial }, index) => (
					<li key={order.orderId}>
						<span className="purchase-route-index">{index + 1}</span>
						<span className="purchase-route-fill">
							<strong>{tokenLabel(order.quantity, props.state)}</strong>
							<small>
								<ArCurrencyText>{orderPriceLabel(order, props.state)}</ArCurrencyText>
								{partial
									? ` · ${tokenLabel(order.quantity, props.state)} of ${tokenLabel(
											sourceOrder.quantity,
											props.state
									  )} from this listing`
									: ' · full order'}
							</small>
						</span>
						<span className="purchase-route-total">
							{winstonToArDecimal(order.asking)} <ArCurrencyLabel />
						</span>
						<WalletAddress address={order.creator} label="seller" />
					</li>
				))}
			</ul>
		</details>
	);
}
