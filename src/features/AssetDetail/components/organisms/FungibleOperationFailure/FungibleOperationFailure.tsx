import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { Tooltip } from 'components/atoms/Tooltip';
import { OperationExternalLink } from 'components/molecules/OperationOutcomeAnnouncement';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import type { FungibleOperationFlow } from '../../../hooks/useFungibleOperationFlow';
import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { batchStageLabel, type FungibleOperation } from '../../../model/fungible-operation';
import { FungibleOperationErrorAlert } from '../../molecules/FungibleOperationErrorAlert';
import { FungibleSettlementRecoveryPanel } from '../../molecules/FungibleSettlementRecoveryPanel';
import { FungibleSettlementTabs } from '../../molecules/FungibleSettlementTabs';

export default function FungibleOperationFailure(props: {
	flow: FungibleOperationFlow;
	operationKind: FungibleOperation['kind'];
	state: AssetState;
	onClose(): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const plural = usePlural();
	const errorMessage = useAppErrorMessage();
	const activeOrder = props.flow.activeOrder;
	const activePurchase = props.flow.activePurchase;
	return (
		<div className="result error">
			<FungibleOperationErrorAlert message={props.flow.message} />
			{props.operationKind === 'buy' && props.flow.visibleOrders.length ? (
				<>
					<FungibleSettlementTabs
						activeOrderId={activeOrder?.orderId}
						onSelect={props.flow.selectOrder}
						orders={props.flow.visibleOrders}
						purchaseStates={props.flow.purchaseStates}
						state={props.state}
					/>
					{activeOrder ? (
						<FungibleSettlementRecoveryPanel
							orderId={activeOrder.orderId}
							settled={activePurchase?.stage === 'complete'}
						>
							<div>
								<span>{messages.failureStage}</span>
								<strong>{batchStageLabel(messages, activePurchase)}</strong>
							</div>
							<div>
								<span>{messages.failureSeller}</span>
								<WalletAddress
									address={activeOrder.creator}
									full
									label={messages.assetDetailWalletLabelSeller}
								/>
							</div>
							<div>
								<span>{messages.failureOrder}</span>
								<Tooltip content={activeOrder.orderId} placement="top">
									{(tooltipId) => (
										<strong aria-describedby={tooltipId}>{short(activeOrder.orderId)}</strong>
									)}
								</Tooltip>
							</div>
							<p>
								{props.flow.activePurchaseFailure
									? errorMessage(props.flow.activePurchaseFailure)
									: activePurchase?.stage === 'complete'
									? messages.failureSettled
									: messages.failureIncomplete}
							</p>
							<div className="settlement-receipt-links">
								{activePurchase?.registration?.id ? (
									<a
										href={transactionExplorerUrl(activePurchase.registration.id)}
										rel="noreferrer"
										target="_blank"
									>
										<OperationExternalLink>
											{formatMessage(messages.failureReservationLink, {
												id: short(activePurchase.registration.id),
											})}
										</OperationExternalLink>
									</a>
								) : null}
								{activePurchase?.payment?.id ? (
									<a
										href={transactionExplorerUrl(activePurchase.payment.id)}
										rel="noreferrer"
										target="_blank"
									>
										<OperationExternalLink>
											{formatMessage(messages.failurePaymentLink, {
												id: short(activePurchase.payment.id),
											})}
										</OperationExternalLink>
									</a>
								) : null}
							</div>
						</FungibleSettlementRecoveryPanel>
					) : null}
				</>
			) : null}
			{props.flow.failureKind === 'market-state-changed' ? (
				<Button data-dialog-initial onClick={() => props.onClose()} size="custom">
					{messages.failureViewUpdatedToken}
				</Button>
			) : props.flow.failureKind === 'transaction-not-sent' && props.flow.transaction ? (
				<>
					<p>{messages.failureNoTransaction}</p>
					<div className="dialog-actions">
						<Button data-dialog-initial onClick={() => props.flow.submit()} size="custom">
							{messages.failureRetryTransfer}
						</Button>
						<Button size="custom" onClick={() => props.flow.discardTransfer()} variant="danger">
							{messages.failureDiscardTransfer}
						</Button>
					</div>
				</>
			) : props.flow.failureKind === 'transaction-rejected' && props.flow.transaction ? (
				<Button
					data-dialog-initial
					size="custom"
					onClick={() => props.flow.discardRejectedSignature()}
					variant="danger"
				>
					{messages.failureDiscardRejected}
				</Button>
			) : props.operationKind === 'buy' ? (
				<>
					{props.flow.purchaseNeedsManualReview ? (
						<p>{messages.failureTerminalPurchase}</p>
					) : props.flow.recoverableBatch ? (
						<p>{messages.failureRecoverableBatch}</p>
					) : (
						<p>{messages.failureDiscardedApprovals}</p>
					)}
					<Button
						data-dialog-initial
						onClick={
							props.flow.purchaseNeedsManualReview
								? props.flow.acknowledgeTerminalPurchase
								: props.flow.restartPurchase
						}
						size="custom"
					>
						{props.flow.purchaseNeedsManualReview
							? messages.failureUnlockAndClose
							: props.flow.recoverableBatch
							? plural(messages.failureResumeSettlements, props.flow.incompletePurchases)
							: messages.failureTryAgain}
					</Button>
				</>
			) : props.flow.transaction ? (
				<Button data-dialog-initial onClick={() => props.flow.submit()} size="custom">
					{messages.failureResumeSigned}
				</Button>
			) : (
				<Button data-dialog-initial size="custom" onClick={() => props.flow.reopenForm()}>
					{messages.failureTryAgain}
				</Button>
			)}
		</div>
	);
}
