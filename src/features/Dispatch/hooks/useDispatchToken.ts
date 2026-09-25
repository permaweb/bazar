import React from 'react';

import { fetchTransferReward } from 'api/dispatch';
import { type AssetState, readAssetStateWithDeadline } from 'api/marketplace';

import { toAppError } from 'helpers/app-error';
import { asyncData, type AsyncState, beginLoad, failLoad, IDLE } from 'helpers/async-state';
import { arweaveGatewayFromLocation } from 'helpers/config';

export type DispatchToken = {
	/** Fresh token process state; a failed retry keeps the last readable state visible. */
	token: AsyncState<AssetState>;
	/** The network reward for one transfer, read once the token state is readable. */
	transferReward: AsyncState<bigint>;
	retry(): void;
};

/** Reads a token's live process state (bypassing the display cache) and the per-transfer network reward. */
export function useDispatchToken(processId: string): DispatchToken {
	const [attempt, setAttempt] = React.useState(0);
	const [token, setToken] = React.useState<AsyncState<AssetState>>(IDLE);
	const [transferReward, setTransferReward] = React.useState<AsyncState<bigint>>(IDLE);
	const tokenState = asyncData(token);

	React.useEffect(() => {
		const controller = new AbortController();
		setToken(beginLoad);
		void readAssetStateWithDeadline(processId, { signal: controller.signal, maxAge: 0 }).then(
			(result) => {
				if (!controller.signal.aborted) setToken({ status: 'success', data: result.state });
			},
			(cause) => {
				if (!controller.signal.aborted)
					setToken((current) => failLoad(current, toAppError(cause, 'unavailable')));
			}
		);
		return () => controller.abort();
	}, [processId, attempt]);

	React.useEffect(() => {
		if (!tokenState) return;
		const controller = new AbortController();
		setTransferReward(beginLoad);
		void fetchTransferReward(arweaveGatewayFromLocation(), processId, undefined, controller.signal).then(
			(reward) => {
				if (!controller.signal.aborted) setTransferReward({ status: 'success', data: reward });
			},
			(cause) => {
				// The quote stays unavailable (or keeps the last reward) until a later token read refreshes it.
				if (!controller.signal.aborted) {
					setTransferReward((current) => failLoad(current, toAppError(cause, 'unavailable')));
				}
			}
		);
		return () => controller.abort();
	}, [processId, tokenState]);

	return { token, transferReward, retry: () => setAttempt((current) => current + 1) };
}
