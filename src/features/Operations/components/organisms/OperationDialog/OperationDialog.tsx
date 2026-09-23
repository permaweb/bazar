import React from 'react';

import type { AssetSummary } from 'api/collections';
import type { Operation } from 'api/operations';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { OperationOutcomeAnnouncement } from 'components/molecules/OperationOutcomeAnnouncement';
import {
	TransactionDialogControl,
	transactionDialogDismissAction,
} from 'components/molecules/TransactionDialogControl';
import { Dialog } from 'components/organisms/Dialog';
import { useAppErrorMessages } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';
import type { OperationActivity } from 'providers/OperationActivityProvider';

import { useAtomicOperationFlow } from '../../../hooks/useAtomicOperationFlow';
import { usePurchaseQuote } from '../../../hooks/usePurchaseQuote';
import { useTransactionDialogHide } from '../../../hooks/useTransactionDialogHide';
import { OPERATIONS_MESSAGES } from '../../../messages';
import { initialOperationValue, purchaseQuoteView } from '../../../model/operation-view';
import { AtomicOperationFailure } from '../../molecules/AtomicOperationFailure';
import { AtomicOperationOutcome } from '../../molecules/AtomicOperationOutcome';
import { AtomicOperationProgress } from '../../molecules/AtomicOperationProgress';
import { AtomicPurchaseSequence } from '../../molecules/AtomicPurchaseSequence';
import { PurchaseRecoveryApproval } from '../../molecules/PurchaseRecoveryApproval';
import { AtomicOperationForm } from '../AtomicOperationForm';

// The side panel of one atomic buy, listing, cancellation, or transfer, from its details through signed recovery.
export default function OperationDialog(props: {
	taskId: string;
	asset: AssetSummary;
	collectionId: string;
	owner: string;
	operation: Operation;
	visible: boolean;
	restoreFallback(): HTMLElement | null;
	onUpdate(
		id: string,
		patch: Pick<OperationActivity, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>,
		assetId: string
	): void;
	onOperation(operation: Operation): void;
	onHide(): void;
	onClose(resumeLater?: boolean, refresh?: boolean): void;
	onViewAsset(): void;
}) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	const [value, setValue] = React.useState(() => initialOperationValue(props.operation));
	const errorMessages = useAppErrorMessages();
	const titleId = React.useId();
	const operationLabelId = React.useId();
	const fieldHelpId = React.useId();
	const quoteStatusId = React.useId();
	const dialogHide = useTransactionDialogHide(props.visible, props.onHide);
	const quote = usePurchaseQuote({ operation: props.operation, assetId: props.asset.id, owner: props.owner });
	const flow = useAtomicOperationFlow({
		taskId: props.taskId,
		asset: props.asset,
		collectionId: props.collectionId,
		owner: props.owner,
		operation: props.operation,
		visible: props.visible,
		value,
		onUpdate: props.onUpdate,
		onOperation: props.onOperation,
		onClose: props.onClose,
	});
	const view = flow.view;
	const kind = props.operation.kind;
	const registrationId = flow.purchaseState?.registration?.id;
	const paymentId = flow.purchaseState?.payment?.id;

	function handleDismiss() {
		const action = transactionDialogDismissAction(view.phase, view.resumable);
		if (action.kind === 'close') {
			props.onClose(action.resumeLater, action.refresh);
			return;
		}
		dialogHide.hide();
	}

	function handleViewCurrentState() {
		props.onClose(false);
	}

	return (
		<Dialog
			backdropClassName="dialog-backdrop operation-panel-backdrop"
			className={`dialog operation-side-panel${view.phase === 'working' ? '' : ' dialog-compact'}${
				view.phase === 'form' ? ' dialog-form-phase' : ''
			}`}
			focusKey={view.phase}
			hiding={dialogHide.hiding}
			keepMounted={view.phase === 'working'}
			labelledBy={`${operationLabelId} ${titleId}`}
			onDismiss={handleDismiss}
			open={props.visible}
			panelRef={dialogHide.panelRef}
			restoreFallback={props.restoreFallback}
		>
			<DialogHeading
				artwork={
					view.phase === 'working' ? (
						props.asset.image ? (
							<ArtworkImage
								alt=""
								className="dialog-asset-artwork"
								decoding="async"
								loading="eager"
								src={props.asset.image}
								unavailableLabel={messages.operationArtworkUnavailable}
							/>
						) : (
							<span aria-hidden="true" className="dialog-asset-artwork dialog-asset-artwork-fallback">
								{props.asset.name.slice(0, 1)}
							</span>
						)
					) : null
				}
				control={
					<TransactionDialogControl
						closeLabel={messages.operationDialogClose}
						hideLabel={messages.operationDialogHideTransaction}
						hiding={dialogHide.hiding}
						phase={view.phase}
						onClick={handleDismiss}
					/>
				}
				eyebrow={view.label}
				eyebrowId={operationLabelId}
				layout="asset"
				title={props.asset.name}
				titleId={titleId}
			/>
			<OperationOutcomeAnnouncement
				active={view.phase === 'done'}
				title={view.result.title}
				detail={view.result.detail}
			/>
			{view.phase === 'working' && kind === 'buy' ? <AtomicPurchaseSequence state={flow.purchaseState} /> : null}
			{view.phase === 'approval' && kind === 'buy' ? (
				<PurchaseRecoveryApproval
					approvalCount={view.recoveryApprovalCount}
					prompt={view.recoveryApprovalPrompt}
					registrationId={
						props.operation.kind === 'buy' ? props.operation.resume?.registration?.id : undefined
					}
					seller={view.order?.creator ?? ''}
					sellerPrice={view.sellerPrice}
					onApprove={flow.submit}
				/>
			) : null}
			{view.phase === 'form' ? (
				<AtomicOperationForm
					actionLabel={view.actionLabel}
					fieldHelpId={fieldHelpId}
					formError={view.formError}
					kind={kind}
					operationValue={view.value}
					quote={purchaseQuoteView(quote.state, errorMessages)}
					quoteStatusId={quoteStatusId}
					reservationMinimum={view.reservationMinimum}
					seller={view.order?.creator ?? ''}
					sellerPrice={view.sellerPrice}
					value={value}
					onRetryQuote={quote.retry}
					onSubmit={flow.submit}
					onValueChange={setValue}
				/>
			) : null}
			{view.phase === 'working' ? (
				<AtomicOperationProgress
					active={props.visible}
					activeStep={view.activeStep}
					observable={view.recoverable}
					pendingAfterConfirmation={view.pendingAfterConfirmation}
					purchase={kind === 'buy'}
					recovering={view.recovering}
					skipKind={view.skipKind}
					startedAt={flow.startedAt}
					status={view.workingStatus}
					steps={view.steps}
					subject={props.asset.name}
					onSkip={view.canSkip ? flow.skipPurchaseObservation : undefined}
				/>
			) : null}
			{view.phase === 'done' ? (
				<AtomicOperationOutcome
					active={props.visible}
					asset={props.asset}
					kind={kind}
					orderId={view.order?.orderId ?? ''}
					paymentConfirmations={view.paymentConfirmations}
					paymentId={paymentId}
					purchaseSteps={view.purchaseSteps}
					registrationId={registrationId}
					result={view.result}
					seller={view.order?.creator ?? ''}
					sellerPrice={view.sellerPrice}
					startedAt={flow.startedAt}
					transactionId={flow.transactionId}
					value={view.value}
					onViewAsset={props.onViewAsset}
				/>
			) : null}
			{view.phase === 'error' ? (
				<AtomicOperationFailure
					failureKind={flow.failureKind}
					failureStage={view.failureStage}
					hasTransaction={flow.transactionId !== null}
					kind={kind}
					message={view.message}
					orderId={view.order?.orderId ?? ''}
					paymentId={paymentId}
					purchaseFailureReason={view.purchaseFailure?.reason}
					recoverable={view.recoverable}
					registrationId={registrationId}
					seller={view.order?.creator ?? ''}
					terminalReservationFailure={view.terminalReservationFailure}
					onDiscardRejectedSignature={flow.discardRejectedSignature}
					onRestartPurchase={flow.restartPurchase}
					onResubmit={flow.submit}
					onReturnToForm={flow.returnToForm}
					onStartFreshPurchase={flow.startFreshPurchase}
					onViewCurrentState={handleViewCurrentState}
				/>
			) : null}
		</Dialog>
	);
}
