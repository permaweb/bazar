import React from 'react';

import type { AssetSummary } from 'api/collections';
import {
	type AssetState,
	liquidBalanceOf,
	type OrderFill,
	parseTokenAmount,
	readAssetStateWithDeadline,
	type SwapOrder,
} from 'api/marketplace';
import { acquireAssetObserverNetwork, type AssetObserverNetworkLease } from 'api/observers';
import {
	acquireWalletOperationClaim,
	discardNewlyPreparedTransactionIfAborted,
	fungibleBatchStorageKey,
	type FungibleOperationActivitySummary,
	operationClaimStorageKey,
	operationStorageKey,
	promoteWalletOperationClaim,
	releaseWalletOperationClaim,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	repairRejectedPurchase,
	storeWalletRecordOrThrow,
	type WalletOperationClaim,
} from 'api/operations';
import {
	AssetTransactionClient,
	continuePaymentConfirmations,
	dispatchAndConfirm,
	type PreparedPurchase,
	type PreparedTransaction,
	PURCHASE_PAYMENT_TARGET,
	PURCHASE_REGISTRATION_TARGET,
	PURCHASE_SKIP_FROM_DEPTH,
	purchaseObservationCheckingMessage,
	purchaseObservationPendingState,
	purchaseObservationResumeState,
	purchaseObservationRetryDelay,
	purchaseObservationRetryKind,
	purchaseObservationRetryMessage,
	type PurchaseState,
	purchaseStateFailure,
	SwapPurchase,
	waitForPurchaseObservationRetry,
} from 'api/transactions';

import { currentPurchaseGatewayContext, type OperationFailureKind, operationFailureKind } from 'features/Operations';
import type { ArweaveSyncStep } from 'features/TransactionSync';
import { type AppError, appError, toAppError } from 'helpers/app-error';
import { useAppErrorMessages } from 'hooks/useAppErrorMessage';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../messages';
import {
	batchPaymentBarrierState,
	batchPurchaseRecoveryApprovalCount,
	batchPurchaseStartingBalance,
	batchRecoveryFrameBuffer,
	batchRecoveryIdentity,
	batchSettlementSummary,
	checkpointBatchPreparation,
	latestRecoverableSnapshot,
	nextSettlementAnnouncement,
	preparedEntry,
	purchaseStateFrameBuffer,
	storeBatchRecoveryBeforeDispatch,
	waitForSettlementBatch,
} from '../model/fungible-batch';
import { lotAsking } from '../model/fungible-market';
import {
	type BatchEntry,
	type BatchResume,
	type FungibleOperation,
	fungibleOperationActivityProgress,
	fungibleOperationFailureMessage,
	fungibleOperationStateError,
	fungibleOperationWorkingStatus,
	fungiblePurchaseResumeOf,
	fungibleTransferRecipientError,
	operationFailureNeedsManualReview,
	purchaseSettlementNeedsManualReview,
} from '../model/fungible-operation';
import {
	createFungibleOperationFlowState,
	fungibleOperationFlowReducer,
	type FungibleOperationFlowState,
} from '../model/fungible-operation-flow';
import {
	fungibleOperationVisibleFills,
	type FungiblePurchaseSync,
	fungiblePurchaseSync,
	fungibleSingleSyncSteps,
	initialExactActionBaseline,
	isRecoverableFungiblePurchase,
	shouldResumeFungibleOperation,
} from '../model/fungible-operation-view';

type ActivityUpdate = Pick<
	FungibleOperationActivitySummary,
	'phase' | 'status' | 'confirmations' | 'confirmationTarget'
>;
type SavedOperationRecordMatch = { txId?: unknown } | null;

export type FungibleOperationFlow = Pick<
	FungibleOperationFlowState,
	'phase' | 'message' | 'failure' | 'transaction' | 'confirmations' | 'purchaseStates'
> & {
	failureKind: OperationFailureKind | null;
	/** Purchase lots shown by the dialog: the saved batch when resuming, otherwise the live match. */
	visibleFills: OrderFill[];
	visibleOrders: SwapOrder[];
	activeOrder?: SwapOrder;
	activePurchase?: PurchaseState;
	activePurchaseFailure: AppError | null;
	purchaseSync: FungiblePurchaseSync;
	singleSteps: ArweaveSyncStep[];
	workingStatus: string;
	recoverableBatch: boolean;
	signedWork: boolean;
	settlementAnnouncement: string;
	incompletePurchases: number;
	purchaseNeedsManualReview: boolean;
	startedAt?: number;
	submit(): void;
	selectOrder(orderId: string): void;
	skipPurchase(orderId: string): void;
	reopenForm(): void;
	restartPurchase(): void;
	acknowledgeTerminalPurchase(): void;
	discardTransfer(): void;
	discardRejectedSignature(): void;
};

/**
 * Runs one fungible operation from wallet approval to its live-state proof: wallet operation claims, durable
 * recovery records, single-transaction dispatch, parallel purchase settlement with a shared payment barrier,
 * observer retries, and cleanup. The dialog renders the returned state; nothing here touches the DOM.
 */
export function useFungibleOperationFlow(params: {
	asset: AssetSummary;
	collectionId: string;
	state: AssetState;
	owner: string;
	operation: FungibleOperation;
	visible: boolean;
	/** Current draft values; `transferRecipient` is already normalized. */
	quantity: string;
	unitPrice: string;
	transferRecipient: string;
	matchedFills: OrderFill[];
	onActivityChange(update: ActivityUpdate): void;
	onRestart(): void;
	onClose(resumeLater?: boolean, refresh?: boolean): void;
}): FungibleOperationFlow {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const errorMessages = useAppErrorMessages();
	const plural = usePlural();
	const [flow, dispatch] = React.useReducer(
		fungibleOperationFlowReducer,
		params.operation,
		createFungibleOperationFlowState
	);
	const [activeOrderId, setActiveOrderId] = React.useState(
		params.operation.kind === 'buy'
			? fungiblePurchaseResumeOf(params.operation)?.entries[0]?.order.orderId ?? ''
			: ''
	);
	const [settlementAnnouncement, setSettlementAnnouncement] = React.useState('');
	const purchaseStateBufferRef = React.useRef<ReturnType<typeof purchaseStateFrameBuffer> | null>(null);
	if (!purchaseStateBufferRef.current) {
		purchaseStateBufferRef.current = purchaseStateFrameBuffer((updates) => {
			dispatch({ type: 'purchase-states', updates });
		});
	}
	const purchaseStateBuffer = purchaseStateBufferRef.current;
	const batchRecoveryBufferRef = React.useRef<ReturnType<typeof batchRecoveryFrameBuffer> | null>(null);
	const settlementAnnouncementKeyRef = React.useRef('');
	const submittedAtRef = React.useRef<number | undefined>(
		params.operation.kind === 'buy' && Number.isFinite(fungiblePurchaseResumeOf(params.operation)?.createdAt)
			? fungiblePurchaseResumeOf(params.operation)?.createdAt
			: undefined
	);
	const purchasesRef = React.useRef<Map<string, SwapPurchase>>(new Map());
	const networkRef = React.useRef<AssetObserverNetworkLease | null>(null);
	const claimRef = React.useRef<WalletOperationClaim | null>(null);
	const exactActionBaselineRef = React.useRef(initialExactActionBaseline(params.operation));
	const attemptRef = React.useRef(new AbortController());
	const cleanupTimerRef = React.useRef<number | undefined>();
	const activityChangeRef = React.useRef(params.onActivityChange);
	activityChangeRef.current = params.onActivityChange;
	const resumed = React.useRef(false);
	const submitRef = React.useRef(submit);
	submitRef.current = submit;

	React.useEffect(() => {
		if (cleanupTimerRef.current !== undefined) window.clearTimeout(cleanupTimerRef.current);
		return () => {
			cleanupTimerRef.current = window.setTimeout(() => {
				batchRecoveryBufferRef.current?.flush();
				batchRecoveryBufferRef.current = null;
				purchaseStateBufferRef.current?.clear();
				attemptRef.current.abort();
				for (const purchase of purchasesRef.current.values()) purchase.abandon();
				networkRef.current?.release();
				if (claimRef.current) {
					releaseWalletOperationClaim(localStorage, claimRef.current);
					claimRef.current = null;
				}
			}, 0);
		};
	}, []);

	function releaseClaim() {
		if (claimRef.current) {
			releaseWalletOperationClaim(localStorage, claimRef.current);
			claimRef.current = null;
		}
	}

	async function submit() {
		const operation = params.operation;
		submittedAtRef.current ??= Date.now();
		dispatch({ type: 'submitted' });
		let attemptedTransactionId = operation.kind === 'buy' ? undefined : operation.resumeId ?? flow.transaction?.id;
		try {
			const freshOperation =
				operation.kind === 'buy' ? !operation.resume : !operation.resumeId && !flow.transaction;
			const signal = attemptRef.current.signal;
			const operationKey = operationStorageKey(params.asset.id, params.owner);
			const purchaseKey = fungibleBatchStorageKey(params.asset.id, params.owner);
			const resumeTransactionId =
				operation.kind === 'buy' ? undefined : operation.resumeId ?? flow.transaction?.id;
			let exactActionBaseline = exactActionBaselineRef.current;
			let freshState: AssetState | undefined;
			claimRef.current = await acquireWalletOperationClaim(
				localStorage,
				operationClaimStorageKey(
					params.asset.id,
					params.owner,
					operation.kind === 'buy' ? 'purchase' : 'asset'
				),
				operation.kind === 'buy' ? [purchaseKey] : [operationKey],
				{
					...(freshOperation
						? {}
						: operation.kind === 'buy' && operation.resume
						? {
								recovery: {
									key: purchaseKey,
									matches: (record: unknown) => {
										const saved = record as Partial<BatchResume> | null;
										return (
											saved?.buyer === params.owner &&
											(saved?.attemptId ?? batchRecoveryIdentity(saved?.entries ?? [])) ===
												(fungiblePurchaseResumeOf(operation)?.attemptId ??
													batchRecoveryIdentity(
														fungiblePurchaseResumeOf(operation)?.entries ?? []
													))
										);
									},
								},
						  }
						: {
								recovery: {
									key: operationKey,
									matches: (record: unknown) =>
										(record as SavedOperationRecordMatch)?.txId === resumeTransactionId,
								},
						  }),
				}
			);
			if (freshOperation) {
				({ state: freshState } = await readAssetStateWithDeadline(params.asset.id, { signal, maxAge: 0 }));
				const expectedOrders =
					operation.kind === 'buy'
						? params.matchedFills.map((fill) => fill.sourceOrder)
						: operation.kind === 'cancel'
						? [operation.order]
						: [];
				const rawQuantity =
					operation.kind === 'sell' || operation.kind === 'transfer'
						? parseTokenAmount(params.quantity, params.state.denomination)
						: '0';
				const stateError = fungibleOperationStateError(
					operation.kind,
					freshState,
					params.owner,
					expectedOrders,
					rawQuantity,
					params.state.denomination
				);
				if (stateError) throw appError(stateError);
				if (operation.kind === 'cancel' || operation.kind === 'transfer') {
					const startingSlot = Number(freshState.raw['at-slot']);
					if (!Number.isSafeInteger(startingSlot) || startingSlot < 0) {
						throw appError('asset-action-starting-slot-unavailable');
					}
					exactActionBaseline = { startingSlot };
					exactActionBaselineRef.current = exactActionBaseline;
				}
			}
			const client = new AssetTransactionClient();
			if (operation.kind === 'buy') {
				if (!operation.resume && !params.matchedFills.length) throw appError('operation-amount-unavailable');
				await runPurchaseBatch(
					client,
					fungiblePurchaseResumeOf(operation)?.entries ??
						params.matchedFills.map((fill) => ({
							order: fill.sourceOrder,
							fillQuantity: fill.order.quantity,
							snapshot: {},
						})),
					operation.resume,
					batchPurchaseStartingBalance(operation.resume, freshState, params.owner, operation.startingBalance)
				);
				return;
			}

			let prepared: PreparedTransaction;
			let newlyPrepared = false;
			let rawQuantity = '';
			let asking = '';
			if (operation.kind === 'transfer') {
				const transferError = fungibleTransferRecipientError(params.transferRecipient, params.owner);
				if (transferError) throw appError(transferError);
			}
			if (flow.transaction) prepared = flow.transaction;
			else if (operation.resumeId) prepared = client.restore(operation.resumeId, params.owner);
			else if (operation.kind === 'sell') {
				rawQuantity = parseTokenAmount(params.quantity, params.state.denomination);
				if (
					BigInt(rawQuantity) < 1n ||
					BigInt(rawQuantity) > BigInt(liquidBalanceOf(params.state, params.owner))
				) {
					throw appError('operation-quantity-exceeds-balance');
				}
				asking = lotAsking(rawQuantity, params.unitPrice, params.state.denomination);
				prepared = await client.makeOffer(
					{ processId: params.asset.id, quantity: rawQuantity, asking, seller: params.owner },
					signal
				);
				newlyPrepared = true;
			} else if (operation.kind === 'cancel') {
				prepared = await client.cancelOrder(params.asset.id, operation.order.orderId, params.owner, signal);
				newlyPrepared = true;
			} else {
				rawQuantity = parseTokenAmount(params.quantity, params.state.denomination);
				if (
					BigInt(rawQuantity) < 1n ||
					BigInt(rawQuantity) > BigInt(liquidBalanceOf(params.state, params.owner))
				) {
					throw appError('operation-quantity-exceeds-balance');
				}
				prepared = await client.transferFungible(
					params.asset.id,
					params.transferRecipient,
					rawQuantity,
					params.owner,
					signal
				);
				newlyPrepared = true;
			}
			if (discardNewlyPreparedTransactionIfAborted(localStorage, prepared.id, newlyPrepared, signal)) {
				throw signal.reason;
			}
			attemptedTransactionId = prepared.id;
			dispatch({ type: 'transaction-prepared', transaction: prepared });
			let startingSlot = 0;
			if (operation.kind === 'cancel' || operation.kind === 'transfer') {
				if (!exactActionBaseline) throw appError('asset-action-recovery-baseline-missing');
				startingSlot = exactActionBaseline.startingSlot;
			}
			const operationRecord = {
				txId: prepared.id,
				kind: operation.kind,
				assetId: params.asset.id,
				asset: params.asset,
				activityKind: 'fungible',
				collectionId: params.collectionId,
				signer: params.owner,
				...(operation.kind === 'cancel'
					? { order: operation.order, startingSlot }
					: operation.kind === 'sell'
					? { quantity: params.quantity, unitPrice: params.unitPrice }
					: {
							quantity: params.quantity,
							recipient: params.transferRecipient,
							startingSlot,
					  }),
				createdAt: Date.now(),
			};
			try {
				const matches = (current: SavedOperationRecordMatch) => current?.txId === prepared.id;
				if (claimRef.current) {
					promoteWalletOperationClaim<SavedOperationRecordMatch>(
						localStorage,
						claimRef.current,
						operationStorageKey(params.asset.id, params.owner),
						operationRecord,
						matches
					);
				} else {
					storeWalletRecordOrThrow<SavedOperationRecordMatch>(
						localStorage,
						operationStorageKey(params.asset.id, params.owner),
						operationRecord,
						matches,
						true
					);
				}
			} catch (cause) {
				localStorage.removeItem(`bazar-signed-transaction:${prepared.id}`);
				dispatch({ type: 'transaction-discarded' });
				throw cause;
			}
			dispatch({ type: 'dispatch-started' });
			await dispatchAndConfirm(prepared, {
				signal,
				target: 5,
				onViews: (views) => dispatch({ type: 'observer-views', views }),
				onConsensus: (consensus) => dispatch({ type: 'consensus', consensus }),
				onProgress: (progress) => dispatch({ type: 'confirmations', confirmations: progress.confirmations }),
			});
			dispatch({ type: 'confirmations', confirmations: 5 });
			dispatch({ type: 'status', message: messages.flowConfirmationsReached });
			if (operation.kind === 'sell') {
				const expectedQuantity =
					rawQuantity || parseTokenAmount(operation.quantity ?? params.quantity, params.state.denomination);
				const expectedAsking =
					asking ||
					lotAsking(expectedQuantity, operation.unitPrice ?? params.unitPrice, params.state.denomination);
				await client.waitForOfferAcceptance(
					params.asset.id,
					{
						orderId: prepared.id,
						seller: params.owner,
						quantity: expectedQuantity,
						asking: expectedAsking,
					},
					signal
				);
			} else if (operation.kind === 'cancel') {
				if (!exactActionBaseline) throw appError('asset-action-recovery-baseline-missing');
				await client.waitForExactCancellation(
					params.asset.id,
					prepared.id,
					params.owner,
					operation.order,
					exactActionBaseline,
					signal
				);
			} else {
				const expectedQuantity =
					rawQuantity || parseTokenAmount(operation.quantity ?? params.quantity, params.state.denomination);
				if (!exactActionBaseline) throw appError('asset-action-recovery-baseline-missing');
				await client.waitForFungibleTransfer(
					params.asset.id,
					prepared.id,
					params.owner,
					params.transferRecipient,
					expectedQuantity,
					exactActionBaseline,
					signal
				);
			}
			removeWalletRecoveryAndSignatures<SavedOperationRecordMatch>(
				localStorage,
				operationStorageKey(params.asset.id, params.owner),
				(record) => record?.txId === prepared.id,
				[prepared.id],
				params.owner
			);
			releaseClaim();
			dispatch({ type: 'completed' });
		} catch (cause) {
			releaseClaim();
			networkRef.current?.release();
			networkRef.current = null;
			if (attemptRef.current.signal.aborted) return;
			const nextFailure = toAppError(cause, 'unknown');
			const discardTransaction = Boolean(
				(nextFailure.reason === 'asset-cancel-rejected' ||
					nextFailure.reason === 'fungible-transfer-rejected') &&
					attemptedTransactionId
			);
			if (discardTransaction) {
				removeWalletRecordIf<SavedOperationRecordMatch>(
					localStorage,
					operationStorageKey(params.asset.id, params.owner),
					(record) => record?.txId === attemptedTransactionId
				);
				localStorage.removeItem(`bazar-signed-transaction:${attemptedTransactionId}`);
			}
			dispatch({
				type: 'failed',
				failure: nextFailure,
				message: fungibleOperationFailureMessage(nextFailure, messages, errorMessages),
				discardTransaction,
			});
		}
	}

	async function runPurchaseBatch(
		client: AssetTransactionClient,
		requested: Array<Pick<BatchEntry, 'order' | 'fillQuantity' | 'snapshot'>>,
		resume?: BatchResume,
		startingBalance = params.operation.kind === 'buy' ? params.operation.startingBalance : '0'
	) {
		const observerLease = acquireAssetObserverNetwork();
		networkRef.current = observerLease;
		await observerLease.ready;
		const network = observerLease.network;
		const signal = attemptRef.current.signal;
		if (signal.aborted) throw signal.reason;
		let entries: BatchEntry[] = resume?.entries ?? [];
		const preparedByOrder = new Map<string, PreparedPurchase>();
		const saved: BatchResume = {
			version: 3,
			asset: params.asset,
			activityKind: 'fungible',
			buyer: params.owner,
			collectionId: params.collectionId,
			startingBalance,
			entries,
			createdAt: resume?.createdAt ?? submittedAtRef.current ?? Date.now(),
			gateway: resume?.gateway ?? currentPurchaseGatewayContext(),
		};
		let terminalRecoveryRemoved = false;
		const attemptId =
			resume?.attemptId ??
			(resume
				? batchRecoveryIdentity(entries)
				: globalThis.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
		saved.attemptId = attemptId;
		const recoveryKey = fungibleBatchStorageKey(params.asset.id, params.owner);
		const matchesAttempt = (current: BatchResume) =>
			current.buyer === params.owner &&
			(current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId;
		try {
			if (!resume) {
				const prepared = await client.preparePurchaseBatch(
					requested.map(({ order, fillQuantity }) => ({
						processId: params.asset.id,
						order,
						fillQuantity,
						buyer: params.owner,
						startingBalance,
						network,
					})),
					signal,
					(event) => {
						entries = checkpointBatchPreparation(entries, event);
						saved.entries = entries;
						if (event.type === 'quoted') {
							if (claimRef.current) {
								promoteWalletOperationClaim(
									localStorage,
									claimRef.current,
									recoveryKey,
									saved,
									matchesAttempt
								);
							} else {
								storeBatchRecoveryBeforeDispatch(localStorage, recoveryKey, saved, signal);
							}
							return;
						}
						storeWalletRecordOrThrow(localStorage, recoveryKey, saved, matchesAttempt, true);
					}
				);
				entries = prepared.map((item) => {
					preparedByOrder.set(item.order.orderId, item);
					return preparedEntry(item);
				});
				saved.entries = entries;
				storeWalletRecordOrThrow(localStorage, recoveryKey, saved, matchesAttempt, true);
				if (signal.aborted) throw signal.reason;
			} else if (claimRef.current) {
				promoteWalletOperationClaim(localStorage, claimRef.current, recoveryKey, saved, matchesAttempt);
			} else {
				storeBatchRecoveryBeforeDispatch(localStorage, recoveryKey, saved, signal);
			}
		} catch (cause) {
			if (!resume) {
				removeWalletRecoveryAndSignatures(
					localStorage,
					recoveryKey,
					matchesAttempt,
					saved.entries.flatMap((entry) => [entry.snapshot.registration?.id, entry.snapshot.payment?.id]),
					params.owner
				);
			}
			throw cause;
		}
		if (resume && batchPurchaseRecoveryApprovalCount(entries) > 0) {
			for (const queued of [...entries]) {
				// Entries keep one lot per order through every checkpoint, so each queued order is still present.
				const current = entries.find((entry) => entry.order.orderId === queued.order.orderId) ?? queued;
				if (current.snapshot.registration?.id && current.snapshot.payment?.id) continue;
				const originalSnapshot = current.snapshot;
				const newlyPreparedIds: string[] = [];
				const adapter = client.purchaseAdapter({
					processId: params.asset.id,
					order: current.order,
					fillQuantity: current.fillQuantity,
					buyer: params.owner,
					startingBalance,
					network,
					onPrepared: (preparedEvent) => {
						const alreadySaved =
							originalSnapshot.registration?.id === preparedEvent.transactionId ||
							originalSnapshot.payment?.id === preparedEvent.transactionId;
						if (!alreadySaved) newlyPreparedIds.push(preparedEvent.transactionId);
						entries = checkpointBatchPreparation(entries, { type: 'signed', ...preparedEvent });
						saved.entries = entries;
						storeWalletRecordOrThrow(localStorage, recoveryKey, saved, matchesAttempt, true);
					},
				});
				try {
					if (!current.snapshot.registration?.id) {
						if (!adapter.prepareBoth) {
							throw appError('unavailable', { message: 'purchase-presign-unavailable' });
						}
						await adapter.prepareBoth(signal);
					} else if (!current.snapshot.payment?.id) {
						if (!current.snapshot.registration.dispatched) {
							await adapter.restorePrepared?.('registration', current.snapshot.registration.id, signal);
						}
						await adapter.preparePayment(current.snapshot.registration.id, signal);
					}
					if (signal.aborted) throw signal.reason;
				} catch (cause) {
					for (const id of newlyPreparedIds) localStorage.removeItem(`bazar-signed-transaction:${id}`);
					entries = entries.map((entry) =>
						entry.order.orderId === current.order.orderId ? { ...entry, snapshot: originalSnapshot } : entry
					);
					saved.entries = entries;
					storeWalletRecordOrThrow(localStorage, recoveryKey, saved, matchesAttempt, true);
					throw cause;
				}
			}
		}
		if (!activeOrderId) setActiveOrderId(entries[0].order.orderId);

		const barrierState = batchPaymentBarrierState(entries);
		let registrationsReady = barrierState.registrationsReady;
		let releasePayments: () => void = () => undefined;
		let rejectPayments: (cause: unknown) => void = () => undefined;
		const paymentGate = new Promise<void>((resolve, reject) => {
			releasePayments = resolve;
			rejectPayments = reject;
		});
		// The gate rejects whenever any lot fails; each waiting lot observes that through its own await.
		void paymentGate.catch(() => undefined);
		const totalPaymentCost = barrierState.pendingPaymentCost;
		let recoveryConflict: AppError | null = null;
		const failRecovery = (cause: unknown) => {
			if (recoveryConflict) return;
			recoveryConflict = toAppError(cause, 'unknown');
			rejectPayments(recoveryConflict);
			for (const purchase of purchasesRef.current.values()) purchase.abandon();
		};
		const recoveryBuffer = batchRecoveryFrameBuffer(() => {
			try {
				storeWalletRecordOrThrow<BatchResume>(
					localStorage,
					fungibleBatchStorageKey(params.asset.id, params.owner),
					saved,
					(current) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
					true
				);
			} catch (cause) {
				failRecovery(cause);
			}
		});
		batchRecoveryBufferRef.current = recoveryBuffer;

		const running = entries.map(async (entry) => {
			if (recoveryConflict) throw recoveryConflict;
			const adapter = client.purchaseAdapter({
				processId: params.asset.id,
				order: entry.order,
				fillQuantity: entry.fillQuantity,
				buyer: params.owner,
				startingBalance: saved.startingBalance,
				network,
			});
			const prepared = preparedByOrder.get(entry.order.orderId);
			const waitForRegistrationAcceptance = adapter.waitForRegistrationAcceptance;
			const coordinatedAdapter = {
				...adapter,
				...(prepared
					? {
							prepareBoth: async () => ({
								registration: prepared.registration,
								payment: prepared.payment,
							}),
					  }
					: {}),
				waitForRegistrationAcceptance: async (
					context: Parameters<NonNullable<typeof waitForRegistrationAcceptance>>[0]
				) => {
					try {
						await waitForRegistrationAcceptance?.(context);
						registrationsReady += 1;
						if (registrationsReady === entries.length) {
							recoveryBuffer.flush();
							if (recoveryConflict) throw recoveryConflict;
							if ((await client.walletBalance(params.owner, signal)) < totalPaymentCost) {
								throw appError('purchase-batch-insufficient-funds');
							}
							recoveryBuffer.flush(true);
							if (recoveryConflict) throw recoveryConflict;
							releasePayments();
						}
						await paymentGate;
					} catch (cause) {
						rejectPayments(cause);
						throw cause;
					}
				},
			};
			let observationRetryAttempt = 0;
			while (true) {
				const purchase = new SwapPurchase(network, coordinatedAdapter, {
					registrationTarget: PURCHASE_REGISTRATION_TARGET,
					paymentTarget: PURCHASE_PAYMENT_TARGET,
					paymentSuccessDepth: 1,
					skipFrom: PURCHASE_SKIP_FROM_DEPTH,
					propagation: 'all',
					minObservers: 2,
					...(resume || observationRetryAttempt > 0 ? { resume: entry.snapshot } : {}),
				});
				purchasesRef.current.set(entry.order.orderId, purchase);
				const update = (purchaseState: PurchaseState) => {
					if (attemptRef.current.signal.aborted || recoveryConflict) return;
					purchaseStateBuffer.push(entry.order.orderId, purchaseState);
					const previousSnapshot = entry.snapshot;
					entry.snapshot = latestRecoverableSnapshot(previousSnapshot, purchase.snapshot());
					if (entry.snapshot === previousSnapshot) return;
					recoveryBuffer.schedule();
				};
				purchase.on('state', update);
				purchase.on('failed', (purchaseState) => {
					const retryKind = purchaseObservationRetryKind(purchaseState);
					if (!retryKind) {
						rejectPayments(
							purchaseStateFailure(purchaseState) ?? appError('purchase-reservation-incomplete')
						);
					}
					update(purchaseState);
					if (retryKind) return;
					const repaired = repairRejectedPurchase(
						entry.snapshot,
						purchaseStateFailure(purchaseState)?.reason
					);
					for (const id of repaired.discardIds) {
						localStorage.removeItem(`bazar-signed-transaction:${id}`);
					}
					if (!repaired.snapshot) {
						entry.snapshot = {};
						saved.entries = saved.entries.filter(
							(savedEntry) => savedEntry.order.orderId !== entry.order.orderId
						);
						if (saved.entries.length) {
							recoveryBuffer.schedule();
							recoveryBuffer.flush();
						} else {
							recoveryBuffer.clear();
							removeWalletRecordIf<BatchResume>(
								localStorage,
								fungibleBatchStorageKey(params.asset.id, params.owner),
								(current) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId
							);
							terminalRecoveryRemoved = true;
						}
					} else if (repaired.snapshot !== entry.snapshot) {
						entry.snapshot = repaired.snapshot ?? {};
						recoveryBuffer.schedule();
						recoveryBuffer.flush();
					}
				});
				purchase.on('complete', update);
				const resumeState =
					resume || observationRetryAttempt > 0
						? purchaseObservationResumeState(entry.snapshot, flow.purchaseStates[entry.order.orderId])
						: null;
				if (resumeState) purchaseStateBuffer.push(entry.order.orderId, resumeState);
				else update(purchase.state());
				const finalState = await purchase.run();
				const retryKind = purchaseObservationRetryKind(finalState);
				if (!retryKind) return finalState;
				const delay = purchaseObservationRetryDelay(observationRetryAttempt++);
				purchaseStateBuffer.push(entry.order.orderId, purchaseObservationPendingState(finalState));
				purchaseStateBuffer.flush();
				recoveryBuffer.flush();
				dispatch({ type: 'observation-retry', message: purchaseObservationRetryMessage(finalState, delay) });
				await waitForPurchaseObservationRetry(delay, signal);
				dispatch({ type: 'status', message: purchaseObservationCheckingMessage(retryKind) });
			}
		});

		try {
			await waitForSettlementBatch(running);
		} catch (cause) {
			if (terminalRecoveryRemoved) recoveryBuffer.clear();
			else recoveryBuffer.flush();
			if (signal.aborted) purchaseStateBuffer.clear();
			else purchaseStateBuffer.flush();
			if (recoveryConflict) throw recoveryConflict;
			throw cause;
		}
		recoveryBuffer.clear();
		if (batchRecoveryBufferRef.current === recoveryBuffer) batchRecoveryBufferRef.current = null;
		purchaseStateBuffer.flush();
		dispatch({ type: 'status', message: messages.flowLotsProven });
		removeWalletRecoveryAndSignatures<BatchResume>(
			localStorage,
			fungibleBatchStorageKey(params.asset.id, params.owner),
			(current) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
			entries.flatMap((entry) => [entry.snapshot.registration?.id, entry.snapshot.payment?.id]),
			params.owner
		);
		releaseClaim();
		dispatch({ type: 'completed' });
	}

	// Saved signed work resumes once, as soon as its dialog opens.
	React.useEffect(() => {
		if (!shouldResumeFungibleOperation(params.operation) || resumed.current) return;
		resumed.current = true;
		void submitRef.current();
	}, [params.operation]);

	const visibleFills = fungibleOperationVisibleFills(params.operation, params.matchedFills);
	const visibleOrders = visibleFills.map((fill) => fill.order);
	const activeOrder = visibleOrders.find((order) => order.orderId === activeOrderId) ?? visibleOrders[0];
	const activePurchase = activeOrder ? flow.purchaseStates[activeOrder.orderId] : undefined;
	const observedOrderId = activeOrder?.orderId;
	const activePaymentId = activePurchase?.payment?.id;

	React.useEffect(() => {
		if (
			flow.phase !== 'done' ||
			params.operation.kind !== 'buy' ||
			!params.visible ||
			!observedOrderId ||
			!activePaymentId
		)
			return;
		const network = networkRef.current?.network;
		if (!network) return;
		const watcher = continuePaymentConfirmations(network, activePaymentId, (observation) => {
			dispatch({ type: 'payment-observed', orderId: observedOrderId, paymentId: activePaymentId, observation });
		});
		return () => watcher.stop();
	}, [activePaymentId, flow.phase, observedOrderId, params.operation.kind, params.visible]);

	const recoverableBatch = isRecoverableFungiblePurchase(params.operation, flow.purchaseStates);
	const settlementSummary = batchSettlementSummary(
		visibleOrders.map((order) => flow.purchaseStates[order.orderId]),
		messages
	);
	const signedWork = Boolean(flow.transaction || recoverableBatch);

	React.useEffect(() => {
		if (params.operation.kind !== 'buy' || flow.phase !== 'working') return;
		const next = nextSettlementAnnouncement(
			settlementAnnouncementKeyRef.current,
			signedWork,
			visibleOrders.length,
			{
				failed: settlementSummary.failed,
				settled: settlementSummary.settled,
			},
			messages,
			plural
		);
		if (!next) return;
		settlementAnnouncementKeyRef.current = next.key;
		setSettlementAnnouncement(next.message);
	}, [
		flow.phase,
		messages,
		params.operation.kind,
		plural,
		settlementSummary.failed,
		settlementSummary.settled,
		signedWork,
		visibleOrders.length,
	]);

	const purchaseSync = fungiblePurchaseSync(messages, activePurchase);
	const singleSteps = fungibleSingleSyncSteps(
		params.operation.kind,
		flow.transaction,
		flow.confirmations,
		flow.views,
		flow.consensus,
		messages
	);
	const activeSyncStep =
		params.operation.kind === 'buy'
			? purchaseSync.steps.find((step) => step.key === purchaseSync.activeStep) ?? purchaseSync.steps[0]
			: singleSteps[0];
	const activityProgress = fungibleOperationActivityProgress(flow.phase, messages, activeSyncStep);

	React.useEffect(() => {
		activityChangeRef.current(activityProgress);
	}, [
		activityProgress.confirmations,
		activityProgress.confirmationTarget,
		activityProgress.phase,
		activityProgress.status,
	]);

	function abandonAttempt() {
		attemptRef.current.abort();
		for (const purchase of purchasesRef.current.values()) purchase.abandon();
		purchasesRef.current.clear();
		networkRef.current?.release();
		networkRef.current = null;
		releaseClaim();
	}

	function restartPurchase() {
		if (!recoverableBatch) {
			dispatch({ type: 'form-reopened' });
			return;
		}
		batchRecoveryBufferRef.current?.flush();
		abandonAttempt();
		params.onRestart();
	}

	function acknowledgeTerminalPurchase() {
		batchRecoveryBufferRef.current?.clear();
		purchaseStateBuffer.clear();
		abandonAttempt();
		const receiptIds = visibleOrders.flatMap((order) => {
			const purchase = flow.purchaseStates[order.orderId];
			return [purchase?.registration?.id, purchase?.payment?.id].filter((id): id is string => Boolean(id));
		});
		const expectedAttemptId =
			params.operation.kind === 'buy' ? fungiblePurchaseResumeOf(params.operation)?.attemptId : undefined;
		removeWalletRecoveryAndSignatures<BatchResume>(
			localStorage,
			fungibleBatchStorageKey(params.asset.id, params.owner),
			(current) => {
				if (current.buyer !== params.owner) return false;
				if (expectedAttemptId) {
					return (current.attemptId ?? batchRecoveryIdentity(current.entries)) === expectedAttemptId;
				}
				const savedIds = current.entries.flatMap((entry) => [
					entry.snapshot.registration?.id,
					entry.snapshot.payment?.id,
				]);
				return receiptIds.length > 0 && receiptIds.every((id) => savedIds.includes(id));
			},
			receiptIds,
			params.owner
		);
		params.onClose(false);
	}

	function discardTransfer() {
		const transaction = flow.transaction;
		if (!transaction) return;
		const discarded = removeWalletRecoveryAndSignatures<SavedOperationRecordMatch>(
			localStorage,
			operationStorageKey(params.asset.id, params.owner),
			(record) => record?.txId === transaction.id,
			[transaction.id],
			params.owner
		);
		if (!discarded) {
			dispatch({ type: 'status', message: messages.flowTransferChangedElsewhere });
			return;
		}
		dispatch({ type: 'transaction-discarded' });
		params.onClose(false, false);
	}

	function discardRejectedSignature() {
		const transaction = flow.transaction;
		if (!transaction) return;
		removeWalletRecordIf<SavedOperationRecordMatch>(
			localStorage,
			operationStorageKey(params.asset.id, params.owner),
			(record) => record?.txId === transaction.id
		);
		localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
		params.onClose(false);
	}

	const incompletePurchases = visibleOrders.length - settlementSummary.settled;
	return {
		phase: flow.phase,
		message: flow.message,
		failure: flow.failure,
		failureKind: flow.failure ? operationFailureKind(flow.failure) : null,
		transaction: flow.transaction,
		confirmations: flow.confirmations,
		purchaseStates: flow.purchaseStates,
		visibleFills,
		visibleOrders,
		activeOrder,
		activePurchase,
		activePurchaseFailure: purchaseStateFailure(activePurchase),
		purchaseSync,
		singleSteps,
		workingStatus: fungibleOperationWorkingStatus(
			params.operation.kind,
			flow.message,
			errorMessages,
			activePurchase
		),
		recoverableBatch,
		signedWork,
		settlementAnnouncement,
		incompletePurchases,
		purchaseNeedsManualReview:
			visibleOrders.some((order) => purchaseSettlementNeedsManualReview(flow.purchaseStates[order.orderId])) ||
			operationFailureNeedsManualReview(flow.failure),
		startedAt: submittedAtRef.current,
		submit: () => void submit(),
		selectOrder: setActiveOrderId,
		skipPurchase: (orderId) => {
			purchasesRef.current.get(orderId)?.skip();
		},
		reopenForm: () => dispatch({ type: 'form-reopened' }),
		restartPurchase,
		acknowledgeTerminalPurchase,
		discardTransfer,
		discardRejectedSignature,
	};
}
