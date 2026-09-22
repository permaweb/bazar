import React from 'react';

import type { AssetState } from 'api/marketplace';

import {
	FungibleHolder,
	fungibleHolderChartSlices,
	fungibleHoldingPercentage,
	fungibleOfferedPercentage,
	HOLDER_CHART_COLORS,
	holderChartPercentage,
} from '../../../model/fungible-holders';
import { tokenLabel } from '../../../model/fungible-market';
import { FungibleHolderIdentity } from '../../molecules/FungibleHolderIdentity';

export default function FungibleHolderChart(props: {
	assetName: string;
	holders: FungibleHolder[];
	state: AssetState;
}) {
	const patternPrefix = React.useId().replace(/:/g, '');
	const slices = React.useMemo(() => fungibleHolderChartSlices(props.holders), [props.holders]);
	const [activeKey, setActiveKey] = React.useState(slices[0]?.key ?? '');
	React.useEffect(() => {
		if (!slices.some((slice) => slice.key === activeKey)) setActiveKey(slices[0]?.key ?? '');
	}, [activeKey, slices]);
	const active = slices.find((slice) => slice.key === activeKey) ?? slices[0];
	const heldSupply = React.useMemo(() => slices.reduce((total, slice) => total + BigInt(slice.total), 0n), [slices]);
	const declaredSupply = BigInt(props.state.totalSupply);
	const chartSupply = declaredSupply > heldSupply ? declaredSupply : heldSupply;
	let offset = 0n;
	const chartSlices = slices.map((slice, index) => {
		const total = BigInt(slice.total);
		const liquid = BigInt(slice.liquid);
		const start = holderChartPercentage(offset, chartSupply);
		const end = holderChartPercentage(offset + total, chartSupply);
		const span = end - start;
		const gap = Math.min(0.34, span * 0.12);
		const visibleStart = start + gap / 2;
		const visibleSpan = Math.max(0, span - gap);
		const liquidSpan = total > 0n ? (visibleSpan * holderChartPercentage(liquid, total)) / 100 : 0;
		offset += total;
		return {
			...slice,
			color: HOLDER_CHART_COLORS[index % HOLDER_CHART_COLORS.length],
			liquidSpan,
			listedSpan: Math.max(0, visibleSpan - liquidSpan),
			start: visibleStart,
		};
	});

	if (!active || chartSupply <= 0n) return null;
	const activeShare = fungibleHoldingPercentage(active.total, props.state.totalSupply);
	const activeOffered = fungibleOfferedPercentage(active.listed, active.total);

	return (
		<section aria-labelledby="fungible-holder-chart-title" className="fungible-holder-chart-card">
			<div className="fungible-holder-chart-visual">
				<svg aria-label={`${props.assetName} supply distribution`} role="list" viewBox="0 0 240 240">
					<defs>
						{chartSlices.map((slice) => (
							<pattern
								height="7"
								id={`${patternPrefix}-${slice.key}`}
								key={slice.key}
								patternTransform="rotate(38)"
								patternUnits="userSpaceOnUse"
								width="7"
							>
								<rect fill={slice.color} height="7" width="7" />
								<path d="m 0 0 v 7" stroke="var(--paper)" strokeOpacity="0.72" strokeWidth="2.25" />
							</pattern>
						))}
					</defs>
					<circle className="fungible-holder-chart-track" cx="120" cy="120" pathLength="100" r="82" />
					{chartSlices.map((slice) => {
						const share = fungibleHoldingPercentage(slice.total, props.state.totalSupply);
						const offered = fungibleOfferedPercentage(slice.listed, slice.total);
						const label = `${slice.label}: ${share} of supply; ${offered} offered for sale`;
						return (
							<g
								aria-label={label}
								className={`fungible-holder-chart-slice${slice.key === active.key ? ' is-active' : ''}`}
								key={slice.key}
								onFocus={() => setActiveKey(slice.key)}
								onMouseEnter={() => setActiveKey(slice.key)}
								role="listitem"
								tabIndex={0}
							>
								<title>{label}</title>
								{slice.liquidSpan > 0 ? (
									<circle
										className="fungible-holder-chart-arc"
										cx="120"
										cy="120"
										pathLength="100"
										r="82"
										stroke={slice.color}
										strokeDasharray={`${slice.liquidSpan} ${100 - slice.liquidSpan}`}
										strokeDashoffset={-slice.start}
									/>
								) : null}
								{slice.listedSpan > 0 ? (
									<circle
										className="fungible-holder-chart-arc"
										cx="120"
										cy="120"
										pathLength="100"
										r="82"
										stroke={`url(#${patternPrefix}-${slice.key})`}
										strokeDasharray={`${slice.listedSpan} ${100 - slice.listedSpan}`}
										strokeDashoffset={-(slice.start + slice.liquidSpan)}
									/>
								) : null}
								<circle
									className="fungible-holder-chart-hit"
									cx="120"
									cy="120"
									pathLength="100"
									r="82"
									strokeDasharray={`${slice.liquidSpan + slice.listedSpan} ${
										100 - slice.liquidSpan - slice.listedSpan
									}`}
									strokeDashoffset={-slice.start}
								/>
							</g>
						);
					})}
					<text className="fungible-holder-chart-value" textAnchor="middle" x="120" y="116">
						{activeShare}
					</text>
					<text className="fungible-holder-chart-label" textAnchor="middle" x="120" y="136">
						of supply
					</text>
				</svg>
			</div>
			<div className="fungible-holder-chart-detail">
				<header>
					<div>
						<h2 id="fungible-holder-chart-title">Supply distribution</h2>
						<p>Select a ring segment to inspect a holder.</p>
					</div>
					<span>{props.holders.length.toLocaleString()} holders</span>
				</header>
				<div className="fungible-holder-chart-identity">
					<span>Selected holder</span>
					{active.address ? (
						<FungibleHolderIdentity address={active.address} />
					) : (
						<strong>{active.label}</strong>
					)}
				</div>
				<dl>
					<div>
						<dt>Supply share</dt>
						<dd>{activeShare}</dd>
					</div>
					<div>
						<dt>Offered for sale</dt>
						<dd>{activeOffered}</dd>
					</div>
				</dl>
				<div className="fungible-holder-chart-balances">
					<div>
						<span>Total balance</span>
						<strong>{tokenLabel(active.total, props.state)}</strong>
					</div>
					<div>
						<span>Listed</span>
						<strong>{BigInt(active.listed) > 0n ? tokenLabel(active.listed, props.state) : 'None'}</strong>
					</div>
				</div>
				<div aria-label="Chart legend" className="fungible-holder-chart-legend">
					<span>
						<i aria-hidden="true" /> Held
					</span>
					<span>
						<i aria-hidden="true" className="is-listed" /> Listed
					</span>
				</div>
			</div>
		</section>
	);
}
