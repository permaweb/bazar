import React from 'react';

import type { AssetSummary } from 'api/collections';
import { discoverPendingAssetOffers } from 'api/discovery';
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
	operationStorageKey,
	promoteWalletOperationClaim,
	releaseWalletOperationClaim,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	repairRejectedPurchase,
	storeWalletRecordIf,
	storeWalletRecordOrThrow,
	type WalletOperationClaim,
} from 'api/operations';
import {
	continuePaymentConfirmations,
	loadAtomicTransactionRuntime,
	type PreparedTransaction,
	PURCHASE_PAYMENT_TARGET,
	PURCHASE_REGISTRATION_TARGET,
	PURCHASE_SKIP_FROM_DEPTH,
	purchaseObservationResumeState,
	purchaseObservationRetryDelay,
	purchaseObservationRetryKind,
	type PurchaseSnapshot,
	type PurchaseState,
	purchaseStateFailure,
	type SwapPurchase,
	waitForPurchaseObservationRetry,
} from 'api/transactions';

import { type AppError, appError, toAppError } from 'helpers/app-error';
import { arToWinston } from 'helpers/ar-units';
import { useAppErrorMessages } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';
import type { OperationActivity } from 'providers/OperationActivityProvider';

import { OPERATIONS_MESSAGES } from '../messages';
import {
	atomicOperationFormError,
	atomicOperationStateError,
	atomicOperationValue,
	type OperationFailureKind,
	pendingListingsFailure,
	purchaseSnapshot,
} from '../model/atomic-operation';
import {
	ATOMIC_ACTION_CONFIRMATION_TARGET,
	createOperationFlowReducer,
	initialOperationFlowState,
	type OperationFlowEvent,
	type OperationFlowState,
	operationResumesAutomatically,
} from '../model/operation-flow';
import {
	type AtomicActionOperation,
	atomicActionRecord,
	atomicActionRecordMatcher,
	atomicPurchaseRecord,
	atomicPurchaseRecordMatcher,
	type BuyOperation,
	type ExactActionBaseline,
	exactActionBaselineFromSlot,
	initialExactActionBaseline,
	preparedAtomicOperation,
	purchaseGatewayForRecovery,
	rejectedActionTransactionId,
	requiredActionBaseline,
} from '../model/operation-records';
import { type AtomicOperationView, atomicOperationView } from '../model/operation-view';

type AtomicTransactionRuntime = Awaited<ReturnType<typeof loadAtomicTransactionRuntime>>;
type AssetTransactionClient = InstanceType<AtomicTransactionRuntime['AssetTransactionClient']>;
type OperationActivityPatch = Pick<OperationActivity, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>;

/** Imperative handles one dialog shares across its attempts: cancellation, the running purchase, and held locks. */
type AttemptRefs = {
	attempt: React.MutableRefObject<AbortController>;
	purchase: React.MutableRefObject<SwapPurchase | null>;
	network: React.MutableRefObject<AssetObserverNetworkLease | null>;
	claim: React.MutableRefObject<WalletOperationClaim | null>;
	submittedAt: React.MutableRefObject<number | undefined>;
	exactActionBaseline: React.MutableRefObject<ExactActionBaseline | null>;
};

/** One attempt, bound to the operation, details, and flow state of the render that started it. */
type AttemptContext = {
	operation: Operation;
	asset: AssetSummary;
	collectionId: string;
	owner: string;
	/** The value the operation acts on: the listing price, or the trimmed transfer recipient. */
	value: string;
	flow: OperationFlowState;
	refs: AttemptRefs;
	dispatch: React.Dispatch<OperationFlowEvent>;
	onOperation(operation: Operation): void;
};

type AttemptStorage = {
	signal: AbortSignal;
	claim: WalletOperationClaim | null;
	operationKey: string;
	purchaseKey: string;
};

function signedTransactionKey(transactionId: string) {
	return `bazar-signed-transaction:${transactionId}`;
}

/** Re-reads live asset state before anything new is signed, returning the slot a cancellation or transfer needs. */
async function checkFreshOperation(context: AttemptContext, signal: AbortSignal) {
	const operation = context.operation;
	const { state: freshState } = await readAssetStateWithDeadline(context.asset.id, { signal, maxAge: 0 });
	const stateError = atomicOperationStateError(
		operation.kind,
		freshState,
		context.owner,
		'order' in operation ? operation.order : null
	);
	if (stateError) throw appError(stateError);
	if (operation.kind === 'sell') {
		let pendingOffers;
		try {
			pendingOffers = await discoverPendingAssetOffers(context.asset.id, freshState, { signal });
		} catch (cause) {
			if (signal.aborted) throw cause;
			throw appError('asset-pending-listing-check-unavailable', { cause });
		}
		const pendingListing = pendingListingsFailure(pendingOffers, context.owner);
		if (pendingListing) throw pendingListing;
	}
	return operation.kind === 'cancel' || operation.kind === 'transfer'
		? exactActionBaselineFromSlot(freshState.raw['at-slot'])
		: null;
}

/** Signs or resumes the reservation and seller payment of an atomic purchase until ownership is verified. */
async function runPurchase(
	context: AttemptContext,
	operation: BuyOperation,
	runtime: AtomicTransactionRuntime,
	client: AssetTransactionClient,
	storage: AttemptStorage,
	initialSnapshot: PurchaseSnapshot | null
) {
	const signal = storage.signal;
	const order = operation.order;
	let currentPurchaseSnapshot = initialSnapshot;
	const observerLease = runtime.acquireAssetObserverNetwork();
	context.refs.network.current = observerLease;
	await observerLease.ready;
	const network = observerLease.network;
	if (signal.aborted) throw signal.reason;
	let observationRetryAttempt = 0;
	let completedSnapshot: PurchaseSnapshot | null = null;
	const purchaseRecord = (snapshot: PurchaseSnapshot) =>
		atomicPurchaseRecord({
			asset: context.asset,
			buyer: context.owner,
			collectionId: context.collectionId,
			gateway: purchaseGatewayForRecovery(localStorage.getItem(storage.purchaseKey)),
			order,
			snapshot,
			createdAt: context.refs.submittedAt.current ?? Date.now(),
		});
	const persistPurchaseSnapshot = (snapshot: PurchaseSnapshot) => {
		context.onOperation({ kind: 'buy', order, resume: snapshot });
		const record = purchaseRecord(snapshot);
		const matches = atomicPurchaseRecordMatcher(context.owner, order.orderId, snapshot.registration?.id);
		if (storage.claim) {
			promoteWalletOperationClaim(localStorage, storage.claim, storage.purchaseKey, record, matches);
		} else {
			storeWalletRecordOrThrow(localStorage, storage.purchaseKey, record, matches, true);
		}
	};
	if (currentPurchaseSnapshot?.registration?.id && !currentPurchaseSnapshot.payment?.id) {
		const reservedSnapshot = currentPurchaseSnapshot;
		const registration = currentPurchaseSnapshot.registration;
		const preparationAdapter = client.purchaseAdapter({
			processId: context.asset.id,
			order,
			buyer: context.owner,
			startingBalance: '0',
			network,
			onPrepared: (event) => {
				if (event.kind !== 'payment') return;
				const snapshot = {
					...(currentPurchaseSnapshot ?? reservedSnapshot),
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
				processId: context.asset.id,
				order,
				buyer: context.owner,
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
		context.refs.purchase.current = purchase;
		let recoveryConflict: AppError | null = null;
		const update = (state: PurchaseState) => {
			if (signal.aborted || recoveryConflict) return;
			context.dispatch({ type: 'purchase-progressed', purchaseState: state });
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
		const resumeState = purchaseObservationResumeState(currentPurchaseSnapshot, context.flow.purchaseState);
		if (resumeState) context.dispatch({ type: 'purchase-progressed', purchaseState: resumeState });
		else update(purchase.state());
		const finalState = await purchase.run();
		if (recoveryConflict) throw recoveryConflict;
		const retryKind = purchaseObservationRetryKind(finalState);
		if (retryKind) {
			currentPurchaseSnapshot = purchase.snapshot();
			const delay = purchaseObservationRetryDelay(observationRetryAttempt++);
			context.dispatch({
				type: 'purchase-observation-retry-scheduled',
				purchaseState: finalState,
				delayMs: delay,
			});
			await waitForPurchaseObservationRetry(delay, signal);
			context.dispatch({ type: 'purchase-observation-retry-started', kind: retryKind });
			continue;
		}
		if (finalState.stage !== 'complete' || !finalState.success) {
			const failure =
				purchaseStateFailure(finalState) ?? appError('unknown', { message: 'asset-purchase-failed' });
			const snapshot = purchase.snapshot();
			const repaired = repairRejectedPurchase(snapshot, failure.reason);
			for (const id of repaired.discardIds) {
				localStorage.removeItem(signedTransactionKey(id));
			}
			const matches = atomicPurchaseRecordMatcher(context.owner, order.orderId, snapshot.registration?.id);
			if (!repaired.snapshot) {
				removeWalletRecordIf(localStorage, storage.purchaseKey, matches);
				context.onOperation({ kind: 'buy', order });
			} else if (repaired.snapshot !== snapshot) {
				storeWalletRecordOrThrow(localStorage, storage.purchaseKey, purchaseRecord(repaired.snapshot), matches);
				context.dispatch({ type: 'purchase-payment-discarded', purchaseState: finalState });
			}
			throw failure;
		}
		completedSnapshot = purchase.snapshot();
	}
	removeWalletRecoveryAndSignatures(
		localStorage,
		storage.purchaseKey,
		atomicPurchaseRecordMatcher(context.owner, order.orderId, completedSnapshot.registration?.id),
		[completedSnapshot.registration?.id, completedSnapshot.payment?.id],
		context.owner
	);
}

/** Signs or resumes one listing, cancellation, or transfer and waits until live asset state reflects it exactly. */
async function runAction(
	context: AttemptContext,
	operation: AtomicActionOperation,
	runtime: AtomicTransactionRuntime,
	client: AssetTransactionClient,
	storage: AttemptStorage,
	startingBaseline: ExactActionBaseline | null,
	attempt: { transactionId?: string }
) {
	const signal = storage.signal;
	let prepared: PreparedTransaction;
	let newlyPrepared = false;
	if (context.flow.transaction) {
		prepared = context.flow.transaction;
	} else if (operation.resumeId) {
		prepared = client.restore(operation.resumeId, context.owner);
	} else if (operation.kind === 'sell') {
		prepared = await client.makeOffer(
			{ processId: context.asset.id, quantity: '1', asking: arToWinston(context.value), seller: context.owner },
			signal
		);
		newlyPrepared = true;
	} else if (operation.kind === 'cancel') {
		prepared = await client.cancelOrder(context.asset.id, operation.order.orderId, context.owner, signal);
		newlyPrepared = true;
	} else {
		prepared = await client.transfer(context.asset.id, context.value, '1', context.owner, signal);
		newlyPrepared = true;
	}
	attempt.transactionId = prepared.id;
	const baseline = operation.kind === 'sell' ? null : requiredActionBaseline(startingBaseline);
	if (discardNewlyPreparedTransactionIfAborted(localStorage, prepared.id, newlyPrepared, signal)) {
		throw signal.reason;
	}
	context.dispatch({ type: 'transaction-prepared', transaction: prepared });
	context.onOperation(preparedAtomicOperation(operation, prepared.id, context.value, baseline));
	const operationRecord = atomicActionRecord({
		transactionId: prepared.id,
		operation,
		asset: context.asset,
		collectionId: context.collectionId,
		signer: context.owner,
		value: context.value,
		baseline,
		createdAt: Date.now(),
	});
	try {
		const matches = atomicActionRecordMatcher(prepared.id);
		if (storage.claim) {
			promoteWalletOperationClaim(localStorage, storage.claim, storage.operationKey, operationRecord, matches);
		} else {
			storeWalletRecordOrThrow(localStorage, storage.operationKey, operationRecord, matches, true);
		}
	} catch (cause) {
		localStorage.removeItem(signedTransactionKey(prepared.id));
		context.dispatch({ type: 'transaction-discarded' });
		throw cause;
	}
	context.dispatch({ type: 'confirmation-started' });
	await runtime.dispatchAndConfirm(prepared, {
		signal,
		target: ATOMIC_ACTION_CONFIRMATION_TARGET,
		onViews: (views) => context.dispatch({ type: 'views-observed', views }),
		onConsensus: (consensus) => context.dispatch({ type: 'consensus-observed', consensus }),
		onProgress: (progress) =>
			context.dispatch({ type: 'confirmations-observed', confirmations: progress.confirmations }),
	});
	context.dispatch({ type: 'confirmation-target-reached' });
	if (operation.kind === 'sell') {
		await client.waitForOfferAcceptance(
			context.asset.id,
			{ orderId: prepared.id, seller: context.owner, quantity: '1', asking: arToWinston(context.value) },
			signal
		);
	} else if (operation.kind === 'cancel') {
		await client.waitForExactCancellation(
			context.asset.id,
			prepared.id,
			context.owner,
			operation.order,
			requiredActionBaseline(baseline),
			signal
		);
	} else {
		await client.waitForFungibleTransfer(
			context.asset.id,
			prepared.id,
			context.owner,
			context.value,
			'1',
			requiredActionBaseline(baseline),
			signal
		);
	}
	removeWalletRecoveryAndSignatures(
		localStorage,
		storage.operationKey,
		atomicActionRecordMatcher(prepared.id),
		[prepared.id],
		context.owner
	);
}

/**
 * Runs one user-initiated (or saved-recovery) attempt: claims the wallet operation lock so no second attempt can
 * sign, re-checks live state before signing anything new, saves every signed transaction for recovery before
 * submitting it, and observes the outcome.
 */
async function runAttempt(context: AttemptContext) {
	const operation = context.operation;
	const validation = atomicOperationFormError(operation.kind, context.value, context.owner);
	if (validation) {
		context.dispatch({ type: 'validation-failed', reason: validation });
		return;
	}
	context.refs.submittedAt.current ??= Date.now();
	context.dispatch({ type: 'submitted' });
	let operationClaim: WalletOperationClaim | null = null;
	const resumeTransactionId =
		operation.kind === 'buy' ? undefined : operation.resumeId ?? context.flow.transaction?.id;
	const attempt: { transactionId?: string } = { transactionId: resumeTransactionId };
	const operationKey = operationStorageKey(context.asset.id, context.owner);
	try {
		const currentPurchaseSnapshot =
			operation.kind === 'buy'
				? latestPurchaseSnapshot(
						operation.resume,
						context.flow.purchaseState ? purchaseSnapshot(context.flow.purchaseState) : null
				  )
				: null;
		const freshOperation =
			operation.kind === 'buy'
				? !hasRecoverablePurchase(currentPurchaseSnapshot)
				: !operation.resumeId && !context.flow.transaction;
		const signal = context.refs.attempt.current.signal;
		const purchaseKey = atomicPurchaseStorageKey(context.asset.id, context.owner);
		let exactActionBaseline = context.refs.exactActionBaseline.current;
		const recoveryRegistrationId = currentPurchaseSnapshot?.registration?.id;
		const recovery =
			!freshOperation && operation.kind === 'buy' && recoveryRegistrationId
				? localStorage.getItem(purchaseKey)
					? {
							key: purchaseKey,
							matches: atomicPurchaseRecordMatcher(
								context.owner,
								operation.order.orderId,
								recoveryRegistrationId
							),
					  }
					: undefined
				: !freshOperation
				? { key: operationKey, matches: atomicActionRecordMatcher(resumeTransactionId) }
				: undefined;
		operationClaim = await acquireWalletOperationClaim(
			localStorage,
			operationClaimStorageKey(context.asset.id, context.owner),
			[operationKey, purchaseKey],
			recovery ? { recovery } : {}
		);
		context.refs.claim.current = operationClaim;
		if (freshOperation) {
			const freshBaseline = await checkFreshOperation(context, signal);
			if (freshBaseline) {
				exactActionBaseline = freshBaseline;
				context.refs.exactActionBaseline.current = freshBaseline;
			}
		}
		const runtime = await loadAtomicTransactionRuntime();
		const client = new runtime.AssetTransactionClient();
		const storage = { signal, claim: operationClaim, operationKey, purchaseKey };
		if (operation.kind === 'buy') {
			await runPurchase(context, operation, runtime, client, storage, currentPurchaseSnapshot);
		} else {
			await runAction(context, operation, runtime, client, storage, exactActionBaseline, attempt);
		}
		if (operationClaim) {
			releaseWalletOperationClaim(localStorage, operationClaim);
			operationClaim = null;
			context.refs.claim.current = null;
		}
		context.dispatch({ type: 'completed' });
	} catch (cause) {
		if (operationClaim) releaseWalletOperationClaim(localStorage, operationClaim);
		context.refs.claim.current = null;
		context.refs.network.current?.release();
		context.refs.network.current = null;
		if (context.refs.attempt.current.signal.aborted) return;
		const failure = toAppError(cause, 'unknown');
		const rejectedTransactionId = rejectedActionTransactionId(failure, attempt.transactionId);
		if (rejectedTransactionId) {
			removeWalletRecordIf(localStorage, operationKey, atomicActionRecordMatcher(rejectedTransactionId));
			localStorage.removeItem(signedTransactionKey(rejectedTransactionId));
		}
		context.dispatch({
			type: 'failed',
			error: failure,
			signer: context.owner,
			discardTransaction: Boolean(rejectedTransactionId),
		});
	}
}

export type AtomicOperationFlow = {
	view: AtomicOperationView;
	purchaseState: PurchaseState | null;
	failureKind: OperationFailureKind | null;
	transactionId: string | null;
	/** When the first attempt started, for elapsed-time displays. */
	startedAt: number | undefined;
	submit(): void;
	/** Keeps a saved purchase for later and closes, or returns an unrecoverable one to the form. */
	restartPurchase(): void;
	/** Forgets an unrecoverable purchase and its signatures so a new purchase can be signed. */
	startFreshPurchase(): void;
	/** Forgets a signed action the network refused, so a replacement can be signed. */
	discardRejectedSignature(): void;
	returnToForm(): void;
	skipPurchaseObservation(): void;
};

/**
 * Orchestrates an atomic buy, listing, cancellation, or transfer: signing only on explicit submission (or resuming
 * saved signed work on open), wallet operation locking, recovery persistence, observation, and reporting progress to
 * the operation activity provider.
 */
export function useAtomicOperationFlow(input: {
	taskId: string;
	asset: AssetSummary;
	collectionId: string;
	owner: string;
	operation: Operation;
	visible: boolean;
	/** The entered listing price or transfer recipient. */
	value: string;
	onUpdate(id: string, patch: OperationActivityPatch, assetId: string): void;
	onOperation(operation: Operation): void;
	onClose(resumeLater?: boolean, refresh?: boolean): void;
}): AtomicOperationFlow {
	const messages = useMessages(OPERATIONS_MESSAGES);
	const errorMessages = useAppErrorMessages();
	const reducer = React.useMemo(() => createOperationFlowReducer(messages, errorMessages), [errorMessages, messages]);
	const [flow, dispatch] = React.useReducer(reducer, input.operation, initialOperationFlowState);
	const purchaseRef = React.useRef<SwapPurchase | null>(null);
	const networkRef = React.useRef<AssetObserverNetworkLease | null>(null);
	const claimRef = React.useRef<WalletOperationClaim | null>(null);
	const submittedAtRef = React.useRef<number>();
	const exactActionBaselineRef = React.useRef(initialExactActionBaseline(input.operation));
	const attemptRef = React.useRef(new AbortController());
	const lifecycleRef = React.useRef<object | null>(null);
	const resumedRef = React.useRef(false);
	const resumesAutomaticallyRef = React.useRef(operationResumesAutomatically(input.operation));
	const view = atomicOperationView({
		operation: input.operation,
		flow,
		assetName: input.asset.name,
		owner: input.owner,
		value: input.value,
		messages,
		errorMessages,
	});
	const operationKind = input.operation.kind;
	const paymentId = flow.purchaseState?.payment?.id;

	function submit() {
		void runAttempt({
			operation: input.operation,
			asset: input.asset,
			collectionId: input.collectionId,
			owner: input.owner,
			value: atomicOperationValue(input.operation.kind, input.value),
			flow,
			refs: {
				attempt: attemptRef,
				purchase: purchaseRef,
				network: networkRef,
				claim: claimRef,
				submittedAt: submittedAtRef,
				exactActionBaseline: exactActionBaselineRef,
			},
			dispatch,
			onOperation: input.onOperation,
		});
	}
	// The automatic resume below runs once, on mount, so it reads the submission of the render it opened with.
	const submitRef = React.useRef(submit);
	submitRef.current = submit;

	// Aborting on unmount waits a microtask so a development double-mount does not cancel the live attempt.
	React.useEffect(() => {
		const lifecycle = {};
		lifecycleRef.current = lifecycle;
		return () => {
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
		if (flow.phase !== 'done' || operationKind !== 'buy' || !input.visible || !paymentId) return;
		const network = networkRef.current?.network;
		if (!network) return;
		const watcher = continuePaymentConfirmations(network, paymentId, (observation) => {
			dispatch({ type: 'payment-observed', paymentId, observation });
		});
		return () => watcher.stop();
	}, [flow.phase, input.visible, operationKind, paymentId]);
	// Saved signed work resumes once, as the dialog opens; everything else waits for an explicit submission.
	React.useEffect(() => {
		if (!resumesAutomaticallyRef.current || resumedRef.current) return;
		resumedRef.current = true;
		submitRef.current();
	}, []);
	React.useEffect(() => {
		input.onUpdate(
			input.taskId,
			{
				phase: view.phase,
				status: { text: view.reportedStatus },
				confirmations: view.activityConfirmations,
				confirmationTarget: view.confirmationTarget,
			},
			input.asset.id
		);
	}, [
		input.asset.id,
		input.onUpdate,
		input.taskId,
		view.activityConfirmations,
		view.confirmationTarget,
		view.phase,
		view.reportedStatus,
	]);

	function restartPurchase() {
		if (input.operation.kind !== 'buy' || !view.recoverable) {
			dispatch({ type: 'returned-to-form' });
			return;
		}
		if (flow.purchaseState) {
			const snapshot = purchaseSnapshot(flow.purchaseState);
			if (hasRecoverablePurchase(snapshot)) {
				const purchaseKey = atomicPurchaseStorageKey(input.asset.id, input.owner);
				storeWalletRecordIf(
					localStorage,
					purchaseKey,
					atomicPurchaseRecord({
						asset: input.asset,
						buyer: input.owner,
						collectionId: input.collectionId,
						gateway: purchaseGatewayForRecovery(localStorage.getItem(purchaseKey)),
						order: input.operation.order,
						snapshot,
						createdAt: submittedAtRef.current ?? Date.now(),
					}),
					atomicPurchaseRecordMatcher(input.owner, input.operation.order.orderId, snapshot.registration?.id),
					true
				);
			}
		}
		attemptRef.current.abort();
		purchaseRef.current?.abandon();
		networkRef.current?.release();
		networkRef.current = null;
		input.onClose(false);
	}

	function startFreshPurchase() {
		if (input.operation.kind !== 'buy') return;
		const order = input.operation.order;
		const snapshot = latestPurchaseSnapshot(
			input.operation.resume,
			flow.purchaseState ? purchaseSnapshot(flow.purchaseState) : null
		);
		if (snapshot?.registration?.id) {
			removeWalletRecoveryAndSignatures(
				localStorage,
				atomicPurchaseStorageKey(input.asset.id, input.owner),
				atomicPurchaseRecordMatcher(input.owner, order.orderId, snapshot.registration.id),
				[snapshot.registration.id, snapshot.payment?.id],
				input.owner
			);
		}
		input.onOperation({ kind: 'buy', order });
		purchaseRef.current = null;
		submittedAtRef.current = undefined;
		dispatch({ type: 'purchase-reset' });
	}

	function discardRejectedSignature() {
		const transaction = flow.transaction;
		if (!transaction) return;
		removeWalletRecordIf(
			localStorage,
			operationStorageKey(input.asset.id, input.owner),
			atomicActionRecordMatcher(transaction.id)
		);
		localStorage.removeItem(signedTransactionKey(transaction.id));
		input.onClose(false);
	}

	function returnToForm() {
		dispatch({ type: 'returned-to-form' });
	}

	function skipPurchaseObservation() {
		purchaseRef.current?.skip();
	}

	return {
		view,
		purchaseState: flow.purchaseState,
		failureKind: flow.failureKind,
		transactionId: flow.transaction?.id ?? null,
		startedAt: submittedAtRef.current,
		submit,
		restartPurchase,
		startFreshPurchase,
		discardRejectedSignature,
		returnToForm,
		skipPurchaseObservation,
	};
}
