import type { PurchaseRecoveryApprovalPrompt } from 'api/operations';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { OperationExternalLink } from 'components/molecules/OperationOutcomeAnnouncement';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES, type OperationsMessages } from '../../../messages';
import { messagePartsAround } from '../../../model/operation-copy';

import * as S from './styles';

const RESERVATION_DETAIL_KEYS: Record<
	Extract<PurchaseRecoveryApprovalPrompt, { kind: 'seller-payment' }>['reservation'],
	keyof OperationsMessages
> = {
	'external-tab': 'recoveryApprovalExternalDetail',
	dispatched: 'recoveryApprovalDispatchedDetail',
	saved: 'recoveryApprovalSavedDetail',
};

function recoveryApprovalCopy(prompt: PurchaseRecoveryApprovalPrompt, messages: OperationsMessages) {
	if (prompt.kind === 'seller-payment') {
		return {
			title: messages.recoveryApprovalContinueTitle,
			detail: messages[RESERVATION_DETAIL_KEYS[prompt.reservation]],
			action: messages.recoveryApprovalPaymentAction,
		};
	}
	return {
		title: formatMessage(messages.recoveryApprovalAllTitle, { approvals: prompt.approvals }),
		detail: messages.recoveryApprovalAllDetail,
		action: formatMessage(messages.recoveryApprovalAllAction, { approvals: prompt.approvals }),
	};
}

// Asks for the wallet approvals a saved purchase still needs before it can continue.
export default function PurchaseRecoveryApproval(props: {
	prompt: PurchaseRecoveryApprovalPrompt | null;
	seller: string;
	sellerPrice: string;
	approvalCount: number;
	registrationId?: string;
	onApprove(): void;
}) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	const copy = props.prompt ? recoveryApprovalCopy(props.prompt, messages) : null;
	const reservationSigned = messagePartsAround(messages.recoveryApprovalReservationSigned, 'transaction');

	return (
		<div className="recovery-approval">
			<div>
				<h3>{copy?.title}</h3>
				<p>{copy?.detail}</p>
			</div>
			<S.Summary className="operation-summary">
				<span>{messages.labelSeller}</span>
				<S.SummaryLink
					address={props.seller}
					className="operation-summary-link"
					full
					label={messages.walletLabelSeller}
				/>
				<span>{messages.labelSellerPayment}</span>
				<strong>
					<ArCurrencyText>{props.sellerPrice}</ArCurrencyText>
				</strong>
				<span>{messages.recoveryApprovalNewApprovals}</span>
				<strong>{props.approvalCount}</strong>
				{props.registrationId ? (
					<small>
						{reservationSigned.before}
						<a href={transactionExplorerUrl(props.registrationId)} rel="noreferrer" target="_blank">
							<OperationExternalLink>{short(props.registrationId)}</OperationExternalLink>
						</a>
						{reservationSigned.after}
					</small>
				) : null}
			</S.Summary>
			<Button
				className="wide"
				data-dialog-initial
				onClick={props.onApprove}
				type="button"
				size="custom"
				variant="primary"
			>
				{copy?.action}
			</Button>
		</div>
	);
}
