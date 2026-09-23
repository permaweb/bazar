import type { AssetState, OrderFill } from 'api/marketplace';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { winstonToArDecimal } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { orderPriceLabel, tokenLabel } from '../../../model/fungible-market';

export default function PurchaseRoute(props: { fills: OrderFill[]; state: AssetState }) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	return (
		<details className="purchase-route" open={props.fills.length === 1}>
			<summary>
				<span>{messages.purchaseRouteSummary}</span>
				<strong>
					{props.fills.length === 1
						? messages.purchaseRouteSingle
						: formatMessage(messages.purchaseRouteMultiple, { count: props.fills.length })}
				</strong>
			</summary>
			<ul aria-label={messages.purchaseRouteLabel} tabIndex={0}>
				{props.fills.map(({ order, sourceOrder, partial }, index) => (
					<li key={order.orderId}>
						<span className="purchase-route-index">{index + 1}</span>
						<span className="purchase-route-fill">
							<strong>{tokenLabel(order.quantity, props.state)}</strong>
							<small>
								<ArCurrencyText>{orderPriceLabel(order, props.state)}</ArCurrencyText>
								{partial
									? formatMessage(messages.purchaseRoutePartial, {
											filled: tokenLabel(order.quantity, props.state),
											total: tokenLabel(sourceOrder.quantity, props.state),
									  })
									: messages.purchaseRouteFull}
							</small>
						</span>
						<span className="purchase-route-total">
							{winstonToArDecimal(order.asking)} <ArCurrencyLabel />
						</span>
						<WalletAddress address={order.creator} label={messages.assetDetailWalletLabelSeller} />
					</li>
				))}
			</ul>
		</details>
	);
}
