import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Eyebrow } from 'components/atoms/Eyebrow';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { TokenArtwork } from 'components/atoms/TokenArtwork';
import { AssetBalanceStateNotice } from 'features/Operations';
import { asyncData, asyncError, isAsyncPending } from 'helpers/async-state';
import { useWallet } from 'providers/WalletProvider';

import { useDispatchToken } from '../../../hooks/useDispatchToken';
import { useHolderDispatch } from '../../../hooks/useHolderDispatch';
import {
	dispatchRunError,
	dispatchSenderBalance,
	formatDispatchTokenAmount,
	holderDispatchQuote,
	shortAddress,
	tokenPagePath,
} from '../../../model/dispatch';
import { EMPTY_HOLDER_ROW, type HolderDraftRow, holderListText } from '../../../model/holder-list';
import { DispatchPlanPanel } from '../../molecules/DispatchPlanPanel';
import { HolderDispatchForm } from '../HolderDispatchForm';

/** Dispatch for one valid token process. Keyed by process ID so every piece of state belongs to one token. */
export default function TokenDispatch(props: { processId: string }) {
	const wallet = useWallet();
	const dispatchToken = useDispatchToken(props.processId);
	const token = asyncData(dispatchToken.token) ?? null;
	const transferReward = asyncData(dispatchToken.transferReward) ?? null;
	const dispatch = useHolderDispatch(props.processId, token);
	const [holderRows, setHolderRows] = React.useState<HolderDraftRow[]>([EMPTY_HOLDER_ROW]);
	const [costApproved, setCostApproved] = React.useState(false);
	const holderText = React.useMemo(() => holderListText(holderRows), [holderRows]);
	const quote = React.useMemo(
		() => holderDispatchQuote(holderText, token, transferReward),
		[holderText, token, transferReward]
	);
	const sender = dispatchSenderBalance(token, wallet.address);
	const runError = dispatchRunError(dispatch.run);
	const running = dispatch.run.status === 'running';

	const handleHolderRowsChange = (next: HolderDraftRow[]) => {
		setHolderRows(next);
		setCostApproved(false);
		dispatch.clearError();
	};

	return (
		<section className="create-page dispatch-page">
			<div className="create-heading">
				<div>
					<Eyebrow>Dispatch fungible token</Eyebrow>
					<h1>
						{token
							? token.name || token.ticker || shortAddress(props.processId)
							: shortAddress(props.processId)}
					</h1>
				</div>
				<p>
					Send token amounts from a pasted holder list. Bazar converts them to atomic units for individual
					Arweave L1 transfers and saves progress locally so you can resume.
				</p>
			</div>

			{isAsyncPending(dispatchToken.token) ? <Loading label="Reading token state…" /> : null}
			{asyncError(dispatchToken.token) ? (
				<div className="mint-recovery" role="status">
					<div>
						<strong>Token state not readable yet</strong>
						<span>
							The token process state is not readable yet. A freshly minted token only becomes readable
							once the arweave-scheduler sequences its creation — around 20 minutes on mainnet. Retry once
							it has settled.
						</span>
					</div>
					<div>
						<Button type="button" size="custom" onClick={dispatchToken.retry}>
							<Icon icon={RefreshCw} size="sm" /> Retry
						</Button>
					</div>
				</div>
			) : null}

			{token ? (
				<div className="dispatch-token-summary">
					<TokenArtwork ticker={token.ticker || 'TOKEN'} />
					<dl>
						<div>
							<dt>Ticker</dt>
							<dd>{token.ticker || '—'}</dd>
						</div>
						<div>
							<dt>Total supply</dt>
							<dd>{formatDispatchTokenAmount(token.totalSupply, token)}</dd>
						</div>
						<div>
							<dt>Denomination</dt>
							<dd>{token.denomination}</dd>
						</div>
						<div>
							<dt>Your balance</dt>
							<dd>
								{wallet.address
									? sender.balanceStateAvailable
										? formatDispatchTokenAmount(sender.balance ?? '0', token)
										: 'Unavailable'
									: 'Connect wallet'}
							</dd>
						</div>
					</dl>
					<Link to={tokenPagePath(props.processId)}>View token page</Link>
				</div>
			) : null}
			{token ? <AssetBalanceStateNotice state={token} /> : null}

			{dispatch.plan ? (
				<DispatchPlanPanel
					plan={dispatch.plan}
					progress={dispatch.progress}
					running={running}
					token={token}
					onResume={() => void dispatch.resume()}
					onDiscard={dispatch.discard}
				/>
			) : (
				<HolderDispatchForm
					token={token}
					holderRows={holderRows}
					quote={quote}
					costApproved={costApproved}
					walletConnected={Boolean(wallet.address)}
					balanceStateAvailable={sender.balanceStateAvailable}
					running={running}
					error={runError}
					onHolderRowsChange={handleHolderRowsChange}
					onCostApprovalToggle={() => setCostApproved((current) => !current)}
					onSubmit={() => void dispatch.start(quote, costApproved)}
				/>
			)}

			{dispatch.plan && runError ? (
				<div className="inline-error">
					<span>{runError}</span>
				</div>
			) : null}
		</section>
	);
}
