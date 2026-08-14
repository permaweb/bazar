import type { MintedAsset } from './asset-mint';
import { isVisibleAssetId } from './collections';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export const MINT_ACTIVITY_STORAGE_KEY = 'bazar-mint-activities:v1';
export const MINT_ACTIVITY_CHANGE_EVENT = 'bazar:mint-activities-changed';
export const MINT_ACTIVITY_ATTENTION_AFTER_MS = 30 * 60 * 1_000;

export type MintActivityPhase = 'accepted' | 'mined' | 'applied' | 'complete';

export type MintActivity = {
	id: string;
	owner: string;
	asset: MintedAsset;
	collectionId: string;
	transactionIds: string[];
	arweaveGateway: string;
	computeGateway: string;
	phase: MintActivityPhase;
	status: string;
	createdAt: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function mintActivityId(owner: string, processId: string) {
	return `mint:${owner}:${processId}`;
}

export function acceptedMintActivity(input: {
	owner: string;
	asset: MintedAsset;
	collectionId: string;
	transactionIds: string[];
	arweaveGateway: string;
	computeGateway: string;
}): MintActivity {
	return {
		...input,
		id: mintActivityId(input.owner, input.asset.id),
		transactionIds: [...new Set(input.transactionIds)],
		phase: 'accepted',
		status: 'Submitted; accepted by Arweave. Safe to leave this page.',
		createdAt: Date.now(),
	};
}

export function loadMintActivities(storage: StorageLike, owner?: string | null): MintActivity[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(storage.getItem(MINT_ACTIVITY_STORAGE_KEY) ?? 'null');
	} catch {
		storage.removeItem(MINT_ACTIVITY_STORAGE_KEY);
		return [];
	}
	if (
		!parsed ||
		typeof parsed !== 'object' ||
		(parsed as any).version !== 1 ||
		!Array.isArray((parsed as any).activities)
	) {
		return [];
	}
	const activities = (parsed as any).activities
		.map(parseMintActivity)
		.filter((activity: MintActivity | null): activity is MintActivity => Boolean(activity));
	if (activities.length !== (parsed as any).activities.length) saveMintActivities(storage, activities);
	return activities
		.filter((activity: MintActivity) => !owner || activity.owner === owner)
		.sort((left: MintActivity, right: MintActivity) => right.createdAt - left.createdAt);
}

export function saveMintActivities(storage: StorageLike, activities: MintActivity[]) {
	const valid = activities.map(parseMintActivity).filter((activity): activity is MintActivity => Boolean(activity));
	if (!valid.length) storage.removeItem(MINT_ACTIVITY_STORAGE_KEY);
	else storage.setItem(MINT_ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, activities: valid }));
}

export function upsertMintActivity(storage: StorageLike, activity: MintActivity) {
	const current = loadMintActivities(storage);
	saveMintActivities(storage, [activity, ...current.filter((candidate) => candidate.id !== activity.id)]);
	notifyMintActivityChange(storage);
}

export function removeMintActivity(storage: StorageLike, id: string) {
	saveMintActivities(
		storage,
		loadMintActivities(storage).filter((activity) => activity.id !== id)
	);
	notifyMintActivityChange(storage);
}

export function removeMintActivities(storage: StorageLike, ids: Iterable<string>) {
	const removed = new Set(ids);
	if (!removed.size) return;
	saveMintActivities(
		storage,
		loadMintActivities(storage).filter((activity) => !removed.has(activity.id))
	);
	notifyMintActivityChange(storage);
}

export function mintActivityNeedsAttention(activity: MintActivity, now = Date.now()) {
	return activity.phase !== 'complete' && now - activity.createdAt >= MINT_ACTIVITY_ATTENTION_AFTER_MS;
}

export function mintActivityStatus(phase: MintActivityPhase) {
	return {
		accepted: 'Submitted; accepted by Arweave. Safe to leave this page.',
		mined: 'Mined on Arweave. Waiting for live process state.',
		applied: 'Applied to live process state. Finishing Bazar indexing.',
		complete: 'Live on Bazar.',
	}[phase];
}

export function advanceMintActivity(activity: MintActivity, phase: MintActivityPhase): MintActivity {
	const order: MintActivityPhase[] = ['accepted', 'mined', 'applied', 'complete'];
	if (order.indexOf(phase) < order.indexOf(activity.phase)) return activity;
	return { ...activity, phase, status: mintActivityStatus(phase) };
}

function parseMintActivity(value: unknown): MintActivity | null {
	if (!value || typeof value !== 'object') return null;
	const activity = value as MintActivity;
	if (
		typeof activity.id !== 'string' ||
		!ADDRESS.test(activity.owner) ||
		!activity.asset ||
		!ADDRESS.test(activity.asset.id) ||
		!isVisibleAssetId(activity.asset.id) ||
		typeof activity.asset.name !== 'string' ||
		typeof activity.collectionId !== 'string' ||
		!Array.isArray(activity.transactionIds) ||
		!activity.transactionIds.length ||
		activity.transactionIds.some((id) => !ADDRESS.test(id)) ||
		typeof activity.arweaveGateway !== 'string' ||
		typeof activity.computeGateway !== 'string' ||
		!['accepted', 'mined', 'applied', 'complete'].includes(activity.phase) ||
		typeof activity.status !== 'string' ||
		!Number.isSafeInteger(activity.createdAt)
	) {
		return null;
	}
	return activity;
}

function notifyMintActivityChange(storage: object) {
	if (typeof window === 'undefined' || typeof localStorage === 'undefined' || storage !== localStorage) return;
	window.dispatchEvent(new Event(MINT_ACTIVITY_CHANGE_EVENT));
}
