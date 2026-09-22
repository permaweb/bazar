import React from 'react';
import { ChevronRight, Images, InfinityIcon, LoaderCircle, Upload } from 'lucide-react';

import { type MintActivity, mintActivityNeedsAttention, removeMintActivities } from 'api/mint';
import { type OperationActivityPhase, operationLabel } from 'api/operations';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { Tooltip } from 'components/atoms/Tooltip';
import { isTransactionActivityVisible } from 'components/molecules/TransactionDialogControl';
import { arweaveGatewayFromLocation, gatewayFromLocation } from 'helpers/config';
import { useOperationActivity } from 'providers/OperationActivityProvider';
import { useWallet } from 'providers/WalletProvider';

export default function OperationActivityControl() {
	const wallet = useWallet();
	const {
		activities,
		fungibleActivities,
		mintActivities,
		uploadActivities,
		show,
		showFungible,
		showMint,
		showUpload,
	} = useOperationActivity();
	const [open, setOpen] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const visibleActivities = activities.filter(
		(activity) => activity.owner === wallet.address && isTransactionActivityVisible(activity.phase)
	);
	const visibleFungibleActivities = fungibleActivities.filter((activity) =>
		isTransactionActivityVisible(activity.phase)
	);
	const visibleUploadActivities = uploadActivities.filter((activity) => activity.owner === wallet.address);
	const linkedUploadAssets = new Set(
		visibleUploadActivities.flatMap((activity) => [activity.assetId, ...(activity.assetIds ?? [])])
	);
	const visibleMintActivities = mintActivities.filter(
		(activity) => activity.owner === wallet.address && !linkedUploadAssets.has(activity.asset.id)
	);
	const attentionMintActivities = visibleMintActivities.filter((activity) => mintActivityNeedsAttention(activity));
	const activityCount =
		visibleActivities.length +
		visibleFungibleActivities.length +
		visibleUploadActivities.length +
		visibleMintActivities.length;
	const workingCount =
		visibleActivities.filter((activity) => activity.phase === 'working').length +
		visibleFungibleActivities.filter((activity) => activity.phase === 'working').length +
		visibleUploadActivities.filter((activity) => ['working', 'tracking'].includes(activity.phase)).length +
		visibleMintActivities.filter(
			(activity) => activity.phase !== 'complete' && !mintActivityNeedsAttention(activity)
		).length;
	const clearUploadIssues = () => {
		if (!attentionMintActivities.length) return;
		const count = attentionMintActivities.length;
		if (
			!window.confirm(
				`Clear ${count.toLocaleString()} upload ${
					count === 1 ? 'item' : 'items'
				} that need attention?\n\nThis removes local Activity tracking only. It does not delete anything from Arweave.`
			)
		)
			return;
		removeMintActivities(
			localStorage,
			attentionMintActivities.map((activity) => activity.id)
		);
		setOpen(false);
	};
	React.useEffect(() => {
		if (!open) return;
		const close = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
		};
		window.addEventListener('mousedown', close);
		return () => window.removeEventListener('mousedown', close);
	}, [open]);
	if (!activityCount) return null;
	return (
		<div className="operation-activity-control" ref={containerRef}>
			<Tooltip content="Transaction activity" disabled={open}>
				{(tooltipId) => (
					<Button
						aria-describedby={tooltipId}
						aria-expanded={open}
						aria-label={`Transaction activity, ${activityCount} ${activityCount === 1 ? 'item' : 'items'}`}
						className={`operation-activity-trigger${workingCount ? ' working' : ''}`}
						data-activity-owner="global"
						size="custom"
						onClick={() => setOpen((value) => !value)}
						type="button"
						variant="ghost"
					>
						<Icon icon={InfinityIcon} />
						<span>{activityCount}</span>
					</Button>
				)}
			</Tooltip>
			{open ? (
				<section aria-label="Transaction activity" className="operation-activity-menu">
					<div className="operation-activity-heading">
						<div>
							<strong>Transaction activity</strong>
							<span>
								{attentionMintActivities.length
									? `${attentionMintActivities.length.toLocaleString()} ${
											attentionMintActivities.length === 1 ? 'upload needs' : 'uploads need'
									  } attention`
									: workingCount
									? `${workingCount} running in the background`
									: 'No transactions running'}
							</span>
						</div>
						{attentionMintActivities.length ? (
							<Button size="custom" variant="ghost" onClick={clearUploadIssues} type="button">
								Clear upload issues
							</Button>
						) : null}
					</div>
					<div className="operation-activity-list">
						{visibleUploadActivities.map((activity) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										showUpload(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<span className="operation-activity-symbol" aria-hidden="true">
										{activity.kind === 'collection' ? (
											<Icon icon={Images} size="sm" />
										) : (
											<Icon icon={Upload} size="sm" />
										)}
									</span>
									<span className="operation-activity-copy">
										<strong>{activity.name}</strong>
										<small>
											{activity.kind === 'collection' ? 'Collection upload' : 'Upload'} ·{' '}
											{activity.phase === 'done'
												? 'Complete'
												: activity.phase === 'error'
												? 'Needs attention'
												: 'In progress'}
										</small>
										<span>{activity.status}</span>
									</span>
									<span className="operation-activity-progress">
										{['working', 'tracking'].includes(activity.phase) ? (
											<Icon
												icon={InfinityIcon}
												size="xs"
												className="operation-activity-infinity"
											/>
										) : null}
									</span>
									<Icon icon={ChevronRight} size="sm" className="operation-activity-chevron" />
								</Button>
							</div>
						))}
						{visibleActivities.map((activity) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										show(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<span className="operation-activity-symbol" aria-hidden="true">
										{activity.asset.image ? (
											<ArtworkImage src={activity.asset.image} alt="" />
										) : (
											<span>{activity.asset.name.slice(0, 1)}</span>
										)}
									</span>
									<span className="operation-activity-copy">
										<strong>{activity.asset.name}</strong>
										<small>
											{operationLabel(activity.operation.kind)} ·{' '}
											{operationActivityPhaseLabel(activity.phase)}
										</small>
										<span>{activity.status}</span>
									</span>
									<span className="operation-activity-progress">
										<span
											aria-label={`${activity.confirmations} of ${activity.confirmationTarget} confirmations`}
											className="operation-activity-confirmations"
										>
											{activity.confirmations}/{activity.confirmationTarget}
										</span>
										{activity.phase === 'working' ? (
											<Icon icon={LoaderCircle} size="xs" className="operation-activity-loader" />
										) : null}
									</span>
									<Icon icon={ChevronRight} size="sm" className="operation-activity-chevron" />
								</Button>
							</div>
						))}
						{visibleFungibleActivities.map((activity) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										showFungible(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<TokenAvatar
										className="operation-activity-symbol"
										image={activity.asset.image}
										ticker={activity.asset.ticker ?? activity.asset.name}
									/>
									<span className="operation-activity-copy">
										<strong>{activity.asset.name}</strong>
										<small>
											{operationLabel(activity.operationKind)} ·{' '}
											{operationActivityPhaseLabel(activity.phase)}
										</small>
										<span>{activity.status}</span>
									</span>
									<span className="operation-activity-progress">
										{activity.confirmations !== undefined &&
										activity.confirmationTarget !== undefined ? (
											<span
												aria-label={`${activity.confirmations} of ${activity.confirmationTarget} confirmations`}
												className="operation-activity-confirmations"
											>
												{activity.confirmations}/{activity.confirmationTarget}
											</span>
										) : null}
										{activity.phase === 'working' ? (
											<Icon icon={LoaderCircle} size="xs" className="operation-activity-loader" />
										) : null}
									</span>
									<Icon icon={ChevronRight} size="sm" className="operation-activity-chevron" />
								</Button>
							</div>
						))}
						{visibleMintActivities.map((activity) => {
							const pinnedGateway =
								activity.arweaveGateway !== arweaveGatewayFromLocation() ||
								activity.computeGateway !== gatewayFromLocation();
							const needsAttention = mintActivityNeedsAttention(activity);
							return (
								<div
									className={`operation-activity-item ${needsAttention ? 'error' : 'working'}`}
									key={activity.id}
								>
									<Button
										className="operation-activity-open"
										onClick={() => {
											showMint(activity.id);
											setOpen(false);
										}}
										size="custom"
										type="button"
										variant="ghost"
									>
										<span className="operation-activity-symbol" aria-hidden="true">
											<Icon icon={Upload} size="sm" />
										</span>
										<span className="operation-activity-copy">
											<strong>{activity.asset.name}</strong>
											<small>
												Upload ·{' '}
												{needsAttention
													? 'Needs attention'
													: mintActivityPhaseLabel(activity.phase)}
											</small>
											<span>
												{needsAttention
													? 'This upload has not reached live process state.'
													: activity.status}
												{pinnedGateway ? ' Tracking is pinned to the original gateways.' : ''}
											</span>
										</span>
										{needsAttention ? null : (
											<Icon icon={LoaderCircle} size="xs" className="operation-activity-loader" />
										)}
										<Icon icon={ChevronRight} size="sm" className="operation-activity-chevron" />
									</Button>
								</div>
							);
						})}
					</div>
				</section>
			) : null}
		</div>
	);
}

function operationActivityPhaseLabel(phase: OperationActivityPhase) {
	return {
		form: 'Awaiting signature',
		approval: 'Awaiting approval',
		working: 'In progress',
		done: 'Complete',
		error: 'Needs attention',
	}[phase];
}

function mintActivityPhaseLabel(phase: MintActivity['phase']) {
	return { accepted: 'Accepted', mined: 'Mined', applied: 'Applied', complete: 'Complete' }[phase];
}
