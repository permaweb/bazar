import { Button } from 'components/atoms/Button';
import { StatusNotice } from 'components/molecules/StatusNotice';
import { transactionExplorerUrl } from 'helpers/explorer';

export type UnavailableOperationRecovery = {
	key: string;
	kind: 'sell' | 'cancel' | 'transfer';
	signer: string;
	txId: string;
};

export default function UnavailableOperationRecoveryNotice(props: {
	recovery: UnavailableOperationRecovery;
	stateNoun: string;
	onRefresh(): void;
	onDiscard(): void;
}) {
	const action = props.recovery.kind === 'sell' ? 'listing' : props.recovery.kind;
	return (
		<StatusNotice
			actions={
				<>
					<a href={transactionExplorerUrl(props.recovery.txId)} rel="noreferrer" target="_blank">
						Check transaction {props.recovery.txId.slice(0, 6)}…{props.recovery.txId.slice(-6)} ↗
					</a>
					<Button onClick={props.onRefresh} size="custom">
						Refresh live state
					</Button>
					<Button onClick={props.onDiscard} size="custom" variant="danger">
						Discard local tracking
					</Button>
					<small>The live source of truth remains current {props.stateNoun}.</small>
				</>
			}
		>
			A previous {action} action cannot be resumed because its exact signed transaction is no longer available. No
			replacement action will be created while this record remains.
		</StatusNotice>
	);
}
