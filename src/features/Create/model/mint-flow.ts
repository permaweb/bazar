import { FUNGIBLE_TOKEN_COLLECTION_ID } from 'api/collections';
import {
	type CollectionMintPhase,
	type CollectionMintResult,
	CREATED_COLLECTION_ID,
	type FungibleMintPhase,
	type FungibleMintResult,
	type MintDraft,
	type MintedAsset,
	type MintPhase,
} from 'api/mint';

import type { MintTransactionReceiptEntry } from 'components/molecules/MintTransactionReceipt';
import { type AsyncState, IDLE, isAsyncPending, LOADING } from 'helpers/async-state';

import type { CreatorMode } from './mint-form';

/** A token mint: submitting through its wallet stages, minted with its process, or failed with its copy. */
export type FungibleMintFlow =
	| { status: 'idle' }
	| { status: 'submitting'; phase: FungibleMintPhase | null }
	| { status: 'minted'; result: FungibleMintResult }
	| { status: 'failed'; error: string };

/**
 * The creator's mint flows. Asset and collection mints report a phase once their first wallet stage starts and keep
 * their last result until the inputs change; the token mint runs in its own side panel.
 */
export type MintFlowState = {
	/** The form's inline error: validation, estimate, and asset or collection mint failures. */
	error: string | null;
	/** The saved media upload of an interrupted asset mint that can be finished without re-uploading. */
	draft: MintDraft | null;
	assetPhase: MintPhase | null;
	assetResult: MintedAsset | null;
	collectionPhase: CollectionMintPhase | null;
	collectionResult: CollectionMintResult | null;
	fungible: FungibleMintFlow;
	fungibleDialogVisible: boolean;
};

export type MintFlowEvent =
	| { type: 'error-changed'; error: string | null }
	| { type: 'draft-loaded'; draft: MintDraft | null }
	| { type: 'draft-dismissed' }
	| { type: 'file-selected' }
	| { type: 'collection-files-selected'; error: string | null }
	| { type: 'mint-started'; mode: CreatorMode }
	| { type: 'asset-phase'; phase: MintPhase }
	| { type: 'asset-minted'; asset: MintedAsset }
	| { type: 'collection-phase'; phase: CollectionMintPhase }
	| { type: 'collection-minted'; result: CollectionMintResult }
	| { type: 'fungible-phase'; phase: FungibleMintPhase }
	| { type: 'fungible-minted'; result: FungibleMintResult }
	| { type: 'mint-failed'; mode: CreatorMode; error: string; draft: MintDraft | null }
	| { type: 'resume-failed'; error: string }
	| { type: 'fungible-error-cleared' }
	| { type: 'fungible-dialog-changed'; visible: boolean };

const IDLE_FUNGIBLE: FungibleMintFlow = { status: 'idle' };

export function mintFlowState(draft: MintDraft | null): MintFlowState {
	return {
		error: null,
		draft,
		assetPhase: null,
		assetResult: null,
		collectionPhase: null,
		collectionResult: null,
		fungible: IDLE_FUNGIBLE,
		fungibleDialogVisible: false,
	};
}

export function mintFlowReducer(state: MintFlowState, event: MintFlowEvent): MintFlowState {
	switch (event.type) {
		case 'error-changed':
			return state.error === event.error ? state : { ...state, error: event.error };
		case 'draft-loaded':
			return { ...state, draft: event.draft };
		case 'draft-dismissed':
			return { ...state, draft: null };
		case 'file-selected':
			return { ...state, error: null, assetResult: null };
		case 'collection-files-selected':
			return { ...state, error: event.error, collectionResult: null };
		case 'mint-started':
			return {
				...state,
				error: null,
				assetResult: null,
				collectionResult: null,
				...(event.mode === 'fungible'
					? { fungible: { status: 'submitting', phase: null }, fungibleDialogVisible: true }
					: state.fungible.status === 'minted'
					? { fungible: IDLE_FUNGIBLE }
					: {}),
			};
		case 'asset-phase':
			return { ...state, assetPhase: event.phase };
		case 'asset-minted':
			return { ...state, assetResult: event.asset, draft: null, assetPhase: null };
		case 'collection-phase':
			return { ...state, collectionPhase: event.phase };
		case 'collection-minted':
			return { ...state, collectionResult: event.result, collectionPhase: null };
		case 'fungible-phase':
			return state.fungible.status === 'submitting'
				? { ...state, fungible: { status: 'submitting', phase: event.phase } }
				: state;
		case 'fungible-minted':
			return { ...state, fungible: { status: 'minted', result: event.result } };
		case 'mint-failed':
			return {
				...state,
				draft: event.draft,
				assetPhase: null,
				collectionPhase: null,
				...(event.mode === 'fungible'
					? { fungible: { status: 'failed', error: event.error } }
					: {
							error: event.error,
							fungible: state.fungible.status === 'submitting' ? IDLE_FUNGIBLE : state.fungible,
					  }),
			};
		case 'resume-failed':
			return { ...state, assetPhase: null, error: event.error };
		case 'fungible-error-cleared':
			return state.fungible.status === 'failed' ? { ...state, fungible: IDLE_FUNGIBLE } : state;
		case 'fungible-dialog-changed':
			return state.fungibleDialogVisible === event.visible
				? state
				: { ...state, fungibleDialogVisible: event.visible };
	}
}

/** Any mint that has reached a wallet stage. Asset and collection mints count once their first phase is reported. */
export function mintWorking(state: MintFlowState): boolean {
	return state.assetPhase !== null || state.collectionPhase !== null || state.fungible.status === 'submitting';
}

export function fungibleMintPhase(state: MintFlowState): FungibleMintPhase | null {
	return state.fungible.status === 'submitting' ? state.fungible.phase : null;
}

export function fungibleMintResult(state: MintFlowState): FungibleMintResult | null {
	return state.fungible.status === 'minted' ? state.fungible.result : null;
}

export function fungibleMintError(state: MintFlowState): string | null {
	return state.fungible.status === 'failed' ? state.fungible.error : null;
}

/** Upload-activity status for one asset mint stage. */
export function mintPhaseStatus(phase: MintPhase): string {
	return {
		'signing-asset': 'Waiting for approval of the atomic asset in your wallet…',
		'uploading-asset': 'Uploading the atomic asset to Arweave…',
		'signing-artwork': 'Waiting for approval of the album artwork in your wallet…',
		'uploading-artwork': 'Uploading album artwork to Arweave…',
	}[phase];
}

/** Upload-activity status for one collection mint stage. */
export function collectionMintPhaseLabel(phase: CollectionMintPhase): string {
	if (phase.kind === 'asset') {
		return `Asset ${phase.index + 1} of ${phase.total}: ${mintPhaseStatus(phase.phase)}`;
	}
	return `${phase.kind === 'manifest' ? 'Collection manifest' : 'Collection process'}: ${phase.phase}…`;
}

/** The submit button and token panel label for the stage in progress, token first. */
export function mintPhaseLabel(state: MintFlowState): string {
	const fungiblePhase = fungibleMintPhase(state);
	if (fungiblePhase) {
		return {
			'signing-logo': 'Approve the token logo in your wallet…',
			'uploading-logo': 'Uploading the token logo to Arweave…',
			signing: 'Approve the token process in your wallet…',
			uploading: 'Submitting the token process to Arweave…',
		}[fungiblePhase];
	}
	const collectionPhase = state.collectionPhase;
	if (collectionPhase) {
		return collectionPhase.kind === 'asset'
			? `Asset ${collectionPhase.index + 1} of ${collectionPhase.total}: ${
					{
						'signing-asset': 'approve atomic asset',
						'uploading-asset': 'uploading atomic asset',
						'signing-artwork': 'approve artwork upload',
						'uploading-artwork': 'uploading artwork',
					}[collectionPhase.phase]
			  }…`
			: `${collectionPhase.kind === 'manifest' ? 'Collection manifest' : 'Collection process'}: ${
					collectionPhase.phase
			  }…`;
	}
	if (state.assetPhase) {
		return {
			'signing-asset': 'Approve the atomic asset in your wallet…',
			'uploading-asset': 'Uploading the atomic asset to Arweave…',
			'signing-artwork': 'Approve the album artwork in your wallet…',
			'uploading-artwork': 'Uploading album artwork to Arweave…',
		}[state.assetPhase];
	}
	return '';
}

/** Transactions to verify for the latest asset or collection mint, collection first. */
export function mintReceiptEntries(state: MintFlowState): MintTransactionReceiptEntry[] {
	if (state.collectionResult) {
		return [
			{ label: 'View collection manifest', transactionId: state.collectionResult.manifestId },
			{ label: 'View collection process', transactionId: state.collectionResult.processId },
		];
	}
	if (state.assetResult) {
		return [
			...(state.assetResult.artworkId
				? [{ label: 'Artwork transaction', transactionId: state.assetResult.artworkId }]
				: []),
			{ label: 'Asset transaction', transactionId: state.assetResult.id },
		];
	}
	return [];
}

/** Where the success panel's view action leads: the minted collection, else the minted asset. */
export function mintResultPath(state: MintFlowState): string | null {
	if (state.collectionResult) return `/collection/${state.collectionResult.collection.id}`;
	if (state.assetResult) return `/asset/${CREATED_COLLECTION_ID}/${state.assetResult.id}`;
	return null;
}

/** Upload-activity links for a finished asset mint. */
export function mintedAssetUpload(asset: MintedAsset): {
	assetId: string;
	collectionId: string;
	transactionIds: string[];
} {
	return {
		assetId: asset.id,
		collectionId: CREATED_COLLECTION_ID,
		transactionIds: [asset.artworkId, asset.id].filter((id): id is string => Boolean(id)),
	};
}

/** Upload-activity links for a finished collection mint. */
export function mintedCollectionUpload(result: CollectionMintResult): {
	collectionId: string;
	assetIds: string[];
	transactionIds: string[];
} {
	return {
		collectionId: result.collection.id,
		assetIds: result.collection.assets.map((asset) => asset.id),
		transactionIds: [result.manifestId, result.processId],
	};
}

export type FungibleMintView = {
	tokenName: string;
	tokenTicker: string;
	receiptEntries: MintTransactionReceiptEntry[];
	/** The minted token's page and dispatch route, once it exists. */
	tokenPath: string | null;
	dispatchPath: string | null;
};

/** The token panel's identity and links: the minted token's values, else the form's, else generic fallbacks. */
export function fungibleMintView(result: FungibleMintResult | null, name: string, ticker: string): FungibleMintView {
	return {
		tokenName: result?.name || name.trim() || 'Fungible token',
		tokenTicker: result?.ticker || ticker.trim() || 'TKN',
		receiptEntries: result
			? [
					...(result.logo ? [{ label: 'Token logo transaction', transactionId: result.logo }] : []),
					{ label: 'Token process transaction', transactionId: result.processId },
			  ]
			: [],
		tokenPath: result ? `/asset/${FUNGIBLE_TOKEN_COLLECTION_ID}/${result.processId}` : null,
		dispatchPath: result ? `/dispatch/${result.processId}` : null,
	};
}

export function mintUploadId(owner: string, now: number): string {
	return `upload:${owner}:${now}`;
}

/**
 * Forget an estimate after its inputs changed. A request already in flight keeps the estimate pending until it
 * settles or the next estimate starts, so the cost line keeps reporting that it is checking.
 */
export function discardEstimate<T>(state: AsyncState<T>): AsyncState<T> {
	return isAsyncPending(state) ? LOADING : IDLE;
}
