import type { Operation } from 'api/operations';

import type { TxAddressLabels } from 'components/atoms/TxAddress';

import type { OperationsMessages } from '../messages';

const OPERATION_LABEL_KEYS: Record<Operation['kind'], keyof OperationsMessages> = {
	buy: 'operationLabelBuy',
	cancel: 'operationLabelCancel',
	sell: 'operationLabelSell',
	transfer: 'operationLabelTransfer',
};

/** The verb one atomic operation is named by, from the feature catalog. */
export function operationKindLabel(kind: Operation['kind'], messages: OperationsMessages): string {
	return messages[OPERATION_LABEL_KEYS[kind]];
}

/** Splits a message around one placeholder so a component can render an element where the value belongs. */
export function messagePartsAround(template: string, placeholder: string): { before: string; after: string } {
	const [before, after = ''] = template.split(`{${placeholder}}`);
	return { before, after };
}

/** The wording `TxAddress` renders for its copy control; the atom cannot read the language provider itself. */
export function operationTransactionAddressCopy(messages: OperationsMessages): TxAddressLabels {
	return {
		copy: messages.operationCopyTransactionAddress,
		copiedTooltip: messages.operationCopiedTooltip,
		copiedLabel: messages.operationCopiedTransactionAddress,
		copiedAnnouncement: messages.operationCopiedTransactionAddressAnnouncement,
	};
}
