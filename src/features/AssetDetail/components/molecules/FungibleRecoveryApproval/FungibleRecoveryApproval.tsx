import type { AssetState, OrderFill } from 'api/marketplace';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { winstonToArDecimal } from 'helpers/ar-units';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { batchPurchaseRecoveryApprovalCopy, batchPurchaseRecoveryApprovalCount } from '../../../model/fungible-batch';
import type { BatchEntry } from '../../../model/fungible-operation';
import { fungiblePurchaseTotals } from '../../../model/fungible-operation-view';
import { PurchaseRoute } from '../PurchaseRoute';

import * as S from './styles';

export default function FungibleRecoveryApproval(props: {
	entries: BatchEntry[];
	fills: OrderFill[];
	state: AssetState;
	onContinue(): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const plural = usePlural();
	const copy = batchPurchaseRecoveryApprovalCopy(props.entries, messages, plural);
	const totals = fungiblePurchaseTotals(props.fills.map((fill) => fill.order));
	return (
		<div className="recovery-approval">
			<div>
				<h3>{copy.title}</h3>
				<p>{copy.detail}</p>
			</div>
			<S.BatchQuote className="batch-quote">
				<div>
					<span>{messages.recoveryApprovalListings}</span>
					<strong>{props.fills.length}</strong>
				</div>
				<div>
					<span>{messages.recoveryApprovalSellers}</span>
					<strong>{totals.sellers}</strong>
				</div>
				<div>
					<span>{messages.recoveryApprovalSubtotal}</span>
					<strong>
						{winstonToArDecimal(totals.asking.toString())} <ArCurrencyLabel />
					</strong>
				</div>
				<div>
					<span>{messages.recoveryApprovalNewApprovals}</span>
					<strong>{batchPurchaseRecoveryApprovalCount(props.entries)}</strong>
				</div>
			</S.BatchQuote>
			<PurchaseRoute fills={props.fills} state={props.state} />
			<Button
				className="wide"
				data-dialog-initial
				onClick={() => props.onContinue()}
				type="button"
				size="custom"
				variant="primary"
			>
				{copy.action}
			</Button>
		</div>
	);
}
