import React from 'react';
import { ArrowLeft, RefreshCw, ShoppingCart, Tag } from 'lucide-react';

import type { AssetSummary } from 'api/collections';
import { discoverPendingAssetOffers, type PendingAssetOffer } from 'api/discovery';
import { readAssetStateWithDeadline } from 'api/marketplace';
import type { AssetObserverNetworkLease } from 'api/observers';
import {
	acquireWalletOperationClaim,
	atomicPurchaseStorageKey,
	discardNewlyPreparedTransactionIfAborted,
	hasRecoverablePurchase,
	latestPurchaseSnapshot,
	type Operation,
	operationClaimStorageKey,
	operationLabel,
	operationStorageKey,
	promoteWalletOperationClaim,
	purchaseRecoveryApprovalCopy,
	purchaseRecoveryApprovalCount,
	releaseWalletOperationClaim,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	repairRejectedPurchase,
	shouldAutomaticallyResumePurchase,
	storeWalletRecordIf,
	storeWalletRecordOrThrow,
	type WalletOperationClaim,
} from 'api/operations';
import {
	type Consensus,
	continuePaymentConfirmations,
	loadAtomicTransactionRuntime,
	type ObserverView,
	type PreparedTransaction,
	PURCHASE_PAYMENT_TARGET,
	PURCHASE_REGISTRATION_TARGET,
	PURCHASE_SKIP_FROM_DEPTH,
	type PurchaseCostEstimate,
	purchaseObservationCheckingMessage,
	purchaseObservationPendingState,
	purchaseObservationResumeState,
	purchaseObservationRetryDelay,
	purchaseObservationRetryKind,
	purchaseObservationRetryMessage,
	purchaseSkipKind,
	type PurchaseSnapshot,
	type PurchaseState,
	purchaseStateFailure,
	type SwapPurchase,
	waitForPurchaseObservationRetry,
	withContinuingPaymentObservation,
} from 'api/transactions';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { TextInput } from 'components/atoms/TextInput';
import { DialogHeading } from 'components/molecules/DialogHeading';
import {
	OperationExternalLink,
	OperationOutcome,
	OperationOutcomeAnnouncement,
	OperationOutcomeSubject,
} from 'components/molecules/OperationOutcomeAnnouncement';
import {
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
	TransactionDialogControl,
	transactionDialogDismissAction,
} from 'components/molecules/TransactionDialogControl';
import { Dialog } from 'components/organisms/Dialog';
import { WalletAddress, WalletIdentity } from 'components/organisms/WalletAddress';
import {
	type ArweaveSyncStep,
	LazyArweaveTransactionSync,
	postConfirmationPendingLabel,
	quorumConfirmationDepth,
} from 'features/TransactionSync';
import { type AppError, appError, appErrorMessage, appErrorReasonMessage, toAppError } from 'helpers/app-error';
import { arToWinston, winstonToAr } from 'helpers/ar-units';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';
import { OperationActivity } from 'providers/OperationActivityProvider';

import {
	atomicOperationActionLabel,
	atomicOperationFailureMessage,
	atomicOperationFormError,
	atomicOperationResult,
	atomicOperationStateError,
	atomicOperationValue,
	atomicPurchaseFailureStage,
	atomicPurchaseHasTerminalReservationFailure,
	type OperationFailureKind,
	operationFailureKind,
	pendingListingFailure,
	purchaseGatewayForRecovery,
	purchaseOrderOf,
	purchaseSnapshot,
	purchaseStatusMessage,
} from '../../../model/atomic-operation';
import { AtomicOperationErrorAlert } from '../../molecules/AtomicOperationErrorAlert';
import { AtomicPurchaseSequence } from '../../molecules/AtomicPurchaseSequence';

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
	const recoveryApprovalCount =
		props.operation.kind === 'buy' && props.operation.resume
			? purchaseRecoveryApprovalCount(props.operation.resume)
			: 0;
	const recoveryApprovalCopy =
		props.operation.kind === 'buy' && props.operation.resume
			? purchaseRecoveryApprovalCopy(props.operation.resume, { externalOrigin: props.operation.externalOrigin })
			: null;
	const [value, setValue] = React.useState(
		props.operation.kind === 'sell' || props.operation.kind === 'transfer' ? props.operation.value ?? '' : ''
	);
	const [phase, setPhase] = React.useState<'form' | 'approval' | 'working' | 'done' | 'error'>(
		props.operation.kind === 'buy' && props.operation.resume
			? recoveryApprovalCount
				? 'approval'
				: 'working'
			: props.operation.kind !== 'buy' && props.operation.resumeId
			? 'working'
			: 'form'
	);
	const [message, setMessage] = React.useState('');
	const [failureKind, setFailureKind] = React.useState<OperationFailureKind | null>(null);
	const [views, setViews] = React.useState<ObserverView[]>([]);
	const [confirmations, setConfirmations] = React.useState(0);
	const [consensus, setConsensus] = React.useState<Consensus | null>(null);
	const [transaction, setTransaction] = React.useState<PreparedTransaction | null>(null);
	const [purchaseState, setPurchaseState] = React.useState<PurchaseState | null>(null);
	const [purchaseQuote, setPurchaseQuote] = React.useState<PurchaseCostEstimate | null>(null);
	const [purchaseWalletBalance, setPurchaseWalletBalance] = React.useState<bigint | null>(null);
	const [quoteError, setQuoteError] = React.useState('');
	const [quoteRetry, setQuoteRetry] = React.useState(0);
	const [hiding, setHiding] = React.useState(false);
	const purchaseRef = React.useRef<SwapPurchase | null>(null);
	const networkRef = React.useRef<AssetObserverNetworkLease | null>(null);
	const claimRef = React.useRef<WalletOperationClaim | null>(null);
	const submittedAtRef = React.useRef<number>();
	const exactActionBaselineRef = React.useRef<{ startingSlot: number } | null>(
		(props.operation.kind === 'cancel' || props.operation.kind === 'transfer') &&
			Number.isSafeInteger(props.operation.startingSlot)
			? { startingSlot: props.operation.startingSlot! }
			: (props.operation.kind === 'cancel' || props.operation.kind === 'transfer') && props.operation.resumeId
			? { startingSlot: 0 }
			: null
	);
	const attemptRef = React.useRef(new AbortController());
	const lifecycleRef = React.useRef<object | null>(null);
	const hideTimerRef = React.useRef<number | null>(null);
	const dialogRef = React.useRef<HTMLElement | null>(null);
	const titleId = React.useId();
	const operationLabelId = React.useId();
	const fieldHelpId = React.useId();
	const quoteStatusId = React.useId();
	const operationValue = atomicOperationValue(props.operation.kind, value);

	React.useEffect(() => {
		const lifecycle = {};
		lifecycleRef.current = lifecycle;
		return () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
			queueMicrotask(() => {
				if (lifecycleRef.current !== lifecycle) return;
				attemptRef.current.abort();
				purchaseRef.current?.abandon();
				networkRef.current?.release();
				if (claimRef.current) {
					releaseWalletOperationClaim(localStorage, claimRef.current);
					claimRef.current = null;
				}
			});
		};
	}, []);
	React.useEffect(() => {
		if (props.visible) setHiding(false);
	}, [props.visible]);
	React.useEffect(() => {
		const paymentId = purchaseState?.payment?.id;
		if (phase !== 'done' || props.operation.kind !== 'buy' || !props.visible || !paymentId) return;
		const network = networkRef.current?.network;
		if (!network) return;
		const watcher = continuePaymentConfirmations(network, paymentId, (observation) => {
			setPurchaseState((current) => withContinuingPaymentObservation(current, paymentId, observation));
		});
		return () => watcher.stop();
	}, [props.operation.kind, phase, purchaseState?.payment?.id, props.visible]);
	React.useEffect(() => {
		if (props.operation.kind !== 'buy' || props.operation.resume) return;
		const controller = new AbortController();
		setPurchaseQuote(null);
		setPurchaseWalletBalance(null);
		setQuoteError('');
		void loadAtomicTransactionRuntime()
			.then(async ({ AssetTransactionClient }) => {
				const client = new AssetTransactionClient();
				return Promise.all([
					client.estimatePurchaseCosts(purchaseOrderOf(props.operation), props.asset.id, controller.signal),
					client.walletBalance(props.owner, controller.signal),
				]);
			})
			.then(
				([quote, balance]) => {
					if (!controller.signal.aborted) {
						setPurchaseQuote(quote);
						setPurchaseWalletBalance(balance);
					}
				},
				(cause) => {
					if (!controller.signal.aborted) setQuoteError(appErrorMessage(toAppError(cause, 'unknown')));
				}
			);
		return () => controller.abort();
	}, [
		props.asset.id,
		props.operation.kind === 'buy' ? purchaseOrderOf(props.operation).orderId : '',
		props.operation.kind === 'buy' ? props.operation.resume : undefined,
		props.owner,
		quoteRetry,
	]);
	const resumed = React.useRef(false);
	React.useEffect(() => {
		const shouldResume =
			(props.operation.kind === 'buy' && shouldAutomaticallyResumePurchase(props.operation.resume)) ||
			(props.operation.kind !== 'buy' && props.operation.resumeId);
		if (!shouldResume || resumed.current) return;
		resumed.current = true;
		void submit();
	}, []);

	async function submit() {
		const validation = atomicOperationFormError(props.operation.kind, operationValue, props.owner);
		if (validation) {
			setMessage(appErrorReasonMessage(validation));
			return;
		}
		submittedAtRef.current ??= Date.now();
		setMessage('');
		setFailureKind(null);
		setPhase('working');
		let operationClaim: WalletOperationClaim | null = null;
		let attemptedTransactionId =
			props.operation.kind === 'buy' ? undefined : props.operation.resumeId ?? transaction?.id;
		try {
			let currentPurchaseSnapshot =
				props.operation.kind === 'buy'
					? latestPurchaseSnapshot(
							props.operation.resume,
							purchaseState ? purchaseSnapshot(purchaseState) : null
					  )
					: null;
			const freshOperation =
				props.operation.kind === 'buy'
					? !hasRecoverablePurchase(currentPurchaseSnapshot)
					: !props.operation.resumeId && !transaction;
			const signal = attemptRef.current.signal;
			const operationKey = operationStorageKey(props.asset.id, props.owner);
			const purchaseKey = atomicPurchaseStorageKey(props.asset.id, props.owner);
			const resumeTransactionId =
				props.operation.kind === 'buy' ? undefined : props.operation.resumeId ?? transaction?.id;
			let exactActionBaseline = exactActionBaselineRef.current;
			const recoveryRegistrationId = currentPurchaseSnapshot?.registration?.id;
			const recovery =
				!freshOperation && props.operation.kind === 'buy' && recoveryRegistrationId
					? localStorage.getItem(purchaseKey)
						? {
								key: purchaseKey,
								matches: (record: any) =>
									record?.buyer === props.owner &&
									record?.order?.orderId === purchaseOrderOf(props.operation).orderId &&
									record?.snapshot?.registration?.id === recoveryRegistrationId,
						  }
						: undefined
					: !freshOperation
					? {
							key: operationKey,
							matches: (record: any) => record?.txId === resumeTransactionId,
					  }
					: undefined;
			operationClaim = await acquireWalletOperationClaim(
				localStorage,
				operationClaimStorageKey(props.asset.id, props.owner),
				[operationKey, purchaseKey],
				recovery ? { recovery } : {}
			);
			claimRef.current = operationClaim;
			if (freshOperation) {
				const { state: freshState } = await readAssetStateWithDeadline(props.asset.id, { signal, maxAge: 0 });
				const stateError = atomicOperationStateError(
					props.operation.kind,
					freshState,
					props.owner,
					'order' in props.operation ? purchaseOrderOf(props.operation) : null
				);
				if (stateError) throw appError(stateError);
				if (props.operation.kind === 'sell') {
					let pendingOffers: PendingAssetOffer[];
					try {
						pendingOffers = await discoverPendingAssetOffers(props.asset.id, freshState, { signal });
					} catch (cause) {
						if (signal.aborted) throw cause;
						throw appError('asset-pending-listing-check-unavailable', { cause });
					}
					const pendingOffer = pendingOffers.find((offer) => offer.actor === props.owner) ?? pendingOffers[0];
					if (pendingOffer) throw pendingListingFailure(pendingOffer, props.owner);
				}
				if (props.operation.kind === 'cancel' || props.operation.kind === 'transfer') {
					const startingSlot = Number(freshState.raw['at-slot']);
					if (!Number.isSafeInteger(startingSlot) || startingSlot < 0) {
						throw appError('asset-action-starting-slot-unavailable');
					}
					exactActionBaseline = { startingSlot };
					exactActionBaselineRef.current = exactActionBaseline;
				}
			}
			const runtime = await loadAtomicTransactionRuntime();
			const client = new runtime.AssetTransactionClient();
			if (props.operation.kind === 'buy') {
				const observerLease = runtime.acquireAssetObserverNetwork();
				networkRef.current = observerLease;
				await observerLease.ready;
				const network = observerLease.network;
				if (signal.aborted) throw signal.reason;
				let observationRetryAttempt = 0;
				let completedSnapshot: PurchaseSnapshot | null = null;
				const persistPurchaseSnapshot = (snapshot: PurchaseSnapshot) => {
					props.onOperation({ kind: 'buy', order: purchaseOrderOf(props.operation), resume: snapshot });
					const record = {
						asset: { id: props.asset.id, name: props.asset.name },
						activityKind: 'atomic',
						buyer: props.owner,
						collectionId: props.collectionId,
						gateway: purchaseGatewayForRecovery(purchaseKey),
						order: purchaseOrderOf(props.operation),
						snapshot,
						createdAt: submittedAtRef.current ?? Date.now(),
					};
					const matches = (current: any) =>
						current?.buyer === props.owner &&
						current?.order?.orderId === purchaseOrderOf(props.operation).orderId &&
						current?.snapshot?.registration?.id === snapshot.registration?.id;
					if (operationClaim) {
						promoteWalletOperationClaim(
							localStorage,
							operationClaim,
							atomicPurchaseStorageKey(props.asset.id, props.owner),
							record,
							matches
						);
					} else {
						storeWalletRecordOrThrow<any>(
							localStorage,
							atomicPurchaseStorageKey(props.asset.id, props.owner),
							record,
							matches,
							true
						);
					}
				};
				if (currentPurchaseSnapshot?.registration?.id && !currentPurchaseSnapshot.payment?.id) {
					const registration = currentPurchaseSnapshot.registration;
					const preparationAdapter = client.purchaseAdapter({
						processId: props.asset.id,
						order: purchaseOrderOf(props.operation),
						buyer: props.owner,
						startingBalance: '0',
						network,
						onPrepared: (event) => {
							if (event.kind !== 'payment') return;
							const snapshot = {
								...currentPurchaseSnapshot!,
								payment: { id: event.transactionId, dispatched: false },
							};
							persistPurchaseSnapshot(snapshot);
							currentPurchaseSnapshot = snapshot;
						},
					});
					if (!registration.dispatched) {
						await preparationAdapter.restorePrepared?.('registration', registration.id, signal);
					}
					await preparationAdapter.preparePayment(registration.id, signal);
					if (signal.aborted) throw signal.reason;
				}
				while (!completedSnapshot) {
					const purchase = new runtime.SwapPurchase(
						network,
						client.purchaseAdapter({
							processId: props.asset.id,
							order: purchaseOrderOf(props.operation),
							buyer: props.owner,
							startingBalance: '0',
							network,
						}),
						{
							registrationTarget: PURCHASE_REGISTRATION_TARGET,
							paymentTarget: PURCHASE_PAYMENT_TARGET,
							paymentSuccessDepth: 1,
							skipFrom: PURCHASE_SKIP_FROM_DEPTH,
							propagation: 'all',
							minObservers: 2,
							...(currentPurchaseSnapshot ? { resume: currentPurchaseSnapshot } : {}),
						}
					);
					purchaseRef.current = purchase;
					let recoveryConflict: AppError | null = null;
					const update = (state: PurchaseState) => {
						if (signal.aborted || recoveryConflict) return;
						setPurchaseState(state);
						const snapshot = purchase.snapshot();
						if (hasRecoverablePurchase(snapshot)) {
							try {
								persistPurchaseSnapshot(snapshot);
							} catch (cause) {
								recoveryConflict = toAppError(cause, 'unknown');
								purchase.abandon();
							}
						}
					};
					purchase.on('state', update);
					purchase.on('failed', update);
					purchase.on('complete', update);
					const resumeState = purchaseObservationResumeState(currentPurchaseSnapshot, purchaseState);
					if (resumeState) setPurchaseState(resumeState);
					else update(purchase.state());
					const finalState = await purchase.run();
					if (recoveryConflict) throw recoveryConflict;
					const retryKind = purchaseObservationRetryKind(finalState);
					if (retryKind) {
						currentPurchaseSnapshot = purchase.snapshot();
						const delay = purchaseObservationRetryDelay(observationRetryAttempt++);
						setPurchaseState(purchaseObservationPendingState(finalState));
						setFailureKind(null);
						setMessage(purchaseObservationRetryMessage(finalState, delay));
						await waitForPurchaseObservationRetry(delay, signal);
						setMessage(purchaseObservationCheckingMessage(retryKind));
						continue;
					}
					if (finalState.stage !== 'complete' || !finalState.success) {
						const failure =
							purchaseStateFailure(finalState) ??
							appError('unknown', { message: 'asset-purchase-failed' });
						const snapshot = purchase.snapshot();
						const repaired = repairRejectedPurchase(snapshot, failure.reason);
						for (const id of repaired.discardIds) {
							localStorage.removeItem(`bazar-signed-transaction:${id}`);
						}
						if (!repaired.snapshot) {
							removeWalletRecordIf<any>(
								localStorage,
								purchaseKey,
								(record) =>
									record?.buyer === props.owner &&
									record?.order?.orderId === purchaseOrderOf(props.operation).orderId &&
									record?.snapshot?.registration?.id === snapshot.registration?.id
							);
							props.onOperation({ kind: 'buy', order: purchaseOrderOf(props.operation) });
						} else if (repaired.snapshot !== snapshot) {
							storeWalletRecordOrThrow<any>(
								localStorage,
								purchaseKey,
								{
									asset: { id: props.asset.id, name: props.asset.name },
									activityKind: 'atomic',
									buyer: props.owner,
									collectionId: props.collectionId,
									gateway: purchaseGatewayForRecovery(purchaseKey),
									order: purchaseOrderOf(props.operation),
									snapshot: repaired.snapshot,
									createdAt: submittedAtRef.current ?? Date.now(),
								},
								(record) =>
									record?.buyer === props.owner &&
									record?.order?.orderId === purchaseOrderOf(props.operation).orderId &&
									record?.snapshot?.registration?.id === snapshot.registration?.id
							);
							setPurchaseState({ ...finalState, payment: undefined });
						}
						throw failure;
					}
					completedSnapshot = purchase.snapshot();
				}
				removeWalletRecoveryAndSignatures<any>(
					localStorage,
					atomicPurchaseStorageKey(props.asset.id, props.owner),
					(record) =>
						record?.buyer === props.owner &&
						record?.order?.orderId === purchaseOrderOf(props.operation).orderId &&
						record?.snapshot?.registration?.id === completedSnapshot.registration?.id,
					[completedSnapshot.registration?.id, completedSnapshot.payment?.id],
					props.owner
				);
				if (operationClaim) {
					releaseWalletOperationClaim(localStorage, operationClaim);
					operationClaim = null;
					claimRef.current = null;
				}
				setPhase('done');
				return;
			}
			let prepared: PreparedTransaction;
			let newlyPrepared = false;
			if (transaction) {
				prepared = transaction;
			} else if (props.operation.resumeId) {
				prepared = client.restore(props.operation.resumeId, props.owner);
			} else if (props.operation.kind === 'sell') {
				const winston = arToWinston(value);
				prepared = await client.makeOffer(
					{ processId: props.asset.id, quantity: '1', asking: winston, seller: props.owner },
					signal
				);
				newlyPrepared = true;
			} else if (props.operation.kind === 'cancel') {
				prepared = await client.cancelOrder(
					props.asset.id,
					purchaseOrderOf(props.operation).orderId,
					props.owner,
					signal
				);
				newlyPrepared = true;
			} else if (props.operation.kind === 'transfer') {
				prepared = await client.transfer(props.asset.id, operationValue, '1', props.owner, signal);
				newlyPrepared = true;
			} else throw appError('invalid-input', { message: 'invalid-operation' });
			attemptedTransactionId = prepared.id;
			if ((props.operation.kind === 'cancel' || props.operation.kind === 'transfer') && !exactActionBaseline) {
				throw appError('asset-action-recovery-baseline-missing');
			}
			if (discardNewlyPreparedTransactionIfAborted(localStorage, prepared.id, newlyPrepared, signal)) {
				throw signal.reason;
			}
			setTransaction(prepared);
			props.onOperation(
				props.operation.kind === 'cancel'
					? {
							kind: 'cancel',
							order: purchaseOrderOf(props.operation),
							resumeId: prepared.id,
							startingSlot: exactActionBaseline!.startingSlot,
					  }
					: props.operation.kind === 'transfer'
					? {
							kind: 'transfer',
							resumeId: prepared.id,
							startingSlot: exactActionBaseline!.startingSlot,
							value: operationValue,
					  }
					: { kind: 'sell', resumeId: prepared.id, value: operationValue }
			);
			const operationRecord = {
				txId: prepared.id,
				kind: props.operation.kind,
				assetId: props.asset.id,
				asset: {
					id: props.asset.id,
					name: props.asset.name,
					...(props.asset.image ? { image: props.asset.image } : {}),
				},
				activityKind: 'atomic',
				collectionId: props.collectionId,
				signer: props.owner,
				...(props.operation.kind === 'cancel'
					? { order: purchaseOrderOf(props.operation), startingSlot: exactActionBaseline!.startingSlot }
					: props.operation.kind === 'transfer'
					? { value: operationValue, startingSlot: exactActionBaseline!.startingSlot }
					: { value: operationValue }),
				createdAt: Date.now(),
			};
			try {
				const matches = (current: any) => current?.txId === prepared.id;
				if (operationClaim) {
					promoteWalletOperationClaim(
						localStorage,
						operationClaim,
						operationStorageKey(props.asset.id, props.owner),
						operationRecord,
						matches
					);
				} else {
					storeWalletRecordOrThrow<any>(
						localStorage,
						operationStorageKey(props.asset.id, props.owner),
						operationRecord,
						matches,
						true
					);
				}
			} catch (cause) {
				localStorage.removeItem(`bazar-signed-transaction:${prepared.id}`);
				setTransaction(null);
				throw cause;
			}
			setViews([]);
			setConfirmations(0);
			setConsensus(null);
			await runtime.dispatchAndConfirm(prepared, {
				signal,
				target: 5,
				onViews: setViews,
				onConsensus: setConsensus,
				onProgress: (progress) => setConfirmations(progress.confirmations),
			});
			setConfirmations(5);
			setMessage('Five confirmations reached. Waiting for the scheduler safety depth and live asset state…');
			if (props.operation.kind === 'sell') {
				await client.waitForOfferAcceptance(
					props.asset.id,
					{
						orderId: prepared.id,
						seller: props.owner,
						quantity: '1',
						asking: arToWinston(value),
					},
					signal
				);
			} else if (props.operation.kind === 'cancel') {
				await client.waitForExactCancellation(
					props.asset.id,
					prepared.id,
					props.owner,
					purchaseOrderOf(props.operation),
					exactActionBaseline!,
					signal
				);
			} else if (props.operation.kind === 'transfer') {
				await client.waitForFungibleTransfer(
					props.asset.id,
					prepared.id,
					props.owner,
					operationValue,
					'1',
					exactActionBaseline!,
					signal
				);
			}
			removeWalletRecoveryAndSignatures<any>(
				localStorage,
				operationStorageKey(props.asset.id, props.owner),
				(record) => record?.txId === prepared.id,
				[prepared.id],
				props.owner
			);
			if (operationClaim) {
				releaseWalletOperationClaim(localStorage, operationClaim);
				operationClaim = null;
				claimRef.current = null;
			}
			setPhase('done');
		} catch (cause) {
			if (operationClaim) releaseWalletOperationClaim(localStorage, operationClaim);
			claimRef.current = null;
			networkRef.current?.release();
			networkRef.current = null;
			if (attemptRef.current.signal.aborted) return;
			const failure = toAppError(cause, 'unknown');
			if (
				(failure.reason === 'asset-cancel-rejected' || failure.reason === 'fungible-transfer-rejected') &&
				attemptedTransactionId
			) {
				removeWalletRecordIf<any>(
					localStorage,
					operationStorageKey(props.asset.id, props.owner),
					(record) => record?.txId === attemptedTransactionId
				);
				localStorage.removeItem(`bazar-signed-transaction:${attemptedTransactionId}`);
				setTransaction(null);
			}
			setFailureKind(operationFailureKind(failure));
			setMessage(atomicOperationFailureMessage(failure, props.owner));
			setPhase('error');
		}
	}

	const purchaseSteps: ArweaveSyncStep[] =
		purchaseState && hasRecoverablePurchase(purchaseState)
			? [
					{
						key: 'register',
						label: 'Reserve asset',
						target: PURCHASE_REGISTRATION_TARGET,
						transaction: purchaseState.registration,
					},
					{
						key: 'pay',
						label: 'Pay seller',
						target: PURCHASE_PAYMENT_TARGET,
						terminal: true,
						transaction: purchaseState.payment,
					},
			  ]
			: [];
	const steps: ArweaveSyncStep[] = transaction
		? [
				{
					key: props.operation.kind,
					label: operationLabel(props.operation.kind),
					target: 5,
					terminal: true,
					confirmations,
					transaction: { id: transaction.id, views, ...(consensus ? { consensus } : {}) },
				},
		  ]
		: purchaseSteps;
	const activeStep =
		purchaseState?.stage.includes('payment') || purchaseState?.stage === 'ownership-verifying'
			? 'pay'
			: props.operation.kind === 'buy'
			? 'register'
			: props.operation.kind;
	const activeSyncStep = steps.find((step) => step.key === activeStep) ?? steps[0];
	const confirmationTarget = activeSyncStep?.target ?? 5;
	const activityConfirmations = Math.min(confirmationTarget, quorumConfirmationDepth(activeSyncStep));
	const visiblePhase =
		props.operation.kind === 'buy' && phase === 'done' && purchaseState?.stage !== 'complete' ? 'error' : phase;
	const purchaseFailure = purchaseStateFailure(purchaseState);
	const visibleMessage = message || (purchaseFailure ? appErrorMessage(purchaseFailure) : '');
	const workingStatus = message || purchaseStatusMessage(purchaseState);
	const pendingAfterConfirmation =
		purchaseState?.stage === 'registration-accepting'
			? 'Checking live reservation'
			: purchaseState?.stage === 'ownership-verifying'
			? 'Checking ownership'
			: postConfirmationPendingLabel(activityConfirmations, confirmationTarget, workingStatus);
	const formError = atomicOperationFormError(props.operation.kind, operationValue, props.owner);
	const recoverable = Boolean(
		transaction ||
			hasRecoverablePurchase(purchaseState) ||
			(props.operation.kind === 'buy' && hasRecoverablePurchase(props.operation.resume))
	);
	const terminalReservationFailure = atomicPurchaseHasTerminalReservationFailure(purchaseState);
	const sellerPrice =
		props.operation.kind === 'buy' || props.operation.kind === 'cancel'
			? `${winstonToAr(purchaseOrderOf(props.operation).asking)} AR`
			: '';
	const purchaseAffordable =
		purchaseQuote && purchaseWalletBalance !== null ? purchaseWalletBalance >= BigInt(purchaseQuote.total) : null;
	const actionLabel = atomicOperationActionLabel(props.operation, operationValue);
	const resultCopy = atomicOperationResult(props.operation.kind, props.asset.name, operationValue, props.owner);
	const reportedStatus =
		visiblePhase === 'form'
			? 'Waiting for details'
			: visiblePhase === 'approval'
			? 'Waiting for wallet approval'
			: visiblePhase === 'working'
			? workingStatus || 'Watching Arweave confirmations…'
			: visiblePhase === 'done'
			? resultCopy.title
			: visibleMessage || 'This transaction needs attention';
	React.useEffect(() => {
		props.onUpdate(
			props.taskId,
			{
				phase: visiblePhase,
				status: reportedStatus,
				confirmations: activityConfirmations,
				confirmationTarget,
			},
			props.asset.id
		);
	}, [
		activityConfirmations,
		props.asset.id,
		confirmationTarget,
		props.onUpdate,
		reportedStatus,
		props.taskId,
		visiblePhase,
	]);
	const restartPurchase = () => {
		if (props.operation.kind !== 'buy' || !recoverable) {
			setMessage('');
			setFailureKind(null);
			setPhase('form');
			return;
		}
		if (purchaseState) {
			const snapshot = purchaseSnapshot(purchaseState);
			if (hasRecoverablePurchase(snapshot)) {
				const record = {
					asset: { id: props.asset.id, name: props.asset.name },
					activityKind: 'atomic',
					buyer: props.owner,
					collectionId: props.collectionId,
					gateway: purchaseGatewayForRecovery(atomicPurchaseStorageKey(props.asset.id, props.owner)),
					order: purchaseOrderOf(props.operation),
					snapshot,
					createdAt: submittedAtRef.current ?? Date.now(),
				};
				storeWalletRecordIf<any>(
					localStorage,
					atomicPurchaseStorageKey(props.asset.id, props.owner),
					record,
					(current) =>
						current?.buyer === props.owner &&
						current?.order?.orderId === purchaseOrderOf(props.operation).orderId &&
						current?.snapshot?.registration?.id === snapshot.registration?.id,
					true
				);
			}
		}
		attemptRef.current.abort();
		purchaseRef.current?.abandon();
		networkRef.current?.release();
		networkRef.current = null;
		props.onClose(false);
	};
	const startFreshPurchase = () => {
		if (props.operation.kind !== 'buy') return;
		const snapshot = latestPurchaseSnapshot(
			props.operation.resume,
			purchaseState ? purchaseSnapshot(purchaseState) : null
		);
		if (snapshot?.registration?.id) {
			removeWalletRecoveryAndSignatures<any>(
				localStorage,
				atomicPurchaseStorageKey(props.asset.id, props.owner),
				(record) =>
					record?.buyer === props.owner &&
					record?.order?.orderId === purchaseOrderOf(props.operation).orderId &&
					record?.snapshot?.registration?.id === snapshot.registration?.id,
				[snapshot.registration.id, snapshot.payment?.id],
				props.owner
			);
		}
		props.onOperation({ kind: 'buy', order: purchaseOrderOf(props.operation) });
		purchaseRef.current = null;
		submittedAtRef.current = undefined;
		setPurchaseState(null);
		setMessage('');
		setFailureKind(null);
		setPhase('form');
	};
	const closeOrHide = () => {
		const action = transactionDialogDismissAction(visiblePhase, recoverable && !terminalReservationFailure);
		if (action.kind === 'close') {
			props.onClose(action.resumeLater, action.refresh);
			return;
		}
		if (hiding) return;
		if (dialogRef.current) {
			prepareTransactionDialogHide(
				dialogRef.current,
				document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]')
			);
		}
		setHiding(true);
		hideTimerRef.current = window.setTimeout(() => {
			hideTimerRef.current = null;
			props.onHide();
		}, TRANSACTION_DIALOG_HIDE_DURATION_MS);
	};
	React.useEffect(() => {
		if (props.visible) setHiding(false);
	}, [props.visible]);
	return (
		<Dialog
			backdropClassName="dialog-backdrop operation-panel-backdrop"
			className={`dialog operation-side-panel${visiblePhase === 'working' ? '' : ' dialog-compact'}${
				visiblePhase === 'form' ? ' dialog-form-phase' : ''
			}`}
			focusKey={visiblePhase}
			hiding={hiding}
			keepMounted={visiblePhase === 'working'}
			labelledBy={`${operationLabelId} ${titleId}`}
			onDismiss={closeOrHide}
			open={props.visible}
			panelRef={dialogRef}
			restoreFallback={props.restoreFallback}
		>
			<DialogHeading
				artwork={
					visiblePhase === 'working' ? (
						props.asset.image ? (
							<ArtworkImage
								alt=""
								className="dialog-asset-artwork"
								decoding="async"
								loading="eager"
								src={props.asset.image}
							/>
						) : (
							<span aria-hidden="true" className="dialog-asset-artwork dialog-asset-artwork-fallback">
								{props.asset.name.slice(0, 1)}
							</span>
						)
					) : null
				}
				control={<TransactionDialogControl hiding={hiding} phase={visiblePhase} onClick={closeOrHide} />}
				eyebrow={operationLabel(props.operation.kind)}
				eyebrowId={operationLabelId}
				layout="asset"
				title={props.asset.name}
				titleId={titleId}
			/>
			<OperationOutcomeAnnouncement
				active={visiblePhase === 'done'}
				title={resultCopy.title}
				detail={resultCopy.detail}
			/>
			{visiblePhase === 'working' && props.operation.kind === 'buy' ? (
				<AtomicPurchaseSequence state={purchaseState} />
			) : null}
			{visiblePhase === 'approval' && props.operation.kind === 'buy' ? (
				<div className="recovery-approval">
					<div>
						<h3>{recoveryApprovalCopy?.title}</h3>
						<p>{recoveryApprovalCopy?.detail}</p>
					</div>
					<div className="operation-summary">
						<span>Seller</span>
						<WalletAddress
							address={purchaseOrderOf(props.operation).creator}
							className="operation-summary-link"
							full
							label="seller"
						/>
						<span>Seller payment</span>
						<strong>
							<ArCurrencyText>{sellerPrice}</ArCurrencyText>
						</strong>
						<span>New approvals</span>
						<strong>{recoveryApprovalCount}</strong>
						{props.operation.resume?.registration?.id ? (
							<small>
								Reservation{' '}
								<a
									href={transactionExplorerUrl(props.operation.resume.registration.id)}
									rel="noreferrer"
									target="_blank"
								>
									<OperationExternalLink>
										{short(props.operation.resume.registration.id)}
									</OperationExternalLink>
								</a>{' '}
								is already signed.
							</small>
						) : null}
					</div>
					<Button
						className="wide"
						data-dialog-initial
						onClick={() => void submit()}
						type="button"
						size="custom"
						variant="primary"
					>
						{recoveryApprovalCopy?.action}
					</Button>
				</div>
			) : null}
			{visiblePhase === 'form' ? (
				<form
					className="operation-form"
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<div className="dialog-form-scroll">
						{props.operation.kind === 'buy' ? (
							<div className="operation-summary">
								<span>Seller</span>
								<WalletAddress
									address={purchaseOrderOf(props.operation).creator}
									className="operation-summary-link"
									full
									label="seller"
								/>
								<span>Seller price</span>
								<strong>
									<ArCurrencyText>{sellerPrice}</ArCurrencyText>
								</strong>
								<span>Network fees</span>
								<strong>
									{quoteError ? (
										'Unavailable'
									) : purchaseQuote ? (
										<ArCurrencyText>{`${winstonToAr(
											(BigInt(purchaseQuote.total) - BigInt(purchaseQuote.asking)).toString()
										)} AR`}</ArCurrencyText>
									) : (
										'Checking…'
									)}
								</strong>
								<span>Maximum total</span>
								<strong>
									{quoteError ? (
										'Unavailable'
									) : purchaseQuote ? (
										<ArCurrencyText>{`${winstonToAr(purchaseQuote.total)} AR`}</ArCurrencyText>
									) : (
										'Checking…'
									)}
								</strong>
								<span>Wallet after purchase</span>
								<strong>
									{quoteError ? (
										'Unavailable'
									) : purchaseQuote && purchaseWalletBalance !== null ? (
										purchaseAffordable ? (
											<ArCurrencyText>{`${winstonToAr(
												(purchaseWalletBalance - BigInt(purchaseQuote.total)).toString()
											)} AR`}</ArCurrencyText>
										) : (
											<ArCurrencyText>Insufficient AR</ArCurrencyText>
										)
									) : (
										'Checking…'
									)}
								</strong>
								<small>
									One asset · native <ArCurrencyLabel /> settlement
								</small>
							</div>
						) : null}
						{props.operation.kind === 'buy' ? (
							<LiveRegion as="p" id={quoteStatusId}>
								<ArCurrencyText>
									{quoteError
										? 'Purchase quote unavailable. Retry the cost check before buying.'
										: purchaseQuote
										? `Purchase quote ready. Maximum total ${winstonToAr(purchaseQuote.total)} AR.${
												purchaseAffordable ? '' : ' This wallet has insufficient AR.'
										  }`
										: 'Checking the exact purchase cost.'}
								</ArCurrencyText>
							</LiveRegion>
						) : null}
						{props.operation.kind === 'buy' ? (
							<div
								className={quoteError ? 'inline-error retry-notice' : 'quote-check-action'}
								role={quoteError ? 'status' : undefined}
							>
								<span>
									{quoteError
										? 'Compute hasn’t completed yet. Please try again.'
										: purchaseQuote
										? 'Costs checked.'
										: 'Checking wallet balance and network fees…'}
								</span>
								<Button
									aria-describedby={quoteStatusId}
									aria-disabled={!purchaseQuote && !quoteError}
									className="with-icon"
									size="custom"
									type="button"
									onClick={() => {
										if (purchaseQuote || quoteError) setQuoteRetry((current) => current + 1);
									}}
								>
									<Icon icon={RefreshCw} size="sm" /> Retry
								</Button>
							</div>
						) : null}
						{props.operation.kind === 'sell' ? (
							<label>
								<span>
									Sale price in <ArCurrencyLabel />
								</span>
								<TextInput
									autoFocus
									data-dialog-initial
									aria-describedby={fieldHelpId}
									aria-invalid={Boolean(value && formError)}
									value={value}
									onChange={(event) => setValue(event.target.value)}
									placeholder="0.25"
								/>
							</label>
						) : null}
						{props.operation.kind === 'transfer' ? (
							<label>
								Recipient wallet address
								<TextInput
									autoFocus
									data-dialog-initial
									aria-describedby={fieldHelpId}
									aria-invalid={Boolean(value && formError)}
									autoCapitalize="none"
									autoComplete="off"
									autoCorrect="off"
									spellCheck={false}
									value={value}
									onChange={(event) => setValue(event.target.value)}
									placeholder="43-character Arweave address"
								/>
							</label>
						) : null}
						{props.operation.kind === 'transfer' && operationValue && !formError ? (
							<div className="operation-summary transfer-review">
								<span>Recipient</span>
								<WalletIdentity address={operationValue} />
								<small>
									Review the complete destination before asking your wallet to approve this
									irreversible transfer.
								</small>
							</div>
						) : null}
						{props.operation.kind === 'cancel' ? (
							<div className="operation-summary">
								<span>Open listing</span>
								<strong>
									<ArCurrencyText>{sellerPrice}</ArCurrencyText>
								</strong>
								<small>Cancelling returns the asset from order escrow to your liquid balance.</small>
							</div>
						) : null}
						{props.operation.kind === 'sell' || props.operation.kind === 'transfer' ? (
							<p
								id={fieldHelpId}
								className={value && formError ? 'field-help field-help-error' : 'field-help'}
								role={value && formError ? 'alert' : undefined}
							>
								{formError ? <ArCurrencyText>{appErrorReasonMessage(formError)}</ArCurrencyText> : null}
							</p>
						) : null}
						<p className="operation-disclosure">
							{props.operation.kind === 'buy'
								? 'Your wallet will ask for two approvals: one reservation and one seller payment. The payment stays local until the reservation is accepted by the network.'
								: 'After signing, Bazar observes this action through independently addressed Arweave nodes. Signed transaction details are saved in this browser so you can return with the same wallet while browser data remains available.'}
						</p>
					</div>
					<Button
						aria-describedby={props.operation.kind === 'buy' ? quoteStatusId : undefined}
						className={`wide${
							props.operation.kind === 'buy' || props.operation.kind === 'sell'
								? ' with-icon market-primary-action'
								: ''
						}`}
						data-dialog-initial
						size="custom"
						disabled={
							Boolean(formError) ||
							(props.operation.kind === 'buy' &&
								(!purchaseQuote || purchaseAffordable !== true || Boolean(quoteError)))
						}
						type="submit"
						variant={props.operation.kind === 'cancel' ? 'danger' : 'primary'}
					>
						{props.operation.kind === 'buy' ? (
							<Icon icon={ShoppingCart} size="sm" />
						) : props.operation.kind === 'sell' ? (
							<Icon icon={Tag} size="sm" />
						) : null}
						{props.operation.kind === 'buy' && purchaseAffordable === false ? (
							<ArCurrencyText>Insufficient AR</ArCurrencyText>
						) : props.operation.kind === 'buy' && purchaseQuote ? (
							<ArCurrencyText>{`Buy · up to ${winstonToAr(purchaseQuote.total)} AR`}</ArCurrencyText>
						) : (
							<ArCurrencyText>{actionLabel}</ArCurrencyText>
						)}
					</Button>
				</form>
			) : null}
			{visiblePhase === 'working' && !steps.length ? (
				<div className="operation-preparing">
					<Loading
						label={
							(props.operation.kind === 'buy' ? props.operation.resume : props.operation.resumeId)
								? 'Recovering the signed transaction…'
								: 'Preparing secure wallet approvals…'
						}
					/>
					<p>
						{props.operation.kind === 'buy'
							? 'Bazar may contact observer nodes while preparing the reservation and seller payment, but no transaction is submitted until its signing step completes.'
							: 'Bazar is preparing the Arweave transaction. The network view will appear as soon as the signed transaction is recoverable.'}
					</p>
				</div>
			) : null}
			{visiblePhase === 'working' && recoverable ? (
				<div className="operation-working">
					<LiveRegion as="p">
						{workingStatus ||
							'Watching independently addressed Arweave nodes report confirmations for this action.'}
					</LiveRegion>
					<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
						<LazyArweaveTransactionSync
							active={props.visible}
							skipKind={purchaseSkipKind(purchaseState)}
							onSkip={
								purchaseState?.canSkip
									? () => {
											purchaseRef.current?.skip();
									  }
									: undefined
							}
							subject={props.asset.name}
							startedAt={submittedAtRef.current}
							steps={steps}
							activeStep={activeStep}
							pendingAfterConfirmation={pendingAfterConfirmation}
						/>
					</React.Suspense>
				</div>
			) : null}
			{visiblePhase === 'done' ? (
				<div className="result success">
					<OperationOutcome
						title={resultCopy.title}
						detail={resultCopy.detail}
						status={
							props.operation.kind === 'buy'
								? `Confirmations: ${quorumConfirmationDepth(
										purchaseSteps.find((step) => step.key === 'pay')
								  )}`
								: undefined
						}
					>
						{props.operation.kind === 'buy' && purchaseSteps.length ? (
							<div className="result-outcome-sync">
								<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
									<LazyArweaveTransactionSync
										active={props.visible}
										activeStep="pay"
										startedAt={submittedAtRef.current}
										steps={purchaseSteps}
										subject={props.asset.name}
									/>
								</React.Suspense>
							</div>
						) : null}
						{props.operation.kind === 'buy' || props.operation.kind === 'sell' ? (
							<OperationOutcomeSubject
								label={props.operation.kind === 'buy' ? 'You received' : 'You listed'}
								title={props.asset.name}
								detail={props.operation.kind === 'sell' ? `${value} AR` : 'One asset'}
								media={
									props.asset.image ? (
										<ArtworkImage
											alt={`${props.asset.name} artwork`}
											className="operation-outcome-subject-artwork"
											decoding="async"
											loading="eager"
											src={props.asset.image}
										/>
									) : (
										<span
											aria-label={`${props.asset.name} artwork`}
											className="operation-outcome-subject-artwork operation-outcome-subject-artwork-fallback"
											role="img"
										>
											{props.asset.name.slice(0, 1)}
										</span>
									)
								}
							/>
						) : null}
					</OperationOutcome>
					{props.operation.kind === 'buy' ? (
						<div className="settlement-receipt">
							<div>
								<span>Seller payment</span>
								<strong>
									<ArCurrencyText>{sellerPrice}</ArCurrencyText>
								</strong>
							</div>
							<div>
								<span>Seller</span>
								<WalletAddress address={purchaseOrderOf(props.operation).creator} full label="seller" />
							</div>
							<div>
								<span>Order</span>
								<a
									href={transactionExplorerUrl(purchaseOrderOf(props.operation).orderId)}
									rel="noreferrer"
									target="_blank"
								>
									<OperationExternalLink>
										{short(purchaseOrderOf(props.operation).orderId)}
									</OperationExternalLink>
								</a>
							</div>
							<div className="settlement-receipt-links">
								{purchaseState?.registration?.id ? (
									<a
										href={transactionExplorerUrl(purchaseState.registration.id)}
										rel="noreferrer"
										target="_blank"
									>
										<OperationExternalLink>
											Reservation {short(purchaseState.registration.id)}
										</OperationExternalLink>
									</a>
								) : null}
								{purchaseState?.payment?.id ? (
									<a
										href={transactionExplorerUrl(purchaseState.payment.id)}
										rel="noreferrer"
										target="_blank"
									>
										<OperationExternalLink>
											Payment {short(purchaseState.payment.id)}
										</OperationExternalLink>
									</a>
								) : null}
							</div>
						</div>
					) : props.operation.kind === 'transfer' && transaction ? (
						<div className="settlement-receipt">
							<div>
								<span>Asset</span>
								<strong>{props.asset.name}</strong>
							</div>
							<div>
								<span>Recipient</span>
								<WalletAddress address={value.trim()} full label="recipient" />
							</div>
							<div className="settlement-receipt-links">
								<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
									<OperationExternalLink>Transaction {short(transaction.id)}</OperationExternalLink>
								</a>
							</div>
						</div>
					) : transaction ? (
						<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
							<OperationExternalLink>View transaction {short(transaction.id)}</OperationExternalLink>
						</a>
					) : null}
					<Button
						className="with-icon"
						data-dialog-initial
						onClick={props.onViewAsset}
						size="custom"
						variant="primary"
					>
						<Icon icon={ArrowLeft} size="sm" /> View updated asset
					</Button>
				</div>
			) : null}
			{visiblePhase === 'error' ? (
				<div className="result error">
					<AtomicOperationErrorAlert message={visibleMessage} />
					{failureKind === 'market-state-changed' ? (
						<Button data-dialog-initial type="button" onClick={() => props.onClose(false)} size="custom">
							View updated asset
						</Button>
					) : props.operation.kind === 'buy' ? (
						<>
							<div className="settlement-receipt">
								<div>
									<span>Failed stage</span>
									<strong>{atomicPurchaseFailureStage(purchaseState)}</strong>
								</div>
								<div>
									<span>Seller</span>
									<WalletAddress
										address={purchaseOrderOf(props.operation).creator}
										full
										label="seller"
									/>
								</div>
								<div>
									<span>Order</span>
									<a
										href={transactionExplorerUrl(purchaseOrderOf(props.operation).orderId)}
										rel="noreferrer"
										target="_blank"
									>
										<OperationExternalLink>
											{short(purchaseOrderOf(props.operation).orderId)}
										</OperationExternalLink>
									</a>
								</div>
								<div className="settlement-receipt-links">
									{purchaseState?.registration?.id ? (
										<a
											href={transactionExplorerUrl(purchaseState.registration.id)}
											rel="noreferrer"
											target="_blank"
										>
											<OperationExternalLink>
												Reservation {short(purchaseState.registration.id)}
											</OperationExternalLink>
										</a>
									) : null}
									{purchaseState?.payment?.id ? (
										<a
											href={transactionExplorerUrl(purchaseState.payment.id)}
											rel="noreferrer"
											target="_blank"
										>
											<OperationExternalLink>
												Payment {short(purchaseState.payment.id)}
											</OperationExternalLink>
										</a>
									) : null}
								</div>
							</div>
							{purchaseFailure?.reason === 'registration-dispatch-rejected' ? (
								<Button data-dialog-initial onClick={() => props.onClose(false)} size="custom">
									View current listing
								</Button>
							) : terminalReservationFailure ? (
								<Button data-dialog-initial onClick={startFreshPurchase} size="custom">
									Start a new purchase
								</Button>
							) : purchaseFailure?.reason === 'payment-dispatch-rejected' ? (
								<Button data-dialog-initial onClick={() => void submit()} size="custom">
									Sign a replacement seller payment
								</Button>
							) : (
								<Button data-dialog-initial onClick={restartPurchase} size="custom">
									{recoverable ? 'Continue saved purchase' : 'Try again'}
								</Button>
							)}
						</>
					) : failureKind === 'transaction-rejected' && transaction ? (
						<Button
							data-dialog-initial
							size="custom"
							onClick={() => {
								removeWalletRecordIf<any>(
									localStorage,
									operationStorageKey(props.asset.id, props.owner),
									(record) => record?.txId === transaction.id
								);
								localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
								props.onClose(false);
							}}
							variant="danger"
						>
							Discard rejected signature and sign again
						</Button>
					) : transaction ? (
						<Button data-dialog-initial onClick={() => void submit()} size="custom">
							Resume the signed transaction
						</Button>
					) : (
						<Button
							data-dialog-initial
							size="custom"
							onClick={() => {
								setFailureKind(null);
								setMessage('');
								setPhase('form');
							}}
						>
							Try again
						</Button>
					)}
				</div>
			) : null}
		</Dialog>
	);
}
