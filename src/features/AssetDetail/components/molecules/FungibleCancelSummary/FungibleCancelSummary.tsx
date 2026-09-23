import { CircleX } from 'lucide-react';

import type { AssetState, SwapOrder } from 'api/marketplace';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { winstonToArDecimal } from 'helpers/ar-units';

import { tokenLabel } from '../../../model/fungible-market';
import type { FungibleOperationDraftView } from '../../../model/fungible-operation-view';

export default function FungibleCancelSummary(props: {
	draft: Pick<FungibleOperationDraftView, 'currentLiquid' | 'currentListed'>;
	order: SwapOrder;
	state: AssetState;
}) {
	return (
		<div className="cancel-summary">
			<CircleX aria-hidden="true" />
			<div>
				<strong>Return this listing to your balance?</strong>
				<span>
					{tokenLabel(props.order.quantity, props.state)} · {winstonToArDecimal(props.order.asking)}{' '}
					<ArCurrencyLabel /> total
				</span>
				<span>
					After network confirmation:{' '}
					{tokenLabel((props.draft.currentLiquid + BigInt(props.order.quantity)).toString(), props.state)}{' '}
					liquid ·{' '}
					{tokenLabel((props.draft.currentListed - BigInt(props.order.quantity)).toString(), props.state)}{' '}
					listed
				</span>
				<span>A reserved listing cannot be cancelled. This listing is currently open.</span>
			</div>
		</div>
	);
}
