import type { ArweaveAcceptedProof } from 'api/arweave-mining-telemetry';
import { ARWEAVE_OBSERVER_RESPONSE_EVENT, type ArweaveObserverResponseDetail } from 'api/arweave-observers';
import React from 'react';
import { type Observer, type ObserverView, type PurchaseTransaction } from 'weave-wrangler';

import { TxAddress } from 'components/atoms/TxAddress';
import {
	elapsedLabel,
	MAX_VISIBLE_MINOR_EVENT_MARKERS,
	minorEventMarkerPositions,
	phaseIsComplete,
	type RaceTimelineEvent,
	timelineLayout,
	transitionKey,
} from './raceTimeline';
import * as S from './styles';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { type ObserverTooltipStage } from './ObserverTooltipCard';
import { confirmationProgress } from './progressColors';
import { quorumConfirmationDepth } from './confirmationDepth';
import { confirmationLifecycleState, sequencePhaseBounds } from './sequence';
import type { CableTelemetry, Infinity3DLane } from './TransactionSequenceCable3D';
import { TransactionRendererFallback, TransactionVisualizerBoundary } from './TransactionVisualizerFallback';
import { type ArweaveMiningTelemetry, useArweaveMiningTelemetry } from './useArweaveMiningTelemetry';

const TransactionSequenceCable3D = React.lazy(async () => {
	const module = await import('./TransactionSequenceCable3D');
	return { default: module.TransactionSequenceCable3D };
});

const CableTelemetryPanel = React.lazy(async () => {
	const module = await import('./TransactionSequenceCable3D');
	return { default: module.CableTelemetryPanel };
});

const MAX_PROOFS_PER_LANE = 320;
const RECENT_PROOF_CANDIDATE_MULTIPLIER = 2;
const RACE_CLOCK_INTERVAL_MS = 250;
const LIVE_RESPONSE_BATCH_MS = 50;

type LaneEvent = RaceTimelineEvent & {
	nodeHeight?: number;
	latency?: number;
};

type LaneProof = {
	observedAt: number;
	state: ObserverView['state'];
	confirmations: number;
	latency?: number;
	httpStatus?: number;
	blockId?: string;
	blockHeight?: number;
	nodeHeight?: number;
};

type LaneHistory = {
	observer: ObserverView['observer'];
	events: LaneEvent[];
	proofs: LaneProof[];
	observedAt: number;
};

export type Timeline = {
	transactionId: string;
	lanes: LaneHistory[];
};

type LiveObserverResponseStore = {
	key: string;
	viewsByTransaction: Map<string, Map<string, ObserverView>>;
};

export type ArweaveSyncTransaction = Pick<PurchaseTransaction, 'id' | 'views'> & {
	consensus?: PurchaseTransaction['consensus'];
};

export type ArweaveSyncStep = {
	key: string;
	label: string;
	transaction?: ArweaveSyncTransaction;
	target: number;
	confirmations?: number;
	hasError?: boolean;
};

type Props = {
	subject: string;
	steps: ArweaveSyncStep[];
	startedAt?: number;
	skipKind?: 'yolo' | 'skip';
	onSkip?: () => void;
	activeStep?: string;
	active?: boolean;
	pendingAfterConfirmation?: string;
	onProgressChange?: (progress: number) => void;
};

export function ArweaveTransactionSync({
	subject,
	steps,
	startedAt,
	skipKind,
	onSkip,
	activeStep,
	active: renderActive = true,
	pendingAfterConfirmation,
	onProgressChange,
}: Props) {
	const language = useLanguageProvider().strings;
	const skipTooltipId = React.useId();
	const active = steps.find((step) => step.key === activeStep) ?? steps[0];
	const activeKey = active?.key;
	const transaction = active?.transaction;
	const confirmationDepth = quorumConfirmationDepth(active);
	const target = active?.target ?? 0;
	const lifecycle = confirmationLifecycleState(
		confirmationDepth,
		target,
		pendingAfterConfirmation,
		Boolean(active?.hasError),
	);
	const displayedConfirmationDepth = lifecycle.depth;
	const transactionState = transaction?.consensus?.state ?? latestObserverState(transaction?.views ?? []);
	const progressKey = `${transaction?.id ?? 'none'}:${active?.key ?? 'none'}`;
	const [estimatedProgress, setEstimatedProgress] = React.useState({ key: progressKey, value: 0 });
	const confirmedProgress = target > 0 ? (confirmationDepth / target) * 100 : 0;
	const progressActive = Boolean(transaction) && lifecycle.active;
	const continuousProgress =
		estimatedProgress.key === progressKey ? Math.max(confirmedProgress, estimatedProgress.value) : confirmedProgress;
	const displayedProgress = Math.min(progressActive ? 99 : 100, Math.max(progressActive ? 2 : 0, continuousProgress));
	const observedSteps = useLiveObserverResponses(steps);
	const telemetrySessionKey = transactionSyncSessionKey(observedSteps);
	const telemetrySessionRef = React.useRef({ key: telemetrySessionKey, startedAt: startedAt ?? Date.now() });
	if (
		telemetrySessionRef.current.key !== telemetrySessionKey ||
		(startedAt !== undefined && telemetrySessionRef.current.startedAt !== startedAt)
	) {
		telemetrySessionRef.current = { key: telemetrySessionKey, startedAt: startedAt ?? Date.now() };
	}
	const timelines = useObserverTimelines(observedSteps);
	const lanes = React.useMemo(() => mergeRaceLanes(observedSteps, timelines), [observedSteps, timelines]);
	const raceActive = lanes.some((lane) =>
		observedSteps.some(
			(step) => step.transaction && !phaseIsComplete(latestLaneEvent(lane.phases.get(step.key)), step.target),
		),
	);
	const liveAt = useRaceClock(renderActive && raceActive);
	const protocolTelemetry = useProtocolTelemetry(
		observedSteps,
		activeKey,
		liveAt,
		telemetrySessionKey,
		telemetrySessionRef.current.startedAt,
	);
	const miningTelemetry = useArweaveMiningTelemetry(
		renderActive && lanes.length > 0,
		telemetrySessionKey,
		telemetrySessionRef.current.startedAt,
	);
	const acceptedProofs = miningTelemetry.acceptedProofs;
	const cableLanes = React.useMemo(
		() => lanes.map((lane) => infinity3DLane(lane, observedSteps, liveAt, true, language)),
		[language, lanes, liveAt, observedSteps],
	);
	const activePhaseProgress = React.useMemo(() => {
		const activeIndex = observedSteps.findIndex((step) => step.key === activeKey);
		if (activeIndex < 0 || !cableLanes.length) return undefined;
		const bounds = sequencePhaseBounds(activeIndex, observedSteps.length);
		const phaseSize = bounds.end - bounds.start;
		const values = cableLanes
			.map((lane) => (((lane.phases[activeIndex]?.progress ?? bounds.start) - bounds.start) / phaseSize) * 100)
			.map((progress) => Math.min(100, Math.max(0, progress)))
			.sort((left, right) => left - right);
		const middle = Math.floor(values.length / 2);
		return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
	}, [activeKey, cableLanes, observedSteps]);

	React.useEffect(() => {
		if (activePhaseProgress === undefined) return;
		setEstimatedProgress((current) => {
			const next = Math.max(confirmedProgress, activePhaseProgress);
			if (current.key === progressKey && Math.abs(current.value - next) < 0.02) return current;
			return { key: progressKey, value: next };
		});
		onProgressChange?.(activePhaseProgress);
	}, [activePhaseProgress, confirmedProgress, onProgressChange, progressKey]);

	const telemetry: CableTelemetry = {
		heading: language.transactionSyncProtocolTelemetry,
		liveLabel: language.transactionSyncProtocolLive,
		metrics: protocolMetrics(protocolTelemetry, language),
		activityLabel: language.transactionSyncProtocolRecent,
		activity: [
			...acceptedProofs.map((proof) => ({
				key: proof.key,
				label: language.transactionSyncMiningBlockLabel.replace('{height}', proof.height.toLocaleString()),
				detail: miningProofDetail(proof, language),
				kind: 'proof' as const,
				typeLabel: language.transactionSyncActivityProof,
				observedAt: proof.observedAt,
			})),
			...protocolTelemetry.recent.map((event) => ({
				key: event.key,
				label: event.observer,
				detail: protocolActivityDetail(event, language),
				kind: event.kind,
				typeLabel:
					event.kind === 'confirmation'
						? language.transactionSyncActivityConfirmation
						: event.kind === 'error'
							? language.transactionSyncActivityError
							: language.transactionSyncActivityStatus,
				observedAt: event.observedAt,
			})),
		]
			.sort((left, right) => right.observedAt - left.observedAt)
			.map(({ observedAt: _observedAt, ...event }) => event),
		mining: {
			heading: language.transactionSyncMiningTelemetry,
			status: miningStatus(miningTelemetry, language),
			metrics: [
				{
					label: language.transactionSyncMiningAverage,
					value: formatCandidateRate(miningTelemetry.averageCandidateRate, language),
				},
				{
					label: language.transactionSyncMiningDiskRate,
					value: formatBytes(miningTelemetry.averageDiskReadRate, language, true),
				},
				{
					label: language.transactionSyncMiningCandidateTotal,
					value: formatCandidateRate(miningTelemetry.candidatesSinceStart, language),
				},
				{
					label: language.transactionSyncMiningDiskTotal,
					value: formatBytes(miningTelemetry.bytesReadSinceStart, language),
				},
				{ label: language.transactionSyncMiningAccepted, value: String(acceptedProofs.length) },
			],
		},
	};

	return (
		<>
			{transaction && (
				<>
					<S.TransactionHeader>
						<div>
							<span>{language.transaction}</span>
							<TxAddress address={transaction.id} wrap={false} tooltipPosition={'right'} />
						</div>
						<S.Depth
							aria-label={lifecycle.pending ? pendingAfterConfirmation : `${displayedConfirmationDepth} of ${target}`}
							$success={lifecycle.complete}
						>
							{lifecycle.pending ? (
								<strong>{pendingAfterConfirmation}</strong>
							) : (
								<>
									<strong>{displayedConfirmationDepth}</strong>
									<span> / {target}</span>
								</>
							)}
						</S.Depth>
					</S.TransactionHeader>
					<S.ProgressTrack
						$active={progressActive}
						$progress={displayedProgress}
						$state={transactionState}
						$confirmations={confirmationDepth}
						$hasError={Boolean(active.hasError)}
					>
						<span style={{ width: `${displayedProgress}%` }} />
					</S.ProgressTrack>
					{confirmationDepth >= 2 && <S.RiskNote>{localizedRisk(confirmationDepth, language)}</S.RiskNote>}
					{skipKind && onSkip ? (
						<S.SkipAction $warning={skipKind === 'yolo'}>
							<span>
								<strong>
									{skipKind === 'yolo'
										? language.transactionSyncYoloTitle
										: language.transactionSyncSkipTitle.replace('{depth}', String(confirmationDepth))}
								</strong>
								<small>
									{skipKind === 'yolo' ? language.transactionSyncYoloDetail : language.transactionSyncSkipDetail}
								</small>
							</span>
							<S.SkipButtonWrap>
								<button aria-describedby={skipTooltipId} onClick={onSkip} type="button">
									{skipKind === 'yolo' ? language.transactionSyncYolo : language.transactionSyncSkip}
								</button>
								<S.SkipTooltip id={skipTooltipId} role="tooltip">
									{language.transactionSyncSkipTooltip}
								</S.SkipTooltip>
							</S.SkipButtonWrap>
						</S.SkipAction>
					) : null}
				</>
			)}
			{lanes.length > 0 && (
				<TransactionVisualizerBoundary
					fallback={
						<S.RaceShell $height={320} $embedded={false}>
							<TransactionRendererFallback lanes={cableLanes} />
						</S.RaceShell>
					}
					resetKey={transaction?.id ?? subject}
				>
					<>
						<S.RaceShell $height={320} $embedded={false}>
							<React.Suspense fallback={<TransactionRendererFallback lanes={cableLanes} />}>
								<TransactionSequenceCable3D
									lanes={cableLanes}
									ariaLabel={`${language.transactionSyncRacePrototypeInfinityCable}: ${subject}`}
									active={renderActive}
									layout={'bundle'}
									phaseLabels={observedSteps.map((step) => step.label)}
									miningActivity={{
										candidateRate: miningTelemetry.candidateRate,
										acceptedProofs: acceptedProofs.map((proof) => ({
											key: proof.key,
											height: proof.height,
											observedAt: proof.observedAt,
											label: language.transactionSyncMiningBlockLabel.replace(
												'{height}',
												proof.height.toLocaleString(),
											),
											meta: miningProofPinMeta(proof, language),
											recalls: proof.recallSamples.map((sample) => ({
												key: `${proof.key}:${sample.index}`,
												content: sample.content,
												fallback: language.transactionSyncMiningPinOffset.replace(
													'{offset}',
													sample.offset.toLocaleString(),
												),
												contentLabel: recallContentLabel(sample.content, language),
												meta: miningRecallPinMeta(proof, sample, language),
											})),
										})),
									}}
								/>
							</React.Suspense>
						</S.RaceShell>
						<React.Suspense fallback={null}>
							<CableTelemetryPanel telemetry={telemetry} />
						</React.Suspense>
					</>
				</TransactionVisualizerBoundary>
			)}
		</>
	);
}

function useRaceClock(active: boolean): number {
	const [now, setNow] = React.useState(() => Date.now());

	React.useEffect(() => {
		if (!active) return undefined;
		let interval: number | undefined;
		const stop = () => {
			if (interval !== undefined) window.clearInterval(interval);
			interval = undefined;
		};
		const start = () => {
			stop();
			if (document.hidden) return;
			setNow(Date.now());
			interval = window.setInterval(() => setNow(Date.now()), RACE_CLOCK_INTERVAL_MS);
		};

		start();
		document.addEventListener('visibilitychange', start);
		return () => {
			stop();
			document.removeEventListener('visibilitychange', start);
		};
	}, [active]);

	return now;
}

export function observedConfirmationDepth(views: ObserverView[]): number {
	const depths = views
		.filter((view) => view.state === 'confirmed')
		.map((view) => view.confirmations)
		.sort((left, right) => left - right);
	if (!depths.length) return 0;
	return depths[Math.floor((depths.length - 1) / 2)];
}

function latestObserverState(views: ObserverView[]): ObserverView['state'] {
	let latest: ObserverView | undefined;
	for (const view of views) {
		if (!latest || view.updatedAt > latest.updatedAt) latest = view;
	}
	return latest?.state ?? 'unknown';
}

function localizedRisk(depth: number, language: any): string {
	if (depth === 2) return language.transactionSyncForkDaily;
	if (depth === 3) return language.transactionSyncForkMonthly;
	return language.transactionSyncForkTwoYears;
}

function useLiveObserverResponses(steps: ArweaveSyncStep[]): ArweaveSyncStep[] {
	const key = steps.map((step) => `${step.key}:${step.transaction?.id ?? ''}`).join('|');
	const storeRef = React.useRef<LiveObserverResponseStore>({ key, viewsByTransaction: new Map() });
	const [version, setVersion] = React.useState(0);
	if (storeRef.current.key !== key) {
		storeRef.current = { key, viewsByTransaction: new Map() };
	}

	React.useEffect(() => {
		const transactionIds = new Set(steps.flatMap((step) => (step.transaction ? [step.transaction.id] : [])));
		let flushTimer: number | undefined;
		const scheduleRender = () => {
			if (flushTimer !== undefined) return;
			flushTimer = window.setTimeout(() => {
				flushTimer = undefined;
				setVersion((current) => current + 1);
			}, LIVE_RESPONSE_BATCH_MS);
		};
		const handleResponse = (event: Event) => {
			const detail = (event as CustomEvent<ArweaveObserverResponseDetail>).detail;
			if (!detail || !transactionIds.has(detail.transactionId)) return;
			const transactionViews = storeRef.current.viewsByTransaction.get(detail.transactionId) ?? new Map();
			const previous = transactionViews.get(detail.observer.url);
			const view = observerViewFromResponse(detail, previous);
			if (!view) return;
			transactionViews.set(detail.observer.url, view);
			storeRef.current.viewsByTransaction.set(detail.transactionId, transactionViews);
			scheduleRender();
		};

		window.addEventListener(ARWEAVE_OBSERVER_RESPONSE_EVENT, handleResponse);
		return () => {
			window.removeEventListener(ARWEAVE_OBSERVER_RESPONSE_EVENT, handleResponse);
			if (flushTimer !== undefined) window.clearTimeout(flushTimer);
		};
	}, [key]);

	return React.useMemo(
		() =>
			steps.map((step) => ({
				...step,
				transaction: mergeLiveObserverViews(step.transaction, storeRef.current.viewsByTransaction),
			})),
		[steps, version],
	);
}

function mergeLiveObserverViews(
	transaction: ArweaveSyncTransaction | undefined,
	viewsByTransaction: LiveObserverResponseStore['viewsByTransaction'],
): ArweaveSyncTransaction | undefined {
	if (!transaction) return undefined;
	const merged = new Map(transaction.views.map((view) => [view.observer.url, view]));
	for (const view of viewsByTransaction.get(transaction.id)?.values() ?? []) {
		const existing = merged.get(view.observer.url);
		if (!existing || view.updatedAt >= existing.updatedAt) merged.set(view.observer.url, view);
	}
	return { ...transaction, views: [...merged.values()] };
}

function observerViewFromResponse(
	detail: ArweaveObserverResponseDetail,
	previous: ObserverView | undefined,
): ObserverView | undefined {
	let state: ObserverView['state'];
	let confirmations = 0;
	let blockId: string | undefined;
	let blockHeight: number | undefined;
	if (detail.status === 404) state = 'not-found';
	else if (detail.status === 202) state = 'pending';
	else if (detail.status === 200 && detail.body && typeof detail.body === 'object') {
		const body = detail.body as Record<string, unknown>;
		confirmations = Number(body.number_of_confirmations);
		blockId = typeof body.block_indep_hash === 'string' ? body.block_indep_hash : undefined;
		blockHeight = Number(body.block_height);
		if (!Number.isSafeInteger(confirmations) || confirmations < 1 || !blockId) return undefined;
		if (!Number.isSafeInteger(blockHeight) || blockHeight < 0) blockHeight = undefined;
		state = 'confirmed';
	} else {
		return undefined;
	}

	const changed =
		!previous ||
		previous.state !== state ||
		previous.confirmations !== confirmations ||
		previous.blockId !== blockId ||
		previous.blockHeight !== blockHeight;
	return {
		observer: detail.observer,
		state,
		confirmations,
		...(blockId === undefined ? {} : { blockId }),
		...(blockHeight === undefined ? {} : { blockHeight }),
		...(detail.observer.height === undefined ? {} : { nodeHeight: detail.observer.height }),
		updatedAt: detail.observedAt,
		lastSeenAt: detail.observedAt,
		changedAt: changed ? detail.observedAt : previous.changedAt,
		httpStatus: detail.status,
		latency: detail.latency,
	};
}

type ProtocolActivity = {
	key: string;
	observedAt: number;
	kind: 'status' | 'confirmation' | 'error';
	phase: string;
	phaseLabel: string;
	observer: string;
	state: ObserverView['state'];
	confirmations: number;
	httpStatus?: number;
	latency?: number;
	nodeHeight?: number;
	blockHeight?: number;
};

type ProtocolTelemetry = {
	responses: number;
	responsesPerSecond: number;
	observers: number;
	answering: number;
	agreeing: number;
	eligible: number;
	stateChanges: number;
	confirmationEvents: number;
	phaseLabel: string;
	latestResponseAge: number;
	recent: ProtocolActivity[];
};

type ProtocolTelemetryTracker = {
	key: string;
	startedAt: number;
	latestResponseAt: Map<string, number>;
	latestState: Map<string, ObserverView['state']>;
	latestConfirmations: Map<string, number>;
};

function useProtocolTelemetry(
	steps: ArweaveSyncStep[],
	activeStep: string | undefined,
	now: number,
	sessionKey: string,
	sessionStartedAt: number,
): ProtocolTelemetry {
	const trackerRef = React.useRef<ProtocolTelemetryTracker>({
		key: sessionKey,
		startedAt: sessionStartedAt,
		latestResponseAt: new Map(),
		latestState: new Map(),
		latestConfirmations: new Map(),
	});
	const [responses, setResponses] = React.useState(0);
	const [stateChanges, setStateChanges] = React.useState(0);
	const [confirmationEvents, setConfirmationEvents] = React.useState(0);
	const [recent, setRecent] = React.useState<ProtocolActivity[]>([]);

	React.useEffect(() => {
		let tracker = trackerRef.current;
		const reset = tracker.key !== sessionKey;
		if (reset) {
			tracker = {
				key: sessionKey,
				startedAt: sessionStartedAt,
				latestResponseAt: new Map(),
				latestState: new Map(),
				latestConfirmations: new Map(),
			};
			trackerRef.current = tracker;
		}

		const additions: ProtocolActivity[] = [];
		let responseCount = 0;
		let addedStateChanges = 0;
		let addedConfirmationEvents = 0;
		const collect = (step: ArweaveSyncStep) => {
			for (const view of step.transaction?.views ?? []) {
				if (view.lastSeenAt === undefined) continue;
				const observerKey = `${step.key}:${view.observer.url}`;
				const previousResponseAt = tracker.latestResponseAt.get(observerKey) ?? 0;
				if (view.lastSeenAt <= previousResponseAt) continue;
				responseCount += 1;
				const previousState = tracker.latestState.get(observerKey);
				const previousConfirmations = tracker.latestConfirmations.get(observerKey) ?? 0;
				const stateChanged = previousState !== undefined && previousState !== view.state;
				const confirmationsAdded = Math.max(0, view.confirmations - previousConfirmations);
				if (!reset && stateChanged) addedStateChanges += 1;
				addedConfirmationEvents += confirmationsAdded;
				tracker.latestResponseAt.set(observerKey, view.lastSeenAt);
				tracker.latestState.set(observerKey, view.state);
				tracker.latestConfirmations.set(observerKey, view.confirmations);
				if (previousState !== undefined && !stateChanged && confirmationsAdded === 0 && !view.error) continue;
				additions.push({
					key: `${observerKey}:${view.lastSeenAt}`,
					observedAt: view.lastSeenAt,
					kind: view.error ? 'error' : confirmationsAdded > 0 ? 'confirmation' : 'status',
					phase: step.key,
					phaseLabel: step.label,
					observer: view.observer.label,
					state: view.state,
					confirmations: view.confirmations,
					...(view.httpStatus === undefined ? {} : { httpStatus: view.httpStatus }),
					...(view.latency === undefined ? {} : { latency: view.latency }),
					...(view.nodeHeight === undefined ? {} : { nodeHeight: view.nodeHeight }),
					...(view.blockHeight === undefined ? {} : { blockHeight: view.blockHeight }),
				});
			}
		};
		steps.forEach(collect);
		if (reset) {
			setResponses(responseCount);
			setStateChanges(0);
			setConfirmationEvents(addedConfirmationEvents);
			setRecent(additions.slice(-10).reverse());
		} else if (responseCount > 0) {
			setResponses((current) => current + responseCount);
			setStateChanges((current) => current + addedStateChanges);
			setConfirmationEvents((current) => current + addedConfirmationEvents);
			if (additions.length > 0) setRecent((current) => [...additions.reverse(), ...current].slice(0, 10));
		}
	}, [sessionKey, sessionStartedAt, steps]);

	const startedAt = trackerRef.current.key === sessionKey ? trackerRef.current.startedAt : sessionStartedAt;
	const elapsedSeconds = Math.max(1, (now - startedAt) / 1_000);
	const active =
		steps.find((step) => step.key === activeStep) ??
		[...steps].reverse().find((step) => step.transaction?.views.length) ??
		steps[0];
	const views = active?.transaction?.views ?? [];
	const consensus = active?.transaction?.consensus;
	const observers = new Map<string, Observer>();
	for (const step of steps) {
		for (const view of step.transaction?.views ?? []) observers.set(view.observer.url, view.observer);
	}
	const latestResponseAt = Math.max(0, ...trackerRef.current.latestResponseAt.values());

	return {
		responses,
		responsesPerSecond: responses / elapsedSeconds,
		observers: observers.size,
		answering: consensus?.answering ?? views.filter((view) => view.lastSeenAt !== undefined).length,
		agreeing: consensus?.agreeing ?? 0,
		eligible: consensus?.eligible ?? 0,
		stateChanges,
		confirmationEvents,
		phaseLabel: active?.label ?? '',
		latestResponseAge: latestResponseAt ? Math.max(0, (now - latestResponseAt) / 1_000) : 0,
		recent,
	};
}

function protocolMetrics(telemetry: ProtocolTelemetry, language: any): Array<{ label: string; value: string }> {
	return [
		{ label: language.transactionSyncProtocolResponseRate, value: telemetry.responsesPerSecond.toFixed(2) },
		{ label: language.transactionSyncProtocolResponses, value: telemetry.responses.toLocaleString() },
		{ label: language.transactionSyncProtocolObservers, value: `${telemetry.answering}/${telemetry.observers}` },
		{
			label: language.transactionSyncProtocolAgreement,
			value: telemetry.eligible
				? `${telemetry.agreeing}/${telemetry.eligible}`
				: language.transactionSyncProtocolUnknown,
		},
		{ label: language.transactionSyncProtocolStateChanges, value: telemetry.stateChanges.toLocaleString() },
		{
			label: language.transactionSyncProtocolConfirmationEvents,
			value: telemetry.confirmationEvents.toLocaleString(),
		},
		{
			label: language.transactionSyncProtocolPhase,
			value: telemetry.phaseLabel,
		},
		{
			label: language.transactionSyncProtocolLatestResponse,
			value: language.transactionSyncProtocolSecondsAgo.replace('{seconds}', telemetry.latestResponseAge.toFixed(1)),
		},
	];
}

function formatCandidateRate(value: number | undefined, language: any): string {
	if (value === undefined) return language.transactionSyncProtocolUnknown;
	return value.toLocaleString(undefined, {
		notation: value >= 1_000_000 ? 'compact' : 'standard',
		maximumFractionDigits: value >= 1_000_000 ? 2 : value >= 100 ? 0 : 1,
	});
}

function formatBytes(value: number | undefined, language: any, perSecond = false): string {
	if (value === undefined) return language.transactionSyncProtocolUnknown;
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
	let formatted = Math.max(0, value);
	let unit = 0;
	while (formatted >= 1024 && unit < units.length - 1) {
		formatted /= 1024;
		unit += 1;
	}
	return `${formatted.toLocaleString(undefined, {
		maximumFractionDigits: formatted >= 100 ? 0 : formatted >= 10 ? 1 : 2,
	})} ${units[unit]}${perSecond ? '/s' : ''}`;
}

function recallContentLabel(content: ArweaveAcceptedProof['recallSamples'][number]['content'], language: any): string {
	const type = content?.contentType?.split(';', 1)[0] ?? language.transactionSyncMiningContentData;
	return content?.contentLength === undefined ? type : `${type} · ${formatBytes(content.contentLength, language)}`;
}

function miningStatus(telemetry: ArweaveMiningTelemetry, language: any): string {
	if (!telemetry.checked) return language.transactionSyncMiningChecking;
	if (!telemetry.available) return language.transactionSyncMiningUnavailable;
	return language.transactionSyncMiningSource.replace('{source}', telemetry.sourceLabel);
}

function miningProofDetail(proof: ArweaveAcceptedProof, language: any): string {
	const acceptedProofBytes = proof.recallSamples.reduce((total, sample) => total + (sample.packedBytes ?? 0), 0);
	const summary = language.transactionSyncMiningProofDetail
		.replace('{height}', proof.height.toLocaleString())
		.replace('{proofs}', String(proof.proofCount))
		.replace(
			'{proofBytes}',
			acceptedProofBytes ? formatBytes(acceptedProofBytes, language) : language.transactionSyncProtocolUnknown,
		)
		.replace(
			'{step}',
			proof.vdfStep === undefined ? language.transactionSyncProtocolUnknown : proof.vdfStep.toLocaleString(),
		)
		.replace('{transactions}', proof.transactionCount.toLocaleString());
	const recalls = proof.recallSamples.flatMap((sample) => {
		const age =
			proof.timestamp === undefined || sample.sourceTimestamp === undefined
				? language.transactionSyncMiningDataUnknown
				: durationLabel(Math.max(0, proof.timestamp - sample.sourceTimestamp), language);
		const detail = language.transactionSyncMiningRecallDetail
			.replace('{index}', String(sample.index))
			.replace('{offset}', sample.offset.toLocaleString())
			.replace('{age}', age)
			.replace(
				'{sourceHeight}',
				sample.sourceHeight === undefined
					? language.transactionSyncProtocolUnknown
					: sample.sourceHeight.toLocaleString(),
			)
			.replace(
				'{dataBytes}',
				sample.unpackedBytes === undefined
					? language.transactionSyncProtocolUnknown
					: formatBytes(sample.unpackedBytes, language),
			);
		return [detail];
	});
	return [summary, ...recalls].join('\n');
}

function miningProofPinMeta(proof: ArweaveAcceptedProof, language: any): string {
	const acceptedProofBytes = proof.recallSamples.reduce((total, sample) => total + (sample.packedBytes ?? 0), 0);
	return language.transactionSyncMiningPinProofMeta
		.replace('{proofs}', String(proof.proofCount))
		.replace(
			'{proofBytes}',
			acceptedProofBytes ? formatBytes(acceptedProofBytes, language) : language.transactionSyncProtocolUnknown,
		)
		.replace(
			'{step}',
			proof.vdfStep === undefined ? language.transactionSyncProtocolUnknown : proof.vdfStep.toLocaleString(),
		);
}

function miningRecallPinMeta(
	proof: ArweaveAcceptedProof,
	sample: ArweaveAcceptedProof['recallSamples'][number],
	language: any,
): string | undefined {
	if (sample.sourceHeight === undefined) return undefined;
	const age =
		proof.timestamp === undefined || sample.sourceTimestamp === undefined
			? language.transactionSyncMiningDataUnknown
			: durationLabel(Math.max(0, proof.timestamp - sample.sourceTimestamp), language);
	return language.transactionSyncMiningPinRecallMeta
		.replace('{age}', age)
		.replace('{height}', sample.sourceHeight.toLocaleString());
}

function durationLabel(seconds: number, language: any): string {
	const day = 24 * 60 * 60;
	const year = 365.25 * day;
	if (seconds >= year) {
		return language.transactionSyncMiningAgeYears.replace('{value}', (seconds / year).toFixed(1));
	}
	if (seconds >= day) {
		return language.transactionSyncMiningAgeDays.replace('{value}', Math.round(seconds / day).toLocaleString());
	}
	return language.transactionSyncMiningAgeHours.replace(
		'{value}',
		Math.max(1, Math.round(seconds / 3600)).toLocaleString(),
	);
}

export function protocolActivityDetail(event: ProtocolActivity, language: any): string {
	const unknown = language.transactionSyncProtocolUnknown;
	const status = event.httpStatus ?? protocolStatusForState(event.state) ?? unknown;
	const latency = event.latency === undefined ? unknown : String(Math.max(0, Math.round(event.latency)));
	const height = event.nodeHeight ?? event.blockHeight;
	return language.transactionSyncProtocolActivity
		.replace('{phase}', event.phaseLabel)
		.replace('{state}', protocolActivityState(event, language))
		.replace('{status}', String(status))
		.replace('{latency}', latency)
		.replace('{height}', height === undefined ? unknown : height.toLocaleString())
		.replace('{depth}', String(event.confirmations));
}

function protocolActivityState(event: ProtocolActivity, language: any): string {
	if (event.kind === 'error') return language.transactionSyncProtocolStateError;
	if (event.state === 'not-found') return language.transactionSyncProtocolStateNotFound;
	if (event.state === 'pending') return language.transactionSyncProtocolStatePending;
	if (event.state === 'confirmed') return language.transactionSyncProtocolStateConfirmed;
	if (event.state === 'gone') return language.transactionSyncProtocolStateGone;
	return language.transactionSyncProtocolUnknown;
}

export function transactionSyncSessionKey(steps: ArweaveSyncStep[]): string {
	return (
		steps.find((step) => step.transaction?.id)?.transaction?.id ?? `pending:${steps.map((step) => step.key).join(':')}`
	);
}

function protocolStatusForState(state: ObserverView['state']): number | undefined {
	if (state === 'not-found' || state === 'gone') return 404;
	if (state === 'pending') return 202;
	if (state === 'confirmed') return 200;
	return undefined;
}

type RaceLane = {
	observer: ObserverView['observer'];
	phases: Map<string, LaneHistory>;
};

function mergeRaceLanes(steps: ArweaveSyncStep[], timelines: Map<string, Timeline>): RaceLane[] {
	const lanes = new Map<string, RaceLane>();
	for (const step of steps) {
		for (const lane of timelines.get(step.key)?.lanes ?? []) {
			const current = lanes.get(lane.observer.url) ?? {
				observer: lane.observer,
				phases: new Map<string, LaneHistory>(),
			};
			current.observer = lane.observer;
			current.phases.set(step.key, lane);
			lanes.set(lane.observer.url, current);
		}
	}
	return [...lanes.values()];
}

function latestLaneEvent(lane: LaneHistory | undefined): LaneEvent | undefined {
	return lane?.events[lane.events.length - 1];
}

function previousLaneEvent(lane: LaneHistory | undefined): LaneEvent | undefined {
	return lane?.events[lane.events.length - 2];
}

function cappedConfirmations(event: LaneEvent | undefined, target: number): number {
	return Math.min(target, Math.max(0, event?.confirmations ?? 0));
}

function infinity3DLane(
	lane: RaceLane,
	steps: ArweaveSyncStep[],
	liveAt: number,
	includeProofs: boolean,
	language: any,
): Infinity3DLane {
	const phases = steps.map((step, index) => {
		const bounds = sequencePhaseBounds(index, steps.length);
		const history = lane.phases.get(step.key);
		const event = latestLaneEvent(history);
		const complete = phaseIsComplete(event, step.target);
		const rendered = infinity3DPhase(
			history,
			bounds.start,
			bounds.end,
			step.target,
			complete,
			liveAt,
			step.label,
			includeProofs,
			language,
		);
		return {
			step,
			history,
			event,
			complete,
			confirmations: cappedConfirmations(event, step.target),
			...rendered,
		};
	});
	const activePhase = [...phases].reverse().find((phase) => phase.history?.events.length) ?? phases[0];
	const latestEvent = activePhase?.event;
	const previousEvent = previousLaneEvent(activePhase?.history);
	const statusLabel = latestEvent
		? observerStatusLabel(
				timelineEventLabel(latestEvent, previousEvent, language),
				latestLaneLatency(activePhase?.history),
				language,
			)
		: language.transactionSyncLaneConnecting;
	const stages: ObserverTooltipStage[] = phases.map((phase) => ({
		label: phase.step.label,
		count: phase.confirmations,
		target: phase.step.target,
		state: phase.event?.state ?? 'unknown',
		hasError: Boolean(phase.event?.error),
	}));
	const phaseDetail = phases
		.map((phase) => `${phase.step.label} ${phase.confirmations}/${phase.step.target}`)
		.join(' · ');
	const detail = `${lane.observer.label} · ${phaseDetail} · ${statusLabel} · ${observerProtocolDetail(
		lane.observer,
		language,
	)}`;

	return {
		observerUrl: lane.observer.url,
		label: lane.observer.label,
		detail,
		statusLabel,
		stages,
		progress: activePhase?.progress ?? 0,
		phases: phases.map((phase) => ({
			progress: phase.progress,
			started: Boolean(phase.history?.events.length),
			complete: phase.complete,
		})),
		state: latestEvent?.state ?? 'unknown',
		confirmations: latestEvent?.confirmations ?? 0,
		error: Boolean(latestEvent?.error),
		markers: phases.flatMap((phase) => phase.markers),
	};
}

function infinity3DPhase(
	lane: LaneHistory | undefined,
	phaseStart: number,
	phaseEnd: number,
	target: number,
	complete: boolean,
	liveAt: number,
	phaseLabel: string,
	includeProofs: boolean,
	language: any,
): Pick<Infinity3DLane, 'progress' | 'markers'> {
	if (!lane?.events.length) return { progress: phaseStart, markers: [] };
	const observedAt = complete ? lane.observedAt : Math.max(lane.observedAt, liveAt);
	const layout = timelineLayout(lane.events, observedAt, phaseStart, phaseEnd, target, complete);
	const startedAt = lane.events[0].updatedAt;
	const eventTimestamps = new Set(lane.events.map((event) => event.updatedAt));
	const rawProofMarkers = includeProofs
		? lane.proofs.slice(-MAX_VISIBLE_MINOR_EVENT_MARKERS * RECENT_PROOF_CANDIDATE_MULTIPLIER).flatMap((proof) => {
				if (eventTimestamps.has(proof.observedAt)) return [];
				const proofEvents = lane.events.filter((event) => event.updatedAt <= proof.observedAt);
				if (!proofEvents.length) return [];
				const proofLayout = timelineLayout(proofEvents, proof.observedAt, phaseStart, phaseEnd, target, false);
				return [
					{
						kind: 'proof' as const,
						confirmation: false,
						progress: proofLayout.progressEnd,
						colorProgress: confirmationProgress(proof.confirmations, target),
						state: proof.state,
						confirmations: proof.confirmations,
						error: false,
						observedAt: proof.observedAt,
						detail: `${phaseLabel} · ${proofEventLabel(proof, language)} · ${elapsedLabel(
							proof.observedAt - startedAt,
						)}`,
					},
				];
			})
		: [];
	const minorMarkerPositions = minorEventMarkerPositions(
		rawProofMarkers.map((marker) => marker.progress),
		phaseStart,
	);
	const proofMarkers = rawProofMarkers
		.slice(-MAX_VISIBLE_MINOR_EVENT_MARKERS)
		.slice(-minorMarkerPositions.length)
		.map((marker, index) => ({ ...marker, progress: minorMarkerPositions[index] }));
	return {
		progress: layout.progressEnd,
		markers: [
			...lane.events.map((event, index) => ({
				kind: 'event' as const,
				confirmation: event.confirmations > (lane.events[index - 1]?.confirmations ?? 0),
				progress: layout.positions[index] ?? phaseStart,
				colorProgress: confirmationProgress(event.confirmations, target),
				state: event.state,
				confirmations: event.confirmations,
				error: Boolean(event.error),
				observedAt: event.updatedAt,
				detail: `${phaseLabel} · ${observerStatusLabel(
					timelineEventLabel(event, lane.events[index - 1], language),
					event.latency,
					language,
				)}${
					protocolEventContext(event, language) ? ` · ${protocolEventContext(event, language)}` : ''
				} · ${elapsedLabel(event.updatedAt - startedAt)}`,
			})),
			...proofMarkers,
		],
	};
}

function proofEventLabel(proof: LaneProof, language: any): string {
	const parts: string[] = [];
	if (proof.httpStatus !== undefined) {
		parts.push(language.transactionSyncProofHttpStatus.replace('{status}', String(proof.httpStatus)));
	}
	if (proof.blockHeight !== undefined) {
		parts.push(language.transactionSyncProofMinedAtHeight.replace('{height}', proof.blockHeight.toLocaleString()));
	}
	if (proof.blockId) {
		parts.push(language.transactionSyncProofBlockId.replace('{id}', shortBlockId(proof.blockId)));
	}
	if (proof.nodeHeight !== undefined) {
		parts.push(language.transactionSyncProofCheckedHeight.replace('{height}', proof.nodeHeight.toLocaleString()));
	}
	if (proof.latency !== undefined) parts.push(observerLatencyLabel(proof.latency, language));
	return parts.length ? parts.join(' · ') : language.transactionSyncProofObserved;
}

function shortBlockId(blockId: string): string {
	return blockId.length <= 14 ? blockId : `${blockId.slice(0, 7)}…${blockId.slice(-5)}`;
}

function latestLaneLatency(lane: LaneHistory | undefined): number | undefined {
	return lane?.proofs[lane.proofs.length - 1]?.latency ?? latestLaneEvent(lane)?.latency;
}

function observerStatusLabel(label: string, latency: number | undefined, language: any): string {
	return latency === undefined ? label : `${label} · ${observerLatencyLabel(latency, language)}`;
}

function observerLatencyLabel(latency: number, language: any): string {
	return language.transactionSyncObserverLatency.replace('{latency}', String(Math.max(0, Math.round(latency))));
}

function protocolEventContext(event: LaneEvent, language: any): string {
	const parts: string[] = [];
	if (event.httpStatus !== undefined && ![404, 202].includes(event.httpStatus)) {
		parts.push(language.transactionSyncProofHttpStatus.replace('{status}', String(event.httpStatus)));
	}
	if (event.blockHeight !== undefined) {
		parts.push(language.transactionSyncProofMinedAtHeight.replace('{height}', event.blockHeight.toLocaleString()));
	}
	if (event.blockId) {
		parts.push(language.transactionSyncProofBlockId.replace('{id}', shortBlockId(event.blockId)));
	}
	if (event.nodeHeight !== undefined) {
		parts.push(language.transactionSyncProofCheckedHeight.replace('{height}', event.nodeHeight.toLocaleString()));
	}
	return parts.join(' · ');
}

function observerProtocolDetail(observer: Observer, language: any): string {
	const unknown = language.transactionSyncProtocolUnknown;
	const sourceKey =
		observer.source === 'seed'
			? 'transactionSyncObserverSourceSeed'
			: observer.source === 'local'
				? 'transactionSyncObserverSourceLocal'
				: observer.source === 'hyperbeam'
					? 'transactionSyncObserverSourceHyperbeam'
					: 'transactionSyncObserverSourcePeer';
	const summary = language.transactionSyncProtocolObserver
		.replace('{source}', language[sourceKey])
		.replace('{height}', observer.height === undefined ? unknown : observer.height.toLocaleString())
		.replace('{release}', observer.release === undefined ? unknown : String(observer.release))
		.replace('{failures}', String(observer.failures));
	return observer.discoveredBy
		? `${summary} · ${language.transactionSyncProtocolDiscoveredBy.replace('{observer}', observer.discoveredBy)}`
		: summary;
}

function useObserverTimelines(steps: ArweaveSyncStep[]): Map<string, Timeline> {
	const [timelines, setTimelines] = React.useState<Map<string, Timeline>>(() => new Map());

	React.useEffect(() => {
		setTimelines((current) => {
			let changed = current.size !== steps.length;
			const next = new Map<string, Timeline>();
			for (const step of steps) {
				const transactionId = step.transaction?.id ?? `${step.key}:empty`;
				const existing = current.get(step.key);
				const reset = existing?.transactionId !== transactionId;
				const base: Timeline = reset || !existing ? { transactionId, lanes: [] } : existing;
				const updated = updateObserverTimeline(base, step.transaction?.views ?? []);
				next.set(step.key, updated);
				if (reset || updated !== existing) changed = true;
			}
			return changed ? next : current;
		});
	}, [steps]);

	return timelines;
}

export function updateObserverTimeline(current: Timeline, views: ObserverView[]): Timeline {
	let changed = false;
	let lanes = current.lanes;
	const laneIndexes = new Map(lanes.map((lane, index) => [lane.observer.url, index]));
	const mutableLane = (index: number): LaneHistory => {
		if (lanes === current.lanes) lanes = [...lanes];
		if (lanes[index] === current.lanes[index]) {
			lanes[index] = { ...lanes[index], events: [...lanes[index].events], proofs: [...lanes[index].proofs] };
		}
		return lanes[index];
	};

	for (const view of views) {
		const event: LaneEvent = {
			state: view.state,
			confirmations: view.confirmations,
			updatedAt: view.updatedAt,
			...(view.blockId === undefined ? {} : { blockId: view.blockId }),
			...(view.blockHeight === undefined ? {} : { blockHeight: view.blockHeight }),
			...(view.nodeHeight === undefined ? {} : { nodeHeight: view.nodeHeight }),
			...(view.httpStatus === undefined ? {} : { httpStatus: view.httpStatus }),
			...(view.latency === undefined ? {} : { latency: view.latency }),
			...(view.error === undefined ? {} : { error: view.error }),
		};
		let laneIndex = laneIndexes.get(view.observer.url);
		if (laneIndex === undefined) {
			if (lanes === current.lanes) lanes = [...lanes];
			laneIndex = lanes.length;
			lanes.push({ observer: view.observer, events: [], proofs: [], observedAt: view.updatedAt });
			laneIndexes.set(view.observer.url, laneIndex);
			changed = true;
		}
		let lane = lanes[laneIndex];
		const previous = lane.events[lane.events.length - 1];
		const addEvent = !previous || transitionKey(previous) !== transitionKey(event);
		const previousProof = lane.proofs[lane.proofs.length - 1];
		const addProof = view.lastSeenAt !== undefined && (!previousProof || view.lastSeenAt > previousProof.observedAt);
		const updateObservedAt = view.updatedAt > lane.observedAt;
		if (!addEvent && !addProof && !updateObservedAt) continue;

		lane = mutableLane(laneIndex);
		if (addEvent) {
			lane.events.push(event);
			lane.events.sort((left, right) => left.updatedAt - right.updatedAt);
			changed = true;
		}
		if (addProof && view.lastSeenAt !== undefined) {
			lane.proofs.push({
				observedAt: view.lastSeenAt,
				state: view.state,
				confirmations: view.confirmations,
				...(view.latency === undefined ? {} : { latency: view.latency }),
				...(view.httpStatus === undefined ? {} : { httpStatus: view.httpStatus }),
				...(view.blockId === undefined ? {} : { blockId: view.blockId }),
				...(view.blockHeight === undefined ? {} : { blockHeight: view.blockHeight }),
				...(view.nodeHeight === undefined ? {} : { nodeHeight: view.nodeHeight }),
			});
			if (lane.proofs.length > MAX_PROOFS_PER_LANE) {
				lane.proofs.splice(0, lane.proofs.length - MAX_PROOFS_PER_LANE);
			}
			changed = true;
		}
		if (updateObservedAt) {
			lane.observedAt = view.updatedAt;
			changed = true;
		}
	}

	return changed ? { ...current, lanes } : current;
}

function eventKey(event: LaneEvent): string {
	return [
		event.updatedAt,
		event.state,
		event.confirmations,
		event.blockId,
		event.blockHeight,
		event.httpStatus,
		event.error,
	].join(':');
}

function laneEventLabel(event: LaneEvent, language: any): string {
	return event.state === 'confirmed'
		? language.transactionSyncLaneConfirmed.replace('{count}', String(event.confirmations))
		: laneLabel(event.state, language);
}

function timelineEventLabel(event: LaneEvent, previous: LaneEvent | undefined, language: any): string {
	if (event.error) return language.transactionSyncLaneUnavailable;
	const label = laneEventLabel(event, language);
	return previous?.error ? language.transactionSyncLaneRecovered.replace('{status}', label) : label;
}

function laneLabel(state: ObserverView['state'], language: any): string {
	return {
		unknown: language.transactionSyncLaneConnecting,
		'not-found': language.transactionSyncLaneWaiting,
		pending: language.transactionSyncLanePending,
		confirmed: language.transactionSyncLaneConfirmed.replace('{count}', '0'),
		gone: language.transactionSyncLaneReorged,
	}[state];
}
