import React from 'react';

import type { AssetState, SwapOrder } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { unitPriceWinston } from 'features/Catalogue';
import { useAssetOperationPendingActionLabel } from 'features/Operations';
import { winstonToArDecimal } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { formatTickerLabel } from 'helpers/token-display';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import {
	formatGroupedTokenAmount,
	orderPriceLabel,
	tokenLabel,
	visibleOrderbookRows,
} from '../../../model/fungible-market';
import { fungibleOrderActionLabel } from '../../../model/fungible-operation';

import * as S from './styles';

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
	const pendingActionLabel = useAssetOperationPendingActionLabel();
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const revealStatusRef = React.useRef<HTMLParagraphElement>(null);
	const tickerDisplay = formatTickerLabel(props.state.ticker, messages.validationDefaultTicker);
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
			<S.FungibleTable
				aria-label={formatMessage(messages.orderbookLabel, { name: props.assetName })}
				className="orderbook-table fungible-orderbook"
				role="table"
			>
				<S.Head className="orderbook-head" role="row">
					<span role="columnheader">{messages.orderbookColumnPrice}</span>
					<span role="columnheader">
						{formatMessage(messages.orderbookColumnSize, { ticker: tickerDisplay })}
					</span>
					<span role="columnheader">{messages.orderbookColumnValue}</span>
					<span role="columnheader">{messages.orderbookColumnSeller}</span>
					<span role="columnheader">{messages.orderbookColumnState}</span>
					<span aria-label={messages.orderbookColumnActions} role="columnheader" />
				</S.Head>
				{visibleRows.map((order, index) => {
					const own = order.creator === props.walletAddress;
					return (
						<S.Row
							className="orderbook-row orderbook-depth-row"
							key={order.orderId}
							role="row"
							style={{ '--orderbook-depth': `${props.orderDepths[index]}%` } as React.CSSProperties}
						>
							<strong
								aria-label={orderPriceLabel(order, props.state)}
								data-label={messages.orderbookColumnPrice}
								role="cell"
							>
								{winstonToArDecimal(unitPriceWinston(order, props.state.denomination).toString())}
							</strong>
							<span
								aria-label={tokenLabel(order.quantity, props.state)}
								data-label={formatMessage(messages.orderbookColumnSize, { ticker: tickerDisplay })}
								role="cell"
							>
								{formatGroupedTokenAmount(order.quantity, props.state.denomination)}
							</span>
							<span
								aria-label={formatMessage(messages.orderbookValueAr, {
									amount: winstonToArDecimal(order.asking),
								})}
								data-label={messages.orderbookColumnValue}
								role="cell"
							>
								{winstonToArDecimal(order.asking)}
							</span>
							<span data-label={messages.orderbookColumnSeller} role="cell">
								<WalletAddress address={order.creator} label={messages.assetDetailWalletLabelSeller} />
							</span>
							<S.Status
								className={`order-status ${order.status}`}
								data-label={messages.orderbookColumnState}
								role="cell"
							>
								{order.status}
							</S.Status>
							<S.ActionCell className="orderbook-action-cell" role="cell">
								{own && order.status === 'open' ? (
									<S.OrderAction
										aria-label={fungibleOrderActionLabel('cancel', order, props.state, messages)}
										className="order-action"
										disabled={props.cancelDisabled}
										size="custom"
										onClick={() => props.onCancel(order)}
										variant="danger"
									>
										{props.pendingCancelOrderId === order.orderId
											? pendingActionLabel('cancel')
											: messages.orderbookCancel}
									</S.OrderAction>
								) : null}
							</S.ActionCell>
						</S.Row>
					);
				})}
				{!props.orders.length ? (
					<S.Empty className="orderbook-empty" role="row">
						<S.EmptyCell aria-colspan={6} className="orderbook-empty-cell" role="cell">
							<strong>{messages.orderbookEmptyTitle}</strong>
							<span>{messages.orderbookEmptyDetail}</span>
						</S.EmptyCell>
					</S.Empty>
				) : null}
			</S.FungibleTable>
			{props.orders.length > ORDER_REVEAL_STEP ? (
				<S.Reveal className="orderbook-reveal">
					<p aria-atomic="true" aria-live="polite" ref={revealStatusRef} role="status" tabIndex={-1}>
						{formatMessage(messages.orderbookShowing, {
							visible: visibleRows.length.toLocaleString(),
							total: props.orders.length.toLocaleString(),
						})}
					</p>
					{visibleRows.length < props.orders.length ? (
						<Button type="button" size="custom" onClick={handleReveal}>
							{formatMessage(messages.orderbookShowMore, {
								count: Math.min(
									ORDER_REVEAL_STEP,
									props.orders.length - visibleRows.length
								).toLocaleString(),
							})}
						</Button>
					) : null}
				</S.Reveal>
			) : null}
		</>
	);
}
