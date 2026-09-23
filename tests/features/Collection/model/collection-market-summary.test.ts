import { describe, expect, it } from 'vitest';

import {
	collectionListingSearchProgress,
	collectionResultAnnouncement,
	collectionResultSummary,
} from 'features/Collection/model/collection-market-summary';

import { assetSummary, collectionFixture } from '../../../fixtures/collection';

const images = collectionFixture([assetSummary(1), assetSummary(2)], { name: 'Waves' });
const names = collectionFixture([assetSummary(1)], { kind: 'names', name: 'Names' });
const pagedTokens = collectionFixture([assetSummary(1)], { kind: 'tokens', name: 'Tokens', hasMore: true });

const summaryInput = {
	collection: images,
	loading: false,
	listedOnly: false,
	listedCount: 0,
	offerCount: 0,
	query: '',
	initial: 'all',
	matchCount: 2,
	failures: 0,
};

describe('collection listing progress copy', () => {
	it('counts pages, candidates, failures, and the loaded token scope', () => {
		expect(collectionListingSearchProgress({ pages: 1, total: 1, resolved: 0, failures: 0 }, null)).toBe(
			'1 index check this pass · 1 candidate · 0 checked'
		);
		expect(collectionListingSearchProgress({ pages: 2, total: 1200, resolved: 40, failures: 3 }, 2500)).toBe(
			'2 index checks this pass · 1,200 candidates · 40 checked · 3 unavailable · among 2,500 loaded tokens'
		);
	});
});

describe('collection result summary copy', () => {
	it('reports progress while a listing pass runs', () => {
		expect(collectionResultSummary({ ...summaryInput, loading: true, listedOnly: true, listedCount: 1 })).toBe(
			'1 live listing so far'
		);
		expect(collectionResultSummary({ ...summaryInput, loading: true, offerCount: 3 })).toBe('3 live offers so far');
	});

	it('reports matches for a search or a letter filter', () => {
		expect(collectionResultSummary({ ...summaryInput, query: 'wave' })).toBe('2 loaded matches');
		expect(collectionResultSummary({ ...summaryInput, collection: names, query: 'wave' })).toBe(
			'2 current namespace matches'
		);
		expect(collectionResultSummary({ ...summaryInput, initial: 'W', matchCount: 1 })).toBe(
			'1 loaded names beginning with W'
		);
	});

	it('reports live listings with unavailable candidates and the loaded token scope', () => {
		expect(
			collectionResultSummary({
				...summaryInput,
				collection: pagedTokens,
				listedOnly: true,
				matchCount: 1,
				failures: 2,
			})
		).toBe('1 live listing in loaded tokens · 2 unavailable');
	});

	it('counts the loaded window for each collection kind', () => {
		expect(collectionResultSummary(summaryInput)).toBe('2 assets');
		expect(collectionResultSummary({ ...summaryInput, collection: collectionFixture([assetSummary(1)]) })).toBe(
			'1 asset'
		);
		expect(collectionResultSummary({ ...summaryInput, collection: names })).toBe('1 current name');
		expect(collectionResultSummary({ ...summaryInput, collection: { ...names, hasMore: true } })).toBe(
			'1 current names loaded · more available'
		);
		expect(collectionResultSummary({ ...summaryInput, collection: pagedTokens })).toBe(
			'1 tokens loaded · more available'
		);
		expect(collectionResultSummary({ ...summaryInput, collection: { ...pagedTokens, hasMore: false } })).toBe(
			'1 token'
		);
	});
});

describe('collection result announcement copy', () => {
	const announcementInput = {
		collection: images,
		loading: false,
		listedOnly: false,
		searchProgress: '1 index check this pass · 1 candidate · 0 checked',
		pricesLoading: false,
		visiblePriceCount: 2,
		query: '',
		matchCount: 2,
		summary: '2 assets',
	};

	it('announces the listing pass, the price check, then the result', () => {
		expect(collectionResultAnnouncement({ ...announcementInput, loading: true, listedOnly: true })).toBe(
			'Searching Arweave for live listings in Waves: 1 index check this pass · 1 candidate · 0 checked.'
		);
		expect(collectionResultAnnouncement({ ...announcementInput, loading: true })).toBe(
			'Checking live offers in Waves while all items remain visible.'
		);
		expect(collectionResultAnnouncement({ ...announcementInput, pricesLoading: true })).toBe(
			'Checking live prices for 2 visible assets in Waves.'
		);
		expect(collectionResultAnnouncement(announcementInput)).toBe('2 assets in Waves.');
	});

	it('announces search results, including an empty paged token search', () => {
		expect(collectionResultAnnouncement({ ...announcementInput, query: 'wave' })).toBe(
			'2 assets match wave in Waves.'
		);
		expect(collectionResultAnnouncement({ ...announcementInput, query: 'wave', matchCount: 0 })).toBe(
			'No assets match wave in Waves.'
		);
		expect(
			collectionResultAnnouncement({
				...announcementInput,
				collection: pagedTokens,
				query: 'wave',
				matchCount: 0,
			})
		).toBe('No loaded tokens match wave in Tokens; more token records remain available.');
		expect(
			collectionResultAnnouncement({ ...announcementInput, collection: names, query: 'wave', matchCount: 1 })
		).toBe('1 names match wave in Names.');
	});
});
