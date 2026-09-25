import type { AssetState } from 'api/marketplace';

import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';
import { assetBalanceStateNoticeRequired } from '../../../model/atomic-operation';

export default function AssetBalanceStateNotice(props: { state: Pick<AssetState, 'holderBalancesAvailable'> }) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	if (!assetBalanceStateNoticeRequired(props.state)) return null;
	return (
		<div className="pending-operation-notice asset-balance-state-notice" role="status">
			<strong>{messages.assetBalanceStateIncomplete}</strong>
			<span>{messages.assetBalanceStateDetail}</span>
		</div>
	);
}
