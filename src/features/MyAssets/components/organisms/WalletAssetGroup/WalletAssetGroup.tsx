import React from 'react';

import type { ResolvedAsset } from 'api/discovery';

import { Button } from 'components/atoms/Button';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Select } from 'components/atoms/Select';
import { AssetCard, tokenBalanceLabel } from 'features/Catalogue';
import {
	assetGroupRevealAnnouncement,
	assetGroupRevealComplete,
	retainedAssetGroupLimit,
} from 'helpers/progressive-assets';
import { useProgressiveAssetPageSize } from 'hooks/useProgressiveAssetPageSize';
import { useProgressiveReveal } from 'hooks/useProgressiveReveal';

import { walletAssetHolding, type WalletAssetKind, type WalletAssetView } from '../../../model/wallet-assets';

export const WalletAssetGroup = React.memo(function WalletAssetGroup(props: {
	title: string;
	results: ResolvedAsset[];
	address: string;
	kind: WalletAssetKind;
	onViewChange(view: WalletAssetView): void;
	settled: boolean;
	view: WalletAssetView;
}) {
	const pageSize = useProgressiveAssetPageSize();
	const [limit, setLimit] = React.useState(pageSize);
	const gridId = React.useId();
	const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
	const resultCountRef = React.useRef(props.results.length);
	const [revealAnnouncement, setRevealAnnouncement] = React.useState('');
	resultCountRef.current = props.results.length;
	const assetLabel = `${props.view === 'listed' ? 'listed ' : ''}${props.kind}`;
	const revealNextAssetPage = React.useCallback(() => {
		setLimit((current) => {
			const nextLimit = Math.min(resultCountRef.current, current + pageSize);
			setRevealAnnouncement(assetGroupRevealAnnouncement(nextLimit, resultCountRef.current, assetLabel));
			return nextLimit;
		});
	}, [assetLabel, pageSize]);
	const progressiveRevealRef = useProgressiveReveal(limit < props.results.length, revealNextAssetPage);
	React.useEffect(() => {
		setLimit(pageSize);
		setRevealAnnouncement('');
	}, [props.address, props.kind, props.view]);
	React.useEffect(() => setLimit((current) => retainedAssetGroupLimit(current, pageSize)), [pageSize]);
	return (
		<section className="asset-group">
			<div className="asset-group-title">
				<div className="asset-group-heading">
					<h2 aria-label={`${props.title}, ${props.results.length.toLocaleString()}`}>{props.title}</h2>
					<span aria-hidden="true">{props.results.length.toLocaleString()}</span>
				</div>
				<Select<'all' | 'listed'>
					label={`${props.title} view`}
					onChange={props.onViewChange}
					options={[
						{ value: 'all', label: 'All assets' },
						{ value: 'listed', label: 'Listed for sale' },
					]}
					showLabel={false}
					value={props.view}
				/>
			</div>
			{props.results.length ? (
				<>
					<div className="asset-grid" id={gridId}>
						{props.results.slice(0, limit).map((result, index) => {
							const holding = walletAssetHolding(result, props.address, props.view);
							return (
								<AssetCard
									key={result.asset.id}
									collection={result.collection}
									asset={result.asset}
									badge={props.view === 'listed' || holding.listed ? 'For sale' : 'Owned'}
									priority={index < 2}
									price={
										result.collection.kind === 'tokens'
											? `${tokenBalanceLabel(holding.balance, result.state)}${
													props.view === 'listed' ? ' listed' : ''
											  }`
											: holding.uniquePrice
									}
									priceListed={Boolean(holding.uniquePrice)}
								/>
							);
						})}
					</div>
					<p
						className={
							props.results.length > pageSize && limit >= props.results.length
								? 'collection-result-count reveal-complete'
								: 'sr-only'
						}
						ref={resultSummaryRef}
						tabIndex={-1}
					>
						{props.results.length > pageSize && limit >= props.results.length
							? `All ${props.results.length.toLocaleString()} ${assetLabel} are shown.`
							: `Showing ${Math.min(
									limit,
									props.results.length
							  ).toLocaleString()} of ${props.results.length.toLocaleString()} ${assetLabel}.`}
					</p>
					<LiveRegion>{revealAnnouncement}</LiveRegion>
				</>
			) : (
				<p className="asset-group-empty">
					{props.settled ? `No ${assetLabel}.` : `Checking for ${assetLabel}…`}
				</p>
			)}
			{props.results.length && limit < props.results.length ? (
				<>
					<span aria-hidden="true" className="progressive-reveal-sentinel" ref={progressiveRevealRef} />
					<Button
						aria-controls={gridId}
						className="load-more"
						size="custom"
						onClick={() => {
							const nextLimit = Math.min(props.results.length, limit + pageSize);
							setLimit(nextLimit);
							setRevealAnnouncement(
								assetGroupRevealAnnouncement(nextLimit, props.results.length, assetLabel)
							);
							window.requestAnimationFrame(() => {
								if (assetGroupRevealComplete(nextLimit, resultCountRef.current)) {
									resultSummaryRef.current?.focus();
								}
							});
						}}
					>
						Show {Math.min(pageSize, props.results.length - limit).toLocaleString()} more {assetLabel}
					</Button>
				</>
			) : null}
		</section>
	);
});

export default WalletAssetGroup;
