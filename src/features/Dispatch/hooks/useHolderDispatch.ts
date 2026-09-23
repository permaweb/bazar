import React from 'react';

import {
	createDispatchPlan,
	DEFAULT_DISPATCH_BATCH_SIZE,
	discardDispatchPlan,
	type DispatchPlan,
	loadDispatchPlan,
	runDispatch,
} from 'api/dispatch';
import {
	ASSET_BALANCE_STATE_UNAVAILABLE,
	assetBalanceStateAvailable,
	type AssetState,
	readAssetStateWithDeadline,
} from 'api/marketplace';
import { announceFungibleOperationActivityChange } from 'api/operations';
import { AssetTransactionClient } from 'api/transactions';

import { appError } from 'helpers/app-error';
import { useAppErrorMessages } from 'hooks/useAppErrorMessage';
import { useMessages, usePlural } from 'providers/LanguageProvider';
import { useWallet } from 'providers/WalletProvider';

import { DISPATCH_MESSAGES } from '../messages';
import {
	dispatchActivityChange,
	type DispatchActivityPhase,
	dispatchErrorMessage,
	type DispatchPlanProgress,
	dispatchPlanProgress,
	dispatchProgressStatus,
	dispatchReducer,
	type DispatchRun,
	dispatchStartStatus,
	dispatchState,
	type HolderDispatchQuote,
	holderDispatchReady,
} from '../model/dispatch';

export type HolderDispatchController = {
	/** The resumable plan saved in this browser for the token, if any. */
	plan: DispatchPlan | null;
	progress: DispatchPlanProgress;
	run: DispatchRun;
	/** Pre-flight the quoted list, save a resumable plan, and sign its transfers. Requires a user action. */
	start(quote: HolderDispatchQuote, costApproved: boolean): Promise<void>;
	/** Continue the saved plan from the wallet that started it, without re-sending posted transfers. */
	resume(): Promise<void>;
	discard(): void;
	clearError(): void;
};

/**
 * The holder dispatch flow for one token process: resumable plan persistence, wallet-signed batched transfers,
 * settlement progress, and the top-bar activity entry.
 */
export function useHolderDispatch(processId: string, token: AssetState | null): HolderDispatchController {
	const messages = useMessages(DISPATCH_MESSAGES);
	const errorMessages = useAppErrorMessages();
	const plural = usePlural();
	const wallet = useWallet();
	const abortRef = React.useRef<AbortController | null>(null);
	const [state, dispatch] = React.useReducer(dispatchReducer, processId, (id) => dispatchState(loadDispatchPlan(id)));
	const progress = dispatchPlanProgress(state.plan, wallet.address);
	const running = state.run.status === 'running';

	React.useEffect(() => () => abortRef.current?.abort(), []);

	const announce = (sender: string, phase: DispatchActivityPhase, status: string, createdAt: number) =>
		announceFungibleOperationActivityChange(
			dispatchActivityChange({ processId, token, sender, phase, status, createdAt, messages })
		);

	const execute = async (dispatchPlan: DispatchPlan) => {
		const controller = new AbortController();
		abortRef.current = controller;
		dispatch({ type: 'run-started' });
		const sender = dispatchPlan.sender;
		const startedAt = Date.now();
		announce(sender, 'working', dispatchStartStatus(dispatchPlan.rows.length, messages, plural), startedAt);
		try {
			await runDispatch(dispatchPlan, {
				signal: controller.signal,
				batchSize: DEFAULT_DISPATCH_BATCH_SIZE,
				readCurrentState: readAssetStateWithDeadline,
				onProgress: (next) => {
					dispatch({ type: 'progressed', plan: next });
					announce(sender, 'working', dispatchProgressStatus(next, messages), startedAt);
				},
			});
			announce(sender, 'done', '', startedAt);
		} catch (cause) {
			if (!controller.signal.aborted) {
				dispatch({ type: 'failed', error: dispatchErrorMessage(cause, messages, errorMessages) });
				announce(sender, 'error', dispatchErrorMessage(cause, messages, errorMessages), startedAt);
			}
		} finally {
			if (!controller.signal.aborted) dispatch({ type: 'run-settled' });
		}
	};

	return {
		plan: state.plan,
		progress,
		run: state.run,
		start: async (quote, costApproved) => {
			if (!wallet.address) {
				wallet.openConnectDialog();
				return;
			}
			if (running || !quote.parsed || !holderDispatchReady(quote, costApproved)) return;
			dispatch({ type: 'error-cleared' });
			try {
				if (!token || !assetBalanceStateAvailable(token)) throw appError(ASSET_BALANCE_STATE_UNAVAILABLE);
				// Pre-flight every network reward (native AR quantity stays zero) before creating a resumable
				// dispatch plan.
				if (quote.estimate) {
					const arBalance = await new AssetTransactionClient().walletBalance(wallet.address);
					if (arBalance < quote.estimate.totalWinston) throw appError('asset-purchase-insufficient-funds');
				}
				const created = await createDispatchPlan(processId, wallet.address, quote.parsed.rows);
				dispatch({ type: 'plan-created', plan: created });
				await execute(created);
			} catch (cause) {
				dispatch({ type: 'failed', error: dispatchErrorMessage(cause, messages, errorMessages) });
			}
		},
		resume: async () => {
			if (!state.plan || running || progress.senderMismatch) return;
			await execute(state.plan);
		},
		discard: () => {
			if (running) return;
			if (state.plan) announce(state.plan.sender, 'done', '', 0);
			discardDispatchPlan(processId);
			dispatch({ type: 'discarded' });
		},
		clearError: () => dispatch({ type: 'error-cleared' }),
	};
}
