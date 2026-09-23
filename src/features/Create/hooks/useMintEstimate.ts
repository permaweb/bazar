import React from 'react';

import { type AppError, toAppError } from 'helpers/app-error';
import { type AsyncState, beginLoad, failLoad, IDLE } from 'helpers/async-state';

import { discardEstimate } from '../model/mint-flow';

/** Inputs settle for this long before a network cost estimate is requested. */
export const MINT_ESTIMATE_DEBOUNCE_MS = 250;

export type MintEstimateState<Estimate> = {
	estimate: AsyncState<Estimate>;
	/** Forget the current estimate because an input that prices the mint changed. */
	discard(): void;
};

/**
 * A debounced, cancellable network cost estimate for the current mint inputs. A new request identity restarts the
 * debounce and aborts the previous request (latest inputs win); `null` means the inputs are incomplete. A failed
 * refresh keeps the last estimate.
 */
export function useMintEstimate<Request, Estimate>(
	request: Request | null,
	estimate: (request: Request, signal: AbortSignal) => Promise<Estimate>,
	onStart: () => void,
	onError: (error: AppError) => void
): MintEstimateState<Estimate> {
	const [state, setState] = React.useState<AsyncState<Estimate>>(IDLE);

	React.useEffect(() => {
		if (!request) {
			setState(IDLE);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			setState(beginLoad);
			onStart();
			void estimate(request, controller.signal).then(
				(next) => {
					if (!controller.signal.aborted) setState({ status: 'success', data: next });
				},
				(cause) => {
					if (controller.signal.aborted) return;
					const error = toAppError(cause, 'unknown');
					setState((current) => failLoad(current, error));
					onError(error);
				}
			);
		}, MINT_ESTIMATE_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [request, estimate, onStart, onError]);

	const discard = React.useCallback(() => setState(discardEstimate), []);
	return { estimate: state, discard };
}
