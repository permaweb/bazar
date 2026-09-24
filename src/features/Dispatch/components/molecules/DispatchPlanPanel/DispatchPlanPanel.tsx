import React from 'react';
import { Check, Info } from 'lucide-react';

import type { DispatchPlan } from 'api/dispatch';
import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Tooltip } from 'components/atoms/Tooltip';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { DISPATCH_MESSAGES } from '../../../messages';
import {
	type DispatchPlanProgress,
	dispatchRowStatusLabel,
	formatDispatchTokenAmount,
	shortAddress,
} from '../../../model/dispatch';

import * as S from './styles';

export default function DispatchPlanPanel(props: {
	plan: DispatchPlan;
	progress: DispatchPlanProgress;
	running: boolean;
	token: AssetState | null;
	onResume: () => void;
	onDiscard: () => void;
}) {
	const messages = useMessages(DISPATCH_MESSAGES);

	return (
		<S.Plan className="dispatch-plan">
			<S.PlanHeading className="dispatch-plan-heading">
				<div>
					<strong>
						{props.progress.complete
							? messages.dispatchPlanComplete
							: props.running
							? messages.dispatchPlanRunning
							: messages.dispatchPlanSaved}
					</strong>
					<span>
						{formatMessage(messages.dispatchPlanSettled, {
							settled: props.progress.settled,
							total: props.plan.rows.length,
						})}
						{props.progress.posted
							? formatMessage(messages.dispatchPlanPosted, { posted: props.progress.posted })
							: ''}
						{formatMessage(messages.dispatchPlanStartedFrom, { sender: shortAddress(props.plan.sender) })}
					</span>
				</div>
				<div>
					{!props.progress.complete ? (
						<Button
							type="button"
							size="custom"
							onClick={props.onResume}
							disabled={props.running || props.progress.senderMismatch}
						>
							{props.running ? messages.dispatchPlanWorking : messages.dispatchPlanResume}
						</Button>
					) : null}
					<Button
						type="button"
						size="custom"
						variant="danger"
						onClick={props.onDiscard}
						disabled={props.running}
					>
						{props.progress.complete ? messages.dispatchPlanClear : messages.dispatchPlanDiscard}
					</Button>
				</div>
			</S.PlanHeading>
			{props.progress.senderMismatch ? (
				<div className="inline-error">
					<span>
						{formatMessage(messages.dispatchPlanSenderMismatch, {
							sender: shortAddress(props.plan.sender),
						})}
					</span>
				</div>
			) : null}
			{props.running && props.progress.posted ? (
				<S.Notice className="mint-notice">
					<Icon icon={Info} />
					<span>{messages.dispatchPlanSettlementNotice}</span>
				</S.Notice>
			) : null}
			<S.TableWrapper className="dispatch-table-wrapper">
				<S.Table className="dispatch-table">
					<thead>
						<tr>
							<th scope="col">{messages.dispatchTableRecipient}</th>
							<th scope="col">{messages.dispatchTableTokenAmount}</th>
							<th scope="col">{messages.dispatchTableStatus}</th>
						</tr>
					</thead>
					<tbody>
						{props.plan.rows.map((row) => (
							<S.PlanRow key={row.address} className={`dispatch-row-${row.status}`}>
								<td>
									<Tooltip content={row.address} placement="top">
										{(tooltipId) => (
											<code aria-describedby={tooltipId}>{shortAddress(row.address)}</code>
										)}
									</Tooltip>
								</td>
								<td>
									{props.token ? formatDispatchTokenAmount(row.quantity, props.token, messages) : '—'}
								</td>
								<td>
									{row.status === 'settled' ? <Icon icon={Check} size="sm" /> : null}{' '}
									{dispatchRowStatusLabel(row.status, messages)}
								</td>
							</S.PlanRow>
						))}
					</tbody>
				</S.Table>
			</S.TableWrapper>
			{props.progress.complete ? (
				<S.Success className="mint-success">
					<span>
						<Check aria-hidden="true" />
					</span>
					<div>
						<strong>{messages.dispatchPlanSettledTitle}</strong>
						<p>{messages.dispatchPlanSettledDetail}</p>
					</div>
				</S.Success>
			) : null}
		</S.Plan>
	);
}
