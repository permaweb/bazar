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
import { useMessages } from 'providers/LanguageProvider';
import { useWallet } from 'providers/WalletProvider';

import { useDispatchToken } from '../../../hooks/useDispatchToken';
import { useHolderDispatch } from '../../../hooks/useHolderDispatch';
import { DISPATCH_MESSAGES } from '../../../messages';
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

import * as S from './styles';

/** Dispatch for one valid token process. Keyed by process ID so every piece of state belongs to one token. */
export default function TokenDispatch(props: { processId: string }) {
	const messages = useMessages(DISPATCH_MESSAGES);
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
		<S.Page className="create-page dispatch-page">
			<S.Heading className="create-heading">
				<div>
					<Eyebrow>{messages.dispatchTokenEyebrow}</Eyebrow>
					<h1>
						{token
							? token.name || token.ticker || shortAddress(props.processId)
							: shortAddress(props.processId)}
					</h1>
				</div>
				<p>{messages.dispatchTokenIntro}</p>
			</S.Heading>

			{isAsyncPending(dispatchToken.token) ? <Loading label={messages.dispatchTokenLoading} /> : null}
			{asyncError(dispatchToken.token) ? (
				<S.Recovery className="mint-recovery" role="status">
					<div>
						<strong>{messages.dispatchTokenUnreadableTitle}</strong>
						<span>{messages.dispatchTokenUnreadableDetail}</span>
					</div>
					<div>
						<Button type="button" size="custom" onClick={dispatchToken.retry}>
							<Icon icon={RefreshCw} size="sm" /> {messages.dispatchTokenRetry}
						</Button>
					</div>
				</S.Recovery>
			) : null}

			{token ? (
				<S.TokenSummary className="dispatch-token-summary">
					<TokenArtwork
						subtitle={messages.dispatchTokenArtworkSubtitle}
						ticker={token.ticker || messages.dispatchArtworkFallbackTicker}
					/>
					<dl>
						<div>
							<dt>{messages.dispatchTokenTicker}</dt>
							<dd>{token.ticker || '—'}</dd>
						</div>
						<div>
							<dt>{messages.dispatchTokenTotalSupply}</dt>
							<dd>{formatDispatchTokenAmount(token.totalSupply, token, messages)}</dd>
						</div>
						<div>
							<dt>{messages.dispatchTokenDenomination}</dt>
							<dd>{token.denomination}</dd>
						</div>
						<div>
							<dt>{messages.dispatchTokenYourBalance}</dt>
							<dd>
								{wallet.address
									? sender.balanceStateAvailable
										? formatDispatchTokenAmount(sender.balance ?? '0', token, messages)
										: messages.dispatchTokenBalanceUnavailable
									: messages.dispatchTokenConnectWallet}
							</dd>
						</div>
					</dl>
					<Link to={tokenPagePath(props.processId)}>{messages.dispatchTokenPageLink}</Link>
				</S.TokenSummary>
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
		</S.Page>
	);
}
