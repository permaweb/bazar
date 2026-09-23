import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CircleX, Images, Upload } from 'lucide-react';

import type { MintActivity } from 'api/mint';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { MintTransactionReceipt } from 'components/molecules/MintTransactionReceipt';
import { TransactionDialogControl } from 'components/molecules/TransactionDialogControl';
import { Dialog } from 'components/organisms/Dialog';
import { LazyArweaveTransactionSync } from 'features/TransactionSync';
import { useMessages } from 'providers/LanguageProvider';
import type { UploadActivity } from 'providers/OperationActivityProvider';

import { useTransactionDialogHide } from '../../../hooks/useTransactionDialogHide';
import { useUploadObservers } from '../../../hooks/useUploadObservers';
import { OPERATIONS_MESSAGES } from '../../../messages';
import { operationTransactionAddressCopy } from '../../../model/operation-copy';
import { isUploadActivityWorking, uploadActivityDestination, uploadActivityView } from '../../../model/upload-activity';

export default function UploadActivityPanel(props: {
	activity: UploadActivity;
	relatedMintActivities: MintActivity[];
	visible: boolean;
	onHide(): void;
	onClose(): void;
}) {
	const navigate = useNavigate();
	const messages = useMessages(OPERATIONS_MESSAGES);
	const dialogHide = useTransactionDialogHide(props.visible, props.onHide);
	const titleId = React.useId();
	const observerState = useUploadObservers(
		props.activity.transactions,
		props.visible && isUploadActivityWorking(props.activity)
	);
	const view = uploadActivityView(props.activity, props.relatedMintActivities, observerState, messages);

	function handleDismiss() {
		if (!view.working) {
			props.onClose();
			return;
		}
		dialogHide.hide();
	}

	function handleViewResult() {
		navigate(uploadActivityDestination(props.activity));
		props.onClose();
	}

	return (
		<Dialog
			backdropClassName="dialog-backdrop operation-panel-backdrop"
			className="dialog operation-side-panel upload-activity-panel"
			focusKey={props.activity.phase}
			hiding={dialogHide.hiding}
			keepMounted={view.working}
			labelledBy={titleId}
			onDismiss={handleDismiss}
			open={props.visible}
			panelRef={dialogHide.panelRef}
			restoreFallback={() =>
				document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]') ??
				document.getElementById('main-content')
			}
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
				control={
					<TransactionDialogControl
						closeLabel={messages.operationDialogClose}
						hideLabel={messages.operationDialogHideTransaction}
						hiding={dialogHide.hiding}
						phase={view.phase}
						onClick={handleDismiss}
					/>
				}
				eyebrow={
					props.activity.kind === 'collection'
						? messages.uploadEyebrowCollection
						: messages.uploadEyebrowAsset
				}
				layout="asset"
				title={props.activity.name}
				titleId={titleId}
			/>
			{view.working && !view.syncSteps.length ? (
				<div className="operation-preparing">
					<Loading label={view.status} />
					<p>{messages.uploadPreparingDetail}</p>
				</div>
			) : null}
			{view.working && view.syncSteps.length ? (
				<div className="operation-working">
					<LiveRegion as="p">{view.status}</LiveRegion>
					<React.Suspense fallback={<Loading label={messages.loadingTransactionProgress} />}>
						<LazyArweaveTransactionSync
							active={props.visible}
							activeStep={view.activeStep}
							miningTelemetryEnabled={false}
							pendingAfterConfirmation={view.pendingAfterConfirmation}
							startedAt={props.activity.createdAt}
							steps={view.syncSteps}
							subject={props.activity.name}
							telemetryPanelEnabled={false}
						/>
					</React.Suspense>
				</div>
			) : null}
			{!view.working ? (
				<div className={`upload-activity-state ${props.activity.phase}`}>
					<span className="upload-activity-result-icon" aria-hidden="true">
						{props.activity.phase === 'done' ? <Check /> : <CircleX />}
					</span>
					<div>
						<strong>
							{props.activity.phase === 'done'
								? props.activity.kind === 'collection'
									? props.activity.extended
										? messages.uploadCollectionExtended
										: messages.uploadCollectionSubmitted
									: messages.uploadAssetLive
								: messages.uploadNeedsAttention}
						</strong>
						<p aria-live="polite" role="status">
							{view.status}
						</p>
					</div>
				</div>
			) : null}
			{view.receiptEntries.length ? (
				<MintTransactionReceipt
					addressLabels={operationTransactionAddressCopy(messages)}
					ariaLabel={messages.operationReceiptsLabel}
					entries={view.receiptEntries}
				/>
			) : null}
			{props.activity.phase === 'done' && props.activity.collectionId ? (
				<Button className="wide" data-dialog-initial onClick={handleViewResult} size="custom" variant="primary">
					{props.activity.kind === 'collection' ? messages.uploadViewCollection : messages.uploadViewAsset}
				</Button>
			) : null}
		</Dialog>
	);
}
