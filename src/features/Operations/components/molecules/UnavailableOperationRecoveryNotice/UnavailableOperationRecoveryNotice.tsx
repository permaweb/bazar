import { Button } from 'components/atoms/Button';
import { StatusNotice } from 'components/molecules/StatusNotice';
import { transactionExplorerUrl } from 'helpers/explorer';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES, type OperationsMessages } from '../../../messages';

export type UnavailableOperationRecovery = {
	key: string;
	kind: 'sell' | 'cancel' | 'transfer';
	signer: string;
	txId: string;
};

const RECOVERY_ACTION_KEYS: Record<UnavailableOperationRecovery['kind'], keyof OperationsMessages> = {
	sell: 'unavailableRecoveryActionListing',
	cancel: 'unavailableRecoveryActionCancel',
	transfer: 'unavailableRecoveryActionTransfer',
};

export default function UnavailableOperationRecoveryNotice(props: {
	recovery: UnavailableOperationRecovery;
	stateNoun: string;
	onRefresh(): void;
	onDiscard(): void;
}) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	const action = messages[RECOVERY_ACTION_KEYS[props.recovery.kind]];
	return (
		<StatusNotice
			actions={
				<>
					<a href={transactionExplorerUrl(props.recovery.txId)} rel="noreferrer" target="_blank">
						{formatMessage(messages.unavailableRecoveryCheckTransaction, {
							transaction: `${props.recovery.txId.slice(0, 6)}…${props.recovery.txId.slice(-6)}`,
						})}
					</a>
					<Button onClick={props.onRefresh} size="custom">
						{messages.unavailableRecoveryRefresh}
					</Button>
					<Button onClick={props.onDiscard} size="custom" variant="danger">
						{messages.unavailableRecoveryDiscard}
					</Button>
					<small>{formatMessage(messages.unavailableRecoverySource, { stateNoun: props.stateNoun })}</small>
				</>
			}
		>
			{formatMessage(messages.unavailableRecoveryDetail, { action })}
		</StatusNotice>
	);
}
