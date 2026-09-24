import type { AssetState } from 'api/marketplace';

import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { postConfirmationPendingLabel } from 'features/TransactionSync';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import type { FungibleOperationFlow } from '../../../hooks/useFungibleOperationFlow';
import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleOperation } from '../../../model/fungible-operation';
import { FungiblePurchaseSequence } from '../../molecules/FungiblePurchaseSequence';
import { DeferredTransactionSync as ArweaveTransactionSync } from '../DeferredTransactionSync';

import * as S from './styles';

export default function FungibleOperationProgress(props: {
	assetName: string;
	flow: FungibleOperationFlow;
	operationKind: FungibleOperation['kind'];
	state: AssetState;
	visible: boolean;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const activeOrder = props.flow.activeOrder;
	const activePurchase = props.flow.activePurchase;
	return (
		<div className="operation-working">
			{props.operationKind === 'buy' ? (
				<LiveRegion as="p">{props.flow.settlementAnnouncement}</LiveRegion>
			) : (
				<LiveRegion as="p">
					{props.flow.message ||
						(props.flow.signedWork ? messages.progressWatching : messages.progressPreparing)}
				</LiveRegion>
			)}
			{props.operationKind === 'buy' && props.flow.visibleOrders.length ? (
				<FungiblePurchaseSequence
					listingCount={props.flow.visibleOrders.length}
					states={props.flow.visibleOrders.map((order) => props.flow.purchaseStates[order.orderId])}
				/>
			) : null}
			{props.flow.signedWork && props.operationKind !== 'buy' ? (
				<S.ResumeNote className="sync-resume-note">{messages.progressResumeNote}</S.ResumeNote>
			) : null}
			{props.flow.workingStatus ? <p className="scheduler-wait">{props.flow.workingStatus}</p> : null}
			{props.operationKind === 'buy' && props.flow.visibleOrders.length ? (
				activeOrder && activePurchase ? (
					<ArweaveTransactionSync
						active={props.visible}
						skipKind={props.flow.purchaseSync.skipKind}
						onSkip={activePurchase.canSkip ? () => props.flow.skipPurchase(activeOrder.orderId) : undefined}
						subject={formatMessage(messages.progressSubject, {
							name: props.assetName,
							amount: tokenLabel(activeOrder.quantity, props.state),
						})}
						startedAt={props.flow.startedAt}
						steps={props.flow.purchaseSync.steps}
						activeStep={props.flow.purchaseSync.activeStep}
						pendingAfterConfirmation={props.flow.purchaseSync.pendingAfterConfirmation}
					/>
				) : (
					<Loading label={messages.progressPreparingPurchase} />
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
				<Loading label={messages.progressPreparingSigned} />
			)}
		</div>
	);
}
