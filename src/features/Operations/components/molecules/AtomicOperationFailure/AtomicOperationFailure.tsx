import type { Operation } from 'api/operations';

import { Button } from 'components/atoms/Button';
import type { AppErrorReason } from 'helpers/app-error';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';
import type { OperationFailureKind } from '../../../model/atomic-operation';
import { AtomicOperationErrorAlert } from '../AtomicOperationErrorAlert';
import { PurchaseSettlementReceipt } from '../PurchaseSettlementReceipt';

// A failed atomic operation with the one recovery action its failure allows.
export default function AtomicOperationFailure(props: {
	kind: Operation['kind'];
	message: string;
	failureKind: OperationFailureKind | null;
	purchaseFailureReason: AppErrorReason | undefined;
	failureStage: string;
	terminalReservationFailure: boolean;
	recoverable: boolean;
	seller: string;
	orderId: string;
	registrationId?: string;
	paymentId?: string;
	hasTransaction: boolean;
	onViewCurrentState(): void;
	onStartFreshPurchase(): void;
	onResubmit(): void;
	onRestartPurchase(): void;
	onDiscardRejectedSignature(): void;
	onReturnToForm(): void;
}) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	return (
		<div className="result error">
			<AtomicOperationErrorAlert message={props.message} />
			{props.failureKind === 'market-state-changed' ? (
				<Button data-dialog-initial type="button" onClick={props.onViewCurrentState} size="custom">
					{messages.viewUpdatedAsset}
				</Button>
			) : props.kind === 'buy' ? (
				<>
					<PurchaseSettlementReceipt
						orderId={props.orderId}
						paymentId={props.paymentId}
						registrationId={props.registrationId}
						seller={props.seller}
						summary={props.failureStage}
						summaryLabel={messages.failureStageLabel}
					/>
					{props.purchaseFailureReason === 'registration-dispatch-rejected' ? (
						<Button data-dialog-initial onClick={props.onViewCurrentState} size="custom">
							{messages.failureViewCurrentListing}
						</Button>
					) : props.terminalReservationFailure ? (
						<Button data-dialog-initial onClick={props.onStartFreshPurchase} size="custom">
							{messages.failureStartNewPurchase}
						</Button>
					) : props.purchaseFailureReason === 'payment-dispatch-rejected' ? (
						<Button data-dialog-initial onClick={props.onResubmit} size="custom">
							{messages.failureSignReplacementPayment}
						</Button>
					) : (
						<Button data-dialog-initial onClick={props.onRestartPurchase} size="custom">
							{props.recoverable ? messages.failureContinueSavedPurchase : messages.failureTryAgain}
						</Button>
					)}
				</>
			) : props.failureKind === 'transaction-rejected' && props.hasTransaction ? (
				<Button data-dialog-initial size="custom" onClick={props.onDiscardRejectedSignature} variant="danger">
					{messages.failureDiscardRejectedSignature}
				</Button>
			) : props.hasTransaction ? (
				<Button data-dialog-initial onClick={props.onResubmit} size="custom">
					{messages.failureResumeSignedTransaction}
				</Button>
			) : (
				<Button data-dialog-initial size="custom" onClick={props.onReturnToForm}>
					{messages.failureTryAgain}
				</Button>
			)}
		</div>
	);
}
