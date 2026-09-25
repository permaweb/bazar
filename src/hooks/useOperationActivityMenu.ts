import { type MintActivity, mintActivityNeedsAttention, removeMintActivities } from 'api/mint';
import type { FungibleOperationActivitySummary, Operation, OperationActivityPhase } from 'api/operations';

import { arweaveGatewayFromLocation, gatewayFromLocation } from 'helpers/config';
import { type OperationActivity, type UploadActivity, useOperationActivity } from 'providers/OperationActivityProvider';
import { useWallet } from 'providers/WalletProvider';

export type OperationActivityMenuItems = {
	uploads: UploadActivity[];
	operations: Array<{ activity: OperationActivity; operationKind: Operation['kind'] }>;
	fungibleOperations: Array<{ activity: FungibleOperationActivitySummary; operationKind: Operation['kind'] }>;
	mints: Array<{
		activity: MintActivity;
		/** The upload has not reached live process state in time and needs the user's attention. */
		needsAttention: boolean;
		/** Tracking still uses the gateways the upload started with, not the page's current ones. */
		pinnedGateway: boolean;
	}>;
	activityCount: number;
	workingCount: number;
	attentionMintIds: string[];
};

export type OperationActivityMenu = OperationActivityMenuItems & {
	showOperation(id: string): void;
	showFungible(id: string): void;
	showUpload(id: string): void;
	showMint(id: string): void;
	/** Stops tracking the uploads that need attention in this browser; nothing is deleted from Arweave. */
	clearAttentionMints(): void;
};

/**
 * The connected wallet's background activity for the header menu. `isPhaseVisible` decides which atomic and fungible
 * operation phases belong in the menu rather than in their own dialog.
 */
export function useOperationActivityMenu(
	isPhaseVisible: (phase: OperationActivityPhase) => boolean
): OperationActivityMenu {
	const wallet = useWallet();
	const activity = useOperationActivity();
	const items = operationActivityMenuItems(
		{
			activities: activity.activities,
			fungibleActivities: activity.fungibleActivities,
			uploadActivities: activity.uploadActivities,
			mintActivities: activity.mintActivities,
		},
		{
			owner: wallet.address,
			isPhaseVisible,
			now: Date.now(),
			arweaveGateway: arweaveGatewayFromLocation(),
			computeGateway: gatewayFromLocation(),
		}
	);

	return {
		...items,
		showOperation: activity.show,
		showFungible: activity.showFungible,
		showUpload: activity.showUpload,
		showMint: activity.showMint,
		clearAttentionMints: () => removeMintActivities(localStorage, items.attentionMintIds),
	};
}

/** Selects the owner's visible activity; uploads absorb the mint activities of the assets they created. */
export function operationActivityMenuItems(
	sources: {
		activities: OperationActivity[];
		fungibleActivities: FungibleOperationActivitySummary[];
		uploadActivities: UploadActivity[];
		mintActivities: MintActivity[];
	},
	context: {
		owner: string | null | undefined;
		isPhaseVisible: (phase: OperationActivityPhase) => boolean;
		now: number;
		arweaveGateway: string;
		computeGateway: string;
	}
): OperationActivityMenuItems {
	const operations = sources.activities
		.filter((activity) => activity.owner === context.owner && context.isPhaseVisible(activity.phase))
		.map((activity) => ({ activity, operationKind: activity.operation.kind }));
	const fungibleOperations = sources.fungibleActivities
		.filter((activity) => context.isPhaseVisible(activity.phase))
		.map((activity) => ({ activity, operationKind: activity.operationKind }));
	const uploads = sources.uploadActivities.filter((activity) => activity.owner === context.owner);
	const linkedUploadAssets = new Set(uploads.flatMap((activity) => [activity.assetId, ...(activity.assetIds ?? [])]));
	const mints = sources.mintActivities
		.filter((activity) => activity.owner === context.owner && !linkedUploadAssets.has(activity.asset.id))
		.map((activity) => ({
			activity,
			needsAttention: mintActivityNeedsAttention(activity, context.now),
			pinnedGateway:
				activity.arweaveGateway !== context.arweaveGateway ||
				activity.computeGateway !== context.computeGateway,
		}));
	return {
		uploads,
		operations,
		fungibleOperations,
		mints,
		activityCount: operations.length + fungibleOperations.length + uploads.length + mints.length,
		workingCount:
			operations.filter((item) => item.activity.phase === 'working').length +
			fungibleOperations.filter((item) => item.activity.phase === 'working').length +
			uploads.filter((activity) => ['working', 'tracking'].includes(activity.phase)).length +
			mints.filter((item) => item.activity.phase !== 'complete' && !item.needsAttention).length,
		attentionMintIds: mints.filter((item) => item.needsAttention).map((item) => item.activity.id),
	};
}
