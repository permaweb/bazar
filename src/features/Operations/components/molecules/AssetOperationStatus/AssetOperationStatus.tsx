import { AlertCircle, ChevronRight, LoaderCircle } from 'lucide-react';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';

export type AssetOperationKind = 'sell' | 'buy' | 'cancel' | 'transfer';
export type AssetOperationPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

export function assetOperationProgressTitle(kind: AssetOperationKind, phase: AssetOperationPhase) {
	const subject = {
		sell: 'Listing',
		buy: 'Purchase',
		cancel: 'Listing cancellation',
		transfer: 'Transfer',
	}[kind];
	return phase === 'error' ? `${subject} needs attention` : `${subject} in progress`;
}

export function assetOperationPendingActionLabel(kind: AssetOperationKind) {
	return {
		sell: 'Listing…',
		buy: 'Buying…',
		cancel: 'Canceling listing…',
		transfer: 'Transferring…',
	}[kind];
}

type Props = {
	kind: AssetOperationKind;
	phase: AssetOperationPhase;
	status: string;
	onView(): void;
};

export default function AssetOperationStatus(props: Props) {
	const failed = props.phase === 'error';
	return (
		<div className={`asset-operation-status ${props.phase}`}>
			<span className="asset-operation-status-icon" aria-hidden="true">
				{failed ? (
					<Icon icon={AlertCircle} />
				) : (
					<Icon icon={LoaderCircle} className="operation-activity-loader" />
				)}
			</span>
			<span className="asset-operation-status-copy" aria-atomic="true" aria-live="polite" role="status">
				<strong>{assetOperationProgressTitle(props.kind, props.phase)}</strong>
				<small>
					<ArCurrencyText>{props.status}</ArCurrencyText>
				</small>
			</span>
			<Button className="with-icon" onClick={props.onView}>
				View details <Icon icon={ChevronRight} size="sm" />
			</Button>
		</div>
	);
}
