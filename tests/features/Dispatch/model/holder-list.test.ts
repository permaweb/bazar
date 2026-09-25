import { describe, expect, it } from 'vitest';

import {
	appendHolderRow,
	editableHolderRows,
	EMPTY_HOLDER_ROW,
	expandHolderBlob,
	holderListText,
	looksLikeHolderBlob,
	pasteHolderRows,
	removeHolderRow,
	updateHolderRow,
} from 'features/Dispatch/model/holder-list';

const ALICE = 'A'.repeat(43);
const BOB = 'B'.repeat(43);

describe('holder list paste expansion', () => {
	it('treats single values as field input and lists as blobs', () => {
		expect(looksLikeHolderBlob(ALICE)).toBe(false);
		expect(looksLikeHolderBlob(' 250.5 ')).toBe(false);
		expect(looksLikeHolderBlob(`${ALICE},1`)).toBe(true);
		expect(looksLikeHolderBlob(`${ALICE}\n${BOB}`)).toBe(true);
		expect(looksLikeHolderBlob('[]')).toBe(true);
		expect(looksLikeHolderBlob('{}')).toBe(true);
	});

	it('expands every supported JSON shape', () => {
		expect(expandHolderBlob(`[{"address":"${ALICE}","quantity":"1.5"}]`)).toEqual([
			{ address: ALICE, quantity: '1.5' },
		]);
		expect(expandHolderBlob(`[["${ALICE}", 2]]`)).toEqual([{ address: ALICE, quantity: '2' }]);
		expect(expandHolderBlob(`{"${ALICE}":"3","${BOB}":4}`)).toEqual([
			{ address: ALICE, quantity: '3' },
			{ address: BOB, quantity: '4' },
		]);
		// Lenient: malformed entries become blank rows for the user to fix; scalars are dropped.
		expect(expandHolderBlob('[1, [1, 2, 3], null]')).toEqual([{ address: '', quantity: '' }]);
	});

	it('falls back to CSV, skipping comments and blank lines', () => {
		expect(expandHolderBlob(`# holders\n${ALICE}, 1\n\n${BOB}\r\n[not json`)).toEqual([
			{ address: ALICE, quantity: '1' },
			{ address: BOB, quantity: '' },
			{ address: '[not json', quantity: '' },
		]);
		expect(expandHolderBlob('   ')).toEqual([]);
	});
});

describe('holder list rows', () => {
	it('always offers one editable row', () => {
		expect(editableHolderRows([])).toEqual([EMPTY_HOLDER_ROW]);
		expect(removeHolderRow([{ address: ALICE, quantity: '1' }], 0)).toEqual([EMPTY_HOLDER_ROW]);
	});

	it('edits, removes, and appends rows without mutating the input', () => {
		const rows = [
			{ address: ALICE, quantity: '1' },
			{ address: BOB, quantity: '2' },
		];
		expect(updateHolderRow(rows, 1, { quantity: '3' })).toEqual([rows[0], { address: BOB, quantity: '3' }]);
		expect(removeHolderRow(rows, 0)).toEqual([rows[1]]);
		expect(appendHolderRow(rows)).toEqual([...rows, EMPTY_HOLDER_ROW]);
		expect(rows).toEqual([
			{ address: ALICE, quantity: '1' },
			{ address: BOB, quantity: '2' },
		]);
	});

	it('replaces the pasted-into row with the list and keeps other filled rows', () => {
		expect(pasteHolderRows([EMPTY_HOLDER_ROW], 0, ALICE)).toBeNull();
		expect(pasteHolderRows([EMPTY_HOLDER_ROW], 0, '# only a comment,')).toBeNull();
		expect(pasteHolderRows([EMPTY_HOLDER_ROW], 0, `${ALICE},1\n${BOB},2`)).toEqual([
			{ address: ALICE, quantity: '1' },
			{ address: BOB, quantity: '2' },
		]);
		const filled = [{ address: ALICE, quantity: '1' }, { address: 'partial', quantity: '' }, EMPTY_HOLDER_ROW];
		expect(pasteHolderRows(filled, 1, `${BOB},2`)).toEqual([
			{ address: ALICE, quantity: '1' },
			{ address: BOB, quantity: '2' },
		]);
	});

	it('serializes non-empty rows to CSV for the strict parser', () => {
		expect(
			holderListText([{ address: ALICE, quantity: '1' }, EMPTY_HOLDER_ROW, { address: '', quantity: '2' }])
		).toBe(`${ALICE},1\n,2`);
		expect(holderListText([EMPTY_HOLDER_ROW])).toBe('');
	});
});
