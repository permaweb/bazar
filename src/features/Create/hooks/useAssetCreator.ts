import React from 'react';

import {
	AssetMintClient,
	CollectionMintClient,
	type CollectionMintEstimate,
	type CollectionMintInput,
	discardMintDraft,
	type FungibleMintEstimate,
	type FungibleMintInput,
	type FungibleMintResult,
	getMintDraft,
	MAX_FUNGIBLE_DENOMINATION,
	MAX_FUNGIBLE_TICKER_LENGTH,
	MAX_FUNGIBLE_WHOLE_SUPPLY,
	type MintedAsset,
	type MintEstimate,
	type MintInput,
	type UdlPreset,
} from 'api/mint';

import { type AppError, appErrorMessage, toAppError } from 'helpers/app-error';
import { asyncData, type AsyncState, isAsyncPending } from 'helpers/async-state';
import { type EmbeddedAudioMetadata, extractEmbeddedAudioMetadata } from 'helpers/audio-metadata';
import { useMarketProvider } from 'providers/MarketProvider';
import { useOperationActivity } from 'providers/OperationActivityProvider';
import { useWallet } from 'providers/WalletProvider';

import {
	collectionMintPhaseLabel,
	fungibleMintResult,
	mintedAssetUpload,
	mintedCollectionUpload,
	mintFlowReducer,
	type MintFlowState,
	mintFlowState,
	mintPhaseLabel,
	mintPhaseStatus,
	mintUploadId,
	mintWorking,
} from '../model/mint-flow';
import {
	assetMintInput,
	COLLECTION_FILE_LIMIT_ERROR,
	type CreatorMode,
	fallbackAssetName,
	fungibleLogoError,
	fungibleMintInput,
	fungibleMintInputError,
	isAudioAssetFile,
	MAX_COLLECTION_FILES,
	type MintCostSummary,
	mintCostSummary,
	mintSubmissionError,
	mintSubmitDisabled,
	nameWithAudioTitle,
	safeAudioMetadata,
	selectedAssetContentType,
} from '../model/mint-form';
import type { UdlConfigurationMode } from '../model/udl';

import { useMintedAssetLive } from './useMintedAssetLive';
import { useMintEstimate } from './useMintEstimate';
import { useObjectUrl, useObjectUrls } from './useObjectUrl';
import { type TransactionConfirmation, useTransactionConfirmation } from './useTransactionConfirmation';
import { type UdlLicense, type UdlLicenseControls, useUdlLicense } from './useUdlLicense';

/** Observer confirmations a minted token process is watched to. */
const TOKEN_CONFIRMATION_TARGET = 5;

/** Protocol limits the token fields enforce while typing. */
const FUNGIBLE_LIMITS = {
	maxTickerLength: MAX_FUNGIBLE_TICKER_LENGTH,
	maxWholeSupply: MAX_FUNGIBLE_WHOLE_SUPPLY,
	maxDenomination: MAX_FUNGIBLE_DENOMINATION,
};

type FungibleEstimateRequest = { input: FungibleMintInput; logo?: File };

// Each estimate builds a fresh client, exactly like the mint it prices.
const estimateAsset = (input: MintInput, signal: AbortSignal) => new AssetMintClient().estimate(input, signal);
const estimateCollection = (input: CollectionMintInput, signal: AbortSignal) =>
	new CollectionMintClient().estimate(input, signal);
const estimateFungible = (request: FungibleEstimateRequest, signal: AbortSignal) =>
	new AssetMintClient().estimateFungible(request.input, request.logo, signal);

export type AssetCreatorFields = {
	name: string;
	description: string;
	ticker: string;
	wholeSupply: string;
	denomination: string;
	logo: File | null;
	logoTxId: string;
	logoPreview: string;
	file: File | null;
	preview: string;
	selectedContentType: string | null;
	audioSelected: boolean;
	artwork: File | null;
	artworkPreview: string;
	audioMetadata: EmbeddedAudioMetadata;
	readingAudioMetadata: boolean;
	collectionFiles: File[];
	collectionPreviews: string[];
};

export type AssetCreatorEstimates = {
	asset: AsyncState<MintEstimate>;
	collection: AsyncState<CollectionMintEstimate>;
	fungible: AsyncState<FungibleMintEstimate>;
	/** Any estimate request in flight. */
	estimating: boolean;
};

export type AssetCreator = {
	mode: CreatorMode;
	fields: AssetCreatorFields;
	fungibleLimits: typeof FUNGIBLE_LIMITS;
	walletConnected: boolean;
	cost: MintCostSummary;
	license: UdlLicense;
	estimates: AssetCreatorEstimates;
	flow: MintFlowState;
	working: boolean;
	phaseLabel: string;
	submitDisabled: boolean;
	assetResultLive: boolean;
	fungibleResultLive: boolean;
	fungibleConfirmation: TransactionConfirmation;
	setMode(mode: CreatorMode): void;
	setName(name: string): void;
	setDescription(description: string): void;
	setTicker(ticker: string): void;
	setWholeSupply(wholeSupply: string): void;
	setDenomination(denomination: string): void;
	selectFile(file: File | null): void;
	selectCollectionFiles(files: File[]): void;
	removeCollectionFile(index: number): void;
	selectArtwork(file: File | null): void;
	removeArtwork(): void;
	/** Returns `false` when the logo was rejected, so the caller can clear its file input. */
	selectLogo(file: File | null): boolean;
	setLicenseEnabled(enabled: boolean): void;
	applyLicensePreset(preset: UdlPreset): void;
	setShareWithPaymentAmount(value: string): void;
	updateLicenseTerms: UdlLicenseControls['updateTerms'];
	setLicenseConfigurationMode(mode: UdlConfigurationMode): void;
	setCustomLicenseId(value: string): void;
	/** Validate and mint the current mode. Signing starts only from this user action. */
	mint(): Promise<void>;
	/** Finish the saved asset mint from its already-uploaded media. */
	resume(): Promise<void>;
	dismissDraft(): void;
	setFungibleDialogVisible(visible: boolean): void;
	clearFungibleError(): void;
};

/** The creator's inputs, cost estimates, and asset, collection, and token mint flows. */
export function useAssetCreator(): AssetCreator {
	const market = useMarketProvider();
	const wallet = useWallet();
	const uploads = useOperationActivity();
	const metadataRequest = React.useRef(0);
	const artworkRevision = React.useRef(0);
	const [flow, dispatch] = React.useReducer(mintFlowReducer, wallet.address, (address: string | null) =>
		mintFlowState(address ? getMintDraft(address) : null)
	);
	const [mode, setModeState] = React.useState<CreatorMode>('asset');
	const [name, setName] = React.useState('');
	const [description, setDescription] = React.useState('');
	const [ticker, setTicker] = React.useState('');
	const [wholeSupply, setWholeSupply] = React.useState('');
	const [denomination, setDenomination] = React.useState('12');
	const [logo, setLogo] = React.useState<File | null>(null);
	const [logoTxId, setLogoTxId] = React.useState('');
	const [file, setFile] = React.useState<File | null>(null);
	const [artwork, setArtwork] = React.useState<File | null>(null);
	const [audioMetadata, setAudioMetadata] = React.useState<EmbeddedAudioMetadata>({});
	const [readingAudioMetadata, setReadingAudioMetadata] = React.useState(false);
	const [collectionFiles, setCollectionFiles] = React.useState<File[]>([]);
	const license = useUdlLicense();
	const logoPreview = useObjectUrl(logo);
	const preview = useObjectUrl(file);
	const artworkPreview = useObjectUrl(artwork);
	const collectionPreviews = useObjectUrls(collectionFiles);

	const fungibleInput = fungibleMintInput({ name, description, ticker, wholeSupply, denomination, logoTxId });
	const fungibleReady = mode === 'fungible' && !fungibleMintInputError(fungibleInput, logo);
	const assetRequest = React.useMemo(
		() =>
			mode === 'asset' && file && name.trim()
				? assetMintInput({ file, artwork, name, description, audioMetadata, udl: license.active })
				: null,
		[license.active, artwork, audioMetadata, description, file, mode, name]
	);
	const collectionRequest = React.useMemo<CollectionMintInput | null>(
		() =>
			mode === 'collection' && collectionFiles.length && name.trim()
				? { files: collectionFiles, name, description, udl: license.active }
				: null,
		[license.active, collectionFiles, description, mode, name]
	);
	const fungibleRequest = React.useMemo<FungibleEstimateRequest | null>(
		() =>
			mode === 'fungible' && fungibleReady
				? {
						input: fungibleMintInput({ name, description, ticker, wholeSupply, denomination, logoTxId }),
						logo: logo ?? undefined,
				  }
				: null,
		[mode, fungibleReady, name, description, ticker, wholeSupply, denomination, logo, logoTxId]
	);

	const clearError = React.useCallback(() => dispatch({ type: 'error-changed', error: null }), []);
	const reportEstimateError = React.useCallback(
		(error: AppError) => dispatch({ type: 'error-changed', error: appErrorMessage(error) }),
		[]
	);
	const assetEstimate = useMintEstimate(assetRequest, estimateAsset, clearError, reportEstimateError);
	const collectionEstimate = useMintEstimate(collectionRequest, estimateCollection, clearError, reportEstimateError);
	const fungibleEstimate = useMintEstimate(fungibleRequest, estimateFungible, clearError, reportEstimateError);

	const fungibleResult: FungibleMintResult | null = fungibleMintResult(flow);
	const assetResultLive = useMintedAssetLive(flow.assetResult?.id ?? null);
	const fungibleResultLive = useMintedAssetLive(fungibleResult?.processId ?? null);
	const fungibleConfirmation = useTransactionConfirmation(
		fungibleResult?.processId ?? null,
		TOKEN_CONFIRMATION_TARGET
	);
	const working = mintWorking(flow);

	React.useEffect(() => {
		dispatch({ type: 'draft-loaded', draft: wallet.address ? getMintDraft(wallet.address) : null });
	}, [wallet.address]);

	const discardLicensedEstimates = () => {
		assetEstimate.discard();
		collectionEstimate.discard();
		clearError();
	};
	const selectCollectionFiles = (next: File[]) => {
		setCollectionFiles(next.slice(0, MAX_COLLECTION_FILES));
		collectionEstimate.discard();
		dispatch({
			type: 'collection-files-selected',
			error: next.length > MAX_COLLECTION_FILES ? COLLECTION_FILE_LIMIT_ERROR : null,
		});
	};
	const completeMint = (asset: MintedAsset, uploadId: string) => {
		market.addCreatedAsset(asset);
		dispatch({ type: 'asset-minted', asset });
		uploads.finishUpload(uploadId, mintedAssetUpload(asset));
	};

	return {
		mode,
		fungibleLimits: FUNGIBLE_LIMITS,
		walletConnected: Boolean(wallet.address),
		cost: mintCostSummary(mode, asyncData(assetEstimate.estimate), asyncData(collectionEstimate.estimate)),
		fields: {
			name,
			description,
			ticker,
			wholeSupply,
			denomination,
			logo,
			logoTxId,
			logoPreview,
			file,
			preview,
			selectedContentType: selectedAssetContentType(file),
			audioSelected: isAudioAssetFile(file),
			artwork,
			artworkPreview,
			audioMetadata,
			readingAudioMetadata,
			collectionFiles,
			collectionPreviews,
		},
		license,
		estimates: {
			asset: assetEstimate.estimate,
			collection: collectionEstimate.estimate,
			fungible: fungibleEstimate.estimate,
			estimating:
				isAsyncPending(assetEstimate.estimate) ||
				isAsyncPending(collectionEstimate.estimate) ||
				isAsyncPending(fungibleEstimate.estimate),
		},
		flow,
		working,
		phaseLabel: mintPhaseLabel(flow),
		submitDisabled: mintSubmitDisabled({
			mode,
			working,
			walletConnected: Boolean(wallet.address),
			readingAudioMetadata,
			hasFile: Boolean(file),
			hasName: Boolean(name.trim()),
			collectionFileCount: collectionFiles.length,
			fungibleReady,
			hasAssetEstimate: Boolean(asyncData(assetEstimate.estimate)),
			hasCollectionEstimate: Boolean(asyncData(collectionEstimate.estimate)),
			hasFungibleEstimate: Boolean(asyncData(fungibleEstimate.estimate)),
		}),
		assetResultLive,
		fungibleResultLive,
		fungibleConfirmation,
		setMode: (next) => {
			setModeState(next);
			clearError();
		},
		setName,
		setDescription,
		setTicker,
		setWholeSupply: (next) => setWholeSupply(next.trim()),
		setDenomination: (next) => setDenomination(next.trim()),
		selectFile: (next) => {
			const request = ++metadataRequest.current;
			const artworkVersion = ++artworkRevision.current;
			setFile(next);
			setArtwork(null);
			setAudioMetadata({});
			setReadingAudioMetadata(false);
			assetEstimate.discard();
			dispatch({ type: 'file-selected' });
			if (!next) return;
			const fallbackName = fallbackAssetName(next);
			if (!name.trim()) setName(fallbackName);
			if (!isAudioAssetFile(next)) return;
			setReadingAudioMetadata(true);
			// Only the latest selection may apply its tags, and embedded artwork never replaces artwork chosen since.
			void extractEmbeddedAudioMetadata(next).then(
				(metadata) => {
					if (metadataRequest.current !== request) return;
					const safeMetadata = safeAudioMetadata(metadata);
					setAudioMetadata(safeMetadata);
					setName((current) => nameWithAudioTitle(current, fallbackName, metadata.title));
					if (safeMetadata.artwork && artworkRevision.current === artworkVersion) {
						setArtwork(safeMetadata.artwork);
					}
					setReadingAudioMetadata(false);
				},
				() => {
					if (metadataRequest.current === request) setReadingAudioMetadata(false);
				}
			);
		},
		selectCollectionFiles,
		removeCollectionFile: (index) =>
			selectCollectionFiles(collectionFiles.filter((_, heldIndex) => heldIndex !== index)),
		selectArtwork: (next) => {
			artworkRevision.current += 1;
			setArtwork(next);
			assetEstimate.discard();
			clearError();
		},
		removeArtwork: () => {
			artworkRevision.current += 1;
			setArtwork(null);
		},
		selectLogo: (next) => {
			const rejection = next ? fungibleLogoError(next) : null;
			setLogo(rejection ? null : next);
			setLogoTxId('');
			fungibleEstimate.discard();
			dispatch({ type: 'error-changed', error: rejection ? appErrorMessage(rejection) : null });
			return !rejection;
		},
		setLicenseEnabled: (enabled) => {
			license.setEnabled(enabled);
			discardLicensedEstimates();
		},
		applyLicensePreset: (preset) => {
			license.applyPreset(preset);
			clearError();
		},
		setShareWithPaymentAmount: license.setShareWithPaymentAmount,
		updateLicenseTerms: license.updateTerms,
		setLicenseConfigurationMode: (next) => {
			license.setConfigurationMode(next);
			discardLicensedEstimates();
		},
		setCustomLicenseId: (value) => {
			license.setCustomLicenseId(value);
			discardLicensedEstimates();
		},
		mint: async () => {
			if (!wallet.address) {
				wallet.openConnectDialog();
				return;
			}
			const invalid = mintSubmissionError(mode, { file, collectionFiles, fungibleInput, logo });
			if (invalid) {
				dispatch({ type: 'error-changed', error: invalid });
				return;
			}
			const owner = wallet.address;
			const uploadId = mintUploadId(owner, Date.now());
			dispatch({ type: 'mint-started', mode });
			if (mode !== 'fungible') {
				uploads.beginUpload({
					id: uploadId,
					owner,
					kind: mode,
					name: name.trim(),
					status: 'Preparing secure wallet approvals…',
				});
			}
			try {
				if (mode === 'fungible') {
					const minted = await new AssetMintClient().mintFungible(fungibleInput, owner, {
						logo: logo ?? undefined,
						onLogoUploaded: setLogoTxId,
						onPhase: (phase) => dispatch({ type: 'fungible-phase', phase }),
					});
					dispatch({ type: 'fungible-minted', result: minted });
					return;
				}
				if (mode === 'collection') {
					const minted = await new CollectionMintClient().mint(
						{ files: collectionFiles, name, description, udl: license.active },
						owner,
						{
							allowHighCost: true,
							onTransaction: (transaction) => uploads.recordUploadTransaction(uploadId, transaction),
							onPhase: (phase) => {
								dispatch({ type: 'collection-phase', phase });
								uploads.updateUpload(uploadId, collectionMintPhaseLabel(phase));
							},
						}
					);
					market.addCollection(minted.collection);
					dispatch({ type: 'collection-minted', result: minted });
					uploads.finishUpload(uploadId, mintedCollectionUpload(minted));
					return;
				}
				if (!file) return;
				const minted = await new AssetMintClient().mint(
					assetMintInput({ file, artwork, name, description, audioMetadata, udl: license.active }),
					owner,
					{
						allowHighCost: true,
						onTransaction: (transaction) => uploads.recordUploadTransaction(uploadId, transaction),
						onPhase: (phase) => {
							dispatch({ type: 'asset-phase', phase });
							uploads.updateUpload(uploadId, mintPhaseStatus(phase));
						},
					}
				);
				completeMint(minted.asset, uploadId);
			} catch (cause) {
				const message = appErrorMessage(toAppError(cause, 'unknown'));
				dispatch({ type: 'mint-failed', mode, error: message, draft: getMintDraft(owner) });
				if (mode !== 'fungible') uploads.failUpload(uploadId, message);
			}
		},
		resume: async () => {
			const draft = flow.draft;
			if (!wallet.address || !draft) return;
			const owner = wallet.address;
			clearError();
			const uploadId = mintUploadId(owner, Date.now());
			uploads.beginUpload({
				id: uploadId,
				owner,
				kind: 'asset',
				name: draft.name,
				status: 'Recovering the saved asset upload…',
			});
			try {
				const minted = await new AssetMintClient().resume(draft, owner, {
					onTransaction: (transaction) => uploads.recordUploadTransaction(uploadId, transaction),
					onPhase: (phase) => {
						dispatch({ type: 'asset-phase', phase });
						uploads.updateUpload(uploadId, mintPhaseStatus(phase));
					},
				});
				completeMint(minted.asset, uploadId);
			} catch (cause) {
				const message = appErrorMessage(toAppError(cause, 'unknown'));
				dispatch({ type: 'resume-failed', error: message });
				uploads.failUpload(uploadId, message);
			}
		},
		dismissDraft: () => {
			if (!flow.draft) return;
			discardMintDraft(flow.draft.owner);
			dispatch({ type: 'draft-dismissed' });
		},
		setFungibleDialogVisible: (visible) => dispatch({ type: 'fungible-dialog-changed', visible }),
		clearFungibleError: () => dispatch({ type: 'fungible-error-cleared' }),
	};
}
