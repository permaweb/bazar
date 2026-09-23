import React from 'react';
import { ChevronRight, Images, InfinityIcon, LoaderCircle, Upload } from 'lucide-react';

import type { MintActivity } from 'api/mint';
import type { OperationActivityPhase } from 'api/operations';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { Tooltip } from 'components/atoms/Tooltip';
import { isTransactionActivityVisible } from 'components/molecules/TransactionDialogControl';
import { useOperationActivityMenu } from 'hooks/useOperationActivityMenu';

export default function OperationActivityControl() {
	const menu = useOperationActivityMenu(isTransactionActivityVisible);
	const [open, setOpen] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const attentionCount = menu.attentionMintIds.length;
	const handleClearUploadIssues = () => {
		if (!attentionCount) return;
		if (
			!window.confirm(
				`Clear ${attentionCount.toLocaleString()} upload ${
					attentionCount === 1 ? 'item' : 'items'
				} that need attention?\n\nThis removes local Activity tracking only. It does not delete anything from Arweave.`
			)
		)
			return;
		menu.clearAttentionMints();
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
	if (!menu.activityCount) return null;
	return (
		<div className="operation-activity-control" ref={containerRef}>
			<Tooltip content="Transaction activity" disabled={open}>
				{(tooltipId) => (
					<Button
						aria-describedby={tooltipId}
						aria-expanded={open}
						aria-label={`Transaction activity, ${menu.activityCount} ${
							menu.activityCount === 1 ? 'item' : 'items'
						}`}
						className={`operation-activity-trigger${menu.workingCount ? ' working' : ''}`}
						data-activity-owner="global"
						size="custom"
						onClick={() => setOpen((value) => !value)}
						type="button"
						variant="ghost"
					>
						<Icon icon={InfinityIcon} />
						<span>{menu.activityCount}</span>
					</Button>
				)}
			</Tooltip>
			{open ? (
				<section aria-label="Transaction activity" className="operation-activity-menu">
					<div className="operation-activity-heading">
						<div>
							<strong>Transaction activity</strong>
							<span>
								{attentionCount
									? `${attentionCount.toLocaleString()} ${
											attentionCount === 1 ? 'upload needs' : 'uploads need'
									  } attention`
									: menu.workingCount
									? `${menu.workingCount} running in the background`
									: 'No transactions running'}
							</span>
						</div>
						{attentionCount ? (
							<Button size="custom" variant="ghost" onClick={handleClearUploadIssues} type="button">
								Clear upload issues
							</Button>
						) : null}
					</div>
					<div className="operation-activity-list">
						{menu.uploads.map((activity) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										menu.showUpload(activity.id);
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
						{menu.operations.map(({ activity, operationLabel }) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										menu.showOperation(activity.id);
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
											{operationLabel} · {operationActivityPhaseLabel(activity.phase)}
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
						{menu.fungibleOperations.map(({ activity, operationLabel }) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										menu.showFungible(activity.id);
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
											{operationLabel} · {operationActivityPhaseLabel(activity.phase)}
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
						{menu.mints.map(({ activity, needsAttention, pinnedGateway }) => {
							return (
								<div
									className={`operation-activity-item ${needsAttention ? 'error' : 'working'}`}
									key={activity.id}
								>
									<Button
										className="operation-activity-open"
										onClick={() => {
											menu.showMint(activity.id);
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
