import { transactionExplorerUrl } from 'api/arweave-explorer';

export type UnavailableOperationRecovery = {
	key: string;
	kind: 'sell' | 'cancel' | 'transfer';
	signer: string;
	txId: string;
};

export function UnavailableOperationRecoveryNotice({
	recovery,
	stateNoun,
	onRefresh,
	onDiscard,
}: {
	recovery: UnavailableOperationRecovery;
	stateNoun: string;
	onRefresh(): void;
	onDiscard(): void;
}) {
	const action = recovery.kind === 'sell' ? 'listing' : recovery.kind;
	return (
		<div className="pending-operation-notice">
			<span role="status">
				A previous {action} action cannot be resumed because its exact signed transaction is no longer available. No replacement action will be created while this record remains.
			</span>
			<a href={transactionExplorerUrl(recovery.txId)} rel="noreferrer" target="_blank">
				Check transaction {recovery.txId.slice(0, 6)}…{recovery.txId.slice(-6)} ↗
			</a>
			<button type="button" onClick={onRefresh}>Refresh live state</button>
			<button type="button" onClick={onDiscard}>Discard local tracking</button>
			<small>The live source of truth remains current {stateNoun}.</small>
		</div>
	);
}
