import type { WeaveNetworkOptions } from 'weave-wrangler';

import { GATEWAYS, gatewayFromLocation } from 'helpers/config';

export function assetObserverNetworkOptions(
	location: Location = window.location
): WeaveNetworkOptions {
	return {
		node: `${GATEWAYS.default.protocol}://${GATEWAYS.default.host}`,
		minObservers: 3,
		syncTolerance: 2,
		maxObservers: 12,
		'relay-with': gatewayFromLocation(location),
	};
}
