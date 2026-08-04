export const DEFAULT_GATEWAY = 'https://arweave.net';
export const PAGINATED_GRAPHQL = import.meta.env.VITE_PAGINATED_GRAPHQL ?? 'https://turbo-gateway.com/graphql';
export const NAMES_NAMESPACE_ID =
  import.meta.env.VITE_NAMES_NAMESPACE_ID ?? 'fQXYPE9MAcfI1wV2CwJ3sJIhgT9btBOlYFOKFDGhAs0';
export const GATEWAYS = {
  default: { protocol: 'https', host: 'arweave.net' },
};
export const AO_MAINNET = { app1: DEFAULT_GATEWAY };

export function gatewayFromLocation(location: Location = window.location): string {
  const hashQueryIndex = location.hash?.indexOf('?') ?? -1;
  const hashSearch = hashQueryIndex === -1 ? '' : location.hash.slice(hashQueryIndex);
  const requested = new URLSearchParams(location.search).get('node') ?? new URLSearchParams(hashSearch).get('node');
  if (requested) return new URL(requested).origin;
  const labels = location.hostname.split('.');
  const host = labels[0]?.length === 52 && labels.length > 2 ? labels.slice(1).join('.') : location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return DEFAULT_GATEWAY;
  return `${location.protocol}//${host}${location.port ? `:${location.port}` : ''}`;
}
