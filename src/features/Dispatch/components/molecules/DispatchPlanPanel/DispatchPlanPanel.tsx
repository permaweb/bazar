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
		<div className="dispatch-plan">
			<div className="dispatch-plan-heading">
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
			</div>
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
				<div className="mint-notice">
					<Icon icon={Info} />
					<span>{messages.dispatchPlanSettlementNotice}</span>
				</div>
			) : null}
			<div className="dispatch-table-wrapper">
				<table className="dispatch-table">
					<thead>
						<tr>
							<th scope="col">{messages.dispatchTableRecipient}</th>
							<th scope="col">{messages.dispatchTableTokenAmount}</th>
							<th scope="col">{messages.dispatchTableStatus}</th>
						</tr>
					</thead>
					<tbody>
						{props.plan.rows.map((row) => (
							<tr key={row.address} className={`dispatch-row-${row.status}`}>
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
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{props.progress.complete ? (
				<div className="mint-success">
					<span>
						<Check aria-hidden="true" />
					</span>
					<div>
						<strong>{messages.dispatchPlanSettledTitle}</strong>
						<p>{messages.dispatchPlanSettledDetail}</p>
					</div>
				</div>
			) : null}
		</div>
	);
}
