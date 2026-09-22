import React from 'react';
import { useNavigate } from 'react-router-dom';

import { readAssetStateCached } from 'api/marketplace';
import {
	advanceMintActivity,
	loadMintActivities,
	MINT_ACTIVITY_CHANGE_EVENT,
	type MintActivity,
	mintActivityNeedsAttention,
	type MintUploadTransaction,
	observeMintActivity,
	removeMintActivity,
	upsertMintActivity,
} from 'api/mint';
import {
	atomicOperationActivityId,
	atomicPurchaseRecoveryCanBeDiscarded,
	atomicPurchaseStorageKey,
	deriveFungibleOperationActivities,
	deriveOperationActivities,
	FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT,
	FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY,
	fungibleActivityHasRecovery,
	fungibleBatchStorageKey,
	type FungibleOperationActivityChange,
	type FungibleOperationActivitySummary,
	fungiblePurchaseRecoveryCanBeDiscarded,
	isWalletOperationRecoveryKey,
	type Operation,
	type OperationActivity as StoredOperationActivity,
	type OperationActivityPhase,
	operationRecoveryCanStillApply,
	operationStorageKey,
	purchaseRecoveryApprovalCount,
	reduceFungibleRuntimeActivities,
	removeWalletRecoveryAndSignatures,
	saveFungibleOperationActivities,
	saveOperationActivities,
	WALLET_OPERATION_RECOVERY_CHANGE_EVENT,
} from 'api/operations';
import type { Consensus, ObserverView } from 'api/transactions';

import { mapConcurrent } from 'helpers/concurrency';
import { scheduleIdleTask } from 'helpers/idle';
import { useMarketProvider } from 'providers/MarketProvider';
import { useWallet } from 'providers/WalletProvider';

export type OperationActivity = StoredOperationActivity & {
	origin: 'runtime' | 'restored';
	restoreFallback(): HTMLElement | null;
};

export type UploadActivity = {
	id: string;
	owner: string;
	kind: 'asset' | 'collection';
	name: string;
	phase: 'working' | 'tracking' | 'done' | 'error';
	status: string;
	createdAt: number;
	transactionIds: string[];
	extended?: boolean;
	transactions: MintUploadTransaction[];
	assetId?: string;
	assetIds?: string[];
	collectionId?: string;
};

type OperationActivityContextValue = {
	activities: OperationActivity[];
	fungibleActivities: FungibleOperationActivitySummary[];
	mintActivities: MintActivity[];
	uploadActivities: UploadActivity[];
	activeId: string | null;
	start(
		input: Pick<OperationActivity, 'asset' | 'collectionId' | 'owner' | 'operation' | 'restoreFallback'>,
		options?: { show?: boolean }
	): void;
	show(id: string): void;
	showFungible(id: string): void;
	showUpload(id: string): void;
	showMint(id: string): void;
	beginUpload(input: Pick<UploadActivity, 'id' | 'owner' | 'kind' | 'name' | 'status'>): void;
	updateUpload(id: string, status: string): void;
	recordUploadTransaction(id: string, transaction: MintUploadTransaction): void;
	finishUpload(
		id: string,
		result: Pick<UploadActivity, 'transactionIds'> &
			Partial<Pick<UploadActivity, 'assetId' | 'assetIds' | 'collectionId' | 'extended'>>
	): void;
	failUpload(id: string, status: string): void;
	hide(): void;
	remove(id: string): void;
	activeUploadId: string | null;
	activeMintId: string | null;
	mintNotice: MintActivity | null;
	dismissMintNotice(): void;
	update(
		id: string,
		patch: Pick<OperationActivity, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>,
		assetId: string
	): void;
	updateOperation(id: string, operation: Operation): void;
	removeUpload(id: string): void;
	hideOperation(): void;
	hideUpload(): void;
	hideMint(): void;
};

const OperationActivityContext = React.createContext<OperationActivityContextValue | null>(null);

export default function OperationActivityProvider(props: React.PropsWithChildren) {
	const navigate = useNavigate();
	const wallet = useWallet();
	const market = useMarketProvider();
	const [activities, setActivities] = React.useState<OperationActivity[]>([]);
	const [fungibleActivities, setFungibleActivities] = React.useState<FungibleOperationActivitySummary[]>([]);
	const [mintActivities, setMintActivities] = React.useState<MintActivity[]>([]);
	const [uploadActivities, setUploadActivities] = React.useState<UploadActivity[]>([]);
	const [mintNotice, setMintNotice] = React.useState<MintActivity | null>(null);
	const [activeId, setActiveId] = React.useState<string | null>(null);
	const [activeUploadId, setActiveUploadId] = React.useState<string | null>(null);
	const [activeMintId, setActiveMintId] = React.useState<string | null>(null);
	const [hydratedOwners, setHydratedOwners] = React.useState<string[]>([]);
	const [recoveryValidationRetry, setRecoveryValidationRetry] = React.useState(0);
	const fungibleRuntimeActivitiesRef = React.useRef<FungibleOperationActivitySummary[]>([]);
	const mintWatchersRef = React.useRef(new Map<string, AbortController>());
	const activitiesRef = React.useRef(activities);
	activitiesRef.current = activities;
	const refreshOperationActivities = React.useCallback(() => {
		const owner = wallet.address;
		if (!owner) return;
		const restored = deriveOperationActivities(localStorage, owner, market.collections).map((activity) => ({
			...activity,
			origin: 'restored' as const,
			restoreFallback: () => null,
		}));
		setActivities((current) => {
			const runtime = current.filter((activity) => activity.origin === 'runtime');
			const runtimeAssets = new Set(
				runtime.filter((activity) => activity.owner === owner).map((activity) => activity.asset.id)
			);
			const otherOwners = current.filter(
				(activity) => activity.origin === 'restored' && activity.owner !== owner
			);
			return [
				...runtime,
				...otherOwners,
				...restored.filter((activity) => !runtimeAssets.has(activity.asset.id)),
			].sort((left, right) => right.createdAt - left.createdAt);
		});
		setHydratedOwners((current) => (current.includes(owner) ? current : [...current, owner]));
	}, [market.collections, wallet.address]);
	React.useEffect(() => refreshOperationActivities(), [refreshOperationActivities]);
	React.useEffect(() => {
		if (!hydratedOwners.length) return;
		saveOperationActivities(localStorage, activities, hydratedOwners);
	}, [activities, hydratedOwners]);
	const refreshFungibleActivities = React.useCallback(
		(runtime = fungibleRuntimeActivitiesRef.current) => {
			const owner = wallet.address;
			if (!owner) {
				setFungibleActivities([]);
				return;
			}
			const derived = deriveFungibleOperationActivities(localStorage, owner, market.collections, runtime);
			saveFungibleOperationActivities(
				localStorage,
				derived.filter((activity) => fungibleActivityHasRecovery(localStorage, activity)),
				[owner]
			);
			setFungibleActivities(derived);
		},
		[market.collections, wallet.address]
	);
	React.useEffect(() => refreshFungibleActivities(), [refreshFungibleActivities]);
	const refreshMintActivities = React.useCallback(() => {
		setMintActivities(loadMintActivities(localStorage));
	}, []);
	React.useEffect(() => refreshMintActivities(), [refreshMintActivities]);
	React.useEffect(() => {
		const refresh = () => refreshMintActivities();
		const refreshStorage = (event: StorageEvent) => {
			if (event.key === 'bazar-mint-activities:v1') refreshMintActivities();
		};
		window.addEventListener(MINT_ACTIVITY_CHANGE_EVENT, refresh);
		window.addEventListener('storage', refreshStorage);
		return () => {
			window.removeEventListener(MINT_ACTIVITY_CHANGE_EVENT, refresh);
			window.removeEventListener('storage', refreshStorage);
		};
	}, [refreshMintActivities]);
	React.useEffect(() => {
		const completeUpload = (event: Event) => {
			const completed = (event as CustomEvent<MintActivity>).detail;
			if (!completed?.asset?.id) return;
			setUploadActivities((current) =>
				current.map((activity) =>
					activity.assetId === completed.asset.id
						? { ...activity, phase: 'done', status: 'Live on Bazar.' }
						: activity
				)
			);
		};
		window.addEventListener('bazar:mint-live', completeUpload);
		return () => window.removeEventListener('bazar:mint-live', completeUpload);
	}, []);
	React.useEffect(() => {
		for (const activity of mintActivities) {
			if (
				mintWatchersRef.current.has(activity.id) ||
				activity.phase === 'complete' ||
				mintActivityNeedsAttention(activity)
			)
				continue;
			const controller = new AbortController();
			mintWatchersRef.current.set(activity.id, controller);
			void observeMintActivity(
				activity,
				(phase) => {
					const current = loadMintActivities(localStorage).find((candidate) => candidate.id === activity.id);
					if (!current) return;
					const updated = advanceMintActivity(current, phase);
					upsertMintActivity(localStorage, updated);
					if (phase !== 'complete') return;
					setMintNotice(updated);
					window.dispatchEvent(new CustomEvent('bazar:mint-live', { detail: updated }));
					if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
						try {
							new Notification(`${updated.asset.name} is live on Bazar`, {
								body: 'The accepted Arweave upload is now available in live process state.',
							});
						} catch {
							// The in-app completion notice remains available when system notifications fail.
						}
					}
					removeMintActivity(localStorage, updated.id);
				},
				controller.signal
			)
				.catch(() => undefined)
				.finally(() => mintWatchersRef.current.delete(activity.id));
		}
		const active = new Set(
			mintActivities.filter((activity) => !mintActivityNeedsAttention(activity)).map((activity) => activity.id)
		);
		for (const [id, controller] of mintWatchersRef.current) {
			if (!active.has(id)) {
				controller.abort();
				mintWatchersRef.current.delete(id);
			}
		}
	}, [mintActivities]);
	React.useEffect(
		() => () => {
			for (const controller of mintWatchersRef.current.values()) controller.abort();
			mintWatchersRef.current.clear();
		},
		[]
	);
	React.useEffect(() => {
		const updateRuntimeActivity = (event: Event) => {
			const change = (event as CustomEvent<FungibleOperationActivityChange>).detail;
			if (!change || (change.type !== 'upsert' && change.type !== 'remove')) return;
			const next = reduceFungibleRuntimeActivities(fungibleRuntimeActivitiesRef.current, change);
			fungibleRuntimeActivitiesRef.current = next;
			refreshFungibleActivities(next);
		};
		const refreshCurrentDocument = (event: Event) => {
			if (!isWalletOperationRecoveryKey((event as CustomEvent<string>).detail)) return;
			refreshOperationActivities();
			refreshFungibleActivities();
		};
		const refreshFromStorage = (event: StorageEvent) => {
			if (isWalletOperationRecoveryKey(event.key)) {
				refreshOperationActivities();
				refreshFungibleActivities();
			} else if (event.key === FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY) refreshFungibleActivities();
		};
		window.addEventListener(FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT, updateRuntimeActivity);
		window.addEventListener(WALLET_OPERATION_RECOVERY_CHANGE_EVENT, refreshCurrentDocument);
		window.addEventListener('storage', refreshFromStorage);
		return () => {
			window.removeEventListener(FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT, updateRuntimeActivity);
			window.removeEventListener(WALLET_OPERATION_RECOVERY_CHANGE_EVENT, refreshCurrentDocument);
			window.removeEventListener('storage', refreshFromStorage);
		};
	}, [refreshFungibleActivities, refreshOperationActivities]);
	const recoveryValidationKey = JSON.stringify(
		[
			...activities
				.filter((activity) => activity.origin === 'restored' && activity.owner === wallet.address)
				.map((activity) => ({ assetId: activity.asset.id, family: 'atomic', kind: activity.operation.kind })),
			...fungibleActivities
				.filter((activity) => activity.owner === wallet.address)
				.map((activity) => ({ assetId: activity.asset.id, family: 'fungible', kind: activity.operationKind })),
		].sort((left, right) =>
			`${left.family}:${left.assetId}:${left.kind}`.localeCompare(
				`${right.family}:${right.assetId}:${right.kind}`
			)
		)
	);
	React.useEffect(() => {
		const owner = wallet.address;
		if (!owner) return;
		const candidates = JSON.parse(recoveryValidationKey) as Array<{
			assetId: string;
			family: 'atomic' | 'fungible';
			kind: 'sell' | 'transfer' | 'cancel' | 'buy';
		}>;
		if (!candidates.length) return;
		const controller = new AbortController();
		let retryTimer: number | undefined;
		const validate = async (candidate: (typeof candidates)[number]) => {
			const key =
				candidate.kind === 'buy'
					? candidate.family === 'atomic'
						? atomicPurchaseStorageKey(candidate.assetId, owner)
						: fungibleBatchStorageKey(candidate.assetId, owner)
					: operationStorageKey(candidate.assetId, owner);
			const serialized = localStorage.getItem(key);
			if (!serialized) return;
			let record: any;
			try {
				record = JSON.parse(serialized);
			} catch {
				return;
			}
			const { state } = await readAssetStateCached(candidate.assetId, {
				cacheTtlMs: 20_000,
				maxAge: 60,
				maxAttempts: 1,
				signal: controller.signal,
			});
			if (controller.signal.aborted || localStorage.getItem(key) !== serialized) return;
			if (candidate.kind === 'buy') {
				const discard =
					candidate.family === 'atomic'
						? record?.buyer === owner &&
						  record?.order &&
						  record?.snapshot &&
						  atomicPurchaseRecoveryCanBeDiscarded(state, owner, record.order, record.snapshot)
						: record?.buyer === owner && fungiblePurchaseRecoveryCanBeDiscarded(state, owner, record);
				if (!discard) return;
				const transactionIds =
					candidate.family === 'atomic'
						? [record.snapshot?.registration?.id, record.snapshot?.payment?.id]
						: (record.entries ?? []).flatMap((entry: any) => [
								entry?.snapshot?.registration?.id,
								entry?.snapshot?.payment?.id,
						  ]);
				removeWalletRecoveryAndSignatures<any>(
					localStorage,
					key,
					(current) => current?.buyer === owner,
					transactionIds,
					owner
				);
				return;
			}
			if (operationRecoveryCanStillApply(state, owner, record, candidate.family)) return;
			removeWalletRecoveryAndSignatures<any>(
				localStorage,
				key,
				(current) => current?.signer === owner && current?.txId === record?.txId,
				[record?.txId],
				owner
			);
		};
		const cancelIdleValidation = scheduleIdleTask(() => {
			void mapConcurrent(candidates, 2, async (candidate) => {
				if (controller.signal.aborted) return false;
				try {
					await validate(candidate);
					return false;
				} catch {
					return true;
				}
			}).then((failed) => {
				if (controller.signal.aborted || !failed.includes(true)) return;
				const delay = Math.min(60_000, 5_000 * 2 ** Math.min(recoveryValidationRetry, 4));
				retryTimer = window.setTimeout(() => setRecoveryValidationRetry((attempt) => attempt + 1), delay);
			});
		}, 750);
		return () => {
			cancelIdleValidation();
			controller.abort();
			if (retryTimer !== undefined) window.clearTimeout(retryTimer);
		};
	}, [recoveryValidationKey, recoveryValidationRetry, wallet.address]);
	const start = React.useCallback(
		(
			input: Pick<OperationActivity, 'asset' | 'collectionId' | 'owner' | 'operation' | 'restoreFallback'>,
			options?: { show?: boolean }
		) => {
			const show = options?.show ?? true;
			const id = atomicOperationActivityId(input.asset.id, input.owner);
			const existing = activitiesRef.current.find(
				(activity) =>
					activity.asset.id === input.asset.id && activity.owner === input.owner && activity.phase !== 'done'
			);
			if (existing) {
				if (show) {
					setActiveUploadId(null);
					setActiveMintId(null);
					setActiveId(existing.id);
				}
				return;
			}
			const phase: OperationActivityPhase =
				input.operation.kind === 'buy' && input.operation.resume
					? purchaseRecoveryApprovalCount(input.operation.resume)
						? 'approval'
						: 'working'
					: input.operation.kind !== 'buy' && input.operation.resumeId
					? 'working'
					: 'form';
			setActivities((current) => {
				if (
					current.some(
						(activity) =>
							activity.asset.id === input.asset.id &&
							activity.owner === input.owner &&
							activity.phase !== 'done'
					)
				) {
					return current;
				}
				return [
					{
						...input,
						id,
						phase,
						status:
							phase === 'approval'
								? 'Waiting for wallet approval'
								: phase === 'working'
								? 'Starting transaction…'
								: 'Waiting for details',
						confirmations: 0,
						confirmationTarget: 5,
						createdAt: Date.now(),
						origin: 'runtime',
					},
					...current,
				];
			});
			if (show) {
				setActiveUploadId(null);
				setActiveMintId(null);
				setActiveId(id);
			}
		},
		[]
	);
	const update = React.useCallback(
		(
			id: string,
			patch: Pick<OperationActivity, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>,
			assetId: string
		) => {
			setActivities((current) =>
				current.map((activity) => (activity.id === id ? { ...activity, ...patch } : activity))
			);
			if (patch.phase === 'done') {
				queueMicrotask(() =>
					window.dispatchEvent(new CustomEvent('bazar:asset-operation-finished', { detail: assetId }))
				);
			}
		},
		[]
	);
	const updateOperation = React.useCallback((id: string, operation: Operation) => {
		setActivities((current) =>
			current.map((activity) => (activity.id === id ? { ...activity, operation } : activity))
		);
	}, []);
	const remove = React.useCallback((id: string) => {
		setActivities((current) => current.filter((activity) => activity.id !== id));
		setActiveId((current) => (current === id ? null : current));
	}, []);
	const beginUpload = React.useCallback(
		(input: Pick<UploadActivity, 'id' | 'owner' | 'kind' | 'name' | 'status'>) => {
			setUploadActivities((current) => [
				{ ...input, phase: 'working', createdAt: Date.now(), transactionIds: [], transactions: [] },
				...current.filter((activity) => activity.id !== input.id),
			]);
			setActiveId(null);
			setActiveMintId(null);
			setActiveUploadId(input.id);
		},
		[]
	);
	const updateUpload = React.useCallback((id: string, status: string) => {
		setUploadActivities((current) =>
			current.map((activity) => (activity.id === id ? { ...activity, phase: 'working', status } : activity))
		);
	}, []);
	const recordUploadTransaction = React.useCallback((id: string, transaction: MintUploadTransaction) => {
		setUploadActivities((current) =>
			current.map((activity) =>
				activity.id === id && !activity.transactions.some((candidate) => candidate.id === transaction.id)
					? { ...activity, transactions: [...activity.transactions, transaction] }
					: activity
			)
		);
	}, []);
	const finishUpload = React.useCallback(
		(
			id: string,
			result: Pick<UploadActivity, 'transactionIds'> &
				Partial<Pick<UploadActivity, 'assetId' | 'assetIds' | 'collectionId' | 'extended'>>
		) => {
			setUploadActivities((current) =>
				current.map((activity) =>
					activity.id === id
						? {
								...activity,
								...result,
								phase: result.assetId ? 'tracking' : 'done',
								status: result.assetId
									? 'Submitted; accepted by Arweave. Waiting for live process state.'
									: activity.kind === 'collection' && result.extended
									? 'Collection manifest update submitted to Arweave.'
									: 'Collection process submitted to Arweave.',
						  }
						: activity
				)
			);
		},
		[]
	);
	const failUpload = React.useCallback((id: string, status: string) => {
		setUploadActivities((current) =>
			current.map((activity) => (activity.id === id ? { ...activity, phase: 'error', status } : activity))
		);
	}, []);
	const removeUpload = React.useCallback((id: string) => {
		setUploadActivities((current) => current.filter((activity) => activity.id !== id));
		setActiveUploadId((current) => (current === id ? null : current));
	}, []);
	React.useEffect(() => {
		if (!activities.some((activity) => activity.phase === 'done' && activity.id !== activeId)) return;
		setActivities((current) => current.filter((activity) => activity.phase !== 'done' || activity.id === activeId));
	}, [activeId, activities]);
	const value = React.useMemo<OperationActivityContextValue>(
		() => ({
			activities,
			fungibleActivities,
			mintActivities,
			uploadActivities,
			activeId,
			start,
			show: (id) => {
				setActiveUploadId(null);
				setActiveMintId(null);
				setActiveId(id);
			},
			showFungible: (id) => {
				const activity = fungibleActivities.find((candidate) => candidate.id === id);
				if (!activity) return;
				setActiveId(null);
				setActiveUploadId(null);
				setActiveMintId(null);
				navigate(`/asset/${activity.collectionId}/${activity.asset.id}`, {
					state: { fungibleOperationActivityId: activity.id },
				});
			},
			showMint: (id) => {
				setActiveId(null);
				setActiveUploadId(null);
				setActiveMintId(id);
			},
			showUpload: (id) => {
				setActiveId(null);
				setActiveMintId(null);
				setActiveUploadId(id);
			},
			beginUpload,
			updateUpload,
			recordUploadTransaction,
			finishUpload,
			failUpload,
			hide: () => {
				setActiveId(null);
				setActiveUploadId(null);
				setActiveMintId(null);
			},
			remove,
			activeUploadId,
			activeMintId,
			mintNotice,
			dismissMintNotice: () => setMintNotice(null),
			update,
			updateOperation,
			removeUpload,
			hideOperation: () => setActiveId(null),
			hideUpload: () => setActiveUploadId(null),
			hideMint: () => setActiveMintId(null),
		}),
		[
			activeId,
			activeMintId,
			activeUploadId,
			activities,
			beginUpload,
			failUpload,
			finishUpload,
			fungibleActivities,
			mintActivities,
			mintNotice,
			navigate,
			recordUploadTransaction,
			remove,
			removeUpload,
			start,
			update,
			updateOperation,
			updateUpload,
			uploadActivities,
		]
	);
	return <OperationActivityContext.Provider value={value}>{props.children}</OperationActivityContext.Provider>;
}

export function useOperationActivity() {
	const value = React.useContext(OperationActivityContext);
	if (!value) throw new Error('operation-activity-provider-missing');
	return value;
}

export type UploadObserverState = Record<string, { views: ObserverView[]; consensus?: Consensus }>;
