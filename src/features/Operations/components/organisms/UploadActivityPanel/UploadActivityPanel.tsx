import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CircleX, Images, Upload } from 'lucide-react';

import { CREATED_COLLECTION_ID, type MintActivity } from 'api/mint';
import type { AssetObserverNetworkLease } from 'api/observers';
import { loadAssetObserverRuntime } from 'api/transactions';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { MintTransactionReceipt } from 'components/molecules/MintTransactionReceipt';
import {
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
	TransactionDialogControl,
} from 'components/molecules/TransactionDialogControl';
import { LazyArweaveTransactionSync } from 'features/TransactionSync';
import { useDialogFocus } from 'hooks/useDialogFocus';
import { UploadActivity, UploadObserverState } from 'providers/OperationActivityProvider';

import { uploadActivitySyncSteps } from '../../../model/upload-activity';

export default function UploadActivityPanel(props: {
	activity: UploadActivity;
	relatedMintActivities: MintActivity[];
	visible: boolean;
	onHide(): void;
	onClose(): void;
}) {
	const navigate = useNavigate();
	const [hiding, setHiding] = React.useState(false);
	const [observerState, setObserverState] = React.useState<UploadObserverState>({});
	const hideTimerRef = React.useRef<number | null>(null);
	const titleId = React.useId();
	const working = props.activity.phase === 'working' || props.activity.phase === 'tracking';
	const primaryMintActivity =
		props.relatedMintActivities.find((candidate) => candidate.asset.id === props.activity.assetId) ??
		props.relatedMintActivities[props.relatedMintActivities.length - 1];
	const displayedStatus =
		props.activity.phase === 'tracking'
			? primaryMintActivity?.status ?? props.activity.status
			: props.activity.status;
	const syncSteps = uploadActivitySyncSteps(props.activity, props.relatedMintActivities, observerState);
	const activeSyncStep =
		[...syncSteps].reverse().find((step) => (step.confirmations ?? 0) < step.target) ??
		syncSteps[syncSteps.length - 1];
	const closeOrHide = React.useCallback(() => {
		if (!working) {
			props.onClose();
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
	}, [hiding, props.onClose, props.onHide, working]);
	const dialogRef = useDialogFocus<HTMLDivElement>(
		props.visible,
		closeOrHide,
		undefined,
		props.activity.phase,
		() =>
			document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]') ??
			document.getElementById('main-content')
	);
	React.useEffect(() => {
		if (props.visible) setHiding(false);
	}, [props.visible]);
	React.useEffect(() => {
		if (!props.visible || !working || !props.activity.transactions.length) return;
		let cancelled = false;
		let lease: AssetObserverNetworkLease | undefined;
		const watchers: Array<{ stop(): void }> = [];
		const unsubscribe: Array<() => void> = [];
		const observe = async () => {
			const runtime = await loadAssetObserverRuntime();
			if (cancelled) return;
			lease = runtime.acquireAssetObserverNetwork();
			await lease.ready;
			if (cancelled) return;
			for (const transaction of props.activity.transactions) {
				const watcher = lease.network.watch(transaction.id, {
					target: 1,
					minObservers: 3,
					propagation: 'all',
					notFoundTimeout: 180_000,
				});
				const publish = (consensus = watcher.consensus()) => {
					if (cancelled) return;
					setObserverState((current) => ({
						...current,
						[transaction.id]: { views: watcher.views(), consensus },
					}));
				};
				unsubscribe.push(
					watcher.on('view', () => publish()),
					watcher.on('consensus', publish)
				);
				watchers.push(watcher);
				watcher.start();
			}
		};
		void observe().catch(() => {
			lease?.release();
			lease = undefined;
		});
		return () => {
			cancelled = true;
			for (const off of unsubscribe) off();
			for (const watcher of watchers) watcher.stop();
			lease?.release();
		};
	}, [props.activity.transactions, props.visible, working]);
	React.useEffect(
		() => () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
		},
		[]
	);
	if (!props.visible && !working) return null;
	const receiptEntries = props.activity.transactions.length
		? props.activity.transactions.map((transaction) => ({
				label: transaction.label,
				transactionId: transaction.id,
		  }))
		: props.activity.transactionIds.map((transactionId, index) => ({
				label:
					props.activity.kind === 'collection'
						? index === props.activity.transactionIds.length - 1
							? props.activity.extended
								? 'Collection update'
								: 'Collection process'
							: 'Collection manifest'
						: index === props.activity.transactionIds.length - 1
						? 'Asset transaction'
						: 'Artwork transaction',
				transactionId,
		  }));
	const dialogPhase =
		props.activity.phase === 'error' ? 'error' : props.activity.phase === 'done' ? 'done' : 'working';
	return (
		<div
			className={`dialog-backdrop operation-panel-backdrop${hiding ? ' dialog-backdrop-hiding' : ''}`}
			hidden={!props.visible}
			onMouseDown={(event) => event.target === event.currentTarget && closeOrHide()}
			role="presentation"
		>
			<div
				aria-hidden={props.visible ? undefined : true}
				aria-labelledby={props.visible ? titleId : undefined}
				aria-modal={props.visible ? true : undefined}
				className="dialog operation-side-panel upload-activity-panel"
				ref={dialogRef}
				role={props.visible ? 'dialog' : undefined}
				tabIndex={-1}
			>
				<DialogHeading
					artwork={
						<span aria-hidden="true" className="dialog-asset-artwork dialog-asset-artwork-fallback">
							{props.activity.kind === 'collection' ? (
								<Icon icon={Images} size="sm" />
							) : (
								<Icon icon={Upload} size="sm" />
							)}
						</span>
					}
					control={<TransactionDialogControl hiding={hiding} phase={dialogPhase} onClick={closeOrHide} />}
					eyebrow={props.activity.kind === 'collection' ? 'Collection upload' : 'Asset upload'}
					layout="asset"
					title={props.activity.name}
					titleId={titleId}
				/>
				{working && !syncSteps.length ? (
					<div className="operation-preparing">
						<Loading label={displayedStatus} />
						<p>The network view will appear as soon as the first signed transaction is available.</p>
					</div>
				) : null}
				{working && syncSteps.length ? (
					<div className="operation-working">
						<LiveRegion as="p">{displayedStatus}</LiveRegion>
						<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
							<LazyArweaveTransactionSync
								active={props.visible}
								activeStep={activeSyncStep?.key}
								miningTelemetryEnabled={false}
								pendingAfterConfirmation={
									primaryMintActivity?.phase === 'mined'
										? 'Waiting for live process state'
										: primaryMintActivity?.phase === 'applied'
										? 'Finishing Bazar indexing'
										: undefined
								}
								startedAt={props.activity.createdAt}
								steps={syncSteps}
								subject={props.activity.name}
								telemetryPanelEnabled={false}
							/>
						</React.Suspense>
					</div>
				) : null}
				{!working ? (
					<div className={`upload-activity-state ${props.activity.phase}`}>
						<span className="upload-activity-result-icon" aria-hidden="true">
							{props.activity.phase === 'done' ? <Check /> : <CircleX />}
						</span>
						<div>
							<strong>
								{props.activity.phase === 'done'
									? props.activity.kind === 'collection'
										? props.activity.extended
											? 'Collection extended'
											: 'Collection submitted'
										: 'Live on Bazar'
									: 'Upload needs attention'}
							</strong>
							<p aria-live="polite" role="status">
								{displayedStatus}
							</p>
						</div>
					</div>
				) : null}
				{receiptEntries.length ? <MintTransactionReceipt entries={receiptEntries} /> : null}
				{props.activity.phase === 'done' && props.activity.collectionId ? (
					<Button
						className="wide"
						data-dialog-initial
						onClick={() => {
							navigate(
								props.activity.kind === 'collection'
									? `/collection/${props.activity.collectionId}`
									: `/asset/${CREATED_COLLECTION_ID}/${props.activity.assetId}`
							);
							props.onClose();
						}}
						size="custom"
						variant="primary"
					>
						View {props.activity.kind === 'collection' ? 'collection' : 'asset'}
					</Button>
				) : null}
			</div>
		</div>
	);
}
