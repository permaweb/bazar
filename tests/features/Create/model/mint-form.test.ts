import { describe, expect, it } from 'vitest';

import type { CollectionMintEstimate, MintEstimate } from 'api/mint';

import { CREATE_MESSAGES } from 'features/Create/messages';
import {
	assetMintInput,
	fallbackAssetName,
	fungibleLogoError,
	fungibleMintInput,
	fungibleMintInputError,
	isAudioAssetFile,
	isWholeTokenSupply,
	mintCostSummary,
	mintSubmissionError,
	mintSubmitDisabled,
	nameWithAudioTitle,
	safeAudioMetadata,
	selectedAssetContentType,
} from 'features/Create/model/mint-form';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';

const messages = CREATE_MESSAGES.en;

function file(name: string, type: string, size = 8) {
	return new File([new Uint8Array(size)], name, { type });
}

const image = file('cover.png', 'image/png');
const audio = file('track.mp3', 'audio/mpeg');

const validToken = {
	name: 'Signal',
	description: '',
	ticker: 'SIG',
	wholeSupply: '1000',
	denomination: '12',
	logoTxId: '',
};

const assetEstimate: MintEstimate = {
	assetReward: 10n,
	artworkReward: 5n,
	total: 15n,
	assetBytes: 100,
	artworkBytes: 20,
	transactionCount: 2,
};

const collectionEstimate: CollectionMintEstimate = { assetCount: 3, total: 30n, transactionCount: 5 };

describe('media selection', () => {
	it('normalizes the content type and detects audio', () => {
		expect(selectedAssetContentType(null)).toBeNull();
		expect(selectedAssetContentType(image)).toBe('image/png');
		expect(isAudioAssetFile(image)).toBe(false);
		expect(isAudioAssetFile(audio)).toBe(true);
		expect(isAudioAssetFile(null)).toBe(false);
	});

	it('suggests a name from the file and lets an embedded title replace only a default name', () => {
		expect(fallbackAssetName(file(`${'x'.repeat(120)}.png`, 'image/png'))).toHaveLength(80);
		expect(fallbackAssetName(image)).toBe('cover');
		expect(nameWithAudioTitle('', 'track', 'Real Title')).toBe('Real Title');
		expect(nameWithAudioTitle('track', 'track', 'Real Title')).toBe('Real Title');
		expect(nameWithAudioTitle('My name', 'track', 'Real Title')).toBe('My name');
		expect(nameWithAudioTitle('My name', 'track', undefined)).toBe('My name');
		expect(nameWithAudioTitle('', 'track', 'T'.repeat(200))).toHaveLength(80);
	});

	it('truncates embedded tags and drops oversized embedded artwork', () => {
		const artwork = file('art.png', 'image/png', 10 * 1024 * 1024 + 1);
		const safe = safeAudioMetadata({
			title: 'Title',
			artist: 'a'.repeat(200),
			album: 'b'.repeat(200),
			duration: 12,
			artwork,
		});
		expect(safe.artist).toHaveLength(160);
		expect(safe.album).toHaveLength(160);
		expect(safe.artwork).toBeUndefined();
		expect(safe.duration).toBe(12);
		expect(safeAudioMetadata({ artwork: image }).artwork).toBe(image);
		expect(safeAudioMetadata({})).toEqual({ artwork: undefined });
	});

	it('builds the asset mint input from the form and embedded tags', () => {
		expect(
			assetMintInput({
				file: audio,
				artwork: null,
				name: 'Song',
				description: 'About',
				audioMetadata: { artist: 'A', album: 'B', duration: 30 },
				udl: undefined,
			})
		).toEqual({
			file: audio,
			artwork: undefined,
			name: 'Song',
			description: 'About',
			artist: 'A',
			album: 'B',
			duration: 30,
			udl: undefined,
		});
	});
});

describe('token inputs', () => {
	it('includes a logo transaction only once it exists', () => {
		expect(fungibleMintInput(validToken).logo).toBeUndefined();
		expect(fungibleMintInput({ ...validToken, logoTxId: ` ${'L'.repeat(43)} ` }).logo).toBe('L'.repeat(43));
	});

	it('reports why a token or its logo is not mintable yet', () => {
		expect(fungibleMintInputError(fungibleMintInput(validToken), null)).toBeNull();
		expect(fungibleMintInputError(fungibleMintInput({ ...validToken, ticker: '' }), null)?.reason).toBe(
			'mint-ticker-invalid'
		);
		expect(fungibleMintInputError(fungibleMintInput({ ...validToken, wholeSupply: '0' }), null)?.reason).toBe(
			'mint-supply-invalid'
		);
		expect(fungibleMintInputError(fungibleMintInput({ ...validToken, denomination: '256' }), null)?.reason).toBe(
			'mint-denomination-invalid'
		);
		expect(fungibleLogoError(image)).toBeNull();
		expect(fungibleLogoError(file('logo.svg', 'image/svg+xml'))?.reason).toBe('mint-logo-type-unsupported');
		expect(fungibleMintInputError(fungibleMintInput(validToken), file('logo.svg', 'image/svg+xml'))).not.toBeNull();
	});

	it('recognizes whole-token supplies', () => {
		expect(isWholeTokenSupply('1000')).toBe(true);
		expect(isWholeTokenSupply('0')).toBe(false);
		expect(isWholeTokenSupply('1.5')).toBe(false);
		expect(isWholeTokenSupply('')).toBe(false);
	});
});

describe('submission gating', () => {
	it('explains what each mode still needs before any wallet request', () => {
		const empty = { file: null, collectionFiles: [], fungibleInput: fungibleMintInput(validToken), logo: null };
		expect(mintSubmissionError('asset', empty, messages, APP_ERROR_MESSAGES.en)).toBe(messages.mintChooseFileError);
		expect(mintSubmissionError('collection', empty, messages, APP_ERROR_MESSAGES.en)).toBe(
			messages.mintChooseCollectionImageError
		);
		expect(mintSubmissionError('fungible', empty, messages, APP_ERROR_MESSAGES.en)).toBeNull();
		expect(
			mintSubmissionError(
				'fungible',
				{ ...empty, fungibleInput: fungibleMintInput({ ...validToken, ticker: '' }) },
				messages,
				APP_ERROR_MESSAGES.en
			)
		).toBe('Enter a token ticker between 1 and 32 characters.');
		expect(mintSubmissionError('asset', { ...empty, file: image }, messages, APP_ERROR_MESSAGES.en)).toBeNull();
		expect(
			mintSubmissionError('collection', { ...empty, collectionFiles: [image] }, messages, APP_ERROR_MESSAGES.en)
		).toBeNull();
	});

	it('waits for metadata and estimates only once a wallet is connected', () => {
		const base = {
			mode: 'asset' as const,
			working: false,
			walletConnected: true,
			readingAudioMetadata: false,
			hasFile: true,
			hasName: true,
			collectionFileCount: 0,
			fungibleReady: false,
			hasAssetEstimate: true,
			hasCollectionEstimate: true,
			hasFungibleEstimate: true,
		};
		expect(mintSubmitDisabled(base)).toBe(false);
		expect(mintSubmitDisabled({ ...base, working: true })).toBe(true);
		expect(mintSubmitDisabled({ ...base, walletConnected: false, hasAssetEstimate: false })).toBe(false);
		expect(mintSubmitDisabled({ ...base, readingAudioMetadata: true })).toBe(true);
		expect(mintSubmitDisabled({ ...base, hasAssetEstimate: false })).toBe(true);
		expect(mintSubmitDisabled({ ...base, hasAssetEstimate: false, hasName: false })).toBe(false);
		expect(
			mintSubmitDisabled({ ...base, mode: 'collection', collectionFileCount: 2, hasCollectionEstimate: false })
		).toBe(true);
		expect(mintSubmitDisabled({ ...base, mode: 'fungible', fungibleReady: true, hasFungibleEstimate: false })).toBe(
			true
		);
		expect(
			mintSubmitDisabled({ ...base, mode: 'fungible', fungibleReady: false, hasFungibleEstimate: false })
		).toBe(false);
	});

	it('summarizes the cost of the active mode', () => {
		expect(mintCostSummary('asset', assetEstimate, collectionEstimate)).toEqual({
			estimate: assetEstimate,
			uploadBytes: 120,
			highCost: false,
		});
		expect(mintCostSummary('collection', assetEstimate, collectionEstimate)).toEqual({
			estimate: collectionEstimate,
			uploadBytes: null,
			highCost: false,
		});
		expect(mintCostSummary('fungible', assetEstimate, undefined)).toEqual({
			estimate: null,
			uploadBytes: null,
			highCost: false,
		});
		expect(mintCostSummary('asset', { ...assetEstimate, total: 200_000_000_000n }, undefined).highCost).toBe(true);
	});
});
