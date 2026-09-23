import React from 'react';
import { ArrowRight, Check, Info } from 'lucide-react';

import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Tooltip } from 'components/atoms/Tooltip';
import { winstonToAr } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { DISPATCH_MESSAGES } from '../../../messages';
import { formatDispatchTokenAmount, type HolderDispatchQuote, shortAddress } from '../../../model/dispatch';
import type { HolderDraftRow } from '../../../model/holder-list';
import { holderListIssueMessage } from '../../../model/holder-list-issue';
import { HolderListField } from '../../molecules/HolderListField';

/** Inline parse errors beyond this count collapse into a single "and N more" line. */
const VISIBLE_HOLDER_LIST_ERRORS = 8;

export default function HolderDispatchForm(props: {
	token: AssetState | null;
	holderRows: HolderDraftRow[];
	quote: HolderDispatchQuote;
	costApproved: boolean;
	walletConnected: boolean;
	balanceStateAvailable: boolean;
	running: boolean;
	error: string | null;
	onHolderRowsChange: (rows: HolderDraftRow[]) => void;
	onCostApprovalToggle: () => void;
	onSubmit: () => void;
}) {
	const messages = useMessages(DISPATCH_MESSAGES);
	const plural = usePlural();
	const parsed = props.quote.parsed;
	const estimate = props.quote.estimate;

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		props.onSubmit();
	};

	return (
		<div className="create-layout dispatch-layout">
			<form className="create-form" onSubmit={handleSubmit}>
				<div className="create-field">
					<label>{messages.dispatchHolderListLabel}</label>
					<HolderListField
						rows={props.holderRows}
						disabled={props.running}
						denomination={props.token?.denomination ?? 0}
						ticker={props.token?.ticker || messages.dispatchTokenFallbackTicker}
						onChange={props.onHolderRowsChange}
					/>
					<span>
						{parsed?.rows.length
							? plural(messages.dispatchParsedRecipients, parsed.rows.length)
							: messages.dispatchHolderListHint}
					</span>
				</div>

				{parsed?.errors.length ? (
					<div className="inline-error">
						<span>
							{parsed.errors.slice(0, VISIBLE_HOLDER_LIST_ERRORS).map((entry, index) => (
								<React.Fragment key={index}>
									{holderListIssueMessage(entry, messages, plural)}
									<br />
								</React.Fragment>
							))}
							{parsed.errors.length > VISIBLE_HOLDER_LIST_ERRORS
								? formatMessage(messages.dispatchMoreErrors, {
										count: parsed.errors.length - VISIBLE_HOLDER_LIST_ERRORS,
								  })
								: null}
						</span>
					</div>
				) : null}

				{parsed?.rows.length && !parsed.errors.length ? (
					<>
						<div className="dispatch-table-wrapper">
							<table className="dispatch-table">
								<thead>
									<tr>
										<th scope="col">{messages.dispatchTableRecipient}</th>
										<th scope="col">{messages.dispatchTableTokenAmount}</th>
									</tr>
								</thead>
								<tbody>
									{parsed.rows.map((row) => (
										<tr key={row.address}>
											<td>
												<Tooltip content={row.address} placement="top">
													{(tooltipId) => (
														<code aria-describedby={tooltipId}>
															{shortAddress(row.address)}
														</code>
													)}
												</Tooltip>
											</td>
											<td>
												{props.token
													? formatDispatchTokenAmount(row.quantity, props.token, messages)
													: '—'}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="mint-summary">
							<div>
								<span>{messages.dispatchSummaryRecipients}</span>
								<strong>{parsed.rows.length}</strong>
							</div>
							<div>
								<span>{messages.dispatchSummaryTotalTokenAmount}</span>
								<strong>
									{estimate && props.token
										? formatDispatchTokenAmount(
												estimate.totalQuantity.toString(),
												props.token,
												messages
										  )
										: '—'}
								</strong>
							</div>
							<div>
								<span>{messages.dispatchSummaryTotalArCost}</span>
								<strong>
									{estimate
										? formatMessage(messages.dispatchArAmount, {
												amount: winstonToAr(estimate.totalWinston.toString()),
										  })
										: '—'}
								</strong>
							</div>
						</div>
						<div className="mint-notice">
							<Icon icon={Info} />
							<span>
								{plural(messages.dispatchSignatureNotice, parsed.rows.length, {
									batchSize: props.quote.batchSize,
								})}
							</span>
						</div>
						{props.quote.needsCostApproval ? (
							<section className="mint-cost-warning" aria-labelledby="dispatch-cost-warning-title">
								<div>
									<strong id="dispatch-cost-warning-title">
										{messages.dispatchCostWarningTitle}
									</strong>
									<span>
										{messages.dispatchCostWarningExpected}{' '}
										<b>
											{formatMessage(messages.dispatchArAmount, {
												amount: estimate ? winstonToAr(estimate.totalWinston.toString()) : '0',
											})}
										</b>{' '}
										{messages.dispatchCostWarningSpend}
									</span>
									<small>{messages.dispatchCostWarningHint}</small>
								</div>
								<Button
									type="button"
									size="custom"
									aria-pressed={props.costApproved}
									className={props.costApproved ? 'approved' : undefined}
									onClick={props.onCostApprovalToggle}
								>
									{props.costApproved ? <Icon icon={Check} size="sm" /> : null}
									{props.costApproved ? messages.dispatchCostApproved : messages.dispatchCostApprove}
								</Button>
							</section>
						) : null}
					</>
				) : null}

				{props.error ? (
					<div className="inline-error">
						<span>{props.error}</span>
					</div>
				) : null}

				<Button
					className="mint-submit"
					type="submit"
					size="custom"
					disabled={
						props.running ||
						!props.token ||
						!props.balanceStateAvailable ||
						!parsed?.rows.length ||
						Boolean(parsed?.errors.length) ||
						Boolean(props.walletConnected && !estimate) ||
						(props.quote.needsCostApproval && !props.costApproved)
					}
				>
					{props.running
						? messages.dispatchSubmitRunning
						: props.walletConnected
						? messages.dispatchSubmit
						: messages.dispatchSubmitConnectWallet}
					{!props.running ? <Icon icon={ArrowRight} /> : null}
				</Button>
				<p className="mint-permanence">{messages.dispatchPermanenceNote}</p>
			</form>
		</div>
	);
}
