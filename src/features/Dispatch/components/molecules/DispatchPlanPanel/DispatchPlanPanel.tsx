import React from 'react';
import { Check, Info } from 'lucide-react';

import type { DispatchPlan } from 'api/dispatch';
import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Tooltip } from 'components/atoms/Tooltip';

import {
	DISPATCH_STATUS_LABEL,
	type DispatchPlanProgress,
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
	return (
		<div className="dispatch-plan">
			<div className="dispatch-plan-heading">
				<div>
					<strong>
						{props.progress.complete
							? 'Dispatch complete'
							: props.running
							? 'Dispatching…'
							: 'Saved dispatch in progress'}
					</strong>
					<span>
						{props.progress.settled} of {props.plan.rows.length} settled
						{props.progress.posted ? ` · ${props.progress.posted} posted, awaiting settlement` : ''} ·
						started from {shortAddress(props.plan.sender)}
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
							{props.running ? 'Working…' : 'Resume'}
						</Button>
					) : null}
					<Button
						type="button"
						size="custom"
						variant="danger"
						onClick={props.onDiscard}
						disabled={props.running}
					>
						{props.progress.complete ? 'Clear' : 'Discard plan'}
					</Button>
				</div>
			</div>
			{props.progress.senderMismatch ? (
				<div className="inline-error">
					<span>
						This dispatch was started from {shortAddress(props.plan.sender)}. Connect that wallet to resume
						it.
					</span>
				</div>
			) : null}
			{props.running && props.progress.posted ? (
				<div className="mint-notice">
					<Icon icon={Info} />
					<span>
						Settlement is not instant: the scheduler only sequences a transfer once it sits ~10 blocks below
						the network tip (~20 minutes). Leaving this page is safe — resume later and nothing will be
						re-sent.
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
						{props.plan.rows.map((row) => (
							<tr key={row.address} className={`dispatch-row-${row.status}`}>
								<td>
									<Tooltip content={row.address} placement="top">
										{(tooltipId) => (
											<code aria-describedby={tooltipId}>{shortAddress(row.address)}</code>
										)}
									</Tooltip>
								</td>
								<td>{props.token ? formatDispatchTokenAmount(row.quantity, props.token) : '—'}</td>
								<td>
									{row.status === 'settled' ? <Icon icon={Check} size="sm" /> : null}{' '}
									{DISPATCH_STATUS_LABEL[row.status]}
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
						<strong>All transfers settled</strong>
						<p>Every recipient balance has risen by its dispatched quantity.</p>
					</div>
				</div>
			) : null}
		</div>
	);
}
