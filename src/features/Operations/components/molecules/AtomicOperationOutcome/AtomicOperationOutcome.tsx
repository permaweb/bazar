import React from 'react';
import { ArrowLeft } from 'lucide-react';

import type { AssetSummary } from 'api/collections';
import type { Operation } from 'api/operations';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import {
	OperationExternalLink,
	OperationOutcome,
	OperationOutcomeSubject,
} from 'components/molecules/OperationOutcomeAnnouncement';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { type ArweaveSyncStep, LazyArweaveTransactionSync } from 'features/TransactionSync';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';

import { PurchaseSettlementReceipt } from '../PurchaseSettlementReceipt';

// The confirmed result of an atomic operation with its receipt and a route back to the updated asset.
export default function AtomicOperationOutcome(props: {
	kind: Operation['kind'];
	asset: AssetSummary;
	result: { title: string; detail: string };
	/** The listing price, or the trimmed transfer recipient. */
	value: string;
	sellerPrice: string;
	seller: string;
	orderId: string;
	registrationId?: string;
	paymentId?: string;
	transactionId: string | null;
	purchaseSteps: ArweaveSyncStep[];
	paymentConfirmations: number;
	active: boolean;
	startedAt: number | undefined;
	onViewAsset(): void;
}) {
	return (
		<div className="result success">
			<OperationOutcome
				title={props.result.title}
				detail={props.result.detail}
				status={props.kind === 'buy' ? `Confirmations: ${props.paymentConfirmations}` : undefined}
			>
				{props.kind === 'buy' && props.purchaseSteps.length ? (
					<div className="result-outcome-sync">
						<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
							<LazyArweaveTransactionSync
								active={props.active}
								activeStep="pay"
								startedAt={props.startedAt}
								steps={props.purchaseSteps}
								subject={props.asset.name}
							/>
						</React.Suspense>
					</div>
				) : null}
				{props.kind === 'buy' || props.kind === 'sell' ? (
					<OperationOutcomeSubject
						label={props.kind === 'buy' ? 'You received' : 'You listed'}
						title={props.asset.name}
						detail={props.kind === 'sell' ? `${props.value} AR` : 'One asset'}
						media={
							props.asset.image ? (
								<ArtworkImage
									alt={`${props.asset.name} artwork`}
									className="operation-outcome-subject-artwork"
									decoding="async"
									loading="eager"
									src={props.asset.image}
								/>
							) : (
								<span
									aria-label={`${props.asset.name} artwork`}
									className="operation-outcome-subject-artwork operation-outcome-subject-artwork-fallback"
									role="img"
								>
									{props.asset.name.slice(0, 1)}
								</span>
							)
						}
					/>
				) : null}
			</OperationOutcome>
			{props.kind === 'buy' ? (
				<PurchaseSettlementReceipt
					orderId={props.orderId}
					paymentId={props.paymentId}
					registrationId={props.registrationId}
					seller={props.seller}
					summary={<ArCurrencyText>{props.sellerPrice}</ArCurrencyText>}
					summaryLabel="Seller payment"
				/>
			) : props.kind === 'transfer' && props.transactionId ? (
				<div className="settlement-receipt">
					<div>
						<span>Asset</span>
						<strong>{props.asset.name}</strong>
					</div>
					<div>
						<span>Recipient</span>
						<WalletAddress address={props.value} full label="recipient" />
					</div>
					<div className="settlement-receipt-links">
						<a href={transactionExplorerUrl(props.transactionId)} rel="noreferrer" target="_blank">
							<OperationExternalLink>Transaction {short(props.transactionId)}</OperationExternalLink>
						</a>
					</div>
				</div>
			) : props.transactionId ? (
				<a href={transactionExplorerUrl(props.transactionId)} rel="noreferrer" target="_blank">
					<OperationExternalLink>View transaction {short(props.transactionId)}</OperationExternalLink>
				</a>
			) : null}
			<Button
				className="with-icon"
				data-dialog-initial
				onClick={props.onViewAsset}
				size="custom"
				variant="primary"
			>
				<Icon icon={ArrowLeft} size="sm" /> View updated asset
			</Button>
		</div>
	);
}
