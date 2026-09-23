import React from 'react';

import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';

import { type FungibleHolder, fungibleHoldingPercentage } from '../../../model/fungible-holders';
import { tokenLabel } from '../../../model/fungible-market';
import { FungibleHolderIdentity } from '../../molecules/FungibleHolderIdentity';

const HOLDER_REVEAL_STEP = 50;

export default function FungibleHolderTable(props: {
	assetName: string;
	holders: FungibleHolder[];
	limit: number;
	state: AssetState;
	onLimitChange(limit: number): void;
}) {
	const revealStatusRef = React.useRef<HTMLParagraphElement>(null);
	const visibleRows = props.holders.slice(0, props.limit);

	function handleReveal() {
		const next = Math.min(props.holders.length, props.limit + HOLDER_REVEAL_STEP);
		props.onLimitChange(next);
		if (next === props.holders.length) {
			window.requestAnimationFrame(() => revealStatusRef.current?.focus());
		}
	}

	return (
		<>
			<div
				aria-label={`${props.assetName} token holders`}
				className="orderbook-table fungible-holder-table"
				role="table"
			>
				<div className="orderbook-head" role="row">
					<span role="columnheader">Holder</span>
					<span role="columnheader">Total balance</span>
					<span role="columnheader">Share</span>
					<span role="columnheader">Listed</span>
				</div>
				{visibleRows.map((holder) => (
					<div className="orderbook-row" key={holder.address} role="row">
						<span data-label="Holder" role="cell">
							<FungibleHolderIdentity address={holder.address} />
						</span>
						<strong data-label="Total balance" role="cell">
							{tokenLabel(holder.total, props.state)}
						</strong>
						<span className="fungible-holder-share" data-label="Share" role="cell">
							{fungibleHoldingPercentage(holder.total, props.state.totalSupply)}
						</span>
						<span data-label="Listed" role="cell">
							{BigInt(holder.listed) > 0n ? tokenLabel(holder.listed, props.state) : '—'}
						</span>
					</div>
				))}
				{!props.holders.length ? (
					<div className="orderbook-empty" role="row">
						<div aria-colspan={4} className="orderbook-empty-cell" role="cell">
							<strong>No holders found</strong>
							<span>The current process state does not contain a positive balance.</span>
						</div>
					</div>
				) : null}
			</div>
			{props.holders.length > HOLDER_REVEAL_STEP ? (
				<div className="orderbook-reveal">
					<p aria-atomic="true" aria-live="polite" ref={revealStatusRef} role="status" tabIndex={-1}>
						Showing {visibleRows.length.toLocaleString()} of {props.holders.length.toLocaleString()}{' '}
						holders.
					</p>
					{visibleRows.length < props.holders.length ? (
						<Button type="button" size="custom" onClick={handleReveal}>
							Show{' '}
							{Math.min(HOLDER_REVEAL_STEP, props.holders.length - visibleRows.length).toLocaleString()}{' '}
							more holders
						</Button>
					) : null}
				</div>
			) : null}
		</>
	);
}
