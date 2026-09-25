import React from 'react';

import {
	OperationExternalLink,
	SettlementReceipt,
	SettlementReceiptLinks,
} from 'components/molecules/OperationOutcomeAnnouncement';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';

// The seller, order, and signed transactions of an atomic purchase, led by its payment or failed stage.
export default function PurchaseSettlementReceipt(props: {
	summaryLabel: string;
	summary: React.ReactNode;
	seller: string;
	orderId: string;
	registrationId?: string;
	paymentId?: string;
}) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	return (
		<SettlementReceipt className="settlement-receipt">
			<div>
				<span>{props.summaryLabel}</span>
				<strong>{props.summary}</strong>
			</div>
			<div>
				<span>{messages.labelSeller}</span>
				<WalletAddress address={props.seller} full label={messages.walletLabelSeller} />
			</div>
			<div>
				<span>{messages.receiptOrder}</span>
				<a href={transactionExplorerUrl(props.orderId)} rel="noreferrer" target="_blank">
					<OperationExternalLink>{short(props.orderId)}</OperationExternalLink>
				</a>
			</div>
			<SettlementReceiptLinks className="settlement-receipt-links">
				{props.registrationId ? (
					<a href={transactionExplorerUrl(props.registrationId)} rel="noreferrer" target="_blank">
						<OperationExternalLink>
							{formatMessage(messages.receiptReservation, { transaction: short(props.registrationId) })}
						</OperationExternalLink>
					</a>
				) : null}
				{props.paymentId ? (
					<a href={transactionExplorerUrl(props.paymentId)} rel="noreferrer" target="_blank">
						<OperationExternalLink>
							{formatMessage(messages.receiptPayment, { transaction: short(props.paymentId) })}
						</OperationExternalLink>
					</a>
				) : null}
			</SettlementReceiptLinks>
		</SettlementReceipt>
	);
}
