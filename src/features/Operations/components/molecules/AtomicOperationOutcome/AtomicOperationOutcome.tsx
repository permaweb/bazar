import React from 'react';
import { ArrowLeft } from 'lucide-react';

import type { AssetSummary } from 'api/collections';
import type { Operation } from 'api/operations';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
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
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';
import { PurchaseSettlementReceipt } from '../PurchaseSettlementReceipt';

import * as S from './styles';

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
	const messages = useMessages(OPERATIONS_MESSAGES);
	const artworkAlt = formatMessage(messages.outcomeArtworkAlt, { asset: props.asset.name });

	return (
		<div className="result success">
			<OperationOutcome
				title={props.result.title}
				detail={props.result.detail}
				status={
					props.kind === 'buy'
						? formatMessage(messages.outcomeConfirmations, { count: props.paymentConfirmations })
						: undefined
				}
			>
				{props.kind === 'buy' && props.purchaseSteps.length ? (
					<div className="result-outcome-sync">
						<React.Suspense fallback={<Loading label={messages.loadingTransactionProgress} />}>
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
						label={props.kind === 'buy' ? messages.outcomeYouReceived : messages.outcomeYouListed}
						title={props.asset.name}
						detail={
							props.kind === 'sell'
								? formatMessage(messages.outcomeListedPrice, { price: props.value })
								: messages.outcomeOneAsset
						}
						media={
							props.asset.image ? (
								<S.SubjectArtwork
									alt={artworkAlt}
									className="operation-outcome-subject-artwork"
									decoding="async"
									loading="eager"
									src={props.asset.image}
									unavailableLabel={messages.operationArtworkUnavailable}
								/>
							) : (
								<S.SubjectArtworkFallback
									aria-label={artworkAlt}
									className="operation-outcome-subject-artwork operation-outcome-subject-artwork-fallback"
									role="img"
								>
									{props.asset.name.slice(0, 1)}
								</S.SubjectArtworkFallback>
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
					summaryLabel={messages.labelSellerPayment}
				/>
			) : props.kind === 'transfer' && props.transactionId ? (
				<div className="settlement-receipt">
					<div>
						<span>{messages.receiptAsset}</span>
						<strong>{props.asset.name}</strong>
					</div>
					<div>
						<span>{messages.receiptRecipient}</span>
						<WalletAddress address={props.value} full label={messages.walletLabelRecipient} />
					</div>
					<div className="settlement-receipt-links">
						<a href={transactionExplorerUrl(props.transactionId)} rel="noreferrer" target="_blank">
							<OperationExternalLink>
								{formatMessage(messages.receiptTransaction, {
									transaction: short(props.transactionId),
								})}
							</OperationExternalLink>
						</a>
					</div>
				</div>
			) : props.transactionId ? (
				<a href={transactionExplorerUrl(props.transactionId)} rel="noreferrer" target="_blank">
					<OperationExternalLink>
						{formatMessage(messages.receiptViewTransaction, { transaction: short(props.transactionId) })}
					</OperationExternalLink>
				</a>
			) : null}
			<Button
				className="with-icon"
				data-dialog-initial
				onClick={props.onViewAsset}
				size="custom"
				variant="primary"
			>
				<Icon icon={ArrowLeft} size="sm" /> {messages.viewUpdatedAsset}
			</Button>
		</div>
	);
}
