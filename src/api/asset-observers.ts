import type { WeaveNetworkOptions } from 'weave-wrangler';

import { GATEWAYS, gatewayFromLocation } from 'helpers/config';

export function assetObserverNetworkOptions(location: Location = window.location): WeaveNetworkOptions {
  const hasSelectedRelay = new URLSearchParams(location.search).has('node');
  const isLocalDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  return {
    node: `${GATEWAYS.default.protocol}://${GATEWAYS.default.host}`,
    minObservers: 3,
    syncTolerance: 2,
    maxObservers: 12,
    ...(isLocalDevelopment && !hasSelectedRelay
      ? { pageProtocol: location.protocol }
      : { 'relay-with': gatewayFromLocation(location) }),
  };
}
