const configuredArweaveGateway = import.meta.env.VITE_ARWEAVE_GATEWAY?.trim();

export const DEFAULT_ARWEAVE_GATEWAY = configuredArweaveGateway
  ? new URL(configuredArweaveGateway).origin
  : 'https://arweave.net';
export const DEFAULT_COMPUTE_GATEWAY = 'https://alpha.neo.zephyrdev.xyz';
export const NAMES_NAMESPACE_ID =
  import.meta.env.VITE_NAMES_NAMESPACE_ID ?? 'fQXYPE9MAcfI1wV2CwJ3sJIhgT9btBOlYFOKFDGhAs0';
export const AO_MAINNET = { app1: DEFAULT_COMPUTE_GATEWAY };

type GatewayLocation = Pick<Location, 'protocol' | 'hostname' | 'port' | 'search' | 'hash'>;

function queryValue(location: Pick<GatewayLocation, 'search' | 'hash'>, name: string): string | null {
  const hashQueryIndex = location.hash?.indexOf('?') ?? -1;
  const hashSearch = hashQueryIndex === -1 ? '' : location.hash.slice(hashQueryIndex);
  return new URLSearchParams(location.search).get(name) ?? new URLSearchParams(hashSearch).get(name);
}

function httpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
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
  location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
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
  location: GatewayLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
): string {
  return `${arweaveGatewayFromLocation(location)}/graphql`;
}

export function gatewayFromLocation(location: Location = window.location): string {
  const requested = queryValue(location, 'node');
  if (requested) return new URL(requested).origin;
  return DEFAULT_COMPUTE_GATEWAY;
}
