import { type HttpResult, type Observer, type RequestOptions, WeaveNetwork } from 'weave-wrangler';

export const ARWEAVE_OBSERVER_RESPONSE_EVENT = 'ao:arweave-observer-response';

export type ArweaveObserverResponseDetail = {
	transactionId: string;
	observer: Observer;
	observedAt: number;
	status: number;
	latency: number;
	body?: unknown;
	error?: string;
};

/**
 * A WeaveNetwork that publishes each transaction-status response so any
 * synchronization UI can render the individual observer events live.
 */
export class ArweaveObserverNetwork extends WeaveNetwork {
	override async request<T = unknown>(
		observer: Observer,
		path: string,
		options?: Omit<RequestOptions, 'fetch' | 'method'>
	): Promise<HttpResult<T>> {
		const result = await super.request<T>(observer, path, options);
		const transactionId = path.match(/^\/tx\/([A-Za-z0-9_-]{43})\/status(?:\?|$)/)?.[1];
		if (
			transactionId &&
			typeof globalThis.window !== 'undefined' &&
			typeof globalThis.CustomEvent !== 'undefined'
		) {
			window.dispatchEvent(
				new CustomEvent<ArweaveObserverResponseDetail>(ARWEAVE_OBSERVER_RESPONSE_EVENT, {
					detail: {
						transactionId,
						observer: { ...observer },
						observedAt: Date.now(),
						status: result.status,
						latency: result.latency,
						...(result.body === undefined ? {} : { body: result.body }),
						...(result.error === undefined ? {} : { error: result.error }),
					},
				})
			);
		}
		return result;
	}
}
