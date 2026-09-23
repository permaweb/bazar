import type { MintActivity, MintedAsset } from 'api/mint';

import { isFungiblePendingMint } from './asset-detail';

/** Upload phases in the order the pending page walks through them. */
export const PENDING_MINT_PHASES: MintActivity['phase'][] = ['accepted', 'mined', 'applied', 'complete'];

/** What each submitted transaction holds, which decides how the receipt labels it. */
export type PendingMintTransactionRole = 'artwork' | 'asset' | 'logo' | 'token';

export type PendingMintTransaction = { transactionId: string; role: PendingMintTransactionRole };

export type PendingMintView = {
	fungible: boolean;
	/** Index into `PENDING_MINT_PHASES`, or -1 for a phase the page does not list. */
	currentPhaseIndex: number;
	/** The upload is tracked against gateways other than the ones selected now. */
	pinnedGateway: boolean;
	transactions: PendingMintTransaction[];
};

/** Present a submitted mint: its kind, how far it has progressed, and the transactions it produced. */
export function pendingMintView(input: {
	activity: MintActivity;
	asset: Pick<MintedAsset, 'contentType' | 'ticker'>;
	collectionId: string;
	arweaveGateway: string;
	computeGateway: string;
}): PendingMintView {
	const fungible = isFungiblePendingMint(input.asset, input.activity.collectionId ?? input.collectionId);
	const transactionIds = input.activity.transactionIds;
	return {
		fungible,
		currentPhaseIndex: PENDING_MINT_PHASES.indexOf(input.activity.phase),
		pinnedGateway:
			input.activity.arweaveGateway !== input.arweaveGateway ||
			input.activity.computeGateway !== input.computeGateway,
		transactions: transactionIds.map((transactionId, index) => ({
			transactionId,
			role: index === transactionIds.length - 1 ? (fungible ? 'token' : 'asset') : fungible ? 'logo' : 'artwork',
		})),
	};
}
