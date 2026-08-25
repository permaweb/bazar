const configuredArweaveGateway = import.meta.env.VITE_ARWEAVE_GATEWAY?.trim();
const configuredComputeGateway = import.meta.env.VITE_COMPUTE_GATEWAY?.trim();

export type NetworkProviderSummary = {
	url: string;
	ownership: 'community' | 'default' | 'personal';
};

export type EffectivePermawebNetworkPolicy = {
	version: 1;
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

type NetworkPolicyFetcher = PermawebOsAoFetch & {
	networkPolicy?(): Promise<EffectivePermawebNetworkPolicy>;
};

const networkPolicies = new WeakMap<NetworkPolicyFetcher, EffectivePermawebNetworkPolicy>();
const networkPolicyLoads = new WeakMap<NetworkPolicyFetcher, Promise<EffectivePermawebNetworkPolicy | undefined>>();
const networkPolicyRevisions = new WeakMap<NetworkPolicyFetcher, number>();

export const DEFAULT_ARWEAVE_GATEWAY = configuredArweaveGateway
	? new URL(configuredArweaveGateway).origin
	: 'https://arweave.net';
export const PRODUCTION_COMPUTE_GATEWAYS = [
	'https://alpha.neo.zephyrdev.xyz',
	'https://charlie.neo2.zephyrdev.xyz',
] as const;
export const PRODUCTION_COMPUTE_GATEWAY = PRODUCTION_COMPUTE_GATEWAYS[0];
export const AO_TRANSPORT_QUERY_PARAMETER = 'ao-transport';
export const BAZAR_AO_TRANSPORT = 'bazar';

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

export function computeGatewaysForEnvironment(_development: boolean, configured = configuredComputeGateway): string[] {
	if (configured) {
		const parsed = normalizeComputeGateways(configured);
		if (!parsed) throw new TypeError('invalid-compute-gateways');
		return parsed;
	}
	return [...PRODUCTION_COMPUTE_GATEWAYS];
}

export function computeGatewayForEnvironment(development: boolean, configured = configuredComputeGateway) {
	return computeGatewaysForEnvironment(development, configured)[0];
}

export const DEFAULT_COMPUTE_GATEWAYS = computeGatewaysForEnvironment(import.meta.env.DEV);
export const DEFAULT_COMPUTE_GATEWAY = DEFAULT_COMPUTE_GATEWAYS[0];
export const NAMES_NAMESPACE_ID =
	import.meta.env.VITE_NAMES_NAMESPACE_ID ?? 'fQXYPE9MAcfI1wV2CwJ3sJIhgT9btBOlYFOKFDGhAs0';
export const AO_MAINNET = { app1: DEFAULT_COMPUTE_GATEWAY };

type GatewayLocation = Pick<Location, 'protocol' | 'hostname' | 'port' | 'search' | 'hash'>;

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
	return `${location.protocol}//${location.hostname}${location.port ? `:${location.port}` : ''}`;
}

export function arweaveClientConfig(gateway = arweaveGatewayFromLocation()) {
	const url = new URL(gateway);
	return {
		host: url.hostname,
		port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
		protocol: url.protocol.slice(0, -1),
	};
}

export function arweaveGraphqlEndpoint(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location
): string {
	return `${arweaveGatewayFromLocation(location)}/graphql`;
}

/** Address an Arweave item through the gateway's ordinary HTTPSig resource route. */
export function arweaveDataUrl(id: string, gateway = arweaveGatewayFromLocation()): string {
	return `${gateway}/${id}`;
}

/** Ordinary resource URLs for one Arweave item, ordered across the selected serving peers. */
export function arweaveDataFallbackUrls(
	value: string,
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): string[] {
	if (!location) return [value];
	let url: URL;
	try {
		url = new URL(value, `${location.protocol}//${location.hostname}${location.port ? `:${location.port}` : ''}`);
	} catch {
		return [value];
	}
	const match = url.pathname.match(/^\/([A-Za-z0-9_-]{43})$/);
	if (!match) return [value];
	const policy = usesPermawebOsAo(location, scope) ? currentPermawebOsNetworkPolicy(scope) : undefined;
	const computeOrigins = new Set(policy?.ao.processReads.map(({ url: provider }) => new URL(provider).origin));
	const permanent = arweaveDataUrl(match[1], permanentContentGatewayFromLocation(location, scope));
	return [
		...new Set([
			...(computeOrigins.has(url.origin) && url.origin !== new URL(permanent).origin ? [] : [value]),
			permanent,
			arweaveDataUrl(match[1], arweaveGatewayFromLocation(location)),
		]),
	];
}

export function permawebOsAoAvailable(scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window): boolean {
	return Boolean(scope?.aoFetch);
}

export function usesPermawebOsAo(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): boolean {
	if (!permawebOsAoAvailable(scope)) return false;
	return !location || queryValue(location, AO_TRANSPORT_QUERY_PARAMETER) !== BAZAR_AO_TRANSPORT;
}

export function fallbackAoPeersFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location
): string[] {
	if (!location) return [...DEFAULT_COMPUTE_GATEWAYS];
	const requested = queryValue(location, 'node')?.trim();
	return (requested && normalizeComputeGateways(requested, location.protocol)) || [...DEFAULT_COMPUTE_GATEWAYS];
}

export async function loadPermawebOsNetworkPolicy(
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): Promise<EffectivePermawebNetworkPolicy | undefined> {
	const fetcher = scope?.aoFetch as NetworkPolicyFetcher | undefined;
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
	const fetcher = scope?.aoFetch as NetworkPolicyFetcher | undefined;
	if (!fetcher || typeof fetcher.networkPolicy !== 'function') return Promise.resolve(undefined);
	networkPolicyRevisions.set(fetcher, (networkPolicyRevisions.get(fetcher) ?? 0) + 1);
	networkPolicies.delete(fetcher);
	networkPolicyLoads.delete(fetcher);
	return loadPermawebOsNetworkPolicy(scope);
}

export function currentPermawebOsNetworkPolicy(
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): EffectivePermawebNetworkPolicy | undefined {
	const fetcher = scope?.aoFetch as NetworkPolicyFetcher | undefined;
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
			return JSON.stringify({
				version: policy.version,
				processReads: policy.ao.processReads.map(({ url }) => url),
				scheduleReads: policy.ao.scheduleReads.map(({ url }) => url),
				linkedStateReads: policy.ao.linkedStateReads.map(({ url }) => url),
				fallbackMode: policy.ao.fallbackMode,
			});
		}
	}
	return gatewaysFromLocation(location, scope).join(',');
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
		const configured = currentPermawebOsNetworkPolicy(scope)?.ao.processReads.map(({ url }) => url);
		if (configured?.length) return [...configured];
		return [...(scope?.aoFetch?.peers ?? [])];
	}
	return fallbackAoPeersFromLocation(location);
}

function isEffectivePermawebNetworkPolicy(value: unknown): value is EffectivePermawebNetworkPolicy {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const policy = value as Partial<EffectivePermawebNetworkPolicy>;
	return (
		policy.version === 1 &&
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
