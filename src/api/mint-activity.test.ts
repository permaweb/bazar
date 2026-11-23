import { describe, expect, it } from 'vitest';

import {
	acceptedMintActivity,
	advanceMintActivity,
	loadMintActivities,
	MINT_ACTIVITY_ATTENTION_AFTER_MS,
	MINT_ACTIVITY_OBSERVATION_MS,
	MINT_ACTIVITY_STALLED_OBSERVATION_MS,
	MINT_ACTIVITY_STORAGE_KEY,
	type MintActivity,
	mintActivityNeedsAttention,
	mintActivityObservationDelay,
	mintActivityTrackingState,
	mintActivityWatchPlan,
	nextMintActivityStalledAt,
	removeMintActivities,
	removeMintActivity,
	upsertMintActivity,
} from './mint-activity';

const owner = 'W'.repeat(43);
const processId = 'P'.repeat(43);

function storage() {
	const values = new Map<string, string>();
	return {
		values,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value),
		removeItem: (key: string) => void values.delete(key),
	};
}

describe('background mint activity', () => {
	it('rehydrates an accepted upload with exact IDs and pinned gateways after reload', () => {
		const store = storage();
		const activity = acceptedMintActivity({
			owner,
			asset: {
				id: processId,
				name: 'Signal',
				description: '',
				contentType: 'image/png',
				image: `https://gateway-a.example/${processId}`,
				mediaId: processId,
				owner,
				createdAt: 1,
			},
			collectionId: 'created-assets',
			transactionIds: [processId],
			arweaveGateway: 'https://gateway-a.example',
			computeGateway: 'https://compute-a.example',
		});
		upsertMintActivity(store, activity);

		const [restored] = loadMintActivities(store, owner);
		expect(restored).toMatchObject({
			phase: 'accepted',
			transactionIds: [processId],
			arweaveGateway: 'https://gateway-a.example',
			computeGateway: 'https://compute-a.example',
		});
		expect(restored.status).toContain('Safe to leave');
	});

	it('moves forward through accepted, mined, applied, and complete without regressing', () => {
		const initial = acceptedMintActivity({
			owner,
			asset: {
				id: processId,
				name: 'Signal',
				description: '',
				contentType: 'image/png',
				image: `https://arweave.net/${processId}`,
				mediaId: processId,
				owner,
				createdAt: 1,
			},
			collectionId: 'created-assets',
			transactionIds: [processId],
			arweaveGateway: 'https://arweave.net',
			computeGateway: 'https://compute.example',
		});
		const mined = advanceMintActivity(initial, 'mined');
		const applied = advanceMintActivity(mined, 'applied');
		const complete = advanceMintActivity(applied, 'complete');

		expect([initial.phase, mined.phase, applied.phase, complete.phase]).toEqual([
			'accepted',
			'mined',
			'applied',
			'complete',
		]);
		expect(advanceMintActivity(complete, 'accepted')).toBe(complete);
	});

	it('removes only the completed upload from persisted activity', () => {
		const store = storage();
		const first = acceptedMintActivity({
			owner,
			asset: {
				id: processId,
				name: 'Signal',
				description: '',
				contentType: 'image/png',
				image: processId,
				mediaId: processId,
				owner,
				createdAt: 1,
			},
			collectionId: 'created-assets',
			transactionIds: [processId],
			arweaveGateway: 'https://arweave.net',
			computeGateway: 'https://compute.example',
		});
		const second = {
			...first,
			id: `mint:${owner}:${'Q'.repeat(43)}`,
			asset: { ...first.asset, id: 'Q'.repeat(43) },
		};
		upsertMintActivity(store, first);
		upsertMintActivity(store, second);
		removeMintActivity(store, first.id);

		expect(loadMintActivities(store).map((activity) => activity.id)).toEqual([second.id]);
		expect(store.values.has(MINT_ACTIVITY_STORAGE_KEY)).toBe(true);
	});

	it('marks only stale unfinished uploads as needing attention', () => {
		const activity = acceptedMintActivity({
			owner,
			asset: {
				id: processId,
				name: 'Signal',
				description: '',
				contentType: 'image/png',
				image: processId,
				mediaId: processId,
				owner,
				createdAt: 1,
			},
			collectionId: 'created-assets',
			transactionIds: [processId],
			arweaveGateway: 'https://arweave.net',
			computeGateway: 'https://compute.example',
		});
		const beforeAttention = activity.createdAt + MINT_ACTIVITY_ATTENTION_AFTER_MS - 1;
		const afterAttention = activity.createdAt + MINT_ACTIVITY_ATTENTION_AFTER_MS;

		expect(mintActivityNeedsAttention(activity, beforeAttention)).toBe(false);
		expect(mintActivityNeedsAttention(activity, afterAttention)).toBe(true);
		expect(mintActivityNeedsAttention(advanceMintActivity(activity, 'complete'), afterAttention)).toBe(false);
	});

	it('bulk-removes only the selected upload tracking records', () => {
		const store = storage();
		const first = acceptedMintActivity({
			owner,
			asset: {
				id: processId,
				name: 'Signal',
				description: '',
				contentType: 'image/png',
				image: processId,
				mediaId: processId,
				owner,
				createdAt: 1,
			},
			collectionId: 'created-assets',
			transactionIds: [processId],
			arweaveGateway: 'https://arweave.net',
			computeGateway: 'https://compute.example',
		});
		const second = {
			...first,
			id: `mint:${owner}:${'Q'.repeat(43)}`,
			asset: { ...first.asset, id: 'Q'.repeat(43) },
		};
		const third = {
			...first,
			id: `mint:${owner}:${'R'.repeat(43)}`,
			asset: { ...first.asset, id: 'R'.repeat(43) },
		};
		upsertMintActivity(store, first);
		upsertMintActivity(store, second);
		upsertMintActivity(store, third);

		removeMintActivities(store, [first.id, third.id]);

		expect(loadMintActivities(store).map((activity) => activity.id)).toEqual([second.id]);
	});
});

describe('mint activity tracking state machine', () => {
	const base: MintActivity = {
		id: `mint:${owner}:${processId}`,
		owner,
		asset: {
			id: processId,
			name: 'Signal',
			description: '',
			contentType: 'image/png',
			image: processId,
			mediaId: processId,
			owner,
			createdAt: 1,
		},
		collectionId: 'created-assets',
		transactionIds: [processId],
		arweaveGateway: 'https://arweave.net',
		computeGateway: 'https://compute.example',
		phase: 'accepted',
		status: 'Submitted; accepted by Arweave. Safe to leave this page.',
		createdAt: 1_000,
	};
	const other: MintActivity = {
		...base,
		id: `mint:${owner}:${'Q'.repeat(43)}`,
		asset: { ...base.asset, id: 'Q'.repeat(43) },
	};
	const stalledAt = base.createdAt + MINT_ACTIVITY_ATTENTION_AFTER_MS;

	it('moves tracking -> stalled on the clock and to complete only through the phase', () => {
		expect(mintActivityTrackingState(base, stalledAt - 1)).toBe('tracking');
		expect(mintActivityTrackingState(base, stalledAt)).toBe('stalled');
		expect(mintActivityTrackingState({ ...base, phase: 'applied' }, stalledAt + 60 * 60_000)).toBe('stalled');
		expect(mintActivityTrackingState({ ...base, phase: 'complete' }, stalledAt)).toBe('complete');
		expect(mintActivityTrackingState({ ...base, phase: 'complete' }, base.createdAt)).toBe('complete');
	});

	it('keeps observing a stalled upload at a slower pace instead of stopping', () => {
		expect(mintActivityObservationDelay(base, stalledAt - 1)).toBe(MINT_ACTIVITY_OBSERVATION_MS);
		expect(mintActivityObservationDelay(base, stalledAt)).toBe(MINT_ACTIVITY_STALLED_OBSERVATION_MS);
		expect(MINT_ACTIVITY_STALLED_OBSERVATION_MS).toBeGreaterThan(MINT_ACTIVITY_OBSERVATION_MS);
		expect(Number.isFinite(mintActivityObservationDelay(base, stalledAt + 24 * 60 * 60_000))).toBe(true);
	});

	it('starts a watcher for an upload that is already stalled (reload after 30 minutes)', () => {
		const realNow = Date.now;
		Date.now = () => stalledAt + 5 * 60_000;
		try {
			expect(mintActivityNeedsAttention(base)).toBe(true);
			expect(mintActivityWatchPlan([base], [])).toEqual({ start: [base], stop: [] });
		} finally {
			Date.now = realNow;
		}
	});

	it('does not abort a stalled watcher when an unrelated mint activity changes', () => {
		const realNow = Date.now;
		Date.now = () => stalledAt + 5 * 60_000;
		try {
			const plan = mintActivityWatchPlan([{ ...other, createdAt: Date.now() }, base], [base.id]);
			expect(plan.stop).toEqual([]);
			expect(plan.start.map((activity) => activity.id)).toEqual([other.id]);
		} finally {
			Date.now = realNow;
		}
	});

	it('stops watchers only for completed or removed activities', () => {
		expect(mintActivityWatchPlan([{ ...base, phase: 'complete' }], [base.id])).toEqual({
			start: [],
			stop: [base.id],
		});
		expect(mintActivityWatchPlan([base], [base.id, other.id])).toEqual({ start: [], stop: [other.id] });
		expect(mintActivityWatchPlan([{ ...base, phase: 'complete' }], [])).toEqual({ start: [], stop: [] });
	});

	it('reports when the next tracked upload turns stalled so views can re-render', () => {
		const later = { ...other, createdAt: base.createdAt + 10_000 };
		expect(nextMintActivityStalledAt([later, base], base.createdAt)).toBe(stalledAt);
		expect(nextMintActivityStalledAt([later, base], stalledAt)).toBe(
			later.createdAt + MINT_ACTIVITY_ATTENTION_AFTER_MS
		);
		expect(nextMintActivityStalledAt([{ ...base, phase: 'complete' }], base.createdAt)).toBeNull();
		expect(nextMintActivityStalledAt([], base.createdAt)).toBeNull();
	});
});
