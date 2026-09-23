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
import { Dialog } from 'components/organisms/Dialog';
import { LazyArweaveTransactionSync } from 'features/TransactionSync';

import { fungibleMintView } from '../../../model/mint-flow';

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

	const view = fungibleMintView(props.result, props.name, props.ticker);
	const tokenName = view.tokenName;
	const tokenTicker = view.tokenTicker;
	const receiptEntries = view.receiptEntries;

	const handleNavigate = (path: string | null) => {
		if (path) props.onNavigate(path);
	};

	return (
		<Dialog
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
						<TokenArtwork className="dialog-asset-artwork" ticker={tokenTicker} />
					)
				}
				control={<TransactionDialogControl hiding={hiding} phase={dialogPhase} onClick={closeOrHide} />}
				eyebrow="Create token"
				eyebrowId="fungible-mint-operation"
				layout="asset"
				title={tokenName}
				titleId="fungible-mint-title"
			/>
			<OperationOutcomeAnnouncement
				active={dialogPhase === 'done'}
				detail={`All ${props.result?.wholeSupply ?? ''} ${
					props.result?.ticker ?? ''
				} are in your wallet and ready to dispatch.`}
				title="Token live on Bazar"
			/>
			{dialogPhase === 'working' && !props.result ? (
				<div className="operation-preparing">
					<Loading label={props.phaseLabel || 'Preparing token transactions…'} />
					<p>
						{props.phase
							? 'Keep this wallet request open while Bazar prepares and submits the permanent token transactions.'
							: 'Checking the connected wallet, network cost, and token details before requesting approval.'}
					</p>
				</div>
			) : null}
			{dialogPhase === 'working' && props.result ? (
				<div className="operation-working">
					<LiveRegion as="p">
						Token submitted. Watching independently addressed Arweave nodes and waiting for the token
						process state.
					</LiveRegion>
					<p className="scheduler-wait">
						All {props.result.wholeSupply} {props.result.ticker} are minted to your wallet. Bazar is waiting
						for the scheduler to make the process readable.
					</p>
					<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
						<LazyArweaveTransactionSync
							active={props.visible}
							activeStep="mint"
							pendingAfterConfirmation="Waiting for token process state"
							steps={[
								{
									key: 'mint',
									label: 'Mint token',
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
					<MintTransactionReceipt entries={receiptEntries} />
				</div>
			) : null}
			{dialogPhase === 'done' && props.result ? (
				<div className="result success">
					<OperationOutcome
						detail={`All ${props.result.wholeSupply} ${props.result.ticker} are in your wallet and ready to dispatch.`}
						title="Token live on Bazar"
					>
						<OperationOutcomeSubject
							label="You created"
							title={`${props.result.wholeSupply} ${props.result.ticker}`}
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
					<MintTransactionReceipt entries={receiptEntries} />
					<Button
						className="with-icon"
						data-dialog-initial
						onClick={() => handleNavigate(view.tokenPath)}
						size="custom"
						variant="primary"
					>
						View token <Icon icon={ArrowRight} size="sm" />
					</Button>
					<Button className="with-icon" onClick={() => handleNavigate(view.dispatchPath)} size="custom">
						Dispatch to holders <Icon icon={ArrowRight} size="sm" />
					</Button>
				</div>
			) : null}
			{dialogPhase === 'error' ? (
				<div className="result error">
					<OperationErrorAlert title="Could not create this token" message={props.error ?? ''} />
					<Button
						data-dialog-initial
						onClick={() => {
							props.onClearError();
							props.onVisibleChange(false);
						}}
						size="custom"
					>
						Return to token details
					</Button>
				</div>
			) : null}
		</Dialog>
	);
}
