import React from 'react';

import type { AssetState } from 'api/marketplace';

import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
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

import * as S from './styles';

export default function FungibleHolderChart(props: {
	assetName: string;
	holders: FungibleHolder[];
	state: AssetState;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const patternPrefix = React.useId().replace(/:/g, '');
	const slices = React.useMemo(() => fungibleHolderChartSlices(props.holders, messages), [messages, props.holders]);
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
		<S.Card aria-labelledby="fungible-holder-chart-title" className="fungible-holder-chart-card">
			<S.Visual className="fungible-holder-chart-visual">
				<svg
					aria-label={formatMessage(messages.holderChartLabel, { name: props.assetName })}
					role="list"
					viewBox="0 0 240 240"
				>
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
					<S.Track className="fungible-holder-chart-track" cx="120" cy="120" pathLength="100" r="82" />
					{chartSlices.map((slice) => {
						const share = fungibleHoldingPercentage(slice.total, props.state.totalSupply);
						const offered = fungibleOfferedPercentage(slice.listed, slice.total);
						const label = formatMessage(messages.holderChartSliceLabel, {
							label: slice.label,
							share,
							offered,
						});
						return (
							<S.Slice
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
									<S.Arc
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
									<S.Arc
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
								<S.Hit
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
							</S.Slice>
						);
					})}
					<S.Value className="fungible-holder-chart-value" textAnchor="middle" x="120" y="116">
						{activeShare}
					</S.Value>
					<S.Label className="fungible-holder-chart-label" textAnchor="middle" x="120" y="136">
						{messages.holderChartOfSupply}
					</S.Label>
				</svg>
			</S.Visual>
			<S.Detail className="fungible-holder-chart-detail">
				<header>
					<div>
						<h2 id="fungible-holder-chart-title">{messages.holderChartTitle}</h2>
						<p>{messages.holderChartHint}</p>
					</div>
					<span>
						{formatMessage(messages.holderChartHolderCount, {
							count: props.holders.length.toLocaleString(),
						})}
					</span>
				</header>
				<S.Identity className="fungible-holder-chart-identity">
					<span>{messages.holderChartSelectedHolder}</span>
					{active.address ? (
						<FungibleHolderIdentity address={active.address} />
					) : (
						<strong>{active.label}</strong>
					)}
				</S.Identity>
				<dl>
					<div>
						<dt>{messages.holderChartSupplyShare}</dt>
						<dd>{activeShare}</dd>
					</div>
					<div>
						<dt>{messages.holderChartOfferedForSale}</dt>
						<dd>{activeOffered}</dd>
					</div>
				</dl>
				<S.Balances className="fungible-holder-chart-balances">
					<div>
						<span>{messages.holderChartTotalBalance}</span>
						<strong>{tokenLabel(active.total, props.state)}</strong>
					</div>
					<div>
						<span>{messages.holderChartListed}</span>
						<strong>
							{BigInt(active.listed) > 0n
								? tokenLabel(active.listed, props.state)
								: messages.holderChartNone}
						</strong>
					</div>
				</S.Balances>
				<S.Legend aria-label={messages.holderChartLegend} className="fungible-holder-chart-legend">
					<span>
						<i aria-hidden="true" /> {messages.holderChartLegendHeld}
					</span>
					<span>
						<i aria-hidden="true" className="is-listed" /> {messages.holderChartLegendListed}
					</span>
				</S.Legend>
			</S.Detail>
		</S.Card>
	);
}
