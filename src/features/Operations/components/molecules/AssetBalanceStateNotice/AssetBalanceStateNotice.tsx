import type { AssetState } from 'api/marketplace';

import { assetBalanceStateNotice } from '../../../model/atomic-operation';

export default function AssetBalanceStateNotice(props: { state: Pick<AssetState, 'holderBalancesAvailable'> }) {
	const notice = assetBalanceStateNotice(props.state);
	if (!notice) return null;
	return (
		<div className="pending-operation-notice asset-balance-state-notice" role="status">
			<strong>Balance state incomplete</strong>
			<span>{notice}</span>
		</div>
	);
}
