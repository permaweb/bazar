import {
	type HttpResult,
	type Observer,
	type RequestOptions,
	type TxWatcher,
	type WatchOptions,
	WeaveNetwork,
} from 'weave-wrangler';

import { observerDiscoveryComplete, observerWatchOptions } from './observer-policy';

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
	override watch(id: string, options: WatchOptions = {}): TxWatcher {
		return super.watch(id, observerWatchOptions(options));
	}

	override async request<T = unknown>(
		observer: Observer,
		path: string,
		options?: Omit<RequestOptions, 'fetch' | 'method'>
	): Promise<HttpResult<T>> {
		if (observerDiscoveryComplete(this.active().length, path)) {
			// Report an incomplete discovery pass so WeaveNetwork may revisit this
			// observer if the healthy cohort later drops below the target.
			return { ok: false, status: 0, latency: 0, error: 'observer-discovery-paused' };
		}
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
