import { assetBalanceStateAvailable, type AssetState } from 'api/asset-marketplace';

export const ASSET_BALANCE_STATE_NOTICE =
	'The configured AO routes returned token and order state without a complete holder balance table. Bazar cannot safely verify wallet ownership or liquid balances, so new purchases, listings, cancellations, transfers, and holder-list dispatches are paused. Existing signed actions can still be resumed.';

export function AssetBalanceStateNotice({ state }: { state: Pick<AssetState, 'holderBalancesAvailable'> }) {
	if (assetBalanceStateAvailable(state)) return null;
	return (
		<div className="pending-operation-notice asset-balance-state-notice" role="status">
			<strong>Balance state incomplete</strong>
			<span>{ASSET_BALANCE_STATE_NOTICE}</span>
		</div>
	);
}
