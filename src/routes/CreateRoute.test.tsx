import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));

import { FungibleMintDialog } from './CreateRoute';

describe('fungible mint presentation', () => {
	it('uses the marketplace operation side drawer for a completed token mint', () => {
		const markup = renderToStaticMarkup(
			React.createElement(FungibleMintDialog, {
				confirmations: 5,
				consensus: null,
				error: null,
				logoPreview: 'blob:token-logo',
				name: 'Signal',
				onClearError: () => undefined,
				onNavigate: () => undefined,
				onVisibleChange: () => undefined,
				phase: null,
				phaseLabel: '',
				progressButton: React.createRef<HTMLButtonElement>(),
				ready: true,
				result: {
					processId: 'P'.repeat(43),
					logo: 'L'.repeat(43),
					owner: 'W'.repeat(43),
					name: 'Signal',
					ticker: 'SIG',
					wholeSupply: '1000000',
					atomicSupply: '1000000000000000000',
					denomination: 12,
					createdAt: 1,
				},
				ticker: 'SIG',
				views: [],
				visible: true,
			})
		);

		expect(markup).toContain('operation-panel-backdrop');
		expect(markup).toContain('operation-side-panel');
		expect(markup).toContain('Token live on Bazar');
		expect(markup).toContain('Token logo transaction');
		expect(markup).not.toContain('mint-success');
	});
});

describe('collection image selection', () => {
	// CreateRoute has no render harness here (node environment, no DOM), so these guard the
	// wiring; the selection rules themselves are unit-tested in CollectionSelectionNotice.test.tsx.
	const source = readFileSync(new URL('./CreateRoute.tsx', import.meta.url), 'utf8');
	const collectionEstimateEffect =
		source.match(/React\.useEffect\(\(\) => \{\s*if \(mode !== 'collection'[\s\S]*?\n\t\}, \[[^\]]*\]\);/)?.[0] ??
		'';

	it('keeps the over-10 notice out of the error slot that the estimate run clears', () => {
		expect(collectionEstimateEffect).toContain('setError(null)');
		expect(collectionEstimateEffect).not.toContain('Dropped');
		expect(source).not.toMatch(/setError\([^;]*up to 10 images/);
		expect(source).toContain('<CollectionSelectionNotice dropped={collectionDropped} />');
	});

	it('appends from "Add images" and replaces from the dropzone', () => {
		expect(source).toMatch(/openFilePicker\('append'\)[^\n]*\n[^\n]*\/> Add images/);
		expect(source).toMatch(/onClick=\{\(\) => openFilePicker\('replace'\)\}\s*onDragOver/);
		expect(source).toMatch(
			/selectCollectionFiles\(Array\.from\(event\.target\.files \?\? \[\]\), collectionPickMode\.current\);/
		);
		expect(source).toMatch(/collectionPickMode\.current = 'replace';\s*\/\/[^\n]*\n\s*event\.target\.value = '';/);
	});
});
