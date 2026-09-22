import { useNavigate } from 'react-router-dom';

import { Button } from 'components/atoms/Button';
import { useOperationActivity } from 'providers/OperationActivityProvider';

import { OperationDialog } from '../OperationDialog';
import { UploadActivityPanel } from '../UploadActivityPanel';

// Renders the global operation, upload, and mint surfaces owned by the operation activity provider.
export default function OperationActivityHost() {
	const navigate = useNavigate();
	const operationActivity = useOperationActivity();
	const mintNotice = operationActivity.mintNotice;

	return (
		<>
			{mintNotice ? (
				<div className="mint-live-notice" role="status" aria-live="polite">
					<div>
						<strong>{mintNotice.asset.name} is live on Bazar</strong>
						<span>The original accepted upload is now applied to live process state.</span>
					</div>
					<Button
						type="button"
						size="custom"
						onClick={() => {
							navigate(`/asset/${mintNotice.collectionId}/${mintNotice.asset.id}`);
							operationActivity.dismissMintNotice();
						}}
					>
						View asset
					</Button>
					<Button type="button" size="custom" variant="ghost" onClick={operationActivity.dismissMintNotice}>
						Dismiss
					</Button>
				</div>
			) : null}
			{operationActivity.activities.map((activity) => (
				<OperationDialog
					key={activity.id}
					taskId={activity.id}
					asset={activity.asset}
					collectionId={activity.collectionId}
					owner={activity.owner}
					operation={activity.operation}
					visible={operationActivity.activeId === activity.id}
					restoreFallback={() =>
						activity.restoreFallback() ??
						document.querySelector<HTMLElement>(
							'.operation-activity-trigger[data-activity-owner="global"]'
						) ??
						document.getElementById('main-content')
					}
					onUpdate={operationActivity.update}
					onOperation={(operation) => operationActivity.updateOperation(activity.id, operation)}
					onHide={operationActivity.hideOperation}
					onClose={(resumeLater, refresh = true) => {
						if (refresh) {
							window.dispatchEvent(
								new CustomEvent('bazar:asset-operation-finished', { detail: activity.asset.id })
							);
						}
						if (resumeLater) operationActivity.hideOperation();
						else operationActivity.remove(activity.id);
					}}
					onViewAsset={() => {
						navigate(`/asset/${activity.collectionId}/${activity.asset.id}`);
						operationActivity.remove(activity.id);
					}}
				/>
			))}
			{operationActivity.uploadActivities.map((activity) => (
				<UploadActivityPanel
					activity={activity}
					key={activity.id}
					relatedMintActivities={operationActivity.mintActivities.filter(
						(candidate) =>
							candidate.asset.id === activity.assetId ||
							activity.assetIds?.includes(candidate.asset.id) ||
							candidate.transactionIds.some((id) =>
								activity.transactions.some((transaction) => transaction.id === id)
							)
					)}
					visible={operationActivity.activeUploadId === activity.id}
					onHide={operationActivity.hideUpload}
					onClose={() => operationActivity.removeUpload(activity.id)}
				/>
			))}
			{operationActivity.mintActivities
				.filter(
					(activity) =>
						!operationActivity.uploadActivities.some(
							(upload) =>
								upload.assetId === activity.asset.id || upload.assetIds?.includes(activity.asset.id)
						)
				)
				.map((activity) => (
					<UploadActivityPanel
						activity={{
							id: activity.id,
							owner: activity.owner,
							kind: 'asset',
							name: activity.asset.name,
							phase: 'tracking',
							status: activity.status,
							createdAt: activity.createdAt,
							transactionIds: activity.transactionIds,
							transactions: activity.transactionIds.map((id, index) => ({
								id,
								label:
									index === activity.transactionIds.length - 1
										? 'Asset transaction'
										: 'Artwork transaction',
							})),
							assetId: activity.asset.id,
							collectionId: activity.collectionId,
						}}
						key={activity.id}
						relatedMintActivities={[activity]}
						visible={operationActivity.activeMintId === activity.id}
						onHide={operationActivity.hideMint}
						onClose={operationActivity.hideMint}
					/>
				))}
		</>
	);
}
