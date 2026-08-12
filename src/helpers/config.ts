const configuredArweaveGateway = import.meta.env.VITE_ARWEAVE_GATEWAY?.trim();
const configuredComputeGateway = import.meta.env.VITE_COMPUTE_GATEWAY?.trim();

export const DEFAULT_ARWEAVE_GATEWAY = configuredArweaveGateway
	? new URL(configuredArweaveGateway).origin
	: 'https://arweave.net';
export const PRODUCTION_COMPUTE_GATEWAYS = [
	'https://alpha.neo.zephyrdev.xyz',
	'https://charlie.neo2.zephyrdev.xyz',
] as const;
export const PRODUCTION_COMPUTE_GATEWAY = PRODUCTION_COMPUTE_GATEWAYS[0];

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

export function computeGatewaysForEnvironment(development: boolean, configured = configuredComputeGateway): string[] {
	if (configured) {
		const parsed = normalizeComputeGateways(configured);
		if (!parsed) throw new TypeError('invalid-compute-gateways');
		return parsed;
	}
	return development ? [DEFAULT_ARWEAVE_GATEWAY] : [...PRODUCTION_COMPUTE_GATEWAYS];
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

/**
 * Raw fallback suite: bypass redirect/cache inconsistencies for immutable media bytes.
 * Keep callers on this helper so the node-side fix can later remove the suite as one unit.
 */
export function arweaveRawDataUrl(id: string, gateway = arweaveGatewayFromLocation()): string {
	return `${gateway}/raw/${id}`;
}

export function gatewayFromLocation(location: Location = window.location): string {
	return gatewaysFromLocation(location)[0];
}

export function gatewaysFromLocation(
	location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location
): string[] {
	if (!location) return [...DEFAULT_COMPUTE_GATEWAYS];
	const requested = queryValue(location, 'node')?.trim();
	return (requested && normalizeComputeGateways(requested, location.protocol)) || [...DEFAULT_COMPUTE_GATEWAYS];
}
