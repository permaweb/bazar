import { describe, expect, it } from 'vitest';

import type { CollectionMintEstimate } from 'api/asset-mint';

import {
	collectionAppendCanSubmit,
	type CollectionAppendEstimateEvent,
	collectionAppendEstimateReducer as reduce,
	type CollectionAppendEstimateState,
	idleCollectionAppendEstimate,
} from './collection-append-estimate';

const twoImages: CollectionMintEstimate = { assetCount: 2, total: 2_000_000_000_000n, transactionCount: 4 };
const tenImages: CollectionMintEstimate = { assetCount: 10, total: 9_000_000_000_000n, transactionCount: 12 };
const file = new File(['x'], 'x.png', { type: 'image/png' });

function run(events: CollectionAppendEstimateEvent[], from = idleCollectionAppendEstimate) {
	return events.reduce(reduce, from);
}

describe('collectionAppendEstimateReducer', () => {
	it('walks idle -> checking -> ready', () => {
		expect(run([{ type: 'start' }])).toEqual({ status: 'checking' });
		expect(run([{ type: 'start' }, { type: 'resolve', estimate: twoImages }])).toEqual({
			status: 'ready',
			estimate: twoImages,
		});
	});

	it('drops the previous total as soon as a new estimate starts', () => {
		const ready = run([{ type: 'start' }, { type: 'resolve', estimate: twoImages }]);
		const rechecking = reduce(ready, { type: 'start' });

		expect(rechecking).toEqual({ status: 'checking' });
		expect(reduce(rechecking, { type: 'resolve', estimate: tenImages })).toEqual({
			status: 'ready',
			estimate: tenImages,
		});
	});

	it('leaves no total after a failed re-estimate, and a retry starts clean', () => {
		const failed = run([
			{ type: 'start' },
			{ type: 'resolve', estimate: twoImages },
			{ type: 'start' },
			{ type: 'reject', message: 'mint price 503' },
		]);

		expect(failed).toEqual({ status: 'failed', message: 'mint price 503' });
		expect(reduce(failed, { type: 'start' })).toEqual({ status: 'checking' });
	});

	it('returns to idle from any state when the files empty or the dialog closes', () => {
		const states: CollectionAppendEstimateState[] = [
			{ status: 'checking' },
			{ status: 'ready', estimate: twoImages },
			{ status: 'failed', message: 'mint price 503' },
		];
		for (const state of states) expect(reduce(state, { type: 'reset' })).toEqual({ status: 'idle' });
	});

	it('ignores a result that arrives when no estimate is in flight', () => {
		expect(reduce(idleCollectionAppendEstimate, { type: 'resolve', estimate: twoImages })).toBe(
			idleCollectionAppendEstimate
		);
		expect(reduce(idleCollectionAppendEstimate, { type: 'reject', message: 'late' })).toBe(
			idleCollectionAppendEstimate
		);
		const ready: CollectionAppendEstimateState = { status: 'ready', estimate: twoImages };
		expect(reduce(ready, { type: 'resolve', estimate: tenImages })).toBe(ready);
	});
});

describe('collectionAppendCanSubmit', () => {
	const ready: CollectionAppendEstimateState = { status: 'ready', estimate: twoImages };
	it.each([
		['no files', { files: [], estimate: ready, working: false }, false],
		['no estimate yet', { files: [file], estimate: idleCollectionAppendEstimate, working: false }, false],
		['estimate running', { files: [file], estimate: { status: 'checking' }, working: false }, false],
		['estimate failed', { files: [file], estimate: { status: 'failed', message: 'x' }, working: false }, false],
		['append running', { files: [file], estimate: ready, working: true }, false],
		['fresh estimate', { files: [file], estimate: ready, working: false }, true],
	] as Array<[string, Parameters<typeof collectionAppendCanSubmit>[0], boolean]>)('%s', (_label, input, expected) => {
		expect(collectionAppendCanSubmit(input)).toBe(expected);
	});
});
