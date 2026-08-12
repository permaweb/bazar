import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, Info, RefreshCw } from 'lucide-react';

import { type AssetState, liquidBalanceOf, readAssetState } from 'api/asset-marketplace';
import { AssetTransactionClient } from 'api/asset-transactions';
import { FUNGIBLE_TOKEN_COLLECTION_ID } from 'api/collections';
import {
	createDispatchPlan,
	DEFAULT_DISPATCH_BATCH_SIZE,
	discardDispatchPlan,
	type DispatchPlan,
	estimateDispatchCost,
	fetchTransferReward,
	loadDispatchPlan,
	parseHolderList,
	requiresCostConfirmation,
	runDispatch,
} from 'api/fungible-dispatch';
import { formatTokenAmount } from 'api/order-matching';

import { Button } from 'components/Button';
import { type HolderDraftRow, HolderListField } from 'components/HolderListField';
import { Loading } from 'components/Loading';
import { TokenArtwork } from 'components/TokenArtwork';
import { arweaveGatewayFromLocation } from 'helpers/config';
import { useWallet } from 'providers/WalletProvider';

import { winstonToAr } from '../app/App';
import { announceFungibleOperationActivityChange } from '../app/operation-activity';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;

function shortAddress(address: string): string {
	return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function tokenAmount(raw: string, state: Pick<AssetState, 'denomination' | 'ticker'>): string {
	const [whole, fraction] = formatTokenAmount(raw, state.denomination).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return `${fraction ? `${grouped}.${fraction}` : grouped} ${state.ticker || 'tokens'}`;
}

function dispatchErrorMessage(cause: unknown): string {
	const message = cause instanceof Error ? cause.message : String(cause);
	switch (message) {
		case 'dispatch-insufficient-token-balance':
			return 'Your token balance is smaller than the total quantity in the holder list.';
		case 'dispatch-self-recipient':
			return 'Remove your own address from the list. A transfer to yourself is a no-op that balance-based settlement cannot verify.';
		case 'asset-state-timeout':
			return 'Timed out waiting for settlement. Nothing was lost: posted transfers stay posted — resume to continue watching without re-sending.';
		case 'wallet-sign-unavailable':
			return 'Connect an Arweave wallet extension that supports transaction signing.';
		case 'asset-purchase-insufficient-funds':
			return 'Your AR balance cannot cover the transfer amounts plus network rewards.';
		case 'wallet-account-changed':
			return 'The connected wallet changed mid-dispatch. Reconnect the wallet that started this dispatch and resume.';
	}
	if (message.startsWith('transaction-dispatch-')) return `Arweave rejected a transfer: ${message}`;
	return message || 'Dispatch failed.';
}

const STATUS_LABEL = { unsent: 'Unsent', posted: 'Posted', settled: 'Settled' } as const;

export default function DispatchRoute() {
	const { processId = '' } = useParams();
	const wallet = useWallet();
	const validId = ADDRESS.test(processId);
	const abortRef = React.useRef<AbortController | null>(null);
	const [state, setState] = React.useState<AssetState | null>(null);
	const [stateError, setStateError] = React.useState<string | null>(null);
	const [loadingState, setLoadingState] = React.useState(false);
	const [stateAttempt, setStateAttempt] = React.useState(0);
	const [holderRows, setHolderRows] = React.useState<HolderDraftRow[]>([{ address: '', quantity: '' }]);
	const [reward, setReward] = React.useState<bigint | null>(null);
	const [plan, setPlan] = React.useState<DispatchPlan | null>(() => (validId ? loadDispatchPlan(processId) : null));
	const [running, setRunning] = React.useState(false);
	const [runError, setRunError] = React.useState<string | null>(null);
	const [costApproved, setCostApproved] = React.useState(false);

	React.useEffect(() => () => abortRef.current?.abort(), []);
	React.useEffect(() => {
		if (!validId) return;
		const controller = new AbortController();
		setLoadingState(true);
		setStateError(null);
		void readAssetState(processId, { signal: controller.signal, maxAge: 0 })
			.then(
				(result) => {
					if (!controller.signal.aborted) setState(result.state);
				},
				() => {
					if (!controller.signal.aborted) {
						setStateError(
							'The token process state is not readable yet. A freshly minted token only becomes readable once the arweave-scheduler sequences its creation — around 20 minutes on mainnet. Retry once it has settled.'
						);
					}
				}
			)
			.finally(() => {
				if (!controller.signal.aborted) setLoadingState(false);
			});
		return () => controller.abort();
	}, [processId, validId, stateAttempt]);
	React.useEffect(() => {
		if (!validId || !state) return;
		const controller = new AbortController();
		void fetchTransferReward(arweaveGatewayFromLocation(), processId, undefined, controller.signal).then(
			(value) => {
				if (!controller.signal.aborted) setReward(value);
			},
			() => undefined
		);
		return () => controller.abort();
	}, [processId, validId, state]);

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
	const needsCostApproval = Boolean(estimate && requiresCostConfirmation(estimate.totalWinston));
	const planSettled = plan ? plan.rows.filter((row) => row.status === 'settled').length : 0;
	const planPosted = plan ? plan.rows.filter((row) => row.status === 'posted').length : 0;
	const planComplete = Boolean(plan && planSettled === plan.rows.length);
	const senderMismatch = Boolean(plan && wallet.address && plan.sender !== wallet.address);
	const balance = state && wallet.address ? liquidBalanceOf(state, wallet.address) : null;

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

	const execute = async (dispatchPlan: DispatchPlan) => {
		const controller = new AbortController();
		abortRef.current = controller;
		setRunning(true);
		setRunError(null);
		const sender = dispatchPlan.sender;
		const total = dispatchPlan.rows.length;
		const startedAt = Date.now();
		dispatchActivity(sender, 'working', `Dispatching to ${total} holder${total === 1 ? '' : 's'}…`, startedAt);
		try {
			await runDispatch(dispatchPlan, {
				signal: controller.signal,
				batchSize: DEFAULT_DISPATCH_BATCH_SIZE,
				onProgress: (next) => {
					setPlan(next);
					const settled = next.rows.filter((row) => row.status === 'settled').length;
					dispatchActivity(sender, 'working', `${settled} of ${next.rows.length} settled`, startedAt);
				},
			});
			dispatchActivity(sender, 'done', '', startedAt);
		} catch (cause) {
			if (!controller.signal.aborted) {
				setRunError(dispatchErrorMessage(cause));
				dispatchActivity(sender, 'error', dispatchErrorMessage(cause), startedAt);
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
		if (!parsed?.rows.length || parsed.errors.length || running) return;
		if (needsCostApproval && !costApproved) return;
		setRunError(null);
		try {
			// walletBalance pre-flights the full AR spend (atomic token units are
			// in winston — the protocol quantity shadows the quantity tag) so a
			// long dispatch does not die halfway through on an empty wallet.
			if (estimate) {
				const arBalance = await new AssetTransactionClient().walletBalance(wallet.address);
				if (arBalance < estimate.totalWinston) throw new Error('asset-purchase-insufficient-funds');
			}
			const created = await createDispatchPlan(processId, wallet.address, parsed.rows);
			setPlan(created);
			await execute(created);
		} catch (cause) {
			setRunError(dispatchErrorMessage(cause));
		}
	};

	const resume = async () => {
		if (!plan || running || senderMismatch) return;
		await execute(plan);
	};

	const discard = () => {
		if (running) return;
		if (plan) dispatchActivity(plan.sender, 'done', '', 0);
		discardDispatchPlan(processId);
		setPlan(null);
		setRunError(null);
	};

	if (!validId) {
		return (
			<section className="create-page dispatch-page">
				<div className="create-heading">
					<div>
						<p className="eyebrow">Dispatch</p>
						<h1>Unknown token</h1>
					</div>
					<p>The address in the URL is not a 43-character Arweave process ID.</p>
				</div>
			</section>
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
						<strong>Token state not readable yet</strong>
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
							<dd>{wallet.address ? tokenAmount(balance ?? '0', state) : 'Connect wallet'}</dd>
						</div>
					</dl>
					<Link to={`/asset/${FUNGIBLE_TOKEN_COLLECTION_ID}/${processId}`}>View token page</Link>
				</div>
			) : null}

			{plan ? (
				<div className="dispatch-plan">
					<div className="dispatch-plan-heading">
						<div>
							<strong>
								{planComplete
									? 'Dispatch complete'
									: running
									? 'Dispatching…'
									: 'Saved dispatch in progress'}
							</strong>
							<span>
								{planSettled} of {plan.rows.length} settled
								{planPosted ? ` · ${planPosted} posted, awaiting settlement` : ''} · started from{' '}
								{shortAddress(plan.sender)}
							</span>
						</div>
						<div>
							{!planComplete ? (
								<Button
									type="button"
									size="custom"
									onClick={() => void resume()}
									disabled={running || senderMismatch}
								>
									{running ? 'Working…' : 'Resume'}
								</Button>
							) : null}
							<Button type="button" size="custom" variant="danger" onClick={discard} disabled={running}>
								{planComplete ? 'Clear' : 'Discard plan'}
							</Button>
						</div>
					</div>
					{senderMismatch ? (
						<div className="inline-error">
							<span>
								This dispatch was started from {shortAddress(plan.sender)}. Connect that wallet to
								resume it.
							</span>
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
											<code title={row.address}>{shortAddress(row.address)}</code>
										</td>
										<td>{state ? tokenAmount(row.quantity, state) : '—'}</td>
										<td>
											{row.status === 'settled' ? (
												<Check className="ui-icon ui-icon--sm" aria-hidden="true" />
											) : null}{' '}
											{STATUS_LABEL[row.status]}
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
								<p>Every recipient balance has risen by its dispatched quantity.</p>
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
						<div className="create-field">
							<label>Holder list</label>
							<HolderListField
								rows={holderRows}
								disabled={running}
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
							<div className="inline-error">
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
														<code title={row.address}>{shortAddress(row.address)}</code>
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
										<strong>
											{estimate ? `${winstonToAr(estimate.totalWinston.toString())} AR` : '—'}
										</strong>
									</div>
								</div>
								<div className="mint-notice">
									<Info className="ui-icon" aria-hidden="true" />
									<span>
										Each recipient is one L1 transfer signed in your wallet ({parsed.rows.length}{' '}
										signature{parsed.rows.length === 1 ? '' : 's'}, sent in batches of{' '}
										{DEFAULT_DISPATCH_BATCH_SIZE}). Behind this form, each token amount is converted
										to atomic units. The protocol requires the same winston quantity, so this quote
										includes {estimate ? winstonToAr(estimate.totalQuantity.toString()) : '0'} AR
										from atomic transfer quantities plus network rewards.
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
											<small>
												Token amounts are converted to atomic units before signing. The protocol
												charges 1 AR per 1e12 atomic units per transfer. Approve the quote to
												enable sending.
											</small>
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

						{runError ? (
							<div className="inline-error">
								<span>{runError}</span>
							</div>
						) : null}

						<Button
							className="mint-submit"
							type="submit"
							size="custom"
							disabled={
								running ||
								!state ||
								!parsed?.rows.length ||
								Boolean(parsed?.errors.length) ||
								Boolean(wallet.address && !estimate) ||
								(needsCostApproval && !costApproved)
							}
						>
							{running
								? 'Dispatching…'
								: wallet.address
								? 'Sign and dispatch'
								: 'Connect wallet to dispatch'}
							{!running ? <ArrowRight className="ui-icon" aria-hidden="true" /> : null}
						</Button>
						<p className="mint-permanence">
							Confirmed Arweave transfers are permanent. Review every address and quantity before signing.
						</p>
					</form>
				</div>
			)}

			{plan && runError ? (
				<div className="inline-error">
					<span>{runError}</span>
				</div>
			) : null}
		</section>
	);
}
