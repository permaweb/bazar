import { describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/discovery';

import {
	completeHomeSummaryRetryGroup,
	HOME_TOKEN_PRICE_EVENT_LIMIT,
	type HomeSummaryRetryRun,
	homeTokenPriceChanges,
	startHomeSummaryRetry,
} from 'features/Home/model/home-market';

import { assetId } from '../../../fixtures/home-market';

const token = assetId('T');
const other = assetId('U');
const NOW = Date.UTC(2026, 7, 14, 12);

function offer(id: string, processId: string, hoursAgo: number, asking: string, quantity: string) {
	return {
		id,
		processId,
		action: 'make-offer',
		actor: assetId('W'),
		height: 1,
		timestamp: (NOW - hoursAgo * 3_600_000) / 1_000,
		asking,
		quantity,
	} satisfies CollectionActivityEvent;
}

describe('home summary retries', () => {
	it('starts a run over each group that has failures', () => {
		const run: HomeSummaryRetryRun = { token: 3, pending: new Set() };
		expect(startHomeSummaryRetry(run, [], [])).toBeNull();
		expect(startHomeSummaryRetry(run, [assetId('A')], [])).toEqual({ token: 4, pending: new Set(['assets']) });
		expect(startHomeSummaryRetry(run, [assetId('A')], ['art'])).toEqual({
			token: 4,
			pending: new Set(['assets', 'collections']),
		});
	});

	it('ends only after every group settles with no requests left in flight', () => {
		const run = startHomeSummaryRetry({ token: 0, pending: new Set() }, [assetId('A')], ['art']);
		if (!run) throw new Error('expected a retry run');

		expect(completeHomeSummaryRetryGroup(run, run.token, 'assets', 1)).toBe(false);
		expect(completeHomeSummaryRetryGroup(run, run.token + 1, 'assets', 0)).toBe(false);
		expect(completeHomeSummaryRetryGroup(run, run.token, 'assets', 0)).toBe(false);
		expect(completeHomeSummaryRetryGroup(run, run.token, 'assets', 0)).toBe(false);
		expect(completeHomeSummaryRetryGroup(run, run.token, 'collections', 0)).toBe(true);
		expect(run.pending.size).toBe(0);
	});
});

describe('home token price changes', () => {
	it('reports each token’s own 24-hour ask change', () => {
		const changes = homeTokenPriceChanges(
			[token, other],
			[
				offer('a', token, 20, '1000000000000', '1'),
				offer('b', token, 1, '1500000000000', '1'),
				offer('c', other, 2, '1000000000000', '1'),
			],
			NOW
		);

		expect(changes[token]).toBe(50);
		expect(changes[other]).toBeNull();
	});

	it('reports no change when the index window may be incomplete', () => {
		const events = Array.from({ length: HOME_TOKEN_PRICE_EVENT_LIMIT }, (_, index) =>
			offer(String(index), token, 1, '1000000000000', '1')
		);
		expect(homeTokenPriceChanges([token], events, NOW)[token]).toBeNull();
	});

	it('returns a pending-free record for every requested token', () => {
		expect(homeTokenPriceChanges([token, other], [], NOW)).toEqual({ [token]: null, [other]: null });
		expect(homeTokenPriceChanges([], [], NOW)).toEqual({});
	});
});
