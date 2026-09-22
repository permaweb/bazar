import React from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { ArrowUpRight, BarChart3, Grid2X2, Send, ShoppingCart, Tag, Users } from 'lucide-react';

import { type AssetSummary, type Collection, collectionDisplayName } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import {
	assetBalanceStateAvailable,
	type AssetState,
	formatTokenAmount,
	licenseProperties,
	liquidBalanceOf,
	listedBalanceOf,
	liveOrdersOfAsset,
} from 'api/marketplace';
import {
	announceFungibleOperationActivityChange,
	assetHasSavedSignedAction,
	clearStaleWalletOperationClaim,
	fungibleBatchStorageKey,
	fungibleOperationActivityId,
	type FungibleOperationActivitySummary,
	hasRecoverablePurchase,
	loadWalletRecord,
	operationClaimStorageKey,
	operationRecoveryCanStillApply,
	operationStorageKey,
	removeWalletRecord,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	walletOperationStorageChange,
} from 'api/operations';
import { AssetTransactionClient, purchaseGatewaySwitchNotice } from 'api/transactions';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { type SegmentedTab, SegmentedTabs } from 'components/atoms/SegmentedTabs';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { ErrorPanel, type ErrorPanelAction } from 'components/molecules/ErrorPanel';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { StatusNotice } from 'components/molecules/StatusNotice';
import { type TransactionDialogPhase } from 'components/molecules/TransactionDialogControl';
import { ConnectWalletButton } from 'components/organisms/ConnectWalletButton';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { MarketActivityList } from 'features/Activity';
import { unitPriceWinston } from 'features/Catalogue';
import {
	AssetBalanceStateNotice,
	assetOperationPendingActionLabel,
	AssetOperationStatus,
	type UnavailableOperationRecovery,
	UnavailableOperationRecoveryNotice,
} from 'features/Operations';
import { currentPurchaseGatewayContext, PausedRecoveryNotice } from 'features/Operations';
import { preloadArweaveTransactionSync } from 'features/TransactionSync';
import { winstonToArDecimal } from 'helpers/ar-units';
import { isArweaveId } from 'helpers/arweave-id';
import { transactionExplorerUrl } from 'helpers/explorer';
import { formatTickerLabel } from 'helpers/token-display';
import { useWallet } from 'providers/WalletProvider';

import {
	batchHasNoDispatchedSellerPayment,
	batchRecoveryIdentity,
	fungibleBatchRecoveryStatus,
	isRecoverableBatch,
} from '../../../model/fungible-batch';
import { fungibleHolders, fungibleHoldingPercentage } from '../../../model/fungible-holders';
import {
	assetDescription,
	formatGroupedTokenAmount,
	fungiblePriceHistory,
	orderbookCumulativeDepths,
	orderPriceLabel,
	purchaseAmountMatch,
	safeArPrice,
	safeLotQuote,
	safeTokenAmount,
	tokenLabel,
	visibleOrderbookRows,
} from '../../../model/fungible-market';
import {
	activityDetail,
	appendFungibleOperationActivity,
	BatchResume,
	fungibleActivityPhaseStatus,
	FungibleOperation,
	FungibleOperationActivity,
	fungibleOrderActionLabel,
	fungiblePurchaseActivityAmount,
	restartFungibleOperationActivity,
} from '../../../model/fungible-operation';
import { type AssetDetailTab, AssetDetailTabs } from '../../molecules/AssetDetailTabs';
import { FungibleHolderIdentity } from '../../molecules/FungibleHolderIdentity';
import { FungibleListingComposer } from '../../molecules/FungibleListingComposer';
import { FungiblePurchaseComposer } from '../../molecules/FungiblePurchaseComposer';
import { FungibleHolderChart } from '../FungibleHolderChart';
import { FungibleOperationDialog } from '../FungibleOperationDialog';
import { TokenPriceChart } from '../TokenPriceChart';

// The synchronization view loads as its own chunk; warm it as soon as the trading view loads.
preloadArweaveTransactionSync();

type Props = {
	asset: AssetSummary;
	collection: Collection;
	collectionIndexNotice?: React.ReactNode;
	state: AssetState;
	activity: CollectionActivityEvent[];
	activityHasNextPage: boolean;
	activityLoading: boolean;
	activityLoadingMore: boolean;
	activityTotalCount: number | null;
	activityError: string | null;
	askActivity: CollectionActivityEvent[];
	askError: string | null;
	askHasNextPage: boolean;
	askLoading: boolean;
	askLoadingMore: boolean;
	onActivityLoadMore(): void;
	onActivityRetry(): void;
	onActivityVisible(): void;
	onAskLoadMore(): void;
	onAskRetry(): void;
	loading: boolean;
	error: string | null;
	provider: string;
	verifiedAt: number | null;
	onRefresh(): Promise<void>;
	stateRecoveryAction?: ErrorPanelAction;
};

export default function FungibleAssetView(props: Props) {
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
		[props.asset.id, wallet.address]
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
		(
			activity: FungibleOperationActivity,
			nextPhase: TransactionDialogPhase | null = activity.phase,
			progress?: Pick<FungibleOperationActivitySummary, 'status' | 'confirmations' | 'confirmationTarget'>
		) => {
			const phase = nextPhase ?? 'form';
			if (phase === 'done') {
				announceFungibleOperationActivityChange({ type: 'remove', id: activity.id, owner: activity.signer });
			} else {
				const summary = {
					id: activity.id,
					asset: props.asset,
					collectionId: props.collection.id,
					owner: activity.signer,
					operationKind: activity.operation.kind,
					phase,
					status: progress?.status ?? fungibleActivityPhaseStatus(phase),
					...(progress?.confirmations !== undefined && progress.confirmationTarget !== undefined
						? {
								confirmations: progress.confirmations,
								confirmationTarget: progress.confirmationTarget,
						  }
						: {}),
					createdAt: activity.createdAt ?? Date.now(),
				};
				announceFungibleOperationActivityChange({ type: 'upsert', activity: summary });
			}
		},
		[props.asset, props.collection.id]
	);
	const openOperation = React.useCallback(
		(next: FungibleOperation, options?: { show?: boolean }) => {
			if (wallet.address) {
				const show = options?.show ?? true;
				const signer = wallet.address;
				const id = fungibleOperationActivityId(props.asset.id, signer, next.kind);
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
		[props.asset.id, publishOperationActivity, showOperationActivity, wallet.address]
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
	const [orderReveal, setOrderReveal] = React.useState({ assetId: props.asset.id, limit: 50 });
	const orderRevealStatusRef = React.useRef<HTMLParagraphElement>(null);
	const [activityReveal, setActivityReveal] = React.useState({ assetId: props.asset.id, limit: 8 });
	const [holderReveal, setHolderReveal] = React.useState({ assetId: props.asset.id, limit: 50 });
	const holderRevealStatusRef = React.useRef<HTMLParagraphElement>(null);
	const [storageVersion, setStorageVersion] = React.useState(0);
	const orders = React.useMemo(() => liveOrdersOfAsset(props.state), [props.state]);
	const orderLimit = orderReveal.assetId === props.asset.id ? orderReveal.limit : 50;
	const visibleOrderRows = visibleOrderbookRows(orders, orderLimit);
	const orderDepths = React.useMemo(() => orderbookCumulativeDepths(orders), [orders]);
	const activityLimit = activityReveal.assetId === props.asset.id ? activityReveal.limit : 8;
	const visibleActivityRows = props.activity.slice(0, activityLimit);
	const openOrders = React.useMemo(() => orders.filter((order) => order.status === 'open'), [orders]);
	const purchasableOrders = React.useMemo(
		() => openOrders.filter((order) => order.creator !== wallet.address && order.recipient !== wallet.address),
		[openOrders, wallet.address]
	);
	const liquid = wallet.address ? liquidBalanceOf(props.state, wallet.address) : '0';
	const listed = wallet.address ? listedBalanceOf(props.state, wallet.address) : '0';
	const ticker = props.state.ticker || 'Token';
	const tickerDisplay = formatTickerLabel(ticker);
	const best = openOrders[0] ?? null;
	const forSale = React.useMemo(
		() => openOrders.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
		[openOrders]
	);
	const listingAmount = safeTokenAmount(listingQuantity, props.state.denomination);
	const listingBalance = BigInt(liquid);
	const listingQuantityError = listingQuantity.trim()
		? listingAmount === null
			? `Enter a valid ${tickerDisplay} amount using no more than ${props.state.denomination} decimal places.`
			: listingAmount > listingBalance
			? `You can list up to ${tokenLabel(liquid, props.state)}.`
			: ''
		: '';
	const listingUnitPriceError =
		listingUnitPrice.trim() && !safeArPrice(listingUnitPrice)
			? 'Enter a positive AR price with no more than 12 decimal places.'
			: '';
	const listingQuote =
		listingAmount !== null && listingAmount <= listingBalance
			? safeLotQuote(listingQuantity, listingUnitPrice, props.state)
			: null;
	const listingReady = Boolean(
		listingAmount !== null && listingAmount <= listingBalance && safeArPrice(listingUnitPrice) && listingQuote
	);
	const purchasableQuantity = React.useMemo(
		() => purchasableOrders.reduce((total, order) => total + BigInt(order.quantity), 0n),
		[purchasableOrders]
	);
	const purchaseQuantityTracksMaximum = React.useRef(false);
	const maximumPurchaseQuantity = formatTokenAmount(purchasableQuantity.toString(), props.state.denomination);
	React.useEffect(() => {
		if (!purchaseQuantityTracksMaximum.current) return;
		setPurchaseQuantity((current) => (current === maximumPurchaseQuantity ? current : maximumPurchaseQuantity));
	}, [maximumPurchaseQuantity]);
	const purchaseAmountResult = React.useMemo(
		() => purchaseAmountMatch(purchasableOrders, purchaseQuantity, props.state),
		[purchasableOrders, purchaseQuantity, props.state]
	);
	const holderRows = React.useMemo(() => fungibleHolders(props.state), [props.state]);
	const holderBalancesAvailable = assetBalanceStateAvailable(props.state);
	const holders = holderRows.length;
	const holderLimit = holderReveal.assetId === props.asset.id ? holderReveal.limit : 50;
	const visibleHolderRows = holderRows.slice(0, holderLimit);
	React.useEffect(() => {
		if (!holderBalancesAvailable && activeSection === 'holders') setActiveSection('market');
	}, [activeSection, holderBalancesAvailable]);
	const license = licenseProperties(props.state);
	const description = assetDescription(props.state, props.collection.description);
	const priceHistory = React.useMemo(
		() => fungiblePriceHistory(props.askActivity, props.state.denomination),
		[props.askActivity, props.state.denomination]
	);
	const purchaseKey = wallet.address ? fungibleBatchStorageKey(props.asset.id, wallet.address) : '';
	type FungibleAssetSection = typeof activeSection;
	const assetTabs: AssetDetailTab<FungibleAssetSection>[] = [
		{
			value: 'market',
			label: 'Market',
			icon: <Icon icon={BarChart3} />,
			panelId: 'fungible-asset-market',
		},
		{
			value: 'holders',
			label: 'Holders',
			icon: <Icon icon={Users} />,
			panelId: 'fungible-asset-holders',
			disabled: !holderBalancesAvailable,
			disabledMessage: !holderBalancesAvailable
				? 'Holder balances are unavailable from the current AO routes.'
				: undefined,
		},
		{
			value: 'about',
			label: 'About',
			icon: <Icon icon={Grid2X2} />,
			panelId: 'fungible-asset-about',
		},
	];
	type FungibleTradeMode = typeof tradeMode;
	const tradeTabs: SegmentedTab<FungibleTradeMode>[] = [
		{
			value: 'buy',
			label: 'Buy',
			icon: <Icon icon={ShoppingCart} />,
			panelId: 'fungible-trade-buy',
		},
		{
			value: 'sell',
			label: 'List',
			icon: <Icon icon={Tag} />,
			panelId: 'fungible-trade-sell',
		},
		{
			value: 'transfer',
			label: 'Transfer',
			icon: <Icon icon={Send} />,
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
		setActivityReveal({ assetId: props.asset.id, limit: 8 });
	}, [props.asset.id]);

	React.useEffect(() => {
		if (activeSection === 'market') props.onActivityVisible();
	}, [activeSection, props.onActivityVisible]);

	React.useEffect(() => {
		if (!wallet.address) return;
		const walletAddress = wallet.address;
		const purchaseClaimKey = operationClaimStorageKey(props.asset.id, walletAddress, 'purchase');
		const assetClaimKey = operationClaimStorageKey(props.asset.id, walletAddress, 'asset');
		const operationKey = operationStorageKey(props.asset.id, walletAddress);
		const purchaseKey = fungibleBatchStorageKey(props.asset.id, walletAddress);
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
				void props.onRefresh();
			}
			setStorageVersion((version) => version + 1);
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, [props.asset.id, props.onRefresh, wallet.address]);

	React.useEffect(() => {
		setRecoverySuppressed(false);
		setRecoveryNotice('');
		setUnavailableRecovery(null);
		setOperationActivities([]);
	}, [props.asset.id, wallet.address]);
	React.useLayoutEffect(() => {
		if (recoverySuppressed) resumeButtonRef.current?.focus();
	}, [recoverySuppressed]);
	React.useEffect(() => {
		if (!wallet.address || hasWalletActivities || recoverySuppressed) return;
		const activeClaimKeys = [
			operationClaimStorageKey(props.asset.id, wallet.address, 'purchase'),
			operationClaimStorageKey(props.asset.id, wallet.address, 'asset'),
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
			savedBatch = JSON.parse(
				localStorage.getItem(fungibleBatchStorageKey(props.asset.id, wallet.address)) ?? 'null'
			);
		} catch {
			removeWalletRecord(localStorage, purchaseKey);
		}
		if (isRecoverableBatch(savedBatch, wallet.address)) {
			const resume = savedBatch as BatchResume;
			const recoveryStatus = fungibleBatchRecoveryStatus(resume, props.state, wallet.address);
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
					fungibleBatchStorageKey(props.asset.id, wallet.address),
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
				fungibleBatchStorageKey(props.asset.id, wallet.address),
				(current) => !isRecoverableBatch(current, wallet.address!)
			);
		}
		try {
			const pendingOperationKey = operationStorageKey(props.asset.id, wallet.address);
			const saved = loadWalletRecord<any>(
				localStorage,
				pendingOperationKey,
				`bazar-operation:${props.asset.id}`,
				(record) =>
					record?.signer === wallet.address &&
					isArweaveId(record?.txId ?? '') &&
					['sell', 'cancel', 'transfer'].includes(record?.kind)
			);
			if (!saved) {
				setUnavailableRecovery((current) => (current?.key === pendingOperationKey ? null : current));
				return;
			}
			if (saved.signer !== wallet.address || !isArweaveId(saved.txId)) return;
			try {
				new AssetTransactionClient().restore(saved.txId, wallet.address);
			} catch {
				const canStillApply = operationRecoveryCanStillApply(props.state, wallet.address, saved, 'fungible');
				const matches = (record: any) =>
					record?.assetId === props.asset.id &&
					record?.signer === wallet.address &&
					record?.txId === saved.txId;
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
			if (wallet.address) removeWalletRecord(localStorage, operationStorageKey(props.asset.id, wallet.address));
		}
	}, [
		props.asset.id,
		hasWalletActivities,
		openOperation,
		purchaseKey,
		recoverySuppressed,
		props.state,
		storageVersion,
		wallet.address,
	]);

	const signedRecoveryLocksAsset = Boolean(
		wallet.address && assetHasSavedSignedAction(localStorage, props.asset.id, wallet.address)
	);
	const recoveryBlocksActions = recoverySuppressed || Boolean(unavailableRecovery) || signedRecoveryLocksAsset;
	const purchaseBlocksActions = recoveryBlocksActions || Boolean(activePurchaseActivity);
	const assetBlocksActions = recoveryBlocksActions || Boolean(activeAssetActivity);
	const handleOperationActivityChange = React.useCallback(
		(
			id: string,
			update: Pick<FungibleOperationActivitySummary, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>
		) => {
			const activity = operationActivitiesRef.current.find((candidate) => candidate.id === id);
			if (activity) publishOperationActivity(activity, update.phase, update);
			setOperationActivities((current) =>
				current.map((activity) => (activity.id === id ? { ...activity, phase: update.phase } : activity))
			);
			if (update.phase === 'done') void props.onRefresh();
		},
		[props.onRefresh, publishOperationActivity]
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
				<PausedRecoveryNotice onResume={() => setRecoverySuppressed(false)} resumeButtonRef={resumeButtonRef} />
			) : null}
			{recoveryNotice ? (
				<StatusNotice onDismiss={() => setRecoveryNotice('')}>{recoveryNotice}</StatusNotice>
			) : null}
			{unavailableRecovery ? (
				<UnavailableOperationRecoveryNotice
					recovery={unavailableRecovery}
					stateNoun="balances and orders above"
					onRefresh={() => void props.onRefresh()}
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
					image={props.asset.image}
					loading="eager"
					ticker={ticker}
				/>
				<div className="fungible-token-identity">
					<div className="fungible-token-title">
						<h1 ref={operationFocusFallbackRef} tabIndex={-1}>
							{tickerDisplay}
						</h1>
						<span className="fungible-token-name">{props.asset.name}</span>
					</div>
					<div className="fungible-token-meta" aria-label="Token protocol details">
						<Link to={`/collection/${props.collection.id}`}>{collectionDisplayName(props.collection)}</Link>
						<span>{props.state.device}</span>
						<span>{props.state.denomination} decimals</span>
					</div>
				</div>
				<div className="fungible-token-balance">
					<span>
						{props.loading || props.error
							? wallet.address
								? 'Balance'
								: 'Last known supply'
							: wallet.address
							? 'Your liquid balance'
							: 'Circulating supply'}
					</span>
					<strong>
						{wallet.address && !holderBalancesAvailable
							? 'Unavailable'
							: tokenLabel(wallet.address ? liquid : props.state.totalSupply, props.state)}
					</strong>
				</div>
			</header>
			{props.loading ? <Loading label="Computing current state…" /> : null}
			{props.error ? (
				<ErrorPanel
					message={props.error}
					onRetry={() => void props.onRefresh()}
					secondaryAction={props.stateRecoveryAction}
				/>
			) : null}
			<div className="asset-detail-layout">
				<div className="asset-commerce-column asset-commerce-primary">
					<section aria-busy={hasBusyWalletActivities} className="asset-commerce-card">
						<AssetBalanceStateNotice state={props.state} />
						<div className="asset-market-stats">
							<div>
								<span>Current unit price</span>
								<strong>
									{best ? (
										<ArCurrencyText>{orderPriceLabel(best, props.state)}</ArCurrencyText>
									) : (
										'Not listed'
									)}
								</strong>
							</div>
							<div>
								<span>For sale</span>
								<strong>{tokenLabel(forSale, props.state)}</strong>
							</div>
							<div>
								<span>Your listed</span>
								<strong>{wallet.address ? tokenLabel(listed, props.state) : '—'}</strong>
							</div>
							<div>
								<span>Holders</span>
								<strong>
									{holderBalancesAvailable ? holderRows.length.toLocaleString() : 'Unavailable'}
								</strong>
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
										state={props.state}
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
								{wallet.address && holderBalancesAvailable && listingBalance > 0n ? (
									<FungibleListingComposer
										availableQuantity={liquid}
										onMax={() =>
											setListingQuantity(formatTokenAmount(liquid, props.state.denomination))
										}
										onQuantityChange={setListingQuantity}
										onUnitPriceChange={setListingUnitPrice}
										quantity={listingQuantity}
										quantityError={listingQuantityError}
										state={props.state}
										total={listingQuote}
										unitPrice={listingUnitPrice}
										unitPriceError={listingUnitPriceError}
									/>
								) : (
									<div className="asset-buy-summary asset-buy-summary-empty">
										<span>Listing amount</span>
										<h1>
											{wallet.address
												? holderBalancesAvailable
													? 'No liquid tokens'
													: 'Balance unavailable'
												: 'Connect to list'}
										</h1>
										<small>
											{wallet.address
												? holderBalancesAvailable
													? 'Tokens already listed for sale are not available for a new listing.'
													: 'Complete holder balance state is required before listing tokens.'
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
											? !holderBalancesAvailable
												? 'Balance unavailable'
												: listingBalance > 0n
												? tokenLabel(liquid, props.state)
												: 'No liquid tokens'
											: 'Connect to transfer'}
									</h1>
									<small>
										{wallet.address
											? !holderBalancesAvailable
												? 'Complete holder balance state is required before transferring tokens.'
												: listingBalance > 0n
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
										!holderBalancesAvailable ||
										purchaseBlocksActions ||
										props.loading ||
										Boolean(props.error)
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
									<Icon icon={ShoppingCart} size="sm" />{' '}
									{activePurchaseActivity
										? assetOperationPendingActionLabel('buy')
										: purchaseAmountResult.match
										? 'Buy tokens'
										: 'Enter an amount'}
								</Button>
							) : null}
							{tradeMode === 'sell' &&
							wallet.address &&
							(!holderBalancesAvailable || listingBalance > 0n) ? (
								<Button
									className="with-icon market-primary-action"
									disabled={
										!holderBalancesAvailable ||
										!listingReady ||
										assetBlocksActions ||
										props.loading ||
										Boolean(props.error)
									}
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
									<Icon icon={Tag} size="sm" />{' '}
									{activeAssetActivity?.operation.kind === 'sell'
										? assetOperationPendingActionLabel('sell')
										: listingReady
										? 'Review listing'
										: 'Enter listing details'}
								</Button>
							) : null}
							{tradeMode === 'transfer' &&
							wallet.address &&
							(!holderBalancesAvailable || listingBalance > 0n) ? (
								<Button
									className="with-icon market-primary-action"
									disabled={
										!holderBalancesAvailable ||
										assetBlocksActions ||
										props.loading ||
										Boolean(props.error)
									}
									size="custom"
									onClick={() => openOperation({ kind: 'transfer' })}
									variant="primary"
								>
									<Icon icon={Send} size="sm" />{' '}
									{activeAssetActivity?.operation.kind === 'transfer'
										? assetOperationPendingActionLabel('transfer')
										: 'Transfer tokens'}
								</Button>
							) : null}
						</div>
					</section>
				</div>
				<div className="asset-commerce-column asset-commerce-secondary">
					{props.collectionIndexNotice}
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
								error={props.askError}
								floorValue={best ? unitPriceWinston(best, props.state.denomination).toString() : null}
								formatValue={(value) => `${winstonToArDecimal(value)} AR / ${ticker}`}
								hasNextPage={props.askHasNextPage}
								loading={props.askLoading}
								loadingMore={props.askLoadingMore}
								onLoadMore={props.onAskLoadMore}
								onRetry={props.onAskRetry}
								points={priceHistory}
								ticker={ticker}
							/>
							<div
								aria-label={`${props.asset.name} order book`}
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
												aria-label={orderPriceLabel(order, props.state)}
												data-label="Price (AR)"
												role="cell"
											>
												{winstonToArDecimal(
													unitPriceWinston(order, props.state.denomination).toString()
												)}
											</strong>
											<span
												aria-label={tokenLabel(order.quantity, props.state)}
												data-label={`Size (${tickerDisplay})`}
												role="cell"
											>
												{formatGroupedTokenAmount(order.quantity, props.state.denomination)}
											</span>
											<span
												aria-label={`${winstonToArDecimal(order.asking)} AR`}
												data-label="Value (AR)"
												role="cell"
											>
												{winstonToArDecimal(order.asking)}
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
														aria-label={fungibleOrderActionLabel(
															'cancel',
															order,
															props.state
														)}
														className="order-action"
														disabled={
															!holderBalancesAvailable ||
															assetBlocksActions ||
															props.loading ||
															Boolean(props.error)
														}
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
												setOrderReveal({ assetId: props.asset.id, limit: next });
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
										{props.activityLoading ? <span role="status">Refreshing…</span> : null}
									</div>
								</div>
								{props.activityError ? (
									<RetryNotice onRetry={props.onActivityRetry} retryLabel="Retry history">
										Compute hasn’t completed yet. Please try again.{' '}
										{props.activity.length ? 'Previously loaded events remain visible.' : ''}
									</RetryNotice>
								) : null}
								{visibleActivityRows.length ? (
									<MarketActivityList
										ariaLabel={`${props.asset.name} market activity`}
										collectionId={props.collection.id}
										compact
										describeEvent={(event) => activityDetail(event, props.state)}
										eventAmount={(event) =>
											fungiblePurchaseActivityAmount(event, props.activity, props.state)
										}
										events={visibleActivityRows}
										loading={props.activityLoading || props.activityLoadingMore}
										reservationState={props.state}
										resolveAsset={() => props.asset}
									/>
								) : null}
								{!props.activityLoading && !props.activityError && !props.activity.length ? (
									<p className="asset-empty-copy">No indexed market events found.</p>
								) : null}
								{visibleActivityRows.length < props.activity.length ? (
									<div className="asset-market-activity-footer">
										<p className="market-note">
											{props.activityTotalCount === null
												? `${props.activity.length.toLocaleString()} indexed events loaded.`
												: `${props.activity.length.toLocaleString()} of ${props.activityTotalCount.toLocaleString()} indexed events loaded.`}
										</p>
										<Button
											type="button"
											size="custom"
											onClick={() =>
												setActivityReveal({
													assetId: props.asset.id,
													limit: Math.min(props.activity.length, activityLimit + 8),
												})
											}
										>
											Show{' '}
											{Math.min(
												8,
												props.activity.length - visibleActivityRows.length
											).toLocaleString()}{' '}
											more
										</Button>
									</div>
								) : props.activityHasNextPage ? (
									<div className="asset-market-activity-footer">
										<p className="market-note">
											{props.activityTotalCount === null
												? `${props.activity.length.toLocaleString()} indexed events loaded.`
												: `${props.activity.length.toLocaleString()} of ${props.activityTotalCount.toLocaleString()} indexed events loaded.`}
										</p>
										<Button
											disabled={props.activityLoadingMore}
											onClick={props.onActivityLoadMore}
											size="custom"
											type="button"
										>
											{props.activityLoadingMore
												? 'Loading older activity…'
												: 'Load older activity'}
										</Button>
									</div>
								) : props.activity.length ? (
									<p className="market-note">
										{props.activityTotalCount === null
											? `${props.activity.length.toLocaleString()} indexed events loaded.`
											: `${props.activity.length.toLocaleString()} of ${props.activityTotalCount.toLocaleString()} indexed events loaded.`}
									</p>
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
							<FungibleHolderChart
								assetName={props.asset.name}
								holders={holderRows}
								state={props.state}
							/>
							<div
								aria-label={`${props.asset.name} token holders`}
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
											<FungibleHolderIdentity address={holder.address} />
										</span>
										<strong data-label="Total balance" role="cell">
											{tokenLabel(holder.total, props.state)}
										</strong>
										<span className="fungible-holder-share" data-label="Share" role="cell">
											{fungibleHoldingPercentage(holder.total, props.state.totalSupply)}
										</span>
										<span data-label="Listed" role="cell">
											{BigInt(holder.listed) > 0n ? tokenLabel(holder.listed, props.state) : '—'}
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
												setHolderReveal({ assetId: props.asset.id, limit: next });
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
									<strong>{tokenLabel(props.state.totalSupply, props.state)}</strong>
								</div>
								<div>
									<span>Atomic precision</span>
									<strong>{props.state.denomination} decimals</strong>
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
													href={transactionExplorerUrl(props.asset.id)}
													target="_blank"
													rel="noreferrer"
												>
													View license proof on ViewBlock{' '}
													<Icon icon={ArrowUpRight} size="xs" />
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
					asset={props.asset}
					collectionId={props.collection.id}
					state={props.state}
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
					onActivityChange={(update) => handleOperationActivityChange(activity.id, update)}
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
						if (refresh) void props.onRefresh();
					}}
				/>
			))}
		</section>
	);
}
