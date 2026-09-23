import type { AssetState } from 'api/marketplace';

import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { postConfirmationPendingLabel } from 'features/TransactionSync';

import type { FungibleOperationFlow } from '../../../hooks/useFungibleOperationFlow';
import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleOperation } from '../../../model/fungible-operation';
import { FungiblePurchaseSequence } from '../../molecules/FungiblePurchaseSequence';
import { DeferredTransactionSync as ArweaveTransactionSync } from '../DeferredTransactionSync';

export default function FungibleOperationProgress(props: {
	assetName: string;
	flow: FungibleOperationFlow;
	operationKind: FungibleOperation['kind'];
	state: AssetState;
	visible: boolean;
}) {
	const activeOrder = props.flow.activeOrder;
	const activePurchase = props.flow.activePurchase;
	return (
		<div className="operation-working">
			{props.operationKind === 'buy' ? (
				<LiveRegion as="p">{props.flow.settlementAnnouncement}</LiveRegion>
			) : (
				<LiveRegion as="p">
					{props.flow.message ||
						(props.flow.signedWork
							? 'Watching this transaction.'
							: 'Preparing the transaction for wallet approval.')}
				</LiveRegion>
			)}
			{props.operationKind === 'buy' && props.flow.visibleOrders.length ? (
				<FungiblePurchaseSequence
					listingCount={props.flow.visibleOrders.length}
					states={props.flow.visibleOrders.map((order) => props.flow.purchaseStates[order.orderId])}
				/>
			) : null}
			{props.flow.signedWork && props.operationKind !== 'buy' ? (
				<p className="sync-resume-note">
					Transaction details are saved in this browser. Return with the same wallet to continue while this
					browser data remains available.
				</p>
			) : null}
			{props.flow.workingStatus ? <p className="scheduler-wait">{props.flow.workingStatus}</p> : null}
			{props.operationKind === 'buy' && props.flow.visibleOrders.length ? (
				activeOrder && activePurchase ? (
					<ArweaveTransactionSync
						active={props.visible}
						skipKind={props.flow.purchaseSync.skipKind}
						onSkip={activePurchase.canSkip ? () => props.flow.skipPurchase(activeOrder.orderId) : undefined}
						subject={`${props.assetName} · ${tokenLabel(activeOrder.quantity, props.state)}`}
						startedAt={props.flow.startedAt}
						steps={props.flow.purchaseSync.steps}
						activeStep={props.flow.purchaseSync.activeStep}
						pendingAfterConfirmation={props.flow.purchaseSync.pendingAfterConfirmation}
					/>
				) : (
					<Loading label="Preparing the purchase for wallet approval…" />
				)
			) : props.flow.singleSteps.length ? (
				<ArweaveTransactionSync
					active={props.visible}
					subject={props.assetName}
					startedAt={props.flow.startedAt}
					steps={props.flow.singleSteps}
					activeStep={props.operationKind}
					pendingAfterConfirmation={postConfirmationPendingLabel(
						props.flow.confirmations,
						5,
						props.flow.message
					)}
				/>
			) : (
				<Loading label="Preparing the signed transaction…" />
			)}
		</div>
	);
}
