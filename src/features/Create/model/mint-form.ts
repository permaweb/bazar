import {
	type CollectionMintEstimate,
	type FungibleMintInput,
	isHighMintCost,
	type MintEstimate,
	type MintInput,
	type UdlTerms,
	validateFungibleLogo,
	validateFungibleMintInput,
} from 'api/mint';

import { type AppError, appErrorMessage, toAppError } from 'helpers/app-error';
import { isAudioContentType, normalizeAssetContentType } from 'helpers/asset-media';
import type { EmbeddedAudioMetadata } from 'helpers/audio-metadata';

/** What the creator mints: one atomic asset, a collection of them, or a fungible token process. */
export type CreatorMode = 'asset' | 'collection' | 'fungible';

export const MAX_COLLECTION_FILES = 10;
export const MAX_EMBEDDED_ARTWORK_BYTES = 10 * 1024 * 1024;
export const COLLECTION_FILE_LIMIT_ERROR = 'Collections support up to 10 images at a time.';

export function selectedAssetContentType(file: File | null): string | null {
	return file ? normalizeAssetContentType(file.type, file.name) : null;
}

export function isAudioAssetFile(file: File | null): boolean {
	return isAudioContentType(selectedAssetContentType(file) ?? undefined);
}

/** The file name without its extension, as a default asset name. */
export function fallbackAssetName(file: File): string {
	return file.name.replace(/\.[^.]+$/, '').slice(0, 80);
}

/** Embedded audio tags trimmed to the metadata limits; embedded artwork over 10 MB is dropped. */
export function safeAudioMetadata(metadata: EmbeddedAudioMetadata): EmbeddedAudioMetadata {
	return {
		...metadata,
		...(metadata.artist ? { artist: metadata.artist.slice(0, 160) } : {}),
		...(metadata.album ? { album: metadata.album.slice(0, 160) } : {}),
		...(metadata.artwork && metadata.artwork.size <= MAX_EMBEDDED_ARTWORK_BYTES
			? { artwork: metadata.artwork }
			: { artwork: undefined }),
	};
}

/** An embedded title replaces the name only while it is empty or still the file-name default. */
export function nameWithAudioTitle(current: string, fallbackName: string, title: string | undefined): string {
	return title && (!current.trim() || current === fallbackName) ? title.slice(0, 80) : current;
}

export function isWholeTokenSupply(value: string): boolean {
	return /^[1-9]\d*$/.test(value);
}

export function fungibleMintInput(fields: {
	name: string;
	description: string;
	ticker: string;
	wholeSupply: string;
	denomination: string;
	logoTxId: string;
}): FungibleMintInput {
	return {
		name: fields.name,
		description: fields.description,
		ticker: fields.ticker,
		wholeSupply: fields.wholeSupply,
		denomination: fields.denomination,
		...(fields.logoTxId.trim() ? { logo: fields.logoTxId.trim() } : {}),
	};
}

/** Why a token cannot be minted yet, or `null` when its details and optional logo are valid. */
export function fungibleMintInputError(input: FungibleMintInput, logo: File | null): AppError | null {
	try {
		validateFungibleMintInput(input);
		if (logo) validateFungibleLogo(logo);
		return null;
	} catch (cause) {
		return toAppError(cause, 'unknown');
	}
}

export function fungibleLogoError(logo: File): AppError | null {
	try {
		validateFungibleLogo(logo);
		return null;
	} catch (cause) {
		return toAppError(cause, 'unknown');
	}
}

export function assetMintInput(fields: {
	file: File;
	artwork: File | null;
	name: string;
	description: string;
	audioMetadata: EmbeddedAudioMetadata;
	udl: UdlTerms | undefined;
}): MintInput {
	return {
		file: fields.file,
		artwork: fields.artwork ?? undefined,
		name: fields.name,
		description: fields.description,
		artist: fields.audioMetadata.artist,
		album: fields.audioMetadata.album,
		duration: fields.audioMetadata.duration,
		udl: fields.udl,
	};
}

/** The message that blocks a submission before any wallet request, or `null` when the mode's inputs are present. */
export function mintSubmissionError(
	mode: CreatorMode,
	fields: {
		file: File | null;
		collectionFiles: File[];
		fungibleInput: FungibleMintInput;
		logo: File | null;
	}
): string | null {
	if (mode === 'asset' && !fields.file) return 'Choose an image, MP3, or WAV file to continue.';
	if (mode === 'collection' && !fields.collectionFiles.length) return 'Choose at least one collection image.';
	if (mode === 'fungible') {
		const error = fungibleMintInputError(fields.fungibleInput, fields.logo);
		if (error) return appErrorMessage(error);
	}
	return null;
}

/**
 * The submit button waits for a wallet-side precondition: metadata still reading, or a cost estimate not yet
 * returned for complete inputs. Without a wallet it stays enabled so it can open the connection dialog.
 */
export function mintSubmitDisabled(input: {
	mode: CreatorMode;
	working: boolean;
	walletConnected: boolean;
	readingAudioMetadata: boolean;
	hasFile: boolean;
	hasName: boolean;
	collectionFileCount: number;
	fungibleReady: boolean;
	hasAssetEstimate: boolean;
	hasCollectionEstimate: boolean;
	hasFungibleEstimate: boolean;
}): boolean {
	if (input.working) return true;
	if (!input.walletConnected) return false;
	return (
		input.readingAudioMetadata ||
		(input.mode === 'asset' && input.hasFile && input.hasName && !input.hasAssetEstimate) ||
		(input.mode === 'collection' &&
			input.collectionFileCount > 0 &&
			input.hasName &&
			!input.hasCollectionEstimate) ||
		(input.mode === 'fungible' && input.fungibleReady && !input.hasFungibleEstimate)
	);
}

export type MintCostSummary = {
	/** The estimate the summary reports: the asset estimate in asset mode, the collection estimate otherwise. */
	estimate: MintEstimate | CollectionMintEstimate | null;
	/** Permanent media bytes behind an asset estimate, for the high-cost note. */
	uploadBytes: number | null;
	highCost: boolean;
};

/** The cost line and high-cost note for the active mode. */
export function mintCostSummary(
	mode: CreatorMode,
	assetEstimate: MintEstimate | undefined,
	collectionEstimate: CollectionMintEstimate | undefined
): MintCostSummary {
	const estimate = (mode === 'asset' ? assetEstimate : collectionEstimate) ?? null;
	return {
		estimate,
		uploadBytes: mode === 'asset' && assetEstimate ? assetEstimate.assetBytes + assetEstimate.artworkBytes : null,
		highCost: Boolean(estimate && isHighMintCost(estimate.total)),
	};
}
