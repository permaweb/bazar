import { ArrowUpRight } from 'lucide-react';

import type { AssetState, SwapOrder } from 'api/marketplace';
import type { PurchaseState } from 'api/transactions';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Select } from 'components/atoms/Select';
import { Tooltip } from 'components/atoms/Tooltip';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { winstonToArDecimal } from 'helpers/ar-units';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';

import { fungiblePurchaseReceiptOptions, tokenLabel } from '../../../model/fungible-market';

export default function FungiblePurchaseReceiptNavigator(props: {
	activeOrderId?: string;
	onSelect(orderId: string): void;
	orders: SwapOrder[];
	purchaseStates: Record<string, PurchaseState>;
	state: AssetState;
}) {
	if (!props.orders.length) return null;
	const activeIndex = Math.max(
		0,
		props.orders.findIndex((order) => order.orderId === props.activeOrderId)
	);
	const order = props.orders[activeIndex];
	const settled = props.purchaseStates[order.orderId];
	const receiptOptions = fungiblePurchaseReceiptOptions(props.orders, props.state);
	return (
		<div className="settlement-receipts">
			<div className={`settlement-receipt-navigation${props.orders.length === 1 ? ' single' : ''}`}>
				<div>
					<strong>Settlement receipt</strong>
					{props.orders.length > 1 ? (
						<Select
							label="Choose settlement receipt"
							onChange={props.onSelect}
							options={receiptOptions}
							showLabel={false}
							value={order.orderId}
						/>
					) : null}
				</div>
				<span aria-live="polite" className="settlement-receipt-count">
					{activeIndex + 1} of {props.orders.length}
				</span>
			</div>
			<section
				aria-label={`Settlement receipt ${activeIndex + 1} of ${props.orders.length}`}
				className="settlement-receipt purchase-settlement-receipt"
			>
				<div className="settlement-receipt-amount">
					<span>Listing {activeIndex + 1}</span>
					<strong>{tokenLabel(order.quantity, props.state)}</strong>
				</div>
				<dl className="settlement-receipt-facts">
					<div>
						<dt>Seller</dt>
						<dd>
							<WalletAddress address={order.creator} label="seller" tooltipEscapesOverflow />
						</dd>
					</div>
					<div>
						<dt>Order</dt>
						<dd>
							<Tooltip content={order.orderId} placement="top">
								{(tooltipId) => <span aria-describedby={tooltipId}>{short(order.orderId)}</span>}
							</Tooltip>
						</dd>
					</div>
					<div>
						<dt>Seller payment</dt>
						<dd>
							{winstonToArDecimal(order.asking)} <ArCurrencyLabel />
						</dd>
					</div>
				</dl>
				<div className="settlement-receipt-links receipt-proof-links">
					{settled?.registration?.id ? (
						<a
							aria-label={`View reservation ${settled.registration.id}`}
							href={transactionExplorerUrl(settled.registration.id)}
							rel="noreferrer"
							target="_blank"
						>
							<span>Reservation</span>
							<strong>{short(settled.registration.id)}</strong>
							<Icon icon={ArrowUpRight} size="xs" />
						</a>
					) : null}
					{settled?.payment?.id ? (
						<a
							aria-label={`View payment ${settled.payment.id}`}
							href={transactionExplorerUrl(settled.payment.id)}
							rel="noreferrer"
							target="_blank"
						>
							<span>Payment</span>
							<strong>{short(settled.payment.id)}</strong>
							<Icon icon={ArrowUpRight} size="xs" />
						</a>
					) : null}
				</div>
			</section>
			{props.orders.length > 1 ? (
				<div className="settlement-receipt-paging">
					<Button
						aria-disabled={activeIndex === 0}
						onClick={() => {
							if (activeIndex > 0) props.onSelect(props.orders[activeIndex - 1].orderId);
						}}
						type="button"
						size="custom"
					>
						Previous receipt
					</Button>
					<Button
						aria-disabled={activeIndex === props.orders.length - 1}
						onClick={() => {
							if (activeIndex < props.orders.length - 1)
								props.onSelect(props.orders[activeIndex + 1].orderId);
						}}
						type="button"
						size="custom"
					>
						Next receipt
					</Button>
				</div>
			) : null}
		</div>
	);
}
