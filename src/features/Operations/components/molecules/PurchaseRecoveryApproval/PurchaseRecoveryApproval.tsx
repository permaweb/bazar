import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { OperationExternalLink } from 'components/molecules/OperationOutcomeAnnouncement';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';

// Asks for the wallet approvals a saved purchase still needs before it can continue.
export default function PurchaseRecoveryApproval(props: {
	copy: { title: string; detail: string; action: string } | null;
	seller: string;
	sellerPrice: string;
	approvalCount: number;
	registrationId?: string;
	onApprove(): void;
}) {
	return (
		<div className="recovery-approval">
			<div>
				<h3>{props.copy?.title}</h3>
				<p>{props.copy?.detail}</p>
			</div>
			<div className="operation-summary">
				<span>Seller</span>
				<WalletAddress address={props.seller} className="operation-summary-link" full label="seller" />
				<span>Seller payment</span>
				<strong>
					<ArCurrencyText>{props.sellerPrice}</ArCurrencyText>
				</strong>
				<span>New approvals</span>
				<strong>{props.approvalCount}</strong>
				{props.registrationId ? (
					<small>
						Reservation{' '}
						<a href={transactionExplorerUrl(props.registrationId)} rel="noreferrer" target="_blank">
							<OperationExternalLink>{short(props.registrationId)}</OperationExternalLink>
						</a>{' '}
						is already signed.
					</small>
				) : null}
			</div>
			<Button
				className="wide"
				data-dialog-initial
				onClick={props.onApprove}
				type="button"
				size="custom"
				variant="primary"
			>
				{props.copy?.action}
			</Button>
		</div>
	);
}
