import { describe, expect, it } from 'vitest';

import type { CollectionMintPhase, FungibleMintPhase, MintPhase } from 'api/asset-mint';

import {
	activeMintPhaseLabel,
	collectionMintPhaseLabel,
	fungibleMintPhaseLabel,
	mintPhaseLabel,
} from './mint-phase-labels';

const ASSET_PHASES: MintPhase[] = ['signing-asset', 'uploading-asset', 'signing-artwork', 'uploading-artwork'];
const FUNGIBLE_PHASES: FungibleMintPhase[] = ['signing-logo', 'uploading-logo', 'signing', 'uploading'];
const COLLECTION_STEPS: CollectionMintPhase[] = [
	{ kind: 'manifest', phase: 'signing' },
	{ kind: 'manifest', phase: 'uploading' },
	{ kind: 'process', phase: 'signing' },
	{ kind: 'process', phase: 'uploading' },
];
const RAW_PHASE = /:\s*(signing|uploading)\b|\b(signing|uploading)…/i;

describe('mint phase labels', () => {
	it.each([false, true])('describes every collection manifest/process step in words (extending=%s)', (extending) => {
		const labels = COLLECTION_STEPS.map((phase) => collectionMintPhaseLabel(phase, { extending }));
		for (const label of labels) {
			expect(label).not.toMatch(RAW_PHASE);
			expect(label).toMatch(/collection/i);
			expect(label.endsWith('…')).toBe(true);
		}
		expect(new Set(labels).size).toBe(labels.length);
	});

	it('asks for the wallet on signing steps and names the upload on uploading steps', () => {
		expect(collectionMintPhaseLabel({ kind: 'manifest', phase: 'signing' })).toBe(
			'Approve the collection manifest in your wallet…'
		);
		expect(collectionMintPhaseLabel({ kind: 'manifest', phase: 'uploading' })).toBe(
			'Uploading the collection manifest to Arweave…'
		);
		expect(collectionMintPhaseLabel({ kind: 'process', phase: 'signing' })).toBe(
			'Approve the new collection process in your wallet…'
		);
		expect(collectionMintPhaseLabel({ kind: 'process', phase: 'uploading' })).toBe(
			'Creating the collection process…'
		);
	});

	it('describes the process step as an update when extending, and shares the manifest copy', () => {
		const process: CollectionMintPhase = { kind: 'process', phase: 'signing' };
		const manifest: CollectionMintPhase = { kind: 'manifest', phase: 'signing' };
		expect(collectionMintPhaseLabel(process, { extending: true })).toBe(
			'Approve the collection update in your wallet…'
		);
		expect(collectionMintPhaseLabel(process, { extending: true })).not.toBe(collectionMintPhaseLabel(process));
		expect(collectionMintPhaseLabel(manifest, { extending: true })).toBe(collectionMintPhaseLabel(manifest));
	});

	it('keeps the four asset steps distinct and numbers collection assets', () => {
		const single = ASSET_PHASES.map(mintPhaseLabel);
		expect(new Set(single).size).toBe(4);
		for (const phase of ASSET_PHASES) {
			const label = collectionMintPhaseLabel({ kind: 'asset', index: 1, total: 5, phase });
			expect(label).toBe(`Asset 2 of 5: ${mintPhaseLabel(phase)}`);
			expect(collectionMintPhaseLabel({ kind: 'asset', index: 1, total: 5, phase }, { extending: true })).toBe(
				label
			);
		}
		expect(mintPhaseLabel('signing-asset')).toBe('Approve the atomic asset in your wallet…');
		expect(mintPhaseLabel('signing-artwork')).toBe('Approve the album artwork in your wallet…');
	});

	it('gives the button the same string the Activity status gets for the same phase', () => {
		for (const asset of ASSET_PHASES)
			expect(activeMintPhaseLabel({ fungible: null, collection: null, asset })).toBe(mintPhaseLabel(asset));
		const collectionPhases: CollectionMintPhase[] = [
			...ASSET_PHASES.map((phase) => ({ kind: 'asset' as const, index: 0, total: 3, phase })),
			...COLLECTION_STEPS,
		];
		for (const collection of collectionPhases)
			expect(activeMintPhaseLabel({ fungible: null, collection, asset: null })).toBe(
				collectionMintPhaseLabel(collection)
			);
		for (const fungible of FUNGIBLE_PHASES)
			expect(activeMintPhaseLabel({ fungible, collection: null, asset: null })).toBe(
				fungibleMintPhaseLabel(fungible)
			);
	});

	it('prefers the token, then the collection, then the single asset, and is empty when idle', () => {
		const collection: CollectionMintPhase = { kind: 'manifest', phase: 'signing' };
		expect(activeMintPhaseLabel({ fungible: 'signing', collection, asset: 'signing-asset' })).toBe(
			'Approve the token process in your wallet…'
		);
		expect(activeMintPhaseLabel({ fungible: null, collection, asset: 'signing-asset' })).toBe(
			collectionMintPhaseLabel(collection)
		);
		expect(activeMintPhaseLabel({ fungible: null, collection: null, asset: null })).toBe('');
	});
});
