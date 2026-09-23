import React from 'react';

import type { AssetState, SwapOrder } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { unitPriceWinston } from 'features/Catalogue';
import { assetOperationPendingActionLabel } from 'features/Operations';
import { winstonToArDecimal } from 'helpers/ar-units';
import { formatTickerLabel } from 'helpers/token-display';

import {
	formatGroupedTokenAmount,
	orderPriceLabel,
	tokenLabel,
	visibleOrderbookRows,
} from '../../../model/fungible-market';
import { fungibleOrderActionLabel } from '../../../model/fungible-operation';

const ORDER_REVEAL_STEP = 50;

export default function FungibleOrderbook(props: {
	assetName: string;
	/** Rows disable their cancel actions while another action or refresh is in progress. */
	cancelDisabled: boolean;
	limit: number;
	orderDepths: number[];
	orders: SwapOrder[];
	/** The own listing whose cancellation dialog is open. */
	pendingCancelOrderId?: string;
	state: AssetState;
	walletAddress: string | null;
	onCancel(order: SwapOrder): void;
	onLimitChange(limit: number): void;
}) {
	const revealStatusRef = React.useRef<HTMLParagraphElement>(null);
	const tickerDisplay = formatTickerLabel(props.state.ticker || 'Token');
	const visibleRows = visibleOrderbookRows(props.orders, props.limit);

	function handleReveal() {
		const next = Math.min(props.orders.length, props.limit + ORDER_REVEAL_STEP);
		props.onLimitChange(next);
		if (next === props.orders.length) {
			window.requestAnimationFrame(() => revealStatusRef.current?.focus());
		}
	}

	return (
		<>
			<div
				aria-label={`${props.assetName} order book`}
				className="orderbook-table fungible-orderbook"
				role="table"
			>
				<div className="orderbook-head" role="row">
					<span role="columnheader">Price (AR)</span>
					<span role="columnheader">Size ({tickerDisplay})</span>
					<span role="columnheader">Value (AR)</span>
					<span role="columnheader">Seller</span>
					<span role="columnheader">State</span>
					<span aria-label="Actions" role="columnheader" />
				</div>
				{visibleRows.map((order, index) => {
					const own = order.creator === props.walletAddress;
					return (
						<div
							className="orderbook-row orderbook-depth-row"
							key={order.orderId}
							role="row"
							style={{ '--orderbook-depth': `${props.orderDepths[index]}%` } as React.CSSProperties}
						>
							<strong
								aria-label={orderPriceLabel(order, props.state)}
								data-label="Price (AR)"
								role="cell"
							>
								{winstonToArDecimal(unitPriceWinston(order, props.state.denomination).toString())}
							</strong>
							<span
								aria-label={tokenLabel(order.quantity, props.state)}
								data-label={`Size (${tickerDisplay})`}
								role="cell"
							>
								{formatGroupedTokenAmount(order.quantity, props.state.denomination)}
							</span>
							<span
								aria-label={`${winstonToArDecimal(order.asking)} AR`}
								data-label="Value (AR)"
								role="cell"
							>
								{winstonToArDecimal(order.asking)}
							</span>
							<span data-label="Seller" role="cell">
								<WalletAddress address={order.creator} label="seller" />
							</span>
							<span className={`order-status ${order.status}`} data-label="State" role="cell">
								{order.status}
							</span>
							<span className="orderbook-action-cell" role="cell">
								{own && order.status === 'open' ? (
									<Button
										aria-label={fungibleOrderActionLabel('cancel', order, props.state)}
										className="order-action"
										disabled={props.cancelDisabled}
										size="custom"
										onClick={() => props.onCancel(order)}
										variant="danger"
									>
										{props.pendingCancelOrderId === order.orderId
											? assetOperationPendingActionLabel('cancel')
											: 'Cancel'}
									</Button>
								) : null}
							</span>
						</div>
					);
				})}
				{!props.orders.length ? (
					<div className="orderbook-empty" role="row">
						<div aria-colspan={6} className="orderbook-empty-cell" role="cell">
							<strong>No open asks</strong>
							<span>Token holders can list any whole lot directly from their wallet.</span>
						</div>
					</div>
				) : null}
			</div>
			{props.orders.length > ORDER_REVEAL_STEP ? (
				<div className="orderbook-reveal">
					<p aria-atomic="true" aria-live="polite" ref={revealStatusRef} role="status" tabIndex={-1}>
						Showing {visibleRows.length.toLocaleString()} of {props.orders.length.toLocaleString()} live
						orders.
					</p>
					{visibleRows.length < props.orders.length ? (
						<Button type="button" size="custom" onClick={handleReveal}>
							Show{' '}
							{Math.min(ORDER_REVEAL_STEP, props.orders.length - visibleRows.length).toLocaleString()}{' '}
							more orders
						</Button>
					) : null}
				</div>
			) : null}
		</>
	);
}
