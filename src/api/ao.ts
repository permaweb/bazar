import { type AoCacheMetadata, type AoCacheStatus, cacheMetadata, createAo } from 'ao.js';

import {
	AO_WALLET_CONNECTION_EVENT,
	aoPeerPlanFromLocation,
	gatewaysFromLocation,
	loadPermawebOsNetworkPolicy,
	markServingOriginWithoutCompute,
	refreshPermawebOsNetworkPolicy,
	usesPermawebOsAo,
} from 'helpers/config';

import { fetchWithDeadline } from './fetch-with-deadline';

export type { AoCacheMetadata, AoCacheStatus };

type Nodes = string | readonly string[];

export type AoPeerFetch = typeof fetch & {
	invalidate(input: RequestInfo | URL, init?: RequestInit): Promise<void>;
	cacheMetadata(response: Response): AoCacheMetadata | undefined;
	readonly peers: readonly string[];
	ready(): Promise<readonly string[]>;
	allowNotFound?(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type BazarAoPeerFetch = AoPeerFetch & {
	allowNotFound(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

let bazarTransport: { peers: string; fetcher: BazarAoPeerFetch } | undefined;
const servingOriginProbes = new Map<string, Promise<boolean>>();
const SERVING_ORIGIN_PROBE_TIMEOUT_MS = 10_000;

function nodeList(nodes?: Nodes): string[] {
	return typeof nodes === 'string' ? [nodes] : [...(nodes ?? [])];
}

function permawebOsAoFetch(): AoPeerFetch | undefined {
	return usesPermawebOsAo() ? globalThis.window?.aoFetch : undefined;
}

function directAoFetch(): BazarAoPeerFetch {
	const { peers, ordered } = aoPeerPlanFromLocation();
	const signature = `${ordered ? 'ordered' : 'by-base'}\n${peers.join('\n')}`;
	if (bazarTransport?.peers !== signature) {
		bazarTransport = { peers: signature, fetcher: createBazarAoFetch(peers, undefined, { ordered }) };
	}
	return bazarTransport.fetcher;
}

/**
 * `ordered` tries peers in the given priority order; otherwise reads are spread
 * across the peers by hashpath base.
 */
export function createBazarAoFetch(
	nodes: Nodes,
	override?: typeof fetch,
	options: { ordered?: boolean } = {}
): BazarAoPeerFetch {
	const peers = Object.freeze(nodeList(nodes));
	const client = createAo(
		peerConfig(peers, override ? false : 'discover', options.ordered === true),
		admitProcessStateReads(override ?? ((input, init) => globalThis.fetch(input, init)))
	);
	const origins = new Set(peers.map((peer) => new URL(peer).origin));
	const routed = ((input, init) => client.fetch(routeDefaultPeerRequest(input, origins), init)) as BazarAoPeerFetch;
	let readiness: Promise<readonly string[]> | undefined;
	routed.invalidate = (input, init) => client.invalidate(routeDefaultPeerRequest(input, origins), init);
	routed.allowNotFound = (input, init) =>
		client.request(
			{
				path: requestPath(routeDefaultPeerRequest(input, origins)),
				method: init?.method ?? 'GET',
				'multirequest-admissible-status': [200, 201, 202, 204, 206, 304, 404],
			},
			init
		);
	routed.cacheMetadata = cacheMetadata;
	Object.defineProperty(routed, 'peers', { value: peers });
	routed.ready = () => {
		readiness ??= client
			.warm()
			.catch(() => undefined)
			.then(() => peers);
		return readiness;
	};
	return routed;
}

export function aoFetch(override?: typeof fetch): AoPeerFetch | typeof fetch {
	return override ?? permawebOsAoFetch() ?? directAoFetch();
}

export function aoPeers(): string[] {
	return gatewaysFromLocation();
}

export function aoPrimaryPeer(): string {
	return aoPeers()[0] ?? '';
}

export function aoCacheMetadata(response: Response): AoCacheMetadata | undefined {
	const readPermawebOsMetadata = permawebOsAoFetch()?.cacheMetadata;
	return (
		(typeof readPermawebOsMetadata === 'function' ? readPermawebOsMetadata(response) : undefined) ??
		cacheMetadata(response)
	);
}

export async function readyAoFetch(): Promise<readonly string[]> {
	const fetcher = permawebOsAoFetch() ?? directAoFetch();
	const currentPeers = Array.isArray(fetcher.peers)
		? fetcher.peers.filter((peer): peer is string => typeof peer === 'string')
		: [];
	if (typeof fetcher.ready !== 'function') return currentPeers;
	try {
		const peers = await fetcher.ready();
		return Array.isArray(peers) ? peers.filter((peer): peer is string => typeof peer === 'string') : currentPeers;
	} catch {
		return currentPeers;
	}
}

/**
 * Ask the serving origin, at most once per page load, for one known process's
 * cached state. An origin that answers not-found or with an inadmissible state,
 * such as an ArNS host or a static SPA host, is dropped from the last-resort peers
 * so reads stop paying for it first. The drop lasts for the tab session, so later
 * page loads start without the origin and do not probe again. Resolves true when
 * this call dropped the origin.
 */
export function probeServingOriginCompute(
	processId: string,
	fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
	location: Parameters<typeof aoPeerPlanFromLocation>[0] = globalThis.window?.location
): Promise<boolean> {
	const origin = aoPeerPlanFromLocation(location).servingOrigin;
	if (!origin || !/^[A-Za-z0-9_-]{43}$/.test(processId)) return Promise.resolve(false);
	let probe = servingOriginProbes.get(origin);
	if (!probe) {
		probe = fetchWithDeadline(
			fetcher,
			`${origin}/${processId}~process@1.0/compute&max-age=86400`,
			{ method: 'HEAD', credentials: 'omit' },
			{ timeoutMs: SERVING_ORIGIN_PROBE_TIMEOUT_MS, timeoutError: 'serving-origin-probe-timeout' }
		).then(
			(response) => {
				void response.body?.cancel().catch(() => undefined);
				if (response.status !== 404 && !inadmissibleProcessState(response)) return false;
				markServingOriginWithoutCompute(origin);
				return true;
			},
			() => false
		);
		servingOriginProbes.set(origin, probe);
	}
	return probe;
}

/**
 * Start transport discovery without making otherwise independent application data wait for it.
 * With `probeProcessId`, Bazar's own transport also checks once whether the serving origin computes.
 */
export function warmAoFetch(onNetworkPolicy?: () => void, options: { probeProcessId?: string } = {}): () => void {
	let stopped = false;
	if (options.probeProcessId && !permawebOsAoFetch()) {
		void probeServingOriginCompute(options.probeProcessId).then((dropped) => {
			if (!dropped) return;
			// The transport without the origin is a new AO.js client; discover its peers now
			// rather than inside the request budget of the first reads routed to it.
			void readyAoFetch();
			if (!stopped) onNetworkPolicy?.();
		});
	}
	const loadPolicy = (refresh: boolean) => {
		if (!permawebOsAoFetch()) return;
		const loading = refresh ? refreshPermawebOsNetworkPolicy() : loadPermawebOsNetworkPolicy();
		void loading.then((policy) => {
			if (!stopped && (refresh || policy)) onNetworkPolicy?.();
		});
	};
	const policyChanged = () => {
		void readyAoFetch();
		loadPolicy(true);
	};
	const walletChanged = () => {
		if (!stopped) onNetworkPolicy?.();
		policyChanged();
	};
	globalThis.window?.addEventListener?.('aoFetchLoaded', policyChanged);
	globalThis.window?.addEventListener?.(AO_WALLET_CONNECTION_EVENT, walletChanged);
	void readyAoFetch();
	loadPolicy(false);
	return () => {
		stopped = true;
		globalThis.window?.removeEventListener?.('aoFetchLoaded', policyChanged);
		globalThis.window?.removeEventListener?.(AO_WALLET_CONNECTION_EVENT, walletChanged);
	};
}
function peerConfig(peers: readonly string[], rateLimit: 'discover' | false, ordered: boolean) {
	const nodes = peers.map((prefix) => ({ prefix, 'rate-limit': rateLimit } as const));
	const strategy = ordered ? ('All' as const) : ('By-Base' as const);
	const readRoute = (method: 'GET' | 'HEAD') => ({
		template: { method },
		nodes,
		strategy,
		choose: nodes.length,
		'admissible-status': [200, 201, 202, 204, 206, 304],
		'fallback-on-cooldown': true,
	});
	return {
		nodes,
		requestTimeoutMs: 4_000,
		...(nodes.length
			? {
					routes: [
						readRoute('GET'),
						readRoute('HEAD'),
						{ template: '*', nodes, strategy, choose: nodes.length },
					],
			  }
			: {}),
	};
}

function requestPath(input: RequestInfo | URL): string {
	return typeof input === 'string' || input instanceof URL ? String(input) : input.url;
}

function routeDefaultPeerRequest(input: RequestInfo | URL, origins: ReadonlySet<string>): RequestInfo | URL {
	if (input instanceof Request) return input;
	try {
		const url = new URL(String(input));
		return origins.has(url.origin) ? `${url.pathname}${url.search}${url.hash}` : input;
	} catch {
		return input;
	}
}

/** The current or cached state of one process, as Bazar's readers request it. */
const PROCESS_STATE_READ = /^\/[A-Za-z0-9_-]{43}~process@1\.0\/(?:now|compute)(?:&[^/]*)?$/;

function isProcessStateRead(input: RequestInfo | URL): boolean {
	try {
		return PROCESS_STATE_READ.test(new URL(requestPath(input), 'http://ao.invalid').pathname);
	} catch {
		return false;
	}
}

/**
 * A successful process state answer always carries the slot it was evaluated at.
 * Static hosts answer device paths with their HTML shell, and some peers return
 * header-only shells without state; neither may be parsed as process state.
 */
function inadmissibleProcessState(response: Response): boolean {
	if (!response.ok) return false;
	if (/^\s*text\/html\b/i.test(response.headers.get('content-type') ?? '')) return true;
	if (response.headers.get('codec-device')?.toLowerCase() === 'json@1.0') return false;
	return !response.headers.has('at-slot');
}

/** Fail a peer's inadmissible state answer so AO.js routes the read to the next peer. */
function admitProcessStateReads(fetcher: typeof fetch): typeof fetch {
	return async (input, init) => {
		const response = await fetcher(input, init);
		if (!isProcessStateRead(input) || !inadmissibleProcessState(response)) return response;
		void response.body?.cancel().catch(() => undefined);
		throw new Error('ao-inadmissible-process-state');
	};
}
