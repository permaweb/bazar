import type { AssetState, SwapOrder } from 'api/marketplace';
import type { PurchaseState } from 'api/transactions';

import { Button } from 'components/atoms/Button';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { settlementTabIndex } from '../../../model/fungible-batch';
import { tokenLabel } from '../../../model/fungible-market';
import { batchStageLabel, SETTLEMENT_ERROR_PANEL_ID } from '../../../model/fungible-operation';

export default function FungibleSettlementTabs(props: {
	activeOrderId?: string;
	orders: SwapOrder[];
	purchaseStates: Record<string, PurchaseState>;
	state: AssetState;
	onSelect(orderId: string): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	return (
		<div className="settlement-tabs" aria-label={messages.settlementTabsLabel} role="tablist">
			{props.orders.map((order, index) => {
				const active = order.orderId === props.activeOrderId;
				return (
					<Button
						aria-controls={SETTLEMENT_ERROR_PANEL_ID}
						aria-selected={active}
						className={active ? 'active' : undefined}
						id={`settlement-error-tab-${order.orderId}`}
						key={order.orderId}
						onClick={() => props.onSelect(order.orderId)}
						size="custom"
						onKeyDown={(event) => {
							const nextIndex = settlementTabIndex(event.key, index, props.orders.length);
							if (nextIndex === null) return;
							event.preventDefault();
							const nextOrder = props.orders[nextIndex];
							props.onSelect(nextOrder.orderId);
							window.requestAnimationFrame(() => {
								document.getElementById(`settlement-error-tab-${nextOrder.orderId}`)?.focus();
							});
						}}
						role="tab"
						tabIndex={active ? 0 : -1}
						type="button"
					>
						<span>{formatMessage(messages.settlementListing, { index: index + 1 })}</span>
						<strong>{tokenLabel(order.quantity, props.state)}</strong>
						<small>{batchStageLabel(messages, props.purchaseStates[order.orderId])}</small>
					</Button>
				);
			})}
		</div>
	);
}
