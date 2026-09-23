import React from 'react';

import { OperationExternalLink } from 'components/molecules/OperationOutcomeAnnouncement';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';

// The seller, order, and signed transactions of an atomic purchase, led by its payment or failed stage.
export default function PurchaseSettlementReceipt(props: {
	summaryLabel: string;
	summary: React.ReactNode;
	seller: string;
	orderId: string;
	registrationId?: string;
	paymentId?: string;
}) {
	return (
		<div className="settlement-receipt">
			<div>
				<span>{props.summaryLabel}</span>
				<strong>{props.summary}</strong>
			</div>
			<div>
				<span>Seller</span>
				<WalletAddress address={props.seller} full label="seller" />
			</div>
			<div>
				<span>Order</span>
				<a href={transactionExplorerUrl(props.orderId)} rel="noreferrer" target="_blank">
					<OperationExternalLink>{short(props.orderId)}</OperationExternalLink>
				</a>
			</div>
			<div className="settlement-receipt-links">
				{props.registrationId ? (
					<a href={transactionExplorerUrl(props.registrationId)} rel="noreferrer" target="_blank">
						<OperationExternalLink>Reservation {short(props.registrationId)}</OperationExternalLink>
					</a>
				) : null}
				{props.paymentId ? (
					<a href={transactionExplorerUrl(props.paymentId)} rel="noreferrer" target="_blank">
						<OperationExternalLink>Payment {short(props.paymentId)}</OperationExternalLink>
					</a>
				) : null}
			</div>
		</div>
	);
}
