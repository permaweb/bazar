import React from 'react';
import { ChevronRight, Images, InfinityIcon, LoaderCircle, Upload } from 'lucide-react';

import type { MintActivity, MintActivityPhase } from 'api/mint';
import type {
	Operation,
	OperationActivityPhase,
	OperationActivityStatus,
	OperationRecoveryStatus,
} from 'api/operations';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { Tooltip } from 'components/atoms/Tooltip';
import { isTransactionActivityVisible } from 'components/molecules/TransactionDialogControl';
import { formatMessage } from 'helpers/i18n';
import { useOperationActivityMenu } from 'hooks/useOperationActivityMenu';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { OPERATION_ACTIVITY_CONTROL_MESSAGES, type OperationActivityControlMessages } from './messages';

export default function OperationActivityControl() {
	const language = useMessages(OPERATION_ACTIVITY_CONTROL_MESSAGES);
	const plural = usePlural();
	const menu = useOperationActivityMenu(isTransactionActivityVisible);
	const [open, setOpen] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const attentionCount = menu.attentionMintIds.length;
	const handleClearUploadIssues = () => {
		if (!attentionCount) return;
		if (
			!window.confirm(
				plural(language.operationActivityClearConfirm, attentionCount, {
					count: attentionCount.toLocaleString(),
				})
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
			<Tooltip content={language.operationActivityTitle} disabled={open}>
				{(tooltipId) => (
					<Button
						aria-describedby={tooltipId}
						aria-expanded={open}
						aria-label={plural(language.operationActivityTrigger, menu.activityCount)}
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
				<section aria-label={language.operationActivityTitle} className="operation-activity-menu">
					<div className="operation-activity-heading">
						<div>
							<strong>{language.operationActivityTitle}</strong>
							<span>
								{attentionCount
									? plural(language.operationActivityAttention, attentionCount, {
											count: attentionCount.toLocaleString(),
									  })
									: menu.workingCount
									? formatMessage(language.operationActivityWorking, { count: menu.workingCount })
									: language.operationActivityIdle}
							</span>
						</div>
						{attentionCount ? (
							<Button size="custom" variant="ghost" onClick={handleClearUploadIssues} type="button">
								{language.operationActivityClearIssues}
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
											{formatMessage(language.operationActivityItemMeta, {
												kind:
													activity.kind === 'collection'
														? language.operationActivityCollectionUpload
														: language.operationActivityUpload,
												phase:
													activity.phase === 'done'
														? language.operationActivityUploadComplete
														: activity.phase === 'error'
														? language.operationActivityUploadAttention
														: language.operationActivityUploadWorking,
											})}
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
						{menu.operations.map(({ activity, operationKind }) => (
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
											<ArtworkImage
												src={activity.asset.image}
												alt=""
												unavailableLabel={language.operationActivityArtworkUnavailable}
											/>
										) : (
											<span>{activity.asset.name.slice(0, 1)}</span>
										)}
									</span>
									<span className="operation-activity-copy">
										<strong>{activity.asset.name}</strong>
										<small>
											{formatMessage(language.operationActivityItemMeta, {
												kind: operationActivityKindLabel(operationKind, language),
												phase: operationActivityPhaseLabel(activity.phase, language),
											})}
										</small>
										<span>{operationActivityStatusText(activity.status, language)}</span>
									</span>
									<span className="operation-activity-progress">
										<span
											aria-label={formatMessage(language.operationActivityConfirmations, {
												confirmations: activity.confirmations,
												target: activity.confirmationTarget,
											})}
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
						{menu.fungibleOperations.map(({ activity, operationKind }) => (
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
											{formatMessage(language.operationActivityItemMeta, {
												kind: operationActivityKindLabel(operationKind, language),
												phase: operationActivityPhaseLabel(activity.phase, language),
											})}
										</small>
										<span>{operationActivityStatusText(activity.status, language)}</span>
									</span>
									<span className="operation-activity-progress">
										{activity.confirmations !== undefined &&
										activity.confirmationTarget !== undefined ? (
											<span
												aria-label={formatMessage(language.operationActivityConfirmations, {
													confirmations: activity.confirmations,
													target: activity.confirmationTarget,
												})}
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
												{formatMessage(language.operationActivityItemMeta, {
													kind: language.operationActivityUpload,
													phase: needsAttention
														? language.operationActivityUploadAttention
														: mintActivityPhaseLabel(activity.phase, language),
												})}
											</small>
											<span>
												{mintActivityStatus(
													needsAttention,
													activity.phase,
													pinnedGateway,
													language
												)}
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

function operationActivityKindLabel(kind: Operation['kind'], language: OperationActivityControlMessages) {
	return {
		sell: language.operationKindSell,
		buy: language.operationKindBuy,
		cancel: language.operationKindCancel,
		transfer: language.operationKindTransfer,
	}[kind];
}

function operationActivityPhaseLabel(phase: OperationActivityPhase, language: OperationActivityControlMessages) {
	return {
		form: language.operationPhaseForm,
		approval: language.operationPhaseApproval,
		working: language.operationPhaseWorking,
		done: language.operationPhaseDone,
		error: language.operationPhaseError,
	}[phase];
}

function mintActivityPhaseLabel(phase: MintActivity['phase'], language: OperationActivityControlMessages) {
	return {
		accepted: language.mintPhaseAccepted,
		mined: language.mintPhaseMined,
		applied: language.mintPhaseApplied,
		complete: language.mintPhaseComplete,
	}[phase];
}

const MINT_STATUS_KEYS: Record<MintActivityPhase, keyof OperationActivityControlMessages> = {
	accepted: 'mintStatusAccepted',
	mined: 'mintStatusMined',
	applied: 'mintStatusApplied',
	complete: 'mintStatusComplete',
};

const RECOVERY_STATUS_KEYS: Record<OperationRecoveryStatus, keyof OperationActivityControlMessages> = {
	'resume-saved-purchase': 'recoveryStatusResumeSavedPurchase',
	'resume-signed-transaction': 'recoveryStatusResumeSignedTransaction',
	'resuming-purchase': 'recoveryStatusResumingPurchase',
	'resuming-signed-transaction': 'recoveryStatusResumingSignedTransaction',
};

/** The adapter's recovery code as copy, or the status text the operation dialog already resolved. */
function operationActivityStatusText(status: OperationActivityStatus, language: OperationActivityControlMessages) {
	return 'code' in status ? (language[RECOVERY_STATUS_KEYS[status.code]] as string) : status.text;
}

/** An upload that never reached live state explains itself; a pinned tracker adds that note to either status. */
function mintActivityStatus(
	needsAttention: boolean,
	phase: MintActivityPhase,
	pinnedGateway: boolean,
	language: OperationActivityControlMessages
) {
	const current = needsAttention
		? language.operationActivityMintUnsettled
		: (language[MINT_STATUS_KEYS[phase]] as string);
	return pinnedGateway ? formatMessage(language.operationActivityMintPinnedGateway, { status: current }) : current;
}
