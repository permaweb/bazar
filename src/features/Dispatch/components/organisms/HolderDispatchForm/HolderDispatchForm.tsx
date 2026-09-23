import React from 'react';
import { ArrowRight, Check, Info } from 'lucide-react';

import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Tooltip } from 'components/atoms/Tooltip';
import { winstonToAr } from 'helpers/ar-units';

import { formatDispatchTokenAmount, type HolderDispatchQuote, shortAddress } from '../../../model/dispatch';
import type { HolderDraftRow } from '../../../model/holder-list';
import { HolderListField } from '../../molecules/HolderListField';

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
					<label>Holder list</label>
					<HolderListField
						rows={props.holderRows}
						disabled={props.running}
						denomination={props.token?.denomination ?? 0}
						ticker={props.token?.ticker || 'tokens'}
						onChange={props.onHolderRowsChange}
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
													? formatDispatchTokenAmount(row.quantity, props.token)
													: '—'}
											</td>
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
									{estimate && props.token
										? formatDispatchTokenAmount(estimate.totalQuantity.toString(), props.token)
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
							<Icon icon={Info} />
							<span>
								Each recipient is one L1 transfer signed in your wallet ({parsed.rows.length} signature
								{parsed.rows.length === 1 ? '' : 's'}, sent in batches of {props.quote.batchSize}).
								Behind this form, each token amount is converted to atomic units. The AR quote includes
								network rewards only.
							</span>
						</div>
						{props.quote.needsCostApproval ? (
							<section className="mint-cost-warning" aria-labelledby="dispatch-cost-warning-title">
								<div>
									<strong id="dispatch-cost-warning-title">
										This dispatch costs more than 0.1 AR
									</strong>
									<span>
										Expected{' '}
										<b>{estimate ? winstonToAr(estimate.totalWinston.toString()) : '0'} AR</b> in
										real AR spend
									</span>
									<small>Approve the network quote to enable sending.</small>
								</div>
								<Button
									type="button"
									size="custom"
									aria-pressed={props.costApproved}
									className={props.costApproved ? 'approved' : undefined}
									onClick={props.onCostApprovalToggle}
								>
									{props.costApproved ? <Icon icon={Check} size="sm" /> : null}
									{props.costApproved ? 'Approved' : 'Approve quote'}
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
						? 'Dispatching…'
						: props.walletConnected
						? 'Sign and dispatch'
						: 'Connect wallet to dispatch'}
					{!props.running ? <Icon icon={ArrowRight} /> : null}
				</Button>
				<p className="mint-permanence">
					Confirmed Arweave transfers are permanent. Review every address and quantity before signing.
				</p>
			</form>
		</div>
	);
}
