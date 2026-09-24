import React from 'react';
import { ArrowRight } from 'lucide-react';

import type { FungibleMintPhase, FungibleMintResult } from 'api/mint';
import type { Consensus, ObserverView } from 'api/transactions';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { TokenArtwork } from 'components/atoms/TokenArtwork';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { MintTransactionReceipt } from 'components/molecules/MintTransactionReceipt';
import {
	OperationErrorAlert,
	OperationOutcome,
	OperationOutcomeAnnouncement,
	OperationOutcomeSubject,
} from 'components/molecules/OperationOutcomeAnnouncement';
import {
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
	TransactionDialogControl,
	type TransactionDialogPhase,
} from 'components/molecules/TransactionDialogControl';
import { LazyArweaveTransactionSync } from 'features/TransactionSync';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { CREATE_MESSAGES } from '../../../messages';
import { fungibleMintView, mintTransactionAddressCopy } from '../../../model/mint-flow';

import * as S from './styles';

export default function FungibleMintDialog(props: {
	error: string | null;
	logoPreview: string;
	name: string;
	onClearError: () => void;
	onNavigate: (path: string) => void;
	onVisibleChange: (visible: boolean) => void;
	phase: FungibleMintPhase | null;
	phaseLabel: string;
	progressButton: React.RefObject<HTMLButtonElement>;
	ready: boolean;
	result: FungibleMintResult | null;
	ticker: string;
	visible: boolean;
	views: ObserverView[];
	consensus: Consensus | null;
	confirmations: number;
}) {
	const messages = useMessages(CREATE_MESSAGES);
	const dialogRef = React.useRef<HTMLElement | null>(null);
	const [hiding, setHiding] = React.useState(false);
	const hideTimerRef = React.useRef<number | null>(null);
	const dialogPhase: TransactionDialogPhase = props.error ? 'error' : props.ready ? 'done' : 'working';
	const closeOrHide = React.useCallback(() => {
		if (dialogPhase !== 'working') {
			props.onVisibleChange(false);
			return;
		}
		if (hiding) return;
		if (dialogRef.current) prepareTransactionDialogHide(dialogRef.current, props.progressButton.current);
		setHiding(true);
		hideTimerRef.current = window.setTimeout(() => {
			hideTimerRef.current = null;
			props.onVisibleChange(false);
		}, TRANSACTION_DIALOG_HIDE_DURATION_MS);
	}, [dialogPhase, hiding, props.onVisibleChange, props.progressButton]);

	React.useEffect(() => {
		if (props.visible) setHiding(false);
	}, [props.visible]);
	React.useEffect(
		() => () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
		},
		[]
	);

	const view = fungibleMintView(props.result, props.name, props.ticker, messages);
	const tokenName = view.tokenName;
	const tokenTicker = view.tokenTicker;
	const receiptEntries = view.receiptEntries;

	const handleNavigate = (path: string | null) => {
		if (path) props.onNavigate(path);
	};

	return (
		<S.Panel
			backdropClassName="dialog-backdrop operation-panel-backdrop"
			className="dialog operation-side-panel fungible-dialog fungible-mint-dialog"
			focusKey={dialogPhase}
			hiding={hiding}
			keepMounted={dialogPhase === 'working'}
			labelledBy="fungible-mint-operation fungible-mint-title"
			onDismiss={closeOrHide}
			open={props.visible}
			panelRef={dialogRef}
			restoreTarget={() => props.progressButton.current}
		>
			<DialogHeading
				artwork={
					props.logoPreview ? (
						<img alt="" className="dialog-asset-artwork" src={props.logoPreview} />
					) : (
						<TokenArtwork
							className="dialog-asset-artwork"
							subtitle={messages.mintTokenArtworkSubtitle}
							ticker={tokenTicker}
						/>
					)
				}
				control={
					<TransactionDialogControl
						closeLabel={messages.mintDialogClose}
						hideLabel={messages.mintDialogHideTransaction}
						hiding={hiding}
						phase={dialogPhase}
						onClick={closeOrHide}
					/>
				}
				eyebrow={messages.fungibleDialogEyebrow}
				eyebrowId="fungible-mint-operation"
				layout="asset"
				title={tokenName}
				titleId="fungible-mint-title"
			/>
			<OperationOutcomeAnnouncement
				active={dialogPhase === 'done'}
				detail={formatMessage(messages.fungibleDialogOutcomeDetail, {
					supply: props.result?.wholeSupply ?? '',
					ticker: props.result?.ticker ?? '',
				})}
				title={messages.fungibleDialogOutcomeTitle}
			/>
			{dialogPhase === 'working' && !props.result ? (
				<S.Preparing className="operation-preparing">
					<Loading label={props.phaseLabel || messages.fungibleDialogPreparing} />
					<p>{props.phase ? messages.fungibleDialogPhaseDetail : messages.fungibleDialogCheckingDetail}</p>
				</S.Preparing>
			) : null}
			{dialogPhase === 'working' && props.result ? (
				<div className="operation-working">
					<LiveRegion as="p">{messages.fungibleDialogSubmitted}</LiveRegion>
					<p className="scheduler-wait">
						{formatMessage(messages.fungibleDialogSchedulerWait, {
							supply: props.result.wholeSupply,
							ticker: props.result.ticker,
						})}
					</p>
					<React.Suspense fallback={<Loading label={messages.fungibleDialogLoadingProgress} />}>
						<LazyArweaveTransactionSync
							active={props.visible}
							activeStep="mint"
							pendingAfterConfirmation={messages.fungibleDialogPendingAfterConfirmation}
							steps={[
								{
									key: 'mint',
									label: messages.fungibleDialogStepMint,
									target: 5,
									terminal: true,
									confirmations: props.confirmations,
									transaction: {
										id: props.result?.processId,
										views: props.views,
										...(props.consensus ? { consensus: props.consensus } : {}),
									},
								},
							]}
							subject={tokenTicker}
						/>
					</React.Suspense>
					<MintTransactionReceipt
						addressLabels={mintTransactionAddressCopy(messages)}
						ariaLabel={messages.mintReceiptsLabel}
						entries={receiptEntries}
					/>
				</div>
			) : null}
			{dialogPhase === 'done' && props.result ? (
				<div className="result success">
					<OperationOutcome
						detail={formatMessage(messages.fungibleDialogOutcomeDetail, {
							supply: props.result.wholeSupply,
							ticker: props.result.ticker,
						})}
						title={messages.fungibleDialogOutcomeTitle}
					>
						<OperationOutcomeSubject
							label={messages.fungibleDialogOutcomeSubjectLabel}
							title={formatMessage(messages.fungibleDialogOutcomeSubjectTitle, {
								supply: props.result.wholeSupply,
								ticker: props.result.ticker,
							})}
							detail={tokenName}
							media={
								<TokenAvatar
									className="operation-outcome-token-avatar"
									image={props.logoPreview || undefined}
									loading="eager"
									ticker={props.result.ticker}
								/>
							}
						/>
					</OperationOutcome>
					<MintTransactionReceipt
						addressLabels={mintTransactionAddressCopy(messages)}
						ariaLabel={messages.mintReceiptsLabel}
						entries={receiptEntries}
					/>
					<Button
						className="with-icon"
						data-dialog-initial
						onClick={() => handleNavigate(view.tokenPath)}
						size="custom"
						variant="primary"
					>
						{messages.fungibleDialogViewToken} <Icon icon={ArrowRight} size="sm" />
					</Button>
					<Button className="with-icon" onClick={() => handleNavigate(view.dispatchPath)} size="custom">
						{messages.fungibleDialogDispatch} <Icon icon={ArrowRight} size="sm" />
					</Button>
				</div>
			) : null}
			{dialogPhase === 'error' ? (
				<div className="result error">
					<OperationErrorAlert title={messages.fungibleDialogErrorTitle} message={props.error ?? ''} />
					<Button
						data-dialog-initial
						onClick={() => {
							props.onClearError();
							props.onVisibleChange(false);
						}}
						size="custom"
					>
						{messages.fungibleDialogReturn}
					</Button>
				</div>
			) : null}
		</S.Panel>
	);
}
