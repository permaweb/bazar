import React from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
	ArrowDown,
	ArrowLeft,
	ArrowUpRight,
	BarChart3,
	Check,
	CircleX,
	Grid2X2,
	RefreshCw,
	Send,
	ShoppingCart,
	Tag,
	Users,
} from 'lucide-react';
import {
	type Consensus,
	type ObserverView,
	type PreparedTransaction,
	type PurchaseSnapshot,
	type PurchaseState,
	SwapPurchase,
} from 'weave-wrangler';

import { transactionExplorerUrl } from 'api/arweave-explorer';
import type { CollectionActivityEvent } from 'api/asset-discovery';
import {
	type AssetState,
	licenseProperties,
	liquidBalanceOf,
	listedBalanceOf,
	liveOrdersOfAsset,
	readAssetState,
	type SwapOrder,
} from 'api/asset-marketplace';
import { acquireAssetObserverNetwork, type AssetObserverNetworkLease } from 'api/asset-observers';
import {
	AssetTransactionClient,
	DEFAULT_REGISTRATION_FEE,
	dispatchAndConfirm,
	type PreparedPurchase,
	type PurchaseBatchPreparationEvent,
} from 'api/asset-transactions';
import type { AssetSummary, Collection } from 'api/collections';
import {
	filledOrder,
	formatTokenAmount,
	matchOrderFills,
	matchSortedOrderFills,
	type OrderFill,
	parseTokenAmount,
} from 'api/order-matching';

import { ArCurrencyLabel, ArCurrencyText, formatArCurrencyText } from 'components/ArCurrencyLabel';
import { type ArweaveSyncStep, ArweaveTransactionSync } from 'components/ArweaveTransactionSync';
import { quorumConfirmationDepth } from 'components/ArweaveTransactionSync/confirmationDepth';
import { postConfirmationPendingLabel } from 'components/ArweaveTransactionSync/sequence';
import { type AssetDetailTab, AssetDetailTabs } from 'components/AssetDetailTabs';
import { assetOperationPendingActionLabel, AssetOperationStatus } from 'components/AssetOperationStatus';
import { Button } from 'components/Button';
import { ConnectWalletButton } from 'components/ConnectWalletButton';
import { ErrorPanel } from 'components/ErrorPanel';
import { Loading } from 'components/Loading';
import { MarketActivityList } from 'components/MarketActivityList';
import {
	OperationErrorAlert,
	OperationExternalLink,
	OperationOutcome,
	OperationOutcomeAnnouncement,
	OperationOutcomeSubject,
} from 'components/OperationOutcomeAnnouncement';
import { type SegmentedTab, SegmentedTabs } from 'components/SegmentedTabs';
import { TokenAvatar } from 'components/TokenAvatar';
import { TokenPriceChart, type TokenPricePoint } from 'components/TokenPriceChart';
import { Tooltip } from 'components/Tooltip';
import {
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
	TransactionDialogControl,
	transactionDialogDismissAction,
	type TransactionDialogPhase,
} from 'components/TransactionDialogControl';
import {
	type UnavailableOperationRecovery,
	UnavailableOperationRecoveryNotice,
} from 'components/UnavailableOperationRecovery';
import { WalletAddress, WalletIdentity } from 'components/WalletAddress';
import { arweaveGatewayFromLocation, gatewayFromLocation } from 'helpers/config';
import { optionalMotionBehavior } from 'helpers/motion';
import { formatTickerLabel } from 'helpers/token-display';
import { useWallet } from 'providers/WalletProvider';

import { collectionDisplayName, MarketSelect } from './App';
import {
	marketplaceCodedError,
	marketplaceErrorMessage as errorMessage,
	type MarketplaceOperationFailure,
	marketplaceOperationFailure,
} from './marketplace-error';
import { announceFungibleOperationActivityChange, fungibleOperationActivityId } from './operation-activity';
import {
	acquireWalletOperationClaim,
	assetHasSavedSignedAction,
	clearStaleWalletOperationClaim,
	discardNewlyPreparedTransactionIfAborted,
	fungibleBatchStorageKey,
	hasRecoverablePurchase,
	loadWalletRecord,
	operationClaimStorageKey,
	type OperationSession,
	operationStorageKey,
	promoteWalletOperationClaim,
	purchaseRecoveryApprovalCount,
	releaseWalletOperationClaim,
	removeWalletRecord,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	repairRejectedPurchase,
	shouldAutomaticallyResumePurchase,
	storeWalletRecordOrThrow,
	type WalletOperationClaim,
	walletOperationStorageChange,
} from './operation-session';
import {
	continuePaymentConfirmations,
	PURCHASE_PAYMENT_TARGET,
	PURCHASE_REGISTRATION_TARGET,
	PURCHASE_SKIP_FROM_DEPTH,
	type PurchaseGatewayContext,
	purchaseGatewaySwitchNotice,
	purchaseLifecycleStatus,
	purchaseSkipKind,
	withContinuingPaymentObservation,
} from './purchase-lifecycle';
import {
	purchaseObservationCheckingMessage,
	purchaseObservationPendingState,
	purchaseObservationResumeState,
	purchaseObservationRetryDelay,
	purchaseObservationRetryKind,
	purchaseObservationRetryMessage,
	waitForPurchaseObservationRetry,
} from './purchase-observation-retry';
import { useDialogFocus } from './useDialogFocus';

type Props = {
	asset: AssetSummary;
	collection: Collection;
	collectionIndexNotice?: React.ReactNode;
	state: AssetState;
	activity: CollectionActivityEvent[];
	activityLoading: boolean;
	activityError: string | null;
	onActivityRetry(): void;
	onActivityVisible(): void;
	loading: boolean;
	error: string | null;
	provider: string;
	verifiedAt: number | null;
	onRefresh(): Promise<void>;
};

type BatchEntry = {
	order: SwapOrder;
	fillQuantity: string;
	snapshot: PurchaseSnapshot;
	paymentCost: string;
};

type BatchResume = {
	version: 3;
	asset?: AssetSummary;
	activityKind?: 'fungible';
	buyer: string;
	collectionId?: string;
	startingBalance: string;
	entries: BatchEntry[];
	attemptId?: string;
	createdAt?: number;
	gateway?: PurchaseGatewayContext;
};

export type FungibleOperation =
	| { kind: 'sell'; quantity?: string; unitPrice?: string; resumeId?: string }
	| {
			kind: 'transfer';
			quantity?: string;
			recipient?: string;
			startingSlot?: number;
			resumeId?: string;
	  }
	| { kind: 'cancel'; order: SwapOrder; startingSlot?: number; resumeId?: string }
	| {
			kind: 'buy';
			availableOrders: SwapOrder[];
			quantity?: string;
			startingBalance: string;
			resume?: BatchResume;
	  };

export type FungibleOperationActivity = OperationSession<FungibleOperation> & {
	id: string;
	createdAt?: number;
	phase: TransactionDialogPhase | null;
	visible: boolean;
};

export function appendFungibleOperationActivity(
	current: FungibleOperationActivity[],
	activity: FungibleOperationActivity
) {
	return [...current.map((item) => ({ ...item, visible: false })), activity];
}

export function restartFungibleOperationActivity(activity: FungibleOperationActivity, now = Date.now()) {
	return {
		...activity,
		phase: null,
		visible: true,
		createdAt: Math.max(now, (activity.createdAt ?? 0) + 1),
	};
}

export function fungibleAskHistory(events: CollectionActivityEvent[], denomination: number): TokenPricePoint[] {
	const scale = 10n ** BigInt(denomination);
	return events
		.flatMap((event) => {
			if (event.action !== 'make-offer' || !event.asking || !event.quantity) return [];
			try {
				const asking = BigInt(event.asking);
				const quantity = BigInt(event.quantity);
				if (asking <= 0n || quantity <= 0n) return [];
				return [
					{
						id: event.id,
						timestamp: event.timestamp,
						value: ((asking * scale + quantity - 1n) / quantity).toString(),
					},
				];
			} catch {
				return [];
			}
		})
		.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const SETTLEMENT_ERROR_PANEL_ID = 'fungible-settlement-error-panel';
const TERMINAL_PURCHASE_FAILURES = new Set(['asset-purchase-rejected', 'asset-purchase-proof-mismatch']);
const TERMINAL_PURCHASE_FAILURE_MESSAGES = new Set(['asset purchase rejected', 'asset purchase proof mismatch']);

export type FungibleHolder = {
	address: string;
	liquid: string;
	listed: string;
	total: string;
};

export function fungibleHolders(state: AssetState): FungibleHolder[] {
	const listedByAddress = new Map<string, bigint>();
	for (const order of liveOrdersOfAsset(state)) {
		listedByAddress.set(order.creator, (listedByAddress.get(order.creator) ?? 0n) + BigInt(order.quantity));
	}

	const addresses = new Set([
		...Object.entries(state.balances)
			.filter(([address, balance]) => ADDRESS.test(address) && BigInt(balance) > 0n)
			.map(([address]) => address),
		...listedByAddress.keys(),
	]);

	return [...addresses]
		.map((address) => {
			const liquid = BigInt(state.balances[address] ?? '0');
			const listed = listedByAddress.get(address) ?? 0n;
			return {
				address,
				liquid: liquid.toString(),
				listed: listed.toString(),
				total: (liquid + listed).toString(),
			};
		})
		.sort((left, right) => {
			const difference = BigInt(right.total) - BigInt(left.total);
			if (difference !== 0n) return difference < 0n ? -1 : 1;
			return left.address.localeCompare(right.address);
		});
}

export function fungibleHoldingPercentage(balance: string, totalSupply: string) {
	try {
		const held = BigInt(balance);
		const supply = BigInt(totalSupply);
		if (held <= 0n || supply <= 0n) return '—';
		const hundredths = (held * 10_000n + supply / 2n) / supply;
		if (hundredths === 0n) return '<0.01%';
		const whole = hundredths / 100n;
		const fraction = (hundredths % 100n).toString().padStart(2, '0').replace(/0+$/, '');
		return `${whole.toString()}${fraction ? `.${fraction}` : ''}%`;
	} catch {
		return '—';
	}
}

export function purchaseSettlementNeedsManualReview(state?: PurchaseState) {
	if (state?.stage !== 'failed' || !state.error) return false;
	if (TERMINAL_PURCHASE_FAILURES.has(state.error.code)) return true;
	return TERMINAL_PURCHASE_FAILURE_MESSAGES.has(state.error.message.trim().toLowerCase());
}

export function purchaseFailureMessageNeedsManualReview(message?: string) {
	if (!message) return false;
	const normalized = message.trim().toLowerCase();
	if (TERMINAL_PURCHASE_FAILURE_MESSAGES.has(normalized)) return true;
	return [...TERMINAL_PURCHASE_FAILURE_MESSAGES].some((failure) => normalized.endsWith(`. ${failure}`));
}

function currentPurchaseGatewayContext(): PurchaseGatewayContext {
	return { arweave: arweaveGatewayFromLocation(), compute: gatewayFromLocation() };
}

export function FungibleAssetView({
	asset,
	collection,
	collectionIndexNotice,
	state,
	activity,
	activityLoading,
	activityError,
	onActivityRetry,
	onActivityVisible,
	loading,
	error,
	onRefresh,
}: Props) {
	const wallet = useWallet();
	const location = useLocation();
	const navigate = useNavigate();
	const navigationType = useNavigationType();
	const [operationActivities, setOperationActivities] = React.useState<FungibleOperationActivity[]>([]);
	const operationActivitiesRef = React.useRef(operationActivities);
	operationActivitiesRef.current = operationActivities;
	React.useEffect(
		() => () => {
			for (const activity of operationActivitiesRef.current) {
				announceFungibleOperationActivityChange({ type: 'remove', id: activity.id, owner: activity.signer });
			}
		},
		[asset.id, wallet.address]
	);
	const walletActivities = operationActivities.filter((activity) => activity.signer === wallet.address);
	const hasWalletActivities = walletActivities.length > 0;
	const hasBusyWalletActivities = walletActivities.some((activity) => (activity.phase ?? 'form') !== 'error');
	const activePurchaseActivity = walletActivities.find((activity) => activity.operation.kind === 'buy');
	const activeAssetActivity = walletActivities.find((activity) => activity.operation.kind !== 'buy');
	const showOperationActivity = React.useCallback((id: string) => {
		setOperationActivities((current) => current.map((activity) => ({ ...activity, visible: activity.id === id })));
	}, []);
	const publishOperationActivity = React.useCallback(
		(activity: FungibleOperationActivity, nextPhase: TransactionDialogPhase | null = activity.phase) => {
			const phase = nextPhase ?? 'form';
			if (phase === 'done') {
				announceFungibleOperationActivityChange({ type: 'remove', id: activity.id, owner: activity.signer });
			} else {
				const summary = {
					id: activity.id,
					asset,
					collectionId: collection.id,
					owner: activity.signer,
					operationKind: activity.operation.kind,
					phase,
					status: fungibleActivityPhaseStatus(phase),
					createdAt: activity.createdAt ?? Date.now(),
				};
				announceFungibleOperationActivityChange({ type: 'upsert', activity: summary });
			}
		},
		[asset, collection.id]
	);
	const openOperation = React.useCallback(
		(next: FungibleOperation, options?: { show?: boolean }) => {
			if (wallet.address) {
				const show = options?.show ?? true;
				const signer = wallet.address;
				const id = fungibleOperationActivityId(asset.id, signer, next.kind);
				const existing = operationActivitiesRef.current.find(
					(activity) => activity.id === id && activity.signer === signer
				);
				if (existing) {
					if (show) showOperationActivity(existing.id);
					return;
				}
				const activity = {
					id,
					operation: next,
					phase: null,
					signer,
					visible: show,
					createdAt: Date.now(),
				} satisfies FungibleOperationActivity;
				setOperationActivities((current) =>
					appendFungibleOperationActivity(
						current.filter((candidate) => candidate.id !== id),
						activity
					)
				);
				publishOperationActivity(activity);
			}
		},
		[asset.id, publishOperationActivity, showOperationActivity, wallet.address]
	);
	const [recoverySuppressed, setRecoverySuppressed] = React.useState(false);
	const [recoveryNotice, setRecoveryNotice] = React.useState('');
	const [unavailableRecovery, setUnavailableRecovery] = React.useState<UnavailableOperationRecovery | null>(null);
	const resumeButtonRef = React.useRef<HTMLButtonElement>(null);
	const operationFocusFallbackRef = React.useRef<HTMLHeadingElement>(null);
	const operationFocusFallback = React.useCallback(
		() =>
			document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]') ??
			resumeButtonRef.current ??
			operationFocusFallbackRef.current,
		[]
	);
	const [purchaseQuantity, setPurchaseQuantity] = React.useState('');
	const [listingQuantity, setListingQuantity] = React.useState('');
	const [listingUnitPrice, setListingUnitPrice] = React.useState('');
	const [tradeMode, setTradeMode] = React.useState<'buy' | 'sell' | 'transfer'>('buy');
	const [activeSection, setActiveSection] = React.useState<'market' | 'holders' | 'about'>('market');
	const [orderReveal, setOrderReveal] = React.useState({ assetId: asset.id, limit: 50 });
	const orderRevealStatusRef = React.useRef<HTMLParagraphElement>(null);
	const [activityReveal, setActivityReveal] = React.useState({ assetId: asset.id, limit: 8 });
	const [holderReveal, setHolderReveal] = React.useState({ assetId: asset.id, limit: 50 });
	const holderRevealStatusRef = React.useRef<HTMLParagraphElement>(null);
	const [storageVersion, setStorageVersion] = React.useState(0);
	const orders = React.useMemo(() => liveOrdersOfAsset(state), [state]);
	const orderLimit = orderReveal.assetId === asset.id ? orderReveal.limit : 50;
	const visibleOrderRows = visibleOrderbookRows(orders, orderLimit);
	const orderDepths = React.useMemo(() => orderbookCumulativeDepths(orders), [orders]);
	const activityLimit = activityReveal.assetId === asset.id ? activityReveal.limit : 8;
	const visibleActivityRows = activity.slice(0, activityLimit);
	const openOrders = React.useMemo(() => orders.filter((order) => order.status === 'open'), [orders]);
	const purchasableOrders = React.useMemo(
		() => openOrders.filter((order) => order.creator !== wallet.address && order.recipient !== wallet.address),
		[openOrders, wallet.address]
	);
	const liquid = wallet.address ? liquidBalanceOf(state, wallet.address) : '0';
	const listed = wallet.address ? listedBalanceOf(state, wallet.address) : '0';
	const ticker = state.ticker || 'Token';
	const tickerDisplay = formatTickerLabel(ticker);
	const best = openOrders[0] ?? null;
	const forSale = React.useMemo(
		() => openOrders.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
		[openOrders]
	);
	const listingAmount = safeTokenAmount(listingQuantity, state.denomination);
	const listingBalance = BigInt(liquid);
	const listingQuantityError = listingQuantity.trim()
		? listingAmount === null
			? `Enter a valid ${tickerDisplay} amount using no more than ${state.denomination} decimal places.`
			: listingAmount > listingBalance
			? `You can list up to ${tokenLabel(liquid, state)}.`
			: ''
		: '';
	const listingUnitPriceError =
		listingUnitPrice.trim() && !safeArPrice(listingUnitPrice)
			? 'Enter a positive AR price with no more than 12 decimal places.'
			: '';
	const listingQuote =
		listingAmount !== null && listingAmount <= listingBalance
			? safeLotQuote(listingQuantity, listingUnitPrice, state)
			: null;
	const listingReady = Boolean(
		listingAmount !== null && listingAmount <= listingBalance && safeArPrice(listingUnitPrice) && listingQuote
	);
	const purchasableQuantity = React.useMemo(
		() => purchasableOrders.reduce((total, order) => total + BigInt(order.quantity), 0n),
		[purchasableOrders]
	);
	const purchaseQuantityTracksMaximum = React.useRef(false);
	const maximumPurchaseQuantity = formatTokenAmount(purchasableQuantity.toString(), state.denomination);
	React.useEffect(() => {
		if (!purchaseQuantityTracksMaximum.current) return;
		setPurchaseQuantity((current) => (current === maximumPurchaseQuantity ? current : maximumPurchaseQuantity));
	}, [maximumPurchaseQuantity]);
	const purchaseAmountResult = React.useMemo(
		() => purchaseAmountMatch(purchasableOrders, purchaseQuantity, state),
		[purchasableOrders, purchaseQuantity, state]
	);
	const holderRows = React.useMemo(() => fungibleHolders(state), [state]);
	const holders = holderRows.length;
	const holderLimit = holderReveal.assetId === asset.id ? holderReveal.limit : 50;
	const visibleHolderRows = holderRows.slice(0, holderLimit);
	const license = licenseProperties(state);
	const description = assetDescription(state, collection.description);
	const askHistory = React.useMemo(
		() => fungibleAskHistory(activity, state.denomination),
		[activity, state.denomination]
	);
	const purchaseKey = wallet.address ? fungibleBatchStorageKey(asset.id, wallet.address) : '';
	type FungibleAssetSection = typeof activeSection;
	const assetTabs: AssetDetailTab<FungibleAssetSection>[] = [
		{
			value: 'market',
			label: 'Market',
			icon: <BarChart3 className="ui-icon" aria-hidden="true" />,
			panelId: 'fungible-asset-market',
		},
		{
			value: 'holders',
			label: 'Holders',
			icon: <Users className="ui-icon" aria-hidden="true" />,
			panelId: 'fungible-asset-holders',
		},
		{
			value: 'about',
			label: 'About',
			icon: <Grid2X2 className="ui-icon" aria-hidden="true" />,
			panelId: 'fungible-asset-about',
		},
	];
	type FungibleTradeMode = typeof tradeMode;
	const tradeTabs: SegmentedTab<FungibleTradeMode>[] = [
		{
			value: 'buy',
			label: 'Buy',
			icon: <ShoppingCart className="ui-icon" aria-hidden="true" />,
			panelId: 'fungible-trade-buy',
		},
		{
			value: 'sell',
			label: 'List',
			icon: <Tag className="ui-icon" aria-hidden="true" />,
			panelId: 'fungible-trade-sell',
		},
		{
			value: 'transfer',
			label: 'Transfer',
			icon: <Send className="ui-icon" aria-hidden="true" />,
			panelId: 'fungible-trade-transfer',
		},
	];

	React.useEffect(() => {
		purchaseQuantityTracksMaximum.current = false;
		setPurchaseQuantity('');
		setListingQuantity('');
		setListingUnitPrice('');
		setTradeMode('buy');
		setActiveSection('market');
		setActivityReveal({ assetId: asset.id, limit: 8 });
	}, [asset.id]);

	React.useEffect(() => {
		if (activeSection === 'market') onActivityVisible();
	}, [activeSection, onActivityVisible]);

	React.useEffect(() => {
		if (!wallet.address) return;
		const walletAddress = wallet.address;
		const purchaseClaimKey = operationClaimStorageKey(asset.id, walletAddress, 'purchase');
		const assetClaimKey = operationClaimStorageKey(asset.id, walletAddress, 'asset');
		const operationKey = operationStorageKey(asset.id, walletAddress);
		const purchaseKey = fungibleBatchStorageKey(asset.id, walletAddress);
		const onStorage = (event: StorageEvent) => {
			if (event.storageArea && event.storageArea !== localStorage) return;
			const purchaseChange = walletOperationStorageChange(event.key, event.newValue, purchaseClaimKey, [
				purchaseKey,
			]);
			const change =
				purchaseChange === 'ignore'
					? walletOperationStorageChange(event.key, event.newValue, assetClaimKey, [operationKey])
					: purchaseChange;
			if (change === 'ignore') return;
			const changedScope = event.key === purchaseClaimKey || event.key === purchaseKey ? 'purchase' : 'asset';
			const inChangedScope = (activity: FungibleOperationActivity) =>
				changedScope === 'purchase' ? activity.operation.kind === 'buy' : activity.operation.kind !== 'buy';
			setRecoverySuppressed(false);
			if (change === 'claim-acquired' || change === 'claim-released') {
				if (change === 'claim-acquired') {
					setOperationActivities((current) =>
						current.filter((activity) => {
							if (activity.signer !== walletAddress || !inChangedScope(activity)) return true;
							return activity.operation.kind === 'buy'
								? Boolean(activity.operation.resume)
								: Boolean(activity.operation.resumeId);
						})
					);
				}
				setStorageVersion((version) => version + 1);
				return;
			}
			if (change === 'recovery-updated') {
				setOperationActivities((current) =>
					current.filter((activity) => {
						if (activity.signer !== walletAddress || !inChangedScope(activity)) return true;
						return activity.operation.kind === 'buy'
							? Boolean(activity.operation.resume)
							: Boolean(activity.operation.resumeId);
					})
				);
			} else {
				setOperationActivities((current) =>
					current.filter((activity) => activity.signer !== walletAddress || !inChangedScope(activity))
				);
				void onRefresh();
			}
			setStorageVersion((version) => version + 1);
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, [asset.id, onRefresh, wallet.address]);

	React.useEffect(() => {
		setRecoverySuppressed(false);
		setRecoveryNotice('');
		setUnavailableRecovery(null);
		setOperationActivities([]);
	}, [asset.id, wallet.address]);
	React.useLayoutEffect(() => {
		if (recoverySuppressed) resumeButtonRef.current?.focus();
	}, [recoverySuppressed]);
	React.useEffect(() => {
		if (!wallet.address || hasWalletActivities || recoverySuppressed) return;
		const activeClaimKeys = [
			operationClaimStorageKey(asset.id, wallet.address, 'purchase'),
			operationClaimStorageKey(asset.id, wallet.address, 'asset'),
		];
		const activeClaimKey = activeClaimKeys.find((key) => localStorage.getItem(key));
		if (activeClaimKey) {
			const controller = new AbortController();
			void clearStaleWalletOperationClaim(localStorage, activeClaimKey, { signal: controller.signal })
				.then((cleared) => {
					if (!controller.signal.aborted && cleared) setStorageVersion((version) => version + 1);
				})
				.catch(() => undefined);
			return () => controller.abort();
		}
		let savedBatch: any = null;
		try {
			savedBatch = JSON.parse(localStorage.getItem(fungibleBatchStorageKey(asset.id, wallet.address)) ?? 'null');
		} catch {
			removeWalletRecord(localStorage, purchaseKey);
		}
		if (isRecoverableBatch(savedBatch, wallet.address)) {
			const resume = savedBatch as BatchResume;
			const recoveryStatus = fungibleBatchRecoveryStatus(resume, state, wallet.address);
			if (recoveryStatus === 'resumable') {
				const gatewayNotice = purchaseGatewaySwitchNotice(
					resume.gateway,
					currentPurchaseGatewayContext(),
					resume.entries.find((entry) => hasRecoverablePurchase(entry.snapshot))?.snapshot
				);
				if (gatewayNotice) setRecoveryNotice(gatewayNotice);
				openOperation(
					{
						kind: 'buy',
						availableOrders: resume.entries.map((entry) => entry.order),
						startingBalance: resume.startingBalance,
						resume,
					},
					{ show: false }
				);
			} else if (batchHasNoDispatchedSellerPayment(resume)) {
				const removed = removeWalletRecoveryAndSignatures<BatchResume>(
					localStorage,
					fungibleBatchStorageKey(asset.id, wallet.address),
					(current) =>
						current.buyer === wallet.address &&
						(current.attemptId ?? batchRecoveryIdentity(current.entries)) ===
							(resume.attemptId ?? batchRecoveryIdentity(resume.entries)),
					resume.entries.flatMap((entry) => [entry.snapshot.registration?.id, entry.snapshot.payment?.id]),
					wallet.address
				);
				if (removed) {
					setRecoveryNotice(
						'A stale unpaid purchase was cleared because the live order changed before seller payment. No seller payment was sent; review the current order book to continue.'
					);
				}
			} else {
				setRecoveryNotice(
					'A previous token purchase is paused because a dispatched seller payment still needs a settlement check. Its signed transaction details remain saved in this browser, and no replacement payment will be created.'
				);
			}
		} else if (savedBatch !== null) {
			removeWalletRecordIf<any>(
				localStorage,
				fungibleBatchStorageKey(asset.id, wallet.address),
				(current) => !isRecoverableBatch(current, wallet.address!)
			);
		}
		try {
			const pendingOperationKey = operationStorageKey(asset.id, wallet.address);
			const saved = loadWalletRecord<any>(
				localStorage,
				pendingOperationKey,
				`bazar-operation:${asset.id}`,
				(record) =>
					record?.signer === wallet.address &&
					ADDRESS.test(record?.txId ?? '') &&
					['sell', 'cancel', 'transfer'].includes(record?.kind)
			);
			if (!saved) {
				setUnavailableRecovery((current) => (current?.key === pendingOperationKey ? null : current));
				return;
			}
			if (saved.signer !== wallet.address || !ADDRESS.test(saved.txId)) return;
			try {
				new AssetTransactionClient().restore(saved.txId, wallet.address);
			} catch {
				let canStillApply = false;
				if (saved.kind === 'cancel') {
					const order = state.orders[saved.order?.orderId];
					canStillApply = Boolean(order?.status === 'open' && order.creator === wallet.address);
				} else if (!state.orders[saved.txId]) {
					try {
						const quantity = parseTokenAmount(saved.quantity ?? '', state.denomination);
						canStillApply = BigInt(quantity) <= BigInt(liquidBalanceOf(state, wallet.address));
					} catch {
						canStillApply = false;
					}
				}
				const matches = (record: any) =>
					record?.assetId === asset.id && record?.signer === wallet.address && record?.txId === saved.txId;
				if (!canStillApply) {
					if (
						removeWalletRecoveryAndSignatures(
							localStorage,
							pendingOperationKey,
							matches,
							[saved.txId],
							wallet.address
						)
					) {
						setUnavailableRecovery(null);
						setRecoveryNotice(
							'A stale local action was removed after current live state proved that it can no longer apply. No replacement transaction was created.'
						);
					}
				} else {
					setUnavailableRecovery({
						key: pendingOperationKey,
						kind: saved.kind,
						signer: wallet.address,
						txId: saved.txId,
					});
				}
				return;
			}
			setUnavailableRecovery(null);
			if (saved.kind === 'cancel' && saved.order) {
				openOperation(
					{
						kind: 'cancel',
						order: saved.order,
						startingSlot: saved.startingSlot,
						resumeId: saved.txId,
					},
					{ show: false }
				);
			} else if (saved.kind === 'sell') {
				openOperation(
					{
						kind: 'sell',
						quantity: saved.quantity,
						unitPrice: saved.unitPrice,
						resumeId: saved.txId,
					},
					{ show: false }
				);
			} else if (saved.kind === 'transfer') {
				openOperation(
					{
						kind: 'transfer',
						quantity: saved.quantity,
						recipient: saved.recipient,
						startingSlot: saved.startingSlot,
						resumeId: saved.txId,
					},
					{ show: false }
				);
			}
		} catch {
			if (wallet.address) removeWalletRecord(localStorage, operationStorageKey(asset.id, wallet.address));
		}
	}, [
		asset.id,
		hasWalletActivities,
		openOperation,
		purchaseKey,
		recoverySuppressed,
		state,
		storageVersion,
		wallet.address,
	]);

	const signedRecoveryLocksAsset = Boolean(
		wallet.address && assetHasSavedSignedAction(localStorage, asset.id, wallet.address)
	);
	const recoveryBlocksActions = recoverySuppressed || Boolean(unavailableRecovery) || signedRecoveryLocksAsset;
	const purchaseBlocksActions = recoveryBlocksActions || Boolean(activePurchaseActivity);
	const assetBlocksActions = recoveryBlocksActions || Boolean(activeAssetActivity);
	const handleOperationPhaseChange = React.useCallback(
		(id: string, nextPhase: TransactionDialogPhase) => {
			const activity = operationActivitiesRef.current.find((candidate) => candidate.id === id);
			if (activity) publishOperationActivity(activity, nextPhase);
			setOperationActivities((current) =>
				current.map((activity) => (activity.id === id ? { ...activity, phase: nextPhase } : activity))
			);
			if (nextPhase === 'done') void onRefresh();
		},
		[onRefresh, publishOperationActivity]
	);

	React.useEffect(() => {
		const requestedId = (location.state as { fungibleOperationActivityId?: unknown } | null)
			?.fungibleOperationActivityId;
		if (typeof requestedId !== 'string') return;
		if (navigationType === 'POP') {
			navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
			return;
		}
		if (!operationActivities.some((activity) => activity.id === requestedId)) return;
		setOperationActivities((current) => {
			if (current.every((activity) => activity.visible === (activity.id === requestedId))) return current;
			return current.map((activity) => ({ ...activity, visible: activity.id === requestedId }));
		});
		navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
	}, [location.pathname, location.search, location.state, navigate, navigationType, operationActivities]);

	return (
		<section className="asset-page asset-detail-page fungible-asset-page">
			{recoverySuppressed ? (
				<div className="pending-operation-notice">
					<span role="status">
						Local tracking is paused. Resume here to continue observing signed work or review any wallet
						approvals still required.
					</span>
					<Button
						ref={resumeButtonRef}
						className="with-icon"
						type="button"
						size="custom"
						onClick={() => setRecoverySuppressed(false)}
					>
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Resume pending action
					</Button>
				</div>
			) : null}
			{recoveryNotice ? (
				<div className="pending-operation-notice">
					<span role="status">{recoveryNotice}</span>
					<Button type="button" onClick={() => setRecoveryNotice('')} size="custom">
						Dismiss
					</Button>
				</div>
			) : null}
			{unavailableRecovery ? (
				<UnavailableOperationRecoveryNotice
					recovery={unavailableRecovery}
					stateNoun="balances and orders above"
					onRefresh={() => void onRefresh()}
					onDiscard={() => {
						const removed = removeWalletRecoveryAndSignatures<any>(
							localStorage,
							unavailableRecovery.key,
							(record) =>
								record?.signer === unavailableRecovery.signer &&
								record?.txId === unavailableRecovery.txId,
							[unavailableRecovery.txId],
							unavailableRecovery.signer
						);
						if (removed) {
							setUnavailableRecovery(null);
							setRecoveryNotice(
								'Local tracking was discarded. Current balances and orders above remain the live source of truth.'
							);
						}
					}}
				/>
			) : null}
			<header className="fungible-token-header">
				<TokenAvatar
					className="fungible-token-avatar"
					fetchPriority="high"
					image={asset.image}
					loading="eager"
					ticker={ticker}
				/>
				<div className="fungible-token-identity">
					<div className="fungible-token-title">
						<h1 ref={operationFocusFallbackRef} tabIndex={-1}>
							{tickerDisplay}
						</h1>
						<span className="fungible-token-name">{asset.name}</span>
					</div>
					<div className="fungible-token-meta" aria-label="Token protocol details">
						<Link to={`/collection/${collection.id}`}>{collectionDisplayName(collection)}</Link>
						<span>{state.device}</span>
						<span>{state.denomination} decimals</span>
					</div>
				</div>
				<div className="fungible-token-balance">
					<span>
						{loading || error
							? wallet.address
								? 'Last known balance'
								: 'Last known supply'
							: wallet.address
							? 'Your liquid balance'
							: 'Circulating supply'}
					</span>
					<strong>{tokenLabel(wallet.address ? liquid : state.totalSupply, state)}</strong>
				</div>
			</header>
			{loading ? <Loading label="Computing current state…" /> : null}
			{error ? <ErrorPanel message={error} /> : null}
			<div className="asset-detail-layout">
				<div className="asset-commerce-column asset-commerce-primary">
					<section aria-busy={hasBusyWalletActivities} className="asset-commerce-card">
						<div className="asset-market-stats">
							<div>
								<span>Current unit price</span>
								<strong>
									{best ? (
										<ArCurrencyText>{orderPriceLabel(best, state)}</ArCurrencyText>
									) : (
										'Not listed'
									)}
								</strong>
							</div>
							<div>
								<span>For sale</span>
								<strong>{tokenLabel(forSale, state)}</strong>
							</div>
							<div>
								<span>Your listed</span>
								<strong>{wallet.address ? tokenLabel(listed, state) : '—'}</strong>
							</div>
							<div>
								<span>Holders</span>
								<strong>{holderRows.length.toLocaleString()}</strong>
							</div>
						</div>
						<div className="fungible-trade-switcher">
							<SegmentedTabs<FungibleTradeMode>
								active={tradeMode}
								ariaLabel="Trade action"
								className="fungible-trade-tabs"
								idPrefix="fungible-trade"
								onChange={setTradeMode}
								tabs={tradeTabs}
							/>
						</div>
						{tradeMode === 'buy' ? (
							<div
								aria-labelledby="fungible-trade-buy-tab"
								className="fungible-trade-panel"
								id="fungible-trade-buy"
								role="tabpanel"
							>
								{purchasableOrders.length ? (
									<FungiblePurchaseComposer
										availableQuantity={purchasableQuantity.toString()}
										excludedQuantity={(BigInt(forSale) - purchasableQuantity).toString()}
										error={purchaseAmountResult.error}
										match={purchaseAmountResult.match}
										onChange={(quantity) => {
											purchaseQuantityTracksMaximum.current = false;
											setPurchaseQuantity(quantity);
										}}
										onMax={() => {
											purchaseQuantityTracksMaximum.current = true;
											setPurchaseQuantity(maximumPurchaseQuantity);
										}}
										quantity={purchaseQuantity}
										state={state}
									/>
								) : (
									<div className="asset-buy-summary asset-buy-summary-empty">
										<span>Purchase amount</span>
										<h1>No purchasable listings</h1>
										<small>No open listings are available to this wallet.</small>
									</div>
								)}
							</div>
						) : tradeMode === 'sell' ? (
							<div
								aria-labelledby="fungible-trade-sell-tab"
								className="fungible-trade-panel"
								id="fungible-trade-sell"
								role="tabpanel"
							>
								{wallet.address && listingBalance > 0n ? (
									<FungibleListingComposer
										availableQuantity={liquid}
										onMax={() => setListingQuantity(formatTokenAmount(liquid, state.denomination))}
										onQuantityChange={setListingQuantity}
										onUnitPriceChange={setListingUnitPrice}
										quantity={listingQuantity}
										quantityError={listingQuantityError}
										state={state}
										total={listingQuote}
										unitPrice={listingUnitPrice}
										unitPriceError={listingUnitPriceError}
									/>
								) : (
									<div className="asset-buy-summary asset-buy-summary-empty">
										<span>Listing amount</span>
										<h1>{wallet.address ? 'No liquid tokens' : 'Connect to list'}</h1>
										<small>
											{wallet.address
												? 'Tokens already listed for sale are not available for a new listing.'
												: 'Connect your wallet to see the tokens available to list.'}
										</small>
									</div>
								)}
							</div>
						) : (
							<div
								aria-labelledby="fungible-trade-transfer-tab"
								className="fungible-trade-panel"
								id="fungible-trade-transfer"
								role="tabpanel"
							>
								<div className="asset-buy-summary asset-buy-summary-empty">
									<span>Available to transfer</span>
									<h1>
										{wallet.address
											? listingBalance > 0n
												? tokenLabel(liquid, state)
												: 'No liquid tokens'
											: 'Connect to transfer'}
									</h1>
									<small>
										{wallet.address
											? listingBalance > 0n
												? 'Choose a recipient and amount in the transfer review.'
												: 'Tokens listed for sale are not available to transfer.'
											: 'Connect your wallet to see the tokens available to transfer.'}
									</small>
								</div>
							</div>
						)}
						{walletActivities.map((activity) => (
							<AssetOperationStatus
								key={activity.id}
								kind={activity.operation.kind}
								phase={activity.phase ?? 'form'}
								status={fungibleActivityPhaseStatus(activity.phase ?? 'form')}
								onView={() => showOperationActivity(activity.id)}
							/>
						))}
						<div className="asset-commerce-actions">
							{!wallet.address ? <ConnectWalletButton /> : null}
							{tradeMode === 'buy' && wallet.address && purchasableOrders.length ? (
								<Button
									className="with-icon market-primary-action"
									disabled={
										!purchaseAmountResult.match ||
										purchaseBlocksActions ||
										loading ||
										Boolean(error)
									}
									size="custom"
									variant="primary"
									onClick={() => {
										if (!purchaseAmountResult.match) return;
										openOperation({
											kind: 'buy',
											availableOrders: purchasableOrders,
											quantity: purchaseQuantity,
											startingBalance: liquid,
										});
									}}
								>
									<ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
									{activePurchaseActivity
										? assetOperationPendingActionLabel('buy')
										: purchaseAmountResult.match
										? 'Buy tokens'
										: 'Enter an amount'}
								</Button>
							) : null}
							{tradeMode === 'sell' && wallet.address && listingBalance > 0n ? (
								<Button
									className="with-icon market-primary-action"
									disabled={!listingReady || assetBlocksActions || loading || Boolean(error)}
									size="custom"
									onClick={() =>
										openOperation({
											kind: 'sell',
											quantity: listingQuantity,
											unitPrice: listingUnitPrice,
										})
									}
									variant="primary"
								>
									<Tag className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
									{activeAssetActivity?.operation.kind === 'sell'
										? assetOperationPendingActionLabel('sell')
										: listingReady
										? 'Review listing'
										: 'Enter listing details'}
								</Button>
							) : null}
							{tradeMode === 'transfer' && wallet.address && listingBalance > 0n ? (
								<Button
									className="with-icon market-primary-action"
									disabled={assetBlocksActions || loading || Boolean(error)}
									size="custom"
									onClick={() => openOperation({ kind: 'transfer' })}
									variant="primary"
								>
									<Send className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
									{activeAssetActivity?.operation.kind === 'transfer'
										? assetOperationPendingActionLabel('transfer')
										: 'Transfer tokens'}
								</Button>
							) : null}
						</div>
					</section>
				</div>
				<div className="asset-commerce-column asset-commerce-secondary">
					{collectionIndexNotice}
					<AssetDetailTabs<FungibleAssetSection>
						active={activeSection}
						ariaLabel="Token detail sections"
						idPrefix="fungible-asset"
						onChange={setActiveSection}
						tabs={assetTabs}
					/>
					{activeSection === 'market' ? (
						<section
							aria-labelledby="fungible-asset-market-tab"
							className="asset-tab-panel fungible-market-panel"
							id="fungible-asset-market"
							role="tabpanel"
							tabIndex={0}
						>
							<TokenPriceChart
								error={activityError}
								formatValue={(value) => `${winstonToAr(value)} AR / ${ticker}`}
								loading={activityLoading}
								points={askHistory}
								ticker={ticker}
							/>
							<div
								aria-label={`${asset.name} order book`}
								className="orderbook-table fungible-orderbook"
								role="table"
							>
								<div className="orderbook-head" role="row">
									<span role="columnheader">Price (AR)</span>
									<span role="columnheader">Size ({tickerDisplay})</span>
									<span role="columnheader">Value (AR)</span>
									<span role="columnheader">Seller</span>
									<span role="columnheader">State</span>
									<span aria-label="Actions" role="columnheader" />
								</div>
								{visibleOrderRows.map((order, index) => {
									const own = order.creator === wallet.address;
									return (
										<div
											className="orderbook-row orderbook-depth-row"
											key={order.orderId}
											role="row"
											style={
												{ '--orderbook-depth': `${orderDepths[index]}%` } as React.CSSProperties
											}
										>
											<strong
												aria-label={orderPriceLabel(order, state)}
												data-label="Price (AR)"
												role="cell"
											>
												{winstonToAr(unitPriceWinston(order, state.denomination).toString())}
											</strong>
											<span
												aria-label={tokenLabel(order.quantity, state)}
												data-label={`Size (${tickerDisplay})`}
												role="cell"
											>
												{formatGroupedTokenAmount(order.quantity, state.denomination)}
											</span>
											<span
												aria-label={`${winstonToAr(order.asking)} AR`}
												data-label="Value (AR)"
												role="cell"
											>
												{winstonToAr(order.asking)}
											</span>
											<span data-label="Seller" role="cell">
												<WalletAddress address={order.creator} label="seller" />
											</span>
											<span
												className={`order-status ${order.status}`}
												data-label="State"
												role="cell"
											>
												{order.status}
											</span>
											<span className="orderbook-action-cell" role="cell">
												{own && order.status === 'open' ? (
													<Button
														aria-label={fungibleOrderActionLabel('cancel', order, state)}
														className="order-action"
														disabled={assetBlocksActions || loading || Boolean(error)}
														size="custom"
														onClick={() => openOperation({ kind: 'cancel', order })}
														variant="danger"
													>
														{activeAssetActivity?.operation.kind === 'cancel' &&
														activeAssetActivity.operation.order.orderId === order.orderId
															? assetOperationPendingActionLabel('cancel')
															: 'Cancel'}
													</Button>
												) : null}
											</span>
										</div>
									);
								})}
								{!orders.length ? (
									<div className="orderbook-empty" role="row">
										<div aria-colspan={6} className="orderbook-empty-cell" role="cell">
											<strong>No open asks</strong>
											<span>
												Token holders can list any whole lot directly from their wallet.
											</span>
										</div>
									</div>
								) : null}
							</div>
							{orders.length > 50 ? (
								<div className="orderbook-reveal">
									<p
										aria-atomic="true"
										aria-live="polite"
										ref={orderRevealStatusRef}
										role="status"
										tabIndex={-1}
									>
										Showing {visibleOrderRows.length.toLocaleString()} of{' '}
										{orders.length.toLocaleString()} live orders.
									</p>
									{visibleOrderRows.length < orders.length ? (
										<Button
											type="button"
											size="custom"
											onClick={() => {
												const next = Math.min(orders.length, orderLimit + 50);
												setOrderReveal({ assetId: asset.id, limit: next });
												if (next === orders.length) {
													window.requestAnimationFrame(() =>
														orderRevealStatusRef.current?.focus()
													);
												}
											}}
										>
											Show{' '}
											{Math.min(50, orders.length - visibleOrderRows.length).toLocaleString()}{' '}
											more orders
										</Button>
									) : null}
								</div>
							) : null}
							<section className="asset-market-activity" aria-labelledby="fungible-market-activity-title">
								<div className="asset-market-activity-heading">
									<div>
										<h2 id="fungible-market-activity-title">Activity</h2>
										{activityLoading ? <span role="status">Refreshing…</span> : null}
									</div>
								</div>
								{activityError ? (
									<div className="inline-error retry-notice" role="status">
										<span>
											Compute hasn’t completed yet. Please try again.{' '}
											{activity.length ? 'Previously loaded events remain visible.' : ''}
										</span>
										<Button
											className="with-icon"
											onClick={onActivityRetry}
											size="custom"
											type="button"
										>
											<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
											history
										</Button>
									</div>
								) : null}
								{visibleActivityRows.length ? (
									<MarketActivityList
										ariaLabel={`${asset.name} market activity`}
										collectionId={collection.id}
										compact
										describeEvent={(event) => activityDetail(event, state)}
										eventAmount={(event) => fungiblePurchaseActivityAmount(event, activity, state)}
										events={visibleActivityRows}
										loading={activityLoading}
										resolveAsset={() => asset}
									/>
								) : null}
								{!activityLoading && !activityError && !activity.length ? (
									<p className="asset-empty-copy">No indexed market events found.</p>
								) : null}
								{visibleActivityRows.length < activity.length ? (
									<div className="asset-market-activity-footer">
										<Button
											type="button"
											size="custom"
											onClick={() =>
												setActivityReveal({
													assetId: asset.id,
													limit: Math.min(activity.length, activityLimit + 8),
												})
											}
										>
											Show{' '}
											{Math.min(8, activity.length - visibleActivityRows.length).toLocaleString()}{' '}
											more
										</Button>
									</div>
								) : null}
							</section>
						</section>
					) : null}
					{activeSection === 'holders' ? (
						<section
							aria-labelledby="fungible-asset-holders-tab"
							className="asset-tab-panel"
							id="fungible-asset-holders"
							role="tabpanel"
							tabIndex={0}
						>
							<div
								aria-label={`${asset.name} token holders`}
								className="orderbook-table fungible-holder-table"
								role="table"
							>
								<div className="orderbook-head" role="row">
									<span role="columnheader">Holder</span>
									<span role="columnheader">Total balance</span>
									<span role="columnheader">Share</span>
									<span role="columnheader">Listed</span>
								</div>
								{visibleHolderRows.map((holder) => (
									<div className="orderbook-row" key={holder.address} role="row">
										<span data-label="Holder" role="cell">
											<WalletAddress address={holder.address} label="holder" />
										</span>
										<strong data-label="Total balance" role="cell">
											{tokenLabel(holder.total, state)}
										</strong>
										<span className="fungible-holder-share" data-label="Share" role="cell">
											{fungibleHoldingPercentage(holder.total, state.totalSupply)}
										</span>
										<span data-label="Listed" role="cell">
											{BigInt(holder.listed) > 0n ? tokenLabel(holder.listed, state) : '—'}
										</span>
									</div>
								))}
								{!holderRows.length ? (
									<div className="orderbook-empty" role="row">
										<div aria-colspan={4} className="orderbook-empty-cell" role="cell">
											<strong>No holders found</strong>
											<span>The current process state does not contain a positive balance.</span>
										</div>
									</div>
								) : null}
							</div>
							{holderRows.length > 50 ? (
								<div className="orderbook-reveal">
									<p
										aria-atomic="true"
										aria-live="polite"
										ref={holderRevealStatusRef}
										role="status"
										tabIndex={-1}
									>
										Showing {visibleHolderRows.length.toLocaleString()} of{' '}
										{holderRows.length.toLocaleString()} holders.
									</p>
									{visibleHolderRows.length < holderRows.length ? (
										<Button
											type="button"
											size="custom"
											onClick={() => {
												const next = Math.min(holderRows.length, holderLimit + 50);
												setHolderReveal({ assetId: asset.id, limit: next });
												if (next === holderRows.length) {
													window.requestAnimationFrame(() =>
														holderRevealStatusRef.current?.focus()
													);
												}
											}}
										>
											Show{' '}
											{Math.min(
												50,
												holderRows.length - visibleHolderRows.length
											).toLocaleString()}{' '}
											more holders
										</Button>
									) : null}
								</div>
							) : null}
							<p className="market-note">Balances include tokens held in active marketplace listings.</p>
						</section>
					) : null}
					{activeSection === 'about' ? (
						<section
							aria-labelledby="fungible-asset-about-tab"
							className="asset-tab-panel"
							id="fungible-asset-about"
							role="tabpanel"
							tabIndex={0}
						>
							<p className="asset-description">{description}</p>
							<div className="asset-detail-facts">
								<div>
									<span>Ticker</span>
									<strong>{tickerDisplay}</strong>
								</div>
								<div>
									<span>Total supply</span>
									<strong>{tokenLabel(state.totalSupply, state)}</strong>
								</div>
								<div>
									<span>Atomic precision</span>
									<strong>{state.denomination} decimals</strong>
								</div>
								<div>
									<span>Settlement</span>
									<strong>
										<ArCurrencyLabel />
									</strong>
								</div>
							</div>
							<section className="asset-about-rights" aria-labelledby="fungible-about-rights-title">
								<h2 id="fungible-about-rights-title">Usage rights</h2>
								{license.length ? (
									<dl className="license-properties">
										{license.map((property) => (
											<div key={property.key}>
												<dt>{property.label}</dt>
												<dd>{property.value}</dd>
											</div>
										))}
										<div className="license-proof">
											<dt>Proof</dt>
											<dd>
												<a
													href={transactionExplorerUrl(asset.id)}
													target="_blank"
													rel="noreferrer"
												>
													View license proof on ViewBlock{' '}
													<ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
												</a>
											</dd>
										</div>
									</dl>
								) : (
									<p className="asset-empty-copy">No UDL terms declared.</p>
								)}
								<p className="market-note">
									Declared terms and effective UDL 0.2 defaults come from immutable process metadata.
								</p>
							</section>
						</section>
					) : null}
				</div>
			</div>
			{walletActivities.map((activity) => (
				<FungibleOperationDialog
					key={`${activity.id}:${activity.createdAt ?? 0}`}
					asset={asset}
					collectionId={collection.id}
					state={state}
					owner={activity.signer}
					operation={activity.operation}
					visible={activity.visible}
					restoreFallback={operationFocusFallback}
					onHide={() =>
						setOperationActivities((current) =>
							current.map((currentActivity) =>
								currentActivity.id === activity.id
									? { ...currentActivity, visible: false }
									: currentActivity
							)
						)
					}
					onPhaseChange={(phase) => handleOperationPhaseChange(activity.id, phase)}
					onRestart={() => {
						setRecoverySuppressed(false);
						setOperationActivities((current) =>
							current.map((candidate) =>
								candidate.id === activity.id ? restartFungibleOperationActivity(candidate) : candidate
							)
						);
					}}
					onClose={(resumeLater, refresh = true) => {
						setRecoverySuppressed(Boolean(resumeLater));
						if (!resumeLater) publishOperationActivity(activity, 'done');
						setOperationActivities((current) =>
							resumeLater
								? current.map((currentActivity) =>
										currentActivity.id === activity.id
											? { ...currentActivity, visible: false }
											: currentActivity
								  )
								: current.filter((currentActivity) => currentActivity.id !== activity.id)
						);
						if (refresh) void onRefresh();
					}}
				/>
			))}
		</section>
	);
}

function fungibleActivityPhaseStatus(phase: TransactionDialogPhase) {
	return {
		form: 'Waiting for details',
		approval: 'Waiting for wallet approval',
		working: 'Transaction in progress',
		done: 'Complete',
		error: 'Needs attention',
	}[phase];
}

export type FungiblePurchaseSequenceStep = {
	key: 'sign' | 'reserve' | 'pay' | 'verify';
	label: string;
	detail: string;
	state: 'done' | 'active' | 'next';
};

const PAYMENT_PURCHASE_STAGES = new Set([
	'dispatching-payment',
	'payment-propagating',
	'payment-confirming',
	'ownership-verifying',
	'complete',
]);

export function fungiblePurchaseSequence(
	states: Array<PurchaseState | undefined>,
	listingCount: number
): FungiblePurchaseSequenceStep[] {
	const total = Math.max(1, listingCount);
	const known = states.filter((state): state is PurchaseState => Boolean(state));
	const signed = Math.min(total, known.length);
	const reserved = Math.min(total, known.filter((state) => PAYMENT_PURCHASE_STAGES.has(state.stage)).length);
	const paid = Math.min(
		total,
		known.filter((state) => state.stage === 'ownership-verifying' || state.stage === 'complete').length
	);
	const verified = Math.min(total, known.filter((state) => state.stage === 'complete').length);
	const activeIndex = signed < total ? 0 : reserved < total ? 1 : paid < total ? 2 : verified < total ? 3 : 4;
	const progress = [signed, reserved, paid, verified];
	const steps: Array<Omit<FungiblePurchaseSequenceStep, 'state'>> = [
		{
			key: 'sign',
			label: 'Sign',
			detail: `${total * 2} wallet ${total * 2 === 1 ? 'approval' : 'approvals'}`,
		},
		{ key: 'reserve', label: 'Reserve', detail: `${reserved}/${total} accepted` },
		{ key: 'pay', label: 'Pay', detail: `${paid}/${total} confirmed` },
		{ key: 'verify', label: 'Verify', detail: `${verified}/${total} verified` },
	];
	return steps.map((step, index) => ({
		...step,
		state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'next',
		...(index === 0 && signed < total ? { detail: `Preparing ${total * 2} wallet approvals` } : {}),
		...(index > 0 && progress[index] === total ? { state: 'done' as const } : {}),
	}));
}

export function FungiblePurchaseSequence({
	states,
	listingCount,
}: {
	states: Array<PurchaseState | undefined>;
	listingCount: number;
}) {
	const steps = fungiblePurchaseSequence(states, listingCount);
	return (
		<section aria-label="Purchase transaction sequence" className="purchase-sequence">
			<ol>
				{steps.map((step, index) => (
					<li className={step.state} key={step.key}>
						<span aria-hidden="true" className="purchase-sequence-marker">
							{step.state === 'done' ? <Check /> : index + 1}
						</span>
						<span className="purchase-sequence-copy">
							<strong>{step.label}</strong>
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}

function FungibleOperationDialog({
	asset,
	collectionId,
	state,
	owner,
	operation,
	visible,
	restoreFallback,
	onHide,
	onPhaseChange,
	onRestart,
	onClose,
}: {
	asset: AssetSummary;
	collectionId: string;
	state: AssetState;
	owner: string;
	operation: FungibleOperation;
	visible: boolean;
	restoreFallback(): HTMLElement | null;
	onHide(): void;
	onPhaseChange(phase: TransactionDialogPhase): void;
	onRestart(): void;
	onClose(resumeLater?: boolean, refresh?: boolean): void;
}) {
	const recoveryApprovalCount =
		operation.kind === 'buy' && operation.resume ? batchPurchaseRecoveryApprovalCount(operation.resume.entries) : 0;
	const recoveryApprovalCopy =
		operation.kind === 'buy' && operation.resume
			? batchPurchaseRecoveryApprovalCopy(operation.resume.entries)
			: null;
	const eligible = React.useMemo(
		() => (operation.kind === 'buy' ? operation.availableOrders.filter((order) => order.status === 'open') : []),
		[operation.kind, operation.kind === 'buy' ? operation.availableOrders : undefined]
	);
	const initialQuantity =
		operation.kind === 'buy' && operation.resume
			? formatTokenAmount(
					operation.resume.entries
						.reduce((total, entry) => total + BigInt(entry.fillQuantity), 0n)
						.toString(),
					state.denomination
			  )
			: operation.kind === 'buy'
			? operation.quantity ?? ''
			: '';
	const [quantity, setQuantity] = React.useState(
		operation.kind === 'sell' || operation.kind === 'transfer' ? operation.quantity ?? '' : initialQuantity
	);
	const [unitPrice, setUnitPrice] = React.useState(operation.kind === 'sell' ? operation.unitPrice ?? '' : '');
	const [recipient, setRecipient] = React.useState(operation.kind === 'transfer' ? operation.recipient ?? '' : '');
	const [phase, setPhase] = React.useState<'form' | 'approval' | 'working' | 'done' | 'error'>(
		operation.kind === 'buy' && operation.resume
			? recoveryApprovalCount
				? 'approval'
				: 'working'
			: operation.kind !== 'buy' && operation.resumeId
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
		operation.kind === 'buy' ? operation.resume?.entries[0]?.order.orderId ?? '' : ''
	);
	const [estimatedCost, setEstimatedCost] = React.useState<string | null>(null);
	const [estimatedWalletBalance, setEstimatedWalletBalance] = React.useState<string | null>(null);
	const [canAfford, setCanAfford] = React.useState<boolean | null>(null);
	const [quoteState, setQuoteState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
	const [quoteRetry, setQuoteRetry] = React.useState(0);
	const [hiding, setHiding] = React.useState(false);
	const [settlementAnnouncement, setSettlementAnnouncement] = React.useState('');
	const settlementAnnouncementKeyRef = React.useRef('');
	const submittedAtRef = React.useRef<number>();
	const purchasesRef = React.useRef<Map<string, SwapPurchase>>(new Map());
	const networkRef = React.useRef<AssetObserverNetworkLease | null>(null);
	const claimRef = React.useRef<WalletOperationClaim | null>(null);
	const exactActionBaselineRef = React.useRef<{ startingSlot: number } | null>(
		(operation.kind === 'cancel' || operation.kind === 'transfer') && Number.isSafeInteger(operation.startingSlot)
			? { startingSlot: operation.startingSlot! }
			: (operation.kind === 'cancel' || operation.kind === 'transfer') && operation.resumeId
			? { startingSlot: 0 }
			: null
	);
	const attemptRef = React.useRef(new AbortController());
	const cleanupTimerRef = React.useRef<number | undefined>();
	const hideTimerRef = React.useRef<number | null>(null);
	const phaseChangeRef = React.useRef(onPhaseChange);
	phaseChangeRef.current = onPhaseChange;
	const resumed = React.useRef(false);
	const ticker = state.ticker || 'Token';
	const tickerDisplay = formatTickerLabel(ticker);
	const automaticMatchResult = React.useMemo(() => {
		if (operation.kind !== 'buy') return { match: null, error: '' };
		try {
			const atomic = parseTokenAmount(quantity, state.denomination);
			const match = matchOrderFills(eligible, atomic);
			return {
				match,
				error: match
					? ''
					: `Only ${tokenLabel(
							eligible.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
							state
					  )} is currently available.`,
			};
		} catch (cause) {
			return {
				match: null,
				error:
					cause instanceof RangeError
						? 'This order book is too large to quote safely. Refresh and try again.'
						: quantity
						? `Enter a valid ${tickerDisplay} amount using no more than ${state.denomination} decimal places.`
						: '',
			};
		}
	}, [eligible, operation.kind, quantity, state, state.denomination, tickerDisplay]);
	const automaticMatch = automaticMatchResult.match;
	const matchedFills = automaticMatch?.fills ?? [];
	const matchedOrders = matchedFills.map((fill) => fill.order);
	const matchedQuantity = matchedOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
	const matchedAsking = matchedOrders.reduce((total, order) => total + BigInt(order.asking), 0n);
	const matchedSellers = new Set(matchedOrders.map((order) => order.creator)).size;
	const enteredQuantity = safeTokenAmount(quantity, state.denomination);
	const currentLiquid = BigInt(liquidBalanceOf(state, owner));
	const currentListed = BigInt(listedBalanceOf(state, owner));
	const listingQuote = operation.kind === 'sell' ? safeLotQuote(quantity, unitPrice, state) : null;
	const unitPriceValid = safeArPrice(unitPrice);
	const transferRecipient =
		operation.kind === 'transfer' ? (operation.recipient ?? recipient).trim() : recipient.trim();
	const recipientError =
		operation.kind === 'transfer' ? fungibleTransferRecipientError(transferRecipient, owner) : '';
	const sellValid =
		operation.kind === 'sell' &&
		enteredQuantity !== null &&
		enteredQuantity <= currentLiquid &&
		unitPriceValid &&
		listingQuote !== null;
	const transferValid =
		operation.kind === 'transfer' &&
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
		if (visible) setHiding(false);
	}, [visible]);

	React.useEffect(() => {
		phaseChangeRef.current(phase);
	}, [phase]);

	React.useEffect(() => {
		if (operation.kind !== 'buy' || !matchedOrders.length || operation.resume) {
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
				client.estimatePurchaseBatchCosts(matchedOrders, asset.id, controller.signal),
				client.walletBalance(owner, controller.signal),
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
		asset.id,
		purchaseQuoteIdentity(matchedOrders),
		operation.kind,
		operation.kind === 'buy' ? operation.resume : undefined,
		owner,
		quoteRetry,
	]);

	React.useEffect(() => {
		const shouldResume =
			(operation.kind === 'buy' &&
				operation.resume?.entries.every((entry) => shouldAutomaticallyResumePurchase(entry.snapshot))) ||
			(operation.kind !== 'buy' && operation.resumeId);
		if (!shouldResume || resumed.current) return;
		resumed.current = true;
		void submit();
	}, []);

	async function submit() {
		submittedAtRef.current ??= Date.now();
		setMessage('');
		setFailureKind(null);
		setPhase('working');
		let attemptedTransactionId = operation.kind === 'buy' ? undefined : operation.resumeId ?? transaction?.id;
		try {
			const freshOperation = operation.kind === 'buy' ? !operation.resume : !operation.resumeId && !transaction;
			const signal = attemptRef.current.signal;
			const operationKey = operationStorageKey(asset.id, owner);
			const purchaseKey = fungibleBatchStorageKey(asset.id, owner);
			const resumeTransactionId = operation.kind === 'buy' ? undefined : operation.resumeId ?? transaction?.id;
			let exactActionBaseline = exactActionBaselineRef.current;
			let freshState: AssetState | undefined;
			claimRef.current = await acquireWalletOperationClaim(
				localStorage,
				operationClaimStorageKey(asset.id, owner, operation.kind === 'buy' ? 'purchase' : 'asset'),
				operation.kind === 'buy' ? [purchaseKey] : [operationKey],
				{
					...(freshOperation
						? {}
						: operation.kind === 'buy' && operation.resume
						? {
								recovery: {
									key: purchaseKey,
									matches: (record: any) =>
										record?.buyer === owner &&
										(record?.attemptId ?? batchRecoveryIdentity(record?.entries ?? [])) ===
											(operation.resume?.attemptId ??
												batchRecoveryIdentity(operation.resume?.entries ?? [])),
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
				({ state: freshState } = await readAssetState(asset.id, { signal, maxAge: 0 }));
				const expectedOrders =
					operation.kind === 'buy'
						? matchedFills.map((fill) => fill.sourceOrder)
						: operation.kind === 'cancel'
						? [operation.order]
						: [];
				const rawQuantity =
					operation.kind === 'sell' || operation.kind === 'transfer'
						? parseTokenAmount(quantity, state.denomination)
						: '0';
				if (
					fungibleOperationStateError(
						operation.kind,
						freshState,
						owner,
						expectedOrders,
						rawQuantity,
						state.denomination
					)
				) {
					throw new Error('market-state-changed');
				}
				if (operation.kind === 'cancel' || operation.kind === 'transfer') {
					const startingSlot = Number(freshState.raw['at-slot']);
					if (!Number.isSafeInteger(startingSlot) || startingSlot < 0) {
						throw new Error('asset-action-starting-slot-unavailable');
					}
					exactActionBaseline = { startingSlot };
					exactActionBaselineRef.current = exactActionBaseline;
				}
			}
			const client = new AssetTransactionClient();
			if (operation.kind === 'buy') {
				if (!operation.resume && !matchedFills.length)
					throw new Error('Enter an amount available from the order book.');
				await runPurchaseBatch(
					client,
					operation.resume?.entries ??
						matchedFills.map((fill) => ({
							order: fill.sourceOrder,
							fillQuantity: fill.order.quantity,
							snapshot: {},
						})),
					operation.resume,
					batchPurchaseStartingBalance(operation.resume, freshState, owner, operation.startingBalance)
				);
				return;
			}

			let prepared: PreparedTransaction;
			let newlyPrepared = false;
			let rawQuantity = '';
			let asking = '';
			if (operation.kind === 'transfer') {
				const transferError = fungibleTransferRecipientError(transferRecipient, owner);
				if (transferError) throw new Error(transferError);
			}
			if (transaction) prepared = transaction;
			else if (operation.resumeId) prepared = client.restore(operation.resumeId, owner);
			else if (operation.kind === 'sell') {
				rawQuantity = parseTokenAmount(quantity, state.denomination);
				if (BigInt(rawQuantity) < 1n || BigInt(rawQuantity) > BigInt(liquidBalanceOf(state, owner))) {
					throw new Error('Enter a quantity within your liquid balance.');
				}
				asking = lotAsking(rawQuantity, unitPrice, state.denomination);
				prepared = await client.makeOffer(
					{ processId: asset.id, quantity: rawQuantity, asking, seller: owner },
					signal
				);
				newlyPrepared = true;
			} else if (operation.kind === 'cancel') {
				prepared = await client.cancelOrder(asset.id, operation.order.orderId, owner, signal);
				newlyPrepared = true;
			} else {
				rawQuantity = parseTokenAmount(quantity, state.denomination);
				if (BigInt(rawQuantity) < 1n || BigInt(rawQuantity) > BigInt(liquidBalanceOf(state, owner))) {
					throw new Error('Enter a quantity within your liquid balance.');
				}
				prepared = await client.transferFungible(asset.id, transferRecipient, rawQuantity, owner, signal);
				newlyPrepared = true;
			}
			if (discardNewlyPreparedTransactionIfAborted(localStorage, prepared.id, newlyPrepared, signal)) {
				throw signal.reason;
			}
			attemptedTransactionId = prepared.id;
			setTransaction(prepared);
			if ((operation.kind === 'cancel' || operation.kind === 'transfer') && !exactActionBaseline) {
				throw new Error('asset-action-recovery-baseline-missing');
			}
			const operationRecord = {
				txId: prepared.id,
				kind: operation.kind,
				assetId: asset.id,
				asset,
				activityKind: 'fungible',
				collectionId,
				signer: owner,
				...(operation.kind === 'cancel'
					? { order: operation.order, startingSlot: exactActionBaseline!.startingSlot }
					: operation.kind === 'sell'
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
						operationStorageKey(asset.id, owner),
						operationRecord,
						matches
					);
				} else {
					storeWalletRecordOrThrow<any>(
						localStorage,
						operationStorageKey(asset.id, owner),
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
			if (operation.kind === 'sell') {
				const expectedQuantity =
					rawQuantity || parseTokenAmount(operation.quantity ?? quantity, state.denomination);
				const expectedAsking =
					asking || lotAsking(expectedQuantity, operation.unitPrice ?? unitPrice, state.denomination);
				await client.waitForOfferAcceptance(
					asset.id,
					{
						orderId: prepared.id,
						seller: owner,
						quantity: expectedQuantity,
						asking: expectedAsking,
						minimumFee: DEFAULT_REGISTRATION_FEE.toString(),
					},
					signal
				);
			} else if (operation.kind === 'cancel') {
				await client.waitForExactCancellation(
					asset.id,
					prepared.id,
					owner,
					operation.order,
					exactActionBaseline!,
					signal
				);
			} else {
				const expectedQuantity =
					rawQuantity || parseTokenAmount(operation.quantity ?? quantity, state.denomination);
				if (!exactActionBaseline) throw new Error('asset-action-recovery-baseline-missing');
				await client.waitForFungibleTransfer(
					asset.id,
					prepared.id,
					owner,
					transferRecipient,
					expectedQuantity,
					exactActionBaseline,
					signal
				);
			}
			removeWalletRecoveryAndSignatures<any>(
				localStorage,
				operationStorageKey(asset.id, owner),
				(record) => record?.txId === prepared.id,
				[prepared.id],
				owner
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
					operationStorageKey(asset.id, owner),
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
		startingBalance = operation.kind === 'buy' ? operation.startingBalance : '0'
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
			asset,
			activityKind: 'fungible',
			buyer: owner,
			collectionId,
			startingBalance,
			entries,
			createdAt: resume?.createdAt ?? Date.now(),
			gateway: resume?.gateway ?? currentPurchaseGatewayContext(),
		};
		let terminalRecoveryRemoved = false;
		const attemptId =
			resume?.attemptId ??
			(resume
				? batchRecoveryIdentity(entries)
				: globalThis.crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
		saved.attemptId = attemptId;
		const recoveryKey = fungibleBatchStorageKey(asset.id, owner);
		const matchesAttempt = (current: BatchResume) =>
			current.buyer === owner && (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId;
		try {
			if (!resume) {
				const prepared = await client.preparePurchaseBatch(
					requested.map(({ order, fillQuantity }) => ({
						processId: asset.id,
						order,
						fillQuantity,
						buyer: owner,
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
					owner
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
					processId: asset.id,
					order: current.order,
					fillQuantity: current.fillQuantity,
					buyer: owner,
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
					fungibleBatchStorageKey(asset.id, owner),
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
				processId: asset.id,
				order: entry.order,
				fillQuantity: entry.fillQuantity,
				buyer: owner,
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
							if ((await client.walletBalance(owner, signal)) < totalPaymentCost) {
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
								fungibleBatchStorageKey(asset.id, owner),
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
			fungibleBatchStorageKey(asset.id, owner),
			(current) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
			entries.flatMap((entry) => [entry.snapshot.registration?.id, entry.snapshot.payment?.id]),
			owner
		);
		if (claimRef.current) {
			releaseWalletOperationClaim(localStorage, claimRef.current);
			claimRef.current = null;
		}
		setPhase('done');
	}

	const visibleFills: OrderFill[] =
		operation.kind === 'buy'
			? operation.resume?.entries.map((entry) => ({
					sourceOrder: entry.order,
					order: filledOrder(entry.order, entry.fillQuantity),
					partial: entry.fillQuantity !== entry.order.quantity,
			  })) ?? matchedFills
			: [];
	const visibleOrders = visibleFills.map((fill) => fill.order);
	const activeOrder = visibleOrders.find((order) => order.orderId === activeOrderId) ?? visibleOrders[0];
	const activePurchase = activeOrder ? purchaseStates[activeOrder.orderId] : undefined;
	const observedOrderId = activeOrder?.orderId;
	React.useEffect(() => {
		const paymentId = activePurchase?.payment?.id;
		if (phase !== 'done' || operation.kind !== 'buy' || !visible || !observedOrderId || !paymentId) return;
		const network = networkRef.current?.network;
		if (!network) return;
		const watcher = continuePaymentConfirmations(network, paymentId, (observation) => {
			setPurchaseStates((current) => {
				const next = withContinuingPaymentObservation(current[observedOrderId] ?? null, paymentId, observation);
				return next ? { ...current, [observedOrderId]: next } : current;
			});
		});
		return () => watcher.stop();
	}, [activePurchase?.payment?.id, observedOrderId, operation.kind, phase, visible]);
	const recoverableBatch =
		operation.kind === 'buy' &&
		(operation.resume?.entries.some((entry) => hasRecoverablePurchase(entry.snapshot)) ||
			Object.values(purchaseStates).some((purchase) => hasRecoverablePurchase(purchase)));
	const completedPurchaseQuantity = visibleOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
	const outcomeTitle =
		operation.kind === 'buy'
			? 'Purchase complete'
			: operation.kind === 'sell'
			? 'Tokens listed'
			: operation.kind === 'cancel'
			? 'Listing cancelled'
			: 'Transfer complete';
	const outcomeDetail =
		operation.kind === 'buy'
			? `${tokenLabel(completedPurchaseQuantity.toString(), state)} received from ${visibleOrders.length} ${
					visibleOrders.length === 1 ? 'listing' : 'listings'
			  } · ${winstonToAr(
					visibleOrders.reduce((total, order) => total + BigInt(order.asking), 0n).toString()
			  )} AR paid to sellers.`
			: operation.kind === 'sell' && enteredQuantity && listingQuote
			? `${tokenLabel(enteredQuantity.toString(), state)} listed for ${listingQuote} AR.`
			: operation.kind === 'cancel'
			? `${tokenLabel(operation.order.quantity, state)} returned to your liquid balance.`
			: enteredQuantity
			? `${tokenLabel(enteredQuantity.toString(), state)} sent to ${transferRecipient}.`
			: 'The live token state now reflects this action.';
	const settlementSummary = batchSettlementSummary(visibleOrders.map((order) => purchaseStates[order.orderId]));
	const incompletePurchases = visibleOrders.length - settlementSummary.settled;
	const purchaseNeedsManualReview =
		visibleOrders.some((order) => purchaseSettlementNeedsManualReview(purchaseStates[order.orderId])) ||
		purchaseFailureMessageNeedsManualReview(message);
	const signedWork = Boolean(transaction || recoverableBatch);
	React.useEffect(() => {
		if (operation.kind !== 'buy' || phase !== 'working') return;
		const next = nextSettlementAnnouncement(
			settlementAnnouncementKeyRef.current,
			signedWork,
			visibleOrders.length,
			settlementSummary
		);
		if (!next) return;
		settlementAnnouncementKeyRef.current = next.key;
		setSettlementAnnouncement(next.message);
	}, [operation.kind, phase, settlementSummary.failed, settlementSummary.settled, signedWork, visibleOrders.length]);
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
					key: operation.kind,
					label: operationLabel(operation.kind),
					target: 5,
					terminal: true,
					confirmations,
					transaction: { id: transaction.id, views, ...(consensus ? { consensus } : {}) },
				},
		  ]
		: [];
	const closeOrHide = () => {
		const action = transactionDialogDismissAction(phase, Boolean(transaction || recoverableBatch));
		if (action.kind === 'close') {
			onClose(action.resumeLater, action.refresh);
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
			onHide();
		}, TRANSACTION_DIALOG_HIDE_DURATION_MS);
	};
	const dialogRef = useDialogFocus<HTMLDivElement>(visible, closeOrHide, undefined, phase, restoreFallback);
	React.useEffect(() => {
		if (visible) setHiding(false);
	}, [visible]);
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
		onRestart();
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
		const expectedAttemptId = operation.kind === 'buy' ? operation.resume?.attemptId : undefined;
		removeWalletRecoveryAndSignatures<BatchResume>(
			localStorage,
			fungibleBatchStorageKey(asset.id, owner),
			(current) => {
				if (current.buyer !== owner) return false;
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
			owner
		);
		onClose(false);
	};

	if (!visible && phase !== 'working') return null;
	const compactPurchaseForm = phase === 'form' && operation.kind === 'buy';
	return (
		<div
			className={`dialog-backdrop operation-panel-backdrop${hiding ? ' dialog-backdrop-hiding' : ''}`}
			hidden={!visible}
			onMouseDown={(event) => event.target === event.currentTarget && closeOrHide()}
			role="presentation"
		>
			<div
				className={`dialog operation-side-panel fungible-dialog${phase === 'form' ? ' dialog-form-phase' : ''}${
					compactPurchaseForm ? ' purchase-dialog' : ''
				}`}
				aria-hidden={visible ? undefined : true}
				aria-labelledby={
					visible ? (compactPurchaseForm ? dialogTitleId : `${operationLabelId} ${dialogTitleId}`) : undefined
				}
				aria-modal={visible ? true : undefined}
				ref={dialogRef}
				role={visible ? 'dialog' : undefined}
				tabIndex={-1}
			>
				<div className="dialog-heading">
					<div className={phase === 'working' ? 'dialog-asset-heading' : undefined}>
						{phase === 'working' ? (
							<TokenAvatar
								className="dialog-asset-artwork"
								image={asset.image}
								loading="eager"
								ticker={state.ticker || asset.ticker || asset.name}
							/>
						) : null}
						<div className="dialog-asset-heading-copy">
							{compactPurchaseForm ? (
								<h2 id={dialogTitleId}>Buy {asset.name}</h2>
							) : (
								<>
									<p className="eyebrow" id={operationLabelId}>
										{operationLabel(operation.kind)}
									</p>
									<h2 id={dialogTitleId}>{asset.name}</h2>
								</>
							)}
						</div>
					</div>
					<TransactionDialogControl hiding={hiding} phase={phase} onClick={closeOrHide} />
				</div>
				<OperationOutcomeAnnouncement active={phase === 'done'} title={outcomeTitle} detail={outcomeDetail} />
				{phase === 'approval' && operation.kind === 'buy' && operation.resume ? (
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
									{winstonToAr(
										visibleOrders
											.reduce((total, order) => total + BigInt(order.asking), 0n)
											.toString()
									)}{' '}
									<ArCurrencyLabel />
								</strong>
							</div>
							<div>
								<span>New approvals</span>
								<strong>{recoveryApprovalCount}</strong>
							</div>
						</div>
						<PurchaseRoute fills={visibleFills} state={state} />
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
							{operation.kind === 'sell' ? (
								<>
									<div className="trade-balance">
										<span>Available to list</span>
										<strong>{tokenLabel(liquidBalanceOf(state, owner), state)}</strong>
									</div>
									<div className="trade-fields">
										<label>
											Token quantity
											<input
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
											<input
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
												{tokenLabel((currentLiquid - enteredQuantity).toString(), state)} liquid
												· {tokenLabel((currentListed + enteredQuantity).toString(), state)}{' '}
												listed
											</strong>
										</div>
									) : null}
									{quantity && (enteredQuantity === null || enteredQuantity > currentLiquid) ? (
										<p id={quantityGuidanceId} className="trade-guidance" role="alert">
											Enter a quantity up to {tokenLabel(currentLiquid.toString(), state)}.
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
										Listed tokens move into order escrow after network confirmation. Network fees
										are shown by your wallet before signing.
									</p>
								</>
							) : null}
							{operation.kind === 'transfer' ? (
								<>
									<div className="trade-balance">
										<span>Available to send</span>
										<strong>{tokenLabel(liquidBalanceOf(state, owner), state)}</strong>
									</div>
									<label>
										Recipient wallet address
										<input
											aria-describedby={
												recipient && recipientError ? recipientGuidanceId : undefined
											}
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
										<input
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
											inputMode="decimal"
											value={quantity}
											onChange={(event) => setQuantity(event.target.value)}
											placeholder="100"
										/>
									</label>
									{quantity && (enteredQuantity === null || enteredQuantity > currentLiquid) ? (
										<p id={quantityGuidanceId} className="trade-guidance" role="alert">
											Enter a quantity up to {tokenLabel(currentLiquid.toString(), state)}.
										</p>
									) : null}
								</>
							) : null}
							{operation.kind === 'cancel' ? (
								<div className="cancel-summary">
									<CircleX aria-hidden="true" />
									<div>
										<strong>Return this listing to your balance?</strong>
										<span>
											{tokenLabel(operation.order.quantity, state)} ·{' '}
											{winstonToAr(operation.order.asking)} <ArCurrencyLabel /> total
										</span>
										<span>
											After network confirmation:{' '}
											{tokenLabel(
												(currentLiquid + BigInt(operation.order.quantity)).toString(),
												state
											)}{' '}
											liquid ·{' '}
											{tokenLabel(
												(currentListed - BigInt(operation.order.quantity)).toString(),
												state
											)}{' '}
											listed
										</span>
										<span>
											A reserved listing cannot be cancelled. This listing is currently open.
										</span>
									</div>
								</div>
							) : null}
							{operation.kind === 'buy' ? (
								<>
									{matchedOrders.length ? (
										<section
											aria-busy={quoteState === 'loading'}
											className="purchase-confirmation"
											aria-label="Purchase summary"
										>
											<div className="purchase-confirmation-amount">
												<span>You receive</span>
												<strong>{tokenLabel(matchedQuantity.toString(), state)}</strong>
											</div>
											<dl className="purchase-confirmation-facts">
												<div>
													<dt>Seller total</dt>
													<dd>
														{winstonToAr(matchedAsking.toString())} <ArCurrencyLabel />
													</dd>
												</div>
												<div>
													<dt>Network fees</dt>
													<dd>
														{quoteState === 'error' ? (
															'Unavailable'
														) : estimatedCost ? (
															<ArCurrencyText>{`${winstonToAr(
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
															<ArCurrencyText>{`${winstonToAr(
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
															<ArCurrencyText>{`${winstonToAr(
																(
																	BigInt(estimatedWalletBalance) -
																	BigInt(estimatedCost)
																).toString()
															)} AR`}</ArCurrencyText>
														) : (
															'Checking…'
														)}
													</dd>
												</div>
											</dl>
											<p className="purchase-confirmation-meta">
												{matchedOrders.length} {matchedOrders.length === 1 ? 'order' : 'orders'}{' '}
												· {matchedSellers} {matchedSellers === 1 ? 'seller' : 'sellers'} ·{' '}
												{matchedOrders.length * 2} wallet approvals
											</p>
										</section>
									) : null}
									{matchedOrders.length ? (
										<p id={quoteStatusId} className="sr-only" aria-live="polite" role="status">
											<ArCurrencyText>
												{quoteState === 'ready' && estimatedCost
													? `Purchase quote ready. Maximum total ${winstonToAr(
															estimatedCost
													  )} AR.${canAfford ? '' : ' This wallet has insufficient AR.'}`
													: quoteState === 'error'
													? 'Purchase quote unavailable. Retry the cost check before buying.'
													: 'Checking the wallet balance and network fees.'}
											</ArCurrencyText>
										</p>
									) : null}
									{matchedOrders.length ? (
										quoteState === 'error' ? (
											<div className="inline-error retry-notice" role="status">
												<span>Compute hasn’t completed yet. Please try again.</span>
												<Button
													aria-describedby={quoteStatusId}
													className="with-icon"
													onClick={() => setQuoteRetry((value) => value + 1)}
													type="button"
													size="custom"
												>
													<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
													Retry
												</Button>
											</div>
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
									operation.kind === 'buy' || operation.kind === 'sell'
										? ' with-icon market-primary-action'
										: ''
								}`}
								data-dialog-initial
								aria-label={
									operation.kind === 'transfer' && enteredQuantity && transferValid
										? fungibleTransferSubmitLabel(
												enteredQuantity.toString(),
												state,
												transferRecipient,
												true
										  )
										: undefined
								}
								aria-describedby={
									operation.kind === 'buy' && matchedOrders.length ? quoteStatusId : undefined
								}
								disabled={
									(operation.kind === 'buy' &&
										(!matchedOrders.length || !estimatedCost || canAfford !== true)) ||
									(operation.kind === 'sell' && !sellValid) ||
									(operation.kind === 'transfer' && !transferValid)
								}
								size="custom"
								type="submit"
								variant={operation.kind === 'cancel' ? 'danger' : 'primary'}
							>
								{operation.kind === 'buy' ? (
									<ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" />
								) : operation.kind === 'sell' ? (
									<Tag className="ui-icon ui-icon--sm" aria-hidden="true" />
								) : null}
								<ArCurrencyText>
									{operation.kind === 'buy' && matchedOrders.length
										? `Buy ${tokenLabel(matchedQuantity.toString(), state)} · ${
												estimatedCost
													? `${winstonToAr(estimatedCost)} AR max`
													: 'checking total…'
										  }`
										: operation.kind === 'sell' && listingQuote && enteredQuantity
										? `List ${tokenLabel(enteredQuantity.toString(), state)} for ${listingQuote} AR`
										: operation.kind === 'cancel'
										? `Cancel listing and return ${tokenLabel(operation.order.quantity, state)}`
										: operation.kind === 'transfer' && enteredQuantity
										? fungibleTransferSubmitLabel(
												enteredQuantity.toString(),
												state,
												transferRecipient
										  )
										: operationLabel(operation.kind)}
								</ArCurrencyText>
							</Button>
						</div>
					</form>
				) : null}
				{phase === 'working' ? (
					<div className="operation-working">
						{operation.kind === 'buy' ? (
							<p className="sr-only" aria-live="polite" role="status">
								{settlementAnnouncement}
							</p>
						) : (
							<p className="sr-only" aria-live="polite" role="status">
								{message ||
									(signedWork
										? 'Watching this transaction.'
										: 'Preparing the transaction for wallet approval.')}
							</p>
						)}
						{operation.kind === 'buy' && visibleOrders.length ? (
							<FungiblePurchaseSequence
								listingCount={visibleOrders.length}
								states={visibleOrders.map((order) => purchaseStates[order.orderId])}
							/>
						) : null}
						{signedWork && operation.kind !== 'buy' ? (
							<p className="sync-resume-note">
								Transaction details are saved in this browser. Return with the same wallet to continue
								while this browser data remains available.
							</p>
						) : null}
						{message ? <p className="scheduler-wait">{message}</p> : null}
						{operation.kind === 'buy' && activePurchase ? (
							<p className="scheduler-wait">{purchaseLifecycleStatus(activePurchase)}</p>
						) : null}
						{operation.kind === 'buy' && visibleOrders.length ? (
							activeOrder && activePurchase ? (
								<ArweaveTransactionSync
									active={visible}
									skipKind={purchaseSkipKind(activePurchase)}
									onSkip={
										activePurchase.canSkip
											? () => {
													purchasesRef.current.get(activeOrder.orderId)?.skip();
											  }
											: undefined
									}
									subject={`${asset.name} · ${tokenLabel(activeOrder.quantity, state)}`}
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
								active={visible}
								subject={asset.name}
								startedAt={submittedAtRef.current}
								steps={singleSteps}
								activeStep={operation.kind}
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
								operation.kind === 'buy'
									? `Confirmations: ${quorumConfirmationDepth(
											purchaseSteps.find((step) => step.key === 'pay')
									  )}`
									: undefined
							}
						>
							{operation.kind === 'buy' && purchaseSteps.length ? (
								<div className="result-outcome-sync">
									<ArweaveTransactionSync
										active={visible}
										activeStep="pay"
										startedAt={submittedAtRef.current}
										steps={purchaseSteps}
										subject={`${asset.name} · ${tokenLabel(activeOrder?.quantity ?? '0', state)}`}
									/>
								</div>
							) : null}
							{operation.kind === 'buy' || operation.kind === 'sell' ? (
								<OperationOutcomeSubject
									label={operation.kind === 'buy' ? 'You received' : 'You listed'}
									title={
										operation.kind === 'buy'
											? tokenLabel(completedPurchaseQuantity.toString(), state)
											: enteredQuantity
											? tokenLabel(enteredQuantity.toString(), state)
											: asset.name
									}
									detail={
										operation.kind === 'sell' && listingQuote
											? `${listingQuote} AR total`
											: asset.name
									}
									media={
										<TokenAvatar
											className="operation-outcome-token-avatar"
											image={asset.image}
											loading="eager"
											ticker={state.ticker || asset.ticker || asset.name}
										/>
									}
								/>
							) : null}
						</OperationOutcome>
						{transaction && operation.kind !== 'transfer' ? (
							<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
								<OperationExternalLink>View transaction {short(transaction.id)}</OperationExternalLink>
							</a>
						) : null}
						{operation.kind === 'buy' ? (
							<FungiblePurchaseReceiptNavigator
								activeOrderId={activeOrder?.orderId}
								onSelect={setActiveOrderId}
								orders={visibleOrders}
								purchaseStates={purchaseStates}
								state={state}
							/>
						) : operation.kind === 'transfer' && transaction && enteredQuantity ? (
							<div className="settlement-receipt">
								<div>
									<span>Quantity</span>
									<strong>{tokenLabel(enteredQuantity.toString(), state)}</strong>
								</div>
								<div>
									<span>Recipient</span>
									<WalletAddress address={transferRecipient} full label="recipient" />
								</div>
								<div className="settlement-receipt-links">
									<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
										<OperationExternalLink>
											Transaction {short(transaction.id)}
										</OperationExternalLink>
									</a>
								</div>
							</div>
						) : null}
						<Button
							className="with-icon"
							data-dialog-initial
							onClick={() => onClose(false)}
							size="custom"
							variant="primary"
						>
							<ArrowLeft className="ui-icon ui-icon--sm" /> View updated token
						</Button>
					</div>
				) : null}
				{phase === 'error' ? (
					<div className="result error">
						<FungibleOperationErrorAlert message={message} />
						{operation.kind === 'buy' && visibleOrders.length ? (
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
												<strong>{tokenLabel(order.quantity, state)}</strong>
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
							<Button data-dialog-initial onClick={() => onClose(false)} size="custom">
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
												operationStorageKey(asset.id, owner),
												(record) => record?.txId === transaction.id,
												[transaction.id],
												owner
											);
											if (!discarded) {
												setMessage(
													'This saved transfer changed in another tab. Close this panel and review the active action.'
												);
												return;
											}
											setTransaction(null);
											onClose(false, false);
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
										operationStorageKey(asset.id, owner),
										(record) => record?.txId === transaction.id
									);
									localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
									onClose(false);
								}}
								variant="danger"
							>
								Discard rejected signature and sign again
							</Button>
						) : operation.kind === 'buy' ? (
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
			</div>
		</div>
	);
}

export function FungibleOperationErrorAlert({ message }: { message: string }) {
	return <OperationErrorAlert title="Could not complete this action" message={message} />;
}

export function MatchedListingsReview({
	onRemove,
	orders,
	state,
}: {
	onRemove?(order: SwapOrder): void;
	orders: SwapOrder[];
	state: AssetState;
}) {
	return (
		<section aria-label="Purchase overview" className="matched-listings">
			<div className="matched-listings-heading">
				<strong>Purchase overview</strong>
				<span>
					{orders.length} {orders.length === 1 ? 'listing' : 'listings'}
				</span>
			</div>
			{orders.length ? (
				<ul aria-label="Matched seller addresses" tabIndex={orders.length > 4 ? 0 : undefined}>
					{orders.map((order) => (
						<li key={order.orderId}>
							<span>
								<strong>{tokenLabel(order.quantity, state)}</strong>
								<small>
									<ArCurrencyText>
										{`${orderPriceLabel(order, state)} · ${winstonToAr(order.asking)} AR total`}
									</ArCurrencyText>
								</small>
							</span>
							<WalletIdentity address={order.creator} />
							{onRemove ? (
								<Button
									aria-label={`Remove ${fungibleListingAccessibleLabel(order, state)} from purchase`}
									onClick={() => onRemove(order)}
									size="custom"
									type="button"
									variant="danger"
								>
									Remove
								</Button>
							) : null}
						</li>
					))}
				</ul>
			) : (
				<p className="matched-listings-empty">Your purchase overview is empty.</p>
			)}
		</section>
	);
}

export function purchaseAmountMatch(orders: SwapOrder[], quantity: string, state: AssetState) {
	if (!quantity.trim()) return { match: null, error: '' };
	try {
		const atomic = parseTokenAmount(quantity, state.denomination);
		const match = matchSortedOrderFills(orders, atomic);
		return {
			match,
			error: match
				? ''
				: `Only ${tokenLabel(
						orders.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
						state
				  )} is currently available.`,
		};
	} catch (cause) {
		return {
			match: null,
			error:
				cause instanceof RangeError
					? 'This order book is too large to quote safely. Refresh and try again.'
					: `Enter a valid ${formatTickerLabel(state.ticker)} amount using no more than ${
							state.denomination
					  } decimal places.`,
		};
	}
}

export function FungiblePurchaseComposer({
	availableQuantity,
	excludedQuantity = '0',
	error,
	match,
	onChange,
	onMax,
	quantity,
	state,
}: {
	availableQuantity: string;
	excludedQuantity?: string;
	error: string;
	match: ReturnType<typeof matchOrderFills>;
	onChange(quantity: string): void;
	onMax(): void;
	quantity: string;
	state: AssetState;
}) {
	const ticker = state.ticker || 'Token';
	const tickerDisplay = formatTickerLabel(ticker);
	const matchedSellerCount = match ? new Set(match.fills.map((fill) => fill.order.creator)).size : 0;
	const inputId = React.useId();
	const guidanceId = React.useId();
	const errorId = React.useId();

	return (
		<section aria-label="Choose purchase amount" className="purchase-composer">
			<div className="purchase-composer-panel purchase-composer-buy">
				<div className="purchase-composer-heading">
					<label htmlFor={inputId}>You buy</label>
					<Button onClick={onMax} type="button" size="custom">
						Max
					</Button>
				</div>
				<div className="purchase-composer-value">
					<input
						aria-describedby={`${guidanceId}${error ? ` ${errorId}` : ''}`}
						aria-invalid={Boolean(error)}
						id={inputId}
						inputMode="decimal"
						onChange={(event) => onChange(event.target.value)}
						placeholder="0"
						value={quantity}
					/>
					<span className="purchase-composer-token">{tickerDisplay}</span>
				</div>
				<small id={guidanceId}>
					{tokenLabel(availableQuantity, state)} available to buy
					{BigInt(excludedQuantity) > 0n
						? ` · ${tokenLabel(excludedQuantity, state)} from your listing excluded`
						: ''}
				</small>
			</div>
			<div className="purchase-composer-panel purchase-composer-pay" aria-live="polite">
				<span className="purchase-composer-direction" aria-hidden="true">
					<ArrowDown />
				</span>
				<div className="purchase-composer-heading">
					<span>You pay</span>
					<span>Seller total</span>
				</div>
				<div className="purchase-composer-value">
					<strong>{match ? winstonToAr(match.totalAsking) : '0'}</strong>
					<span className="purchase-composer-token">
						<ArCurrencyLabel />
					</span>
				</div>
				<small>
					{match
						? `${match.fills.length} ${
								match.fills.length === 1 ? 'order' : 'orders'
						  } · ${matchedSellerCount} ${
								matchedSellerCount === 1 ? 'seller' : 'sellers'
						  } · network fees shown in review`
						: 'Enter an amount to see the seller payment.'}
				</small>
			</div>
			{error ? (
				<p className="purchase-composer-error" id={errorId} role="alert">
					{error}
				</p>
			) : null}
		</section>
	);
}

export function FungibleListingComposer({
	availableQuantity,
	onMax,
	onQuantityChange,
	onUnitPriceChange,
	quantity,
	quantityError,
	state,
	total,
	unitPrice,
	unitPriceError,
}: {
	availableQuantity: string;
	onMax(): void;
	onQuantityChange(quantity: string): void;
	onUnitPriceChange(unitPrice: string): void;
	quantity: string;
	quantityError: string;
	state: AssetState;
	total: string | null;
	unitPrice: string;
	unitPriceError: string;
}) {
	const ticker = state.ticker || 'Token';
	const tickerDisplay = formatTickerLabel(ticker);
	const quantityId = React.useId();
	const quantityGuidanceId = React.useId();
	const quantityErrorId = React.useId();
	const unitPriceId = React.useId();
	const priceGuidanceId = React.useId();
	const priceErrorId = React.useId();

	return (
		<section aria-label="Create listing" className="purchase-composer">
			<div className="purchase-composer-panel purchase-composer-buy">
				<div className="purchase-composer-heading">
					<label htmlFor={quantityId}>You list</label>
					<Button onClick={onMax} type="button" size="custom">
						Max
					</Button>
				</div>
				<div className="purchase-composer-value">
					<input
						aria-describedby={`${quantityGuidanceId}${quantityError ? ` ${quantityErrorId}` : ''}`}
						aria-invalid={Boolean(quantityError)}
						id={quantityId}
						inputMode="decimal"
						onChange={(event) => onQuantityChange(event.target.value)}
						placeholder="0"
						value={quantity}
					/>
					<span className="purchase-composer-token">{tickerDisplay}</span>
				</div>
				<small id={quantityGuidanceId}>{tokenLabel(availableQuantity, state)} available</small>
			</div>
			<div className="purchase-composer-panel purchase-composer-pay">
				<span className="purchase-composer-direction" aria-hidden="true">
					<ArrowDown />
				</span>
				<div className="purchase-composer-heading">
					<label htmlFor={unitPriceId}>Unit price</label>
					<span>{total ? <ArCurrencyText>{`${total} AR total`}</ArCurrencyText> : 'Listing total'}</span>
				</div>
				<div className="purchase-composer-value">
					<input
						aria-describedby={`${priceGuidanceId}${unitPriceError ? ` ${priceErrorId}` : ''}`}
						aria-invalid={Boolean(unitPriceError)}
						id={unitPriceId}
						inputMode="decimal"
						onChange={(event) => onUnitPriceChange(event.target.value)}
						placeholder="0"
						value={unitPrice}
					/>
					<span className="purchase-composer-token">
						<ArCurrencyLabel />
					</span>
				</div>
				<small id={priceGuidanceId}>Price per {tickerDisplay}; network fees are shown in review.</small>
			</div>
			{quantityError ? (
				<p className="purchase-composer-error" id={quantityErrorId} role="alert">
					{quantityError}
				</p>
			) : null}
			{unitPriceError ? (
				<p className="purchase-composer-error" id={priceErrorId} role="alert">
					<ArCurrencyText>{unitPriceError}</ArCurrencyText>
				</p>
			) : null}
		</section>
	);
}

export function PurchaseRoute({ fills, state }: { fills: OrderFill[]; state: AssetState }) {
	return (
		<details className="purchase-route" open={fills.length === 1}>
			<summary>
				<span>Purchase route</span>
				<strong>{fills.length === 1 ? '1 order' : `View ${fills.length} orders`}</strong>
			</summary>
			<ul aria-label="Purchase execution route" tabIndex={0}>
				{fills.map(({ order, sourceOrder, partial }, index) => (
					<li key={order.orderId}>
						<span className="purchase-route-index">{index + 1}</span>
						<span className="purchase-route-fill">
							<strong>{tokenLabel(order.quantity, state)}</strong>
							<small>
								<ArCurrencyText>{orderPriceLabel(order, state)}</ArCurrencyText>
								{partial
									? ` · ${tokenLabel(order.quantity, state)} of ${tokenLabel(
											sourceOrder.quantity,
											state
									  )} from this listing`
									: ' · full order'}
							</small>
						</span>
						<span className="purchase-route-total">
							{winstonToAr(order.asking)} <ArCurrencyLabel />
						</span>
						<WalletAddress address={order.creator} label="seller" />
					</li>
				))}
			</ul>
		</details>
	);
}

export function FungiblePurchaseReceiptNavigator({
	activeOrderId,
	onSelect,
	orders,
	purchaseStates,
	state,
}: {
	activeOrderId?: string;
	onSelect(orderId: string): void;
	orders: SwapOrder[];
	purchaseStates: Record<string, PurchaseState>;
	state: AssetState;
}) {
	if (!orders.length) return null;
	const activeIndex = Math.max(
		0,
		orders.findIndex((order) => order.orderId === activeOrderId)
	);
	const order = orders[activeIndex];
	const settled = purchaseStates[order.orderId];
	const receiptOptions = fungiblePurchaseReceiptOptions(orders, state);
	return (
		<div className="settlement-receipts">
			<div className={`settlement-receipt-navigation${orders.length === 1 ? ' single' : ''}`}>
				<div>
					<strong>Settlement receipt</strong>
					{orders.length > 1 ? (
						<MarketSelect
							label="Choose settlement receipt"
							onChange={onSelect}
							options={receiptOptions}
							showLabel={false}
							value={order.orderId}
						/>
					) : null}
				</div>
				<span aria-live="polite" className="settlement-receipt-count">
					{activeIndex + 1} of {orders.length}
				</span>
			</div>
			<section
				aria-label={`Settlement receipt ${activeIndex + 1} of ${orders.length}`}
				className="settlement-receipt purchase-settlement-receipt"
			>
				<div className="settlement-receipt-amount">
					<span>Listing {activeIndex + 1}</span>
					<strong>{tokenLabel(order.quantity, state)}</strong>
				</div>
				<dl className="settlement-receipt-facts">
					<div>
						<dt>Seller</dt>
						<dd>
							<WalletAddress address={order.creator} label="seller" />
						</dd>
					</div>
					<div>
						<dt>Order</dt>
						<dd>
							<Tooltip content={order.orderId} placement="top">
								{(tooltipId) => <span aria-describedby={tooltipId}>{short(order.orderId)}</span>}
							</Tooltip>
						</dd>
					</div>
					<div>
						<dt>Seller payment</dt>
						<dd>
							{winstonToAr(order.asking)} <ArCurrencyLabel />
						</dd>
					</div>
				</dl>
				<div className="settlement-receipt-links receipt-proof-links">
					{settled?.registration?.id ? (
						<a
							aria-label={`View reservation ${settled.registration.id}`}
							href={transactionExplorerUrl(settled.registration.id)}
							rel="noreferrer"
							target="_blank"
						>
							<span>Reservation</span>
							<strong>{short(settled.registration.id)}</strong>
							<ArrowUpRight aria-hidden="true" className="ui-icon ui-icon--xs" />
						</a>
					) : null}
					{settled?.payment?.id ? (
						<a
							aria-label={`View payment ${settled.payment.id}`}
							href={transactionExplorerUrl(settled.payment.id)}
							rel="noreferrer"
							target="_blank"
						>
							<span>Payment</span>
							<strong>{short(settled.payment.id)}</strong>
							<ArrowUpRight aria-hidden="true" className="ui-icon ui-icon--xs" />
						</a>
					) : null}
				</div>
			</section>
			{orders.length > 1 ? (
				<div className="settlement-receipt-paging">
					<Button
						aria-disabled={activeIndex === 0}
						onClick={() => {
							if (activeIndex > 0) onSelect(orders[activeIndex - 1].orderId);
						}}
						type="button"
						size="custom"
					>
						Previous receipt
					</Button>
					<Button
						aria-disabled={activeIndex === orders.length - 1}
						onClick={() => {
							if (activeIndex < orders.length - 1) onSelect(orders[activeIndex + 1].orderId);
						}}
						type="button"
						size="custom"
					>
						Next receipt
					</Button>
				</div>
			) : null}
		</div>
	);
}

export function fungiblePurchaseReceiptOptions(orders: SwapOrder[], state: AssetState) {
	return orders.map((order, index) => ({
		value: order.orderId,
		label: `Listing ${index + 1} · ${tokenLabel(order.quantity, state)} · ${short(order.creator)}`,
	}));
}

export function FungibleSettlementRecoveryPanel({
	children,
	orderId,
	settled = false,
}: {
	children?: React.ReactNode;
	orderId: string;
	settled?: boolean;
}) {
	return (
		<section
			aria-labelledby={`settlement-error-tab-${orderId}`}
			className={`settlement-error-detail${settled ? ' settlement-success-detail' : ''}`}
			id={SETTLEMENT_ERROR_PANEL_ID}
			role="tabpanel"
			tabIndex={0}
		>
			{children}
		</section>
	);
}

function preparedEntry(prepared: PreparedPurchase): BatchEntry {
	return {
		order: prepared.order,
		fillQuantity: prepared.fillQuantity,
		snapshot: prepared.snapshot,
		paymentCost: prepared.paymentCost,
	};
}

export function checkpointBatchPreparation(entries: BatchEntry[], event: PurchaseBatchPreparationEvent): BatchEntry[] {
	if (event.type === 'quoted') {
		return event.entries.map((entry) => ({ ...entry, snapshot: {} }));
	}
	let matched = false;
	const next = entries.map((entry) => {
		if (entry.order.orderId !== event.orderId) return entry;
		matched = true;
		return {
			...entry,
			...(event.kind === 'payment' ? { paymentCost: event.cost } : {}),
			snapshot: {
				...entry.snapshot,
				[event.kind]: { id: event.transactionId, dispatched: false },
			},
		};
	});
	if (!matched) throw new Error('purchase-preparation-checkpoint-missing');
	return next;
}

export function batchPaymentBarrierState(entries: Array<Pick<BatchEntry, 'snapshot' | 'paymentCost'>>) {
	return entries.reduce(
		(state, entry) =>
			entry.snapshot.payment?.dispatched
				? { ...state, registrationsReady: state.registrationsReady + 1 }
				: { ...state, pendingPaymentCost: state.pendingPaymentCost + BigInt(entry.paymentCost) },
		{ registrationsReady: 0, pendingPaymentCost: 0n }
	);
}

export function batchRecoveryIdentity(entries: Array<Pick<BatchEntry, 'order' | 'fillQuantity' | 'snapshot'>>) {
	return entries
		.map(
			({ order, fillQuantity, snapshot }) =>
				`${order.orderId}:${fillQuantity}:${snapshot.registration?.id ?? ''}:${snapshot.payment?.id ?? ''}`
		)
		.join('|');
}

export function purchaseQuoteIdentity(orders: SwapOrder[]) {
	return orders
		.map((order) => `${order.orderId}:${order.quantity}:${order.asking}:${order.minimumFee}:${order.recipient}`)
		.join('|');
}

export function batchPurchaseStartingBalance(
	resume: Pick<BatchResume, 'startingBalance'> | undefined,
	freshState: AssetState | undefined,
	buyer: string,
	renderedBalance: string
) {
	if (resume) return resume.startingBalance;
	return freshState ? liquidBalanceOf(freshState, buyer) : renderedBalance;
}

export function fungibleBatchRecoveryStatus(
	resume: Pick<BatchResume, 'entries'>,
	state: AssetState,
	buyer: string
): 'resumable' | 'blocked' {
	return resume.entries.every((entry) => {
		// A payment leg must resume its exact historical proof even if the buyer
		// later transfers the purchased units and current balance returns to zero.
		if (entry.snapshot.payment?.id) return true;
		const order = state.orders[entry.order.orderId];
		const fill = filledOrder(entry.order, entry.fillQuantity);
		const expected = order?.status === 'reserved' ? fill : entry.order;
		return Boolean(
			order &&
				order.creator === expected.creator &&
				order.recipient === expected.recipient &&
				order.asking === expected.asking &&
				order.deposit === expected.deposit &&
				order.minimumFee === expected.minimumFee &&
				order.deadline === expected.deadline &&
				order.createdAt === expected.createdAt &&
				order.quantity === expected.quantity &&
				(order.status === 'open' || (order.status === 'reserved' && order.buyer === buyer))
		);
	})
		? 'resumable'
		: 'blocked';
}

export function isRecoverableBatch(record: unknown, buyer: string): record is BatchResume {
	if (!record || typeof record !== 'object') return false;
	const candidate = record as Partial<BatchResume>;
	if (
		candidate.version !== 3 ||
		candidate.buyer !== buyer ||
		!/^\d+$/.test(candidate.startingBalance ?? '') ||
		!Array.isArray(candidate.entries) ||
		candidate.entries.length === 0
	) {
		return false;
	}
	return candidate.entries.every((entry) =>
		Boolean(
			entry &&
				ADDRESS.test(entry.order?.orderId ?? '') &&
				/^\d+$/.test(entry.order?.quantity ?? '') &&
				/^\d+$/.test(entry.order?.asking ?? '') &&
				/^[1-9]\d*$/.test(entry.fillQuantity ?? '') &&
				BigInt(entry.fillQuantity) <= BigInt(entry.order.quantity) &&
				/^\d+$/.test(entry.paymentCost ?? '') &&
				(hasRecoverablePurchase(entry.snapshot) || (!entry.snapshot.registration && !entry.snapshot.payment))
		)
	);
}

export function batchPurchaseRecoveryApprovalCount(entries: Array<Pick<BatchEntry, 'snapshot'>>) {
	return entries.reduce((total, entry) => total + purchaseRecoveryApprovalCount(entry.snapshot), 0);
}

export function batchPurchaseRecoveryApprovalCopy(entries: Array<Pick<BatchEntry, 'snapshot'>>) {
	const approvals = batchPurchaseRecoveryApprovalCount(entries);
	const transactionCount = entries.length * 2;
	const recovered = transactionCount - approvals;
	const dispatchedPayments = entries.filter((entry) => entry.snapshot.payment?.dispatched === true).length;
	const paymentDetail = dispatchedPayments
		? `${dispatchedPayments} seller ${
				dispatchedPayments === 1 ? 'payment has' : 'payments have'
		  } already been submitted and will only be monitored; Bazar will not replace them.`
		: 'No seller payment has been submitted. Signed seller payments remain held until every reservation is accepted.';
	return {
		title: `${approvals} missing transaction ${approvals === 1 ? 'approval' : 'approvals'} needed to resume`,
		detail: `Bazar recovered ${recovered} of ${transactionCount} signed transactions and will reuse those exact transactions. Your wallet will be asked only for the ${approvals} missing ${
			approvals === 1 ? 'approval' : 'approvals'
		}. ${paymentDetail} Nothing new will be signed or submitted until you choose Continue.`,
		action: `Approve ${approvals} missing ${approvals === 1 ? 'transaction' : 'transactions'} and continue`,
	};
}

export function batchHasNoDispatchedSellerPayment(resume: Pick<BatchResume, 'entries'>) {
	return resume.entries.every((entry) => entry.snapshot.payment?.dispatched !== true);
}

export function latestRecoverableSnapshot(current: PurchaseSnapshot, next: PurchaseSnapshot) {
	if (!hasRecoverablePurchase(next)) return current;
	const candidate =
		current.registration?.id === next.registration?.id
			? {
					registration: {
						id: next.registration!.id,
						dispatched: Boolean(current.registration?.dispatched || next.registration?.dispatched),
					},
					...(next.payment
						? {
								payment:
									next.payment.id === current.payment?.id
										? {
												id: next.payment.id,
												dispatched: Boolean(
													current.payment.dispatched || next.payment.dispatched
												),
										  }
										: next.payment,
						  }
						: current.payment
						? { payment: current.payment }
						: {}),
					...(current.dismissed || next.dismissed ? { dismissed: true } : {}),
			  }
			: next;
	return equalPurchaseSnapshots(current, candidate) ? current : candidate;
}

export function purchaseStateFrameBuffer(
	commit: (updates: Record<string, PurchaseState>) => void,
	schedule: (callback: () => void) => number = (callback) => window.requestAnimationFrame(callback),
	cancel: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle)
) {
	let scheduled: number | null = null;
	let pending: Record<string, PurchaseState> = {};
	const flush = () => {
		if (scheduled !== null) cancel(scheduled);
		scheduled = null;
		if (!Object.keys(pending).length) return;
		const updates = pending;
		pending = {};
		commit(updates);
	};
	return {
		push(orderId: string, state: PurchaseState) {
			pending[orderId] = state;
			if (scheduled !== null) return;
			scheduled = schedule(() => {
				scheduled = null;
				flush();
			});
		},
		flush,
		clear() {
			if (scheduled !== null) cancel(scheduled);
			scheduled = null;
			pending = {};
		},
	};
}

export function batchRecoveryFrameBuffer(
	persist: () => void,
	scheduleFrame: (callback: () => void) => number = (callback) => window.requestAnimationFrame(callback),
	cancelFrame: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle)
) {
	let scheduled: number | null = null;
	let dirty = false;
	const persistDirty = () => {
		if (!dirty) return;
		dirty = false;
		persist();
	};
	return {
		schedule() {
			dirty = true;
			if (scheduled !== null) return;
			scheduled = scheduleFrame(() => {
				scheduled = null;
				persistDirty();
			});
		},
		flush(force = false) {
			if (scheduled !== null) cancelFrame(scheduled);
			scheduled = null;
			if (force && !dirty) persist();
			else persistDirty();
		},
		clear() {
			if (scheduled !== null) cancelFrame(scheduled);
			scheduled = null;
			dirty = false;
		},
	};
}

export function visibleOrderbookRows<T>(orders: T[], limit: number) {
	return orders.slice(0, Math.max(0, limit));
}

/**
 * Build the one-sided sell-depth contour shown behind the ask rows. Reserved
 * listings stay visible in the table but do not add purchasable market depth.
 */
export function orderbookCumulativeDepths(orders: ReadonlyArray<Pick<SwapOrder, 'quantity' | 'status'>>) {
	const total = orders.reduce((sum, order) => (order.status === 'open' ? sum + BigInt(order.quantity) : sum), 0n);
	if (total === 0n) return orders.map(() => 0);

	let cumulative = 0n;
	return orders.map((order) => {
		if (order.status === 'open') cumulative += BigInt(order.quantity);
		return Number((cumulative * 10_000n) / total) / 100;
	});
}

function equalPurchaseSnapshots(left: PurchaseSnapshot, right: PurchaseSnapshot) {
	return (
		left.registration?.id === right.registration?.id &&
		left.registration?.dispatched === right.registration?.dispatched &&
		left.payment?.id === right.payment?.id &&
		left.payment?.dispatched === right.payment?.dispatched &&
		left.dismissed === right.dismissed
	);
}

export function storeBatchRecoveryBeforeDispatch(
	storage: Pick<Storage, 'getItem' | 'setItem'>,
	key: string,
	record: BatchResume,
	signal: AbortSignal
) {
	const attemptId = record.attemptId ?? batchRecoveryIdentity(record.entries);
	record.attemptId = attemptId;
	storeWalletRecordOrThrow(
		storage,
		key,
		record,
		(current: BatchResume) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
		true
	);
	if (signal.aborted) throw signal.reason;
}

export async function waitForSettlementBatch(running: Promise<PurchaseState>[]): Promise<PurchaseState[]> {
	const settled = await Promise.allSettled(running);
	const failed = settled.filter(
		(result) => result.status === 'rejected' || result.value.stage !== 'complete' || !result.value.success
	);
	if (failed.length) {
		const reasons = [
			...new Set(
				failed.flatMap((result) => {
					if (result.status === 'rejected') {
						return [result.reason instanceof Error ? result.reason.message : String(result.reason)];
					}
					return result.value.error?.message ? [result.value.error.message] : [];
				})
			),
		];
		throw new Error(
			`${failed.length} of ${settled.length} settlements need attention.${
				reasons.length ? ` ${reasons.join(' ')}` : ''
			}`
		);
	}
	return settled.map((result) => (result as PromiseFulfilledResult<PurchaseState>).value);
}

export function settlementTabIndex(key: string, current: number, count: number): number | null {
	if (count < 1) return null;
	if (key === 'Home') return 0;
	if (key === 'End') return count - 1;
	if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
	if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
	return null;
}

export function batchSettlementSummary(states: Array<PurchaseState | undefined>) {
	const settled = states.filter((state) => state?.stage === 'complete').length;
	const failed = states.filter((state) => state?.stage === 'failed').length;
	const paying = states.filter((state) => {
		const stage = state?.stage ?? '';
		return stage.includes('payment') || stage === 'ownership-verifying';
	}).length;
	const reserving = states.length - settled - failed - paying;
	return {
		settled,
		failed,
		paying,
		reserving,
		label: `${states.length} listings · ${settled} settled${
			failed ? ` · ${failed} needs attention` : ''
		} · ${paying} paying · ${reserving} reserving`,
	};
}

export function nextSettlementAnnouncement(
	previousKey: string,
	signedWork: boolean,
	total: number,
	summary: Pick<ReturnType<typeof batchSettlementSummary>, 'failed' | 'settled'>
): { key: string; message: string } | null {
	if (total < 1) return null;
	let next: { key: string; message: string };
	if (!signedWork) {
		next = {
			key: `preparing:${total}`,
			message: `Preparing wallet approvals for ${total} ${total === 1 ? 'listing' : 'listings'}.`,
		};
	} else if (summary.failed) {
		if (previousKey.startsWith('attention:')) return null;
		next = {
			key: `attention:${total}`,
			message: `A settlement needs attention. ${summary.settled} of ${total} settled; the others continue independently.`,
		};
	} else if (summary.settled >= total) {
		next = {
			key: `complete:${total}`,
			message: total === 1 ? 'The settlement is complete.' : `All ${total} settlements are complete.`,
		};
	} else {
		const quarter = Math.floor((summary.settled * 4) / total);
		if (quarter > 0) {
			const threshold = Math.ceil((total * Math.min(quarter, 3)) / 4);
			next = {
				key: `progress:${Math.min(quarter, 3)}:${total}`,
				message: `${threshold} of ${total} settlements complete.`,
			};
		} else {
			next = {
				key: `watching:${total}`,
				message: `Watching ${total} parallel ${total === 1 ? 'settlement' : 'settlements'}.`,
			};
		}
	}
	return next.key === previousKey ? null : next;
}

function lotAsking(rawQuantity: string, unitPrice: string, denomination: number): string {
	const price = BigInt(arToWinston(unitPrice));
	const quantity = BigInt(rawQuantity);
	const scale = 10n ** BigInt(denomination);
	return ((price * quantity + scale - 1n) / scale).toString();
}

function safeLotQuote(quantity: string, price: string, state: AssetState): string | null {
	try {
		return winstonToAr(lotAsking(parseTokenAmount(quantity, state.denomination), price, state.denomination));
	} catch {
		return null;
	}
}

function safeArPrice(value: string): boolean {
	try {
		return BigInt(arToWinston(value)) > 0n;
	} catch {
		return false;
	}
}

function safeTokenAmount(value: string, denomination: number): bigint | null {
	try {
		const amount = BigInt(parseTokenAmount(value, denomination));
		return amount > 0n ? amount : null;
	} catch {
		return null;
	}
}

function unitPriceWinston(order: SwapOrder, denomination: number): bigint {
	const scale = 10n ** BigInt(denomination);
	return (BigInt(order.asking) * scale + BigInt(order.quantity) - 1n) / BigInt(order.quantity);
}

function orderPriceLabel(order: SwapOrder, state: AssetState) {
	return formatArCurrencyText(
		`${winstonToAr(unitPriceWinston(order, state.denomination).toString())} AR / ${formatTickerLabel(
			state.ticker,
			'token'
		)}`
	);
}

function tokenLabel(raw: string, state: AssetState) {
	return `${formatGroupedTokenAmount(raw, state.denomination)} ${formatTickerLabel(state.ticker, 'tokens')}`;
}

export function fungibleOrderActionLabel(action: 'buy' | 'cancel', order: SwapOrder, state: AssetState) {
	const lot = formatArCurrencyText(`${tokenLabel(order.quantity, state)} for ${winstonToAr(order.asking)} AR`);
	return action === 'buy' ? `Buy ${lot} from ${order.creator}` : `Cancel listing of ${lot}`;
}

export function fungibleListingAccessibleLabel(order: SwapOrder, state: AssetState) {
	return formatArCurrencyText(
		`${tokenLabel(order.quantity, state)}, ${orderPriceLabel(order, state)}, ${winstonToAr(
			order.asking
		)} AR total, seller ${order.creator}`
	);
}

export function fungibleOperationStateError(
	kind: FungibleOperation['kind'],
	state: AssetState,
	owner: string,
	expectedOrders: SwapOrder[],
	rawQuantity = '0',
	expectedDenomination = state.denomination
) {
	if (state.denomination !== expectedDenomination) return 'market-state-changed';
	if (kind === 'buy' || kind === 'cancel') {
		if (!expectedOrders.length) return 'market-state-changed';
		const unchanged = expectedOrders.every((expected) => {
			const current = state.orders[expected.orderId];
			return Boolean(
				current &&
					current.status === 'open' &&
					current.creator === expected.creator &&
					current.asking === expected.asking &&
					current.quantity === expected.quantity &&
					(kind === 'buy' ? current.creator !== owner : current.creator === owner)
			);
		});
		return unchanged ? '' : 'market-state-changed';
	}
	try {
		const quantity = BigInt(rawQuantity);
		return quantity > 0n && quantity <= BigInt(liquidBalanceOf(state, owner)) ? '' : 'market-state-changed';
	} catch {
		return 'market-state-changed';
	}
}

export function fungibleTransferRecipientError(recipient: string, owner: string) {
	const normalized = recipient.trim();
	if (!ADDRESS.test(normalized)) return 'Enter a 43-character Arweave wallet address.';
	if (normalized === owner)
		return 'Choose a different wallet. Sending tokens to this wallet would not change its balance.';
	return '';
}

export function fungibleTransferSubmitLabel(
	quantity: string,
	state: AssetState,
	recipient: string,
	fullRecipient = false
) {
	return `Send ${tokenLabel(quantity, state)} to ${fullRecipient ? recipient : short(recipient)}`;
}

function formatGroupedTokenAmount(raw: string, denomination: number) {
	const [whole, fraction] = formatTokenAmount(raw, denomination).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return fraction ? `${grouped}.${fraction}` : grouped;
}

function winstonToAr(value: string) {
	const raw = BigInt(value);
	const whole = raw / 1_000_000_000_000n;
	const fraction = (raw % 1_000_000_000_000n).toString().padStart(12, '0').replace(/0+$/, '');
	return fraction ? `${whole}.${fraction}` : whole.toString();
}

function arToWinston(value: string) {
	if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || value === '0') throw new Error('Enter a positive AR amount.');
	const [whole, decimals = ''] = value.split('.');
	return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
}

function assetDescription(state: AssetState, fallback: string) {
	if (typeof state.raw.description === 'string' && state.raw.description.trim()) return state.raw.description.trim();
	return fallback;
}

function operationLabel(kind: FungibleOperation['kind']) {
	return { sell: 'List tokens', buy: 'Buy tokens', cancel: 'Cancel listing', transfer: 'Transfer tokens' }[kind];
}

export function batchStageLabel(state?: PurchaseState) {
	if (!state) return 'Preparing';
	if (state.stage === 'complete') return 'Settled ✓';
	if (state.stage === 'failed') return 'Needs attention';
	if (state.stage === 'registration-accepting') return 'Checking reservation';
	if (state.stage === 'ownership-verifying') return 'Checking receipt';
	if (state.stage.includes('payment')) {
		return `Pay ${Math.min(state.payment?.consensus.confirmations ?? 0, 5)}/5`;
	}
	if (state.stage === 'signing' || state.stage === 'idle') return 'Preparing';
	return `Reserve ${Math.min(state.registration?.consensus.confirmations ?? 0, 5)}/5`;
}

function activityDetail(event: CollectionActivityEvent, state: AssetState) {
	if (event.action === 'make-offer') {
		return event.asking ? `${winstonToAr(event.asking)} AR total` : '';
	}
	if (event.action === 'transfer') {
		return event.recipient ? `To ${short(event.recipient)}` : '';
	}
	if (event.action === 'register-interest' && event.orderId) return `Order ${short(event.orderId)}`;
	if (event.action === 'cancel-order' && event.orderId) return `Order ${short(event.orderId)}`;
	return '';
}

export function fungibleActivityAmount(event: CollectionActivityEvent, state: AssetState) {
	if (!event.quantity) return '';
	const quantity = tokenLabel(event.quantity, state);
	return event.action === 'make-offer' && event.asking ? `${quantity} for ${winstonToAr(event.asking)} AR` : quantity;
}

export function fungiblePurchaseActivityAmount(
	event: CollectionActivityEvent,
	events: CollectionActivityEvent[],
	state: AssetState
) {
	if (event.action !== 'register-interest' || !event.orderId || !event.quantity) {
		return fungibleActivityAmount(event, state);
	}
	const indexedListing = events.find(
		(candidate) =>
			candidate.action === 'make-offer' &&
			candidate.id === event.orderId &&
			Boolean(candidate.asking) &&
			Boolean(candidate.quantity)
	);
	const liveListing = state.orders?.[event.orderId];
	const asking = indexedListing?.asking ?? liveListing?.asking;
	const listedQuantity = indexedListing?.quantity ?? liveListing?.quantity;
	if (!asking || !listedQuantity) return fungibleActivityAmount(event, state);
	try {
		const fill = BigInt(event.quantity);
		const lot = BigInt(listedQuantity);
		if (fill <= 0n || lot <= 0n || fill > lot) return fungibleActivityAmount(event, state);
		const paid = (BigInt(asking) * fill + lot - 1n) / lot;
		return `${tokenLabel(event.quantity, state)} for ${winstonToAr(paid.toString())} AR`;
	} catch {
		return fungibleActivityAmount(event, state);
	}
}

function short(value: string) {
	return `${value.slice(0, 6)}…${value.slice(-5)}`;
}
