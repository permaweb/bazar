import type { CollectionMintPhase, FungibleMintPhase, MintPhase } from 'api/asset-mint';

/**
 * The one place mint progress copy lives. The create button, the Loading label,
 * the Activity status and the collection append flow all read from here, so a
 * phase always reads the same way wherever it is shown.
 */

const MINT_PHASE_LABELS: Record<MintPhase, string> = {
	'signing-asset': 'Approve the atomic asset in your wallet…',
	'uploading-asset': 'Uploading the atomic asset to Arweave…',
	'signing-artwork': 'Approve the album artwork in your wallet…',
	'uploading-artwork': 'Uploading the album artwork to Arweave…',
};

const FUNGIBLE_MINT_PHASE_LABELS: Record<FungibleMintPhase, string> = {
	'signing-logo': 'Approve the token logo in your wallet…',
	'uploading-logo': 'Uploading the token logo to Arweave…',
	signing: 'Approve the token process in your wallet…',
	uploading: 'Submitting the token process to Arweave…',
};

type CollectionStepPhase = Exclude<CollectionMintPhase, { kind: 'asset' }>['phase'];

const COLLECTION_MANIFEST_LABELS: Record<CollectionStepPhase, string> = {
	signing: 'Approve the collection manifest in your wallet…',
	uploading: 'Uploading the collection manifest to Arweave…',
};

/** A new collection creates its process; extending one sends an update to the existing process. */
const COLLECTION_PROCESS_LABELS: Record<'create' | 'extend', Record<CollectionStepPhase, string>> = {
	create: {
		signing: 'Approve the new collection process in your wallet…',
		uploading: 'Creating the collection process…',
	},
	extend: {
		signing: 'Approve the collection update in your wallet…',
		uploading: 'Submitting the collection update…',
	},
};

export function mintPhaseLabel(phase: MintPhase): string {
	return MINT_PHASE_LABELS[phase];
}

export function fungibleMintPhaseLabel(phase: FungibleMintPhase): string {
	return FUNGIBLE_MINT_PHASE_LABELS[phase];
}

export function collectionMintPhaseLabel(
	phase: CollectionMintPhase,
	{ extending = false }: { extending?: boolean } = {}
): string {
	if (phase.kind === 'asset') return `Asset ${phase.index + 1} of ${phase.total}: ${mintPhaseLabel(phase.phase)}`;
	if (phase.kind === 'manifest') return COLLECTION_MANIFEST_LABELS[phase.phase];
	return COLLECTION_PROCESS_LABELS[extending ? 'extend' : 'create'][phase.phase];
}

/** The label for whichever create-flow mint is in progress; '' when none is. */
export function activeMintPhaseLabel({
	fungible,
	collection,
	asset,
}: {
	fungible: FungibleMintPhase | null;
	collection: CollectionMintPhase | null;
	asset: MintPhase | null;
}): string {
	if (fungible) return fungibleMintPhaseLabel(fungible);
	if (collection) return collectionMintPhaseLabel(collection);
	if (asset) return mintPhaseLabel(asset);
	return '';
}
