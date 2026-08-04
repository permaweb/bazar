import type { WeaveNetworkOptions } from 'weave-wrangler';

import { AO_MAINNET, GATEWAYS, gatewayFromLocation } from 'helpers/config';

export function assetObserverNetworkOptions(location: Location = window.location): WeaveNetworkOptions {
  const hashQueryIndex = location.hash?.indexOf('?') ?? -1;
  const hashSearch = hashQueryIndex === -1 ? '' : location.hash.slice(hashQueryIndex);
  const hasSelectedRelay =
    new URLSearchParams(location.search).has('node') || new URLSearchParams(hashSearch).has('node');
  const isLocalDevelopment = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);

  return {
    node: `${GATEWAYS.default.protocol}://${GATEWAYS.default.host}`,
    minObservers: 3,
    syncTolerance: 2,
    maxObservers: 12,
    ...(isLocalDevelopment && !hasSelectedRelay
      ? { pageProtocol: location.protocol }
      : { 'relay-with': hasSelectedRelay ? gatewayFromLocation(location) : AO_MAINNET.app1 }),
  };
}
