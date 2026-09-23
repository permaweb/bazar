import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { replaceHiddenCollectionAssetIndex } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import {
	homeActivityAsset,
	homeActivityLoadedAnnouncement,
	homeActivityRevealLabel,
	homeActivityScope,
	INITIAL_HOME_ACTIVITY_REQUEST,
	nextHomeActivityRequest,
} from 'features/Home/model/home-activity';

import { assetId, imageCollection, READY_HIDDEN_COLLECTION_INDEX } from '../../../fixtures/home-market';

function event(processId: string): CollectionActivityEvent {
	return { id: 'event', processId, action: 'transfer', actor: assetId('W'), height: 1, timestamp: 1 };
}

beforeEach(() => replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX));
afterEach(() => replaceHiddenCollectionAssetIndex({}));

describe('home activity feed', () => {
	it('identifies the checked marketplace membership independently of collection order', () => {
		const assets = [{ id: assetId('A'), name: 'First' }];
		expect(homeActivityScope([imageCollection('art', assets), imageCollection('names', [])])).toBe(
			homeActivityScope([imageCollection('names', []), imageCollection('art', assets)])
		);
		expect(homeActivityScope([imageCollection('art', assets)])).not.toBe(
			homeActivityScope([imageCollection('art', [])])
		);
		expect(homeActivityScope([])).toBe('[]');
	});

	it('resolves a loaded asset only for collections that are part of the market', () => {
		const asset = { id: assetId('A'), name: 'First' };
		const collections = [imageCollection('art', [asset])];
		expect(homeActivityAsset(collections, event(asset.id))).toEqual(asset);
		expect(homeActivityAsset(collections, event(assetId('Z')))).toBeUndefined();
	});

	it('makes every page request distinct so repeating one still reloads', () => {
		const first = nextHomeActivityRequest(INITIAL_HOME_ACTIVITY_REQUEST, 'more');
		expect(first).toEqual({ kind: 'more', id: 1 });
		expect(nextHomeActivityRequest(first, 'more')).toEqual({ kind: 'more', id: 2 });
		expect(nextHomeActivityRequest(first, 'initial')).toEqual({ kind: 'initial', id: 2 });
	});

	it('describes the loaded events without claiming the whole indexed history', () => {
		expect(homeActivityLoadedAnnouncement(1_500)).toBe('1,500 indexed events loaded.');
		expect(homeActivityLoadedAnnouncement(0)).toBe('0 indexed events loaded.');
	});

	it('reveals loaded rows before offering an older page', () => {
		expect(homeActivityRevealLabel({ loading: true, canReveal: true, revealCount: 20, matchingCount: 40 })).toBe(
			'Loading activity…'
		);
		expect(homeActivityRevealLabel({ loading: false, canReveal: true, revealCount: 12, matchingCount: 32 })).toBe(
			'Show 12 more events'
		);
		expect(homeActivityRevealLabel({ loading: false, canReveal: false, revealCount: 0, matchingCount: 32 })).toBe(
			'Load older activity'
		);
		expect(homeActivityRevealLabel({ loading: false, canReveal: false, revealCount: 0, matchingCount: 0 })).toBe(
			'Check older activity'
		);
	});
});
