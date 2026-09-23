import React from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

import type { AssetSummary } from 'api/collections';
import type { AssetState } from 'api/marketplace';
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

import type { TransactionDialogPhase } from 'components/molecules/TransactionDialogControl';
import { currentPurchaseGatewayContext, type UnavailableOperationRecovery } from 'features/Operations';

import {
	batchHasNoDispatchedSellerPayment,
	batchRecoveryIdentity,
	fungibleBatchRecoveryStatus,
	isRecoverableBatch,
} from '../model/fungible-batch';
import {
	appendFungibleOperationActivity,
	type BatchResume,
	type FungibleOperation,
	type FungibleOperationActivity,
	restartFungibleOperationActivity,
} from '../model/fungible-operation';
import {
	batchResumeOperation,
	fungibleOperationActivitySummary,
	isSavedFungibleOperationRecord,
	retainResumingActivities,
	revealFungibleOperationActivity,
	savedFungibleOperation,
	savedOperationRecordMatches,
	withoutScopedActivities,
} from '../model/fungible-recovery';

type ActivityUpdate = Pick<
	FungibleOperationActivitySummary,
	'phase' | 'status' | 'confirmations' | 'confirmationTarget'
>;
type ActivityProgress = Pick<FungibleOperationActivitySummary, 'status' | 'confirmations' | 'confirmationTarget'>;

export type FungibleOperationActivities = {
	/** Operation dialogs owned by the connected wallet, in the order they opened. */
	walletActivities: FungibleOperationActivity[];
	hasBusyWalletActivities: boolean;
	activePurchaseActivity?: FungibleOperationActivity;
	activeAssetActivity?: FungibleOperationActivity;
	/** The user paused a recoverable operation; nothing resumes until they choose to. */
	recoverySuppressed: boolean;
	recoveryNotice: string;
	unavailableRecovery: UnavailableOperationRecovery | null;
	purchaseBlocksActions: boolean;
	assetBlocksActions: boolean;
	open(operation: FungibleOperation, options?: { show?: boolean }): void;
	show(id: string): void;
	hide(id: string): void;
	change(id: string, update: ActivityUpdate): void;
	restart(id: string): void;
	close(activity: FungibleOperationActivity, resumeLater?: boolean, refresh?: boolean): void;
	resumeRecovery(): void;
	dismissRecoveryNotice(): void;
	discardUnavailableRecovery(): void;
};

/**
 * Owns the operation dialogs of one token page: opening and announcing them, restoring signed work saved in this
 * browser, following other tabs that claim or finish the same wallet's operations, and revealing a dialog requested
 * through navigation state.
 */
export function useFungibleOperationActivities(params: {
	asset: AssetSummary;
	collectionId: string;
	state: AssetState;
	walletAddress: string | null;
	onRefresh(): Promise<void>;
}): FungibleOperationActivities {
	const location = useLocation();
	const navigate = useNavigate();
	const navigationType = useNavigationType();
	const [operationActivities, setOperationActivities] = React.useState<FungibleOperationActivity[]>([]);
	const [recoverySuppressed, setRecoverySuppressed] = React.useState(false);
	const [recoveryNotice, setRecoveryNotice] = React.useState('');
	const [unavailableRecovery, setUnavailableRecovery] = React.useState<UnavailableOperationRecovery | null>(null);
	const [storageVersion, setStorageVersion] = React.useState(0);
	const operationActivitiesRef = React.useRef(operationActivities);
	operationActivitiesRef.current = operationActivities;
	const walletAddress = params.walletAddress;
	const onRefresh = params.onRefresh;

	React.useEffect(
		() => () => {
			for (const activity of operationActivitiesRef.current) {
				announceFungibleOperationActivityChange({ type: 'remove', id: activity.id, owner: activity.signer });
			}
		},
		[params.asset.id, walletAddress]
	);

	const walletActivities = operationActivities.filter((activity) => activity.signer === walletAddress);
	const hasWalletActivities = walletActivities.length > 0;
	const activePurchaseActivity = walletActivities.find((activity) => activity.operation.kind === 'buy');
	const activeAssetActivity = walletActivities.find((activity) => activity.operation.kind !== 'buy');

	const show = React.useCallback((id: string) => {
		setOperationActivities((current) => current.map((activity) => ({ ...activity, visible: activity.id === id })));
	}, []);

	const publish = React.useCallback(
		(
			activity: FungibleOperationActivity,
			nextPhase: TransactionDialogPhase | null = activity.phase,
			progress?: ActivityProgress
		) => {
			const phase = nextPhase ?? 'form';
			if (phase === 'done') {
				announceFungibleOperationActivityChange({ type: 'remove', id: activity.id, owner: activity.signer });
			} else {
				announceFungibleOperationActivityChange({
					type: 'upsert',
					activity: fungibleOperationActivitySummary(
						activity,
						params.asset,
						params.collectionId,
						phase,
						progress
					),
				});
			}
		},
		[params.asset, params.collectionId]
	);

	const open = React.useCallback(
		(next: FungibleOperation, options?: { show?: boolean }) => {
			if (!walletAddress) return;
			const visible = options?.show ?? true;
			const id = fungibleOperationActivityId(params.asset.id, walletAddress, next.kind);
			const existing = operationActivitiesRef.current.find(
				(activity) => activity.id === id && activity.signer === walletAddress
			);
			if (existing) {
				if (visible) show(existing.id);
				return;
			}
			const activity = {
				id,
				operation: next,
				phase: null,
				signer: walletAddress,
				visible,
				createdAt: Date.now(),
			} satisfies FungibleOperationActivity;
			setOperationActivities((current) =>
				appendFungibleOperationActivity(
					current.filter((candidate) => candidate.id !== id),
					activity
				)
			);
			publish(activity);
		},
		[params.asset.id, publish, show, walletAddress]
	);

	React.useEffect(() => {
		if (!walletAddress) return;
		const purchaseClaimKey = operationClaimStorageKey(params.asset.id, walletAddress, 'purchase');
		const assetClaimKey = operationClaimStorageKey(params.asset.id, walletAddress, 'asset');
		const operationKey = operationStorageKey(params.asset.id, walletAddress);
		const purchaseKey = fungibleBatchStorageKey(params.asset.id, walletAddress);
		const handleStorage = (event: StorageEvent) => {
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
			setRecoverySuppressed(false);
			if (change === 'claim-acquired' || change === 'claim-released') {
				if (change === 'claim-acquired') {
					setOperationActivities((current) => retainResumingActivities(current, walletAddress, changedScope));
				}
				setStorageVersion((version) => version + 1);
				return;
			}
			if (change === 'recovery-updated') {
				setOperationActivities((current) => retainResumingActivities(current, walletAddress, changedScope));
			} else {
				setOperationActivities((current) => withoutScopedActivities(current, walletAddress, changedScope));
				void onRefresh();
			}
			setStorageVersion((version) => version + 1);
		};
		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	}, [onRefresh, params.asset.id, walletAddress]);

	React.useEffect(() => {
		setRecoverySuppressed(false);
		setRecoveryNotice('');
		setUnavailableRecovery(null);
		setOperationActivities([]);
	}, [params.asset.id, walletAddress]);

	React.useEffect(() => {
		if (!walletAddress || hasWalletActivities || recoverySuppressed) return;
		const activeClaimKeys = [
			operationClaimStorageKey(params.asset.id, walletAddress, 'purchase'),
			operationClaimStorageKey(params.asset.id, walletAddress, 'asset'),
		];
		const activeClaimKey = activeClaimKeys.find((key) => localStorage.getItem(key));
		if (activeClaimKey) {
			const controller = new AbortController();
			void clearStaleWalletOperationClaim(localStorage, activeClaimKey, { signal: controller.signal })
				.then((cleared) => {
					if (!controller.signal.aborted && cleared) setStorageVersion((version) => version + 1);
				})
				// An aborted or unavailable lock check leaves the claim for the tab that holds it.
				.catch(() => undefined);
			return () => controller.abort();
		}
		const purchaseKey = fungibleBatchStorageKey(params.asset.id, walletAddress);
		let savedBatch: unknown = null;
		try {
			savedBatch = JSON.parse(localStorage.getItem(purchaseKey) ?? 'null');
		} catch {
			// Unreadable purchase recovery cannot resume anything; discard only that record.
			removeWalletRecord(localStorage, purchaseKey);
		}
		if (isRecoverableBatch(savedBatch, walletAddress)) {
			const resume: BatchResume = savedBatch;
			const recoveryStatus = fungibleBatchRecoveryStatus(resume, params.state, walletAddress);
			if (recoveryStatus === 'resumable') {
				const gatewayNotice = purchaseGatewaySwitchNotice(
					resume.gateway,
					currentPurchaseGatewayContext(),
					resume.entries.find((entry) => hasRecoverablePurchase(entry.snapshot))?.snapshot
				);
				if (gatewayNotice) setRecoveryNotice(gatewayNotice);
				open(batchResumeOperation(resume), { show: false });
			} else if (batchHasNoDispatchedSellerPayment(resume)) {
				const removed = removeWalletRecoveryAndSignatures<BatchResume>(
					localStorage,
					purchaseKey,
					(current) =>
						current.buyer === walletAddress &&
						(current.attemptId ?? batchRecoveryIdentity(current.entries)) ===
							(resume.attemptId ?? batchRecoveryIdentity(resume.entries)),
					resume.entries.flatMap((entry) => [entry.snapshot.registration?.id, entry.snapshot.payment?.id]),
					walletAddress
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
			removeWalletRecordIf<unknown>(
				localStorage,
				purchaseKey,
				(current) => !isRecoverableBatch(current, walletAddress)
			);
		}
		try {
			const pendingOperationKey = operationStorageKey(params.asset.id, walletAddress);
			const saved = loadWalletRecord<unknown>(
				localStorage,
				pendingOperationKey,
				`bazar-operation:${params.asset.id}`,
				(record) => isSavedFungibleOperationRecord(record, walletAddress)
			);
			if (!isSavedFungibleOperationRecord(saved, walletAddress)) {
				setUnavailableRecovery((current) => (current?.key === pendingOperationKey ? null : current));
				return;
			}
			try {
				new AssetTransactionClient().restore(saved.txId, walletAddress);
			} catch {
				// The signed transaction is gone from this browser; decide from live state whether it can still apply.
				const canStillApply = operationRecoveryCanStillApply(params.state, walletAddress, saved, 'fungible');
				if (!canStillApply) {
					if (
						removeWalletRecoveryAndSignatures(
							localStorage,
							pendingOperationKey,
							(record: unknown) =>
								savedOperationRecordMatches(record, {
									assetId: params.asset.id,
									signer: walletAddress,
									txId: saved.txId,
								}),
							[saved.txId],
							walletAddress
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
						signer: walletAddress,
						txId: saved.txId,
					});
				}
				return;
			}
			setUnavailableRecovery(null);
			const resumeOperation = savedFungibleOperation(saved);
			if (resumeOperation) open(resumeOperation, { show: false });
		} catch {
			// A malformed saved action cannot resume; discard only this asset's record.
			removeWalletRecord(localStorage, operationStorageKey(params.asset.id, walletAddress));
		}
	}, [hasWalletActivities, open, params.asset.id, params.state, recoverySuppressed, storageVersion, walletAddress]);

	React.useEffect(() => {
		const requestedId = (location.state as { fungibleOperationActivityId?: unknown } | null)
			?.fungibleOperationActivityId;
		if (typeof requestedId !== 'string') return;
		if (navigationType === 'POP') {
			navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
			return;
		}
		if (!operationActivities.some((activity) => activity.id === requestedId)) return;
		setOperationActivities((current) => revealFungibleOperationActivity(current, requestedId));
		navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
	}, [location.pathname, location.search, location.state, navigate, navigationType, operationActivities]);

	const change = React.useCallback(
		(id: string, update: ActivityUpdate) => {
			const activity = operationActivitiesRef.current.find((candidate) => candidate.id === id);
			if (activity) publish(activity, update.phase, update);
			setOperationActivities((current) =>
				current.map((candidate) => (candidate.id === id ? { ...candidate, phase: update.phase } : candidate))
			);
			if (update.phase === 'done') void onRefresh();
		},
		[onRefresh, publish]
	);

	const signedRecoveryLocksAsset = Boolean(
		walletAddress && assetHasSavedSignedAction(localStorage, params.asset.id, walletAddress)
	);
	const recoveryBlocksActions = recoverySuppressed || Boolean(unavailableRecovery) || signedRecoveryLocksAsset;

	return {
		walletActivities,
		hasBusyWalletActivities: walletActivities.some((activity) => (activity.phase ?? 'form') !== 'error'),
		activePurchaseActivity,
		activeAssetActivity,
		recoverySuppressed,
		recoveryNotice,
		unavailableRecovery,
		purchaseBlocksActions: recoveryBlocksActions || Boolean(activePurchaseActivity),
		assetBlocksActions: recoveryBlocksActions || Boolean(activeAssetActivity),
		open,
		show,
		hide: (id) =>
			setOperationActivities((current) =>
				current.map((activity) => (activity.id === id ? { ...activity, visible: false } : activity))
			),
		change,
		restart: (id) => {
			setRecoverySuppressed(false);
			setOperationActivities((current) =>
				current.map((activity) => (activity.id === id ? restartFungibleOperationActivity(activity) : activity))
			);
		},
		close: (activity, resumeLater, refresh = true) => {
			setRecoverySuppressed(Boolean(resumeLater));
			if (!resumeLater) publish(activity, 'done');
			setOperationActivities((current) =>
				resumeLater
					? current.map((candidate) =>
							candidate.id === activity.id ? { ...candidate, visible: false } : candidate
					  )
					: current.filter((candidate) => candidate.id !== activity.id)
			);
			if (refresh) void onRefresh();
		},
		resumeRecovery: () => setRecoverySuppressed(false),
		dismissRecoveryNotice: () => setRecoveryNotice(''),
		discardUnavailableRecovery: () => {
			if (!unavailableRecovery) return;
			const removed = removeWalletRecoveryAndSignatures<unknown>(
				localStorage,
				unavailableRecovery.key,
				(record) => {
					const candidate = record as { signer?: unknown; txId?: unknown } | null;
					return (
						candidate?.signer === unavailableRecovery.signer && candidate?.txId === unavailableRecovery.txId
					);
				},
				[unavailableRecovery.txId],
				unavailableRecovery.signer
			);
			if (removed) {
				setUnavailableRecovery(null);
				setRecoveryNotice(
					'Local tracking was discarded. Current balances and orders above remain the live source of truth.'
				);
			}
		},
	};
}
