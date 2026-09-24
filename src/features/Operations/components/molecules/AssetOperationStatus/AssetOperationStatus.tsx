import React from 'react';
import { AlertCircle, ChevronRight, LoaderCircle } from 'lucide-react';

import type { OperationActivityStatus } from 'api/operations';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES, type OperationsMessages } from '../../../messages';
import { operationActivityStatusText } from '../../../model/activity-status';

import * as S from './styles';

export type AssetOperationKind = 'sell' | 'buy' | 'cancel' | 'transfer';
export type AssetOperationPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

const SUBJECT_KEYS: Record<AssetOperationKind, keyof OperationsMessages> = {
	sell: 'assetOperationSubjectSell',
	buy: 'assetOperationSubjectBuy',
	cancel: 'assetOperationSubjectCancel',
	transfer: 'assetOperationSubjectTransfer',
};

const PENDING_ACTION_KEYS: Record<AssetOperationKind, keyof OperationsMessages> = {
	sell: 'assetOperationPendingSell',
	buy: 'assetOperationPendingBuy',
	cancel: 'assetOperationPendingCancel',
	transfer: 'assetOperationPendingTransfer',
};

export function assetOperationProgressTitle(
	kind: AssetOperationKind,
	phase: AssetOperationPhase,
	messages: OperationsMessages
) {
	const subject = messages[SUBJECT_KEYS[kind]];
	return formatMessage(
		phase === 'error' ? messages.assetOperationNeedsAttention : messages.assetOperationInProgress,
		{ subject }
	);
}

export function assetOperationPendingActionLabel(kind: AssetOperationKind, messages: OperationsMessages) {
	return messages[PENDING_ACTION_KEYS[kind]];
}

/** The pending action label of an asset operation, resolved for the active language. */
export function useAssetOperationPendingActionLabel(): (kind: AssetOperationKind) => string {
	const messages = useMessages(OPERATIONS_MESSAGES);
	return React.useCallback(
		(kind: AssetOperationKind) => assetOperationPendingActionLabel(kind, messages),
		[messages]
	);
}

type Props = {
	kind: AssetOperationKind;
	phase: AssetOperationPhase;
	status: OperationActivityStatus;
	onView(): void;
};

export default function AssetOperationStatus(props: Props) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	const failed = props.phase === 'error';
	return (
		<S.Status className={`asset-operation-status ${props.phase}`}>
			<S.StatusIcon className="asset-operation-status-icon" aria-hidden="true">
				{failed ? (
					<Icon icon={AlertCircle} />
				) : (
					<Icon icon={LoaderCircle} className="operation-activity-loader" />
				)}
			</S.StatusIcon>
			<S.StatusCopy className="asset-operation-status-copy" aria-atomic="true" aria-live="polite" role="status">
				<strong>{assetOperationProgressTitle(props.kind, props.phase, messages)}</strong>
				<small>
					<ArCurrencyText>{operationActivityStatusText(props.status, messages)}</ArCurrencyText>
				</small>
			</S.StatusCopy>
			<Button className="with-icon" onClick={props.onView}>
				{messages.assetOperationViewDetails} <Icon icon={ChevronRight} size="sm" />
			</Button>
		</S.Status>
	);
}
