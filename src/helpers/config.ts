export const DEFAULT_GATEWAY = 'https://arweave.net';
export const DEFAULT_COMPUTE_GATEWAY = 'https://alpha.neo.zephyrdev.xyz';
export const PAGINATED_GRAPHQL = import.meta.env.VITE_PAGINATED_GRAPHQL ?? 'https://turbo-gateway.com/graphql';
export const NAMES_NAMESPACE_ID =
  import.meta.env.VITE_NAMES_NAMESPACE_ID ?? 'fQXYPE9MAcfI1wV2CwJ3sJIhgT9btBOlYFOKFDGhAs0';
export const GATEWAYS = {
  default: { protocol: 'https', host: 'arweave.net' },
};
export const AO_MAINNET = { app1: DEFAULT_COMPUTE_GATEWAY };

export function gatewayFromLocation(location: Location = window.location): string {
  const hashQueryIndex = location.hash?.indexOf('?') ?? -1;
  const hashSearch = hashQueryIndex === -1 ? '' : location.hash.slice(hashQueryIndex);
  const requested = new URLSearchParams(location.search).get('node') ?? new URLSearchParams(hashSearch).get('node');
  if (requested) return new URL(requested).origin;
  return DEFAULT_COMPUTE_GATEWAY;
}
