import { Button } from 'components/atoms/Button';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { useOperationActivityHost } from '../../../hooks/useOperationActivityHost';
import { OPERATIONS_MESSAGES } from '../../../messages';
import { OperationDialog } from '../OperationDialog';
import { UploadActivityPanel } from '../UploadActivityPanel';

// Renders the global operation, upload, and mint surfaces owned by the operation activity provider.
export default function OperationActivityHost() {
	const messages = useMessages(OPERATIONS_MESSAGES);
	const host = useOperationActivityHost();
	const mintNotice = host.mintNotice;

	return (
		<>
			{mintNotice ? (
				<div className="mint-live-notice" role="status" aria-live="polite">
					<div>
						<strong>{formatMessage(messages.mintNoticeTitle, { asset: mintNotice.asset.name })}</strong>
						<span>{messages.mintNoticeDetail}</span>
					</div>
					<Button type="button" size="custom" onClick={host.viewMintNoticeAsset}>
						{messages.mintNoticeViewAsset}
					</Button>
					<Button type="button" size="custom" variant="ghost" onClick={host.dismissMintNotice}>
						{messages.mintNoticeDismiss}
					</Button>
				</div>
			) : null}
			{host.operations.map((activity) => (
				<OperationDialog
					key={activity.id}
					taskId={activity.id}
					asset={activity.asset}
					collectionId={activity.collectionId}
					owner={activity.owner}
					operation={activity.operation}
					visible={host.activeOperationId === activity.id}
					restoreFallback={() =>
						activity.restoreFallback() ??
						document.querySelector<HTMLElement>(
							'.operation-activity-trigger[data-activity-owner="global"]'
						) ??
						document.getElementById('main-content')
					}
					onUpdate={host.update}
					onOperation={(operation) => host.updateOperation(activity.id, operation)}
					onHide={host.hideOperation}
					onClose={(resumeLater, refresh) => host.closeOperation(activity, resumeLater, refresh)}
					onViewAsset={() => host.viewOperationAsset(activity)}
				/>
			))}
			{host.uploads.map((upload) => (
				<UploadActivityPanel
					activity={upload.activity}
					key={upload.activity.id}
					relatedMintActivities={upload.relatedMintActivities}
					visible={host.activeUploadId === upload.activity.id}
					onHide={host.hideUpload}
					onClose={() => host.removeUpload(upload.activity.id)}
				/>
			))}
			{host.mintUploads.map((mint) => (
				<UploadActivityPanel
					activity={mint.activity}
					key={mint.activity.id}
					relatedMintActivities={mint.relatedMintActivities}
					visible={host.activeMintId === mint.activity.id}
					onHide={host.hideMint}
					onClose={host.hideMint}
				/>
			))}
		</>
	);
}
