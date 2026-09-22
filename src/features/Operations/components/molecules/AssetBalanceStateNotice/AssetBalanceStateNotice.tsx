import { assetBalanceStateAvailable, type AssetState } from 'api/marketplace';

export const ASSET_BALANCE_STATE_NOTICE =
	'The configured AO routes returned token and order state without a complete holder balance table. Bazar cannot safely verify wallet ownership or liquid balances, so new purchases, listings, cancellations, transfers, and holder-list dispatches are paused. Saved signed actions remain available for recovery.';

export default function AssetBalanceStateNotice(props: { state: Pick<AssetState, 'holderBalancesAvailable'> }) {
	if (assetBalanceStateAvailable(props.state)) return null;
	return (
		<div className="pending-operation-notice asset-balance-state-notice" role="status">
			<strong>Balance state incomplete</strong>
			<span>{ASSET_BALANCE_STATE_NOTICE}</span>
		</div>
	);
}
