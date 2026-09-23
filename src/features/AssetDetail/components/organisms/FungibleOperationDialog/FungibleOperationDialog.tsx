import React from 'react';
import { ShoppingCart, Tag } from 'lucide-react';

import type { AssetSummary } from 'api/collections';
import type { AssetState } from 'api/marketplace';
import type { FungibleOperationActivitySummary } from 'api/operations';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { OperationOutcomeAnnouncement } from 'components/molecules/OperationOutcomeAnnouncement';
import {
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
	TransactionDialogControl,
	transactionDialogDismissAction,
} from 'components/molecules/TransactionDialogControl';
import { Dialog } from 'components/organisms/Dialog';
import { asyncData } from 'helpers/async-state';
import { formatTickerLabel } from 'helpers/token-display';

import { useFungibleOperationFlow } from '../../../hooks/useFungibleOperationFlow';
import { useFungiblePurchaseQuote } from '../../../hooks/useFungiblePurchaseQuote';
import { type FungibleOperation, operationLabel } from '../../../model/fungible-operation';
import {
	fungibleOperationDraftView,
	fungibleOperationOutcome,
	fungibleOperationSubmit,
	fungiblePurchaseCandidates,
	fungiblePurchaseDraftMatch,
	fungiblePurchaseTotals,
	initialFungibleOperationDraft,
} from '../../../model/fungible-operation-view';
import { FungibleCancelSummary } from '../../molecules/FungibleCancelSummary';
import { FungiblePurchaseReview } from '../../molecules/FungiblePurchaseReview';
import { FungibleRecoveryApproval } from '../../molecules/FungibleRecoveryApproval';
import { FungibleSellFields } from '../../molecules/FungibleSellFields';
import { FungibleTransferFields } from '../../molecules/FungibleTransferFields';
import { FungibleOperationFailure } from '../FungibleOperationFailure';
import { FungibleOperationProgress } from '../FungibleOperationProgress';
import { FungibleOperationReceipt } from '../FungibleOperationReceipt';

export default function FungibleOperationDialog(props: {
	asset: AssetSummary;
	collectionId: string;
	state: AssetState;
	owner: string;
	operation: FungibleOperation;
	visible: boolean;
	restoreFallback(): HTMLElement | null;
	onHide(): void;
	onActivityChange(
		update: Pick<FungibleOperationActivitySummary, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>
	): void;
	onRestart(): void;
	onClose(resumeLater?: boolean, refresh?: boolean): void;
}) {
	const hideTimerRef = React.useRef<number | null>(null);
	const dialogRef = React.useRef<HTMLElement | null>(null);
	const [draft, setDraft] = React.useState(() =>
		initialFungibleOperationDraft(props.operation, props.state.denomination)
	);
	const [hiding, setHiding] = React.useState(false);
	const tickerDisplay = formatTickerLabel(props.state.ticker || 'Token');
	const eligible = React.useMemo(() => fungiblePurchaseCandidates(props.operation), [props.operation]);
	const purchaseMatch = React.useMemo(
		() => fungiblePurchaseDraftMatch(props.operation.kind, eligible, draft.quantity, props.state, tickerDisplay),
		[draft.quantity, eligible, props.operation.kind, props.state, tickerDisplay]
	);
	const matchedFills = purchaseMatch.match?.fills ?? [];
	const matchedOrders = matchedFills.map((fill) => fill.order);
	const draftView = fungibleOperationDraftView(props.operation, props.state, props.owner, draft);
	const quote = useFungiblePurchaseQuote({
		assetId: props.asset.id,
		owner: props.owner,
		orders: matchedOrders,
		enabled: props.operation.kind === 'buy' && !props.operation.resume,
	});
	const flow = useFungibleOperationFlow({
		asset: props.asset,
		collectionId: props.collectionId,
		state: props.state,
		owner: props.owner,
		operation: props.operation,
		visible: props.visible,
		quantity: draft.quantity,
		unitPrice: draft.unitPrice,
		transferRecipient: draftView.transferRecipient,
		matchedFills,
		onActivityChange: props.onActivityChange,
		onRestart: props.onRestart,
		onClose: props.onClose,
	});
	const quoteData = asyncData(quote.state);
	const outcome = fungibleOperationOutcome(props.operation, props.state, flow.visibleOrders, draftView);
	const submitAction = fungibleOperationSubmit(props.operation, props.state, draftView, {
		orders: matchedOrders,
		quantity: fungiblePurchaseTotals(matchedOrders).quantity,
		estimatedCost: quoteData?.total,
		canAfford: quoteData?.canAfford,
	});
	const quoteStatusId = React.useId();
	const dialogTitleId = React.useId();
	const operationLabelId = React.useId();

	React.useEffect(
		() => () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
		},
		[]
	);

	React.useEffect(() => {
		if (props.visible) setHiding(false);
	}, [props.visible]);

	function handleDismiss() {
		const action = transactionDialogDismissAction(flow.phase, flow.signedWork);
		if (action.kind === 'close') {
			props.onClose(action.resumeLater, action.refresh);
			return;
		}
		if (hiding) return;
		if (dialogRef.current) {
			prepareTransactionDialogHide(
				dialogRef.current,
				document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]')
			);
		}
		setHiding(true);
		hideTimerRef.current = window.setTimeout(() => {
			hideTimerRef.current = null;
			props.onHide();
		}, TRANSACTION_DIALOG_HIDE_DURATION_MS);
	}

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		flow.submit();
	}

	function handleQuantityChange(quantity: string) {
		setDraft((current) => ({ ...current, quantity }));
	}

	const compactPurchaseForm = flow.phase === 'form' && props.operation.kind === 'buy';
	return (
		<Dialog
			backdropClassName="dialog-backdrop operation-panel-backdrop"
			className={`dialog operation-side-panel fungible-dialog${
				flow.phase === 'form' ? ' dialog-form-phase' : ''
			}${compactPurchaseForm ? ' purchase-dialog' : ''}`}
			focusKey={flow.phase}
			hiding={hiding}
			keepMounted={flow.phase === 'working'}
			labelledBy={compactPurchaseForm ? dialogTitleId : `${operationLabelId} ${dialogTitleId}`}
			onDismiss={handleDismiss}
			open={props.visible}
			panelRef={dialogRef}
			restoreFallback={props.restoreFallback}
		>
			<DialogHeading
				artwork={
					flow.phase === 'working' ? (
						<TokenAvatar
							className="dialog-asset-artwork"
							image={props.asset.image}
							loading="eager"
							ticker={props.state.ticker || props.asset.ticker || props.asset.name}
						/>
					) : null
				}
				control={<TransactionDialogControl hiding={hiding} phase={flow.phase} onClick={handleDismiss} />}
				eyebrow={compactPurchaseForm ? undefined : operationLabel(props.operation.kind)}
				eyebrowId={operationLabelId}
				layout="asset"
				title={compactPurchaseForm ? `Buy ${props.asset.name}` : props.asset.name}
				titleId={dialogTitleId}
			/>
			<OperationOutcomeAnnouncement
				active={flow.phase === 'done'}
				title={outcome.title}
				detail={outcome.detail}
			/>
			{flow.phase === 'approval' && props.operation.kind === 'buy' && props.operation.resume ? (
				<FungibleRecoveryApproval
					entries={props.operation.resume.entries}
					fills={flow.visibleFills}
					onContinue={flow.submit}
					state={props.state}
				/>
			) : null}
			{flow.phase === 'form' ? (
				<form className="trade-form" onSubmit={handleSubmit}>
					<div className="dialog-form-scroll">
						{props.operation.kind === 'sell' ? (
							<FungibleSellFields
								draft={draftView}
								onQuantityChange={handleQuantityChange}
								onUnitPriceChange={(unitPrice) => setDraft((current) => ({ ...current, unitPrice }))}
								quantity={draft.quantity}
								state={props.state}
								unitPrice={draft.unitPrice}
							/>
						) : null}
						{props.operation.kind === 'transfer' ? (
							<FungibleTransferFields
								draft={draftView}
								onQuantityChange={handleQuantityChange}
								onRecipientChange={(recipient) => setDraft((current) => ({ ...current, recipient }))}
								quantity={draft.quantity}
								recipient={draft.recipient}
								state={props.state}
							/>
						) : null}
						{props.operation.kind === 'cancel' ? (
							<FungibleCancelSummary
								draft={draftView}
								order={props.operation.order}
								state={props.state}
							/>
						) : null}
						{props.operation.kind === 'buy' ? (
							<FungiblePurchaseReview
								onRetryQuote={quote.retry}
								orders={matchedOrders}
								quote={quote.state}
								quoteStatusId={quoteStatusId}
								state={props.state}
							/>
						) : null}
					</div>
					<div className="trade-form-footer">
						<Button
							className={`wide${
								props.operation.kind === 'buy' || props.operation.kind === 'sell'
									? ' with-icon market-primary-action'
									: ''
							}`}
							data-dialog-initial
							aria-label={submitAction.ariaLabel}
							aria-describedby={
								props.operation.kind === 'buy' && matchedOrders.length ? quoteStatusId : undefined
							}
							disabled={submitAction.disabled}
							size="custom"
							type="submit"
							variant={props.operation.kind === 'cancel' ? 'danger' : 'primary'}
						>
							{props.operation.kind === 'buy' ? (
								<Icon icon={ShoppingCart} size="sm" />
							) : props.operation.kind === 'sell' ? (
								<Icon icon={Tag} size="sm" />
							) : null}
							<ArCurrencyText>{submitAction.label}</ArCurrencyText>
						</Button>
					</div>
				</form>
			) : null}
			{flow.phase === 'working' ? (
				<FungibleOperationProgress
					assetName={props.asset.name}
					flow={flow}
					operationKind={props.operation.kind}
					state={props.state}
					visible={props.visible}
				/>
			) : null}
			{flow.phase === 'done' ? (
				<FungibleOperationReceipt
					asset={props.asset}
					draft={draftView}
					flow={flow}
					onClose={() => props.onClose(false)}
					operation={props.operation}
					outcome={outcome}
					state={props.state}
					visible={props.visible}
				/>
			) : null}
			{flow.phase === 'error' ? (
				<FungibleOperationFailure
					flow={flow}
					onClose={() => props.onClose(false)}
					operationKind={props.operation.kind}
					state={props.state}
				/>
			) : null}
		</Dialog>
	);
}
