import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { Tooltip } from 'components/atoms/Tooltip';
import { OperationExternalLink } from 'components/molecules/OperationOutcomeAnnouncement';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { appErrorMessage } from 'helpers/app-error';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';

import type { FungibleOperationFlow } from '../../../hooks/useFungibleOperationFlow';
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
								<span>Stage</span>
								<strong>{batchStageLabel(activePurchase)}</strong>
							</div>
							<div>
								<span>Seller</span>
								<WalletAddress address={activeOrder.creator} full label="seller" />
							</div>
							<div>
								<span>Order</span>
								<Tooltip content={activeOrder.orderId} placement="top">
									{(tooltipId) => (
										<strong aria-describedby={tooltipId}>{short(activeOrder.orderId)}</strong>
									)}
								</Tooltip>
							</div>
							<p>
								{props.flow.activePurchaseFailure
									? appErrorMessage(props.flow.activePurchaseFailure)
									: activePurchase?.stage === 'complete'
									? 'This listing settled successfully.'
									: 'This incomplete listing has saved transaction details and can be continued with the same wallet.'}
							</p>
							<div className="settlement-receipt-links">
								{activePurchase?.registration?.id ? (
									<a
										href={transactionExplorerUrl(activePurchase.registration.id)}
										rel="noreferrer"
										target="_blank"
									>
										<OperationExternalLink>
											Reservation {short(activePurchase.registration.id)}
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
											Payment {short(activePurchase.payment.id)}
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
					View updated token
				</Button>
			) : props.flow.failureKind === 'transaction-not-sent' && props.flow.transaction ? (
				<>
					<p>No transaction was submitted. Retry this signature or discard it to start over.</p>
					<div className="dialog-actions">
						<Button data-dialog-initial onClick={() => props.flow.submit()} size="custom">
							Retry transfer
						</Button>
						<Button size="custom" onClick={() => props.flow.discardTransfer()} variant="danger">
							Discard transfer
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
					Discard rejected signature and sign again
				</Button>
			) : props.operationKind === 'buy' ? (
				<>
					{props.flow.purchaseNeedsManualReview ? (
						<p>
							The process rejected this scheduled purchase after payment. Rechecking it cannot apply the
							transfer, so Bazar will keep the permanent receipts without creating a replacement.
						</p>
					) : props.flow.recoverableBatch ? (
						<p>Completed settlements will not be retried; only incomplete settlements will continue.</p>
					) : (
						<p>No transaction was submitted. Any earlier approvals from this attempt were discarded.</p>
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
							? 'Unlock asset and close'
							: props.flow.recoverableBatch
							? `Resume ${props.flow.incompletePurchases} incomplete ${
									props.flow.incompletePurchases === 1 ? 'settlement' : 'settlements'
							  }`
							: 'Try again'}
					</Button>
				</>
			) : props.flow.transaction ? (
				<Button data-dialog-initial onClick={() => props.flow.submit()} size="custom">
					Resume the signed transaction
				</Button>
			) : (
				<Button data-dialog-initial size="custom" onClick={() => props.flow.reopenForm()}>
					Try again
				</Button>
			)}
		</div>
	);
}
