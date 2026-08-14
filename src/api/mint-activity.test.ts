import { describe, expect, it } from 'vitest';

import {
	acceptedMintActivity,
	advanceMintActivity,
	loadMintActivities,
	MINT_ACTIVITY_ATTENTION_AFTER_MS,
	MINT_ACTIVITY_STORAGE_KEY,
	mintActivityNeedsAttention,
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
