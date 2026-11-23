import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Info, RefreshCw } from 'lucide-react';

import {
	ASSET_BALANCE_STATE_UNAVAILABLE,
	assetBalanceStateAvailable,
	type AssetState,
	liquidBalanceOf,
} from 'api/asset-marketplace';
import { DISPLAY_STATE_TIMEOUT_ERROR, readAssetStateWithDeadline } from 'api/asset-state-store';
import { ASSET_BALANCE_PROOF_UNAVAILABLE, AssetTransactionClient } from 'api/asset-transactions';
import { FUNGIBLE_TOKEN_COLLECTION_ID } from 'api/collections';
import {
	createDispatchPlan,
	DEFAULT_DISPATCH_BATCH_SIZE,
	discardDispatchPlan,
	discardRejectedDispatchSignature,
	DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED,
	DISPATCH_SIGNED_TRANSACTION_REJECTED,
	dispatchDiscardConfirmation,
	type DispatchPlan,
	dispatchPlanProgress,
	type DispatchRow,
	type DispatchRowStatus,
	estimateDispatchCost,
	fetchTransferReward,
	type HolderRow,
	loadDispatchPlan,
	parseHolderList,
	requiresCostConfirmation,
	runDispatch,
} from 'api/fungible-dispatch';

import { AssetBalanceStateNotice } from 'components/AssetBalanceStateNotice';
import { Button } from 'components/Button';
import { type HolderDraftRow, HolderListField } from 'components/HolderListField';
import { Loading } from 'components/Loading';
import { TokenArtwork } from 'components/TokenArtwork';
import { WalletAddress } from 'components/WalletAddress';
import { arweaveGatewayFromLocation } from 'helpers/config';
import { formatTokenQuantity } from 'helpers/token-display';
import { useWallet } from 'providers/WalletProvider';

import { assetStateErrorMessage, RouteState, winstonToAr } from '../app/App';
import { announceFungibleOperationActivityChange } from '../app/operation-activity';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;

function shortAddress(address: string): string {
	return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function tokenAmount(raw: string, state: Pick<AssetState, 'denomination' | 'ticker'>): string {
	return formatTokenQuantity(raw, state, 'tokens');
}

/** Gateway answers that say "try again later", not "this transaction is invalid". */
const TRANSIENT_GATEWAY_DISPATCH = /^transaction-dispatch-(5\d\d|408|425|429)\b/;
const GATEWAY_DISPATCH_STATUS = /^transaction-dispatch-(\d{3})\b/;
/**
 * A recipient in a dispatch review table. The full address is rendered as text
 * (no profile lookup per row) with a copy button whose accessible name carries
 * the address, so keyboard and screen-reader users can check every recipient
 * before signing or resuming a dispatch.
 */
export function DispatchRecipientCell({ address }: { address: string }) {
	return <WalletAddress address={address} full label="recipient" tooltipEscapesOverflow />;
}

export function dispatchErrorMessage(cause: unknown): string {
	const message = cause instanceof Error ? cause.message : String(cause);
	const code = cause && typeof cause === 'object' ? (cause as { code?: unknown }).code : undefined;
	if (code === 'transaction-dispatch-rejected') {
		return 'Arweave rejected a transfer Bazar had just signed, so it was never accepted. Bazar deleted that signature. Resume signs a replacement for this holder only.';
	}
	if (code === DISPATCH_SIGNED_TRANSACTION_REJECTED) {
		const listed = (cause as { addresses?: unknown }).addresses;
		const proven = (cause as { processRejected?: unknown }).processRejected;
		const processRejected = Array.isArray(proven) ? proven.length : 0;
		const gatewayRejected = Math.max((Array.isArray(listed) ? listed.length : 1) - processRejected, 0);
		const parts: string[] = [];
		if (gatewayRejected) {
			const rows = gatewayRejected > 1 ? `${gatewayRejected} rows marked Rejected` : 'the row marked Rejected';
			parts.push(
				`Arweave rejected the saved signed transfer for ${rows}. It may have been posted before an interruption, so Bazar will not replace it on its own. Discard this row's rejected signature to sign a replacement; Bazar first checks whether the recipient balance already rose and marks the row settled instead.`
			);
		}
		if (processRejected) {
			const rows =
				processRejected > 1 ? `${processRejected} rows marked Not applied` : 'the row marked Not applied';
			parts.push(
				`The token process reached the exact transfer for ${rows} and did not apply it, so no tokens moved. Bazar will not re-sign on its own: choose Sign again on a row to delete its rejected signature, then Resume signs a replacement for that holder only.`
			);
		}
		return parts.join(' ');
	}
	switch (message) {
		case 'dispatch-insufficient-token-balance':
			return 'Your token balance is smaller than the total quantity in the holder list.';
		case 'dispatch-self-recipient':
			return 'Remove your own address from the list. A transfer to yourself is a no-op that Bazar cannot verify as delivered.';
		case ASSET_BALANCE_STATE_UNAVAILABLE:
			return 'The configured AO routes did not return a complete holder balance table. Bazar did not sign a transfer. Retry after complete state is available; any saved dispatch progress remains available.';
		case DISPLAY_STATE_TIMEOUT_ERROR:
			return 'The configured AO routes did not return complete holder state within 45 seconds. No new transfer was signed; saved dispatch progress remains available.';
		case DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED:
			return 'Bazar found a transaction ID for this dispatch row, but its saved signed transaction could not be restored. It may already have reached Arweave, so Bazar will not sign a replacement. Keep this dispatch plan for manual review, or restore the original browser data before resuming.';
		case 'asset-state-timeout':
			return 'Timed out waiting for settlement. Nothing was lost: posted transfers stay posted — resume to continue watching without re-sending.';
		case 'fungible-transfer-proof-mismatch':
			return "Bazar found a dispatched transfer in the token schedule, but it does not match the row's sender, recipient and quantity, so its outcome is unknown. The row stays Posted and its signed transaction stays saved for manual review. Nothing was re-signed.";
		case ASSET_BALANCE_PROOF_UNAVAILABLE:
		case 'scheduled-action-state-missing':
			return 'Bazar found a dispatched transfer at its exact schedule slot, but the configured AO routes did not return the state needed to prove its receipt. The row stays Posted; resume to check again without re-sending.';
		case 'wallet-sign-unavailable':
			return 'Connect an Arweave wallet extension that supports transaction signing.';
		case 'asset-purchase-insufficient-funds':
			return 'Your AR balance cannot cover the transfer amounts plus network rewards.';
		case 'wallet-account-changed':
			return 'The connected wallet changed mid-dispatch. Reconnect the wallet that started this dispatch and resume.';
	}
	// Never echo the gateway body (often HTML); the signed transfer is kept either way.
	if (TRANSIENT_GATEWAY_DISPATCH.test(message)) {
		return `The Arweave gateway is temporarily unavailable (HTTP ${
			GATEWAY_DISPATCH_STATUS.exec(message)?.[1]
		}). Nothing was re-signed: Resume retries the same signed transfer.`;
	}
	const status = GATEWAY_DISPATCH_STATUS.exec(message)?.[1];
	if (status) {
		return `The Arweave gateway did not accept the transfer (HTTP ${status}). Nothing was re-signed: Resume retries the same signed transfer.`;
	}
	return message || 'Dispatch failed.';
}

const MINTED_TOKEN_HINT =
	'If this token was minted recently, it only becomes readable once the arweave-scheduler sequences its creation — around 20 minutes on mainnet.';
const TRANSPORT_STATE_FAILURES = [
	'Failed to fetch',
	'fetch failed',
	'compute-provider-failed',
	'compute-provider-timeout',
];

/**
 * Copy for a failed token-state read. Uses the asset page's cause-specific
 * mapping; the freshly-minted hint is added only when the cause could be a
 * token that is not sequenced yet (not found / unrecognised), never for a
 * rate limit, peer outage, timeout or unreachable peer.
 */
export function dispatchStateReadMessage(cause: unknown): string {
	const message = cause instanceof Error ? cause.message : String(cause);
	const base = assetStateErrorMessage(cause);
	const transport =
		/^HTTP (?:429|5\d\d)(?:\b|$)/i.test(message) ||
		/response[-\s]+quorum[-\s]+not[-\s]+met/i.test(message) ||
		message === DISPLAY_STATE_TIMEOUT_ERROR ||
		TRANSPORT_STATE_FAILURES.includes(message);
	return transport ? base : `${base} ${MINTED_TOKEN_HINT}`;
}

/** Fixed, short copy for a failed network-fee quote; raw codes never reach the UI. */
export function transferRewardErrorMessage(cause: unknown): string {
	const message = cause instanceof Error ? cause.message : String(cause);
	return message === 'transfer-price-429'
		? 'The Arweave gateway is rate-limiting network fee checks. Wait briefly and retry.'
		: 'Network fee could not be checked. Retry.';
}

/**
 * The network-fee quote as explicit state:
 * - idle: nothing to show yet (no rows, or no wallet while the quote is pending)
 * - checking: a connected wallet is waiting on the quote that gates sending
 * - error: the quote failed; a Retry re-requests only the fee
 * - ready: the quote is known
 */
export type DispatchFeeStatus = 'idle' | 'checking' | 'error' | 'ready';

export function dispatchFeeStatus(input: {
	walletConnected: boolean;
	rowsParsed: boolean;
	reward: bigint | null;
	rewardError: string | null;
}): DispatchFeeStatus {
	if (!input.rowsParsed) return 'idle';
	if (input.rewardError) return 'error';
	if (input.reward !== null) return 'ready';
	return input.walletConnected ? 'checking' : 'idle';
}

export function dispatchFeeLabel(status: DispatchFeeStatus, totalWinston: bigint | null): string {
	if (status === 'ready' && totalWinston !== null) return `${winstonToAr(totalWinston.toString())} AR`;
	if (status === 'checking') return 'Checking…';
	if (status === 'error') return 'Unavailable';
	return '—';
}

export function DispatchFeeNotice(props: { message: string; blocksDispatch: boolean; onRetry: () => void }) {
	return (
		<div className="mint-recovery" role="status">
			<div>
				<strong>Network fee unavailable</strong>
				<span>
					{props.message}
					{props.blocksDispatch ? ' Sign and dispatch stays disabled until the fee is known.' : ''}
				</span>
			</div>
			<div>
				<Button type="button" size="custom" onClick={props.onRetry}>
					<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
				</Button>
			</div>
		</div>
	);
}

export type DispatchStartRequest = {
	/**
	 * Single-flight gate shared by start and resume. It is claimed synchronously,
	 * before any await, so a second submit landing before React re-renders is a
	 * no-op instead of a second plan that signs every transfer again.
	 */
	inFlight: { current: boolean };
	/** Receives the run's controller before the first await so unmount aborts the pre-flight too. */
	abortRef: { current: AbortController | null };
	processId: string;
	sender: string;
	rows: HolderRow[];
	state: AssetState | null;
	/** Total network rewards to check against the AR balance; null skips the check. */
	requiredWinston: bigint | null;
	readWalletBalance: (address: string, signal: AbortSignal) => Promise<bigint>;
	createPlan: (
		processId: string,
		sender: string,
		rows: HolderRow[],
		options: { signal: AbortSignal }
	) => Promise<DispatchPlan>;
	execute: (plan: DispatchPlan, controller: AbortController) => Promise<void>;
	onPreparingChange: (preparing: boolean) => void;
	onPlan: (plan: DispatchPlan) => void;
	onError: (message: string) => void;
};

export type DispatchStartOutcome = 'busy' | 'executed' | 'aborted' | 'failed';

/**
 * Runs the dispatch pre-flight (AR balance, fresh plan) and hands the plan to
 * execute under one controller. Returns 'busy' without side effects when a
 * start or resume is already in flight.
 */
export async function startDispatchOnce(request: DispatchStartRequest): Promise<DispatchStartOutcome> {
	if (request.inFlight.current) return 'busy';
	request.inFlight.current = true;
	const controller = new AbortController();
	const { signal } = controller;
	request.abortRef.current = controller;
	request.onPreparingChange(true);
	try {
		if (!request.state || !assetBalanceStateAvailable(request.state)) {
			throw new Error(ASSET_BALANCE_STATE_UNAVAILABLE);
		}
		// Pre-flight every network reward before creating a resumable dispatch
		// plan. Native AR quantity stays zero.
		if (request.requiredWinston !== null) {
			const arBalance = await request.readWalletBalance(request.sender, signal);
			if (signal.aborted) return 'aborted';
			if (arBalance < request.requiredWinston) throw new Error('asset-purchase-insufficient-funds');
		}
		const created = await request.createPlan(request.processId, request.sender, request.rows, { signal });
		if (signal.aborted) return 'aborted';
		request.onPlan(created);
		await request.execute(created, controller);
		return signal.aborted ? 'aborted' : 'executed';
	} catch (cause) {
		if (signal.aborted) return 'aborted';
		request.onError(dispatchErrorMessage(cause));
		return 'failed';
	} finally {
		request.inFlight.current = false;
		if (!signal.aborted) request.onPreparingChange(false);
	}
}

/** A run failure follows a user action (sign, resume), so it interrupts as an alert. */
export function DispatchRunError(props: { message: string }) {
	return (
		<div className="inline-error" role="alert">
			<span>{props.message}</span>
		</div>
	);
}

/**
 * Text for the page's one polite progress region: the plain settled counter
 * while a run is active, completion once, and nothing otherwise. The visible
 * heading keeps its posted/sender detail; it is left out here so every
 * onProgress update stays short.
 */
export function dispatchPlanStatusText(input: {
	hasPlan: boolean;
	complete: boolean;
	running: boolean;
	settled: number;
	total: number;
}): string {
	if (!input.hasPlan) return '';
	if (input.complete) return 'Dispatch complete. All transfers settled.';
	if (input.running) return `${input.settled} of ${input.total} settled`;
	return '';
}

/**
 * Always mounted at section level, outside the plan/form swap, so it exists
 * empty before its first update (mirrors OperationOutcomeAnnouncement).
 */
export function DispatchPlanStatus(props: { text: string }) {
	return (
		<div aria-atomic="true" className="sr-only" role="status">
			{props.text}
		</div>
	);
}

/**
 * Moves focus to the plan heading once, after start() created the plan and the
 * form (holding the focused submit button) unmounted. A plan restored from
 * storage on mount never raises the flag, so opening the page keeps focus
 * where the user put it.
 */
export function focusCreatedPlan(justCreated: { current: boolean }, target: { focus: () => void } | null): boolean {
	if (!justCreated.current || !target) return false;
	justCreated.current = false;
	target.focus();
	return true;
}

const STATUS_LABEL: Record<DispatchRowStatus, string> = {
	unsent: 'Unsent',
	posted: 'Posted',
	settled: 'Settled',
	rejected: 'Rejected',
};

/**
 * Row status text. Plans with a startingSlot settle on the exact receipt;
 * older plans only checked the balance, and say so.
 */
export function dispatchRowStatusLabel(
	plan: Pick<DispatchPlan, 'startingSlot'>,
	row: Pick<DispatchRow, 'status' | 'rejectedBy'>
): string {
	if (row.status === 'rejected' && row.rejectedBy === 'process') return 'Not applied';
	if (row.status === 'settled' && plan.startingSlot === undefined) return 'Settled (balance-checked)';
	return STATUS_LABEL[row.status];
}

export function notAppliedSignAgainConfirmation(address: string): string {
	return (
		`The token process reached the transfer to ${shortAddress(
			address
		)} and did not apply it, so no tokens moved.\n\n` +
		"Bazar deletes this row's rejected signature. Resume then checks fresh holder state and signs a replacement for this holder only.\n\nContinue?"
	);
}

export function rejectedSignatureConfirmation(address: string): string {
	return (
		`Arweave rejected the saved signed transfer to ${shortAddress(address)}.\n\n` +
		'Bazar reads fresh holder balances first. If this recipient already received the amount, the row is marked settled and nothing is re-signed. ' +
		"Otherwise only this row's rejected signature is deleted, and Resume signs a replacement for this holder.\n\nContinue?"
	);
}

export function rejectedSignatureOutcomeMessage(outcome: 'settled' | 'discarded'): string {
	return outcome === 'settled'
		? 'The recipient balance already rose by this amount, so Bazar marked the row settled instead of signing a replacement.'
		: 'Rejected signature deleted. Resume signs a replacement for this holder only.';
}

/**
 * How a dispatch run stopped. 'interrupted' is the unmount abort: the plan is
 * saved and the page offers Resume, but nothing is running any more.
 */
export type DispatchRunEnd = { kind: 'complete' } | { kind: 'failed'; cause: unknown } | { kind: 'interrupted' };

/**
 * The top-bar activity a stopped run leaves behind. Every exit maps to a
 * terminal phase so the tray never keeps a 'working' row for a run that ended:
 * complete removes the row, failed and interrupted keep a needs-attention row.
 */
export function dispatchEndActivity(
	end: DispatchRunEnd,
	plan: Pick<DispatchPlan, 'rows'>
): { phase: 'done' | 'error'; status: string } {
	switch (end.kind) {
		case 'complete':
			return { phase: 'done', status: '' };
		case 'failed':
			return { phase: 'error', status: dispatchErrorMessage(end.cause) };
		case 'interrupted': {
			const settled = plan.rows.filter((row) => row.status === 'settled').length;
			return {
				phase: 'error',
				status: `Dispatch paused when you left the page · ${settled} of ${plan.rows.length} settled. Resume it from Dispatch on this token; posted transfers will not be re-sent.`,
			};
		}
	}
}

export default function DispatchRoute() {
	const { processId = '' } = useParams();
	const wallet = useWallet();
	const validId = ADDRESS.test(processId);
	const abortRef = React.useRef<AbortController | null>(null);
	const inFlightRef = React.useRef(false);
	const planHeadingRef = React.useRef<HTMLElement>(null);
	const planJustCreatedRef = React.useRef(false);
	const holderListLabelId = React.useId();
	const holderListErrorsId = React.useId();
	const senderMismatchId = React.useId();
	const [state, setState] = React.useState<AssetState | null>(null);
	const [stateError, setStateError] = React.useState<string | null>(null);
	const [loadingState, setLoadingState] = React.useState(false);
	const [stateAttempt, setStateAttempt] = React.useState(0);
	const [holderRows, setHolderRows] = React.useState<HolderDraftRow[]>([{ address: '', quantity: '' }]);
	const [reward, setReward] = React.useState<bigint | null>(null);
	const [rewardError, setRewardError] = React.useState<string | null>(null);
	// Separate from stateAttempt: retrying the fee must not re-read the token state.
	const [rewardAttempt, setRewardAttempt] = React.useState(0);
	const [plan, setPlan] = React.useState<DispatchPlan | null>(() => (validId ? loadDispatchPlan(processId) : null));
	const [running, setRunning] = React.useState(false);
	const [preparing, setPreparing] = React.useState(false);
	const [runError, setRunError] = React.useState<string | null>(null);
	const [costApproved, setCostApproved] = React.useState(false);

	React.useEffect(() => () => abortRef.current?.abort(), []);
	React.useEffect(() => {
		if (!validId) return;
		const controller = new AbortController();
		setLoadingState(true);
		setStateError(null);
		void readAssetStateWithDeadline(processId, { signal: controller.signal, maxAge: 0 })
			.then(
				(result) => {
					if (!controller.signal.aborted) setState(result.state);
				},
				(cause) => {
					if (!controller.signal.aborted) setStateError(dispatchStateReadMessage(cause));
				}
			)
			.finally(() => {
				if (!controller.signal.aborted) setLoadingState(false);
			});
		return () => controller.abort();
	}, [processId, validId, stateAttempt]);
	React.useEffect(() => {
		// Every attempt starts clean so a fee or error from another token or an
		// earlier attempt is never shown.
		setReward(null);
		setRewardError(null);
		if (!validId || !state) return;
		const controller = new AbortController();
		void fetchTransferReward(arweaveGatewayFromLocation(), processId, undefined, controller.signal).then(
			(value) => {
				if (!controller.signal.aborted) setReward(value);
			},
			(cause) => {
				if (!controller.signal.aborted) setRewardError(transferRewardErrorMessage(cause));
			}
		);
		return () => controller.abort();
	}, [processId, validId, state, rewardAttempt]);

	// The K/V rows are the editable source of truth; serialize non-empty rows
	// back to the CSV the strict parser/validator already understands.
	const text = React.useMemo(
		() =>
			holderRows
				.filter((row) => row.address || row.quantity)
				.map((row) => `${row.address},${row.quantity}`)
				.join('\n'),
		[holderRows]
	);
	const parsed = React.useMemo(
		() => (text.trim() && state ? parseHolderList(text, state.denomination) : null),
		[state, text]
	);
	const estimate = parsed?.rows.length && reward !== null ? estimateDispatchCost(parsed.rows, reward) : null;
	const feeStatus = dispatchFeeStatus({
		walletConnected: Boolean(wallet.address),
		rowsParsed: Boolean(parsed?.rows.length),
		reward,
		rewardError,
	});
	const needsCostApproval = Boolean(estimate && requiresCostConfirmation(estimate.totalWinston));
	const progress = plan ? dispatchPlanProgress(plan) : null;
	const planSettled = progress?.settled ?? 0;
	const planPosted = progress?.posted ?? 0;
	const planRejected = progress?.rejected ?? 0;
	const planPending = progress?.pending ?? 0;
	const planComplete = Boolean(progress?.complete);
	const [discardingRow, setDiscardingRow] = React.useState<string | null>(null);
	const [rowNotice, setRowNotice] = React.useState<string | null>(null);
	const busy = running || discardingRow !== null;
	const senderMismatch = Boolean(plan && wallet.address && plan.sender !== wallet.address);
	const balanceStateAvailable = state ? assetBalanceStateAvailable(state) : false;
	const balance = state && wallet.address && balanceStateAvailable ? liquidBalanceOf(state, wallet.address) : null;
	const planStatusText = dispatchPlanStatusText({
		hasPlan: Boolean(plan),
		complete: planComplete,
		running,
		settled: planSettled,
		total: plan?.rows.length ?? 0,
	});

	React.useEffect(() => {
		if (plan) focusCreatedPlan(planJustCreatedRef, planHeadingRef.current);
	}, [plan]);

	// Surface the run in the top-bar activity notifier the same as a buy/sell/
	// transfer. It rides the fungible runtime-activity channel with a dedicated
	// `:dispatch` id so it never collides with a manual transfer on the same
	// token; the operation reads as a transfer (a dispatch is batched transfers)
	// and the status line carries the settled/total progress.
	const dispatchActivity = (
		sender: string,
		phase: 'working' | 'done' | 'error',
		status: string,
		createdAt: number
	) => {
		const id = `fungible:${processId}:${sender}:dispatch`;
		if (phase === 'done') {
			announceFungibleOperationActivityChange({ type: 'remove', id, owner: sender });
			return;
		}
		announceFungibleOperationActivityChange({
			type: 'upsert',
			activity: {
				id,
				asset: {
					id: processId,
					name: state?.ticker || 'Token',
					...(state?.ticker ? { ticker: state.ticker } : {}),
				},
				collectionId: FUNGIBLE_TOKEN_COLLECTION_ID,
				owner: sender,
				operationKind: 'transfer',
				phase,
				status,
				createdAt,
			},
		});
	};

	const execute = async (dispatchPlan: DispatchPlan, controller = new AbortController()) => {
		abortRef.current = controller;
		setRunning(true);
		setRunError(null);
		setRowNotice(null);
		const sender = dispatchPlan.sender;
		const total = dispatchPlan.rows.length;
		const startedAt = Date.now();
		dispatchActivity(sender, 'working', `Dispatching to ${total} holder${total === 1 ? '' : 's'}…`, startedAt);
		let latest = dispatchPlan;
		const finish = (end: DispatchRunEnd) => {
			const activity = dispatchEndActivity(end, latest);
			dispatchActivity(sender, activity.phase, activity.status, startedAt);
		};
		try {
			await runDispatch(dispatchPlan, {
				signal: controller.signal,
				batchSize: DEFAULT_DISPATCH_BATCH_SIZE,
				readCurrentState: readAssetStateWithDeadline,
				onProgress: (next) => {
					latest = next;
					setPlan(next);
					const settled = next.rows.filter((row) => row.status === 'settled').length;
					dispatchActivity(sender, 'working', `${settled} of ${next.rows.length} settled`, startedAt);
				},
			});
			finish({ kind: 'complete' });
			wallet.refreshBalances();
		} catch (cause) {
			if (controller.signal.aborted) {
				// The page unmounted mid-run. The plan is saved; replace the
				// 'working' row so the tray stops claiming a run is in progress.
				finish({ kind: 'interrupted' });
			} else {
				setRunError(dispatchErrorMessage(cause));
				finish({ kind: 'failed', cause });
			}
		} finally {
			if (!controller.signal.aborted) setRunning(false);
		}
	};

	const start = async () => {
		if (!wallet.address) {
			wallet.openConnectDialog();
			return;
		}
		if (!parsed?.rows.length || parsed.errors.length || running || inFlightRef.current) return;
		if (needsCostApproval && !costApproved) return;
		setRunError(null);
		await startDispatchOnce({
			inFlight: inFlightRef,
			abortRef,
			processId,
			sender: wallet.address,
			rows: parsed.rows,
			state,
			requiredWinston: estimate ? estimate.totalWinston : null,
			readWalletBalance: (address, signal) => new AssetTransactionClient().walletBalance(address, signal),
			createPlan: createDispatchPlan,
			execute,
			onPreparingChange: setPreparing,
			onPlan: (created) => {
				planJustCreatedRef.current = true;
				setPlan(created);
			},
			onError: setRunError,
		});
	};

	const resume = async () => {
		if (!plan || busy || senderMismatch || inFlightRef.current) return;
		inFlightRef.current = true;
		try {
			await execute(plan);
		} finally {
			inFlightRef.current = false;
		}
	};

	const discardRejected = async (address: string) => {
		if (!plan || busy) return;
		// Fail closed without a DOM confirm, like discarding the plan.
		const processRejected = plan.rows.some((row) => row.address === address && row.rejectedBy === 'process');
		const confirmation = processRejected
			? notAppliedSignAgainConfirmation(address)
			: rejectedSignatureConfirmation(address);
		if (!(globalThis.window?.confirm?.(confirmation) ?? false)) return;
		setDiscardingRow(address);
		setRunError(null);
		setRowNotice(null);
		try {
			const result = await discardRejectedDispatchSignature(plan, address, {
				readCurrentState: readAssetStateWithDeadline,
			});
			setPlan(result.plan);
			setRowNotice(rejectedSignatureOutcomeMessage(result.outcome));
		} catch (cause) {
			setRunError(dispatchErrorMessage(cause));
		} finally {
			setDiscardingRow(null);
		}
	};

	const discardConfirmation = dispatchDiscardConfirmation(plan);

	const discard = () => {
		if (busy) return;
		// Fail closed without a DOM confirm: in-flight rows are never forgotten silently.
		if (discardConfirmation && !(globalThis.window?.confirm?.(discardConfirmation) ?? false)) return;
		if (plan) dispatchActivity(plan.sender, 'done', '', 0);
		discardDispatchPlan(processId);
		setPlan(null);
		setRunError(null);
		setRowNotice(null);
	};

	if (!validId) {
		return (
			<RouteState title="Unknown token" backTo="/discover" backLabel="Discover">
				<p>The address in the URL is not a 43-character Arweave process ID.</p>
			</RouteState>
		);
	}

	return (
		<section className="create-page dispatch-page">
			<div className="create-heading">
				<div>
					<p className="eyebrow">Dispatch fungible token</p>
					<h1>{state ? state.name || state.ticker || shortAddress(processId) : shortAddress(processId)}</h1>
				</div>
				<p>
					Send token amounts from a pasted holder list. Bazar converts them to atomic units for individual
					Arweave L1 transfers and saves progress locally so you can resume.
				</p>
			</div>

			{loadingState ? <Loading label="Reading token state…" /> : null}
			{stateError ? (
				<div className="mint-recovery" role="status">
					<div>
						<strong>Token state unavailable</strong>
						<span>{stateError}</span>
					</div>
					<div>
						<Button type="button" size="custom" onClick={() => setStateAttempt((current) => current + 1)}>
							<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
						</Button>
					</div>
				</div>
			) : null}

			{state ? (
				<div className="dispatch-token-summary">
					<TokenArtwork ticker={state.ticker || 'TOKEN'} />
					<dl>
						<div>
							<dt>Ticker</dt>
							<dd>{state.ticker || '—'}</dd>
						</div>
						<div>
							<dt>Total supply</dt>
							<dd>{tokenAmount(state.totalSupply, state)}</dd>
						</div>
						<div>
							<dt>Denomination</dt>
							<dd>{state.denomination}</dd>
						</div>
						<div>
							<dt>Your balance</dt>
							<dd>
								{wallet.address
									? balanceStateAvailable
										? tokenAmount(balance ?? '0', state)
										: 'Unavailable'
									: 'Connect wallet'}
							</dd>
						</div>
					</dl>
					<Link to={`/asset/${FUNGIBLE_TOKEN_COLLECTION_ID}/${processId}`}>View token page</Link>
				</div>
			) : null}
			{state ? <AssetBalanceStateNotice state={state} /> : null}

			{plan ? (
				<div className="dispatch-plan">
					<div className="dispatch-plan-heading">
						<div>
							<strong ref={planHeadingRef} tabIndex={-1}>
								{planComplete
									? 'Dispatch complete'
									: running
									? 'Dispatching…'
									: planRejected && !planPending
									? 'Dispatch needs a decision'
									: 'Saved dispatch in progress'}
							</strong>
							<span>
								{planSettled} of {plan.rows.length} settled
								{planPosted ? ` · ${planPosted} posted, awaiting settlement` : ''}
								{planRejected ? ` · ${planRejected} rejected` : ''} · started from{' '}
								{shortAddress(plan.sender)}
							</span>
						</div>
						<div>
							{planPending ? (
								<Button
									type="button"
									size="custom"
									onClick={() => void resume()}
									disabled={busy || senderMismatch}
									aria-describedby={senderMismatch ? senderMismatchId : undefined}
								>
									{running ? 'Working…' : 'Resume'}
								</Button>
							) : null}
							<Button type="button" size="custom" variant="danger" onClick={discard} disabled={busy}>
								{planComplete ? 'Clear' : discardConfirmation ? 'Discard plan…' : 'Discard plan'}
							</Button>
						</div>
					</div>
					{senderMismatch ? (
						<div className="inline-error" id={senderMismatchId}>
							<span>
								This dispatch was started from {shortAddress(plan.sender)}. Connect that wallet to
								resume it.
							</span>
						</div>
					) : null}
					{runError ? <DispatchRunError message={runError} /> : null}
					{rowNotice ? (
						<div className="mint-notice" role="status">
							<Info className="ui-icon" aria-hidden="true" />
							<span>{rowNotice}</span>
						</div>
					) : null}
					{running && planPosted ? (
						<div className="mint-notice">
							<Info className="ui-icon" aria-hidden="true" />
							<span>
								Settlement is not instant: the scheduler only sequences a transfer once it sits ~10
								blocks below the network tip (~20 minutes). Leaving this page is safe — resume later and
								nothing will be re-sent.
							</span>
						</div>
					) : null}
					<div className="dispatch-table-wrapper">
						<table className="dispatch-table">
							<thead>
								<tr>
									<th scope="col">Recipient</th>
									<th scope="col">Token amount</th>
									<th scope="col">Status</th>
								</tr>
							</thead>
							<tbody>
								{plan.rows.map((row) => (
									<tr key={row.address} className={`dispatch-row-${row.status}`}>
										<td>
											<DispatchRecipientCell address={row.address} />
										</td>
										<td>{state ? tokenAmount(row.quantity, state) : '—'}</td>
										<td>
											{row.status === 'settled' ? (
												<Check className="ui-icon ui-icon--sm" aria-hidden="true" />
											) : null}{' '}
											{dispatchRowStatusLabel(plan, row)}
											{row.status === 'rejected' ? (
												<>
													{' '}
													<Button
														type="button"
														size="custom"
														variant="danger"
														onClick={() => void discardRejected(row.address)}
														disabled={busy}
														aria-label={
															discardingRow === row.address
																? undefined
																: row.rejectedBy === 'process'
																? `Sign again for ${shortAddress(row.address)}`
																: `Discard rejected signature for ${shortAddress(
																		row.address
																  )}`
														}
													>
														{row.rejectedBy === 'process'
															? discardingRow === row.address
																? 'Clearing…'
																: 'Sign again…'
															: discardingRow === row.address
															? 'Checking balance…'
															: 'Discard rejected signature…'}
													</Button>
												</>
											) : null}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{planComplete ? (
						<div className="mint-success">
							<span>
								<Check aria-hidden="true" />
							</span>
							<div>
								<strong>All transfers settled</strong>
								<p>
									{plan.startingSlot === undefined
										? 'Every recipient balance has risen by its dispatched quantity (balance-checked).'
										: "Bazar verified each transfer's Debit and Credit notices at its exact token schedule slot."}
								</p>
							</div>
						</div>
					) : null}
				</div>
			) : (
				<div className="create-layout dispatch-layout">
					<form
						className="create-form"
						onSubmit={(event) => {
							event.preventDefault();
							void start();
						}}
					>
						<div
							className="create-field"
							role="group"
							aria-labelledby={holderListLabelId}
							aria-describedby={parsed?.errors.length ? holderListErrorsId : undefined}
						>
							<label id={holderListLabelId}>Holder list</label>
							<HolderListField
								rows={holderRows}
								disabled={running || preparing}
								denomination={state?.denomination ?? 0}
								ticker={state?.ticker || 'tokens'}
								onChange={(next) => {
									setHolderRows(next);
									setCostApproved(false);
									setRunError(null);
								}}
							/>
							<span>
								{parsed?.rows.length
									? `${parsed.rows.length} recipient${parsed.rows.length === 1 ? '' : 's'} parsed`
									: 'Add rows, or paste a JSON/CSV list into any field to autofill'}
							</span>
						</div>

						{parsed?.errors.length ? (
							// Not live: it re-renders on every keystroke. The holder-list group
							// references it through aria-describedby instead.
							<div className="inline-error" id={holderListErrorsId}>
								<span>
									{parsed.errors.slice(0, 8).map((entry, index) => (
										<React.Fragment key={index}>
											{entry}
											<br />
										</React.Fragment>
									))}
									{parsed.errors.length > 8 ? `…and ${parsed.errors.length - 8} more.` : null}
								</span>
							</div>
						) : null}

						{parsed?.rows.length && !parsed.errors.length ? (
							<>
								<div className="dispatch-table-wrapper">
									<table className="dispatch-table">
										<thead>
											<tr>
												<th scope="col">Recipient</th>
												<th scope="col">Token amount</th>
											</tr>
										</thead>
										<tbody>
											{parsed.rows.map((row) => (
												<tr key={row.address}>
													<td>
														<DispatchRecipientCell address={row.address} />
													</td>
													<td>{state ? tokenAmount(row.quantity, state) : '—'}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<div className="mint-summary">
									<div>
										<span>Recipients</span>
										<strong>{parsed.rows.length}</strong>
									</div>
									<div>
										<span>Total token amount</span>
										<strong>
											{estimate && state
												? tokenAmount(estimate.totalQuantity.toString(), state)
												: '—'}
										</strong>
									</div>
									<div>
										<span>Total AR cost</span>
										<strong>{dispatchFeeLabel(feeStatus, estimate?.totalWinston ?? null)}</strong>
									</div>
								</div>
								{feeStatus === 'error' && rewardError ? (
									<DispatchFeeNotice
										message={rewardError}
										blocksDispatch={Boolean(wallet.address)}
										onRetry={() => setRewardAttempt((current) => current + 1)}
									/>
								) : null}
								<div className="mint-notice">
									<Info className="ui-icon" aria-hidden="true" />
									<span>
										Each recipient is one L1 transfer signed in your wallet ({parsed.rows.length}{' '}
										signature{parsed.rows.length === 1 ? '' : 's'}, sent in batches of{' '}
										{DEFAULT_DISPATCH_BATCH_SIZE}). Behind this form, each token amount is converted
										to atomic units. The AR quote includes network rewards only.
									</span>
								</div>
								{needsCostApproval ? (
									<section
										className="mint-cost-warning"
										aria-labelledby="dispatch-cost-warning-title"
									>
										<div>
											<strong id="dispatch-cost-warning-title">
												This dispatch costs more than 0.1 AR
											</strong>
											<span>
												Expected{' '}
												<b>
													{estimate ? winstonToAr(estimate.totalWinston.toString()) : '0'} AR
												</b>{' '}
												in real AR spend
											</span>
											<small>Approve the network quote to enable sending.</small>
										</div>
										<Button
											type="button"
											size="custom"
											aria-pressed={costApproved}
											className={costApproved ? 'approved' : undefined}
											onClick={() => setCostApproved((current) => !current)}
										>
											{costApproved ? (
												<Check className="ui-icon ui-icon--sm" aria-hidden="true" />
											) : null}
											{costApproved ? 'Approved' : 'Approve quote'}
										</Button>
									</section>
								) : null}
							</>
						) : null}

						{runError ? <DispatchRunError message={runError} /> : null}

						<Button
							className="mint-submit"
							type="submit"
							size="custom"
							disabled={
								running ||
								preparing ||
								!state ||
								!balanceStateAvailable ||
								!parsed?.rows.length ||
								Boolean(parsed?.errors.length) ||
								Boolean(wallet.address && !estimate) ||
								(needsCostApproval && !costApproved)
							}
						>
							{running
								? 'Dispatching…'
								: preparing
								? 'Checking balances…'
								: wallet.address
								? 'Sign and dispatch'
								: 'Connect wallet to dispatch'}
							{!running && !preparing ? <ArrowRight className="ui-icon" aria-hidden="true" /> : null}
						</Button>
						<p className="mint-permanence">
							Confirmed Arweave transfers are permanent. Review every address and quantity before signing.
						</p>
					</form>
				</div>
			)}

			<DispatchPlanStatus text={planStatusText} />
		</section>
	);
}
