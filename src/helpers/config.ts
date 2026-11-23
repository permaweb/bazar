import { AO_SERVING_ORIGIN_WITHOUT_COMPUTE_STORAGE_PREFIX } from './browser-storage';

const configuredArweaveGateway = import.meta.env.VITE_ARWEAVE_GATEWAY?.trim();
const configuredComputeGateway = import.meta.env.VITE_COMPUTE_GATEWAY?.trim();
const configuredGraphqlEndpoints = import.meta.env.VITE_GRAPHQL_ENDPOINTS?.trim();

export type NetworkProviderSummary = {
	url: string;
	ownership: 'community' | 'default' | 'personal';
};

export type EffectivePermawebNetworkPolicy = {
	version: 1;
	fingerprint?: string;
	arweaveGateway: NetworkProviderSummary;
	permanentContent: NetworkProviderSummary;
	publishing: NetworkProviderSummary;
	ao: {
		processReads: readonly NetworkProviderSummary[];
		scheduleReads: readonly NetworkProviderSummary[];
		linkedStateReads: readonly NetworkProviderSummary[];
		observerRelay?: NetworkProviderSummary;
		scheduleWrite?: NetworkProviderSummary;
		directWrite?: NetworkProviderSummary;
		fallbackMode: 'custom' | 'hosted' | 'personal-first' | 'personal-only';
	};
};

const networkPolicies = new WeakMap<PermawebOsAoFetch, EffectivePermawebNetworkPolicy>();
const networkPolicyLoads = new WeakMap<PermawebOsAoFetch, Promise<EffectivePermawebNetworkPolicy | undefined>>();
const networkPolicyRevisions = new WeakMap<PermawebOsAoFetch, number>();
const strictNetworkPolicyFetchers = new WeakSet<PermawebOsAoFetch>();
type AoRoutingScope = Pick<Window, 'aoFetch'> & Partial<Pick<Window, 'arweaveWallet' | 'permawebConnect'>>;
const connectedRoutingWallets = new WeakMap<AoRoutingScope, ArweaveWalletProvider>();
export const AO_WALLET_CONNECTION_EVENT = 'bazarWalletConnectionChanged';

/** Called only after Bazar has restored or explicitly changed its active wallet. */
export function setAoWalletConnection(address: string | null, scope: AoRoutingScope | undefined = globalThis.window) {
	if (!scope) return;
	const previous = connectedRoutingWallets.get(scope);
	const wallet =
		address && scope.permawebConnect && scope.arweaveWallet === scope.permawebConnect
			? scope.permawebConnect
			: undefined;
	if (wallet) connectedRoutingWallets.set(scope, wallet);
	else connectedRoutingWallets.delete(scope);
	if (previous !== wallet && scope === globalThis.window) {
		globalThis.window?.dispatchEvent?.(new Event(AO_WALLET_CONNECTION_EVENT));
	}
}

export const DEFAULT_ARWEAVE_GATEWAY = configuredArweaveGateway
	? new URL(configuredArweaveGateway).origin
	: 'https://arweave.net';
export const AO_TRANSPORT_QUERY_PARAMETER = 'ao-transport';
export const BAZAR_AO_TRANSPORT = 'bazar';

export function bazarAoTransportUrl(value: string | URL): string {
	const url = new URL(value.toString());
	url.searchParams.set(AO_TRANSPORT_QUERY_PARAMETER, BAZAR_AO_TRANSPORT);
	return url.toString();
}

export function normalizeComputeGateways(value: string, defaultProtocol = 'https:'): string[] | null {
	let entries: unknown[];
	try {
		entries = value.trim().startsWith('[') ? JSON.parse(value) : value.split(/[\s,]+/);
	} catch {
		return null;
	}
	if (!Array.isArray(entries) || !entries.length || entries.some((entry) => typeof entry !== 'string')) return null;
	const origins = entries.filter(Boolean).map((entry) => httpOrigin(entry as string, defaultProtocol));
	return origins.length && origins.every(Boolean) ? [...new Set(origins as string[])] : null;
}

export const NAMES_NAMESPACE_ID =
	import.meta.env.VITE_NAMES_NAMESPACE_ID ?? 'fQXYPE9MAcfI1wV2CwJ3sJIhgT9btBOlYFOKFDGhAs0';

type GatewayLocation = Pick<Location, 'protocol' | 'hostname' | 'port' | 'search' | 'hash'>;

function locationOrigin(location: GatewayLocation): string {
	return `${location.protocol}//${location.hostname}${location.port ? `:${location.port}` : ''}`;
}

function queryValue(location: Pick<GatewayLocation, 'search' | 'hash'>, name: string): string | null {
	const hashQueryIndex = location.hash?.indexOf('?') ?? -1;
	const hashSearch = hashQueryIndex === -1 ? '' : location.hash.slice(hashQueryIndex);
	return new URLSearchParams(location.search).get(name) ?? new URLSearchParams(hashSearch).get(name);
}

function httpOrigin(value: string, defaultProtocol?: string): string | null {
	try {
		const requested = value.trim();
		const local = /^(?:localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)(?::|$)/i.test(requested);
		const protocol = local ? defaultProtocol : 'https:';
		const url = new URL(requested.includes('://') || !protocol ? requested : `${protocol}//${requested}`);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
	} catch {
		return null;
	}
}

function isLocalGatewayHost(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

export function arweaveGatewayOverrideFromLocation(location: GatewayLocation): string | null {
	const requested = queryValue(location, 'arweave-node')?.trim();
	return requested ? httpOrigin(requested) : null;
}

export function arweaveGatewayFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location
): string {
	if (!location) return DEFAULT_ARWEAVE_GATEWAY;
	const requested = arweaveGatewayOverrideFromLocation(location);
	if (requested) return requested;
	if (configuredArweaveGateway) return DEFAULT_ARWEAVE_GATEWAY;
	if (!['http:', 'https:'].includes(location.protocol) || isLocalGatewayHost(location.hostname)) {
		return DEFAULT_ARWEAVE_GATEWAY;
	}
	return locationOrigin(location);
}

export function arweaveClientConfig(gateway = arweaveGatewayFromLocation()) {
	const url = new URL(gateway);
	return {
		host: url.hostname,
		port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
		protocol: url.protocol.slice(0, -1),
	};
}

/**
 * arweave.net's index only. A deployment that runs or trusts another index lists it, in
 * preference order, in `VITE_GRAPHQL_ENDPOINTS`; reads then fall back along that list.
 */
export const DEFAULT_GRAPHQL_ENDPOINTS: readonly string[] = ['https://arweave.net/graphql'];

/** Parse an ordered, comma-separated GraphQL endpoint list; unusable entries are skipped. */
export function parseGraphqlEndpoints(value: string | undefined): string[] {
	const endpoints = new Set<string>();
	for (const entry of value?.split(',') ?? []) {
		const candidate = entry.trim();
		if (!candidate) continue;
		try {
			const url = new URL(candidate);
			if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) endpoints.add(url.href);
		} catch {
			// A malformed entry must not take indexed search down with it.
		}
	}
	return endpoints.size ? [...endpoints] : [...DEFAULT_GRAPHQL_ENDPOINTS];
}

const graphqlEndpoints = parseGraphqlEndpoints(configuredGraphqlEndpoints);

/** Indexed-search endpoints in preference order, independent of the serving host and content gateway. */
export function arweaveGraphqlEndpoints(): string[] {
	return [...graphqlEndpoints];
}

/** The preferred indexed-search endpoint; persisted cursors and scan scopes stay keyed to it. */
export function arweaveGraphqlEndpoint(): string {
	return graphqlEndpoints[0];
}

/** AR.IO gateway domains whose apex and ArNS/sandbox subdomains serve item bytes on `/raw/<id>`. */
const AR_IO_CONTENT_DOMAINS = ['arweave.net', 'ardrive.net'] as const;

/** Domains whose subdomains are AR.IO gateways but whose apex is not (https://ar.io/raw/<id> is 404 HTML). */
const AR_IO_CONTENT_SUBDOMAIN_ROOTS = ['ar.io'] as const;

/** Public AR.IO content gateways tried, in order, after the selected and same-origin gateways. */
export const ARWEAVE_CONTENT_FALLBACK_GATEWAYS = ['https://ardrive.net', 'https://arweave.net'] as const;

/**
 * AR.IO gateways redirect `/<id>` to a `<b32>` sandbox that answers 200 with an empty body for
 * process-with-data items, so content reads must use `/raw/<id>` there. HyperBEAM nodes have no
 * `/raw` route and serve `/<id>` directly.
 */
export function isArIoContentGateway(gateway: string): boolean {
	let hostname: string;
	try {
		hostname = new URL(gateway).hostname.toLowerCase();
	} catch {
		return false;
	}
	return (
		AR_IO_CONTENT_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ||
		AR_IO_CONTENT_SUBDOMAIN_ROOTS.some((domain) => hostname.endsWith(`.${domain}`))
	);
}

/** Address an Arweave item's bytes through the route the gateway kind serves them on. */
export function arweaveDataUrl(id: string, gateway = arweaveGatewayFromLocation()): string {
	const base = gateway.replace(/\/+$/, '');
	return isArIoContentGateway(base) ? `${base}/raw/${id}` : `${base}/${id}`;
}

/**
 * Content URLs for one Arweave item: the PermawebOS permanent-content provider (or the selected
 * gateway), the same-origin AR.IO gateway, the caller's URL, then public AR.IO fallbacks. An active
 * PermawebOS network policy names its own content providers, so public fallbacks are left out.
 */
export function arweaveDataFallbackUrls(
	value: string,
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): string[] {
	if (!location) return [value];
	let url: URL;
	try {
		url = new URL(value, locationOrigin(location));
	} catch {
		return [value];
	}
	const match = url.pathname.match(/^\/(?:raw\/)?([A-Za-z0-9_-]{43})$/);
	if (!match) return [value];
	const id = match[1];
	const policy = usesPermawebOsAo(location, scope) ? currentPermawebOsNetworkPolicy(scope) : undefined;
	const computeOrigins = new Set(policy?.ao.processReads.map(({ url: provider }) => new URL(provider).origin));
	const permanent = arweaveDataUrl(id, permanentContentGatewayFromLocation(location, scope));
	const servingOrigin = locationOrigin(location);
	const requested = isArIoContentGateway(url.origin) ? arweaveDataUrl(id, url.origin) : value;
	return [
		...new Set([
			permanent,
			arweaveDataUrl(id, arweaveGatewayFromLocation(location)),
			...(isArIoContentGateway(servingOrigin) ? [arweaveDataUrl(id, servingOrigin)] : []),
			...(computeOrigins.has(url.origin) && url.origin !== new URL(permanent).origin ? [] : [requested]),
			...(policy ? [] : ARWEAVE_CONTENT_FALLBACK_GATEWAYS.map((gateway) => arweaveDataUrl(id, gateway))),
		]),
	];
}

export function permawebOsAoAvailable(scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window): boolean {
	return typeof scope?.aoFetch === 'function';
}

export function prefersPermawebOsAo(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): boolean {
	if (!permawebOsAoAvailable(scope)) return false;
	return !location || queryValue(location, AO_TRANSPORT_QUERY_PARAMETER) !== BAZAR_AO_TRANSPORT;
}

export function usesPermawebOsAo(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: AoRoutingScope | undefined = globalThis.window
): boolean {
	return Boolean(
		prefersPermawebOsAo(location, scope) &&
			scope?.permawebConnect &&
			scope.arweaveWallet === scope.permawebConnect &&
			connectedRoutingWallets.get(scope) === scope.permawebConnect
	);
}

/** Upstream-neutral compute peers tried after the serving origin when no AO peer is selected or configured. */
export const DEFAULT_COMPUTE_GATEWAYS: readonly string[] = Object.freeze(['https://arweave.net']);

/** Serving origins known, or known not, to lack process compute in this page load. */
const servingOriginsWithoutCompute = new Map<string, boolean>();

export type AoPeerPlan = {
	peers: string[];
	/** A `?node=` selection, VITE_COMPUTE_GATEWAY, or the last-resort default peers. */
	source: 'selected' | 'configured' | 'default';
	/**
	 * Peers are a priority order: the first answers every read and the next is tried
	 * when it fails, answers inadmissibly, or is still silent after the hedge delay.
	 * Every plan with peers is ordered; only the empty plan outside HTTP(S) is not.
	 */
	ordered: boolean;
	/** The serving origin, while it still leads the default peers. */
	servingOrigin?: string;
};

function sessionStore(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
	return globalThis.window?.sessionStorage ?? undefined;
}

/** A drop is kept in sessionStorage so later page loads in the same tab start without the origin. */
function servingOriginWithoutCompute(origin: string): boolean {
	let dropped = servingOriginsWithoutCompute.get(origin);
	if (dropped === undefined) {
		try {
			dropped = sessionStore()?.getItem(`${AO_SERVING_ORIGIN_WITHOUT_COMPUTE_STORAGE_PREFIX}${origin}`) === '1';
		} catch {
			dropped = false;
		}
		servingOriginsWithoutCompute.set(origin, dropped);
	}
	return dropped;
}

export function aoPeerPlanFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location
): AoPeerPlan {
	const requested = location && queryValue(location, 'node')?.trim();
	const override = requested && normalizeComputeGateways(requested, location?.protocol);
	if (override) return { peers: override, source: 'selected', ordered: true };

	if (configuredComputeGateway) {
		const configured = normalizeComputeGateways(configuredComputeGateway);
		if (!configured) throw new TypeError('invalid-compute-gateways');
		return { peers: configured, source: 'configured', ordered: true };
	}

	if (!location || !['http:', 'https:'].includes(location.protocol))
		return { peers: [], source: 'default', ordered: false };
	const origin = locationOrigin(location);
	if (servingOriginWithoutCompute(origin))
		return { peers: [...DEFAULT_COMPUTE_GATEWAYS], source: 'default', ordered: true };
	return {
		peers: [...new Set([origin, ...DEFAULT_COMPUTE_GATEWAYS])],
		source: 'default',
		ordered: true,
		servingOrigin: origin,
	};
}

/** Bazar's peer plan as it stood before any serving origin was dropped from it. */
function undroppedAoPeers(location: GatewayLocation | undefined): string[] {
	const plan = aoPeerPlanFromLocation(location);
	// Only the default peers ever lead with the serving origin; selected and configured lists are used as given.
	if (!location || plan.source !== 'default' || plan.servingOrigin || !plan.peers.length) return plan.peers;
	return [...new Set([locationOrigin(location), ...plan.peers])];
}

export function fallbackAoPeersFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location
): string[] {
	return aoPeerPlanFromLocation(location).peers;
}

/**
 * Stop routing last-resort AO reads to a serving origin that cannot compute process
 * state, for the rest of this tab session where sessionStorage is available and for
 * this page load otherwise.
 */
export function markServingOriginWithoutCompute(origin: string): void {
	servingOriginsWithoutCompute.set(origin, true);
	try {
		sessionStore()?.setItem(`${AO_SERVING_ORIGIN_WITHOUT_COMPUTE_STORAGE_PREFIX}${origin}`, '1');
	} catch {
		// Kept in memory for this page load.
	}
}

/**
 * The `node` query value that selects these AO peers, or null when they are the
 * default plan, so submitting the peer editor unchanged keeps default routing
 * instead of pinning the defaults as a user selection.
 */
export function aoPeerSelectionQuery(peers: readonly string[], location: GatewayLocation): string | null {
	const selected = [...new Set(peers)];
	const { protocol, hostname, port } = location;
	const unselected = { protocol, hostname, port, search: '', hash: '' };
	const defaults = [aoPeerPlanFromLocation(unselected).peers, undroppedAoPeers(unselected)];
	const isDefault = defaults.some(
		(peers) => selected.length === peers.length && selected.every((peer, index) => peer === peers[index])
	);
	// A selection carried in the hash query outlives removing ?node=, so it must be overridden explicitly.
	return isDefault && !queryValue({ search: '', hash: location.hash }, 'node') ? null : selected.join(',');
}

export async function loadPermawebOsNetworkPolicy(
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): Promise<EffectivePermawebNetworkPolicy | undefined> {
	const fetcher = scope?.aoFetch;
	if (!fetcher || typeof fetcher.networkPolicy !== 'function') return undefined;
	const cached = networkPolicies.get(fetcher);
	if (cached) return cached;
	let loading = networkPolicyLoads.get(fetcher);
	if (!loading) {
		const revision = networkPolicyRevisions.get(fetcher) ?? 0;
		loading = fetcher
			.networkPolicy()
			.then((policy) => {
				if ((networkPolicyRevisions.get(fetcher) ?? 0) !== revision) {
					return networkPolicies.get(fetcher);
				}
				if (!isEffectivePermawebNetworkPolicy(policy)) return undefined;
				strictNetworkPolicyFetchers.add(fetcher);
				networkPolicies.set(fetcher, policy);
				return policy;
			})
			.catch(() => undefined);
		networkPolicyLoads.set(fetcher, loading);
	}
	return loading;
}

export function refreshPermawebOsNetworkPolicy(
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): Promise<EffectivePermawebNetworkPolicy | undefined> {
	const fetcher = scope?.aoFetch;
	if (!fetcher || typeof fetcher.networkPolicy !== 'function') return Promise.resolve(undefined);
	networkPolicyRevisions.set(fetcher, (networkPolicyRevisions.get(fetcher) ?? 0) + 1);
	networkPolicies.delete(fetcher);
	networkPolicyLoads.delete(fetcher);
	return loadPermawebOsNetworkPolicy(scope);
}

export function currentPermawebOsNetworkPolicy(
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): EffectivePermawebNetworkPolicy | undefined {
	const fetcher = scope?.aoFetch;
	return fetcher ? networkPolicies.get(fetcher) : undefined;
}

export function permanentContentGatewayFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): string {
	if (usesPermawebOsAo(location, scope)) {
		const configured = currentPermawebOsNetworkPolicy(scope)?.permanentContent.url;
		if (configured) return configured;
	}
	return arweaveGatewayFromLocation(location);
}

export function observerRelayFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): string {
	if (usesPermawebOsAo(location, scope)) {
		const policy = currentPermawebOsNetworkPolicy(scope);
		if (policy) return policy.ao.observerRelay?.url ?? '';
	}
	return gatewaysFromLocation(location, scope)[0] ?? '';
}

export function aoRoutingScopeFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): string {
	if (usesPermawebOsAo(location, scope)) {
		const policy = currentPermawebOsNetworkPolicy(scope);
		if (policy) {
			if (policy.fingerprint) return policy.fingerprint;
			return JSON.stringify({
				version: policy.version,
				processReads: policy.ao.processReads.map(({ url }) => url),
				scheduleReads: policy.ao.scheduleReads.map(({ url }) => url),
				linkedStateReads: policy.ao.linkedStateReads.map(({ url }) => url),
				fallbackMode: policy.ao.fallbackMode,
			});
		}
		const fetcher = scope?.aoFetch;
		if (fetcher && strictNetworkPolicyFetchers.has(fetcher)) {
			return `permawebos-policy-unavailable:${networkPolicyRevisions.get(fetcher) ?? 0}`;
		}
		return gatewaysFromLocation(location, scope).join(',');
	}
	// Dropping a serving origin that cannot compute changes which peer answers, not
	// which state is read; keeping it in the scope avoids restarting every keyed read.
	return undroppedAoPeers(location).join(',');
}

export function gatewayFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location
): string {
	return gatewaysFromLocation(location)[0] ?? '';
}

export function gatewaysFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): string[] {
	if (usesPermawebOsAo(location, scope)) {
		const policy = currentPermawebOsNetworkPolicy(scope);
		if (policy) return policy.ao.processReads.map(({ url }) => url);
		if (scope?.aoFetch && strictNetworkPolicyFetchers.has(scope.aoFetch)) return [];
		return [...(scope?.aoFetch?.peers ?? [])];
	}
	return fallbackAoPeersFromLocation(location);
}

function isEffectivePermawebNetworkPolicy(value: unknown): value is EffectivePermawebNetworkPolicy {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const policy = value as Partial<EffectivePermawebNetworkPolicy>;
	return (
		policy.version === 1 &&
		(policy.fingerprint === undefined ||
			(typeof policy.fingerprint === 'string' && policy.fingerprint.length > 0)) &&
		isProvider(policy.arweaveGateway) &&
		isProvider(policy.permanentContent) &&
		isProvider(policy.publishing) &&
		Boolean(policy.ao) &&
		Array.isArray(policy.ao?.processReads) &&
		policy.ao.processReads.every(isProvider) &&
		Array.isArray(policy.ao.scheduleReads) &&
		policy.ao.scheduleReads.every(isProvider) &&
		Array.isArray(policy.ao.linkedStateReads) &&
		policy.ao.linkedStateReads.every(isProvider) &&
		(policy.ao.observerRelay === undefined || isProvider(policy.ao.observerRelay)) &&
		(policy.ao.scheduleWrite === undefined || isProvider(policy.ao.scheduleWrite)) &&
		(policy.ao.directWrite === undefined || isProvider(policy.ao.directWrite)) &&
		['custom', 'hosted', 'personal-first', 'personal-only'].includes(String(policy.ao.fallbackMode))
	);
}

function isProvider(value: unknown): value is NetworkProviderSummary {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const provider = value as Partial<NetworkProviderSummary>;
	if (
		typeof provider.url !== 'string' ||
		!['community', 'default', 'personal'].includes(String(provider.ownership))
	) {
		return false;
	}
	try {
		return ['http:', 'https:'].includes(new URL(provider.url).protocol);
	} catch {
		return false;
	}
}
