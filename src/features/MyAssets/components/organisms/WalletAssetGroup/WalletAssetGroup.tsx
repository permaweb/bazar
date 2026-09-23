import React from 'react';

import type { ResolvedAsset } from 'api/discovery';

import { Button } from 'components/atoms/Button';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Select } from 'components/atoms/Select';
import { AssetCard, tokenBalanceLabel } from 'features/Catalogue';
import { formatMessage } from 'helpers/i18n';
import {
	assetGroupRevealAnnouncement,
	assetGroupRevealComplete,
	retainedAssetGroupLimit,
} from 'helpers/progressive-assets';
import { useProgressiveAssetPageSize } from 'hooks/useProgressiveAssetPageSize';
import { useProgressiveReveal } from 'hooks/useProgressiveReveal';
import { useMessages } from 'providers/LanguageProvider';

import { MY_ASSETS_MESSAGES, type MyAssetsMessages } from '../../../messages';
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
	const language = useMessages(MY_ASSETS_MESSAGES);
	const pageSize = useProgressiveAssetPageSize();
	const [limit, setLimit] = React.useState(pageSize);
	const gridId = React.useId();
	const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
	const resultCountRef = React.useRef(props.results.length);
	const [revealAnnouncement, setRevealAnnouncement] = React.useState('');
	resultCountRef.current = props.results.length;
	const assetLabel = walletAssetGroupLabel(props.kind, props.view, language);
	const revealMessages = React.useMemo(
		() => ({ complete: language.myAssetsGroupRevealComplete, partial: language.myAssetsGroupRevealPartial }),
		[language.myAssetsGroupRevealComplete, language.myAssetsGroupRevealPartial]
	);
	const revealNextAssetPage = React.useCallback(() => {
		setLimit((current) => {
			const nextLimit = Math.min(resultCountRef.current, current + pageSize);
			setRevealAnnouncement(
				assetGroupRevealAnnouncement(nextLimit, resultCountRef.current, assetLabel, revealMessages)
			);
			return nextLimit;
		});
	}, [assetLabel, pageSize, revealMessages]);
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
					<h2
						aria-label={formatMessage(language.myAssetsGroupHeading, {
							title: props.title,
							count: props.results.length.toLocaleString(),
						})}
					>
						{props.title}
					</h2>
					<span aria-hidden="true">{props.results.length.toLocaleString()}</span>
				</div>
				<Select<'all' | 'listed'>
					label={formatMessage(language.myAssetsGroupViewLabel, { title: props.title })}
					onChange={props.onViewChange}
					options={[
						{ value: 'all', label: language.myAssetsGroupViewAll },
						{ value: 'listed', label: language.myAssetsGroupViewListed },
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
									badge={
										props.view === 'listed' || holding.listed
											? language.myAssetsBadgeForSale
											: language.myAssetsBadgeOwned
									}
									priority={index < 2}
									price={
										result.collection.kind === 'tokens'
											? walletTokenPriceLabel(holding.balance, result.state, props.view, language)
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
							? formatMessage(revealMessages.complete, {
									count: props.results.length.toLocaleString(),
									assets: assetLabel,
							  })
							: formatMessage(revealMessages.partial, {
									shown: Math.min(limit, props.results.length).toLocaleString(),
									count: props.results.length.toLocaleString(),
									assets: assetLabel,
							  })}
					</p>
					<LiveRegion>{revealAnnouncement}</LiveRegion>
				</>
			) : (
				<p className="asset-group-empty">
					{formatMessage(props.settled ? language.myAssetsGroupEmpty : language.myAssetsGroupChecking, {
						assets: assetLabel,
					})}
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
								assetGroupRevealAnnouncement(
									nextLimit,
									props.results.length,
									assetLabel,
									revealMessages
								)
							);
							window.requestAnimationFrame(() => {
								if (assetGroupRevealComplete(nextLimit, resultCountRef.current)) {
									resultSummaryRef.current?.focus();
								}
							});
						}}
					>
						{formatMessage(language.myAssetsGroupShowMore, {
							count: Math.min(pageSize, props.results.length - limit).toLocaleString(),
							assets: assetLabel,
						})}
					</Button>
				</>
			) : null}
		</section>
	);
});

/** The noun phrase the group's counts and empty states are written around, as one message per kind and view. */
function walletAssetGroupLabel(kind: WalletAssetKind, view: WalletAssetView, language: MyAssetsMessages): string {
	if (view === 'listed') {
		return kind === 'tokens' ? language.myAssetsGroupAssetsListedTokens : language.myAssetsGroupAssetsListedUniques;
	}
	return kind === 'tokens' ? language.myAssetsGroupAssetsTokens : language.myAssetsGroupAssetsUniques;
}

function walletTokenPriceLabel(
	balance: string,
	state: ResolvedAsset['state'],
	view: WalletAssetView,
	language: MyAssetsMessages
): string {
	const label = tokenBalanceLabel(balance, state);
	return view === 'listed' ? formatMessage(language.myAssetsListedBalance, { balance: label }) : label;
}

export default WalletAssetGroup;
