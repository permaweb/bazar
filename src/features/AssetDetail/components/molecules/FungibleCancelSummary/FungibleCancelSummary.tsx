import { CircleX } from 'lucide-react';

import type { AssetState, SwapOrder } from 'api/marketplace';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { winstonToArDecimal } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleOperationDraftView } from '../../../model/fungible-operation-view';

import * as S from './styles';

export default function FungibleCancelSummary(props: {
	draft: Pick<FungibleOperationDraftView, 'currentLiquid' | 'currentListed'>;
	order: SwapOrder;
	state: AssetState;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	return (
		<S.Summary className="cancel-summary">
			<CircleX aria-hidden="true" />
			<div>
				<strong>{messages.cancelSummaryTitle}</strong>
				<span>
					{formatMessage(messages.cancelSummaryLot, {
						quantity: tokenLabel(props.order.quantity, props.state),
						asking: winstonToArDecimal(props.order.asking),
					})}{' '}
					<ArCurrencyLabel /> {messages.cancelSummaryTotal}
				</span>
				<span>
					{messages.cancelSummaryAfterConfirmation}{' '}
					{formatMessage(messages.cancelSummaryBalanceSplit, {
						liquid: tokenLabel(
							(props.draft.currentLiquid + BigInt(props.order.quantity)).toString(),
							props.state
						),
						listed: tokenLabel(
							(props.draft.currentListed - BigInt(props.order.quantity)).toString(),
							props.state
						),
					})}
				</span>
				<span>{messages.cancelSummaryReservedNote}</span>
			</div>
		</S.Summary>
	);
}
