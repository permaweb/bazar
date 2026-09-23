import { FUNGIBLE_TOKEN_COLLECTION_ID } from 'api/collections';
import {
	DEFAULT_DISPATCH_BATCH_SIZE,
	type DispatchCostEstimate,
	type DispatchPlan,
	estimateDispatchCost,
	type ParsedHolderList,
	parseHolderList,
	requiresCostConfirmation,
} from 'api/dispatch';
import {
	ASSET_BALANCE_STATE_UNAVAILABLE,
	assetBalanceStateAvailable,
	type AssetState,
	DISPLAY_STATE_TIMEOUT_ERROR,
	formatTokenAmount,
	liquidBalanceOf,
} from 'api/marketplace';
import type { FungibleOperationActivityChange } from 'api/operations';

import { appErrorMessage, toAppError } from 'helpers/app-error';

export function shortAddress(address: string): string {
	return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

/** A human token amount with grouped whole digits and the token's ticker. */
export function formatDispatchTokenAmount(raw: string, token: Pick<AssetState, 'denomination' | 'ticker'>): string {
	const [whole, fraction] = formatTokenAmount(raw, token.denomination).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return `${fraction ? `${grouped}.${fraction}` : grouped} ${token.ticker || 'tokens'}`;
}

/** Dispatch copy for an application error: holder-dispatch context for shared reasons, the shared table otherwise. */
export function dispatchErrorMessage(cause: unknown): string {
	const error = toAppError(cause, 'dispatch-failed');
	switch (error.reason) {
		case ASSET_BALANCE_STATE_UNAVAILABLE:
			return 'The configured AO routes did not return a complete holder balance table. Bazar did not sign a transfer. Retry after complete state is available; any saved dispatch progress remains available.';
		case DISPLAY_STATE_TIMEOUT_ERROR:
			return 'The configured AO routes did not return complete holder state within 45 seconds. No new transfer was signed; saved dispatch progress remains available.';
		case 'asset-state-timeout':
			return 'Timed out waiting for settlement. Nothing was lost: posted transfers stay posted — resume to continue watching without re-sending.';
		case 'wallet-sign-unavailable':
			return 'Connect an Arweave wallet extension that supports transaction signing.';
		case 'asset-purchase-insufficient-funds':
			return 'Your AR balance cannot cover the transfer amounts plus network rewards.';
		case 'wallet-account-changed':
			return 'The connected wallet changed mid-dispatch. Reconnect the wallet that started this dispatch and resume.';
	}
	return appErrorMessage(error);
}

export const DISPATCH_STATUS_LABEL = { unsent: 'Unsent', posted: 'Posted', settled: 'Settled' } as const;

export function tokenPagePath(processId: string): string {
	return `/asset/${FUNGIBLE_TOKEN_COLLECTION_ID}/${processId}`;
}

/** The connected wallet's spendable token balance, or `null` when it cannot be read from complete holder state. */
export function dispatchSenderBalance(
	token: AssetState | null,
	walletAddress: string | null
): { balanceStateAvailable: boolean; balance: string | null } {
	const balanceStateAvailable = token ? assetBalanceStateAvailable(token) : false;
	return {
		balanceStateAvailable,
		balance: token && walletAddress && balanceStateAvailable ? liquidBalanceOf(token, walletAddress) : null,
	};
}

export type HolderDispatchQuote = {
	parsed: ParsedHolderList | null;
	estimate: DispatchCostEstimate | null;
	needsCostApproval: boolean;
	/** How many transfers are signed and posted together. */
	batchSize: number;
};

/** Parse the holder list in the token's precision and quote its network rewards once the per-transfer reward is known. */
export function holderDispatchQuote(
	holderText: string,
	token: Pick<AssetState, 'denomination'> | null,
	transferReward: bigint | null
): HolderDispatchQuote {
	const parsed = holderText.trim() && token ? parseHolderList(holderText, token.denomination) : null;
	const estimate =
		parsed?.rows.length && transferReward !== null ? estimateDispatchCost(parsed.rows, transferReward) : null;
	return {
		parsed,
		estimate,
		needsCostApproval: Boolean(estimate && requiresCostConfirmation(estimate.totalWinston)),
		batchSize: DEFAULT_DISPATCH_BATCH_SIZE,
	};
}

/** Whether a quoted list may be signed: parsed without errors and, above the cost threshold, explicitly approved. */
export function holderDispatchReady(quote: HolderDispatchQuote, costApproved: boolean): boolean {
	if (!quote.parsed?.rows.length || quote.parsed.errors.length) return false;
	return !quote.needsCostApproval || costApproved;
}

export type DispatchPlanProgress = { settled: number; posted: number; complete: boolean; senderMismatch: boolean };

export function dispatchPlanProgress(plan: DispatchPlan | null, walletAddress: string | null): DispatchPlanProgress {
	const settled = plan ? plan.rows.filter((row) => row.status === 'settled').length : 0;
	return {
		settled,
		posted: plan ? plan.rows.filter((row) => row.status === 'posted').length : 0,
		complete: Boolean(plan && settled === plan.rows.length),
		senderMismatch: Boolean(plan && walletAddress && plan.sender !== walletAddress),
	};
}

export type DispatchActivityPhase = 'working' | 'done' | 'error';

export function dispatchStartStatus(recipientCount: number): string {
	return `Dispatching to ${recipientCount} holder${recipientCount === 1 ? '' : 's'}…`;
}

export function dispatchProgressStatus(plan: DispatchPlan): string {
	return `${dispatchPlanProgress(plan, null).settled} of ${plan.rows.length} settled`;
}

// Surface the run in the top-bar activity notifier the same as a buy/sell/
// transfer. It rides the fungible runtime-activity channel with a dedicated
// `:dispatch` id so it never collides with a manual transfer on the same
// token; the operation reads as a transfer (a dispatch is batched transfers)
// and the status line carries the settled/total progress.
export function dispatchActivityChange(input: {
	processId: string;
	token: Pick<AssetState, 'ticker'> | null;
	sender: string;
	phase: DispatchActivityPhase;
	status: string;
	createdAt: number;
}): FungibleOperationActivityChange {
	const id = `fungible:${input.processId}:${input.sender}:dispatch`;
	if (input.phase === 'done') return { type: 'remove', id, owner: input.sender };
	return {
		type: 'upsert',
		activity: {
			id,
			asset: {
				id: input.processId,
				name: input.token?.ticker || 'Token',
				...(input.token?.ticker ? { ticker: input.token.ticker } : {}),
			},
			collectionId: FUNGIBLE_TOKEN_COLLECTION_ID,
			owner: input.sender,
			operationKind: 'transfer',
			phase: input.phase,
			status: input.status,
			createdAt: input.createdAt,
		},
	};
}

/** A dispatch run: idle between runs, running while transfers are signed and settled, failed with its copy. */
export type DispatchRun = { status: 'idle' } | { status: 'running' } | { status: 'failed'; error: string };

export type DispatchState = { plan: DispatchPlan | null; run: DispatchRun };

export type DispatchEvent =
	| { type: 'error-cleared' }
	| { type: 'plan-created'; plan: DispatchPlan }
	| { type: 'run-started' }
	| { type: 'progressed'; plan: DispatchPlan }
	| { type: 'failed'; error: string }
	| { type: 'run-settled' }
	| { type: 'discarded' };

const IDLE_RUN: DispatchRun = { status: 'idle' };

export function dispatchState(plan: DispatchPlan | null): DispatchState {
	return { plan, run: IDLE_RUN };
}

export function dispatchReducer(state: DispatchState, event: DispatchEvent): DispatchState {
	switch (event.type) {
		case 'error-cleared':
			return state.run.status === 'failed' ? { ...state, run: IDLE_RUN } : state;
		case 'plan-created':
		case 'progressed':
			return { ...state, plan: event.plan };
		case 'run-started':
			return state.run.status === 'running' ? state : { ...state, run: { status: 'running' } };
		case 'failed':
			return { ...state, run: { status: 'failed', error: event.error } };
		case 'run-settled':
			// A run leaves `running` when it ends; a failure recorded just before stays visible.
			return state.run.status === 'running' ? { ...state, run: IDLE_RUN } : state;
		case 'discarded':
			return state.run.status === 'running' ? state : dispatchState(null);
	}
}

export function dispatchRunError(run: DispatchRun): string | null {
	return run.status === 'failed' ? run.error : null;
}
