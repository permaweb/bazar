import React from 'react';
import { ArrowLeft, CircleX, ShoppingCart, Tag } from 'lucide-react';

import type { AssetSummary } from 'api/collections';
import {
	type AssetState,
	filledOrder,
	formatTokenAmount,
	liquidBalanceOf,
	listedBalanceOf,
	matchOrderFills,
	type OrderFill,
	parseTokenAmount,
	readAssetStateWithDeadline,
} from 'api/marketplace';
import { acquireAssetObserverNetwork, type AssetObserverNetworkLease } from 'api/observers';
import {
	acquireWalletOperationClaim,
	discardNewlyPreparedTransactionIfAborted,
	fungibleBatchStorageKey,
	type FungibleOperationActivitySummary,
	hasRecoverablePurchase,
	operationClaimStorageKey,
	operationStorageKey,
	promoteWalletOperationClaim,
	releaseWalletOperationClaim,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	repairRejectedPurchase,
	shouldAutomaticallyResumePurchase,
	storeWalletRecordOrThrow,
	type WalletOperationClaim,
} from 'api/operations';
import {
	AssetTransactionClient,
	type Consensus,
	continuePaymentConfirmations,
	dispatchAndConfirm,
	type ObserverView,
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
	purchaseSkipKind,
	type PurchaseState,
	SwapPurchase,
	waitForPurchaseObservationRetry,
	withContinuingPaymentObservation,
} from 'api/transactions';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { TextInput } from 'components/atoms/TextInput';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { Tooltip } from 'components/atoms/Tooltip';
import { DialogHeading } from 'components/molecules/DialogHeading';
import {
	OperationExternalLink,
	OperationOutcome,
	OperationOutcomeAnnouncement,
	OperationOutcomeSubject,
} from 'components/molecules/OperationOutcomeAnnouncement';
import { RetryNotice } from 'components/molecules/RetryNotice';
import {
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
	TransactionDialogControl,
	transactionDialogDismissAction,
} from 'components/molecules/TransactionDialogControl';
import { Dialog } from 'components/organisms/Dialog';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { currentPurchaseGatewayContext } from 'features/Operations';
import { type ArweaveSyncStep, postConfirmationPendingLabel, quorumConfirmationDepth } from 'features/TransactionSync';
import { winstonToArDecimal } from 'helpers/ar-units';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';
import {
	marketplaceCodedError,
	marketplaceErrorMessage as errorMessage,
	type MarketplaceOperationFailure,
	marketplaceOperationFailure,
} from 'helpers/marketplace-error';
import { formatTickerLabel } from 'helpers/token-display';

import {
	batchPaymentBarrierState,
	batchPurchaseRecoveryApprovalCopy,
	batchPurchaseRecoveryApprovalCount,
	batchPurchaseStartingBalance,
	batchRecoveryFrameBuffer,
	batchRecoveryIdentity,
	batchSettlementSummary,
	checkpointBatchPreparation,
	latestRecoverableSnapshot,
	nextSettlementAnnouncement,
	preparedEntry,
	purchaseQuoteIdentity,
	purchaseStateFrameBuffer,
	settlementTabIndex,
	storeBatchRecoveryBeforeDispatch,
	waitForSettlementBatch,
} from '../../../model/fungible-batch';
import { lotAsking, safeArPrice, safeLotQuote, safeTokenAmount, tokenLabel } from '../../../model/fungible-market';
import {
	BatchEntry,
	BatchResume,
	batchStageLabel,
	FungibleOperation,
	fungibleOperationActivityProgress,
	fungibleOperationStateError,
	fungibleOperationWorkingStatus,
	fungiblePurchaseResumeOf,
	fungibleTransferRecipientError,
	fungibleTransferSubmitLabel,
	operationLabel,
	purchaseFailureMessageNeedsManualReview,
	purchaseSettlementNeedsManualReview,
	SETTLEMENT_ERROR_PANEL_ID,
} from '../../../model/fungible-operation';
import { FungibleOperationErrorAlert } from '../../molecules/FungibleOperationErrorAlert';
import { FungiblePurchaseSequence } from '../../molecules/FungiblePurchaseSequence';
import { FungibleSettlementRecoveryPanel } from '../../molecules/FungibleSettlementRecoveryPanel';
import { PurchaseRoute } from '../../molecules/PurchaseRoute';
import { DeferredTransactionSync as ArweaveTransactionSync } from '../DeferredTransactionSync';
import { FungiblePurchaseReceiptNavigator } from '../FungiblePurchaseReceiptNavigator';

export default function FungibleOperationDialog(props: {
	asset: AssetSummary;
	collectionId: string;
	state: AssetState;
	owner: string;
	operation: FungibleOperation;
	visible: boolean;
	restoreFallback(): HTMLElement | null;
	onHide(): void;
	onActivityChange(
		update: Pick<FungibleOperationActivitySummary, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>
	): void;
	onRestart(): void;
	onClose(resumeLater?: boolean, refresh?: boolean): void;
}) {
	const recoveryApprovalCount =
		props.operation.kind === 'buy' && props.operation.resume
			? batchPurchaseRecoveryApprovalCount(props.operation.resume.entries)
			: 0;
	const recoveryApprovalCopy =
		props.operation.kind === 'buy' && props.operation.resume
			? batchPurchaseRecoveryApprovalCopy(props.operation.resume.entries)
			: null;
	const eligible = React.useMemo(
		() =>
			props.operation.kind === 'buy'
				? props.operation.availableOrders.filter((order) => order.status === 'open')
				: [],
		[props.operation.kind, props.operation.kind === 'buy' ? props.operation.availableOrders : undefined]
	);
	const initialQuantity =
		props.operation.kind === 'buy' && props.operation.resume
			? formatTokenAmount(
					props.operation.resume.entries
						.reduce((total, entry) => total + BigInt(entry.fillQuantity), 0n)
						.toString(),
					props.state.denomination
			  )
			: props.operation.kind === 'buy'
			? props.operation.quantity ?? ''
			: '';
	const [quantity, setQuantity] = React.useState(
		props.operation.kind === 'sell' || props.operation.kind === 'transfer'
			? props.operation.quantity ?? ''
			: initialQuantity
	);
	const [unitPrice, setUnitPrice] = React.useState(
		props.operation.kind === 'sell' ? props.operation.unitPrice ?? '' : ''
	);
	const [recipient, setRecipient] = React.useState(
		props.operation.kind === 'transfer' ? props.operation.recipient ?? '' : ''
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
	const [failureKind, setFailureKind] = React.useState<MarketplaceOperationFailure | null>(null);
	const [views, setViews] = React.useState<ObserverView[]>([]);
	const [confirmations, setConfirmations] = React.useState(0);
	const [consensus, setConsensus] = React.useState<Consensus | null>(null);
	const [transaction, setTransaction] = React.useState<PreparedTransaction | null>(null);
	const [purchaseStates, setPurchaseStates] = React.useState<Record<string, PurchaseState>>({});
	const purchaseStateBufferRef = React.useRef<ReturnType<typeof purchaseStateFrameBuffer> | null>(null);
	if (!purchaseStateBufferRef.current) {
		purchaseStateBufferRef.current = purchaseStateFrameBuffer((updates) => {
			setPurchaseStates((current) => ({ ...current, ...updates }));
		});
	}
	const batchRecoveryBufferRef = React.useRef<ReturnType<typeof batchRecoveryFrameBuffer> | null>(null);
	const [activeOrderId, setActiveOrderId] = React.useState(
		props.operation.kind === 'buy' ? fungiblePurchaseResumeOf(props.operation)?.entries[0]?.order.orderId ?? '' : ''
	);
	const [estimatedCost, setEstimatedCost] = React.useState<string | null>(null);
	const [estimatedWalletBalance, setEstimatedWalletBalance] = React.useState<string | null>(null);
	const [canAfford, setCanAfford] = React.useState<boolean | null>(null);
	const [quoteState, setQuoteState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
	const [quoteRetry, setQuoteRetry] = React.useState(0);
	const [hiding, setHiding] = React.useState(false);
	const [settlementAnnouncement, setSettlementAnnouncement] = React.useState('');
	const settlementAnnouncementKeyRef = React.useRef('');
	const submittedAtRef = React.useRef<number | undefined>(
		props.operation.kind === 'buy' && Number.isFinite(fungiblePurchaseResumeOf(props.operation)?.createdAt)
			? fungiblePurchaseResumeOf(props.operation)?.createdAt
			: undefined
	);
	const purchasesRef = React.useRef<Map<string, SwapPurchase>>(new Map());
	const networkRef = React.useRef<AssetObserverNetworkLease | null>(null);
	const claimRef = React.useRef<WalletOperationClaim | null>(null);
	const exactActionBaselineRef = React.useRef<{ startingSlot: number } | null>(
		(props.operation.kind === 'cancel' || props.operation.kind === 'transfer') &&
			Number.isSafeInteger(props.operation.startingSlot)
			? { startingSlot: props.operation.startingSlot! }
			: (props.operation.kind === 'cancel' || props.operation.kind === 'transfer') && props.operation.resumeId
			? { startingSlot: 0 }
			: null
	);
	const attemptRef = React.useRef(new AbortController());
	const cleanupTimerRef = React.useRef<number | undefined>();
	const hideTimerRef = React.useRef<number | null>(null);
	const dialogRef = React.useRef<HTMLElement | null>(null);
	const activityChangeRef = React.useRef(props.onActivityChange);
	activityChangeRef.current = props.onActivityChange;
	const resumed = React.useRef(false);
	const ticker = props.state.ticker || 'Token';
	const tickerDisplay = formatTickerLabel(ticker);
	const automaticMatchResult = React.useMemo(() => {
		if (props.operation.kind !== 'buy') return { match: null, error: '' };
		try {
			const atomic = parseTokenAmount(quantity, props.state.denomination);
			const match = matchOrderFills(eligible, atomic);
			return {
				match,
				error: match
					? ''
					: `Only ${tokenLabel(
							eligible.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
							props.state
					  )} is currently available.`,
			};
		} catch (cause) {
			return {
				match: null,
				error:
					cause instanceof RangeError
						? 'This order book is too large to quote safely. Refresh and try again.'
						: quantity
						? `Enter a valid ${tickerDisplay} amount using no more than ${props.state.denomination} decimal places.`
						: '',
			};
		}
	}, [eligible, props.operation.kind, quantity, props.state, props.state.denomination, tickerDisplay]);
	const automaticMatch = automaticMatchResult.match;
	const matchedFills = automaticMatch?.fills ?? [];
	const matchedOrders = matchedFills.map((fill) => fill.order);
	const matchedQuantity = matchedOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
	const matchedAsking = matchedOrders.reduce((total, order) => total + BigInt(order.asking), 0n);
	const matchedSellers = new Set(matchedOrders.map((order) => order.creator)).size;
	const enteredQuantity = safeTokenAmount(quantity, props.state.denomination);
	const currentLiquid = BigInt(liquidBalanceOf(props.state, props.owner));
	const currentListed = BigInt(listedBalanceOf(props.state, props.owner));
	const listingQuote = props.operation.kind === 'sell' ? safeLotQuote(quantity, unitPrice, props.state) : null;
	const unitPriceValid = safeArPrice(unitPrice);
	const transferRecipient =
		props.operation.kind === 'transfer' ? (props.operation.recipient ?? recipient).trim() : recipient.trim();
	const recipientError =
		props.operation.kind === 'transfer' ? fungibleTransferRecipientError(transferRecipient, props.owner) : '';
	const sellValid =
		props.operation.kind === 'sell' &&
		enteredQuantity !== null &&
		enteredQuantity <= currentLiquid &&
		unitPriceValid &&
		listingQuote !== null;
	const transferValid =
		props.operation.kind === 'transfer' &&
		!recipientError &&
		enteredQuantity !== null &&
		enteredQuantity <= currentLiquid;
	const quantityGuidanceId = React.useId();
	const priceGuidanceId = React.useId();
	const recipientGuidanceId = React.useId();
	const quoteStatusId = React.useId();
	const dialogTitleId = React.useId();
	const operationLabelId = React.useId();

	React.useEffect(() => {
		if (cleanupTimerRef.current !== undefined) window.clearTimeout(cleanupTimerRef.current);
		return () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
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

	React.useEffect(() => {
		if (props.visible) setHiding(false);
	}, [props.visible]);

	React.useEffect(() => {
		if (props.operation.kind !== 'buy' || !matchedOrders.length || props.operation.resume) {
			setEstimatedCost(null);
			setEstimatedWalletBalance(null);
			setCanAfford(null);
			setQuoteState('idle');
			return;
		}
		const controller = new AbortController();
		const client = new AssetTransactionClient();
		setEstimatedCost(null);
		setEstimatedWalletBalance(null);
		setCanAfford(null);
		setQuoteState('loading');
		const quoteTimer = window.setTimeout(() => {
			void Promise.all([
				client.estimatePurchaseBatchCosts(matchedOrders, props.asset.id, controller.signal),
				client.walletBalance(props.owner, controller.signal),
			])
				.then(([costs, walletBalance]) => {
					if (!controller.signal.aborted) {
						const total = costs.reduce((sum, item) => sum + BigInt(item.total), 0n);
						setEstimatedCost(total.toString());
						setEstimatedWalletBalance(walletBalance.toString());
						setCanAfford(walletBalance >= total);
						setQuoteState('ready');
					}
				})
				.catch(() => {
					if (!controller.signal.aborted) {
						setEstimatedCost(null);
						setEstimatedWalletBalance(null);
						setCanAfford(null);
						setQuoteState('error');
					}
				});
		}, 250);
		return () => {
			window.clearTimeout(quoteTimer);
			controller.abort();
		};
	}, [
		props.asset.id,
		purchaseQuoteIdentity(matchedOrders),
		props.operation.kind,
		props.operation.kind === 'buy' ? props.operation.resume : undefined,
		props.owner,
		quoteRetry,
	]);

	React.useEffect(() => {
		const shouldResume =
			(props.operation.kind === 'buy' &&
				fungiblePurchaseResumeOf(props.operation)?.entries.every((entry) =>
					shouldAutomaticallyResumePurchase(entry.snapshot)
				)) ||
			(props.operation.kind !== 'buy' && props.operation.resumeId);
		if (!shouldResume || resumed.current) return;
		resumed.current = true;
		void submit();
	}, []);

	async function submit() {
		submittedAtRef.current ??= Date.now();
		setMessage('');
		setFailureKind(null);
		setPhase('working');
		let attemptedTransactionId =
			props.operation.kind === 'buy' ? undefined : props.operation.resumeId ?? transaction?.id;
		try {
			const freshOperation =
				props.operation.kind === 'buy' ? !props.operation.resume : !props.operation.resumeId && !transaction;
			const signal = attemptRef.current.signal;
			const operationKey = operationStorageKey(props.asset.id, props.owner);
			const purchaseKey = fungibleBatchStorageKey(props.asset.id, props.owner);
			const resumeTransactionId =
				props.operation.kind === 'buy' ? undefined : props.operation.resumeId ?? transaction?.id;
			let exactActionBaseline = exactActionBaselineRef.current;
			let freshState: AssetState | undefined;
			claimRef.current = await acquireWalletOperationClaim(
				localStorage,
				operationClaimStorageKey(
					props.asset.id,
					props.owner,
					props.operation.kind === 'buy' ? 'purchase' : 'asset'
				),
				props.operation.kind === 'buy' ? [purchaseKey] : [operationKey],
				{
					...(freshOperation
						? {}
						: props.operation.kind === 'buy' && props.operation.resume
						? {
								recovery: {
									key: purchaseKey,
									matches: (record: any) =>
										record?.buyer === props.owner &&
										(record?.attemptId ?? batchRecoveryIdentity(record?.entries ?? [])) ===
											(fungiblePurchaseResumeOf(props.operation)?.attemptId ??
												batchRecoveryIdentity(
													fungiblePurchaseResumeOf(props.operation)?.entries ?? []
												)),
								},
						  }
						: {
								recovery: {
									key: operationKey,
									matches: (record: any) => record?.txId === resumeTransactionId,
								},
						  }),
				}
			);
			if (freshOperation) {
				({ state: freshState } = await readAssetStateWithDeadline(props.asset.id, { signal, maxAge: 0 }));
				const expectedOrders =
					props.operation.kind === 'buy'
						? matchedFills.map((fill) => fill.sourceOrder)
						: props.operation.kind === 'cancel'
						? [props.operation.order]
						: [];
				const rawQuantity =
					props.operation.kind === 'sell' || props.operation.kind === 'transfer'
						? parseTokenAmount(quantity, props.state.denomination)
						: '0';
				const stateError = fungibleOperationStateError(
					props.operation.kind,
					freshState,
					props.owner,
					expectedOrders,
					rawQuantity,
					props.state.denomination
				);
				if (stateError) throw new Error(stateError);
				if (props.operation.kind === 'cancel' || props.operation.kind === 'transfer') {
					const startingSlot = Number(freshState.raw['at-slot']);
					if (!Number.isSafeInteger(startingSlot) || startingSlot < 0) {
						throw new Error('asset-action-starting-slot-unavailable');
					}
					exactActionBaseline = { startingSlot };
					exactActionBaselineRef.current = exactActionBaseline;
				}
			}
			const client = new AssetTransactionClient();
			if (props.operation.kind === 'buy') {
				if (!props.operation.resume && !matchedFills.length)
					throw new Error('Enter an amount available from the order book.');
				await runPurchaseBatch(
					client,
					fungiblePurchaseResumeOf(props.operation)?.entries ??
						matchedFills.map((fill) => ({
							order: fill.sourceOrder,
							fillQuantity: fill.order.quantity,
							snapshot: {},
						})),
					props.operation.resume,
					batchPurchaseStartingBalance(
						props.operation.resume,
						freshState,
						props.owner,
						props.operation.startingBalance
					)
				);
				return;
			}

			let prepared: PreparedTransaction;
			let newlyPrepared = false;
			let rawQuantity = '';
			let asking = '';
			if (props.operation.kind === 'transfer') {
				const transferError = fungibleTransferRecipientError(transferRecipient, props.owner);
				if (transferError) throw new Error(transferError);
			}
			if (transaction) prepared = transaction;
			else if (props.operation.resumeId) prepared = client.restore(props.operation.resumeId, props.owner);
			else if (props.operation.kind === 'sell') {
				rawQuantity = parseTokenAmount(quantity, props.state.denomination);
				if (
					BigInt(rawQuantity) < 1n ||
					BigInt(rawQuantity) > BigInt(liquidBalanceOf(props.state, props.owner))
				) {
					throw new Error('Enter a quantity within your liquid balance.');
				}
				asking = lotAsking(rawQuantity, unitPrice, props.state.denomination);
				prepared = await client.makeOffer(
					{ processId: props.asset.id, quantity: rawQuantity, asking, seller: props.owner },
					signal
				);
				newlyPrepared = true;
			} else if (props.operation.kind === 'cancel') {
				prepared = await client.cancelOrder(props.asset.id, props.operation.order.orderId, props.owner, signal);
				newlyPrepared = true;
			} else {
				rawQuantity = parseTokenAmount(quantity, props.state.denomination);
				if (
					BigInt(rawQuantity) < 1n ||
					BigInt(rawQuantity) > BigInt(liquidBalanceOf(props.state, props.owner))
				) {
					throw new Error('Enter a quantity within your liquid balance.');
				}
				prepared = await client.transferFungible(
					props.asset.id,
					transferRecipient,
					rawQuantity,
					props.owner,
					signal
				);
				newlyPrepared = true;
			}
			if (discardNewlyPreparedTransactionIfAborted(localStorage, prepared.id, newlyPrepared, signal)) {
				throw signal.reason;
			}
			attemptedTransactionId = prepared.id;
			setTransaction(prepared);
			if ((props.operation.kind === 'cancel' || props.operation.kind === 'transfer') && !exactActionBaseline) {
				throw new Error('asset-action-recovery-baseline-missing');
			}
			const operationRecord = {
				txId: prepared.id,
				kind: props.operation.kind,
				assetId: props.asset.id,
				asset: props.asset,
				activityKind: 'fungible',
				collectionId: props.collectionId,
				signer: props.owner,
				...(props.operation.kind === 'cancel'
					? { order: props.operation.order, startingSlot: exactActionBaseline!.startingSlot }
					: props.operation.kind === 'sell'
					? { quantity, unitPrice }
					: {
							quantity,
							recipient: transferRecipient,
							startingSlot: exactActionBaseline!.startingSlot,
					  }),
				createdAt: Date.now(),
			};
			try {
				const matches = (current: any) => current?.txId === prepared.id;
				if (claimRef.current) {
					promoteWalletOperationClaim(
						localStorage,
						claimRef.current,
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
			await dispatchAndConfirm(prepared, {
				signal,
				target: 5,
				onViews: setViews,
				onConsensus: setConsensus,
				onProgress: (progress) => setConfirmations(progress.confirmations),
			});
			setConfirmations(5);
			setMessage('Five confirmations reached. Waiting for live token state…');
			if (props.operation.kind === 'sell') {
				const expectedQuantity =
					rawQuantity || parseTokenAmount(props.operation.quantity ?? quantity, props.state.denomination);
				const expectedAsking =
					asking ||
					lotAsking(expectedQuantity, props.operation.unitPrice ?? unitPrice, props.state.denomination);
				await client.waitForOfferAcceptance(
					props.asset.id,
					{
						orderId: prepared.id,
						seller: props.owner,
						quantity: expectedQuantity,
						asking: expectedAsking,
					},
					signal
				);
			} else if (props.operation.kind === 'cancel') {
				await client.waitForExactCancellation(
					props.asset.id,
					prepared.id,
					props.owner,
					props.operation.order,
					exactActionBaseline!,
					signal
				);
			} else {
				const expectedQuantity =
					rawQuantity || parseTokenAmount(props.operation.quantity ?? quantity, props.state.denomination);
				if (!exactActionBaseline) throw new Error('asset-action-recovery-baseline-missing');
				await client.waitForFungibleTransfer(
					props.asset.id,
					prepared.id,
					props.owner,
					transferRecipient,
					expectedQuantity,
					exactActionBaseline,
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
			if (claimRef.current) {
				releaseWalletOperationClaim(localStorage, claimRef.current);
				claimRef.current = null;
			}
			setPhase('done');
		} catch (cause) {
			if (claimRef.current) {
				releaseWalletOperationClaim(localStorage, claimRef.current);
				claimRef.current = null;
			}
			networkRef.current?.release();
			networkRef.current = null;
			if (attemptRef.current.signal.aborted) return;
			if (
				cause instanceof Error &&
				['asset-cancel-rejected', 'fungible-transfer-rejected'].includes(cause.message) &&
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
			setFailureKind(marketplaceOperationFailure(cause));
			setMessage(errorMessage(cause));
			setPhase('error');
		}
	}

	async function runPurchaseBatch(
		client: AssetTransactionClient,
		requested: Array<Pick<BatchEntry, 'order' | 'fillQuantity' | 'snapshot'>>,
		resume?: BatchResume,
		startingBalance = props.operation.kind === 'buy' ? props.operation.startingBalance : '0'
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
			asset: props.asset,
			activityKind: 'fungible',
			buyer: props.owner,
			collectionId: props.collectionId,
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
		const recoveryKey = fungibleBatchStorageKey(props.asset.id, props.owner);
		const matchesAttempt = (current: BatchResume) =>
			current.buyer === props.owner &&
			(current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId;
		try {
			if (!resume) {
				const prepared = await client.preparePurchaseBatch(
					requested.map(({ order, fillQuantity }) => ({
						processId: props.asset.id,
						order,
						fillQuantity,
						buyer: props.owner,
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
					props.owner
				);
			}
			throw cause;
		}
		if (resume && batchPurchaseRecoveryApprovalCount(entries) > 0) {
			for (const queued of [...entries]) {
				const current = entries.find((entry) => entry.order.orderId === queued.order.orderId)!;
				if (current.snapshot.registration?.id && current.snapshot.payment?.id) continue;
				const originalSnapshot = current.snapshot;
				const newlyPreparedIds: string[] = [];
				const adapter = client.purchaseAdapter({
					processId: props.asset.id,
					order: current.order,
					fillQuantity: current.fillQuantity,
					buyer: props.owner,
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
						if (!adapter.prepareBoth) throw new Error('purchase-presign-unavailable');
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
		let releasePayments!: () => void;
		let rejectPayments!: (cause: unknown) => void;
		const paymentGate = new Promise<void>((resolve, reject) => {
			releasePayments = resolve;
			rejectPayments = reject;
		});
		void paymentGate.catch(() => undefined);
		const totalPaymentCost = barrierState.pendingPaymentCost;
		let recoveryConflict: Error | null = null;
		const failRecovery = (cause: unknown) => {
			if (recoveryConflict) return;
			recoveryConflict = cause instanceof Error ? cause : new Error(String(cause));
			rejectPayments(recoveryConflict);
			for (const purchase of purchasesRef.current.values()) purchase.abandon();
		};
		const recoveryBuffer = batchRecoveryFrameBuffer(() => {
			try {
				storeWalletRecordOrThrow<BatchResume>(
					localStorage,
					fungibleBatchStorageKey(props.asset.id, props.owner),
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
				processId: props.asset.id,
				order: entry.order,
				fillQuantity: entry.fillQuantity,
				buyer: props.owner,
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
							if ((await client.walletBalance(props.owner, signal)) < totalPaymentCost) {
								throw new Error(
									'The wallet no longer has enough AR to pay every reserved listing. No seller payment was sent.'
								);
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
					purchaseStateBufferRef.current!.push(entry.order.orderId, purchaseState);
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
							new Error(
								purchaseState.error?.message ??
									'A reservation could not complete. No remaining seller payment was sent.'
							)
						);
					}
					update(purchaseState);
					if (retryKind) return;
					const failureCode =
						purchaseState.error?.code === 'unexpected'
							? purchaseState.error.message
							: purchaseState.error?.code;
					const repaired = repairRejectedPurchase(entry.snapshot, failureCode);
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
								fungibleBatchStorageKey(props.asset.id, props.owner),
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
						? purchaseObservationResumeState(entry.snapshot, purchaseStates[entry.order.orderId])
						: null;
				if (resumeState) purchaseStateBufferRef.current!.push(entry.order.orderId, resumeState);
				else update(purchase.state());
				const finalState = await purchase.run();
				const retryKind = purchaseObservationRetryKind(finalState);
				if (!retryKind) return finalState;
				const delay = purchaseObservationRetryDelay(observationRetryAttempt++);
				purchaseStateBufferRef.current!.push(entry.order.orderId, purchaseObservationPendingState(finalState));
				purchaseStateBufferRef.current!.flush();
				recoveryBuffer.flush();
				setFailureKind(null);
				setMessage(purchaseObservationRetryMessage(finalState, delay));
				await waitForPurchaseObservationRetry(delay, signal);
				setMessage(purchaseObservationCheckingMessage(retryKind));
			}
		});

		try {
			await waitForSettlementBatch(running);
		} catch (cause) {
			if (terminalRecoveryRemoved) recoveryBuffer.clear();
			else recoveryBuffer.flush();
			if (signal.aborted) purchaseStateBufferRef.current!.clear();
			else purchaseStateBufferRef.current!.flush();
			if (recoveryConflict) throw recoveryConflict;
			throw cause;
		}
		recoveryBuffer.clear();
		if (batchRecoveryBufferRef.current === recoveryBuffer) batchRecoveryBufferRef.current = null;
		purchaseStateBufferRef.current!.flush();
		setMessage('Every lot is proven in its scheduled payment slot.');
		removeWalletRecoveryAndSignatures<BatchResume>(
			localStorage,
			fungibleBatchStorageKey(props.asset.id, props.owner),
			(current) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
			entries.flatMap((entry) => [entry.snapshot.registration?.id, entry.snapshot.payment?.id]),
			props.owner
		);
		if (claimRef.current) {
			releaseWalletOperationClaim(localStorage, claimRef.current);
			claimRef.current = null;
		}
		setPhase('done');
	}

	const visibleFills: OrderFill[] =
		props.operation.kind === 'buy'
			? fungiblePurchaseResumeOf(props.operation)?.entries.map((entry) => ({
					sourceOrder: entry.order,
					order: filledOrder(entry.order, entry.fillQuantity),
					partial: entry.fillQuantity !== entry.order.quantity,
			  })) ?? matchedFills
			: [];
	const visibleOrders = visibleFills.map((fill) => fill.order);
	const activeOrder = visibleOrders.find((order) => order.orderId === activeOrderId) ?? visibleOrders[0];
	const activePurchase = activeOrder ? purchaseStates[activeOrder.orderId] : undefined;
	const workingStatus = fungibleOperationWorkingStatus(props.operation.kind, message, activePurchase);
	const observedOrderId = activeOrder?.orderId;
	React.useEffect(() => {
		const paymentId = activePurchase?.payment?.id;
		if (phase !== 'done' || props.operation.kind !== 'buy' || !props.visible || !observedOrderId || !paymentId)
			return;
		const network = networkRef.current?.network;
		if (!network) return;
		const watcher = continuePaymentConfirmations(network, paymentId, (observation) => {
			setPurchaseStates((current) => {
				const next = withContinuingPaymentObservation(current[observedOrderId] ?? null, paymentId, observation);
				return next ? { ...current, [observedOrderId]: next } : current;
			});
		});
		return () => watcher.stop();
	}, [activePurchase?.payment?.id, observedOrderId, props.operation.kind, phase, props.visible]);
	const recoverableBatch =
		props.operation.kind === 'buy' &&
		(fungiblePurchaseResumeOf(props.operation)?.entries.some((entry) => hasRecoverablePurchase(entry.snapshot)) ||
			Object.values(purchaseStates).some((purchase) => hasRecoverablePurchase(purchase)));
	const completedPurchaseQuantity = visibleOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
	const outcomeTitle =
		props.operation.kind === 'buy'
			? 'Purchase complete'
			: props.operation.kind === 'sell'
			? 'Tokens listed'
			: props.operation.kind === 'cancel'
			? 'Listing cancelled'
			: 'Transfer complete';
	const outcomeDetail =
		props.operation.kind === 'buy'
			? `${tokenLabel(completedPurchaseQuantity.toString(), props.state)} received from ${visibleOrders.length} ${
					visibleOrders.length === 1 ? 'listing' : 'listings'
			  } · ${winstonToArDecimal(
					visibleOrders.reduce((total, order) => total + BigInt(order.asking), 0n).toString()
			  )} AR paid to sellers.`
			: props.operation.kind === 'sell' && enteredQuantity && listingQuote
			? `${tokenLabel(enteredQuantity.toString(), props.state)} listed for ${listingQuote} AR.`
			: props.operation.kind === 'cancel'
			? `${tokenLabel(props.operation.order.quantity, props.state)} returned to your liquid balance.`
			: enteredQuantity
			? `${tokenLabel(enteredQuantity.toString(), props.state)} sent to ${transferRecipient}.`
			: 'The live token state now reflects this action.';
	const settlementSummary = batchSettlementSummary(visibleOrders.map((order) => purchaseStates[order.orderId]));
	const incompletePurchases = visibleOrders.length - settlementSummary.settled;
	const purchaseNeedsManualReview =
		visibleOrders.some((order) => purchaseSettlementNeedsManualReview(purchaseStates[order.orderId])) ||
		purchaseFailureMessageNeedsManualReview(message);
	const signedWork = Boolean(transaction || recoverableBatch);
	React.useEffect(() => {
		if (props.operation.kind !== 'buy' || phase !== 'working') return;
		const next = nextSettlementAnnouncement(
			settlementAnnouncementKeyRef.current,
			signedWork,
			visibleOrders.length,
			settlementSummary
		);
		if (!next) return;
		settlementAnnouncementKeyRef.current = next.key;
		setSettlementAnnouncement(next.message);
	}, [
		props.operation.kind,
		phase,
		settlementSummary.failed,
		settlementSummary.settled,
		signedWork,
		visibleOrders.length,
	]);
	const purchaseSteps: ArweaveSyncStep[] = activePurchase
		? [
				{
					key: 'register',
					label: 'Reserve listing',
					target: PURCHASE_REGISTRATION_TARGET,
					transaction: activePurchase.registration,
				},
				{
					key: 'pay',
					label: 'Pay seller',
					target: PURCHASE_PAYMENT_TARGET,
					terminal: true,
					transaction: activePurchase.payment,
				},
		  ]
		: [];
	const activeStep =
		activePurchase?.stage.includes('payment') || activePurchase?.stage === 'ownership-verifying'
			? 'pay'
			: 'register';
	const singleSteps: ArweaveSyncStep[] = transaction
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
		: [];
	const activeSyncStep =
		props.operation.kind === 'buy'
			? purchaseSteps.find((step) => step.key === activeStep) ?? purchaseSteps[0]
			: singleSteps[0];
	const activityProgress = fungibleOperationActivityProgress(phase, activeSyncStep);
	React.useEffect(() => {
		activityChangeRef.current(activityProgress);
	}, [
		activityProgress.confirmations,
		activityProgress.confirmationTarget,
		activityProgress.phase,
		activityProgress.status,
	]);
	const closeOrHide = () => {
		const action = transactionDialogDismissAction(phase, Boolean(transaction || recoverableBatch));
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
	const restartPurchase = () => {
		if (!recoverableBatch) {
			setMessage('');
			setFailureKind(null);
			setPhase('form');
			return;
		}
		batchRecoveryBufferRef.current?.flush();
		attemptRef.current.abort();
		for (const purchase of purchasesRef.current.values()) purchase.abandon();
		purchasesRef.current.clear();
		networkRef.current?.release();
		networkRef.current = null;
		if (claimRef.current) {
			releaseWalletOperationClaim(localStorage, claimRef.current);
			claimRef.current = null;
		}
		props.onRestart();
	};
	const acknowledgeTerminalPurchase = () => {
		batchRecoveryBufferRef.current?.clear();
		purchaseStateBufferRef.current?.clear();
		attemptRef.current.abort();
		for (const purchase of purchasesRef.current.values()) purchase.abandon();
		purchasesRef.current.clear();
		networkRef.current?.release();
		networkRef.current = null;
		if (claimRef.current) {
			releaseWalletOperationClaim(localStorage, claimRef.current);
			claimRef.current = null;
		}
		const receiptIds = visibleOrders.flatMap((order) => {
			const purchase = purchaseStates[order.orderId];
			return [purchase?.registration?.id, purchase?.payment?.id].filter((id): id is string => Boolean(id));
		});
		const expectedAttemptId =
			props.operation.kind === 'buy' ? fungiblePurchaseResumeOf(props.operation)?.attemptId : undefined;
		removeWalletRecoveryAndSignatures<BatchResume>(
			localStorage,
			fungibleBatchStorageKey(props.asset.id, props.owner),
			(current) => {
				if (current.buyer !== props.owner) return false;
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
			props.owner
		);
		props.onClose(false);
	};

	const compactPurchaseForm = phase === 'form' && props.operation.kind === 'buy';
	return (
		<Dialog
			backdropClassName="dialog-backdrop operation-panel-backdrop"
			className={`dialog operation-side-panel fungible-dialog${phase === 'form' ? ' dialog-form-phase' : ''}${
				compactPurchaseForm ? ' purchase-dialog' : ''
			}`}
			focusKey={phase}
			hiding={hiding}
			keepMounted={phase === 'working'}
			labelledBy={compactPurchaseForm ? dialogTitleId : `${operationLabelId} ${dialogTitleId}`}
			onDismiss={closeOrHide}
			open={props.visible}
			panelRef={dialogRef}
			restoreFallback={props.restoreFallback}
		>
			<DialogHeading
				artwork={
					phase === 'working' ? (
						<TokenAvatar
							className="dialog-asset-artwork"
							image={props.asset.image}
							loading="eager"
							ticker={props.state.ticker || props.asset.ticker || props.asset.name}
						/>
					) : null
				}
				control={<TransactionDialogControl hiding={hiding} phase={phase} onClick={closeOrHide} />}
				eyebrow={compactPurchaseForm ? undefined : operationLabel(props.operation.kind)}
				eyebrowId={operationLabelId}
				layout="asset"
				title={compactPurchaseForm ? `Buy ${props.asset.name}` : props.asset.name}
				titleId={dialogTitleId}
			/>
			<OperationOutcomeAnnouncement active={phase === 'done'} title={outcomeTitle} detail={outcomeDetail} />
			{phase === 'approval' && props.operation.kind === 'buy' && props.operation.resume ? (
				<div className="recovery-approval">
					<div>
						<h3>{recoveryApprovalCopy?.title}</h3>
						<p>{recoveryApprovalCopy?.detail}</p>
					</div>
					<div className="batch-quote">
						<div>
							<span>Listings</span>
							<strong>{visibleOrders.length}</strong>
						</div>
						<div>
							<span>Sellers</span>
							<strong>{new Set(visibleOrders.map((order) => order.creator)).size}</strong>
						</div>
						<div>
							<span>Seller subtotal</span>
							<strong>
								{winstonToArDecimal(
									visibleOrders.reduce((total, order) => total + BigInt(order.asking), 0n).toString()
								)}{' '}
								<ArCurrencyLabel />
							</strong>
						</div>
						<div>
							<span>New approvals</span>
							<strong>{recoveryApprovalCount}</strong>
						</div>
					</div>
					<PurchaseRoute fills={visibleFills} state={props.state} />
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
			{phase === 'form' ? (
				<form
					className="trade-form"
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<div className="dialog-form-scroll">
						{props.operation.kind === 'sell' ? (
							<>
								<div className="trade-balance">
									<span>Available to list</span>
									<strong>
										{tokenLabel(liquidBalanceOf(props.state, props.owner), props.state)}
									</strong>
								</div>
								<div className="trade-fields">
									<label>
										Token quantity
										<TextInput
											aria-describedby={
												quantity &&
												(enteredQuantity === null || enteredQuantity > currentLiquid)
													? quantityGuidanceId
													: undefined
											}
											aria-invalid={
												Boolean(quantity) &&
												(enteredQuantity === null || enteredQuantity > currentLiquid)
											}
											autoFocus
											data-dialog-initial
											inputMode="decimal"
											value={quantity}
											onChange={(event) => setQuantity(event.target.value)}
											placeholder="100"
										/>
									</label>
									<label>
										<span>
											Price per {tickerDisplay} in <ArCurrencyLabel />
										</span>
										<TextInput
											aria-describedby={
												unitPrice && !unitPriceValid ? priceGuidanceId : undefined
											}
											aria-invalid={Boolean(unitPrice) && !unitPriceValid}
											inputMode="decimal"
											value={unitPrice}
											onChange={(event) => setUnitPrice(event.target.value)}
											placeholder="0.01"
										/>
									</label>
								</div>
								{listingQuote ? (
									<div className="trade-quote">
										<span>Listing total</span>
										<strong>
											{listingQuote} <ArCurrencyLabel />
										</strong>
									</div>
								) : null}
								{enteredQuantity && enteredQuantity <= currentLiquid ? (
									<div className="trade-quote">
										<span>After network confirmation</span>
										<strong>
											{tokenLabel((currentLiquid - enteredQuantity).toString(), props.state)}{' '}
											liquid ·{' '}
											{tokenLabel((currentListed + enteredQuantity).toString(), props.state)}{' '}
											listed
										</strong>
									</div>
								) : null}
								{quantity && (enteredQuantity === null || enteredQuantity > currentLiquid) ? (
									<p id={quantityGuidanceId} className="trade-guidance" role="alert">
										Enter a quantity up to {tokenLabel(currentLiquid.toString(), props.state)}.
									</p>
								) : null}
								{unitPrice && !unitPriceValid ? (
									<p id={priceGuidanceId} className="trade-guidance" role="alert">
										<ArCurrencyText>
											Enter a positive AR price with no more than 12 decimal places.
										</ArCurrencyText>
									</p>
								) : null}
								<p className="settlement-disclosure">
									Listed tokens move into order escrow after network confirmation. Network fees are
									shown by your wallet before signing.
								</p>
							</>
						) : null}
						{props.operation.kind === 'transfer' ? (
							<>
								<div className="trade-balance">
									<span>Available to send</span>
									<strong>
										{tokenLabel(liquidBalanceOf(props.state, props.owner), props.state)}
									</strong>
								</div>
								<label>
									Recipient wallet address
									<TextInput
										aria-describedby={recipient && recipientError ? recipientGuidanceId : undefined}
										aria-invalid={Boolean(recipient) && Boolean(recipientError)}
										autoCapitalize="none"
										autoComplete="off"
										autoCorrect="off"
										autoFocus
										data-dialog-initial
										spellCheck={false}
										value={recipient}
										onChange={(event) => setRecipient(event.target.value)}
										placeholder="43-character Arweave address"
									/>
								</label>
								{recipient && recipientError ? (
									<p id={recipientGuidanceId} className="trade-guidance" role="alert">
										{recipientError}
									</p>
								) : null}
								{recipient && !recipientError ? (
									<div className="trade-quote">
										<span>Recipient</span>
										<strong>{transferRecipient}</strong>
									</div>
								) : null}
								{recipient && !recipientError ? (
									<p className="settlement-disclosure">
										Review the complete destination before asking your wallet to approve this
										irreversible transfer.
									</p>
								) : null}
								<label>
									Token quantity
									<TextInput
										aria-describedby={
											quantity && (enteredQuantity === null || enteredQuantity > currentLiquid)
												? quantityGuidanceId
												: undefined
										}
										aria-invalid={
											Boolean(quantity) &&
											(enteredQuantity === null || enteredQuantity > currentLiquid)
										}
										inputMode="decimal"
										value={quantity}
										onChange={(event) => setQuantity(event.target.value)}
										placeholder="100"
									/>
								</label>
								{quantity && (enteredQuantity === null || enteredQuantity > currentLiquid) ? (
									<p id={quantityGuidanceId} className="trade-guidance" role="alert">
										Enter a quantity up to {tokenLabel(currentLiquid.toString(), props.state)}.
									</p>
								) : null}
							</>
						) : null}
						{props.operation.kind === 'cancel' ? (
							<div className="cancel-summary">
								<CircleX aria-hidden="true" />
								<div>
									<strong>Return this listing to your balance?</strong>
									<span>
										{tokenLabel(props.operation.order.quantity, props.state)} ·{' '}
										{winstonToArDecimal(props.operation.order.asking)} <ArCurrencyLabel /> total
									</span>
									<span>
										After network confirmation:{' '}
										{tokenLabel(
											(currentLiquid + BigInt(props.operation.order.quantity)).toString(),
											props.state
										)}{' '}
										liquid ·{' '}
										{tokenLabel(
											(currentListed - BigInt(props.operation.order.quantity)).toString(),
											props.state
										)}{' '}
										listed
									</span>
									<span>A reserved listing cannot be cancelled. This listing is currently open.</span>
								</div>
							</div>
						) : null}
						{props.operation.kind === 'buy' ? (
							<>
								{matchedOrders.length ? (
									<section
										aria-busy={quoteState === 'loading'}
										className="purchase-confirmation"
										aria-label="Purchase summary"
									>
										<div className="purchase-confirmation-amount">
											<span>You receive</span>
											<strong>{tokenLabel(matchedQuantity.toString(), props.state)}</strong>
										</div>
										<dl className="purchase-confirmation-facts">
											<div>
												<dt>Seller total</dt>
												<dd>
													{winstonToArDecimal(matchedAsking.toString())} <ArCurrencyLabel />
												</dd>
											</div>
											<div>
												<dt>Network fees</dt>
												<dd>
													{quoteState === 'error' ? (
														'Unavailable'
													) : estimatedCost ? (
														<ArCurrencyText>{`${winstonToArDecimal(
															(BigInt(estimatedCost) - matchedAsking).toString()
														)} AR`}</ArCurrencyText>
													) : (
														'Checking…'
													)}
												</dd>
											</div>
											<div className="purchase-confirmation-total">
												<dt>Maximum total</dt>
												<dd>
													{quoteState === 'error' ? (
														'Quote unavailable'
													) : estimatedCost ? (
														<ArCurrencyText>{`${winstonToArDecimal(
															estimatedCost
														)} AR`}</ArCurrencyText>
													) : (
														'Checking…'
													)}
												</dd>
											</div>
											<div>
												<dt>Wallet after</dt>
												<dd>
													{quoteState === 'error' ? (
														'—'
													) : canAfford === false ? (
														<ArCurrencyText>Insufficient AR</ArCurrencyText>
													) : estimatedCost && estimatedWalletBalance ? (
														<ArCurrencyText>{`${winstonToArDecimal(
															(
																BigInt(estimatedWalletBalance) - BigInt(estimatedCost)
															).toString()
														)} AR`}</ArCurrencyText>
													) : (
														'Checking…'
													)}
												</dd>
											</div>
										</dl>
										<p className="purchase-confirmation-meta">
											{matchedOrders.length} {matchedOrders.length === 1 ? 'order' : 'orders'} ·{' '}
											{matchedSellers} {matchedSellers === 1 ? 'seller' : 'sellers'} ·{' '}
											{matchedOrders.length * 2} wallet approvals
										</p>
									</section>
								) : null}
								{matchedOrders.length ? (
									<LiveRegion as="p" id={quoteStatusId}>
										<ArCurrencyText>
											{quoteState === 'ready' && estimatedCost
												? `Purchase quote ready. Maximum total ${winstonToArDecimal(
														estimatedCost
												  )} AR.${canAfford ? '' : ' This wallet has insufficient AR.'}`
												: quoteState === 'error'
												? 'Purchase quote unavailable. Retry the cost check before buying.'
												: 'Checking the wallet balance and network fees.'}
										</ArCurrencyText>
									</LiveRegion>
								) : null}
								{matchedOrders.length ? (
									quoteState === 'error' ? (
										<RetryNotice
											onRetry={() => setQuoteRetry((value) => value + 1)}
											retryDescribedBy={quoteStatusId}
										/>
									) : null
								) : null}
								{canAfford === false ? (
									<p className="purchase-form-error" role="alert">
										<ArCurrencyText>
											This wallet does not have enough AR for the purchase and network fees.
										</ArCurrencyText>
									</p>
								) : null}
							</>
						) : null}
					</div>
					<div className="trade-form-footer">
						<Button
							className={`wide${
								props.operation.kind === 'buy' || props.operation.kind === 'sell'
									? ' with-icon market-primary-action'
									: ''
							}`}
							data-dialog-initial
							aria-label={
								props.operation.kind === 'transfer' && enteredQuantity && transferValid
									? fungibleTransferSubmitLabel(
											enteredQuantity.toString(),
											props.state,
											transferRecipient,
											true
									  )
									: undefined
							}
							aria-describedby={
								props.operation.kind === 'buy' && matchedOrders.length ? quoteStatusId : undefined
							}
							disabled={
								(props.operation.kind === 'buy' &&
									(!matchedOrders.length || !estimatedCost || canAfford !== true)) ||
								(props.operation.kind === 'sell' && !sellValid) ||
								(props.operation.kind === 'transfer' && !transferValid)
							}
							size="custom"
							type="submit"
							variant={props.operation.kind === 'cancel' ? 'danger' : 'primary'}
						>
							{props.operation.kind === 'buy' ? (
								<Icon icon={ShoppingCart} size="sm" />
							) : props.operation.kind === 'sell' ? (
								<Icon icon={Tag} size="sm" />
							) : null}
							<ArCurrencyText>
								{props.operation.kind === 'buy' && matchedOrders.length
									? `Buy ${tokenLabel(matchedQuantity.toString(), props.state)} · ${
											estimatedCost
												? `${winstonToArDecimal(estimatedCost)} AR max`
												: 'checking total…'
									  }`
									: props.operation.kind === 'sell' && listingQuote && enteredQuantity
									? `List ${tokenLabel(
											enteredQuantity.toString(),
											props.state
									  )} for ${listingQuote} AR`
									: props.operation.kind === 'cancel'
									? `Cancel listing and return ${tokenLabel(
											props.operation.order.quantity,
											props.state
									  )}`
									: props.operation.kind === 'transfer' && enteredQuantity
									? fungibleTransferSubmitLabel(
											enteredQuantity.toString(),
											props.state,
											transferRecipient
									  )
									: operationLabel(props.operation.kind)}
							</ArCurrencyText>
						</Button>
					</div>
				</form>
			) : null}
			{phase === 'working' ? (
				<div className="operation-working">
					{props.operation.kind === 'buy' ? (
						<LiveRegion as="p">{settlementAnnouncement}</LiveRegion>
					) : (
						<LiveRegion as="p">
							{message ||
								(signedWork
									? 'Watching this transaction.'
									: 'Preparing the transaction for wallet approval.')}
						</LiveRegion>
					)}
					{props.operation.kind === 'buy' && visibleOrders.length ? (
						<FungiblePurchaseSequence
							listingCount={visibleOrders.length}
							states={visibleOrders.map((order) => purchaseStates[order.orderId])}
						/>
					) : null}
					{signedWork && props.operation.kind !== 'buy' ? (
						<p className="sync-resume-note">
							Transaction details are saved in this browser. Return with the same wallet to continue while
							this browser data remains available.
						</p>
					) : null}
					{workingStatus ? <p className="scheduler-wait">{workingStatus}</p> : null}
					{props.operation.kind === 'buy' && visibleOrders.length ? (
						activeOrder && activePurchase ? (
							<ArweaveTransactionSync
								active={props.visible}
								skipKind={purchaseSkipKind(activePurchase)}
								onSkip={
									activePurchase.canSkip
										? () => {
												purchasesRef.current.get(activeOrder.orderId)?.skip();
										  }
										: undefined
								}
								subject={`${props.asset.name} · ${tokenLabel(activeOrder.quantity, props.state)}`}
								startedAt={submittedAtRef.current}
								steps={purchaseSteps}
								activeStep={activeStep}
								pendingAfterConfirmation={
									activePurchase.stage === 'registration-accepting'
										? 'Checking live reservation'
										: activePurchase.stage === 'ownership-verifying'
										? 'Checking receipt'
										: undefined
								}
							/>
						) : (
							<Loading label="Preparing the purchase for wallet approval…" />
						)
					) : singleSteps.length ? (
						<ArweaveTransactionSync
							active={props.visible}
							subject={props.asset.name}
							startedAt={submittedAtRef.current}
							steps={singleSteps}
							activeStep={props.operation.kind}
							pendingAfterConfirmation={postConfirmationPendingLabel(confirmations, 5, message)}
						/>
					) : (
						<Loading label="Preparing the signed transaction…" />
					)}
				</div>
			) : null}
			{phase === 'done' ? (
				<div className="result success">
					<OperationOutcome
						title={outcomeTitle}
						detail={outcomeDetail}
						status={
							props.operation.kind === 'buy'
								? `Confirmations: ${quorumConfirmationDepth(
										purchaseSteps.find((step) => step.key === 'pay')
								  )}`
								: undefined
						}
					>
						{props.operation.kind === 'buy' || props.operation.kind === 'sell' ? (
							<OperationOutcomeSubject
								label={props.operation.kind === 'buy' ? 'You received' : 'You listed'}
								title={
									props.operation.kind === 'buy'
										? tokenLabel(completedPurchaseQuantity.toString(), props.state)
										: enteredQuantity
										? tokenLabel(enteredQuantity.toString(), props.state)
										: props.asset.name
								}
								detail={
									props.operation.kind === 'sell' && listingQuote
										? `${listingQuote} AR total`
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
									startedAt={submittedAtRef.current}
									steps={purchaseSteps}
									subject={`${props.asset.name} · ${tokenLabel(
										activeOrder?.quantity ?? '0',
										props.state
									)}`}
								/>
							</div>
						) : null}
					</OperationOutcome>
					{transaction && props.operation.kind !== 'transfer' ? (
						<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
							<OperationExternalLink>View transaction {short(transaction.id)}</OperationExternalLink>
						</a>
					) : null}
					{props.operation.kind === 'buy' ? (
						<FungiblePurchaseReceiptNavigator
							activeOrderId={activeOrder?.orderId}
							onSelect={setActiveOrderId}
							orders={visibleOrders}
							purchaseStates={purchaseStates}
							state={props.state}
						/>
					) : props.operation.kind === 'transfer' && transaction && enteredQuantity ? (
						<div className="settlement-receipt">
							<div>
								<span>Quantity</span>
								<strong>{tokenLabel(enteredQuantity.toString(), props.state)}</strong>
							</div>
							<div>
								<span>Recipient</span>
								<WalletAddress address={transferRecipient} full label="recipient" />
							</div>
							<div className="settlement-receipt-links">
								<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
									<OperationExternalLink>Transaction {short(transaction.id)}</OperationExternalLink>
								</a>
							</div>
						</div>
					) : null}
					<Button
						className="with-icon"
						data-dialog-initial
						onClick={() => props.onClose(false)}
						size="custom"
						variant="primary"
					>
						<Icon icon={ArrowLeft} size="sm" /> View updated token
					</Button>
				</div>
			) : null}
			{phase === 'error' ? (
				<div className="result error">
					<FungibleOperationErrorAlert message={message} />
					{props.operation.kind === 'buy' && visibleOrders.length ? (
						<>
							<div className="settlement-tabs" aria-label="Settlement recovery status" role="tablist">
								{visibleOrders.map((order, index) => {
									const active = order.orderId === activeOrder?.orderId;
									return (
										<Button
											aria-controls={SETTLEMENT_ERROR_PANEL_ID}
											aria-selected={active}
											className={active ? 'active' : undefined}
											id={`settlement-error-tab-${order.orderId}`}
											key={order.orderId}
											onClick={() => setActiveOrderId(order.orderId)}
											size="custom"
											onKeyDown={(event) => {
												const nextIndex = settlementTabIndex(
													event.key,
													index,
													visibleOrders.length
												);
												if (nextIndex === null) return;
												event.preventDefault();
												const nextOrder = visibleOrders[nextIndex];
												setActiveOrderId(nextOrder.orderId);
												window.requestAnimationFrame(() => {
													document
														.getElementById(`settlement-error-tab-${nextOrder.orderId}`)
														?.focus();
												});
											}}
											role="tab"
											tabIndex={active ? 0 : -1}
											type="button"
										>
											<span>Listing {index + 1}</span>
											<strong>{tokenLabel(order.quantity, props.state)}</strong>
											<small>{batchStageLabel(purchaseStates[order.orderId])}</small>
										</Button>
									);
								})}
							</div>
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
												<strong aria-describedby={tooltipId}>
													{short(activeOrder.orderId)}
												</strong>
											)}
										</Tooltip>
									</div>
									<p>
										{activePurchase?.error
											? errorMessage(
													marketplaceCodedError(
														activePurchase.error.code,
														activePurchase.error.message || activePurchase.error.code
													)
											  )
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
					{failureKind === 'market-state-changed' ? (
						<Button data-dialog-initial onClick={() => props.onClose(false)} size="custom">
							View updated token
						</Button>
					) : failureKind === 'transaction-not-sent' && transaction ? (
						<>
							<p>No transaction was submitted. Retry this signature or discard it to start over.</p>
							<div className="dialog-actions">
								<Button data-dialog-initial onClick={() => void submit()} size="custom">
									Retry transfer
								</Button>
								<Button
									size="custom"
									onClick={() => {
										const discarded = removeWalletRecoveryAndSignatures<any>(
											localStorage,
											operationStorageKey(props.asset.id, props.owner),
											(record) => record?.txId === transaction.id,
											[transaction.id],
											props.owner
										);
										if (!discarded) {
											setMessage(
												'This saved transfer changed in another tab. Close this panel and review the active action.'
											);
											return;
										}
										setTransaction(null);
										props.onClose(false, false);
									}}
									variant="danger"
								>
									Discard transfer
								</Button>
							</div>
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
					) : props.operation.kind === 'buy' ? (
						<>
							{purchaseNeedsManualReview ? (
								<p>
									The process rejected this scheduled purchase after payment. Rechecking it cannot
									apply the transfer, so Bazar will keep the permanent receipts without creating a
									replacement.
								</p>
							) : recoverableBatch ? (
								<p>
									Completed settlements will not be retried; only incomplete settlements will
									continue.
								</p>
							) : (
								<p>
									No transaction was submitted. Any earlier approvals from this attempt were
									discarded.
								</p>
							)}
							<Button
								data-dialog-initial
								onClick={purchaseNeedsManualReview ? acknowledgeTerminalPurchase : restartPurchase}
								size="custom"
							>
								{purchaseNeedsManualReview
									? 'Unlock asset and close'
									: recoverableBatch
									? `Resume ${incompletePurchases} incomplete ${
											incompletePurchases === 1 ? 'settlement' : 'settlements'
									  }`
									: 'Try again'}
							</Button>
						</>
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
