import type { PurchaseSnapshot } from 'weave-wrangler';

import type { SwapOrder } from 'api/asset-marketplace';
import type { AssetSummary, Collection } from 'api/collections';

import {
	atomicPurchaseStorageKey,
	fungibleBatchStorageKey,
	hasRecoverablePurchase,
	operationStorageKey,
} from './operation-session';

export const OPERATION_ACTIVITY_STORAGE_KEY = 'bazar-operation-activities:v1';
export const FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY = 'bazar-fungible-operation-activities:v1';
export const FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT = 'bazar:fungible-operation-activities-changed';

export type Operation =
	| { kind: 'sell'; resumeId?: string; value?: string }
	| { kind: 'transfer'; resumeId?: string; startingSlot?: number; value?: string }
	| { kind: 'cancel'; order: SwapOrder; resumeId?: string; startingSlot?: number }
	| { kind: 'buy'; order: SwapOrder; resume?: PurchaseSnapshot; externalOrigin?: boolean };

export type OperationActivityPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

export type OperationActivity = {
	id: string;
	asset: AssetSummary;
	collectionId: string;
	owner: string;
	operation: Operation;
	phase: OperationActivityPhase;
	status: string;
	confirmations: number;
	confirmationTarget: number;
	createdAt: number;
};

type ActivityStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type EnumerableActivityStorage = ActivityStorage & Pick<Storage, 'key' | 'length'>;

export type FungibleOperationKind = 'sell' | 'transfer' | 'cancel' | 'buy';

export type FungibleOperationActivitySummary = {
	id: string;
	asset: AssetSummary;
	collectionId: string;
	owner: string;
	operationKind: FungibleOperationKind;
	phase: OperationActivityPhase;
	status: string;
	createdAt: number;
};

export type FungibleOperationActivityChange =
	| { type: 'upsert'; activity: FungibleOperationActivitySummary }
	| { type: 'remove'; id: string; owner: string };

type StoredPurchase = {
	activityKind?: unknown;
	asset?: unknown;
	buyer?: unknown;
	collectionId?: unknown;
	order?: unknown;
	snapshot?: unknown;
	createdAt?: unknown;
};

type StoredOperation = {
	activityKind?: unknown;
	asset?: unknown;
	collectionId?: unknown;
	signer?: unknown;
	txId?: unknown;
	kind?: unknown;
	order?: unknown;
	value?: unknown;
	createdAt?: unknown;
};

export function deriveOperationActivities(
	storage: EnumerableActivityStorage,
	owner: string,
	collections: Collection[]
) {
	const discovered = discoverOperationActivities(storage, owner, collections);
	const cached = loadOperationActivities(storage, owner);
	const byAsset = new Map(discovered.map((activity) => [activity.asset.id, activity]));
	for (const activity of cached) byAsset.set(activity.asset.id, activity);
	return [...byAsset.values()].sort((left, right) => right.createdAt - left.createdAt);
}

export function loadOperationActivities(storage: ActivityStorage, owner: string): OperationActivity[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY) ?? 'null');
	} catch {
		storage.removeItem(OPERATION_ACTIVITY_STORAGE_KEY);
		return [];
	}
	if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.activities)) return [];

	const activities: OperationActivity[] = [];
	let removedStaleActivity = false;
	for (const candidate of parsed.activities) {
		const activity = parseActivity(candidate);
		if (!activity || activity.owner !== owner || activity.phase === 'done') continue;
		if (!operationActivityHasRecovery(storage, activity)) {
			removedStaleActivity = true;
			continue;
		}
		activities.push(reconcileActivity(activity, storage));
	}
	if (removedStaleActivity) saveOperationActivities(storage, activities, [owner]);
	return activities.sort((left, right) => right.createdAt - left.createdAt);
}

export function operationActivityHasRecovery(
	storage: Pick<Storage, 'getItem'>,
	activity: Pick<OperationActivity, 'asset' | 'owner' | 'operation'>
) {
	if (activity.operation.kind === 'buy') {
		const saved = parseJson<StoredPurchase>(
			storage.getItem(atomicPurchaseStorageKey(activity.asset.id, activity.owner))
		);
		return validAtomicPurchase(saved, activity.owner);
	}
	const saved = parseJson<StoredOperation>(storage.getItem(operationStorageKey(activity.asset.id, activity.owner)));
	return validStoredOperation(saved, activity.owner, activity.operation.kind, 'atomic');
}

export function discoverOperationActivities(
	storage: EnumerableActivityStorage,
	owner: string,
	collections: Collection[]
): OperationActivity[] {
	const discovered: OperationActivity[] = [];
	const ownerSuffix = `:${owner}`;
	for (let index = 0; index < storage.length; index += 1) {
		const key = storage.key(index);
		if (!key?.endsWith(ownerSuffix)) continue;
		const purchase = key.startsWith('bazar-purchase:');
		const operation = key.startsWith('bazar-operation:');
		if (!purchase && !operation) continue;
		const assetId = key.slice(purchase ? 'bazar-purchase:'.length : 'bazar-operation:'.length, -ownerSuffix.length);
		if (purchase) {
			const record = parseJson<StoredPurchase>(storage.getItem(key));
			if (!validAtomicPurchase(record, owner)) continue;
			const located = locateActivityAsset(collections, assetId, record, 'atomic');
			if (!located) continue;
			discovered.push({
				id: atomicOperationActivityId(assetId, owner),
				asset: located.asset,
				collectionId: located.collectionId,
				owner,
				operation: {
					kind: 'buy',
					order: record.order as SwapOrder,
					resume: record.snapshot as PurchaseSnapshot,
				},
				phase: 'working',
				status: 'Resume saved purchase',
				confirmations: 0,
				confirmationTarget: 5,
				createdAt: finiteNonNegative(record.createdAt),
			});
			continue;
		}
		const record = parseJson<StoredOperation>(storage.getItem(key));
		const kind = parseAssetOperationKind(record?.kind);
		if (!kind || !validStoredOperation(record, owner, kind, 'atomic')) continue;
		const located = locateActivityAsset(collections, assetId, record, 'atomic');
		if (!located || located.kind !== 'atomic') continue;
		let restoredOperation: Operation;
		if (kind === 'cancel') {
			restoredOperation = { kind, order: record.order as unknown as SwapOrder, resumeId: record.txId };
		} else if (kind === 'sell') {
			restoredOperation = {
				kind,
				resumeId: record.txId,
				...(typeof record.value === 'string' ? { value: record.value } : {}),
			};
		} else {
			restoredOperation = {
				kind,
				resumeId: record.txId,
				...(typeof record.value === 'string' ? { value: record.value } : {}),
			};
		}
		discovered.push({
			id: atomicOperationActivityId(assetId, owner),
			asset: located.asset,
			collectionId: located.collectionId,
			owner,
			operation: restoredOperation,
			phase: 'working',
			status: 'Resume signed transaction',
			confirmations: 0,
			confirmationTarget: 5,
			createdAt: finiteNonNegative(record.createdAt),
		});
	}
	return discovered.sort((left, right) => right.createdAt - left.createdAt);
}

export function atomicOperationActivityId(assetId: string, owner: string) {
	return `atomic:${assetId}:${owner}`;
}

export function saveOperationActivities(
	storage: ActivityStorage,
	activities: OperationActivity[],
	managedOwners: string[]
): void {
	const durable = activities.filter(
		(activity) => activity.phase === 'approval' || activity.phase === 'working' || activity.phase === 'error'
	);
	const preserved = readStoredActivities(storage).filter((activity) => !managedOwners.includes(activity.owner));
	const stored = [...durable, ...preserved];
	if (!stored.length) {
		storage.removeItem(OPERATION_ACTIVITY_STORAGE_KEY);
		return;
	}
	storage.setItem(OPERATION_ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, activities: stored }));
}

function readStoredActivities(storage: ActivityStorage): OperationActivity[] {
	try {
		const parsed = JSON.parse(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY) ?? 'null');
		if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.activities)) return [];
		return parsed.activities
			.map(parseActivity)
			.filter((activity): activity is OperationActivity => Boolean(activity));
	} catch {
		return [];
	}
}

function reconcileActivity(activity: OperationActivity, storage: ActivityStorage): OperationActivity {
	if (activity.operation.kind === 'buy') {
		const saved = parseJson<StoredPurchase>(
			storage.getItem(atomicPurchaseStorageKey(activity.asset.id, activity.owner))
		);
		if (saved?.buyer === activity.owner && isRecord(saved.order)) {
			return {
				...activity,
				operation: {
					kind: 'buy',
					order: saved.order as unknown as SwapOrder,
					...(isRecord(saved.snapshot) ? { resume: saved.snapshot as PurchaseSnapshot } : {}),
				},
				phase: 'working',
				status: 'Resuming purchase…',
			};
		}
		return activity;
	}

	const saved = parseJson<StoredOperation>(storage.getItem(operationStorageKey(activity.asset.id, activity.owner)));
	if (saved?.signer === activity.owner && typeof saved.txId === 'string' && saved.kind === activity.operation.kind) {
		const operation =
			saved.kind === 'cancel' && isRecord(saved.order)
				? ({ kind: 'cancel', order: saved.order as unknown as SwapOrder, resumeId: saved.txId } as const)
				: ({
						kind: saved.kind as 'sell' | 'transfer',
						resumeId: saved.txId,
						...(typeof saved.value === 'string' ? { value: saved.value } : {}),
				  } as const);
		return { ...activity, operation, phase: 'working', status: 'Resuming signed transaction…' };
	}

	return activity;
}

function parseActivity(value: unknown): OperationActivity | null {
	if (!isRecord(value) || !isRecord(value.asset) || !isOperation(value.operation)) return null;
	if (
		typeof value.id !== 'string' ||
		typeof value.asset.id !== 'string' ||
		typeof value.asset.name !== 'string' ||
		typeof value.collectionId !== 'string' ||
		typeof value.owner !== 'string' ||
		!isPhase(value.phase) ||
		typeof value.status !== 'string' ||
		typeof value.createdAt !== 'number'
	)
		return null;
	return {
		id: value.id,
		asset: value.asset as unknown as AssetSummary,
		collectionId: value.collectionId,
		owner: value.owner,
		operation: value.operation,
		phase: value.phase,
		status: value.status,
		confirmations: finiteNonNegative(value.confirmations),
		confirmationTarget: Math.max(1, finiteNonNegative(value.confirmationTarget) || 5),
		createdAt: value.createdAt,
	};
}

function isOperation(value: unknown): value is Operation {
	if (!isRecord(value)) return false;
	if (value.kind === 'sell' || value.kind === 'transfer') {
		return value.resumeId === undefined || typeof value.resumeId === 'string';
	}
	if (value.kind === 'cancel') return isRecord(value.order) && typeof value.order.orderId === 'string';
	return value.kind === 'buy' && isRecord(value.order) && typeof value.order.orderId === 'string';
}

function isPhase(value: unknown): value is OperationActivityPhase {
	return value === 'form' || value === 'approval' || value === 'working' || value === 'done' || value === 'error';
}

export function fungibleOperationActivityId(assetId: string, owner: string, operationKind: FungibleOperationKind) {
	return `fungible:${assetId}:${owner}:${operationKind === 'buy' ? 'purchase' : 'asset'}`;
}

export function loadFungibleOperationActivities(
	storage: ActivityStorage,
	owner: string
): FungibleOperationActivitySummary[] {
	const activities = readStoredFungibleActivities(storage).filter(
		(activity) => activity.owner === owner && activity.phase !== 'done'
	);
	const restored = activities.filter((activity) => fungibleActivityHasRecovery(storage, activity));
	if (restored.length !== activities.length) {
		saveFungibleOperationActivities(storage, restored, [owner]);
	}
	return restored.sort((left, right) => right.createdAt - left.createdAt);
}

export function deriveFungibleOperationActivities(
	storage: EnumerableActivityStorage,
	owner: string,
	collections: Collection[],
	runtime: FungibleOperationActivitySummary[] = []
) {
	const discovered = discoverFungibleOperationActivities(storage, owner, collections);
	const cached = loadFungibleOperationActivities(storage, owner);
	return mergeFungibleOperationActivities([...discovered, ...cached], runtime, owner);
}

export function mergeFungibleOperationActivities(
	recovered: FungibleOperationActivitySummary[],
	runtime: FungibleOperationActivitySummary[],
	owner: string
) {
	const byId = new Map(
		recovered.filter((activity) => activity.owner === owner).map((activity) => [activity.id, activity])
	);
	for (const activity of runtime) {
		if (activity.owner === owner) byId.set(activity.id, activity);
	}
	return [...byId.values()].sort((left, right) => right.createdAt - left.createdAt);
}

export function reduceFungibleRuntimeActivities(
	current: FungibleOperationActivitySummary[],
	change: FungibleOperationActivityChange
) {
	if (change.type === 'remove') {
		return current.filter((activity) => activity.id !== change.id || activity.owner !== change.owner);
	}
	return [
		change.activity,
		...current.filter((activity) => activity.id !== change.activity.id || activity.owner !== change.activity.owner),
	];
}

export function announceFungibleOperationActivityChange(change: FungibleOperationActivityChange) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT, { detail: change }));
}

export function saveFungibleOperationActivities(
	storage: ActivityStorage,
	activities: FungibleOperationActivitySummary[],
	managedOwners: string[]
) {
	const preserved = readStoredFungibleActivities(storage).filter(
		(activity) => !managedOwners.includes(activity.owner)
	);
	const stored = [...activities.filter((activity) => activity.phase !== 'done'), ...preserved];
	if (!stored.length) {
		storage.removeItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY);
		return;
	}
	storage.setItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, activities: stored }));
}

export function upsertFungibleOperationActivity(storage: ActivityStorage, activity: FungibleOperationActivitySummary) {
	const current = readStoredFungibleActivities(storage);
	saveFungibleOperationActivities(
		storage,
		[
			activity,
			...current.filter((candidate) => candidate.id !== activity.id && candidate.owner === activity.owner),
		],
		[activity.owner]
	);
}

export function removeFungibleOperationActivity(storage: ActivityStorage, id: string, owner: string) {
	saveFungibleOperationActivities(
		storage,
		readStoredFungibleActivities(storage).filter((activity) => activity.owner === owner && activity.id !== id),
		[owner]
	);
}

export function discoverFungibleOperationActivities(
	storage: EnumerableActivityStorage,
	owner: string,
	collections: Collection[]
): FungibleOperationActivitySummary[] {
	const discovered: FungibleOperationActivitySummary[] = [];
	const operationSuffix = `:${owner}`;
	for (let index = 0; index < storage.length; index += 1) {
		const key = storage.key(index);
		if (!key?.endsWith(operationSuffix)) continue;
		const purchase = key.startsWith('bazar-purchase-batch:');
		const operation = key.startsWith('bazar-operation:');
		if (!purchase && !operation) continue;
		const assetId = key.slice(
			purchase ? 'bazar-purchase-batch:'.length : 'bazar-operation:'.length,
			-operationSuffix.length
		);
		const record = parseJson<Record<string, unknown>>(storage.getItem(key));
		if (!record) continue;
		if (purchase ? !validFungiblePurchase(record, owner) : record?.signer !== owner) continue;
		const operationKind = purchase ? 'buy' : parseFungibleOperationKind(record?.kind);
		if (
			!operationKind ||
			(operationKind !== 'buy' && !validStoredOperation(record, owner, operationKind, 'fungible'))
		)
			continue;
		const located = locateActivityAsset(collections, assetId, record, 'fungible');
		if (!located) continue;
		discovered.push({
			id: fungibleOperationActivityId(assetId, owner, operationKind),
			asset: located.asset,
			collectionId: located.collectionId,
			owner,
			operationKind,
			phase: 'working',
			status: purchase ? 'Resume saved purchase' : 'Resume signed transaction',
			createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
		});
	}
	return discovered.sort((left, right) => right.createdAt - left.createdAt);
}

function readStoredFungibleActivities(storage: ActivityStorage): FungibleOperationActivitySummary[] {
	try {
		const parsed = JSON.parse(storage.getItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY) ?? 'null');
		if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.activities)) return [];
		return parsed.activities
			.map(parseFungibleActivity)
			.filter((activity): activity is FungibleOperationActivitySummary => Boolean(activity));
	} catch {
		storage.removeItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY);
		return [];
	}
}

function parseFungibleActivity(value: unknown): FungibleOperationActivitySummary | null {
	if (!isRecord(value) || !isRecord(value.asset)) return null;
	const operationKind = parseFungibleOperationKind(value.operationKind);
	if (
		typeof value.id !== 'string' ||
		typeof value.asset.id !== 'string' ||
		typeof value.asset.name !== 'string' ||
		typeof value.collectionId !== 'string' ||
		typeof value.owner !== 'string' ||
		!operationKind ||
		!isPhase(value.phase) ||
		typeof value.status !== 'string' ||
		typeof value.createdAt !== 'number'
	)
		return null;
	return {
		id: value.id,
		asset: value.asset as unknown as AssetSummary,
		collectionId: value.collectionId,
		owner: value.owner,
		operationKind,
		phase: value.phase,
		status: value.status,
		createdAt: value.createdAt,
	};
}

export function fungibleActivityHasRecovery(storage: ActivityStorage, activity: FungibleOperationActivitySummary) {
	const key =
		activity.operationKind === 'buy'
			? fungibleBatchStorageKey(activity.asset.id, activity.owner)
			: operationStorageKey(activity.asset.id, activity.owner);
	const record = parseJson<Record<string, unknown>>(storage.getItem(key));
	if (activity.operationKind === 'buy') return validFungiblePurchase(record, activity.owner);
	return validStoredOperation(record, activity.owner, activity.operationKind, 'fungible');
}

function parseFungibleOperationKind(value: unknown): FungibleOperationKind | null {
	return value === 'sell' || value === 'transfer' || value === 'cancel' || value === 'buy' ? value : null;
}

function parseAssetOperationKind(value: unknown): Exclude<FungibleOperationKind, 'buy'> | null {
	return value === 'sell' || value === 'transfer' || value === 'cancel' ? value : null;
}

function validAtomicPurchase(
	record: StoredPurchase | null,
	owner: string
): record is StoredPurchase & { buyer: string; order: SwapOrder; snapshot: PurchaseSnapshot } {
	return Boolean(
		record?.buyer === owner &&
			record.activityKind !== 'fungible' &&
			isRecord(record.order) &&
			typeof record.order.orderId === 'string' &&
			isRecord(record.snapshot) &&
			hasRecoverablePurchase(record.snapshot)
	);
}

function validFungiblePurchase(record: Record<string, unknown> | null, owner: string) {
	return Boolean(
		record?.buyer === owner &&
			record.activityKind !== 'atomic' &&
			Array.isArray(record.entries) &&
			record.entries.length > 0 &&
			record.entries.every(
				(entry) =>
					isRecord(entry) &&
					isRecord(entry.order) &&
					typeof entry.order.orderId === 'string' &&
					isRecord(entry.snapshot) &&
					hasRecoverablePurchase(entry.snapshot)
			)
	);
}

function validStoredOperation(
	record: StoredOperation | Record<string, unknown> | null,
	owner: string,
	kind: Exclude<FungibleOperationKind, 'buy'>,
	expectedKind?: 'atomic' | 'fungible'
): record is StoredOperation & { signer: string; txId: string; kind: Exclude<FungibleOperationKind, 'buy'> } {
	return Boolean(
		record?.signer === owner &&
			(!expectedKind ||
				(record.activityKind !== 'atomic' && record.activityKind !== 'fungible') ||
				record.activityKind === expectedKind) &&
			typeof record.txId === 'string' &&
			/^[A-Za-z0-9_-]{43}$/.test(record.txId) &&
			record.kind === kind &&
			(kind !== 'cancel' || (isRecord(record.order) && typeof record.order.orderId === 'string'))
	);
}

function locateActivityAsset(
	collections: Collection[],
	assetId: string,
	record: object | null,
	expectedKind: 'atomic' | 'fungible'
) {
	const metadata = isRecord(record) ? record : null;
	if (
		(metadata?.activityKind === 'atomic' || metadata?.activityKind === 'fungible') &&
		metadata.activityKind !== expectedKind
	)
		return null;
	const located = locateAsset(collections, assetId);
	if (located && (located.collection.kind === 'tokens') === (expectedKind === 'fungible')) {
		return { asset: located.asset, collectionId: located.collection.id, kind: expectedKind };
	}
	if (
		isRecord(metadata?.asset) &&
		metadata.asset.id === assetId &&
		typeof metadata.asset.name === 'string' &&
		typeof metadata.collectionId === 'string'
	) {
		return {
			asset: metadata.asset as unknown as AssetSummary,
			collectionId: metadata.collectionId,
			kind: expectedKind,
		};
	}
	return null;
}

function locateAsset(collections: Collection[], assetId: string) {
	for (const collection of collections) {
		const asset = collection.assets.find((candidate) => candidate.id === assetId);
		if (asset) return { asset, collection };
	}
	return null;
}

function finiteNonNegative(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function parseJson<T>(value: string | null): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
