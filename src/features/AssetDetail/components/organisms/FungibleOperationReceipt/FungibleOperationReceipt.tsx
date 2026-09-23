import { ArrowLeft } from 'lucide-react';

import type { AssetSummary } from 'api/collections';
import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import {
	OperationExternalLink,
	OperationOutcome,
	OperationOutcomeSubject,
} from 'components/molecules/OperationOutcomeAnnouncement';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { quorumConfirmationDepth } from 'features/TransactionSync';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import type { FungibleOperationFlow } from '../../../hooks/useFungibleOperationFlow';
import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleOperation } from '../../../model/fungible-operation';
import type { FungibleOperationDraftView, FungibleOperationOutcome } from '../../../model/fungible-operation-view';
import { DeferredTransactionSync as ArweaveTransactionSync } from '../DeferredTransactionSync';
import { FungiblePurchaseReceiptNavigator } from '../FungiblePurchaseReceiptNavigator';

export default function FungibleOperationReceipt(props: {
	asset: AssetSummary;
	draft: Pick<FungibleOperationDraftView, 'enteredQuantity' | 'listingQuote' | 'transferRecipient'>;
	flow: FungibleOperationFlow;
	operation: FungibleOperation;
	outcome: FungibleOperationOutcome;
	state: AssetState;
	visible: boolean;
	onClose(): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const transaction = props.flow.transaction;
	const purchaseSteps = props.flow.purchaseSync.steps;
	return (
		<div className="result success">
			<OperationOutcome
				title={props.outcome.title}
				detail={props.outcome.detail}
				status={
					props.operation.kind === 'buy'
						? formatMessage(messages.receiptConfirmations, {
								depth: quorumConfirmationDepth(purchaseSteps.find((step) => step.key === 'pay')),
						  })
						: undefined
				}
			>
				{props.operation.kind === 'buy' || props.operation.kind === 'sell' ? (
					<OperationOutcomeSubject
						label={props.operation.kind === 'buy' ? messages.receiptYouReceived : messages.receiptYouListed}
						title={
							props.operation.kind === 'buy'
								? tokenLabel(props.outcome.purchasedQuantity.toString(), props.state)
								: props.draft.enteredQuantity
								? tokenLabel(props.draft.enteredQuantity.toString(), props.state)
								: props.asset.name
						}
						detail={
							props.operation.kind === 'sell' && props.draft.listingQuote
								? formatMessage(messages.receiptListingTotal, { total: props.draft.listingQuote })
								: props.asset.name
						}
						media={
							<TokenAvatar
								className="operation-outcome-token-avatar"
								image={props.asset.image}
								loading="eager"
								ticker={props.state.ticker || props.asset.ticker || props.asset.name}
							/>
						}
					/>
				) : null}
				{props.operation.kind === 'buy' && purchaseSteps.length ? (
					<div className="result-outcome-sync">
						<ArweaveTransactionSync
							active={props.visible}
							activeStep="pay"
							startedAt={props.flow.startedAt}
							steps={purchaseSteps}
							subject={formatMessage(messages.progressSubject, {
								name: props.asset.name,
								amount: tokenLabel(props.flow.activeOrder?.quantity ?? '0', props.state),
							})}
						/>
					</div>
				) : null}
			</OperationOutcome>
			{transaction && props.operation.kind !== 'transfer' ? (
				<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
					<OperationExternalLink>
						{formatMessage(messages.receiptViewTransaction, { id: short(transaction.id) })}
					</OperationExternalLink>
				</a>
			) : null}
			{props.operation.kind === 'buy' ? (
				<FungiblePurchaseReceiptNavigator
					activeOrderId={props.flow.activeOrder?.orderId}
					onSelect={props.flow.selectOrder}
					orders={props.flow.visibleOrders}
					purchaseStates={props.flow.purchaseStates}
					state={props.state}
				/>
			) : props.operation.kind === 'transfer' && transaction && props.draft.enteredQuantity ? (
				<div className="settlement-receipt">
					<div>
						<span>{messages.receiptQuantity}</span>
						<strong>{tokenLabel(props.draft.enteredQuantity.toString(), props.state)}</strong>
					</div>
					<div>
						<span>{messages.receiptRecipient}</span>
						<WalletAddress
							address={props.draft.transferRecipient}
							full
							label={messages.assetDetailWalletLabelRecipient}
						/>
					</div>
					<div className="settlement-receipt-links">
						<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
							<OperationExternalLink>
								{formatMessage(messages.receiptTransaction, { id: short(transaction.id) })}
							</OperationExternalLink>
						</a>
					</div>
				</div>
			) : null}
			<Button
				className="with-icon"
				data-dialog-initial
				onClick={() => props.onClose()}
				size="custom"
				variant="primary"
			>
				<Icon icon={ArrowLeft} size="sm" /> {messages.receiptViewUpdatedToken}
			</Button>
		</div>
	);
}
