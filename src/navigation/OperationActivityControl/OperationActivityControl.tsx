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
import { Tooltip } from 'components/atoms/Tooltip';
import { isTransactionActivityVisible } from 'components/molecules/TransactionDialogControl';
import { formatMessage } from 'helpers/i18n';
import { useOperationActivityMenu } from 'hooks/useOperationActivityMenu';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { OPERATION_ACTIVITY_CONTROL_MESSAGES, type OperationActivityControlMessages } from './messages';
import * as S from './styles';

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
		<S.Control className="operation-activity-control" ref={containerRef}>
			<Tooltip content={language.operationActivityTitle} disabled={open}>
				{(tooltipId) => (
					<S.Trigger
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
					</S.Trigger>
				)}
			</Tooltip>
			{open ? (
				<S.Menu aria-label={language.operationActivityTitle} className="operation-activity-menu">
					<S.Heading className="operation-activity-heading">
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
					</S.Heading>
					<S.List className="operation-activity-list">
						{menu.uploads.map((activity) => (
							<S.Item className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<S.Open
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										menu.showUpload(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<S.Symbol className="operation-activity-symbol" aria-hidden="true">
										{activity.kind === 'collection' ? (
											<Icon icon={Images} size="sm" />
										) : (
											<Icon icon={Upload} size="sm" />
										)}
									</S.Symbol>
									<S.Copy className="operation-activity-copy">
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
									</S.Copy>
									<S.Progress className="operation-activity-progress">
										{['working', 'tracking'].includes(activity.phase) ? (
											<S.InfinityGlyph
												icon={InfinityIcon}
												size="xs"
												className="operation-activity-infinity"
											/>
										) : null}
									</S.Progress>
									<S.Chevron icon={ChevronRight} size="sm" className="operation-activity-chevron" />
								</S.Open>
							</S.Item>
						))}
						{menu.operations.map(({ activity, operationKind }) => (
							<S.Item className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<S.Open
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										menu.showOperation(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<S.Symbol className="operation-activity-symbol" aria-hidden="true">
										{activity.asset.image ? (
											<ArtworkImage
												src={activity.asset.image}
												alt=""
												unavailableLabel={language.operationActivityArtworkUnavailable}
											/>
										) : (
											<span>{activity.asset.name.slice(0, 1)}</span>
										)}
									</S.Symbol>
									<S.Copy className="operation-activity-copy">
										<strong>{activity.asset.name}</strong>
										<small>
											{formatMessage(language.operationActivityItemMeta, {
												kind: operationActivityKindLabel(operationKind, language),
												phase: operationActivityPhaseLabel(activity.phase, language),
											})}
										</small>
										<span>{operationActivityStatusText(activity.status, language)}</span>
									</S.Copy>
									<S.Progress className="operation-activity-progress">
										<S.Confirmations
											aria-label={formatMessage(language.operationActivityConfirmations, {
												confirmations: activity.confirmations,
												target: activity.confirmationTarget,
											})}
											className="operation-activity-confirmations"
										>
											{activity.confirmations}/{activity.confirmationTarget}
										</S.Confirmations>
										{activity.phase === 'working' ? (
											<Icon icon={LoaderCircle} size="xs" className="operation-activity-loader" />
										) : null}
									</S.Progress>
									<S.Chevron icon={ChevronRight} size="sm" className="operation-activity-chevron" />
								</S.Open>
							</S.Item>
						))}
						{menu.fungibleOperations.map(({ activity, operationKind }) => (
							<S.Item className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<S.Open
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										menu.showFungible(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<S.SymbolAvatar
										className="operation-activity-symbol"
										image={activity.asset.image}
										ticker={activity.asset.ticker ?? activity.asset.name}
									/>
									<S.Copy className="operation-activity-copy">
										<strong>{activity.asset.name}</strong>
										<small>
											{formatMessage(language.operationActivityItemMeta, {
												kind: operationActivityKindLabel(operationKind, language),
												phase: operationActivityPhaseLabel(activity.phase, language),
											})}
										</small>
										<span>{operationActivityStatusText(activity.status, language)}</span>
									</S.Copy>
									<S.Progress className="operation-activity-progress">
										{activity.confirmations !== undefined &&
										activity.confirmationTarget !== undefined ? (
											<S.Confirmations
												aria-label={formatMessage(language.operationActivityConfirmations, {
													confirmations: activity.confirmations,
													target: activity.confirmationTarget,
												})}
												className="operation-activity-confirmations"
											>
												{activity.confirmations}/{activity.confirmationTarget}
											</S.Confirmations>
										) : null}
										{activity.phase === 'working' ? (
											<Icon icon={LoaderCircle} size="xs" className="operation-activity-loader" />
										) : null}
									</S.Progress>
									<S.Chevron icon={ChevronRight} size="sm" className="operation-activity-chevron" />
								</S.Open>
							</S.Item>
						))}
						{menu.mints.map(({ activity, needsAttention, pinnedGateway }) => {
							return (
								<S.Item
									className={`operation-activity-item ${needsAttention ? 'error' : 'working'}`}
									key={activity.id}
								>
									<S.Open
										className="operation-activity-open"
										onClick={() => {
											menu.showMint(activity.id);
											setOpen(false);
										}}
										size="custom"
										type="button"
										variant="ghost"
									>
										<S.Symbol className="operation-activity-symbol" aria-hidden="true">
											<Icon icon={Upload} size="sm" />
										</S.Symbol>
										<S.Copy className="operation-activity-copy">
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
										</S.Copy>
										{needsAttention ? null : (
											<Icon icon={LoaderCircle} size="xs" className="operation-activity-loader" />
										)}
										<S.Chevron
											icon={ChevronRight}
											size="sm"
											className="operation-activity-chevron"
										/>
									</S.Open>
								</S.Item>
							);
						})}
					</S.List>
				</S.Menu>
			) : null}
		</S.Control>
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
