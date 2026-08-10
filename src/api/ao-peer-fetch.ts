import { fetchWithDeadline } from './fetch-with-deadline';

const DEFAULT_CONTROL_WINDOW_MS = 180_000;
const DEFAULT_DECREASE_FACTOR = 2 / 3;
const DEFAULT_RECOVERY_FACTOR = 1.1;
const DEFAULT_RETRY_AFTER_MS = 1_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const MINIMUM_SAMPLE_MS = 1_000;

export type AoPeerRateOptions = {
	controlWindowMs?: number;
	decreaseFactor?: number;
	recoveryFactor?: number;
	retryAfterFallbackMs?: number;
	maxRetries?: number;
	requestTimeoutMs?: number;
	minimumRequestsPerSecond?: number;
	maxRequestsPerSecond?: number | Readonly<Record<string, number>>;
};

type PeerState = {
	blockedUntil: number;
	ceiling: number;
	dispatchedAt: number[];
	nextAllowedAt: number;
	nextDecreaseAt: number;
	nextRecoveryAt: number;
	rate: number;
};

const nativeFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);
const wrappers = new WeakMap<typeof fetch, typeof fetch>();
const managed = new WeakSet<typeof fetch>();

export function aoPeerFetch(fetcher: typeof fetch = nativeFetch): typeof fetch {
	if (managed.has(fetcher)) return fetcher;
	let wrapper = wrappers.get(fetcher);
	if (!wrapper) {
		wrapper = createAoPeerFetch(fetcher);
		wrappers.set(fetcher, wrapper);
		managed.add(wrapper);
	}
	return wrapper;
}

export function createAoPeerFetch(fetcher: typeof fetch, options: AoPeerRateOptions = {}): typeof fetch {
	const controlWindowMs = positive(options.controlWindowMs, DEFAULT_CONTROL_WINDOW_MS);
	const decreaseFactor = fraction(options.decreaseFactor, DEFAULT_DECREASE_FACTOR);
	const recoveryFactor = atLeast(options.recoveryFactor, 1, DEFAULT_RECOVERY_FACTOR);
	const retryAfterFallbackMs = positive(options.retryAfterFallbackMs, DEFAULT_RETRY_AFTER_MS);
	const maxRetries = nonNegativeInteger(options.maxRetries, DEFAULT_MAX_RETRIES);
	const requestTimeoutMs = positive(options.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
	const minimumRate = positive(options.minimumRequestsPerSecond, 1 / 60);
	const states = new Map<string, PeerState>();

	return async (input, init = {}) => {
		const origin = requestOrigin(input);
		let state = states.get(origin);
		if (!state) {
			const ceiling = configuredRate(options.maxRequestsPerSecond, origin);
			state = {
				blockedUntil: 0,
				ceiling,
				dispatchedAt: [],
				nextAllowedAt: 0,
				nextDecreaseAt: 0,
				nextRecoveryAt: Number.POSITIVE_INFINITY,
				rate: ceiling,
			};
			states.set(origin, state);
		}
		const signal = init.signal ?? requestSignal(input);
		const method = (init.method ?? requestMethod(input)).toUpperCase();
		const retryable = method === 'GET' || method === 'HEAD';

		for (let attempt = 0; ; attempt += 1) {
			await admit(state, signal, controlWindowMs, recoveryFactor);
			const response = await fetchWithDeadline(
				fetcher,
				input,
				{ ...init, signal },
				{ timeoutMs: requestTimeoutMs, timeoutError: 'ao-peer-timeout' }
			);
			if (response.status !== 429) return response;

			const now = Date.now();
			state.blockedUntil = Math.max(
				state.blockedUntil,
				retryDeadline(response.headers.get('retry-after'), now) ?? now + retryAfterFallbackMs
			);
			if (now >= state.nextDecreaseAt) {
				const observedRate = recentRate(state, now, controlWindowMs);
				state.rate = Math.max(minimumRate, Math.min(state.rate, observedRate) * decreaseFactor);
				state.nextDecreaseAt = now + controlWindowMs;
				state.nextRecoveryAt = now + controlWindowMs;
			}
			if (!retryable || attempt >= maxRetries) return response;
			void response.body?.cancel().catch(() => undefined);
		}
	};
}

async function admit(
	state: PeerState,
	signal: AbortSignal | null | undefined,
	controlWindowMs: number,
	recoveryFactor: number
) {
	while (true) {
		throwIfAborted(signal);
		const now = Date.now();
		recover(state, now, controlWindowMs, recoveryFactor);
		const admittedAt = Math.max(state.blockedUntil, state.nextAllowedAt);
		if (admittedAt <= now) {
			state.dispatchedAt.push(now);
			trimHistory(state, now, controlWindowMs);
			state.nextAllowedAt = Number.isFinite(state.rate) ? now + 1000 / state.rate : now;
			return;
		}
		await delay(admittedAt - now, signal);
	}
}

function recover(state: PeerState, now: number, controlWindowMs: number, recoveryFactor: number) {
	if (!Number.isFinite(state.rate) || now < state.nextRecoveryAt) return;
	const cycles = Math.floor((now - state.nextRecoveryAt) / controlWindowMs) + 1;
	state.rate = Math.min(state.ceiling, state.rate * recoveryFactor ** cycles);
	state.nextRecoveryAt += cycles * controlWindowMs;
}

function recentRate(state: PeerState, now: number, controlWindowMs: number) {
	trimHistory(state, now, controlWindowMs);
	const oldest = state.dispatchedAt[0] ?? now;
	const sampleMs = Math.min(controlWindowMs, Math.max(MINIMUM_SAMPLE_MS, now - oldest));
	return (state.dispatchedAt.length * 1000) / sampleMs;
}

function trimHistory(state: PeerState, now: number, controlWindowMs: number) {
	const first = state.dispatchedAt.findIndex((at) => at > now - controlWindowMs);
	if (first > 0) state.dispatchedAt.splice(0, first);
	else if (first === -1) state.dispatchedAt.splice(0);
}

function retryDeadline(value: string | null, now: number): number | undefined {
	if (!value?.trim()) return undefined;
	const seconds = Number(value);
	if (Number.isFinite(seconds)) return now + Math.max(0, seconds) * 1000;
	const date = Date.parse(value);
	return Number.isFinite(date) ? Math.max(now, date) : undefined;
}

function requestOrigin(input: RequestInfo | URL) {
	const value = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
	const base = typeof location === 'undefined' ? 'http://localhost' : location.href;
	return new URL(value, base).origin;
}

function requestMethod(input: RequestInfo | URL) {
	return typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET';
}

function requestSignal(input: RequestInfo | URL) {
	return typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined;
}

function configuredRate(config: AoPeerRateOptions['maxRequestsPerSecond'], origin: string) {
	const value = typeof config === 'number' ? config : config?.[origin];
	return value === undefined ? Number.POSITIVE_INFINITY : positive(value, Number.POSITIVE_INFINITY);
}

function delay(ms: number, signal?: AbortSignal | null) {
	return new Promise<void>((resolve, reject) => {
		const timer = setTimeout(done, ms);
		const abort = () => {
			clearTimeout(timer);
			signal?.removeEventListener('abort', abort);
			reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
		};
		function done() {
			signal?.removeEventListener('abort', abort);
			resolve();
		}
		signal?.addEventListener('abort', abort, { once: true });
	});
}

function throwIfAborted(signal?: AbortSignal | null) {
	if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function positive(value: number | undefined, fallback: number) {
	return typeof value === 'number' && value > 0 && Number.isFinite(value) ? value : fallback;
}

function fraction(value: number | undefined, fallback: number) {
	return typeof value === 'number' && value > 0 && value < 1 ? value : fallback;
}

function atLeast(value: number | undefined, minimum: number, fallback: number) {
	return typeof value === 'number' && value >= minimum && Number.isFinite(value) ? value : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number) {
	return Number.isSafeInteger(value) && value! >= 0 ? value! : fallback;
}
