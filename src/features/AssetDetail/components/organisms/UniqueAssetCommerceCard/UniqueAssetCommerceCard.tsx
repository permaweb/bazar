import { CircleX, Send, ShoppingCart, Tag } from 'lucide-react';

import type { AssetSummary } from 'api/collections';
import type { AssetState } from 'api/marketplace';
import type { Operation, OperationActivity } from 'api/operations';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { ConnectWalletButton } from 'components/organisms/ConnectWalletButton';
import {
	AssetBalanceStateNotice,
	AssetOperationStatus,
	useAssetOperationPendingActionLabel,
} from 'features/Operations';
import { winstonToAr } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import type { UniqueAssetView } from '../../../model/unique-asset-view';
import { SetProfilePictureButton } from '../../molecules/SetProfilePictureButton';

export default function UniqueAssetCommerceCard(props: {
	asset: AssetSummary;
	state: AssetState;
	view: UniqueAssetView;
	walletAddress: string | null;
	operationActivity: Pick<OperationActivity, 'id' | 'operation' | 'phase' | 'status'> | undefined;
	operation: Operation | null;
	onOpenOperation(operation: Operation): void;
	onShowOperation(id: string): void;
}) {
	const pendingActionLabel = useAssetOperationPendingActionLabel();
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const order = props.view.order;
	return (
		<section aria-busy={props.view.operationIsBusy} className="asset-commerce-card">
			<AssetBalanceStateNotice state={props.state} />
			{/* One price leads the card; supply, order status, and protocol details live under Blockchain. */}
			<div className="asset-purchase-summary">
				<div className="asset-buy-summary">
					<span>
						{order?.status === 'reserved'
							? messages.uniqueCommerceReservedAt
							: order
							? messages.uniqueCommercePrice
							: messages.uniqueCommerceMarketStatus}
					</span>
					<strong>
						{order ? (
							<ArCurrencyText>
								{formatMessage(messages.orderbookValueAr, { amount: winstonToAr(order.asking) })}
							</ArCurrencyText>
						) : (
							messages.uniqueCommerceNotListed
						)}
					</strong>
					{order ? <small>{messages.uniqueCommerceFeeNote}</small> : null}
				</div>
				<span className="asset-edition">{messages.uniqueCommerceEdition}</span>
			</div>
			{props.operationActivity ? (
				<AssetOperationStatus
					kind={props.operationActivity.operation.kind}
					phase={props.operationActivity.phase}
					status={props.operationActivity.status}
					onView={() => {
						if (props.operationActivity) props.onShowOperation(props.operationActivity.id);
					}}
				/>
			) : null}
			{props.view.externalReservation && order && !props.operationActivity ? (
				<div className="external-reservation-notice" role="status">
					<div>
						<strong>{messages.uniqueCommerceReservationReady}</strong>
						<p>{messages.uniqueCommerceReservationDetail}</p>
					</div>
					<Button
						disabled={props.view.liveActionBlocked}
						size="custom"
						variant="primary"
						onClick={() => {
							if (!props.view.externalReservation) return;
							props.onOpenOperation({
								kind: 'buy',
								order,
								resume: {
									registration: { id: props.view.externalReservation.id, dispatched: true },
								},
								externalOrigin: true,
							});
						}}
						type="button"
					>
						{messages.uniqueCommerceContinuePurchase}
					</Button>
				</div>
			) : null}
			<div className="asset-commerce-actions">
				{!props.walletAddress ? <ConnectWalletButton /> : null}
				{props.walletAddress && props.view.buyableOrder && !props.view.mine ? (
					<Button
						className="with-icon asset-buy-now market-primary-action"
						disabled={props.view.newOperationBlocksActions}
						size="custom"
						variant="primary"
						onClick={() => {
							if (props.view.buyableOrder)
								props.onOpenOperation({ kind: 'buy', order: props.view.buyableOrder });
						}}
					>
						<Icon icon={ShoppingCart} size="sm" />{' '}
						{props.operation?.kind === 'buy' ? pendingActionLabel('buy') : messages.uniqueCommerceBuyNow}
					</Button>
				) : null}
				{props.walletAddress && props.view.mine && !order ? (
					<Button
						className="with-icon asset-buy-now market-primary-action"
						disabled={props.view.newOperationBlocksActions}
						size="custom"
						variant="primary"
						onClick={() => props.onOpenOperation({ kind: 'sell' })}
					>
						<Icon icon={Tag} size="sm" />{' '}
						{props.operation?.kind === 'sell'
							? pendingActionLabel('sell')
							: messages.uniqueCommerceListForSale}
					</Button>
				) : null}
				{props.walletAddress && props.view.mine && order?.status === 'open' ? (
					<Button
						className="with-icon"
						disabled={props.view.newOperationBlocksActions}
						size="custom"
						onClick={() => props.onOpenOperation({ kind: 'cancel', order })}
						variant="danger"
					>
						<Icon icon={CircleX} size="sm" />{' '}
						{props.operation?.kind === 'cancel'
							? pendingActionLabel('cancel')
							: messages.uniqueCommerceCancelListing}
					</Button>
				) : null}
				{props.walletAddress && props.view.mine && !order ? (
					<Button
						className="with-icon"
						disabled={props.view.newOperationBlocksActions}
						size="custom"
						onClick={() => props.onOpenOperation({ kind: 'transfer' })}
					>
						<Icon icon={Send} size="sm" />{' '}
						{props.operation?.kind === 'transfer'
							? pendingActionLabel('transfer')
							: messages.uniqueCommerceTransfer}
					</Button>
				) : null}
				{props.walletAddress && props.view.mine && props.asset.image ? (
					<SetProfilePictureButton
						assetId={props.asset.id}
						disabled={props.view.liveActionBlocked}
						image={props.asset.image}
						owner={props.walletAddress}
					/>
				) : null}
			</div>
		</section>
	);
}
