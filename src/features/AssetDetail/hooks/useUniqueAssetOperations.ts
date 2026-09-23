import React from 'react';

import type { AssetSummary } from 'api/collections';
import type { AssetState } from 'api/marketplace';
import {
	atomicPurchaseStorageKey,
	clearStaleWalletOperationClaim,
	loadWalletRecord,
	type Operation,
	operationClaimStorageKey,
	operationStorageKey,
	removeWalletRecord,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	walletOperationStorageChange,
} from 'api/operations';
import { loadAtomicTransactionRuntime, preloadAtomicTransactionRuntime } from 'api/transactions';

import {
	currentPurchaseGatewayContext,
	hasStoredSignedTransaction,
	type UnavailableOperationRecovery,
} from 'features/Operations';
import { preloadArweaveTransactionSync } from 'features/TransactionSync';
import { type OperationActivity, useOperationActivity } from 'providers/OperationActivityProvider';

import {
	activeAssetOperation,
	INITIAL_UNIQUE_ASSET_RECOVERY,
	isSavedAtomicOperation,
	isStoredAtomicPurchase,
	recoveryStorageReaction,
	registrationRecoveryOrder,
	resumedRegistrationOperation,
	resumedSavedOperation,
	type SavedAtomicOperation,
	savedOperationRecordMatches,
	savedPurchaseRecoveryPlan,
	type StoredAtomicPurchase,
	storedPurchaseDiscardable,
	unavailableRecoveryRecordMatches,
	type UniqueAssetRecoveryNotice,
	uniqueAssetRecoveryReducer,
	unrestorableOperationPlan,
} from '../model/unique-asset-recovery';

export type UniqueAssetOperations = {
	/** This wallet's unfinished operation on the asset, shown in the shared operation activity. */
	activity: OperationActivity | undefined;
	operation: Operation | null;
	/** Receives focus when an operation dialog closes without a better target. */
	focusFallbackRef: React.RefObject<HTMLHeadingElement>;
	notice: UniqueAssetRecoveryNotice | null;
	unavailableRecovery: UnavailableOperationRecovery | null;
	openOperation(operation: Operation, options?: { show?: boolean }): void;
	showOperation(id: string): void;
	dismissNotice(): void;
	discardUnavailableRecovery(): void;
};

function loadSavedPurchase(key: string, assetId: string, buyer: string): StoredAtomicPurchase | null {
	try {
		const record = loadWalletRecord<unknown>(localStorage, key, `bazar-purchase:${assetId}`, (candidate) =>
			isStoredAtomicPurchase(candidate, buyer)
		);
		return isStoredAtomicPurchase(record, buyer) ? record : null;
	} catch {
		removeWalletRecord(localStorage, key);
		return null;
	}
}

function loadSavedOperation(key: string, assetId: string, signer: string): SavedAtomicOperation | null {
	try {
		const record = loadWalletRecord<unknown>(localStorage, key, `bazar-operation:${assetId}`, (candidate) =>
			isSavedAtomicOperation(candidate, signer)
		);
		return isSavedAtomicOperation(record, signer) ? record : null;
	} catch {
		removeWalletRecord(localStorage, key);
		return null;
	}
}

/**
 * Atomic operations on a unique asset: starts listing, purchase, cancellation, and transfer flows in the shared
 * operation activity, and resumes signed actions this wallet saved in the browser. Recovery re-runs whenever live
 * state, the wallet, or this wallet's saved records change (including from another tab), never while an operation
 * is already open, and never signs anything itself.
 */
export function useUniqueAssetOperations(input: {
	assetId: string;
	collectionId: string;
	walletAddress: string | null;
	verifiedAsset: AssetSummary | null | undefined;
	state: AssetState | null;
	refreshAsset(): Promise<void>;
}): UniqueAssetOperations {
	const operationActivity = useOperationActivity();
	const startOperationActivity = operationActivity.start;
	const removeOperationActivity = operationActivity.remove;
	const focusFallbackRef = React.useRef<HTMLHeadingElement>(null);
	const [recovery, dispatchRecovery] = React.useReducer(uniqueAssetRecoveryReducer, INITIAL_UNIQUE_ASSET_RECOVERY);
	const activity = activeAssetOperation(operationActivity.activities, input.assetId, input.walletAddress);
	const operation = activity?.operation ?? null;
	const operationFocusFallback = React.useCallback(() => focusFallbackRef.current, []);

	const openOperation = React.useCallback(
		(next: Operation, options?: { show?: boolean }) => {
			if (!input.walletAddress || !input.verifiedAsset) return;
			preloadAtomicTransactionRuntime();
			preloadArweaveTransactionSync();
			startOperationActivity(
				{
					asset: input.verifiedAsset,
					collectionId: input.collectionId,
					owner: input.walletAddress,
					operation: next,
					restoreFallback: operationFocusFallback,
				},
				options
			);
		},
		[input.collectionId, input.verifiedAsset, input.walletAddress, operationFocusFallback, startOperationActivity]
	);

	React.useEffect(() => {
		if (!input.walletAddress) return;
		const claimKey = operationClaimStorageKey(input.assetId, input.walletAddress);
		const recoveryKeys = [
			operationStorageKey(input.assetId, input.walletAddress),
			atomicPurchaseStorageKey(input.assetId, input.walletAddress),
		];
		const handleStorage = (event: StorageEvent) => {
			if (event.storageArea && event.storageArea !== localStorage) return;
			const change = walletOperationStorageChange(event.key, event.newValue, claimKey, recoveryKeys);
			const reaction = recoveryStorageReaction(change, activity?.operation ?? null);
			if (!reaction) return;
			if (reaction.removeActivity && activity) removeOperationActivity(activity.id);
			if (reaction.refresh) void input.refreshAsset();
			dispatchRecovery({ type: 'storage-changed' });
		};
		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	}, [activity, input.assetId, input.refreshAsset, input.walletAddress, removeOperationActivity]);

	React.useEffect(() => {
		dispatchRecovery({ type: 'reset' });
	}, [input.assetId, input.walletAddress]);

	React.useEffect(() => {
		if (!input.walletAddress || operation || !input.state) return;
		if (input.state.totalSupply !== '1' || input.state.denomination > 0) return;
		const assetId = input.assetId;
		const walletAddress = input.walletAddress;
		const state = input.state;
		const controller = new AbortController();
		const activeClaimKey = operationClaimStorageKey(assetId, walletAddress);
		if (localStorage.getItem(activeClaimKey)) {
			void clearStaleWalletOperationClaim(localStorage, activeClaimKey, { signal: controller.signal })
				.then((cleared) => {
					if (!controller.signal.aborted && cleared) dispatchRecovery({ type: 'storage-changed' });
				})
				// An aborted or unavailable lock check leaves the claim to the next storage change.
				.catch(() => undefined);
			return () => controller.abort();
		}
		void (async () => {
			if (controller.signal.aborted) return;
			const purchaseKey = atomicPurchaseStorageKey(assetId, walletAddress);
			const pendingOperationKey = operationStorageKey(assetId, walletAddress);
			const purchasePlan = savedPurchaseRecoveryPlan(
				state,
				walletAddress,
				loadSavedPurchase(purchaseKey, assetId, walletAddress),
				currentPurchaseGatewayContext()
			);
			if (purchasePlan.kind === 'discard') {
				removeWalletRecordIf<unknown>(localStorage, purchaseKey, (record) =>
					storedPurchaseDiscardable(record, walletAddress, purchasePlan.orderId)
				);
			} else if (purchasePlan.kind === 'resume') {
				if (purchasePlan.gatewayNotice) {
					dispatchRecovery({
						type: 'notice',
						notice: { kind: 'gateway-switch', message: purchasePlan.gatewayNotice },
					});
				}
				openOperation(purchasePlan.operation, { show: false });
				return;
			} else if (purchasePlan.kind === 'paused') {
				dispatchRecovery({ type: 'notice', notice: { kind: 'purchase-paused' } });
			}

			const savedOperation = loadSavedOperation(pendingOperationKey, assetId, walletAddress);
			const registrationOrder = registrationRecoveryOrder(state, walletAddress);
			const mayHaveRegistration = Boolean(registrationOrder && hasStoredSignedTransaction(localStorage));
			if (!savedOperation && !mayHaveRegistration) {
				dispatchRecovery({ type: 'recovery-cleared', key: pendingOperationKey });
				return;
			}

			const { AssetTransactionClient } = await loadAtomicTransactionRuntime();
			if (controller.signal.aborted) return;
			const client = new AssetTransactionClient();
			if (mayHaveRegistration && registrationOrder) {
				const registrationId = client.findStoredRegistration(assetId, registrationOrder.orderId, walletAddress);
				if (registrationId) {
					openOperation(resumedRegistrationOperation(registrationOrder, registrationId), { show: false });
					return;
				}
			}
			if (!savedOperation) return;

			try {
				client.restore(savedOperation.txId, walletAddress);
			} catch {
				const plan = unrestorableOperationPlan(state, walletAddress, savedOperation, pendingOperationKey);
				if (plan.kind === 'unavailable') {
					dispatchRecovery({ type: 'recovery-unavailable', recovery: plan.recovery });
				} else if (
					removeWalletRecoveryAndSignatures<unknown>(
						localStorage,
						pendingOperationKey,
						(record) => savedOperationRecordMatches(record, assetId, walletAddress, savedOperation.txId),
						[savedOperation.txId],
						walletAddress
					)
				) {
					dispatchRecovery({ type: 'stale-action-removed' });
				}
				return;
			}
			dispatchRecovery({ type: 'recovery-cleared' });
			const resumed = resumedSavedOperation(savedOperation);
			if (resumed) openOperation(resumed, { show: false });
		})()
			// Recovery is best effort: live state stays authoritative and the next change re-evaluates it.
			.catch(() => undefined);
		return () => controller.abort();
	}, [input.assetId, input.state, input.walletAddress, openOperation, operation, recovery.storageVersion]);

	const unavailableRecovery = recovery.unavailable;
	const discardUnavailableRecovery = React.useCallback(() => {
		if (!unavailableRecovery) return;
		const removed = removeWalletRecoveryAndSignatures<unknown>(
			localStorage,
			unavailableRecovery.key,
			(record) => unavailableRecoveryRecordMatches(record, unavailableRecovery),
			[unavailableRecovery.txId],
			unavailableRecovery.signer
		);
		if (removed) dispatchRecovery({ type: 'tracking-discarded' });
	}, [unavailableRecovery]);
	const dismissNotice = React.useCallback(() => dispatchRecovery({ type: 'notice-dismissed' }), []);

	return {
		activity,
		operation,
		focusFallbackRef,
		notice: recovery.notice,
		unavailableRecovery,
		openOperation,
		showOperation: operationActivity.show,
		dismissNotice,
		discardUnavailableRecovery,
	};
}
